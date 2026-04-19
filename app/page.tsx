"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    
    // TODO: Wire to actual email service (Resend, ConvertKit, etc.)
    // For now, save to localStorage and show success
    try {
      const existing = JSON.parse(localStorage.getItem("waitlist") || "[]");
      existing.push({ email, timestamp: new Date().toISOString() });
      localStorage.setItem("waitlist", JSON.stringify(existing));
      
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      console.error("Failed to save email:", err);
    }
    
    setLoading(false);
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0c0c0e",
      color: "#e4e4e7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ textAlign: "center", maxWidth: 600 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>👕</div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: "0 0 8px", letterSpacing: -1 }}>
          VirtualFit
        </h1>
        <p style={{ fontSize: 18, color: "#a1a1aa", margin: "0 0 32px", lineHeight: 1.6 }}>
          Try on clothes virtually using your camera.<br />
          Real-time body tracking. Instant fit preview.
        </p>

        {/* Email Capture */}
        <div style={{
          background: "linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(108,92,231,0.05) 100%)",
          border: "1px solid rgba(108,92,231,0.3)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
        }}>
          {submitted ? (
            <div style={{ color: "#6C5CE7", fontWeight: 600 }}>
              ✓ You&apos;re on the list! We&apos;ll notify you when we launch.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 12 }}>
                🚀 Get notified when we launch publicly
              </div>
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    flex: "1 1 200px",
                    padding: "12px 16px",
                    fontSize: 14,
                    borderRadius: 8,
                    border: "1px solid #27272a",
                    background: "#18181b",
                    color: "#e4e4e7",
                    outline: "none",
                    minWidth: 200,
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: "none",
                    background: "#6C5CE7",
                    color: "#fff",
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "..." : "Notify Me"}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          width: "100%",
          maxWidth: 520,
        }}>
          <Link href="/mirror" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#6C5CE7",
              borderRadius: 16,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.15s, opacity 0.15s",
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🪞</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Try On</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                Open the mirror
              </div>
            </div>
          </Link>

          <Link href="/pricing" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.15s",
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💳</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e4e4e7" }}>Pricing</div>
              <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
                View plans
              </div>
            </div>
          </Link>

          <Link href="/retailer" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.15s",
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏪</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e4e4e7" }}>Retailer</div>
              <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
                Embed in your store
              </div>
            </div>
          </Link>
        </div>

        <div style={{ marginTop: 48, display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { icon: "📸", label: "Real-time tracking" },
            { icon: "👕", label: "5 built-in garments" },
            { icon: "📱", label: "Mobile-friendly" },
            { icon: "🎨", label: "Color & style controls" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a", fontSize: 13 }}>
              <span>{f.icon}</span> {f.label}
            </div>
          ))}
        </div>

        <p style={{ marginTop: 48, fontSize: 12, color: "#3f3f46" }}>
          Built by Madhav Somani · Powered by MediaPipe + Three.js
        </p>
      </div>
    </main>
  );
}
