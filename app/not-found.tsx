import Link from "next/link";

export default function NotFound() {
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
      <div style={{ fontSize: 72, marginBottom: 16 }}>🪞</div>
      <h1 style={{ fontSize: 48, fontWeight: 800, margin: "0 0 8px" }}>404</h1>
      <p style={{ fontSize: 18, color: "#a1a1aa", margin: "0 0 32px" }}>
        This page doesn&apos;t exist — but virtual try-on does!
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/"
          style={{
            padding: "12px 24px",
            background: "#6C5CE7",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Go Home
        </Link>
        <Link
          href="/mirror"
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
          Try On Clothes
        </Link>
      </div>
    </div>
  );
}
