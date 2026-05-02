/**
 * TRELLIS HF Space adapter — calls the public microsoft/TRELLIS HuggingFace
 * Space via its Gradio queue API. Free ZeroGPU A10G tier, no API key needed.
 *
 * Uses raw fetch (no gradio-client dep). Proven approach from VirtualFit v2.
 *
 * Multi-step pipeline with shared session hash:
 *   1. Upload image
 *   2. /start_session — allocate GPU
 *   3. /preprocess_image — remove background, center object
 *   4. /image_to_3d — generate 3D Gaussian splatting
 *   5. /extract_glb — extract textured GLB mesh
 *   6. Download GLB binary
 *
 * Each step uses queue/join → queue/data (SSE), sharing one session_hash
 * so TRELLIS maintains server-side state across the pipeline.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Blob as NodeBlob } from "node:buffer";

const TRELLIS_BASE = "https://microsoft-trellis.hf.space";
const STEP_TIMEOUT_MS = 300_000; // 5 min per step

function makeSessionHash() {
  return Math.random().toString(36).slice(2, 14);
}

function extractGlbPath(data) {
  const seen = new Set();
  function walk(x) {
    if (!x || seen.has(x)) return null;
    if (typeof x === "string") return x.endsWith(".glb") ? x : null;
    if (typeof x !== "object") return null;
    seen.add(x);
    if (typeof x.path === "string" && x.path.endsWith(".glb")) return x.path;
    if (typeof x.url === "string" && x.url.endsWith(".glb")) return x.url;
    if (typeof x.name === "string" && x.name.endsWith(".glb")) return x.name;
    if (Array.isArray(x)) {
      for (const item of x) { const r = walk(item); if (r) return r; }
    } else {
      for (const v of Object.values(x)) { const r = walk(v); if (r) return r; }
    }
    return null;
  }
  return walk(data);
}

/** Resolve fn_index for a named endpoint from /config. */
let _fnIndexCache = null;
async function resolveFnIndex(base, apiName) {
  if (_fnIndexCache && _fnIndexCache[apiName] != null) return _fnIndexCache[apiName];
  const configRes = await fetch(`${base}/config`);
  if (!configRes.ok) throw new Error(`TRELLIS /config ${configRes.status}`);
  const config = await configRes.json();
  const cache = {};
  if (Array.isArray(config.dependencies)) {
    for (let i = 0; i < config.dependencies.length; i++) {
      const dep = config.dependencies[i];
      if (dep.api_name) {
        cache[dep.api_name] = i;
        if (dep.api_name.startsWith("/")) cache[dep.api_name.slice(1)] = i;
        else cache["/" + dep.api_name] = i;
      }
    }
  }
  _fnIndexCache = cache;
  if (!(apiName in cache)) {
    throw new Error(`TRELLIS endpoint ${apiName} not found. Available: ${Object.keys(cache).join(", ")}`);
  }
  return cache[apiName];
}

async function uploadImage(base, imageBytes) {
  const fd = new FormData();
  const blob = new NodeBlob([imageBytes], { type: "image/png" });
  fd.append("files", blob, "garment.png");
  const res = await fetch(`${base}/upload`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TRELLIS upload ${res.status}: ${body.slice(0, 200)}`);
  }
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("TRELLIS upload returned empty path array");
  }
  return arr[0];
}

/**
 * Call a single Gradio endpoint via queue/join + SSE queue/data.
 * Returns the output.data from process_completed.
 */
async function callEndpoint(base, apiName, inputData, sessionHash, timeoutMs) {
  const fnIndex = await resolveFnIndex(base, apiName);

  // Submit to queue
  const joinRes = await fetch(`${base}/queue/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: inputData,
      event_data: null,
      fn_index: fnIndex,
      trigger_id: 0,
      session_hash: sessionHash,
    }),
  });
  if (!joinRes.ok) {
    const body = await joinRes.text().catch(() => "");
    throw new Error(`TRELLIS queue/join ${apiName} ${joinRes.status}: ${body.slice(0, 300)}`);
  }

  // Wait for result via SSE
  const url = `${base}/queue/data?session_hash=${sessionHash}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`TRELLIS ${apiName} timeout`)), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/event-stream" },
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`TRELLIS queue/data ${apiName} ${res.status}`);
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
        let evt;
        try { evt = JSON.parse(payload); } catch { continue; }
        const msg = evt?.msg;
        if (msg === "estimation" || msg === "progress") {
          const pct = evt?.progress != null ? ` (${Math.round(evt.progress * 100)}%)` : "";
          process.stdout.write(`[TRELLIS] ${apiName} ${msg}${pct}\n`);
        } else if (msg === "process_completed") {
          if (evt?.success === false) {
            console.error(`[TRELLIS] ${apiName} FAILED: ${String(JSON.stringify(evt)).slice(0, 800)}`);
            throw new Error(`TRELLIS ${apiName} failed (success=false, error=${evt?.output?.error || "null"})`);
          }
          return evt?.output?.data;
        } else if (msg === "process_failed" || msg === "queue_full") {
          throw new Error(`TRELLIS ${apiName} ${msg}: ${String(JSON.stringify(evt)).slice(0, 300)}`);
        }
      }
    }
    throw new Error(`TRELLIS ${apiName} stream ended without completion`);
  } finally {
    clearTimeout(timer);
  }
}

export const trellisAdapter = {
  name: "trellis",

  async generate({ garmentId, sourceImageUrl, outputAbsPath }) {
    const base = process.env.TRELLIS_SPACE_URL || TRELLIS_BASE;

    // 1. Read image bytes
    let imageBytes;
    if (sourceImageUrl.startsWith("http://") || sourceImageUrl.startsWith("https://")) {
      const res = await fetch(sourceImageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      imageBytes = Buffer.from(await res.arrayBuffer());
    } else {
      imageBytes = await readFile(sourceImageUrl);
    }
    console.log(`[TRELLIS] Image loaded for ${garmentId} (${imageBytes.length} bytes)`);

    // 2. Upload image
    const serverPath = await uploadImage(base, imageBytes);
    console.log(`[TRELLIS] Uploaded → ${serverPath}`);

    const fileData = {
      path: serverPath,
      meta: { _type: "gradio.FileData" },
      orig_name: "garment.png",
    };

    // All steps share ONE session hash so TRELLIS keeps GPU state.
    const sessionHash = makeSessionHash();

    // 3. Start GPU session
    console.log(`[TRELLIS] Step 0/3: Starting GPU session...`);
    await callEndpoint(base, "/start_session", [], sessionHash, STEP_TIMEOUT_MS);
    console.log(`[TRELLIS] GPU session active`);

    // 4. Preprocess image (background removal + centering)
    console.log(`[TRELLIS] Step 1/3: Preprocessing image...`);
    const preprocessed = await callEndpoint(
      base, "/preprocess_image", [fileData], sessionHash, STEP_TIMEOUT_MS
    );
    console.log(`[TRELLIS] Preprocessed: ${String(JSON.stringify(preprocessed)).slice(0, 200)}`);

    const preprocessedImage = Array.isArray(preprocessed) ? preprocessed[0] : preprocessed;

    // 5. Image → 3D (with retry for transient ZeroGPU failures)
    console.log(`[TRELLIS] Step 2/3: Generating 3D model (30-90s)...`);
    let gen3d;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        gen3d = await callEndpoint(
          base,
          "/image_to_3d",
          [
            preprocessedImage,
            [],            // multiimages
            0,             // seed
            7.5,           // ss_guidance_strength
            12,            // ss_sampling_steps
            3,             // slat_guidance_strength
            12,            // slat_sampling_steps
            "stochastic",  // multiimage_algo
          ],
          sessionHash,
          STEP_TIMEOUT_MS
        );
        break;
      } catch (err) {
        console.error(`[TRELLIS] image_to_3d attempt ${attempt}/3: ${err.message}`);
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, attempt * 5000));
      }
    }
    console.log(`[TRELLIS] 3D model generated`);

    // 6. Extract GLB mesh
    console.log(`[TRELLIS] Step 3/3: Extracting GLB mesh...`);
    const glbOutput = await callEndpoint(
      base, "/extract_glb", [0.95, 1024], sessionHash, STEP_TIMEOUT_MS
    );
    console.log(`[TRELLIS] GLB output: ${String(JSON.stringify(glbOutput)).slice(0, 300)}`);

    // 7. Find GLB path
    const glbPath = extractGlbPath(glbOutput);
    if (!glbPath) {
      throw new Error(`No GLB path in extract_glb output: ${String(JSON.stringify(glbOutput)).slice(0, 500)}`);
    }
    const glbUrl = glbPath.startsWith("http") ? glbPath : `${base}/file=${glbPath}`;
    console.log(`[TRELLIS] GLB URL: ${glbUrl}`);

    // 8. Download GLB binary
    const glbRes = await fetch(glbUrl);
    if (!glbRes.ok) throw new Error(`Failed to download GLB: ${glbRes.status}`);
    const glbBuffer = Buffer.from(await glbRes.arrayBuffer());

    // 9. Validate
    if (glbBuffer.length <= 12) {
      throw new Error(`TRELLIS returned invalid GLB (${glbBuffer.length} bytes)`);
    }
    const magic = glbBuffer.toString("ascii", 0, 4);
    if (magic !== "glTF") {
      throw new Error(`TRELLIS returned non-GLB file (magic: ${magic})`);
    }
    console.log(`[TRELLIS] Valid GLB: ${glbBuffer.length} bytes (glTF v${glbBuffer.readUInt32LE(4)})`);

    // 10. Write to disk
    await mkdir(dirname(outputAbsPath), { recursive: true });
    await writeFile(outputAbsPath, glbBuffer);
    console.log(`[TRELLIS] Saved → ${outputAbsPath}`);

    return { outputAssetUrl: `/garments/${garmentId}.glb` };
  },
};
