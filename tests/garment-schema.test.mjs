// Phase 8.7 — Garment schema + validator contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GARMENT_SCHEMA,
  validateGarment,
  assertValidGarment,
} from "../app/lib/garment-schema.mjs";
import { parseCatalogJsonl } from "../app/lib/catalog-data.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const VALID = Object.freeze({
  id: "demo-tee",
  name: "Demo Tee",
  category: "tops",
  fabric: "cotton",
  imageUrl: "/garments/tshirt-blue.png",
  glbUrl: "/models/demo-tshirt.glb",
  palette: { primary: "#4f7cff" },
});

test("GARMENT_SCHEMA is frozen + draft-07 + has $id", () => {
  assert.equal(GARMENT_SCHEMA.$schema, "http://json-schema.org/draft-07/schema#");
  assert.ok(GARMENT_SCHEMA.$id.includes("garment.schema.json"));
  assert.ok(Object.isFrozen(GARMENT_SCHEMA));
});

test("validateGarment: minimal valid record passes", () => {
  const { valid, errors } = validateGarment(VALID);
  assert.ok(valid, errors.join("\n"));
});

test("validateGarment: missing required field fails with reason", () => {
  const r = { ...VALID };
  delete r.glbUrl;
  const { valid, errors } = validateGarment(r);
  assert.ok(!valid);
  assert.ok(errors.some((e) => e.includes("missing required 'glbUrl'")));
});

test("validateGarment: VISION GUARD — non-.glb glbUrl rejected", () => {
  const { valid, errors } = validateGarment({ ...VALID, glbUrl: "/models/demo.png" });
  assert.ok(!valid);
  assert.ok(errors.some((e) => e.includes("glbUrl")));
});

test("validateGarment: id must be kebab-case URL-safe", () => {
  for (const bad of ["UPPER", "with space", "hash#", "1234567890".repeat(7)]) {
    const { valid } = validateGarment({ ...VALID, id: bad });
    assert.ok(!valid, `id '${bad}' should fail`);
  }
  for (const good of ["ab", "demo-tee", "x-1-2-3"]) {
    const { valid } = validateGarment({ ...VALID, id: good });
    assert.ok(valid, `id '${good}' should pass`);
  }
});

test("validateGarment: category enum enforced", () => {
  const { valid } = validateGarment({ ...VALID, category: "spaceships" });
  assert.ok(!valid);
});

test("validateGarment: fabric must be a KNOWN_FABRIC_KIND (PBR-coupled)", () => {
  const { valid } = validateGarment({ ...VALID, fabric: "burlap" });
  assert.ok(!valid);
});

test("validateGarment: palette.primary must be #RRGGBB", () => {
  const { valid } = validateGarment({ ...VALID, palette: { primary: "blue" } });
  assert.ok(!valid);
  assert.ok(validateGarment({ ...VALID, palette: { primary: "#0000ff" } }).valid);
});

test("validateGarment: price must be in [0, 100000]", () => {
  assert.ok(validateGarment({ ...VALID, price: 0 }).valid);
  assert.ok(validateGarment({ ...VALID, price: 99999 }).valid);
  assert.ok(!validateGarment({ ...VALID, price: -1 }).valid);
  assert.ok(!validateGarment({ ...VALID, price: 100001 }).valid);
});

test("validateGarment: currency must be ISO-4217 (3 uppercase letters)", () => {
  assert.ok(validateGarment({ ...VALID, currency: "USD" }).valid);
  assert.ok(!validateGarment({ ...VALID, currency: "usd" }).valid);
  assert.ok(!validateGarment({ ...VALID, currency: "DOLLARS" }).valid);
});

test("validateGarment: sizes uniqueItems + enum", () => {
  assert.ok(validateGarment({ ...VALID, sizes: ["S", "M", "L"] }).valid);
  assert.ok(!validateGarment({ ...VALID, sizes: ["S", "S"] }).valid, "duplicates");
  assert.ok(!validateGarment({ ...VALID, sizes: ["XXXL"] }).valid, "out of enum");
});

test("validateGarment: materials.composition percentages must sum to ~100", () => {
  const ok = validateGarment({
    ...VALID,
    materials: {
      primary: "Cotton",
      composition: [
        { fiber: "cotton", percent: 95 },
        { fiber: "elastane", percent: 5 },
      ],
    },
  });
  assert.ok(ok.valid, ok.errors.join("\n"));

  const bad = validateGarment({
    ...VALID,
    materials: {
      primary: "Cotton",
      composition: [
        { fiber: "cotton", percent: 50 },
        { fiber: "polyester", percent: 30 },
      ],
    },
  });
  assert.ok(!bad.valid);
  assert.ok(bad.errors.some((e) => e.includes("sum to 80")));
});

test("validateGarment: pbr asset URLs validated when present", () => {
  const ok = validateGarment({
    ...VALID,
    pbr: { roughnessUrl: "/textures/r.png", normalMapUrl: "/textures/n.png" },
  });
  assert.ok(ok.valid);
  const bad = validateGarment({ ...VALID, pbr: { normalMapUrl: "javascript:alert(1)" } });
  assert.ok(!bad.valid);
});

test("validateGarment: additionalProperties=false catches typos", () => {
  const { valid, errors } = validateGarment({ ...VALID, colour: "blue" });
  assert.ok(!valid);
  assert.ok(errors.some((e) => e.includes("unexpected property 'colour'")));
});

test("validateGarment: tags array length capped at 12", () => {
  const tags = Array.from({ length: 13 }, (_, i) => `tag-${i}`);
  const { valid } = validateGarment({ ...VALID, tags });
  assert.ok(!valid);
});

test("assertValidGarment throws GARMENT_INVALID with errors[]", () => {
  assert.doesNotThrow(() => assertValidGarment(VALID));
  try {
    assertValidGarment({ id: "x" });
    assert.fail("should throw");
  } catch (err) {
    assert.equal(err.code, "GARMENT_INVALID");
    assert.ok(Array.isArray(err.errors));
    assert.ok(err.errors.length > 0);
  }
});

test("REAL CATALOG: every shipped row in catalog.jsonl validates against GARMENT_SCHEMA", () => {
  const text = readFileSync(resolve(ROOT, "public/data/catalog.jsonl"), "utf8");
  const records = parseCatalogJsonl(text);
  for (const r of records) {
    const { valid, errors } = validateGarment(r);
    assert.ok(valid, `${r.id}: ${errors.join("\n  ")}`);
  }
});
