import type { Metadata } from "next";

// Phase 7.74: per-route metadata for /retailer/signup. Pre-7.74 this
// page was a client component that inherited the generic
// "VirtualFit - Virtual Try-On" title + description from app/layout.tsx
// — the highest-intent retailer conversion URL on the entire site
// shared on Twitter/Slack/email rendered an OG card identical to the
// home page. Same fix pattern as /pricing's layout.tsx.
export const metadata: Metadata = {
  title: "Retailer Signup - VirtualFit",
  description:
    "Add virtual try-on to your Shopify, WooCommerce, or custom store in 60 seconds. One <script> tag, your brand color, your products. Free during beta.",
  openGraph: {
    title: "Add Virtual Try-On to Your Store in 60 Seconds — VirtualFit",
    description:
      "One <script> tag. Your brand color. Try on your products via webcam + 3D body tracking. Free during beta.",
  },
  twitter: {
    title: "Add Virtual Try-On to Your Store in 60 Seconds",
    description:
      "One script tag. Your brand color. Webcam + 3D body tracking. Free during beta.",
  },
};

export default function RetailerSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
