const CACHE_NAME = 'ble-app-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
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
        console.error('🛑 SW install failed:', err);
        /* Si falló por un solo asset, aún así instala:
           self.skipWaiting();                                          */
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
  // solo intercepta peticiones GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(hit => {
      if (hit) return hit;                          // 1) Cache hit

      return fetch(event.request)
        .then(resp => {
          // 2) Solo cachea respuestas OK y tipo básico (mismo origen)
          if (resp && resp.ok && resp.type === 'basic') {
            const clone = resp.clone();             // stream sin consumir
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => {
          // 3) Sin red y sin cache: devuelve página offline si era HTML
          if (event.request.destination === 'document')
            return caches.match('./index.html');
        });
    })
  );
});
