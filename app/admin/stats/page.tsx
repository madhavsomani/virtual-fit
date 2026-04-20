"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AnalyticsEvent {
  timestamp: string;
  event: string;
  data?: Record<string, string | number | boolean>;
}

interface WaitlistEntry {
  email: string;
  timestamp: string;
  revenue?: string;
  wouldPay?: string;
  killerFeature?: string;
}

export default function StatsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simple URL token auth (check ?key=xxx)
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    
    // In production, use env var. For now, accept any key or "admin"
    if (key === "admin" || key === process.env.NEXT_PUBLIC_ADMIN_KEY || key) {
      setAuthorized(true);
    }

    // Load data from localStorage
    try {
      const analyticsData = localStorage.getItem("virtualfit_analytics");
      if (analyticsData) {
        setEvents(JSON.parse(analyticsData));
      }

      const waitlistData = localStorage.getItem("waitlist");
      if (waitlistData) {
        setWaitlist(JSON.parse(waitlistData));
      }
    } catch (e) {
      console.error("Failed to load stats:", e);
    }

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 24, color: "#fff" }}>
        Loading...
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
      }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>🔒 Stats Dashboard</h1>
          <p style={{ color: "#888" }}>Add ?key=admin to access</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const pageViews = events.filter(e => e.event === "page_view").length;
  const waitlistSignups = events.filter(e => e.event === "waitlist_signup").length;
  const checkoutStarts = events.filter(e => e.event === "checkout_start").length;
  const checkoutCompletes = events.filter(e => e.event === "checkout_complete").length;
  const mirrorOpens = events.filter(e => e.event === "mirror_open").length;

  // Group by page
  const pageViewsByPage: Record<string, number> = {};
  events.filter(e => e.event === "page_view").forEach(e => {
    const page = (e.data?.page as string) || "unknown";
    pageViewsByPage[page] = (pageViewsByPage[page] || 0) + 1;
  });

  // Recent events (last 10)
  const recentEvents = [...events].reverse().slice(0, 10);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: 0 }}>
              📊 VirtualFit Stats
            </h1>
            <p style={{ color: "#888", fontSize: 14, margin: "4px 0 0" }}>
              Client-side analytics dashboard
            </p>
          </div>
          <Link
            href="/admin"
            style={{
              padding: "10px 20px",
              background: "#333",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Key Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Page Views", value: pageViews, color: "#6C5CE7" },
            { label: "Waitlist Signups", value: waitlistSignups, color: "#00b894" },
            { label: "Checkout Starts", value: checkoutStarts, color: "#fdcb6e" },
            { label: "Checkout Complete", value: checkoutCompletes, color: "#00cec9" },
            { label: "Mirror Opens", value: mirrorOpens, color: "#e17055" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#111",
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
                border: "1px solid #222",
              }}
            >
              <div style={{ color: stat.color, fontSize: 36, fontWeight: 700 }}>
                {stat.value}
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Page Views Breakdown */}
        <div style={{ background: "#111", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #222" }}>
          <h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 16px" }}>📈 Page Views by Route</h3>
          {Object.keys(pageViewsByPage).length === 0 ? (
            <p style={{ color: "#666", fontSize: 14 }}>No page view data yet</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {Object.entries(pageViewsByPage).map(([page, count]) => (
                <div
                  key={page}
                  style={{
                    background: "#1a1a1a",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#6C5CE7" }}>{page}</span>
                  <span style={{ color: "#888", marginLeft: 8 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waitlist Entries */}
        <div style={{ background: "#111", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #222" }}>
          <h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 16px" }}>
            📧 Waitlist Entries ({waitlist.length})
          </h3>
          {waitlist.length === 0 ? (
            <p style={{ color: "#666", fontSize: 14 }}>No waitlist entries yet</p>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #333" }}>
                    <th style={{ textAlign: "left", padding: 8, color: "#888" }}>Email</th>
                    <th style={{ textAlign: "left", padding: 8, color: "#888" }}>Revenue</th>
                    <th style={{ textAlign: "left", padding: 8, color: "#888" }}>Would Pay</th>
                    <th style={{ textAlign: "left", padding: 8, color: "#888" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((entry, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                      <td style={{ padding: 8, color: "#fff" }}>{entry.email}</td>
                      <td style={{ padding: 8, color: "#888" }}>{entry.revenue || "-"}</td>
                      <td style={{ padding: 8, color: entry.wouldPay?.includes("Yes") ? "#00b894" : "#888" }}>
                        {entry.wouldPay || "-"}
                      </td>
                      <td style={{ padding: 8, color: "#666" }}>
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div style={{ background: "#111", borderRadius: 12, padding: 20, border: "1px solid #222" }}>
          <h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 16px" }}>🕐 Recent Events (Last 10)</h3>
          {recentEvents.length === 0 ? (
            <p style={{ color: "#666", fontSize: 14 }}>No events yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentEvents.map((event, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#1a1a1a",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ color: "#6C5CE7", fontWeight: 600 }}>{event.event}</span>
                    {event.data && (
                      <span style={{ color: "#666", marginLeft: 8 }}>
                        {JSON.stringify(event.data)}
                      </span>
                    )}
                  </div>
                  <span style={{ color: "#555", fontSize: 11 }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export Button */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button
            onClick={() => {
              const data = { events, waitlist, exportedAt: new Date().toISOString() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `virtualfit-stats-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
            }}
            style={{
              padding: "12px 24px",
              background: "#6C5CE7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📥 Export All Data (JSON)
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#444" }}>
          Data stored in browser localStorage • Clears when browser data is cleared
        </p>
      </div>
    </div>
  );
}
