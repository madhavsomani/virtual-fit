// Phase 8.12 — clip-recorder controller + share-intent contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClipRecorder,
  buildShareIntents,
  DEFAULT_MIME_TYPES,
  MAX_CLIP_MS,
  DEFAULT_CLIP_MS,
} from "../app/lib/clip-recorder.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Fake MediaRecorder + URL facade so the controller is fully testable
// without a DOM. Returns the controller + a `harness` we can poke.
function makeHarness({ supportedTypes = ["video/webm"], throwOnCreate = false } = {}) {
  const created = [];
  const timers = [];
  let nextTimerId = 1;
  const clearedTimers = new Set();

  class FakeRecorder {
    constructor(stream, opts) {
      this.stream = stream;
      this.opts = opts;
      this.started = false;
      this.stopped = false;
      this.ondataavailable = null;
      this.onstop = null;
      this.onerror = null;
      created.push(this);
    }
    start() { this.started = true; }
    stop() {
      this.stopped = true;
      // Synchronously emit one data chunk + onstop so the test stays linear.
      if (this.ondataavailable) {
        this.ondataavailable({ data: { size: 1234 } });
      }
      if (this.onstop) this.onstop();
    }
  }

  class FakeBlob {
    constructor(parts, opts) {
      this.parts = parts || [];
      this.type = opts?.type || "";
      this.size = this.parts.reduce((a, p) => a + (p?.size || 0), 0);
    }
  }

  const factories = {
    createRecorder: (s, o) => {
      if (throwOnCreate) throw new Error("boom");
      return new FakeRecorder(s, o);
    },
    isTypeSupported: (t) => supportedTypes.includes(t),
    createObjectURL: (b) => `blob:fake/${b.type || "any"}`,
    revokeObjectURL: () => {},
    setTimeout: (fn, ms) => {
      const id = nextTimerId++;
      timers.push({ id, fn, ms });
      return id;
    },
    clearTimeout: (id) => clearedTimers.add(id),
  };

  // Make Blob global available for the recorder's onstop path.
  globalThis.Blob = globalThis.Blob || FakeBlob;

  return { factories, created, timers, clearedTimers };
}

test("createClipRecorder: requires a stream", () => {
  assert.throws(() => createClipRecorder({}), /stream is required/);
  assert.throws(() => createClipRecorder({ stream: null }), /stream is required/);
});

test("createClipRecorder: starts in idle", () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: { id: "fake" }, factories: h.factories });
  assert.equal(rec.getState(), "idle");
  assert.equal(rec.getLastResult(), null);
});

test("start → recording, calls MediaRecorder.start, schedules auto-stop", () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  rec.start({ maxDurationMs: 5000 });
  assert.equal(rec.getState(), "recording");
  assert.equal(h.created.length, 1);
  assert.equal(h.created[0].started, true);
  // Picks the first supported type.
  assert.equal(h.created[0].opts.mimeType, "video/webm");
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 5000);
});

test("start: clamps maxDurationMs to MAX_CLIP_MS, defaults when bogus", () => {
  const h1 = makeHarness();
  const r1 = createClipRecorder({ stream: {}, factories: h1.factories });
  r1.start({ maxDurationMs: 999_999 });
  assert.equal(h1.timers[0].ms, MAX_CLIP_MS);

  const h2 = makeHarness();
  const r2 = createClipRecorder({ stream: {}, factories: h2.factories });
  r2.start({ maxDurationMs: -5 });
  assert.equal(h2.timers[0].ms, DEFAULT_CLIP_MS);
});

test("start: throws when no MIME type is supported (and stays in error state)", () => {
  const h = makeHarness({ supportedTypes: [] });
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  assert.throws(() => rec.start(), /no supported MIME type/);
  assert.equal(rec.getState(), "error");
  assert.match(rec.getLastError().message, /no supported MIME type/);
});

test("start: respects an explicit mimeType when supported", () => {
  const h = makeHarness({ supportedTypes: ["video/mp4", "video/webm"] });
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  rec.start({ mimeType: "video/mp4" });
  assert.equal(h.created[0].opts.mimeType, "video/mp4");
});

test("start: refuses to start twice", () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  rec.start();
  assert.throws(() => rec.start(), /already recording/);
});

test("start: surfaces createRecorder failures via fail()", () => {
  const h = makeHarness({ throwOnCreate: true });
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  assert.throws(() => rec.start(), /boom/);
  assert.equal(rec.getState(), "error");
});

test("stop → ready, resolves with result; auto-stop timer cleared", async () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  rec.start({ maxDurationMs: 5000 });
  const timerId = h.timers[0].id;
  const result = await rec.stop();
  assert.equal(rec.getState(), "ready");
  assert.equal(typeof result.blobUrl, "string");
  assert.equal(result.mimeType, "video/webm");
  assert.ok(result.durationMs >= 0);
  assert.ok(h.clearedTimers.has(timerId), "expected auto-stop timer to be cleared");
});

test("stop: rejects when not recording", async () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  await assert.rejects(() => rec.stop(), /cannot stop/);
});

test("autoBlur flag is carried through to result for downstream consumers", async () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  rec.start({ autoBlur: true });
  const result = await rec.stop();
  assert.equal(result.autoBlur, true);
});

test("subscribe: receives state transitions", async () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  const states = [];
  const off = rec.subscribe((snap) => states.push(snap.state));
  rec.start();
  await rec.stop();
  rec.reset();
  assert.deepEqual(states, ["recording", "ready", "idle"]);
  off();
});

test("subscribe: unsubscribe stops further callbacks", () => {
  const h = makeHarness();
  const rec = createClipRecorder({ stream: {}, factories: h.factories });
  let n = 0;
  const off = rec.subscribe(() => n++);
  rec.start();
  off();
  rec.reset();
  assert.equal(n, 1, "only the recording transition should have fired");
});

test("DEFAULT_MIME_TYPES is frozen + DEFAULT_CLIP_MS is 10s", () => {
  assert.ok(Object.isFrozen(DEFAULT_MIME_TYPES));
  assert.equal(DEFAULT_CLIP_MS, 10_000);
  assert.equal(MAX_CLIP_MS, 30_000);
});

test("buildShareIntents: requires a blobUrl", () => {
  assert.throws(() => buildShareIntents({}), /blobUrl is required/);
});

test("buildShareIntents: returns download + copy + 3 platforms", () => {
  const out = buildShareIntents({
    blobUrl: "blob:fake/video",
    caption: "first try-on",
    hashtags: ["#virtualfit", "ootd "],
    deepLink: "https://virtualfit.app/share/abc",
  });
  assert.equal(out.download.href, "blob:fake/video");
  assert.equal(out.download.filename, "virtualfit-clip.webm");
  assert.match(out.copy.text, /first try-on/);
  assert.match(out.copy.text, /#virtualfit/);
  assert.match(out.copy.text, /#ootd/);
  assert.match(out.copy.text, /https:\/\/virtualfit\.app\/share\/abc/);
  assert.match(out.twitter.href, /^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  assert.equal(out.instagram.kind, "deep-link");
  assert.equal(out.tiktok.kind, "deep-link");
  assert.match(out.instagram.hint, /Instagram/);
  assert.match(out.tiktok.hint, /TikTok/);
});

test("buildShareIntents: rejects bad hashtags type", () => {
  assert.throws(
    () => buildShareIntents({ blobUrl: "x", hashtags: "not-array" }),
    /hashtags must be an array/,
  );
});

test("VISION GUARD: clip-recorder never imports 2D fallback or paid APIs", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/clip-recorder.mjs"), "utf8");
  assert.ok(!src.includes("2d-overlay"));
  assert.ok(!src.includes("garmentTexture"));
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com/i.test(src));
});
