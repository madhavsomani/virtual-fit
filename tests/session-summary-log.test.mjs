// Phase 7.105 — local-only session-summary log appender contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  appendSessionSummary,
  readSessionSummaries,
  clearSessionSummaries,
  SESSION_SUMMARY_LOG_KEY,
  SESSION_SUMMARY_LOG_DEFAULT_MAX,
} from "../app/mirror/session-summary-log.js";
import { buildSessionSummary } from "../app/mirror/session-summary.js";

// Minimal in-memory localStorage shim. We pass it explicitly via opts.storage
// instead of stubbing globalThis — keeps tests parallel-safe.
function makeStorage(initial = {}) {
  let store = { ...initial };
  let throwOn = null; // "get" | "set" | "remove" | null
  return {
    getItem(k) {
      if (throwOn === "get") throw new Error("denied");
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k, v) {
      if (throwOn === "set") throw new Error("quota");
      store[k] = String(v);
    },
    removeItem(k) {
      if (throwOn === "remove") throw new Error("denied");
      delete store[k];
    },
    _peek: () => ({ ...store }),
    _setThrow: (mode) => { throwOn = mode; },
  };
}

const sampleSnapshot = (totalFrames = 100, totals = { yaw: 10, pitch: 0, roll: 0, depth: 5 }) => ({
  totalFrames,
  holds: { yaw: 0, pitch: 0, roll: 0, depth: 0 },
  maxHold: { yaw: 7, pitch: 0, roll: 0, depth: 3 },
  totals,
  held: { yaw: false, pitch: false, roll: false, depth: false },
});

test("default max-entries cap is 20 (sane non-bloating default)", () => {
  assert.equal(SESSION_SUMMARY_LOG_DEFAULT_MAX, 20);
});

test("uses a single namespaced storage key (not the bare 'session-summaries')", () => {
  // Namespacing prevents collision with any other app on the same origin.
  assert.match(SESSION_SUMMARY_LOG_KEY, /^virtualfit:/);
  assert.match(SESSION_SUMMARY_LOG_KEY, /:v\d+$/, "key must be schema-versioned");
});

test("append + read round-trips a single summary", () => {
  const storage = makeStorage();
  const summary = buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: "s1" });
  appendSessionSummary(summary, { storage });
  const read = readSessionSummaries({ storage });
  assert.equal(read.length, 1);
  assert.equal(read[0].sessionId, "s1");
  assert.equal(read[0].totalFrames, 100);
});

test("newest-first ordering: latest append lands at index 0", () => {
  const storage = makeStorage();
  appendSessionSummary(buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: "old" }), { storage });
  appendSessionSummary(buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: "new" }), { storage });
  const read = readSessionSummaries({ storage });
  assert.equal(read[0].sessionId, "new");
  assert.equal(read[1].sessionId, "old");
});

test("ring-buffer caps at maxEntries (default 20)", () => {
  const storage = makeStorage();
  for (let i = 0; i < 25; i += 1) {
    appendSessionSummary(
      buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: `s${i}` }),
      { storage },
    );
  }
  const read = readSessionSummaries({ storage });
  assert.equal(read.length, 20);
  // Newest is last appended (s24); oldest kept is s5.
  assert.equal(read[0].sessionId, "s24");
  assert.equal(read[19].sessionId, "s5");
});

test("custom maxEntries honored; non-finite falls back; floors fractions", () => {
  const storage = makeStorage();
  for (let i = 0; i < 5; i += 1) {
    appendSessionSummary(
      buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: `s${i}` }),
      { storage, maxEntries: 3 },
    );
  }
  const read = readSessionSummaries({ storage });
  assert.equal(read.length, 3);
  // NaN → default 20; fraction 4.9 → floor(4.9)=4.
  const storage2 = makeStorage();
  for (let i = 0; i < 6; i += 1) {
    appendSessionSummary(
      buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: `s${i}` }),
      { storage: storage2, maxEntries: 4.9 },
    );
  }
  assert.equal(readSessionSummaries({ storage: storage2 }).length, 4);
});

test("ignores garbage input; never throws on null/undefined/non-object summaries", () => {
  const storage = makeStorage();
  const r1 = appendSessionSummary(null, { storage });
  const r2 = appendSessionSummary(undefined, { storage });
  const r3 = appendSessionSummary("not a summary", { storage });
  assert.deepEqual(r1, []);
  assert.deepEqual(r2, []);
  assert.deepEqual(r3, []);
  assert.equal(readSessionSummaries({ storage }).length, 0);
});

test("missing storage (SSR/disabled) returns empty list, no throw", () => {
  // No storage passed AND no globalThis.localStorage in the test runner.
  assert.deepEqual(readSessionSummaries({}), []);
  // Append also no-throws.
  const r = appendSessionSummary(buildSessionSummary({ snapshot: sampleSnapshot() }), {});
  assert.ok(Array.isArray(r));
});

test("corrupt JSON in storage → empty list, no throw", () => {
  const storage = makeStorage({ [SESSION_SUMMARY_LOG_KEY]: "not-json{{{" });
  assert.deepEqual(readSessionSummaries({ storage }), []);
});

test("non-array JSON in storage → empty list (defensive shape check)", () => {
  const storage = makeStorage({ [SESSION_SUMMARY_LOG_KEY]: '{"oops":1}' });
  assert.deepEqual(readSessionSummaries({ storage }), []);
});

test("storage that throws on getItem/setItem/removeItem never breaks the caller", () => {
  const storage = makeStorage();
  storage._setThrow("get");
  assert.deepEqual(readSessionSummaries({ storage }), []);
  storage._setThrow("set");
  // Append no-throws even when setItem rejects (quota exceeded etc).
  const r = appendSessionSummary(buildSessionSummary({ snapshot: sampleSnapshot() }), { storage });
  assert.ok(Array.isArray(r));
  storage._setThrow("remove");
  assert.equal(clearSessionSummaries({ storage }), false);
});

test("expectedSchemaVersion filters out mismatched entries", () => {
  const storage = makeStorage();
  // Manually inject a v0 entry alongside a v1 entry.
  const v1 = buildSessionSummary({ snapshot: sampleSnapshot(), sessionId: "current" });
  const v0 = { schemaVersion: 0, sessionId: "ancient", totalFrames: 9 };
  storage.setItem(SESSION_SUMMARY_LOG_KEY, JSON.stringify([v1, v0]));
  const filtered = readSessionSummaries({ storage, expectedSchemaVersion: 1 });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].sessionId, "current");
  // Without filter both come back.
  assert.equal(readSessionSummaries({ storage }).length, 2);
});

test("clearSessionSummaries empties the buffer", () => {
  const storage = makeStorage();
  appendSessionSummary(buildSessionSummary({ snapshot: sampleSnapshot() }), { storage });
  assert.equal(readSessionSummaries({ storage }).length, 1);
  assert.equal(clearSessionSummaries({ storage }), true);
  assert.equal(readSessionSummaries({ storage }).length, 0);
});

test("NO NETWORK: module source contains zero fetch/XMLHttpRequest/sendBeacon refs", async () => {
  // Hard architectural lock. If a future PR adds a "and POST it to /api/foo"
  // line this test fires immediately. Network telemetry deserves its own
  // consent UX; this module's job is local persistence ONLY.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const SRC = readFileSync(
    resolve(__dirname, "../app/mirror/session-summary-log.js"),
    "utf8",
  );
  const stripped = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.doesNotMatch(stripped, /\bfetch\s*\(/);
  assert.doesNotMatch(stripped, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(stripped, /\bsendBeacon\b/);
  assert.doesNotMatch(stripped, /navigator\.\w*[Bb]eacon/);
});
