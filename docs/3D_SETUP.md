# 3D Generation Setup Guide (Phase 7.41 rewrite)

## TL;DR
Set `NEXT_PUBLIC_HF_TOKEN` (a free HuggingFace read-only token) in your
deployment environment. That's it. No paid keys, no Azure Functions, no
provider chain — the photo→GLB pipeline calls the public
`microsoft/TRELLIS` HF Space directly and runs on the free ZeroGPU A10G
tier.

## Why no paid providers
The project HARD RULES include "NO paid APIs." Phase 7.41 deleted the
old `api/generate-3d/` Azure Function (311 lines wiring Meshy +
HuggingFace + Replicate as fallbacks) because:
- Meshy and Replicate are paid.
- Zero client code called the endpoint — `app/lib/trellis-client.ts`
  was already the real path used by the `/generate-3d` page.
- Dead paid-API code is a footgun: a future agent could set
  `MESHY_API_KEY` and burn real money on a code path nobody uses.

## How to get the HF token
1. Go to https://huggingface.co/settings/tokens
2. Create a token with **read** access (free).
3. Set `NEXT_PUBLIC_HF_TOKEN=hf_xxxxx` in:
   - local dev: `.env.local`
   - Azure SWA: Portal → Static Web App → Configuration →
     Application settings (must start with `NEXT_PUBLIC_` since the
     browser reads it directly).
4. Redeploy. Done.

## End-to-end flow
```
User uploads image → /generate-3d page (Next.js)
    → app/lib/trellis-client.ts.generateMesh(file)
    → POST https://microsoft-trellis.hf.space/run/predict
       Authorization: Bearer NEXT_PUBLIC_HF_TOKEN
    → Returns GLB URL on the HF Space's CDN
    → Persist to localStorage
    → Redirect to /mirror
    → GLTFLoader loads the GLB into the Three.js scene
    → MediaPipe Pose tracks body landmarks
    → Mesh anchored to shoulders/torso in real-time
```

## Troubleshooting

### "NEXT_PUBLIC_TRIPOSR_URL is not configured" / "NEXT_PUBLIC_HF_TOKEN is required"
→ Set the env var as above.

### Model looks wrong / not like clothing
TRELLIS works best with:
- Clear photos on plain/white background
- Single garment, no person wearing it
- Good lighting, no shadows

### Model doesn't track body
- Use `/mirror` (the canonical try-on with body tracking).
- Stand back so shoulders + torso are visible.
- Check lighting — MediaPipe needs to see you.

### Slow generation
TRELLIS on the free ZeroGPU tier can take 30-60s and may queue behind
other users. There is no paid fallback by design.

## Architecture
```
┌─────────────────────────────────────┐
│  /generate-3d (Next.js client page) │
│  → trellis-client.generateMesh()    │
│  → microsoft/TRELLIS HF Space       │
│  → Persist GLB to localStorage      │
│  → Redirect /mirror                 │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  /mirror (full try-on)              │
│  ├─ MediaPipe Pose (body tracking)  │
│  ├─ Three.js (GLB rendering)        │
│  ├─ GLTFLoader (loads the mesh)     │
│  └─ Anchor: shoulders → mesh pos    │
└─────────────────────────────────────┘
```
