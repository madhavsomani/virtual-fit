# 3D Provider Smoke Tests — DEPRECATED (Phase 7.41)

**This file used to document `curl` smoke-tests against `api/generate-3d/`,
a 311-line Azure SWA function that wired up Meshy + HuggingFace + Replicate
as fallback providers.**

That endpoint was deleted in Phase 7.41 because:

1. **It violated the project HARD RULE: "NO paid APIs."** Meshy and
   Replicate are paid. The HF rule allows free Spaces only.
2. **Zero client code called it.** A grep across `app/**/*.tsx` and
   `app/**/*.ts` for `fetch('/api/generate-3d'` returned no matches.
3. **The real photo→GLB pipeline lives at `app/lib/trellis-client.ts`**
   and calls the public `microsoft/TRELLIS` HF Space directly (free
   ZeroGPU A10G tier). The user-facing `/generate-3d` Next.js page is the
   single entrypoint.

## How to smoke-test the real path

Open `/generate-3d` in the browser, drop in a garment image, and watch
the GLB download. The flow is fully client-side; there is no Azure
Function involved.

For programmatic testing, see `app/lib/trellis-client.ts` — its
`generateMesh()` export is the canonical entry point. There is no curl
recipe because the auth header reads `NEXT_PUBLIC_HF_TOKEN` from the
browser environment.
