// Phase 8.10 — Catalog persistence (JSONL on disk).
//
// Decision: JSONL on disk for v1. No DB dependency, no managed costs,
// trivially diffable in git, streams cheaply. We can swap to Cosmos
// Free (1GB) behind the same interface later without touching callers.
//
// Source of truth: `app/public/data/catalog.jsonl` (one garment per
// line, schema-validated).
//
// API:
//   readCatalog(file?)         → { ok, garments, dropped }
//   writeCatalog(garments, f?) → { ok, count }   (atomic via *.tmp + rename)
//   appendGarment(g, f?)       → { ok, garment }   (validates before write)
//   removeGarmentById(id, f?)  → { ok, removed }
//   replaceGarmentById(g, f?)  → { ok, replaced }
//
// Every write goes through `validateGarment` (Phase 8.7). Invalid
// payloads throw `CATALOG_INVALID` so retailer typos cannot land in
// the JSONL even via the persistence helper.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGarment } from "./garment-schema.mjs";
import { parseCatalogJsonl } from "./catalog-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOG_PATH = resolve(__dirname, "../../public/data/catalog.jsonl");

function ensureParentDir(file) {
  const d = dirname(file);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/**
 * Read + parse + validate the catalog. Mirrors the Phase 8.6 build-time
 * loader but returns a structured result and never throws on a bad row
 * (it drops + reports). The Phase 8.7 schema is applied as a second
 * pass so the persistence layer is the strict gatekeeper.
 */
export function readCatalog(file = DEFAULT_CATALOG_PATH) {
  if (!existsSync(file)) return { ok: true, garments: [], dropped: [] };
  const raw = readFileSync(file, "utf8");
  const garments = [];
  const dropped = [];
  let lines;
  try {
    lines = parseCatalogJsonl(raw);
  } catch (e) {
    return { ok: false, garments: [], dropped: [{ raw: null, errors: [e.message] }] };
  }
  for (const g of lines) {
    const v = validateGarment(g);
    if (v.valid) garments.push(g);
    else dropped.push({ raw: g, errors: v.errors });
  }
  return { ok: true, garments, dropped };
}

/** Atomic write of the whole catalog. Validates every entry first. */
export function writeCatalog(garments, file = DEFAULT_CATALOG_PATH) {
  if (!Array.isArray(garments)) {
    throw new Error("CATALOG_INVALID: garments must be an array");
  }
  const seen = new Set();
  for (const g of garments) {
    const v = validateGarment(g);
    if (!v.valid) {
      throw new Error(`CATALOG_INVALID: ${v.errors.join("; ")}`);
    }
    if (seen.has(g.id)) {
      throw new Error(`CATALOG_INVALID: duplicate id '${g.id}'`);
    }
    seen.add(g.id);
  }
  ensureParentDir(file);
  const body = garments.map((g) => JSON.stringify(g)).join("\n") + (garments.length ? "\n" : "");
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, body, "utf8");
  renameSync(tmp, file);
  return { ok: true, count: garments.length };
}

/** Append one garment. Throws if the id already exists. */
export function appendGarment(g, file = DEFAULT_CATALOG_PATH) {
  const cur = readCatalog(file).garments;
  if (cur.some((x) => x.id === g.id)) {
    throw new Error(`CATALOG_INVALID: duplicate id '${g.id}'`);
  }
  const next = [...cur, g];
  writeCatalog(next, file); // re-validates
  return { ok: true, garment: g };
}

/** Replace by id. Throws if no match. */
export function replaceGarmentById(g, file = DEFAULT_CATALOG_PATH) {
  const cur = readCatalog(file).garments;
  const idx = cur.findIndex((x) => x.id === g.id);
  if (idx === -1) throw new Error(`CATALOG_NOT_FOUND: id '${g.id}'`);
  const next = [...cur];
  next[idx] = g;
  writeCatalog(next, file);
  return { ok: true, replaced: g };
}

/** Remove by id. No-op (returns ok:true, removed:false) if missing. */
export function removeGarmentById(id, file = DEFAULT_CATALOG_PATH) {
  const cur = readCatalog(file).garments;
  const next = cur.filter((x) => x.id !== id);
  if (next.length === cur.length) return { ok: true, removed: false };
  writeCatalog(next, file);
  return { ok: true, removed: true };
}
