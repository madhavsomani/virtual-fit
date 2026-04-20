"use client";

import { useRef, useCallback } from "react";
import * as THREE from "three";

interface PoseLandmarks {
  leftShoulder: { x: number; y: number; z?: number; visibility?: number };
  rightShoulder: { x: number; y: number; z?: number; visibility?: number };
  leftHip?: { x: number; y: number; z?: number; visibility?: number };
  rightHip?: { x: number; y: number; z?: number; visibility?: number };
}

interface BodyAnchorResult {
  shoulderCenter: { x: number; y: number };
  shoulderWidth: number;
  torsoHeight: number;
  confidence: number;
}

// Lerp for smooth transitions
function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

// Convert normalized coords (0-1) to Three.js orthographic camera space
function normalizedToScene(
  nx: number,
  ny: number,
  camera: THREE.OrthographicCamera
): { x: number; y: number } {
  const frustumWidth = camera.right - camera.left;
  const frustumHeight = camera.top - camera.bottom;
  
  return {
    x: (nx - 0.5) * frustumWidth,
    y: -(ny - 0.5) * frustumHeight, // Flip Y for screen coords
  };
}

/**
 * Hook to anchor a Three.js object to body landmarks
 */
export function useBodyAnchor(
  smoothingFactor: number = 0.15 // Higher = snappier, lower = smoother
) {
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null);
  const prevScaleRef = useRef<number>(1);

  const computeAnchor = useCallback((landmarks: PoseLandmarks): BodyAnchorResult | null => {
    const { leftShoulder, rightShoulder, leftHip, rightHip } = landmarks;

    // Check visibility
    const minVisibility = 0.5;
    if (
      (leftShoulder.visibility ?? 1) < minVisibility ||
      (rightShoulder.visibility ?? 1) < minVisibility
    ) {
      return null;
    }

    // Shoulder center (normalized 0-1)
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

    // Shoulder width (normalized, will be multiplied by viewport later)
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

    // Torso height (if hips available)
    let torsoHeight = 0.2; // Default
    if (leftHip && rightHip) {
      const hipCenterY = (leftHip.y + rightHip.y) / 2;
      torsoHeight = Math.abs(hipCenterY - shoulderCenterY);
    }

    // Confidence based on visibility
    const confidence = Math.min(
      leftShoulder.visibility ?? 1,
      rightShoulder.visibility ?? 1
    );

    return {
      shoulderCenter: { x: shoulderCenterX, y: shoulderCenterY },
      shoulderWidth,
      torsoHeight,
      confidence,
    };
  }, []);

  const updateMeshPosition = useCallback(
    (
      mesh: THREE.Object3D,
      camera: THREE.OrthographicCamera,
      landmarks: PoseLandmarks,
      baseScale: number = 20
    ) => {
      const anchor = computeAnchor(landmarks);
      if (!anchor) return false;

      // Convert to scene coordinates
      const targetPos = normalizedToScene(
        anchor.shoulderCenter.x,
        anchor.shoulderCenter.y,
        camera
      );

      // Smooth position
      if (prevPositionRef.current) {
        mesh.position.x = lerp(
          prevPositionRef.current.x,
          targetPos.x,
          smoothingFactor
        );
        mesh.position.y = lerp(
          prevPositionRef.current.y,
          targetPos.y,
          smoothingFactor
        );
      } else {
        mesh.position.x = targetPos.x;
        mesh.position.y = targetPos.y;
      }
      prevPositionRef.current = { x: mesh.position.x, y: mesh.position.y };

      // Scale based on shoulder width
      const targetScale = anchor.shoulderWidth * baseScale;
      const smoothedScale = lerp(prevScaleRef.current, targetScale, smoothingFactor);
      mesh.scale.setScalar(smoothedScale);
      prevScaleRef.current = smoothedScale;

      return true;
    },
    [computeAnchor, smoothingFactor]
  );

  const reset = useCallback(() => {
    prevPositionRef.current = null;
    prevScaleRef.current = 1;
  }, []);

  return {
    computeAnchor,
    updateMeshPosition,
    reset,
  };
}

export default useBodyAnchor;
