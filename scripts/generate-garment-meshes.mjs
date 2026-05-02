/**
 * Generate real GLB (glTF 2.0 binary) garment meshes.
 *
 * Each garment gets a proper triangulated mesh with UV coordinates.
 * These are geometric approximations (flat panels, cylinders, A-lines)
 * suitable for the virtual try-on pipeline until AI-generated meshes
 * replace them via CA-14's TRELLIS adapter.
 *
 * GLB spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const GARMENTS = [
  { id: "core-crew-tee", fn: crewTee },
  { id: "city-bomber-jacket", fn: bomberJacket },
  { id: "tailored-straight-pants", fn: straightPants },
  { id: "studio-wrap-dress", fn: wrapDress },
  { id: "weekend-pullover-hoodie", fn: pulloverHoodie },
  { id: "track-runner-shorts", fn: runnerShorts },
  { id: "pleated-midi-skirt", fn: midiSkirt },
  { id: "resort-lounge-tee", fn: loungeTee },
];

const outDir = resolve(import.meta.dirname, "..", "public", "garments");

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const g of GARMENTS) {
    const { positions, normals, uvs, indices } = g.fn();
    const glb = buildGlb(positions, normals, uvs, indices, g.id);
    const path = resolve(outDir, `${g.id}.glb`);
    await writeFile(path, glb);
    console.log(`✅ ${g.id}.glb — ${glb.length} bytes, ${indices.length / 3} triangles, ${positions.length / 3} vertices`);
  }
  console.log(`\nGenerated ${GARMENTS.length} GLB files in ${outDir}`);
}

// ─── Garment geometry generators ────────────────────────────────────────

/** Crew-neck t-shirt: torso panel + short sleeves */
function crewTee() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Front panel
  addQuad(verts, norms, uv, idx, [-0.3, 0.5, 0.05], [0.3, 0.5, 0.05], [0.3, -0.2, 0.05], [-0.3, -0.2, 0.05], [0, 0, 1]);
  // Back panel
  addQuad(verts, norms, uv, idx, [0.3, 0.5, -0.05], [-0.3, 0.5, -0.05], [-0.3, -0.2, -0.05], [0.3, -0.2, -0.05], [0, 0, -1]);
  // Left sleeve
  addQuad(verts, norms, uv, idx, [-0.3, 0.5, 0.05], [-0.3, 0.5, -0.05], [-0.45, 0.35, -0.05], [-0.45, 0.35, 0.05], [-1, 0, 0]);
  // Right sleeve
  addQuad(verts, norms, uv, idx, [0.3, 0.5, -0.05], [0.3, 0.5, 0.05], [0.45, 0.35, 0.05], [0.45, 0.35, -0.05], [1, 0, 0]);
  // Collar (neckline ring approximation)
  addRing(verts, norms, uv, idx, [0, 0.5, 0], 0.1, 0.52, 8);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Bomber jacket: wider torso + full sleeves + collar band */
function bomberJacket() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Front panels (left + right with center gap for zipper)
  addQuad(verts, norms, uv, idx, [-0.35, 0.55, 0.06], [-0.02, 0.55, 0.06], [-0.02, -0.25, 0.06], [-0.35, -0.25, 0.06], [0, 0, 1]);
  addQuad(verts, norms, uv, idx, [0.02, 0.55, 0.06], [0.35, 0.55, 0.06], [0.35, -0.25, 0.06], [0.02, -0.25, 0.06], [0, 0, 1]);
  // Back panel
  addQuad(verts, norms, uv, idx, [0.35, 0.55, -0.06], [-0.35, 0.55, -0.06], [-0.35, -0.25, -0.06], [0.35, -0.25, -0.06], [0, 0, -1]);
  // Left sleeve (longer)
  addCylinder(verts, norms, uv, idx, [-0.35, 0.45, 0], [-0.55, 0.1, 0], 0.07, 8);
  // Right sleeve
  addCylinder(verts, norms, uv, idx, [0.35, 0.45, 0], [0.55, 0.1, 0], 0.07, 8);
  // Collar band
  addRing(verts, norms, uv, idx, [0, 0.55, 0], 0.12, 0.58, 10);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Straight pants: two leg cylinders + waistband */
function straightPants() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Waistband
  addQuad(verts, norms, uv, idx, [-0.25, 0.0, 0.08], [0.25, 0.0, 0.08], [0.25, -0.08, 0.08], [-0.25, -0.08, 0.08], [0, 0, 1]);
  addQuad(verts, norms, uv, idx, [0.25, 0.0, -0.08], [-0.25, 0.0, -0.08], [-0.25, -0.08, -0.08], [0.25, -0.08, -0.08], [0, 0, -1]);
  // Left leg
  addCylinder(verts, norms, uv, idx, [-0.1, -0.08, 0], [-0.1, -0.7, 0], 0.08, 10);
  // Right leg
  addCylinder(verts, norms, uv, idx, [0.1, -0.08, 0], [0.1, -0.7, 0], 0.08, 10);
  // Crotch bridge
  addQuad(verts, norms, uv, idx, [-0.02, -0.08, 0.05], [0.02, -0.08, 0.05], [0.02, -0.15, 0.02], [-0.02, -0.15, 0.02], [0, 0, 1]);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Wrap dress: A-line silhouette, full-body */
function wrapDress() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Build A-line shape with multiple horizontal rings
  const rings = 12;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1); // 0 = top (shoulders), 1 = bottom (hem)
    const y = 0.5 - t * 1.0; // 0.5 to -0.5
    const radius = 0.15 + t * 0.2; // flares outward
    addRing(verts, norms, uv, idx, [0, y, 0], radius, y, 12);
  }
  // Connect rings with quads
  const segs = 12;
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const baseTop = i * segs;
      const baseBot = (i + 1) * segs;
      const j1 = (j + 1) % segs;
      // Offset by the verts added before the rings
      const off = (verts.length / 3) - (rings * segs);
      // Note: rings are added sequentially, so indices are predictable
    }
  }

  // Shoulder straps
  addQuad(verts, norms, uv, idx, [-0.12, 0.55, 0.04], [-0.05, 0.55, 0.04], [-0.05, 0.5, 0.04], [-0.12, 0.5, 0.04], [0, 0, 1]);
  addQuad(verts, norms, uv, idx, [0.05, 0.55, 0.04], [0.12, 0.55, 0.04], [0.12, 0.5, 0.04], [0.05, 0.5, 0.04], [0, 0, 1]);

  // Simple A-line front+back panels (more reliable than ring connections)
  const panelVerts = 8;
  for (let i = 0; i < panelVerts; i++) {
    const t = i / (panelVerts - 1);
    const y = 0.5 - t * 1.0;
    const halfW = 0.15 + t * 0.2;
    // Front
    addQuad(verts, norms, uv, idx,
      [-halfW, y, 0.05], [halfW, y, 0.05],
      [halfW, y - 0.125, 0.05], [-halfW, y - 0.125, 0.05], [0, 0, 1]);
    // Back
    addQuad(verts, norms, uv, idx,
      [halfW, y, -0.05], [-halfW, y, -0.05],
      [-halfW, y - 0.125, -0.05], [halfW, y - 0.125, -0.05], [0, 0, -1]);
  }

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Pullover hoodie: torso + sleeves + hood */
function pulloverHoodie() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Front panel
  addQuad(verts, norms, uv, idx, [-0.32, 0.5, 0.06], [0.32, 0.5, 0.06], [0.32, -0.25, 0.06], [-0.32, -0.25, 0.06], [0, 0, 1]);
  // Back panel
  addQuad(verts, norms, uv, idx, [0.32, 0.5, -0.06], [-0.32, 0.5, -0.06], [-0.32, -0.25, -0.06], [0.32, -0.25, -0.06], [0, 0, -1]);
  // Left sleeve
  addCylinder(verts, norms, uv, idx, [-0.32, 0.45, 0], [-0.52, 0.05, 0], 0.08, 8);
  // Right sleeve
  addCylinder(verts, norms, uv, idx, [0.32, 0.45, 0], [0.52, 0.05, 0], 0.08, 8);
  // Hood - back dome
  addQuad(verts, norms, uv, idx, [-0.15, 0.5, -0.06], [0.15, 0.5, -0.06], [0.15, 0.7, -0.12], [-0.15, 0.7, -0.12], [0, 0.3, -1]);
  // Hood - top
  addQuad(verts, norms, uv, idx, [-0.15, 0.7, -0.12], [0.15, 0.7, -0.12], [0.12, 0.72, 0.02], [-0.12, 0.72, 0.02], [0, 1, 0]);
  // Hood - sides
  addQuad(verts, norms, uv, idx, [-0.15, 0.5, -0.06], [-0.15, 0.7, -0.12], [-0.12, 0.72, 0.02], [-0.12, 0.5, 0.04], [-1, 0, 0]);
  addQuad(verts, norms, uv, idx, [0.15, 0.7, -0.12], [0.15, 0.5, -0.06], [0.12, 0.5, 0.04], [0.12, 0.72, 0.02], [1, 0, 0]);
  // Kangaroo pocket
  addQuad(verts, norms, uv, idx, [-0.18, 0.1, 0.065], [0.18, 0.1, 0.065], [0.18, -0.08, 0.065], [-0.18, -0.08, 0.065], [0, 0, 1]);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Runner shorts: short leg cylinders + waistband */
function runnerShorts() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Waistband
  addQuad(verts, norms, uv, idx, [-0.22, 0.0, 0.07], [0.22, 0.0, 0.07], [0.22, -0.06, 0.07], [-0.22, -0.06, 0.07], [0, 0, 1]);
  addQuad(verts, norms, uv, idx, [0.22, 0.0, -0.07], [-0.22, 0.0, -0.07], [-0.22, -0.06, -0.07], [0.22, -0.06, -0.07], [0, 0, -1]);
  // Left leg (short)
  addCylinder(verts, norms, uv, idx, [-0.09, -0.06, 0], [-0.09, -0.3, 0], 0.08, 8);
  // Right leg (short)
  addCylinder(verts, norms, uv, idx, [0.09, -0.06, 0], [0.09, -0.3, 0], 0.08, 8);
  // Side panels
  addQuad(verts, norms, uv, idx, [-0.22, 0.0, 0.07], [-0.22, 0.0, -0.07], [-0.22, -0.2, -0.07], [-0.22, -0.2, 0.07], [-1, 0, 0]);
  addQuad(verts, norms, uv, idx, [0.22, 0.0, -0.07], [0.22, 0.0, 0.07], [0.22, -0.2, 0.07], [0.22, -0.2, -0.07], [1, 0, 0]);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Pleated midi skirt: flared cylinder with pleats */
function midiSkirt() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Waistband
  addRing(verts, norms, uv, idx, [0, 0.0, 0], 0.18, 0.02, 16);
  // Skirt body — multiple rings flaring outward
  const rings = 8;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = -t * 0.55;
    const radius = 0.18 + t * 0.15; // flares
    // Add pleats via zigzag radius
    addRing(verts, norms, uv, idx, [0, y, 0], radius + (i % 2 === 0 ? 0.01 : -0.01), y, 16);
  }
  // Front panel
  addQuad(verts, norms, uv, idx, [-0.18, 0.0, 0.06], [0.18, 0.0, 0.06], [0.33, -0.55, 0.06], [-0.33, -0.55, 0.06], [0, 0, 1]);
  // Back panel
  addQuad(verts, norms, uv, idx, [0.18, 0.0, -0.06], [-0.18, 0.0, -0.06], [-0.33, -0.55, -0.06], [0.33, -0.55, -0.06], [0, 0, -1]);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

/** Lounge tee: relaxed fit, slightly wider than crew tee */
function loungeTee() {
  const verts = [];
  const norms = [];
  const uv = [];
  const idx = [];

  // Front panel (wider, longer)
  addQuad(verts, norms, uv, idx, [-0.33, 0.48, 0.05], [0.33, 0.48, 0.05], [0.33, -0.28, 0.05], [-0.33, -0.28, 0.05], [0, 0, 1]);
  // Back panel
  addQuad(verts, norms, uv, idx, [0.33, 0.48, -0.05], [-0.33, 0.48, -0.05], [-0.33, -0.28, -0.05], [0.33, -0.28, -0.05], [0, 0, -1]);
  // Left sleeve (relaxed, slightly dropped)
  addQuad(verts, norms, uv, idx, [-0.33, 0.48, 0.05], [-0.33, 0.48, -0.05], [-0.48, 0.3, -0.05], [-0.48, 0.3, 0.05], [-1, 0, 0]);
  // Right sleeve
  addQuad(verts, norms, uv, idx, [0.33, 0.48, -0.05], [0.33, 0.48, 0.05], [0.48, 0.3, 0.05], [0.48, 0.3, -0.05], [1, 0, 0]);
  // V-neck (two triangles forming V shape)
  addQuad(verts, norms, uv, idx, [-0.08, 0.48, 0.055], [0.0, 0.38, 0.055], [0.0, 0.38, 0.055], [0.08, 0.48, 0.055], [0, 0, 1]);
  // Side panels
  addQuad(verts, norms, uv, idx, [-0.33, 0.48, 0.05], [-0.33, -0.28, 0.05], [-0.33, -0.28, -0.05], [-0.33, 0.48, -0.05], [-1, 0, 0]);
  addQuad(verts, norms, uv, idx, [0.33, -0.28, 0.05], [0.33, 0.48, 0.05], [0.33, 0.48, -0.05], [0.33, -0.28, -0.05], [1, 0, 0]);

  return { positions: new Float32Array(verts), normals: new Float32Array(norms), uvs: new Float32Array(uv), indices: new Uint16Array(idx) };
}

// ─── Geometry helpers ───────────────────────────────────────────────────

/** Add a quad (two triangles) with UV mapping */
function addQuad(verts, norms, uv, idx, tl, tr, br, bl, normal) {
  const base = verts.length / 3;
  // Vertices
  verts.push(...tl, ...tr, ...br, ...bl);
  // Normals
  for (let i = 0; i < 4; i++) norms.push(...normal);
  // UVs (standard quad mapping)
  uv.push(0, 1, 1, 1, 1, 0, 0, 0);
  // Indices (two triangles: TL-TR-BR, TL-BR-BL)
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** Add a ring of vertices at a given center/radius (for collars, waistbands) */
function addRing(verts, norms, uv, idx, center, radius, yOffset, segments) {
  const base = verts.length / 3;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = center[0] + Math.cos(angle) * radius;
    const z = center[2] + Math.sin(angle) * radius;
    verts.push(x, center[1], z);
    // Normal points outward
    norms.push(Math.cos(angle), 0, Math.sin(angle));
    uv.push(i / segments, (yOffset + 1) / 2);
  }
  // Triangulate ring as a fan from center
  const centerIdx = verts.length / 3;
  verts.push(center[0], center[1], center[2]);
  norms.push(0, 1, 0);
  uv.push(0.5, 0.5);
  for (let i = 0; i < segments; i++) {
    idx.push(centerIdx, base + i, base + ((i + 1) % segments));
  }
}

/** Add a cylinder between two points */
function addCylinder(verts, norms, uv, idx, from, to, radius, segments) {
  const base = verts.length / 3;
  // Direction vector
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Find perpendicular vectors
  const up = Math.abs(dy / len) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const px = [up[1] * dz / len - up[2] * dy / len, up[2] * dx / len - up[0] * dz / len, up[0] * dy / len - up[1] * dx / len];
  const pLen = Math.sqrt(px[0] ** 2 + px[1] ** 2 + px[2] ** 2);
  px[0] /= pLen; px[1] /= pLen; px[2] /= pLen;
  const py = [dy / len * px[2] - dz / len * px[1], dz / len * px[0] - dx / len * px[2], dx / len * px[1] - dy / len * px[0]];

  for (let ring = 0; ring < 2; ring++) {
    const center = ring === 0 ? from : to;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const x = center[0] + (px[0] * cos + py[0] * sin) * radius;
      const y = center[1] + (px[1] * cos + py[1] * sin) * radius;
      const z = center[2] + (px[2] * cos + py[2] * sin) * radius;
      verts.push(x, y, z);
      // Normal = outward from axis
      const nx = px[0] * cos + py[0] * sin;
      const ny = px[1] * cos + py[1] * sin;
      const nz = px[2] * cos + py[2] * sin;
      norms.push(nx, ny, nz);
      uv.push(i / segments, ring);
    }
  }

  // Connect rings
  for (let i = 0; i < segments; i++) {
    const i1 = (i + 1) % segments;
    const topA = base + i, topB = base + i1;
    const botA = base + segments + i, botB = base + segments + i1;
    idx.push(topA, botA, botB, topA, botB, topB);
  }
}

// ─── GLB builder ────────────────────────────────────────────────────────

function buildGlb(positions, normals, uvs, indices, name) {
  // Compute bounds
  const posMin = [Infinity, Infinity, Infinity];
  const posMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      if (positions[i + c] < posMin[c]) posMin[c] = positions[i + c];
      if (positions[i + c] > posMax[c]) posMax[c] = positions[i + c];
    }
  }

  const vertexCount = positions.length / 3;
  const indexCount = indices.length;

  // Binary buffer: positions + normals + uvs + indices
  const posBuf = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const normBuf = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
  const uvBuf = Buffer.from(uvs.buffer, uvs.byteOffset, uvs.byteLength);
  const idxBuf = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);

  const posLen = posBuf.length;
  const normLen = normBuf.length;
  const uvLen = uvBuf.length;
  const idxLen = idxBuf.length;

  // Pad index buffer to 4-byte alignment
  const idxPadded = idxLen % 4 === 0 ? idxLen : idxLen + (4 - idxLen % 4);

  const totalBinLen = posLen + normLen + uvLen + idxPadded;

  const gltf = {
    asset: { version: "2.0", generator: "VirtualFit-CA1-GarmentGen" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        mode: 4, // TRIANGLES
      }],
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: "VEC3", min: posMin, max: posMax },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: indexCount, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posLen, target: 34962 },
      { buffer: 0, byteOffset: posLen, byteLength: normLen, target: 34962 },
      { buffer: 0, byteOffset: posLen + normLen, byteLength: uvLen, target: 34962 },
      { buffer: 0, byteOffset: posLen + normLen + uvLen, byteLength: idxLen, target: 34963 },
    ],
    buffers: [{ byteLength: totalBinLen }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr, "utf8");
  // Pad JSON to 4-byte alignment
  const jsonPadded = jsonBuf.length % 4 === 0 ? jsonBuf.length : jsonBuf.length + (4 - jsonBuf.length % 4);
  const jsonChunk = Buffer.alloc(jsonPadded, 0x20); // pad with spaces
  jsonBuf.copy(jsonChunk);

  // Binary chunk
  const binChunk = Buffer.alloc(totalBinLen);
  let offset = 0;
  posBuf.copy(binChunk, offset); offset += posLen;
  normBuf.copy(binChunk, offset); offset += normLen;
  uvBuf.copy(binChunk, offset); offset += uvLen;
  idxBuf.copy(binChunk, offset);

  // GLB structure: header (12) + JSON chunk header (8) + JSON + BIN chunk header (8) + BIN
  const totalLen = 12 + 8 + jsonPadded + 8 + totalBinLen;
  const glb = Buffer.alloc(totalLen);
  let pos = 0;

  // GLB header
  glb.writeUInt32LE(0x46546C67, pos); pos += 4; // magic "glTF"
  glb.writeUInt32LE(2, pos); pos += 4;           // version
  glb.writeUInt32LE(totalLen, pos); pos += 4;    // total length

  // JSON chunk
  glb.writeUInt32LE(jsonPadded, pos); pos += 4;  // chunk length
  glb.writeUInt32LE(0x4E4F534A, pos); pos += 4;  // chunk type "JSON"
  jsonChunk.copy(glb, pos); pos += jsonPadded;

  // BIN chunk
  glb.writeUInt32LE(totalBinLen, pos); pos += 4;  // chunk length
  glb.writeUInt32LE(0x004E4942, pos); pos += 4;   // chunk type "BIN\0"
  binChunk.copy(glb, pos);

  return glb;
}

main().catch(err => { console.error(err); process.exit(1); });
