const test = require('node:test');
const assert = require('node:assert/strict');
const { sign } = require('../src/utils/encryption');
const { mediaUrl } = require('../src/services/postingService');

process.env.ENCRYPTION_KEY = 'a'.repeat(64);

test('media links are signed per posting and differ between postings', () => {
  const a = sign(1), b = sign(2);
  assert.equal(a, sign(1));
  assert.notEqual(a, b);
  assert.match(a, /^[\w-]{32}$/);
  assert.equal(mediaUrl('https://x.test', 7), `https://x.test/api/posting/media/7/${sign(7)}`);
});

test('a media link with a wrong signature or posting id is refused (no database needed)', async () => {
  const dbPath = require.resolve('../src/config/db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async () => ({ rows: [], rowCount: 0 }) } };
  const app = require('../src/app');
  const srv = app.listen(0);
  const u = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.equal((await fetch(`${u}/api/posting/media/7/palsu`)).status, 404);
    assert.equal((await fetch(`${u}/api/posting/media/7/${sign(8)}`)).status, 404);
    assert.equal((await fetch(`${u}/api/posting/media/7/${sign(7)}`)).status, 404); // signed but no such posting
    assert.equal((await fetch(`${u}/api/posting`)).status, 401);
    assert.equal((await fetch(`${u}/api/posting/yt/antrean`)).status, 401);
    assert.equal((await fetch(`${u}/api/posting/yt/3/hasil`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${u}/api/posting/blob`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status >= 400, true);
  } finally { srv.close(); }
});
