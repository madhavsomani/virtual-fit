// Phase 4.4 — JS-importable pure orchestrator (mirrors image-to-glb.ts).

export async function imageToGlbPipelineImpl(input, opts = {}) {
  const isolate = opts.isolate;
  const segment = opts.segment;
  const trellis = opts.trellis;
  const onProgress = opts.onProgress;

  if (!isolate || !segment || !trellis) {
    throw new Error("imageToGlbPipelineImpl: isolate/segment/trellis must be provided");
  }

  onProgress?.({ stage: "segmenting" });
  const { png, method } = await isolate(input, segment, { token: opts.token, signal: opts.signal });

  onProgress?.({ stage: "trellis" });
  const { glbUrl } = await trellis(
    png,
    (p) => onProgress?.({ stage: "trellis", fraction: p.fraction, message: p.message }),
    { token: opts.token, signal: opts.signal },
  );

  onProgress?.({ stage: "complete", glbUrl });
  return { glbUrl, method };
}
