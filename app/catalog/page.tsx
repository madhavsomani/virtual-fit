// Phase 8.6 — /catalog page (server component, JSONL backed).
//
// Read order:
//   1. Server reads `public/data/catalog.jsonl` at build/SSR time.
//   2. Bad rows are dropped (validateCatalog) — production never crashes
//      on a retailer typo; counts are surfaced for the build log.
//   3. Validated records + facet lists handed to <CatalogBrowser/>
//      (client component below the fold) for interactive search/filter.

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  parseCatalogJsonl,
  validateCatalog,
  listCategories,
  listFabrics,
} from "../lib/catalog-data.mjs";
import CatalogBrowser from "./CatalogBrowser";

export const dynamic = "force-static";

export default async function CatalogPage() {
  const file = path.join(process.cwd(), "public", "data", "catalog.jsonl");
  const text = await fs.readFile(file, "utf8");
  const parsed = parseCatalogJsonl(text);
  const { valid, dropped } = validateCatalog(parsed);
  // Surface dropped rows in the server log; never block render.
  if (dropped.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[catalog] dropped ${dropped.length} malformed rows`,
      dropped.map((d) => d.reasons.join(", ")),
    );
  }
  const categories = listCategories(valid);
  const fabrics = listFabrics(valid);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · Catalog
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Browse Every Garment
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          {valid.length} garments across {categories.length} categories and {fabrics.length} fabric
          types. Search, filter, and overlay any of them on your webcam in
          real time.
        </p>
      </header>
      <CatalogBrowser
        items={valid}
        categories={categories}
        fabrics={fabrics}
      />
    </main>
  );
}
