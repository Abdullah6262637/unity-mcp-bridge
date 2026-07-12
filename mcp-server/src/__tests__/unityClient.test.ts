import test from 'node:test';
import assert from 'node:assert';
import { UnityClient } from '../unityClient.js';

test('UnityClient.post calls fetch with correct URL, method, headers and body', async () => {
  const originalFetch = globalThis.fetch;

  let calledUrl = '';
  let calledOptions: any = null;

  // Mock global fetch
  globalThis.fetch = (async (url: string, options: any) => {
    calledUrl = url;
    calledOptions = options;
    return {
      ok: true,
      json: async () => ({ success: true, instanceId: 12345 }),
    } as Response;
  }) as any;

  try {
    const payload = { name: 'MockCube', position: [0, 1, 0] };
    const response = await UnityClient.post('/tools/create_gameobject', payload);

    assert.strictEqual(calledUrl, 'http://127.0.0.1:8090/tools/create_gameobject');
    assert.strictEqual(calledOptions.method, 'POST');
    assert.strictEqual(calledOptions.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(calledOptions.body), payload);
    assert.deepStrictEqual(response, { success: true, instanceId: 12345 });
  } finally {
    // Restore fetch
    globalThis.fetch = originalFetch;
  }
});

test('UnityClient.checkHealth returns true when Unity responds with ok status', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return {
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response;
  }) as any;

  try {
    const health = await UnityClient.checkHealth();
    assert.strictEqual(health, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
