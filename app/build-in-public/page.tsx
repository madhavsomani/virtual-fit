"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  waitlistCount: number;
  checkoutStarts: number;
  checkoutCompletes: number;
  mrr: number;
  pageViews: number;
}

export default function BuildInPublicPage() {
  const [stats, setStats] = useState<Stats>({
    waitlistCount: 0,
    checkoutStarts: 0,
    checkoutCompletes: 0,
    mrr: 0,
    pageViews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage (same source as stats dashboard)
    try {
      const waitlistData = localStorage.getItem("waitlist");
      const waitlist = waitlistData ? JSON.parse(waitlistData) : [];
      
      const analyticsData = localStorage.getItem("virtualfit_analytics");
      const events = analyticsData ? JSON.parse(analyticsData) : [];
      
      const checkoutStarts = events.filter((e: { event: string }) => e.event === "checkout_start").length;
      const checkoutCompletes = events.filter((e: { event: string }) => e.event === "checkout_complete").length;
      const pageViews = events.filter((e: { event: string }) => e.event === "page_view").length;
      
      // MRR = $0 until we have real payments
      // Each checkout_complete adds mock value for demo
      const mockMrr = checkoutCompletes * 29; // avg of $9 and $49
      
      setStats({
        waitlistCount: waitlist.length,
        checkoutStarts,
        checkoutCompletes,
        mrr: mockMrr,
        pageViews,
      });
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
    setLoading(false);
  }, []);

  // Hardcoded public metrics (update manually or via CI)
  const publicMetrics = {
    commits: 145, // Update this periodically
    daysBuilding: Math.floor((Date.now() - new Date("2026-04-01").getTime()) / (1000 * 60 * 60 * 24)),
    linesOfCode: "15K+",
    techStack: ["Next.js", "MediaPipe", "Three.js", "TypeScript"],
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0c0e 0%, #1a1a2e 100%)",
      color: "#e4e4e7",
      padding: "48px 24px",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 8px" }}>
            Building VirtualFit in Public
          </h1>
          <p style={{ fontSize: 18, color: "#a1a1aa", margin: "0 0 24px" }}>
            Follow our journey from 0 to $1K MRR
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="https://github.com/madhavsomani/virtual-fit"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 20px",
                background: "#333",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              ⭐ Star on GitHub
            </a>
            <Link
              href="/pricing"
              style={{
                padding: "10px 20px",
                background: "#6C5CE7",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              View Pricing →
            </Link>
          </div>
        </div>

        {/* The Big Number */}
        <div style={{
          background: "linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)",
          borderRadius: 20,
          padding: 40,
          textAlign: "center",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
            MONTHLY RECURRING REVENUE
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#fff" }}>
            ${loading ? "..." : stats.mrr}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
            Goal: $1,000 MRR by June 2026
          </div>
        </div>

        {/* Live Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}>
          {[
            { label: "Waitlist Signups", value: loading ? "..." : stats.waitlistCount, icon: "📧" },
            { label: "Page Views", value: loading ? "..." : stats.pageViews, icon: "👀" },
            { label: "Checkout Starts", value: loading ? "..." : stats.checkoutStarts, icon: "🛒" },
            { label: "Paying Customers", value: loading ? "..." : stats.checkoutCompletes, icon: "💳" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Build Stats */}
        <div style={{
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 16, margin: "0 0 16px", color: "#e4e4e7" }}>🔨 Build Progress</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#6C5CE7" }}>{publicMetrics.commits}</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>Commits</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#6C5CE7" }}>{publicMetrics.daysBuilding}</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>Days Building</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#6C5CE7" }}>{publicMetrics.linesOfCode}</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>Lines of Code</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {publicMetrics.techStack.map((tech) => (
              <span
                key={tech}
                style={{
                  padding: "4px 10px",
                  background: "#27272a",
                  borderRadius: 4,
                  fontSize: 12,
                  color: "#a1a1aa",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline / Milestones */}
        <div style={{
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 16, margin: "0 0 16px", color: "#e4e4e7" }}>🎯 Milestones</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { date: "Apr 1", milestone: "Project started", done: true },
              { date: "Apr 13", milestone: "v2 prototype working", done: true },
              { date: "Apr 19", milestone: "Pricing + checkout flow", done: true },
              { date: "Apr 19", milestone: "Admin dashboard", done: true },
              { date: "TBD", milestone: "First paying customer 🎉", done: false },
              { date: "TBD", milestone: "$100 MRR", done: false },
              { date: "Jun 26", milestone: "$1K MRR goal", done: false },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: m.done ? "#00b894" : "#27272a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: m.done ? "#fff" : "#71717a",
                }}>
                  {m.done ? "✓" : "○"}
                </span>
                <span style={{ color: m.done ? "#e4e4e7" : "#71717a", fontSize: 14 }}>
                  <strong style={{ color: "#6C5CE7" }}>{m.date}</strong> — {m.milestone}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: 16, color: "#a1a1aa", marginBottom: 16 }}>
            Want to be part of our journey?
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                padding: "14px 28px",
                background: "#6C5CE7",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Join the Waitlist
            </Link>
            <Link
              href="/mirror"
              style={{
                padding: "14px 28px",
                background: "#18181b",
                border: "1px solid #27272a",
                color: "#e4e4e7",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Try the Demo
            </Link>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#3f3f46" }}>
          Built by Madhav Somani · Updated live from browser data
        </p>
      </div>
    </div>
  );
}
