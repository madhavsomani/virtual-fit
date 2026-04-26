// Phase 7.86 — Server-side HF proxy. The token never leaves the server.
//
// Route: POST /api/hf-proxy/{owner}/{model}
//   e.g. POST /api/hf-proxy/mattmdjaga/segformer_b2_clothes
//        POST /api/hf-proxy/briaai/RMBG-1.4
//
// Body: raw image bytes (forwarded as application/octet-stream).
// Response: forwarded HF response (image/png blob OR JSON mask array).
//
// Server reads HF_TOKEN from process.env (Azure SWA Application Settings,
// NOT NEXT_PUBLIC_*). The token is added to the outbound HF request and
// never echoed back to the client. The client makes the same call shape
// it used to make to api-inference.huggingface.co, just to /api/hf-proxy/…
// instead — so the rest of the segformer/RMBG/mask-decode pipeline is
// unchanged.
//
// Why this matters: pre-7.86 the three lib files (garment-segment,
// remove-background, trellis-client) all read NEXT_PUBLIC_HF_TOKEN at
// call time. NEXT_PUBLIC_* env vars are inlined into client JS chunks
// at `next build` time. CI doesn't have the token in the build env, so
// the inline yields `undefined`, the libs throw "NEXT_PUBLIC_HF_TOKEN
// is not configured", and the entire Photo→3D pipeline (the VISION) is
// broken on production for every end user. If we DID pass the token
// through CI it would ship publicly in the chunk and the Phase 7.83
// scanner would correctly block the deploy.
//
// This proxy breaks the dilemma: token only exists server-side, client
// makes an unauthenticated call to our own origin, server adds auth.
// Standard pattern.
//
// Allowlist: we ONLY proxy to the segformer + RMBG models (the two HF
// inference endpoints the client needs). TRELLIS uses a different
// Gradio Space contract (queue/join + SSE + multipart upload) that
// can't be expressed as a single octet-stream forward — that gets a
// dedicated proxy in Phase 7.87.

const ALLOWED_MODELS = new Set([
  "mattmdjaga/segformer_b2_clothes",
  "briaai/RMBG-1.4",
]);

const HF_INFERENCE_BASE = "https://api-inference.huggingface.co/models";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "3600",
};

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  // The route binding `hf-proxy/{*model}` puts the catch-all in
  // context.bindingData.model (e.g. "mattmdjaga/segformer_b2_clothes").
  const model = context.bindingData && context.bindingData.model;
  if (!model || typeof model !== "string") {
    context.res = {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: { error: "Missing model path. Use /api/hf-proxy/{owner}/{model}." },
    };
    return;
  }

  if (!ALLOWED_MODELS.has(model)) {
    // Don't echo arbitrary client input into upstream — block unknown
    // model paths so this proxy can't be turned into an open-relay
    // for the operator's HF account quota.
    context.res = {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: {
        error: "Model not allowlisted on this proxy.",
        allowed: Array.from(ALLOWED_MODELS),
      },
    };
    return;
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    // 503 (not 500) — Phase 7.82 pattern: hard-fail loudly when an
    // operator-configured secret is missing, instead of silently
    // succeeding with broken behavior.
    context.res = {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: {
        error:
          "HF_TOKEN is not configured on this Azure SWA. Set it in the SWA's Application Settings (NOT as NEXT_PUBLIC_HF_TOKEN — that would inline into client bundles).",
      },
    };
    return;
  }

  // Body comes through as a Buffer when Content-Type is binary on
  // Azure Functions v4 host. Defensive: also handle string + base64.
  let body = req.body;
  if (!body) {
    context.res = {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: { error: "Missing request body (raw image bytes required)." },
    };
    return;
  }
  if (typeof body === "string") {
    // SWA sometimes base64-encodes binary bodies. The Buffer.from
    // round-trip is a no-op for raw strings and a decode for base64.
    body = Buffer.from(body, "base64");
  }

  // Cap upload size to defend the proxy against amplification abuse.
  // 8 MB is generous for a single garment photo (camera frames are
  // typically <2 MB after JPEG compression).
  const MAX_BYTES = 8 * 1024 * 1024;
  const size = Buffer.isBuffer(body) ? body.length : (body.byteLength || 0);
  if (size > MAX_BYTES) {
    context.res = {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: {
        error: `Request body too large (${size} bytes). Max is ${MAX_BYTES}.`,
      },
    };
    return;
  }

  const upstreamUrl = `${HF_INFERENCE_BASE}/${model}`;
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type":
          req.headers["content-type"] || "application/octet-stream",
        Accept: req.headers["accept"] || "*/*",
      },
      body,
    });
  } catch (err) {
    context.log.error(`HF proxy upstream fetch failed: ${err && err.message}`);
    context.res = {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: { error: "Upstream HF fetch failed", detail: String(err && err.message) },
    };
    return;
  }

  // Forward upstream content-type so the client gets PNG bytes for RMBG
  // and JSON for segformer multi-class output transparently.
  const upstreamCT = upstream.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await upstream.arrayBuffer());

  context.res = {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": upstreamCT,
      // Defensive: scrub any HF-side cookies/auth headers that might
      // somehow be set. We're not a transparent proxy.
      "Cache-Control": "no-store",
    },
    body: buf,
    isRaw: true,
  };
};
