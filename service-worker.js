const CACHE_NAME = 'ble-app-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e =>
  e.respondWith(
    caches.match(e.request)
      .then(r => r || fetch(e.request).then(resp => {
        caches.open(CACHE_NAME).then(c => c.put(e.request, resp.clone()));
        return resp;
      }))
      .catch(() => {
        if (e.request.destination === 'document')
          return caches.match('./index.html');
      })
  )
);
