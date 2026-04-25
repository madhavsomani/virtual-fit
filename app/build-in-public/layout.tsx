import type { Metadata } from "next";

// Phase 7.74: per-route metadata for /build-in-public. Pre-7.74 this
// page inherited the generic home-page metadata, undermining the
// build-in-public narrative when the URL was shared on Twitter/HN/IH
// (which is THE primary distribution channel for build-in-public posts).
export const metadata: Metadata = {
  title: "Build in Public - VirtualFit",
  description:
    "Live commit count, test count, lines of code, and roadmap for VirtualFit. Watch a virtual try-on platform get built one commit at a time, 100% in the open.",
  openGraph: {
    title: "Building VirtualFit in Public — Commits, Tests, Roadmap",
    description:
      "Live snapshot: every commit, every test, every milestone. Watch a virtual try-on platform get built one commit at a time, 100% in the open.",
  },
  twitter: {
    title: "Building VirtualFit in Public — Live Commit & Test Count",
    description:
      "Live snapshot of every commit, every test, every milestone. 100% in the open.",
  },
};

export default function BuildInPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
