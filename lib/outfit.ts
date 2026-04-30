/**
 * Outfit presets — which body-anchored pieces are visible.
 *
 * The renderer multiplies its per-piece opacity target by the preset's
 * mask, so 'helmet' shows only the helmet, etc. Pure data + a tiny
 * cycle helper so wiring can stay one-liner in Tryon.tsx.
 */

export type OutfitId = "full" | "chestOnly" | "armsOnly" | "helmetOnly";

export interface OutfitMask {
  chest: number;
  helmet: number;
  bicep: number;
  gauntlet: number;
  shoulderPad: number;
}

export interface OutfitPreset {
  id: OutfitId;
  label: string;
  mask: OutfitMask;
}

export const OUTFIT_PRESETS: readonly OutfitPreset[] = [
  { id: "full",       label: "Full armor",  mask: { chest: 1, helmet: 1, bicep: 1, gauntlet: 1, shoulderPad: 1 } },
  { id: "chestOnly",  label: "Chest only",  mask: { chest: 1, helmet: 0, bicep: 0, gauntlet: 0, shoulderPad: 0 } },
  { id: "armsOnly",   label: "Arms only",   mask: { chest: 0, helmet: 0, bicep: 1, gauntlet: 1, shoulderPad: 1 } },
  { id: "helmetOnly", label: "Helmet only", mask: { chest: 0, helmet: 1, bicep: 0, gauntlet: 0, shoulderPad: 0 } }
];

export function nextOutfit(id: OutfitId): OutfitPreset {
  const i = OUTFIT_PRESETS.findIndex((p) => p.id === id);
  const next = OUTFIT_PRESETS[(i + 1) % OUTFIT_PRESETS.length];
  return next;
}

export function getOutfit(id: OutfitId): OutfitPreset {
  return OUTFIT_PRESETS.find((p) => p.id === id) ?? OUTFIT_PRESETS[0];
}
