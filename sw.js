const CACHE_NAME = 'my-site-cache-v1';
// ضع هنا روابط الصفحات والملفات التي تريد حفظها لتعمل بدون إنترنت
const urlsToCache = [
  './',
  './index.html',
  // يمكنك إضافة ملفات الـ CSS أو الـ JS أو صفحات الدروس الأخرى هنا
];

// تثبيت الـ Service Worker وحفظ الملفات في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// جلب الملفات من الكاش في حال عدم وجود إنترنت
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // إذا وجد الملف في الكاش يعرضه، وإلا يجربه من الشبكة
      return response || fetch(event.request);
    })
  );
});
