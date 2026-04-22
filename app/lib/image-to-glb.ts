// Phase 4.4 — End-to-end image→GLB pipeline orchestrator.
// Chains: isolate garment (segformer + RMBG fallback) → TRELLIS image→3D → GLB URL.
// Pure orchestration; HTTP-touching pieces are injected so the unit test can mock them.
import { isolateGarment } from "./remove-background";
import { segmentGarment } from "./garment-segment";
import { generateGlbFromImage, type TrellisProgress } from "./trellis-client";

export type PipelineProgress =
  | { stage: "segmenting"; message?: string }
  | { stage: "trellis"; message?: string; fraction?: number }
  | { stage: "complete"; glbUrl: string };

export type PipelineOptions = {
  token?: string;
  signal?: AbortSignal;
  onProgress?: (p: PipelineProgress) => void;
  // Injectable seams for tests.
  _isolate?: typeof isolateGarment;
  _segment?: typeof segmentGarment;
  _trellis?: typeof generateGlbFromImage;
};

export async function imageToGlbPipeline(
  input: Blob | File,
  opts: PipelineOptions = {},
): Promise<{ glbUrl: string; method: "segformer" | "rmbg" }> {
  const isolate = opts._isolate ?? isolateGarment;
  const segment = opts._segment ?? segmentGarment;
  const trellis = opts._trellis ?? generateGlbFromImage;
  const onProgress = opts.onProgress;

  onProgress?.({ stage: "segmenting", message: "Isolating garment from background…" });
  const { png, method } = await isolate(input, segment, {
    token: opts.token,
    signal: opts.signal,
  });

  onProgress?.({ stage: "trellis", message: "Generating 3D mesh…" });
  const { glbUrl } = await trellis(
    png,
    (p: TrellisProgress) =>
      onProgress?.({ stage: "trellis", fraction: p.fraction, message: p.message }),
    { token: opts.token, signal: opts.signal },
  );

  onProgress?.({ stage: "complete", glbUrl });
  return { glbUrl, method };
}
