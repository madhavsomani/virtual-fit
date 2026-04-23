import assert from "node:assert/strict";
import test from "node:test";

import { imageToGlbPipelineImpl } from "../app/lib/image-to-glb-pure.mjs";

const FAKE_INPUT = { size: 1234, type: "image/jpeg" };
const SEGMENTED_PNG = { size: 999, _tag: "segmented" };
const RMBG_PNG = { size: 888, _tag: "rmbg" };

test("happy path: segformer → trellis → glb", async () => {
  const events = [];
  const isolate = async () => ({ png: SEGMENTED_PNG, method: "segformer" });
  const segment = async () => ({ garmentPng: SEGMENTED_PNG, coverage: 0.5 });
  const trellis = async (png, onP) => {
    onP?.({ fraction: 0.5, message: "halfway" });
    return { glbUrl: "https://h/out.glb", sessionHash: "abc" };
  };
  const r = await imageToGlbPipelineImpl(FAKE_INPUT, {
    isolate, segment, trellis,
    onProgress: (p) => events.push(p),
  });
  assert.equal(r.glbUrl, "https://h/out.glb");
  assert.equal(r.method, "segformer");
  assert.deepEqual(events.map((e) => e.stage), ["segmenting", "trellis", "trellis", "complete"]);
  assert.equal(events.at(-1).glbUrl, "https://h/out.glb");
});

test("rmbg fallback path is reported", async () => {
  const isolate = async () => ({ png: RMBG_PNG, method: "rmbg" });
  const segment = async () => { throw new Error("no garment"); };
  const trellis = async () => ({ glbUrl: "https://h/x.glb", sessionHash: "z" });
  const r = await imageToGlbPipelineImpl(FAKE_INPUT, { isolate, segment, trellis });
  assert.equal(r.method, "rmbg");
  assert.equal(r.glbUrl, "https://h/x.glb");
});

test("trellis failure surfaces", async () => {
  const isolate = async () => ({ png: SEGMENTED_PNG, method: "segformer" });
  const segment = async () => ({ garmentPng: SEGMENTED_PNG, coverage: 0.5 });
  const trellis = async () => { throw new Error("zerogpu queue full"); };
  await assert.rejects(
    () => imageToGlbPipelineImpl(FAKE_INPUT, { isolate, segment, trellis }),
    /zerogpu queue full/,
  );
});

test("rejects when injected deps are missing", async () => {
  await assert.rejects(() => imageToGlbPipelineImpl(FAKE_INPUT), /must be provided/);
});

test("forwards token and signal to isolate and trellis", async () => {
  const ac = new AbortController();
  let isolateOpts = null;
  let trellisOpts = null;
  const isolate = async (_in, _seg, o) => { isolateOpts = o; return { png: SEGMENTED_PNG, method: "segformer" }; };
  const segment = async () => ({ garmentPng: SEGMENTED_PNG, coverage: 0.5 });
  const trellis = async (_p, _on, o) => { trellisOpts = o; return { glbUrl: "https://h/y.glb", sessionHash: "" }; };
  await imageToGlbPipelineImpl(FAKE_INPUT, {
    isolate, segment, trellis,
    token: "hf_test", signal: ac.signal,
  });
  assert.equal(isolateOpts.token, "hf_test");
  assert.equal(isolateOpts.signal, ac.signal);
  assert.equal(trellisOpts.token, "hf_test");
  assert.equal(trellisOpts.signal, ac.signal);
});
