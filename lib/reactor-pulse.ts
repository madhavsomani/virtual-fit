/**
 * Reactor pulse — deterministic breathing intensity for the chest's
 * arc reactor. Returns a multiplier in [minIntensity, maxIntensity]
 * given a clock time in milliseconds.
 *
 * Pure (no DOM, no clock dep) so it can be unit-tested.
 *
 * Default cadence: ~1.4 s breath, 60% .. 130% of base intensity.
 */

export interface PulseOptions {
  periodMs?: number;
  minIntensity?: number;
  maxIntensity?: number;
}

export function reactorPulse(timeMs: number, options: PulseOptions = {}): number {
  const period = options.periodMs ?? 1400;
  const lo = options.minIntensity ?? 0.6;
  const hi = options.maxIntensity ?? 1.3;
  if (!Number.isFinite(timeMs) || period <= 0) return (lo + hi) / 2;
  // Sine in [-1, 1] → [0, 1] → [lo, hi].
  const phase = (timeMs % period) / period; // 0..1
  const s = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  return lo + (hi - lo) * s;
}
