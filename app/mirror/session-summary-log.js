// Phase 7.105 — local-only session-summary log appender.
//
// 7.104 ships the pure builder. This module ships the OPT-IN persistence
// layer. Hard rules baked in by design (not by code review):
//
//   1. NO NETWORK. Period. Network ingest of telemetry deserves its own
//      consent UX + privacy review. This appender writes to localStorage
//      under a single namespaced key. The user owns the data.
//   2. OPT-IN. The wiring layer (mirror/page.tsx) MUST gate calls behind
//      a URL flag (?debugTelemetry=1). Default off.
//   3. RING BUFFER. Cap at maxEntries (default 20). The latest session's
//      summary always lands at index 0; oldest gets evicted. Prevents
//      localStorage bloat over time.
//   4. SCHEMA-AWARE. Each entry carries the schemaVersion the builder
//      produced. A future shape change rejects mismatched entries on read
//      instead of crashing downstream consumers.
//   5. DEFENSIVE READS. Corrupt/missing/SSR localStorage → empty list.
//      Same posture as safe-storage.ts.

const LOG_KEY = "virtualfit:debug:session-summaries:v1";
const DEFAULT_MAX_ENTRIES = 20;

function getStorage(storage) {
  if (storage) return storage;
  if (typeof globalThis === "undefined") return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // SecurityError / sandboxed iframe.
    return null;
  }
}

function safeRead(ls) {
  if (!ls) return [];
  let raw;
  try {
    raw = ls.getItem(LOG_KEY);
  } catch {
    return [];
  }
  if (raw == null) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed : [];
}

function safeWrite(ls, value) {
  if (!ls) return false;
  try {
    ls.setItem(LOG_KEY, JSON.stringify(value));
    return true;
  } catch {
    // QuotaExceeded / SecurityError. Swallow — telemetry must never break
    // the app. The next append will retry; a quota issue self-heals once
    // entries roll out of the buffer (when the caller retries with one
    // fewer to keep).
    return false;
  }
}

/**
 * Append a session summary. Returns the new buffer (newest first), capped.
 * @param {object} summary  output of buildSessionSummary
 * @param {{ storage?: any, maxEntries?: number }} [opts]
 */
export function appendSessionSummary(summary, opts = {}) {
  if (!summary || typeof summary !== "object") return safeRead(getStorage(opts.storage));
  const maxEntries = Number.isFinite(opts.maxEntries)
    ? Math.max(1, Math.floor(opts.maxEntries))
    : DEFAULT_MAX_ENTRIES;
  const ls = getStorage(opts.storage);
  const existing = safeRead(ls);
  // Newest first, then existing — capped at maxEntries.
  const next = [summary, ...existing].slice(0, maxEntries);
  safeWrite(ls, next);
  return next;
}

/**
 * Read the appended summaries (newest first). Defensive — never throws.
 * @param {{ storage?: any, expectedSchemaVersion?: number }} [opts]
 */
export function readSessionSummaries(opts = {}) {
  const ls = getStorage(opts.storage);
  const all = safeRead(ls);
  if (!Number.isFinite(opts.expectedSchemaVersion)) return all;
  return all.filter((e) => e && e.schemaVersion === opts.expectedSchemaVersion);
}

/**
 * Clear the appended summaries. Returns true on success.
 * @param {{ storage?: any }} [opts]
 */
export function clearSessionSummaries(opts = {}) {
  const ls = getStorage(opts.storage);
  if (!ls) return false;
  try {
    ls.removeItem(LOG_KEY);
    return true;
  } catch {
    return false;
  }
}

export const SESSION_SUMMARY_LOG_KEY = LOG_KEY;
export const SESSION_SUMMARY_LOG_DEFAULT_MAX = DEFAULT_MAX_ENTRIES;
