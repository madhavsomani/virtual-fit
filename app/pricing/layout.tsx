import type { Metadata } from "next";
import { PRICING_FAQ } from "./faq-data";

export const metadata: Metadata = {
  title: "Pricing - VirtualFit",
  description: "VirtualFit pricing plans. Free tier, Creator at $9/mo, Retailer at $49/mo with embeddable widget for your store.",
  openGraph: {
    title: "VirtualFit Pricing - Free, Creator, Retailer Plans",
    description: "Virtual try-on for your store. Start free, upgrade when ready.",
  },
};

// Phase 7.78: schema.org/FAQPage JSON-LD for /pricing rich-result
// eligibility. Read from the same PRICING_FAQ source the page renders,
// so every Q/A in the schema appears verbatim in the rendered DOM
// (Google penalizes mismatched FAQ schemas — schema text MUST match
// visible text).
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PRICING_FAQ.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* JSON-LD must render before children so it's near the top of
          the DOM head/body output — crawlers parse top-down. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      {children}
    </>
  );
}
