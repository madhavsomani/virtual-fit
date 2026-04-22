// Phase 4.3 — pure helper extracted from trellis-client.ts for node:test.

export function extractGlbPath(data) {
  const seen = new Set();
  function walk(x) {
    if (!x || seen.has(x)) return null;
    if (typeof x === "string") return x.endsWith(".glb") ? x : null;
    if (typeof x !== "object") return null;
    seen.add(x);
    if (typeof x.path === "string" && x.path.endsWith(".glb")) return x.path;
    if (typeof x.url === "string" && x.url.endsWith(".glb")) return x.url;
    if (typeof x.name === "string" && x.name.endsWith(".glb")) return x.name;
    if (Array.isArray(x)) {
      for (const item of x) {
        const r = walk(item);
        if (r) return r;
      }
    } else {
      for (const v of Object.values(x)) {
        const r = walk(v);
        if (r) return r;
      }
    }
    return null;
  }
  return walk(data);
}
