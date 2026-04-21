"use client";

import { useState, useRef } from "react";
import Link from "next/link";

// HuggingFace Inference API for TripoSR
// Note: Requires NEXT_PUBLIC_HF_TOKEN env var
const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/TripoSR";

interface GenerationState {
  status: "idle" | "uploading" | "processing" | "done" | "error";
  progress: number;
  error?: string;
  resultUrl?: string;
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
      // Check for HF token
      const token = process.env.NEXT_PUBLIC_HF_TOKEN;
      if (!token) {
        setState({
          status: "error",
          progress: 0,
          error: "3D generation is not configured. NEXT_PUBLIC_HF_TOKEN required. The 2D try-on at /mirror works without this.",
        });
        return;
      }

      // Real API call
      setState({ status: "processing", progress: 30 });
      
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      setState({ status: "processing", progress: 70 });

      // Get GLB blob
      const blob = await response.blob();
      const resultUrl = URL.createObjectURL(blob);

      setState({
        status: "done",
        progress: 100,
        resultUrl,
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

        {/* API not configured warning */}
        {!process.env.NEXT_PUBLIC_HF_TOKEN && (
          <div
            style={{
              background: "#fecaca",
              color: "#991b1b",
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 13,
              border: "1px solid #f87171",
            }}
          >
            <strong>🛑 3D Generation Unavailable:</strong> The AI model API key is not configured.
            Uploads will fail. Use <a href="/mirror" style={{ color: "#6C5CE7", fontWeight: 600 }}>/mirror</a> for 2D virtual try-on (works now).
          </div>
        )}

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
                : "Generating 3D model... This may take 30-60 seconds."}
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
              3D Model Ready!
            </h2>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 24 }}>
              Your garment has been converted to 3D
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link
                href={`/mirror-3d?model=${encodeURIComponent(state.resultUrl || "")}`}
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
