
const CACHE_NAME = 'ble-app-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './service-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ---------- Install ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('🛑 SW install failed:', err);                                     */
      })
  );
});

/* ---------- Activate ---------- */
self.addEventListener('activate', event =>
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
);

/* ---------- Fetch ---------- */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' ||
      !(event.request.url.startsWith('http://') || event.request.url.startsWith('https://'))) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => {
      if (hit) return hit;

      return fetch(event.request)
        .then(resp => {
          if (resp && resp.ok && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => {
          if (event.request.destination === 'document')
            return caches.match('./index.html');
        });
    })
  );
});
