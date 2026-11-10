/* ==========================================================================
   refs-projects.js — مشاريع البحث في «مولّد المراجع الأكاديمية» (بلا واجهة، بلا حسابات، بلا خادم)
   - كل مشروع: اسم + قائمة مراجع + نمط توثيق وإعدادات مستقلة (style, chicago, sort, titleCase, exp)
   - الحفظ في localStorage فقط (المفتاح tl_refs_projects_v1)، مع ترحيل تلقائي لبيانات النسخة القديمة tl_refs_v1
     (المفتاح القديم لا يُحذف ولا يُعدَّل، فيبقى نسخة أمان)
   - نسخة احتياطية JSON + استيراد مع تحقق كامل ودمج آمن: لا استبدال لمشروع موجود إلا بموافقة صريحة
   - يعمل في المتصفح (RF.proj) وفي Node للاختبار
   ========================================================================== */
(function (root) {
  'use strict';
  var RF = root.RF;
  if (!RF) return;
  var P = RF.proj = {};

  var KEY = 'tl_refs_projects_v1', LEGACY = 'tl_refs_v1', FORMAT = 'tl-refs-projects', FORMAT_V = 1;
  var MAX_NAME = 80, MAX_BYTES = 8 * 1024 * 1024, MAX_PROJECTS = 500;
  P.KEY = KEY; P.FORMAT = FORMAT; P.MAX_NAME = MAX_NAME; P.MAX_BYTES = MAX_BYTES;

  /* ------------------------------------------------------------------ أدوات */
  function now() { return Date.now(); }
  function newId() { return 'p' + now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function num(v) { v = +v; return isFinite(v) && v > 0 ? v : 0; }
  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function rawGet(k) { try { var s = ls(); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function rawSet(k, v) { try { var s = ls(); if (!s) return false; s.setItem(k, v); return true; } catch (e) { return false; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cleanName(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  }
  function nameTaken(store, name, exceptId) {
    var k = name.toLowerCase();
    return store.projects.some(function (p) { return p.id !== exceptId && p.name.toLowerCase() === k; });
  }
  function uniqueName(store, base, exceptId) {
    base = cleanName(base) || 'مشروع';
    if (!nameTaken(store, base, exceptId)) return base;
    for (var i = 2; i < 10000; i++) {
      var cand = cleanName(base.slice(0, MAX_NAME - 8) + ' (' + i + ')');
      if (!nameTaken(store, cand, exceptId)) return cand;
    }
    return base + ' ' + newId();
  }

  /* ------------------------------------------------------------------ تنظيف المراجع والمشاريع */
  /* strict=true (للاستيراد): يُسقط ما ليس مرجعاً صالحاً بدل إصلاحه صامتاً؛ يُرجع {items, dropped} */
  function cleanItems(arr, strict) {
    var out = [], seen = {}, dropped = 0;
    (Array.isArray(arr) ? arr : []).forEach(function (r) {
      if (!isObj(r) || (strict && !RF.TYPES[r.type])) { dropped++; return; }
      var o;
      try { o = RF.sanitize(r, true); } catch (e) { dropped++; return; }
      if (!o || !RF.TYPES[o.type]) { dropped++; return; }
      while (!o.id || seen[o.id]) o.id = RF.uid();
      seen[o.id] = 1; out.push(o);
    });
    return { items: out, dropped: dropped };
  }
  function cleanProject(p, strict) {
    p = isObj(p) ? p : {};
    var c = cleanItems(p.items, strict), t = now();
    var style = RF.STYLES[p.style] ? p.style : 'apa';
    var o = {
      id: typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.id) ? p.id : newId(),
      name: cleanName(p.name) || 'مشروع بدون اسم',
      created: num(p.created) || t, updated: num(p.updated) || t,
      style: style,
      chicago: p.chicago === 'chicago-ad' ? 'chicago-ad' : 'chicago-nb',
      sort: p.sort === 'added' || p.sort === 'recent' ? p.sort : 'alpha',
      titleCase: p.titleCase !== false,
      exp: { hang: !isObj(p.exp) || p.exp.hang !== false, split: isObj(p.exp) && p.exp.split === true },
      items: c.items
    };
    if (style.indexOf('chicago') === 0) o.chicago = style;
    o.dropped = c.dropped;
    return o;
  }

  /* ------------------------------------------------------------------ التحميل / الحفظ */
  P.defaultProject = function (name) { var p = cleanProject({ name: name || 'مشروعي الأول' }); delete p.dropped; return p; };
  P.save = function (store) {
    try { return rawSet(KEY, JSON.stringify(store)); } catch (e) { return false; }
  };
  P.active = function (store) {
    for (var i = 0; i < store.projects.length; i++) if (store.projects[i].id === store.active) return store.projects[i];
    return store.projects[0];
  };
  P.load = function () {
    var s = rawGet(KEY), raw = null, store = { v: 1, active: '', projects: [] }, changed = false;
    if (s != null) { try { raw = JSON.parse(s); } catch (e) { raw = null; } }
    if (raw && Array.isArray(raw.projects) && raw.projects.length) {
      var ids = {};
      raw.projects.forEach(function (p) {
        if (!isObj(p)) return;
        var c = cleanProject(p, false); delete c.dropped;
        while (ids[c.id]) c.id = newId();
        ids[c.id] = 1; store.projects.push(c);
      });
      store.active = typeof raw.active === 'string' ? raw.active : '';
    } else {
      if (s != null && !(raw && Array.isArray(raw.projects))) rawSet(KEY + '_corrupt', s); /* ملف تالف: نحتفظ بنسخة قبل أي كتابة */
      var old = null;
      try { old = JSON.parse(rawGet(LEGACY)); } catch (e) { old = null; }
      if (isObj(old)) {
        if (!isObj(old.exp)) { try { var ex = JSON.parse(rawGet('tl_refs_exp_v1')); if (isObj(ex)) old.exp = ex; } catch (e) { /* إعدادات التصدير القديمة اختيارية */ } }
        var m = cleanProject(old, false); delete m.dropped; m.name = 'مراجعي'; store.projects.push(m); }
      changed = true;
    }
    if (!store.projects.length) { store.projects.push(P.defaultProject()); changed = true; }
    var act = P.active(store);
    if (store.active !== act.id) { store.active = act.id; changed = true; }
    if (changed) P.save(store);
    return store;
  };

  /* ------------------------------------------------------------------ إنشاء / إعادة تسمية / حذف */
  P.checkName = function (store, name, exceptId) {
    var n = cleanName(name);
    if (!n) return { ok: false, error: 'اكتب اسماً للمشروع.' };
    if (nameTaken(store, n, exceptId)) return { ok: false, error: 'يوجد مشروع بهذا الاسم، اختر اسماً مختلفاً.' };
    return { ok: true, name: n };
  };
  P.create = function (store, name) {
    var c = P.checkName(store, name);
    if (!c.ok) return c;
    if (store.projects.length >= MAX_PROJECTS) return { ok: false, error: 'بلغتَ الحد الأقصى لعدد المشاريع على هذا الجهاز (' + MAX_PROJECTS + ').' };
    var p = P.defaultProject(c.name);
    store.projects.push(p);
    return { ok: true, project: p };
  };
  P.rename = function (store, id, name) {
    var c = P.checkName(store, name, id);
    if (!c.ok) return c;
    for (var i = 0; i < store.projects.length; i++) if (store.projects[i].id === id) {
      store.projects[i].name = c.name; store.projects[i].updated = now();
      return { ok: true, project: store.projects[i] };
    }
    return { ok: false, error: 'المشروع غير موجود.' };
  };
  /* يحذف المشروع؛ إن كان آخر مشروع يُنشأ مشروع فارغ بديل حتى لا تبقى الأداة بلا مشروع */
  P.remove = function (store, id) {
    store.projects = store.projects.filter(function (p) { return p.id !== id; });
    if (!store.projects.length) store.projects.push(P.defaultProject());
    if (!store.projects.some(function (p) { return p.id === store.active; })) store.active = store.projects[0].id;
    return store;
  };

  /* ------------------------------------------------------------------ نسخة احتياطية */
  P.backup = function (store) {
    return {
      app: FORMAT, format: FORMAT_V, exported: new Date().toISOString(), count: store.projects.length,
      projects: store.projects.map(function (p) {
        return { id: p.id, name: p.name, created: p.created, updated: p.updated, style: p.style, chicago: p.chicago, sort: p.sort, titleCase: p.titleCase, exp: p.exp, items: p.items };
      })
    };
  };
  P.backupJson = function (store) { return JSON.stringify(P.backup(store), null, 2); };

  /* ------------------------------------------------------------------ التحقق من ملف الاستيراد (لا يغيّر أي بيانات) */
  P.parseBackup = function (text) {
    function bad(m) { return { ok: false, error: m }; }
    if (typeof text !== 'string' || !text.trim()) return bad('الملف فارغ.');
    if (text.length > MAX_BYTES) return bad('الملف كبير جداً (الحد 8 ميغابايت).');
    var obj;
    try { obj = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { return bad('الملف ليس بصيغة JSON صالحة.'); }
    if (!isObj(obj)) return bad('محتوى الملف غير معروف: ليس نسخة احتياطية لهذه الأداة.');
    var list, warnings = [];
    if (obj.app === FORMAT) {
      if (typeof obj.format !== 'number' || obj.format < 1) return bad('رقم إصدار النسخة الاحتياطية غير صالح.');
      if (obj.format > FORMAT_V) return bad('هذه النسخة أُنشئت بإصدار أحدث من الأداة؛ حدّث الموقع أولاً.');
      list = obj.projects;
      if (!Array.isArray(list) || !list.length) return bad('النسخة الاحتياطية لا تحتوي أي مشروع.');
    } else if (Array.isArray(obj.items)) { /* حالة قديمة: قائمة مراجع واحدة بلا مشاريع */
      list = [{ name: 'مشروع مستورد', style: obj.style, chicago: obj.chicago, sort: obj.sort, titleCase: obj.titleCase, items: obj.items }];
      warnings.push('الملف بصيغة قديمة (قائمة واحدة)، وسيُستورد كمشروع واحد.');
    } else return bad('الملف ليس نسخة احتياطية لمولّد المراجع.');
    if (list.length > MAX_PROJECTS) return bad('عدد المشاريع في الملف أكبر من الحد المسموح (' + MAX_PROJECTS + ').');
    var projects = [], ids = {}, total = 0, dropped = 0, skipped = 0;
    list.forEach(function (p) {
      if (!isObj(p)) { skipped++; return; }
      var c = cleanProject(p, true);
      while (ids[c.id]) c.id = newId();
      ids[c.id] = 1; dropped += c.dropped; delete c.dropped; total += c.items.length;
      projects.push(c);
    });
    if (!projects.length) return bad('لا يحتوي الملف أي مشروع صالح.');
    if (skipped) warnings.push('تم تجاهل ' + skipped + ' عنصراً ليس مشروعاً صالحاً.');
    if (dropped) warnings.push('تم تجاهل ' + dropped + ' مرجعاً غير صالح داخل الملف.');
    return { ok: true, projects: projects, total: total, dropped: dropped, warnings: warnings };
  };

  /* ------------------------------------------------------------------ الدمج الآمن */
  /* المشاريع المتعارضة = نفس المعرّف موجود مسبقاً */
  P.conflicts = function (store, incoming) {
    return incoming.filter(function (p) { return store.projects.some(function (e) { return e.id === p.id; }); });
  };
  /* mode: both (الافتراضي: يحتفظ بالنسختين) | replace (يستبدل المطابق) | skip (يتخطاه). يعمل على نسخة ولا يمسّ المخزن الأصلي */
  P.merge = function (store, incoming, mode) {
    var s = clone(store), r = { added: 0, replaced: 0, skipped: 0, items: 0 };
    incoming.forEach(function (p0) {
      var p = clone(p0), idx = -1, i;
      for (i = 0; i < s.projects.length; i++) if (s.projects[i].id === p.id) { idx = i; break; }
      if (idx > -1 && mode === 'skip') { r.skipped++; return; }
      if (idx > -1 && mode === 'replace') {
        p.name = uniqueName(s, p.name, p.id);
        s.projects[idx] = p; r.replaced++; r.items += p.items.length; return;
      }
      if (s.projects.length >= MAX_PROJECTS) { r.skipped++; return; }
      if (idx > -1) { p.id = newId(); p.name = uniqueName(s, p.name + ' (مستورد)'); } /* both */
      else p.name = uniqueName(s, p.name);
      s.projects.push(p); r.added++; r.items += p.items.length;
    });
    r.store = s;
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
