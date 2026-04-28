// Phase 8.15 — /pricing page (server component, force-static).
import { PRICING_FAQ } from "./faq-data";
import { resolvePlans, formatUsdMonthly } from "../lib/pricing.mjs";

export const dynamic = "force-static";

export default function PricingPage() {
  const plans = resolvePlans();
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-slate-800">
      <header className="mb-12 text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · Pricing
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Built on free models. Priced honestly.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          We use HF Spaces (TRELLIS) and HF Inference (segformer) — no paid
          per-query AI fees. You pay for hosting, support, and the embed.
          That&rsquo;s it.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </section>

      <section className="mx-auto mt-16 max-w-3xl rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
        <h2 className="mb-2 text-lg font-semibold text-amber-900">
          Stripe Checkout — test mode only (until Madhav approves live keys)
        </h2>
        <p className="text-sm text-amber-900">
          The Subscribe / Talk-to-sales buttons are wired through{" "}
          <code>NEXT_PUBLIC_STRIPE_*_LINK</code> environment variables. The
          codebase actively <em>rejects</em> any URL that contains a live-mode
          marker — only Stripe test Payment Links resolve. If a tier shows a
          &ldquo;coming soon&rdquo; pill, the env var is unset.
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-4 text-center text-2xl font-semibold text-slate-900">Frequently asked</h2>
        <dl className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
          {PRICING_FAQ.map((entry) => (
            <div key={entry.q} className="px-6 py-4">
              <dt className="text-sm font-semibold text-slate-900">{entry.q}</dt>
              <dd className="mt-1 text-sm text-slate-600">{entry.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-12 text-center text-xs text-slate-400">
        See also <a className="text-blue-600 underline" href="/api-docs">API docs</a> ·{" "}
        <a className="text-blue-600 underline" href="/embed-docs">Shopify embed</a> ·{" "}
        <a className="text-blue-600 underline" href="/showcase">Live showcase</a>
      </p>
    </main>
  );
}

function PlanCard({ plan }: { plan: ReturnType<typeof resolvePlans>[number] }) {
  const popular = plan.badge === "Most popular";
  return (
    <article
      className={[
        "relative rounded-2xl bg-white p-6 ring-1",
        popular ? "ring-2 ring-blue-500 shadow-xl" : "ring-slate-200",
      ].join(" ")}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          {plan.badge}
        </span>
      )}
      <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
      <p className="mt-4 text-3xl font-bold text-slate-900">
        {formatUsdMonthly(plan.priceUsdMonthly)}
      </p>
      <ul className="mt-6 space-y-2 text-sm text-slate-700">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <CtaButton plan={plan} />
    </article>
  );
}

function CtaButton({ plan }: { plan: ReturnType<typeof resolvePlans>[number] }) {
  const popular = plan.badge === "Most popular";
  const baseClass =
    "mt-8 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition";
  if (plan.id === "free") {
    return (
      <a href="/mirror" className={`${baseClass} bg-slate-900 text-white hover:bg-slate-700`}>
        {plan.cta}
      </a>
    );
  }
  if (plan.checkout?.mode === "test" && plan.checkout.value) {
    return (
      <a
        href={plan.checkout.value}
        rel="noopener noreferrer"
        target="_blank"
        className={`${baseClass} ${popular ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-900 text-white hover:bg-slate-700"}`}
      >
        {plan.cta} <span className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs">test</span>
      </a>
    );
  }
  return (
    <button
      disabled
      aria-disabled
      className={`${baseClass} cursor-not-allowed bg-slate-200 text-slate-500`}
      title={(plan.checkout as { reason?: string } | undefined)?.reason || "Stripe link not configured"}
    >
      Coming soon
    </button>
  );
}
