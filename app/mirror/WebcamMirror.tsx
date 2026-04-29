"use client";

import { useEffect, useRef, useState } from "react";

import { getCameraConstraints, mapCameraError, stopMediaStream } from "@/lib/webcam";

type CameraState = {
  code: string;
  message: string;
} | null;

export function WebcamMirror() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<CameraState>(null);

  useEffect(() => {
    return () => {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  async function startCamera() {
    if (isStarting) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      stopMediaStream(streamRef.current);

      const stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
    } catch (err) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setIsActive(false);
      setError(mapCameraError(err));
    } finally {
      setIsStarting(false);
    }
  }

  function stopCamera() {
    stopMediaStream(streamRef.current);
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    setError(null);
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
      <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#09101d]/90">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Phase 1 foundation</p>
            <p className="mt-1 text-lg font-medium text-white">Live webcam capture</p>
          </div>
          <button
            type="button"
            onClick={isActive ? stopCamera : startCamera}
            disabled={isStarting}
            className="inline-flex items-center justify-center rounded-full border border-white/[0.12] bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isActive ? "Stop camera" : isStarting ? "Starting..." : "Start camera"}
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div
              aria-live="assertive"
              className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
            >
              {error.message}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/30">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full bg-[#050814] object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
