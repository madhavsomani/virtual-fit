// Phase 8.12 — Social-share clip recorder.
//
// Pure controller around the browser's MediaRecorder API. Wraps an
// injectable recorder factory + URL/Blob facades so the whole module
// is testable under `node:test` without a DOM. Auto-blur background
// is *not* implemented here — segmentation lives upstream of the
// stream we receive (Phase 8.13+). The controller carries a boolean
// `autoBlur` flag that callers can wire to a SegmentationStream
// transform later without changing recorder semantics.
//
// State machine:
//   idle ──start──▶ recording ──stop──▶ ready ──reset──▶ idle
//                  │                  ▲
//                  └──auto-stop @ T──┘
//
// API:
//   const rec = createClipRecorder({ stream, options?, factories? })
//   rec.start({ maxDurationMs?, mimeType?, autoBlur? })
//   rec.stop()                    // resolves with { blob, durationMs, ... }
//   rec.reset()
//   rec.getState()                // 'idle' | 'recording' | 'ready' | 'error'
//   rec.subscribe(fn)             // returns unsubscribe; fn({ state, ... })
//   buildShareIntents({ blobUrl, caption?, hashtags?, deepLink? })
//     → { instagram:{href,kind}, tiktok:{href,kind}, twitter:{href,kind},
//         download:{href, filename}, copy:{text} }

export const DEFAULT_MIME_TYPES = Object.freeze([
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
]);

export const MAX_CLIP_MS = 30_000;
export const DEFAULT_CLIP_MS = 10_000;

function pickMimeType(candidates, isSupported) {
  for (const t of candidates) {
    if (isSupported(t)) return t;
  }
  return null;
}

function clampDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_CLIP_MS;
  if (ms > MAX_CLIP_MS) return MAX_CLIP_MS;
  return Math.floor(ms);
}

/**
 * @param {object} opts
 * @param {MediaStream|object} opts.stream  — MediaStream or any opaque token
 * @param {object} [opts.factories]
 * @param {(stream, options) => any} [opts.factories.createRecorder]
 * @param {(type: string) => boolean} [opts.factories.isTypeSupported]
 * @param {(blob: Blob) => string} [opts.factories.createObjectURL]
 * @param {(url: string) => void}  [opts.factories.revokeObjectURL]
 * @param {(fn: () => void, ms: number) => any} [opts.factories.setTimeout]
 * @param {(handle: any) => void}  [opts.factories.clearTimeout]
 */
export function createClipRecorder({ stream, factories = {} } = {}) {
  if (stream === null || stream === undefined) {
    throw new Error("createClipRecorder: stream is required");
  }

  const f = {
    createRecorder:
      factories.createRecorder ||
      ((s, o) => new globalThis.MediaRecorder(s, o)),
    isTypeSupported:
      factories.isTypeSupported ||
      ((t) => globalThis.MediaRecorder?.isTypeSupported?.(t) ?? false),
    createObjectURL:
      factories.createObjectURL ||
      ((b) => globalThis.URL?.createObjectURL?.(b) ?? ""),
    revokeObjectURL:
      factories.revokeObjectURL ||
      ((u) => globalThis.URL?.revokeObjectURL?.(u)),
    setTimeout: factories.setTimeout || ((fn, ms) => globalThis.setTimeout(fn, ms)),
    clearTimeout: factories.clearTimeout || ((h) => globalThis.clearTimeout(h)),
  };

  let state = "idle";
  let recorder = null;
  let chunks = [];
  let startedAt = 0;
  let stopTimer = null;
  let lastResult = null; // { blob, blobUrl, durationMs, mimeType }
  let lastError = null;
  let stopResolver = null;
  let activeAutoBlur = false;
  const subscribers = new Set();

  function emit() {
    const snap = {
      state,
      lastError,
      lastResult,
      autoBlur: activeAutoBlur,
    };
    for (const fn of subscribers) {
      try { fn(snap); } catch { /* subscriber errors must not break controller */ }
    }
  }

  function clearStopTimer() {
    if (stopTimer !== null) {
      f.clearTimeout(stopTimer);
      stopTimer = null;
    }
  }

  function fail(err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    state = "error";
    clearStopTimer();
    if (stopResolver) {
      const r = stopResolver;
      stopResolver = null;
      r.reject(lastError);
    }
    emit();
  }

  function start({ maxDurationMs = DEFAULT_CLIP_MS, mimeType, autoBlur = false } = {}) {
    if (state === "recording") throw new Error("clip-recorder: already recording");
    const candidates = mimeType ? [mimeType, ...DEFAULT_MIME_TYPES] : DEFAULT_MIME_TYPES;
    const chosen = pickMimeType(candidates, f.isTypeSupported);
    if (!chosen) {
      const e = new Error("clip-recorder: no supported MIME type");
      fail(e);
      throw e;
    }
    const dur = clampDuration(maxDurationMs);
    chunks = [];
    lastResult = null;
    lastError = null;
    activeAutoBlur = !!autoBlur;
    try {
      recorder = f.createRecorder(stream, { mimeType: chosen });
    } catch (e) {
      fail(e);
      throw lastError;
    }

    recorder.ondataavailable = (ev) => {
      const data = ev?.data;
      if (data && (typeof data.size !== "number" || data.size > 0)) chunks.push(data);
    };
    recorder.onerror = (ev) => fail(ev?.error || new Error("MediaRecorder error"));
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAt;
      const BlobCtor = globalThis.Blob || class {
        constructor(parts, opts) { this.parts = parts; this.type = opts?.type || ""; this.size = parts.reduce((a, p) => a + (p?.size || 0), 0); }
      };
      const blob = new BlobCtor(chunks, { type: chosen });
      const blobUrl = f.createObjectURL(blob);
      lastResult = { blob, blobUrl, durationMs, mimeType: chosen, autoBlur: activeAutoBlur };
      state = "ready";
      clearStopTimer();
      emit();
      if (stopResolver) {
        const r = stopResolver;
        stopResolver = null;
        r.resolve(lastResult);
      }
    };

    startedAt = Date.now();
    state = "recording";
    try {
      recorder.start();
    } catch (e) {
      fail(e);
      throw lastError;
    }
    stopTimer = f.setTimeout(() => {
      if (state === "recording") {
        try { recorder.stop(); } catch (e) { fail(e); }
      }
    }, dur);
    emit();
  }

  function stop() {
    if (state !== "recording") {
      return Promise.reject(new Error(`clip-recorder: cannot stop in state '${state}'`));
    }
    return new Promise((resolve, reject) => {
      stopResolver = { resolve, reject };
      try { recorder.stop(); } catch (e) { fail(e); }
    });
  }

  function reset() {
    clearStopTimer();
    if (lastResult?.blobUrl) {
      try { f.revokeObjectURL(lastResult.blobUrl); } catch { /* noop */ }
    }
    chunks = [];
    lastResult = null;
    lastError = null;
    recorder = null;
    activeAutoBlur = false;
    state = "idle";
    emit();
  }

  function getState() { return state; }
  function getLastResult() { return lastResult; }
  function getLastError() { return lastError; }

  function subscribe(fn) {
    if (typeof fn !== "function") throw new Error("subscribe: fn must be a function");
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  return { start, stop, reset, getState, getLastResult, getLastError, subscribe };
}

/**
 * Build platform share intents. Instagram & TikTok don't accept arbitrary
 * file uploads via web URL on desktop, so we surface a download + copy
 * fallback alongside any deep link the caller passed.
 */
export function buildShareIntents({
  blobUrl,
  caption = "",
  hashtags = [],
  deepLink = null,
  filename = "virtualfit-clip.webm",
} = {}) {
  if (typeof blobUrl !== "string" || blobUrl.length === 0) {
    throw new Error("buildShareIntents: blobUrl is required");
  }
  if (!Array.isArray(hashtags)) {
    throw new Error("buildShareIntents: hashtags must be an array");
  }
  const cleanedTags = hashtags
    .map((t) => String(t).replace(/^#/, "").replace(/\s+/g, ""))
    .filter(Boolean);
  const tagBlob = cleanedTags.map((t) => `#${t}`).join(" ");
  const fullText = [caption, tagBlob, deepLink].filter(Boolean).join(" ").trim();

  const enc = encodeURIComponent;
  return {
    download: { href: blobUrl, filename, kind: "download" },
    copy: { text: fullText, kind: "copy-text" },
    twitter: {
      kind: "web-intent",
      href: `https://twitter.com/intent/tweet?text=${enc(fullText)}`,
    },
    instagram: {
      kind: "deep-link",
      href: "instagram://share",
      hint: "Instagram requires native share. Save the clip then upload from the IG app.",
    },
    tiktok: {
      kind: "deep-link",
      href: "snssdk1233://share",
      hint: "TikTok requires native share. Save the clip then upload from the TikTok app.",
    },
  };
}
