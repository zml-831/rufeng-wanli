/* 儒风万里 · Service Worker
 * 目标：首屏与同屏/人机模式可离线；在线接口永不缓存。
 * 策略：导航与脚本网络优先（保证更新），字体/图片缓存优先，接口直连网络。
 */

const VERSION = 'rufeng-v1.0.0';
const CORE_CACHE = `${VERSION}-core`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const CORE = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/home.css',
  '/css/board.css',
  '/css/game.css',
  '/js/client/main.js',
  '/js/client/app.js',
  '/js/client/api.js',
  '/js/client/audio.js',
  '/js/client/board.js',
  '/js/client/game-view.js',
  '/js/client/icons.js',
  '/js/client/art.js',
  '/js/client/storage.js',
  '/js/client/ui.js',
  '/js/shared/constants.js',
  '/js/shared/game.js',
  '/js/shared/ai.js',
  '/js/shared/quotes.js',
  '/assets/fonts/lxgw-wenkai.css',
  '/assets/fonts/ma-shan-zheng.woff2',
  '/assets/icons/favicon.svg',
  '/favicon.ico',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);
      await Promise.allSettled(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }

  if (url.pathname.startsWith('/assets/fonts/') || url.pathname.startsWith('/assets/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
