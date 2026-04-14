import assert from "node:assert/strict";
import test from "node:test";

import {
  appendDebugLandmarkTrace,
  buildDebugLandmarkReplaySnapshot,
  buildDebugLandmarkTraceEntry,
  stepDebugLandmarkReplay
} from "../app/mirror/debug-landmark-traces.js";

test("buildDebugLandmarkTraceEntry returns normalized trace entry", () => {
  const entry = buildDebugLandmarkTraceEntry({
    nowMs: 1234.56,
    trackingMode: "POSE",
    landmarkCount: 24.4,
    poseConfidence: 0.834,
    fallbackConfidence: null,
    overlayEnabled: true
  });

  assert.deepEqual(entry, {
    nowMs: 1235,
    trackingMode: "POSE",
    landmarkCount: 24,
    poseConfidence: 0.83,
    fallbackConfidence: null,
    overlayEnabled: true
  });
});

test("buildDebugLandmarkTraceEntry returns null when timestamp missing", () => {
  const entry = buildDebugLandmarkTraceEntry({
    nowMs: null,
    trackingMode: "POSE"
  });

  assert.equal(entry, null);
});

test("appendDebugLandmarkTrace keeps only latest bounded entries", () => {
  const traces = [];
  for (let i = 0; i < 5; i += 1) {
    traces.push({ nowMs: i, trackingMode: "POSE", landmarkCount: i });
  }

  const next = appendDebugLandmarkTrace({
    traces,
    trace: { nowMs: 5, trackingMode: "POSE", landmarkCount: 5 },
    maxEntries: 4
  });

  assert.equal(next.length, 4);
  assert.equal(next[0].nowMs, 2);
  assert.equal(next[3].nowMs, 5);
});

test("buildDebugLandmarkReplaySnapshot returns bounded replay frame", () => {
  const traces = [
    { nowMs: 1000, trackingMode: "POSE", landmarkCount: 24 },
    { nowMs: 1040, trackingMode: "POSE", landmarkCount: 24 },
    { nowMs: 1080, trackingMode: "FALLBACK", landmarkCount: 0 }
  ];

  const snapshot = buildDebugLandmarkReplaySnapshot({ traces, replayIndex: 9 });

  assert.equal(snapshot.total, 3);
  assert.equal(snapshot.index, 2);
  assert.equal(snapshot.trace.nowMs, 1080);
});

test("stepDebugLandmarkReplay loops through trace boundaries", () => {
  const traces = [
    { nowMs: 1 },
    { nowMs: 2 },
    { nowMs: 3 }
  ];

  const nextFromEnd = stepDebugLandmarkReplay({ traces, replayIndex: 2, direction: 1, loop: true });
  const nextFromStart = stepDebugLandmarkReplay({ traces, replayIndex: 0, direction: -1, loop: true });

  assert.equal(nextFromEnd.index, 0);
  assert.equal(nextFromStart.index, 2);
});
