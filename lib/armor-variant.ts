/**
 * Armor variants — palette presets that swap the primary/accent colors
 * of every armor piece. Pure data, so the renderer can apply by index.
 *
 * `primary` = main shell color (chest plate, gauntlet, bicep, helmet, pad cap)
 * `accent`  = trim color (sternum, arc rim, helmet faceplate, halo)
 * `emissive` = self-glow tint applied to primary
 */

export type ArmorVariantId = "classic" | "stealth" | "hulkbuster" | "war_machine";

export interface ArmorVariant {
  id: ArmorVariantId;
  label: string;
  primary: string;
  accent: string;
  emissive: string;
  /** Multiplier on the reactor pulse base intensity */
  reactorBoost: number;
}

export const ARMOR_VARIANTS: readonly ArmorVariant[] = [
  { id: "classic",     label: "Mark VII",      primary: "#cf2a2a", accent: "#d4af37", emissive: "#280506", reactorBoost: 1.0 },
  { id: "stealth",     label: "Stealth",       primary: "#1f242b", accent: "#5a6470", emissive: "#080a0c", reactorBoost: 0.55 },
  { id: "hulkbuster",  label: "Hulkbuster",    primary: "#c41e1e", accent: "#1f6dd6", emissive: "#2a0606", reactorBoost: 1.2 },
  { id: "war_machine", label: "War Machine",   primary: "#2c2f33", accent: "#9aa0a6", emissive: "#101012", reactorBoost: 0.9 }
];

export function getVariant(id: ArmorVariantId): ArmorVariant {
  return ARMOR_VARIANTS.find((v) => v.id === id) ?? ARMOR_VARIANTS[0];
}

export function nextVariant(id: ArmorVariantId): ArmorVariant {
  const idx = ARMOR_VARIANTS.findIndex((v) => v.id === id);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % ARMOR_VARIANTS.length;
  return ARMOR_VARIANTS[nextIdx];
}
