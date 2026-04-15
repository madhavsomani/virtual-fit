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
  const [lowFpsWarning, setLowFpsWarning] = useState(false);
  const lowFpsCountRef = useRef(0);
  const totalFramesRef = useRef(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedGarment, setSelectedGarment] = useState(0);
  const [savedGarments, setSavedGarments] = useState<Array<{name: string, dataUrl: string}>>([]);
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);
  const [garmentOpacity, setGarmentOpacity] = useState(0.9);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [handsVisible, setHandsVisible] = useState<{left: boolean, right: boolean}>({left: false, right: false});
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const lastPoseDetectedRef = useRef(Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [screenshotCountdown, setScreenshotCountdown] = useState<number | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [garmentTransition, setGarmentTransition] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const lastAdjustmentsRef = useRef<{
    opacity: number; scale: number; yOffset: number; xOffset: number;
    brightness: number; hue: number; rotation: number;
  } | null>(null);
  const previousGarmentRef = useRef<number | null>(null);
  const [smoothMode, setSmoothMode] = useState(false);
  const [showPinchFeedback, setShowPinchFeedback] = useState(false);
  const tapCountRef = useRef(0);
  const [maxZoom, setMaxZoom] = useState(1);
  const [shareImageBlob, setShareImageBlob] = useState<Blob | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [garmentScale, setGarmentScale] = useState(1.0);
  const [isMirrored, setIsMirrored] = useState(true);
  const [garmentYOffset, setGarmentYOffset] = useState(0);
  const [garmentXOffset, setGarmentXOffset] = useState(0);
  const [garmentRotation, setGarmentRotation] = useState(0); // manual rotation offset in radians
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1.0);
  const [showControls, setShowControls] = useState(true);
  const [lowLightWarning, setLowLightWarning] = useState(false);
  const [garmentBrightness, setGarmentBrightness] = useState(1.0);
  const [garmentHue, setGarmentHue] = useState(0); // 0-360 degrees hue rotation
  const [isLandscape, setIsLandscape] = useState(false);
  const [showGarment, setShowGarment] = useState(true); // toggle for before/after comparison
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [favoriteGarments, setFavoriteGarments] = useState<number[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const lastTapTimeRef = useRef(0);
  const touchStartXRef = useRef(0);
  const lowConfidenceCountRef = useRef(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Battery status for mobile
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if ('getBattery' in nav) {
      nav.getBattery().then((battery: { level: number; addEventListener: (event: string, cb: () => void) => void }) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Network status detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load saved garments from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("virtualfit-saved-garments");
      if (saved) {
        setSavedGarments(JSON.parse(saved));
      }
      // Load saved adjustments
      const savedAdjustments = localStorage.getItem("virtualfit-adjustments");
      if (savedAdjustments) {
        const adj = JSON.parse(savedAdjustments);
        if (adj.opacity !== undefined) setGarmentOpacity(adj.opacity);
        if (adj.scale !== undefined) setGarmentScale(adj.scale);
        if (adj.yOffset !== undefined) setGarmentYOffset(adj.yOffset);
        if (adj.xOffset !== undefined) setGarmentXOffset(adj.xOffset);
        if (adj.brightness !== undefined) setGarmentBrightness(adj.brightness);
        if (adj.rotation !== undefined) setGarmentRotation(adj.rotation);
      }
      // Check if first-time user
      const hasSeenOnboarding = localStorage.getItem("virtualfit-onboarding-seen");
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
      // Load favorite garments
      const savedFavorites = localStorage.getItem("virtualfit-favorites");
      if (savedFavorites) {
        setFavoriteGarments(JSON.parse(savedFavorites));
      }
      // Load last selected garment
      const lastGarment = localStorage.getItem("virtualfit-last-garment");
      if (lastGarment) {
        const idx = parseInt(lastGarment, 10);
        if (!isNaN(idx) && idx >= 0) {
          setSelectedGarment(idx);
        }
      }
    } catch {
      console.warn("Failed to load saved garments");
    }
  }, []);

  // Save adjustments to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem("virtualfit-adjustments", JSON.stringify({
        opacity: garmentOpacity,
        scale: garmentScale,
        yOffset: garmentYOffset,
        xOffset: garmentXOffset,
        brightness: garmentBrightness,
        rotation: garmentRotation,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [garmentOpacity, garmentScale, garmentYOffset, garmentXOffset, garmentBrightness, garmentRotation]);

  // Toggle favorite status for a garment
  const toggleFavorite = useCallback((index: number) => {
    setFavoriteGarments(prev => {
      const updated = prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index];
      try {
        localStorage.setItem("virtualfit-favorites", JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  // Clear all app data and reset to defaults
  const clearAllData = useCallback(() => {
    try {
      localStorage.removeItem("virtualfit-saved-garments");
      localStorage.removeItem("virtualfit-adjustments");
      localStorage.removeItem("virtualfit-favorites");
      localStorage.removeItem("virtualfit-onboarding-seen");
      setSavedGarments([]);
      setFavoriteGarments([]);
      setGarmentOpacity(0.9);
      setGarmentScale(1.0);
      setGarmentYOffset(0);
      setGarmentXOffset(0);
      setGarmentBrightness(1.0);
      setGarmentHue(0);
      setGarmentRotation(0);
      setShowClearConfirm(false);
      setStatus("🧹 All data cleared!");
    } catch {
      setStatus("❌ Failed to clear data");
    }
  }, []);

  // Haptic feedback helper (mobile)
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Apply camera zoom
  const applyCameraZoom = useCallback((zoomLevel: number) => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (track) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const constraints = { advanced: [{ zoom: zoomLevel }] } as any;
      track.applyConstraints(constraints).catch(() => {});
      setCameraZoom(zoomLevel);
    }
  }, []);

  // Save current adjustments for undo
  const saveAdjustmentsForUndo = useCallback(() => {
    lastAdjustmentsRef.current = {
      opacity: garmentOpacity, scale: garmentScale, yOffset: garmentYOffset,
      xOffset: garmentXOffset, brightness: garmentBrightness, hue: garmentHue,
      rotation: garmentRotation,
    };
  }, [garmentOpacity, garmentScale, garmentYOffset, garmentXOffset, garmentBrightness, garmentHue, garmentRotation]);

  // Undo last adjustment change
  const undoAdjustments = useCallback(() => {
    if (!lastAdjustmentsRef.current) {
      setStatus("❌ Nothing to undo");
      return;
    }
    const prev = lastAdjustmentsRef.current;
    setGarmentOpacity(prev.opacity);
    setGarmentScale(prev.scale);
    setGarmentYOffset(prev.yOffset);
    setGarmentXOffset(prev.xOffset);
    setGarmentBrightness(prev.brightness);
    setGarmentHue(prev.hue);
    setGarmentRotation(prev.rotation);
    setStatus("↩️ Adjustments restored!");
    lastAdjustmentsRef.current = null;
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
    // Use higher smoothing in smooth mode
    const alpha = smoothMode ? 0.15 : 0.3;
    const tiltAlpha = smoothMode ? 0.1 : 0.25;
    const depthAlpha = smoothMode ? 0.1 : 0.2;
    
    if (!smoothPos.current.ready) {
      smoothPos.current = { x: shoulderCX, y: shoulderCY, w: shoulderW, h: torsoH, tilt: tiltAngle, depth: clampedDepth, ready: true };
    } else {
      smoothPos.current.x = smoothScalar(smoothPos.current.x, shoulderCX, { alpha }) ?? shoulderCX;
      smoothPos.current.y = smoothScalar(smoothPos.current.y, shoulderCY, { alpha }) ?? shoulderCY;
      smoothPos.current.w = smoothScalar(smoothPos.current.w, shoulderW, { alpha, min: 50 }) ?? shoulderW;
      smoothPos.current.h = smoothScalar(smoothPos.current.h, torsoH, { alpha, min: 50 }) ?? torsoH;
      smoothPos.current.tilt = smoothScalar(smoothPos.current.tilt, tiltAngle, { alpha: tiltAlpha }) ?? tiltAngle;
      smoothPos.current.depth = smoothScalar(smoothPos.current.depth, clampedDepth, { alpha: depthAlpha, min: 0.7, max: 1.3 }) ?? clampedDepth;
    }

    const sp = smoothPos.current;

    // Position & scale the 3D mesh
    mesh.position.set(sp.x + garmentXOffset * sp.w * 0.01, sp.y + sp.h * 0.45 + garmentYOffset * sp.h * 0.01, 0);
    const scaleX = sp.w * 1.35 * sp.depth * garmentScale;
    const scaleY = sp.h * 1.1 * sp.depth * garmentScale;
    mesh.scale.set(scaleX, scaleY, scaleX * 0.3);
    
    // Apply shoulder tilt as Z-rotation
    mesh.rotation.z = sp.tilt + garmentRotation;
    
    mesh.visible = showGarment;

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

    // Calculate overall tracking confidence from key landmarks
    const keyLandmarks = [ls, rs, lh, rh, leftWrist, rightWrist];
    const avgConfidence = keyLandmarks.reduce((sum, lm) => sum + (lm?.visibility ?? 0), 0) / keyLandmarks.length;
    const confidencePercent = Math.round(avgConfidence * 100);
    setTrackingConfidence(confidencePercent);
    
    // Update last pose detected time
    if (confidencePercent > 20) {
      lastPoseDetectedRef.current = Date.now();
      if (isPaused) setIsPaused(false);
    } else {
      // Auto-pause if no pose for 10 seconds
      if (Date.now() - lastPoseDetectedRef.current > 10000 && !isPaused) {
        setIsPaused(true);
        setStatus("⏸️ Paused — no pose detected. Move into frame to resume.");
      }
    }

    // Detect sustained low confidence for lighting warning
    if (confidencePercent < 30) {
      lowConfidenceCountRef.current++;
      if (lowConfidenceCountRef.current > 30) { // ~1 second at 30fps
        setLowLightWarning(true);
      }
    } else {
      lowConfidenceCountRef.current = 0;
      setLowLightWarning(false);
    }

    // Draw debug overlay if enabled
    if (debugMode && debugCanvasRef.current) {
      const ctx = debugCanvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, vw, vh);
        // Draw key landmarks as circles
        ctx.fillStyle = "#6C5CE7";
        landmarks.forEach((lm, idx) => {
          if ((lm.visibility ?? 0) > 0.3) {
            const x = (1 - lm.x) * vw; // mirrored
            const y = lm.y * vh;
            ctx.beginPath();
            ctx.arc(x, y, idx < 11 ? 6 : 4, 0, Math.PI * 2); // face landmarks bigger
            ctx.fill();
          }
        });
        // Draw shoulder line
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo((1 - ls.x) * vw, ls.y * vh);
        ctx.lineTo((1 - rs.x) * vw, rs.y * vh);
        ctx.stroke();
      }
    }
  }, [debugMode, garmentScale, garmentYOffset]);

  // Start camera + pose detection
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Check for zoom capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = track.getCapabilities() as any;
        if (capabilities?.zoom) {
          setMaxZoom(capabilities.zoom.max || 1);
          setCameraZoom(capabilities.zoom.min || 1);
        }
      }

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
      setSessionStartTime(Date.now());
      setIsLoading(false);
      setStatus("✅ Tracking active — move around!");
      
      // Show keyboard hints briefly for desktop users
      if (!isMobileDevice) {
        setShowKeyboardHint(true);
        setTimeout(() => setShowKeyboardHint(false), 5000);
      }

      // Detection + render loop
      let lastTime = -1;
      function loop() {
        if (!videoRef.current || !poseLandmarkerRef.current) return;
        const now = performance.now();
        if (now === lastTime) { animFrameRef.current = requestAnimationFrame(loop); return; }
        lastTime = now;

        // FPS tracking
        frameCount.current++;
        totalFramesRef.current++;
        if (now - lastFpsUpdate.current >= 1000) {
          const currentFps = frameCount.current;
          setFps(currentFps);
          
          // Low FPS warning (below 15 fps for 3 seconds)
          if (currentFps < 15 && currentFps > 0) {
            lowFpsCountRef.current++;
            if (lowFpsCountRef.current >= 3) {
              setLowFpsWarning(true);
            }
          } else {
            lowFpsCountRef.current = 0;
            setLowFpsWarning(false);
          }
          
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
      setIsLoading(false);
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
  }, [initThree, updateGarmentFromLandmarks, facingMode]);

  // Upload garment image → rembg → texture on 3D mesh
  const handleUpload = useCallback(async (file: File) => {
    // Check upload limit
    if (savedGarments.length >= 10) {
      setStatus("⚠️ Upload limit reached (10 garments). Delete some to add more.");
      return;
    }
    setUploading(true);
    setUploadProgress(10);
    setStatus("🔄 Uploading image...");
    try {
      const formData = new FormData();
      formData.append("image", file);
      setUploadProgress(30);
      setStatus("🔄 Removing background...");
      const res = await fetch("/api/remove-bg", { method: "POST", body: formData });
      setUploadProgress(60);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");

      setUploadProgress(80);
      setStatus("🔄 Loading texture...");
      // Load as Three.js texture
      const loader = new THREE.TextureLoader();
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(data.imageUrl, resolve, undefined, reject);
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      setUploadProgress(90);

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

      setUploadProgress(100);
      setStatus(`✅ "${file.name}" loaded and saved!`);
    } catch (err: unknown) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [createShirtMesh, savedGarments]);

  // Switch to a garment from the gallery
  const switchGarment = useCallback((index: number) => {
    if (!sceneRef.current || !garmentMeshRef.current) return;
    
    const garment = GARMENTS[index];
    if (!garment) return;
    
    // Trigger visual transition
    setGarmentTransition(true);
    setTimeout(() => setGarmentTransition(false), 300);
    
    // Track previous garment for quick switch
    previousGarmentRef.current = selectedGarment;
    setSelectedGarment(index);
    // Save to localStorage for persistence
    try {
      localStorage.setItem("virtualfit-last-garment", String(index));
    } catch {
      // Ignore
    }
    setStatus(`Loading ${garment.name}...`);
    
    // Fade out current garment
    if (garmentMeshRef.current) {
      const mat = garmentMeshRef.current.material as THREE.MeshBasicMaterial;
      if (mat.opacity !== undefined) {
        mat.opacity = 0.3; // dim during transition
        mat.needsUpdate = true;
      }
    }
    
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
          
          // Start new mesh at low opacity
          const newMat = newMesh.material as THREE.MeshBasicMaterial;
          newMat.opacity = 0.3;
          
          sceneRef.current.remove(oldMesh);
          oldMesh.geometry.dispose();
          (oldMesh.material as THREE.Material).dispose();
          
          sceneRef.current.add(newMesh);
          garmentMeshRef.current = newMesh;
          garmentTextureRef.current = texture;
          
          // Fade in new garment
          let fadeStep = 0;
          const fadeIn = () => {
            fadeStep += 0.1;
            if (fadeStep < garmentOpacity) {
              newMat.opacity = 0.3 + fadeStep * 0.7;
              newMat.needsUpdate = true;
              requestAnimationFrame(fadeIn);
            } else {
              newMat.opacity = garmentOpacity;
              newMat.needsUpdate = true;
            }
          };
          requestAnimationFrame(fadeIn);
          
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

  // Rename a saved garment
  const renameSavedGarment = useCallback((index: number, newName: string) => {
    if (!newName.trim()) return;
    const updated = savedGarments.map((g, i) => 
      i === index ? { ...g, name: newName.trim() } : g
    );
    setSavedGarments(updated);
    try {
      localStorage.setItem("virtualfit-saved-garments", JSON.stringify(updated));
    } catch {
      console.warn("Failed to update localStorage");
    }
    setRenamingIndex(null);
    setRenameValue("");
    setStatus(`Renamed to "${newName.trim()}"`);
  }, [savedGarments]);

  // Immediate screenshot capture
  const doScreenshotCapture = useCallback(() => {
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
    if (isMirrored) {
      ctx.scale(-1, 1);
      ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
    } else {
      ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
    }
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
      vibrate(25);
      setStatus("📸 Screenshot saved!");
    }, "image/png");
  }, [isMirrored, vibrate]);

  // Capture screenshot with 3-second countdown
  const captureScreenshot = useCallback(() => {
    if (!videoRef.current || !threeCanvasRef.current) {
      setStatus("Cannot capture - camera not ready");
      return;
    }
    if (screenshotCountdown !== null) return; // Already counting down

    setScreenshotCountdown(3);
    vibrate(50);
    
    const countdown = setInterval(() => {
      setScreenshotCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdown);
          setScreenshotCountdown(null);
          doScreenshotCapture();
          return null;
        }
        vibrate(30);
        return prev - 1;
      });
    }, 1000);
  }, [screenshotCountdown, vibrate, doScreenshotCapture]);

  // Copy screenshot to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!videoRef.current || !threeCanvasRef.current) {
      setStatus("Cannot copy - camera not ready");
      return;
    }

    const video = videoRef.current;
    const threeCanvas = threeCanvasRef.current;
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = video.videoWidth || 640;
    compositeCanvas.height = video.videoHeight || 480;
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return;

    if (isMirrored) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
    }
    ctx.drawImage(threeCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);

    compositeCanvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        vibrate(25);
        setStatus("📋 Copied to clipboard!");
      } catch {
        setStatus("❌ Clipboard access denied");
      }
    }, "image/png");
  }, [isMirrored, vibrate]);

  // Prepare share image
  const prepareShareImage = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !threeCanvasRef.current) {
        resolve(null);
        return;
      }
      const video = videoRef.current;
      const threeCanvas = threeCanvasRef.current;
      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = video.videoWidth || 640;
      compositeCanvas.height = video.videoHeight || 480;
      const ctx = compositeCanvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      if (isMirrored) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
      }
      ctx.drawImage(threeCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);
      compositeCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }, [isMirrored]);

  // Share try-on result using Web Share API
  const shareResult = useCallback(async () => {
    if (!videoRef.current || !threeCanvasRef.current) {
      setStatus("Cannot share - camera not ready");
      return;
    }

    // Create composite canvas same as screenshot
    const video = videoRef.current;
    const threeCanvas = threeCanvasRef.current;
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = video.videoWidth || 640;
    compositeCanvas.height = video.videoHeight || 480;
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return;

    if (isMirrored) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
    }
    ctx.drawImage(threeCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);

    compositeCanvas.toBlob(async (blob) => {
      if (!blob) return;

      // Check if Web Share API is available
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `virtualfit-${Date.now()}.png`, { type: "image/png" });
        const shareData = {
          title: "My VirtualFit Try-On",
          text: "Check out how this looks on me! Made with VirtualFit",
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            setStatus("🚀 Shared successfully!");
          } catch (err) {
            if ((err as Error).name !== "AbortError") {
              setStatus("❌ Share cancelled");
            }
          }
        } else {
          // Fallback to download
          setStatus("📱 Share not supported - showing share menu");
          const blob = await prepareShareImage();
          if (blob) {
            setShareImageBlob(blob);
            setShowShareMenu(true);
          }
        }
      } else {
        // Fallback for browsers without Web Share API - show share menu
        const blob = await prepareShareImage();
        if (blob) {
          setShareImageBlob(blob);
          setShowShareMenu(true);
        }
      }
    }, "image/png");
  }, [captureScreenshot, isMirrored, prepareShareImage]);

  // Start/stop recording video clip
  const toggleRecording = useCallback(() => {
    if (!videoRef.current) return;

    if (isRecording && mediaRecorderRef.current) {
      // Stop recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setStatus("⏹ Saving video...");
    } else {
      // Start recording
      const stream = videoRef.current.srcObject as MediaStream;
      if (!stream) {
        setStatus("❌ Cannot record - camera not ready");
        return;
      }

      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") 
        ? "video/webm;codecs=vp9" 
        : "video/webm";
      
      const recorder = new MediaRecorder(stream, { mimeType });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `virtualfit-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("🎬 Video saved!");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setStatus("🔴 Recording... Press again to stop");
    }
  }, [isRecording]);

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

  // Update garment opacity when slider changes
  useEffect(() => {
    if (garmentMeshRef.current) {
      const material = garmentMeshRef.current.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
      if (material.opacity !== undefined) {
        material.opacity = garmentOpacity;
        material.needsUpdate = true;
      }
    }
  }, [garmentOpacity]);

  // Update garment brightness when slider changes
  useEffect(() => {
    if (garmentMeshRef.current) {
      const material = garmentMeshRef.current.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
      // For MeshBasicMaterial, we can use color multiplier with hue shift
      if ('color' in material && material.color) {
        const brightness = garmentBrightness;
        // Apply hue rotation (0-360) with brightness
        if (garmentHue === 0) {
          material.color.setRGB(brightness, brightness, brightness);
        } else {
          // Convert hue to RGB tint
          const h = garmentHue / 360;
          const s = 0.5; // saturation for tint
          const l = brightness * 0.5;
          // HSL to RGB conversion
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          const r = hue2rgb(p, q, h + 1/3);
          const g = hue2rgb(p, q, h);
          const b = hue2rgb(p, q, h - 1/3);
          material.color.setRGB(r * 2, g * 2, b * 2); // scale up for visibility
        }
        material.needsUpdate = true;
      }
    }
  }, [garmentBrightness, garmentHue]);

  // Detect landscape orientation and mobile device
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      // Detect mobile via touch or user agent
      const isMobile = 'ontouchstart' in window || window.innerWidth < 768;
      setIsMobileDevice(isMobile);
      // Show rotate hint on mobile in portrait while camera is on
      if (isMobile && window.innerWidth < window.innerHeight && cameraOn) {
        setShowRotateHint(true);
        setTimeout(() => setShowRotateHint(false), 5000); // Auto-hide after 5s
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, [cameraOn]);

  // Auto-hide controls after 5 seconds of inactivity in fullscreen
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isFullscreen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimer();
    }
  }, [isFullscreen, resetControlsTimer]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Show controls on mouse/touch activity
  useEffect(() => {
    const handleActivity = () => resetControlsTimer();
    document.addEventListener("mousemove", handleActivity);
    document.addEventListener("touchstart", handleActivity);
    return () => {
      document.removeEventListener("mousemove", handleActivity);
      document.removeEventListener("touchstart", handleActivity);
    };
  }, [resetControlsTimer]);

  // Pinch-to-zoom for garment scale on mobile
  useEffect(() => {
    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return null;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastTouchDistanceRef.current = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
        const currentDistance = getDistance(e.touches);
        if (currentDistance !== null) {
          const delta = (currentDistance - lastTouchDistanceRef.current) * 0.002;
          setGarmentScale(prev => Math.max(0.7, Math.min(1.3, prev + delta)));
          lastTouchDistanceRef.current = currentDistance;
        }
      }
    };

    const handleTouchEnd = () => {
      lastTouchDistanceRef.current = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
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
        case 'c': // Copy to clipboard
          if (cameraOn) copyToClipboard();
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
        case 'd': // Toggle debug mode
          setDebugMode(prev => !prev);
          break;
        case 'm': // Toggle mirror mode
          setIsMirrored(prev => !prev);
          break;
        case 'g': // Toggle garment visibility (before/after)
        case ' ': // Space also toggles garment
          e.preventDefault();
          setShowGarment(prev => !prev);
          break;
        case 'b': // Before/after compare toggle
          setCompareMode(prev => !prev);
          setStatus(compareMode ? "👁️ Compare off" : "👁️ Compare mode: showing before/after");
          break;
        case 'o': // Grid overlay toggle
          setShowGrid(prev => !prev);
          setStatus(showGrid ? "📷 Grid off" : "📷 Grid overlay on");
          break;
        case 'i': // Stats info toggle
          setShowStats(prev => !prev);
          break;
        case 'r': // Quick reset adjustments
          saveAdjustmentsForUndo();
          setGarmentOpacity(0.9);
          setGarmentScale(1.0);
          setGarmentYOffset(0);
          setGarmentXOffset(0);
          setGarmentBrightness(1.0);
          setGarmentHue(0);
          setGarmentRotation(0);
          setStatus("🔄 Adjustments reset! Press Z to undo");
          break;
        case 'z': // Undo last adjustment change
          undoAdjustments();
          break;
        case 'Tab': // Quick switch to previous garment
          e.preventDefault();
          if (previousGarmentRef.current !== null && cameraOn) {
            switchGarment(previousGarmentRef.current);
            setStatus("⇄ Switched to previous garment");
          }
          break;
        case 'q': // Toggle smooth mode
          setSmoothMode(prev => !prev);
          setStatus(smoothMode ? "✨ Smooth mode off" : "✨ Smooth mode on (less jitter)");
          break;
        case 'v': // Cycle opacity levels
          {
            const levels = [1.0, 0.75, 0.5, 0.25];
            const currentIdx = levels.findIndex(l => Math.abs(l - garmentOpacity) < 0.1);
            const nextIdx = (currentIdx + 1) % levels.length;
            setGarmentOpacity(levels[nextIdx]);
            setStatus(`👓 Opacity: ${Math.round(levels[nextIdx] * 100)}%`);
          }
          break;
        case 'e': // Export adjustments to clipboard
          {
            const exportData = {
              garment: GARMENTS[selectedGarment]?.name || 'Unknown',
              adjustments: {
                opacity: Math.round(garmentOpacity * 100),
                scale: Math.round(garmentScale * 100),
                xOffset: garmentXOffset,
                yOffset: garmentYOffset,
                brightness: Math.round(garmentBrightness * 100),
                hue: garmentHue,
              },
              timestamp: new Date().toISOString(),
            };
            navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
              .then(() => setStatus("📋 Adjustments copied to clipboard!"))
              .catch(() => setStatus("❌ Failed to copy"));
          }
          break;
        case '1': case '2': case '3': case '4': case '5': // Quick garment select
          {
            const idx = parseInt(e.key) - 1;
            if (idx < GARMENTS.length && cameraOn) {
              switchGarment(idx);
            }
          }
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cameraOn, selectedGarment, isFullscreen, showHelp, toggleFullscreen, captureScreenshot, copyToClipboard, switchGarment, GARMENTS.length, saveAdjustmentsForUndo, undoAdjustments]);

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    
    try {
      const capabilities = track.getCapabilities();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ('torch' in capabilities && (capabilities as any).torch) {
        const newTorchState = !torchOn;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await track.applyConstraints({ advanced: [{ torch: newTorchState } as any] });
        setTorchOn(newTorchState);
        setStatus(newTorchState ? "🔦 Torch ON" : "🔦 Torch OFF");
      } else {
        setStatus("⚠️ Torch not supported on this device");
      }
    } catch {
      setStatus("❌ Failed to toggle torch");
    }
  }, [torchOn]);

  // Stop camera and clean up
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (garmentMeshRef.current) {
      garmentMeshRef.current.visible = false;
    }
    setCameraOn(false);
    setSessionStartTime(null);
    setTorchOn(false);
    setFps(0);
    setLowFpsWarning(false);
    lowFpsCountRef.current = 0;
    totalFramesRef.current = 0;
    setEstimatedSize(null);
    setHandsVisible({ left: false, right: false });
    setStatus("Camera stopped. Click Start to begin again.");
  }, []);

  // Flip between front and back camera
  const flipCamera = useCallback(async () => {
    // Stop current stream
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    // Toggle facing mode
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    setStatus(`Switching to ${newMode === "user" ? "front" : "back"} camera...`);
  }, [facingMode]);

  // Restart camera when facingMode changes
  useEffect(() => {
    if (cameraOn) {
      // Small delay to let previous stream close
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

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
    <div ref={containerRef} style={{ 
      background: "#111", 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: isLandscape ? "row" : "column", 
      alignItems: "center", 
      justifyContent: isLandscape ? "center" : "flex-start",
      gap: isLandscape ? 24 : 0,
      padding: isLandscape ? 12 : 20 
    }}>
      {/* Offline warning banner */}
      {!isOnline && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          background: "#dc2626",
          color: "#fff",
          padding: "8px 16px",
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
          zIndex: 300,
        }}>
          📴 You&apos;re offline — some features may not work
        </div>
      )}

      {/* Rotate device hint for mobile portrait */}
      {showRotateHint && isMobileDevice && !isLandscape && cameraOn && (
        <div 
          onClick={() => setShowRotateHint(false)}
          style={{
            position: "fixed",
            bottom: 80, left: 16, right: 16,
            background: "rgba(108, 92, 231, 0.95)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 12,
            textAlign: "center",
            fontSize: 14,
            zIndex: 250,
            cursor: "pointer",
          }}
        >
          🔄 Rotate your device for a better try-on experience
          <span style={{ display: "block", fontSize: 11, marginTop: 4, opacity: 0.8 }}>Tap to dismiss</span>
        </div>
      )}

      {/* Quick keyboard hints toast for desktop */}
      {showKeyboardHint && cameraOn && !isMobileDevice && (
        <div
          onClick={() => setShowKeyboardHint(false)}
          style={{
            position: "fixed",
            bottom: 80, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 13,
            zIndex: 250,
            cursor: "pointer",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span>⌨️ <kbd style={{ background: "#374151", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>H</kbd> Help</span>
          <span><kbd style={{ background: "#374151", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>S</kbd> Screenshot</span>
          <span><kbd style={{ background: "#374151", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>F</kbd> Fullscreen</span>
          <span><kbd style={{ background: "#374151", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>←→</kbd> Switch</span>
        </div>
      )}

      {/* Onboarding Overlay for First-Time Users */}
      {showOnboarding && (
        <div
          onClick={() => {
            setShowOnboarding(false);
            localStorage.setItem("virtualfit-onboarding-seen", "true");
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.9)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 400, textAlign: "center", color: "#fff" }}>
            <h1 style={{ fontSize: 36, marginBottom: 16 }}>👗 Welcome to VirtualFit!</h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 24, color: "#aaa" }}>
              Try on clothes virtually using your camera and AI-powered body tracking.
            </p>
            <div style={{ textAlign: "left", background: "rgba(255,255,255,0.1)", padding: 20, borderRadius: 12, marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 16 }}><strong>Quick Start:</strong></p>
              <p style={{ margin: "0 0 8px", fontSize: 14, color: "#ccc" }}>1️⃣ Click &quot;Start Camera&quot; and allow camera access</p>
              <p style={{ margin: "0 0 8px", fontSize: 14, color: "#ccc" }}>2️⃣ Stand back so your shoulders and torso are visible</p>
              <p style={{ margin: "0 0 8px", fontSize: 14, color: "#ccc" }}>3️⃣ Select a garment from the gallery or upload your own</p>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#ccc" }}>4️⃣ Adjust the fit using controls below the video</p>
              <p style={{ margin: "0 0 8px", fontSize: 14, color: "#a78bfa" }}><strong>📱 Touch Gestures:</strong></p>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#9ca3af" }}>👈👉 Swipe left/right to change garments</p>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#9ca3af" }}>👆👆 Double-tap to cycle to next garment</p>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#9ca3af" }}>🤏 Pinch with 2 fingers to resize</p>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>✋ Two-finger drag to reposition</p>
            </div>
            <button
              style={{
                padding: "16px 48px", fontSize: 18, fontWeight: 700,
                background: "#6C5CE7", color: "#fff", border: "none",
                borderRadius: 12, cursor: "pointer",
              }}
            >
              Let&apos;s Try It! →
            </button>
            <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>Tap anywhere to dismiss</p>
          </div>
        </div>
      )}

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
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>C</kbd>
              <span>Copy to clipboard</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>← / P</kbd>
              <span>Previous garment</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>→ / N</kbd>
              <span>Next garment</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>H / ?</kbd>
              <span>Toggle this help</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>D</kbd>
              <span>Toggle debug landmarks</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>M</kbd>
              <span>Toggle mirror mode</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>Space</kbd>
              <span>Toggle garment on/off</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>B</kbd>
              <span>Before/after compare mode</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>O</kbd>
              <span>Grid overlay for positioning</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>R</kbd>
              <span>Reset all adjustments</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>1-5</kbd>
              <span>Quick select garment 1-5</span>
              <kbd style={{ background: "#374151", padding: "4px 8px", borderRadius: 4 }}>Esc</kbd>
              <span>Close help / exit fullscreen</span>
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: "#9ca3af" }}>
              👋 Swipe gestures also work with your hand!<br/>
              🤏 Pinch to resize garment on touch devices!
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
      <div 
        style={{ position: "relative", width: "100%", maxWidth: 640 }}
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches[0].clientX;
          // Two-finger touch starts drag mode + pinch
          if (e.touches.length === 2) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            dragStartRef.current = { x: midX, y: midY, offsetX: garmentXOffset, offsetY: garmentYOffset };
            // Calculate initial pinch distance
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
            pinchStartScaleRef.current = garmentScale;
            setIsDragging(true);
            setShowPinchFeedback(true);
          }
        }}
        onTouchMove={(e) => {
          // Two-finger drag for positioning + pinch for scale
          if (isDragging && e.touches.length === 2) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const posX = midX - dragStartRef.current.x;
            const posY = midY - dragStartRef.current.y;
            setGarmentXOffset(dragStartRef.current.offsetX + posX * 0.3);
            setGarmentYOffset(dragStartRef.current.offsetY + posY * 0.3);
            
            // Pinch-to-zoom
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (pinchStartDistRef.current > 0) {
              const ratio = dist / pinchStartDistRef.current;
              const newScale = Math.max(0.5, Math.min(2.0, pinchStartScaleRef.current * ratio));
              setGarmentScale(newScale);
              setShowPinchFeedback(true);
            }
          }
        }}
        onTouchEnd={(e) => {
          if (isDragging) {
            setIsDragging(false);
            setShowPinchFeedback(false);
            return;
          }
          if (!cameraOn) return;
          const touchEndX = e.changedTouches[0].clientX;
          const swipeDistance = touchEndX - touchStartXRef.current;
          const minSwipe = 50; // minimum swipe distance
          
          // Swipe detection (single finger only)
          if (Math.abs(swipeDistance) > minSwipe) {
            vibrate(15); // haptic feedback on swipe
            if (swipeDistance > 0) {
              // Swipe right - previous garment
              switchGarment((selectedGarment - 1 + GARMENTS.length) % GARMENTS.length);
            } else {
              // Swipe left - next garment
              switchGarment((selectedGarment + 1) % GARMENTS.length);
            }
            touchStartXRef.current = 0;
            return;
          }
          
          // Double/triple tap detection (if no swipe)
          const now = Date.now();
          if (now - lastTapTimeRef.current < 300) {
            tapCountRef.current++;
            if (tapCountRef.current >= 2) {
              // Triple tap detected - reset adjustments
              vibrate([10, 20, 10, 20, 10]); // haptic pattern for triple-tap
              saveAdjustmentsForUndo();
              setGarmentScale(1.0);
              setGarmentXOffset(0);
              setGarmentYOffset(0);
              setStatus("🔄 Position reset! Press Z to undo");
              tapCountRef.current = 0;
              lastTapTimeRef.current = 0;
            } else {
              // Double tap detected - cycle to next garment
              vibrate([10, 30, 10]); // haptic pattern for double-tap
              switchGarment((selectedGarment + 1) % GARMENTS.length);
            }
          } else {
            tapCountRef.current = 0;
            lastTapTimeRef.current = now;
          }
        }}
      >
        <video
          ref={videoRef}
          style={{ width: "100%", transform: isMirrored ? "scaleX(-1)" : "none", borderRadius: 12, background: "#000" }}
          playsInline
          muted
        />
        <canvas
          ref={threeCanvasRef}
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%", height: "100%",
            transform: `${isMirrored ? "scaleX(-1)" : "none"} ${garmentTransition ? "scale(1.02)" : "scale(1)"}`,
            transition: garmentTransition ? "transform 0.15s ease-out" : "transform 0.15s ease-in",
            pointerEvents: "auto",
            cursor: isDragging ? "grabbing" : "grab",
          }}
          onMouseDown={(e) => {
            if (!cameraOn) return;
            setIsDragging(true);
            dragStartRef.current = { 
              x: e.clientX, 
              y: e.clientY, 
              offsetX: garmentXOffset, 
              offsetY: garmentYOffset 
            };
          }}
          onMouseMove={(e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            setGarmentXOffset(dragStartRef.current.offsetX + dx * 0.5);
            setGarmentYOffset(dragStartRef.current.offsetY + dy * 0.5);
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        />

        {/* Position/Scale indicator during drag */}
        {isDragging && (
          <div style={{
            position: "absolute",
            top: 12, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "monospace",
            pointerEvents: "none",
          }}>
            X: {garmentXOffset.toFixed(0)} | Y: {garmentYOffset.toFixed(0)} | 🔍 {(garmentScale * 100).toFixed(0)}%
          </div>
        )}

        {/* Loading spinner during garment switch */}
        {isLoading && cameraOn && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "16px 24px",
            borderRadius: 12,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            pointerEvents: "none",
          }}>
            <span style={{ 
              display: "inline-block", 
              width: 20, height: 20, 
              border: "3px solid #fff", 
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            Loading garment...
          </div>
        )}

        {/* Fit quality indicator */}
        {cameraOn && trackingConfidence > 0 && (
          <div style={{
            position: "absolute",
            bottom: 12, right: 12,
            background: "rgba(0,0,0,0.6)",
            padding: "6px 10px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            pointerEvents: "none",
          }}>
            <span style={{
              width: 8, height: 8,
              borderRadius: "50%",
              background: trackingConfidence >= 70 ? "#22c55e" : trackingConfidence >= 40 ? "#eab308" : "#ef4444",
              boxShadow: `0 0 6px ${trackingConfidence >= 70 ? "#22c55e" : trackingConfidence >= 40 ? "#eab308" : "#ef4444"}`,
            }} />
            <span style={{ color: "#fff", fontSize: 11 }}>
              {trackingConfidence >= 70 ? "✨ Great fit" : trackingConfidence >= 40 ? "👍 Good" : "👀 Move closer"}
            </span>
          </div>
        )}

        {/* Pinch zoom feedback */}
        {cameraOn && showPinchFeedback && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.7)",
            padding: "16px 24px",
            borderRadius: 12,
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span>🔍</span>
            <span>{Math.round(garmentScale * 100)}%</span>
          </div>
        )}

        {/* Smooth mode indicator */}
        {cameraOn && smoothMode && (
          <div style={{
            position: "absolute",
            top: 50, left: 12,
            background: "rgba(34, 197, 94, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            ✨ Smooth
          </div>
        )}

        {/* Stats info overlay */}
        {cameraOn && showStats && (
          <div style={{
            position: "absolute",
            top: 50, right: 12,
            background: "rgba(0,0,0,0.8)",
            padding: "10px 14px",
            borderRadius: 10,
            color: "#fff",
            fontSize: 11,
            fontFamily: "monospace",
            pointerEvents: "none",
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: "#a78bfa" }}>📊 Adjustments</div>
            <div>Opacity: {Math.round(garmentOpacity * 100)}%</div>
            <div>Scale: {Math.round(garmentScale * 100)}%</div>
            <div>Y Offset: {garmentYOffset}px</div>
            <div>X Offset: {garmentXOffset}px</div>
            <div>Rotation: {garmentRotation === 0 ? "Auto" : `${Math.round(garmentRotation * 180 / Math.PI)}°`}</div>
            <div>Brightness: {Math.round(garmentBrightness * 100)}%</div>
            <div>Hue: {garmentHue}°</div>
            <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 10 }}>Press I to hide</div>
          </div>
        )}

        {/* Session duration timer */}
        {cameraOn && sessionStartTime && (
          <div style={{
            position: "absolute",
            bottom: 12, left: 12,
            background: "rgba(0,0,0,0.6)",
            padding: "6px 10px",
            borderRadius: 8,
            color: "#fff",
            fontSize: 11,
            fontFamily: "monospace",
            pointerEvents: "none",
          }}>
            ⏱️ {Math.floor((Date.now() - sessionStartTime) / 60000)}:{String(Math.floor(((Date.now() - sessionStartTime) % 60000) / 1000)).padStart(2, "0")}
            {debugMode && ` | 🎬 ${totalFramesRef.current.toLocaleString()}f`}
            {batteryLevel !== null && batteryLevel <= 20 && (
              <span style={{ color: batteryLevel <= 10 ? "#ef4444" : "#eab308" }}>
                {" | "}🔋 {batteryLevel}%
              </span>
            )}
          </div>
        )}

        {/* Current garment name badge */}
        {cameraOn && GARMENTS[selectedGarment] && (
          <div style={{
            position: "absolute",
            top: 12, left: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{
              background: showGarment ? "rgba(108, 92, 231, 0.8)" : "rgba(75, 85, 99, 0.8)",
              padding: "6px 12px",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <span>{showGarment ? GARMENTS[selectedGarment].emoji : "👁️‍🗨️"}</span>
              <span>{showGarment ? GARMENTS[selectedGarment].name : "Garment Hidden"}</span>
            </div>
            <button
              onClick={() => {
                toggleFavorite(selectedGarment);
                vibrate(20);
              }}
              style={{
                background: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 16,
              }}
              title={favoriteGarments.includes(selectedGarment) ? "Remove from favorites" : "Add to favorites"}
            >
              {favoriteGarments.includes(selectedGarment) ? "❤️" : "🤍"}
            </button>
            <div style={{
              background: "rgba(0,0,0,0.5)",
              padding: "4px 8px",
              borderRadius: 6,
              color: "#9ca3af",
              fontSize: 11,
              fontWeight: 500,
            }}>
              {selectedGarment + 1}/{GARMENTS.length}
            </div>
          </div>
        )}

        {/* Grid overlay for positioning */}
        {cameraOn && showGrid && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: "none",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
          }}>
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{
                border: "1px solid rgba(255,255,255,0.2)",
              }} />
            ))}
            {/* Center crosshair */}
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: 40, height: 40,
              transform: "translate(-50%, -50%)",
              border: "2px solid rgba(108, 92, 231, 0.8)",
              borderRadius: "50%",
            }}>
              <div style={{
                position: "absolute",
                top: "50%", left: 0, right: 0,
                height: 1,
                background: "rgba(108, 92, 231, 0.8)",
              }} />
              <div style={{
                position: "absolute",
                left: "50%", top: 0, bottom: 0,
                width: 1,
                background: "rgba(108, 92, 231, 0.8)",
              }} />
            </div>
          </div>
        )}

        {/* Compare mode split indicator */}
        {cameraOn && compareMode && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: "none",
            display: "flex",
          }}>
            <div style={{
              flex: 1,
              borderRight: "2px dashed rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 50,
            }}>
              <span style={{
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}>
                BEFORE
              </span>
            </div>
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 50,
            }}>
              <span style={{
                background: "rgba(108, 92, 231, 0.9)",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}>
                AFTER
              </span>
            </div>
          </div>
        )}

        {/* Screenshot countdown overlay */}
        {screenshotCountdown !== null && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            zIndex: 50,
          }}>
            <div style={{
              fontSize: 120,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              animation: "pulse 0.5s ease-in-out",
            }}>
              {screenshotCountdown}
            </div>
          </div>
        )}

        {/* Pause overlay */}
        {cameraOn && isPaused && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
          }}>
            <span style={{ fontSize: 48, marginBottom: 12 }}>⏸️</span>
            <span style={{ color: "#fff", fontSize: 16 }}>Paused — No pose detected</span>
            <span style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>Move into frame to resume</span>
          </div>
        )}

        {/* Debug overlay canvas */}
        {debugMode && (
          <canvas
            ref={debugCanvasRef}
            width={640}
            height={480}
            style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Start button overlay */}
        {!cameraOn && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", borderRadius: 12,
          }}>
            <button
              onClick={startCamera}
              disabled={isLoading}
              style={{
                padding: "16px 40px", fontSize: 20, fontWeight: 700,
                background: isLoading ? "#4a4a6a" : "#6C5CE7", color: "#fff", border: "none",
                borderRadius: 12, cursor: isLoading ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ 
                    display: "inline-block", 
                    width: 20, height: 20, 
                    border: "3px solid #fff", 
                    borderTopColor: "transparent", 
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }} />
                  Loading...
                </>
              ) : (
                "🎥 Start Camera"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      <p style={{ color: "#aaa", fontSize: 16, marginTop: 12, fontFamily: "monospace" }}>
        {status} {cameraOn && fps > 0 && (
          <>
            <span style={{ color: fps >= 24 ? "#22c55e" : fps >= 15 ? "#eab308" : "#ef4444" }}>({fps} FPS)</span>
            {" "}
            <span style={{ color: trackingConfidence >= 70 ? "#22c55e" : trackingConfidence >= 40 ? "#eab308" : "#ef4444" }}>
              [{trackingConfidence}% conf]
            </span>
            {" "}
            <span style={{ color: "#60a5fa" }}>
              [{selectedGarment + 1}/{GARMENTS.length + savedGarments.length}]
            </span>
            {estimatedSize && (
              <>
                {" "}
                <span style={{ color: "#a78bfa" }}>[Size: {estimatedSize}]</span>
              </>
            )}
          </>
        )}
      </p>

      {/* Low Light Warning */}
      {cameraOn && lowLightWarning && (
        <div style={{
          marginTop: 8,
          padding: "10px 16px",
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: 8,
          color: "#92400e",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          💡 <strong>Low light detected.</strong> Move to a brighter area for better tracking.
        </div>
      )}

      {/* Low FPS Performance Warning */}
      {cameraOn && lowFpsWarning && (
        <div style={{
          marginTop: 8,
          padding: "10px 16px",
          background: "#fee2e2",
          border: "1px solid #ef4444",
          borderRadius: 8,
          color: "#991b1b",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          ⚠️ <strong>Performance issue.</strong> Close other apps or tabs for smoother tracking.
        </div>
      )}

      {/* Controls */}
      {cameraOn && showControls && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {/* Upload button */}
          <label style={{
            padding: "12px 24px", fontSize: 16, fontWeight: 700,
            background: uploading ? "#555" : "#6C5CE7", color: "#fff",
            borderRadius: 10, cursor: uploading ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 8,
            position: "relative", overflow: "hidden",
          }}>
            {uploading && (
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${uploadProgress}%`,
                background: "rgba(110,86,207,0.5)",
                transition: "width 0.3s ease",
              }} />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>
              {uploading ? `⏳ ${uploadProgress}% Processing...` : "📸 Upload Clothing Photo"}
            </span>
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

          {/* Share button */}
          <button
            onClick={shareResult}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#059669", color: "#fff", border: "1px solid #10b981",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            🚀 Share
          </button>

          {/* Record button */}
          <button
            onClick={toggleRecording}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: isRecording ? "#dc2626" : "#ec4899", 
              color: "#fff", 
              border: isRecording ? "1px solid #ef4444" : "1px solid #f472b6",
              borderRadius: 10, cursor: "pointer",
              animation: isRecording ? "pulse 1s infinite" : "none",
            }}
          >
            {isRecording ? `⏹ Stop (${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')})` : "🎬 Record"}
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

          {/* Stop Camera button */}
          <button
            onClick={stopCamera}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#dc2626", color: "#fff", border: "1px solid #ef4444",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            ⏹ Stop
          </button>

          {/* Flip Camera button */}
          <button
            onClick={flipCamera}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: "#0891b2", color: "#fff", border: "1px solid #06b6d4",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            🔄 {facingMode === "user" ? "Back Cam" : "Front Cam"}
          </button>

          {/* Torch button */}
          <button
            onClick={toggleTorch}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: torchOn ? "#f59e0b" : "#374151", color: "#fff", 
              border: torchOn ? "1px solid #fbbf24" : "1px solid #4b5563",
              borderRadius: 10, cursor: "pointer",
            }}
            title="Toggle flashlight (mobile only)"
          >
            🔦 {torchOn ? "Torch ON" : "Torch"}
          </button>

          {/* Mirror toggle */}
          <button
            onClick={() => setIsMirrored(prev => !prev)}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: isMirrored ? "#7c3aed" : "#374151", color: "#fff", border: "1px solid #8b5cf6",
              borderRadius: 10, cursor: "pointer",
            }}
          >
            🪞 {isMirrored ? "Mirror ON" : "Mirror OFF"}
          </button>

          {/* Comparison toggle */}
          <button
            onClick={() => setShowGarment(prev => !prev)}
            style={{
              padding: "12px 24px", fontSize: 16, fontWeight: 600,
              background: showGarment ? "#059669" : "#374151", color: "#fff", border: "1px solid #10b981",
              borderRadius: 10, cursor: "pointer",
            }}
            title="Press G to toggle"
          >
            {showGarment ? "👗 Garment ON" : "👤 Before View"}
          </button>
        </div>
      )}

      {/* Garment Gallery */}
      {cameraOn && showControls && (
        <div style={{ marginTop: 16, width: "100%", maxWidth: 640 }}>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 8, textAlign: "center" }}>
            Try these garments ({GARMENTS.length + savedGarments.length} total): {favoriteGarments.length > 0 && <span style={{ color: "#f59e0b" }}>(⭐ favorites first)</span>}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[...GARMENTS.map((g, i) => ({ ...g, originalIndex: i }))]
              .sort((a, b) => {
                const aFav = favoriteGarments.includes(a.originalIndex);
                const bFav = favoriteGarments.includes(b.originalIndex);
                if (aFav && !bFav) return -1;
                if (!aFav && bFav) return 1;
                return 0;
              })
              .map(({ originalIndex: idx, ...garment }) => (
              <div key={garment.path} style={{ position: "relative" }}>
                <button
                  onClick={() => switchGarment(idx)}
                  style={{
                    padding: "8px 12px",
                    paddingRight: 36,
                    paddingLeft: 8,
                    fontSize: 13,
                    fontWeight: selectedGarment === idx ? 700 : 500,
                    background: selectedGarment === idx ? "#6C5CE7" : "#222",
                    color: "#fff",
                    border: selectedGarment === idx ? "2px solid #8B7CF0" : "1px solid #444",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={garment.path} 
                    alt={garment.name}
                    style={{ 
                      width: 28, 
                      height: 28, 
                      objectFit: "contain",
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.1)"
                    }} 
                  />
                  {garment.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(idx); }}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: 4,
                  }}
                  title={favoriteGarments.includes(idx) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favoriteGarments.includes(idx) ? "⭐" : "☆"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Garments */}
      {cameraOn && savedGarments.length > 0 && (
        <div style={{ marginTop: 16, width: "100%", maxWidth: 640 }}>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 8, textAlign: "center" }}>
            Your saved garments ({savedGarments.length}/10)
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {savedGarments.map((garment, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {renamingIndex === idx ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); renameSavedGarment(idx, renameValue); }}
                    style={{ display: "flex", gap: 4 }}
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      style={{
                        padding: "8px 12px", fontSize: 14,
                        background: "#1a3a2a", color: "#4ade80",
                        border: "1px solid #22c55e", borderRadius: 6,
                        width: 120,
                      }}
                      placeholder="New name"
                    />
                    <button type="submit" style={{ padding: "8px", background: "#22c55e", border: "none", borderRadius: 6, cursor: "pointer" }}>✓</button>
                    <button type="button" onClick={() => { setRenamingIndex(null); setRenameValue(""); }} style={{ padding: "8px", background: "#666", border: "none", borderRadius: 6, cursor: "pointer" }}>✕</button>
                  </form>
                ) : (
                  <>
                    <button
                      onClick={() => loadSavedGarment(idx)}
                      onDoubleClick={() => { setRenamingIndex(idx); setRenameValue(garment.name); }}
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
                      title="Double-click to rename"
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
                  </>
                )}
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

      {/* Garment Opacity Slider */}
      {cameraOn && (
        <div style={{ marginTop: 16, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>👕 Garment Opacity</span>
            <span>{Math.round(garmentOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={garmentOpacity}
            onChange={(e) => setGarmentOpacity(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#6C5CE7" }}
          />
        </div>
      )}

      {/* Garment Scale Slider */}
      {cameraOn && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>📏 Garment Size</span>
            <span>{Math.round(garmentScale * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.7"
            max="1.3"
            step="0.05"
            value={garmentScale}
            onChange={(e) => setGarmentScale(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#10b981" }}
          />
        </div>
      )}

      {/* Garment Y Offset Slider */}
      {cameraOn && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>↕️ Position</span>
            <span>{garmentYOffset > 0 ? `+${garmentYOffset}` : garmentYOffset}</span>
          </label>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={garmentYOffset}
            onChange={(e) => setGarmentYOffset(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: "#f59e0b" }}
          />
        </div>
      )}

      {/* Garment Brightness Slider */}
      {cameraOn && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>☀️ Brightness</span>
            <span>{Math.round(garmentBrightness * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={garmentBrightness}
            onChange={(e) => setGarmentBrightness(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#eab308" }}
          />
        </div>
      )}

      {/* Garment Hue Slider */}
      {cameraOn && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>🎨 Color Tint</span>
            <span>{garmentHue === 0 ? "Off" : `${garmentHue}°`}</span>
          </label>
          <input
            type="range"
            min="0"
            max="360"
            step="15"
            value={garmentHue}
            onChange={(e) => setGarmentHue(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: `hsl(${garmentHue}, 70%, 50%)` }}
          />
        </div>
      )}

      {/* Garment Rotation Slider */}
      {cameraOn && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>🔄 Rotation</span>
            <span>{garmentRotation === 0 ? "Auto" : `${Math.round(garmentRotation * 180 / Math.PI)}°`}</span>
          </label>
          <input
            type="range"
            min="-0.5"
            max="0.5"
            step="0.05"
            value={garmentRotation}
            onChange={(e) => setGarmentRotation(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#8b5cf6" }}
          />
        </div>
      )}

      {/* Camera Zoom Slider (if supported) */}
      {cameraOn && maxZoom > 1 && (
        <div style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
          <label style={{ color: "#888", fontSize: 14, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>🔍 Camera Zoom</span>
            <span>{cameraZoom.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="1"
            max={maxZoom}
            step="0.1"
            value={cameraZoom}
            onChange={(e) => applyCameraZoom(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#06b6d4" }}
          />
        </div>
      )}

      {/* Touch-friendly size buttons */}
      {cameraOn && isMobileDevice && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
          <button
            onClick={() => {
              setGarmentScale(prev => Math.max(0.5, prev - 0.1));
              vibrate(15);
            }}
            style={{
              width: 48, height: 48, fontSize: 24, fontWeight: 700,
              background: "#1e293b", color: "#fff", border: "1px solid #334155",
              borderRadius: 12, cursor: "pointer",
            }}
          >
            −
          </button>
          <span style={{ color: "#9ca3af", fontSize: 14, minWidth: 80, textAlign: "center" }}>
            👕 {Math.round(garmentScale * 100)}%
          </span>
          <button
            onClick={() => {
              setGarmentScale(prev => Math.min(1.5, prev + 0.1));
              vibrate(15);
            }}
            style={{
              width: 48, height: 48, fontSize: 24, fontWeight: 700,
              background: "#1e293b", color: "#fff", border: "1px solid #334155",
              borderRadius: 12, cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      )}

      {/* Quick Presets */}
      {cameraOn && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => { setGarmentScale(0.9); setGarmentYOffset(-5); }}
            style={{
              padding: "8px 12px", fontSize: 12, background: "#1e293b", color: "#94a3b8",
              border: "1px solid #334155", borderRadius: 6, cursor: "pointer",
            }}
            title="Smaller, higher fit"
          >
            👕 Fitted
          </button>
          <button
            onClick={() => { setGarmentScale(1.1); setGarmentYOffset(5); }}
            style={{
              padding: "8px 12px", fontSize: 12, background: "#1e293b", color: "#94a3b8",
              border: "1px solid #334155", borderRadius: 6, cursor: "pointer",
            }}
            title="Larger, lower fit"
          >
            🧥 Oversized
          </button>
          <button
            onClick={() => { setGarmentOpacity(0.7); setGarmentBrightness(0.9); }}
            style={{
              padding: "8px 12px", fontSize: 12, background: "#1e293b", color: "#94a3b8",
              border: "1px solid #334155", borderRadius: 6, cursor: "pointer",
            }}
            title="Semi-transparent preview"
          >
            👻 Ghost
          </button>
          <button
            onClick={() => { setGarmentOpacity(1.0); setGarmentBrightness(1.2); }}
            style={{
              padding: "8px 12px", fontSize: 12, background: "#1e293b", color: "#94a3b8",
              border: "1px solid #334155", borderRadius: 6, cursor: "pointer",
            }}
            title="Full opacity, bright"
          >
            ✨ Vivid
          </button>
        </div>
      )}

      {/* Reset Settings Button */}
      {cameraOn && (garmentOpacity !== 0.9 || garmentScale !== 1.0 || garmentYOffset !== 0 || garmentXOffset !== 0 || garmentBrightness !== 1.0 || garmentHue !== 0 || garmentRotation !== 0) && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => {
              setGarmentOpacity(0.9);
              setGarmentScale(1.0);
              setGarmentYOffset(0);
              setGarmentXOffset(0);
              setGarmentBrightness(1.0);
              setGarmentHue(0);
              setGarmentRotation(0);
            }}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "transparent",
              color: "#888",
              border: "1px solid #444",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ↩ Reset to Defaults
          </button>
          <button
            onClick={() => {
              const preset = {
                opacity: garmentOpacity,
                scale: garmentScale,
                yOffset: garmentYOffset,
                xOffset: garmentXOffset,
                brightness: garmentBrightness,
                hue: garmentHue,
                rotation: garmentRotation,
              };
              const data = JSON.stringify(preset, null, 2);
              navigator.clipboard.writeText(data).then(() => {
                setStatus("📋 Preset copied to clipboard!");
              }).catch(() => {
                setStatus("❌ Failed to copy preset");
              });
            }}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "transparent",
              color: "#60a5fa",
              border: "1px solid #3b82f6",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            📤 Export Preset
          </button>
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

      {/* Version footer */}
      <div style={{ marginTop: 32, color: "#444", fontSize: 11, textAlign: "center" }}>
        <p>VirtualFit v2.0.0 • 77 features • Built with Next.js + Three.js + MediaPipe</p>
        <p style={{ marginTop: 4 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setShowHelp(true); }} style={{ color: "#6C5CE7", textDecoration: "none" }}>
            ❓ Help
          </a>
          {" • "}
          <a href="#" onClick={(e) => { e.preventDefault(); setShowOnboarding(true); }} style={{ color: "#6C5CE7", textDecoration: "none" }}>
            📖 Tutorial
          </a>
          {" • "}
          <a href="#" onClick={(e) => { e.preventDefault(); setShowClearConfirm(true); }} style={{ color: "#ef4444", textDecoration: "none" }}>
            🗑️ Clear Data
          </a>
        </p>
      </div>

      {/* Share Menu Modal */}
      {showShareMenu && shareImageBlob && (
        <div
          onClick={() => setShowShareMenu(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#1a1a2e", borderRadius: 16, padding: 24,
            maxWidth: 320, width: "100%", textAlign: "center",
          }}>
            <h3 style={{ color: "#fff", marginBottom: 16 }}>🚀 Share Your Look</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(shareImageBlob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `virtualfit-${Date.now()}.png`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setShowShareMenu(false);
                  setStatus("📸 Downloaded!");
                }}
                style={{ padding: "12px 16px", fontSize: 15, background: "#6C5CE7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                📥 Download Image
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.write([
                      new ClipboardItem({ "image/png": shareImageBlob })
                    ]);
                    setStatus("📋 Copied to clipboard!");
                  } catch {
                    setStatus("❌ Clipboard not supported");
                  }
                  setShowShareMenu(false);
                }}
                style={{ padding: "12px 16px", fontSize: 15, background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                📋 Copy to Clipboard
              </button>
            </div>
            <button
              onClick={() => setShowShareMenu(false)}
              style={{ marginTop: 16, padding: "8px 16px", fontSize: 13, background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 6, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearConfirm && (
        <div
          onClick={() => setShowClearConfirm(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1f2937", borderRadius: 16, padding: 24,
              maxWidth: 400, textAlign: "center", color: "#fff",
            }}
          >
            <h2 style={{ fontSize: 24, marginBottom: 16 }}>🗑️ Clear All Data?</h2>
            <p style={{ color: "#9ca3af", marginBottom: 24 }}>
              This will delete all saved garments, favorites, and settings. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: "12px 24px", fontSize: 16, fontWeight: 600,
                  background: "#374151", color: "#fff", border: "none",
                  borderRadius: 10, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearAllData}
                style={{
                  padding: "12px 24px", fontSize: 16, fontWeight: 600,
                  background: "#dc2626", color: "#fff", border: "none",
                  borderRadius: 10, cursor: "pointer",
                }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
