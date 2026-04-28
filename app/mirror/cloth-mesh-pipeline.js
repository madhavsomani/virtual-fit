// Phase 8.3 — cloth-sim-ready mesh pipeline.
//
// Pure adapter that bridges Phase 8.2's `cloth-sim.js` (Verlet particles +
// constraints) to a renderable mesh geometry. Stays framework-agnostic by
// returning Float32Array buffers + index Uint32Array — caller wraps these
// into THREE.BufferGeometry (live in mirror/page.tsx) or any other renderer.
//
// Deliverables:
//   1. buildClothGeometry(cloth)     → { positions, indices, uvs, normals }
//   2. updateClothPositions(cloth, positions)  → writes particles → buffer
//   3. computeClothNormals(positions, indices, normals) → recomputed each frame
//   4. mapAnchorsFromShoulders({ leftShoulder, rightShoulder }, cloth)
//      → drives the top row of pinned particles from MediaPipe shoulder
//        landmarks, interpolating across the row.
//
// Triangulation: each grid quad → 2 triangles (CCW, front-facing toward
// camera at z=+). UVs map directly from grid coords (0,0)..(1,1) so a TRELLIS
// GLB texture (or any image) can be applied with no UV unwrapping work.

/**
 * Build static geometry buffers for a cloth grid.
 * Positions populated with INITIAL particle positions; caller is expected
 * to call updateClothPositions() each frame after stepping the sim.
 *
 * @param {{ width: number, height: number, particles: Array<{x:number,y:number,z:number}> }} cloth
 * @returns {{
 *   positions: Float32Array,   // length = particles*3
 *   indices: Uint32Array,      // length = (W-1)*(H-1)*6
 *   uvs: Float32Array,         // length = particles*2
 *   normals: Float32Array      // length = particles*3 (initialized; recompute each frame)
 * }}
 */
export function buildClothGeometry(cloth) {
  const { width, height, particles } = cloth;
  if (!Number.isInteger(width) || width < 2) throw new Error("cloth.width must be int >= 2");
  if (!Number.isInteger(height) || height < 2) throw new Error("cloth.height must be int >= 2");
  if (!Array.isArray(particles) || particles.length !== width * height) {
    throw new Error("cloth.particles length mismatch");
  }

  const n = particles.length;
  const positions = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  const normals = new Float32Array(n * 3);

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const idx = j * width + i;
      const p = particles[idx];
      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;
      // UV: (0,0) at top-left → (1,1) at bottom-right.
      // V flipped so top of cloth (j=0) maps to top of texture (v=1).
      uvs[idx * 2] = i / (width - 1);
      uvs[idx * 2 + 1] = 1 - j / (height - 1);
      // Default normal pointing toward camera (+z); recomputed by computeClothNormals.
      normals[idx * 3 + 2] = 1;
    }
  }

  // Indices: 2 triangles per quad, CCW winding (front-facing toward +z).
  const indices = new Uint32Array((width - 1) * (height - 1) * 6);
  let idx = 0;
  for (let j = 0; j + 1 < height; j++) {
    for (let i = 0; i + 1 < width; i++) {
      const tl = j * width + i;
      const tr = tl + 1;
      const bl = tl + width;
      const br = bl + 1;
      // CCW (when viewed from +z): tl → bl → tr, then tr → bl → br
      indices[idx++] = tl;
      indices[idx++] = bl;
      indices[idx++] = tr;
      indices[idx++] = tr;
      indices[idx++] = bl;
      indices[idx++] = br;
    }
  }

  return { positions, indices, uvs, normals };
}

/**
 * Copy cloth particle positions into a Float32Array buffer in-place.
 * Caller wraps this buffer in a THREE.BufferAttribute and flips
 * needsUpdate=true after this call.
 */
export function updateClothPositions(cloth, positions) {
  const ps = cloth.particles;
  const expected = ps.length * 3;
  if (positions.length !== expected) {
    throw new Error(`positions length ${positions.length} !== ${expected}`);
  }
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k];
    const o = k * 3;
    positions[o] = p.x;
    positions[o + 1] = p.y;
    positions[o + 2] = p.z;
  }
}

/**
 * Recompute per-vertex normals by averaging adjacent triangle face normals.
 * Pure (no THREE dependency). Result: smoothed normals suitable for lit
 * materials. O(triangles + vertices).
 */
export function computeClothNormals(positions, indices, normals) {
  // Zero out
  for (let i = 0; i < normals.length; i++) normals[i] = 0;

  // Accumulate face normals per vertex
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;

    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

    // Cross product e1 × e2
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
    normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
    normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
  }

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i], y = normals[i + 1], z = normals[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 1e-9) {
      normals[i] = x / len;
      normals[i + 1] = y / len;
      normals[i + 2] = z / len;
    } else {
      // Degenerate triangle: fall back to +z (camera-facing)
      normals[i] = 0; normals[i + 1] = 0; normals[i + 2] = 1;
    }
  }
}

/**
 * Drive cloth's pinned top row from MediaPipe shoulder landmarks.
 * Particles 0..(width-1) are interpolated linearly between the two shoulders
 * — leftmost = leftShoulder, rightmost = rightShoulder.
 *
 * @param {{ leftShoulder: {x:number,y:number,z:number}, rightShoulder: {x:number,y:number,z:number} }} anchors
 * @param {ReturnType<import('./cloth-sim.js').createClothMesh>} cloth
 * @param {(cloth: any, idx: number, x: number, y: number, z: number) => boolean} setAnchorFn
 *   Pass the `setAnchor` exported from cloth-sim.js. Injectable for testing.
 * @returns {number} number of anchors successfully set
 */
export function mapAnchorsFromShoulders(anchors, cloth, setAnchorFn) {
  const { leftShoulder: ls, rightShoulder: rs } = anchors ?? {};
  if (!ls || !rs) return 0;
  if (![ls.x, ls.y, ls.z, rs.x, rs.y, rs.z].every(Number.isFinite)) return 0;

  const w = cloth.width;
  let updated = 0;
  for (let i = 0; i < w; i++) {
    const t = w === 1 ? 0 : i / (w - 1);
    const x = ls.x + (rs.x - ls.x) * t;
    const y = ls.y + (rs.y - ls.y) * t;
    const z = ls.z + (rs.z - ls.z) * t;
    if (setAnchorFn(cloth, i, x, y, z)) updated++;
  }
  return updated;
}
