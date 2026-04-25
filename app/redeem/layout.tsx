import type { Metadata } from "next";

// Phase 7.75: per-route metadata for /redeem. Gift-code redemption is
// high-intent (someone got a code from a friend / promo); the OG card
// when shared in DMs needs to telegraph "enter your code, get the perk"
// not the generic "AI-powered 3D body tracking" line. Same pattern as
// Phase 7.74's /retailer/signup + /build-in-public layouts.
export const metadata: Metadata = {
  title: "Redeem Code - VirtualFit",
  description:
    "Got a VirtualFit gift code? Redeem it here to unlock the virtual try-on experience.",
  openGraph: {
    title: "Redeem Your VirtualFit Code",
    description:
      "Enter your gift or promo code to unlock virtual try-on with 3D body tracking.",
  },
  twitter: {
    title: "Redeem Your VirtualFit Code",
    description:
      "Enter your gift or promo code to unlock virtual try-on.",
  },
};

export default function RedeemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
