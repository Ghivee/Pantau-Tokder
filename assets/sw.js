// Service worker: shows push notifications and opens the right page when one is tapped.
// It does not cache pages, so the app is always the latest version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Pantau Tokder', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Pantau Tokder', {
    body: d.body || '', icon: '/tokderlogo.png', badge: '/tokderlogo.png', tag: d.tag, data: { url: d.url || '/' },
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
