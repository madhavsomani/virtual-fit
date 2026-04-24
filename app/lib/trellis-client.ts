// Phase 4.3 — TRELLIS image→3D mesh client.
// Calls the public microsoft/TRELLIS HF Space directly. Free ZeroGPU A10G tier.
//
// Endpoints (Gradio queue API):
//   POST {SPACE}/queue/join     — enqueue with input image
//   GET  {SPACE}/queue/data?session_hash=… — SSE stream of results
//
// We expose a Promise-based wrapper that uploads the segmented garment PNG
// and resolves with a downloadable .glb URL.
//
// Token: NEXT_PUBLIC_HF_TOKEN (browser-callable HF read token).
//
// Phase 7.29: extractGlbPath() now lives in trellis-helpers.mjs (single
// truth source). This module just re-exports the typed binding so the
// recursive .glb-path walker isn't maintained in two places.
import { extractGlbPath as _extractGlbPath } from "./trellis-helpers.mjs";

export const extractGlbPath: (data: unknown) => string | null = _extractGlbPath;

const TRELLIS_BASE = "https://microsoft-trellis.hf.space";

export type TrellisOptions = {
  token?: string;
  signal?: AbortSignal;
  /** Override the HF Space base URL (e.g. for a personal duplicate). */
  spaceBase?: string;
  /** Max wait per stage in ms; default 240_000 (4 min, ZeroGPU cold start). */
  timeoutMs?: number;
};

export type TrellisProgress = {
  stage: "preprocess" | "image_to_3d" | "extract_glb" | "complete";
  /** 0..1 fractional progress within the current stage if known. */
  fraction?: number;
  message?: string;
};

function getToken(opts?: TrellisOptions): string {
  const t = opts?.token || process.env.NEXT_PUBLIC_HF_TOKEN;
  if (!t) {
    throw new Error("NEXT_PUBLIC_HF_TOKEN is required for TRELLIS image→3D");
  }
  return t;
}

function makeSessionHash(): string {
  return Math.random().toString(36).slice(2, 14);
}

async function uploadFile(
  base: string,
  token: string,
  file: Blob,
  signal?: AbortSignal,
): Promise<string> {
  // Gradio file-upload endpoint: POST multipart, returns ["<server-side-path>"]
  const fd = new FormData();
  const named = new File([file], "garment.png", { type: file.type || "image/png" });
  fd.append("files", named);
  const res = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TRELLIS upload ${res.status}: ${body.slice(0, 200)}`);
  }
  const arr: string[] = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("TRELLIS upload returned empty path array");
  }
  return arr[0];
}

/**
 * Phase 4.3 — Convert a garment image to a downloadable GLB via TRELLIS.
 *
 * This is a thin wrapper. Because the public TRELLIS Space's exact
 * fn_index/queue contract changes between versions, we keep the wire
 * code small and delegate the per-stage retry logic to the caller
 * for now (Phase 4.4 will add an end-to-end test against the real
 * Space; until then, this is integration-shaped scaffolding).
 */
export async function generateGlbFromImage(
  garmentPng: Blob,
  onProgress?: (p: TrellisProgress) => void,
  opts?: TrellisOptions,
): Promise<{ glbUrl: string; sessionHash: string }> {
  const base = opts?.spaceBase || TRELLIS_BASE;
  const token = getToken(opts);
  const signal = opts?.signal;

  onProgress?.({ stage: "preprocess", message: "Uploading image to TRELLIS…" });
  const serverPath = await uploadFile(base, token, garmentPng, signal);

  onProgress?.({ stage: "image_to_3d", message: "Generating 3D mesh (~30–90s)…" });
  // Submit a queue/join request. The exact `fn_index` for the image→3d entrypoint
  // is read from the Space's /info endpoint at call-time (cached per base URL).
  const info = await fetchSpaceInfo(base, token, signal);
  const fnIndex = info.image_to_3d_fn_index;
  const sessionHash = makeSessionHash();

  const joinRes = await fetch(`${base}/queue/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [{ path: serverPath }],
      event_data: null,
      fn_index: fnIndex,
      trigger_id: 0,
      session_hash: sessionHash,
    }),
    signal,
  });
  if (!joinRes.ok) {
    const body = await joinRes.text().catch(() => "");
    throw new Error(`TRELLIS queue/join ${joinRes.status}: ${body.slice(0, 200)}`);
  }

  // Poll the SSE stream until we see a "process_completed" event.
  const glbUrl = await streamUntilGlb(
    base,
    token,
    sessionHash,
    onProgress,
    signal,
    opts?.timeoutMs ?? 240_000,
  );

  onProgress?.({ stage: "complete", message: "GLB ready" });
  return { glbUrl, sessionHash };
}

type SpaceInfo = {
  image_to_3d_fn_index: number;
};

const infoCache = new Map<string, SpaceInfo>();

async function fetchSpaceInfo(
  base: string,
  token: string,
  signal?: AbortSignal,
): Promise<SpaceInfo> {
  const cached = infoCache.get(base);
  if (cached) return cached;
  const res = await fetch(`${base}/info`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) {
    throw new Error(`TRELLIS /info ${res.status}`);
  }
  const data: { named_endpoints?: Record<string, { fn_index?: number }> } = await res.json();
  const named = data.named_endpoints || {};
  // Try common entrypoint names; fall back to fn_index 0.
  const candidates = [
    "/image_to_3d",
    "/generate_3d",
    "/run",
  ];
  let fn = 0;
  for (const c of candidates) {
    if (named[c] && typeof named[c].fn_index === "number") {
      fn = named[c].fn_index!;
      break;
    }
  }
  const info: SpaceInfo = { image_to_3d_fn_index: fn };
  infoCache.set(base, info);
  return info;
}

async function streamUntilGlb(
  base: string,
  token: string,
  sessionHash: string,
  onProgress: ((p: TrellisProgress) => void) | undefined,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<string> {
  const url = `${base}/queue/data?session_hash=${sessionHash}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error("TRELLIS stream timeout")), timeoutMs);
  if (signal) {
    signal.addEventListener("abort", () => ac.abort(signal.reason));
  }
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`TRELLIS queue/data ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let evt: { msg?: string; progress?: number; message?: string; output?: { data?: unknown } };
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        const msg: string | undefined = evt?.msg;
        if (msg === "estimation" || msg === "progress") {
          onProgress?.({ stage: "image_to_3d", fraction: evt?.progress, message: evt?.message });
        } else if (msg === "process_completed") {
          const out = evt?.output?.data;
          const glbPath = extractGlbPath(out);
          if (glbPath) {
            return glbPath.startsWith("http") ? glbPath : `${base}/file=${glbPath}`;
          }
          throw new Error("TRELLIS completed without a GLB path");
        } else if (msg === "process_failed" || msg === "queue_full") {
          throw new Error(`TRELLIS ${msg}: ${JSON.stringify(evt).slice(0, 200)}`);
        }
      }
    }
    throw new Error("TRELLIS stream ended without completion");
  } finally {
    clearTimeout(timer);
  }
}

// extractGlbPath was deleted in Phase 7.29 — see import at top of file.
