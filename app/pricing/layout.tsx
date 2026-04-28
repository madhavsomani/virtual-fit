import type { Metadata } from "next";
import { PRICING_FAQ } from "./faq-data";

export const metadata: Metadata = {
  title: "Pricing — VirtualFit",
  description:
    "Free for personal use. $19/mo Pro for creators. $499/mo Retailer for Shopify merchants. No paid AI APIs in our pipeline — pricing is for hosting + support, not per-query model fees.",
  openGraph: {
    title: "Pricing — VirtualFit",
    description:
      "Free / Pro / Retailer plans for the open 3D try-on platform. No paid AI APIs in the pipeline.",
    type: "website",
    url: "https://virtualfit.app/pricing/",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.a,
      },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
