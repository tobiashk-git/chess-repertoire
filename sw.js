/* Service worker: network-first for the app (updates show on reload), falling back to the
   cache offline. The repertoire itself lives in localStorage, not here. */
const CACHE = 'chess-repertoire-v22';
const PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'].flatMap(p => [`./pieces/w${p}.svg`, `./pieces/b${p}.svg`]);
const SHELL = [
  './', './index.html', './styles.css', './app.js', './board.js', './repertoire.js', './pgn.js', './train.js', './games.js', './theory.js', './openings.js', './sync.js', './engine.js', './models.js', './check.js', './data/openings.json',
  './vendor/chess.js', './manifest.webmanifest', './icons/icon-180.png', ...PIECES,
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // `cache: 'no-cache'` revalidates past GitHub Pages' 10-minute HTTP cache so pushes show up.
  e.respondWith(
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
