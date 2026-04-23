// Phase 7.1 — shared GLB normalization helper.
// Centers a GLB model at origin and scales it so its largest dimension is
// `targetSize` units. Used by every garment loader on /mirror so any future
// fix to mesh handling lives in one place.
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export type NormalizeOptions = {
  /** Target size for the largest bounding-box dimension (default 2.0). */
  targetSize?: number;
  /** When true (default), enables shadow casting on every mesh. */
  castShadow?: boolean;
  /** When true (default), forces materials to render double-sided. */
  doubleSide?: boolean;
};

/**
 * Centers, scales, and prepares a GLTF scene for use as a garment overlay.
 * Mutates `gltf.scene` in place and returns it. Pure outside of THREE state.
 */
export function normalizeGlb(gltf: GLTF, opts: NormalizeOptions = {}): THREE.Group {
  const targetSize = opts.targetSize ?? 2.0;
  const castShadow = opts.castShadow ?? true;
  const doubleSide = opts.doubleSide ?? true;

  const model = gltf.scene;
  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (castShadow) mesh.castShadow = true;
    if (doubleSide && mesh.material) {
      (mesh.material as THREE.Material).side = THREE.DoubleSide;
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) model.scale.setScalar(targetSize / maxDim);

  return model;
}

/**
 * Computes the scale factor that `normalizeGlb` would apply, exposed for
 * unit testing without needing a real Three.js scene.
 */
export function computeNormalizeScale(maxDim: number, targetSize: number = 2.0): number {
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  return targetSize / maxDim;
}
