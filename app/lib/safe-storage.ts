// Phase 7.35 — TS facade for the resilient localStorage hydration helper.
//
// The single truth source is `safe-storage-pure.mjs` so node:test can
// import it directly. This file re-exports with typed bindings so
// callers in `mirror/page.tsx` (and elsewhere) get full type inference
// on the generic `safeLoadJson<T>`.

import {
  safeLoadJson as _safeLoadJson,
  safeLoadString as _safeLoadString,
} from "./safe-storage-pure.mjs";

/** Parse a JSON-encoded localStorage value with safe fallback on every failure mode. */
export const safeLoadJson: <T>(key: string, fallback: T) => T =
  _safeLoadJson as unknown as <T>(key: string, fallback: T) => T;

/** Read a plain string from localStorage with safe fallback. */
export const safeLoadString: (key: string, fallback?: string | null) => string | null =
  _safeLoadString as unknown as (key: string, fallback?: string | null) => string | null;
