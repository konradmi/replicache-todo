const CACHE_NAME = 'static-assets-v1';
const STATIC_ASSET_EXTENSIONS = [
  '.js', '.css', '.woff2', '.woff', '.ttf', '.eot', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.mp4', '.webm', '.json', '.txt', '.map'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Do not cache Replicache or auth API requests
  if (
    url.pathname.startsWith('/api/replicache/pull') ||
    url.pathname.startsWith('/api/replicache/push') ||
    url.pathname.startsWith('/api/auth/')
  ) {
    return;
  }

  // Only cache static assets
  if (STATIC_ASSET_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
  // For all other requests, just fetch from network
}); 
