"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { analytics } from "./lib/analytics";

export default function Home() {
  const [email, setEmail] = useState("");
  const [revenue, setRevenue] = useState("");
  const [wouldPay, setWouldPay] = useState("");
  const [killerFeature, setKillerFeature] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSurvey, setShowSurvey] = useState(false);

  useEffect(() => {
    analytics.pageView("/");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // First submit: just email → show survey questions
    if (!showSurvey) {
      setShowSurvey(true);
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          revenue,
          wouldPay,
          killerFeature,
          source: 'homepage',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');
      
      // Also save locally as backup
      const existing = JSON.parse(localStorage.getItem("waitlist") || "[]");
      existing.push({ email, revenue, wouldPay, killerFeature, timestamp: new Date().toISOString() });
      localStorage.setItem("waitlist", JSON.stringify(existing));
      
      analytics.waitlistSignup(email);
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      console.error("Waitlist submit failed:", err);
      // Fallback: save locally even if API fails
      const existing = JSON.parse(localStorage.getItem("waitlist") || "[]");
      existing.push({ email, revenue, wouldPay, killerFeature, timestamp: new Date().toISOString() });
      localStorage.setItem("waitlist", JSON.stringify(existing));
      analytics.waitlistSignup(email);
      setSubmitted(true);
      setEmail("");
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
              ✓ You&apos;re on the list! We&apos;ll reach out soon.
            </div>
          ) : !showSurvey ? (
            <>
              <div style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 12 }}>
                🚀 Join the waitlist — be first to embed virtual try-on in your store
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
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: "none",
                    background: "#6C5CE7",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Join Waitlist
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 16, textAlign: "center" }}>
                📊 Quick questions to help us build the right product for you
              </div>
              
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
                  What&apos;s your store&apos;s monthly revenue?
                </span>
                <select
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 14,
                    borderRadius: 8, border: "1px solid #27272a",
                    background: "#18181b", color: "#e4e4e7",
                  }}
                >
                  <option value="">Select...</option>
                  <option value="pre-launch">Pre-launch / Side project</option>
                  <option value="0-10k">$0 – $10K/mo</option>
                  <option value="10k-50k">$10K – $50K/mo</option>
                  <option value="50k-200k">$50K – $200K/mo</option>
                  <option value="200k+">$200K+/mo</option>
                </select>
              </label>

              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
                  Would you pay $49/mo for embeddable virtual try-on?
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Yes, definitely", "Maybe, need to test first", "No, too expensive", "No, not useful"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWouldPay(opt)}
                      style={{
                        padding: "8px 14px", fontSize: 13, borderRadius: 8,
                        border: wouldPay === opt ? "2px solid #6C5CE7" : "1px solid #27272a",
                        background: wouldPay === opt ? "rgba(108,92,231,0.2)" : "#18181b",
                        color: wouldPay === opt ? "#a29bfe" : "#a1a1aa",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </label>

              <label style={{ display: "block", marginBottom: 20 }}>
                <span style={{ fontSize: 13, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
                  What 1 feature would make this a no-brainer?
                </span>
                <input
                  type="text"
                  value={killerFeature}
                  onChange={(e) => setKillerFeature(e.target.value)}
                  placeholder="e.g. Works with my Shopify store"
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 14,
                    borderRadius: 8, border: "1px solid #27272a",
                    background: "#18181b", color: "#e4e4e7", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "12px 32px", fontSize: 15, fontWeight: 600,
                    borderRadius: 8, border: "none",
                    background: "#6C5CE7", color: "#fff",
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Submitting..." : "✨ Join Waitlist"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Skip survey, submit email only
                    setLoading(true);
                    fetch('/api/waitlist', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, source: 'homepage-skip' }),
                    }).finally(() => {
                      setSubmitted(true);
                      setLoading(false);
                    });
                  }}
                  style={{
                    padding: "12px 20px", fontSize: 13,
                    borderRadius: 8, border: "1px solid #27272a",
                    background: "transparent", color: "#71717a",
                    cursor: "pointer",
                  }}
                >
                  Skip &rarr;
                </button>
              </div>
            </form>
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
