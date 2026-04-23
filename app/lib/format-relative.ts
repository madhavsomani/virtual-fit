/**
 * Tiny relative-time formatter. Pure, no Intl dep, no allocations on the hot path.
 *
 * Used by /mirror to surface "generated 5m ago" next to the 3D garment status,
 * which closes the dead-write loop on the `virtualfit-glb-ts` localStorage
 * key (Phase 7.15).
 *
 * @param iso ISO-8601 timestamp string (e.g. `new Date().toISOString()`)
 * @param now optional clock override for tests; defaults to Date.now()
 * @returns short string like "just now", "5m ago", "2h ago", "3d ago",
 *          or null when `iso` is missing/unparseable/in the future by >1min.
 */
export function formatRelativeAgo(
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;

  const deltaMs = now - t;
  if (deltaMs < -60_000) return null; // future timestamp by more than 1 minute → ignore
  if (deltaMs < 60_000) return "just now";

  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  // Older than a month — just say "long ago" rather than introducing month math.
  return "long ago";
}
