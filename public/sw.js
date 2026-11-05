/**
 * @file sw.js
 * @description Service worker: offline app shell + background reminders.
 *
 * CACHING
 *   - Install precaches EVERY built file (HTML, hashed JS/CSS, icons). The list and
 *     the cache version are written in at build time by the `typoHunterPrecache`
 *     plugin in vite.config.ts, so the app works offline right after the first visit
 *     and each deploy gets a fresh cache (old bundles are deleted on activate).
 *   - Page navigations: network first (so new deploys show immediately), falling back
 *     to the cached app shell when offline.
 *   - Hashed assets (/assets/*): cache first (their names change when content changes).
 *   - Google Fonts: cached at runtime in a separate long-lived cache.
 *
 * REMINDERS
 *   Periodic Background Sync (Chromium, installed app only) wakes this worker a few
 *   times a day. It reads settings and the last-capture time that the app mirrors into
 *   IndexedDB (`typo-hunter-db` → `meta`) and shows at most one inactivity nudge per
 *   ~20 hours and one daily prompt per day.
 */

const CACHE_VERSION = 'dev'; /*__BUILD_VERSION__*/
const CACHE_NAME = `typo-hunter-${CACHE_VERSION}`;
const FONT_CACHE = 'typo-hunter-fonts-v1';

const PRECACHE_ASSETS = [/*__PRECACHE_START__*/ '/', '/index.html', '/manifest.json' /*__PRECACHE_END__*/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FONT_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response && response.ok) {
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cached = (await cache.match('/index.html', MATCH_OPTIONS)) || (await cache.match('/', MATCH_OPTIONS));
    return cached || Response.error();
  }
}

// Match by URL and ignore `Vary`: precached entries were fetched without an Origin
// header, while module scripts are requested in CORS mode with one, and servers often
// send `Vary: Origin` on static assets.
const MATCH_OPTIONS = { ignoreVary: true, ignoreSearch: false };

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request.url, MATCH_OPTIONS);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Opaque (cross-origin, no-cors) font responses have status 0 but are still usable.
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url, MATCH_OPTIONS);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }
  // Leave every other third-party request alone.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

// ---------------------------------------------------------------------------
// Background reminders (Periodic Background Sync)
// ---------------------------------------------------------------------------

function openAppDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('typo-hunter-db');
    // Never create or upgrade the app's database from the worker.
    req.onupgradeneeded = () => req.transaction.abort();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function metaGet(db, key) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction('meta', 'readonly').objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function metaSet(db, key, value) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function checkReminders() {
  let db;
  try {
    db = await openAppDb();
  } catch {
    return;
  }
  if (!db.objectStoreNames.contains('meta')) return;

  const settings = await metaGet(db, 'notificationSettings');
  const messages = await metaGet(db, 'reminderMessages');
  if (!settings || !settings.enabled || !messages) return;

  const now = Date.now();
  const options = (tag) => ({
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    silent: settings.soundVibration === false,
    data: { url: '/' },
  });

  if (settings.inactivityReminder) {
    const lastCapture = Number(await metaGet(db, 'lastCaptureAt')) || 0;
    const lastNudge = Number(await metaGet(db, 'lastNudgeAt')) || 0;
    const hours = lastCapture ? (now - lastCapture) / 3600000 : 0;
    const threshold = Number(settings.inactivityHoursThreshold) || 24;
    if (lastCapture && hours >= threshold && now - lastNudge > 20 * 3600000) {
      const msg = hours >= 72 ? messages.inactivity.h72 : hours >= 48 ? messages.inactivity.h48 : messages.inactivity.h24;
      try {
        await self.registration.showNotification(msg.title, { body: msg.body, ...options('inactivity-nudge') });
        await metaSet(db, 'lastNudgeAt', now);
      } catch {
        // permission revoked
      }
    }
  }

  if (settings.dailySafariTime && settings.dailySafariTime !== 'off') {
    const hour = parseInt(String(settings.dailySafariTime).slice(0, 2), 10);
    const today = new Date(now).toDateString();
    const lastDaily = await metaGet(db, 'lastDailyDate');
    if (new Date(now).getHours() >= hour && lastDaily !== today) {
      try {
        await self.registration.showNotification(messages.daily.title, { body: messages.daily.body, ...options('daily-hunt') });
        await metaSet(db, 'lastDailyDate', today);
      } catch {
        // permission revoked
      }
    }
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'typo-hunter-reminders') {
    event.waitUntil(checkReminders());
  }
});

// Lets the app (or tests) trigger the same check on demand.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    event.waitUntil(checkReminders());
  }
});
