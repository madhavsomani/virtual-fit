# 3D Upload Flow Trace

## Function: `handleUpload3D(file: File)`
Location: `app/mirror/page.tsx` lines ~1455-1560

## Input
- `file: File` — image file uploaded by user (clothing photo)

## Flow Diagram

```
handleUpload3D(file)
    │
    ├─► Check NEXT_PUBLIC_TRIPOSR_URL
    │   └─► [MISSING] → setStatus('❌ 3D service not configured...') → handleUpload(file) → RETURN
    │
    ├─► Check savedGarments.length >= 10
    │   └─► [LIMIT REACHED] → setStatus('⚠️ Upload limit reached.') → RETURN
    │
    ├─► setUploading(true), setUploadProgress(10), setStatus('🧊 Generating 3D mesh...')
    │
    ├─► Create FormData, append 'image' field
    │
    ├─► fetch(WORKER_URL, { method: 'POST', body: fd })
    │   ├─► [FETCH THROWS] → catch block → setStatus('❌ 3D failed: ...') 
    │   │                   → setGarment3DStatus('error') → handleUpload(file) → RETURN
    │   │
    │   └─► [FETCH OK] → check resp.ok
    │       ├─► [!resp.ok] → throw Error('3D service error ${status}') → catch → fallback 2D
    │       │
    │       └─► [resp.ok] → resp.blob() → glbBlob
    │
    ├─► Persist to localStorage (optional, wrapped in try/catch)
    │   - virtualfit-glb-data (base64)
    │   - virtualfit-glb-provider (from X-Provider header)
    │   - virtualfit-glb-ts (ISO timestamp)
    │
    ├─► URL.createObjectURL(glbBlob) → glbUrl
    │
    ├─► GLTFLoader.loadAsync(glbUrl) → gltf
    │   └─► [PARSE ERROR] → catch block → setStatus('❌ 3D failed: ...') → fallback 2D
    │
    ├─► Scene manipulation (if sceneRef.current && garmentMeshRef.current):
    │   1. Remove old garment mesh
    │   2. Dispose geometry/material
    │   3. Remove old garment3DModelRef if exists
    │   4. Extract gltf.scene as model
    │   5. Traverse: set castShadow=true, material.side=DoubleSide
    │   6. Normalize: center model, scale to fit 2.0 units
    │   7. Add to scene
    │   8. Set garment3DModelRef.current = model
    │   9. Create invisible dummy mesh for position/scale compatibility
    │
    ├─► setGarment3DStatus('loaded')
    ├─► setGarment3DProvider(from X-Provider header or 'hunyuan3d-2')
    ├─► setStatus('✅ 3D garment loaded!')
    │
    ├─► Save to gallery:
    │   - garmentName = file.name + ' (3D)'
    │   - newGarment = { name, dataUrl: 'local:' + timestamp }
    │   - Update savedGarments state
    │   - Persist to localStorage
    │
    └─► finally: setUploading(false), setUploadProgress(0)
```

## Branch Summary

| Branch | Trigger | Status Text | Action |
|--------|---------|-------------|--------|
| **ENV_MISSING** | `!NEXT_PUBLIC_TRIPOSR_URL` | "❌ 3D service not configured (NEXT_PUBLIC_TRIPOSR_URL). Using 2D mode." | Fallback to `handleUpload(file)` |
| **LIMIT_REACHED** | `savedGarments.length >= 10` | "⚠️ Upload limit reached." | Return early |
| **FETCH_ERROR** | `fetch()` throws | "❌ 3D failed: {message}. Falling back to 2D." | setGarment3DStatus('error'), fallback 2D |
| **NON_OK_RESPONSE** | `!resp.ok` (e.g., 502) | "❌ 3D failed: 3D service error {status}: {text}. Falling back to 2D." | setGarment3DStatus('error'), fallback 2D |
| **GLTF_PARSE_ERROR** | `GLTFLoader.loadAsync()` throws | "❌ 3D failed: {message}. Falling back to 2D." | setGarment3DStatus('error'), fallback 2D |
| **SUCCESS** | All steps pass | "✅ 3D garment loaded! Move around to see it track." | Model added to scene, saved to gallery |

## State Changes

| State | Type | Set When |
|-------|------|----------|
| `uploading` | boolean | true at start, false in finally |
| `uploadProgress` | number | 10→20→60→80→90→100→0 |
| `status` | string | Various messages per branch |
| `garment3DStatus` | string | 'loaded' on success, 'error' on failure |
| `garment3DProvider` | string | From X-Provider header or 'hunyuan3d-2' |
| `savedGarments` | array | Appended with new garment on success |

## Dependencies
- `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader`
- `THREE.Box3`, `THREE.Vector3` for normalization
- `sceneRef.current` (Three.js scene)
- `garmentMeshRef.current` (current 2D garment mesh)
- `garment3DModelRef.current` (current 3D model group)
