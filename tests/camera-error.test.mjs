import { test } from "node:test";
import assert from "node:assert/strict";

import { describeCameraError } from "../lib/camera-error.ts";

test("permission denied → asks user to allow camera", () => {
  const err = Object.assign(new Error("denied"), { name: "NotAllowedError" });
  assert.match(describeCameraError(err), /permission/i);
});

test("no camera → reports not found", () => {
  const err = Object.assign(new Error("nope"), { name: "NotFoundError" });
  assert.match(describeCameraError(err), /no usable camera/i);
});

test("busy → tells user another app/tab is using it", () => {
  const err = Object.assign(new Error("busy"), { name: "NotReadableError" });
  assert.match(describeCameraError(err), /busy/i);
});

test("unknown Error → returns short message", () => {
  const err = new Error("MediaPipe failed to load wasm");
  assert.equal(describeCameraError(err), "MediaPipe failed to load wasm");
});

test("non-Error fallback", () => {
  assert.equal(describeCameraError(null), "Camera unavailable.");
  assert.equal(describeCameraError("oops"), "Camera unavailable.");
});

test("long error message is truncated to 140 chars", () => {
  const long = "x".repeat(500);
  assert.equal(describeCameraError(new Error(long)).length, 140);
});
