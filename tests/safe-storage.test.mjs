// Phase 7.35 — unit tests for the resilient localStorage hydration helper.
//
// Pre-7.35 the /mirror mount-time hydration wrapped seven JSON.parse blocks
// in ONE try/catch — a single corrupt key would silently kill all later
// rehydrates. `safeLoadJson` makes each block self-healing.

import assert from "node:assert/strict";
import test from "node:test";
import { safeLoadJson, safeLoadString } from "../app/lib/safe-storage-pure.mjs";

// Tiny localStorage stub so node:test runs without jsdom.
function withStubStorage(impl, fn) {
  const prior = globalThis.localStorage;
  globalThis.localStorage = impl;
  try {
    return fn();
  } finally {
    if (prior === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = prior;
    }
  }
}

const okStorage = (data) => ({
  getItem(key) { return key in data ? data[key] : null; },
});

const throwingStorage = () => ({
  getItem() { throw new Error("SecurityError"); },
});

test("missing key returns the fallback", () => {
  withStubStorage(okStorage({}), () => {
    assert.deepEqual(safeLoadJson("nope", { a: 1 }), { a: 1 });
    assert.equal(safeLoadJson("nope", null), null);
    assert.equal(safeLoadString("nope"), null);
    assert.equal(safeLoadString("nope", "def"), "def");
  });
});

test("valid JSON is parsed", () => {
  withStubStorage(okStorage({ k: '{"x":42}' }), () => {
    assert.deepEqual(safeLoadJson("k", null), { x: 42 });
  });
  withStubStorage(okStorage({ k: '[1,2,3]' }), () => {
    assert.deepEqual(safeLoadJson("k", null), [1, 2, 3]);
  });
});

test("malformed JSON returns the fallback (does NOT throw)", () => {
  withStubStorage(okStorage({ k: "{not-valid-json" }), () => {
    assert.deepEqual(safeLoadJson("k", { a: 1 }), { a: 1 });
    assert.equal(safeLoadJson("k", null), null);
  });
});

test("empty-string value returns the fallback (treated as missing)", () => {
  withStubStorage(okStorage({ k: "" }), () => {
    assert.equal(safeLoadJson("k", "DEFAULT"), "DEFAULT");
  });
});

test("localStorage that throws (private mode / SecurityError) returns fallback", () => {
  withStubStorage(throwingStorage(), () => {
    assert.deepEqual(safeLoadJson("k", { ok: true }), { ok: true });
    assert.equal(safeLoadString("k", "def"), "def");
  });
});

test("absence of globalThis.localStorage (SSR) returns fallback", () => {
  withStubStorage(undefined, () => {
    // delete via stub so getter is undefined
    delete globalThis.localStorage;
    assert.equal(safeLoadJson("k", "ssr-default"), "ssr-default");
    assert.equal(safeLoadString("k", "ssr-string"), "ssr-string");
  });
});

test("non-string key returns fallback (defensive)", () => {
  withStubStorage(okStorage({}), () => {
    // @ts-expect-error intentional bad input
    assert.equal(safeLoadJson(null, "fb"), "fb");
    // @ts-expect-error intentional bad input
    assert.equal(safeLoadString(123, "fb"), "fb");
  });
});

test("safeLoadString returns the raw string verbatim (no JSON parsing)", () => {
  withStubStorage(okStorage({ k: "hello world" }), () => {
    assert.equal(safeLoadString("k"), "hello world");
  });
  // A value that LOOKS like JSON is still returned as a string.
  withStubStorage(okStorage({ k: '"quoted"' }), () => {
    assert.equal(safeLoadString("k"), '"quoted"');
  });
});

test("number / boolean / null fallback types are preserved verbatim", () => {
  withStubStorage(okStorage({}), () => {
    assert.equal(safeLoadJson("nope", 42), 42);
    assert.equal(safeLoadJson("nope", true), true);
    assert.equal(safeLoadJson("nope", null), null);
    assert.deepEqual(safeLoadJson("nope", []), []);
  });
});

test("a valid sibling key still parses when an unrelated key is malformed (isolation)", () => {
  // The whole point: pre-7.35 this case lost BOTH. Now they're independent.
  const data = {
    "virtualfit-saved-garments": "{corrupt",
    "virtualfit-favorites": "[1,2,3]",
    "virtualfit-ui-prefs": '{"theme":"dark"}',
  };
  withStubStorage(okStorage(data), () => {
    assert.deepEqual(safeLoadJson("virtualfit-saved-garments", []), []);
    assert.deepEqual(safeLoadJson("virtualfit-favorites", []), [1, 2, 3]);
    assert.deepEqual(safeLoadJson("virtualfit-ui-prefs", null), { theme: "dark" });
  });
});
