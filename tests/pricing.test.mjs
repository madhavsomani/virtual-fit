// Phase 8.15 — pricing tier + Stripe-Checkout-link safety tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLANS,
  resolvePlans,
  readCheckoutLink,
  formatUsdMonthly,
  validatePlans,
} from "../app/lib/pricing.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(ROOT, "app/pricing/page.tsx");
const LAYOUT = resolve(ROOT, "app/pricing/layout.tsx");

test("PLANS: ships exactly 3 tiers in Free/Pro/Retailer order at the right prices", () => {
  assert.equal(PLANS.length, 3);
  assert.deepEqual(PLANS.map((p) => p.id), ["free", "pro", "retailer"]);
  assert.equal(PLANS[0].priceUsdMonthly, 0);
  assert.equal(PLANS[1].priceUsdMonthly, 19);
  assert.equal(PLANS[2].priceUsdMonthly, 499);
});

test("PLANS: each plan + features array is frozen", () => {
  for (const p of PLANS) {
    assert.ok(Object.isFrozen(p), `plan ${p.id} not frozen`);
    assert.ok(Object.isFrozen(p.features), `plan ${p.id}.features not frozen`);
  }
});

test("validatePlans: ships valid catalog out of the box", () => {
  const r = validatePlans();
  assert.equal(r.valid, true, r.errors.join("|"));
});

test("validatePlans: catches missing/invalid fields", () => {
  const bad = [{ id: "X", name: "n", priceUsdMonthly: -1, features: [], cta: "" }];
  const r = validatePlans(bad);
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 3);
});

test("validatePlans: rejects duplicate ids", () => {
  const r = validatePlans([
    { id: "a", name: "A", priceUsdMonthly: 0, features: ["one"], cta: "Go", envKey: null },
    { id: "a", name: "B", priceUsdMonthly: 1, features: ["one"], cta: "Go", envKey: null },
  ]);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /duplicate/.test(e)));
});

test("formatUsdMonthly: 0 → 'Free', N → '$N/mo'; rejects negatives/NaN", () => {
  assert.equal(formatUsdMonthly(0), "Free");
  assert.equal(formatUsdMonthly(19), "$19/mo");
  assert.equal(formatUsdMonthly(499), "$499/mo");
  assert.throws(() => formatUsdMonthly(-1), /non-negative/);
  assert.throws(() => formatUsdMonthly(NaN), /non-negative/);
});

test("readCheckoutLink: unset env → mode 'unset'", () => {
  assert.deepEqual(readCheckoutLink("NEXT_PUBLIC_STRIPE_PRO_LINK", {}), { value: null, mode: "unset" });
  assert.deepEqual(readCheckoutLink("NEXT_PUBLIC_STRIPE_PRO_LINK", { NEXT_PUBLIC_STRIPE_PRO_LINK: "" }), { value: null, mode: "unset" });
});

test("readCheckoutLink: accepts valid Stripe TEST payment link", () => {
  const r = readCheckoutLink("NEXT_PUBLIC_STRIPE_PRO_LINK", {
    NEXT_PUBLIC_STRIPE_PRO_LINK: "https://buy.stripe.com/test_aBcDeF12345",
  });
  assert.equal(r.mode, "test");
  assert.match(r.value, /test_/);
});

test("readCheckoutLink: REJECTS live-mode markers (pk_live_, sk_live_, /live_, etc.)", () => {
  for (const url of [
    "https://buy.stripe.com/live_aBcDeF12345",
    "https://buy.stripe.com/9aaaa",
    "pk_live_abc",
    "sk_live_abc",
    "rk_live_abc",
  ]) {
    const r = readCheckoutLink("NEXT_PUBLIC_STRIPE_PRO_LINK", { NEXT_PUBLIC_STRIPE_PRO_LINK: url });
    assert.equal(r.mode, "rejected", `expected rejected for ${url}`);
    assert.match(r.reason, /live/);
  }
});

test("readCheckoutLink: rejects junk URLs (not buy.stripe.com test_)", () => {
  const r = readCheckoutLink("NEXT_PUBLIC_STRIPE_PRO_LINK", {
    NEXT_PUBLIC_STRIPE_PRO_LINK: "https://example.com/checkout",
  });
  assert.equal(r.mode, "rejected");
  assert.match(r.reason, /stripe/);
});

test("readCheckoutLink: rejects non-string env values", () => {
  const r = readCheckoutLink("NEXT_PUBLIC_STRIPE_PRO_LINK", { NEXT_PUBLIC_STRIPE_PRO_LINK: 12345 });
  assert.equal(r.mode, "rejected");
});

test("resolvePlans: free plan has no checkout, paid plans inherit env state", () => {
  const out = resolvePlans({});
  assert.equal(out[0].checkout.mode, "unset"); // free
  assert.equal(out[1].checkout.mode, "unset"); // pro env unset
  assert.equal(out[2].checkout.mode, "unset"); // retailer env unset

  const out2 = resolvePlans({
    NEXT_PUBLIC_STRIPE_PRO_LINK: "https://buy.stripe.com/test_aaaaaa",
    NEXT_PUBLIC_STRIPE_RETAILER_LINK: "https://buy.stripe.com/test_bbbbbb",
  });
  assert.equal(out2[1].checkout.mode, "test");
  assert.equal(out2[2].checkout.mode, "test");
});

test("/pricing page + layout exist + reference 3 tiers + Stripe", () => {
  assert.ok(existsSync(PAGE));
  assert.ok(existsSync(LAYOUT));
  const page = readFileSync(PAGE, "utf8");
  assert.match(page, /resolvePlans/);
  assert.match(page, /formatUsdMonthly/);
  assert.match(page, /Stripe Checkout/);
  assert.match(page, /test mode/);
  const layout = readFileSync(LAYOUT, "utf8");
  assert.match(layout, /metadata/);
});

test("VISION GUARD: pricing module never references 2D fallback or paid AI APIs or Tailscale", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/pricing.mjs"), "utf8");
  assert.ok(!src.includes("2d-overlay"));
  assert.ok(!src.includes("garmentTexture"));
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com/i.test(src));
  assert.ok(!/ts\.net|tailscale/i.test(src));
});

test("VISION GUARD: pricing source has no hardcoded Stripe live keys", () => {
  for (const f of [PAGE, resolve(ROOT, "app/lib/pricing.mjs")]) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/pk_live_[A-Za-z0-9]/.test(src), `${f} contains pk_live_*`);
    assert.ok(!/sk_live_[A-Za-z0-9]/.test(src), `${f} contains sk_live_*`);
  }
});
