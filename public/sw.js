/**
 * ============================================================================
 * OFFLINE SERVICE WORKER (`sw.js`)
 * ============================================================================
 * 
 * WHAT IS A SERVICE WORKER?
 * A Service Worker is a special JavaScript script that runs in the background
 * on its own thread, completely separate from the web page's UI thread.
 * It acts like a programmable proxy server sitting between your browser and
 * the internet network.
 * 
 * WHY USE A SERVICE WORKER FOR MICROCONVERT?
 * MicroConvert is designed to be 100% offline-ready!
 * All our heavy dependencies (marked.js, DOMPurify, highlight.js, html2pdf.js)
 * are loaded from Cloudflare CDNs.
 * By caching these exact scripts during first load:
 * 1. The user can open MicroConvert while on an airplane or without WiFi.
 * 2. Conversions work completely offline with zero internet access!
 * 3. Subsequent page loads are near-instantaneous (0ms latency from disk cache).
 * 
 * THE 3 SERVICE WORKER LIFECYCLE EVENTS:
 * 1. `install`: Triggered when the browser registers the SW. We pre-cache CDN assets.
 * 2. `activate`: Cleans up any outdated cache versions from previous deployments.
 * 3. `fetch`: Intercepts every network request made by the page and responds from cache!
 */

// Name of our cache storage bucket. Bump this version string (e.g. v2) to invalidate old caches.
const CACHE_NAME = 'microconvert-v1';

// List of external CDN scripts and styles required for complete offline functionality
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.7/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js'
];

/**
 * ============================================================================
 * 1. INSTALL EVENT
 * ============================================================================
 * Runs once when the browser discovers a new Service Worker file.
 * `event.waitUntil()` tells the browser: "Do not consider installation finished
 * until this Promise resolves."
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-fetch and cache all required CDN assets
      return cache.addAll(CDN_ASSETS).catch((err) => {
        console.debug('[MicroConvert SW] Non-blocking cache error during install:', err);
      });
    }).then(() => {
      // Force this new Service Worker to activate immediately without waiting for open tabs to close
      return self.skipWaiting();
    })
  );
});

/**
 * ============================================================================
 * 2. ACTIVATE EVENT
 * ============================================================================
 * Runs after `install` succeeds and the old worker is retired.
 * Ideal place to purge obsolete caches so user storage isn't cluttered.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // If a cache bucket is not our current CACHE_NAME, delete it!
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Take immediate control of all currently open tabs
      return self.clients.claim();
    })
  );
});

/**
 * ============================================================================
 * 3. FETCH EVENT (CACHE-FIRST WITH NETWORK FALLBACK)
 * ============================================================================
 * Intercepts every HTTP request made by the web application.
 * 
 * STRATEGY:
 * 1. Check if the requested file already exists in `caches`.
 * 2. If FOUND in cache -> Return the cached response immediately (instant load).
 * 3. If NOT in cache -> Fetch from network, clone the response, and store it in cache for future offline visits.
 * 4. If network fails (OFFLINE) -> Return a friendly offline response.
 */
self.addEventListener('fetch', (event) => {
  // Only intercept HTTP GET requests (ignore POST/PUT/etc.)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Hit: Return from cache immediately
      if (cached) {
        return cached;
      }

      // Miss: Fetch from network
      return fetch(event.request).then((response) => {
        // Cache external CDN resources or static assets if response is HTTP 200 OK
        if (response && response.status === 200) {
          const isCdn = CDN_ASSETS.some((url) => event.request.url.startsWith(url));
          if (isCdn) {
            // Responses can only be consumed once! We MUST clone it before putting in cache.
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        }
        return response;
      }).catch(() => {
        // Network error (User is completely offline and resource wasn't pre-cached)
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
