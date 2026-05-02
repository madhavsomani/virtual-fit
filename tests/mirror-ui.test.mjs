import test from "node:test";
import assert from "node:assert/strict";

import { canCapture, getStatusChip } from "../lib/mirror-ui.ts";

test("getStatusChip defaults to idle slate", () => {
  assert.deepEqual(getStatusChip({ isStarting: false, isActive: false, error: null }), {
    label: "Idle",
    tone: "slate"
  });
});

test("getStatusChip returns connecting amber while starting", () => {
  assert.deepEqual(getStatusChip({ isStarting: true, isActive: false, error: null }), {
    label: "Connecting",
    tone: "amber"
  });
});

test("getStatusChip returns live emerald while active", () => {
  assert.deepEqual(getStatusChip({ isStarting: false, isActive: true, error: null }), {
    label: "Live",
    tone: "emerald"
  });
});

test("getStatusChip returns error rose when an error exists", () => {
  assert.deepEqual(getStatusChip({ isStarting: false, isActive: false, error: new Error("boom") }), {
    label: "Error",
    tone: "rose"
  });
});

test("getStatusChip prioritizes error over starting", () => {
  assert.deepEqual(getStatusChip({ isStarting: true, isActive: false, error: { message: "fail" } }), {
    label: "Error",
    tone: "rose"
  });
});

test("getStatusChip prioritizes error over active", () => {
  assert.deepEqual(getStatusChip({ isStarting: false, isActive: true, error: { message: "fail" } }), {
    label: "Error",
    tone: "rose"
  });
});

test("canCapture returns false when not active", () => {
  assert.equal(canCapture({ isActive: false }), false);
});

test("canCapture returns true when active with no error", () => {
  assert.equal(canCapture({ isActive: true }), true);
});

test("canCapture returns false when active with an error", () => {
  assert.equal(canCapture({ isActive: true, error: { code: "NotAllowedError" } }), false);
});

test("canCapture returns false while starting because the camera is not active yet", () => {
  assert.equal(canCapture({ isActive: false }), false);
});
