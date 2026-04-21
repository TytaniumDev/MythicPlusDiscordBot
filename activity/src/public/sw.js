// Service worker that caches Blizzard character renders for 24h.
//
// Two URL shapes are cached:
//   - Inside Discord: /blizzard-renders/... (routed by patchUrlMappings to
//     render.worldofwarcraft.com through Discord's activity proxy)
//   - Outside Discord (dev, preview, GitHub Pages): render.worldofwarcraft.com
//     directly
//
// Freshness is determined by the response's `Date` header, which both
// Blizzard and the Discord proxy regenerate on every hop.

const CACHE_NAME = 'bnet-renders-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isRenderRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.hostname === 'render.worldofwarcraft.com') return true;
  if (url.pathname.startsWith('/blizzard-renders/')) return true;
  return false;
}

function cachedAtMs(response) {
  const header = response.headers.get('date');
  if (!header) return NaN;
  const parsed = Date.parse(header);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function isFresh(response) {
  const at = cachedAtMs(response);
  return Number.isFinite(at) && Date.now() - at < MAX_AGE_MS;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('bnet-renders-') && n !== CACHE_NAME)
          .map((n) => caches.delete(n)),
      );

      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      await Promise.all(
        keys.map(async (req) => {
          const res = await cache.match(req);
          if (!res || !isFresh(res)) await cache.delete(req);
        }),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (!isRenderRequest(event.request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached && isFresh(cached)) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok) {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
