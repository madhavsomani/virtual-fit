# 3D Garment Generation Research

## Overview
This document summarizes options for converting 2D garment images to 3D meshes (.glb format) for VirtualFit's try-on experience.

## Options Evaluated

### 1. TripoSR (Recommended for Local)
**Source:** https://github.com/VAST-AI-Research/TripoSR

- **Speed:** <0.5 seconds per image (on GPU)
- **License:** MIT (open source)
- **Developed by:** Tripo AI + Stability AI
- **Output:** 3D mesh from single image
- **Architecture:** Transformer-based (LRM-inspired)

**M1 Mac Considerations:**
- Requires ~6GB RAM
- MPS (Metal) support needed for acceleration
- May be slower without CUDA GPU (10-30s on CPU)

**Setup:**
```bash
git clone https://github.com/VAST-AI-Research/TripoSR
cd TripoSR
pip install -r requirements.txt
python run.py input.png --output output.glb
```

### 2. InstantMesh (Alternative)
**Source:** Tencent PCG ARC Lab / Hugging Face

- **Speed:** ~10 seconds per image
- **Quality:** Higher quality than TripoSR for complex objects
- **Architecture:** Multi-view diffusion + mesh reconstruction

**Pros:**
- Better detail preservation
- Works well with clothing/fabric

**Cons:**
- Slower than TripoSR
- Higher memory requirements

### 3. Hugging Face Inference API (Recommended for MVP)
**URL:** https://huggingface.co/models?pipeline_tag=image-to-3d

**Pros:**
- No local GPU needed
- Free tier available
- Multiple model options (TripoSR, InstantMesh, TRELLIS)
- Easy API integration

**Cons:**
- Network latency
- Rate limits on free tier
- Dependency on external service

**Integration Example:**
```typescript
const response = await fetch(
  "https://api-inference.huggingface.co/models/stabilityai/TripoSR",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: imageBlob,
  }
);
const glbBuffer = await response.arrayBuffer();
```

### 4. Meshy API (Production Quality)
**URL:** https://www.meshy.ai/

- **Free tier:** 200 credits/month
- **Quality:** Best-in-class results
- **Output:** High-poly meshes with textures

**Pros:**
- Production-ready quality
- REST API
- Texture generation included

**Cons:**
- Limited free tier
- Costs scale with usage

## Recommendation

### Phase 1 (MVP) - Use Hugging Face Inference API
1. Zero infrastructure needed
2. Test with TripoSR model
3. Validate 3D try-on UX before investing in local inference

### Phase 2 (Production) - Evaluate:
- **High volume:** Local TripoSR with GPU server
- **Best quality:** Meshy API with credit budget
- **Hybrid:** HF for dev, Meshy for production

## Next Steps
1. [ ] Get HuggingFace API token
2. [ ] Create /api/generate-3d endpoint (or use client-side)
3. [ ] Test with sample garment images
4. [ ] Measure latency and quality
5. [ ] Integrate with ThreeOverlay component

## Sample GLB Sources (for testing)
- Sketchfab (free downloads)
- poly.pizza (public domain)
- Google Poly archive

---
*Last updated: 2026-04-20*
