// Phase 7.93 — guard: mirror/page.tsx upload-path catch block must humanize the error.
//
// Pre-7.93 the catch block at ~line 1566 rendered raw error.message in the
// status banner: "❌ 3D failed: TRELLIS queue_full: {...}. Garment must be
// 3D — re-upload as GLB." which contradicted the actual failure (queue
// busy != "must be GLB") AND leaked internals.
//
// Post-7.93 it should call humanizePipelineError(err) and render
// "❌ <title> — <action>" using the same humanizer as /generate-3d (7.92).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/mirror/page.tsx"),
  "utf8",
);

test("mirror imports humanizePipelineError from ../lib/humanize-pipeline-error", () => {
  assert.match(
    SRC,
    /import\s*\{\s*humanizePipelineError\s*\}\s*from\s*["']\.\.\/lib\/humanize-pipeline-error["']/,
  );
});

test("mirror upload-path catch calls humanizePipelineError(err)", () => {
  // Locate the upload-path try/catch (the one with the imageToGlbPipeline call).
  const start = SRC.indexOf("imageToGlbPipeline(file");
  assert.ok(start > 0, "expected imageToGlbPipeline(file, ...) call site");
  const region = SRC.slice(start, start + 4500);
  assert.match(
    region,
    /catch\s*\([^)]*\)\s*\{[\s\S]{0,800}humanizePipelineError\s*\(\s*err\s*\)/,
    "upload-path catch must humanize the raw error",
  );
});

test("mirror upload-path catch no longer renders raw error.message in setStatus", () => {
  // Specifically the "❌ 3D failed: ${msg}. Garment must be 3D — re-upload as GLB." line.
  // It contradicted the actual failure when the cause was the TRELLIS queue,
  // a network blip, or a too-large photo. Lock against regression.
  assert.doesNotMatch(
    SRC,
    /❌ 3D failed: \$\{msg\}\. Garment must be 3D/,
    "the misleading hard-coded 'must be GLB' error string must be gone",
  );
});

test("mirror upload-path catch still console.error's the raw message for support", () => {
  // We humanize the user-facing copy but want the raw error in dev consoles.
  const start = SRC.indexOf("imageToGlbPipeline(file");
  const region = SRC.slice(start, start + 4500);
  assert.match(
    region,
    /console\.error\(\s*['"]3D upload failed:['"]\s*,\s*msg\s*\)/,
    "raw msg must still hit console.error for support debugging",
  );
});
