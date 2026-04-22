import assert from "node:assert/strict";
import test from "node:test";

import { extractGlbPath } from "../app/lib/trellis-helpers.mjs";

test("extractGlbPath: bare string", () => {
  assert.equal(extractGlbPath("/tmp/abc.glb"), "/tmp/abc.glb");
});

test("extractGlbPath: returns null for non-glb string", () => {
  assert.equal(extractGlbPath("/tmp/abc.png"), null);
});

test("extractGlbPath: { path } object", () => {
  assert.equal(extractGlbPath({ path: "/x/y.glb" }), "/x/y.glb");
});

test("extractGlbPath: { url } object", () => {
  assert.equal(extractGlbPath({ url: "https://h/file.glb" }), "https://h/file.glb");
});

test("extractGlbPath: nested in arrays", () => {
  const data = [
    { type: "preview", url: "x.png" },
    { type: "model", path: "/out/model.glb" },
  ];
  assert.equal(extractGlbPath(data), "/out/model.glb");
});

test("extractGlbPath: deeply nested", () => {
  const data = { a: { b: { c: [{ d: { name: "shirt.glb" } }] } } };
  assert.equal(extractGlbPath(data), "shirt.glb");
});

test("extractGlbPath: returns null when no glb", () => {
  assert.equal(extractGlbPath({ a: 1, b: [2, 3, "x.png"] }), null);
});

test("extractGlbPath: handles cycles without crashing", () => {
  const a = { name: "x.png" };
  a.self = a;
  assert.equal(extractGlbPath(a), null);
});

test("extractGlbPath: null/undefined/numbers", () => {
  assert.equal(extractGlbPath(null), null);
  assert.equal(extractGlbPath(undefined), null);
  assert.equal(extractGlbPath(42), null);
});
