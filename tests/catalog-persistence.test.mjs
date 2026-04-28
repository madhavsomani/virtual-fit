// Phase 8.10 — JSONL persistence layer contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_CATALOG_PATH,
  readCatalog,
  writeCatalog,
  appendGarment,
  replaceGarmentById,
  removeGarmentById,
} from "../app/lib/catalog-persistence.mjs";

function freshDir(label) {
  return mkdtempSync(join(tmpdir(), `vfit-cat-${label}-`));
}

function validG(over = {}) {
  return {
    id: "tee-test",
    name: "Test Tee",
    category: "tops",
    fabric: "cotton",
    imageUrl: "/garments/tee.png",
    glbUrl: "/models/demo-tshirt.glb",
    palette: { primary: "#4f7cff" },
    ...over,
  };
}

test("DEFAULT_CATALOG_PATH points at the shipped JSONL", () => {
  assert.match(DEFAULT_CATALOG_PATH, /public\/data\/catalog\.jsonl$/);
});

test("readCatalog: real shipped catalog parses + validates", () => {
  const out = readCatalog();
  assert.equal(out.ok, true);
  assert.ok(out.garments.length >= 12, `expected ≥12, got ${out.garments.length}`);
  assert.equal(out.dropped.length, 0, `unexpected drops: ${JSON.stringify(out.dropped)}`);
});

test("writeCatalog → readCatalog roundtrip preserves entries", () => {
  const dir = freshDir("roundtrip");
  try {
    const file = join(dir, "catalog.jsonl");
    const items = [validG({ id: "aa-1" }), validG({ id: "bb-2", name: "Other" })];
    const w = writeCatalog(items, file);
    assert.equal(w.count, 2);
    const r = readCatalog(file);
    assert.equal(r.garments.length, 2);
    assert.equal(r.garments[0].id, "aa-1");
    assert.equal(r.garments[1].id, "bb-2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeCatalog: rejects an invalid garment before touching disk", () => {
  const dir = freshDir("invalid");
  try {
    const file = join(dir, "catalog.jsonl");
    const bad = [validG(), { id: "x", name: "no-glb", category: "tops", fabric: "cotton", imageUrl: "/x.png", palette: { primary: "#000" } }];
    assert.throws(() => writeCatalog(bad, file), /CATALOG_INVALID/);
    assert.equal(existsSync(file), false, "file must not be created when validation fails");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeCatalog: rejects duplicate ids", () => {
  const dir = freshDir("dupe");
  try {
    const file = join(dir, "catalog.jsonl");
    const items = [validG({ id: "same-id" }), validG({ id: "same-id", name: "Bee" })];
    assert.throws(() => writeCatalog(items, file), /duplicate id 'same-id'/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeCatalog: atomic — bad write doesn't clobber existing file", () => {
  const dir = freshDir("atomic");
  try {
    const file = join(dir, "catalog.jsonl");
    writeCatalog([validG({ id: "good-1" })], file);
    const before = readFileSync(file, "utf8");
    assert.throws(
      () => writeCatalog([validG({ id: "ok" }), { bogus: true }], file),
      /CATALOG_INVALID/,
    );
    assert.equal(readFileSync(file, "utf8"), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appendGarment: adds + validates + rejects duplicate id", () => {
  const dir = freshDir("append");
  try {
    const file = join(dir, "catalog.jsonl");
    writeCatalog([validG({ id: "aa" })], file);
    const r = appendGarment(validG({ id: "bb", name: "Bee" }), file);
    assert.equal(r.ok, true);
    assert.equal(readCatalog(file).garments.length, 2);
    assert.throws(() => appendGarment(validG({ id: "aa" }), file), /duplicate id 'aa'/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("replaceGarmentById: replaces existing, throws when missing", () => {
  const dir = freshDir("replace");
  try {
    const file = join(dir, "catalog.jsonl");
    writeCatalog([validG({ id: "aa", name: "Old" })], file);
    const r = replaceGarmentById(validG({ id: "aa", name: "New" }), file);
    assert.equal(r.ok, true);
    assert.equal(readCatalog(file).garments[0].name, "New");
    assert.throws(() => replaceGarmentById(validG({ id: "missing" }), file), /CATALOG_NOT_FOUND/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("removeGarmentById: removes existing, no-op when missing", () => {
  const dir = freshDir("remove");
  try {
    const file = join(dir, "catalog.jsonl");
    writeCatalog([validG({ id: "aa" }), validG({ id: "bb", name: "Bee" })], file);
    assert.equal(removeGarmentById("aa", file).removed, true);
    const after = readCatalog(file).garments;
    assert.equal(after.length, 1);
    assert.equal(after[0].id, "bb");
    assert.equal(removeGarmentById("ghost", file).removed, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readCatalog: missing file → empty result, no throw", () => {
  const dir = freshDir("missing");
  try {
    const file = join(dir, "nope.jsonl");
    const r = readCatalog(file);
    assert.equal(r.ok, true);
    assert.deepEqual(r.garments, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readCatalog: drops invalid rows but reports them (production never crashes)", () => {
  const dir = freshDir("drop");
  try {
    const file = join(dir, "catalog.jsonl");
    // Manually write a mix; bypass writeCatalog so a bad row lands.
    const lines = [
      JSON.stringify(validG({ id: "good-1" })),
      JSON.stringify({ id: "bad", name: "no-glb", category: "tops", fabric: "cotton", imageUrl: "/x.png", palette: { primary: "#000" } }),
    ].join("\n");
    writeFileSync(file, lines + "\n", "utf8");
    const r = readCatalog(file);
    assert.equal(r.garments.length, 1);
    assert.equal(r.garments[0].id, "good-1");
    assert.equal(r.dropped.length, 1);
    assert.equal(r.dropped[0].raw.id, "bad");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("VISION GUARD: persistence module never imports a 2D fallback", () => {
  const fs = readFileSync(new URL("../app/lib/catalog-persistence.mjs", import.meta.url), "utf8");
  assert.ok(!fs.includes("2d-overlay"));
  assert.ok(!fs.includes("garmentTexture"));
});
