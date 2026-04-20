"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { analytics } from "../lib/analytics";

interface SavedGarment {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: string;
  isFavorite?: boolean;
}

export default function GalleryPage() {
  const [garments, setGarments] = useState<SavedGarment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.pageView("/gallery");
    const saved = localStorage.getItem("savedGarments");
    if (saved) {
      setGarments(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const toggleFavorite = (id: string) => {
    const updated = garments.map((g) =>
      g.id === id ? { ...g, isFavorite: !g.isFavorite } : g
    );
    setGarments(updated);
    localStorage.setItem("savedGarments", JSON.stringify(updated));
  };

  const deleteGarment = (id: string) => {
    const updated = garments.filter((g) => g.id !== id);
    setGarments(updated);
    localStorage.setItem("savedGarments", JSON.stringify(updated));
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
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
              👗 My Garments
            </h1>
            <p style={{ color: "#71717a", fontSize: 14, margin: "4px 0 0" }}>
              Your saved try-on garments
            </p>
          </div>
          <Link href="/mirror" style={{ textDecoration: "none" }}>
            <button
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                borderRadius: 10,
                background: "#6C5CE7",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Try On New →
            </button>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#71717a" }}>
            Loading...
          </div>
        ) : garments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 64,
              background: "#18181b",
              borderRadius: 16,
              border: "1px solid #27272a",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
              No saved garments yet
            </h2>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 24 }}>
              Try on some garments and save your favorites!
            </p>
            <Link href="/mirror" style={{ textDecoration: "none" }}>
              <button
                style={{
                  padding: "14px 28px",
                  fontSize: 16,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 12,
                  background: "#6C5CE7",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Start Trying On
              </button>
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {garments.map((garment) => (
              <div
                key={garment.id}
                style={{
                  background: "#18181b",
                  borderRadius: 12,
                  border: "1px solid #27272a",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 200,
                    background: "#27272a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {garment.thumbnail ? (
                    <img
                      src={garment.thumbnail}
                      alt={garment.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 48 }}>👕</span>
                  )}
                </div>
                <div style={{ padding: 12 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      marginBottom: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {garment.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#71717a",
                      marginBottom: 8,
                    }}
                  >
                    {new Date(garment.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => toggleFavorite(garment.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: 12,
                        border: "1px solid #27272a",
                        borderRadius: 6,
                        background: garment.isFavorite ? "#fef3c7" : "transparent",
                        color: garment.isFavorite ? "#92400e" : "#a1a1aa",
                        cursor: "pointer",
                      }}
                    >
                      {garment.isFavorite ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => deleteGarment(garment.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: 12,
                        border: "1px solid #27272a",
                        borderRadius: 6,
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: 64, fontSize: 12, color: "#3f3f46" }}>
          <Link href="/" style={{ color: "#6C5CE7", textDecoration: "none" }}>
            ← Back to Home
          </Link>
        </p>
      </div>
    </main>
  );
}
