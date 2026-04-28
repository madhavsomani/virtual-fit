// Phase 8.11 — AI styling embeddings (local, zero-dep, free).
//
// Hard rule: no paid APIs. We ship a deterministic hashed-bigram bag
// of words embedding + cosine similarity. It runs in node and the
// browser, has no model download, no network call, and is good enough
// for "find me the 3 garments most like this one" over our catalog
// description corpus. The shape mirrors a real embedding service so
// we can swap in a local SBERT/ONNX model later behind the same
// interface without changing callers.
//
// API:
//   embedText(text, dim?)            → Float32Array(dim) (L2-normalised)
//   embedGarment(g, dim?)            → Float32Array(dim)
//   cosineSimilarity(a, b)           → number in [-1, 1]
//   styleNeighbours(target, corpus, opts?) → [{id, score, garment}]
//   buildEmbeddingIndex(corpus, dim?) → { dim, vectors:Map<id, Float32Array> }
//
// All garment text fields (name, brand, tagline, tags[], category,
// fabric, materials.composition[].name) are concatenated into a single
// document before embedding. We lowercase, strip non-letters, tokenise
// to whitespace + char-bigrams, then hash each token into one of `dim`
// buckets and accumulate. Final vector is L2-normalised so cosine
// similarity reduces to a dot product.

const DEFAULT_DIM = 256;

function hashStringToInt(str) {
  // FNV-1a 32-bit. Fast, no deps, well-distributed for short strings.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function tokenise(text) {
  if (typeof text !== "string") return [];
  const cleaned = text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
  const out = [];
  for (const w of words) {
    out.push(w);
    // Char bigrams for sub-word similarity (e.g. "cotton" ↔ "cottons").
    for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  }
  return out;
}

function l2Normalise(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const n = Math.sqrt(sum);
  if (n === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / n;
  return vec;
}

export function embedText(text, dim = DEFAULT_DIM) {
  if (!Number.isInteger(dim) || dim < 16 || dim > 4096) {
    throw new Error(`embedText: dim must be 16..4096 (got ${dim})`);
  }
  const v = new Float32Array(dim);
  for (const tok of tokenise(text)) {
    const bucket = hashStringToInt(tok) % dim;
    v[bucket] += 1;
  }
  return l2Normalise(v);
}

export function garmentToText(g) {
  if (!g || typeof g !== "object") return "";
  const parts = [];
  if (g.name) parts.push(g.name);
  if (g.brand) parts.push(g.brand);
  if (g.tagline) parts.push(g.tagline);
  if (g.category) parts.push(g.category);
  if (g.fabric) parts.push(g.fabric);
  if (Array.isArray(g.tags)) parts.push(g.tags.join(" "));
  if (g.materials && Array.isArray(g.materials.composition)) {
    parts.push(g.materials.composition.map((c) => c?.name).filter(Boolean).join(" "));
  }
  return parts.join(" ");
}

export function embedGarment(g, dim = DEFAULT_DIM) {
  return embedText(garmentToText(g), dim);
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error("cosineSimilarity: vectors must be same length");
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // Both sides are L2-normalised → dot product == cosine.
  return dot;
}

export function buildEmbeddingIndex(corpus, dim = DEFAULT_DIM) {
  if (!Array.isArray(corpus)) throw new Error("buildEmbeddingIndex: corpus must be array");
  const vectors = new Map();
  for (const g of corpus) {
    if (!g || !g.id) continue;
    vectors.set(g.id, embedGarment(g, dim));
  }
  return { dim, vectors };
}

/**
 * Top-k most similar garments to `target` from `corpus`. `target` may
 * be a garment object OR a free-text query string ("oversized cream
 * cotton tee"). The target itself is excluded from results when it
 * shares an id with a corpus entry.
 */
export function styleNeighbours(target, corpus, { k = 3, dim = DEFAULT_DIM, minScore = 0 } = {}) {
  if (!Array.isArray(corpus)) throw new Error("styleNeighbours: corpus must be array");
  if (!Number.isInteger(k) || k < 1 || k > 50) {
    throw new Error(`styleNeighbours: k must be 1..50 (got ${k})`);
  }
  const targetVec = typeof target === "string"
    ? embedText(target, dim)
    : embedGarment(target, dim);
  const targetId = typeof target === "object" && target ? target.id : null;
  const scored = [];
  for (const g of corpus) {
    if (!g || !g.id) continue;
    if (targetId && g.id === targetId) continue;
    const v = embedGarment(g, dim);
    const score = cosineSimilarity(targetVec, v);
    if (score >= minScore) scored.push({ id: g.id, score, garment: g });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export const EMBEDDING_VERSION = Object.freeze({
  algorithm: "fnv1a-bigram-bow",
  dim: DEFAULT_DIM,
  // Bumping this string invalidates any cached embeddings (callers that
  // persist vectors should compare and re-embed on mismatch).
  version: "1.0.0",
});
