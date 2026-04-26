// Phase 7.92 — humanize Photo→3D pipeline errors for end users.
//
// Pre-7.92 the /generate-3d (and /mirror) error UIs just rendered the raw
// error.message verbatim. That leaks internals like:
//   "TRELLIS queue_full: {"msg":"queue_full","queue_size":47,..."
//   "TRELLIS queue/data 503"
//   "fetch failed"
//   "HF proxy 413: payload too large"
//   "TRELLIS stream timeout"
//   "TRELLIS completed without a GLB path"
//   "Failed to fetch"
//   "TypeError: NetworkError when attempting to fetch resource"
// Users see jargon, can't tell what to do, bounce. This lookup maps every
// known internal failure surface to a plain-English title + body + suggested
// recovery action, AND preserves the raw message in `details` for support.
//
// Design contract: every branch returns { title, body, action, retryable, details }.
// - title:     short noun phrase ("Photo too large", "TRELLIS is busy")
// - body:      one-sentence explanation a non-technical user understands
// - action:    one imperative ("Try a smaller photo", "Wait a minute and retry")
// - retryable: boolean — does it make sense to show a "Try Again" button?
//   (false for "photo too large" — they need to pick a different file;
//    true for transient TRELLIS/proxy/network errors)
// - details:   the raw error.message, for the "Show details" toggle
//
// Adding a new mapping: add a (regex, mapping) pair to MAPPINGS. Order
// matters — first match wins. The catch-all at the end ensures we always
// return a valid shape.

export type HumanError = {
  title: string;
  body: string;
  action: string;
  retryable: boolean;
  details: string;
};

type Mapping = {
  pattern: RegExp;
  build: (raw: string) => Omit<HumanError, "details">;
};

// Pre-bake the recovery copy that's reused across patterns to keep the
// suggested actions consistent with each other.
const RETRY_LATER = "Wait a minute and try again — the free 3D service is shared and gets busy.";
const TRY_DIFFERENT_PHOTO = "Try a different photo — clear, well-lit, garment centered.";
const SMALLER_PHOTO = "Try a smaller photo (under 8 MB) — phone JPEGs work great.";
const CHECK_NETWORK = "Check your internet connection and try again.";

const MAPPINGS: Mapping[] = [
  // --- Payload size limits (HF proxy 413, browser body too large) ---
  {
    pattern: /\b(413|payload too large|file too large|maximum.+size|too\s*big)\b/i,
    build: () => ({
      title: "Photo too large",
      body: "We need photos under 8 MB to keep the free 3D service fast.",
      action: SMALLER_PHOTO,
      retryable: false,
    }),
  },

  // --- TRELLIS queue / capacity failures ---
  {
    pattern: /TRELLIS\s+queue_full|queue is full|too many requests/i,
    build: () => ({
      title: "TRELLIS is busy right now",
      body: "The free 3D-generation queue is full — this happens at peak times.",
      action: RETRY_LATER,
      retryable: true,
    }),
  },
  {
    pattern: /TRELLIS\s+(queue\/data\s+)?5\d{2}\b|TRELLIS\s+process_failed/i,
    build: () => ({
      title: "TRELLIS hit a snag",
      body: "The free 3D-generation service had an internal error on this photo.",
      action: RETRY_LATER,
      retryable: true,
    }),
  },
  {
    pattern: /TRELLIS\s+stream\s+timeout|TRELLIS\s+stream\s+ended\s+without\s+completion|TRELLIS\s+completed\s+without\s+a\s+GLB\s+path/i,
    build: () => ({
      title: "3D generation stalled",
      body: "The 3D mesh request didn't finish in time — usually means the service was overloaded.",
      action: RETRY_LATER,
      retryable: true,
    }),
  },

  // --- HF proxy / segformer / RMBG failures (Phase 7.86) ---
  {
    pattern: /HF\s+proxy\s+503|HF_TOKEN.+(missing|unset|not\s+configured)|NEXT_PUBLIC_HF_TOKEN/i,
    build: () => ({
      title: "3D service not configured",
      body: "VirtualFit's free 3D pipeline isn't set up on this server yet.",
      action: "We'll fix this soon — please email support@virtualfit.app if it persists.",
      retryable: false,
    }),
  },
  {
    pattern: /HF\s+proxy\s+4\d{2}\b|segformer.+(failed|error)|RMBG.+(failed|error)/i,
    build: () => ({
      title: "Couldn't isolate the garment",
      body: "We couldn't separate the garment from the background in this photo.",
      action: TRY_DIFFERENT_PHOTO,
      retryable: false,
    }),
  },

  // --- Network / fetch failures ---
  {
    pattern: /failed to fetch|network ?error|networkerror|fetch\s+failed|err_internet_disconnected/i,
    build: () => ({
      title: "Network problem",
      body: "We couldn't reach the 3D-generation service.",
      action: CHECK_NETWORK,
      retryable: true,
    }),
  },
  {
    pattern: /aborted|abort\s*error|user\s+cancelled/i,
    build: () => ({
      title: "Cancelled",
      body: "The 3D-generation request was cancelled before it finished.",
      action: "Tap Try Again to restart.",
      retryable: true,
    }),
  },

  // --- Image format / decode failures ---
  {
    pattern: /unsupported\s+(image|format|mime)|invalid\s+image|cannot\s+decode|not\s+a\s+valid\s+image/i,
    build: () => ({
      title: "Photo format not supported",
      body: "We need a JPEG, PNG, or WebP image.",
      action: "Save the photo as JPEG or PNG and try again.",
      retryable: false,
    }),
  },
];

const FALLBACK: Omit<HumanError, "details"> = {
  title: "Something went wrong",
  body: "We couldn't generate a 3D mesh from this photo.",
  action: "Try Again, or pick a different photo.",
  retryable: true,
};

/**
 * Map a raw pipeline error to a user-facing { title, body, action, retryable, details }.
 *
 * Accepts:
 *   - Error instance (uses .message)
 *   - string (uses verbatim)
 *   - any other value (coerced via String())
 *
 * Always returns a valid HumanError; never throws.
 */
export function humanizePipelineError(err: unknown): HumanError {
  const raw = errorMessage(err);
  for (const m of MAPPINGS) {
    if (m.pattern.test(raw)) {
      return { ...m.build(raw), details: raw };
    }
  }
  return { ...FALLBACK, details: raw };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "string") return err;
  if (err == null) return "";
  try {
    return String(err);
  } catch {
    return "";
  }
}
