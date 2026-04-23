/**
 * Lightweight dev API server for 3D generation.
 * Run alongside `next dev` for local development.
 *
 * Usage: node --import tsx api-server.ts
 * Or:    npx tsx api-server.ts
 *
 * Env: HF_TOKEN (optional), PORT (default 3001)
 *
 * Phase 7.10: Meshy (paid API) removed. HF Inference TripoSR is the only
 * supported backend in this dev server now. For TRELLIS-grade quality, point
 * the client at a self-hosted HF Space via NEXT_PUBLIC_TRIPOSR_URL instead.
 */

import http from 'node:http';
import { hfGenerate3D } from './app/lib/generate-3d.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

function cors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseMultipart(req: http.IncomingMessage): Promise<{ imageBuffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';

      // Simple multipart boundary extraction
      const boundaryMatch = ct.match(/boundary=(.+)/);
      if (!boundaryMatch) {
        reject(new Error('No multipart boundary'));
        return;
      }
      const boundary = boundaryMatch[1];
      const parts = body.toString('binary').split(`--${boundary}`);

      for (const part of parts) {
        if (part.includes('name="image"')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const fileData = part.slice(headerEnd + 4).replace(/\r\n$/, '');
          const imageBuffer = Buffer.from(fileData, 'binary');

          const ctMatch = part.match(/Content-Type:\s*(\S+)/i);
          resolve({
            imageBuffer,
            contentType: ctMatch?.[1] || 'image/png'
          });
          return;
        }
      }
      reject(new Error('No image field in multipart'));
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Note: localhost in this URL is OK — server-side only (request parsing).
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // POST /api/generate-3d — HF TripoSR (synchronous, returns GLB data URI)
    if (req.method === 'POST' && url.pathname === '/api/generate-3d') {
      const { imageBuffer, contentType } = await parseMultipart(req);
      const base64 = imageBuffer.toString('base64');
      const dataUri = `data:${contentType};base64,${base64}`;

      const result = await hfGenerate3D(dataUri);
      json(res, 200, {
        taskId: result.taskId,
        provider: 'huggingface',
        glbUrl: result.glbUrl,
      });
      return;
    }

    // GET /api/generate-3d/status — HF completes synchronously, no polling.
    if (req.method === 'GET' && url.pathname === '/api/generate-3d/status') {
      json(res, 400, {
        error: 'HF TripoSR completes synchronously \u2014 no polling endpoint.',
      });
      return;
    }

    // Health
    if (url.pathname === '/health') {
      json(res, 200, { ok: true, hf: !!process.env.HF_TOKEN });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('API error:', e);
    json(res, 500, { error: (e as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`3D Generation API running on http://localhost:${PORT}`);
  console.log(`  HF:    ${process.env.HF_TOKEN ? '\u2705 configured' : '\u26a0\ufe0f  no token (free tier, rate-limited)'}`);
});
