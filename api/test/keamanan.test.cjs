const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml } = require('../src/utils/html');
const { hashPin, verifyPin } = require('../src/middlewares/sessionAuth');
const { clientIp } = require('../src/utils/clientIp');

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
});

test('PIN hashes verify and reject', () => {
  const h = hashPin('1234');
  assert.equal(verifyPin('1234', h), true);
  assert.equal(verifyPin('1235', h), false);
  assert.equal(verifyPin('1234', 'garbage'), false);
  assert.equal(verifyPin('1234', 'ab:cd'), false);
});

test('client IP headers are trusted only on Vercel', () => {
  const req = { headers: { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }, socket: { remoteAddress: '::ffff:127.0.0.1' } };
  const was = process.env.VERCEL;
  delete process.env.VERCEL;
  assert.equal(clientIp(req), '127.0.0.1');
  process.env.VERCEL = '1';
  assert.equal(clientIp(req), '5.6.7.8');
  if (was === undefined) delete process.env.VERCEL; else process.env.VERCEL = was;
});
