/**
 * UI preferences persisted across sessions via localStorage.
 *
 * Pure functions: load() and save() each take a Storage-like object so
 * tests can pass an in-memory mock. Unknown ids fall back to defaults
 * so a stale storage entry from an older build never breaks the UI.
 */

import type { OutfitId } from "./outfit";
import type { ArmorVariantId } from "./armor-variant";

export interface Preferences {
  outfitId: OutfitId;
  variantId: ArmorVariantId;
  debugLandmarks: boolean;
}

export const PREFS_KEY = "virtualfit:prefs:v1";

const VALID_OUTFITS: ReadonlySet<OutfitId> = new Set<OutfitId>([
  "full",
  "chestOnly",
  "armsOnly",
  "helmetOnly"
]);

const VALID_VARIANTS: ReadonlySet<ArmorVariantId> = new Set<ArmorVariantId>([
  "classic",
  "stealth",
  "hulkbuster",
  "war_machine"
]);

export const DEFAULT_PREFS: Preferences = {
  outfitId: "full",
  variantId: "classic",
  debugLandmarks: false
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadPrefs(storage: StorageLike | null | undefined): Preferences {
  if (!storage) return { ...DEFAULT_PREFS };
  try {
    const raw = storage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      outfitId: VALID_OUTFITS.has(parsed.outfitId as OutfitId)
        ? (parsed.outfitId as OutfitId)
        : DEFAULT_PREFS.outfitId,
      variantId: VALID_VARIANTS.has(parsed.variantId as ArmorVariantId)
        ? (parsed.variantId as ArmorVariantId)
        : DEFAULT_PREFS.variantId,
      debugLandmarks: typeof parsed.debugLandmarks === "boolean"
        ? parsed.debugLandmarks
        : DEFAULT_PREFS.debugLandmarks
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(storage: StorageLike | null | undefined, prefs: Preferences): void {
  if (!storage) return;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota / disabled-storage errors silently.
  }
}
