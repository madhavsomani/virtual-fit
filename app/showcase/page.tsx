// Phase 8.5 — /showcase route. Server-rendered (no "use client") so SEO
// + first paint are instant. Five high-fidelity sample garments hand-picked
// to demonstrate every Phase 8.4 PBR fabric preset (cotton/denim/silk/
// leather/wool). Each card links to /mirror?garment=<glb>&fabric=<kind>
// — that param is what /mirror's existing `?garment=` loader already
// understands; the `fabric` param is plumbed for the next mirror commit
// to switch material presets without further routing changes.

import Link from "next/link";
import Image from "next/image";
import { SHOWCASE_GARMENTS, mirrorUrlFor } from "./showcase-data.mjs";
import { fabricMaterialDefaults } from "../lib/pbr-fabric.mjs";

export default function ShowcasePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · ZERO10 Parity
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Showcase: 5 Fabrics, One Click to Try On
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Each card uses calibrated PBR materials — roughness, sheen, and
          clearcoat tuned per fabric — so silk catches highlights and wool
          stays matte. Hit{" "}
          <span className="font-medium text-slate-900">Try On Live</span> to
          overlay it on your webcam in real time.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SHOWCASE_GARMENTS.map((g) => {
          const pbr = fabricMaterialDefaults({ kind: g.fabric });
          return (
            <li
              key={g.id}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-lg"
            >
              <div
                className="relative h-64 w-full"
                style={{ backgroundColor: g.palette.primary }}
              >
                <Image
                  src={g.imageUrl}
                  alt={g.name}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-contain p-6"
                  priority={false}
                />
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {g.name}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-slate-700">
                    {g.fabric}
                  </span>
                </div>
                {g.tagline && (
                  <p className="text-sm text-slate-600">{g.tagline}</p>
                )}
                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>
                    <dt className="font-medium text-slate-700">Roughness</dt>
                    <dd>{pbr.roughness.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700">Metalness</dt>
                    <dd>{pbr.metalness.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700">Sheen</dt>
                    <dd>{pbr.sheen.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700">Clearcoat</dt>
                    <dd>{pbr.clearcoat.toFixed(2)}</dd>
                  </div>
                </dl>
                <Link
                  href={mirrorUrlFor(g)}
                  className="mt-2 block rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Try On Live →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-16 rounded-2xl bg-slate-50 p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">
          What you&apos;re looking at
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          These five garments were chosen to demonstrate every fabric preset
          Phase 8.4 ships. The PBR values shown above feed directly into the
          MeshStandardMaterial that wraps the GLB once it&apos;s overlaid on
          your body. Free, no signup, no paid APIs — Microsoft TRELLIS for the
          mesh, segformer for masking, MediaPipe Pose Landmarker v2 for
          tracking.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/generate-3d"
            className="rounded-lg bg-white px-4 py-2 font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
          >
            Generate your own
          </Link>
          <Link
            href="/build-in-public"
            className="rounded-lg bg-white px-4 py-2 font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
          >
            See the build log
          </Link>
        </div>
      </section>
    </main>
  );
}
