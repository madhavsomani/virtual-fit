export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>🪞 Magic Mirror</h1>
      <p style={{ color: "#999", marginBottom: 32 }}>
        Virtual try-on — right in your browser
      </p>
      <a
        href="/mirror"
        style={{
          padding: "16px 48px",
          fontSize: 20,
          background: "#6C5CE7",
          color: "#fff",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Try It On →
      </a>
    </div>
  );
}
