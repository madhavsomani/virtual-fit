"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

type PoseResultLandmark = { x: number; y: number; z?: number; visibility?: number };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function MirrorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Click Start to begin");
  const [cameraOn, setCameraOn] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const garmentMeshRef = useRef<THREE.Mesh | null>(null);
  const garmentTextureRef = useRef<THREE.Texture | null>(null);

  // Pose refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseLandmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const smoothPos = useRef({ x: 0, y: 0, w: 0, h: 0, ready: false });

  // Video dimensions
  const videoDims = useRef({ w: 640, h: 480 });

  // Build a 3D shirt mesh (curved plane that wraps around body)
  const createShirtMesh = useCallback((texture?: THREE.Texture) => {
    // Create a curved plane geometry (simulates shirt wrapping around torso)
    const widthSegs = 20;
    const heightSegs = 20;
    const geo = new THREE.PlaneGeometry(1, 1.3, widthSegs, heightSegs);

    // Curve the vertices to simulate body wrap
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Curve on x-axis (wrap around body)
      const curve = Math.cos(x * Math.PI * 0.8) * 0.08;
      // Slight bulge at chest area
      const chestBulge = Math.exp(-((y - 0.15) ** 2) / 0.1) * 0.03;
      pos.setZ(i, curve + chestBulge);
    }
    geo.computeVertexNormals();

    let mat: THREE.Material;
    if (texture) {
      mat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1,
      });
    } else {
      // Default yellow shirt
      mat = new THREE.MeshStandardMaterial({
        color: 0xf0c040,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        roughness: 0.8,
        metalness: 0.0,
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
  }, []);

  // Init Three.js scene
  const initThree = useCallback((canvas: HTMLCanvasElement, w: number, h: number) => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, w, 0, h, -500, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(0, 1, 2);
    scene.add(dirLight);

    // Create default shirt
    const shirt = createShirtMesh();
    scene.add(shirt);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    garmentMeshRef.current = shirt;
  }, [createShirtMesh]);

  // Update garment mesh position based on body landmarks
  const updateGarmentFromLandmarks = useCallback((landmarks: PoseResultLandmark[]) => {
    const mesh = garmentMeshRef.current;
    if (!mesh || landmarks.length < 25) return;

    const vw = videoDims.current.w;
    const vh = videoDims.current.h;

    const ls = landmarks[11]; // left shoulder
    const rs = landmarks[12]; // right shoulder
    const lh = landmarks[23]; // left hip
    const rh = landmarks[24]; // right hip

    if (!ls || !rs || !lh || !rh) return;

    const vis = ((ls.visibility ?? 0) + (rs.visibility ?? 0)) / 2;
    if (vis < 0.4) {
      mesh.visible = false;
      return;
    }

    // Mirror: camera is flipped
    const shoulderCX = ((1 - ls.x + 1 - rs.x) / 2) * vw;
    const shoulderCY = ((ls.y + rs.y) / 2) * vh;
    const hipCY = ((lh.y + rh.y) / 2) * vh;
    const shoulderW = Math.abs(rs.x - ls.x) * vw;
    const torsoH = hipCY - shoulderCY;

    // Smooth position
    const t = 0.3;
    if (!smoothPos.current.ready) {
      smoothPos.current = { x: shoulderCX, y: shoulderCY, w: shoulderW, h: torsoH, ready: true };
    } else {
      smoothPos.current.x = lerp(smoothPos.current.x, shoulderCX, t);
      smoothPos.current.y = lerp(smoothPos.current.y, shoulderCY, t);
      smoothPos.current.w = lerp(smoothPos.current.w, shoulderW, t);
      smoothPos.current.h = lerp(smoothPos.current.h, torsoH, t);
    }

    const sp = smoothPos.current;

    // Position & scale the 3D mesh
    mesh.position.set(sp.x, sp.y + sp.h * 0.45, 0);
    const scaleX = sp.w * 1.35;
    const scaleY = sp.h * 1.1;
    mesh.scale.set(scaleX, scaleY, scaleX * 0.3);
    mesh.visible = true;
  }, []);

  // Start camera + pose detection
  const startCamera = useCallback(async () => {
    try {
      setStatus("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      videoDims.current = { w: vw, h: vh };

      // Init Three.js overlay
      if (threeCanvasRef.current) {
        initThree(threeCanvasRef.current, vw, vh);
      }

      setStatus("Loading pose model...");
      const vision = await import("@mediapipe/tasks-vision");
      const { PoseLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      poseLandmarkerRef.current = poseLandmarker;

      setCameraOn(true);
      setStatus("✅ Tracking active — move around!");

      // Detection + render loop
      let lastTime = -1;
      function loop() {
        if (!videoRef.current || !poseLandmarkerRef.current) return;
        const now = performance.now();
        if (now === lastTime) { animFrameRef.current = requestAnimationFrame(loop); return; }
        lastTime = now;

        try {
          const result = poseLandmarkerRef.current.detectForVideo(videoRef.current, now);
          if (result?.landmarks?.[0]) {
            updateGarmentFromLandmarks(result.landmarks[0]);
          }
        } catch { /* skip frame */ }

        // Render Three.js
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }

        animFrameRef.current = requestAnimationFrame(loop);
      }
      loop();
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }, [initThree, updateGarmentFromLandmarks]);

  // Upload garment image → rembg → texture on 3D mesh
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setStatus("🔄 Removing background...");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/remove-bg", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");

      // Load as Three.js texture
      const loader = new THREE.TextureLoader();
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(data.imageUrl, resolve, undefined, reject);
      });
      texture.colorSpace = THREE.SRGBColorSpace;

      // Replace mesh with textured version
      if (sceneRef.current && garmentMeshRef.current) {
        sceneRef.current.remove(garmentMeshRef.current);
        garmentMeshRef.current.geometry.dispose();
        (garmentMeshRef.current.material as THREE.Material).dispose();

        const newMesh = createShirtMesh(texture);
        sceneRef.current.add(newMesh);
        garmentMeshRef.current = newMesh;
        garmentTextureRef.current = texture;
      }

      setStatus(`✅ "${file.name}" loaded as 3D garment!`);
    } catch (err: unknown) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setUploading(false);
    }
  }, [createShirtMesh]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        🪞 Virtual Try-On
      </h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
        Upload any clothing photo → see it on you in 3D
      </p>

      {/* Camera + Three.js overlay */}
      <div style={{ position: "relative", width: "100%", maxWidth: 640 }}>
        <video
          ref={videoRef}
          style={{ width: "100%", transform: "scaleX(-1)", borderRadius: 12, background: "#000" }}
          playsInline
          muted
        />
        <canvas
          ref={threeCanvasRef}
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%", height: "100%",
            transform: "scaleX(-1)",
            pointerEvents: "none",
          }}
        />

        {/* Start button overlay */}
        {!cameraOn && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", borderRadius: 12,
          }}>
            <button
              onClick={startCamera}
              style={{
                padding: "16px 40px", fontSize: 20, fontWeight: 700,
                background: "#6C5CE7", color: "#fff", border: "none",
                borderRadius: 12, cursor: "pointer",
              }}
            >
              🎥 Start Camera
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      <p style={{ color: "#aaa", fontSize: 16, marginTop: 12, fontFamily: "monospace" }}>
        {status}
      </p>

      {/* Controls */}
      {cameraOn && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {/* Upload button */}
          <label style={{
            padding: "12px 24px", fontSize: 16, fontWeight: 700,
            background: uploading ? "#555" : "#6C5CE7", color: "#fff",
            borderRadius: 10, cursor: uploading ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {uploading ? "⏳ Processing..." : "📸 Upload Clothing Photo"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </label>

          {/* Reset to default yellow shirt */}
          <button
            onClick={() => {
              if (sceneRef.current && garmentMeshRef.current) {
                sceneRef.current.remove(garmentMeshRef.current);
                garmentMeshRef.current.geometry.dispose();
                (garmentMeshRef.current.material as THREE.Material).dispose();
                const newMesh = createShirtMesh();
                sceneRef.current.add(newMesh);
                garmentMeshRef.current = newMesh;
                setStatus("Default shirt loaded");
              }
            }}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#333", color: "#fff", border: "1px solid #555",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            👕 Default Shirt
          </button>
        </div>
      )}

      {/* How it works */}
      <div style={{ marginTop: 24, color: "#666", fontSize: 13, textAlign: "center", maxWidth: 500 }}>
        <p><strong>How it works:</strong></p>
        <p>1. Start camera → MediaPipe tracks your body</p>
        <p>2. Upload any clothing photo → AI removes background</p>
        <p>3. Image becomes a 3D curved mesh anchored to your shoulders</p>
      </div>
    </div>
  );
}
