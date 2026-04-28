// Phase 8.14 — /embed-docs landing page (Shopify embed snippet docs).

import { VFIT_EMBED_VERSION, VFIT_EMBED_DEFAULTS } from "../lib/virtualfit-mirror-embed.mjs";

export const dynamic = "force-static";

export default function EmbedDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-slate-800">
      <header className="mb-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · Storefront embed
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          &lt;virtualfit-mirror&gt;
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          One script tag. One custom element. The full VirtualFit 3D Mirror
          on any Shopify product page or theme template &mdash; sandboxed,
          lazy-loaded, with first-class postMessage events.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Embed v<code>{VFIT_EMBED_VERSION}</code> &middot; served from{" "}
          <a className="text-blue-600 underline" href="/embed/virtualfit-mirror.js">
            /embed/virtualfit-mirror.js
          </a>
        </p>
      </header>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-semibold">1. Add the script</h2>
        <p className="mb-2 text-sm text-slate-600">
          Paste once in your <code>theme.liquid</code> head:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{`<script type="module"
  src="https://virtualfit.app/embed/virtualfit-mirror.js"></script>`}</pre>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-semibold">2. Drop the element</h2>
        <p className="mb-2 text-sm text-slate-600">
          On the product page (Liquid friendly):
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{`<virtualfit-mirror
  garment="https://cdn.virtualfit.app/models/{{ product.handle }}.glb"
  fabric="cotton"
  mode="topwear"
  height="640"
  analytics="{{ shop.permanent_domain }}"></virtualfit-mirror>`}</pre>
        <p className="mt-3 text-xs text-slate-500">
          <code>garment</code> must be an HTTPS URL ending in{" "}
          <code>.glb</code>. (3D-only.) <code>mode</code> accepts{" "}
          {VFIT_EMBED_DEFAULTS.validModes.map((m) => (
            <code key={m} className="mr-1">{m}</code>
          ))}
          .
        </p>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-semibold">3. Listen for events</h2>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{`document.querySelector('virtualfit-mirror')
  .addEventListener('vfit:tryon-snapshot', (e) => {
    console.log('snapshot url:', e.detail.url);
  });`}</pre>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {VFIT_EMBED_DEFAULTS.allowedEvents.map((evt) => (
            <li key={evt}>
              <code>{evt}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
        <h2 className="mb-2 text-lg font-semibold text-amber-900">Sandbox + privacy</h2>
        <p className="text-sm text-amber-900">
          The mirror runs inside a sandboxed iframe with{" "}
          <code>allow=&quot;camera; xr-spatial-tracking; fullscreen&quot;</code>.
          We never receive customer photos &mdash; the 3D pipeline runs
          locally in the iframe and only emits short-lived snapshot URLs to
          your event handlers.
        </p>
      </section>

      <p className="mt-8 text-xs text-slate-400">
        See also: <a className="text-blue-600 underline" href="/api-docs">/api-docs</a>{" "}
        for the server-side <code>/api/v1/tryOn</code> endpoint &middot;{" "}
        <a className="text-blue-600 underline" href="https://github.com/madhavsomani/virtual-fit/blob/master/docs/hardware-kit.md">
          BYO Hardware Kit
        </a>{" "}
        for in-store kiosk recommendations.
      </p>
    </main>
  );
}
