export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0c0e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "3px solid #27272a",
            borderTopColor: "#6C5CE7",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
