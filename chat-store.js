/* ==========================================================================
   chat-store.js — التخزين المحلي (IndexedDB): المحادثات، الرسائل، فهارس المحاضرات
   لا يُرسَل أي شيء إلى خادم خارجي. إن تعذّر IndexedDB (وضع خاص) يعمل بالذاكرة فقط.
   ========================================================================== */
(function (root) {
  'use strict';
  var DB_NAME = 'edu-chat', DB_VER = 1, db = null, mem = { convs: {}, msgs: {}, docs: {} }, useMem = false, opening = null;

  function open() {
    if (db || useMem) return Promise.resolve(db);
    if (opening) return opening;
    opening = new Promise(function (res) {
      if (!root.indexedDB) { useMem = true; return res(null); }
      var rq;
      try { rq = root.indexedDB.open(DB_NAME, DB_VER); } catch (e) { useMem = true; return res(null); }
      rq.onupgradeneeded = function () {
        var d = rq.result;
        if (!d.objectStoreNames.contains('convs')) { var c = d.createObjectStore('convs', { keyPath: 'id' }); c.createIndex('scope', 'scope'); }
        if (!d.objectStoreNames.contains('msgs')) { var m = d.createObjectStore('msgs', { keyPath: 'id' }); m.createIndex('conv', 'conv'); }
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'key' });
      };
      rq.onsuccess = function () { db = rq.result; db.onversionchange = function () { db.close(); db = null; opening = null; }; res(db); };
      rq.onerror = rq.onblocked = function () { useMem = true; res(null); };
    });
    return opening;
  }

  function tx(store, mode, fn) {
    return open().then(function (d) {
      if (!d) return null;
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out;
        try { out = fn(t.objectStore(store)); } catch (e) { rej(e); return; }
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  var Store = {
    uid: uid,
    isPersistent: function () { return open().then(function (d) { return !!d; }); },

    putConv: function (c) {
      return open().then(function (d) { if (!d) { mem.convs[c.id] = c; return c; } return tx('convs', 'readwrite', function (s) { s.put(c); }).then(function () { return c; }); });
    },
    getConv: function (id) {
      return open().then(function (d) { if (!d) return mem.convs[id] || null; return new Promise(function (res, rej) { var r = d.transaction('convs').objectStore('convs').get(id); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { rej(r.error); }; }); });
    },
    listConvs: function (scope) {
      return open().then(function (d) {
        if (!d) return Object.keys(mem.convs).map(function (k) { return mem.convs[k]; }).filter(function (c) { return c.scope === scope; });
        return new Promise(function (res, rej) { var r = d.transaction('convs').objectStore('convs').index('scope').getAll(scope); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { rej(r.error); }; });
      });
    },
    deleteConv: function (id) {
      return open().then(function (d) {
        if (!d) { delete mem.convs[id]; Object.keys(mem.msgs).forEach(function (k) { if (mem.msgs[k].conv === id) delete mem.msgs[k]; }); return; }
        return new Promise(function (res, rej) {
          var t = d.transaction(['convs', 'msgs'], 'readwrite');
          t.objectStore('convs').delete(id);
          var cur = t.objectStore('msgs').index('conv').openKeyCursor(IDBKeyRange.only(id));
          cur.onsuccess = function () { var c = cur.result; if (c) { t.objectStore('msgs').delete(c.primaryKey); c.continue(); } };
          t.oncomplete = function () { res(); }; t.onerror = t.onabort = function () { rej(t.error); };
        });
      });
    },
    putMsg: function (m) {
      return open().then(function (d) { if (!d) { mem.msgs[m.id] = m; return m; } return tx('msgs', 'readwrite', function (s) { s.put(m); }).then(function () { return m; }); });
    },
    listMsgs: function (convId) {
      return open().then(function (d) {
        var arr;
        if (!d) arr = Object.keys(mem.msgs).map(function (k) { return mem.msgs[k]; }).filter(function (m) { return m.conv === convId; });
        else return new Promise(function (res, rej) { var r = d.transaction('msgs').objectStore('msgs').index('conv').getAll(convId); r.onsuccess = function () { res((r.result || []).sort(function (a, b) { return a.ts - b.ts || (a.seq || 0) - (b.seq || 0); })); }; r.onerror = function () { rej(r.error); }; });
        return arr.sort(function (a, b) { return a.ts - b.ts || (a.seq || 0) - (b.seq || 0); });
      });
    },
    putDoc: function (rec) {
      return open().then(function (d) { if (!d) { mem.docs[rec.key] = rec; return rec; } return tx('docs', 'readwrite', function (s) { s.put(rec); }).then(function () { return rec; }); });
    },
    getDoc: function (key) {
      return open().then(function (d) { if (!d) return mem.docs[key] || null; return new Promise(function (res, rej) { var r = d.transaction('docs').objectStore('docs').get(key); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { rej(r.error); }; }); });
    }
  };
  root.ChatStore = Store;
})(window);
