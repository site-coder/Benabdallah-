/* ==========================================================================
   research-core.js — نواة أداة «إنشاء بحث جامعي»
   - أدوات عامة + قاعدة IndexedDB + نموذج البيانات + تنظيف HTML
   - محلّل أماكن الصور (قواعد برمجية بلا ذكاء اصطناعي) + تنسيق المراجع
   - كل شيء يعمل محلياً بلا إنترنت. الأسماء كلها داخل window.RS
   ========================================================================== */
(function () {
  'use strict';
  var RS = window.RS = window.RS || {};

  /* ---------------------------------------------------------------- أدوات */
  var U = RS.u = {};
  U.esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  U.uid = function () { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  U.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  U.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  U.fmtDate = function (t) { try { return new Date(t).toLocaleDateString('ar-DZ-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  U.fmtDT = function (t) { var d = new Date(t); return U.fmtDate(t) + ' ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };
  U.debounce = function (fn, ms) { var t = 0; var f = function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; f.flush = function () { clearTimeout(t); }; return f; };
  /* تطبيع عربي للمقارنة: حذف التشكيل، توحيد الألف والياء والتاء المربوطة والأرقام */
  U.norm = function (s) {
    return String(s || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; });
  };
  U.hasArabic = function (s) { return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s || ''); };
  U.download = function (blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  };
  U.safeName = function (s) { return String(s || 'بحث').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'بحث'; };
  U.indic = function (n) { return String(n).replace(/\d/g, function (d) { return String.fromCharCode(1632 + +d); }); };
  U.textOf = function (html) {
    var d = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    return (d.body.textContent || '');
  };
  U.countWords = function (txt) { var m = String(txt || '').replace(/\u200b/g, ' ').trim().match(/\S+/g); return m ? m.length : 0; };
  U.countChars = function (txt) { return String(txt || '').replace(/\s+/g, '').length; };

  /* -------------------------------------------------- قاعدة البيانات IndexedDB */
  RS.db = (function () {
    var dbp = null, mem = { papers: {}, images: {}, snaps: {}, tpls: {} }, volatile = false;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error('no-idb')); return; }
        var r;
        try { r = indexedDB.open('edu_research_v1', 1); } catch (e) { rej(e); return; }
        r.onupgradeneeded = function () {
          var d = r.result;
          ['papers', 'images', 'snaps', 'tpls'].forEach(function (n) {
            if (!d.objectStoreNames.contains(n)) {
              var s = d.createObjectStore(n, { keyPath: 'id' });
              if (n === 'images' || n === 'snaps') s.createIndex('paperId', 'paperId', { unique: false });
            }
          });
        };
        r.onsuccess = function () { var d = r.result; d.onversionchange = function () { d.close(); }; res(d); };
        r.onerror = function () { rej(r.error || new Error('idb')); };
        r.onblocked = function () { rej(new Error('blocked')); };
      }).catch(function () { volatile = true; return null; });
      return dbp;
    }
    function run(store, mode, fn) {
      return open().then(function (d) {
        if (!d) return fn(null);
        return new Promise(function (res, rej) {
          var tx = d.transaction(store, mode), st = tx.objectStore(store), out;
          try { out = fn(st); } catch (e) { rej(e); return; }
          tx.oncomplete = function () { res(out && out.__req ? out.__req.result : out); };
          tx.onerror = function () { rej(tx.error || new Error('tx')); };
          tx.onabort = function () { rej(tx.error || new Error('abort')); };
        });
      });
    }
    function wrap(req) { return { __req: req }; }
    var api = {
      isVolatile: function () { return volatile; },
      ready: function () { return open().then(function () { return !volatile; }); },
      get: function (s, id) { return run(s, 'readonly', function (st) { return st ? wrap(st.get(id)) : mem[s][id]; }); },
      put: function (s, o) { return run(s, 'readwrite', function (st) { if (!st) { mem[s][o.id] = U.clone(o); return o; } st.put(o); return o; }); },
      del: function (s, id) { return run(s, 'readwrite', function (st) { if (!st) { delete mem[s][id]; return; } st.delete(id); }); },
      all: function (s) { return run(s, 'readonly', function (st) { return st ? wrap(st.getAll()) : Object.keys(mem[s]).map(function (k) { return mem[s][k]; }); }); },
      byPaper: function (s, pid) {
        return run(s, 'readonly', function (st) {
          if (!st) return Object.keys(mem[s]).map(function (k) { return mem[s][k]; }).filter(function (o) { return o.paperId === pid; });
          return wrap(st.index('paperId').getAll(pid));
        });
      },
      delPaper: function (pid) {
        return Promise.all([api.byPaper('images', pid), api.byPaper('snaps', pid)]).then(function (r) {
          var jobs = [api.del('papers', pid)];
          r[0].forEach(function (o) { jobs.push(api.del('images', o.id)); });
          r[1].forEach(function (o) { jobs.push(api.del('snaps', o.id)); });
          return Promise.all(jobs);
        });
      }
    };
    return api;
  })();

  /* ---------------------------------------------------------- النموذج */
  var M = RS.model = {};
  M.TYPES = [
    { k: 'chapter', n: 'فصل', pre: 'الفصل' }, { k: 'mabhath', n: 'مبحث', pre: 'المبحث' }, { k: 'matlab', n: 'مطلب', pre: 'المطلب' },
    { k: 'far', n: 'فرع', pre: 'الفرع' }, { k: 'band', n: 'بند', pre: 'البند' }, { k: 'qism', n: 'قسم', pre: 'القسم' }, { k: 'head', n: 'عنوان بلا ترقيم', pre: '' }
  ];
  M.typeOf = function (k) { for (var i = 0; i < M.TYPES.length; i++) if (M.TYPES[i].k === k) return M.TYPES[i]; return M.TYPES[5]; };
  M.nextType = function (k) { var o = ['chapter', 'mabhath', 'matlab', 'far', 'band']; var i = o.indexOf(k); return i >= 0 && i < o.length - 1 ? o[i + 1] : 'qism'; };
  var ORDW = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون'];
  M.ordWord = function (n) { return ORDW[n] || String(n); };

  M.defaultSettings = function () {
    return {
      paper: 'A4', orient: 'portrait', font: 'Traditional Arabic', fs: 16, h1: 20, h2: 18, h3: 17, h4: 16,
      lh: 1.5, pgap: 6, align: 'justify', mt: 2.5, mb: 2.5, ml: 2.5, mr: 2.5, color: '#000000', indent: 0,
      numOn: true, numPos: 'bottom-center', numStyle: 'latin', numStart: 1, numCover: false,
      header: '', footer: '', hdrTitle: false, chapNewPage: true,
      planTitle: 'خطة البحث', introTitle: 'مقدمة', conclTitle: 'خاتمة', refsTitle: 'قائمة المصادر والمراجع', tocTitle: 'الفهرس', groupRefs: false
    };
  };
  M.PAPERS = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4] };
  M.pageMM = function (st) { var p = M.PAPERS[st.paper] || M.PAPERS.A4; return st.orient === 'landscape' ? [p[1], p[0]] : [p[0], p[1]]; };

  M.newSection = function (type, title, html) { return { id: U.uid(), type: type || 'qism', title: title || '', html: html || '', children: [] }; };
  M.newPaper = function (o) {
    o = o || {}; var t = Date.now();
    var meta = U.clone(o.meta || {});
    var p = {
      v: 1, id: U.uid(), title: o.title || meta.title || 'بحث جديد', status: 'draft', created: t, modified: t,
      meta: { title: meta.title || o.title || '', major: '', level: '', group: '', year: '', university: '', faculty: '', dept: '', students: [], supervisor: '', extra: [] },
      cover: null, intro: { html: '' }, concl: { html: '' }, body: [], figs: [], refs: [], cite: 'apa',
      toc: { on: false, tables: false, figs: false }, settings: M.defaultSettings(), tplName: o.tplName || ''
    };
    for (var k in meta) p.meta[k] = meta[k];
    if (o.structure) p.body = M.buildStructure(o.structure);
    if (o.settings) for (var s in o.settings) p.settings[s] = o.settings[s];
    return p;
  };
  /* بناء هيكل من وصف مختصر: [{t:'chapter',title:'',c:[...]}] */
  M.buildStructure = function (arr) {
    return (arr || []).map(function (x) { var s = M.newSection(x.t, x.title || '', ''); s.children = M.buildStructure(x.c); return s; });
  };
  M.TEMPLATES = [
    { id: 'plain', name: 'بحث جامعي عادي', desc: 'فصلان، لكل فصل مبحثان',
      structure: [{ t: 'chapter', c: [{ t: 'mabhath' }, { t: 'mabhath' }] }, { t: 'chapter', c: [{ t: 'mabhath' }, { t: 'mabhath' }] }] },
    { id: 'thesis', name: 'مذكرة تخرج', desc: 'إطار منهجي ثم فصل نظري وفصل تطبيقي',
      structure: [{ t: 'chapter', title: 'الإطار المنهجي للدراسة', c: [{ t: 'mabhath' }, { t: 'mabhath' }] }, { t: 'chapter', title: 'الجانب النظري', c: [{ t: 'mabhath', c: [{ t: 'matlab' }, { t: 'matlab' }] }, { t: 'mabhath', c: [{ t: 'matlab' }, { t: 'matlab' }] }] }, { t: 'chapter', title: 'الجانب التطبيقي', c: [{ t: 'mabhath' }, { t: 'mabhath' }] }] },
    { id: 'science', name: 'بحث علمي', desc: 'أقسام: المنهجية، النتائج، المناقشة',
      structure: [{ t: 'qism', title: 'المنهجية' }, { t: 'qism', title: 'النتائج' }, { t: 'qism', title: 'المناقشة' }] },
    { id: 'report', name: 'تقرير جامعي', desc: 'أقسام مرقّمة بسيطة بلا فصول',
      structure: [{ t: 'qism' }, { t: 'qism' }, { t: 'qism' }] },
    { id: 'blank', name: 'بحث فارغ', desc: 'بلا أقسام، ابنِ الهيكل بنفسك', structure: [] }
  ];

  M.walk = function (arr, fn, parent, depth) {
    depth = depth || 0;
    for (var i = 0; i < arr.length; i++) { if (fn(arr[i], parent, i, arr, depth) === false) return false; if (arr[i].children && M.walk(arr[i].children, fn, arr[i], depth + 1) === false) return false; }
  };
  M.findSec = function (paper, id) {
    var r = null;
    M.walk(paper.body, function (s, par, i, arr) { if (s.id === id) { r = { sec: s, parent: par, arr: arr, idx: i }; return false; } });
    return r;
  };
  /* ترقيم الأقسام: الفصل الأول، المبحث الثاني ... (يُعاد الترقيم تحت كل أب) */
  M.numberTree = function (paper) {
    var map = {}, flat = [];
    (function rec(arr, path, depth) {
      var cnt = {};
      arr.forEach(function (s) {
        cnt[s.type] = (cnt[s.type] || 0) + 1;
        var ty = M.typeOf(s.type), ord = cnt[s.type];
        var label = ty.pre ? ty.pre + ' ' + M.ordWord(ord) : '';
        var full = label ? (s.title ? label + ': ' + s.title : label) : (s.title || '');
        var rec_ = { id: s.id, type: s.type, ord: ord, label: label, text: full || 'قسم بلا عنوان', depth: depth, path: path.concat(s.id), sec: s };
        map[s.id] = rec_; flat.push(rec_);
        rec(s.children || [], rec_.path, depth + 1);
      });
    })(paper.body, [], 0);
    return { map: map, flat: flat };
  };
  M.headingFont = function (st, type, depth) {
    if (type === 'chapter') return st.h1; if (type === 'mabhath') return st.h2; if (type === 'matlab') return st.h3; return st.h4;
  };
  M.allHtmlHolders = function (paper) { var a = [paper.intro, paper.concl]; M.walk(paper.body, function (s) { a.push(s); }); return a; };
  M.paperStats = function (paper) {
    var tw = 0, tc = 0, per = [];
    function one(name, html, id) { var t = U.textOf(html); var w = U.countWords(t), c = U.countChars(t); tw += w; tc += c; per.push({ id: id, name: name, words: w, chars: c, empty: !t.trim() && !/<table|<img/i.test(html || '') }); }
    one('المقدمة', paper.intro.html, 'intro');
    M.numberTree(paper).flat.forEach(function (r) { one(r.text, r.sec.html, r.id); });
    one('الخاتمة', paper.concl.html, 'concl');
    return { words: tw, chars: tc, per: per };
  };

  /* --------------------------------------------------- تنظيف HTML (آمن) */
  var H = RS.html = {};
  var OKTAG = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, SPAN: 1, A: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1, SUP: 1, SUB: 1, DIV: 1 };
  var MAPTAG = { H1: 'h4', H2: 'h4', H3: 'h4', DIV: 'p', STRONG: 'b', EM: 'i', STRIKE: 's', FONT: 'span', MARK: 'span' };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, MATH: 1, IMG: 1, VIDEO: 1, AUDIO: 1, CANVAS: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, LINK: 1, META: 1, HEAD: 1, TITLE: 1 };
  function cleanStyle(st) {
    var out = [];
    String(st || '').split(';').forEach(function (d) {
      var i = d.indexOf(':'); if (i < 1) return;
      var k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim();
      if (/url\(|expression|javascript|@import|[<>{}\\]/i.test(v)) return;
      if (k === 'color' || k === 'background-color') { if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20}|transparent)$/i.test(v)) out.push(k + ':' + v); }
      else if (k === 'font-family') { if (/^[\w\s,"'\-\u0600-\u06FF]+$/.test(v)) out.push(k + ':' + v.replace(/"/g, "'")); }
      else if (k === 'font-size') { if (/^[\d.]+(pt|px|em|%)$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'font-weight') { if (/^(bold|normal|[1-9]00)$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'font-style') { if (/^(italic|normal)$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'text-decoration' || k === 'text-decoration-line') { if (/^(underline|line-through|none)( (underline|line-through))?$/.test(v)) out.push('text-decoration:' + v); }
      else if (k === 'text-align') { if (/^(right|left|center|justify)$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'line-height') { if (/^[\d.]+(pt|px|em|%)?$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'margin-top' || k === 'margin-bottom' || k === 'text-indent') { if (/^-?[\d.]+(pt|px|em|cm)?$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'width') { if (/^[\d.]+(px|%|pt|cm)$/.test(v)) out.push(k + ':' + v); }
      else if (k === 'vertical-align') { if (/^(top|middle|bottom|sub|super)$/.test(v)) out.push(k + ':' + v); }
    });
    return out.join(';');
  }
  function cleanNode(n, out) {
    if (n.nodeType === 3) { out.push(U.esc(n.nodeValue.replace(/\u00a0/g, ' ').replace(/\u200b/g, ''))); return; }
    if (n.nodeType !== 1) return;
    var tag = n.tagName.toUpperCase();
    if (DROP[tag]) return;
    if (n.getAttribute && n.getAttribute('data-pgbrk') != null) { out.push('<div data-pgbrk="1" class="rs-pgbrk"></div>'); return; }
    if (tag === 'SPAN' && n.classList.contains('rs-cite') && n.getAttribute('data-ref')) {
      out.push('<span class="rs-cite" data-ref="' + U.esc(n.getAttribute('data-ref')) + '"' + (n.getAttribute('data-page') ? ' data-page="' + U.esc(n.getAttribute('data-page')) + '"' : '') + '>' + U.esc(n.textContent) + '</span>'); return;
    }
    if (tag === 'FIGURE' && n.hasAttribute('data-fig')) return; /* الصور المُدرجة تُحفظ خارج النص */
    var t = MAPTAG[tag] || tag.toLowerCase();
    var ok = OKTAG[tag] || MAPTAG[tag];
    if (!ok) { for (var c = n.firstChild; c; c = c.nextSibling) cleanNode(c, out); return; }
    var attrs = '';
    var st = cleanStyle(n.getAttribute('style'));
    if (tag === 'FONT') { var fc = n.getAttribute('color'); if (fc && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(fc)) st = ('color:' + fc + ';' + st).replace(/;$/, ''); var ff = n.getAttribute('face'); if (ff && /^[\w\s,\-\u0600-\u06FF]+$/.test(ff)) st = ('font-family:' + ff + ';' + st).replace(/;$/, ''); }
    if (tag === 'MARK') st = ('background-color:#ffeb3b;' + st).replace(/;$/, '');
    if (st) attrs += ' style="' + U.esc(st) + '"';
    var dir = n.getAttribute && n.getAttribute('dir'); if ((dir === 'ltr' || dir === 'rtl') && /^(p|h4|h5|h6|li|blockquote|td|th|ul|ol)$/.test(t)) attrs += ' dir="' + dir + '"';
    if (t === 'a') { var h = n.getAttribute('href') || ''; if (/^(https?:|mailto:|tel:)/i.test(h)) attrs += ' href="' + U.esc(h) + '"'; else { for (var c0 = n.firstChild; c0; c0 = c0.nextSibling) cleanNode(c0, out); return; } }
    if (t === 'td' || t === 'th') { var cs = parseInt(n.getAttribute('colspan'), 10), rs = parseInt(n.getAttribute('rowspan'), 10); if (cs > 1 && cs < 50) attrs += ' colspan="' + cs + '"'; if (rs > 1 && rs < 200) attrs += ' rowspan="' + rs + '"'; }
    if (t === 'ol') { var sa = parseInt(n.getAttribute('start'), 10); if (sa > 1 && sa < 10000) attrs += ' start="' + sa + '"'; }
    if (t === 'table') { var b = n.getAttribute('data-b'); attrs += ' data-b="' + (b === '0' || b === '2' ? b : '1') + '"'; if (n.getAttribute('data-fixed') === '1') attrs += ' data-fixed="1"'; if (n.getAttribute('data-nohead') === '1') attrs += ' data-nohead="1"'; }
    if (t === 'br') { out.push('<br>'); return; }
    out.push('<' + t + attrs + '>');
    for (var c2 = n.firstChild; c2; c2 = c2.nextSibling) cleanNode(c2, out);
    out.push('</' + t + '>');
  }
  /* يحوّل أي HTML إلى هيكل آمن مكوّن من كتل على المستوى الأعلى فقط (p, h4-6, ul, ol, table, blockquote, فاصل) */
  H.clean = function (html) {
    var d;
    try { d = new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + (html || '') + '</body></html>', 'text/html'); } catch (e) { return ''; }
    var out = []; cleanNode(d.body, out);
    var s = out.join('');
    /* الأن نغلّف أي نص/عناصر مضمّنة على المستوى الأعلى داخل <p> */
    var d2 = new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + s + '</body></html>', 'text/html');
    var blocks = [], run = [];
    var BLK = { P: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, BLOCKQUOTE: 1, TABLE: 1 };
    function flush() {
      if (!run.length) return;
      var tmp = d2.createElement('p'); run.forEach(function (x) { tmp.appendChild(x); });
      if (tmp.textContent.trim() || tmp.querySelector('.rs-cite')) blocks.push(tmp.outerHTML);
      run = [];
    }
    var kids = Array.prototype.slice.call(d2.body.childNodes);
    kids.forEach(function (n) {
      if (n.nodeType === 1 && (BLK[n.tagName] || n.hasAttribute('data-pgbrk'))) { flush(); blocks.push(n.outerHTML); }
      else if (n.nodeType === 1 && n.tagName === 'BR') { flush(); }
      else run.push(n);
    });
    flush();
    return blocks.join('');
  };
  /* كتل المستوى الأعلى كعناصر DOM (في المستند الحالي) */
  H.blocks = function (html) {
    var d = new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + (html || '') + '</body></html>', 'text/html');
    return Array.prototype.slice.call(d.body.children).map(function (e) { return document.importNode(e, true); });
  };
  H.isPara = function (el) { return el.nodeType === 1 && /^(P|H4|H5|H6|UL|OL|BLOCKQUOTE)$/.test(el.tagName) && (el.textContent.trim() !== '' || !!el.querySelector('.rs-cite')); };
  H.paraCount = function (html) { return H.blocks(html).filter(H.isPara).length; };
  H.firstWords = function (el, n) { var w = (el.textContent || '').trim().split(/\s+/).slice(0, n || 6).join(' '); return w; };

  /* ----------------------------------------------- محلّل مواضع الصور (قواعد) */
  var ORDN = { 'اول': 1, 'اولي': 1, 'ثاني': 2, 'ثانيه': 2, 'ثالث': 3, 'ثالثه': 3, 'رابع': 4, 'رابعه': 4, 'خامس': 5, 'خامسه': 5, 'سادس': 6, 'سادسه': 6, 'سابع': 7, 'سابعه': 7, 'ثامن': 8, 'ثامنه': 8, 'تاسع': 9, 'تاسعه': 9, 'عاشر': 10, 'عاشره': 10, 'حادي': 11 };
  var LVL = { 'فصل': 'chapter', 'مبحث': 'mabhath', 'مطلب': 'matlab', 'فرع': 'far', 'بند': 'band', 'قسم': 'qism' };
  function tokens(text) {
    var s = U.norm(text).replace(/[،,.؛;:()\-–—«»"'/\\|]/g, ' ').replace(/\s+/g, ' ').trim();
    return s ? s.split(' ') : [];
  }
  function stemTok(t) {
    if (/^\d+$/.test(t)) return t;
    var r = t.replace(/^(وال|بال|فال|ال)/, '');
    if (r === t && /^و/.test(t) && t.length > 3) r = t.slice(1);
    return r;
  }
  function ordAt(tk, i) {
    var t = tk[i]; if (t == null) return null;
    if (/^\d{1,3}$/.test(t)) return { n: parseInt(t, 10), len: 1 };
    if (t === 'اخير' || t === 'اخيره') return { n: -1, len: 1 };
    var b = ORDN[t]; if (!b) return null;
    var nx = tk[i + 1];
    if (nx === 'عشر' || nx === 'عشره') return { n: b === 11 ? 11 : b + 10, len: 2 };
    if (b === 11) return null;
    return { n: b, len: 1 };
  }
  /* الإخراج: {ok:true, sectionId, mode, n} أو {ok:false, msg} */
  RS.place = {};
  RS.place.parse = function (paper, text) {
    var tk = tokens(text).map(stemTok);
    if (!tk.length) return { ok: false, msg: 'اكتب وصف المكان أو اختره من القوائم.' };
    var path = [], special = null, mode = null, n = 0, i;
    for (i = 0; i < tk.length; i++) {
      var t = tk[i];
      if (LVL[t]) { var o = ordAt(tk, i + 1); if (o && o.n > 0) { path.push({ type: LVL[t], n: o.n }); i += o.len; } else { return { ok: false, msg: 'لم أفهم رقم «' + t + '». اكتب مثلاً: ' + t + ' الأول.' }; } continue; }
      if (t === 'مقدمه') { special = 'intro'; continue; }
      if (t === 'خاتمه' && !(tk[i - 1] === 'نهايه' || tk[i - 1] === 'اخر')) { special = 'concl'; continue; }
      if ((t === 'بعد' || t === 'قبل') && (tk[i + 1] === 'فقره' || tk[i + 1] === 'الفقره')) {
        var o2 = ordAt(tk, i + 2);
        if (!o2) return { ok: false, msg: 'حدّد رقم الفقرة (مثل: بعد الفقرة الثانية).' };
        if (o2.n === -1) { mode = 'end'; } else { mode = t === 'بعد' ? 'afterPara' : 'beforePara'; n = o2.n; }
        i += 1 + o2.len; continue;
      }
      if (t === 'بعد' && (tk[i + 1] === 'عنوان' || tk[i + 1] === 'العنوان')) { mode = 'afterTitle'; i++; continue; }
      if (t === 'تحت' && tk[i + 1] === 'عنوان') { mode = 'afterTitle'; i++; continue; }
      if (t === 'عنوان' && tk[i - 1] === 'بعد') { mode = 'afterTitle'; continue; }
      if (t === 'بدايه' || t === 'مطلع') { if (!mode) mode = 'start'; continue; }
      if (t === 'نهايه' || t === 'اخر' || t === 'ختام') { if (!mode) mode = 'end'; continue; }
    }
    if (!path.length && !special) return { ok: false, msg: 'لم يتحدد القسم في الوصف. اختر الفصل/المبحث/المطلب من القوائم.' };
    if (!mode) return { ok: false, msg: 'لم يتحدد الموضع داخل القسم (مثل: بعد الفقرة الثانية، في بداية، في نهاية). اختره من القوائم.' };
    var secId = null;
    if (special) secId = special;
    else {
      var nt = M.numberTree(paper), cands = [];
      nt.flat.forEach(function (r) {
        var last = path[path.length - 1];
        if (r.type !== last.type || r.ord !== last.n) return;
        var ok = true, pi = path.length - 2;
        for (var k = r.path.length - 2; k >= 0 && pi >= 0; k--) { var a = nt.map[r.path[k]]; if (a.type === path[pi].type && a.ord === path[pi].n) pi--; }
        if (pi >= 0) ok = false;
        if (ok) cands.push(r);
      });
      if (!cands.length) return { ok: false, msg: 'لم أجد هذا القسم في هيكل البحث الحالي. تأكد من وجوده أو اختره من القوائم.' };
      if (cands.length > 1) return { ok: false, msg: 'الوصف ينطبق على أكثر من قسم. اذكر الفصل أو المبحث الذي يحويه أو اختر من القوائم.' };
      secId = cands[0].id;
    }
    var res = { ok: true, sectionId: secId, mode: mode, n: n };
    var html = RS.place.htmlOf(paper, secId);
    if (html == null) return { ok: false, msg: 'القسم غير موجود.' };
    if ((mode === 'afterPara' || mode === 'beforePara') && n > H.paraCount(html)) return { ok: false, msg: 'القسم المذكور فيه ' + H.paraCount(html) + ' فقرة فقط، ولا توجد فقرة رقم ' + n + '. اختر الفقرة من القائمة.' };
    return res;
  };
  RS.place.htmlOf = function (paper, id) {
    if (id === 'intro') return paper.intro.html; if (id === 'concl') return paper.concl.html;
    var f = M.findSec(paper, id); return f ? f.sec.html : null;
  };
  RS.place.nameOf = function (paper, id) {
    if (id === 'intro') return paper.settings.introTitle || 'المقدمة'; if (id === 'concl') return paper.settings.conclTitle || 'الخاتمة';
    var nt = M.numberTree(paper), r = nt.map[id]; if (!r) return '';
    return r.path.map(function (x) { var q = nt.map[x]; return q.label || q.sec.title || 'قسم'; }).join(' ← ');
  };
  RS.place.describe = function (paper, pl) {
    if (!pl || !pl.sectionId) return 'غير مرتبطة بمكان';
    var base = RS.place.nameOf(paper, pl.sectionId);
    var w = { afterTitle: 'بعد العنوان مباشرة', start: 'في بداية القسم', end: 'في نهاية القسم', afterPara: 'بعد الفقرة ' + pl.n, beforePara: 'قبل الفقرة ' + pl.n }[pl.mode] || '';
    return base + ' ← ' + w;
  };
  /* يدمج الصور المرتبطة بقسم داخل قائمة كتله (عناصر DOM)، مع الحفاظ على ترتيب الإضافة */
  RS.place.interleave = function (paper, secId, blocks, makeFig) {
    var figs = (paper.figs || []).filter(function (f) { return f.place && f.place.sectionId === secId; });
    if (!figs.length) return { out: blocks, warn: [] };
    var warn = [], before = {}, after = {}, startL = [], endL = [];
    var pidx = [], c = 0;
    blocks.forEach(function (b, i) { if (H.isPara(b)) { c++; pidx[c] = i; } });
    figs.forEach(function (f) {
      var p = f.place, el = makeFig(f);
      if (p.mode === 'afterTitle' || p.mode === 'start') startL.push(el);
      else if (p.mode === 'end') endL.push(el);
      else if (p.mode === 'afterPara') { if (p.n >= 1 && p.n <= c) (after[pidx[p.n]] = after[pidx[p.n]] || []).push(el); else { endL.push(el); warn.push(f.title || 'صورة'); } }
      else if (p.mode === 'beforePara') { if (p.n >= 1 && p.n <= c) (before[pidx[p.n]] = before[pidx[p.n]] || []).push(el); else { endL.push(el); warn.push(f.title || 'صورة'); } }
      else endL.push(el);
    });
    var out = startL.slice();
    blocks.forEach(function (b, i) {
      if (before[i]) out = out.concat(before[i]);
      out.push(b);
      if (after[i]) out = out.concat(after[i]);
    });
    return { out: out.concat(endL), warn: warn };
  };

  /* ------------------------------------------------------------ المراجع */
  var R = RS.refs = {};
  R.TYPES = [{ k: 'book', n: 'كتاب' }, { k: 'article', n: 'مقال علمي' }, { k: 'thesis', n: 'رسالة جامعية' }, { k: 'dissertation', n: 'أطروحة' }, { k: 'web', n: 'موقع إلكتروني' }, { k: 'other', n: 'مصدر آخر' }];
  R.typeName = function (k) { for (var i = 0; i < R.TYPES.length; i++) if (R.TYPES[i].k === k) return R.TYPES[i].n; return 'مصدر'; };
  R.STYLES = [{ k: 'apa', n: 'APA' }, { k: 'mla', n: 'MLA' }, { k: 'chicago', n: 'Chicago' }, { k: 'manual', n: 'توثيق يدوي' }];
  R.newRef = function (type) { return { id: U.uid(), type: type || 'book', authors: [], title: '', year: '', publisher: '', place: '', edition: '', journal: '', volume: '', issue: '', pages: '', url: '', site: '', accessed: '', univ: '', degree: '', manual: '' }; };
  function authorsArr(r) { return (r.authors || []).filter(function (a) { return (a.f || '').trim() || (a.g || '').trim(); }); }
  function initials(g) { return g.trim().split(/\s+/).map(function (w) { return /^[A-Za-z]/.test(w) ? w[0].toUpperCase() + '.' : w; }).join(' '); }
  function joinList(list, ar, amp) { if (list.length <= 1) return list.join(''); if (ar) return list.slice(0, -1).join('، ') + ' و' + list[list.length - 1]; return list.slice(0, -1).join(', ') + (amp ? ', & ' : ', and ') + list[list.length - 1]; }
  function fmtAuthors(r, style) {
    var as = authorsArr(r); if (!as.length) return '';
    var ar = as.some(function (a) { return U.hasArabic(a.f + a.g); });
    var list = as.map(function (a, i) {
      var f = (a.f || '').trim(), g = (a.g || '').trim();
      if (style === 'apa') return ar ? (g ? f + ' ' + g : f) : (g ? f + ', ' + initials(g) : f);
      if (style === 'manual') return (g ? g + ' ' : '') + f;
      if (i === 0) return ar ? (g ? f + ' ' + g : f) : (g ? f + ', ' + g : f);
      return ar ? (g ? g + ' ' + f : f) : (g ? g + ' ' + f : f);
    });
    if (style === 'mla' && !ar && list.length > 2) return list[0] + ', et al';
    return joinList(list, ar, style === 'apa');
  }
  function endDot(s) { s = String(s || '').trim(); return !s ? '' : /[.!?؟]$/.test(s) ? s : s + '.'; }
  function iT(s) { return s ? '<i>' + U.esc(s) + '</i>' : ''; }
  /* مدخل قائمة المراجع كـ HTML */
  R.entryHtml = function (r, style) {
    var e = U.esc, au = fmtAuthors(r, style), y = r.year ? e(r.year) : 'د.ت', ar = U.hasArabic((r.title || '') + au);
    var parts = [], t = r.title || '', url = r.url ? ' ' + e(r.url) : '';
    if (style === 'manual') {
      if (r.manual && r.manual.trim()) return e(r.manual.trim());
      var m = [];
      if (au) m.push(e(au)); if (t) m.push(r.type === 'article' ? '«' + e(t) + '»' : iT(t));
      if (r.type === 'article') { if (r.journal) m.push(iT(r.journal)); if (r.volume) m.push('المجلد ' + e(r.volume)); if (r.issue) m.push('العدد ' + e(r.issue)); }
      else if (r.type === 'thesis' || r.type === 'dissertation') { m.push((r.degree ? e(r.degree) + '، ' : '') + e(r.univ)); }
      else { if (r.edition) m.push('ط' + e(r.edition)); if (r.publisher) m.push(e(r.publisher)); if (r.place) m.push(e(r.place)); }
      m = m.filter(Boolean); if (r.year) m.push(e(r.year)); if (r.pages) m.push('ص ' + e(r.pages));
      var s = m.join('، ') + '.'; if (r.url) s += ' ' + e(r.url); return s;
    }
    if (style === 'apa') {
      if (r.type === 'article') parts = [au ? endDot(e(au)) : '', '(' + y + ').', t ? endDot(e(t)) : '', (r.journal ? iT(r.journal) : '') + (r.volume ? ', ' + iT(r.volume) : '') + (r.issue ? '(' + e(r.issue) + ')' : '') + (r.pages ? ', ' + e(r.pages) : '') + (r.journal || r.volume || r.pages ? '.' : ''), url];
      else if (r.type === 'thesis' || r.type === 'dissertation') parts = [au ? endDot(e(au)) : '', '(' + y + ').', iT(t) + (t ? '' : ''), '[' + e(r.degree || (r.type === 'thesis' ? 'رسالة جامعية' : 'أطروحة')) + (r.univ ? ', ' + e(r.univ) : '') + '].', url];
      else if (r.type === 'web') parts = [au ? endDot(e(au)) : '', '(' + y + ').', iT(t) + '.', r.site ? endDot(e(r.site)) : '', r.accessed ? 'تاريخ الاطلاع: ' + e(r.accessed) + '.' : '', url];
      else parts = [au ? endDot(e(au)) : '', '(' + y + ').', iT(t) + (t ? '.' : ''), (r.edition ? '(' + e(r.edition) + '). ' : '') + (r.publisher ? endDot(e(r.publisher)) : ''), url];
    } else if (style === 'mla') {
      if (r.type === 'article') parts = [au ? endDot(e(au)) : '', t ? '«' + e(t) + '».' : '', iT(r.journal) + (r.volume ? ', vol. ' + e(r.volume) : '') + (r.issue ? ', no. ' + e(r.issue) : '') + (r.year ? ', ' + e(r.year) : '') + (r.pages ? ', pp. ' + e(r.pages) : '') + '.', url];
      else if (r.type === 'thesis' || r.type === 'dissertation') parts = [au ? endDot(e(au)) : '', iT(t) + '.', (r.year ? e(r.year) + '. ' : '') + (r.univ ? e(r.univ) : '') + (r.degree ? ', ' + e(r.degree) : '') + '.', url];
      else if (r.type === 'web') parts = [au ? endDot(e(au)) : '', t ? '«' + e(t) + '».' : '', (r.site ? iT(r.site) + ', ' : '') + (r.year ? e(r.year) + ', ' : '') + (r.url ? e(r.url) : '') + '.', r.accessed ? 'تاريخ الاطلاع: ' + e(r.accessed) + '.' : ''];
      else parts = [au ? endDot(e(au)) : '', iT(t) + '.', (r.edition ? e(r.edition) + ', ' : '') + (r.publisher ? e(r.publisher) + ', ' : '') + (r.year ? e(r.year) : '') + '.', url];
    } else {
      if (r.type === 'article') parts = [au ? endDot(e(au)) : '', y + '.', t ? '«' + e(t) + '».' : '', iT(r.journal) + (r.volume ? ' ' + e(r.volume) : '') + (r.issue ? ' (' + e(r.issue) + ')' : '') + (r.pages ? ': ' + e(r.pages) : '') + '.', url];
      else if (r.type === 'thesis' || r.type === 'dissertation') parts = [au ? endDot(e(au)) : '', y + '.', iT(t) + '.', (r.degree ? e(r.degree) + ', ' : '') + (r.univ ? e(r.univ) : '') + '.', url];
      else if (r.type === 'web') parts = [au ? endDot(e(au)) : '', y + '.', t ? '«' + e(t) + '».' : '', r.site ? endDot(e(r.site)) : '', url];
      else parts = [au ? endDot(e(au)) : '', y + '.', iT(t) + '.', (r.place ? e(r.place) + (r.publisher ? ': ' : '') : '') + (r.publisher ? e(r.publisher) : '') + ((r.place || r.publisher) ? '.' : ''), url];
    }
    return parts.filter(function (x) { return x && x.trim() && x.trim() !== '.'; }).join(' ');
  };
  R.surname = function (r) {
    var as = authorsArr(r); if (!as.length) return '';
    var n = as.map(function (a) { return (a.f || a.g || '').trim(); });
    var ar = as.some(function (a) { return U.hasArabic(a.f + a.g); });
    if (n.length === 1) return n[0];
    if (n.length === 2) return n[0] + (ar ? ' و' : ' & ') + n[1];
    return n[0] + (ar ? ' وآخرون' : ' et al.');
  };
  /* الإحالة داخل النص */
  R.citeText = function (paper, r, page) {
    var style = paper.cite, sn = R.surname(r) || (r.title || '').split(/\s+/).slice(0, 3).join(' ');
    var y = r.year || 'د.ت';
    if (style === 'manual') { var idx = sortedRefs(paper).indexOf(r) + 1; return '[' + (idx || '؟') + (page ? ': ' + page : '') + ']'; }
    if (style === 'mla') return '(' + sn + (page ? ' ' + page : '') + ')';
    if (style === 'chicago') return '(' + sn + ' ' + y + (page ? ', ' + page : '') + ')';
    return '(' + sn + '، ' + y + (page ? '، ص ' + page : '') + ')';
  };
  function sortedRefs(paper) {
    var a = (paper.refs || []).slice();
    if (paper.cite === 'manual') return a;
    return a.sort(function (x, y) { var kx = (R.surname(x) || x.title || '').toLowerCase(), ky = (R.surname(y) || y.title || '').toLowerCase(); return kx.localeCompare(ky, 'ar'); });
  }
  R.sorted = sortedRefs;
  /* قائمة نهائية: [{head:'',items:[{id,html,text}]}] */
  R.biblio = function (paper) {
    var list = sortedRefs(paper), st = paper.cite, groups = [];
    function mk(r) { var h = R.entryHtml(r, st); return { id: r.id, html: h, text: U.textOf(h) }; }
    if (paper.settings.groupRefs) {
      R.TYPES.forEach(function (t) {
        var its = list.filter(function (r) { return r.type === t.k; }).map(mk); if (its.length) groups.push({ head: { book: 'الكتب', article: 'المقالات العلمية', thesis: 'الرسائل الجامعية', dissertation: 'الأطروحات', web: 'المواقع الإلكترونية', other: 'مصادر أخرى' }[t.k], items: its });
      });
    } else if (list.length) groups.push({ head: '', items: list.map(mk) });
    return groups;
  };
  R.usageCount = function (paper, refId) {
    var n = 0, re = new RegExp('data-ref="' + refId + '"', 'g');
    M.allHtmlHolders(paper).forEach(function (h) { var m = (h.html || '').match(re); if (m) n += m.length; });
    return n;
  };
  /* يحدّث نص الإحالات المخزّنة داخل HTML حسب النمط الحالي */
  R.refreshCites = function (paper, html) {
    if (!html || html.indexOf('rs-cite') < 0) return html;
    var map = {}; (paper.refs || []).forEach(function (r) { map[r.id] = r; });
    return html.replace(/<span class="rs-cite" data-ref="([^"]+)"( data-page="([^"]*)")?>[\s\S]*?<\/span>/g, function (m0, id, x, pg) {
      var r = map[id]; var txt = r ? R.citeText(paper, r, pg ? U.textOf(pg) : '') : '(مرجع محذوف)';
      return '<span class="rs-cite" data-ref="' + id + '"' + (pg ? ' data-page="' + pg + '"' : '') + '>' + U.esc(txt) + '</span>';
    });
  };
})();
