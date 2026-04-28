// Phase 8.9 — Footwear anchor composer + /mirror?mode=footwear contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FOOT_LANDMARK_INDEX,
  FOOT_SIDES,
  composeFootAnchor,
  composeBothFeet,
  parseMirrorMode,
  SUPPORTED_MIRROR_MODES,
} from "../app/mirror/foot-anchor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Build a 33-element BlazePose landmark array with sensible defaults
// and only override the ones we care about.
function makeLandmarks(overrides = {}) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) arr[i] = { visibility: 1, ...v };
  return arr;
}

test("FOOT_LANDMARK_INDEX maps to BlazePose 33-point indices", () => {
  assert.equal(FOOT_LANDMARK_INDEX.LEFT_HEEL, 29);
  assert.equal(FOOT_LANDMARK_INDEX.RIGHT_HEEL, 30);
  assert.equal(FOOT_LANDMARK_INDEX.LEFT_FOOT_INDEX, 31);
  assert.equal(FOOT_LANDMARK_INDEX.RIGHT_FOOT_INDEX, 32);
  assert.deepEqual(FOOT_SIDES, ["left", "right"]);
});

test("composeFootAnchor: rejects bad side", () => {
  assert.throws(
    () => composeFootAnchor({ landmarks: makeLandmarks(), side: "north" }),
    /side must be 'left' or 'right'/,
  );
});

test("composeFootAnchor: returns valid:false when landmarks missing", () => {
  const out = composeFootAnchor({ landmarks: [], side: "left" });
  assert.equal(out.valid, false);
  assert.equal(out.scale, 0);
  assert.equal(out.visibility, 0);
});

test("composeFootAnchor: returns valid:false when landmarks isn't an array", () => {
  assert.equal(composeFootAnchor({ landmarks: null, side: "left" }).valid, false);
  assert.equal(composeFootAnchor({ landmarks: undefined, side: "right" }).valid, false);
});

test("composeFootAnchor: position is midpoint of heel and toe", () => {
  const lm = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0.0 }, // ankle
    29: { x: 0.4, y: 0.97, z: 0.0 }, // heel
    31: { x: 0.5, y: 0.97, z: 0.0 }, // toe
  });
  const out = composeFootAnchor({ landmarks: lm, side: "left" });
  assert.ok(out.valid);
  assert.equal(out.position[0], 0.45);
  assert.equal(out.position[1], 0.97);
  assert.equal(out.position[2], 0.0);
});

test("composeFootAnchor: scale = heel→toe distance", () => {
  const lm = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0 },
    29: { x: 0.4, y: 1.0, z: 0 },
    31: { x: 0.5, y: 1.0, z: 0 }, // 0.1 horizontal distance
  });
  const out = composeFootAnchor({ landmarks: lm, side: "left" });
  assert.ok(Math.abs(out.scale - 0.1) < 1e-6);
});

test("composeFootAnchor: yaw rotates with foot direction", () => {
  // Foot pointing camera-right with no z displacement → yaw ≈ 0
  const flat = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0 },
    29: { x: 0.4, y: 1.0, z: 0 },
    31: { x: 0.5, y: 1.0, z: 0 },
  });
  const flatOut = composeFootAnchor({ landmarks: flat, side: "left" });
  assert.ok(Math.abs(flatOut.rotation[1]) < 1e-6, `expected yaw≈0, got ${flatOut.rotation[1]}`);

  // Foot pointing away from camera (toe further than heel in +z) → yaw ≈ +π/2
  const away = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0 },
    29: { x: 0.4, y: 1.0, z: 0 },
    31: { x: 0.4, y: 1.0, z: 0.2 },
  });
  const awayOut = composeFootAnchor({ landmarks: away, side: "left" });
  assert.ok(awayOut.rotation[1] > 1.0, `expected positive yaw, got ${awayOut.rotation[1]}`);
});

test("composeFootAnchor: visibility = min of ankle/heel/toe", () => {
  const lm = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0, visibility: 0.9 },
    29: { x: 0.4, y: 1.0, z: 0, visibility: 0.5 },
    31: { x: 0.5, y: 1.0, z: 0, visibility: 0.7 },
  });
  const out = composeFootAnchor({ landmarks: lm, side: "left" });
  assert.equal(out.visibility, 0.5);
});

test("composeFootAnchor: handles tiny denominators (foot facing camera)", () => {
  // heel and toe at exactly the same point — degenerate.
  const lm = makeLandmarks({
    27: { x: 0.5, y: 0.95, z: 0 },
    29: { x: 0.5, y: 1.0, z: 0 },
    31: { x: 0.5, y: 1.0, z: 0 },
  });
  const out = composeFootAnchor({ landmarks: lm, side: "left" });
  assert.ok(out.valid);
  assert.ok(Number.isFinite(out.scale));
  assert.ok(Number.isFinite(out.rotation[0]));
  assert.ok(Number.isFinite(out.rotation[1]));
  assert.ok(Number.isFinite(out.rotation[2]));
});

test("composeBothFeet: returns left + right independently", () => {
  const lm = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0 }, // L_ANKLE
    29: { x: 0.4, y: 1.0, z: 0 }, // L_HEEL
    31: { x: 0.5, y: 1.0, z: 0 }, // L_TOE
    28: { x: 0.6, y: 0.95, z: 0 }, // R_ANKLE
    30: { x: 0.6, y: 1.0, z: 0 }, // R_HEEL
    32: { x: 0.7, y: 1.0, z: 0 }, // R_TOE
  });
  const out = composeBothFeet({ landmarks: lm });
  assert.ok(out.left.valid);
  assert.ok(out.right.valid);
  assert.ok(Math.abs(out.left.position[0] - 0.45) < 1e-9);
  assert.ok(Math.abs(out.right.position[0] - 0.65) < 1e-9);
});

test("composeBothFeet: one foot can be invalid without breaking the other", () => {
  const lm = makeLandmarks({
    27: { x: 0.4, y: 0.95, z: 0 },
    29: { x: 0.4, y: 1.0, z: 0 },
    31: { x: 0.5, y: 1.0, z: 0 },
  });
  // Knock out right foot landmarks.
  lm[28] = { x: NaN, y: NaN, z: NaN };
  lm[30] = { x: NaN, y: NaN, z: NaN };
  lm[32] = { x: NaN, y: NaN, z: NaN };
  const out = composeBothFeet({ landmarks: lm });
  assert.ok(out.left.valid);
  assert.equal(out.right.valid, false);
});

test("parseMirrorMode: ?mode=footwear → 'footwear'", () => {
  const sp = new URLSearchParams("mode=footwear");
  assert.equal(parseMirrorMode(sp), "footwear");
});

test("parseMirrorMode: missing/unknown defaults to 'topwear'", () => {
  assert.equal(parseMirrorMode(null), "topwear");
  assert.equal(parseMirrorMode(undefined), "topwear");
  assert.equal(parseMirrorMode(new URLSearchParams("")), "topwear");
  assert.equal(parseMirrorMode(new URLSearchParams("mode=hat")), "topwear");
  assert.equal(parseMirrorMode({ mode: "footwear" }), "footwear");
  assert.equal(parseMirrorMode({ mode: "shoes" }), "topwear");
});

test("SUPPORTED_MIRROR_MODES includes both modes and is frozen", () => {
  assert.deepEqual(SUPPORTED_MIRROR_MODES, ["topwear", "footwear"]);
  assert.ok(Object.isFrozen(SUPPORTED_MIRROR_MODES));
});

test("VISION GUARD: foot-anchor module never imports a 2D fallback", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/mirror/foot-anchor.js"),
    "utf8",
  );
  assert.ok(!src.includes("2d-overlay"));
  assert.ok(!src.includes("garmentTexture"));
});
