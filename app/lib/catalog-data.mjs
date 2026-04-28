// Phase 8.6 — Catalog data layer.
//
// JSONL backed (one JSON object per line). Lives in `public/data/catalog.jsonl`
// so it ships with the static export and can be hot-edited by retailers
// in Phase 8.8 without redeploying schema.
//
// Pure helpers (no Next.js / React imports) so we can `node:test` them
// directly. The /catalog page reads the file at SSR time via `fs`.
//
// Schema (will be formalised in P8.7 with JSON-schema validation):
//   { id, name, fabric, category, brand, price, imageUrl, glbUrl,
//     palette: { primary }, tagline?, tags?: string[] }

import { KNOWN_FABRIC_KINDS } from "./pbr-fabric.mjs";

/**
 * Parse JSONL text → array of catalog records. Empty/whitespace lines
 * are skipped silently; malformed lines throw with line number so a
 * retailer's typo doesn't silently drop their entire SKU.
 */
export function parseCatalogJsonl(text) {
  if (typeof text !== "string") throw new Error("parseCatalogJsonl: text must be string");
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      throw new Error(`parseCatalogJsonl: line ${i + 1} is not valid JSON: ${e.message}`);
    }
    out.push(obj);
  }
  return out;
}

const REQUIRED_FIELDS = ["id", "name", "fabric", "category", "imageUrl", "glbUrl"];

/**
 * Filter out malformed entries (missing required fields) but DON'T throw.
 * Production catalog should never crash render — log + drop bad rows.
 * Returns `{ valid, dropped }` so callers can surface counts.
 */
export function validateCatalog(records) {
  const valid = [];
  const dropped = [];
  for (const r of records) {
    const reasons = [];
    if (!r || typeof r !== "object") {
      dropped.push({ record: r, reasons: ["not an object"] });
      continue;
    }
    for (const k of REQUIRED_FIELDS) {
      if (typeof r[k] !== "string" || !r[k]) reasons.push(`missing ${k}`);
    }
    if (typeof r.glbUrl === "string" && !r.glbUrl.endsWith(".glb")) {
      reasons.push("glbUrl must end with .glb (vision: no 2D fallback)");
    }
    if (r.fabric && !KNOWN_FABRIC_KINDS.includes(r.fabric)) {
      reasons.push(`unknown fabric '${r.fabric}'`);
    }
    if (reasons.length) {
      dropped.push({ record: r, reasons });
    } else {
      valid.push(r);
    }
  }
  return { valid, dropped };
}

/** Group catalog entries by category, preserving insertion order. */
export function groupByCategory(records) {
  const groups = new Map();
  for (const r of records) {
    const key = r.category || "uncategorised";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}

/** Distinct categories, alphabetised. */
export function listCategories(records) {
  return [...new Set(records.map((r) => r.category).filter(Boolean))].sort();
}

/** Distinct fabrics actually present in the catalog. */
export function listFabrics(records) {
  return [...new Set(records.map((r) => r.fabric).filter(Boolean))].sort();
}

/**
 * Filter the catalog by free-text query + optional category/fabric.
 * Search hits: name, brand, tagline, tags. Case-insensitive.
 */
export function filterCatalog(records, { query = "", category = "", fabric = "" } = {}) {
  const q = (query || "").trim().toLowerCase();
  return records.filter((r) => {
    if (category && r.category !== category) return false;
    if (fabric && r.fabric !== fabric) return false;
    if (!q) return true;
    const haystack = [
      r.name,
      r.brand,
      r.tagline,
      ...(Array.isArray(r.tags) ? r.tags : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Build /mirror URL for a catalog entry — same shape as showcase. */
export function mirrorUrlForCatalogItem(r) {
  if (!r || typeof r.glbUrl !== "string") return "/mirror";
  const params = new URLSearchParams();
  params.set("garment", r.glbUrl);
  if (r.id) params.set("catalogId", r.id);
  if (r.fabric) params.set("fabric", r.fabric);
  return `/mirror?${params.toString()}`;
}
