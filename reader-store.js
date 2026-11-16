/* ==========================================================================
   reader-store.js — قاعدة البيانات المحلية (IndexedDB) للقارئ الأكاديمي التفاعلي
   - تحفظ: بيانات الملفات (مع Blob محلياً)، سجل القراءة، آخر موضع قراءة،
     التظليلات والتعليقات الجانبية، ملاحظات الصفحات، والعلامات المرجعية.
   - لكل ملف معرّف ثابت (fileId) مبني على البصمة الرقمية للمحتوى لمنع تداخل
     الملفات ذات الاسم المتشابه.
   - تدعم تصدير نسخة احتياطية كاملة (JSON) واستعادتها دون أي خادم خارجي.
   ========================================================================== */
(function (root) {
  'use strict';

  var DB_NAME = 'edu_reader_db_v1';
  var DB_VER = 1;
  var ST_FILES = 'files';
  var ST_ANNS = 'annotations';
  var ST_NOTES = 'notes';
  var ST_MARKS = 'bookmarks';
  var ST_META = 'meta';

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) {
        reject(new Error('IndexedDB غير مدعوم في هذا المتصفح'));
        return;
      }
      var req = root.indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(ST_FILES)) {
          var sf = db.createObjectStore(ST_FILES, { keyPath: 'id' });
          sf.createIndex('lastOpenedAt', 'lastOpenedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(ST_ANNS)) {
          var sa = db.createObjectStore(ST_ANNS, { keyPath: 'id' });
          sa.createIndex('fileId', 'fileId', { unique: false });
          sa.createIndex('filePage', ['fileId', 'page'], { unique: false });
        }
        if (!db.objectStoreNames.contains(ST_NOTES)) {
          var sn = db.createObjectStore(ST_NOTES, { keyPath: 'id' });
          sn.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(ST_MARKS)) {
          var sm = db.createObjectStore(ST_MARKS, { keyPath: 'id' });
          sm.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(ST_META)) {
          db.createObjectStore(ST_META, { keyPath: 'key' });
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
      tx.onerror = function () { reject(tx.error || new Error('خطأ في قاعدة البيانات')); };
      tx.onabort = function () { reject(tx.error || new Error('تم إلغاء العملية')); };
    });
  }

  function getAllByIndex(storeName, indexName, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var st = tx.objectStore(storeName);
        var req = indexName ? st.index(indexName).getAll(key) : st.getAll();
        req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getOne(storeName, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function putOne(storeName, val) {
    return openDB().then(function (db) {
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(val);
      return txDone(tx);
    });
  }

  function deleteOne(storeName, key) {
    return openDB().then(function (db) {
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      return txDone(tx);
    });
  }

  /* ---------- الملفات وسجل القراءة ---------- */
  async function saveOrUpdateFile(fileMeta, u8Bytes) {
    var existing = await getOne(ST_FILES, fileMeta.id);
    var now = Date.now();
    var blob = null;
    if (u8Bytes) {
      try {
        blob = new Blob([u8Bytes], { type: 'application/pdf' });
      } catch (e) {
        blob = u8Bytes;
      }
    } else if (existing && existing.blob) {
      blob = existing.blob;
    }

    var rec = {
      id: fileMeta.id,
      name: fileMeta.name || (existing && existing.name) || 'document.pdf',
      size: fileMeta.size || (existing && existing.size) || 0,
      lastModified: fileMeta.lastModified || (existing && existing.lastModified) || now,
      pageCount: fileMeta.pageCount || (existing && existing.pageCount) || 0,
      blob: blob,
      addedAt: (existing && existing.addedAt) || now,
      lastOpenedAt: now,
      lastPage: (existing && existing.lastPage) || 1,
      lastZoom: (existing && existing.lastZoom) || 1,
      zoomMode: (existing && existing.zoomMode) || 'fit-width',
      nightMode: existing && typeof existing.nightMode === 'boolean' ? existing.nightMode : false
    };
    await putOne(ST_FILES, rec);
    return rec;
  }

  async function updateFileState(fileId, patch) {
    var rec = await getOne(ST_FILES, fileId);
    if (!rec) return null;
    Object.keys(patch || {}).forEach(function (k) {
      if (k !== 'id') rec[k] = patch[k];
    });
    await putOne(ST_FILES, rec);
    return rec;
  }

  async function getFileBytes(fileRec) {
    if (!fileRec || !fileRec.blob) return null;
    if (fileRec.blob instanceof Uint8Array) return fileRec.blob;
    if (fileRec.blob instanceof ArrayBuffer) return new Uint8Array(fileRec.blob);
    if (typeof fileRec.blob.arrayBuffer === 'function') {
      var ab = await fileRec.blob.arrayBuffer();
      return new Uint8Array(ab);
    }
    return null;
  }

  async function listRecentFiles() {
    var files = await getAllByIndex(ST_FILES, null, null);
    var anns = await getAllByIndex(ST_ANNS, null, null);
    var notes = await getAllByIndex(ST_NOTES, null, null);
    var marks = await getAllByIndex(ST_MARKS, null, null);

    var annCounts = Object.create(null);
    var noteCounts = Object.create(null);
    var markCounts = Object.create(null);
    anns.forEach(function (a) { annCounts[a.fileId] = (annCounts[a.fileId] || 0) + 1; });
    notes.forEach(function (n) { if (n.content && n.content.trim()) noteCounts[n.fileId] = (noteCounts[n.fileId] || 0) + 1; });
    marks.forEach(function (m) { markCounts[m.fileId] = (markCounts[m.fileId] || 0) + 1; });

    files.sort(function (a, b) { return (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0); });
    return files.map(function (f) {
      return {
        id: f.id,
        name: f.name,
        size: f.size,
        pageCount: f.pageCount || 0,
        lastOpenedAt: f.lastOpenedAt || f.addedAt || 0,
        lastPage: f.lastPage || 1,
        hasBlob: !!f.blob,
        annCount: annCounts[f.id] || 0,
        noteCount: noteCounts[f.id] || 0,
        markCount: markCounts[f.id] || 0
      };
    });
  }

  async function deleteFileAndData(fileId) {
    var db = await openDB();
    var anns = await getAllByIndex(ST_ANNS, 'fileId', fileId);
    var notes = await getAllByIndex(ST_NOTES, 'fileId', fileId);
    var marks = await getAllByIndex(ST_MARKS, 'fileId', fileId);

    var tx = db.transaction([ST_FILES, ST_ANNS, ST_NOTES, ST_MARKS], 'readwrite');
    tx.objectStore(ST_FILES).delete(fileId);
    var sa = tx.objectStore(ST_ANNS);
    anns.forEach(function (a) { sa.delete(a.id); });
    var sn = tx.objectStore(ST_NOTES);
    notes.forEach(function (n) { sn.delete(n.id); });
    var sm = tx.objectStore(ST_MARKS);
    marks.forEach(function (m) { sm.delete(m.id); });
    return txDone(tx);
  }

  /* ---------- بيانات الملف الواحد ---------- */
  async function getFileBundle(fileId) {
    var res = await Promise.all([
      getOne(ST_FILES, fileId),
      getAllByIndex(ST_ANNS, 'fileId', fileId),
      getAllByIndex(ST_NOTES, 'fileId', fileId),
      getAllByIndex(ST_MARKS, 'fileId', fileId)
    ]);
    var annotations = res[1].sort(function (a, b) {
      return (a.page - b.page) || ((a.createdAt || 0) - (b.createdAt || 0));
    });
    var notes = res[2].filter(function (n) { return n.content && n.content.trim(); })
      .sort(function (a, b) { return a.page - b.page; });
    var bookmarks = res[3].sort(function (a, b) { return a.page - b.page; });
    return {
      file: res[0],
      annotations: annotations,
      notes: notes,
      bookmarks: bookmarks
    };
  }

  function saveAnnotation(ann) {
    return putOne(ST_ANNS, ann);
  }

  function deleteAnnotation(id) {
    return deleteOne(ST_ANNS, id);
  }

  function savePageNote(fileId, page, content) {
    var id = fileId + '::' + page;
    var trimmed = String(content || '');
    if (!trimmed.trim()) return deleteOne(ST_NOTES, id);
    return putOne(ST_NOTES, {
      id: id,
      fileId: fileId,
      page: page,
      content: trimmed,
      updatedAt: Date.now()
    });
  }

  function saveBookmark(bm) {
    return putOne(ST_MARKS, bm);
  }

  function deleteBookmark(id) {
    return deleteOne(ST_MARKS, id);
  }

  function getMeta(key, fallback) {
    return getOne(ST_META, key).then(function (r) {
      return r ? r.value : fallback;
    }).catch(function () { return fallback; });
  }

  function setMeta(key, value) {
    return putOne(ST_META, { key: key, value: value });
  }

  /* ---------- النسخ الاحتياطي والاستعادة (JSON محلي) ---------- */
  function u8ToBase64(u8) {
    var chunk = 0x8000;
    var bin = '';
    for (var i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function base64ToU8(b64) {
    var bin = atob(b64);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  async function exportBackup(includePdfs) {
    var files = await getAllByIndex(ST_FILES, null, null);
    var anns = await getAllByIndex(ST_ANNS, null, null);
    var notes = await getAllByIndex(ST_NOTES, null, null);
    var marks = await getAllByIndex(ST_MARKS, null, null);

    var outFiles = [];
    var embeddedCount = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var item = {
        id: f.id,
        name: f.name,
        size: f.size,
        lastModified: f.lastModified,
        pageCount: f.pageCount,
        addedAt: f.addedAt,
        lastOpenedAt: f.lastOpenedAt,
        lastPage: f.lastPage,
        lastZoom: f.lastZoom,
        zoomMode: f.zoomMode,
        nightMode: !!f.nightMode
      };
      if (includePdfs && f.blob) {
        var u8 = await getFileBytes(f);
        if (u8 && u8.byteLength <= 25 * 1024 * 1024) {
          item.pdfBase64 = u8ToBase64(u8);
          embeddedCount++;
        }
      }
      outFiles.push(item);
    }

    return {
      app: 'eps-chlef-academic-reader',
      version: 1,
      exportedAt: Date.now(),
      embeddedPdfs: embeddedCount,
      files: outFiles,
      annotations: anns,
      notes: notes,
      bookmarks: marks
    };
  }

  async function importBackup(jsonText) {
    var data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      throw new Error('ملف النسخة الاحتياطية غير صالح (ليس JSON صحيحاً)');
    }
    if (!data || data.app !== 'eps-chlef-academic-reader' || !Array.isArray(data.files)) {
      throw new Error('صيغة النسخة الاحتياطية غير متوافقة مع القارئ الأكاديمي');
    }

    var db = await openDB();
    var filesToSave = [];
    for (var i = 0; i < data.files.length; i++) {
      var f = data.files[i];
      if (!f || !f.id) continue;
      var existing = await getOne(ST_FILES, f.id);
      var blob = existing ? existing.blob : null;
      if (f.pdfBase64) {
        try {
          blob = new Blob([base64ToU8(f.pdfBase64)], { type: 'application/pdf' });
        } catch (e) { /* ignore */ }
      }
      filesToSave.push({
        id: f.id,
        name: f.name || (existing && existing.name) || 'document.pdf',
        size: Number(f.size) || (existing && existing.size) || 0,
        lastModified: Number(f.lastModified) || Date.now(),
        pageCount: Number(f.pageCount) || (existing && existing.pageCount) || 0,
        blob: blob,
        addedAt: Number(f.addedAt) || Date.now(),
        lastOpenedAt: Number(f.lastOpenedAt) || Date.now(),
        lastPage: Math.max(1, Number(f.lastPage) || 1),
        lastZoom: Number(f.lastZoom) || 1,
        zoomMode: f.zoomMode || 'fit-width',
        nightMode: !!f.nightMode
      });
    }

    var tx = db.transaction([ST_FILES, ST_ANNS, ST_NOTES, ST_MARKS], 'readwrite');
    var sf = tx.objectStore(ST_FILES);
    filesToSave.forEach(function (rec) { sf.put(rec); });

    var sa = tx.objectStore(ST_ANNS);
    (Array.isArray(data.annotations) ? data.annotations : []).forEach(function (a) {
      if (a && a.id && a.fileId && a.page >= 1) sa.put(a);
    });

    var sn = tx.objectStore(ST_NOTES);
    (Array.isArray(data.notes) ? data.notes : []).forEach(function (n) {
      if (n && n.id && n.fileId && n.page >= 1 && n.content) sn.put(n);
    });

    var sm = tx.objectStore(ST_MARKS);
    (Array.isArray(data.bookmarks) ? data.bookmarks : []).forEach(function (m) {
      if (m && m.id && m.fileId && m.page >= 1) sm.put(m);
    });

    await txDone(tx);
    return {
      files: filesToSave.length,
      annotations: Array.isArray(data.annotations) ? data.annotations.length : 0,
      notes: Array.isArray(data.notes) ? data.notes.length : 0,
      bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks.length : 0
    };
  }

  root.ReaderStore = {
    getFile: function (id) { return getOne(ST_FILES, id); },
    getFileBytes: getFileBytes,
    saveOrUpdateFile: saveOrUpdateFile,
    updateFileState: updateFileState,
    listRecentFiles: listRecentFiles,
    deleteFileAndData: deleteFileAndData,
    getFileBundle: getFileBundle,
    saveAnnotation: saveAnnotation,
    deleteAnnotation: deleteAnnotation,
    savePageNote: savePageNote,
    saveBookmark: saveBookmark,
    deleteBookmark: deleteBookmark,
    getMeta: getMeta,
    setMeta: setMeta,
    exportBackup: exportBackup,
    importBackup: importBackup
  };
})(window);
