/* ==========================================================================
   chat-data.js — تجهيز المحاضرات للبحث (مرة واحدة) وتخزين الفهارس محلياً
   المصادر: نص المحاضرة (lectures.json أو CONTENT داخل index.html) + ملف PDF إن وُجد.
   لتحديث فهرس محاضرة بعد تعديل ملف PDF: غيّر CHAT_DATA_REV أدناه (أو اسم الملف).
   ========================================================================== */
(function (root) {
  'use strict';
  var E = root.ChatEngine, S = root.ChatStore;
  var CHAT_DATA_REV = 1;
  var memScopes = {}, lecJson = null, pdfTried = {};

  function loadLecJson() {
    if (lecJson) return lecJson;
    lecJson = fetch('lectures.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('x'); return r.json(); })
      .catch(function () { return fetch('lectures.json').then(function (r) { return r.json(); }).catch(function () { return []; }); })
      .then(function (a) { var m = {}; (Array.isArray(a) ? a : []).forEach(function (e) { if (e && e.id) m[e.id] = e; }); return m; });
    return lecJson;
  }

  function content() { return root.CONTENT || {}; }
  function allKeys(subject) {
    var set = {};
    Object.keys(content()).forEach(function (k) { if (k.indexOf(subject + '-') === 0) set[k] = 1; });
    return loadLecJson().then(function (m) {
      Object.keys(m).forEach(function (k) { if (k.indexOf(subject + '-') === 0) set[k] = 1; });
      return Object.keys(set).sort(function (a, b) { return parseInt(a.split('-')[1], 10) - parseInt(b.split('-')[1], 10); });
    });
  }

  function pdfUrlFor(key) {
    var c = content()[key], p = key.split('-');
    return (c && c.pdf) || (typeof root.pdfUrl === 'function' ? root.pdfUrl(+p[0] - 1, +p[1]) : key + '.pdf');
  }

  function titleOf(key, entry) { return (entry && entry.title) || ('محاضرة ' + key.split('-')[1]); }

  function sourceSections(key) {
    return loadLecJson().then(function (m) {
      var ent = m[key], c = content()[key], secs = [];
      if (ent && ent.content) secs = E.parseMarkdown(ent.content);
      if (!secs.length && c && c.lesson) secs = E.parseLesson(c.lesson);
      return { sections: secs, title: titleOf(key, ent) };
    });
  }

  function words(t) { var o = {}, n = 0; E.norm(t).split(' ').forEach(function (w) { if (w.length > 2) { o[w] = 1; n++; } }); return { set: o, n: n }; }
  function dupOf(a, list) {
    for (var i = 0; i < list.length; i++) {
      var b = list[i], inter = 0;
      for (var k in a.set) if (b.set[k]) inter++;
      var min = Math.min(a.n, b.n) || 1;
      if (inter / min >= 0.85 && inter / (a.n + b.n - inter) >= 0.6) return true;
    }
    return false;
  }

  function fetchPdf(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('missing');
      var ct = (r.headers.get('content-type') || '').toLowerCase();
      return r.arrayBuffer().then(function (buf) {
        var head = new Uint8Array(buf.slice(0, 5)), isPdf = String.fromCharCode.apply(null, head).indexOf('%PDF') === 0;
        if (!isPdf && ct.indexOf('pdf') === -1) throw new Error('notpdf');
        return buf;
      });
    });
  }

  function prepare(key, onStatus) {
    var say = onStatus || function () {};
    return Promise.all([sourceSections(key), S.getDoc(key)]).then(function (arr) {
      var src = arr[0], rec = arr[1];
      var srcText = JSON.stringify(src.sections);
      var srcHash = E.hashStr(srcText + '|' + CHAT_DATA_REV + '|' + E.VERSION);
      var fresh = rec && rec.srcHash === srcHash && rec.prep && rec.prep.v === E.VERSION;
      var retry = !fresh || (rec.pdf && (rec.pdf.status === 'error') && !pdfTried[key] && navigator.onLine !== false);
      if (fresh && !retry) return { doc: rec.prep, pdf: rec.pdf };
      var url = pdfUrlFor(key);
      pdfTried[key] = 1;
      say('جارٍ تجهيز ' + src.title + '…');
      var pdfInfo = { status: 'missing' }, pdfSecs = [];
      var step = (navigator.onLine === false && !(rec && rec.pdf)) ? Promise.resolve() :
        fetchPdf(url).then(function (buf) {
          if (!root.ChatPDF) throw new Error('nolib');
          say('جارٍ قراءة ملف PDF…');
          return root.ChatPDF.extract(buf, function (d, n) { say('قراءة الصفحة ' + d + ' من ' + n + '…'); }).then(function (res) {
            pdfInfo = { status: res.scanned ? 'scanned' : (res.chars ? 'ok' : 'empty'), pages: res.pages, chars: res.chars, size: buf.byteLength };
            if (!res.scanned && res.chars) pdfSecs = E.parsePlainText(res.text);
          });
        }).catch(function (e) {
          pdfInfo = { status: (e && (e.message === 'missing' || e.message === 'notpdf')) ? 'missing' : 'error' };
          if (navigator.onLine === false && rec && rec.pdf && rec.pdf.status === 'ok' && rec.prep) { pdfInfo = rec.pdf; }
        });
      return step.then(function () {
        /* offline مع نسخة سابقة صالحة: لا نستبدلها بنسخة أفقر */
        if (rec && rec.prep && pdfInfo.status === 'error' && rec.pdf && rec.pdf.status === 'ok') return { doc: rec.prep, pdf: rec.pdf };
        var sections = src.sections.slice();
        var seen = [];
        sections.forEach(function (s) { s.items.forEach(function (it) { seen.push(words(it.text)); }); });
        pdfSecs.forEach(function (s) {
          var items = s.items.filter(function (it) { var w = words(it.text); if (w.n < 3) return false; if (dupOf(w, seen)) return false; seen.push(w); return true; });
          if (items.length) sections.push({ heading: s.heading, items: items });
        });
        if (!sections.length) { return { doc: null, pdf: pdfInfo }; }
        var doc = E.prepareDoc({ id: key, title: src.title, sections: sections });
        var out = { key: key, srcHash: srcHash, prep: doc, pdf: pdfInfo, ts: Date.now() };
        return S.putDoc(out).then(function () { return { doc: doc, pdf: pdfInfo }; });
      });
    });
  }

  /* kind: 'lecture' (id = "1-2") | 'subject' (id = "1") */
  function scopeFor(kind, id, onStatus) {
    var keysP = kind === 'lecture' ? Promise.resolve([id]) : allKeys(id);
    return keysP.then(function (keys) {
      return keys.reduce(function (chain, k) {
        return chain.then(function (acc) { return prepare(k, onStatus).then(function (r) { acc.push(r); return acc; }); });
      }, Promise.resolve([])).then(function (res) {
        var docs = res.filter(function (r) { return r.doc; }).map(function (r) { return r.doc; });
        var sig = docs.map(function (d) { return d.id + ':' + d.hash; }).join('|');
        var ck = kind + ':' + id;
        if (memScopes[ck] && memScopes[ck].sig === sig) return { scope: memScopes[ck].scope, info: infoOf(res, keys) };
        var scope = E.buildScope(docs);
        memScopes[ck] = { sig: sig, scope: scope };
        return { scope: scope, info: infoOf(res, keys) };
      });
    });
  }

  function infoOf(res, keys) {
    var scanned = res.filter(function (r) { return r.pdf && r.pdf.status === 'scanned'; }).length;
    var withPdf = res.filter(function (r) { return r.pdf && r.pdf.status === 'ok'; }).length;
    return { lectures: res.filter(function (r) { return r.doc; }).length, requested: keys.length, scanned: scanned, withPdf: withPdf };
  }

  root.ChatData = { scopeFor: scopeFor, prepare: prepare, allKeys: allKeys, pdfUrlFor: pdfUrlFor };
})(window);
