import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { trellisAdapter } from "../lib/garment-pipeline-trellis-adapter.mjs";

test("trellisAdapter.name is 'trellis'", () => {
  assert.equal(trellisAdapter.name, "trellis");
});

test("trellisAdapter.generate is an async function", () => {
  assert.equal(typeof trellisAdapter.generate, "function");
});

test("trellisAdapter source code calls microsoft-trellis.hf.space (not a stub)", () => {
  const source = readFileSync("lib/garment-pipeline-trellis-adapter.mjs", "utf8");
  assert.match(source, /microsoft-trellis\.hf\.space/, "must reference the real TRELLIS HF Space");
  assert.match(source, /queue\/join/, "must call the Gradio queue/join endpoint");
  assert.match(source, /queue\/data/, "must poll the Gradio queue/data SSE stream");
  assert.match(source, /\/upload/, "must upload image to the Space");
  assert.match(source, /extractGlbPath/, "must extract GLB path from response");
  assert.doesNotMatch(source, /approval pending/i, "must NOT contain approval-pending blocker");
});

test("trellisAdapter rejects gracefully on invalid local file", async () => {
  await assert.rejects(
    trellisAdapter.generate({
      garmentId: "core-crew-tee",
      sourceImageUrl: "/tmp/nonexistent-image-12345.png",
      outputAbsPath: "/tmp/core-crew-tee.glb"
    }),
    (error) => {
      assert.equal(error instanceof Error, true);
      // Should fail on file read, not on "approval pending"
      assert.doesNotMatch(error.message, /approval pending/i);
      return true;
    }
  );
});
