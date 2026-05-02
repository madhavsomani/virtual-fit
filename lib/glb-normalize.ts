/**
 * GLB normalization utility for VirtualFit v3.
 *
 * Ported from v2 (VF-5, commit 906cf99) to fix:
 * 1. Missing vertex normals (TRELLIS GLBs ship without → flat-black rendering)
 * 2. Off-center models (bake centering into geometry, not group position)
 * 3. Degenerate geometry (non-finite bounds → scale=Infinity → invisible mesh)
 * 4. Opacity z-fighting (near-opaque transparent materials flicker)
 * 5. Frustum culling (pose-update recompute can cull the root group)
 *
 * Also adds GLTFLoader-based loading so the garment catalog GLBs (CA-13)
 * can be loaded and rendered in the v3 /mirror and /tryon views.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
 * Mutates the scene in place and returns it.
 *
 * Accepts either a full GLTF result (from GLTFLoader) or a bare THREE.Group.
 */
export function normalizeGlb(
  input: { scene: THREE.Group } | THREE.Group,
  opts: NormalizeOptions = {},
): THREE.Group {
  const targetSize = opts.targetSize ?? 2.0;
  const castShadow = opts.castShadow ?? true;
  const doubleSide = opts.doubleSide ?? true;
  const recomputeNormals = opts.recomputeNormals ?? true;
  const bakeCenterIntoGeometry = opts.bakeCenterIntoGeometry ?? true;

  const model = "scene" in input ? input.scene : input;
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

    // Fix 1: Recompute normals when missing or all-zero (TRELLIS GLBs)
    if (recomputeNormals && geometry) {
      const normals = geometry.getAttribute("normal");
      if (!normals || isAllZeroAttribute(normals as THREE.BufferAttribute)) {
        geometry.computeVertexNormals();
      }
    }

    // Fix 2: Bake centering into geometry (stable across re-parenting)
    if (
      bakeCenterIntoGeometry &&
      geometry &&
      Number.isFinite(centerModel.x) &&
      Number.isFinite(centerModel.y) &&
      Number.isFinite(centerModel.z)
    ) {
      if (translatedGeometries.has(geometry)) {
        geometry = geometry.clone();
        mesh.geometry = geometry;
      }
      const meshToModel = new THREE.Matrix4().multiplyMatrices(
        modelWorldInverse,
        mesh.matrixWorld,
      );
      const meshLinear = new THREE.Matrix3().setFromMatrix4(meshToModel);
      const centerLocal = centerModel.clone().applyMatrix3(meshLinear.invert());
      geometry.translate(-centerLocal.x, -centerLocal.y, -centerLocal.z);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      translatedGeometries.add(geometry);
    }

    if (castShadow) mesh.castShadow = true;

    // Fix 4: near-opaque transparent materials → z-fighting
    forEachMaterial(mesh.material, (material) => {
      if (doubleSide) material.side = THREE.DoubleSide;
      if ((material as THREE.MeshStandardMaterial).opacity >= 0.999) {
        material.transparent = false;
      }
    });
  });

  // Fix 3: degenerate geometry → non-finite bounds → Infinity scale
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = computeNormalizeScale(maxDim, targetSize);
  if (!Number.isFinite(maxDim) || !Number.isFinite(scale)) {
    model.scale.setScalar(1);
    model.userData.normalizeWarning = "non-finite-bounds";
  } else {
    model.scale.setScalar(scale);
  }

  if (
    !bakeCenterIntoGeometry &&
    Number.isFinite(centerModel.x) &&
    Number.isFinite(centerModel.y) &&
    Number.isFinite(centerModel.z)
  ) {
    model.position.sub(centerModel);
  } else {
    model.position.set(0, 0, 0);
  }

  // Fix 5: prevent frustum culling during pose-update
  model.frustumCulled = false;

  return model;
}

/**
 * Computes the scale factor that normalizeGlb would apply.
 * Exported for unit testing without a full Three.js scene.
 */
export function computeNormalizeScale(
  maxDim: number,
  targetSize: number = 2.0,
): number {
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  if (!Number.isFinite(targetSize)) return 1;
  return targetSize / maxDim;
}

/**
 * Load a GLB file and return the normalized Three.js group.
 * Works in browser (fetches from URL) via GLTFLoader.
 *
 * @param url - URL to the GLB file (e.g. "/garments/core-crew-tee.glb")
 * @param opts - Normalization options
 * @returns Promise resolving to the normalized Three.js Group
 */
export async function loadAndNormalizeGlb(
  url: string,
  opts: NormalizeOptions = {},
): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return normalizeGlb(gltf, opts);
}
