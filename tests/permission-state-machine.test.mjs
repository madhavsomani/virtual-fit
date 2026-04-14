import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyCameraError,
  initialPermissionState,
  reducePermissionState
} from "../app/mirror/permission-state-machine.js";

test("permission state machine: start -> success", () => {
  const requesting = reducePermissionState(initialPermissionState, { type: "request-start" });
  assert.equal(requesting.stage, "requesting");
  assert.equal(requesting.cameraError, null);
  assert.equal(requesting.cameraErrorKind, null);

  const live = reducePermissionState(requesting, { type: "request-success" });
  assert.equal(live.stage, "live");
  assert.equal(live.cameraError, null);
  assert.equal(live.cameraErrorKind, null);
});

test("permission state machine: failure then retry increments retryCount and clears error", () => {
  const failed = reducePermissionState(initialPermissionState, {
    type: "request-failure",
    kind: "permission-denied",
    message: "denied"
  });

  assert.equal(failed.stage, "error");
  assert.equal(failed.cameraErrorKind, "permission-denied");
  assert.equal(failed.cameraError, "denied");

  const retrying = reducePermissionState(failed, { type: "retry" });
  assert.equal(retrying.stage, "requesting");
  assert.equal(retrying.retryCount, 1);
  assert.equal(retrying.cameraError, null);
  assert.equal(retrying.cameraErrorKind, null);
});

test("permission state machine: stop returns to idle and clears error", () => {
  const failed = reducePermissionState(initialPermissionState, {
    type: "request-failure",
    kind: "unsupported",
    message: "not supported"
  });

  const stopped = reducePermissionState(failed, { type: "stop" });
  assert.equal(stopped.stage, "idle");
  assert.equal(stopped.cameraError, null);
  assert.equal(stopped.cameraErrorKind, null);
});

test("classifyCameraError maps known DOMException names", () => {
  const denied = classifyCameraError(new DOMException("denied", "NotAllowedError"));
  assert.equal(denied.kind, "permission-denied");

  const notFound = classifyCameraError(new DOMException("missing", "NotFoundError"));
  assert.equal(notFound.kind, "not-found");

  const busy = classifyCameraError(new DOMException("busy", "NotReadableError"));
  assert.equal(busy.kind, "not-readable");
});

test("classifyCameraError falls back to unknown", () => {
  const regularError = classifyCameraError(new Error("boom"));
  assert.equal(regularError.kind, "unknown");
  assert.equal(regularError.message, "boom");

  const unknown = classifyCameraError("unexpected");
  assert.equal(unknown.kind, "unknown");
  assert.equal(unknown.message, "Camera permission failed.");
});
