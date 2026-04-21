# 3D Flow Bug Report — 2026-04-20

## Summary
Madhav uploaded a sari photo to `/generate-3d` and expected a 3D mesh of the sari to appear on `/mirror-3d` overlaid on his body. Instead he got a rubber duck model rotating on screen.

## Root Cause
**`NEXT_PUBLIC_HF_TOKEN` is not set in production.** Without this env var, `/generate-3d` enters "demo mode" which:
1. Fakes a 3-second processing animation
2. Returns a hardcoded Duck.glb URL from KhronosGroup GitHub samples
3. Links to `/mirror-3d?model=<duck-url>`

The duck model then loads on `/mirror-3d` which is just a basic Three.js viewer — it rotates the model but does NOT anchor it to body landmarks.

## What's Actually Broken (3 things)

### 1. No API Key = No Real 3D Generation
- `NEXT_PUBLIC_HF_TOKEN` not set in Azure SWA environment
- The HF TripoSR endpoint (`api-inference.huggingface.co/models/stabilityai/TripoSR`) returns 3D meshes from images
- Without the key, the page silently fakes success with a duck model
- **Impact:** 100% of users get a rubber duck instead of their garment

### 2. Demo Mode is Deceptive
- Shows "Demo Mode" yellow banner but still shows progress bar + "✓ 3D Model Ready!"
- User thinks generation worked — clicks "Try On" — sees duck
- Should instead: refuse to generate, show "API key required" error, or at minimum clearly label the result as "SAMPLE MODEL (not your garment)"

### 3. /mirror-3d Has No Body Tracking
- It's just a rotating 3D model viewer on top of camera feed
- No MediaPipe pose detection
- No body anchoring (the model doesn't follow shoulders/torso)
- It's essentially a glorified 3D model previewer, not "virtual try-on"
- The model auto-rotates at `0.01 rad/frame` which makes it look broken

## Required Fixes (Priority Order)

### Fix 1: Make Demo Mode Honest (IMMEDIATE)
- When no HF token: show CLEAR error "3D generation requires API setup. Contact admin."
- Don't fake a successful generation
- Don't send user to mirror-3d with a duck model

### Fix 2: Set HF Token (REQUIRES MADHAV)
- Get free HF token from https://huggingface.co/settings/tokens
- Add to Azure SWA: Settings → Configuration → Application settings → `NEXT_PUBLIC_HF_TOKEN=hf_xxxx`
- Note: HF Inference API free tier has rate limits (~30 requests/hour)

### Fix 3: /mirror-3d Needs Body Tracking
- Currently: no MediaPipe, no pose detection, model just rotates
- Needed: same pose tracking as /mirror + anchor 3D model to shoulders
- This is the hardest fix — /mirror has 7000+ lines of pose tracking code
- Options:
  a) Import `updateGarmentFromLandmarks` from /mirror into /mirror-3d
  b) Merge /mirror-3d into /mirror (add GLB loading to existing pose-tracked scene)
  c) Keep /mirror-3d as "preview only" and redirect actual try-on to /mirror

### Fix 4: HF TripoSR May Not Work for Clothing
- TripoSR was trained on Objaverse (objects, not clothing)
- A sari photo → TripoSR will likely produce a crumpled blob, not a wearable mesh
- Better alternatives for clothing specifically:
  a) **Meshy API** — better quality, 100 free credits/month
  b) **ClothingGAN** or **SMPL-based** approaches — purpose-built for garments
  c) **2D overlay** (current /mirror) — actually looks decent for clothing

## Recommendation
The 2D overlay on `/mirror` already works well for try-on. The "3D" path is fundamentally broken:
- No API key
- Wrong model (TripoSR not designed for clothing)  
- No body tracking on the output page

**Short term:** Make the UI honest. Remove/hide `/generate-3d` link from main nav, or add giant warning that it's experimental.

**Medium term:** If Madhav wants real 3D, we need:
1. Meshy API key (better for clothing)
2. Body-tracked GLB rendering (merge into /mirror's existing pose system)
3. Custom garment mesh processing (flatten/align the generated mesh to body)

## Files Involved
- `app/generate-3d/page.tsx` — the upload page (demo mode logic)
- `app/mirror-3d/page.tsx` — the viewer (no body tracking)
- `app/lib/generate-3d.ts` — server-side API wrappers (unused by generate-3d page)
- `app/lib/generate-3d-client.ts` — client hooks (unused by generate-3d page)

## Environment
- Production: https://wonderful-sky-0513a3610.7.azurestaticapps.net
- `NEXT_PUBLIC_HF_TOKEN`: NOT SET
- `MESHY_API_KEY`: NOT SET
