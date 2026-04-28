"use client";

// Phase 8.6 — Catalog browser (client). Search + facet filters over the
// SSR-loaded catalog. Stateless wrt server: receives full record list as
// props from the server component; all filtering happens client-side
// (<200 records expected through MVP).

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  filterCatalog,
  mirrorUrlForCatalogItem,
} from "../lib/catalog-data.mjs";

export default function CatalogBrowser({ items, categories, fabrics }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [fabric, setFabric] = useState("");

  const filtered = useMemo(
    () => filterCatalog(items, { query, category, fabric }),
    [items, query, category, fabric],
  );

  return (
    <>
      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, brand, tag…"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          aria-label="Search catalog"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={fabric}
          onChange={(e) => setFabric(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
          aria-label="Filter by fabric"
        >
          <option value="">All fabrics</option>
          {fabrics.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("");
            setFabric("");
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Reset
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500" aria-live="polite">
        Showing {filtered.length} of {items.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-12 text-center text-slate-500">
          No garments match those filters.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((g) => (
            <li
              key={g.id}
              className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
            >
              <div
                className="relative h-48 w-full"
                style={{ backgroundColor: g.palette?.primary || "#e2e8f0" }}
              >
                <Image
                  src={g.imageUrl}
                  alt={g.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-contain p-4"
                />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-sm font-semibold text-slate-900">
                    {g.name}
                  </h2>
                  {typeof g.price === "number" && (
                    <span className="text-sm font-medium text-slate-900">
                      ${g.price}
                    </span>
                  )}
                </div>
                {g.brand && (
                  <p className="truncate text-xs text-slate-500">{g.brand}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                    {g.fabric}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700">
                    {g.category}
                  </span>
                </div>
                <Link
                  href={mirrorUrlForCatalogItem(g)}
                  className="mt-1 block rounded-md bg-blue-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Try On →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
