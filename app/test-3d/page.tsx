"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Sample GLB URLs from public sources
const SAMPLE_MODELS = [
  {
    name: "Duck",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb",
  },
  {
    name: "Box",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF-Binary/Box.glb",
  },
  {
    name: "Avocado",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb",
  },
];

export default function Test3DPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(SAMPLE_MODELS[0]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 3);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect =
        containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load model when currentModel changes
  useEffect(() => {
    if (!sceneRef.current || !currentModel.url) return;

    setLoading(true);
    setError(null);

    const loader = new GLTFLoader();
    loader.load(
      currentModel.url,
      (gltf) => {
        // Remove old model
        if (modelRef.current && sceneRef.current) {
          sceneRef.current.remove(modelRef.current);
        }

        const model = gltf.scene;
        modelRef.current = model;

        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);
        model.position.y += size.y / 2;

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        model.scale.setScalar(scale);

        sceneRef.current?.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error("Error loading model:", err);
        setError("Failed to load model");
        setLoading(false);
      }
    );
  }, [currentModel]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #27272a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            🧪 Three.js Test
          </h1>
          <p style={{ fontSize: 12, color: "#71717a", margin: "4px 0 0" }}>
            Testing 3D model loading and rendering
          </p>
        </div>
        <Link href="/" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "8px 16px",
              background: "#27272a",
              border: "none",
              borderRadius: 8,
              color: "#a1a1aa",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Home
          </button>
        </Link>
      </div>

      {/* Model selector */}
      <div
        style={{
          padding: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {SAMPLE_MODELS.map((model) => (
          <button
            key={model.name}
            onClick={() => setCurrentModel(model)}
            style={{
              padding: "8px 16px",
              background:
                currentModel.name === model.name ? "#6C5CE7" : "#27272a",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {model.name}
          </button>
        ))}
      </div>

      {/* Status */}
      {loading && (
        <div style={{ padding: "0 16px", color: "#fbbf24" }}>
          Loading model...
        </div>
      )}
      {error && (
        <div style={{ padding: "0 16px", color: "#ef4444" }}>{error}</div>
      )}

      {/* 3D Viewport */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "calc(100vh - 150px)",
          background: "#1a1a1a",
        }}
      />
    </main>
  );
}
