// Phase 4.2 — Background removal via Hugging Face Inference API.
// Model: briaai/RMBG-1.4 (free, ~3M downloads). Used as the fallback path when
// segformer can't find a garment class in the input image (e.g. flat product
// photo of a shirt on white background, no person visible).
//
// Returns a PNG with transparent background.
//
// Token: NEXT_PUBLIC_HF_TOKEN (browser-callable; HF read tokens are low-risk).
//
// Phase 7.29: the segformer→RMBG fall-through orchestration lives in
// isolate-garment.mjs (single truth source). isolateGarment() is now a
// typed forwarder so the coverage-threshold logic isn't maintained twice.
import { isolateGarmentImpl } from "./isolate-garment.mjs";

const HF_RMBG_PATH = "briaai/RMBG-1.4";
const HF_RMBG_DIRECT_URL = `https://api-inference.huggingface.co/models/${HF_RMBG_PATH}`;
const HF_RMBG_PROXY_URL = `/api/hf-proxy/${HF_RMBG_PATH}`;

export type RemoveBackgroundOptions = {
  token?: string;
  signal?: AbortSignal;
};

// Phase 7.86 — same proxy-by-default pattern as garment-segment.ts.
function resolveEndpoint(opts?: RemoveBackgroundOptions): { url: string; headers: Record<string, string> } {
  const explicit = opts?.token || (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_HF_TOKEN : undefined);
  if (explicit) {
    return {
      url: HF_RMBG_DIRECT_URL,
      headers: {
        Authorization: `Bearer ${explicit}`,
        "Content-Type": "application/octet-stream",
        Accept: "image/png",
      },
    };
  }
  return {
    url: HF_RMBG_PROXY_URL,
    headers: {
      "Content-Type": "application/octet-stream",
      Accept: "image/png",
    },
  };
}

/**
 * Phase 4.2 — Send an image to RMBG-1.4 and return the same image with
 * the background pixels made transparent. The HF endpoint returns a PNG
 * directly (image/png blob).
 */
export async function removeBackground(
  input: Blob | File,
  opts?: RemoveBackgroundOptions,
): Promise<Blob> {
  const { url, headers } = resolveEndpoint(opts);
  const bytes = await input.arrayBuffer();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: bytes,
    signal: opts?.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HF RMBG ${res.status}: ${body.slice(0, 200)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) {
    // Some HF responses return JSON {error, estimated_time} when the model is loading.
    const body = await res.text().catch(() => "");
    throw new Error(`HF RMBG returned non-image content-type=${ct}: ${body.slice(0, 200)}`);
  }

  return await res.blob();
}

/**
 * Phase 4.2 — Try segformer first (best for "person wearing garment" photos).
 * Fall back to RMBG-1.4 (best for flat product photos). Returns the cleanest
 * transparent-background PNG we can produce.
 */
export async function isolateGarment(
  input: Blob | File,
  segment: (
    input: Blob | File,
    opts?: { token?: string; signal?: AbortSignal },
  ) => Promise<{ garmentPng: Blob; coverage: number }>,
  opts?: RemoveBackgroundOptions,
): Promise<{ png: Blob; method: "segformer" | "rmbg" }> {
  // Phase 7.29: thin typed wrapper. Real logic lives in
  // isolate-garment.mjs so node:test and Next compile against the same source.
  return isolateGarmentImpl(
    input,
    (b: Blob | File) => segment(b, opts),
    (b: Blob | File) => removeBackground(b, opts),
  ) as Promise<{ png: Blob; method: "segformer" | "rmbg" }>;
}
