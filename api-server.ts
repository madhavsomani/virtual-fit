/**
 * Lightweight dev API server for 3D generation.
 * Run alongside `next dev` for local development.
 * 
 * Usage: node --import tsx api-server.ts
 * Or:    npx tsx api-server.ts
 * 
 * Env: MESHY_API_KEY, HF_TOKEN (optional), PORT (default 3001)
 */

import http from 'node:http';
import { meshyCreateTask, meshyPollTask, hfGenerate3D } from './app/lib/generate-3d.js';

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
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // POST /api/generate-3d — start generation
    if (req.method === 'POST' && url.pathname === '/api/generate-3d') {
      const { imageBuffer, contentType } = await parseMultipart(req);
      
      // Convert to data URI for APIs that need a URL
      // For Meshy, we'd need to host it temporarily — for now use base64
      const base64 = imageBuffer.toString('base64');
      const dataUri = `data:${contentType};base64,${base64}`;
      
      const provider = process.env.MESHY_API_KEY ? 'meshy' : 'huggingface';
      
      if (provider === 'meshy') {
        // Meshy needs a real URL — for dev, use the data URI (Meshy supports it)
        const { taskId } = await meshyCreateTask(dataUri);
        json(res, 200, { taskId, provider: 'meshy' });
      } else {
        const result = await hfGenerate3D(dataUri);
        json(res, 200, { 
          taskId: result.taskId, 
          provider: 'huggingface',
          glbUrl: result.glbUrl 
        });
      }
      return;
    }

    // GET /api/generate-3d/status?taskId=...&provider=...
    if (req.method === 'GET' && url.pathname === '/api/generate-3d/status') {
      const taskId = url.searchParams.get('taskId');
      const provider = url.searchParams.get('provider');
      
      if (!taskId || !provider) {
        json(res, 400, { error: 'taskId and provider required' });
        return;
      }

      if (provider === 'meshy') {
        const result = await meshyPollTask(taskId);
        json(res, 200, result);
      } else {
        json(res, 400, { error: 'HF tasks complete immediately, no polling needed' });
      }
      return;
    }

    // Health
    if (url.pathname === '/health') {
      json(res, 200, { ok: true, meshy: !!process.env.MESHY_API_KEY, hf: !!process.env.HF_TOKEN });
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
  console.log(`  Meshy: ${process.env.MESHY_API_KEY ? '✅ configured' : '❌ not set (set MESHY_API_KEY)'}`);
  console.log(`  HF:    ${process.env.HF_TOKEN ? '✅ configured' : '⚠️  no token (free tier, rate-limited)'}`);
});
