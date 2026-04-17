/**
 * Client-side hook for 3D generation.
 * 
 * In static export mode, calls an external API proxy.
 * Configure via NEXT_PUBLIC_API_BASE env var (defaults to same-origin for dev).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type Gen3DStatus = 'idle' | 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';

export interface Gen3DState {
  status: Gen3DStatus;
  progress: number;
  glbUrl: string | null;
  taskId: string | null;
  provider: string | null;
  error: string | null;
}

export async function startGeneration(imageFile: File): Promise<{ taskId: string; provider: string; glbUrl?: string }> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const res = await fetch(`${API_BASE}/api/generate-3d`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function pollGeneration(taskId: string, provider: string): Promise<{
  status: string;
  progress: number;
  glbUrl?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/api/generate-3d/status?taskId=${taskId}&provider=${provider}`);
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Poll failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Full generation flow with polling.
 * Returns the GLB URL when complete.
 */
export async function generateAndPoll(
  imageFile: File,
  onProgress?: (state: Gen3DState) => void
): Promise<string> {
  const report = (partial: Partial<Gen3DState>) => {
    if (onProgress) {
      onProgress({
        status: 'idle',
        progress: 0,
        glbUrl: null,
        taskId: null,
        provider: null,
        error: null,
        ...partial,
      });
    }
  };

  // Upload
  report({ status: 'uploading', progress: 0 });
  
  const { taskId, provider, glbUrl } = await startGeneration(imageFile);
  
  // HF returns immediately with glbUrl
  if (glbUrl) {
    report({ status: 'completed', progress: 100, glbUrl, taskId, provider });
    return glbUrl;
  }

  // Meshy: poll until done
  report({ status: 'pending', progress: 0, taskId, provider });

  const MAX_POLLS = 120; // 10 min max (5s intervals)
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, 5000));
    
    const result = await pollGeneration(taskId, provider);
    
    report({
      status: result.status as Gen3DStatus,
      progress: result.progress || 0,
      glbUrl: result.glbUrl || null,
      taskId,
      provider,
      error: result.error || null,
    });

    if (result.status === 'completed' && result.glbUrl) {
      return result.glbUrl;
    }
    if (result.status === 'failed') {
      throw new Error(result.error || 'Generation failed');
    }
  }

  throw new Error('Generation timed out after 10 minutes');
}
