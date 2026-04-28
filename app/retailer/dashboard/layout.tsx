import type { Metadata } from "next";

// Phase 8.8: per-route metadata for /retailer/dashboard.
export const metadata: Metadata = {
  title: "Retailer Dashboard — Upload Garments | VirtualFit",
  description:
    "Upload SKUs, generate 3D models with TRELLIS, and manage your virtual try-on catalog. Free for early-access partners.",
  robots: { index: false, follow: false },
};

export default function RetailerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
