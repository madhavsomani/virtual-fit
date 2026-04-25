// Phase 7.79: single source of truth for the homepage FAQ accordion.
// Imported by app/page.tsx (renders the visible <details> elements)
// AND app/layout.tsx (renders the schema.org/FAQPage JSON-LD for
// Google rich results). Same pattern as Phase 7.78's pricing/faq-data.ts:
// schema text MUST match visible text verbatim or Google penalizes /
// ignores the FAQ rich result, so a single source guarantees parity.
//
// `emoji` is purely decorative — it prefixes the visible <summary> in
// the accordion but is intentionally NOT part of the JSON-LD `q` field
// because schema.org Question.name should be plain text. The plain `q`
// substring still appears verbatim in the rendered DOM (immediately
// after the emoji), satisfying Google's "match visible text" rule.
//
// Lives at app/home-faq-data.ts (not app/page-faq-data.ts) because
// "page" collides with Next.js's reserved file naming convention for
// route segments under app/.

export interface HomeFaqEntry {
  emoji: string;
  q: string;
  a: string;
}

export const HOME_FAQ: ReadonlyArray<HomeFaqEntry> = [
  {
    emoji: "📅",
    q: "When does it launch?",
    a: "Public beta: Q2 2026. Founding members get early access + lifetime discount.",
  },
  {
    emoji: "💰",
    q: "How much will it cost?",
    a: "$19-$49/mo depending on usage. Design partners: first 6 months free.",
  },
  {
    emoji: "🔒",
    q: "Will my data be private?",
    a: "Yes. Camera processing happens in-browser. We never see customer photos.",
  },
];
