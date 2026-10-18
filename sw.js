// Service worker: imagenes, iconos y fuentes en cache (cache-first); codigo y datos red-primero con respaldo offline.
// Sube ASSET_VERSION al regenerar imagenes o fuentes (tools/optimize_images.py) para invalidar la cache.
const ASSET_VERSION = 1;
const ASSETS = `r6sim-assets-v${ASSET_VERSION}`;
const CODE = `r6sim-code-v${ASSET_VERSION}`;
const STATIC_ASSET = /\/assets\/.+\.(webp|svg|woff2|png|jpe?g)$/i;

// Aplicacion completa para jugar sin conexion (vs CPU). Si anades o renombras ficheros, actualiza esta lista.
const APP_SHELL = [
  './', 'index.html',
  'css/style.css', 'css/fx.css', 'css/game.css', 'css/mobile.css',
  'js/engine.js', 'js/ai.js', 'js/match.js', 'js/controllers.js', 'js/i18n.js', 'js/net.js',
  'js/ui/core.js', 'js/ui/components.js', 'js/ui/screens.js', 'js/ui/controller.js', 'js/app.js',
  'config/rules.json', 'config/balance.json', 'config/decisions.json', 'config/ai.json', 'config/ui.json', 'config/i18n.json', 'config/gadgets.json', 'config/actions.json',
  'data/operators.json', 'data/maps.json', 'locales/es.json', 'locales/en.json',
  'assets/fonts/barlow-semicondensed-500.woff2', 'assets/fonts/barlow-semicondensed-700.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CODE);
    // allSettled: un fichero que falle no debe impedir instalar el worker
    await Promise.allSettled(APP_SHELL.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== ASSETS && k !== CODE) await caches.delete(k);
  await self.clients.claim();
})()));

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CODE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const page = (await cache.match('index.html', { ignoreSearch: true })) || (await cache.match('./')); if (page) return page; }
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const { request } = e; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(STATIC_ASSET.test(url.pathname) ? cacheFirst(request) : networkFirst(request));
});
