// Phase 8.11 — /style-me static SSR route. Loads the precomputed
// embedding index at build time and ships a thin client island that
// runs cosine similarity against the user's free-text query.

import StyleMeBrowser from "./StyleMeBrowser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const dynamic = "force-static";

function loadIndex() {
  try {
    const p = resolve(process.cwd(), "public/data/style-index.json");
    const raw = readFileSync(p, "utf8");
    const data = JSON.parse(raw);
    return data;
  } catch {
    return { entries: [], embeddingVersion: null, count: 0 };
  }
}

export default function StyleMePage() {
  const index = loadIndex();
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-600">
          Phase 8 · Style
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Style Me</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Type a vibe or pick a garment — get the {Math.min(3, index.entries.length)}{" "}
          closest matches from our 3D catalog. 100% local: no API calls, no
          tracking, no model downloads.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Index: {index.count} garments · algorithm{" "}
          <code>{index.embeddingVersion?.algorithm || "n/a"}</code> v
          {index.embeddingVersion?.version || "?"}
        </p>
      </header>
      <StyleMeBrowser index={index} />
    </main>
  );
}
