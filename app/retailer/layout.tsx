import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Retailers - VirtualFit",
  description: "Add virtual try-on to your Shopify or e-commerce store. Reduce returns, increase conversions. Embed in minutes.",
  openGraph: {
    title: "VirtualFit for Retailers - Embeddable Virtual Try-On",
    description: "Reduce returns by 40%. Add virtual try-on to your store in minutes.",
  },
};

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
