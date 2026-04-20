"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SAMPLE_MODELS = [
  {
    name: "Duck",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb",
  },
  {
    name: "Avocado",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb",
  },
];

function Mirror3DContent() {
  const searchParams = useSearchParams();
  const customModelUrl = searchParams.get("model");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState(
    customModelUrl 
      ? { name: "Custom", url: customModelUrl }
      : SAMPLE_MODELS[0]
  );
  const [modelPosition, setModelPosition] = useState({ x: 50, y: 50 });
  const [modelScale, setModelScale] = useState(1);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef<number>(0);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setError("Camera access denied");
      console.error(err);
    }
  }, []);

  // Initialize Three.js overlay
  useEffect(() => {
    if (!overlayRef.current || !cameraActive) return;

    const width = overlayRef.current.clientWidth;
    const height = overlayRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera for 2D-like positioning
    const aspect = width / height;
    const frustumSize = 100;
    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    camera.position.z = 100;
    cameraRef.current = camera;

    // Renderer with transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    overlayRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      
      // Rotate model slowly
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.01;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (overlayRef.current && renderer.domElement.parentElement) {
        overlayRef.current.removeChild(renderer.domElement);
      }
    };
  }, [cameraActive]);

  // Load model
  useEffect(() => {
    if (!sceneRef.current || !currentModel.url || !cameraActive) return;

    const loader = new GLTFLoader();
    loader.load(
      currentModel.url,
      (gltf) => {
        if (modelRef.current && sceneRef.current) {
          sceneRef.current.remove(modelRef.current);
        }

        const model = gltf.scene;
        modelRef.current = model;

        // Center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 20 / maxDim;
        model.scale.setScalar(scale * modelScale);

        sceneRef.current?.add(model);
      },
      undefined,
      (err) => console.error("Model load error:", err)
    );
  }, [currentModel, cameraActive, modelScale]);

  // Update model position
  useEffect(() => {
    if (!modelRef.current || !cameraRef.current) return;

    const frustumWidth = (cameraRef.current.right - cameraRef.current.left);
    const frustumHeight = (cameraRef.current.top - cameraRef.current.bottom);

    // Convert percentage to scene coords
    const x = (modelPosition.x / 100 - 0.5) * frustumWidth;
    const y = -(modelPosition.y / 100 - 0.5) * frustumHeight;

    modelRef.current.position.x = x;
    modelRef.current.position.y = y;
  }, [modelPosition]);

  // Update scale
  useEffect(() => {
    if (!modelRef.current) return;
    const baseScale = modelRef.current.scale.x / modelScale;
    modelRef.current.scale.setScalar(baseScale * modelScale);
  }, [modelScale]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #27272a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          🪞 Mirror 3D Test
        </h1>
        <Link href="/" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "6px 12px",
              background: "#27272a",
              border: "none",
              borderRadius: 6,
              color: "#a1a1aa",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ← Home
          </button>
        </Link>
      </div>

      {/* Camera + 3D Overlay */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
          aspectRatio: "4/3",
          background: "#1a1a1a",
        }}
      >
        {!cameraActive ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {error ? (
              <p style={{ color: "#ef4444" }}>{error}</p>
            ) : (
              <>
                <p style={{ color: "#71717a" }}>Camera not active</p>
                <button
                  onClick={startCamera}
                  style={{
                    padding: "12px 24px",
                    background: "#6C5CE7",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Start Camera
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* Video element */}
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
            display: cameraActive ? "block" : "none",
          }}
          playsInline
          muted
        />

        {/* Three.js overlay */}
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            display: cameraActive ? "block" : "none",
          }}
        />
      </div>

      {/* Controls */}
      {cameraActive && (
        <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
          {/* Model selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#71717a", marginBottom: 4, display: "block" }}>
              Model
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {customModelUrl && (
                <button
                  onClick={() => setCurrentModel({ name: "Custom", url: customModelUrl })}
                  style={{
                    padding: "8px 16px",
                    background: currentModel.name === "Custom" ? "#10B981" : "#27272a",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ✨ Custom
                </button>
              )}
              {SAMPLE_MODELS.map((model) => (
                <button
                  key={model.name}
                  onClick={() => setCurrentModel(model)}
                  style={{
                    padding: "8px 16px",
                    background: currentModel.name === model.name ? "#6C5CE7" : "#27272a",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {model.name}
                </button>
              ))}
            </div>
          </div>

          {/* Position X */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#71717a" }}>
              Position X: {modelPosition.x}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={modelPosition.x}
              onChange={(e) =>
                setModelPosition((p) => ({ ...p, x: Number(e.target.value) }))
              }
              style={{ width: "100%" }}
            />
          </div>

          {/* Position Y */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#71717a" }}>
              Position Y: {modelPosition.y}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={modelPosition.y}
              onChange={(e) =>
                setModelPosition((p) => ({ ...p, y: Number(e.target.value) }))
              }
              style={{ width: "100%" }}
            />
          </div>

          {/* Scale */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#71717a" }}>
              Scale: {modelScale.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={modelScale}
              onChange={(e) => setModelScale(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function Mirror3DPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#0c0c0e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#71717a",
          }}
        >
          Loading...
        </div>
      }
    >
      <Mirror3DContent />
    </Suspense>
  );
}
