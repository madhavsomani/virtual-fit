"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { analytics } from "../lib/analytics";

interface Code {
  code: string;
  tier: string;
  days: number;
}

interface Redemption {
  code: string;
  email: string;
  tier: string;
  days: number;
  redeemedAt: string;
  expiresAt: string;
}

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Redemption | null>(null);
  const [validCodes, setValidCodes] = useState<Code[]>([]);

  useEffect(() => {
    analytics.pageView("/redeem");
    // Load valid codes from public JSON
    fetch("/codes.json")
      .then((res) => res.json())
      .then((codes) => setValidCodes(codes))
      .catch(() => setValidCodes([]));
  }, []);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const normalizedCode = code.trim().toUpperCase();
    
    // Check if code is valid
    const validCode = validCodes.find((c) => c.code === normalizedCode);
    if (!validCode) {
      setError("Invalid code. Please check and try again.");
      setLoading(false);
      return;
    }

    // Check if already redeemed (localStorage)
    const redemptions: Redemption[] = JSON.parse(localStorage.getItem("redemptions") || "[]");
    const alreadyRedeemed = redemptions.find((r) => r.code === normalizedCode);
    if (alreadyRedeemed) {
      setError("This code has already been redeemed.");
      setLoading(false);
      return;
    }

    // Check if this email already has an active subscription
    const existingForEmail = redemptions.find(
      (r) => r.email === email && new Date(r.expiresAt) > new Date()
    );
    if (existingForEmail) {
      setError(`You already have an active ${existingForEmail.tier} trial until ${new Date(existingForEmail.expiresAt).toLocaleDateString()}.`);
      setLoading(false);
      return;
    }

    // Redeem the code
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validCode.days * 24 * 60 * 60 * 1000);
    
    const redemption: Redemption = {
      code: normalizedCode,
      email,
      tier: validCode.tier,
      days: validCode.days,
      redeemedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    redemptions.push(redemption);
    localStorage.setItem("redemptions", JSON.stringify(redemptions));

    // Phase 7.23: removed direct `virtualfit_analytics` localStorage write
    // for `code_redeemed` event. The event was never in the typed
    // `EventName` union and had zero readers anywhere — pure write-only
    // orphan polluting the visitor's localStorage. If we ever want to
    // surface redemption counts, add `code_redeemed` to `EventName` in
    // `lib/analytics.ts` and call `analytics.track(...)` instead.

    setSuccess(redemption);
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>
            Code Redeemed!
          </h1>
          <p style={{ color: "#a1a1aa", marginBottom: 24 }}>
            You now have <strong style={{ color: "#6C5CE7" }}>{success.days} days</strong> of{" "}
            <strong style={{ color: "#6C5CE7" }}>{success.tier}</strong> access.
          </p>
          
          <div style={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            textAlign: "left",
          }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: "#71717a", fontSize: 12 }}>Email</span>
              <div style={{ color: "#fff" }}>{success.email}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: "#71717a", fontSize: 12 }}>Plan</span>
              <div style={{ color: "#6C5CE7", fontWeight: 600, textTransform: "capitalize" }}>
                {success.tier} (30 days free)
              </div>
            </div>
            <div>
              <span style={{ color: "#71717a", fontSize: 12 }}>Expires</span>
              <div style={{ color: "#fff" }}>{new Date(success.expiresAt).toLocaleDateString()}</div>
            </div>
          </div>

          <Link
            href="/mirror"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              background: "#6C5CE7",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Start Using VirtualFit →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c0c0e",
      color: "#e4e4e7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>
            Redeem Code
          </h1>
          <p style={{ color: "#a1a1aa", margin: 0 }}>
            Enter your code to unlock Creator features free for 30 days.
          </p>
        </div>

        <form onSubmit={handleRedeem}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "#71717a", fontSize: 13, marginBottom: 6 }}>
              Your Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid #27272a",
                background: "#18181b",
                color: "#e4e4e7",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: "#71717a", fontSize: 13, marginBottom: 6 }}>
              Promo Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VF-XXXXXX"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 16,
                fontFamily: "monospace",
                letterSpacing: 2,
                borderRadius: 8,
                border: "1px solid #27272a",
                background: "#18181b",
                color: "#e4e4e7",
                outline: "none",
                boxSizing: "border-box",
                textTransform: "uppercase",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: 12,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              color: "#ef4444",
              fontSize: 14,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              borderRadius: 8,
              background: loading ? "#555" : "#6C5CE7",
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Redeeming..." : "Redeem Code"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/pricing" style={{ color: "#6C5CE7", fontSize: 14 }}>
            Don&apos;t have a code? View pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
