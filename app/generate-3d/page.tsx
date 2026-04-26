"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { imageToGlbPipeline, type PipelineProgress } from "../lib/image-to-glb";
import { humanizePipelineError, type HumanError } from "../lib/humanize-pipeline-error";
import { planAutoRetry, MAX_AUTO_RETRY_ATTEMPTS } from "../lib/auto-retry";

// Phase 7.43: rewired to the canonical `imageToGlbPipeline` (segformer/RMBG
// → microsoft/TRELLIS HF Space) used by /mirror's upload path. Pre-7.43 this
// page POSTed multipart/form-data to `NEXT_PUBLIC_TRIPOSR_URL`, which in
// production was unset (page rendered "❌ not configured") and locally
// pointed at `http://127.0.0.1:7860/generate3d` (a personal home machine
// that's offline most of the time). The landing page has always promoted
// /generate-3d, so every real visitor hit a broken page — same brand-trust
// class as Phases 7.32 / 7.33 / 7.40. Both /mirror and /generate-3d now
// share one canonical TRELLIS path.

interface GenerationState {
  status: "idle" | "uploading" | "processing" | "done" | "error";
  progress: number;
  error?: string;
  // Phase 7.92: humanized error surface so the UI can render title/body/action
  // separately + decide whether to show "Try Again" vs "Pick a different photo".
  humanError?: HumanError;
  resultUrl?: string;
  provider?: string;
  // Phase 7.94: countdown UI for queued auto-retry. countdownSec ticks down
  // each second; when it hits 0 the handler reruns the pipeline.
  retryCountdownSec?: number;
  retryAttempt?: number; // 1-indexed
  // Phase 7.8: `isMock`/`textureUrl`/`mockMessage` removed — they powered a 2D
  // flat-overlay fallback that violated HARD RULE #1 (no 2D garment rendering).
}

export default function Generate3DPage() {
  const [state, setState] = useState<GenerationState>({
    status: "idle",
    progress: 0,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Phase 7.94: track auto-retry attempts + last file + countdown timer so
  // retries can run from setTimeout without losing context.
  const fileRef = useRef<File | null>(null);
  const attemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRetryTimers = () => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
  };

  // Phase 7.97: Cancel-only handler. Stops the queued auto-retry but keeps the
  // humanError state visible so the user still sees "❌ <title> — <action>"
  // and a manual "Try Again" button. reset() (used by the in-error "Try Again" /
  // "Pick a different photo" path) clears the preview AND drops back to idle,
  // which is wrong here — the user wanted to stop waiting, not start over.
  const cancelAutoRetry = () => {
    clearRetryTimers();
    attemptsRef.current = 0;
    setState((s) => ({ ...s, retryCountdownSec: undefined, retryAttempt: undefined }));
  };

  const runPipeline = async (file: File) => {
    // Start generation
    setState({ status: "uploading", progress: 10 });

    try {
      // Phase 7.43: canonical TRELLIS pipeline. No env URL, no self-hosted
      // service — hits the public microsoft/TRELLIS HF Space directly.
      const { glbUrl: remoteGlbUrl, method } = await imageToGlbPipeline(file, {
        onProgress: (p: PipelineProgress) => {
          if (p.stage === "segmenting") {
            setState({ status: "processing", progress: 20, provider: "trellis" });
          } else if (p.stage === "trellis") {
            // fraction is 0..1; map to 25..95.
            const pct = 25 + Math.round((p.fraction ?? 0) * 70);
            setState({ status: "processing", progress: pct, provider: "trellis" });
          }
        },
      });

      // Fetch the GLB bytes (TRELLIS returns a remote URL we can pull).
      const resp = await fetch(remoteGlbUrl);
      if (!resp.ok) throw new Error(`GLB fetch ${resp.status}`);
      const glbBlob = await resp.blob();
      const glbUrl = URL.createObjectURL(glbBlob);
      const provider = `trellis+${method}`;

      // Persist GLB to localStorage so it survives navigation to /mirror.
      // Same keys /mirror reads in its load-from-storage branch.
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          localStorage.setItem("virtualfit-glb-data", base64);
          localStorage.setItem("virtualfit-glb-provider", provider);
          localStorage.setItem("virtualfit-glb-ts", new Date().toISOString());
        };
        reader.readAsDataURL(glbBlob);
      } catch (e) {
        console.warn("Failed to persist GLB to localStorage:", e);
      }

      // Success: clear retry state.
      attemptsRef.current = 0;
      clearRetryTimers();
      setState({
        status: "done",
        progress: 100,
        resultUrl: glbUrl,
        provider,
      });
    } catch (err) {
      // Phase 7.92: humanize for the UI; keep raw .message in `error` for dev consoles.
      const humanError = humanizePipelineError(err);
      const rawMsg = err instanceof Error ? err.message : "Generation failed";

      // Phase 7.94: schedule auto-retry for retryable transient failures.
      const plan = planAutoRetry(humanError, attemptsRef.current);
      if (plan) {
        attemptsRef.current = plan.attempt;
        const totalSec = Math.round(plan.delayMs / 1000);
        setState({
          status: "error",
          progress: 0,
          error: rawMsg,
          humanError,
          retryCountdownSec: totalSec,
          retryAttempt: plan.attempt,
        });
        // Tick the countdown each second so the UI shows "Auto-retry in 27s...".
        let remaining = totalSec;
        countdownTimerRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
            return;
          }
          setState((s) => ({ ...s, retryCountdownSec: remaining }));
        }, 1000);
        retryTimerRef.current = setTimeout(() => {
          clearRetryTimers();
          void runPipeline(file);
        }, plan.delayMs);
        return;
      }

      // No auto-retry: manual recovery (retry count exhausted, non-retryable, or Cancelled).
      attemptsRef.current = 0;
      clearRetryTimers();
      setState({
        status: "error",
        progress: 0,
        error: rawMsg,
        humanError,
      });
    }

    // Phase 7.27/7.43: legacy multi-provider/Hunyuan3D dead code removed.
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    // Cancel any in-flight retry from a prior file, reset attempts.
    clearRetryTimers();
    attemptsRef.current = 0;
    fileRef.current = file;
    await runPipeline(file);
  };

  const reset = () => {
    clearRetryTimers();
    attemptsRef.current = 0;
    fileRef.current = null;
    setState({ status: "idle", progress: 0 });
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
              🎨 Generate 3D Garment
            </h1>
            <p style={{ color: "#71717a", fontSize: 14, margin: "4px 0 0" }}>
              Upload a clothing image to create a 3D model
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

        {/* Provider info banner */}
        <div
          style={{
            background: "#0c4a6e",
            color: "#bae6fd",
            padding: 12,
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 13,
            border: "1px solid #0369a1",
          }}
        >
          🟢 Real 3D mesh generation powered by <strong>microsoft/TRELLIS</strong> via
          HuggingFace Space (free ZeroGPU tier). Typical generation: 30–60 sec.
        </div>

        {/* Upload area */}
        {state.status === "idle" && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed #27272a",
              borderRadius: 16,
              padding: 48,
              textAlign: "center",
              cursor: "pointer",
              background: "#18181b",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              Click to upload a garment image
            </p>
            <p style={{ color: "#71717a", fontSize: 13 }}>
              JPG, PNG up to 10MB. Best results with plain background.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>
        )}

        {/* Processing state */}
        {(state.status === "uploading" || state.status === "processing") && (
          <div
            style={{
              background: "#18181b",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
            }}
          >
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  width: 150,
                  height: 150,
                  objectFit: "cover",
                  borderRadius: 12,
                  marginBottom: 24,
                }}
              />
            )}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: "#27272a",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${state.progress}%`,
                    height: "100%",
                    background: "#6C5CE7",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>
            <p style={{ color: "#a1a1aa", fontSize: 14 }}>
              {state.status === "uploading"
                ? "Uploading image..."
                : `Generating 3D model via ${state.provider || 'AI'}... This may take 30-60 seconds.`}
            </p>
          </div>
        )}

        {/* Done state */}
        {state.status === "done" && (
          <div
            style={{
              background: "#18181b",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "#10B981",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 32,
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              🧊 3D Model Ready!
            </h2>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 8 }}>
              {`Generated via ${state.provider || 'AI'}`}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link
                href="/mirror?garment=local"
                style={{ textDecoration: "none" }}
              >
                <button
                  style={{
                    padding: "12px 24px",
                    background: "#6C5CE7",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  Try On →
                </button>
              </Link>
              <button
                onClick={reset}
                style={{
                  padding: "12px 24px",
                  background: "#27272a",
                  border: "none",
                  borderRadius: 10,
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {state.status === "error" && (
          <div
            style={{
              background: "#18181b",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "#ef4444",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 32,
              }}
            >
              ✕
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {state.humanError?.title ?? "Generation Failed"}
            </h2>
            <p
              style={{
                color: "#e4e4e7",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              {state.humanError?.body ?? state.error}
            </p>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: 13,
                marginBottom: 24,
              }}
            >
              {state.humanError?.action ?? ""}
            </p>
            {state.retryCountdownSec !== undefined && state.retryCountdownSec > 0 && (
              <p
                style={{
                  color: "#fbbf24",
                  fontSize: 14,
                  marginBottom: 16,
                  fontWeight: 600,
                }}
              >
                Auto-retrying in {state.retryCountdownSec}s… (attempt {state.retryAttempt} of {MAX_AUTO_RETRY_ATTEMPTS})
              </p>
            )}
            {state.retryCountdownSec !== undefined && state.retryCountdownSec > 0 ? (
              // Phase 7.97: dedicated red Cancel button during the countdown
              // window, parity with mirror 7.96. Distinct from the gray
              // Try Again / Pick-a-different-photo control so the user clearly
              // sees the "stop waiting" affordance.
              <button
                onClick={cancelAutoRetry}
                style={{
                  padding: "12px 24px",
                  background: "#ef4444",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                ✕ Cancel auto-retry ({state.retryCountdownSec}s)
              </button>
            ) : (
              <button
                onClick={reset}
                style={{
                  padding: "12px 24px",
                  background: "#27272a",
                  border: "none",
                  borderRadius: 10,
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                {state.humanError?.retryable === false ? "Pick a different photo" : "Try Again"}
              </button>
            )}
            {state.error && (
              <details style={{ marginTop: 16, fontSize: 12, color: "#71717a" }}>
                <summary style={{ cursor: "pointer" }}>Show technical details</summary>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, textAlign: "left" }}>{state.error}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
