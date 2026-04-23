"use client";

import { useState, useRef } from "react";
import Link from "next/link";

// Phase 7.8: Tailscale URL fallback removed (HARD RULE: no Tailscale URLs in
// client code). `NEXT_PUBLIC_TRIPOSR_URL` is now mandatory; if unset, the page
// renders a clear configuration error instead of silently calling a personal
// dev machine.
const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TRIPOSR_URL) || "";

interface GenerationState {
  status: "idle" | "uploading" | "processing" | "done" | "error";
  progress: number;
  error?: string;
  resultUrl?: string;
  provider?: string;
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    // Start generation
    setState({ status: "uploading", progress: 10 });

    try {
      if (!API_URL) {
        throw new Error(
          "NEXT_PUBLIC_TRIPOSR_URL is not configured. Set it to your TRELLIS / Hunyuan3D-2 endpoint URL before using this page.",
        );
      }
      // Send the file directly as multipart/form-data to our self-hosted service
      const fd = new FormData();
      fd.append("image", file);
      fd.append("mode", "Turbo");

      setState({ status: "processing", progress: 25, provider: "hunyuan3d-2" });

      const res = await fetch(API_URL, { method: "POST", body: fd });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(`3D service error ${res.status}: ${txt.slice(0, 200)}`);
      }

      // Service returns the GLB binary directly. Convert to a blob URL we can load in Three.js.
      const glbBlob = await res.blob();
      const glbUrl = URL.createObjectURL(glbBlob);
      const provider = res.headers.get("X-Provider") || "hunyuan3d-2";
      const cache = res.headers.get("X-Cache") || "MISS";

      // Persist GLB to localStorage so it survives navigation to /mirror
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]; // strip data: prefix
          localStorage.setItem('virtualfit-glb-data', base64);
          localStorage.setItem('virtualfit-glb-provider', provider);
          localStorage.setItem('virtualfit-glb-ts', new Date().toISOString());
        };
        reader.readAsDataURL(glbBlob);
      } catch (e) {
        console.warn('Failed to persist GLB to localStorage:', e);
      }

      setState({
        status: "done",
        progress: 100,
        resultUrl: glbUrl,
        provider: `${provider} (${cache})`,
      });
      return;
    } catch (err) {
      setState({
        status: "error",
        progress: 0,
        error: err instanceof Error ? err.message : "Generation failed",
      });
      return;
    }

    // (legacy multi-provider code below kept for reference, never reached)
    try {
      // Convert file to base64 for the API
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const imageBase64 = await base64Promise;

      setState({ status: "processing", progress: 20 });

      // Call our multi-provider API
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `API error: ${res.status}`);
      }

      const data = await res.json();

      // If Meshy (async) — poll for completion
      if (data.status === "pending" && data.pollUrl) {
        setState({ status: "processing", progress: 30, provider: data.provider });
        const maxPolls = 60; // 5 min at 5s intervals
        for (let i = 0; i < maxPolls; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const pollRes = await fetch(data.pollUrl);
          const pollData = await pollRes.json();
          
          setState({
            status: "processing",
            progress: 30 + (pollData.progress || 0) * 0.6,
            provider: data.provider,
          });

          if (pollData.status === "completed" && pollData.glbUrl) {
            setState({
              status: "done",
              progress: 100,
              resultUrl: pollData.glbUrl,
              provider: data.provider,
            });
            return;
          }
          if (pollData.status === "failed") {
            throw new Error(pollData.error || "Generation failed");
          }
        }
        throw new Error("Generation timed out after 5 minutes");
      }

      // Immediate result (HF, Replicate). Phase 7.8: removed `isMock` flat-overlay
      // branch that returned a 2D texture URL — violated HARD RULE #1 (no 2D).
      if (data.isMock) {
        throw new Error(
          "Backend returned a mock/2D response. The vision is GLB-only — " +
            "configure a real Hunyuan3D-2 / TRELLIS endpoint.",
        );
      }
      if (!data.glbUrl) {
        throw new Error("Backend response missing glbUrl.");
      }
      setState({
        status: "done",
        progress: 100,
        resultUrl: data.glbUrl,
        provider: data.provider,
      });
    } catch (err) {
      setState({
        status: "error",
        progress: 0,
        error: err instanceof Error ? err.message : "Generation failed",
      });
    }
  };

  const reset = () => {
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
          🟢 Real 3D mesh generation powered by <strong>Hunyuan3D-2</strong> (Tencent).
          Typical generation: 5–15 sec. Note: this requires the home service to be online.
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
              Generation Failed
            </h2>
            <p
              style={{
                color: "#ef4444",
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              {state.error}
            </p>
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
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
