// Phase 7.92 — humanizePipelineError unit tests.
//
// The contract: every raw pipeline error message produces a non-empty
// { title, body, action, retryable, details } shape, with stable mappings
// for known failure surfaces. The "details" field always preserves the
// raw error.message so support can debug, but the user-facing fields are
// always plain English.
import test from "node:test";
import assert from "node:assert/strict";
import { humanizePipelineError } from "../app/lib/humanize-pipeline-error.ts";

function check(err, expected) {
  const h = humanizePipelineError(err);
  assert.equal(h.title, expected.title, `title mismatch for "${err}"`);
  if (expected.actionMatch) {
    assert.match(h.action, expected.actionMatch, `action mismatch for "${err}"`);
  }
  assert.equal(h.retryable, expected.retryable, `retryable mismatch for "${err}"`);
  assert.ok(h.body.length > 0, "body must be non-empty");
  assert.ok(h.title.length > 0, "title must be non-empty");
  assert.ok(h.action.length > 0, "action must be non-empty");
  return h;
}

// --- Payload-too-large (HF proxy 413) ---
test("payload too large → 'Photo too large', not retryable", () => {
  const h = check(new Error("HF proxy 413: payload too large"), {
    title: "Photo too large",
    actionMatch: /smaller photo/i,
    retryable: false,
  });
  assert.match(h.details, /HF proxy 413/);
});

test("'too big' phrasing also maps to Photo too large", () => {
  check(new Error("Image is too big to upload"), {
    title: "Photo too large",
    retryable: false,
  });
});

// --- TRELLIS queue / capacity ---
test("TRELLIS queue_full → 'TRELLIS is busy right now', retryable", () => {
  check(new Error('TRELLIS queue_full: {"msg":"queue_full","queue_size":47}'), {
    title: "TRELLIS is busy right now",
    actionMatch: /wait|retry|busy/i,
    retryable: true,
  });
});

test("TRELLIS process_failed → 'TRELLIS hit a snag', retryable", () => {
  check(new Error('TRELLIS process_failed: {"msg":"process_failed"}'), {
    title: "TRELLIS hit a snag",
    retryable: true,
  });
});

test("TRELLIS queue/data 503 → 'TRELLIS hit a snag', retryable", () => {
  check(new Error("TRELLIS queue/data 503"), {
    title: "TRELLIS hit a snag",
    retryable: true,
  });
});

// --- TRELLIS streaming/timeout failures ---
test("TRELLIS stream timeout → '3D generation stalled', retryable", () => {
  check(new Error("TRELLIS stream timeout"), {
    title: "3D generation stalled",
    retryable: true,
  });
});

test("TRELLIS completed without GLB path → '3D generation stalled', retryable", () => {
  check(new Error("TRELLIS completed without a GLB path"), {
    title: "3D generation stalled",
    retryable: true,
  });
});

// --- HF proxy / token / segmentation ---
test("NEXT_PUBLIC_HF_TOKEN missing → '3D service not configured', NOT retryable", () => {
  // This is an operator problem, not a user problem — Try Again won't help.
  check(new Error("NEXT_PUBLIC_HF_TOKEN is not configured"), {
    title: "3D service not configured",
    retryable: false,
  });
});

test("HF proxy 503 → '3D service not configured'", () => {
  check(new Error("HF proxy 503: token missing"), {
    title: "3D service not configured",
    retryable: false,
  });
});

test("segformer failed → 'Couldn't isolate the garment', NOT retryable", () => {
  // Different photo will likely succeed; retrying same photo won't.
  check(new Error("segformer call failed: 422"), {
    title: "Couldn't isolate the garment",
    retryable: false,
  });
});

// --- Network ---
test("'Failed to fetch' → 'Network problem', retryable", () => {
  check(new Error("Failed to fetch"), {
    title: "Network problem",
    actionMatch: /internet|network|connection/i,
    retryable: true,
  });
});

test("'NetworkError when attempting to fetch resource' → 'Network problem'", () => {
  check(new Error("NetworkError when attempting to fetch resource"), {
    title: "Network problem",
    retryable: true,
  });
});

// --- Cancelled ---
test("AbortError-style → 'Cancelled', retryable", () => {
  check(new Error("The operation was aborted."), {
    title: "Cancelled",
    retryable: true,
  });
});

// --- Image format ---
test("'invalid image' → 'Photo format not supported', NOT retryable", () => {
  check(new Error("Invalid image format"), {
    title: "Photo format not supported",
    retryable: false,
  });
});

// --- Catch-all ---
test("unknown error string → fallback 'Something went wrong', retryable", () => {
  check(new Error("totally unrecognized failure mode 9001"), {
    title: "Something went wrong",
    retryable: true,
  });
});

// --- Input shapes ---
test("accepts plain string", () => {
  const h = humanizePipelineError("TRELLIS queue_full");
  assert.equal(h.title, "TRELLIS is busy right now");
});

test("accepts null/undefined without throwing (catch-all)", () => {
  assert.doesNotThrow(() => humanizePipelineError(null));
  assert.doesNotThrow(() => humanizePipelineError(undefined));
  const h = humanizePipelineError(null);
  assert.equal(h.title, "Something went wrong");
  assert.equal(h.details, "");
});

test("accepts non-Error object via String() coercion", () => {
  const h = humanizePipelineError({ status: "queue_full" });
  // Stringified to "[object Object]" → falls through to fallback.
  assert.equal(h.title, "Something went wrong");
});

// --- Always returns a valid shape ---
test("output always has all required fields", () => {
  const samples = [
    new Error("TRELLIS queue_full"),
    new Error("Failed to fetch"),
    "random",
    null,
    {},
    new Error(""),
  ];
  for (const s of samples) {
    const h = humanizePipelineError(s);
    assert.equal(typeof h.title, "string");
    assert.equal(typeof h.body, "string");
    assert.equal(typeof h.action, "string");
    assert.equal(typeof h.retryable, "boolean");
    assert.equal(typeof h.details, "string");
    assert.ok(h.title.length > 0);
    assert.ok(h.body.length > 0);
    assert.ok(h.action.length > 0);
  }
});

// --- Wiring guard: generate-3d page imports + uses humanizePipelineError ---
test("generate-3d page wires humanizePipelineError into the catch block", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    resolve(__dirname, "../app/generate-3d/page.tsx"),
    "utf8",
  );
  assert.match(
    src,
    /from\s+["']\.\.\/lib\/humanize-pipeline-error["']/,
    "must import humanizePipelineError",
  );
  assert.match(
    src,
    /humanizePipelineError\s*\(\s*err\s*\)/,
    "must call humanizePipelineError(err) in the catch block",
  );
  assert.match(
    src,
    /humanError\?\.\s*title/,
    "must render humanError.title in the error UI",
  );
  assert.match(
    src,
    /humanError\?\.\s*retryable/,
    "must use humanError.retryable to choose Try Again vs Pick a different photo",
  );
});
