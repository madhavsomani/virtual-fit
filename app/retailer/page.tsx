"use client";
import { useState } from "react";

export default function RetailerPage() {
  const [shopName, setShopName] = useState("");
  const [connected, setConnected] = useState(false);

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0c0c0e",
      color: "#e4e4e7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 24,
    }}>
      <div style={{
        maxWidth: 640,
        width: "100%",
        marginTop: 40,
      }}>
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🏪</div>
        <h1 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>
          Retailer Portal
        </h1>
        <p style={{ textAlign: "center", color: "#71717a", fontSize: 14, marginBottom: 32 }}>
          Let your customers try on clothes virtually — embed VirtualFit in your store.
        </p>

        {!connected ? (
          <div style={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 16,
            padding: "32px 28px",
          }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Shop Name
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Your Store Name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px",
                margin: "8px 0 16px",
                background: "#09090b",
                border: "1px solid #27272a",
                borderRadius: 8,
                color: "#e4e4e7",
                fontSize: 14,
              }}
            />
            <button
              onClick={() => shopName.trim() && setConnected(true)}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 10,
                background: "#6C5CE7",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Connect Store
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{shopName}</div>
                  <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>● Connected</div>
                </div>
                <button
                  onClick={() => setConnected(false)}
                  style={{
                    background: "none",
                    border: "1px solid #27272a",
                    borderRadius: 6,
                    color: "#71717a",
                    fontSize: 11,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>

            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 16,
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>📋 Embed Code</h3>
              <p style={{ color: "#71717a", fontSize: 13, marginBottom: 12 }}>
                Add this to your product pages to enable virtual try-on:
              </p>
              <pre style={{
                background: "#09090b",
                border: "1px solid #27272a",
                borderRadius: 8,
                padding: 16,
                fontSize: 12,
                overflow: "auto",
                color: "#a1a1aa",
              }}>
{`<iframe
  src="${typeof window !== 'undefined' ? window.location.origin : ''}/mirror?retailer=${encodeURIComponent(shopName)}"
  width="100%"
  height="600"
  frameborder="0"
  allow="camera"
/>`}
              </pre>
            </div>

            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 16,
            }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>📊 Analytics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { label: "Try-ons today", value: "—" },
                  { label: "Avg session", value: "—" },
                  { label: "Conversion", value: "—" },
                ].map((stat) => (
                  <div key={stat.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 16,
              padding: "24px 28px",
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>🔗 Quick Links</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/admin" style={{ color: "#6C5CE7", textDecoration: "none", fontSize: 14 }}>
                  → Manage Garment Inventory
                </a>
                <a href="/mirror" style={{ color: "#6C5CE7", textDecoration: "none", fontSize: 14 }}>
                  → Preview Try-On Experience
                </a>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 32 }}>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#71717a", textDecoration: "none", fontSize: 13 }}>← Back to Home</a>
        </div>
      </div>
    </main>
  );
}
