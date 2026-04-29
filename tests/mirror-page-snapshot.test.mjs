import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mirrorPage = readFileSync(new URL("../app/mirror/page.tsx", import.meta.url), "utf8");
const webcamMirror = readFileSync(new URL("../app/mirror/WebcamMirror.tsx", import.meta.url), "utf8");

test("mirror page includes the privacy footer copy", () => {
  assert.equal(mirrorPage.includes("Camera stays on your device"), true);
});

test('mirror page contains an Exit link to "/"', () => {
  assert.match(mirrorPage, /href="\/"[\s\S]*Exit|Exit[\s\S]*href="\/"/);
});

test("WebcamMirror keeps webcam imports from lib/webcam", () => {
  assert.match(
    webcamMirror,
    /import\s*\{\s*getCameraConstraints,\s*mapCameraError,\s*stopMediaStream\s*\}\s*from\s*"@\/lib\/webcam"/
  );
});

test("WebcamMirror wires Capture disabled state to isActive", () => {
  assert.match(webcamMirror, /Capture/);
  assert.match(webcamMirror, /disabled=\{[^}]*isActive[^}]*\}/);
});

test("WebcamMirror contains all status labels", () => {
  for (const label of ["Idle", "Connecting", "Live", "Error"]) {
    assert.equal(webcamMirror.includes(label), true);
  }
});
