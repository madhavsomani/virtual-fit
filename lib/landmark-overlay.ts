/**
 * Landmark debug overlay — small SVG dots + skeleton lines drawn over the
 * webcam feed showing exactly which body points the tracker is reading
 * each frame. Toggleable via a button in Tryon.
 *
 * Pure data: returns the list of points/edges to render. The component
 * itself is a Tryon-internal SVG; this module is the data layer.
 */

import type { PoseLandmark } from "./armor";

export interface OverlayPoint {
  id: number;
  x: number; // 0..1, video space
  y: number; // 0..1
  visibility: number;
}

export interface OverlayEdge {
  from: number;
  to: number;
}

// Subset of MediaPipe pose landmarks that matter to the armor: shoulders,
// elbows, wrists, hips, plus the head trio (nose, ears) for the helmet.
export const OVERLAY_LANDMARKS = [
  0, // nose
  7, 8, // ears
  11, 12, // shoulders
  13, 14, // elbows
  15, 16, // wrists
  23, 24 // hips
] as const;

// Drawn lines (which dots to connect with a thin skeleton).
export const OVERLAY_EDGES: OverlayEdge[] = [
  { from: 11, to: 12 }, // shoulder line
  { from: 11, to: 23 }, // left side
  { from: 12, to: 24 }, // right side
  { from: 23, to: 24 }, // hip line
  { from: 11, to: 13 }, // left upper arm
  { from: 13, to: 15 }, // left forearm
  { from: 12, to: 14 }, // right upper arm
  { from: 14, to: 16 }, // right forearm
  { from: 7, to: 0 }, // ear-nose
  { from: 8, to: 0 }
];

const MIN_VIS = 0.2;

export interface BuildOverlayOpts {
  mirrorX?: boolean;
}

export function buildOverlayPoints(
  landmarks: readonly PoseLandmark[] | null,
  opts: BuildOverlayOpts = {}
): OverlayPoint[] {
  if (!landmarks || landmarks.length === 0) return [];
  const out: OverlayPoint[] = [];
  for (const id of OVERLAY_LANDMARKS) {
    const l = landmarks[id];
    if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) continue;
    const vis = l.visibility ?? 1;
    if (vis < MIN_VIS) continue;
    out.push({
      id,
      x: opts.mirrorX ? 1 - l.x : l.x,
      y: l.y,
      visibility: vis
    });
  }
  return out;
}

/** Edges where both endpoints are present in the points list. */
export function visibleEdges(points: OverlayPoint[]): OverlayEdge[] {
  const seen = new Set(points.map((p) => p.id));
  return OVERLAY_EDGES.filter((e) => seen.has(e.from) && seen.has(e.to));
}
