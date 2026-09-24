/**
 * MicroConvert - Offline Service Worker
 * Caches CDN libraries and app assets for offline conversion capability
 */

const CACHE_NAME = 'microconvert-v1';

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.7/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache CDN assets on install
      return cache.addAll(CDN_ASSETS).catch((err) => {
        console.debug('[MicroConvert SW] Non-blocking cache error during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        // Cache external CDN resources or static assets
        if (response && response.status === 200) {
          const isCdn = CDN_ASSETS.some((url) => event.request.url.startsWith(url));
          if (isCdn) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        }
        return response;
      }).catch(() => {
        // Return cached version if available, otherwise return a basic offline response
        if (cached) return cached;
        return new Response('Offline - resource unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
