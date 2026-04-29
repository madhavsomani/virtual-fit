import assert from "node:assert/strict";
import test from "node:test";

import { createJob, isTerminal, summarize, transitionJob } from "../lib/garment-pipeline.ts";

test("createJob creates a queued job with timestamps and identifiers", () => {
  const job = createJob({
    garmentId: "core-crew-tee",
    sourceImageUrl: "/tmp/source.png",
    adapter: "stub"
  });

  assert.equal(job.status, "queued");
  assert.equal(job.garmentId, "core-crew-tee");
  assert.equal(job.sourceImageUrl, "/tmp/source.png");
  assert.equal(job.adapter, "stub");
  assert.equal(typeof job.id, "string");
  assert.notEqual(job.id.length, 0);
  assert.equal(Number.isNaN(Date.parse(job.createdAt)), false);
});

test("transitionJob returns a new object and leaves the original unchanged", () => {
  const original = createJob({
    garmentId: "core-crew-tee",
    sourceImageUrl: "/tmp/source.png",
    adapter: "stub"
  });

  const next = transitionJob(original, "running", {
    error: "ignored",
    outputAssetUrl: "/garments/core-crew-tee.glb"
  });

  assert.notEqual(next, original);
  assert.equal(next.status, "running");
  assert.equal(next.outputAssetUrl, "/garments/core-crew-tee.glb");
  assert.equal(typeof next.startedAt, "string");
  assert.equal(original.status, "queued");
  assert.equal(original.startedAt, undefined);
  assert.equal(original.outputAssetUrl, undefined);
});

test("isTerminal is true only for succeeded and failed", () => {
  assert.equal(isTerminal("queued"), false);
  assert.equal(isTerminal("running"), false);
  assert.equal(isTerminal("succeeded"), true);
  assert.equal(isTerminal("failed"), true);
});

test("summarize counts mixed job states", () => {
  const jobs = [
    createJob({ garmentId: "a", sourceImageUrl: "1", adapter: "stub" }),
    transitionJob(createJob({ garmentId: "b", sourceImageUrl: "2", adapter: "stub" }), "running"),
    transitionJob(createJob({ garmentId: "c", sourceImageUrl: "3", adapter: "stub" }), "succeeded"),
    transitionJob(createJob({ garmentId: "d", sourceImageUrl: "4", adapter: "stub" }), "failed"),
    transitionJob(createJob({ garmentId: "e", sourceImageUrl: "5", adapter: "stub" }), "succeeded")
  ];

  assert.deepEqual(summarize(jobs), {
    total: 5,
    queued: 1,
    running: 1,
    succeeded: 2,
    failed: 1
  });

  assert.deepEqual(summarize([]), {
    total: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0
  });
});
