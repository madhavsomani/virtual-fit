import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const webcamMirror = readFileSync(new URL("../app/mirror/WebcamMirror.tsx", import.meta.url), "utf8");

test("WebcamMirror imports the garment library", () => {
  assert.match(webcamMirror, /from\s*"@\/lib\/garment-library"/);
  assert.match(webcamMirror, /GARMENT_LIBRARY/);
});

test('WebcamMirror contains the "Coming soon" tray badge copy', () => {
  assert.match(webcamMirror, /Coming soon/);
});

test('WebcamMirror uses "Try " in garment button labels', () => {
  assert.match(webcamMirror, /Try /);
});
