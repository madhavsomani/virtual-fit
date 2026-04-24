// Phase 7.31 — TS facade for the pure size estimator.
//
// The single truth source is `size-from-shoulder-width-pure.mjs` so
// node:test can import it directly without a TS toolchain. This file
// re-exports the function with typed bindings + a typed thresholds const
// so Next/TypeScript callers in `mirror/page.tsx` get full autocomplete
// and the size-string literal type.

import {
  estimateSizeFromShoulderRatio as _estimate,
  SHOULDER_RATIO_THRESHOLDS as _THRESHOLDS,
} from "./size-from-shoulder-width-pure.mjs";

export type EstimatedSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export const SHOULDER_RATIO_THRESHOLDS: ReadonlyArray<
  readonly [EstimatedSize, number]
> = _THRESHOLDS as unknown as ReadonlyArray<readonly [EstimatedSize, number]>;

export const estimateSizeFromShoulderRatio: (ratio: number) => EstimatedSize =
  _estimate as unknown as (ratio: number) => EstimatedSize;
