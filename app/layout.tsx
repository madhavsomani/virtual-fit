import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "VirtualFit - Virtual Try-On",
  description: "Try on clothes virtually with AI-powered 3D body tracking",
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
