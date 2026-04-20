"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (could send to analytics)
    console.error("App error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        color: "#e4e4e7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 72, marginBottom: 16 }}>😵</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 16, color: "#a1a1aa", margin: "0 0 24px", maxWidth: 400 }}>
        The app encountered an error. This could be a camera issue or a temporary glitch.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "12px 24px",
            background: "#6C5CE7",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          style={{
            padding: "12px 24px",
            background: "#18181b",
            border: "1px solid #27272a",
            color: "#e4e4e7",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Go Home
        </a>
      </div>
      {error.digest && (
        <p style={{ marginTop: 32, fontSize: 11, color: "#3f3f46" }}>
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
