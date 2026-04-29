"use client";

import { useEffect, useRef, useState } from "react";

import { GARMENT_LIBRARY } from "@/lib/garment-library";
import { canCapture, getStatusChip } from "@/lib/mirror-ui";
import { getCameraConstraints, mapCameraError, stopMediaStream } from "@/lib/webcam";

type CameraState = {
  code: string;
  message: string;
} | null;

const STATUS_LABELS = ["Idle", "Connecting", "Live", "Error"] as const;

const STATUS_TONE_STYLES = {
  slate: "border-white/10 bg-slate-400/15 text-slate-100",
  amber: "border-amber-300/25 bg-amber-300/15 text-amber-100",
  emerald: "border-emerald-300/25 bg-emerald-300/15 text-emerald-100",
  rose: "border-rose-300/25 bg-rose-300/15 text-rose-100"
} as const;

const STATUS_DOT_STYLES = {
  slate: "bg-slate-200",
  amber: "bg-amber-300",
  emerald: "bg-emerald-300",
  rose: "bg-rose-300"
} as const;

type WebcamMirrorProps = {
  availableMeshIds: string[];
};

function GarmentTray({ availableMeshIds }: WebcamMirrorProps) {
  const garments = GARMENT_LIBRARY.slice(0, 8);

  return (
    <aside className="absolute inset-x-3 top-3 z-20 md:inset-x-auto md:right-3 md:top-3 md:h-[calc(100%-1.5rem)] md:w-32">
      <div className="rounded-[1.8rem] border border-white/10 bg-black/35 p-3 backdrop-blur-xl md:flex md:h-full md:flex-col">
        <div className="mb-3 hidden md:block">
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/80">Wardrobe</p>
          <p className="mt-1 text-xs text-mist">Mapped garments</p>
        </div>
        <div className="flex gap-3 overflow-x-auto md:grid md:flex-1 md:auto-rows-[minmax(0,1fr)] md:gap-3 md:overflow-y-auto md:overflow-x-hidden pr-1">
          {garments.map((garment) => {
            const hasReadyMesh = availableMeshIds.includes(garment.id);

            return (
              <button
                key={garment.id}
                type="button"
                aria-label={`Try ${garment.name}`}
                onClick={() => {
                  console.warn(`Try-on for ${garment.id} lands in VF-9`);
                }}
                title={hasReadyMesh ? "3D mesh ready" : "Coming soon"}
                className="group relative min-h-24 min-w-24 flex-1 overflow-hidden rounded-[1.3rem] border border-white/10 bg-white/5 p-0 text-left opacity-95 transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:min-h-0 md:min-w-0"
              >
                <span
                  className={`absolute inset-0 bg-gradient-to-br ${garment.previewGradient[0]} ${garment.previewGradient[1]} opacity-80`}
                />
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_55%)]" />
                <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
                {hasReadyMesh ? (
                  <span className="absolute left-2 top-2 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                    Ready
                  </span>
                ) : (
                  <span className="absolute left-2 top-2 inline-flex rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    Coming soon
                  </span>
                )}
                <span className="absolute bottom-2 left-2 right-2 text-[11px] font-medium leading-tight text-white">
                  {garment.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export function WebcamMirror({ availableMeshIds }: WebcamMirrorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<CameraState>(null);
  const statusChip = getStatusChip({ isStarting, isActive, error });
  const captureEnabled = canCapture({ isActive, error: error ?? undefined });

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
    <section className="flex h-full min-h-0 flex-col">
      <div className="relative flex h-full min-h-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[#050814] shadow-halo">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(57,208,255,0.12),transparent_28%),linear-gradient(180deg,rgba(5,8,20,0.15)_0%,rgba(5,8,20,0.65)_100%)]" />
        <div className="absolute inset-0 bg-grid bg-[size:34px_34px] opacity-[0.08]" />

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full bg-[#02040b] object-cover md:aspect-auto"
          />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,20,0.08)_0%,rgba(5,8,20,0.32)_52%,rgba(5,8,20,0.72)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />

          <div className="absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-3 md:left-5 md:right-40 md:top-5">
            <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/80">Mirror feed</p>
              <p className="mt-1 text-sm text-white/85">Phase 1 live camera</p>
            </div>

            <div
              className={`inline-flex min-h-14 items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold backdrop-blur-xl ${STATUS_TONE_STYLES[statusChip.tone]}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_STYLES[statusChip.tone]}`} />
              <span>{statusChip.label}</span>
            </div>
          </div>

          {error ? (
            <div
              aria-live="assertive"
              className="absolute left-1/2 top-20 z-30 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-full border border-rose-300/25 bg-black/55 px-5 py-3 text-center text-sm text-rose-100 shadow-[0_20px_60px_rgba(244,63,94,0.18)] backdrop-blur-xl"
            >
              {error.message}
            </div>
          ) : null}

          <div className="absolute bottom-4 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 md:bottom-5 md:w-auto">
            <div className="flex flex-col items-stretch gap-3 rounded-[1.8rem] border border-white/10 bg-black/35 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-center">
              <button
                type="button"
                aria-label={isActive ? "Stop camera" : "Start camera"}
                onClick={isActive ? stopCamera : startCamera}
                disabled={isStarting}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-accent-cyan to-accent-emerald px-6 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:shadow-halo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActive ? "Stop camera" : isStarting ? "Starting..." : "Start camera"}
              </button>
              <button
                type="button"
                aria-label="Capture still image"
                disabled={!isActive || !captureEnabled}
                title={captureEnabled ? "Capture coming soon" : "Start camera first"}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                Capture
              </button>
              <button
                type="button"
                aria-label="Switch camera"
                aria-disabled="true"
                disabled
                title="Coming in Phase 2"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-45"
              >
                Switch camera
              </button>
            </div>
          </div>

          <GarmentTray availableMeshIds={availableMeshIds} />
        </div>
      </div>
      <div className="hidden">{STATUS_LABELS.join(" ")}</div>
    </section>
  );
}
