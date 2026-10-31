/* ==========================================================================
   Service Worker — Offline-First (PWA)
   - يخزّن الصفحات والصور والتنسيقات والجافاسكريبت وPDF والصوتيات عند أول زيارة أونلاين
   - يعمل على GitHub Pages (مسار فرعي) وعلى WebView الهواتف
   - لتحديث الموقع لاحقاً: غيّر رقم VERSION فقط
   ========================================================================== */
'use strict';

const VERSION = 'v1.0.2';
const PREFIX = 'edu-hub';

/* نسخة مرقّمة: ملفات الموقع نفسها (HTML / CSS / JS / PDF / JSON) */
const CACHE_STATIC = PREFIX + '-static-' + VERSION;
/* أسماء ثابتة (غير مرقّمة) كي لا يُعاد تنزيل الصور والصوتيات عند كل تحديث */
const CACHE_IMAGES = PREFIX + '-images';
const CACHE_MEDIA = PREFIX + '-media';
const CACHE_FONTS = PREFIX + '-fonts';
const KEEP = [CACHE_STATIC, CACHE_IMAGES, CACHE_MEDIA, CACHE_FONTS];

const MAX_IMAGES = 150;
const MAX_MEDIA = 60;
const MAX_FONTS = 40;
const NAV_TIMEOUT_MS = 4000;
const MAX_WARM_URLS = 120;

const SCOPE = self.registration.scope;
const ORIGIN = self.location.origin;
const INDEX_URL = new URL('./index.html', SCOPE).href;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

const MEDIA_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|mp4|webm|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;

const OFFLINE_HTML =
  '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>لا يوجد اتصال</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#08070C;color:#fff;font-family:sans-serif;text-align:center;padding:24px}' +
  'p{color:#B7AFCB;line-height:1.9}</style></head><body><div>' +
  '<h1>لا يوجد اتصال بالإنترنت</h1>' +
  '<p>لم يتم حفظ هذه الصفحة بعد. افتح الموقع مرة واحدة وأنت متصل بالإنترنت ثم حاول مجدداً.</p>' +
  '</div></body></html>';

const OFFLINE_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">' +
  '<rect width="400" height="240" fill="#1a1030"/>' +
  '<text x="200" y="125" fill="#B7AFCB" font-size="16" text-anchor="middle" font-family="sans-serif">offline</text></svg>';

/* ---------------------------------- helpers ---------------------------------- */

function isHttp(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isCacheable(response) {
  return !!response && (response.ok || response.type === 'opaque');
}

function isDocumentRequest(request, url) {
  if (request.mode !== 'navigate') return false;
  const path = url.pathname;
  return /\.html?$/i.test(path) || !/\.[a-z0-9]+$/i.test(path);
}

function classify(request, url) {
  const path = url.pathname;
  if (request.destination === 'audio' || request.destination === 'video' || MEDIA_EXT.test(path)) return 'media';
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || request.destination === 'font') return 'fonts';
  if (request.destination === 'image' || IMAGE_EXT.test(path)) return 'images';
  return 'static';
}

function cacheNameFor(kind) {
  if (kind === 'media') return CACHE_MEDIA;
  if (kind === 'fonts') return CACHE_FONTS;
  if (kind === 'images') return CACHE_IMAGES;
  return CACHE_STATIC;
}

function maxEntriesFor(kind) {
  if (kind === 'media') return MAX_MEDIA;
  if (kind === 'fonts') return MAX_FONTS;
  if (kind === 'images') return MAX_IMAGES;
  return 0;
}

async function trimCache(cacheName, maxEntries) {
  if (!maxEntries) return;
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - maxEntries; i++) {
      await cache.delete(keys[i]);
    }
  } catch (e) { /* ignore */ }
}

async function safePut(cacheName, request, response, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    if (maxEntries) await trimCache(cacheName, maxEntries);
  } catch (e) { /* quota or unsupported response: ignore */ }
}

/* جلب مورد. للموارد الخارجية (مثل i.ibb.co) نحاول CORS أولاً لتفادي الاستجابات
   المعتمة (opaque) التي تستهلك حصة تخزين كبيرة، ثم نرجع إلى no-cors عند الفشل. */
async function fetchForCache(request) {
  const url = new URL(request.url);
  if (url.origin === ORIGIN || request.mode === 'navigate') {
    return fetch(request);
  }
  try {
    return await fetch(new Request(request.url, { mode: 'cors', credentials: 'omit' }));
  } catch (e) {
    return fetch(new Request(request.url, { mode: 'no-cors', credentials: 'omit' }));
  }
}

function timeout(ms) {
  return new Promise(function (_, reject) {
    setTimeout(function () { reject(new Error('timeout')); }, ms);
  });
}

/* ------------------------------ Range (audio/video) ------------------------------ */

const inflightMedia = new Set();

async function cacheFullMedia(url) {
  if (inflightMedia.has(url)) return;
  inflightMedia.add(url);
  try {
    const cache = await caches.open(CACHE_MEDIA);
    if (await cache.match(url, { ignoreVary: true })) return;
    const res = await fetch(new Request(url, { credentials: 'same-origin' }));
    if (res && res.status === 200) {
      await cache.put(url, res.clone());
      await trimCache(CACHE_MEDIA, MAX_MEDIA);
    }
  } catch (e) { /* ignore */ } finally {
    inflightMedia.delete(url);
  }
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/i.exec((header || '').trim());
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '' && m[2] === '') return null;
  if (m[1] === '') {
    const suffix = parseInt(m[2], 10);
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (isNaN(start) || isNaN(end) || start > end || start >= size) return null;
  return { start: start, end: end };
}

async function handleMedia(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_MEDIA);
  const cached = await cache.match(request.url, { ignoreVary: true });
  const rangeHeader = request.headers.get('range');

  if (cached) {
    if (!rangeHeader) return cached;
    const blob = await cached.blob();
    const range = parseRange(rangeHeader, blob.size);
    if (!range) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + blob.size } });
    }
    return new Response(blob.slice(range.start, range.end + 1), {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + blob.size,
        'Accept-Ranges': 'bytes'
      }
    });
  }

  /* غير مخزّن: مرّر الطلب للشبكة، وحمّل الملف كاملاً في الخلفية ليعمل لاحقاً أوفلاين */
  const sameOrigin = new URL(request.url).origin === ORIGIN;
  if (sameOrigin) event.waitUntil(cacheFullMedia(request.url));
  try {
    return await fetch(request);
  } catch (e) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/* --------------------------------- navigation --------------------------------- */

async function handleNavigation(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_STATIC);
  try {
    const network = Promise.resolve(event.preloadResponse).then(function (r) {
      return r || fetch(request);
    });
    const response = await Promise.race([network, timeout(NAV_TIMEOUT_MS)]);
    if (response && response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil((async function () {
        try {
          await cache.put(request, copy.clone());
          const u = new URL(request.url);
          if (u.href === SCOPE || /\/index\.html?$/i.test(u.pathname)) {
            await cache.put(INDEX_URL, copy.clone());
          }
        } catch (e) { /* ignore */ }
      })());
    }
    return response;
  } catch (e) {
    const hit =
      (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
      (await cache.match(INDEX_URL, { ignoreSearch: true })) ||
      (await cache.match(SCOPE, { ignoreSearch: true }));
    return hit || new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/* ---------------------------------- strategies ---------------------------------- */

async function cacheFirst(request, kind) {
  const cacheName = cacheNameFor(kind);
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetchForCache(request);
    if (isCacheable(res)) await safePut(cacheName, request, res.clone(), maxEntriesFor(kind));
    return res;
  } catch (e) {
    if (kind === 'images') {
      return new Response(OFFLINE_IMAGE, { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(event, kind) {
  const request = event.request;
  const cacheName = cacheNameFor(kind);
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });

  const update = fetchForCache(request).then(function (res) {
    if (isCacheable(res)) safePut(cacheName, request, res.clone(), maxEntriesFor(kind));
    return res;
  }).catch(function () { return null; });

  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  const res = await update;
  return res || Response.error();
}

/* ------------------------------------ events ------------------------------------ */

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(CACHE_STATIC);
    await Promise.allSettled(PRECACHE.map(function (path) {
      return cache.add(new Request(new URL(path, SCOPE).href, { cache: 'reload' }));
    }));
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const names = await caches.keys();
    await Promise.all(names.map(function (name) {
      if (name.indexOf(PREFIX + '-') === 0 && KEEP.indexOf(name) === -1) return caches.delete(name);
      return null;
    }));
    /* حذف صورة منتهية الصلاحية من الذاكرة (تم استبدالها برابط جديد) */
    try {
      const imgCache = await caches.open(CACHE_IMAGES);
      await imgCache.delete('https://i.ibb.co/sXSj8yG/902727229-1790797197308525.jpg');
    } catch (e) { /* ignore */ }
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) { /* ignore */ }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isHttp(url)) return;
  if (url.origin === ORIGIN && url.pathname.slice(-6) === '/sw.js') return;
  if (url.origin !== ORIGIN && request.mode === 'navigate') return;

  if (isDocumentRequest(request, url)) {
    event.respondWith(handleNavigation(event));
    return;
  }

  const kind = classify(request, url);
  if (kind === 'media') {
    event.respondWith(handleMedia(event));
  } else if (kind === 'images' || (kind === 'fonts' && url.hostname === 'fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, kind));
  } else {
    event.respondWith(staleWhileRevalidate(event, kind));
  }
});

/* تسخين الذاكرة: الصفحة ترسل قائمة الموارد التي حُمّلت قبل أن يسيطر الـ SW عليها */
async function warmCache(urls) {
  const unique = Array.from(new Set(urls)).slice(0, MAX_WARM_URLS);
  await Promise.allSettled(unique.map(async function (raw) {
    let url;
    try { url = new URL(raw, SCOPE); } catch (e) { return; }
    if (!isHttp(url)) return;
    if (url.origin === ORIGIN && url.pathname.slice(-6) === '/sw.js') return;

    const request = new Request(url.href);
    const kind = classify(request, url);

    if (kind === 'media') {
      if (url.origin === ORIGIN) await cacheFullMedia(url.href);
      return;
    }
    const cacheName = cacheNameFor(kind);
    const cache = await caches.open(cacheName);
    if (await cache.match(url.href, { ignoreVary: true })) return;
    try {
      const res = await fetchForCache(request);
      if (isCacheable(res)) await safePut(cacheName, url.href, res.clone(), maxEntriesFor(kind));
    } catch (e) { /* ignore */ }
  }));
}

self.addEventListener('message', function (event) {
  const data = event.data;
  const type = typeof data === 'string' ? data : data && data.type;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'CACHE_URLS' && data && Array.isArray(data.urls)) {
    event.waitUntil(warmCache(data.urls));
  }
});
