"use client";

/*
BLOCKER for next pass: depth occlusion. Options: BlazePose 3D + manual z-sort vs
front-camera ARKit WebXR vs MediaPipe Selfie Segmentation as a body mask. Madhav
to pick direction.
*/

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { computeArmorTransform } from "@/lib/armor";
import { computeBicepTransforms } from "@/lib/bicep";
import { describeCameraError } from "@/lib/camera-error";
import { computeGauntletTransforms } from "@/lib/gauntlet";
import { computeHelmetTransform } from "@/lib/helmet";
import { buildOverlayPoints, visibleEdges, type OverlayPoint } from "@/lib/landmark-overlay";
import { createPoseTracker } from "@/lib/pose";
import { createTransformSmoother } from "@/lib/smooth";
import { captureSnapshot, downloadBlob, snapshotFilename } from "@/lib/snapshot";
import { createTrackingGate } from "@/lib/tracking-gate";

type TrackingStatus = "initializing" | "searching" | "locked" | "error";

const STATUS_STYLES: Record<TrackingStatus, { label: string; dot: string; badge: string }> = {
  initializing: {
    label: "Initializing",
    dot: "bg-amber-400",
    badge: "border-amber-300/20 bg-amber-300/10 text-amber-50"
  },
  searching: {
    label: "Searching for body",
    dot: "bg-cyan-400",
    badge: "border-cyan-300/20 bg-cyan-300/10 text-cyan-50"
  },
  locked: {
    label: "Locked",
    dot: "bg-emerald-400",
    badge: "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
  },
  error: {
    label: "Camera unavailable",
    dot: "bg-rose-400",
    badge: "border-rose-300/20 bg-rose-300/10 text-rose-50"
  }
};

function createArmorGroup(): THREE.Group {
  const armor = new THREE.Group();
  const primaryMaterial = new THREE.MeshStandardMaterial({
    color: "#cf2a2a",
    emissive: "#280506",
    metalness: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: "#d4af37",
    emissive: "#7a5d05",
    metalness: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0
  });

  const chestShape = new THREE.Shape();
  chestShape.moveTo(-72, -16);
  chestShape.lineTo(-62, 44);
  chestShape.lineTo(-26, 106);
  chestShape.lineTo(0, 126);
  chestShape.lineTo(26, 106);
  chestShape.lineTo(62, 44);
  chestShape.lineTo(72, -16);
  chestShape.lineTo(30, -10);
  chestShape.lineTo(0, 8);
  chestShape.lineTo(-30, -10);
  chestShape.lineTo(-72, -16);

  const chestGeometry = new THREE.ExtrudeGeometry(chestShape, {
    depth: 22,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 4,
    bevelThickness: 4
  });
  chestGeometry.center();

  const chestPlate = new THREE.Mesh(chestGeometry, primaryMaterial);
  chestPlate.position.set(0, -72, 0);
  armor.add(chestPlate);

  const sternum = new THREE.Mesh(new THREE.BoxGeometry(26, 88, 10), accentMaterial);
  sternum.position.set(0, -70, 16);
  armor.add(sternum);

  const arc = new THREE.Mesh(new THREE.TorusGeometry(28, 6, 16, 40, Math.PI), accentMaterial);
  arc.rotation.x = Math.PI;
  arc.position.set(0, -18, 14);
  armor.add(arc);

  const shoulderPadGeometry = new THREE.SphereGeometry(28, 24, 24, 0, Math.PI);
  const leftShoulder = new THREE.Mesh(shoulderPadGeometry, primaryMaterial);
  leftShoulder.rotation.z = Math.PI / 2;
  leftShoulder.position.set(-92, -12, 4);
  armor.add(leftShoulder);

  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = 92;
  armor.add(rightShoulder);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(110, 20, 12), accentMaterial);
  collar.position.set(0, -4, 10);
  armor.add(collar);

  armor.userData.materials = [primaryMaterial, accentMaterial];

  return armor;
}

function setArmorOpacity(armor: THREE.Group, opacity: number) {
  const materials = armor.userData.materials as THREE.MeshStandardMaterial[] | undefined;

  materials?.forEach((material) => {
    material.opacity = opacity;
  });
}

function createHelmetGroup(): THREE.Group {
  // Iron-Man-ish placeholder helmet: faceplate (rounded box) + visor slit (gold).
  const helmet = new THREE.Group();
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: "#cf2a2a",
    emissive: "#280506",
    metalness: 0.95,
    roughness: 0.28,
    transparent: true,
    opacity: 0
  });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: "#f6d17d",
    emissive: "#7a5d05",
    emissiveIntensity: 0.8,
    metalness: 0.6,
    roughness: 0.2,
    transparent: true,
    opacity: 0
  });

  const shell = new THREE.Mesh(new THREE.SphereGeometry(56, 28, 24, 0, Math.PI * 2, 0, Math.PI * 0.65), shellMaterial);
  shell.scale.set(1, 1.12, 0.95);
  helmet.add(shell);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(72, 26, 60), shellMaterial);
  jaw.position.set(0, -42, 0);
  helmet.add(jaw);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(78, 12, 8), visorMaterial);
  visor.position.set(0, 4, 38);
  helmet.add(visor);

  helmet.userData.materials = [shellMaterial, visorMaterial];
  return helmet;
}

function createGauntletGroup(): THREE.Group {
  // Iron-Man-style forearm cuff: tapered cylinder with a gold knuckle band.
  const gauntlet = new THREE.Group();
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: "#cf2a2a",
    emissive: "#280506",
    metalness: 0.92,
    roughness: 0.32,
    transparent: true,
    opacity: 0
  });
  const bandMaterial = new THREE.MeshStandardMaterial({
    color: "#d4af37",
    emissive: "#7a5d05",
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.25,
    transparent: true,
    opacity: 0
  });

  // Cylinder is unit length 1 along Y by default; we set scale.y at runtime
  // to match forearm length. Origin sits at center of forearm.
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(18, 22, 1, 18, 1, false), shellMaterial);
  gauntlet.add(cuff);

  const knuckle = new THREE.Mesh(new THREE.TorusGeometry(20, 4, 12, 24), bandMaterial);
  knuckle.rotation.x = Math.PI / 2;
  knuckle.position.y = -0.5; // wrist end (cylinder local space; we override via group scale.y)
  gauntlet.add(knuckle);

  gauntlet.userData.materials = [shellMaterial, bandMaterial];
  gauntlet.userData.cuff = cuff;
  gauntlet.userData.knuckle = knuckle;
  return gauntlet;
}

export default function Tryon() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [hud, setHud] = useState<{ fps: number; conf: number; phase: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [snapBusy, setSnapBusy] = useState(false);
  const [debugLandmarks, setDebugLandmarks] = useState(false);
  const [overlayPoints, setOverlayPoints] = useState<OverlayPoint[]>([]);
  const debugRef = useRef(false);
  useEffect(() => {
    debugRef.current = debugLandmarks;
    if (!debugLandmarks) setOverlayPoints([]);
  }, [debugLandmarks]);

  const handleSnapshot = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || snapBusy) return;
    setSnapBusy(true);
    try {
      const blob = await captureSnapshot({ video, glCanvas: canvas, mirrorX: true });
      downloadBlob(blob, snapshotFilename());
    } catch (e) {
      console.error("Snapshot failed", e);
    } finally {
      setSnapBusy(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    let stream: MediaStream | null = null;
    let tracker: Awaited<ReturnType<typeof createPoseTracker>> | null = null;
    let frameId = 0;
    let disposed = false;
    let currentOpacity = 0;
    let targetOpacity = 0;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true // required for snapshot canvas readback
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    camera.position.set(0, 0, 600);

    scene.add(new THREE.HemisphereLight("#fff4dd", "#140708", 1.6));

    const directional = new THREE.DirectionalLight("#ffffff", 1.8);
    directional.position.set(140, 210, 360);
    scene.add(directional);

    const rim = new THREE.DirectionalLight("#fbc863", 0.8);
    rim.position.set(-180, 60, 260);
    scene.add(rim);

    const armor = createArmorGroup();
    scene.add(armor);
    const helmet = createHelmetGroup();
    scene.add(helmet);
    const leftGauntlet = createGauntletGroup();
    const rightGauntlet = createGauntletGroup();
    scene.add(leftGauntlet);
    scene.add(rightGauntlet);
    const leftBicep = createGauntletGroup();
    const rightBicep = createGauntletGroup();
    scene.add(leftBicep);
    scene.add(rightBicep);

    const syncRendererSize = () => {
      const rect = video.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));

      renderer.setSize(width, height, false);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
    };

    const smoother = createTransformSmoother();
    const helmetSmoother = createTransformSmoother();
    let helmetCurrentOpacity = 0;
    const leftGauntletSmoother = createTransformSmoother();
    const rightGauntletSmoother = createTransformSmoother();
    let leftGauntletOpacity = 0;
    let rightGauntletOpacity = 0;
    const leftBicepSmoother = createTransformSmoother();
    const rightBicepSmoother = createTransformSmoother();
    let leftBicepOpacity = 0;
    let rightBicepOpacity = 0;
    const gate = createTrackingGate();
    let frameTimes: number[] = [];
    let lastHudPush = 0;
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);

      if (!tracker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        renderer.render(scene, camera);
        return;
      }

      syncRendererSize();

      const detection = tracker.detect(video, performance.now());
      const rawTransform = detection.landmarks
        ? computeArmorTransform(detection.landmarks, { mirrorX: true })
        : null;
      const transform = smoother.push(rawTransform);

      if (transform) {
        const width = camera.right - camera.left;
        const height = camera.top - camera.bottom;
        const pixelScale = Math.max(transform.scale * width * 0.92, 1);

        armor.position.set(
          transform.position.x * width - width / 2,
          height / 2 - transform.position.y * height,
          transform.position.z * 120
        );
        armor.scale.setScalar(pixelScale / 140);
        armor.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
        // Confidence-driven opacity ceiling: hip-fallback path soft-anchors
        // at ~0.55, full-quality at 1.0. Floor at 0.45 so user still sees armor.
        targetOpacity = Math.max(0.45, transform.confidence);

        const phase = gate.push(true);
        if (phase === "locked") {
          setStatus((current) => (current === "locked" ? current : "locked"));
        } else {
          setStatus((current) => (current === "error" ? current : "searching"));
        }
      } else {
        targetOpacity = 0;
        gate.push(false);
        setStatus((current) => (current === "error" ? current : "searching"));
      }

      // HUD: rolling-window fps + last confidence + gate phase, throttled to 4 Hz
      const now = performance.now();
      frameTimes.push(now);
      while (frameTimes.length > 0 && now - frameTimes[0] > 1000) {
        frameTimes.shift();
      }
      if (now - lastHudPush > 250) {
        lastHudPush = now;
        setHud({
          fps: frameTimes.length,
          conf: transform ? Math.round(transform.confidence * 100) / 100 : 0,
          phase: transform ? "valid" : "none"
        });
      }

      currentOpacity = THREE.MathUtils.lerp(currentOpacity, targetOpacity, 0.18);
      setArmorOpacity(armor, currentOpacity);

      // Helmet pipeline (sibling to chest pipeline; same smoother + opacity grammar).
      const rawHelmet = detection.landmarks
        ? computeHelmetTransform(detection.landmarks, { mirrorX: true })
        : null;
      const helmetT = helmetSmoother.push(rawHelmet);
      let helmetTarget = 0;
      if (helmetT) {
        const width = camera.right - camera.left;
        const height = camera.top - camera.bottom;
        // Helmet pixel scale: ear-span normalized; tune divisor so the helmet
        // sits roughly head-sized over the nose anchor.
        const helmetPixel = Math.max(helmetT.scale * width * 1.05, 1);
        helmet.position.set(
          helmetT.position.x * width - width / 2,
          height / 2 - helmetT.position.y * height,
          helmetT.position.z * 120 + 20 // slight forward bias so it draws over chest
        );
        helmet.scale.setScalar(helmetPixel / 110);
        helmet.rotation.set(helmetT.rotation.x, helmetT.rotation.y, helmetT.rotation.z);
        helmetTarget = Math.max(0.45, helmetT.confidence);
      }
      helmetCurrentOpacity = THREE.MathUtils.lerp(helmetCurrentOpacity, helmetTarget, 0.18);
      setArmorOpacity(helmet, helmetCurrentOpacity);

      // Gauntlets: per-arm pipeline (own smoother, own opacity, own scale.y).
      const rawGauntlets = detection.landmarks
        ? computeGauntletTransforms(detection.landmarks, { mirrorX: true })
        : { left: null, right: null };
      const leftG = leftGauntletSmoother.push(rawGauntlets.left);
      const rightG = rightGauntletSmoother.push(rawGauntlets.right);
      const applyGauntlet = (group: THREE.Group, t: typeof leftG, prevOpacity: number): number => {
        let target = 0;
        if (t) {
          const width = camera.right - camera.left;
          const height = camera.top - camera.bottom;
          const lengthPx = Math.max(t.scale * height, 1);
          group.position.set(
            t.position.x * width - width / 2,
            height / 2 - t.position.y * height,
            t.position.z * 100
          );
          // Cylinder geometry has unit Y length; map forearm length to scale.y.
          // X/Z scales held at 1 so the cuff radius stays human-arm-sized.
          group.scale.set(1, lengthPx, 1);
          group.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
          target = Math.max(0.4, t.confidence);
        }
        const next = THREE.MathUtils.lerp(prevOpacity, target, 0.18);
        setArmorOpacity(group, next);
        return next;
      };
      leftGauntletOpacity = applyGauntlet(leftGauntlet, leftG, leftGauntletOpacity);
      rightGauntletOpacity = applyGauntlet(rightGauntlet, rightG, rightGauntletOpacity);

      const rawBiceps = detection.landmarks
        ? computeBicepTransforms(detection.landmarks, { mirrorX: true })
        : { left: null, right: null };
      const leftB = leftBicepSmoother.push(rawBiceps.left);
      const rightB = rightBicepSmoother.push(rawBiceps.right);
      leftBicepOpacity = applyGauntlet(leftBicep, leftB, leftBicepOpacity);
      rightBicepOpacity = applyGauntlet(rightBicep, rightB, rightBicepOpacity);

      if (debugRef.current) {
        setOverlayPoints(
          detection.landmarks ? buildOverlayPoints(detection.landmarks, { mirrorX: true }) : []
        );
      }

      renderer.render(scene, camera);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        video.srcObject = stream;
        await video.play();
        syncRendererSize();

        tracker = await createPoseTracker();

        if (disposed) {
          tracker.close();
          return;
        }

        setStatus("searching");
        animate();
      } catch (error) {
        console.error("Unable to initialize try-on prototype", error);
        setErrorMsg(describeCameraError(error));
        setStatus("error");
      }
    };

    setErrorMsg(null);
    setStatus("initializing");
    start();
    window.addEventListener("resize", syncRendererSize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", syncRendererSize);
      window.cancelAnimationFrame(frameId);
      tracker?.close();
      renderer.dispose();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt]);

  const statusStyle = STATUS_STYLES[status];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(238,186,73,0.18),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(207,42,42,0.22),transparent_24%),linear-gradient(180deg,#090b12_0%,#040507_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col rounded-[2rem] border border-white/10 bg-black/30 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[#f6d17d]">VirtualFit / VF-12</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Body-anchored armor prototype
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
              Front camera + on-device pose tracking lock a metallic chest plate to your torso in a
              mirrored selfie view.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${statusStyle.badge}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${statusStyle.dot}`} />
            <span>{statusStyle.label}</span>
          </div>
        </div>

        <div ref={rootRef} className="relative flex-1 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#06080d]">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent" />

          <button
            type="button"
            onClick={() => setDebugLandmarks((v) => !v)}
            className={`absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur transition ${
              debugLandmarks
                ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200 hover:bg-emerald-400/30"
                : "border-white/30 bg-white/10 text-white/80 hover:bg-white/20"
            }`}
            aria-pressed={debugLandmarks}
            aria-label="Toggle landmark overlay"
          >
            {debugLandmarks ? "Landmarks: on" : "Landmarks: off"}
          </button>

          {debugLandmarks && overlayPoints.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              aria-hidden
            >
              {visibleEdges(overlayPoints).map((edge, i) => {
                const a = overlayPoints.find((p) => p.id === edge.from);
                const b = overlayPoints.find((p) => p.id === edge.to);
                if (!a || !b) return null;
                return (
                  <line
                    key={`e${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgba(110,231,183,0.7)"
                    strokeWidth={0.0035}
                  />
                );
              })}
              {overlayPoints.map((p) => (
                <circle
                  key={`p${p.id}`}
                  cx={p.x}
                  cy={p.y}
                  r={0.008}
                  fill="rgba(110,231,183,0.95)"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={0.001}
                />
              ))}
            </svg>
          ) : null}

          <button
            type="button"
            onClick={handleSnapshot}
            disabled={snapBusy || status !== "locked"}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-[#f6d17d]/40 bg-[#f6d17d]/15 px-3.5 py-1.5 text-xs font-medium text-[#f6d17d] backdrop-blur transition hover:bg-[#f6d17d]/25 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Capture snapshot"
          >
            {snapBusy ? "Saving…" : "Snapshot"}
          </button>

          {hud ? (
            <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 font-mono text-[11px] leading-tight text-white/85 backdrop-blur">
              <div>fps {hud.fps}</div>
              <div>conf {hud.conf.toFixed(2)}</div>
              <div>{hud.phase}</div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur">
              <div className="max-w-sm rounded-2xl border border-rose-300/30 bg-rose-950/40 p-5 text-center">
                <p className="text-sm font-medium text-rose-100">{errorMsg ?? "Camera unavailable."}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-rose-200/40 bg-rose-100/10 px-4 py-1.5 text-sm font-medium text-rose-50 transition hover:bg-rose-100/20"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          <div className="absolute left-4 top-4 max-w-xs rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs leading-5 text-white/65 backdrop-blur">
            Raise your shoulders into frame and keep your torso visible from upper chest to hips for the
            cleanest lock.
          </div>
        </div>

        <footer className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>Camera + pose run entirely on your device. No frames leave your browser.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-white/80 transition hover:text-white"
          >
            Back to home
            <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </div>
    </main>
  );
}
