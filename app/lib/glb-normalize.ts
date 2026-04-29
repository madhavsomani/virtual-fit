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
  /** When true (default), recomputes missing or zeroed vertex normals. */
  recomputeNormals?: boolean;
  /** When true (default), bakes centering into mesh geometry. */
  bakeCenterIntoGeometry?: boolean;
};

function isAllZeroAttribute(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): boolean {
  const { array } = attribute;
  for (let index = 0; index < array.length; index += 1) {
    if (array[index] !== 0) return false;
  }
  return true;
}

function forEachMaterial(
  material: THREE.Material | THREE.Material[] | undefined,
  visitor: (entry: THREE.Material) => void,
): void {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const entry of material) visitor(entry);
    return;
  }
  visitor(material);
}

/**
 * Centers, scales, and prepares a GLTF scene for use as a garment overlay.
 * Mutates `gltf.scene` in place and returns it. Pure outside of THREE state.
 */
export function normalizeGlb(gltf: GLTF, opts: NormalizeOptions = {}): THREE.Group {
  const targetSize = opts.targetSize ?? 2.0;
  const castShadow = opts.castShadow ?? true;
  const doubleSide = opts.doubleSide ?? true;
  const recomputeNormals = opts.recomputeNormals ?? true;
  const bakeCenterIntoGeometry = opts.bakeCenterIntoGeometry ?? true;

  const model = gltf.scene;
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centerWorld = box.getCenter(new THREE.Vector3());
  const centerModel = model.worldToLocal(centerWorld.clone());
  const modelWorldInverse = model.matrixWorld.clone().invert();
  const translatedGeometries = new WeakSet<THREE.BufferGeometry>();

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    let geometry = mesh.geometry;
    if (recomputeNormals && geometry) {
      const normals = geometry.getAttribute("normal");
      if (!normals || isAllZeroAttribute(normals)) {
        geometry.computeVertexNormals();
      }
    }
    if (bakeCenterIntoGeometry && geometry && Number.isFinite(centerModel.x) && Number.isFinite(centerModel.y) && Number.isFinite(centerModel.z)) {
      if (translatedGeometries.has(geometry)) {
        geometry = geometry.clone();
        mesh.geometry = geometry;
      }
      const meshToModel = new THREE.Matrix4().multiplyMatrices(modelWorldInverse, mesh.matrixWorld);
      const meshLinear = new THREE.Matrix3().setFromMatrix4(meshToModel);
      const centerLocal = centerModel.clone().applyMatrix3(meshLinear.invert());
      geometry.translate(-centerLocal.x, -centerLocal.y, -centerLocal.z);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      translatedGeometries.add(geometry);
    }
    if (castShadow) mesh.castShadow = true;
    forEachMaterial(mesh.material, (material) => {
      if (doubleSide) material.side = THREE.DoubleSide;
      if (material.opacity >= 0.999) material.transparent = false;
    });
  });

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = computeNormalizeScale(maxDim, targetSize);
  if (!Number.isFinite(maxDim) || !Number.isFinite(scale)) {
    model.scale.setScalar(1);
    model.userData.normalizeWarning = "non-finite-bounds";
  } else {
    model.scale.setScalar(scale);
  }

  if (!bakeCenterIntoGeometry && Number.isFinite(centerModel.x) && Number.isFinite(centerModel.y) && Number.isFinite(centerModel.z)) {
    model.position.sub(centerModel);
  } else {
    model.position.set(0, 0, 0);
  }
  model.frustumCulled = false;

  return model;
}

/**
 * Computes the scale factor that `normalizeGlb` would apply, exposed for
 * unit testing without needing a real Three.js scene.
 */
export function computeNormalizeScale(maxDim: number, targetSize: number = 2.0): number {
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  if (!Number.isFinite(targetSize)) return 1;
  return targetSize / maxDim;
}
