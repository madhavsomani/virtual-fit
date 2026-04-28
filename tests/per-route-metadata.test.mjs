// Phase 7.74 — guard: high-intent conversion routes (/retailer/signup
// and /build-in-public) must export per-route metadata. Pre-7.74 both
// pages were "use client" components that silently inherited the
// generic "VirtualFit - Virtual Try-On" title from app/layout.tsx, so
// when the URLs were shared on Twitter/Slack/email/HN the OG card was
// indistinguishable from the home page. Same fix pattern as /pricing's
// existing layout.tsx (added in an earlier phase).

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "..", "app");

const ROUTES = [
  {
    layout: resolve(APP, "retailer/signup/layout.tsx"),
    titleMustContain: "Retailer",
    descriptionMustContain: "try-on",
  },
  {
    layout: resolve(APP, "build-in-public/layout.tsx"),
    titleMustContain: "Build in Public",
    descriptionMustContain: "commit",
  },
  {
    // Pair guard: pricing's existing layout.tsx must continue to exist
    // and export metadata. If a future agent deletes it, this test
    // fires.
    layout: resolve(APP, "pricing/layout.tsx"),
    titleMustContain: "Pricing",
    descriptionMustContain: "Retailer",
  },
  // Phase 7.75: extended the per-route metadata pattern to /redeem,
  // /checkout/success, and /generate-3d.
  {
    layout: resolve(APP, "redeem/layout.tsx"),
    titleMustContain: "Redeem",
    descriptionMustContain: "code",
  },
  {
    layout: resolve(APP, "checkout/success/layout.tsx"),
    titleMustContain: "Checkout Complete",
    descriptionMustContain: "subscription",
  },
  {
    layout: resolve(APP, "generate-3d/layout.tsx"),
    titleMustContain: "3D",
    descriptionMustContain: "TRELLIS",
  },
];

for (const route of ROUTES) {
  test(`per-route metadata: ${route.layout.replace(APP, "app")}`, () => {
    assert.ok(
      existsSync(route.layout),
      `${route.layout} must exist (server-component layout exporting metadata for the client page below it)`,
    );
    const body = readFileSync(route.layout, "utf8");

    // Must export metadata typed as Next's Metadata.
    assert.match(
      body,
      /export\s+const\s+metadata\s*:\s*Metadata\s*=/,
      "must export `const metadata: Metadata = {...}`",
    );

    // Title must be route-specific (not the generic homepage title).
    assert.match(
      body,
      /title:\s*["'].*["']/,
      "metadata must set a title",
    );
    assert.ok(
      body.includes(route.titleMustContain),
      `title must contain '${route.titleMustContain}' (route-specific)`,
    );

    // Description must be route-specific.
    assert.match(
      body,
      /description:\s*["'].*["']/,
      "metadata must set a description",
    );
    assert.ok(
      body.includes(route.descriptionMustContain),
      `description must contain '${route.descriptionMustContain}' (route-specific, not the generic 'AI-powered 3D body tracking' fallback)`,
    );

    // Generic homepage description must NOT be the description here —
    // that would mean a future agent copy-pasted the generic and
    // defeated the per-route fix.
    assert.doesNotMatch(
      body,
      /description:\s*["']Try on clothes virtually with AI-powered 3D body tracking["']/,
      "description must not be the generic homepage fallback",
    );

    // Must have an openGraph block for Twitter/Slack/Discord/Facebook
    // unfurls (the whole reason this layout exists).
    assert.match(
      body,
      /openGraph:\s*\{/,
      "metadata must include an openGraph block for social-card unfurls",
    );

    // Layout must wrap children — otherwise the page below it never
    // renders.
    assert.match(
      body,
      /\{\s*children\s*\}/,
      "layout must render {children}",
    );
  });
}

test("client pages remain marked 'use client' (layouts handle metadata, not the pages)", () => {
  // Sanity check: the actual page.tsx files must still be client
  // components — the whole reason we needed the layout.tsx workaround
  // is that "use client" components can't export metadata directly.
  const PAGES = [
    resolve(APP, "retailer/signup/page.tsx"),
    resolve(APP, "build-in-public/page.tsx"),
    // pricing/page.tsx was promoted to a server component in P8.15 (no
    // interactive client work — reads env at build time + renders).
    resolve(APP, "redeem/page.tsx"),
    resolve(APP, "checkout/success/page.tsx"),
    resolve(APP, "generate-3d/page.tsx"),
  ];
  for (const page of PAGES) {
    const body = readFileSync(page, "utf8");
    assert.match(
      body,
      /^["']use client["'];?/m,
      `${page.replace(APP, "app")} must remain "use client" (the page does interactive work; metadata moved to the sibling layout.tsx)`,
    );
  }
});

test("/checkout/success layout.tsx sets robots: noindex,nofollow (Stripe session_id leak guard)", () => {
  // Phase 7.75: this page receives ?session_id=cs_live_XXXX in the URL
  // from Stripe redirects. If a search-engine crawler ever indexes one
  // of those URLs (someone accidentally pastes it in a forum, a blog
  // post, etc.), the user-specific session id ends up in SERPs forever.
  // The robots meta tag is the cheapest possible mitigation.
  const body = readFileSync(
    resolve(APP, "checkout/success/layout.tsx"),
    "utf8",
  );
  assert.match(
    body,
    /robots:\s*["']noindex,?\s*nofollow["']/,
    "checkout/success metadata must set robots: 'noindex, nofollow' to prevent Stripe session_id leaks into search engines",
  );
});
