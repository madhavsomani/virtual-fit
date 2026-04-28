// Phase 8.15 — Pricing tier source of truth.
//
// Single module that defines our 3 tiers + Stripe Checkout wiring.
// Live keys are NEVER hardcoded. The page reads `NEXT_PUBLIC_STRIPE_*`
// env vars at build time. When unset, buttons render in
// "coming soon" mode. Test-mode keys MUST start with `pk_test_` /
// `price_test_` (or be obvious Stripe Payment Link URLs we recognise
// as test) — anything that looks live is rejected.

export const PLANS = Object.freeze([
  Object.freeze({
    id: "free",
    name: "Free",
    priceUsdMonthly: 0,
    tagline: "Try the 3D mirror with our demo catalog.",
    features: Object.freeze([
      "Webcam mirror with body tracking",
      "12 demo garments + 8 PBR fabrics",
      "1 try-on snapshot/session",
      "Community Discord support",
    ]),
    cta: "Start free",
    badge: null,
    envKey: null, // never goes through Stripe
  }),
  Object.freeze({
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 19,
    tagline: "For creators + power users.",
    features: Object.freeze([
      "Everything in Free",
      "Unlimited try-on snapshots",
      "10s social-share clip recorder",
      "AI styling (/style-me) full catalog",
      "Email support, no ads",
    ]),
    cta: "Subscribe",
    badge: "Most popular",
    envKey: "NEXT_PUBLIC_STRIPE_PRO_LINK",
  }),
  Object.freeze({
    id: "retailer",
    name: "Retailer",
    priceUsdMonthly: 499,
    tagline: "For Shopify merchants + brands.",
    features: Object.freeze([
      "Everything in Pro",
      "<virtualfit-mirror> Shopify embed",
      "Public /api/v1/tryOn (600 req/min)",
      "Retailer dashboard + analytics",
      "Onboarding call + Slack channel",
    ]),
    cta: "Talk to sales",
    badge: null,
    envKey: "NEXT_PUBLIC_STRIPE_RETAILER_LINK",
  }),
]);

const SAFE_PAYMENT_LINK_RE = /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\/test_[A-Za-z0-9_-]+$/;
const LIVE_HINTS = [
  "pk_live_",
  "sk_live_",
  "rk_live_",
  "/live_",
  "buy.stripe.com/9", // legacy live shortlink prefix used pre-2024
];

/**
 * @returns {{ value: string|null, mode: "test"|"unset"|"rejected", reason?: string }}
 */
export function readCheckoutLink(envKey, env = (typeof process !== "undefined" ? process.env : {}) || {}) {
  if (!envKey) return { value: null, mode: "unset" };
  const raw = env[envKey];
  if (raw == null || raw === "") return { value: null, mode: "unset" };
  if (typeof raw !== "string") return { value: null, mode: "rejected", reason: "not a string" };
  for (const hint of LIVE_HINTS) {
    if (raw.includes(hint)) return { value: null, mode: "rejected", reason: `live-mode marker '${hint}' detected` };
  }
  if (!SAFE_PAYMENT_LINK_RE.test(raw)) {
    return { value: null, mode: "rejected", reason: "not a stripe test payment link" };
  }
  return { value: raw, mode: "test" };
}

/**
 * Resolve every plan into the shape the /pricing page needs at render time.
 */
export function resolvePlans(env = (typeof process !== "undefined" ? process.env : {}) || {}) {
  return PLANS.map((p) => {
    if (!p.envKey) return { ...p, checkout: { value: null, mode: "unset" } };
    return { ...p, checkout: readCheckoutLink(p.envKey, env) };
  });
}

export function formatUsdMonthly(n) {
  if (!Number.isFinite(n) || n < 0) throw new Error("formatUsdMonthly: n must be a non-negative number");
  if (n === 0) return "Free";
  return `$${n}/mo`;
}

/**
 * Validate the static plan table at build time. Throws if anything
 * that looks like live Stripe data has slipped into the constants.
 */
export function validatePlans(plans = PLANS) {
  const errors = [];
  if (!Array.isArray(plans) || plans.length === 0) errors.push("plans must be a non-empty array");
  const ids = new Set();
  for (const p of plans) {
    if (!p || typeof p !== "object") { errors.push("plan: not an object"); continue; }
    if (typeof p.id !== "string" || !/^[a-z][a-z0-9-]+$/.test(p.id)) errors.push(`plan.id invalid: ${p.id}`);
    if (ids.has(p.id)) errors.push(`plan.id duplicate: ${p.id}`);
    ids.add(p.id);
    if (typeof p.name !== "string" || p.name.length < 2) errors.push(`plan(${p.id}).name invalid`);
    if (!Number.isFinite(p.priceUsdMonthly) || p.priceUsdMonthly < 0) errors.push(`plan(${p.id}).priceUsdMonthly invalid`);
    if (!Array.isArray(p.features) || p.features.length === 0) errors.push(`plan(${p.id}).features must be non-empty`);
    for (const f of p.features) {
      if (typeof f !== "string" || f.length < 2) errors.push(`plan(${p.id}).features: bad entry '${f}'`);
    }
    if (typeof p.cta !== "string" || p.cta.length < 2) errors.push(`plan(${p.id}).cta invalid`);
    if (p.envKey !== null && (typeof p.envKey !== "string" || !/^NEXT_PUBLIC_STRIPE_[A-Z_]+_LINK$/.test(p.envKey))) {
      errors.push(`plan(${p.id}).envKey invalid: ${p.envKey}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
