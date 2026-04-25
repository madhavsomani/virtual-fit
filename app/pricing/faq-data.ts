// Phase 7.78: single source of truth for the /pricing FAQ section.
// Imported by app/pricing/page.tsx (renders the visible accordion) AND
// app/pricing/layout.tsx (renders the schema.org/FAQPage JSON-LD for
// Google rich results). Google penalizes FAQ schema whose Q/A pairs
// don't appear verbatim in the rendered DOM, so a single source
// guarantees parity by construction.

export interface PricingFaqEntry {
  q: string;
  a: string;
}

export const PRICING_FAQ: ReadonlyArray<PricingFaqEntry> = [
  {
    q: "Is my video private?",
    a: "100% private. All processing happens in your browser. We never see, store, or transmit your camera feed.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes! Cancel your subscription at any time, no questions asked. You'll keep access until the end of your billing period.",
  },
  {
    q: "Do you store my photos?",
    a: "No. Garment images you upload are processed locally. We don't store your photos on our servers.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards (Visa, Mastercard, Amex) via Stripe.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! Try the free tier with 3 try-ons/month, or get a 7-day trial on Creator.",
  },
  {
    q: "Can I embed this in my Shopify store?",
    a: "Absolutely! The Retailer plan ($49/mo) includes an embeddable widget with your branding.",
  },
];
