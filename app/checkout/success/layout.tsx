import type { Metadata } from "next";

// Phase 7.75: per-route metadata for /checkout/success. Post-purchase
// landing — when a happy customer shares the URL ("just signed up to
// VirtualFit!"), the unfurl shouldn't be the generic homepage card.
// Also `noindex` because session_id query params are user-specific and
// must never appear in Google search results. Same pattern as 7.74.
export const metadata: Metadata = {
  title: "Welcome to VirtualFit — Checkout Complete",
  description:
    "Your VirtualFit subscription is active. Start trying on clothes virtually with 3D body tracking.",
  openGraph: {
    title: "Welcome to VirtualFit",
    description:
      "Subscription active. Start trying on clothes virtually with 3D body tracking.",
  },
  twitter: {
    title: "Welcome to VirtualFit",
    description: "Subscription active. Start trying on clothes virtually.",
  },
  // Critical: this page receives ?session_id=cs_live_XXXX in the URL
  // from Stripe redirects. Crawlers indexing those URLs would expose
  // user-specific session ids in SERPs. noindex + nofollow.
  robots: "noindex, nofollow",
};

export default function CheckoutSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
