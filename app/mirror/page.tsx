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
  const [adjustmentsLocked, setAdjustmentsLocked] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [autoFit, setAutoFit] = useState(true);
  const [garmentFlipped, setGarmentFlipped] = useState(false);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [perGarmentAdjustments, setPerGarmentAdjustments] = useState<Record<number, {
    scale: number; scaleY: number; xOffset: number; yOffset: number;
    rotation: number; brightness: number; hue: number; flipped: boolean;
  }>>({});
  const tapCountRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [blendMode, setBlendMode] = useState<'normal' | 'multiply' | 'screen' | 'overlay'>('normal');
  const [showShadow, setShowShadow] = useState(true);
  const [shadowAngle, setShadowAngle] = useState(135); // degrees, 135 = bottom-right
  const [savedPresets, setSavedPresets] = useState<{name: string, settings: Record<string, number | boolean>}[]>([]);
  const [edgeFeather, setEdgeFeather] = useState(0); // 0-10px blur for soft edges
  const opacityPresets = [0.25, 0.5, 0.75, 0.9, 1.0]; // Quick opacity levels
  const scalePresets = [0.7, 0.85, 1.0, 1.15, 1.3]; // Quick size levels
  const [tintMode, setTintMode] = useState<'none' | 'warm' | 'cool' | 'sepia' | 'night'>('none');
  const [distanceHint, setDistanceHint] = useState<'too-close' | 'optimal' | 'too-far' | null>(null);
  const [showFitGuide, setShowFitGuide] = useState(false);
  const [garmentFadeIn, setGarmentFadeIn] = useState(true);
  const [slideshowMode, setSlideshowMode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [recentGarments, setRecentGarments] = useState<number[]>([]);
  const [showRecentPanel, setShowRecentPanel] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonGarment, setComparisonGarment] = useState<number | null>(null);
  const [autoPauseOnBlur, setAutoPauseOnBlur] = useState(true);
  const [sessionStats, setSessionStats] = useState({ tryOns: 0, screenshots: 0, adjustments: 0 });
  const wasPlayingBeforeBlur = useRef(false);
  const slideshowIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [flashCompare, setFlashCompare] = useState(false);
  const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [garmentSaturation, setGarmentSaturation] = useState(100);
  const [garmentContrast, setGarmentContrast] = useState(100);
  const [colorGradeIdx, setColorGradeIdx] = useState(0);
  const [showEdgeHints, setShowEdgeHints] = useState(false);
  const [hasSeenEdgeHints, setHasSeenEdgeHints] = useState(false);
  const [fitQuality, setFitQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const prevFitQualityRef = useRef<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [postureTip, setPostureTip] = useState<string | null>(null);
  const [photoCountdown, setPhotoCountdown] = useState<number | null>(null);
  const [splitViewGarment, setSplitViewGarment] = useState<number | null>(null);
  const adjustmentHistoryRef = useRef<Array<{scale: number, scaleY: number, x: number, y: number, rotation: number, brightness: number, hue: number, opacity: number}>>([]);
  const [colorTemp, setColorTemp] = useState(0); // -100 (cool) to +100 (warm)
  const lastShakeTimeRef = useRef(0);
  const shakeThreshold = 15; // acceleration threshold for shake detection
  const sessionStartRef = useRef<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [screenshotHistory, setScreenshotHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSilhouette, setShowSilhouette] = useState(false);
  const [autoLighting, setAutoLighting] = useState(false);
  const [showGarmentGrid, setShowGarmentGrid] = useState(false);
  const ambientBrightnessRef = useRef(100);
  const [maxZoom, setMaxZoom] = useState(1);
  const [shareImageBlob, setShareImageBlob] = useState<Blob | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [garmentScale, setGarmentScale] = useState(1.0);
  const [garmentScaleY, setGarmentScaleY] = useState(1.0);
  const [isMirrored, setIsMirrored] = useState(true);
  const [garmentYOffset, setGarmentYOffset] = useState(0);
  const [garmentXOffset, setGarmentXOffset] = useState(0);
  const [garmentRotation, setGarmentRotation] = useState(0); // manual rotation offset in radians
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1.0);
  const pinchStartAngleRef = useRef(0);
  const pinchStartRotationRef = useRef(0);
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
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true); // Show on first launch
  const [favoriteGarments, setFavoriteGarments] = useState<number[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const lastTapTimeRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const lowConfidenceCountRef = useRef(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPage, setHelpPage] = useState(1);
  const [garmentLoading, setGarmentLoading] = useState(false);
  const [showGarmentInfo, setShowGarmentInfo] = useState(false);
  const [viewportAspect, setViewportAspect] = useState<'auto' | '9:16' | '4:5' | '1:1'>('auto');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showFps, setShowFps] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });
  const [batterySaver, setBatterySaver] = useState(false);
  const frameSkipRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const [showGarmentPreview, setShowGarmentPreview] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [garmentSearch, setGarmentSearch] = useState('');
  const [showGestureTip, setShowGestureTip] = useState(false);
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
        if (adj.hue !== undefined) setGarmentHue(adj.hue);
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
      
      // Load config from URL params (for shareable links)
      const params = new URLSearchParams(window.location.search);
      let loadedFromUrl = false;
      if (params.has('g')) {
        const g = parseInt(params.get('g') || '0', 10);
        if (!isNaN(g) && g >= 0) {
          setSelectedGarment(g);
          loadedFromUrl = true;
        }
      }
      if (params.has('s')) { setGarmentScale(parseFloat(params.get('s') || '1')); loadedFromUrl = true; }
      if (params.has('sy')) { setGarmentScaleY(parseFloat(params.get('sy') || '1')); loadedFromUrl = true; }
      if (params.has('x')) { setGarmentXOffset(parseInt(params.get('x') || '0', 10)); loadedFromUrl = true; }
      if (params.has('y')) { setGarmentYOffset(parseInt(params.get('y') || '0', 10)); loadedFromUrl = true; }
      if (params.has('r')) { setGarmentRotation(parseFloat(params.get('r') || '0')); loadedFromUrl = true; }
      if (params.has('b')) { setGarmentBrightness(parseInt(params.get('b') || '100', 10)); loadedFromUrl = true; }
      if (params.has('h')) { setGarmentHue(parseInt(params.get('h') || '0', 10)); loadedFromUrl = true; }
      if (params.has('f')) { setGarmentFlipped(params.get('f') === '1'); loadedFromUrl = true; }
      
      if (loadedFromUrl) {
        // Show toast and clear URL params
        setTimeout(() => setStatus("📥 Loaded shared config!"), 500);
        window.history.replaceState({}, '', '/mirror');
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
        hue: garmentHue,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [garmentOpacity, garmentScale, garmentYOffset, garmentXOffset, garmentBrightness, garmentRotation, garmentHue]);

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

  // Save current adjustments as a preset
  const savePreset = useCallback((name: string) => {
    const preset = {
      name,
      settings: {
        opacity: garmentOpacity,
        scale: garmentScale,
        scaleY: garmentScaleY,
        yOffset: garmentYOffset,
        xOffset: garmentXOffset,
        brightness: garmentBrightness,
        hue: garmentHue,
        rotation: garmentRotation,
        saturation: garmentSaturation,
        contrast: garmentContrast,
        shadowAngle,
        showShadow,
      }
    };
    setSavedPresets(prev => {
      const updated = [...prev.filter(p => p.name !== name), preset].slice(-5); // Keep last 5
      try { localStorage.setItem("virtualfit-presets", JSON.stringify(updated)); } catch {}
      return updated;
    });
    setStatus(`💾 Preset "${name}" saved!`);
  }, [garmentOpacity, garmentScale, garmentScaleY, garmentYOffset, garmentXOffset, garmentBrightness, garmentHue, garmentRotation, garmentSaturation, garmentContrast, shadowAngle, showShadow]);

  // Load a preset
  const loadPreset = useCallback((preset: typeof savedPresets[0]) => {
    const s = preset.settings;
    if (s.opacity !== undefined) setGarmentOpacity(s.opacity as number);
    if (s.scale !== undefined) setGarmentScale(s.scale as number);
    if (s.scaleY !== undefined) setGarmentScaleY(s.scaleY as number);
    if (s.yOffset !== undefined) setGarmentYOffset(s.yOffset as number);
    if (s.xOffset !== undefined) setGarmentXOffset(s.xOffset as number);
    if (s.brightness !== undefined) setGarmentBrightness(s.brightness as number);
    if (s.hue !== undefined) setGarmentHue(s.hue as number);
    if (s.rotation !== undefined) setGarmentRotation(s.rotation as number);
    if (s.saturation !== undefined) setGarmentSaturation(s.saturation as number);
    if (s.contrast !== undefined) setGarmentContrast(s.contrast as number);
    if (s.shadowAngle !== undefined) setShadowAngle(s.shadowAngle as number);
    if (s.showShadow !== undefined) setShowShadow(s.showShadow as boolean);
    setStatus(`📥 Loaded "${preset.name}"`);
  }, []);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("virtualfit-presets");
      if (stored) setSavedPresets(JSON.parse(stored));
    } catch {}
  }, []);

  // Load per-garment adjustments from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("virtualfit-per-garment");
      if (stored) setPerGarmentAdjustments(JSON.parse(stored));
    } catch {}
  }, []);

  // Check if user has seen onboarding
  useEffect(() => {
    try {
      const seen = localStorage.getItem("virtualfit-onboarding-seen");
      if (seen) setShowOnboarding(false);
    } catch {}
  }, []);
  // Auto-pause camera when tab loses focus (battery saving)
  useEffect(() => {
    if (!autoPauseOnBlur) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - pause if playing
        if (cameraOn && !isPaused) {
          wasPlayingBeforeBlur.current = true;
          setIsPaused(true);
        }
      } else {
        // Tab visible - resume if was playing
        if (wasPlayingBeforeBlur.current && cameraOn) {
          setIsPaused(false);
          wasPlayingBeforeBlur.current = false;
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoPauseOnBlur, cameraOn, isPaused]);
  // Haptic feedback helper (mobile)
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);
  
  // Sound effect helper
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playSound = useCallback((type: 'click' | 'success' | 'error' = 'click') => {
    if (!soundEnabled) return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;
    if (type === 'success') {
      osc.frequency.value = 880;
    } else if (type === 'error') {
      osc.frequency.value = 220;
    } else {
      osc.frequency.value = 440;
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }, [soundEnabled]);

  // Save current adjustments to history (for undo)
  const saveAdjustmentState = useCallback(() => {
    const state = {
      scale: garmentScale,
      scaleY: garmentScaleY,
      x: garmentXOffset,
      y: garmentYOffset,
      rotation: garmentRotation,
      brightness: garmentBrightness,
      hue: garmentHue,
      opacity: garmentOpacity,
    };
    adjustmentHistoryRef.current.push(state);
    // Keep only last 20 states
    if (adjustmentHistoryRef.current.length > 20) {
      adjustmentHistoryRef.current.shift();
    }
  }, [garmentScale, garmentScaleY, garmentXOffset, garmentYOffset, garmentRotation, garmentBrightness, garmentHue, garmentOpacity]);

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
    { name: "Yellow Shirt", path: "/garments/yellow-shirt-nobg.png", emoji: "👕", category: "Shirt" },
    { name: "Blue T-Shirt", path: "/garments/tshirt-blue.png", emoji: "👔", category: "T-Shirt" },
    { name: "Green Polo", path: "/garments/polo-green.png", emoji: "🎽", category: "Polo" },
    { name: "Red Hoodie", path: "/garments/hoodie-red.png", emoji: "🧥", category: "Hoodie" },
    { name: "Black Jacket", path: "/garments/jacket-black.png", emoji: "🧥", category: "Jacket" },
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
    // Note: PlaneGeometry is 1x1.3 units, so scale directly maps to pixels
    mesh.position.set(sp.x + garmentXOffset * sp.w * 0.01, sp.y + sp.h * 0.5 + garmentYOffset * sp.h * 0.01, 0);
    const baseScaleX = sp.w * 1.2 * garmentScale * (garmentFlipped ? -1 : 1);
    const effectiveScaleY = aspectLocked ? garmentScale : garmentScaleY;
    const baseScaleY = sp.h * 0.9 * effectiveScaleY;
    // Apply depth scaling (subtle: closer = slightly larger)
    mesh.scale.set(baseScaleX * sp.depth, baseScaleY * sp.depth, Math.abs(baseScaleX) * 0.3);
    
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
    
    // Distance hint based on shoulder width in frame
    if ((ls?.visibility ?? 0) > 0.7 && (rs?.visibility ?? 0) > 0.7) {
      const shoulderWidthPx = Math.abs(ls.x - rs.x) * vw;
      if (shoulderWidthPx > vw * 0.6) {
        setDistanceHint('too-close');
      } else if (shoulderWidthPx < vw * 0.2) {
        setDistanceHint('too-far');
      } else {
        setDistanceHint('optimal');
      }
    } else {
      setDistanceHint(null);
    }
    
    // Auto-lighting: sample video brightness and adjust garment
    if (autoLighting && videoRef.current && totalFramesRef.current % 30 === 0) {
      try {
        const video = videoRef.current;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 64; tempCanvas.height = 48; // Small sample
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
          tctx.drawImage(video, 0, 0, 64, 48);
          const data = tctx.getImageData(0, 0, 64, 48).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
            sum += (data[i] + data[i+1] + data[i+2]) / 3;
          }
          const avgBrightness = sum / (data.length / 16);
          // Map 0-255 brightness to 70-130% garment brightness
          ambientBrightnessRef.current = 70 + (avgBrightness / 255) * 60;
        }
      } catch {
        // Ignore errors
      }
    }
    
    // Calculate fit quality based on multiple factors
    const shoulderVisible = (ls?.visibility ?? 0) > 0.7 && (rs?.visibility ?? 0) > 0.7;
    const hipVisible = (lh?.visibility ?? 0) > 0.5 && (rh?.visibility ?? 0) > 0.5;
    const bodyStable = Math.abs(sp.tilt) < 0.15; // radians, ~8.5 degrees
    
    let newFitQuality: 'excellent' | 'good' | 'fair' | 'poor';
    let tip: string | null = null;
    
    if (confidencePercent > 80 && shoulderVisible && hipVisible && bodyStable) {
      newFitQuality = 'excellent';
    } else if (confidencePercent > 60 && shoulderVisible) {
      newFitQuality = 'good';
    } else if (confidencePercent > 40) {
      newFitQuality = 'fair';
      // Provide specific guidance
      if (!shoulderVisible) tip = "💪 Show both shoulders";
      else if (!bodyStable) tip = "🧘 Stand straighter";
    } else {
      newFitQuality = 'poor';
      // More urgent guidance
      if (confidencePercent < 20) tip = "📷 Step into frame";
      else if (!shoulderVisible) tip = "💪 Face the camera";
      else tip = "💡 Better lighting needed";
    }
    setPostureTip(tip);
    
    // Haptic feedback on quality change
    if (newFitQuality !== prevFitQualityRef.current) {
      if (newFitQuality === 'excellent') {
        vibrate([15, 30, 15]); // celebratory pattern
      } else if (newFitQuality === 'poor' && prevFitQualityRef.current !== 'poor') {
        vibrate(50); // warning buzz
      }
      prevFitQualityRef.current = newFitQuality;
    }
    setFitQuality(newFitQuality);
    
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
    
    // Draw body silhouette outline if enabled
    if (showSilhouette && debugCanvasRef.current) {
      const ctx = debugCanvasRef.current.getContext("2d");
      if (ctx) {
        if (!debugMode) ctx.clearRect(0, 0, vw, vh);
        
        // Draw torso outline
        ctx.strokeStyle = "rgba(147, 51, 234, 0.7)";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        // Shoulders
        const lsx = (1 - ls.x) * vw, lsy = ls.y * vh;
        const rsx = (1 - rs.x) * vw, rsy = rs.y * vh;
        // Hips
        const lhx = (1 - lh.x) * vw, lhy = lh.y * vh;
        const rhx = (1 - rh.x) * vw, rhy = rh.y * vh;
        
        // Draw torso polygon
        ctx.moveTo(lsx, lsy);
        ctx.lineTo(rsx, rsy);
        ctx.lineTo(rhx, rhy);
        ctx.lineTo(lhx, lhy);
        ctx.closePath();
        ctx.stroke();
        
        // Draw centerline
        ctx.strokeStyle = "rgba(234, 179, 8, 0.5)";
        ctx.setLineDash([3, 3]);
        const centerTopX = (lsx + rsx) / 2;
        const centerTopY = (lsy + rsy) / 2;
        const centerBottomX = (lhx + rhx) / 2;
        const centerBottomY = (lhy + rhy) / 2;
        ctx.beginPath();
        ctx.moveTo(centerTopX, centerTopY);
        ctx.lineTo(centerBottomX, centerBottomY);
        ctx.stroke();
        
        ctx.setLineDash([]);
      }
    }
  }, [debugMode, garmentScale, garmentYOffset, showSilhouette]);

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
        
        // Battery saver: skip every other frame
        if (batterySaver) {
          frameSkipRef.current++;
          if (frameSkipRef.current % 2 !== 0) {
            animFrameRef.current = requestAnimationFrame(loop);
            return;
          }
        }

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
        
        // FPS counter
        fpsCounterRef.current.frames++;
        const fpsNow = Date.now();
        if (fpsNow - fpsCounterRef.current.lastTime >= 1000) {
          setCurrentFps(fpsCounterRef.current.frames);
          fpsCounterRef.current.frames = 0;
          fpsCounterRef.current.lastTime = fpsNow;
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
    
    // Trigger visual transition with fade
    setGarmentFadeIn(false);
    setGarmentTransition(true);
    setTimeout(() => {
      setGarmentTransition(false);
      setGarmentFadeIn(true);
    }, 300);
    
    // Track previous garment for quick switch
    previousGarmentRef.current = selectedGarment;
    setSelectedGarment(index);
    
    // Track session stats
    setSessionStats(prev => ({ ...prev, tryOns: prev.tryOns + 1 }));
    
    // Track recent garments (last 5)
    setRecentGarments(prev => {
      const filtered = prev.filter(g => g !== index);
      return [index, ...filtered].slice(0, 5);
    });
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem("virtualfit-last-garment", String(index));
    } catch {
      // Ignore
    }
    
    // Save current garment's adjustments before switching
    setPerGarmentAdjustments(prev => {
      const updated = {
        ...prev,
        [selectedGarment]: {
          scale: garmentScale,
          scaleY: garmentScaleY,
          xOffset: garmentXOffset,
          yOffset: garmentYOffset,
          rotation: garmentRotation,
          brightness: garmentBrightness,
          hue: garmentHue,
          flipped: garmentFlipped,
        }
      };
      // Persist to localStorage
      try {
        localStorage.setItem("virtualfit-per-garment", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    
    // Restore new garment's adjustments if saved
    const saved = perGarmentAdjustments[index];
    if (saved) {
      setGarmentScale(saved.scale);
      setGarmentScaleY(saved.scaleY);
      setGarmentXOffset(saved.xOffset);
      setGarmentYOffset(saved.yOffset);
      setGarmentRotation(saved.rotation);
      setGarmentBrightness(saved.brightness);
      setGarmentHue(saved.hue);
      setGarmentFlipped(saved.flipped);
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
    
    setGarmentLoading(true);
    const loader = new THREE.TextureLoader();
    loader.load(
      garment.path,
      (texture) => {
        setGarmentLoading(false);
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
        setGarmentLoading(false);
        console.error("Failed to load garment:", err);
        setStatus(`Failed to load ${garment.name}`);
      }
    );
  }, [createShirtMesh]);

  // Session duration timer
  useEffect(() => {
    if (cameraOn && !sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
    if (!cameraOn) {
      sessionStartRef.current = null;
      setSessionDuration(0);
      return;
    }
    
    const interval = setInterval(() => {
      if (sessionStartRef.current) {
        setSessionDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cameraOn]);

  // Shake-to-randomize detection for mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceMotionEvent) return;
    
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || !cameraOn) return;
      
      const totalAcc = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      const now = Date.now();
      
      // Detect strong shake (subtract gravity ~9.8)
      if (totalAcc > shakeThreshold + 9.8 && now - lastShakeTimeRef.current > 1000) {
        lastShakeTimeRef.current = now;
        // Random outfit
        const randomIdx = Math.floor(Math.random() * GARMENTS.length);
        switchGarment(randomIdx);
        setStatus(`📱 Shake! ${GARMENTS[randomIdx].name}`);
        if ('vibrate' in navigator) navigator.vibrate([20, 30, 20]);
      }
    };
    
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [cameraOn, switchGarment]);

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

    // Track screenshot in session stats
    setSessionStats(prev => ({ ...prev, screenshots: prev.screenshots + 1 }));

    // Convert to blob and download
    compositeCanvas.toBlob(async (blob) => {
      if (!blob) return;
      
      // Save to history (keep last 10)
      const dataUrl = compositeCanvas.toDataURL('image/png');
      setScreenshotHistory(prev => {
        const updated = [dataUrl, ...prev].slice(0, 10);
        return updated;
      });
      
      // Try Web Share API on mobile, fallback to download
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `virtualfit-${Date.now()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'VirtualFit Try-On',
              text: 'Check out my virtual try-on!',
            });
            vibrate(25);
            setStatus("📤 Shared!");
            return;
          } catch {
            // User cancelled or share failed, fall through to download
          }
        }
      }
      
      // Fallback: download
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
        // Apply auto-lighting if enabled
        const effectiveBrightness = autoLighting ? (garmentBrightness * ambientBrightnessRef.current / 100) : garmentBrightness;
        const brightness = effectiveBrightness;
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
        case 'p': // Photo booth mode with countdown
          if (cameraOn && photoCountdown === null) {
            setStatus("📸 Photo in 3...");
            vibrate(30);
            setPhotoCountdown(3);
            let count = 3;
            const interval = setInterval(() => {
              count--;
              if (count > 0) {
                setPhotoCountdown(count);
                setStatus(`📸 Photo in ${count}...`);
                vibrate(20);
              } else {
                clearInterval(interval);
                setPhotoCountdown(null);
                vibrate([50, 50, 50]); // shutter sound pattern
                captureScreenshot();
              }
            }, 1000);
          }
          break;
        case '=': // Split view comparison
          if (cameraOn) {
            if (splitViewGarment === null) {
              // Enter split view with next garment
              const nextGarment = (selectedGarment + 1) % GARMENTS.length;
              setSplitViewGarment(nextGarment);
              setStatus(`👓 Split: ${GARMENTS[selectedGarment].name} vs ${GARMENTS[nextGarment].name}`);
            } else {
              // Cycle to next comparison garment
              const nextGarment = (splitViewGarment + 1) % GARMENTS.length;
              if (nextGarment === selectedGarment) {
                // Exiting split view
                setSplitViewGarment(null);
                setStatus("✖️ Split view off");
              } else {
                setSplitViewGarment(nextGarment);
                setStatus(`👓 Compare: ${GARMENTS[nextGarment].name}`);
              }
            }
            vibrate(20);
          }
          break;
        case 'u': // Undo last adjustment
          if (adjustmentHistoryRef.current.length > 0) {
            const prev = adjustmentHistoryRef.current.pop()!;
            setGarmentScale(prev.scale);
            setGarmentScaleY(prev.scaleY);
            setGarmentXOffset(prev.x);
            setGarmentYOffset(prev.y);
            setGarmentRotation(prev.rotation);
            setGarmentBrightness(prev.brightness);
            setGarmentHue(prev.hue);
            setGarmentOpacity(prev.opacity);
            setStatus(`↩️ Undo (${adjustmentHistoryRef.current.length} left)`);
            vibrate(15);
          } else {
            setStatus("⚠️ Nothing to undo");
          }
          break;
        case ',': // Cooler color temperature
          if (!adjustmentsLocked) {
            setColorTemp(prev => Math.max(-100, prev - 20));
            setStatus(`❄️ Temp: ${colorTemp - 20} (cooler)`);
            vibrate(10);
          }
          break;
        case '.': // Warmer color temperature
          if (!adjustmentsLocked) {
            setColorTemp(prev => Math.min(100, prev + 20));
            setStatus(`🔥 Temp: ${colorTemp + 20} (warmer)`);
            vibrate(10);
          }
          break;
        case "'": // Random outfit inspiration
          {
            const randomIdx = Math.floor(Math.random() * GARMENTS.length);
            const randomScale = 0.8 + Math.random() * 0.4; // 0.8-1.2
            const randomBrightness = 80 + Math.floor(Math.random() * 40); // 80-120
            const randomHue = Math.floor(Math.random() * 360);
            switchGarment(randomIdx);
            setGarmentScale(randomScale);
            setGarmentBrightness(randomBrightness);
            setGarmentHue(randomHue);
            setStatus(`🎲 Random: ${GARMENTS[randomIdx].name}`);
            vibrate([10, 20, 10]);
          }
          break;
        case 'c': // Copy to clipboard or copy config (with Shift)
          if (e.shiftKey) {
            // Shift+C: Copy garment config as URL params
            const params = new URLSearchParams({
              g: String(selectedGarment),
              s: garmentScale.toFixed(2),
              sy: garmentScaleY.toFixed(2),
              x: String(garmentXOffset),
              y: String(garmentYOffset),
              r: garmentRotation.toFixed(2),
              b: String(garmentBrightness),
              h: String(garmentHue),
              f: garmentFlipped ? '1' : '0',
            });
            const shareUrl = `${window.location.origin}/mirror?${params.toString()}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
              setStatus("📎 Config URL copied!");
              vibrate(20);
            });
          } else if (cameraOn) {
            copyToClipboard();
          }
          break;
        case 'arrowright': // Next garment or nudge right
        case 'n':
          if (e.altKey && cameraOn) {
            // Alt+N: Random garment
            const randomIdx = Math.floor(Math.random() * GARMENTS.length);
            switchGarment(randomIdx);
            setStatus(`🎲 Random: ${GARMENTS[randomIdx].name}`);
            vibrate(20);
          } else if (e.shiftKey && !adjustmentsLocked) {
            // Shift+Arrow: Nudge position
            setGarmentXOffset(prev => prev + 5);
            setStatus(`↔️ X: ${garmentXOffset + 5}px`);
          } else if (cameraOn) {
            if (favoritesOnly && favoriteGarments.length > 0) {
              // Navigate through favorites only
              const currentFavIdx = favoriteGarments.indexOf(selectedGarment);
              const nextFavIdx = (currentFavIdx + 1) % favoriteGarments.length;
              switchGarment(favoriteGarments[nextFavIdx]);
            } else {
              const nextIdx = (selectedGarment + 1) % GARMENTS.length;
              switchGarment(nextIdx);
            }
          }
          break;
        case 'arrowleft': // Previous garment or nudge left
        case 'p':
          if (e.shiftKey && !adjustmentsLocked) {
            // Shift+Arrow: Nudge position
            setGarmentXOffset(prev => prev - 5);
            setStatus(`↔️ X: ${garmentXOffset - 5}px`);
          } else if (cameraOn) {
            if (favoritesOnly && favoriteGarments.length > 0) {
              // Navigate through favorites only
              const currentFavIdx = favoriteGarments.indexOf(selectedGarment);
              const prevFavIdx = (currentFavIdx - 1 + favoriteGarments.length) % favoriteGarments.length;
              switchGarment(favoriteGarments[prevFavIdx]);
            } else {
              const prevIdx = (selectedGarment - 1 + GARMENTS.length) % GARMENTS.length;
              switchGarment(prevIdx);
            }
          }
          break;
        case 'arrowup': // Nudge up
          if (e.shiftKey && !adjustmentsLocked) {
            saveAdjustmentState();
            setGarmentYOffset(prev => prev - 5);
            setStatus(`↕️ Y: ${garmentYOffset - 5}px`);
          }
          break;
        case 'arrowdown': // Nudge down
          if (e.shiftKey && !adjustmentsLocked) {
            saveAdjustmentState();
            setGarmentYOffset(prev => prev + 5);
            setStatus(`↕️ Y: ${garmentYOffset + 5}px`);
          }
          break;
        case 'escape': // Exit fullscreen, close help, or reset all (with Shift)
          if (e.shiftKey && !adjustmentsLocked) {
            // Shift+Escape: Reset ALL adjustments
            saveAdjustmentsForUndo();
            setGarmentOpacity(1.0);
            setGarmentScale(1.0);
            setGarmentScaleY(1.0);
            setGarmentXOffset(0);
            setGarmentYOffset(0);
            setGarmentRotation(0);
            setGarmentBrightness(100);
            setGarmentHue(0);
            setGarmentFlipped(false);
            setAspectLocked(true);
            setStatus("🔄 All adjustments reset! Press Z to undo");
            vibrate(30);
          } else if (showHelp) {
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
        case 'r': // Quick reset adjustments (without shift)
        case 'R': // Quick rotation 90° with Shift+R
          if (e.shiftKey) {
            setGarmentRotation(prev => (prev + 90) % 360);
            setStatus(`🔄 Rotation: ${(garmentRotation + 90) % 360}°`);
            vibrate(15);
          } else {
            saveAdjustmentsForUndo();
            setGarmentOpacity(0.9);
            setGarmentScale(1.0);
            setGarmentYOffset(0);
            setGarmentXOffset(0);
            setGarmentBrightness(1.0);
            setGarmentHue(0);
            setGarmentRotation(0);
            setStatus("🔄 Adjustments reset! Press Z to undo");
          }
          break;
        case 'z': // Undo last adjustment change
          undoAdjustments();
          break;
        case 'Tab': // Quick switch to previous garment OR cycle sizes with Shift
          e.preventDefault();
          if (e.shiftKey && cameraOn) {
            // Shift+Tab: Cycle through size presets
            const currentIdx = scalePresets.findIndex(s => Math.abs(s - garmentScale) < 0.05);
            const nextIdx = (currentIdx + 1) % scalePresets.length;
            const newScale = scalePresets[nextIdx];
            setGarmentScale(newScale);
            setStatus(`📏 Size: ${Math.round(newScale * 100)}%`);
            vibrate(15);
          } else if (previousGarmentRef.current !== null && cameraOn) {
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
        case 'l': // Toggle adjustments lock
          setAdjustmentsLocked(prev => !prev);
          setStatus(adjustmentsLocked ? "🔓 Adjustments unlocked" : "🔒 Adjustments locked");
          vibrate(adjustmentsLocked ? 20 : [20, 30, 20]);
          break;
        case 'w': // Random garment shuffle
          {
            let randomIdx = Math.floor(Math.random() * GARMENTS.length);
            // Avoid same garment
            while (randomIdx === selectedGarment && GARMENTS.length > 1) {
              randomIdx = Math.floor(Math.random() * GARMENTS.length);
            }
            if (cameraOn) {
              switchGarment(randomIdx);
              setStatus(`🎲 Random: ${GARMENTS[randomIdx]?.name || 'Unknown'}`);
              vibrate([10, 20, 10, 20, 10]);
            }
          }
          break;
        case 'a': // Toggle favorites-only mode
          setFavoritesOnly(prev => !prev);
          if (!favoritesOnly && favoriteGarments.length === 0) {
            setStatus("❤️ No favorites yet! Add some first");
            setFavoritesOnly(false);
          } else {
            setStatus(favoritesOnly ? "👕 Showing all garments" : `❤️ Favorites only (${favoriteGarments.length})`);
          }
          break;
        case 'u': // Cycle through hue presets
          {
            const huePresets = [0, 30, 60, 120, 180, 240, 300];
            const currentIdx = huePresets.findIndex(h => Math.abs(h - garmentHue) < 15);
            const nextIdx = (currentIdx + 1) % huePresets.length;
            if (!adjustmentsLocked) {
              setGarmentHue(huePresets[nextIdx]);
              const hueNames = ['Normal', 'Warm', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple'];
              setStatus(`🎨 Hue: ${hueNames[nextIdx]} (${huePresets[nextIdx]}°)`);
            }
          }
          break;
        case 'x': // Center align - reset position offsets
          if (!adjustmentsLocked) {
            saveAdjustmentsForUndo();
            setGarmentXOffset(0);
            setGarmentYOffset(0);
            setStatus("✝️ Centered! Press Z to undo");
            vibrate(20);
          }
          break;
        case 't': // Toggle auto-fit mode
          setAutoFit(prev => !prev);
          setStatus(autoFit ? "📏 Manual scale mode" : "✨ Auto-fit enabled");
          vibrate(20);
          break;
        case 'j': // Flip garment horizontally
          setGarmentFlipped(prev => !prev);
          setStatus(garmentFlipped ? "↩️ Garment normal" : "↪️ Garment flipped");
          vibrate(20);
          break;
        case 'k': // Toggle aspect ratio lock
          setAspectLocked(prev => !prev);
          if (aspectLocked) {
            // Unlock: copy X scale to Y
            setGarmentScaleY(garmentScale);
          }
          setStatus(aspectLocked ? "🔓 Aspect unlocked (stretch mode)" : "🔒 Aspect locked");
          vibrate(20);
          break;
        case '[': // Decrease Y scale (only in stretch mode)
          if (!aspectLocked && !adjustmentsLocked) {
            setGarmentScaleY(prev => Math.max(0.5, prev - 0.05));
            setStatus(`↕️ Y Scale: ${Math.round((garmentScaleY - 0.05) * 100)}%`);
          }
          break;
        case ']': // Increase Y scale (only in stretch mode)
          if (!aspectLocked && !adjustmentsLocked) {
            setGarmentScaleY(prev => Math.min(2.0, prev + 0.05));
            setStatus(`↕️ Y Scale: ${Math.round((garmentScaleY + 0.05) * 100)}%`);
          }
          break;
        case 'y': // Cycle blend modes
          {
            const modes: Array<'normal' | 'multiply' | 'screen' | 'overlay'> = ['normal', 'multiply', 'screen', 'overlay'];
            const currentIdx = modes.indexOf(blendMode);
            const nextMode = modes[(currentIdx + 1) % modes.length];
            setBlendMode(nextMode);
            setStatus(`🎨 Blend: ${nextMode}`);
            vibrate(20);
          }
          break;
        case ';': // Toggle shadow
          setShowShadow(prev => !prev);
          setStatus(showShadow ? "🌑 Shadow off" : "🌞 Shadow on");
          vibrate(20);
          break;
        case '/': // Cycle saturation levels
          {
            const levels = [100, 125, 150, 75, 50, 0];
            const currentIdx = levels.findIndex(l => Math.abs(l - garmentSaturation) < 10);
            const nextIdx = (currentIdx + 1) % levels.length;
            setGarmentSaturation(levels[nextIdx]);
            const names = ['Normal', 'Vibrant', 'Vivid', 'Muted', 'Desaturated', 'Grayscale'];
            setStatus(`🎨 Saturation: ${names[nextIdx]} (${levels[nextIdx]}%)`);
            vibrate(20);
          }
          break;
        case '\\': // Cycle contrast levels
          {
            const levels = [100, 125, 150, 75, 50];
            const currentIdx = levels.findIndex(l => Math.abs(l - garmentContrast) < 10);
            const nextIdx = (currentIdx + 1) % levels.length;
            setGarmentContrast(levels[nextIdx]);
            const names = ['Normal', 'Punchy', 'High', 'Soft', 'Flat'];
            setStatus(`☀️ Contrast: ${names[nextIdx]} (${levels[nextIdx]}%)`);
            vibrate(20);
          }
          break;
        case '`': // Color grade presets
          {
            const presets = [
              { name: 'None', sat: 100, con: 100, bright: 100, hue: 0 },
              { name: 'Warm', sat: 110, con: 105, bright: 105, hue: 15 },
              { name: 'Cool', sat: 90, con: 100, bright: 100, hue: 200 },
              { name: 'Vintage', sat: 80, con: 90, bright: 95, hue: 30 },
              { name: 'Vivid', sat: 140, con: 110, bright: 100, hue: 0 },
              { name: 'Noir', sat: 0, con: 120, bright: 100, hue: 0 },
            ];
            const nextIdx = (colorGradeIdx + 1) % presets.length;
            const preset = presets[nextIdx];
            setColorGradeIdx(nextIdx);
            setGarmentSaturation(preset.sat);
            setGarmentContrast(preset.con);
            setGarmentBrightness(preset.bright);
            setGarmentHue(preset.hue);
            setStatus(`🎬 Grade: ${preset.name}`);
            vibrate(20);
          }
          break;
        case '1': case '2': case '3': case '4': case '5': // Quick garment select, scale, or brightness presets
          {
            if (e.shiftKey) {
              // Shift+1-5: Scale presets (50%, 75%, 100%, 125%, 150%)
              const scalePresets = [0.5, 0.75, 1.0, 1.25, 1.5];
              const presetIdx = parseInt(e.key) - 1;
              if (!adjustmentsLocked) {
                setGarmentScale(scalePresets[presetIdx]);
                setStatus(`📏 Scale: ${Math.round(scalePresets[presetIdx] * 100)}%`);
              }
            } else if (e.ctrlKey || e.metaKey) {
              // Ctrl/Cmd+1-5: Brightness presets (50%, 75%, 100%, 125%, 150%)
              e.preventDefault();
              const brightnessPresets = [0.5, 0.75, 1.0, 1.25, 1.5];
              const presetIdx = parseInt(e.key) - 1;
              if (!adjustmentsLocked) {
                setGarmentBrightness(brightnessPresets[presetIdx]);
                setStatus(`☀️ Brightness: ${Math.round(brightnessPresets[presetIdx] * 100)}%`);
              }
            } else {
              // Regular 1-5: Quick garment select
              const idx = parseInt(e.key) - 1;
              if (idx < GARMENTS.length && cameraOn) {
                switchGarment(idx);
              }
            }
          }
          break;
        case '6': // Filter: All garments
          setCategoryFilter(null);
          setStatus("👕 Filter: All");
          vibrate(15);
          break;
        case '7': // Filter: Shirts/T-shirts
          setCategoryFilter('shirt');
          setStatus("👕 Filter: Shirts");
          vibrate(15);
          break;
        case '8': // Filter: Hoodies/Jackets
          setCategoryFilter('outerwear');
          setStatus("🧥 Filter: Outerwear");
          vibrate(15);
          break;
        case '9': // Filter: Polos
          setCategoryFilter('polo');
          setStatus("🎽 Filter: Polos");
          vibrate(15);
          break;
        case '0': // Toggle screenshot history
          setShowHistory(prev => !prev);
          setStatus(showHistory ? "🖼️ History hidden" : `🖼️ History (${screenshotHistory.length})`);
          vibrate(15);
          break;
        case '-': // Toggle body silhouette outline
          setShowSilhouette(prev => !prev);
          setStatus(showSilhouette ? "👤 Silhouette off" : "👤 Silhouette on");
          vibrate(15);
          break;
        case '@': // Toggle auto-lighting adaptation
          setAutoLighting(prev => !prev);
          setStatus(autoLighting ? "💡 Auto-light off" : "💡 Auto-light on");
          vibrate(15);
          break;
        case '+': // Toggle garment preview grid
        case '=': // Also = without shift
          if (!e.shiftKey) {
            setShowGarmentGrid(prev => !prev);
            setStatus(showGarmentGrid ? "👕 Grid hidden" : "👕 Garment grid");
            vibrate(15);
          }
          break;
        case '<': // Rotate shadow left
        case ',': // Also comma
          if (showShadow) {
            setShadowAngle(prev => (prev - 45 + 360) % 360);
            setStatus(`🌞 Shadow: ${((shadowAngle - 45 + 360) % 360)}°`);
            vibrate(10);
          }
          break;
        case '>':
        case '.':
          if (showShadow) {
            setShadowAngle(prev => (prev + 45) % 360);
            setStatus(`🌞 Shadow: ${((shadowAngle + 45) % 360)}°`);
            vibrate(10);
          }
          break;
      }
      
      // Ctrl+1-5 to save/load presets
      if (e.ctrlKey && ['1','2','3','4','5'].includes(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (e.shiftKey) {
          // Ctrl+Shift+N to save
          savePreset(`Preset ${e.key}`);
        } else {
          // Ctrl+N to load
          if (savedPresets[idx]) {
            loadPreset(savedPresets[idx]);
          } else {
            setStatus(`⚠️ Preset ${e.key} not saved yet (Ctrl+Shift+${e.key} to save)`);
          }
        }
        vibrate(15);
      }
      
      // Edge feather control [ and ]
      if (e.key === '[') {
        setEdgeFeather(prev => Math.max(0, prev - 1));
        setStatus(`🚶 Edge feather: ${Math.max(0, edgeFeather - 1)}`);
        vibrate(10);
      } else if (e.key === ']') {
        setEdgeFeather(prev => Math.min(10, prev + 1));
        setStatus(`🚶 Edge feather: ${Math.min(10, edgeFeather + 1)}`);
        vibrate(10);
      }
      
      // Alt+1-5 for quick opacity presets
      if (e.altKey && ['1','2','3','4','5'].includes(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const opacity = opacityPresets[idx];
        setGarmentOpacity(opacity);
        setStatus(`💧 Opacity: ${Math.round(opacity * 100)}%`);
        vibrate(15);
      }
      
      // T key to cycle tint modes
      if (e.key === 't' || e.key === 'T') {
        const modes: typeof tintMode[] = ['none', 'warm', 'cool', 'sepia', 'night'];
        const currentIdx = modes.indexOf(tintMode);
        const nextMode = modes[(currentIdx + 1) % modes.length];
        setTintMode(nextMode);
        setStatus(`🎨 Tint: ${nextMode === 'none' ? 'Off' : nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}`);
        vibrate(15);
      }
      
      // Q key for flash compare (toggle garment on/off rapidly)
      if (e.key === 'q' || e.key === 'Q') {
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
          setFlashCompare(false);
          setShowGarment(true);
          setStatus('🔄 Flash compare off');
        } else {
          setFlashCompare(true);
          flashIntervalRef.current = setInterval(() => {
            setShowGarment(prev => !prev);
          }, 500);
          setStatus('🔄 Flash compare on');
        }
        vibrate(15);
      }
      
      // Escape key to close all overlays
      if (e.key === 'Escape') {
        setShowHelp(false);
        setShowHistory(false);
        setShowGarmentGrid(false);
        setShowQuickMenu(false);
        setShowStats(false);
        setShowFitGuide(false);
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
          setFlashCompare(false);
          setShowGarment(true);
        }
        setStatus('❌ Overlays closed');
        vibrate(10);
      }
      
      // Backtick key to toggle fit guide
      if (e.key === '`') {
        setShowFitGuide(prev => !prev);
        setStatus(showFitGuide ? '📏 Fit guide off' : '📏 Fit guide on');
        vibrate(15);
      }
      
      // K key for slideshow mode (auto-cycle garments)
      if (e.key === 'k' || e.key === 'K') {
        if (slideshowIntervalRef.current) {
          clearInterval(slideshowIntervalRef.current);
          slideshowIntervalRef.current = null;
          setSlideshowMode(false);
          setStatus('🎥 Slideshow off');
        } else if (cameraOn) {
          setSlideshowMode(true);
          slideshowIntervalRef.current = setInterval(() => {
            setSelectedGarment(prev => (prev + 1) % GARMENTS.length);
          }, 3000);
          setStatus('🎥 Slideshow on (3s per garment)');
        }
        vibrate(15);
      }
      
      // Y key for quick color picker
      if (e.key === 'y' || e.key === 'Y') {
        setShowColorPicker(prev => !prev);
        setStatus(showColorPicker ? '🎨 Color picker closed' : '🎨 Color picker open');
        vibrate(15);
      }
      
      // U key for recent garments panel
      if (e.key === 'u' || e.key === 'U') {
        setShowRecentPanel(prev => !prev);
        setStatus(showRecentPanel ? '🕒 Recent panel closed' : '🕒 Recent garments');
        vibrate(15);
      }
      
      // O key for comparison mode
      if (e.key === 'o' || e.key === 'O') {
        if (comparisonMode) {
          setComparisonMode(false);
          setComparisonGarment(null);
          setStatus('👁️ Comparison off');
        } else if (cameraOn) {
          // Set comparison to previous garment or next one
          const compareIdx = previousGarmentRef.current !== null 
            ? previousGarmentRef.current 
            : (selectedGarment + 1) % GARMENTS.length;
          setComparisonGarment(compareIdx);
          setComparisonMode(true);
          setStatus(`👁️ Comparing with ${GARMENTS[compareIdx]?.name || 'next'}`);
        }
        vibrate(15);
      }
      
      // Alt+B to toggle auto-pause on blur
      if ((e.key === 'b' || e.key === 'B') && e.altKey) {
        setAutoPauseOnBlur(prev => {
          const newVal = !prev;
          setStatus(newVal ? '🔋 Auto-pause on blur ON' : '🔋 Auto-pause on blur OFF');
          return newVal;
        });
        vibrate(15);
      }
      
      // Alt+S for outfit shuffle (random garment + hue + scale)
      if ((e.key === 's' || e.key === 'S') && e.altKey && cameraOn) {
        e.preventDefault();
        const randomIdx = Math.floor(Math.random() * GARMENTS.length);
        const randomHue = Math.floor(Math.random() * 360);
        const randomScale = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
        switchGarment(randomIdx);
        setGarmentHue(randomHue);
        setGarmentScale(randomScale);
        setStatus(`🎰 Shuffle: ${GARMENTS[randomIdx]?.name || 'Random'} | Hue: ${randomHue}° | Scale: ${Math.round(randomScale * 100)}%`);
        vibrate(30);
      }
      
      // Alt+E to export settings to clipboard
      if ((e.key === 'e' || e.key === 'E') && e.altKey) {
        const settings = {
          garment: selectedGarment,
          scale: garmentScale,
          scaleY: garmentScaleY,
          xOffset: garmentXOffset,
          yOffset: garmentYOffset,
          rotation: garmentRotation,
          brightness: garmentBrightness,
          hue: garmentHue,
          flipped: garmentFlipped,
          opacity: garmentOpacity,
          tintMode,
          edgeFeather,
          shadowAngle,
        };
        navigator.clipboard.writeText(JSON.stringify(settings, null, 2)).then(() => {
          setStatus('💾 Settings exported to clipboard!');
          vibrate(20);
        });
      }
      
      // Alt+I to import settings from clipboard
      if ((e.key === 'i' || e.key === 'I') && e.altKey) {
        navigator.clipboard.readText().then(text => {
          try {
            const settings = JSON.parse(text);
            if (settings.garment !== undefined) switchGarment(settings.garment);
            if (settings.scale !== undefined) setGarmentScale(settings.scale);
            if (settings.scaleY !== undefined) setGarmentScaleY(settings.scaleY);
            if (settings.xOffset !== undefined) setGarmentXOffset(settings.xOffset);
            if (settings.yOffset !== undefined) setGarmentYOffset(settings.yOffset);
            if (settings.rotation !== undefined) setGarmentRotation(settings.rotation);
            if (settings.brightness !== undefined) setGarmentBrightness(settings.brightness);
            if (settings.hue !== undefined) setGarmentHue(settings.hue);
            if (settings.flipped !== undefined) setGarmentFlipped(settings.flipped);
            if (settings.opacity !== undefined) setGarmentOpacity(settings.opacity);
            if (settings.tintMode !== undefined) setTintMode(settings.tintMode);
            if (settings.edgeFeather !== undefined) setEdgeFeather(settings.edgeFeather);
            if (settings.shadowAngle !== undefined) setShadowAngle(settings.shadowAngle);
            setStatus('📥 Settings imported!');
            vibrate(20);
          } catch {
            setStatus('❌ Invalid settings JSON');
          }
        }).catch(() => setStatus('❌ Clipboard read failed'));
      }
      
      // Alt+R for full reset all settings to defaults
      if ((e.key === 'r' || e.key === 'R') && e.altKey) {
        setGarmentScale(1.0);
        setGarmentScaleY(1.0);
        setGarmentXOffset(0);
        setGarmentYOffset(0);
        setGarmentRotation(0);
        setGarmentBrightness(1.0);
        setGarmentHue(0);
        setGarmentFlipped(false);
        setGarmentOpacity(0.9);
        setTintMode('none');
        setEdgeFeather(0);
        setShadowAngle(135);
        setShowShadow(false);
        setBlendMode('normal');
        setSmoothMode(false);
        setAutoLighting(false);
        setStatus('🔄 All settings reset to defaults!');
        vibrate(30);
      }
      
      // Alt+G for garment info panel
      if ((e.key === 'g' || e.key === 'G') && e.altKey) {
        setShowGarmentInfo(prev => !prev);
        setStatus(showGarmentInfo ? 'ℹ️ Info closed' : 'ℹ️ Garment info');
        vibrate(15);
      }
      
      // Alt+A for viewport aspect ratio cycle
      if ((e.key === 'a' || e.key === 'A') && e.altKey) {
        const aspects: typeof viewportAspect[] = ['auto', '9:16', '4:5', '1:1'];
        const currentIdx = aspects.indexOf(viewportAspect);
        const nextAspect = aspects[(currentIdx + 1) % aspects.length];
        setViewportAspect(nextAspect);
        setStatus(`📏 Aspect: ${nextAspect}`);
        vibrate(15);
      }
      
      // Alt+Z for zoom in, Alt+X for zoom out
      if ((e.key === 'z' || e.key === 'Z') && e.altKey) {
        e.preventDefault();
        setZoomLevel(prev => Math.min(3.0, prev + 0.25));
        setStatus(`🔍 Zoom: ${Math.min(3.0, zoomLevel + 0.25).toFixed(2)}x`);
        vibrate(10);
      }
      if ((e.key === 'x' || e.key === 'X') && e.altKey) {
        e.preventDefault();
        setZoomLevel(prev => Math.max(0.5, prev - 0.25));
        setStatus(`🔍 Zoom: ${Math.max(0.5, zoomLevel - 0.25).toFixed(2)}x`);
        vibrate(10);
      }
      
      // Alt+F for FPS counter toggle
      if ((e.key === 'f' || e.key === 'F') && e.altKey) {
        e.preventDefault();
        setShowFps(prev => !prev);
        setStatus(showFps ? '📊 FPS off' : '📊 FPS on');
        vibrate(10);
      }
      
      // Alt+P for battery saver toggle
      if ((e.key === 'p' || e.key === 'P') && e.altKey) {
        e.preventDefault();
        setBatterySaver(prev => !prev);
        setStatus(batterySaver ? '🔋 Full power' : '🔋 Battery saver ON');
        vibrate(15);
      }
      
      // Alt+T for garment thumbnail preview toggle
      if ((e.key === 't' || e.key === 'T') && e.altKey) {
        e.preventDefault();
        setShowGarmentPreview(prev => !prev);
        setStatus(showGarmentPreview ? '🖼️ Preview off' : '🖼️ Preview on');
        vibrate(10);
      }
      
      // Alt+M for sound effects toggle
      if ((e.key === 'm' || e.key === 'M') && e.altKey) {
        e.preventDefault();
        setSoundEnabled(prev => !prev);
        setStatus(soundEnabled ? '🔇 Sound off' : '🔊 Sound on');
        vibrate(10);
      }
      
      // Alt+D for night mode toggle
      if ((e.key === 'd' || e.key === 'D') && e.altKey) {
        e.preventDefault();
        setNightMode(prev => !prev);
        setStatus(nightMode ? '☀️ Day mode' : '🌙 Night mode');
        vibrate(15);
      }
      
      // Alt+C for 200 features celebration
      if ((e.key === 'c' || e.key === 'C') && e.altKey) {
        e.preventDefault();
        setShowMilestone(true);
        vibrate([100, 50, 100, 50, 100]);
        setTimeout(() => setShowMilestone(false), 3000);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cameraOn, selectedGarment, isFullscreen, showHelp, toggleFullscreen, captureScreenshot, copyToClipboard, switchGarment, GARMENTS.length, saveAdjustmentsForUndo, undoAdjustments, adjustmentsLocked, vibrate, showHistory, screenshotHistory.length, showSilhouette, autoLighting, showGarmentGrid, showShadow, shadowAngle, savedPresets, savePreset, loadPreset, edgeFeather, tintMode, showFitGuide, showColorPicker, showRecentPanel, comparisonMode, garmentScale, garmentScaleY, garmentXOffset, garmentYOffset, garmentRotation, garmentBrightness, garmentHue, garmentFlipped, garmentOpacity, showGarmentInfo, viewportAspect, zoomLevel, showFps, batterySaver, showGarmentPreview, soundEnabled, nightMode]);

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
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setHelpPage(helpPage === 1 ? 2 : 1)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#374151",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {helpPage === 1 ? '→ More Shortcuts' : '← Basic Shortcuts'}
              </button>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#6C5CE7",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Close (Esc)
              </button>
            </div>
            {helpPage === 2 && (
              <div style={{ marginTop: 16, fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>
                <strong>Advanced:</strong><br/>
                K → Slideshow | Y → Color picker | U → Recent | O → Compare<br/>
                Alt+S → Shuffle | Alt+E → Export | Alt+I → Import | Alt+R → Full reset<br/>
                Alt+N → Random | Shift+Tab → Size cycle | Shift+R → Rotate 90°<br/>
                ` → Fit guide | @ → Auto-light | ; → Shadow | T → Tint modes<br/>
                [ ] → Edge feather | &lt; &gt; → Shadow angle | Ctrl+1-5 → Presets
              </div>
            )}
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
        style={{ 
          position: "relative", 
          width: "100%", 
          maxWidth: 640,
          aspectRatio: viewportAspect === 'auto' ? undefined : viewportAspect.replace(':', '/'),
          overflow: "hidden",
          transform: `scale(${zoomLevel})`,
          transformOrigin: "center center",
        }}
        onClick={(e) => {
          // Shift+click to center garment
          if (e.shiftKey && cameraOn) {
            setGarmentXOffset(0);
            setGarmentYOffset(0);
            setStatus('🎯 Centered!');
            vibrate(15);
          }
          // Double-click to reset scale
          const now = Date.now();
          if (now - lastClickTimeRef.current < 300 && cameraOn) {
            setGarmentScale(1.0);
            setGarmentScaleY(1.0);
            setStatus('🔄 Scale reset!');
            vibrate(15);
          }
          lastClickTimeRef.current = now;
        }}
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
          
          // Double-tap detection for garment grid
          const now = Date.now();
          if (now - lastTapTimeRef.current < 300 && cameraOn) {
            // Double tap detected
            setShowGarmentGrid(prev => !prev);
            vibrate(30);
            lastTapTimeRef.current = 0; // Reset to prevent triple-tap
          } else {
            lastTapTimeRef.current = now;
          }
          
          // Show edge hints on first touch (once per session)
          if (!hasSeenEdgeHints && cameraOn) {
            setShowEdgeHints(true);
            setHasSeenEdgeHints(true);
            setTimeout(() => setShowEdgeHints(false), 2000);
            // Also show gesture tip for mobile users
            setShowGestureTip(true);
            setTimeout(() => setShowGestureTip(false), 5000);
          }
          
          // Long press detection for quick menu (single finger only)
          if (e.touches.length === 1) {
            longPressTimerRef.current = setTimeout(() => {
              vibrate(30);
              setShowQuickMenu(true);
            }, 500);
          }
          
          // Two-finger touch starts drag mode + pinch
          if (e.touches.length === 2) {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            dragStartRef.current = { x: midX, y: midY, offsetX: garmentXOffset, offsetY: garmentYOffset };
            // Calculate initial pinch distance and angle
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
            pinchStartScaleRef.current = garmentScale;
            pinchStartAngleRef.current = Math.atan2(dy, dx);
            pinchStartRotationRef.current = garmentRotation;
            setIsDragging(true);
            setShowPinchFeedback(true);
          }
        }}
        onTouchMove={(e) => {
          // Cancel long press on move
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          // Two-finger drag for positioning + pinch for scale
          if (isDragging && e.touches.length === 2 && !adjustmentsLocked) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const posX = midX - dragStartRef.current.x;
            const posY = midY - dragStartRef.current.y;
            setGarmentXOffset(dragStartRef.current.offsetX + posX * 0.3);
            setGarmentYOffset(dragStartRef.current.offsetY + posY * 0.3);
            
            // Pinch-to-zoom and rotate
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            if (pinchStartDistRef.current > 0) {
              // Scale
              const ratio = dist / pinchStartDistRef.current;
              const newScale = Math.max(0.5, Math.min(2.0, pinchStartScaleRef.current * ratio));
              setGarmentScale(newScale);
              
              // Rotation (convert radians to degrees)
              const angleDiff = (angle - pinchStartAngleRef.current) * (180 / Math.PI);
              const newRotation = pinchStartRotationRef.current + angleDiff;
              setGarmentRotation(newRotation);
              
              setShowPinchFeedback(true);
            }
          }
        }}
        onTouchEnd={(e) => {
          // Clear long press timer
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          if (isDragging) {
            setIsDragging(false);
            setShowPinchFeedback(false);
            return;
          }
          if (!cameraOn) return;
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const swipeDistanceX = touchEndX - touchStartXRef.current;
          const swipeDistanceY = touchEndY - touchStartYRef.current;
          const minSwipe = 50; // minimum swipe distance
          
          // Vertical swipe for brightness (left edge) or opacity (right edge)
          if (Math.abs(swipeDistanceY) > minSwipe && Math.abs(swipeDistanceY) > Math.abs(swipeDistanceX)) {
            const isLeftEdge = touchStartXRef.current < 80;
            const isRightEdge = touchStartXRef.current > window.innerWidth - 80;
            
            if (isLeftEdge && !adjustmentsLocked) {
              // Left edge: adjust brightness
              const delta = swipeDistanceY < 0 ? 10 : -10;
              setGarmentBrightness(prev => Math.max(50, Math.min(150, prev + delta)));
              setStatus(`☀️ Brightness: ${garmentBrightness + delta}%`);
              vibrate(10);
              return;
            } else if (isRightEdge && !adjustmentsLocked) {
              // Right edge: adjust opacity
              const delta = swipeDistanceY < 0 ? 0.1 : -0.1;
              setGarmentOpacity(prev => Math.max(0.2, Math.min(1, prev + delta)));
              setStatus(`👁️ Opacity: ${Math.round((garmentOpacity + delta) * 100)}%`);
              vibrate(10);
              return;
            }
          }
          
          // Horizontal swipe detection (single finger only)
          if (Math.abs(swipeDistanceX) > minSwipe) {
            vibrate(15); // haptic feedback on swipe
            if (swipeDistanceX > 0) {
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
              // Double tap detected - toggle favorite
              vibrate([10, 30, 10]); // haptic pattern for double-tap
              toggleFavorite(selectedGarment);
            }
          } else {
            tapCountRef.current = 0;
            lastTapTimeRef.current = now;
          }
        }}
      >
        <video
          ref={videoRef}
          style={{ 
            width: "100%", 
            transform: isMirrored ? "scaleX(-1)" : "none", 
            borderRadius: 12, 
            background: "#000",
            filter: nightMode ? "brightness(1.5) contrast(1.2) saturate(0.8)" : "none",
          }}
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
            transition: `transform 0.15s ease-out, opacity 0.2s ease-in-out`,
            opacity: garmentFadeIn ? 1 : 0.3,
            pointerEvents: "auto",
            cursor: isDragging ? "grabbing" : "grab",
            mixBlendMode: blendMode,
            filter: `${showShadow ? `drop-shadow(${Math.round(Math.cos(shadowAngle * Math.PI / 180) * 6)}px ${Math.round(Math.sin(shadowAngle * Math.PI / 180) * 6)}px 8px rgba(0,0,0,0.4))` : ""} ${edgeFeather > 0 ? `blur(${edgeFeather * 0.3}px)` : ""} saturate(${garmentSaturation}%) contrast(${garmentContrast}%) sepia(${Math.abs(colorTemp) * 0.3}%) hue-rotate(${colorTemp > 0 ? 10 : colorTemp < 0 ? -10 : 0}deg) ${tintMode === 'warm' ? 'sepia(20%) hue-rotate(-10deg)' : tintMode === 'cool' ? 'hue-rotate(20deg) saturate(110%)' : tintMode === 'sepia' ? 'sepia(50%)' : tintMode === 'night' ? 'hue-rotate(200deg) saturate(70%)' : ''}`.trim(),
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
            if (!isDragging || adjustmentsLocked) return;
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

        {/* Lock indicator */}
        {cameraOn && adjustmentsLocked && (
          <div style={{
            position: "absolute",
            top: 75, left: 12,
            background: "rgba(239, 68, 68, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            🔒 Locked
          </div>
        )}

        {/* Favorites-only indicator */}
        {cameraOn && favoritesOnly && favoriteGarments.length > 0 && (
          <div style={{
            position: "absolute",
            top: adjustmentsLocked ? 100 : 75, left: 12,
            background: "rgba(239, 68, 68, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            ❤️ Favorites ({favoriteGarments.length})
          </div>
        )}

        {/* Manual scale mode indicator */}
        {cameraOn && !autoFit && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0), left: 12,
            background: "rgba(59, 130, 246, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            📏 Manual
          </div>
        )}

        {/* Flipped indicator */}
        {cameraOn && garmentFlipped && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0), left: 12,
            background: "rgba(168, 85, 247, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            ↪️ Flipped
          </div>
        )}

        {/* Stretch mode indicator */}
        {cameraOn && !aspectLocked && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0), left: 12,
            background: "rgba(236, 72, 153, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            ↔️ Stretch
          </div>
        )}

        {/* Blend mode indicator */}
        {cameraOn && blendMode !== 'normal' && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0) + (!aspectLocked ? 25 : 0), left: 12,
            background: "rgba(147, 51, 234, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            🎨 {blendMode}
          </div>
        )}

        {/* Color grade indicator */}
        {cameraOn && colorGradeIdx > 0 && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0) + (!aspectLocked ? 25 : 0) + (blendMode !== 'normal' ? 25 : 0), left: 12,
            background: "rgba(234, 88, 12, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            🎬 {['None', 'Warm', 'Cool', 'Vintage', 'Vivid', 'Noir'][colorGradeIdx]}
          </div>
        )}

        {/* Fit quality indicator */}
        {cameraOn && showGarment && (
          <div style={{
            position: "absolute",
            bottom: 12, right: 12,
            background: fitQuality === 'excellent' ? "rgba(34, 197, 94, 0.85)" :
                        fitQuality === 'good' ? "rgba(59, 130, 246, 0.85)" :
                        fitQuality === 'fair' ? "rgba(251, 191, 36, 0.85)" :
                        "rgba(239, 68, 68, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
            {fitQuality === 'excellent' ? '✨' : fitQuality === 'good' ? '✅' : fitQuality === 'fair' ? '⚠️' : '❌'}
            Fit: {fitQuality}
          </div>
        )}

        {/* Posture guidance tip */}
        {cameraOn && postureTip && (fitQuality === 'fair' || fitQuality === 'poor') && (
          <div style={{
            position: "absolute",
            bottom: 40, right: 12,
            background: "rgba(0, 0, 0, 0.75)",
            padding: "6px 12px",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            pointerEvents: "none",
            maxWidth: 180,
            textAlign: "center",
          }}>
            {postureTip}
          </div>
        )}

        {/* Split view indicator */}
        {cameraOn && splitViewGarment !== null && (
          <div style={{
            position: "absolute",
            top: 12, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(139, 92, 246, 0.9)",
            padding: "6px 16px",
            borderRadius: 20,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>👓 {GARMENTS[selectedGarment].name}</span>
            <span style={{ opacity: 0.7 }}>vs</span>
            <span>{GARMENTS[splitViewGarment].name}</span>
          </div>
        )}

        {/* Color temperature indicator */}
        {cameraOn && colorTemp !== 0 && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0) + (!aspectLocked ? 25 : 0) + (blendMode !== 'normal' ? 25 : 0) + (colorGradeIdx > 0 ? 25 : 0), left: 12,
            background: colorTemp > 0 ? "rgba(251, 146, 60, 0.85)" : "rgba(96, 165, 250, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            {colorTemp > 0 ? '🔥' : '❄️'} Temp: {colorTemp > 0 ? '+' : ''}{colorTemp}
          </div>
        )}

        {/* Category filter indicator */}
        {cameraOn && categoryFilter && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0) + (!aspectLocked ? 25 : 0) + (blendMode !== 'normal' ? 25 : 0) + (colorGradeIdx > 0 ? 25 : 0) + (colorTemp !== 0 ? 25 : 0), left: 12,
            background: "rgba(16, 185, 129, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            🏷️ {categoryFilter === 'shirt' ? 'Shirts' : categoryFilter === 'outerwear' ? 'Outerwear' : 'Polos'}
          </div>
        )}

        {/* Auto-lighting indicator */}
        {cameraOn && autoLighting && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0) + (!aspectLocked ? 25 : 0) + (blendMode !== 'normal' ? 25 : 0) + (colorGradeIdx > 0 ? 25 : 0) + (colorTemp !== 0 ? 25 : 0) + (categoryFilter ? 25 : 0), left: 12,
            background: "rgba(251, 191, 36, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            💡 Auto-light: {Math.round(ambientBrightnessRef.current)}%
          </div>
        )}

        {/* Tint mode indicator */}
        {cameraOn && tintMode !== 'none' && (
          <div style={{
            position: "absolute",
            top: (adjustmentsLocked ? 100 : 75) + (favoritesOnly && favoriteGarments.length > 0 ? 25 : 0) + (!autoFit ? 25 : 0) + (garmentFlipped ? 25 : 0) + (!aspectLocked ? 25 : 0) + (blendMode !== 'normal' ? 25 : 0) + (colorGradeIdx > 0 ? 25 : 0) + (colorTemp !== 0 ? 25 : 0) + (categoryFilter ? 25 : 0) + (autoLighting ? 25 : 0), left: 12,
            background: tintMode === 'warm' ? "rgba(239, 68, 68, 0.85)" : tintMode === 'cool' ? "rgba(59, 130, 246, 0.85)" : tintMode === 'sepia' ? "rgba(180, 83, 9, 0.85)" : "rgba(79, 70, 229, 0.85)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            🎨 {tintMode.charAt(0).toUpperCase() + tintMode.slice(1)}
          </div>
        )}

        {/* Distance hint indicator */}
        {cameraOn && distanceHint && distanceHint !== 'optimal' && (
          <div style={{
            position: "absolute",
            bottom: 80, left: "50%",
            transform: "translateX(-50%)",
            background: distanceHint === 'too-close' ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 191, 36, 0.9)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            animation: "pulse 1s infinite",
          }}>
            {distanceHint === 'too-close' ? '🚨 Step back!' : '👋 Come closer!'}
          </div>
        )}

        {/* Flash compare indicator */}
        {flashCompare && (
          <div style={{
            position: "absolute",
            top: 50, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(147, 51, 234, 0.9)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            animation: "pulse 0.5s infinite",
          }}>
            🔄 Comparing... (Q to stop)
          </div>
        )}

        {/* Slideshow indicator */}
        {slideshowMode && (
          <div style={{
            position: "absolute",
            top: 90, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(34, 197, 94, 0.9)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
          }}>
            🎥 Slideshow... (K to stop)
          </div>
        )}

        {/* Comparison mode indicator */}
        {comparisonMode && comparisonGarment !== null && (
          <div style={{
            position: "absolute",
            top: 130, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(59, 130, 246, 0.9)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}>
            👁️ {GARMENTS[selectedGarment]?.name} vs {GARMENTS[comparisonGarment]?.name}
            <button
              onClick={() => { setComparisonMode(false); setComparisonGarment(null); }}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: 4,
                padding: "2px 6px",
                color: "#fff",
                fontSize: 10,
                cursor: "pointer",
              }}
            >O to close</button>
          </div>
        )}
        {/* Color picker panel */}
        {showColorPicker && cameraOn && (
          <div style={{
            position: "absolute",
            bottom: 140, right: 12,
            background: "rgba(0,0,0,0.85)",
            padding: 12,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ color: "#fff", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
              🎨 Quick Hue Shift
            </div>
            {[0, 30, 60, 120, 180, 240, 300].map(hue => (
              <button
                key={hue}
                onClick={() => {
                  setGarmentHue(hue);
                  setStatus(`🎨 Hue: ${hue}°`);
                  vibrate(15);
                }}
                style={{
                  width: 36, height: 36,
                  borderRadius: "50%",
                  border: garmentHue === hue ? "3px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                  background: `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${hue}, 70%, 40%))`,
                  cursor: "pointer",
                }}
              />
            ))}
            <button
              onClick={() => {
                setGarmentHue(0);
                setShowColorPicker(false);
                setStatus('🎨 Hue reset');
                vibrate(10);
              }}
              style={{
                marginTop: 4,
                padding: "6px 12px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 6,
                color: "#fff",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Reset & Close
            </button>
          </div>
        )}

        {/* Recent garments panel */}
        {showRecentPanel && cameraOn && recentGarments.length > 0 && (
          <div style={{
            position: "absolute",
            bottom: 140, left: 12,
            background: "rgba(0,0,0,0.85)",
            padding: 12,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ color: "#fff", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
              🕒 Recent (U to close)
            </div>
            {recentGarments.map((idx, i) => (
              <button
                key={idx}
                onClick={() => {
                  switchGarment(idx);
                  setShowRecentPanel(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: idx === selectedGarment ? "rgba(147, 51, 234, 0.5)" : "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ opacity: 0.5 }}>{i + 1}.</span>
                {GARMENTS[idx]?.name || `Garment ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Fit guide overlay */}
        {showFitGuide && cameraOn && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: "none",
          }}>
            {/* Center crosshair */}
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 40, height: 40,
              border: "2px dashed rgba(147, 51, 234, 0.6)",
              borderRadius: "50%",
            }} />
            {/* Shoulder line guide */}
            <div style={{
              position: "absolute",
              top: "25%", left: "15%", right: "15%",
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.5), transparent)",
            }} />
            {/* Hip line guide */}
            <div style={{
              position: "absolute",
              top: "65%", left: "20%", right: "20%",
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.5), transparent)",
            }} />
            {/* Optimal zone box */}
            <div style={{
              position: "absolute",
              top: "20%", left: "10%", right: "10%", bottom: "30%",
              border: "2px dashed rgba(34, 197, 94, 0.3)",
              borderRadius: 12,
            }} />
            {/* Guide label */}
            <div style={{
              position: "absolute",
              bottom: 100, left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)",
              padding: "6px 12px",
              borderRadius: 6,
              color: "#fff",
              fontSize: 11,
            }}>
              📏 Align shoulders to green line | ` to close
            </div>
          </div>
        )}

        {/* Garment preview grid */}
        {showGarmentGrid && cameraOn && (
          <div style={{
            position: "absolute",
            top: 50, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.9)",
            padding: 12,
            borderRadius: 12,
            maxWidth: "80%",
          }}>
            <input
              type="text"
              placeholder="Search garments..."
              value={garmentSearch}
              onChange={(e) => setGarmentSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: 12,
                border: "none",
                borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 12,
                outline: "none",
              }}
              autoFocus
            />
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}>
            {GARMENTS.filter(g => 
              garmentSearch === '' || 
              g.name.toLowerCase().includes(garmentSearch.toLowerCase()) ||
              (g.category && g.category.toLowerCase().includes(garmentSearch.toLowerCase()))
            ).map((g) => {
              const idx = GARMENTS.indexOf(g);
              return (
              <div
                key={idx}
                onClick={() => {
                  switchGarment(idx);
                  setShowGarmentGrid(false);
                  setGarmentSearch('');
                }}
                style={{
                  cursor: "pointer",
                  padding: 8,
                  borderRadius: 8,
                  background: idx === selectedGarment ? "rgba(147, 51, 234, 0.5)" : "rgba(255,255,255,0.1)",
                  border: idx === selectedGarment ? "2px solid #9333ea" : "2px solid transparent",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 24 }}>{g.emoji}</div>
                <div style={{ color: "#fff", fontSize: 10, marginTop: 4 }}>{g.name}</div>
              </div>
            );
            })}
            </div>
          </div>
        )}

        {/* Screenshot history overlay */}
        {showHistory && screenshotHistory.length > 0 && (
          <div style={{
            position: "absolute",
            top: 50, right: 12,
            background: "rgba(0,0,0,0.9)",
            padding: 12,
            borderRadius: 12,
            maxWidth: 200,
            maxHeight: 300,
            overflowY: "auto",
          }}>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              🖼️ Recent ({screenshotHistory.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {screenshotHistory.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Screenshot ${idx + 1}`}
                  style={{ width: "100%", borderRadius: 6, cursor: "pointer" }}
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = img;
                    a.download = `virtualfit-history-${idx}.png`;
                    a.click();
                  }}
                />
              ))}
            </div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 8 }}>Click to download • 0 to close</div>
          </div>
        )}
        {/* Photo countdown overlay */}
        {photoCountdown !== null && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
          }}>
            <div style={{
              fontSize: 120,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              animation: "pulse 0.5s ease-in-out",
            }}>
              {photoCountdown}
            </div>
          </div>
        )}

        {/* Edge zone hints */}
        {showEdgeHints && (
          <>
            <div style={{
              position: "absolute",
              left: 0, top: "50%",
              transform: "translateY(-50%)",
              width: 60, height: 120,
              background: "linear-gradient(to right, rgba(251, 191, 36, 0.6), transparent)",
              borderRadius: "0 12px 12px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              animation: "fadeIn 0.3s ease",
            }}>
              ☀️ Bright
            </div>
            <div style={{
              position: "absolute",
              right: 0, top: "50%",
              transform: "translateY(-50%)",
              width: 60, height: 120,
              background: "linear-gradient(to left, rgba(59, 130, 246, 0.6), transparent)",
              borderRadius: "12px 0 0 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              animation: "fadeIn 0.3s ease",
            }}>
              👁️ Opacity
            </div>
          </>
        )}

        {/* Quick menu (long press) */}
        {showQuickMenu && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowQuickMenu(false)}
          >
            <div style={{
              background: "#1e1e1e",
              borderRadius: 16,
              padding: 16,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              maxWidth: 280,
            }} onClick={e => e.stopPropagation()}>
              {[
                { icon: "❤️", label: "Favorite", action: () => { toggleFavorite(selectedGarment); setShowQuickMenu(false); } },
                { icon: "📸", label: "Screenshot", action: () => { captureScreenshot(); setShowQuickMenu(false); } },
                { icon: "🔄", label: "Reset", action: () => { setGarmentScale(1); setGarmentXOffset(0); setGarmentYOffset(0); setShowQuickMenu(false); } },
                { icon: "↪️", label: "Flip", action: () => { setGarmentFlipped(!garmentFlipped); setShowQuickMenu(false); } },
                { icon: "🔒", label: adjustmentsLocked ? "Unlock" : "Lock", action: () => { setAdjustmentsLocked(!adjustmentsLocked); setShowQuickMenu(false); } },
                { icon: "⚙️", label: "Settings", action: () => { setShowHelp(true); setShowQuickMenu(false); } },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  style={{
                    background: "#333",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <span style={{ fontSize: 11 }}>{item.label}</span>
                </button>
              ))}
            </div>
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
        {cameraOn && sessionDuration > 0 && (
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
            ⏱️ {Math.floor(sessionDuration / 60)}:{String(sessionDuration % 60).padStart(2, "0")}
            {" | "}👕 {selectedGarment + 1}/{GARMENTS.length}
            {sessionStats.tryOns > 0 && ` | 👗 ${sessionStats.tryOns}`}
            {sessionStats.screenshots > 0 && ` | 📸 ${sessionStats.screenshots}`}
            {debugMode && ` | 🎬 ${totalFramesRef.current.toLocaleString()}f`}
            {batteryLevel !== null && batteryLevel <= 20 && (
              <span style={{ color: batteryLevel <= 10 ? "#ef4444" : "#eab308" }}>
                {" | "}🔋 {batteryLevel}%
              </span>
            )}
          </div>
        )}

        {/* Onboarding tooltip for first-time users */}
        {showOnboarding && cameraOn && (
          <div style={{
            position: "absolute",
            bottom: 100, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(108, 92, 231, 0.95)",
            padding: "16px 20px",
            borderRadius: 12,
            color: "#fff",
            fontSize: 13,
            maxWidth: 320,
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 200,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>
              👋 Welcome to VirtualFit!
            </div>
            <div style={{ lineHeight: 1.6, marginBottom: 12 }}>
              Use ← → keys to browse garments<br/>
              Drag to reposition • Pinch to resize<br/>
              Press H or ? for all shortcuts
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                try {
                  localStorage.setItem("virtualfit-onboarding-seen", "true");
                } catch {}
              }}
              style={{
                padding: "8px 24px",
                background: "#fff",
                color: "#6C5CE7",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Got it!
            </button>
          </div>
        )}
        
        {/* Touch gesture tip for mobile */}
        {showGestureTip && cameraOn && (
          <div style={{
            position: "absolute",
            bottom: 80, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            padding: "12px 20px",
            borderRadius: 12,
            color: "#fff",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 150,
          }}>
            <div style={{ fontSize: 24, animation: "bounce 1s infinite" }}>🤏</div>
            <div>
              <div style={{ fontWeight: 600 }}>Pinch to resize</div>
              <div style={{ opacity: 0.7, fontSize: 11 }}>Two-finger pinch to scale garment</div>
            </div>
            <button
              onClick={() => setShowGestureTip(false)}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Garment info panel */}
        {showGarmentInfo && cameraOn && GARMENTS[selectedGarment] && (
          <div style={{
            position: "absolute",
            top: 60, right: 12,
            background: "rgba(0,0,0,0.9)",
            padding: 16,
            borderRadius: 12,
            color: "#fff",
            fontSize: 12,
            minWidth: 180,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>
              ℹ️ {GARMENTS[selectedGarment].name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", opacity: 0.9 }}>
              <span>Category:</span><span>{GARMENTS[selectedGarment].category || 'N/A'}</span>
              <span>Scale:</span><span>{Math.round(garmentScale * 100)}%</span>
              <span>Rotation:</span><span>{Math.round(garmentRotation)}°</span>
              <span>Opacity:</span><span>{Math.round(garmentOpacity * 100)}%</span>
              <span>Hue:</span><span>{garmentHue}°</span>
              <span>Brightness:</span><span>{Math.round(garmentBrightness * 100)}%</span>
              <span>Position:</span><span>({garmentXOffset}, {garmentYOffset})</span>
              <span>Flipped:</span><span>{garmentFlipped ? 'Yes' : 'No'}</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 10, opacity: 0.6 }}>
              Alt+G to close
            </div>
          </div>
        )}

        {/* FPS counter */}
        {showFps && cameraOn && (
          <div style={{
            position: "absolute",
            top: 12, right: 12,
            background: currentFps >= 30 ? "rgba(46, 204, 113, 0.8)" : currentFps >= 15 ? "rgba(241, 196, 15, 0.8)" : "rgba(231, 76, 60, 0.8)",
            padding: "4px 10px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "monospace",
            zIndex: 100,
          }}>
            {currentFps} FPS
          </div>
        )}
        
        {/* Camera flip button */}
        {cameraOn && (
          <button
            onClick={() => {
              const newMode = facingMode === 'user' ? 'environment' : 'user';
              setFacingMode(newMode);
              setStatus(`📷 ${newMode === 'user' ? 'Front' : 'Rear'} camera`);
              vibrate(15);
            }}
            style={{
              position: "absolute",
              bottom: 12, right: 12,
              width: 44, height: 44,
              borderRadius: "50%",
              background: "rgba(108, 92, 231, 0.8)",
              border: "none",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Flip camera"
          >
            🔄
          </button>
        )}
        
        {/* Share button */}
        {cameraOn && (
          <button
            onClick={async () => {
              const shareUrl = window.location.href;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: 'VirtualFit - Virtual Try-On',
                    text: 'Try on clothes virtually!',
                    url: shareUrl,
                  });
                  setStatus('🚀 Shared!');
                } catch {
                  // User cancelled or share failed
                }
              } else {
                await navigator.clipboard.writeText(shareUrl);
                setStatus('📋 Link copied!');
              }
              vibrate(15);
            }}
            style={{
              position: "absolute",
              bottom: 12, right: 64,
              width: 44, height: 44,
              borderRadius: "50%",
              background: "rgba(46, 204, 113, 0.8)",
              border: "none",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Share"
          >
            🚀
          </button>
        )}
        
        {/* Print button */}
        {cameraOn && screenshotHistory.length > 0 && (
          <button
            onClick={() => {
              const lastScreenshot = screenshotHistory[screenshotHistory.length - 1];
              if (lastScreenshot) {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head><title>VirtualFit Screenshot</title></head>
                      <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                        <img src="${lastScreenshot}" style="max-width:100%;max-height:100vh;" />
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }
                setStatus('🖨️ Printing...');
                vibrate(15);
              }
            }}
            style={{
              position: "absolute",
              bottom: 12, right: 116,
              width: 44, height: 44,
              borderRadius: "50%",
              background: "rgba(241, 196, 15, 0.8)",
              border: "none",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Print last screenshot"
          >
            🖨️
          </button>
        )}
        
        {/* Garment thumbnail preview */}
        {showGarmentPreview && cameraOn && GARMENTS[selectedGarment] && (
          <div 
            onClick={() => setShowGarmentGrid(true)}
            style={{
              position: "absolute",
              bottom: 12, left: 12,
              width: 60,
              height: 60,
              borderRadius: 8,
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.5)",
              cursor: "pointer",
              background: "rgba(0,0,0,0.5)",
              zIndex: 100,
            }}
          >
            <img 
              src={GARMENTS[selectedGarment].path} 
              alt={GARMENTS[selectedGarment].name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              fontSize: 8,
              textAlign: "center",
              padding: 2,
            }}>
              {selectedGarment + 1}/{GARMENTS.length}
            </div>
          </div>
        )}
        
        {/* 200 Features Milestone Celebration */}
        {showMilestone && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(108, 92, 231, 0.95)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            animation: "fadeIn 0.3s ease-out",
          }}>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🎉</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#fff", marginBottom: 10 }}>200 Features!</div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.9)", marginBottom: 20 }}>VirtualFit Milestone Achieved</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Alt+C to celebrate anytime</div>
          </div>
        )}
        
        {/* Recording time indicator */}
        {isRecording && (
          <div style={{
            position: "absolute",
            top: 50, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(220, 38, 38, 0.9)",
            padding: "8px 16px",
            borderRadius: 20,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 100,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", animation: "pulse 1s infinite" }} />
            REC {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
          </div>
        )}
        
        {/* Active mode badges */}
        {cameraOn && (batterySaver || adjustmentsLocked || autoLighting || slideshowMode) && (
          <div style={{
            position: "absolute",
            top: showFps ? 44 : 12, right: 12,
            display: "flex",
            gap: 6,
            zIndex: 100,
          }}>
            {batterySaver && (
              <span style={{ background: "rgba(46, 204, 113, 0.8)", padding: "3px 8px", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 600 }}>🔋 ECO</span>
            )}
            {adjustmentsLocked && (
              <span style={{ background: "rgba(231, 76, 60, 0.8)", padding: "3px 8px", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 600 }}>🔒 LOCK</span>
            )}
            {autoLighting && (
              <span style={{ background: "rgba(241, 196, 15, 0.8)", padding: "3px 8px", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 600 }}>💡 AUTO</span>
            )}
            {slideshowMode && (
              <span style={{ background: "rgba(108, 92, 231, 0.8)", padding: "3px 8px", borderRadius: 4, color: "#fff", fontSize: 10, fontWeight: 600 }}>▶️ PLAY</span>
            )}
          </div>
        )}

        {/* Loading indicator */}
        {garmentLoading && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.8)",
            padding: "16px 24px",
            borderRadius: 12,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 100,
          }}>
            <div style={{
              width: 20, height: 20,
              border: "3px solid rgba(255,255,255,0.3)",
              borderTop: "3px solid #fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            Loading...
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
              {showGarment && GARMENTS[selectedGarment].category && (
                <span style={{
                  background: "rgba(255,255,255,0.2)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  marginLeft: 4,
                }}>{GARMENTS[selectedGarment].category}</span>
              )}
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
        <p>VirtualFit v2.5.0 • 200 features • Built with Next.js + Three.js + MediaPipe</p>
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
