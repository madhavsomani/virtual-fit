import type { Metadata } from "next";

// Phase 8.6: per-route metadata for /catalog. The retailer-facing
// browse experience: search, filter by category, filter by fabric.
// SEO: real searches like "virtual try on catalog", "shop 3D garments".
export const metadata: Metadata = {
  title: "Catalog — Browse Every Garment | VirtualFit",
  description:
    "Browse every garment in the VirtualFit catalog. Filter by category, fabric, brand. Click any item to overlay it on your webcam in real time.",
  openGraph: {
    title: "VirtualFit Catalog — Search & Try On",
    description:
      "Browse 12+ premium garments. Filter by fabric or category. Real-time 3D overlay.",
  },
  twitter: {
    title: "VirtualFit Catalog",
    description: "Search 12+ 3D garments. One click to try on live.",
  },
  keywords: [
    "virtual try-on catalog",
    "3D garment browser",
    "shop 3D clothes",
    "virtual fitting room",
    "ZERO10 alternative",
  ],
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
