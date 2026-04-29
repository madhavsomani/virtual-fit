import garments from "@/data/garments.json";

import type { AnchorMode, Garment, GarmentCategory, GarmentLibrary } from "@/lib/garment-types";

const GARMENT_CATEGORY_VALUES = ["tshirt", "jacket", "pants", "dress", "hoodie", "shorts", "skirt"] as const;
const ANCHOR_MODE_VALUES = ["torso", "legs", "full-body", "footwear"] as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ASSET_URL_PATTERN = /^\/garments\/([a-z0-9-]+)\.glb$/;

export const GARMENT_CATEGORIES: readonly GarmentCategory[] = GARMENT_CATEGORY_VALUES;

function fail(index: number, message: string): never {
  throw new Error(`Invalid garment entry at index ${index}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGarmentCategory(value: unknown): value is GarmentCategory {
  return typeof value === "string" && GARMENT_CATEGORY_VALUES.includes(value as GarmentCategory);
}

function isAnchorMode(value: unknown): value is AnchorMode {
  return typeof value === "string" && ANCHOR_MODE_VALUES.includes(value as AnchorMode);
}

function assertString(value: unknown, index: number, field: keyof Garment): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(index, `${field} must be a non-empty string`);
  }

  return value;
}

function assertGradient(value: unknown, index: number): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) {
    fail(index, "previewGradient must be a tuple of two strings");
  }

  const [fromClass, toClass] = value;

  if (typeof fromClass !== "string" || typeof toClass !== "string") {
    fail(index, "previewGradient entries must be strings");
  }

  if (!fromClass.startsWith("from-")) {
    fail(index, 'previewGradient[0] must start with "from-"');
  }

  if (!toClass.startsWith("to-")) {
    fail(index, 'previewGradient[1] must start with "to-"');
  }

  return [fromClass, toClass];
}

function assertSizes(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(index, "sizes must be a non-empty array");
  }

  const sizes = value.map((entry) => {
    if (typeof entry !== "string" || entry.length === 0) {
      fail(index, "sizes must contain only non-empty strings");
    }

    return entry;
  });

  return sizes;
}

function validateGarment(raw: unknown, index: number): Garment {
  if (!isRecord(raw)) {
    fail(index, "entry must be an object");
  }

  const id = assertString(raw.id, index, "id");

  if (!/^[a-z0-9-]+$/.test(id)) {
    fail(index, "id must match /^[a-z0-9-]+$/");
  }

  const name = assertString(raw.name, index, "name");

  if (!isGarmentCategory(raw.category)) {
    fail(index, `category must be one of: ${GARMENT_CATEGORY_VALUES.join(", ")}`);
  }

  if (!isAnchorMode(raw.anchor)) {
    fail(index, `anchor must be one of: ${ANCHOR_MODE_VALUES.join(", ")}`);
  }

  const assetUrl = assertString(raw.assetUrl, index, "assetUrl");
  const assetMatch = assetUrl.match(ASSET_URL_PATTERN);

  if (!assetMatch) {
    fail(index, "assetUrl must match /garments/<id>.glb");
  }

  if (assetMatch[1] !== id) {
    fail(index, `assetUrl must match id "${id}"`);
  }

  const previewGradient = assertGradient(raw.previewGradient, index);
  const sizes = assertSizes(raw.sizes, index);
  const createdAt = assertString(raw.createdAt, index, "createdAt");

  if (!ISO_DATE_PATTERN.test(createdAt) || Number.isNaN(Date.parse(createdAt))) {
    fail(index, "createdAt must be a valid ISO 8601 string");
  }

  return {
    id,
    name,
    category: raw.category,
    anchor: raw.anchor,
    assetUrl,
    previewGradient,
    sizes,
    createdAt
  };
}

function validateGarmentLibrary(raw: unknown): GarmentLibrary {
  if (!Array.isArray(raw)) {
    throw new Error("Invalid garment library: expected an array");
  }

  const entries = raw.map((entry, index) => validateGarment(entry, index));
  const seenIds = new Set<string>();

  for (const garment of entries) {
    if (seenIds.has(garment.id)) {
      throw new Error(`Invalid garment library: duplicate id "${garment.id}"`);
    }

    seenIds.add(garment.id);
  }

  return entries;
}

export const GARMENT_LIBRARY: GarmentLibrary = validateGarmentLibrary(garments);

/**
 * Lists garments from the manifest, optionally filtered by category and anchor.
 *
 * @param opts Optional filters for category and anchor.
 * @returns A fresh array of matching garments.
 */
export function listGarments(opts: { category?: GarmentCategory; anchor?: AnchorMode } = {}): Garment[] {
  return GARMENT_LIBRARY.filter((garment) => {
    if (opts.category && garment.category !== opts.category) {
      return false;
    }

    if (opts.anchor && garment.anchor !== opts.anchor) {
      return false;
    }

    return true;
  });
}

/**
 * Finds a garment by id.
 *
 * @param id Garment identifier.
 * @returns The matching garment, if present.
 */
export function findGarment(id: string): Garment | undefined {
  return GARMENT_LIBRARY.find((garment) => garment.id === id);
}

/**
 * Checks whether a garment's asset URL is internally well-formed for the manifest contract.
 *
 * @param garment Garment to inspect.
 * @returns True when the asset URL matches `/garments/<id>.glb` for the garment id.
 */
export function hasAsset(garment: Garment): boolean {
  return garment.assetUrl === `/garments/${garment.id}.glb` && ASSET_URL_PATTERN.test(garment.assetUrl);
}
