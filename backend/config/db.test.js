const test = require('node:test');
const assert = require('node:assert/strict');
const { connectDB, isFallbackMode } = require('./db');

test('connectDB falls back quickly when MongoDB is unavailable', async () => {
  const startedAt = Date.now();
  const result = await connectDB('mongodb://127.0.0.1:1/library-management-system');
  const elapsed = Date.now() - startedAt;

  assert.equal(result.connected, false);
  assert.equal(result.fallbackMode, true);
  assert.equal(isFallbackMode(), true);
  assert.ok(elapsed < 8000, `Expected fast fallback, but took ${elapsed}ms`);
});
