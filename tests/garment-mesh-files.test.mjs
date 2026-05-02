import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import garments from "../data/garments.json" with { type: "json" };

const garmentDir = resolve(import.meta.dirname, "..", "public", "garments");

test("every catalog garment has a real GLB file on disk", () => {
  for (const g of garments) {
    const path = resolve(garmentDir, `${g.id}.glb`);
    const stat = statSync(path);
    assert.ok(stat.size > 12, `${g.id}.glb must be larger than 12 bytes (got ${stat.size})`);
  }
});

test("every GLB file has valid glTF 2.0 header", () => {
  for (const g of garments) {
    const path = resolve(garmentDir, `${g.id}.glb`);
    const buf = readFileSync(path);
    const magic = buf.toString("ascii", 0, 4);
    assert.equal(magic, "glTF", `${g.id}.glb must start with glTF magic`);
    const version = buf.readUInt32LE(4);
    assert.equal(version, 2, `${g.id}.glb must be glTF version 2`);
    const totalLen = buf.readUInt32LE(8);
    assert.equal(totalLen, buf.length, `${g.id}.glb stated length must match file size`);
  }
});

test("every GLB contains a JSON chunk with mesh data", () => {
  for (const g of garments) {
    const path = resolve(garmentDir, `${g.id}.glb`);
    const buf = readFileSync(path);
    // JSON chunk starts at offset 12
    const jsonLen = buf.readUInt32LE(12);
    const jsonType = buf.readUInt32LE(16);
    assert.equal(jsonType, 0x4E4F534A, `${g.id}.glb chunk type must be JSON (0x4E4F534A)`);
    const jsonStr = buf.toString("utf8", 20, 20 + jsonLen);
    const gltf = JSON.parse(jsonStr);
    assert.ok(gltf.meshes?.length > 0, `${g.id}.glb must have at least one mesh`);
    assert.ok(gltf.accessors?.length >= 4, `${g.id}.glb must have position/normal/uv/index accessors`);
    // Verify UV (TEXCOORD_0) accessor exists
    const prim = gltf.meshes[0].primitives[0];
    assert.ok(prim.attributes.TEXCOORD_0 != null, `${g.id}.glb must have TEXCOORD_0 (UV mapping)`);
    assert.ok(prim.attributes.POSITION != null, `${g.id}.glb must have POSITION attribute`);
    assert.ok(prim.attributes.NORMAL != null, `${g.id}.glb must have NORMAL attribute`);
    assert.ok(prim.indices != null, `${g.id}.glb must have indexed triangles`);
  }
});

test("every GLB has a BIN chunk with vertex data", () => {
  for (const g of garments) {
    const path = resolve(garmentDir, `${g.id}.glb`);
    const buf = readFileSync(path);
    const jsonLen = buf.readUInt32LE(12);
    const jsonPadded = jsonLen % 4 === 0 ? jsonLen : jsonLen + (4 - jsonLen % 4);
    const binOffset = 20 + jsonPadded;
    assert.ok(binOffset + 8 <= buf.length, `${g.id}.glb must have a BIN chunk`);
    const binLen = buf.readUInt32LE(binOffset);
    const binType = buf.readUInt32LE(binOffset + 4);
    assert.equal(binType, 0x004E4942, `${g.id}.glb BIN chunk type must be BIN\\0`);
    assert.ok(binLen > 0, `${g.id}.glb BIN chunk must have data`);
  }
});

test("all 8 catalog garments have meshes", () => {
  assert.equal(garments.length, 8, "catalog must have 8 garments");
  const ids = garments.map(g => g.id);
  const expected = [
    "core-crew-tee", "city-bomber-jacket", "tailored-straight-pants",
    "studio-wrap-dress", "weekend-pullover-hoodie", "track-runner-shorts",
    "pleated-midi-skirt", "resort-lounge-tee"
  ];
  for (const id of expected) {
    assert.ok(ids.includes(id), `catalog must include ${id}`);
  }
});
