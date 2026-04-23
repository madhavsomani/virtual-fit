/**
 * 3D Generation Service — HuggingFace Inference (TripoSR) only.
 *
 * Phase 7.10: Meshy (paid API) removed. HARD RULE forbids paid APIs;
 * vision uses HF Spaces (TRELLIS) / HF Inference (segformer) / free GLBs only.
 *
 * Designed to work as:
 * 1. Imported module (for serverless functions / Azure SWA Functions)
 * 2. Standalone Express endpoint (for local dev via api-server.ts)
 *
 * Environment variables:
 *   HF_TOKEN     — optional, for HF Inference priority queue
 */

const HF_TRIPOSR = 'https://api-inference.huggingface.co/models/stabilityai/TripoSR';

export interface Generate3DRequest {
  imageUrl?: string;      // URL to clothing image
  imageBase64?: string;   // base64-encoded image (data URI or raw)
  provider?: 'huggingface' | 'auto'; // Phase 7.10: 'meshy' removed
}

export interface Generate3DResponse {
  taskId: string;
  provider: 'huggingface';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  glbUrl?: string;
  progress?: number;
  error?: string;
}

// --- HuggingFace Inference API (TripoSR) ---

export async function hfGenerate3D(imageUrl: string): Promise<Generate3DResponse> {
  const token = process.env.HF_TOKEN;

  // Download image first
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBlob = await imgRes.blob();

  const res = await fetch(HF_TRIPOSR, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: imgBlob,
  });

  if (!res.ok) {
    const err = await res.text();
    // HF returns 503 when model is loading
    if (res.status === 503) {
      return {
        taskId: `hf-${Date.now()}`,
        provider: 'huggingface',
        status: 'pending',
        error: 'Model is loading, retry in 30s',
      };
    }
    throw new Error(`HF inference failed (${res.status}): ${err}`);
  }

  // HF returns the 3D model bytes directly
  const meshBytes = await res.arrayBuffer();

  // Convert to base64 data URI for client consumption
  const base64 = Buffer.from(meshBytes).toString('base64');
  const dataUri = `data:model/gltf-binary;base64,${base64}`;

  return {
    taskId: `hf-${Date.now()}`,
    provider: 'huggingface',
    status: 'completed',
    glbUrl: dataUri,
  };
}

// --- Unified handler (HF-only after Phase 7.10) ---

export async function generate3D(req: Generate3DRequest): Promise<Generate3DResponse> {
  const imageUrl = req.imageUrl;

  if (!imageUrl) {
    return {
      taskId: '',
      provider: 'huggingface',
      status: 'failed',
      error: 'imageUrl is required',
    };
  }

  return hfGenerate3D(imageUrl);
}
