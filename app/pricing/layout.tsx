import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - VirtualFit",
  description: "VirtualFit pricing plans. Free tier, Creator at $9/mo, Retailer at $49/mo with embeddable widget for your store.",
  openGraph: {
    title: "VirtualFit Pricing - Free, Creator, Retailer Plans",
    description: "Virtual try-on for your store. Start free, upgrade when ready.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
