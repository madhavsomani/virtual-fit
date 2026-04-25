import type { Metadata } from "next";

// Phase 7.75: per-route metadata for /generate-3d. The TRELLIS image-to-3D
// utility has SEO value: "image to 3D", "TRELLIS demo", "free 3D model
// from photo" are real searches. Generic homepage metadata wastes that.
// Same pattern as Phase 7.74's per-route layouts.
export const metadata: Metadata = {
  title: "Image to 3D Model - Free TRELLIS Generator - VirtualFit",
  description:
    "Convert any product photo to a 3D GLB model in your browser. Free, no signup. Powered by Microsoft TRELLIS via Hugging Face Spaces.",
  openGraph: {
    title: "Free Image-to-3D Generator (TRELLIS) — VirtualFit",
    description:
      "Drop a product photo, get a 3D GLB model. Free, no signup. Powered by Microsoft TRELLIS.",
  },
  twitter: {
    title: "Free Image-to-3D Generator (TRELLIS)",
    description:
      "Drop a photo, get a 3D model. Free, no signup. Microsoft TRELLIS via HF Spaces.",
  },
  keywords: [
    "image to 3D",
    "TRELLIS",
    "free 3D generator",
    "GLB",
    "Microsoft TRELLIS",
    "Hugging Face",
    "photo to 3D model",
  ],
};

export default function Generate3DLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
