"use client";

import { useState } from "react";

type Garment = {
  id: string;
  name: string;
  category: string;
  originalImage: string;
  processedImage: string | null;
  status: "uploading" | "processing" | "ready" | "failed";
  createdAt: string;
};

export default function AdminPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processImage = async (file: File) => {
    const id = `g-${Date.now()}`;
    const name = file.name.replace(/\.[^.]+$/, "");
    const originalUrl = URL.createObjectURL(file);

    // Add to inventory immediately with "uploading" status
    const newGarment: Garment = {
      id,
      name,
      category: "top",
      originalImage: originalUrl,
      processedImage: null,
      status: "uploading",
      createdAt: new Date().toISOString(),
    };
    setGarments((prev) => [newGarment, ...prev]);
    setUploading(true);

    try {
      // Step 1: Remove background via API
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "processing" as const } : g))
      );

      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/remove-bg", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Processing failed");

      // Step 2: Mark as ready with processed image
      setGarments((prev) =>
        prev.map((g) =>
          g.id === id
            ? { ...g, status: "ready" as const, processedImage: data.imageUrl }
            : g
        )
      );
    } catch {
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: "failed" as const } : g))
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (f.type.startsWith("image/")) processImage(f);
    });
  };

  const deleteGarment = (id: string) => {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 24 }}>
      {/* Header */}
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: 0 }}>
              🛠️ VirtualFit Admin
            </h1>
            <p style={{ color: "#888", fontSize: 14, margin: "4px 0 0" }}>
              Upload garment images → AI processes → ready for try-on
            </p>
          </div>
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

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
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
            input.onchange = () => handleFiles(input.files);
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
                  {/* Status badge */}
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: g.status === "ready" ? "#00b894" : g.status === "failed" ? "#e17055" : "#fdcb6e",
                    color: "#000",
                  }}>
                    {g.status === "ready" ? "✅ Ready" : g.status === "failed" ? "❌ Failed" : "⏳ Processing"}
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
                      href={`/mirror?garment=${encodeURIComponent(g.processedImage)}`}
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
    </div>
  );
}
