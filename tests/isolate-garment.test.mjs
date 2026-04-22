import assert from "node:assert/strict";
import test from "node:test";

import { isolateGarmentImpl } from "../app/lib/isolate-garment.mjs";

const SEG_BLOB = { size: 10, _tag: "seg" };
const RMBG_BLOB = { size: 20, _tag: "rmbg" };

test("isolateGarment: segformer wins when coverage > 0.02", async () => {
  const seg = async () => ({ garmentPng: SEG_BLOB, coverage: 0.4 });
  const rmbg = async () => RMBG_BLOB;
  const r = await isolateGarmentImpl({}, seg, rmbg);
  assert.equal(r.method, "segformer");
  assert.equal(r.png, SEG_BLOB);
});

test("isolateGarment: falls back to rmbg when coverage too low", async () => {
  const seg = async () => ({ garmentPng: SEG_BLOB, coverage: 0.01 });
  const rmbg = async () => RMBG_BLOB;
  const r = await isolateGarmentImpl({}, seg, rmbg);
  assert.equal(r.method, "rmbg");
  assert.equal(r.png, RMBG_BLOB);
});

test("isolateGarment: falls back to rmbg when segment throws", async () => {
  const seg = async () => {
    throw new Error("no garment classes detected");
  };
  const rmbg = async () => RMBG_BLOB;
  const r = await isolateGarmentImpl({}, seg, rmbg);
  assert.equal(r.method, "rmbg");
  assert.equal(r.png, RMBG_BLOB);
});

test("isolateGarment: rmbg failure surfaces as rejection", async () => {
  const seg = async () => {
    throw new Error("no");
  };
  const rmbg = async () => {
    throw new Error("rmbg down");
  };
  await assert.rejects(() => isolateGarmentImpl({}, seg, rmbg), /rmbg down/);
});

test("isolateGarment: exactly-threshold coverage falls back (strict >)", async () => {
  const seg = async () => ({ garmentPng: SEG_BLOB, coverage: 0.02 });
  const rmbg = async () => RMBG_BLOB;
  const r = await isolateGarmentImpl({}, seg, rmbg);
  assert.equal(r.method, "rmbg");
});
