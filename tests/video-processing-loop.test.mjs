import assert from "node:assert/strict";
import test from "node:test";

import { startVideoProcessingLoop } from "../app/mirror/video-processing-loop.js";

function createFrameHarness() {
  let nextId = 1;
  const queue = [];
  const cancelled = new Set();

  return {
    requestFrame(callback) {
      const id = nextId++;
      queue.push({ id, callback });
      return id;
    },
    cancelFrame(id) {
      cancelled.add(id);
    },
    flush(timestampMs) {
      const next = queue.shift();
      assert.ok(next, "expected a queued frame callback");
      if (cancelled.has(next.id)) {
        return;
      }

      next.callback(timestampMs);
    },
    queuedCount() {
      return queue.length;
    }
  };
}

test("video processing loop throttles ticks to target fps", async () => {
  const harness = createFrameHarness();
  const received = [];

  const stopLoop = startVideoProcessingLoop({
    onTick: (timestampMs) => {
      received.push(timestampMs);
    },
    targetFps: 10,
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame
  });

  assert.equal(harness.queuedCount(), 1);

  harness.flush(0);
  await Promise.resolve();
  harness.flush(40);
  await Promise.resolve();
  harness.flush(120);
  await Promise.resolve();

  assert.deepEqual(received, [0, 120]);

  stopLoop();
  harness.flush(240);
  await Promise.resolve();
  assert.deepEqual(received, [0, 120]);
});

test("video processing loop prevents overlapping async ticks", async () => {
  const harness = createFrameHarness();
  const received = [];

  let releaseTick;
  const firstTickComplete = new Promise((resolve) => {
    releaseTick = resolve;
  });

  let tickCount = 0;

  const stopLoop = startVideoProcessingLoop({
    targetFps: 30,
    requestFrame: harness.requestFrame,
    cancelFrame: harness.cancelFrame,
    onTick: async (timestampMs) => {
      tickCount += 1;
      received.push(timestampMs);

      if (tickCount === 1) {
        await firstTickComplete;
      }
    }
  });

  harness.flush(0);
  harness.flush(40);

  assert.deepEqual(received, [0]);

  releaseTick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  harness.flush(90);
  await Promise.resolve();
  harness.flush(140);
  await Promise.resolve();

  assert.equal(received.length, 2);
  assert.equal(received[0], 0);
  assert.ok(received[1] >= 90);

  stopLoop();
});
