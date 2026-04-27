"use client";
//
// Phase 7.107 — read-only session-telemetry inspection page.
//
// Purpose: internal testers can opt in via /mirror?debugTelemetry=1, run a
// few sessions, then visit /debug/telemetry to see the persisted summaries
// without opening DevTools. CSV export hands the data straight to a sheet.
//
// HARD CONTRACTS (locked by tests/debug-telemetry-page-wiring.test.mjs):
//   - READ-ONLY: this page imports readSessionSummaries + clearSessionSummaries
//     ONLY. It does not import appendSessionSummary; it cannot manufacture
//     telemetry. The only writes happen via the explicit Clear button.
//   - NO NETWORK: no fetch / XMLHttpRequest / sendBeacon. The CSV download is
//     a client-side Blob / data: URL — bytes never leave the device.
//   - PII-free by construction: it only renders fields the 7.106 wiring
//     already produced. The wiring's static-grep guard (PII ban-list) means
//     there are no UA / device / email / IP fields to render in the first place.

import { useEffect, useState } from "react";
import {
  readSessionSummaries,
  clearSessionSummaries,
} from "../../mirror/session-summary-log.js";
import { summariesToCsv, CSV_COLUMNS } from "../../mirror/session-summary-csv.js";
import { aggregateSummaries } from "../../mirror/session-summary-aggregate.js";

type Summary = ReturnType<typeof readSessionSummaries>[number];

function formatRatio(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatMs(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n < 1000) return `${n} ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${(s / 60).toFixed(1)} min`;
}

function formatDateTime(ms: unknown): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

export default function DebugTelemetryPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSummaries(readSessionSummaries({ expectedSchemaVersion: 1 }));
    setLoaded(true);
  }, []);

  const handleClear = () => {
    if (typeof window !== "undefined" && !window.confirm("Delete all stored telemetry summaries?")) {
      return;
    }
    clearSessionSummaries();
    setSummaries([]);
  };

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    const csv = summariesToCsv(summaries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `virtualfit-telemetry-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#222" }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Session Telemetry (debug)</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Read-only view of locally persisted 6-DOF tracking summaries.
        Captured only when <code>/mirror?debugTelemetry=1</code> is opted into.
        Nothing on this page leaves your device.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <strong>{summaries.length} session{summaries.length === 1 ? "" : "s"}</strong>
        <button
          onClick={handleDownload}
          disabled={summaries.length === 0}
          data-testid="telemetry-download-csv"
          style={{
            padding: "8px 14px", borderRadius: 6, border: "1px solid #2563eb",
            background: summaries.length === 0 ? "#e5e7eb" : "#2563eb",
            color: summaries.length === 0 ? "#888" : "white",
            cursor: summaries.length === 0 ? "not-allowed" : "pointer", fontWeight: 600,
          }}
        >Download CSV</button>
        <button
          onClick={handleClear}
          disabled={summaries.length === 0}
          data-testid="telemetry-clear"
          style={{
            padding: "8px 14px", borderRadius: 6, border: "1px solid #dc2626",
            background: "white", color: summaries.length === 0 ? "#aaa" : "#dc2626",
            cursor: summaries.length === 0 ? "not-allowed" : "pointer", fontWeight: 600,
          }}
        >Clear</button>
      </div>

      {!loaded && <p>Loading…</p>}
      {loaded && summaries.length === 0 && (
        <div style={{ padding: 24, background: "#f3f4f6", borderRadius: 8, color: "#444" }}>
          <p style={{ margin: 0 }}>No sessions captured yet.</p>
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 14 }}>
            Visit <code>/mirror?debugTelemetry=1</code>, run a session with the camera,
            press <strong>Stop</strong>, then return here.
          </p>
        </div>
      )}

      {loaded && summaries.length > 0 && (() => {
        // Phase 7.108: at-a-glance reliability rollup. Pure derivation —
        // re-runs every render, no memo needed (input is local-only and
        // capped at 20 entries by the 7.105 ring buffer).
        const agg = aggregateSummaries(summaries);
        const ratio = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
        const dist = agg.worstAxisDistribution;
        return (
          <section
            data-testid="telemetry-rollup"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12, marginBottom: 24, padding: 16,
              background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Sessions</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{agg.sessionCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Total frames</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{agg.totalFrames.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Median held %</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{ratio(agg.medianHeldRatio)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Worst-axis distribution</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                yaw {dist.yaw} · pitch {dist.pitch} · roll {dist.roll} · depth {dist.depth}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Per-axis median held %</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                yaw {ratio(agg.perAxisMedianHeldRatio.yaw)} · pitch {ratio(agg.perAxisMedianHeldRatio.pitch)} ·
                roll {ratio(agg.perAxisMedianHeldRatio.roll)} · depth {ratio(agg.perAxisMedianHeldRatio.depth)}
              </div>
            </div>
          </section>
        );
      })()}

      {loaded && summaries.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table data-testid="telemetry-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: "8px 10px" }}>Started</th>
                <th style={{ padding: "8px 10px" }}>Duration</th>
                <th style={{ padding: "8px 10px" }}>Frames</th>
                <th style={{ padding: "8px 10px" }}>Worst axis</th>
                <th style={{ padding: "8px 10px" }}>Held %</th>
                <th style={{ padding: "8px 10px" }}>Yaw / Pitch / Roll / Depth (held %)</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, i) => (
                <tr key={s?.sessionId ?? i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 10px" }}>{formatDateTime(s?.startedAtMs)}</td>
                  <td style={{ padding: "8px 10px" }}>{formatMs(s?.durationMs)}</td>
                  <td style={{ padding: "8px 10px" }}>{s?.totalFrames ?? "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{s?.worstAxis ?? "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{formatRatio(s?.overallHeldRatio)}</td>
                  <td style={{ padding: "8px 10px", color: "#555" }}>
                    {formatRatio(s?.heldRatio?.yaw)} / {formatRatio(s?.heldRatio?.pitch)} /{" "}
                    {formatRatio(s?.heldRatio?.roll)} / {formatRatio(s?.heldRatio?.depth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
            CSV columns: {CSV_COLUMNS.join(", ")}
          </p>
        </div>
      )}
    </main>
  );
}
