"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { smoothScalar } from "./smoothing-utils";
import { detectLeftSwipeIntent, detectRightSwipeIntent, detectGestureCooldownWindow } from "./gesture-intent";

type PoseResultLandmark = { x: number; y: number; z?: number; visibility?: number };

export default function MirrorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Click Start to begin");
  const [fps, setFps] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState(0);
  const [savedGarments, setSavedGarments] = useState<Array<{name: string, dataUrl: string}>>([]);
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);
  const [handsVisible, setHandsVisible] = useState<{left: boolean, right: boolean}>({left: false, right: false});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved garments from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("virtualfit-saved-garments");
      if (saved) {
        setSavedGarments(JSON.parse(saved));
      }
    } catch {
      console.warn("Failed to load saved garments");
    }
  }, []);

  // Garment gallery
  const GARMENTS = [
    { name: "Yellow Shirt", path: "/garments/yellow-shirt-nobg.png", emoji: "👕" },
    { name: "Blue T-Shirt", path: "/garments/tshirt-blue.png", emoji: "👔" },
    { name: "Green Polo", path: "/garments/polo-green.png", emoji: "🎽" },
    { name: "Red Hoodie", path: "/garments/hoodie-red.png", emoji: "🧥" },
    { name: "Black Jacket", path: "/garments/jacket-black.png", emoji: "🧥" },
  ];

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const garmentMeshRef = useRef<THREE.Mesh | null>(null);
  const garmentTextureRef = useRef<THREE.Texture | null>(null);
  const defaultTextureRef = useRef<THREE.Texture | null>(null);

  // Pose refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseLandmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const smoothPos = useRef({ x: 0, y: 0, w: 0, h: 0, tilt: 0, depth: 1, ready: false });

  // Video dimensions
  const videoDims = useRef({ w: 640, h: 480 });

  // Gesture detection refs
  const lastWristX = useRef<number | null>(null);
  const lastGestureTime = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const detectGestureRef = useRef<((landmarks: PoseResultLandmark[]) => void) | null>(null);

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

    // Use texture if provided, otherwise use default texture or fallback to solid color
    const textureToUse = texture || defaultTextureRef.current;
    let mat: THREE.Material;
    if (textureToUse) {
      mat = new THREE.MeshStandardMaterial({
        map: textureToUse,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1,
      });
    } else {
      // Fallback to solid yellow if texture not loaded yet
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

  // Load default yellow shirt texture
  const loadDefaultTexture = useCallback(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      "/garments/yellow-shirt-nobg.png",
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        defaultTextureRef.current = texture;
        // Update existing mesh if it exists with solid color fallback
        if (garmentMeshRef.current && sceneRef.current) {
          const oldMesh = garmentMeshRef.current;
          const newMesh = createShirtMesh(texture);
          newMesh.visible = oldMesh.visible;
          newMesh.position.copy(oldMesh.position);
          newMesh.scale.copy(oldMesh.scale);
          newMesh.rotation.copy(oldMesh.rotation);
          sceneRef.current.remove(oldMesh);
          oldMesh.geometry.dispose();
          (oldMesh.material as THREE.Material).dispose();
          sceneRef.current.add(newMesh);
          garmentMeshRef.current = newMesh;
        }
      },
      undefined,
      (err) => console.warn("Failed to load default shirt texture:", err)
    );
  }, [createShirtMesh]);

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

    // Create default shirt (will start with solid color, then swap to texture when loaded)
    const shirt = createShirtMesh();
    scene.add(shirt);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    garmentMeshRef.current = shirt;

    // Load the default yellow shirt texture
    loadDefaultTexture();
  }, [createShirtMesh, loadDefaultTexture]);

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
    
    // Calculate shoulder tilt angle from Y-difference
    // Note: camera is mirrored, so we flip the calculation
    const shoulderDeltaY = (rs.y - ls.y) * vh; // positive = right shoulder lower
    const shoulderDeltaX = Math.abs(rs.x - ls.x) * vw;
    const tiltAngle = Math.atan2(shoulderDeltaY, shoulderDeltaX); // radians
    
    // Calculate depth scale from Z-coordinates (closer = bigger, further = smaller)
    // MediaPipe Z is relative to hip center, negative = closer to camera
    const avgShoulderZ = ((ls.z ?? 0) + (rs.z ?? 0)) / 2;
    // Map Z to a scale factor: Z around -0.5 to 0.5, map to 0.8 to 1.2
    const depthScale = 1.0 - (avgShoulderZ * 0.4); // closer (negative Z) = larger
    const clampedDepth = Math.max(0.7, Math.min(1.3, depthScale));

    // Smooth position using smoothing-utils
    const alpha = 0.3;
    if (!smoothPos.current.ready) {
      smoothPos.current = { x: shoulderCX, y: shoulderCY, w: shoulderW, h: torsoH, tilt: tiltAngle, depth: clampedDepth, ready: true };
    } else {
      smoothPos.current.x = smoothScalar(smoothPos.current.x, shoulderCX, { alpha }) ?? shoulderCX;
      smoothPos.current.y = smoothScalar(smoothPos.current.y, shoulderCY, { alpha }) ?? shoulderCY;
      smoothPos.current.w = smoothScalar(smoothPos.current.w, shoulderW, { alpha, min: 50 }) ?? shoulderW;
      smoothPos.current.h = smoothScalar(smoothPos.current.h, torsoH, { alpha, min: 50 }) ?? torsoH;
      smoothPos.current.tilt = smoothScalar(smoothPos.current.tilt, tiltAngle, { alpha: 0.25 }) ?? tiltAngle;
      smoothPos.current.depth = smoothScalar(smoothPos.current.depth, clampedDepth, { alpha: 0.2, min: 0.7, max: 1.3 }) ?? clampedDepth;
    }

    const sp = smoothPos.current;

    // Position & scale the 3D mesh
    mesh.position.set(sp.x, sp.y + sp.h * 0.45, 0);
    const scaleX = sp.w * 1.35 * sp.depth;
    const scaleY = sp.h * 1.1 * sp.depth;
    mesh.scale.set(scaleX, scaleY, scaleX * 0.3);
    
    // Apply shoulder tilt as Z-rotation
    mesh.rotation.z = sp.tilt;
    
    mesh.visible = true;

    // Estimate garment size based on shoulder width ratio
    // Shoulder width as fraction of frame width (typical range 0.2-0.5)
    const shoulderRatio = shoulderW / vw;
    // Map to clothing sizes (rough estimates based on average webcam framing)
    // These ratios assume user is ~1-2m from camera, shoulders fill 25-45% of frame
    let size: string;
    if (shoulderRatio < 0.22) size = "XS";
    else if (shoulderRatio < 0.27) size = "S";
    else if (shoulderRatio < 0.32) size = "M";
    else if (shoulderRatio < 0.38) size = "L";
    else if (shoulderRatio < 0.45) size = "XL";
    else size = "XXL";
    setEstimatedSize(size);

    // Track hand visibility (wrist landmarks 15=left, 16=right)
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    setHandsVisible({
      left: (leftWrist?.visibility ?? 0) > 0.5,
      right: (rightWrist?.visibility ?? 0) > 0.5,
    });
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

        // FPS tracking
        frameCount.current++;
        if (now - lastFpsUpdate.current >= 1000) {
          setFps(frameCount.current);
          frameCount.current = 0;
          lastFpsUpdate.current = now;
        }

        try {
          const result = poseLandmarkerRef.current.detectForVideo(videoRef.current, now);
          if (result?.landmarks?.[0]) {
            updateGarmentFromLandmarks(result.landmarks[0]);
            detectGestureRef.current?.(result.landmarks[0]);
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
      // Better error handling for camera permission issues
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setStatus("⛔ Camera access denied. Please allow camera permission in your browser settings and refresh.");
        } else if (err.name === "NotFoundError") {
          setStatus("📷 No camera found. Please connect a camera and refresh.");
        } else if (err.name === "NotReadableError") {
          setStatus("⚠️ Camera is in use by another app. Close other apps and try again.");
        } else {
          setStatus(`Error: ${errorMsg}`);
        }
      } else {
        setStatus(`Error: ${errorMsg}`);
      }
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

      // Save to localStorage for persistence
      const garmentName = file.name.replace(/\.[^/.]+$/, ""); // remove extension
      const newGarment = { name: garmentName, dataUrl: data.imageUrl };
      const updatedSaved = [...savedGarments, newGarment];
      setSavedGarments(updatedSaved);
      try {
        localStorage.setItem("virtualfit-saved-garments", JSON.stringify(updatedSaved));
      } catch {
        console.warn("Failed to save garment to localStorage");
      }

      setStatus(`✅ "${file.name}" loaded and saved!`);
    } catch (err: unknown) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setUploading(false);
    }
  }, [createShirtMesh, savedGarments]);

  // Switch to a garment from the gallery
  const switchGarment = useCallback((index: number) => {
    if (!sceneRef.current || !garmentMeshRef.current) return;
    
    const garment = GARMENTS[index];
    if (!garment) return;
    
    setSelectedGarment(index);
    setStatus(`Loading ${garment.name}...`);
    
    const loader = new THREE.TextureLoader();
    loader.load(
      garment.path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        
        if (sceneRef.current && garmentMeshRef.current) {
          const oldMesh = garmentMeshRef.current;
          const newMesh = createShirtMesh(texture);
          newMesh.visible = oldMesh.visible;
          newMesh.position.copy(oldMesh.position);
          newMesh.scale.copy(oldMesh.scale);
          newMesh.rotation.copy(oldMesh.rotation);
          
          sceneRef.current.remove(oldMesh);
          oldMesh.geometry.dispose();
          (oldMesh.material as THREE.Material).dispose();
          
          sceneRef.current.add(newMesh);
          garmentMeshRef.current = newMesh;
          garmentTextureRef.current = texture;
          
          setStatus(`✅ ${garment.name} loaded!`);
        }
      },
      undefined,
      (err) => {
        console.error("Failed to load garment:", err);
        setStatus(`Failed to load ${garment.name}`);
      }
    );
  }, [createShirtMesh]);

  // Detect hand swipe gestures from wrist landmarks
  const detectGesture = useCallback((landmarks: PoseResultLandmark[]) => {
    // Use right wrist (landmark 16) for gesture detection
    const rightWrist = landmarks[16];
    if (!rightWrist || (rightWrist.visibility ?? 0) < 0.5) {
      lastWristX.current = null;
      return;
    }

    const now = performance.now();
    const deltaTimeMs = lastFrameTime.current > 0 ? now - lastFrameTime.current : 0;
    lastFrameTime.current = now;

    // Check cooldown
    const cooldown = detectGestureCooldownWindow({
      lastGestureAtMs: lastGestureTime.current,
      nowMs: now,
      cooldownMs: 800,
    });

    if (cooldown.inCooldown) {
      lastWristX.current = rightWrist.x;
      return;
    }

    if (lastWristX.current !== null && deltaTimeMs > 0) {
      // Check for left swipe (next garment) - mirrored view, so left swipe = rightward X movement
      const leftSwipe = detectLeftSwipeIntent({
        previousX: lastWristX.current,
        currentX: rightWrist.x,
        deltaTimeMs,
        handPresenceMetric: rightWrist.visibility ?? 0,
        minDeltaX: 0.08,
        minVelocityX: 0.0008,
      });

      if (leftSwipe.detected) {
        const nextIdx = (selectedGarment + 1) % GARMENTS.length;
        switchGarment(nextIdx);
        lastGestureTime.current = now;
        setStatus("👈 Swipe: next garment");
      }

      // Check for right swipe (previous garment)
      const rightSwipe = detectRightSwipeIntent({
        previousX: lastWristX.current,
        currentX: rightWrist.x,
        deltaTimeMs,
        handPresenceMetric: rightWrist.visibility ?? 0,
        minDeltaX: 0.08,
        minVelocityX: 0.0008,
      });

      if (rightSwipe.detected) {
        const prevIdx = (selectedGarment - 1 + GARMENTS.length) % GARMENTS.length;
        switchGarment(prevIdx);
        lastGestureTime.current = now;
        setStatus("👉 Swipe: previous garment");
      }
    }

    lastWristX.current = rightWrist.x;
  }, [selectedGarment, switchGarment, GARMENTS]);

  // Keep detectGesture ref updated
  useEffect(() => {
    detectGestureRef.current = detectGesture;
  }, [detectGesture]);

  // Load a saved garment from localStorage
  const loadSavedGarment = useCallback((index: number) => {
    if (!sceneRef.current || !garmentMeshRef.current) return;
    
    const garment = savedGarments[index];
    if (!garment) return;
    
    setSelectedGarment(-1); // deselect preset gallery
    setStatus(`Loading ${garment.name}...`);
    
    const loader = new THREE.TextureLoader();
    loader.load(
      garment.dataUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        
        if (sceneRef.current && garmentMeshRef.current) {
          const oldMesh = garmentMeshRef.current;
          const newMesh = createShirtMesh(texture);
          newMesh.visible = oldMesh.visible;
          newMesh.position.copy(oldMesh.position);
          newMesh.scale.copy(oldMesh.scale);
          newMesh.rotation.copy(oldMesh.rotation);
          
          sceneRef.current.remove(oldMesh);
          oldMesh.geometry.dispose();
          (oldMesh.material as THREE.Material).dispose();
          
          sceneRef.current.add(newMesh);
          garmentMeshRef.current = newMesh;
          garmentTextureRef.current = texture;
          
          setStatus(`✅ ${garment.name} loaded!`);
        }
      },
      undefined,
      (err) => {
        console.error("Failed to load saved garment:", err);
        setStatus(`Failed to load ${garment.name}`);
      }
    );
  }, [createShirtMesh, savedGarments]);

  // Delete a saved garment
  const deleteSavedGarment = useCallback((index: number) => {
    const updated = savedGarments.filter((_, i) => i !== index);
    setSavedGarments(updated);
    try {
      localStorage.setItem("virtualfit-saved-garments", JSON.stringify(updated));
    } catch {
      console.warn("Failed to update localStorage");
    }
    setStatus("Garment removed");
  }, [savedGarments]);

  // Capture screenshot of try-on result
  const captureScreenshot = useCallback(() => {
    if (!videoRef.current || !threeCanvasRef.current) {
      setStatus("Cannot capture - camera not ready");
      return;
    }

    // Create a composite canvas
    const video = videoRef.current;
    const threeCanvas = threeCanvasRef.current;
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = video.videoWidth || 640;
    compositeCanvas.height = video.videoHeight || 480;
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return;

    // Draw mirrored video first
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
    ctx.restore();

    // Draw Three.js overlay on top
    ctx.drawImage(threeCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);

    // Convert to blob and download
    compositeCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `virtualfit-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("📸 Screenshot saved!");
    }, "image/png");
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        setStatus("Fullscreen not available");
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'f': // Fullscreen
          toggleFullscreen();
          break;
        case 's': // Screenshot
          if (cameraOn) captureScreenshot();
          break;
        case 'arrowright': // Next garment
        case 'n':
          if (cameraOn) {
            const nextIdx = (selectedGarment + 1) % GARMENTS.length;
            switchGarment(nextIdx);
          }
          break;
        case 'arrowleft': // Previous garment
        case 'p':
          if (cameraOn) {
            const prevIdx = (selectedGarment - 1 + GARMENTS.length) % GARMENTS.length;
            switchGarment(prevIdx);
          }
          break;
        case 'escape': // Exit fullscreen or close help
          if (showHelp) {
            setShowHelp(false);
          } else if (isFullscreen) {
            document.exitFullscreen();
          }
          break;
        case 'h': // Toggle help
        case '?':
          setShowHelp(prev => !prev);
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cameraOn, selectedGarment, isFullscreen, showHelp, toggleFullscreen, captureScreenshot, switchGarment, GARMENTS.length]);

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
    <div ref={containerRef} style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      {/* Help Overlay */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1f2937",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              color: "#fff",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: 22 }}>⌨️ Keyboard Shortcuts</h2>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 15 }}>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>F</kbd>
              <span>Toggle fullscreen</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>S</kbd>
              <span>Take screenshot</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>← / P</kbd>
              <span>Previous garment</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>→ / N</kbd>
              <span>Next garment</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>H / ?</kbd>
              <span>Toggle this help</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>Esc</kbd>
              <span>Close help / exit fullscreen</span>
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: "#9ca3af" }}>
              👋 Swipe gestures also work with your hand!
            </p>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                background: "#6C5CE7",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

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
        {status} {cameraOn && fps > 0 && <span style={{ color: fps >= 24 ? "#22c55e" : fps >= 15 ? "#eab308" : "#ef4444" }}>({fps} FPS)</span>}
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
                const newMesh = createShirtMesh(defaultTextureRef.current || undefined);
                sceneRef.current.add(newMesh);
                garmentMeshRef.current = newMesh;
                garmentTextureRef.current = null;
                setStatus("Default yellow shirt loaded");
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

          {/* Screenshot button */}
          <button
            onClick={captureScreenshot}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#2563eb", color: "#fff", border: "1px solid #3b82f6",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            📸 Screenshot
          </button>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#7c3aed", color: "#fff", border: "1px solid #8b5cf6",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            {isFullscreen ? "↩️ Exit" : "⛶ Fullscreen"}
          </button>

          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#374151", color: "#fff", border: "1px solid #4b5563",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            ❓ Help
          </button>
        </div>
      )}

      {/* Garment Gallery */}
      {cameraOn && (
        <div style={{ marginTop: 16, width: "100%", maxWidth: 640 }}>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 8, textAlign: "center" }}>Try these garments:</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {GARMENTS.map((garment, idx) => (
              <button
                key={garment.path}
                onClick={() => switchGarment(idx)}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: selectedGarment === idx ? 700 : 500,
                  background: selectedGarment === idx ? "#6C5CE7" : "#222",
                  color: "#fff",
                  border: selectedGarment === idx ? "2px solid #8B7CF0" : "1px solid #444",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {garment.emoji} {garment.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Garments */}
      {cameraOn && savedGarments.length > 0 && (
        <div style={{ marginTop: 16, width: "100%", maxWidth: 640 }}>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 8, textAlign: "center" }}>Your saved garments:</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {savedGarments.map((garment, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => loadSavedGarment(idx)}
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "#1a3a2a",
                    color: "#4ade80",
                    border: "1px solid #22c55e",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  💾 {garment.name}
                </button>
                <button
                  onClick={() => deleteSavedGarment(idx)}
                  style={{
                    padding: "8px",
                    fontSize: 12,
                    background: "#3a1a1a",
                    color: "#f87171",
                    border: "1px solid #ef4444",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Size Recommendation Badge */}
      {cameraOn && estimatedSize && (
        <div style={{
          marginTop: 16,
          padding: "12px 24px",
          background: "linear-gradient(135deg, #10b981, #059669)",
          borderRadius: 12,
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: 14, color: "#d1fae5" }}>Estimated Size</p>
          <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#fff" }}>{estimatedSize}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a7f3d0" }}>Based on shoulder width</p>
        </div>
      )}

      {/* Hand Visibility Indicators */}
      {cameraOn && (
        <div style={{
          marginTop: 12,
          display: "flex",
          gap: 16,
          justifyContent: "center",
        }}>
          <div style={{
            padding: "8px 16px",
            background: handsVisible.left ? "#22c55e" : "#374151",
            borderRadius: 8,
            fontSize: 14,
            color: "#fff",
            transition: "background 0.2s",
          }}>
            ✋ Left Hand {handsVisible.left ? "✓" : "✗"}
          </div>
          <div style={{
            padding: "8px 16px",
            background: handsVisible.right ? "#22c55e" : "#374151",
            borderRadius: 8,
            fontSize: 14,
            color: "#fff",
            transition: "background 0.2s",
          }}>
            🤚 Right Hand {handsVisible.right ? "✓" : "✗"}
          </div>
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
