/**
 * @file sw.js
 * @description Progressive Web App (PWA) Service Worker with Stale-While-Revalidate caching.
 *
 * ARCHITECTURAL STRATEGY:
 * To provide a true offline-first museum experience that persists across airplane mode and
 * network interruptions, this service worker coordinates two tiers of caching:
 *   1. Pre-cached Shell: The core HTML entry point and web manifest are cached immediately upon install.
 *   2. Stale-While-Revalidate: All compiled JS/CSS bundles and Google Fonts are dynamically
 *      cached on first request, immediately served from cache on subsequent visits, and revalidated
 *      in the background when network connectivity exists.
 *   3. Navigation Fallback: All single-page application route transitions return the cached
 *      index shell when offline.
 */

const CACHE_NAME = 'typo-hunter-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Pre-cache static shell on installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Purge obsolete cache versions on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept HTTP(S) GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore browser extensions and non-http schemes
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Fetch fresh version from network in parallel (Stale-While-Revalidate)
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and navigating to a page, serve the cached SPA shell
          if (request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
          return null;
        });

      // Serve from cache immediately if present, otherwise await network fetch
      return cachedResponse || fetchPromise;
    })
  );
});

// Handle push & local notification interactions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

