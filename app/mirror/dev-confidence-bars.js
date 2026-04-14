function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function confidenceColor(value) {
  if (value >= 0.75) return "#2ecc71";
  if (value >= 0.6) return "#f1c40f";
  return "#e74c3c";
}

/**
 * Build display-ready confidence bars for dev diagnostics.
 *
 * @param {{ tracking?: number | null, pose?: number | null, fallback?: number | null }} input
 * @returns {Array<{ key: string, label: string, value: number, percent: number, color: string }>}
 */
export function buildDevConfidenceBars(input) {
  const definitions = [
    { key: "tracking", label: "Tracking", value: input?.tracking },
    { key: "pose", label: "Pose", value: input?.pose },
    { key: "fallback", label: "Fallback", value: input?.fallback }
  ];

  return definitions
    .filter((item) => Number.isFinite(item.value))
    .map((item) => {
      const value = clamp(Number(item.value), 0, 1);
      return {
        key: item.key,
        label: item.label,
        value: Number(value.toFixed(2)),
        percent: Math.round(value * 100),
        color: confidenceColor(value)
      };
    });
}
