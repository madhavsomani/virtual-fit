/**
 * 3D Generation Service — calls Meshy API (primary) or HF Inference (fallback)
 * 
 * Designed to work as:
 * 1. Imported module (for serverless functions / Azure SWA Functions)
 * 2. Standalone Express endpoint (for local dev)
 * 
 * Environment variables:
 *   MESHY_API_KEY — required for Meshy API
 *   HF_TOKEN     — optional, for HF Inference priority queue
 */

const MESHY_BASE = 'https://api.meshy.ai/openapi/v2';
const HF_TRIPOSR = 'https://api-inference.huggingface.co/models/stabilityai/TripoSR';

export interface Generate3DRequest {
  imageUrl?: string;      // URL to clothing image
  imageBase64?: string;   // base64-encoded image (data URI or raw)
  provider?: 'meshy' | 'huggingface' | 'auto';
}

export interface Generate3DResponse {
  taskId: string;
  provider: 'meshy' | 'huggingface';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  glbUrl?: string;
  progress?: number;
  error?: string;
}

// --- Meshy API ---

export async function meshyCreateTask(imageUrl: string): Promise<{ taskId: string }> {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) throw new Error('MESHY_API_KEY not set');

  const res = await fetch(`${MESHY_BASE}/image-to-3d`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      enable_pbr: true,
      topology: 'quad',       // cleaner mesh for clothing
      target_polycount: 30000, // reasonable for real-time rendering
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meshy create failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { taskId: data.result };
}

export async function meshyPollTask(taskId: string): Promise<Generate3DResponse> {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) throw new Error('MESHY_API_KEY not set');

  const res = await fetch(`${MESHY_BASE}/image-to-3d/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meshy poll failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  
  return {
    taskId,
    provider: 'meshy',
    status: data.status === 'SUCCEEDED' ? 'completed'
          : data.status === 'FAILED' ? 'failed'
          : data.status === 'PROCESSING' ? 'processing'
          : 'pending',
    glbUrl: data.model_urls?.glb || undefined,
    progress: data.progress || 0,
    error: data.status === 'FAILED' ? (data.message || 'Generation failed') : undefined,
  };
}

// --- HuggingFace Inference API ---

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

// --- Unified handler ---

export async function generate3D(req: Generate3DRequest): Promise<Generate3DResponse> {
  const provider = req.provider || 'auto';
  const imageUrl = req.imageUrl;
  
  if (!imageUrl) {
    return {
      taskId: '',
      provider: 'meshy',
      status: 'failed',
      error: 'imageUrl is required',
    };
  }

  // Auto: try Meshy first if key is set, else HF
  if (provider === 'meshy' || (provider === 'auto' && process.env.MESHY_API_KEY)) {
    try {
      const { taskId } = await meshyCreateTask(imageUrl);
      return {
        taskId,
        provider: 'meshy',
        status: 'pending',
        progress: 0,
      };
    } catch (e) {
      if (provider === 'meshy') throw e;
      // Auto mode: fall through to HF
      console.warn('Meshy failed, falling back to HF:', (e as Error).message);
    }
  }

  // HuggingFace fallback
  return hfGenerate3D(imageUrl);
}
