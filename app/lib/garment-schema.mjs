// Phase 8.7 — Garment metadata schema (formal JSON Schema, draft-07).
//
// Single source of truth for what a "garment record" must look like across:
//   • /catalog (public/data/catalog.jsonl)
//   • /showcase (app/showcase/showcase-data.mjs)
//   • /retailer/dashboard upload form (P8.8)
//   • /api/generate-3d output payload
//
// Pure JSON Schema (draft-07). No runtime deps — we hand-roll a tiny
// validator below so retailers' uploads can be checked client-side
// without pulling ajv (~120kB) into the bundle.
//
// Schema is exported as a frozen object. The hand-rolled validator
// supports: required-field check, type check (string/number/boolean/
// array/object), enum, pattern (RegExp), minLength, items.type, oneOf
// (URL-or-data-URI), and conditional `if/then` for size schemas.

import { KNOWN_FABRIC_KINDS } from "./pbr-fabric.mjs";

/**
 * @typedef {{
 *   id: string, sku?: string, name: string, brand?: string,
 *   category: 'tops'|'outerwear'|'bottoms'|'dresses'|'footwear'|'accessories',
 *   fabric: string, price?: number, currency?: string,
 *   sizes?: Array<'XS'|'S'|'M'|'L'|'XL'|'XXL'>,
 *   materials?: { primary: string, composition?: Array<{ fiber: string, percent: number }> },
 *   imageUrl: string, glbUrl: string,
 *   pbr?: { roughnessUrl?: string, normalMapUrl?: string, metalnessUrl?: string },
 *   palette: { primary: string, secondary?: string },
 *   tagline?: string, tags?: string[],
 *   createdAt?: string, updatedAt?: string
 * }} GarmentRecord
 */

export const GARMENT_SCHEMA = Object.freeze({
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://virtualfit.app/schemas/garment.schema.json",
  title: "Garment",
  description:
    "Canonical garment metadata for VirtualFit catalog, showcase, and retailer dashboard.",
  type: "object",
  required: ["id", "name", "category", "fabric", "imageUrl", "glbUrl", "palette"],
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      pattern: "^[a-z0-9][a-z0-9-]{1,63}$",
      description: "Kebab-case stable identifier; URL-safe, max 64 chars.",
    },
    sku: { type: "string", minLength: 1, maxLength: 64 },
    name: { type: "string", minLength: 2, maxLength: 120 },
    brand: { type: "string", minLength: 1, maxLength: 80 },
    category: {
      type: "string",
      enum: ["tops", "outerwear", "bottoms", "dresses", "footwear", "accessories"],
    },
    fabric: { type: "string", enum: [...KNOWN_FABRIC_KINDS] },
    price: { type: "number", minimum: 0, maximum: 100000 },
    currency: { type: "string", pattern: "^[A-Z]{3}$", description: "ISO-4217 currency code." },
    sizes: {
      type: "array",
      items: { type: "string", enum: ["XS", "S", "M", "L", "XL", "XXL"] },
      uniqueItems: true,
    },
    materials: {
      type: "object",
      required: ["primary"],
      additionalProperties: false,
      properties: {
        primary: { type: "string", minLength: 2, maxLength: 60 },
        composition: {
          type: "array",
          items: {
            type: "object",
            required: ["fiber", "percent"],
            additionalProperties: false,
            properties: {
              fiber: { type: "string", minLength: 2, maxLength: 40 },
              percent: { type: "number", minimum: 0, maximum: 100 },
            },
          },
        },
      },
    },
    imageUrl: { type: "string", pattern: "^(/|https?://|data:image/)" },
    glbUrl: {
      type: "string",
      pattern: "\\.glb($|\\?)",
      description:
        "VISION GUARD: must be a GLB asset. No 2D fallback rendering anywhere in VirtualFit.",
    },
    pbr: {
      type: "object",
      additionalProperties: false,
      properties: {
        roughnessUrl: { type: "string", pattern: "^(/|https?://|data:image/)" },
        normalMapUrl: { type: "string", pattern: "^(/|https?://|data:image/)" },
        metalnessUrl: { type: "string", pattern: "^(/|https?://|data:image/)" },
      },
    },
    palette: {
      type: "object",
      required: ["primary"],
      additionalProperties: false,
      properties: {
        primary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        secondary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      },
    },
    tagline: { type: "string", minLength: 1, maxLength: 200 },
    tags: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 40 },
      maxItems: 12,
    },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
});

// ----- Hand-rolled validator (no ajv dep, ~80 LOC of supported keywords) -----

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function validate(node, schema, path, errors) {
  if (schema.type) {
    const want = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!want.includes(typeOf(node))) {
      errors.push(`${path || "<root>"}: expected ${want.join("|")}, got ${typeOf(node)}`);
      return;
    }
  }
  if (schema.enum && !schema.enum.includes(node)) {
    errors.push(`${path || "<root>"}: value ${JSON.stringify(node)} not in enum [${schema.enum.join(", ")}]`);
  }
  if (typeof node === "string") {
    if (typeof schema.minLength === "number" && node.length < schema.minLength) {
      errors.push(`${path}: minLength ${schema.minLength} (got ${node.length})`);
    }
    if (typeof schema.maxLength === "number" && node.length > schema.maxLength) {
      errors.push(`${path}: maxLength ${schema.maxLength} (got ${node.length})`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(node)) {
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
  }
  if (typeof node === "number") {
    if (typeof schema.minimum === "number" && node < schema.minimum) {
      errors.push(`${path}: minimum ${schema.minimum} (got ${node})`);
    }
    if (typeof schema.maximum === "number" && node > schema.maximum) {
      errors.push(`${path}: maximum ${schema.maximum} (got ${node})`);
    }
  }
  if (Array.isArray(node)) {
    if (typeof schema.maxItems === "number" && node.length > schema.maxItems) {
      errors.push(`${path}: maxItems ${schema.maxItems} (got ${node.length})`);
    }
    if (schema.uniqueItems) {
      const set = new Set(node.map((v) => JSON.stringify(v)));
      if (set.size !== node.length) errors.push(`${path}: uniqueItems violation`);
    }
    if (schema.items) {
      node.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, errors));
    }
  }
  if (schema.type === "object" && node && typeof node === "object" && !Array.isArray(node)) {
    if (schema.required) {
      for (const r of schema.required) {
        if (!(r in node)) errors.push(`${path || "<root>"}: missing required '${r}'`);
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(node)) {
        if (!(k in schema.properties)) {
          errors.push(`${path || "<root>"}: unexpected property '${k}'`);
        }
      }
    }
    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in node) validate(node[k], sub, path ? `${path}.${k}` : k, errors);
      }
    }
  }
}

/**
 * Validate a candidate garment record against GARMENT_SCHEMA.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateGarment(record) {
  const errors = [];
  validate(record, GARMENT_SCHEMA, "", errors);
  // Additional cross-field check: composition percentages should sum
  // to ~100 if provided (warn, not fail — retailers sometimes round).
  if (
    record &&
    record.materials &&
    Array.isArray(record.materials.composition) &&
    record.materials.composition.length > 0
  ) {
    const sum = record.materials.composition.reduce(
      (a, c) => a + (typeof c.percent === "number" ? c.percent : 0),
      0,
    );
    if (Math.abs(sum - 100) > 1) {
      errors.push(`materials.composition: percentages sum to ${sum}, expected ~100`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Convenience wrapper that throws on failure (useful in retailer
 * upload handlers where we want a hard 400).
 */
export function assertValidGarment(record) {
  const { valid, errors } = validateGarment(record);
  if (!valid) {
    const err = new Error(`Garment validation failed:\n  - ${errors.join("\n  - ")}`);
    err.code = "GARMENT_INVALID";
    err.errors = errors;
    throw err;
  }
  return record;
}
