// Phase 4.1 — Garment segmentation via Hugging Face Inference API.
// Model: mattmdjaga/segformer_b2_clothes (124K downloads, free tier).
// Returns a binary garment mask (Uint8ClampedArray, same dims as input image).
//
// HF Inference returns either:
//  - a JSON array of { label, mask: <base64 PNG> } objects (multi-class), or
//  - a raw image/png blob (single-class).
//
// Token: NEXT_PUBLIC_HF_TOKEN (browser-callable; HF read tokens are low-risk).
import {
  pickGarmentEntries,
  unionMaskAlpha,
  coverageFraction,
} from "./garment-segment-helpers.mjs";

const HF_MODEL_URL =
  "https://api-inference.huggingface.co/models/mattmdjaga/segformer_b2_clothes";

export type SegmentResult = {
  /** PNG blob of the garment-only image (alpha = mask). Same dims as input. */
  garmentPng: Blob;
  /** Detected garment labels included in the mask. */
  labels: string[];
  /** Approximate fraction of pixels that survived the mask (0..1). */
  coverage: number;
};

export type SegmentOptions = {
  /** HF token override; defaults to process.env.NEXT_PUBLIC_HF_TOKEN at call time. */
  token?: string;
  /** AbortSignal for the fetch. */
  signal?: AbortSignal;
};

function getToken(opts?: SegmentOptions): string {
  const t = opts?.token || process.env.NEXT_PUBLIC_HF_TOKEN;
  if (!t) {
    throw new Error(
      "NEXT_PUBLIC_HF_TOKEN is not configured. Set it in .env to use HF segmentation.",
    );
  }
  return t;
}

async function fileToBytes(input: Blob | File | ArrayBuffer): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return input;
  return await input.arrayBuffer();
}

async function loadImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(blob);
}

async function decodeMaskPng(b64: string): Promise<ImageBitmap> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });
  return await createImageBitmap(blob);
}

/**
 * Phase 4.1 — Send an image to HF segformer; return the original image with
 * non-garment pixels replaced by transparent alpha.
 */
export async function segmentGarment(
  input: Blob | File,
  opts?: SegmentOptions,
): Promise<SegmentResult> {
  const token = getToken(opts);
  const bytes = await fileToBytes(input);

  const res = await fetch(HF_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
    signal: opts?.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HF segformer ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: Array<{ label: string; mask: string }> = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("HF segformer returned empty response");
  }

  // Pick all garment-class masks and union them.
  const garmentEntries = pickGarmentEntries(json) as Array<{ label: string; mask: string }>;
  if (garmentEntries.length === 0) {
    throw new Error(
      `No garment classes detected. Got labels: ${json.map((e) => e.label).join(", ")}`,
    );
  }

  // Decode the original image (for sizing) and each mask, then composite.
  const imgBitmap = await loadImageBitmap(
    input instanceof Blob ? input : new Blob([bytes]),
  );
  const W = imgBitmap.width;
  const H = imgBitmap.height;

  const canvas = (typeof OffscreenCanvas !== "undefined")
    ? new OffscreenCanvas(W, H)
    : (() => {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        return c;
      })();
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Draw the original image first.
  ctx.drawImage(imgBitmap as CanvasImageSource, 0, 0, W, H);
  const orig = ctx.getImageData(0, 0, W, H);

  // Build a union alpha mask from all garment masks.
  const maskArrays: Uint8ClampedArray[] = [];
  for (const entry of garmentEntries) {
    const m = await decodeMaskPng(entry.mask);
    const tmp = (typeof OffscreenCanvas !== "undefined")
      ? new OffscreenCanvas(W, H)
      : (() => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          return c;
        })();
    const tctx = tmp.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    if (!tctx) continue;
    tctx.drawImage(m as CanvasImageSource, 0, 0, W, H);
    const md = tctx.getImageData(0, 0, W, H);
    const single = new Uint8ClampedArray(W * H);
    for (let i = 0; i < single.length; i++) single[i] = md.data[i * 4]; // R channel
    maskArrays.push(single);
  }
  const unionAlpha = unionMaskAlpha(maskArrays, W * H);

  // Apply the alpha mask to the original image (premultiplied-style: keep RGB, scale A).
  for (let i = 0; i < unionAlpha.length; i++) {
    orig.data[i * 4 + 3] = unionAlpha[i];
  }
  const coverage = coverageFraction(unionAlpha, 16);
  ctx.putImageData(orig, 0, 0);

  let garmentPng: Blob;
  if (canvas instanceof OffscreenCanvas) {
    garmentPng = await canvas.convertToBlob({ type: "image/png" });
  } else {
    garmentPng = await new Promise<Blob>((resolve, reject) =>
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      ),
    );
  }

  return {
    garmentPng,
    labels: garmentEntries.map((e) => e.label),
    coverage,
  };
}
