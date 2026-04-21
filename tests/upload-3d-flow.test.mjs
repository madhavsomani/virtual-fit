/**
 * Unit tests for handleUpload3D flow
 * Tests the logic branches documented in 3d-flow-trace.md
 */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock globals needed for the upload flow
const mockFetch = mock.fn();
const mockURL = {
  createObjectURL: mock.fn(() => 'blob:mock-url'),
  revokeObjectURL: mock.fn(),
};

// Simulated handleUpload3D logic extracted for unit testing
// (The actual function is in page.tsx and tightly coupled to React state)

/**
 * Pure function version of 3D upload flow for testing
 */
async function processUpload3D(file, options) {
  const {
    TRIPOSR_URL,
    savedGarmentsCount,
    fetchFn,
    createObjectURL,
  } = options;

  // Branch: ENV_MISSING
  if (!TRIPOSR_URL) {
    return { status: 'fallback-2d', reason: 'env-missing', message: '3D service not configured' };
  }

  // Branch: LIMIT_REACHED
  if (savedGarmentsCount >= 10) {
    return { status: 'error', reason: 'limit-reached', message: 'Upload limit reached' };
  }

  try {
    const fd = new FormData();
    fd.append('image', file);

    const resp = await fetchFn(TRIPOSR_URL, { method: 'POST', body: fd });

    // Branch: NON_OK_RESPONSE
    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      return {
        status: 'fallback-2d',
        reason: 'service-error',
        message: `3D service error ${resp.status}: ${errText.slice(0, 200)}`,
      };
    }

    const glbBlob = await resp.blob();
    const glbUrl = createObjectURL(glbBlob);
    const provider = resp.headers.get('X-Provider') || 'hunyuan3d-2';

    return {
      status: 'success',
      glbUrl,
      provider,
      blob: glbBlob,
    };
  } catch (err) {
    // Branch: FETCH_ERROR
    return {
      status: 'fallback-2d',
      reason: 'fetch-error',
      message: err.message || 'Unknown error',
    };
  }
}

describe('processUpload3D', () => {
  const mockFile = { name: 'shirt.png', type: 'image/png' };

  beforeEach(() => {
    mockFetch.mock.resetCalls();
    mockURL.createObjectURL.mock.resetCalls();
  });

  it('returns fallback-2d when TRIPOSR_URL is missing', async () => {
    const result = await processUpload3D(mockFile, {
      TRIPOSR_URL: undefined,
      savedGarmentsCount: 0,
      fetchFn: mockFetch,
      createObjectURL: mockURL.createObjectURL,
    });

    assert.strictEqual(result.status, 'fallback-2d');
    assert.strictEqual(result.reason, 'env-missing');
    assert.ok(result.message.includes('not configured'));
  });

  it('returns error when upload limit reached', async () => {
    const result = await processUpload3D(mockFile, {
      TRIPOSR_URL: 'https://triposr.example.com',
      savedGarmentsCount: 10,
      fetchFn: mockFetch,
      createObjectURL: mockURL.createObjectURL,
    });

    assert.strictEqual(result.status, 'error');
    assert.strictEqual(result.reason, 'limit-reached');
  });

  it('returns fallback-2d on fetch error', async () => {
    mockFetch.mock.mockImplementation(() => {
      throw new Error('Network failed');
    });

    const result = await processUpload3D(mockFile, {
      TRIPOSR_URL: 'https://triposr.example.com',
      savedGarmentsCount: 0,
      fetchFn: mockFetch,
      createObjectURL: mockURL.createObjectURL,
    });

    assert.strictEqual(result.status, 'fallback-2d');
    assert.strictEqual(result.reason, 'fetch-error');
    assert.ok(result.message.includes('Network failed'));
  });

  it('returns fallback-2d on non-OK response (502)', async () => {
    mockFetch.mock.mockImplementation(async () => ({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'Service unavailable',
      headers: new Map(),
    }));

    const result = await processUpload3D(mockFile, {
      TRIPOSR_URL: 'https://triposr.example.com',
      savedGarmentsCount: 0,
      fetchFn: mockFetch,
      createObjectURL: mockURL.createObjectURL,
    });

    assert.strictEqual(result.status, 'fallback-2d');
    assert.strictEqual(result.reason, 'service-error');
    assert.ok(result.message.includes('502'));
  });

  it('returns success with GLB url on valid response', async () => {
    const mockBlob = new Blob(['mock glb data'], { type: 'model/gltf-binary' });
    const mockHeaders = new Map([['X-Provider', 'test-provider']]);
    
    mockFetch.mock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      blob: async () => mockBlob,
      headers: { get: (key) => mockHeaders.get(key) },
    }));

    const result = await processUpload3D(mockFile, {
      TRIPOSR_URL: 'https://triposr.example.com',
      savedGarmentsCount: 5,
      fetchFn: mockFetch,
      createObjectURL: mockURL.createObjectURL,
    });

    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.glbUrl, 'blob:mock-url');
    assert.strictEqual(result.provider, 'test-provider');
    assert.strictEqual(mockFetch.mock.callCount(), 1);
    assert.strictEqual(mockURL.createObjectURL.mock.callCount(), 1);
  });

  it('uses default provider when X-Provider header missing', async () => {
    const mockBlob = new Blob(['mock glb data'], { type: 'model/gltf-binary' });
    
    mockFetch.mock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      blob: async () => mockBlob,
      headers: { get: () => null },
    }));

    const result = await processUpload3D(mockFile, {
      TRIPOSR_URL: 'https://triposr.example.com',
      savedGarmentsCount: 0,
      fetchFn: mockFetch,
      createObjectURL: mockURL.createObjectURL,
    });

    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.provider, 'hunyuan3d-2');
  });
});
