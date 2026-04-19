"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const plan = searchParams.get("plan");

  const planNames: Record<string, string> = {
    creator: "Creator",
    retailer: "Retailer",
  };

  const planName = plan ? planNames[plan] || plan : "your";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <div
          style={{
            width: 80,
            height: 80,
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 40,
          }}
        >
          ✓
        </div>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            margin: "0 0 12px",
          }}
        >
          Welcome to VirtualFit {planName}!
        </h1>

        <p
          style={{
            fontSize: 16,
            color: "#a1a1aa",
            margin: "0 0 32px",
            lineHeight: 1.6,
          }}
        >
          Your subscription is now active. You have full access to all {planName}{" "}
          features.
        </p>

        {sessionId && (
          <div
            style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 12,
              padding: 16,
              marginBottom: 32,
              fontSize: 12,
              color: "#71717a",
            }}
          >
            <div style={{ marginBottom: 4, color: "#a1a1aa" }}>
              Confirmation ID:
            </div>
            <code style={{ color: "#6C5CE7", wordBreak: "break-all" }}>
              {sessionId}
            </code>
            <div
              style={{
                marginTop: 8,
                padding: "4px 8px",
                background: "#fef3c7",
                color: "#92400e",
                borderRadius: 4,
                display: "inline-block",
              }}
            >
              TEST MODE - No charge made
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
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
              Start Trying On →
            </button>
          </Link>
          <Link href="/" style={{ textDecoration: "none" }}>
            <button
              style={{
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: 600,
                border: "1px solid #27272a",
                borderRadius: 12,
                background: "transparent",
                color: "#a1a1aa",
                cursor: "pointer",
              }}
            >
              Back Home
            </button>
          </Link>
        </div>

        <p style={{ marginTop: 48, fontSize: 12, color: "#3f3f46" }}>
          Questions? Email us at support@virtualfit.app
        </p>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#0c0c0e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#71717a",
          }}
        >
          Loading...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
