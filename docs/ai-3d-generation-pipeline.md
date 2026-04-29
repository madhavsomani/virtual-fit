# AI 3D Generation Pipeline

VF-9 ships the garment mesh generation pipeline contract, not a live AI backend.
The goal is to let the catalog track mesh-generation jobs now while keeping the
runtime integration with TRELLIS explicitly blocked until it is approved.

## Overview

The pipeline follows a small, stable flow:

1. `createJob()` creates a queued `MeshGenJob`.
2. An adapter receives `{ garmentId, sourceImageUrl, outputAbsPath }`.
3. The caller moves the job through `transitionJob()`.
4. The final job snapshot is appended to `data/garment-pipeline-jobs.json`.

The ledger format is append-only JSON. Each invocation records one final job
record with timestamps, adapter name, and either an `outputAssetUrl` or an
`error`.

## Job Contract

`lib/garment-pipeline.ts` is pure and SSR-safe.
It contains:

- `MeshGenJobStatus`
- `MeshGenJob`
- `MeshGenAdapter`
- `createJob()`
- `transitionJob()`
- `isTerminal()`
- `summarize()`

There is no filesystem access, fetch, or adapter-specific logic in this file.
That keeps the queue contract safe to import from server code, tests, and future
workers without side effects.

## Adapter Contract

Every adapter implements:

```ts
type MeshGenAdapter = {
  name: string;
  generate(input: {
    garmentId: string;
    sourceImageUrl: string;
    outputAbsPath: string;
  }): Promise<{ outputAssetUrl: string }>;
};
```

The adapter owns artifact creation.
The caller owns queue state transitions and manifest persistence.

That split matters because:

- adapters can stay narrow and testable
- the manifest format stays stable across adapters
- future queue runners can add retries or scheduling without changing adapters

## Stub Adapter

`lib/garment-pipeline-stub-adapter.mjs` is the default VF-9 adapter.
It writes a minimal 12-byte binary glTF header:

- magic: `glTF`
- version: `2`
- total length: `12`

This placeholder file is intentional.
It is large enough for `hasMesh()` to treat the asset as present on disk, but it
is not a usable garment mesh.

The downstream expectation is fail-soft behavior:

- catalog and kiosk flows can observe mesh presence
- a future viewer should handle the placeholder without crashing
- real geometry will arrive in a later ticket when a real adapter is approved

## TRELLIS Reserved Slot

`lib/garment-pipeline-trellis-adapter.ts` exists only as a reserved adapter
slot.
Its `generate()` method always throws.

The approval blocker is explicit:

- TRELLIS is a HuggingFace Space, not a local library
- calling it cleanly needs `gradio-client` or a hand-rolled HTTP client
- `gradio-client` would be a new dependency, which VF-9 does not allow
- real jobs depend on Space warmup and multi-minute polling
- that runtime is not appropriate for CI or the current local workflow

Until approval is granted, use `stubAdapter`.

## CLI Runner

Use the zero-dependency CLI to generate a placeholder mesh:

```bash
node scripts/generate-garment-mesh.mjs --garment core-crew-tee --image https://example.com/front.png
```

The adapter defaults to `stub`.
You can also point at the reserved adapter to confirm the approval guard:

```bash
node scripts/generate-garment-mesh.mjs --garment core-crew-tee --image ./front.png --adapter trellis
```

Expected behavior:

- `stub` writes `public/garments/<id>.glb`
- the CLI appends one final job record to `data/garment-pipeline-jobs.json`
- `trellis` exits non-zero with the approval-pending error

For tests, the CLI also accepts `VF9_ROOT_DIR` so output and manifest paths can
be redirected to a temporary root.

## Manifest Format

The manifest lives at `data/garment-pipeline-jobs.json`.
It is committed at `[]` so the audit trail exists at `HEAD`.

Example entry:

```json
{
  "id": "018f...",
  "garmentId": "core-crew-tee",
  "sourceImageUrl": "https://example.com/front.png",
  "adapter": "stub",
  "status": "succeeded",
  "createdAt": "2026-04-28T00:00:00.000Z",
  "startedAt": "2026-04-28T00:00:01.000Z",
  "finishedAt": "2026-04-28T00:00:02.000Z",
  "outputAssetUrl": "/garments/core-crew-tee.glb"
}
```

Failed jobs use the same shape and populate `error`.

## Asset Presence vs Catalog Presence

VF-8 already established `hasAsset()` in `lib/garment-library.ts`.
That function remains a path-shape check only:

- it validates `/garments/<id>.glb`
- it does not touch the filesystem

VF-9 adds `hasMesh()` in `lib/garment-asset.ts`.
That function checks:

- file existence under `public/garments`
- file size of at least 12 bytes

This divergence is intentional.
The catalog can still declare an expected asset path before a mesh has actually
been generated.

## Kiosk Wiring

The mirror UI must remain statically prerenderable.
Because of that, the client component does not call `hasMesh()`.

Instead:

- `app/mirror/page.tsx` imports `GARMENT_LIBRARY`
- the server component checks `hasMesh()` for each garment at build time
- it passes `availableMeshIds` into `WebcamMirror`
- the tray badge shows `Ready` when an id has a real on-disk mesh
- otherwise it keeps showing `Coming soon`

This preserves the existing mirror contracts while surfacing real mesh
availability.

## Adding a Future Adapter

To add a new adapter later:

1. Implement the `MeshGenAdapter` contract.
2. Write the artifact to `outputAbsPath`.
3. Return `{ outputAssetUrl: "/garments/<id>.glb" }`.
4. Register the adapter in `scripts/generate-garment-mesh.mjs` or a future job runner.
5. Reuse the same manifest format and queue transitions.

If TRELLIS is approved later, the migration path is simple:

- implement `trellisAdapter.generate()`
- invoke the CLI with `--adapter trellis`
- keep `MeshGenJob` and manifest structure unchanged

That is the main point of VF-9: the pipeline contract ships now, and the real AI
backend can land later without reshaping the audit trail or kiosk availability
flow.
