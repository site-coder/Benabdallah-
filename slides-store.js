/* ==========================================================================
   slides-store.js — التخزين المحلي (IndexedDB) وإدارة المشاريع والنسخ الاحتياطي
   - قاعدة البيانات: sl_db_v1 (المخازن: projects, meta)
   - ترحيل آمن وتلقائي من localStorage (sl_projects_v1) دون تكرار ودون حذف البيانات
     القديمة إلا بعد التحقق الفعلي من حفظها في IndexedDB
   - في حال تعذّر IndexedDB، يعود تلقائياً لقراءة المشاريع من localStorage
   - تصدير واستيراد JSON مع التحقق الصارم من البنية وحفظ الصور كاملة
   ========================================================================== */
(function (root) {
  'use strict';
  var E = root.SLE;
  var DB_NAME = 'sl_db_v1', DB_VER = 1, STORE = 'projects', META = 'meta';
  var LS_KEY = 'sl_projects_v1', LS_MIGRATED = 'sl_migrated_v1', LS_LAST = 'sl_last_proj_v1';
  var MAX_IMPORT_BYTES = 50 * 1024 * 1024;
  var dbPromise = null;
  var idbOk = true;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { idbOk = false; reject(new Error('IDB_UNSUPPORTED')); return; }
      try {
        var req = root.indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result;
          if (!db.objectStoreNames.contains(STORE)) {
            var st = db.createObjectStore(STORE, { keyPath: 'id' });
            st.createIndex('updated', 'updated', { unique: false });
          }
          if (!db.objectStoreNames.contains(META)) {
            db.createObjectStore(META, { keyPath: 'key' });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { idbOk = false; reject(req.error || new Error('IDB_OPEN_FAILED')); };
      } catch (e) { idbOk = false; reject(e); }
    });
    return dbPromise;
  }

  function tx(storeName, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var t = db.transaction(storeName, mode);
          var st = t.objectStore(storeName);
          var res;
          t.oncomplete = function () { resolve(res); };
          t.onerror = function () { reject(t.error || new Error('IDB_TX_ERR')); };
          t.onabort = function () { reject(t.error || new Error('IDB_TX_ABORT')); };
          res = fn(st, resolve, reject);
        } catch (e) { reject(e); }
      });
    });
  }

  function getAllIDB() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, 'readonly');
        var req = t.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { reject(req.error || new Error('IDB_GETALL_ERR')); };
      });
    });
  }

  function putIDB(proj) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(proj);
        t.oncomplete = function () { resolve(true); };
        t.onerror = function () { reject(t.error || new Error('IDB_PUT_ERR')); };
      });
    });
  }

  function delIDB(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).delete(id);
        t.oncomplete = function () { resolve(true); };
        t.onerror = function () { reject(t.error || new Error('IDB_DEL_ERR')); };
      });
    });
  }

  function loadLS() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(function (p) { return E ? E.normalizeProject(p) : p; }).filter(Boolean) : [];
    } catch (e) { return []; }
  }

  function saveLSFallback(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  function migrateIfNeeded() {
    var oldList = loadLS();
    if (!oldList.length) return getAllIDB();

    return getAllIDB().then(function (existing) {
      var seen = {};
      existing.forEach(function (p) { if (p && p.id) seen[p.id] = true; });
      var toInsert = oldList.filter(function (p) { return p && p.id && !seen[p.id]; });
      if (!toInsert.length) {
        try { localStorage.setItem(LS_MIGRATED, '1'); } catch (e) {}
        return existing;
      }
      return Promise.all(toInsert.map(putIDB)).then(function () {
        /* التحقق الفعلي من نجاح القراءة من IndexedDB قبل وسم الترحيل كمكتمل */
        return getAllIDB().then(function (after) {
          var afterIds = {};
          after.forEach(function (p) { if (p && p.id) afterIds[p.id] = true; });
          var allVerified = toInsert.every(function (p) { return !!afterIds[p.id]; });
          if (allVerified) {
            try {
              localStorage.setItem(LS_MIGRATED, '1');
              localStorage.removeItem(LS_KEY);
            } catch (e) {}
          }
          return after;
        });
      });
    });
  }

  function initAndList() {
    return migrateIfNeeded().then(function (list) {
      var norm = list.map(function (p) { return E ? E.normalizeProject(p) : p; });
      norm.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      return norm;
    }).catch(function () {
      idbOk = false;
      var ls = loadLS();
      ls.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      return ls;
    });
  }

  function saveProject(proj) {
    if (!proj || !proj.id) return Promise.resolve(false);
    var clean = E ? E.normalizeProject(E.clone(proj)) : proj;
    if (!idbOk) {
      var ls = loadLS().filter(function (p) { return p.id !== clean.id; });
      ls.push(clean);
      return Promise.resolve(saveLSFallback(ls));
    }
    return putIDB(clean).catch(function () {
      var ls = loadLS().filter(function (p) { return p.id !== clean.id; });
      ls.push(clean);
      return saveLSFallback(ls);
    });
  }

  function deleteProject(id) {
    if (!idbOk) {
      var ls = loadLS().filter(function (p) { return p.id !== id; });
      return Promise.resolve(saveLSFallback(ls));
    }
    return delIDB(id).catch(function () { return false; });
  }

  function setLastOpen(id) {
    try { if (id) localStorage.setItem(LS_LAST, id); else localStorage.removeItem(LS_LAST); } catch (e) {}
  }
  function getLastOpen() {
    try { return localStorage.getItem(LS_LAST) || ''; } catch (e) { return ''; }
  }

  /* ---------- النسخ الاحتياطي JSON ---------- */
  function safeFileName(name) {
    return String(name || 'presentation').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || 'presentation';
  }
  function exportJson(proj) {
    if (!proj) return false;
    var payload = {
      format: 'edu-slides-studio',
      version: 2,
      exportedAt: Date.now(),
      project: E ? E.normalizeProject(E.clone(proj)) : proj
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(proj.name) + '.slides.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 250);
    return true;
  }

  function importJsonFile(file, existingList) {
    return new Promise(function (resolve) {
      if (!file) { resolve({ ok: false, msg: 'لم يتم اختيار ملف.' }); return; }
      if (file.size > MAX_IMPORT_BYTES) { resolve({ ok: false, msg: 'حجم الملف كبير جداً (الحد الأقصى 50 ميغابايت).' }); return; }
      if (!/\.json$/i.test(file.name) && file.type && file.type.indexOf('json') < 0 && file.type !== '') {
        resolve({ ok: false, msg: 'الرجاء اختيار ملف بصيغة JSON صالحة.' }); return;
      }
      var fr = new FileReader();
      fr.onerror = function () { resolve({ ok: false, msg: 'تعذّرت قراءة الملف من الجهاز.' }); };
      fr.onload = function () {
        var parsed;
        try { parsed = JSON.parse(String(fr.result || '')); }
        catch (e) { resolve({ ok: false, msg: 'الملف تالف أو لا يحتوي على بيانات JSON صالحة.' }); return; }

        var check = E ? E.validateProject(parsed) : { ok: false, msg: 'محرك البيانات غير متاح.' };
        if (!check.ok) { resolve(check); return; }

        var proj = check.project;
        var existingIds = {};
        (existingList || []).forEach(function (p) { existingIds[p.id] = true; });
        if (existingIds[proj.id]) {
          proj.id = E.uid('p');
          proj.name = proj.name + ' (مستورد)';
        }
        proj.updated = Date.now();
        saveProject(proj).then(function (ok) {
          if (!ok) resolve({ ok: false, msg: 'تم التحقق من الملف لكن تعذّر حفظه في التخزين المحلي.' });
          else resolve({ ok: true, project: proj });
        });
      };
      fr.readAsText(file, 'utf-8');
    });
  }

  root.SLS = {
    initAndList: initAndList,
    saveProject: saveProject,
    deleteProject: deleteProject,
    setLastOpen: setLastOpen,
    getLastOpen: getLastOpen,
    exportJson: exportJson,
    importJsonFile: importJsonFile,
    isIDBActive: function () { return idbOk; }
  };
  if (typeof module !== 'undefined') module.exports = root.SLS;
})(typeof window !== 'undefined' ? window : globalThis);
