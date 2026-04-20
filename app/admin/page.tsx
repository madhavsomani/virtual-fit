"use client";

import { useState, useCallback } from "react";

type Garment = {
  id: string;
  name: string;
  category: string;
  originalImage: string;
  processedImage: string | null;
  status: "pending" | "uploading" | "processing" | "ready" | "failed";
  progress: number;
  createdAt: string;
};

type PendingFile = {
  file: File;
  preview: string;
};

export default function AdminPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const processImage = async (file: File) => {
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name = file.name.replace(/\.[^.]+$/, "");
    const originalUrl = URL.createObjectURL(file);

    const newGarment: Garment = {
      id,
      name,
      category: "top",
      originalImage: originalUrl,
      processedImage: null,
      status: "uploading",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    setGarments((prev) => [newGarment, ...prev]);
    setUploading(true);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 30; i += 10) {
        await new Promise((r) => setTimeout(r, 100));
        setGarments((prev) =>
          prev.map((g) => (g.id === id ? { ...g, progress: i } : g))
        );
      }

      // Step 1: Processing
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "processing" as const, progress: 40 } : g))
      );

      // Simulate background removal (in production, call /api/remove-bg)
      // Since we're in static export, just use the original image
      for (let i = 40; i <= 90; i += 10) {
        await new Promise((r) => setTimeout(r, 200));
        setGarments((prev) =>
          prev.map((g) => (g.id === id ? { ...g, progress: i } : g))
        );
      }

      // Step 2: Mark as ready
      setGarments((prev) =>
        prev.map((g) =>
          g.id === id
            ? { ...g, status: "ready" as const, progress: 100, processedImage: originalUrl }
            : g
        )
      );

      showToast(`✅ "${name}" ready for try-on!`, "success");
      
      // Auto-redirect after short delay
      setTimeout(() => {
        window.location.href = `/mirror/?garment=${encodeURIComponent(originalUrl)}`;
      }, 1500);

    } catch {
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "failed" as const, progress: 0 } : g))
      );
      showToast(`❌ Failed to process "${name}"`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFilesForPreview = (files: FileList | null) => {
    if (!files) return;
    const newPending: PendingFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
    setPendingFiles((prev) => [...prev, ...newPending]);
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const processAllPending = async () => {
    const toProcess = [...pendingFiles];
    setPendingFiles([]);
    for (const { file } of toProcess) {
      await processImage(file);
    }
  };

  const deleteGarment = (id: string) => {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 24 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            padding: "12px 20px",
            borderRadius: 8,
            background: toast.type === "success" ? "#00b894" : "#e17055",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            animation: "slideIn 0.3s ease",
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: 0 }}>
              🛠️ VirtualFit Admin
            </h1>
            <p style={{ color: "#888", fontSize: 14, margin: "4px 0 0" }}>
              Upload garment images → AI processes → ready for try-on
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href="/admin/stats/?key=admin"
              style={{
                padding: "10px 20px", background: "#333", color: "#fff",
                borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14,
              }}
            >
              📊 Stats
            </a>
            <a
              href="/mirror"
              style={{
                padding: "10px 20px", background: "#6C5CE7", color: "#fff",
                borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14,
              }}
            >
              🪞 Open Mirror
            </a>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFilesForPreview(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${dragOver ? "#6C5CE7" : "#333"}`,
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            background: dragOver ? "rgba(108,92,231,0.1)" : "#111",
            transition: "all 0.2s",
            cursor: "pointer",
            marginBottom: 24,
          }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = () => handleFilesForPreview(input.files);
            input.click();
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>📸</div>
          <p style={{ color: "#aaa", fontSize: 16, margin: 0 }}>
            {uploading ? "⏳ Processing..." : "Drop garment images here or click to upload"}
          </p>
          <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
            Supports JPG, PNG • AI removes background automatically
          </p>
        </div>

        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <div style={{
            background: "#111",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            border: "1px solid #333",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ color: "#fff", margin: 0, fontSize: 16 }}>
                📋 Preview ({pendingFiles.length} image{pendingFiles.length > 1 ? "s" : ""})
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setPendingFiles([])}
                  style={{
                    padding: "8px 16px",
                    background: "#333",
                    border: "none",
                    borderRadius: 6,
                    color: "#aaa",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Clear All
                </button>
                <button
                  onClick={processAllPending}
                  disabled={uploading}
                  style={{
                    padding: "8px 16px",
                    background: uploading ? "#555" : "#6C5CE7",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    cursor: uploading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {uploading ? "Processing..." : "🚀 Process All"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {pendingFiles.map((pf, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    width: 100,
                    height: 100,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid #333",
                  }}
                >
                  <img
                    src={pf.preview}
                    alt={pf.file.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    onClick={() => removePending(i)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#e17055",
                      border: "none",
                      color: "#fff",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.7)",
                    padding: "4px 6px",
                    fontSize: 10,
                    color: "#aaa",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {pf.file.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total", value: garments.length, color: "#fff" },
            { label: "Ready", value: garments.filter((g) => g.status === "ready").length, color: "#00b894" },
            { label: "Processing", value: garments.filter((g) => g.status === "processing" || g.status === "uploading").length, color: "#fdcb6e" },
            { label: "Failed", value: garments.filter((g) => g.status === "failed").length, color: "#e17055" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#111", borderRadius: 8, padding: "12px 20px", flex: 1, textAlign: "center" }}>
              <div style={{ color: s.color, fontSize: 24, fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: "#888", fontSize: 12 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Garment Grid */}
        {garments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ color: "#555", fontSize: 16 }}>No garments yet. Upload some images to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {garments.map((g) => (
              <div
                key={g.id}
                style={{
                  background: "#111",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: g.status === "ready" ? "1px solid #333" : "1px solid #222",
                }}
              >
                {/* Image preview */}
                <div style={{ position: "relative", height: 220, background: "#0a0a0a" }}>
                  <img
                    src={g.processedImage || g.originalImage}
                    alt={g.name}
                    style={{
                      width: "100%", height: "100%", objectFit: "contain",
                      opacity: g.status === "ready" ? 1 : 0.5,
                    }}
                  />
                  {/* Progress bar */}
                  {(g.status === "uploading" || g.status === "processing") && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: "#333",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${g.progress}%`,
                        background: "#6C5CE7",
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                  )}
                  {/* Status badge */}
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: g.status === "ready" ? "#00b894" : g.status === "failed" ? "#e17055" : "#fdcb6e",
                    color: "#000",
                  }}>
                    {g.status === "ready" ? "✅ Ready" : g.status === "failed" ? "❌ Failed" : `⏳ ${g.progress}%`}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>{g.name}</p>
                      <p style={{ color: "#666", fontSize: 11, margin: "4px 0 0" }}>
                        {new Date(g.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteGarment(g.id)}
                      style={{
                        background: "none", border: "none", color: "#e17055",
                        cursor: "pointer", fontSize: 16, padding: 4,
                      }}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Try-on link */}
                  {g.status === "ready" && g.processedImage && (
                    <a
                      href={`/mirror/?garment=${encodeURIComponent(g.processedImage)}`}
                      style={{
                        display: "block", marginTop: 8, padding: "8px 0",
                        background: "#6C5CE7", color: "#fff", borderRadius: 6,
                        textAlign: "center", textDecoration: "none", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      👕 Try On
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
