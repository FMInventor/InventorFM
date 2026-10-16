// Service worker di Smart Pantry Pro
// - Funzionamento offline: tiene in memoria le pagine e le librerie del sito
// - Notifiche push delle scadenze (inviate dal server anche a sito chiuso)
const CACHE = 'sp-v6';
const CORE = ['./', './index.html', './style.css?v=6', './app.js?v=6', './manifest.json', './icon-192.png', './icon-512.png'];
const CDN = /^(https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com))\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Rete prima (così il sito è sempre aggiornato), copia salvata se offline
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) || await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
    throw err;
  }
}
// Librerie con versione fissa: copia salvata prima
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) return e.respondWith(networkFirst(req));
  if (CDN.test(req.url)) return e.respondWith(cacheFirst(req));
  // Tutto il resto (es. Supabase) va sempre in rete
});

// Notifica push dal server
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Smart Pantry', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Smart Pantry', {
    body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) if ('focus' in w) return w.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  })());
});
