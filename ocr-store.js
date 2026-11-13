/* ==========================================================================
   ocr-store.js — التخزين المحلي (IndexedDB) وإدارة موارد العمل دون إنترنت (Cache Storage)
   - يحفظ الصور بصيغة Blob مع إعدادات التحسين والنصوص المستخرجة وتعديلات الطالب محلياً فقط.
   - يتحقق من جاهزية ملفات Tesseract.js واللغة العربية والإنجليزية داخل Cache Storage.
   ========================================================================== */
(function () {
  'use strict';

  var DB_NAME = 'edu_ocr_db_v1';
  var DB_VER = 1;
  var STORE_ITEMS = 'items';
  var STORE_META = 'meta';
  var CACHE_OCR = 'edu-hub-ocr-v1';

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB غير مدعوم في هذا المتصفح'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          var s = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
          s.createIndex('order', 'order', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error || new Error('فشل فتح قاعدة البيانات')); };
    });
    return dbPromise;
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('خطأ في التخزين المحلي')); };
      tx.onabort = function () { reject(tx.error || new Error('تم إلغاء عملية التخزين')); };
    });
  }

  function getAllItems() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_ITEMS, 'readonly');
        var req = tx.objectStore(STORE_ITEMS).getAll();
        req.onsuccess = function () {
          var list = req.result || [];
          list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
          resolve(list);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function putItem(item) {
    return openDB().then(function (db) {
      var tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).put(item);
      return txDone(tx);
    });
  }

  function putAllItems(items) {
    return openDB().then(function (db) {
      var tx = db.transaction(STORE_ITEMS, 'readwrite');
      var store = tx.objectStore(STORE_ITEMS);
      items.forEach(function (it) { store.put(it); });
      return txDone(tx);
    });
  }

  function deleteItem(id) {
    return openDB().then(function (db) {
      var tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).delete(id);
      return txDone(tx);
    });
  }

  function getMeta(key, fallback) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE_META, 'readonly');
        var req = tx.objectStore(STORE_META).get(key);
        req.onsuccess = function () {
          resolve(req.result ? req.result.value : fallback);
        };
        req.onerror = function () { resolve(fallback); };
      });
    }).catch(function () { return fallback; });
  }

  function setMeta(key, value) {
    return openDB().then(function (db) {
      var tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: key, value: value });
      return txDone(tx);
    });
  }

  function clearAllData() {
    return openDB().then(function (db) {
      var tx = db.transaction([STORE_ITEMS, STORE_META], 'readwrite');
      tx.objectStore(STORE_ITEMS).clear();
      tx.objectStore(STORE_META).clear();
      return txDone(tx);
    });
  }

  /* ---------- مسارات Tesseract المحلية المتوافقة مع المسار الفرعي وCapacitor ---------- */
  function baseUrl(rel) {
    try {
      return new URL(rel, document.baseURI).href;
    } catch (e) {
      return rel;
    }
  }

  /* كشف نفس خصائص WASM SIMD التي يعتمدها Tesseract.js لاختيار ملف النواة الفعلي لهذا الجهاز */
  var _simdProbe = null;
  function detectCoreFilename() {
    if (_simdProbe) return _simdProbe;
    _simdProbe = (async function () {
      if (typeof WebAssembly !== 'object' || typeof WebAssembly.validate !== 'function') {
        return 'tesseract-core-lstm.wasm.js';
      }
      try {
        /* فحص Relaxed SIMD ثم SIMD القياسي بنمط WebAssembly valid minimal bytes */
        var relaxedBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1, 13, 0, 65, 0, 253, 15, 253, 98, 0, 0, 0, 0, 253, 1, 11]);
        if (WebAssembly.validate(relaxedBytes)) return 'tesseract-core-relaxedsimd-lstm.wasm.js';
      } catch (e) {}
      try {
        var simdBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
        if (WebAssembly.validate(simdBytes)) return 'tesseract-core-simd-lstm.wasm.js';
      } catch (e) {}
      return 'tesseract-core-lstm.wasm.js';
    })();
    return _simdProbe;
  }

  function getRequiredUrls() {
    return detectCoreFilename().then(function (coreFile) {
      return [
        { key: 'lib', label: 'مكتبة Tesseract.js', rel: './vendor/tesseract/tesseract.min.js', url: baseUrl('./vendor/tesseract/tesseract.min.js') },
        { key: 'worker', label: 'عامل المعالجة (Worker)', rel: './vendor/tesseract/worker.min.js', url: baseUrl('./vendor/tesseract/worker.min.js') },
        { key: 'core', label: 'محرك WebAssembly', rel: './vendor/tesseract/' + coreFile, url: baseUrl('./vendor/tesseract/' + coreFile) },
        { key: 'ara', label: 'بيانات اللغة العربية', rel: './vendor/tesseract/lang/ara.traineddata.gz', url: baseUrl('./vendor/tesseract/lang/ara.traineddata.gz') },
        { key: 'eng', label: 'بيانات اللغة الإنجليزية', rel: './vendor/tesseract/lang/eng.traineddata.gz', url: baseUrl('./vendor/tesseract/lang/eng.traineddata.gz') }
      ];
    });
  }

  async function matchAnyCache(url) {
    if (!('caches' in window)) return null;
    try {
      var ocrCache = await caches.open(CACHE_OCR);
      var hit = await ocrCache.match(url, { ignoreVary: true });
      if (hit && hit.ok) return hit;
      hit = await caches.match(url, { ignoreVary: true });
      return (hit && hit.ok) ? hit : null;
    } catch (e) {
      return null;
    }
  }

  async function checkReadiness() {
    var list = await getRequiredUrls();
    var hasCacheApi = 'caches' in window;
    if (!hasCacheApi) {
      return { ready: false, cachedCount: 0, total: list.length, missing: list, items: list, cacheUnsupported: true };
    }
    var missing = [];
    for (var i = 0; i < list.length; i++) {
      var hit = await matchAnyCache(list[i].url);
      list[i].cached = !!hit;
      if (!hit) missing.push(list[i]);
    }
    return {
      ready: missing.length === 0,
      cachedCount: list.length - missing.length,
      total: list.length,
      missing: missing,
      items: list,
      cacheUnsupported: false
    };
  }

  async function prepareOffline(onProgress) {
    var list = await getRequiredUrls();
    if (!('caches' in window)) {
      throw new Error('ذاكرة التخزين المؤقت (Cache API) غير متاحة في هذا السياق');
    }
    var cache = await caches.open(CACHE_OCR);
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (typeof onProgress === 'function') {
        onProgress({ done: done, total: list.length, current: item.label });
      }
      var existing = await cache.match(item.url, { ignoreVary: true });
      if (!existing || !existing.ok) {
        var res = await fetch(new Request(item.url, { credentials: 'same-origin' }));
        if (!res || !res.ok) {
          throw new Error('تعذّر تحميل الملف المحلي: ' + item.rel + ' (' + (res ? res.status : 'network') + ')');
        }
        await cache.put(item.url, res.clone());
      }
      done++;
      if (typeof onProgress === 'function') {
        onProgress({ done: done, total: list.length, current: item.label });
      }
    }
    return checkReadiness();
  }

  window.OCRStore = {
    CACHE_OCR: CACHE_OCR,
    baseUrl: baseUrl,
    detectCoreFilename: detectCoreFilename,
    getAllItems: getAllItems,
    putItem: putItem,
    putAllItems: putAllItems,
    deleteItem: deleteItem,
    getMeta: getMeta,
    setMeta: setMeta,
    clearAllData: clearAllData,
    checkReadiness: checkReadiness,
    prepareOffline: prepareOffline
  };
})();
