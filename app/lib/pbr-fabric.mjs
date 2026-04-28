// Phase 8.4 — PBR fabric defaults + Sobel normal-map generator.
//
// TRELLIS produces GLBs with diffuse-only materials. To upgrade to PBR
// (the difference between "looks like cardboard" and "looks like Tommy
// Hilfiger denim"), we need:
//   1. Sensible per-fabric roughness/metalness/sheen defaults.
//   2. A normal map. TRELLIS doesn't emit one; we can derive a passable
//      tangent-space normal map from the diffuse texture's grayscale
//      gradient (Sobel filter). Not photogrammetric quality, but turns
//      flat fabric into something that catches studio lighting realistically.
//
// Pure JS, no THREE / canvas dependency. Caller (mirror or generate-3d)
// converts the diffuse <img> to a Uint8ClampedArray via a 2D canvas, hands
// it to `computeNormalMapFromGrayscale`, then uploads the resulting RGBA
// buffer as a THREE.DataTexture.

/**
 * Per-fabric PBR material defaults. Values calibrated against MERL BRDF
 * database (cotton, denim, leather, silk samples) and clamped to ranges
 * the THREE MeshStandardMaterial accepts (roughness/metalness ∈ [0,1]).
 *
 * `kind` keys mirror the segformer-clothes label set so we can plumb
 * directly from /api/segformer-classify → /api/generate-3d → mirror.
 */
const FABRIC_PRESETS = Object.freeze({
  // Default for unknown garments — high-roughness matte cotton.
  default:    { roughness: 0.85, metalness: 0.00, sheen: 0.0, clearcoat: 0.0 },
  cotton:     { roughness: 0.85, metalness: 0.00, sheen: 0.0, clearcoat: 0.0 },
  // Denim has tighter weave + slight specular highlight.
  denim:      { roughness: 0.78, metalness: 0.00, sheen: 0.1, clearcoat: 0.0 },
  // Leather: clearcoat on top of dark base.
  leather:    { roughness: 0.55, metalness: 0.00, sheen: 0.0, clearcoat: 0.4 },
  // Silk / satin: low roughness, prominent sheen.
  silk:       { roughness: 0.30, metalness: 0.00, sheen: 0.6, clearcoat: 0.0 },
  satin:      { roughness: 0.25, metalness: 0.00, sheen: 0.7, clearcoat: 0.0 },
  // Wool / knit: very high roughness + sheen for fuzz simulation.
  wool:       { roughness: 0.95, metalness: 0.00, sheen: 0.5, clearcoat: 0.0 },
  // Polyester / nylon (athletic wear).
  polyester:  { roughness: 0.55, metalness: 0.00, sheen: 0.2, clearcoat: 0.0 },
  // Metallic (sequins, foils).
  metallic:   { roughness: 0.20, metalness: 0.85, sheen: 0.0, clearcoat: 0.2 },
});

/** Clamp helper. */
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * @param {{ kind?: string, override?: Partial<{roughness:number, metalness:number, sheen:number, clearcoat:number}> }} [opts]
 */
export function fabricMaterialDefaults(opts = {}) {
  const kind = typeof opts.kind === "string" ? opts.kind.toLowerCase() : "default";
  const base = FABRIC_PRESETS[kind] ?? FABRIC_PRESETS.default;
  const out = { ...base };
  if (opts.override && typeof opts.override === "object") {
    for (const k of ["roughness", "metalness", "sheen", "clearcoat"]) {
      if (k in opts.override) out[k] = clamp01(opts.override[k]);
    }
  }
  return out;
}

export const KNOWN_FABRIC_KINDS = Object.freeze(Object.keys(FABRIC_PRESETS));

/**
 * Convert RGBA pixel data to a tangent-space normal map (also RGBA) using
 * a Sobel filter on the grayscale luminance.
 *
 * The encoding follows OpenGL convention (Y up): `n = (R-0.5, G-0.5, B-0.5) * 2`,
 * with most pixels emitting (0.5, 0.5, 1.0) → flat normal. Bright-to-dark
 * transitions in the diffuse become valleys; dark-to-bright become ridges.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8ClampedArray|Uint8Array} rgba   Source diffuse texture, length = width*height*4.
 * @param {number} [strength=2.0]               Higher = more pronounced bumps. 1-5 typical.
 * @returns {Uint8ClampedArray}                 Normal map, length = width*height*4 (alpha=255).
 */
export function computeNormalMapFromGrayscale(width, height, rgba, strength = 2.0) {
  if (!Number.isInteger(width) || width < 2) throw new Error("width must be int >= 2");
  if (!Number.isInteger(height) || height < 2) throw new Error("height must be int >= 2");
  const expected = width * height * 4;
  if (!rgba || rgba.length !== expected) {
    throw new Error(`rgba length ${rgba?.length} !== ${expected}`);
  }
  const s = Number.isFinite(strength) && strength > 0 ? strength : 2.0;

  // Precompute luminance (Rec.709) into a flat Float32 grid.
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]) / 255;
  }

  const out = new Uint8ClampedArray(expected);
  const at = (x, y) => {
    const xx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const yy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return lum[yy * width + xx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sobel 3x3
      const tl = at(x - 1, y - 1), tc = at(x, y - 1), tr = at(x + 1, y - 1);
      const ml = at(x - 1, y),                          mr = at(x + 1, y);
      const bl = at(x - 1, y + 1), bc = at(x, y + 1), br = at(x + 1, y + 1);
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      // OpenGL/Y-up: positive gy when image gets brighter going DOWN (we want
      // bottom-bright ridges to face upward → invert).
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

      // Build normal vector. (-gx, -gy, 1/strength) then normalize.
      const nx = -gx;
      const ny = -gy;
      const nz = 1 / s;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const rx = nx / len;
      const ry = ny / len;
      const rz = nz / len;

      const o = (y * width + x) * 4;
      out[o]     = Math.round((rx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ry * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((rz * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Build a constant 1x1 fabric-roughness texture (RGBA). Useful when the
 * GLB has no roughness map at all — caller can use this as a uniform
 * fallback instead of relying on `material.roughness` (which some loaders
 * ignore in favour of the texture).
 */
export function buildUniformRoughnessTexture(roughness) {
  const r = Math.round(clamp01(roughness) * 255);
  return new Uint8ClampedArray([r, r, r, 255]);
}
