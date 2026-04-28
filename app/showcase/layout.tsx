import type { Metadata } from "next";

// Phase 8.5: per-route metadata for /showcase. ZERO10 parity push — these
// are the "look, real fabrics tracking your body" landing experience.
export const metadata: Metadata = {
  title: "Showcase: 5 Premium 3D Garments — Try On Live | VirtualFit",
  description:
    "Five fabric demos — cotton, denim, silk, leather, wool — each with calibrated PBR materials. Click any garment to overlay it on your webcam feed in real time.",
  openGraph: {
    title: "VirtualFit Showcase — Premium 3D Try-On",
    description:
      "Five high-fidelity sample garments. Real-time 3D overlay on your webcam.",
  },
  twitter: {
    title: "VirtualFit Showcase",
    description: "Five premium 3D garments. One click to try on live.",
  },
  keywords: [
    "virtual try-on",
    "3D garment",
    "PBR fabric",
    "webcam try-on",
    "ZERO10 alternative",
    "free virtual fitting room",
  ],
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
