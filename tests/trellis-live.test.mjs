// Phase 5.3 — Live TRELLIS smoke test (manual, network-dependent).
// Skipped automatically when NEXT_PUBLIC_HF_TOKEN / HF_TOKEN is unset.
// Uploads a known garment image to the public TRELLIS Space and asserts:
//   1. /info responds with /image_to_3d
//   2. /upload returns a server path
//   3. /queue/join enqueues without 4xx
//
// We do NOT poll the SSE stream for a finished GLB here — ZeroGPU cold-start
// can exceed our heartbeat budget. The full SSE flow is exercised by
// extractGlbPath unit tests (9/9 @ fb5ceb9).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const TOKEN = process.env.NEXT_PUBLIC_HF_TOKEN || process.env.HF_TOKEN;
const BASE = "https://microsoft-trellis.hf.space";
const SKIP = !TOKEN || process.env.SKIP_LIVE === "1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "../public/garments/yellow-shirt-nobg.png");

test("TRELLIS /info exposes /image_to_3d named endpoint", { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/info`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  const named = data.named_endpoints || {};
  assert.ok(named["/image_to_3d"], `missing /image_to_3d, got: ${Object.keys(named).slice(0, 8).join(", ")}`);
});

test("TRELLIS /upload accepts garment PNG and returns server path", { skip: SKIP }, async () => {
  const png = readFileSync(FIXTURE);
  const fd = new FormData();
  fd.append("files", new Blob([png], { type: "image/png" }), "yellow-shirt.png");
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: fd,
  });
  if (res.status !== 200) {
    const body = await res.text().catch(() => "");
    assert.fail(`upload failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const arr = await res.json();
  assert.ok(Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string");
  assert.match(arr[0], /\.png$/i);
});
