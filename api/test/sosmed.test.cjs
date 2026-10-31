const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const sosmed = require('../src/integrations/sosmed');

const sign = (obj, secret) => {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return crypto.createHmac('sha256', secret).update(payload).digest().toString('base64url') + '.' + payload;
};

test('Meta signed_request: valid signature is accepted, tampering and wrong secret are not', () => {
  const ok = sign({ user_id: '123', algorithm: 'HMAC-SHA256' }, 'rahasia');
  assert.equal(sosmed.parseSignedRequest(ok, ['rahasia']).user_id, '123');
  assert.equal(sosmed.parseSignedRequest(ok, [undefined, 'rahasia']).user_id, '123');
  assert.equal(sosmed.parseSignedRequest(ok, ['salah']), null);
  const [sig, payload] = ok.split('.');
  const palsu = Buffer.from(JSON.stringify({ user_id: '999' })).toString('base64url');
  assert.equal(sosmed.parseSignedRequest(sig + '.' + palsu, ['rahasia']), null);
  assert.equal(sosmed.parseSignedRequest('bukan-signed-request', ['rahasia']), null);
  assert.equal(sosmed.parseSignedRequest(undefined, ['rahasia']), null);
  assert.equal(sosmed.parseSignedRequest(ok, []), null);
});

test('platform counts as configured only with both keys', () => {
  const was = { ...process.env };
  delete process.env.TIKTOK_CLIENT_KEY; delete process.env.TIKTOK_CLIENT_SECRET;
  assert.equal(sosmed.configured('tiktok'), false);
  process.env.TIKTOK_CLIENT_KEY = 'k';
  assert.equal(sosmed.configured('tiktok'), false);
  process.env.TIKTOK_CLIENT_SECRET = 's';
  assert.equal(sosmed.configured('tiktok'), true);
  assert.equal(sosmed.configured('myspace'), false);
  Object.assign(process.env, was);
});

test('authorize links carry only read-only scopes and the state', () => {
  process.env.TIKTOK_CLIENT_KEY = 'k'; process.env.INSTAGRAM_APP_ID = 'i'; process.env.FACEBOOK_APP_ID = 'f';
  const uri = 'https://x.test/api/social/callback';
  for (const p of ['tiktok', 'instagram', 'facebook']) {
    const u = new URL(sosmed.authUrl(p, uri, 'STATE'));
    assert.equal(u.searchParams.get('state'), 'STATE');
    assert.equal(u.searchParams.get('redirect_uri'), uri);
    const scope = u.searchParams.get('scope');
    assert.ok(scope.length > 0);
    assert.ok(!/publish|manage_posts|content_publish|pages_manage|messag|comment|upload/i.test(scope.replace('manage_insights', '')), scope);
  }
});

test('post normalisers map the platform fields', () => {
  const t = sosmed.tiktok.post({ id: 7, title: 'Judul #DE', create_time: 1761900000, share_url: 'https://tiktok.com/v/7', view_count: 10, like_count: 2, comment_count: 1, share_count: 3, duration: 30 });
  assert.equal(t.post_id, '7'); assert.equal(t.views, 10); assert.equal(t.shares, 3); assert.equal(t.tanggal.getTime(), 1761900000000);
  const i = sosmed.instagram.post({ id: 'a', caption: 'Baris satu\nbaris dua #DE', permalink: 'https://instagram.com/p/a', timestamp: '2026-10-30T01:00:00+0000', like_count: 5, comments_count: 1 });
  assert.equal(i.judul, 'Baris satu'); assert.equal(i.deskripsi.includes('#DE'), true); assert.equal(i.views, null);
  const f = sosmed.facebook.post({ id: '9', description: 'Halo', created_time: '2026-10-30T01:00:00+0000', permalink_url: '/page/videos/9', views: 4, likes: { summary: { total_count: 2 } }, comments: { summary: { total_count: 1 } } });
  assert.equal(f.url, 'https://www.facebook.com/page/videos/9'); assert.equal(f.likes, 2); assert.equal(f.comments, 1); assert.equal(f.views, 4);
});
