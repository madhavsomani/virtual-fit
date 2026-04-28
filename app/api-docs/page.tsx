// Phase 8.13 — public API spec landing page (/api-docs).
// Reads the prebuilt OpenAPI doc and renders a human summary + curl
// example. The raw spec lives at /api/v1/openapi.json for tooling.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  API_VERSION,
  RATE_LIMITS,
  JWT_REQUIREMENTS,
  SUPPORTED_SIZES,
  SUPPORTED_VIEWS,
  SUPPORTED_RETURN_FORMATS,
} from "../lib/tryon-api-spec.mjs";

export const dynamic = "force-static";

function loadSpec() {
  try {
    const raw = readFileSync(
      resolve(process.cwd(), "public/api/v1/openapi.json"),
      "utf8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function ApiDocsPage() {
  const spec = loadSpec();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-slate-800">
      <header className="mb-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · Public API
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          /api/v1/tryOn
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Submit a garment <code>.glb</code> + a customer image. Get back a
          3D-rendered try-on image URL. JWT-authenticated. Rate-limited. No
          paid AI APIs in the pipeline.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          API version <code>{API_VERSION.toString()}</code> · OpenAPI{" "}
          <a className="text-blue-600 underline" href="/api/v1/openapi.json">
            /api/v1/openapi.json
          </a>
        </p>
      </header>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-semibold">Quick start (curl)</h2>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{`curl -X POST https://api.virtualfit.app/api/v1/tryOn \\
  -H "Authorization: Bearer $VFIT_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "garmentUrl": "https://cdn.virtualfit.app/models/demo-tshirt.glb",
    "imageUrl":   "https://cdn.example.com/selfies/u-1234.jpg",
    "options":    { "fabric": "cotton", "size": "M", "view": "front" }
  }'`}</pre>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="mb-2 text-lg font-semibold">Auth</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>Algorithm: <code>{JWT_REQUIREMENTS.algorithm}</code></li>
            <li>Audience: <code>{JWT_REQUIREMENTS.audience}</code></li>
            <li>Max lifetime: {JWT_REQUIREMENTS.maxLifetimeSeconds}s</li>
            <li>
              Required claims:{" "}
              {JWT_REQUIREMENTS.requiredClaims.map((c) => (
                <code key={c} className="mr-1">{c}</code>
              ))}
            </li>
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="mb-2 text-lg font-semibold">Rate limits</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>
              Free: {RATE_LIMITS.freeTier.requestsPerMinute}/min ·{" "}
              {RATE_LIMITS.freeTier.requestsPerDay.toLocaleString()}/day
            </li>
            <li>
              Pro: {RATE_LIMITS.proTier.requestsPerMinute}/min ·{" "}
              {RATE_LIMITS.proTier.requestsPerDay.toLocaleString()}/day
            </li>
            <li className="pt-1 text-xs text-slate-400">
              Headers: <code>X-RateLimit-Limit</code>,{" "}
              <code>X-RateLimit-Remaining</code>,{" "}
              <code>X-RateLimit-Reset</code>
            </li>
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-2 text-lg font-semibold">Request options</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>
            <code>fabric</code>: see <a className="text-blue-600 underline" href="/showcase">/showcase</a> for the live PBR set
          </li>
          <li>
            <code>size</code>: {SUPPORTED_SIZES.map((s) => <code key={s} className="mr-1">{s}</code>)}
          </li>
          <li>
            <code>view</code>: {SUPPORTED_VIEWS.map((s) => <code key={s} className="mr-1">{s}</code>)}
          </li>
          <li>
            <code>returnFormat</code>: {SUPPORTED_RETURN_FORMATS.map((s) => <code key={s} className="mr-1">{s}</code>)}
          </li>
        </ul>
      </section>

      <section className="rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
        <h2 className="mb-2 text-lg font-semibold text-amber-900">3D-only contract</h2>
        <p className="text-sm text-amber-900">
          <code>garmentUrl</code> MUST end in <code>.glb</code>. We do not
          accept 2D garment textures. If you need help converting, see the{" "}
          <a className="text-amber-900 underline" href="/retailer/dashboard">retailer dashboard</a>.
        </p>
      </section>

      {spec && (
        <p className="mt-8 text-xs text-slate-400">
          Spec generated build-time · {Object.keys(spec.paths).length} path(s).
        </p>
      )}
    </main>
  );
}
