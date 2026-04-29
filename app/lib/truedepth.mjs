// Phase 8.17 — WebXR TrueDepth mode.
//
// Optional /mirror enhancement: when the user is on an iPhone 12+ (or
// any device exposing the WebXR depth-sensing module + a forward-facing
// camera), we offer a "TrueDepth" toggle that anchors garment vertices
// to a real depth buffer instead of the inferred MediaPipe pose
// silhouette. This is **strictly additive** — disable returns to the
// existing 3D pipeline.
//
// Pure module. No DOM. No globals. Tested under node:test by injecting
// fake `navigator` / `userAgent` shapes.

const TRUEDEPTH_REASON = Object.freeze({
  OK: "ok",
  SSR: "ssr",                         // running in node / no navigator
  NO_XR: "no-xr",                     // navigator.xr missing
  NO_DEPTH_API: "no-depth-api",       // session not supported
  UA_NOT_FRONT_DEPTH: "ua-not-front-depth", // not on iPhone 12+/Pro Max
  USER_DECLINED: "user-declined",
  UNKNOWN_FAILURE: "unknown-failure",
});

export const TRUEDEPTH_DEFAULTS = Object.freeze({
  // Apple front-camera depth ships on iPhone X+ (Face ID), but the
  // WebXR depth-sensing JS API only lights up on iOS 17.2+ Safari,
  // which requires iPhone 12+ (A14 baseline for ARKit 4 scene depth).
  minIosMajor: 17,
  minIosMinor: 2,
  preferredFormats: Object.freeze(["luminance-alpha", "float32"]),
  preferredUsage: Object.freeze(["cpu-optimized", "gpu-optimized"]),
  REASON: TRUEDEPTH_REASON,
});

// iPhone 12 and later. iPhone 12 family ⇒ iPhone13,*. iPhone 13 ⇒
// iPhone14,*. So we accept iPhone1[3-9],* and iPhone[2-9][0-9],*.
// iPhone 11 = iPhone12,* must NOT match.
const IPHONE_GEN_RE = /iPhone(?:1[3-9]|[2-9][0-9])\b/;

/**
 * @typedef {{ supported: boolean, reason: string, ios?: { major: number, minor: number } }} TrueDepthCheck
 */

/**
 * Hard "is this device + browser even capable of front-camera WebXR depth"
 * check. SSR-safe. Pure: no side effects, no globals touched.
 *
 * @param {{ userAgent?: string, xr?: object|null }} [env]
 * @returns {TrueDepthCheck}
 */
export function detectTrueDepthSupport(env) {
  const e = env || (typeof navigator !== "undefined" ? navigator : null);
  if (!e) return { supported: false, reason: TRUEDEPTH_REASON.SSR };

  const ua = typeof e.userAgent === "string" ? e.userAgent : "";
  const xr = ("xr" in e) ? e.xr : null;

  if (!xr || typeof xr.isSessionSupported !== "function") {
    return { supported: false, reason: TRUEDEPTH_REASON.NO_XR };
  }

  // iOS UA gating: must be iPhone (front TrueDepth-capable) AND iOS >= 17.2.
  const isIphone = /iPhone/.test(ua);
  const iosMatch = ua.match(/OS (\d+)_(\d+)/);
  const ios = iosMatch ? { major: Number(iosMatch[1]), minor: Number(iosMatch[2]) } : null;
  const meetsIosFloor =
    ios &&
    (ios.major > TRUEDEPTH_DEFAULTS.minIosMajor ||
      (ios.major === TRUEDEPTH_DEFAULTS.minIosMajor && ios.minor >= TRUEDEPTH_DEFAULTS.minIosMinor));
  // Roughly "modern enough iPhone" — iPhone 12 and later UA strings
  // expand IPHONE_GEN_RE; older UAs are blocked even if Safari
  // mis-reports xr presence (defense-in-depth).
  const isLikelyA14Plus = isIphone && IPHONE_GEN_RE.test(ua);

  if (!isIphone || !ios || !meetsIosFloor || !isLikelyA14Plus) {
    return { supported: false, reason: TRUEDEPTH_REASON.UA_NOT_FRONT_DEPTH, ios: ios || undefined };
  }

  return { supported: true, reason: TRUEDEPTH_REASON.OK, ios };
}

/**
 * Build the WebXR session feature payload for TrueDepth front-camera
 * depth. Pure helper — emits the requestSession arg the caller hands
 * to `navigator.xr.requestSession("immersive-ar", payload)`.
 */
export function buildTrueDepthSessionInit(opts) {
  const o = opts || {};
  const formats = Array.isArray(o.formats) && o.formats.length > 0
    ? o.formats
    : TRUEDEPTH_DEFAULTS.preferredFormats;
  const usage = Array.isArray(o.usage) && o.usage.length > 0
    ? o.usage
    : TRUEDEPTH_DEFAULTS.preferredUsage;

  // Validate enums so a future caller can't smuggle in a bogus format
  // string and silently break pose anchoring.
  for (const f of formats) {
    if (!TRUEDEPTH_DEFAULTS.preferredFormats.includes(f)) {
      throw new Error(`buildTrueDepthSessionInit: unknown format '${f}'`);
    }
  }
  for (const u of usage) {
    if (!TRUEDEPTH_DEFAULTS.preferredUsage.includes(u)) {
      throw new Error(`buildTrueDepthSessionInit: unknown usage '${u}'`);
    }
  }

  return {
    requiredFeatures: ["depth-sensing"],
    optionalFeatures: ["camera-access", "anchors"],
    depthSensing: {
      usagePreference: usage,
      dataFormatPreference: formats,
    },
  };
}

/**
 * Try to start a TrueDepth WebXR session. Resolves with a tagged
 * outcome object instead of throwing, so the /mirror UI can render a
 * graceful banner ("Your phone doesn't expose depth — using inferred
 * pose mode") without try/catching at every call site.
 *
 * @param {object} navLike  navigator-like object exposing `.xr.requestSession`
 * @param {object} [opts]   forwarded to buildTrueDepthSessionInit
 * @returns {Promise<{ ok: boolean, session?: object, reason: string, error?: Error }>}
 */
export async function tryStartTrueDepthSession(navLike, opts) {
  const cap = detectTrueDepthSupport(navLike);
  if (!cap.supported) return { ok: false, reason: cap.reason };
  try {
    const init = buildTrueDepthSessionInit(opts);
    const supported = await navLike.xr.isSessionSupported("immersive-ar");
    if (!supported) return { ok: false, reason: TRUEDEPTH_REASON.NO_DEPTH_API };
    const session = await navLike.xr.requestSession("immersive-ar", init);
    return { ok: true, session, reason: TRUEDEPTH_REASON.OK };
  } catch (err) {
    const reason =
      err && /denied|permission/i.test(String(err.message || ""))
        ? TRUEDEPTH_REASON.USER_DECLINED
        : TRUEDEPTH_REASON.UNKNOWN_FAILURE;
    return { ok: false, reason, error: err };
  }
}

/**
 * Read the user's persisted preference for the TrueDepth toggle. Pure;
 * accepts an injectable storage so the mirror page can swap in URL
 * params for embed mode without rewiring this module.
 */
export function readTrueDepthPreference(storage, key = "vfit:truedepth") {
  if (!storage || typeof storage.getItem !== "function") return null;
  const v = storage.getItem(key);
  if (v === "on") return true;
  if (v === "off") return false;
  return null;
}

export function writeTrueDepthPreference(storage, on, key = "vfit:truedepth") {
  if (!storage || typeof storage.setItem !== "function") return false;
  storage.setItem(key, on ? "on" : "off");
  return true;
}

export const TRUEDEPTH_VERSION = "1.0.0";
