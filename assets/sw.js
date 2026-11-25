// Service worker: shows push notifications, opens the right page when one is tapped, and keeps
// a copy of the app itself so it still opens on a weak or missing signal.
// Pages are fetched from the network first (so a new version shows at once) and the saved copy
// is used only when the network fails. Data (/api) is never cached here.
const CACHE = 'pt-app-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// Keeps only the build files the newest page uses, so old versions do not pile up.
async function simpanHalaman(res) {
  const c = await caches.open(CACHE);
  const html = await res.clone().text();
  await c.put('/', res);
  const dipakai = new Set([...html.matchAll(/\/assets\/[^"' )]+/g)].map((m) => m[0]));
  for (const req of await c.keys()) {
    const p = new URL(req.url).pathname;
    if (p.startsWith('/assets/') && !dipakai.has(p)) await c.delete(req);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !/\.(html|txt)$/.test(url.pathname)) e.waitUntil(simpanHalaman(res.clone()));
        return res;
      } catch (err) {
        return (/\.(html|txt)$/.test(url.pathname) ? null : await caches.match('/')) || Response.error();
      }
    })());
    return;
  }
  // Build files have the content hash in their name, so a saved copy is always right.
  if (url.pathname.startsWith('/assets/') || /^\/((icon-[a-z0-9-]+|apple-touch-icon)\.png|logo\.svg)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); e.waitUntil(c.put(req, res.clone())); }
      return res;
    })());
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Tokder', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tokder', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag, data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = list.find((c) => new URL(c.url).origin === self.location.origin);
    if (open) { await open.focus(); return open.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
