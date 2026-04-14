import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "VirtualFit - Virtual Try-On",
  description: "Try on clothes virtually with AI-powered 3D body tracking",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VirtualFit",
  },
  openGraph: {
    title: "VirtualFit - Virtual Try-On",
    description: "Upload any clothing photo and see it on you in real-time with 3D body tracking",
    type: "website",
    locale: "en_US",
    siteName: "VirtualFit",
  },
  twitter: {
    card: "summary_large_image",
    title: "VirtualFit - Virtual Try-On",
    description: "Try on clothes virtually with AI-powered 3D body tracking",
  },
  keywords: ["virtual try-on", "AR", "clothes", "fashion", "3D", "MediaPipe", "body tracking"],
  authors: [{ name: "VirtualFit" }],
  robots: "index, follow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
