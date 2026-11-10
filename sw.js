// Çevrimdışı çalışma: önce önbellekten aç, arkada güncelle.
// Siteyi güncelleyince CACHE adını değiştir ki eski dosyalar temizlensin.
const CACHE = 'zincir-v9';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/style.css?v=9',
  './vendor/chart.umd.min.js',
  './js/data.js?v=9', './js/chain.js?v=9', './js/log.js?v=9', './js/stats.js?v=9',
  './js/gamify.js?v=9', './js/backup.js?v=9', './js/app.js?v=9',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const fonts = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, {ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html')});
    const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
