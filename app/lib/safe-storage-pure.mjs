// Phase 7.35 — resilient localStorage hydration helper.
//
// Single truth source for `safeLoadJson` so node:test can import it
// directly without a TS toolchain. The TS sibling re-exports with a
// generic signature so callers in `mirror/page.tsx` get type inference.
//
// Background: prior to Phase 7.35, `app/mirror/page.tsx` wrapped seven
// separate `JSON.parse` rehydrate blocks (garments, adjustments, favorites,
// last-garment, UI prefs, presets, per-garment adjustments) in ONE big
// `try { ... } catch { warn("Failed to load saved garments") }`. A single
// corrupt byte in any one key would throw on the first parse and silently
// skip every later rehydrate — losing the user's entire setup AND blaming
// the wrong key in the console.

/**
 * Read+parse a JSON-encoded localStorage value with defaults on every
 * failure mode (missing key, malformed JSON, localStorage throwing under
 * SecurityError / quota issues / SSR with no `window`).
 *
 * @template T
 * @param {string} key   localStorage key.
 * @param {T} fallback   value returned for missing/malformed/throwing reads.
 * @returns {T}
 */
export function safeLoadJson(key, fallback) {
  // Defensive: SSR / disabled-storage / sandboxed-iframe → just fallback.
  if (typeof globalThis === "undefined" || typeof key !== "string") return fallback;
  let raw;
  try {
    const ls = globalThis.localStorage;
    if (!ls) return fallback;
    raw = ls.getItem(key);
  } catch {
    // SecurityError in some private/incognito modes; quota errors, etc.
    return fallback;
  }
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Read a localStorage string verbatim (no JSON.parse) with defaults on
 * every failure mode. Useful for plain-string values like "virtualfit-last-garment".
 *
 * @param {string} key
 * @param {string|null} fallback
 * @returns {string|null}
 */
export function safeLoadString(key, fallback = null) {
  if (typeof globalThis === "undefined" || typeof key !== "string") return fallback;
  try {
    const ls = globalThis.localStorage;
    if (!ls) return fallback;
    const raw = ls.getItem(key);
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}
