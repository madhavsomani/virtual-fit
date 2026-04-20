import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Virtual Mirror - VirtualFit",
  description: "Try on clothes in real-time with your camera. AI-powered body tracking for instant fit preview.",
  openGraph: {
    title: "VirtualFit Mirror - Try On Clothes Virtually",
    description: "See how clothes look on you before you buy. Real-time camera-based virtual try-on.",
  },
};

export default function MirrorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
