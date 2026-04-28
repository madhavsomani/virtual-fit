"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { embedText, cosineSimilarity } from "../lib/style-embeddings.mjs";

export default function StyleMeBrowser({ index }) {
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState("");

  const dim = index?.embeddingVersion?.dim || 256;

  // Hydrate vector arrays into Float32Array once.
  const entries = useMemo(() => {
    if (!index?.entries) return [];
    return index.entries.map((e) => ({
      ...e,
      vec: Float32Array.from(e.vector),
    }));
  }, [index]);

  const targetVec = useMemo(() => {
    if (pickedId) {
      const hit = entries.find((e) => e.id === pickedId);
      return hit ? hit.vec : null;
    }
    if (query.trim().length === 0) return null;
    return embedText(query, dim);
  }, [query, pickedId, entries, dim]);

  const neighbours = useMemo(() => {
    if (!targetVec) return [];
    const scored = [];
    for (const e of entries) {
      if (e.id === pickedId) continue;
      const score = cosineSimilarity(targetVec, e.vec);
      scored.push({ id: e.id, score, garment: e });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  }, [entries, targetVec, pickedId]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-600">
          Describe a vibe
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPickedId("");
            }}
            placeholder="oversized cream cotton tee"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="mt-4 text-center text-xs text-slate-400">
          — or pick from the catalog —
        </div>
        <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {entries.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setPickedId(e.id);
                setQuery("");
              }}
              className={
                "rounded-full px-3 py-1 text-xs ring-1 transition " +
                (pickedId === e.id
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-blue-50")
              }
            >
              {e.name}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Top matches">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {neighbours.length > 0 ? "Closest matches" : "Type or pick to see matches"}
        </h2>
        {neighbours.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-3">
            {neighbours.map((n, i) => (
              <li
                key={n.id}
                className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200"
              >
                <div
                  className="h-32 w-full"
                  style={{ backgroundColor: n.garment.palette?.primary || "#e2e8f0" }}
                />
                <div className="space-y-1 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {n.garment.name}
                    </h3>
                    <span className="text-xs text-slate-400">#{i + 1}</span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {n.garment.category} · {n.garment.fabric}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    similarity {(n.score * 100).toFixed(1)}%
                  </p>
                  <Link
                    href={`/mirror?garment=${encodeURIComponent(
                      n.garment.glbUrl,
                    )}&fabric=${n.garment.fabric}&styleMatch=${n.id}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Try on →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
