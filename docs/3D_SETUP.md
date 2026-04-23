# 3D Generation Setup Guide

## Quick Start
1. Get a free Meshy API key: https://www.meshy.ai (sign up → API Keys)
2. Add to Azure SWA: Portal → Static Web App → Settings → Configuration → Application settings
3. Add: `MESHY_API_KEY` = your key
4. Save. Done — 3D generation now works at `/generate-3d`

## Provider Priority
The API tries providers in order until one succeeds:

| Priority | Provider | Env Var | Quality | Speed | Free Tier |
|----------|----------|---------|---------|-------|-----------|
| 1 | Meshy | `MESHY_API_KEY` | ★★★★★ | 30-60s | 100 credits/mo |
| 2 | HuggingFace | `HF_TOKEN` | ★★★☆☆ | 10-30s | Unlimited (rate-limited) |
| 3 | Replicate | `REPLICATE_API_TOKEN` | ★★★★☆ | 30-120s | Free credits to start |
| 4 | Mock | (none needed) | ★☆☆☆☆ | Instant | Always available |

## How to Get Keys

### Meshy (Recommended)
1. Go to https://www.meshy.ai
2. Sign up (free account)
3. Go to Settings → API Keys
4. Create a new key
5. Add to Azure: `MESHY_API_KEY=msy_xxxxx`

### HuggingFace
1. Go to https://huggingface.co/settings/tokens
2. Create a new token (read access is enough)
3. Add to Azure: `HF_TOKEN=hf_xxxxx`

### Replicate
1. Go to https://replicate.com/account/api-tokens
2. Create a token
3. Add to Azure: `REPLICATE_API_TOKEN=r8_xxxxx`

## Azure SWA Environment Variables
1. Azure Portal → your Static Web App resource
2. Settings → Configuration → Application settings
3. Add each key as a new setting
4. Click Save
5. The API auto-detects which keys are available

## End-to-End Flow
```
User uploads image → /generate-3d page
    → POST /api/generate-3d { imageBase64 }
    → Provider chain: Meshy → HF → Replicate → Mock
    → Returns { glbUrl, provider, isMock }
    → Redirect to /mirror?garment=<glbUrl>
    → GLTFLoader loads mesh into Three.js scene
    → MediaPipe tracks body landmarks
    → Mesh anchored to shoulders/torso in real-time
```

## Troubleshooting

### "No 3D API key configured" on /generate-3d
→ Add at least one API key (MESHY_API_KEY recommended)

### Model looks wrong / not like clothing
→ TripoSR/Meshy work best with:
  - Clear photos on plain/white background
  - Single garment, no person wearing it
  - Good lighting, no shadows
  - Remove background before uploading (or the API will try)

### Model doesn't track body
→ Ensure you're on /mirror (the canonical 3D try-on with body tracking)
→ Stand back so shoulders + torso are visible
→ Check lighting — MediaPipe needs to see you

### Slow generation
→ Meshy: 30-60s is normal (cloud GPU processing)
→ HF: may show "model loading" on first request (cold start ~30s)
→ Replicate: can take 2+ minutes on free tier

## Architecture
```
┌─────────────────────────────────────┐
│  /generate-3d (upload UI)           │
│  → POST /api/generate-3d           │
│  → Provider chain                   │
│  → Redirect /mirror?garment=url     │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  /mirror (full try-on)              │
│  ├─ MediaPipe Pose (body tracking)  │
│  ├─ Three.js (GLB rendering)       │
│  ├─ GLTFLoader (loads the mesh)     │
│  └─ Anchor: shoulders → mesh pos   │
└─────────────────────────────────────┘
```
