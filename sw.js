/* Service Worker - منصة تعليمية | GitHub Pages friendly (relative paths) */
const VERSION = 'v2';
const SHELL_CACHE = 'shell-' + VERSION;
const RUNTIME_CACHE = 'runtime-' + VERSION;

/* ملفات أساسية: يجب أن تنجح لإتمام التثبيت */
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'];

/* ملفات اختيارية: تُحمَّل في الخلفية، ولا يفشل التثبيت إن غاب أحدها */
const OPTIONAL = [
  './1-1.pdf', './1-1-map.pdf', './1-2.pdf', './1-2-map.pdf',
  './s1-l1-scene1.mp3', './s1-l1-scene2.mp3', './s1-l1-scene3.mp3', './s1-l1-scene4.mp3', './s1-l1-scene5.mp3',
  './s1-l2-scene1.mp3', './s1-l2-scene2.mp3', './s1-l2-scene3.mp3', './s1-l2-scene4.mp3',
  'https://i.ibb.co/sXSj8yG/902727229-1790797197308525.jpg',
  'https://i.ibb.co/F4p5f00M/579226496-1790797178349737.jpg',
  'https://i.ibb.co/21BgTcKQ/855220876-1790796810408360.jpg',
  'https://i.ibb.co/RGv8R3T3/469790083-1790797184640664.jpg',
  'https://i.ibb.co/QvbjjP1p/840231028-1790797162215566.jpg',
  'https://i.ibb.co/Xr6h5ngH/186266371-1790797209319934.jpg',
  'https://i.ibb.co/n8QqF4LP/543637062-1791729744128813.jpg',
  'https://i.ibb.co/nsNV9SXQ/5-1-map.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
    await Promise.allSettled(OPTIONAL.map(async (u) => {
      const req = u.startsWith('http') ? new Request(u, { mode: 'no-cors' }) : new Request(u);
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) await cache.put(req, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* دعم طلبات Range (ضروري للصوتيات والفيديو من الكاش) */
async function rangeResponse(request, cached) {
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (end >= size) end = size - 1;
  if (start > end) start = 0;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1)
    }
  });
}

/* صفحات التنقل: الشبكة أولاً (لأحدث نسخة) ثم الكاش عند انقطاع الاتصال */
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    return (await cache.match(request, { ignoreSearch: true })) ||
           (await cache.match('./index.html')) ||
           (await cache.match('./')) ||
           new Response('أنت غير متصل بالإنترنت.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

/* باقي الملفات: من الكاش فوراً ثم التحديث في الخلفية */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = (await cache.match(request)) || (await caches.match(request));
  const network = fetch(request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { network.catch(() => {}); return cached; }
  const res = await network;
  return res || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;

  if (req.headers.has('range')) {
    event.respondWith((async () => {
      const cached = await caches.match(req.url);
      if (cached && cached.status === 200) return rangeResponse(req, cached);
      return fetch(req).catch(() => Response.error());
    })());
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});
