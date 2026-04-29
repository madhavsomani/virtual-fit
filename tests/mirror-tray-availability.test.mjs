import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webcamMirror = readFileSync(new URL("../app/mirror/WebcamMirror.tsx", import.meta.url), "utf8");
const mirrorPage = readFileSync(new URL("../app/mirror/page.tsx", import.meta.url), "utf8");

test("WebcamMirror exposes availableMeshIds in props", () => {
  assert.match(webcamMirror, /availableMeshIds/);
  assert.match(webcamMirror, /function WebcamMirror\s*\(\s*\{\s*availableMeshIds\s*\}\s*:\s*WebcamMirrorProps\s*\)/);
});

test('WebcamMirror contains both "Ready" and "Coming soon" tray badges', () => {
  assert.match(webcamMirror, /Ready/);
  assert.match(webcamMirror, /Coming soon/);
});

test("mirror page computes mesh availability server-side and passes it through", () => {
  assert.match(mirrorPage, /import\s*\{\s*hasMesh\s*\}\s*from\s*"@\/lib\/garment-asset"/);
  assert.match(mirrorPage, /import\s*\{\s*GARMENT_LIBRARY\s*\}\s*from\s*"@\/lib\/garment-library"/);
  assert.match(mirrorPage, /<WebcamMirror availableMeshIds=\{availableMeshIds\} \/>/);
});
