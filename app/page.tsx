import Link from "next/link";

export default function Home() {
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
        <p style={{ fontSize: 18, color: "#a1a1aa", margin: "0 0 48px", lineHeight: 1.6 }}>
          Try on clothes virtually using your camera.<br />
          Real-time body tracking. Instant fit preview.
        </p>

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

          <Link href="/admin" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "transform 0.15s",
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚙️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e4e4e7" }}>Admin</div>
              <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
                Manage garments
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
