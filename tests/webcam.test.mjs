import test from "node:test";
import assert from "node:assert/strict";

import { getCameraConstraints, mapCameraError, stopMediaStream } from "../lib/webcam.ts";

test("getCameraConstraints defaults to a 1280x720 user-facing camera with audio disabled", () => {
  assert.deepEqual(getCameraConstraints(), {
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });
});

test("getCameraConstraints honors width and height overrides", () => {
  assert.deepEqual(getCameraConstraints({ width: 1920, height: 1080 }), {
    video: {
      facingMode: "user",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: false
  });
});

test("getCameraConstraints throws RangeError for invalid width values", () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => getCameraConstraints({ width }), RangeError);
  }
});

test("getCameraConstraints throws RangeError for invalid height values", () => {
  for (const height of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => getCameraConstraints({ height }), RangeError);
  }
});

test("mapCameraError maps documented spec errors", () => {
  assert.deepEqual(mapCameraError({ name: "NotAllowedError" }), {
    code: "NotAllowedError",
    message:
      "Camera permission denied. Click the lock icon in your browser address bar to allow VirtualFit to use your camera."
  });
  assert.deepEqual(mapCameraError({ name: "NotFoundError" }), {
    code: "NotFoundError",
    message: "No camera detected. Plug in a webcam or try a device with a built-in camera."
  });
  assert.deepEqual(mapCameraError({ name: "NotReadableError" }), {
    code: "NotReadableError",
    message: "Camera is in use by another app. Close other tabs/apps using the camera and try again."
  });
  assert.deepEqual(mapCameraError({ name: "OverconstrainedError" }), {
    code: "OverconstrainedError",
    message: "Your camera does not support the requested 1280×720 resolution. Try a different device."
  });
});

test("mapCameraError returns unknown code for non-Error inputs", () => {
  assert.deepEqual(mapCameraError("unknown"), {
    code: "unknown",
    message: "Camera could not start."
  });
  assert.deepEqual(mapCameraError(null), {
    code: "unknown",
    message: "Camera could not start."
  });
});

test('mapCameraError prefixes a generic Error with "Camera could not start: "', () => {
  assert.deepEqual(mapCameraError(new Error("device offline")), {
    code: "Error",
    message: "Camera could not start: device offline"
  });
});

test("stopMediaStream is a no-op for null and undefined", () => {
  assert.doesNotThrow(() => stopMediaStream(null));
  assert.doesNotThrow(() => stopMediaStream(undefined));
});

test("stopMediaStream calls stop on every track", () => {
  const stopped = [];
  const stream = {
    getTracks() {
      return [
        { stop() { stopped.push("video"); } },
        { stop() { stopped.push("audio"); } }
      ];
    }
  };

  stopMediaStream(stream);

  assert.deepEqual(stopped, ["video", "audio"]);
});

test("stopMediaStream swallows getTracks failures", () => {
  const stream = {
    getTracks() {
      throw new Error("boom");
    }
  };

  assert.doesNotThrow(() => stopMediaStream(stream));
});
