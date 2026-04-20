"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface ThreeOverlayProps {
  width: number;
  height: number;
  glbUrl?: string;
  shoulderCenter?: { x: number; y: number };
  shoulderWidth?: number;
  torsoHeight?: number;
}

export function ThreeOverlay({
  width,
  height,
  glbUrl,
  shoulderCenter,
  shoulderWidth = 100,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  torsoHeight = 150,
}: ThreeOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef<number>(0);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera for 2D-like overlay
    const aspect = width / height;
    const frustumSize = height;
    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    camera.position.z = 500;
    cameraRef.current = camera;

    // Renderer with alpha for transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  // Load GLB mesh
  useEffect(() => {
    if (!glbUrl || !sceneRef.current) return;

    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf) => {
        // Remove old mesh
        if (meshRef.current && sceneRef.current) {
          sceneRef.current.remove(meshRef.current);
        }

        const model = gltf.scene;
        meshRef.current = model;

        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Scale to fit
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = (shoulderWidth * 2) / maxDim;
        model.scale.setScalar(scale);

        sceneRef.current?.add(model);
      },
      undefined,
      (error) => {
        console.error("Error loading GLB:", error);
      }
    );
  }, [glbUrl, shoulderWidth]);

  // Update mesh position based on body landmarks
  useEffect(() => {
    if (!meshRef.current || !shoulderCenter) return;

    // Convert screen coords to Three.js coords (origin at center)
    const x = shoulderCenter.x - width / 2;
    const y = -(shoulderCenter.y - height / 2); // Flip Y

    meshRef.current.position.x = x;
    meshRef.current.position.y = y;

    // Scale based on shoulder width
    const scale = shoulderWidth / 100; // Normalize
    meshRef.current.scale.setScalar(scale);
  }, [shoulderCenter, shoulderWidth, width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}

export default ThreeOverlay;
