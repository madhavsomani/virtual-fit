const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Multi-provider 3D mesh generation API.
 * 
 * POST /api/generate-3d  { imageUrl: string } or multipart with 'image' field
 * GET  /api/generate-3d?taskId=xxx&provider=meshy  (poll Meshy task status)
 * 
 * Provider chain: Meshy → HuggingFace → Replicate → Mock (billboard)
 */

const MESHY_BASE = 'https://api.meshy.ai/openapi/v2';
const HF_TRIPOSR = 'https://api-inference.huggingface.co/models/stabilityai/TripoSR';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors };
    return;
  }

  // GET = poll task status
  if (req.method === 'GET') {
    return await handlePoll(context, req);
  }

  // POST = start generation
  return await handleGenerate(context, req);
};

// --- Poll existing task ---
async function handlePoll(context, req) {
  const taskId = req.query.taskId;
  const provider = req.query.provider;

  if (!taskId || !provider) {
    context.res = { status: 400, headers: cors, body: { error: 'taskId and provider required' } };
    return;
  }

  if (provider === 'meshy') {
    try {
      const apiKey = process.env.MESHY_API_KEY;
      if (!apiKey) throw new Error('MESHY_API_KEY not set');

      const res = await fetch(`${MESHY_BASE}/image-to-3d/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json();

      context.res = {
        status: 200,
        headers: cors,
        body: {
          taskId,
          provider: 'meshy',
          status: data.status === 'SUCCEEDED' ? 'completed'
                : data.status === 'FAILED' ? 'failed'
                : data.status === 'PROCESSING' ? 'processing'
                : 'pending',
          glbUrl: data.model_urls?.glb || null,
          progress: data.progress || 0,
          error: data.status === 'FAILED' ? (data.message || 'Generation failed') : null,
        },
      };
    } catch (err) {
      context.res = { status: 500, headers: cors, body: { error: err.message } };
    }
    return;
  }

  // HF and Replicate return immediately — no polling needed
  context.res = { status: 400, headers: cors, body: { error: `Provider ${provider} does not support polling` } };
}

// --- Start generation ---
async function handleGenerate(context, req) {
  let imageUrl = null;
  let imageBase64 = null;

  // Parse body — accept JSON { imageUrl } or { imageBase64 }
  if (req.body) {
    imageUrl = req.body.imageUrl;
    imageBase64 = req.body.imageBase64;
  }

  if (!imageUrl && !imageBase64) {
    context.res = {
      status: 400,
      headers: cors,
      body: { error: 'Provide imageUrl or imageBase64' },
    };
    return;
  }

  // If base64, create a data URI
  if (imageBase64 && !imageUrl) {
    imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
  }

  const providers = [];
  if (process.env.MESHY_API_KEY) providers.push('meshy');
  if (process.env.HF_TOKEN) providers.push('huggingface');
  if (process.env.REPLICATE_API_TOKEN) providers.push('replicate');
  providers.push('mock'); // Always available as last resort

  context.log.info(`3D generation: ${providers.length} providers available: ${providers.join(', ')}`);

  let lastError = null;

  for (const provider of providers) {
    try {
      const result = await tryProvider(provider, imageUrl, context);
      context.res = { status: 200, headers: cors, body: result };
      return;
    } catch (err) {
      context.log.warn(`Provider ${provider} failed: ${err.message}`);
      lastError = err;
    }
  }

  context.res = {
    status: 500,
    headers: cors,
    body: {
      error: `All providers failed. Last error: ${lastError?.message}`,
      providers: providers,
      isMock: false,
    },
  };
}

async function tryProvider(provider, imageUrl, context) {
  switch (provider) {
    case 'meshy':
      return await meshyGenerate(imageUrl, context);
    case 'huggingface':
      return await hfGenerate(imageUrl, context);
    case 'replicate':
      return await replicateGenerate(imageUrl, context);
    case 'mock':
      return mockGenerate(imageUrl);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// --- Meshy API ---
async function meshyGenerate(imageUrl, context) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) throw new Error('MESHY_API_KEY not set');

  context.log.info('Trying Meshy API...');
  const res = await fetch(`${MESHY_BASE}/image-to-3d`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      enable_pbr: true,
      topology: 'quad',
      target_polycount: 30000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meshy ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    taskId: data.result,
    provider: 'meshy',
    status: 'pending',
    glbUrl: null,
    progress: 0,
    isMock: false,
    pollUrl: `/api/generate-3d?taskId=${data.result}&provider=meshy`,
  };
}

// --- HuggingFace Inference ---
async function hfGenerate(imageUrl, context) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN not set');

  context.log.info('Trying HuggingFace TripoSR...');

  // Download image if it's a URL (not data URI)
  let imageBlob;
  if (imageUrl.startsWith('data:')) {
    const base64 = imageUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    imageBlob = new Blob([buffer]);
  } else {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    imageBlob = await imgRes.blob();
  }

  const res = await fetch(HF_TRIPOSR, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: imageBlob,
  });

  if (res.status === 503) {
    throw new Error('HF model loading — retry in 30s');
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF ${res.status}: ${err}`);
  }

  // HF returns GLB bytes directly
  const meshBytes = await res.arrayBuffer();
  const base64Glb = Buffer.from(meshBytes).toString('base64');

  return {
    taskId: `hf-${Date.now()}`,
    provider: 'huggingface',
    status: 'completed',
    glbUrl: `data:model/gltf-binary;base64,${base64Glb}`,
    progress: 100,
    isMock: false,
  };
}

// --- Replicate ---
async function replicateGenerate(imageUrl, context) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not set');

  context.log.info('Trying Replicate TripoSR...');

  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'fad1b604a59d1aeab0b58e7e1c6f5e46a5481e22a84bde5d3e7f34a57b53152e',
      input: { image: imageUrl },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate ${res.status}: ${err}`);
  }

  const data = await res.json();

  // Replicate is async — return the prediction ID for polling
  // (For simplicity, we'll poll here with a timeout)
  const predictionId = data.id;
  const maxWait = 120000; // 2 min
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Token ${token}` },
    });
    const pollData = await pollRes.json();

    if (pollData.status === 'succeeded') {
      return {
        taskId: predictionId,
        provider: 'replicate',
        status: 'completed',
        glbUrl: pollData.output,
        progress: 100,
        isMock: false,
      };
    }
    if (pollData.status === 'failed') {
      throw new Error(`Replicate failed: ${pollData.error || 'unknown'}`);
    }
  }
  throw new Error('Replicate timed out after 2 minutes');
}

// --- Mock: billboard with user's image as texture ---
function mockGenerate(imageUrl) {
  // Return a special marker that tells the client to create
  // a textured plane from the original image (NOT a duck)
  return {
    taskId: `mock-${Date.now()}`,
    provider: 'mock',
    status: 'completed',
    glbUrl: null,
    textureUrl: imageUrl, // Client uses this as flat overlay
    progress: 100,
    isMock: true,
    message: 'No 3D API key configured. Showing image as flat overlay. Add MESHY_API_KEY for real 3D meshes.',
  };
}
