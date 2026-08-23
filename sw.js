/* Assay service worker
   - App shell is precached so it opens instantly and works with no signal.
   - Fonts are cached at runtime so the type survives offline.
   - Balance and price APIs are NEVER cached: a stale balance is a lie.
     When they fail, the app falls back to the figures it saved on device.
   Bump SHELL_VERSION whenever index.html changes to push the update out. */

const SHELL_VERSION = 'assay-shell-v25';
const FONT_CACHE    = 'assay-fonts-v1';

/* CORE must cache for offline to work at all. EXTRA is best-effort:
   one missing icon must not stop the worker installing, which would cost
   offline support and the install prompt entirely. */
const CORE = [
  './',
  './index.html'
];
const EXTRA = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_VERSION);
    try{
      await cache.addAll(CORE);
    }catch(e){
      /* even this failing shouldn't leave a half-registered worker */
      console.error('[assay] core precache failed', e);
    }
    await Promise.all(EXTRA.map(u => cache.add(u).catch(err => {
      console.warn('[assay] could not cache', u, err);
    })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL_VERSION, FONT_CACHE];
    for(const key of await caches.keys()){
      if(!keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

const isFont = url =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache first, fill in the background.
  if(isFont(url)){
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if(hit) return hit;
      try{
        const res = await fetch(req);
        if(res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }catch(e){ return new Response('', {status:504}); }
    })());
    return;
  }

  // Live data (mempool.space, CoinGecko): straight to the network, never cached.
  if(url.origin !== self.location.origin) return;

  // Navigations: try network so updates land, fall back to the cached shell.
  if(req.mode === 'navigate'){
    event.respondWith((async () => {
      try{
        const res = await fetch(req);
        const cache = await caches.open(SHELL_VERSION);
        cache.put('./index.html', res.clone());
        return res;
      }catch(e){
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Everything else same-origin: cache first, revalidate quietly.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_VERSION);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if(res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  })());
});
