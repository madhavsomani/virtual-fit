import Link from "next/link";

export default function Home() {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <h1 style={{ color: "#fff", fontSize: 48, fontWeight: 800, margin: 0 }}>
        VirtualFit
      </h1>
      <p style={{ color: "#888", fontSize: 18, marginTop: 8, marginBottom: 40, textAlign: "center" }}>
        AI-powered virtual try-on. Upload any garment, see it on you instantly.
      </p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/mirror"
          style={{
            padding: "20px 40px", background: "#6C5CE7", color: "#fff",
            borderRadius: 12, textDecoration: "none", fontSize: 20, fontWeight: 700,
            transition: "transform 0.2s",
          }}
        >
          🪞 Try On (Mirror)
        </Link>

        <Link
          href="/admin"
          style={{
            padding: "20px 40px", background: "#222", color: "#fff",
            borderRadius: 12, textDecoration: "none", fontSize: 20, fontWeight: 700,
            border: "1px solid #444", transition: "transform 0.2s",
          }}
        >
          🛠️ Admin Panel
        </Link>
      </div>

      <div style={{ marginTop: 60, color: "#444", fontSize: 13, textAlign: "center" }}>
        <p>Built with Next.js • Three.js • MediaPipe • rembg</p>
        <p style={{ marginTop: 4 }}>© 2026 Madhav Somani</p>
      </div>
    </div>
  );
}
