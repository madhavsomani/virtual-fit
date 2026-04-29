import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { hasMesh } from "../lib/garment-asset.ts";

test("hasMesh returns true for a 12-byte mesh file", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-has-mesh-"));

  try {
    mkdirSync(join(rootDir, "public", "garments"), { recursive: true });
    writeFileSync(join(rootDir, "public", "garments", "foo.glb"), Buffer.alloc(12));
    assert.equal(await hasMesh("foo", { rootDir }), true);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("hasMesh returns false when the mesh file is missing", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-has-mesh-missing-"));

  try {
    mkdirSync(join(rootDir, "public", "garments"), { recursive: true });
    assert.equal(await hasMesh("foo", { rootDir }), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("hasMesh returns false for a zero-byte mesh file", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-has-mesh-zero-"));

  try {
    mkdirSync(join(rootDir, "public", "garments"), { recursive: true });
    writeFileSync(join(rootDir, "public", "garments", "foo.glb"), Buffer.alloc(0));
    assert.equal(await hasMesh("foo", { rootDir }), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("hasMesh returns false for an undersized 8-byte placeholder", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "vf9-has-mesh-small-"));

  try {
    mkdirSync(join(rootDir, "public", "garments"), { recursive: true });
    writeFileSync(join(rootDir, "public", "garments", "foo.glb"), Buffer.alloc(8));
    assert.equal(await hasMesh("foo", { rootDir }), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
