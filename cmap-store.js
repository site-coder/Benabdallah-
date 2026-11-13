/* ==========================================================================
   cmap-store.js — «منشئ الخرائط المفاهيمية» (المرحلة 4): الحفظ المحلي وإدارة الخرائط
   - التخزين في IndexedDB داخل متصفح الطالب فقط (بلا خوادم ولا حسابات ولا ذكاء اصطناعي)
   - حفظ تلقائي مؤجَّل مع حالة ظاهرة: جارٍ الحفظ / تم الحفظ / تعذّر الحفظ
   - صفحة «خرائطي»: إنشاء، فتح، إعادة تسمية، نسخ، حذف بتأكيد، معاينة مصغّرة
   - نسخ احتياطي JSON: تصدير واستيراد مع تحقق صارم من البنية وتأكيد قبل أي استبدال
   - يتصل بالمحرر عبر CM.ext فقط؛ لا يعدّل منطق المراحل السابقة (النموذج والواجهة والقوالب)
   - كل خريطة سجل مستقل بمعرّف خاص، فلا تختلط بيانات مشروعين
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM; if (!CM || !CM.u || !CM.Doc) return;
  var U = CM.u, esc = U.esc, LIM = CM.LIMITS;

  var FORMAT = 'edu-concept-map', VERSION = 1, DB_NAME = 'edu_cmap_v1';
  var DEF_NAME = 'خريطة مفاهيمية جديدة';
  var MAX_FILE = 25 * 1024 * 1024, MAX_NODES = 5000, MAX_LINKS = 15000;

  /* ======================================================================
     1) التحقق من البنية وتنظيفها (للملفات المستوردة وللسجلات المخزَّنة)
     ====================================================================== */
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function bad(msg) { return { ok: false, msg: msg }; }
  function cl(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function ids(list) { return list.map(function (x) { return x.id; }); }

  function cleanDoc(d) {
    if (!isObj(d)) return bad('بنية الخريطة غير صحيحة.');
    if (!Array.isArray(d.nodes)) return bad('قائمة العقد مفقودة أو غير صحيحة.');
    if (!Array.isArray(d.links)) return bad('قائمة الروابط مفقودة أو غير صحيحة.');
    if (d.nodes.length > MAX_NODES) return bad('عدد العقد أكبر من الحد المسموح (' + MAX_NODES + ').');
    if (d.links.length > MAX_LINKS) return bad('عدد الروابط أكبر من الحد المسموح (' + MAX_LINKS + ').');
    if (d.theme !== undefined && d.theme !== null && !isObj(d.theme)) return bad('إعدادات مساحة العمل غير صحيحة.');

    var ROLES = ['main', 'sub', 'free', 'shape'], SHAPES = ids(CM.SHAPES), FONTS = ids(CM.FONTS);
    var seen = {}, nodes = [], i, o, n, tag, maxZ = 0, A = 1e6;

    for (i = 0; i < d.nodes.length; i++) {
      o = d.nodes[i]; tag = 'العقدة رقم ' + (i + 1) + ': ';
      if (!isObj(o)) return bad(tag + 'ليست بنية صحيحة.');
      if (typeof o.id !== 'string' || !o.id || o.id.length > 80) return bad(tag + 'المعرّف مفقود أو غير صالح.');
      if (seen[o.id]) return bad(tag + 'المعرّف مكرَّر.');
      if (ROLES.indexOf(o.role) < 0) return bad(tag + 'نوع العقدة غير معروف.');
      if (SHAPES.indexOf(o.shape) < 0) return bad(tag + 'شكل العقدة غير معروف.');
      if (!num(o.x) || !num(o.y) || !num(o.w) || !num(o.h) || Math.abs(o.x) > A || Math.abs(o.y) > A) return bad(tag + 'الموضع أو الحجم غير صالح.');
      if (typeof o.text !== 'string') return bad(tag + 'نص العقدة غير صالح.');
      if (typeof o.bg !== 'string' || !CM.isHex(o.bg) || typeof o.fg !== 'string' || !CM.isHex(o.fg)) return bad(tag + 'لون العقدة أو لون نصها غير صالح.');
      if (o.bc !== undefined && o.bc !== '' && !(typeof o.bc === 'string' && CM.isHex(o.bc))) return bad(tag + 'لون الحدود غير صالح.');
      if (o.desc !== undefined && o.desc !== null && typeof o.desc !== 'string') return bad(tag + 'الوصف غير صالح.');
      seen[o.id] = 1;
      n = {
        id: o.id, role: o.role, shape: o.shape,
        w: cl(Math.round(o.w), LIM.minW, LIM.maxW), h: cl(Math.round(o.h), LIM.minH, LIM.maxH),
        bg: o.bg, fg: o.fg, fs: cl(Math.round(num(o.fs) ? o.fs : 16), LIM.minFs, LIM.maxFs),
        ff: FONTS.indexOf(o.ff) >= 0 ? o.ff : 'alex',
        text: o.text.slice(0, 5000), desc: typeof o.desc === 'string' ? o.desc.slice(0, 5000) : '',
        parent: typeof o.parent === 'string' && o.parent ? o.parent : null,
        z: num(o.z) ? o.z : i + 1, x: Math.round(o.x), y: Math.round(o.y),
        locked: !!o.locked, group: typeof o.group === 'string' && o.group ? o.group.slice(0, 80) : null,
        tone: num(o.tone) ? Math.round(o.tone) : null, leaf: !!o.leaf, bold: o.bold !== false,
        al: CM.ALIGNS.indexOf(o.al) >= 0 ? o.al : 'center',
        pad: num(o.pad) ? cl(Math.round(o.pad), LIM.minPad, LIM.maxPad) : 10,
        bw: num(o.bw) ? cl(Math.round(o.bw), 0, LIM.maxBw) : 0,
        bc: typeof o.bc === 'string' ? o.bc : '',
        br: num(o.br) ? cl(Math.round(o.br), 0, LIM.maxBr) : null,
        op: num(o.op) ? cl(o.op, LIM.minOp, 1) : 1
      };
      if (n.z > maxZ) maxZ = n.z;
      nodes.push(n);
    }
    /* العقدة الأب يجب أن تكون موجودة، وأي مجموعة فيها أقل من عضوين تُحلّ */
    var gc = {};
    nodes.forEach(function (x) { if (x.parent && (!seen[x.parent] || x.parent === x.id)) x.parent = null; if (x.group) gc[x.group] = (gc[x.group] || 0) + 1; });
    nodes.forEach(function (x) { if (x.group && gc[x.group] < 2) x.group = null; });

    var lseen = {}, pairs = {}, links = [], l, c;
    var STYLES = ids(CM.LINK_STYLES);
    for (i = 0; i < d.links.length; i++) {
      o = d.links[i]; tag = 'الرابط رقم ' + (i + 1) + ': ';
      if (!isObj(o)) return bad(tag + 'ليس بنية صحيحة.');
      if (typeof o.id !== 'string' || !o.id || o.id.length > 80) return bad(tag + 'المعرّف مفقود أو غير صالح.');
      if (lseen[o.id]) return bad(tag + 'المعرّف مكرَّر.');
      if (typeof o.from !== 'string' || typeof o.to !== 'string' || !seen[o.from] || !seen[o.to]) return bad(tag + 'يشير إلى عقدة غير موجودة في الملف.');
      if (o.from === o.to) return bad(tag + 'يربط العقدة بنفسها.');
      if (CM.ARROWS.indexOf(o.arrow) < 0) return bad(tag + 'اتجاه السهم غير معروف.');
      if (STYLES.indexOf(o.style) < 0) return bad(tag + 'نمط الرابط غير معروف.');
      if (o.color !== undefined && o.color !== '' && !(typeof o.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(o.color))) return bad(tag + 'لون الرابط غير صالح.');
      if (o.label !== undefined && o.label !== null && typeof o.label !== 'string') return bad(tag + 'نص الرابط غير صالح.');
      lseen[o.id] = 1;
      var pk = o.from < o.to ? o.from + '|' + o.to : o.to + '|' + o.from;
      if (pairs[pk]) continue; /* رابط مكرر بين الزوج نفسه: يُتجاهل كما يمنعه المحرر */
      pairs[pk] = 1;
      l = {
        id: o.id, from: o.from, to: o.to, arrow: o.arrow, style: o.style, color: o.color || '',
        width: num(o.width) ? cl(Math.round(o.width * 2) / 2, LIM.minLw, LIM.maxLw) : CM.LINK_DEFAULT.width,
        label: typeof o.label === 'string' ? o.label.slice(0, 120) : ''
      };
      links.push(l);
    }

    var t = isObj(d.theme) ? d.theme : {};
    var theme = {
      pal: CM.PALETTES.some(function (p) { return p.id === t.pal; }) ? t.pal : 'platform',
      bgMode: CM.BG_MODES.indexOf(t.bgMode) >= 0 ? t.bgMode : 'auto',
      bgColor: typeof t.bgColor === 'string' && CM.isHex(t.bgColor) ? t.bgColor : '#FFFFFF',
      link: typeof t.link === 'string' && CM.isHex(t.link) ? t.link : ''
    };
    var view = null;
    if (isObj(d.view) && num(d.view.x) && num(d.view.y) && num(d.view.k)) view = { x: d.view.x, y: d.view.y, k: cl(d.view.k, LIM.minK, LIM.maxK) };
    var tpl = null;
    if (isObj(d.tpl) && typeof d.tpl.id === 'string') tpl = { id: d.tpl.id.slice(0, 60), name: typeof d.tpl.name === 'string' ? d.tpl.name.slice(0, 80) : '' };

    return {
      ok: true,
      doc: { nodes: nodes, links: links, z: Math.max(num(d.z) ? Math.round(d.z) : 0, maxZ), theme: theme, grid: typeof d.grid === 'boolean' ? d.grid : true, view: view, tpl: tpl }
    };
  }

  function cleanName(s) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return s || DEF_NAME;
  }

  /* ملف المشروع الكامل (JSON) */
  function parseFile(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return bad('الملف ليس بصيغة JSON صحيحة، أو أنه تالف.'); }
    if (!isObj(o) || o.format !== FORMAT) return bad('هذا الملف ليس مشروع خريطة مفاهيمية مُصدَّراً من هذه الأداة.');
    if (!num(o.version) || o.version < 1 || o.version % 1) return bad('رقم إصدار الملف غير صالح.');
    if (o.version > VERSION) return bad('الملف أُنشئ بإصدار أحدث من الأداة (الإصدار ' + o.version + ') ولا يمكن استيراده هنا.');
    var p = o.project;
    if (!isObj(p)) return bad('بيانات المشروع مفقودة من الملف.');
    if (typeof p.name !== 'string') return bad('اسم الخريطة مفقود من الملف.');
    var c = cleanDoc(p.doc); if (!c.ok) return c;
    return {
      ok: true,
      project: {
        id: typeof p.id === 'string' && /^[\w-]{1,80}$/.test(p.id) ? p.id : U.uid('m'),
        name: cleanName(p.name),
        created: num(p.created) && p.created > 0 ? p.created : Date.now(),
        doc: c.doc
      }
    };
  }

  /* ======================================================================
     2) المعاينة المصغّرة (SVG يُرسم من بيانات الخريطة نفسها)
     ====================================================================== */
  var EMPTY_SVG = '<svg viewBox="0 0 120 80" aria-hidden="true"><rect x="22" y="14" width="76" height="52" rx="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 4" opacity=".55"/><path d="M60 30v20M50 40h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>';
  function r1(v) { return Math.round(v * 10) / 10; }

  function makeThumb(d) {
    var th = d.theme, pal = CM.palette(th.pal), bg = '';
    if (th.bgMode === 'white') bg = '#FFFFFF'; else if (th.bgMode === 'custom') bg = th.bgColor;
    if (!d.nodes.length) return { svg: EMPTY_SVG, bg: bg };
    var byId = {}, x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    d.nodes.forEach(function (n) { byId[n.id] = n; x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h); });
    var span = Math.max(x2 - x1, y2 - y1, 1), pad = Math.max(30, span * 0.06);
    x1 -= pad; y1 -= pad; x2 += pad; y2 += pad;
    var sw = Math.max(2.5, span / 120), lc = th.link || pal.link || '#9A7BD0', big = d.nodes.length > 150;
    var h = '<svg viewBox="' + r1(x1) + ' ' + r1(y1) + ' ' + r1(x2 - x1) + ' ' + r1(y2 - y1) + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">';
    d.links.forEach(function (l) {
      var a = byId[l.from], b = byId[l.to]; if (!a || !b) return;
      var rt = CM.geo.route(a, b, l.style, l.arrow, sw), c = l.color || lc;
      h += '<path d="' + rt.d + '" fill="none" stroke="' + c + '" stroke-width="' + r1(sw) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      rt.heads.forEach(function (p) { h += '<polygon points="' + p + '" fill="' + c + '"/>'; });
      if (l.label && !big) {
        var pw = Math.max(40, sw * 14), ph = Math.max(14, sw * 5);
        h += '<rect x="' + r1(rt.mid.x - pw / 2) + '" y="' + r1(rt.mid.y - ph / 2) + '" width="' + r1(pw) + '" height="' + r1(ph) + '" rx="' + r1(ph / 2) + '" style="fill:' + (bg || 'var(--cm-canvas,#fff)') + '" stroke="' + c + '" stroke-width="' + r1(sw * 0.7) + '"/>';
      }
    });
    d.nodes.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (n) {
      var op = n.op == null ? 1 : n.op;
      var st = n.bw > 0 ? ' stroke="' + (CM.isHex(n.bc) ? n.bc : n.fg) + '" stroke-width="' + r1(Math.max(n.bw, sw * 0.6)) + '"' : '';
      var fill = ' fill="' + n.bg + '"' + (op < 1 ? ' fill-opacity="' + op + '"' : '');
      var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      if (n.shape === 'ellipse') h += '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(n.w / 2) + '" ry="' + r1(n.h / 2) + '"' + fill + st + '/>';
      else h += '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + (n.br != null ? n.br : (n.shape === 'round' ? 16 : 3)) + '"' + fill + st + '/>';
      if (!big && n.text) {
        var tw = Math.min(n.w * 0.62, Math.max(30, n.text.length * n.fs * 0.4)), tt = Math.max(8, n.fs * 0.42);
        h += '<rect x="' + r1(cx - tw / 2) + '" y="' + r1(cy - tt / 2) + '" width="' + r1(tw) + '" height="' + r1(tt) + '" rx="' + r1(tt / 2) + '" fill="' + n.fg + '" opacity=".8"/>';
      }
    });
    return { svg: h + '</svg>', bg: bg };
  }

  function buildMeta(id, name, created, updated, d) {
    var t = makeThumb(d);
    return { id: id, name: name, created: created, updated: updated, nodes: d.nodes.length, links: d.links.length, tpl: d.tpl || null, thumb: t.svg, thumbBg: t.bg, v: VERSION };
  }

  /* ======================================================================
     3) طبقة IndexedDB: meta (بيانات القائمة) + docs (محتوى الخريطة) + kv (آخر مشروع مفتوح)
     ====================================================================== */
  var S = CM.store = { ok: false, error: null, parse: parseFile, validate: cleanDoc, thumb: makeThumb };
  var dbp = null, dbh = null;

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var idb = window.indexedDB, rq;
      if (!idb) { var e0 = new Error('unsupported'); e0.code = 'unsupported'; rej(e0); return; }
      try { rq = idb.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      };
      rq.onsuccess = function () {
        var db = rq.result;
        db.onversionchange = function () { try { db.close(); } catch (e) {} dbh = null; dbp = null; };
        db.onclose = function () { dbh = null; dbp = null; };
        dbh = db; res(db);
      };
      rq.onerror = function () { rej(rq.error || new Error('open')); };
      rq.onblocked = function () { rej(new Error('blocked')); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }

  /* ينفّذ معاملة ويحلّ الوعد بعد اكتمالها فعلاً. fn(tx, set) — set(v) يحدّد القيمة المُعادة */
  function run(names, mode, fn) {
    function go(db) {
      return new Promise(function (res, rej) {
        var tx, out;
        try { tx = db.transaction(names, mode); } catch (e) { dbh = null; dbp = null; rej(e); return; }
        tx.oncomplete = function () { res(out); };
        tx.onabort = function () { rej(tx.error || new Error('abort')); };
        try { fn(tx, function (v) { out = v; }); } catch (e) { try { tx.abort(); } catch (x) {} rej(e); }
      });
    }
    /* عند توفر الاتصال تبدأ المعاملة فوراً (مهم عند إغلاق الصفحة) */
    return dbh ? go(dbh) : openDB().then(go);
  }

  S.init = function () {
    var timer, to = new Promise(function (_, rej) { timer = setTimeout(function () { rej(new Error('timeout')); }, 6000); });
    return Promise.race([openDB(), to]).then(function () { clearTimeout(timer); S.ok = true; S.error = null; return true; }, function (e) { clearTimeout(timer); S.ok = false; S.error = e; throw e; });
  };
  S.list = function () {
    return run(['meta'], 'readonly', function (tx, set) { var r = tx.objectStore('meta').getAll(); r.onsuccess = function () { set(r.result || []); }; }).then(function (v) { return v || []; });
  };
  S.get = function (id) {
    var m = null, d = null;
    return run(['meta', 'docs'], 'readonly', function (tx) {
      tx.objectStore('meta').get(id).onsuccess = function (e) { m = e.target.result; };
      tx.objectStore('docs').get(id).onsuccess = function (e) { d = e.target.result; };
    }).then(function () { return m && d ? { meta: m, doc: d.data } : null; });
  };
  S.put = function (meta, data) {
    return run(['meta', 'docs'], 'readwrite', function (tx) { tx.objectStore('meta').put(meta); tx.objectStore('docs').put({ id: meta.id, data: data }); });
  };
  S.remove = function (id) {
    return run(['meta', 'docs', 'kv'], 'readwrite', function (tx) {
      tx.objectStore('meta').delete(id); tx.objectStore('docs').delete(id);
      var kv = tx.objectStore('kv'), g = kv.get('last');
      g.onsuccess = function () { if (g.result && g.result.value === id) kv.delete('last'); };
    });
  };
  S.rename = function (id, name) {
    return run(['meta'], 'readwrite', function (tx) {
      var st = tx.objectStore('meta'), g = st.get(id);
      g.onsuccess = function () { var m = g.result; if (m) { m.name = name; m.updated = Date.now(); st.put(m); } };
    });
  };
  S.getLast = function () {
    return run(['kv'], 'readonly', function (tx, set) { var r = tx.objectStore('kv').get('last'); r.onsuccess = function () { set(r.result ? r.result.value : null); }; }).then(function (v) { return v || null; });
  };
  S.setLast = function (id) { return run(['kv'], 'readwrite', function (tx) { tx.objectStore('kv').put({ key: 'last', value: id }); }); };

  /* رسالة واضحة للطالب بحسب نوع الخطأ */
  S.explain = function (e) {
    var n = e && e.name, m = String((e && e.message) || '');
    if (e && e.user) return e.message;
    if (n === 'QuotaExceededError' || /quota/i.test(m)) return 'مساحة التخزين في المتصفح ممتلئة. احذف خرائط لم تعد تحتاجها أو صدِّر نسخة احتياطية ثم أعد المحاولة.';
    if (e && e.code === 'unsupported') return 'هذا المتصفح لا يدعم التخزين المحلي أو أنه معطّل (مثلاً في التصفح الخفي).';
    if (n === 'SecurityError') return 'المتصفح يمنع التخزين المحلي لهذا الموقع. راجع إعدادات الخصوصية في المتصفح.';
    if (m === 'blocked') return 'التخزين مشغول بنافذة أخرى مفتوحة للمنصة. أغلق النوافذ الأخرى ثم أعد المحاولة.';
    if (m === 'timeout') return 'تأخّر فتح التخزين المحلي أكثر من المعتاد.';
    return 'تعذّر الوصول إلى التخزين المحلي في المتصفح.';
  };

  /* ======================================================================
     4) الربط بالمحرر: الحفظ التلقائي + صفحة «خرائطي»
     ====================================================================== */
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var IC = {
    folder: ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    up: ic('<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>'),
    down: ic('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
    close: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    copy: ic('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 14h10l1-14"/>'),
    open: ic('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>')
  };

  var DF = null;
  try { DF = new Intl.DateTimeFormat('ar-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { DF = null; }
  function fmtDate(ts) { try { return DF ? DF.format(new Date(ts)) : new Date(ts).toLocaleString(); } catch (e) { return '—'; } }
  function clock() { var d = new Date(); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }
  function plural(n) { return n === 0 ? 'لا توجد خرائط' : n === 1 ? 'خريطة واحدة' : n === 2 ? 'خريطتان' : (n <= 10 ? n + ' خرائط' : n + ' خريطة'); }
  function userErr(m) { var e = new Error(m); e.user = true; return e; }
  function fileName(name) { return (String(name).replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'خريطة') + '.json'; }
  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' }), a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(u); }, 4000);
  }
  function readFile(f) {
    if (f.text) return f.text();
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { rej(r.error); }; r.readAsText(f); });
  }

  CM.ext = CM.ext || [];
  CM.ext.push(function (api, doc) {
    var rootEl = api.root, canvas = api.canvas, host = api.host;
    function $(s, r) { return (r || rootEl).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || rootEl).querySelectorAll(s)); }

    /* ------------------------------------------------------------ الهيكل */
    $('.cm-topact').insertAdjacentHTML('afterbegin',
      '<button type="button" class="cm-btn" data-mm="manager" title="خرائطي: كل الخرائط المحفوظة" aria-label="خرائطي">' + IC.folder + '<span>خرائطي</span></button>');
    canvas.insertAdjacentHTML('beforeend',
      '<div class="cm-save" role="status" aria-live="polite" data-state="saved" hidden><i class="cm-sd" aria-hidden="true"></i><span class="cm-st"></span></div>');
    rootEl.insertAdjacentHTML('beforeend',
      '<div class="cm-sbanner" role="alert" hidden><span class="cm-sbmsg"></span><span class="cm-sbact">' +
      '<button type="button" class="cm-btn" data-mm="retry">إعادة المحاولة</button>' +
      '<button type="button" class="cm-btn" data-mm="exportcur">' + IC.down + '<span>تصدير نسخة JSON</span></button>' +
      '<button type="button" class="cm-btn cm-ib" data-mm="bannerx" title="إخفاء" aria-label="إخفاء الرسالة">' + IC.close + '</button></span></div>' +
      '<section class="cm-mm" hidden role="dialog" aria-modal="true" aria-label="خرائطي">' +
      '<header class="cm-mmh"><button type="button" class="cm-btn" data-mm="close" title="العودة إلى المحرر" aria-label="العودة إلى المحرر">' + IC.open + '<span>المحرر</span></button>' +
      '<div class="cm-mmt"><h2>خرائطي</h2><small class="cm-mmc"></small></div>' +
      '<div class="cm-mma"><button type="button" class="cm-btn cm-pri" data-mm="new">' + IC.plus + '<span>خريطة جديدة</span></button>' +
      '<button type="button" class="cm-btn" data-mm="import" title="استيراد مشروع من ملف JSON">' + IC.up + '<span>استيراد JSON</span></button></div></header>' +
      '<div class="cm-mmmsg" role="alert" hidden></div>' +
      '<div class="cm-mmb"><div class="cm-mmgrid"></div></div>' +
      '<input type="file" class="cm-file" accept=".json,application/json" hidden tabindex="-1">' +
      '<div class="cm-dlg" hidden role="dialog" aria-modal="true"></div></section>' +
      '<div class="cm-boot" role="status"><span class="cm-spin" aria-hidden="true"></span><b>جارٍ استعادة خريطتك…</b></div>');
    var chip = $('.cm-save'), chipTx = $('.cm-st', chip);
    var banner = $('.cm-sbanner'), bannerMsg = $('.cm-sbmsg');
    var mm = $('.cm-mm'), mmGrid = $('.cm-mmgrid'), mmCount = $('.cm-mmc'), mmMsg = $('.cm-mmmsg'), fileIn = $('.cm-file'), dlgEl = $('.cm-dlg');
    var boot = $('.cm-boot');
    var openBtn = $('[data-mm="manager"]');

    /* ------------------------------------------------------------ حالة المحرر الحالية */
    var cur = null;            /* { id, created, updated, meta, sig } */
    var tpl = null;            /* القالب المستخدم {id, name} إن وُجد */
    var loading = false, saving = false, again = false, dirty = false, viewDirty = false, busy = false;
    var tDeb = 0, tMax = 0, tRetry = 0, retryN = 0, savePromise = Promise.resolve(true), state = '';

    /* نص عقدة قيد الكتابة: لا يدخل النموذج إلا عند إنهاء التحرير، فيُلتقط من الشاشة كي لا يضيع عند إغلاق مفاجئ */
    function live() {
      var t = rootEl.querySelector('.cm-node.editing .cm-title'), nd = t && t.closest('.cm-node');
      return nd && nd.dataset.id ? { id: nd.dataset.id, text: t.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '') } : null;
    }
    function sig() { var lv = live(); return JSON.stringify([doc.name, doc.grid ? 1 : 0, tpl ? tpl.id : '', doc.z, doc.theme, doc.nodes, doc.links, lv ? [lv.id, lv.text] : 0]); }
    function snapshot() {
      var o = JSON.parse(JSON.stringify({ nodes: doc.nodes, links: doc.links, z: doc.z, theme: doc.theme, grid: !!doc.grid, view: { x: doc.view.x, y: doc.view.y, k: doc.view.k }, tpl: tpl })), lv = live();
      if (lv) o.nodes.forEach(function (n) { if (n.id === lv.id) n.text = lv.text.slice(0, 5000); });
      return o;
    }
    rootEl.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('.cm-node.editing')) mark(true, true); });
    function blankData() { return { nodes: [], links: [], z: 1, theme: CM.defaultTheme(), grid: true, view: null, tpl: null }; }
    var BLANK_SIG = JSON.stringify([DEF_NAME, 1, '', 1, CM.defaultTheme(), [], [], 0]);

    /* القالب المستخدم: يُسجَّل عند تحميل قالب من المعرض (بغلاف على loadSpec دون تعديل ملف القوالب) */
    var origLoadSpec = doc.loadSpec;
    doc.loadSpec = function (spec, label) {
      var r = origLoadSpec.apply(doc, arguments), m = /^قالب: (.+)$/.exec(label || ''), t = null;
      if (m && CM.TEMPLATES) CM.TEMPLATES.forEach(function (x) { if (x.name === m[1]) t = { id: x.id, name: x.name }; });
      tpl = t; mark(true);
      return r;
    };

    /* ------------------------------------------------------------ حالة الحفظ والرسائل */
    var TXT = { saving: 'جارٍ الحفظ…', saved: 'تم الحفظ', error: 'تعذّر الحفظ' };
    function setState(s, msg) {
      var prev = state; state = s;
      chip.hidden = false; chip.dataset.state = s; chipTx.textContent = TXT[s];
      chip.title = s === 'saved' ? 'آخر حفظ: ' + clock() : (s === 'error' ? (msg || '') : '');
      if (s === 'error') { showBanner(msg); if (prev !== 'error') api.say('تعذّر حفظ الخريطة'); } else hideBanner();
    }
    function showBanner(msg) {
      bannerMsg.textContent = (msg || 'تعذّر الحفظ.') + ' تعديلاتك ما زالت أمامك لكنها غير محفوظة بعد.';
      banner.style.top = ($('.cm-top').offsetHeight + $('.cm-acts').offsetHeight + 8) + 'px';
      banner.hidden = false;
    }
    function hideBanner() { banner.hidden = true; }
    banner.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    /* ------------------------------------------------------------ الحفظ التلقائي */
    function clearTimers() { clearTimeout(tDeb); clearTimeout(tMax); clearTimeout(tRetry); tDeb = tMax = tRetry = 0; }
    function mark(content, fast) {
      if (loading || !cur) return;
      if (content) { dirty = true; if (state !== 'saving') setState('saving'); } else viewDirty = true;
      clearTimeout(tDeb); tDeb = setTimeout(saveNow, fast ? 250 : (content || dirty ? 700 : 1800));
      if (!tMax) tMax = setTimeout(saveNow, 4000); /* حدّ أقصى للانتظار أثناء التعديل المتواصل */
    }
    function scheduleRetry() { clearTimeout(tRetry); if (retryN++ < 5) tRetry = setTimeout(saveNow, 8000); }

    function saveNow() {
      clearTimeout(tDeb); clearTimeout(tMax); tDeb = tMax = 0;
      if (!cur || !S.ok || loading) return Promise.resolve(true);
      if (saving) { again = true; return savePromise; }
      var me = cur, s = sig(), content = s !== me.sig;
      if (!content && !viewDirty) { dirty = false; if (state !== 'saved') setState('saved'); return Promise.resolve(true); }
      var data = snapshot(), meta = me.meta, now = Date.now();
      if (content) meta = buildMeta(me.id, doc.name, me.created, now, data);
      dirty = false; viewDirty = false; saving = true;
      savePromise = S.put(meta, data).then(function () {
        saving = false;
        if (cur !== me) return true;
        me.meta = meta; me.sig = s; me.updated = meta.updated; retryN = 0;
        if (again) { again = false; return saveNow(); }
        if (!dirty && !tDeb) setState('saved');
        return true;
      }, function (err) {
        saving = false; again = false;
        if (cur !== me) return false;
        if (content) dirty = true; else viewDirty = true;
        setState('error', S.explain(err)); scheduleRetry();
        return false;
      });
      return savePromise;
    }
    /* يضمن حفظ كل ما هو معلّق (يعيد false إن تعذّر) */
    function flushAll() {
      return saveNow().then(function (ok) {
        if (!ok) return false;
        if (saving || again || dirty || viewDirty || tDeb) return flushAll();
        return true;
      });
    }
    /* قبل المغادرة: أنهِ تعديل النص الجاري ثم احفظ فوراً */
    function leaving() { if (!cur) return; try { api.stopEdits(true); } catch (e) {} saveNow(); }

    ['node:add', 'node:update', 'node:remove', 'link:add', 'link:update', 'link:remove', 'history', 'meta', 'reset'].forEach(function (ev) { doc.on(ev, function () { mark(true); }); });
    doc.on('view', function () { mark(false); });
    window.addEventListener('pagehide', leaving);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leaving(); });
    window.addEventListener('popstate', leaving);
    host.addEventListener('click', function (e) { if (e.target.closest('.tl-back')) leaving(); }, true);

    /* ------------------------------------------------------------ تحميل خريطة داخل المحرر */
    function applyDoc(meta, d) {
      loading = true;
      try {
        api.stopEdits(false); api.clearPending(); if (api.setTool) api.setTool('ptr');
        doc.nodes = d.nodes; doc.links = d.links; doc.byId = {}; doc.linkById = {};
        d.nodes.forEach(function (n) { doc.byId[n.id] = n; });
        d.links.forEach(function (l) { doc.linkById[l.id] = l; });
        doc.z = d.z; doc.theme = d.theme; doc.grid = d.grid; doc.name = meta.name;
        doc.selN = []; doc.selL = []; doc.sel = null; doc._tx = 0; doc._lk = ''; doc._lt = 0;
        doc.hist = [doc._snap()]; doc.hi = 0; doc.hlabel = '';
        tpl = d.tpl;
        api.nameIn.value = meta.name;
        doc.emit('reset'); doc.emit('meta'); doc._emitSel(); doc.emit('history');
        if (d.view) doc.setView(d.view); else api.fit();
      } finally { loading = false; }
      clearTimers(); dirty = false; viewDirty = false; again = false; retryN = 0;
      cur = { id: meta.id, created: meta.created, updated: meta.updated, meta: meta, sig: sig() };
      setState('saved');
    }

    async function loadById(id) {
      var rec = await S.get(id);
      if (!rec) return { ok: false, msg: 'الخريطة غير موجودة.' };
      var c = cleanDoc(rec.doc);
      if (!c.ok) return { ok: false, msg: 'بيانات خريطة «' + rec.meta.name + '» تالفة: ' + c.msg };
      return { ok: true, meta: rec.meta, doc: c.doc };
    }
    async function createProject(d, name) {
      var id = U.uid('m'), now = Date.now(), meta = buildMeta(id, name, now, now, d);
      await S.put(meta, d); await S.setLast(id);
      return meta;
    }

    /* ------------------------------------------------------------ بدء التشغيل: استعادة آخر مشروع */
    var abandoned = false;
    async function bootstrap(adopt) {
      await S.init();
      if (adopt) {
        var d0 = snapshot(), m0 = await createProject(d0, cleanName(doc.name));
        cur = { id: m0.id, created: m0.created, updated: m0.updated, meta: m0, sig: sig() };
        dirty = false; viewDirty = false; setState('saved');
        return;
      }
      var last = await S.getLast(), list = await S.list();
      list.sort(function (a, b) { return b.updated - a.updated; });
      var order = list.filter(function (m) { return m.id === last; }).concat(list.filter(function (m) { return m.id !== last; }));
      var skipped = 0;
      for (var i = 0; i < order.length; i++) {
        var r = await loadById(order[i].id);
        if (abandoned) return;
        if (r.ok) { applyDoc(r.meta, r.doc); await S.setLast(r.meta.id); if (skipped) api.say('تعذّر فتح ' + skipped + ' خريطة تالفة'); return; }
        skipped++;
      }
      var bd = blankData(), bm = await createProject(bd, DEF_NAME);
      if (abandoned) return;
      applyDoc(bm, bd);
      if (skipped) api.say('تعذّر فتح خريطة محفوظة لأنها تالفة، وتم إنشاء خريطة جديدة');
    }
    function bootFail(err) {
      boot.hidden = true; S.ok = false;
      setState('error', S.explain(err) + ' لن تُحفظ التعديلات الجديدة في هذا المتصفح.');
    }
    boot.hidden = false;
    var bootTimer = setTimeout(function () { abandoned = true; bootFail(new Error('timeout')); }, 8000);
    /* بعد أول ملاءمة للعرض (التي يجدولها المحرر عند البدء) كي لا تُلغي العرض المُستعاد */
    requestAnimationFrame(function () {
      bootstrap(false).then(function () { clearTimeout(bootTimer); if (!abandoned) boot.hidden = true; }, function (err) { clearTimeout(bootTimer); if (window.console) console.error('cmap store', err); bootFail(err); });
    });

    /* ------------------------------------------------------------ نوافذ التأكيد (بديل prompt/confirm) */
    var dlgRes = null, dlgOpener = null;
    function ask(o) {
      return new Promise(function (res) {
        if (dlgRes) closeDlg({ action: 'cancel' });
        dlgRes = res; dlgOpener = document.activeElement;
        var h = '<div class="cm-dlgbox"><h3>' + esc(o.title) + '</h3>';
        (o.lines || []).forEach(function (t) { h += '<p>' + esc(t) + '</p>'; });
        if (o.input) h += '<label class="cm-f"><span>' + esc(o.input.label) + '</span><input type="text" class="cm-dlgin" maxlength="' + o.input.max + '" value="' + esc(o.input.value) + '" spellcheck="false"></label>';
        h += '<div class="cm-dlga">';
        o.actions.forEach(function (a) { h += '<button type="button" class="cm-btn ' + (a.cls || '') + '" data-dlg="' + a.id + '"' + (a.primary ? ' data-primary="1"' : '') + '>' + esc(a.label) + '</button>'; });
        h += '</div></div>';
        dlgEl.innerHTML = h; dlgEl.hidden = false;
        var f = o.input ? $('.cm-dlgin', dlgEl) : $('[data-dlg="' + (o.focus || o.actions[0].id) + '"]', dlgEl);
        if (f) { f.focus(); if (o.input) f.select(); }
      });
    }
    function closeDlg(result) {
      if (dlgEl.hidden) return;
      var r = dlgRes, inp = $('.cm-dlgin', dlgEl), val = inp ? inp.value : null;
      dlgRes = null; dlgEl.hidden = true; dlgEl.innerHTML = '';
      try { if (dlgOpener && dlgOpener.focus) dlgOpener.focus({ preventScroll: true }); } catch (e) {}
      if (r) r({ action: result.action, value: val });
    }
    dlgEl.addEventListener('click', function (e) {
      if (e.target === dlgEl) { closeDlg({ action: 'cancel' }); return; }
      var b = e.target.closest('[data-dlg]'); if (b) closeDlg({ action: b.dataset.dlg });
    });

    /* ------------------------------------------------------------ صفحة «خرائطي» */
    var mmOpener = null;
    function mmMessage(t) { mmMsg.textContent = t || ''; mmMsg.hidden = !t; }

    function cardHTML(m) {
      var isCur = cur && cur.id === m.id, n = esc(m.name), meta = '';
      meta += '<span>العقد: ' + m.nodes + '</span><span>الروابط: ' + m.links + '</span>';
      if (m.tpl && m.tpl.name) meta += '<span>القالب: ' + esc(m.tpl.name) + '</span>';
      return '<article class="cm-mc' + (isCur ? ' cur' : '') + '" data-mid="' + esc(m.id) + '">' +
        '<button type="button" class="cm-mcp" data-mm="open" title="فتح «' + n + '»" aria-label="فتح الخريطة ' + n + '"><span class="cm-mcpv"' + (m.thumbBg ? ' style="background:' + esc(m.thumbBg) + '"' : '') + '>' + (m.thumb || EMPTY_SVG) + '</span></button>' +
        '<div class="cm-mci"><h3 class="cm-mcn" title="' + n + '">' + n + '</h3>' + (isCur ? '<span class="cm-badge">مفتوحة الآن</span>' : '') +
        '<p class="cm-mcd"><span>أُنشئت: ' + fmtDate(m.created) + '</span><span>آخر تعديل: ' + fmtDate(m.updated) + '</span></p>' +
        '<p class="cm-mcs">' + meta + '</p></div>' +
        '<div class="cm-mca">' +
        '<button type="button" class="cm-btn cm-pri" data-mm="open" aria-label="' + (isCur ? 'متابعة تعديل ' : 'فتح ') + n + '">' + IC.open + '<span>' + (isCur ? 'متابعة' : 'فتح') + '</span></button>' +
        '<button type="button" class="cm-btn" data-mm="rename" aria-label="إعادة تسمية ' + n + '">' + IC.edit + '<span>إعادة تسمية</span></button>' +
        '<button type="button" class="cm-btn" data-mm="dup" aria-label="إنشاء نسخة من ' + n + '">' + IC.copy + '<span>نسخة</span></button>' +
        '<button type="button" class="cm-btn" data-mm="export" aria-label="تصدير ' + n + ' بصيغة JSON">' + IC.down + '<span>تصدير</span></button>' +
        '<button type="button" class="cm-btn cm-danger" data-mm="del" aria-label="حذف ' + n + '">' + IC.trash + '<span>حذف</span></button></div></article>';
    }
    async function renderList(focusId) {
      if (!S.ok) {
        mmCount.textContent = '';
        mmGrid.innerHTML = '<div class="cm-mmempty"><b>التخزين المحلي غير متاح</b><p>' + esc(S.explain(S.error)) + ' لن تُحفظ الخرائط في هذا المتصفح، لكن يمكنك تصدير الخريطة الحالية كملف JSON للاحتفاظ بها.</p>' +
          '<button type="button" class="cm-btn" data-mm="exportcur">' + IC.down + '<span>تصدير الخريطة الحالية</span></button> <button type="button" class="cm-btn" data-mm="retry">إعادة المحاولة</button></div>';
        $$('[data-mm="new"],[data-mm="import"]', mm).forEach(function (b) { b.disabled = true; });
        return;
      }
      $$('[data-mm="new"],[data-mm="import"]', mm).forEach(function (b) { b.disabled = false; });
      var list = await S.list();
      list.sort(function (a, b) { return b.updated - a.updated; });
      mmCount.textContent = plural(list.length);
      mmGrid.innerHTML = list.length ? list.map(cardHTML).join('') : '<div class="cm-mmempty"><b>لا توجد خرائط محفوظة بعد</b><p>أنشئ خريطة جديدة أو استورد مشروعاً من ملف JSON.</p></div>';
      if (focusId) {
        var c = $$('.cm-mc', mm).filter(function (x) { return x.dataset.mid === focusId; })[0];
        if (c) { c.classList.add('flash'); try { c.scrollIntoView({ block: 'nearest' }); } catch (e) {} setTimeout(function () { c.classList.remove('flash'); }, 2200); }
      }
    }
    async function openManager() {
      if (!mm.hidden) return;
      api.stopEdits(true); api.clearPending();
      mmOpener = document.activeElement; mmMessage('');
      if (cur) await flushAll();
      await renderList();
      mm.hidden = false; rootEl.classList.add('cm-mm-open');
      var f = $('.cm-mc.cur .cm-pri', mm) || $('[data-mm="new"]', mm) || $('[data-mm="close"]', mm); if (f && !f.disabled) f.focus({ preventScroll: true });
    }
    function closeManager() {
      if (mm.hidden) return;
      closeDlg({ action: 'cancel' });
      mm.hidden = true; rootEl.classList.remove('cm-mm-open'); mmMessage('');
      try { (mmOpener && mmOpener.offsetParent ? mmOpener : canvas).focus({ preventScroll: true }); } catch (e) {}
    }

    function guarded(fn) {
      if (busy) return Promise.resolve();
      busy = true; mm.classList.add('cm-busy'); mmMessage('');
      return Promise.resolve().then(fn).catch(function (err) {
        if (window.console && !(err && err.user)) console.error('cmap store', err);
        mmMessage(S.explain(err));
      }).then(function () { busy = false; mm.classList.remove('cm-busy'); });
    }

    /* إن تعذّر حفظ الخريطة الحالية: اسأل قبل الانتقال حتى لا يضيع شيء دون علم الطالب */
    async function savedOrConfirm() {
      var ok = await flushAll();
      if (ok) return true;
      var r = await ask({ title: 'تعذّر حفظ الخريطة الحالية', lines: ['إن انتقلت الآن فقد تضيع آخر تعديلاتها. يمكنك البقاء وتصدير نسخة JSON أولاً.'], actions: [{ id: 'stay', label: 'البقاء هنا', cls: 'cm-pri', primary: true }, { id: 'go', label: 'متابعة دون حفظ', cls: 'cm-danger' }], focus: 'stay' });
      return r.action === 'go';
    }
    function isBlankUntouched() { return !!cur && sig() === BLANK_SIG; }

    async function newProject() {
      if (isBlankUntouched()) { closeManager(); api.say('الخريطة الحالية فارغة، ابدأ عليها مباشرة'); return; }
      if (!(await savedOrConfirm())) return;
      var d = blankData(), meta = await createProject(d, DEF_NAME);
      applyDoc(meta, d); closeManager(); api.say('تم إنشاء خريطة جديدة، وخرائطك السابقة محفوظة في «خرائطي»');
    }
    async function openProject(id) {
      if (cur && cur.id === id) { closeManager(); return; }
      if (!(await savedOrConfirm())) return;
      var r = await loadById(id);
      if (!r.ok) throw userErr(r.msg);
      applyDoc(r.meta, r.doc); await S.setLast(id); closeManager(); api.say('تم فتح «' + r.meta.name + '»');
    }
    async function renameProject(id) {
      var list = await S.list(), m = list.filter(function (x) { return x.id === id; })[0]; if (!m) throw userErr('الخريطة غير موجودة.');
      var isCur = cur && cur.id === id, name = isCur ? doc.name : m.name;
      var r = await ask({ title: 'إعادة تسمية الخريطة', input: { label: 'اسم الخريطة', value: name, max: 80 }, actions: [{ id: 'ok', label: 'حفظ الاسم', cls: 'cm-pri', primary: true }, { id: 'cancel', label: 'إلغاء' }] });
      if (r.action !== 'ok') return;
      var nn = cleanName(r.value);
      if (nn === name) return;
      if (isCur) { doc.setName(nn); api.nameIn.value = nn; if (!(await flushAll())) throw new Error('save'); }
      else await S.rename(id, nn);
      await renderList(id); api.say('تمت إعادة التسمية');
    }
    async function duplicateProject(id) {
      if (cur && cur.id === id && !(await flushAll())) throw new Error('save');
      var r = await loadById(id); if (!r.ok) throw userErr(r.msg);
      var d = JSON.parse(JSON.stringify(r.doc)), nid = U.uid('m'), now = Date.now(), name = cleanName('نسخة من ' + r.meta.name);
      await S.put(buildMeta(nid, name, now, now, d), d);
      await renderList(nid); api.say('تم إنشاء «' + name + '»');
    }
    async function deleteProject(id) {
      var list = await S.list(), m = list.filter(function (x) { return x.id === id; })[0]; if (!m) throw userErr('الخريطة غير موجودة.');
      var isCur = cur && cur.id === id;
      var r = await ask({ title: 'حذف «' + m.name + '»؟', lines: ['سيُحذف هذا المشروع نهائياً من هذا المتصفح ولا يمكن استرجاعه.', 'يمكنك تصدير نسخة JSON أولاً إن أردت الاحتفاظ بها.'], actions: [{ id: 'cancel', label: 'إلغاء', cls: 'cm-pri' }, { id: 'del', label: 'حذف نهائياً', cls: 'cm-danger' }], focus: 'cancel' });
      if (r.action !== 'del') return;
      var keep = cur;
      if (isCur) await flushAll(); /* لا يبقى حفظ جارٍ يعيد إنشاء السجل بعد حذفه */
      if (isCur) { clearTimers(); cur = null; dirty = false; viewDirty = false; }
      try { await S.remove(id); }
      catch (err) { if (isCur) { cur = keep; mark(true); } throw err; }
      if (isCur) {
        var rest = (await S.list()).sort(function (a, b) { return b.updated - a.updated; }), opened = false;
        for (var i = 0; i < rest.length && !opened; i++) { var lr = await loadById(rest[i].id); if (lr.ok) { applyDoc(lr.meta, lr.doc); await S.setLast(lr.meta.id); opened = true; } }
        if (!opened) { var bd = blankData(), bm = await createProject(bd, DEF_NAME); applyDoc(bm, bd); }
      }
      await renderList(); api.say('تم حذف «' + m.name + '»');
    }

    /* ------------------------------------------------------------ النسخ الاحتياطي JSON */
    function exportObj(id, name, created, updated, d) {
      return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), project: { id: id, name: name, created: created, updated: updated, doc: d } };
    }
    async function exportProject(id) {
      var obj, name;
      if (cur && cur.id === id) { name = cleanName(doc.name); obj = exportObj(cur.id, name, cur.created, cur.updated, snapshot()); }
      else {
        var r = await loadById(id); if (!r.ok) throw userErr(r.msg);
        name = r.meta.name; obj = exportObj(r.meta.id, name, r.meta.created, r.meta.updated, r.doc);
      }
      download(fileName(name), JSON.stringify(obj));
      api.say('تم تصدير «' + name + '»');
    }
    function exportCurrent() {
      var name = cleanName(doc.name), now = Date.now();
      download(fileName(name), JSON.stringify(exportObj(cur ? cur.id : U.uid('m'), name, cur ? cur.created : now, now, snapshot())));
      api.say('تم تصدير «' + name + '»');
    }
    async function importFile(file) {
      if (!file) return;
      var okBtn = [{ id: 'ok', label: 'حسناً', cls: 'cm-pri', primary: true }];
      if (file.size > MAX_FILE) { await ask({ title: 'تعذّر استيراد الملف', lines: ['حجم الملف أكبر من الحد المسموح (25 ميغابايت). لم يتغيّر شيء في خرائطك.'], actions: okBtn }); return; }
      var res = parseFile(await readFile(file));
      if (!res.ok) { await ask({ title: 'تعذّر استيراد الملف', lines: [res.msg, 'لم يتغيّر شيء في خرائطك.'], actions: okBtn }); return; }
      var p = res.project, list = await S.list(), ex = list.filter(function (m) { return m.id === p.id; })[0];
      var id = p.id, name = p.name, created = p.created, mode = 'new';
      if (ex) {
        var r = await ask({
          title: 'توجد خريطة محفوظة بنفس المعرّف',
          lines: ['«' + ex.name + '» (آخر تعديل: ' + fmtDate(ex.updated) + ') محفوظة بالفعل، والملف يحوي مشروعاً بنفس المعرّف: «' + p.name + '».', 'الاستبدال يمحو نسخة الخريطة الحالية ويضع محتوى الملف مكانها.'],
          actions: [{ id: 'copy', label: 'حفظ كنسخة جديدة', cls: 'cm-pri', primary: true }, { id: 'replace', label: 'استبدال الموجودة', cls: 'cm-danger' }, { id: 'cancel', label: 'إلغاء' }], focus: 'copy'
        });
        if (r.action === 'cancel') return;
        if (r.action === 'replace') { mode = 'replace'; created = ex.created; }
        else { mode = 'copy'; id = U.uid('m'); name = cleanName(p.name + ' (مستورد)'); }
      }
      var meta = buildMeta(id, name, created, Date.now(), p.doc), replacingCur = mode === 'replace' && cur && cur.id === id;
      if (replacingCur) { clearTimers(); dirty = false; viewDirty = false; }
      try { await S.put(meta, p.doc); }
      catch (err) { if (replacingCur) mark(true); throw err; }
      if (replacingCur) applyDoc(meta, p.doc);
      await renderList(id);
      api.say('تم استيراد «' + name + '»' + (mode === 'replace' ? ' (استُبدلت النسخة الموجودة)' : ''));
    }

    /* ------------------------------------------------------------ الأحداث */
    rootEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mm]'); if (!b || b.disabled) return;
      var act = b.dataset.mm, card = b.closest('[data-mid]'), id = card ? card.dataset.mid : null;
      switch (act) {
        case 'manager': guarded(openManager); break;
        case 'close': closeManager(); break;
        case 'new': guarded(newProject); break;
        case 'import': fileIn.click(); break;
        case 'open': if (id) guarded(function () { return openProject(id); }); break;
        case 'rename': if (id) guarded(function () { return renameProject(id); }); break;
        case 'dup': if (id) guarded(function () { return duplicateProject(id); }); break;
        case 'export': if (id) guarded(function () { return exportProject(id); }); break;
        case 'del': if (id) guarded(function () { return deleteProject(id); }); break;
        case 'exportcur': exportCurrent(); break;
        case 'bannerx': hideBanner(); break;
        case 'retry':
          guarded(async function () {
            if (!S.ok) {
              boot.hidden = false;
              try { await bootstrap(true); } catch (err) { bootFail(err); } finally { boot.hidden = true; }
              if (!mm.hidden) await renderList();
            } else { retryN = 0; if (!(await flushAll())) throw new Error('save'); }
          });
          break;
      }
    });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0]; fileIn.value = '';
      if (f) guarded(function () { return importFile(f); });
    });

    /* لوحة المفاتيح: أثناء فتح «خرائطي» أو نافذة التأكيد أو شاشة الاستعادة لا تصل الاختصارات (حذف/تراجع...) إلى الخريطة خلفها */
    window.addEventListener('keydown', function (e) {
      var dOpen = !dlgEl.hidden, mOpen = !mm.hidden;
      if (!dOpen && !mOpen && boot.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (dOpen) closeDlg({ action: 'cancel' }); else if (mOpen) closeManager();
        return;
      }
      var tg = e.target, typing = tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName);
      if (e.key === 'Enter' && dOpen && tg && tg.classList && tg.classList.contains('cm-dlgin')) {
        e.preventDefault(); var pb = $('[data-primary="1"]', dlgEl); if (pb) pb.click(); return;
      }
      if (e.key === 'Tab' && (dOpen || mOpen)) {
        var box = dOpen ? dlgEl : mm, fs = $$('button:not([disabled]),input:not([type="file"]):not([disabled])', box).filter(function (x) { return x.offsetParent !== null; });
        if (fs.length) {
          var first = fs[0], last = fs[fs.length - 1];
          if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
          else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        e.stopPropagation(); return;
      }
      if (!typing) e.stopPropagation();
    }, true);

    CM.store.state = function () { return { id: cur && cur.id, ok: S.ok, saving: saving, dirty: dirty, state: state }; };
    CM.store.flush = flushAll;
    void openBtn;
  });
})();
