"use client";

/*
BLOCKER for next pass: depth occlusion. Options: BlazePose 3D + manual z-sort vs
front-camera ARKit WebXR vs MediaPipe Selfie Segmentation as a body mask. Madhav
to pick direction.
*/

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { computeArmorTransform } from "@/lib/armor";
import { createPoseTracker } from "@/lib/pose";
import { createTransformSmoother } from "@/lib/smooth";

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

export default function Tryon() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<TrackingStatus>("initializing");

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
      antialias: true
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
        targetOpacity = 1;

        setStatus((current) => (current === "locked" ? current : "locked"));
      } else {
        targetOpacity = 0;
        setStatus((current) => (current === "error" ? current : "searching"));
      }

      currentOpacity = THREE.MathUtils.lerp(currentOpacity, targetOpacity, 0.18);
      setArmorOpacity(armor, currentOpacity);
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
        setStatus("error");
      }
    };

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
  }, []);

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
