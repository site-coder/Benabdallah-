/* ==========================================================================
   refs-core.js — محرّك «مولّد المراجع الأكاديمية» (بلا واجهة، بلا إنترنت، بلا API)
   - يحوّل بيانات المرجع إلى نص منسّق وفق: APA 7 · Harvard · MLA · Chicago (حواشي+قائمة / مؤلف-تاريخ)
   - الأنواع: كتاب · مقال علمي · موقع إلكتروني · رسالة/مذكرة · فصل من كتاب · تقرير/دراسة
   - يعمل داخل المتصفح (window.RF) وفي Node للاختبار (module.exports)
   - للتوسعة لاحقاً: أضف نوعاً في TYPES + دالة في كل نمط ضمن FMT، أو نمطاً جديداً في STYLES + FMT
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ أدوات عامة */
  var AR_RE = /[\u0600-\u06FF\u0750-\u077F]/;
  var LAT_RE = /[A-Za-z\u00C0-\u024F]/;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function strip(h) {
    return String(h || '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function trim(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function digits(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 1632; })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return d.charCodeAt(0) - 1776; });
  }
  function isLatin(s) { return LAT_RE.test(s) && !AR_RE.test(s); }
  function J(arr, sep) { return arr.filter(function (x) { return x; }).join(sep == null ? ' ' : sep); }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function I(s) { s = trim(s); return s ? '<i>' + esc(s) + '</i>' : ''; }
  function dot(h) {
    if (!h) return '';
    return /[.?!\u201D\u00BB]$/.test(strip(h)) ? h : h + '.';
  }
  function ltr(s) { return s ? '<bdi dir="ltr">' + esc(s) + '</bdi>' : ''; }

  /* ------------------------------------------------------------------ ثوابت */
  var MONTHS = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  };
  var MON_MLA = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  var AR_LETTERS = 'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ';

  var LBL = {
    en: { c: ',', and: 'and', amp: '&', etal: 'et al.', nd: 'n.d.', vol: 'Vol.', no: 'no.', inCap: 'In', inLow: 'in', avail: 'Available at:', accessed: 'Accessed', retrieved: 'Retrieved', from: 'from', editedBy: 'edited by', ed1: 'Ed.', edN: 'Eds.', ed1l: 'ed.', edNl: 'eds.', p: 'p.', pp: 'pp.', no_: 'No.' },
    ar: { c: '،', and: 'و', amp: 'و', etal: 'وآخرون', nd: 'د.ت.', vol: 'مج.', no: 'ع.', inCap: 'في', inLow: 'في', avail: 'متاح على:', accessed: 'تاريخ الاطلاع:', retrieved: 'تم الاسترجاع في', from: 'من', editedBy: 'تحرير', ed1: 'محرر', edN: 'محررون', ed1l: 'محرر', edNl: 'محررون', p: 'ص.', pp: 'ص ص.', no_: 'رقم' }
  };

  var LEVELS = {
    licence: { ar: 'مذكرة ليسانس', en: "Bachelor's thesis", enApa: "Bachelor's thesis", enHar: "Bachelor's dissertation", enMla: "Bachelor's thesis", enChi: "Bachelor's thesis" },
    master: { ar: 'مذكرة ماستر', en: "Master's thesis", enApa: "Master's thesis", enHar: "Master's thesis", enMla: "Master's thesis", enChi: "Master's thesis" },
    magister: { ar: 'رسالة ماجستير', en: "Master's thesis", enApa: "Master's thesis", enHar: "Master's thesis", enMla: "Master's thesis", enChi: "Master's thesis" },
    phd: { ar: 'أطروحة دكتوراه', en: 'Doctoral dissertation', enApa: 'Doctoral dissertation', enHar: 'PhD thesis', enMla: 'PhD dissertation', enChi: 'PhD diss.' }
  };
  var KINDS = {
    report: { ar: 'تقرير', en: 'Report' },
    study: { ar: 'دراسة', en: 'Study' },
    working: { ar: 'ورقة عمل', en: 'Working paper' }
  };

  /* ------------------------------------------------------------------ تعريف الأنماط والأنواع (تستعملها الواجهة) */
  var STYLES = {
    apa: { label: 'APA 7', full: 'APA — الإصدار السابع', family: 'ad' },
    harvard: { label: 'Harvard', full: 'Harvard (Cite Them Right)', family: 'ad' },
    mla: { label: 'MLA', full: 'MLA — الإصدار التاسع', family: 'mla' },
    'chicago-nb': { label: 'Chicago', full: 'Chicago 17 — حواشي وقائمة مراجع', family: 'nb' },
    'chicago-ad': { label: 'Chicago', full: 'Chicago 17 — مؤلف وتاريخ', family: 'ad' }
  };
  /* مفاتيح الاختيار الرئيسية في الواجهة (Chicago له خيار فرعي) */
  var STYLE_GROUPS = [
    { id: 'apa', label: 'APA 7', keys: ['apa'] },
    { id: 'harvard', label: 'Harvard', keys: ['harvard'] },
    { id: 'mla', label: 'MLA', keys: ['mla'] },
    { id: 'chicago', label: 'Chicago', keys: ['chicago-nb', 'chicago-ad'] }
  ];

  var COMMON = {
    year: { k: 'year', l: 'سنة النشر', ph: 'مثال: 2023 (اتركها فارغة إن لم تتوفر)', dir: 'ltr', inputmode: 'numeric' },
    doi: { k: 'doi', l: 'DOI (اختياري)', ph: '10.1234/abcd', dir: 'ltr', wide: 1 },
    url: { k: 'url', l: 'الرابط (اختياري)', ph: 'https://...', dir: 'ltr', wide: 1 },
    accessed: { k: 'accessed', l: 'تاريخ الاطلاع (اختياري)', kind: 'date' }
  };
  function F(base, over) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in over) o[k] = over[k]; return o; }

  var TYPES = {
    book: {
      label: 'كتاب', icon: 'book', authors: { label: 'المؤلفون', req: true },
      fields: [
        { k: 'title', l: 'عنوان الكتاب', req: 1, wide: 1 },
        { k: 'edition', l: 'الطبعة (اختياري)', ph: 'مثال: 2' },
        { k: 'volume', l: 'المجلد / الجزء (اختياري)', ph: 'مثال: 3' },
        { k: 'publisher', l: 'دار النشر', ph: 'مثال: دار الفكر' },
        { k: 'place', l: 'مكان النشر (اختياري)', ph: 'مثال: القاهرة' },
        COMMON.year, COMMON.doi, COMMON.url, COMMON.accessed
      ]
    },
    article: {
      label: 'مقال علمي', icon: 'article', authors: { label: 'المؤلفون', req: true },
      fields: [
        { k: 'title', l: 'عنوان المقال', req: 1, wide: 1 },
        { k: 'container', l: 'اسم المجلة', req: 1, wide: 1 },
        COMMON.year,
        { k: 'volume', l: 'المجلد (اختياري)', ph: 'مثال: 12', dir: 'ltr' },
        { k: 'issue', l: 'العدد (اختياري)', ph: 'مثال: 3', dir: 'ltr' },
        { k: 'pages', l: 'الصفحات (اختياري)', ph: 'مثال: 15-32', dir: 'ltr' },
        COMMON.doi, COMMON.url, COMMON.accessed
      ]
    },
    website: {
      label: 'موقع إلكتروني', icon: 'web', authors: { label: 'الكاتب (اختياري)', req: false },
      fields: [
        { k: 'title', l: 'عنوان الصفحة', req: 1, wide: 1 },
        { k: 'container', l: 'اسم الموقع (اختياري)', wide: 1 },
        COMMON.year,
        { k: 'month', l: 'الشهر (اختياري)', kind: 'month' },
        { k: 'day', l: 'اليوم (اختياري)', ph: '1–31', dir: 'ltr', inputmode: 'numeric' },
        { k: 'url', l: 'الرابط', req: 1, ph: 'https://...', dir: 'ltr', wide: 1 },
        COMMON.accessed
      ]
    },
    thesis: {
      label: 'رسالة / مذكرة جامعية', icon: 'cap', authors: { label: 'الباحث', req: true },
      fields: [
        { k: 'title', l: 'عنوان المذكرة / الأطروحة', req: 1, wide: 1 },
        { k: 'level', l: 'المستوى', kind: 'level' },
        { k: 'institution', l: 'الجامعة / المؤسسة', req: 1, ph: 'مثال: جامعة الجزائر 2' },
        COMMON.year, COMMON.url, COMMON.accessed
      ]
    },
    chapter: {
      label: 'فصل من كتاب', icon: 'chapter', authors: { label: 'مؤلفو الفصل', req: true },
      editors: { label: 'محرّرو الكتاب (اختياري)' },
      fields: [
        { k: 'title', l: 'عنوان الفصل', req: 1, wide: 1 },
        { k: 'container', l: 'عنوان الكتاب', req: 1, wide: 1 },
        { k: 'edition', l: 'الطبعة (اختياري)', ph: 'مثال: 2' },
        { k: 'volume', l: 'المجلد / الجزء (اختياري)', ph: 'مثال: 3' },
        { k: 'pages', l: 'صفحات الفصل (اختياري)', ph: 'مثال: 45-78', dir: 'ltr' },
        { k: 'publisher', l: 'دار النشر', ph: 'مثال: دار الفكر' },
        { k: 'place', l: 'مكان النشر (اختياري)', ph: 'مثال: بيروت' },
        COMMON.year, COMMON.doi, COMMON.url, COMMON.accessed
      ]
    },
    report: {
      label: 'تقرير / دراسة', icon: 'report', authors: { label: 'المؤلفون (اختياري)', req: false },
      fields: [
        { k: 'title', l: 'عنوان التقرير / الدراسة', req: 1, wide: 1 },
        { k: 'kind', l: 'النوع', kind: 'kind' },
        { k: 'reportNo', l: 'رقم التقرير (اختياري)', ph: 'مثال: 12', dir: 'ltr' },
        { k: 'publisher', l: 'الجهة المصدرة', ph: 'مثال: اليونسكو' },
        { k: 'place', l: 'مكان النشر (اختياري)', ph: 'مثال: باريس' },
        COMMON.year, COMMON.doi, COMMON.url, COMMON.accessed
      ]
    }
  };
  var TYPE_ORDER = ['book', 'article', 'website', 'thesis', 'chapter', 'report'];

  /* ------------------------------------------------------------------ تنظيف البيانات */
  var NUMERIC = { year: 1, volume: 1, issue: 1, pages: 1, day: 1, edition: 1, reportNo: 1, month: 1 };
  function newRef(type) {
    return { id: uid(), type: TYPES[type] ? type : 'book', lang: 'auto', orgMode: false, org: '', authors: [{ family: '', given: '' }], editors: [], f: {}, created: Date.now(), updated: Date.now() };
  }
  function cleanPeople(a) {
    if (!Array.isArray(a)) return [];
    return a.map(function (p) { return { family: trim(p && p.family), given: trim(p && p.given) }; });
  }
  /* يُستعمل عند القراءة من التخزين وقبل الحفظ: يضمن شكلاً سليماً ويُسقط الصفوف الفارغة */
  function sanitize(r, dropEmpty) {
    r = r && typeof r === 'object' ? r : {};
    var o = newRef(TYPES[r.type] ? r.type : 'book');
    o.id = typeof r.id === 'string' && r.id ? r.id : o.id;
    o.lang = r.lang === 'ar' || r.lang === 'en' ? r.lang : 'auto';
    o.orgMode = !!r.orgMode;
    o.org = trim(r.org);
    o.authors = cleanPeople(r.authors);
    o.editors = cleanPeople(r.editors);
    if (dropEmpty) {
      o.authors = o.authors.filter(function (p) { return p.family || p.given; });
      o.editors = o.editors.filter(function (p) { return p.family || p.given; });
    } else if (!o.authors.length) o.authors = [{ family: '', given: '' }];
    var f = r.f && typeof r.f === 'object' ? r.f : {};
    Object.keys(f).forEach(function (k) {
      var v = f[k];
      if (typeof v !== 'string' && typeof v !== 'number') return;
      v = trim(v);
      if (NUMERIC[k]) v = digits(v);
      o.f[k] = v;
    });
    o.created = +r.created || o.created;
    o.updated = +r.updated || o.updated;
    return o;
  }

  function normDoi(s) {
    s = trim(s);
    if (!s) return '';
    s = s.replace(/^doi:\s*/i, '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    return /^10\.\S+/.test(s) ? 'https://doi.org/' + s : '';
  }
  function normUrl(s) {
    s = trim(s);
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    return s;
  }

  /* ------------------------------------------------------------------ التحقق */
  function hasAuthor(r) {
    if (r.orgMode) return !!trim(r.org);
    return r.authors.some(function (p) { return p.family || p.given; });
  }
  function validate(r) {
    var e = {}, T = TYPES[r.type], f = r.f || {};
    if (T.authors && T.authors.req && !hasAuthor(r)) e.authors = r.orgMode ? 'أدخل اسم الجهة.' : 'أدخل لقب المؤلف على الأقل.';
    else if (!r.orgMode) {
      var bad = r.authors.some(function (p) { return !p.family && p.given; });
      if (bad) e.authors = 'أدخل لقب كل مؤلف (اسم العائلة).';
    }
    T.fields.forEach(function (d) { if (d.req && !trim(f[d.k])) e[d.k] = 'هذا الحقل مطلوب.'; });
    if (trim(f.year) && !/(^|\D)\d{4}(\D|$)/.test(f.year) && !/^(n\.?d\.?|د\.?ت\.?)$/i.test(trim(f.year))) e.year = 'أدخل السنة بأربعة أرقام (مثال: 2023) أو اتركها فارغة.';
    if (trim(f.doi) && !normDoi(f.doi)) e.doi = 'صيغة DOI غير صحيحة (يبدأ بـ 10.).';
    if (trim(f.day) && !(/^\d{1,2}$/.test(f.day) && +f.day >= 1 && +f.day <= 31)) e.day = 'اليوم بين 1 و 31.';
    return { ok: !Object.keys(e).length, errors: e };
  }

  /* ------------------------------------------------------------------ لغة المرجع */
  function resolveLang(r) {
    if (r.lang === 'ar' || r.lang === 'en') return r.lang;
    var f = r.f || {};
    var probe = trim(f.title) || trim(f.container) || trim(r.org) || (r.authors[0] && (r.authors[0].family || r.authors[0].given)) || '';
    return AR_RE.test(probe) ? 'ar' : 'en';
  }

  /* ------------------------------------------------------------------ الأحرف الكبيرة للعناوين اللاتينية (لا تُصغِّر أبداً، تكبّر فقط) */
  var MINOR = /^(a|an|the|and|but|or|nor|for|so|yet|as|at|by|in|of|off|on|per|to|up|via|with|from|into|onto|over|than|vs\.?|upon)$/i;
  function headline(s) {
    var words = s.split(' ');
    var n = words.length, afterBreak = true;
    return words.map(function (w, i) {
      var core = w.replace(/^[^A-Za-z\u00C0-\u024F]+/, '');
      var out = w;
      if (core) {
        var first = i === 0 || i === n - 1 || afterBreak;
        var lowerStart = core.charAt(0) === core.charAt(0).toLowerCase() && core.charAt(0) !== core.charAt(0).toUpperCase();
        if (lowerStart && (first || !MINOR.test(core.replace(/[^A-Za-z.]+$/, '')))) {
          var cut = w.length - core.length;
          out = w.slice(0, cut) + core.charAt(0).toUpperCase() + core.slice(1);
        }
      }
      afterBreak = /[:?!\u2014\u2013]$/.test(w);
      return out;
    }).join(' ');
  }

  /* ------------------------------------------------------------------ الأسماء */
  function initials(given, sep) {
    var out = [];
    given.split(/\s+/).filter(Boolean).forEach(function (t) {
      if (t.indexOf('.') > -1) {
        t.split('.').filter(Boolean).forEach(function (p) { out.push(p.charAt(0).toUpperCase() + '.'); });
      } else if (/^[A-Z]{2,3}$/.test(t)) {
        t.split('').forEach(function (ch) { out.push(ch + '.'); });
      } else {
        out.push(t.split('-').map(function (p) {
          var ch = p.replace(/^[^A-Za-z\u00C0-\u024F]+/, '').charAt(0);
          return ch ? ch.toUpperCase() + '.' : '';
        }).filter(Boolean).join('-'));
      }
    });
    return out.join(sep);
  }
  /* mode: init (J. A.) · initc (J.A.) · full */
  function givenOf(p, mode) {
    if (!p.given) return '';
    if (mode === 'full' || !isLatin(p.given)) return p.given;
    return initials(p.given, mode === 'initc' ? '' : ' ');
  }
  function inverted(p, mode, C) {
    var g = givenOf(p, mode);
    return esc(p.family) + (g ? C + ' ' + esc(g) : '');
  }
  function direct(p, mode) {
    var g = givenOf(p, mode);
    return esc(g ? g + ' ' + p.family : p.family);
  }
  function joinNames(arr, conj, C, serial2, serial3) {
    var sp = conj === 'و' ? '' : ' '; /* واو العطف تلتصق بالكلمة التي بعدها */
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + (serial2 ? C : '') + ' ' + conj + sp + arr[1];
    return arr.slice(0, -1).join(C + ' ') + (serial3 ? C : '') + ' ' + conj + sp + arr[arr.length - 1];
  }

  /* ------------------------------------------------------------------ سياق التنسيق */
  function makeCtx(ref, opts, suffix) {
    opts = opts || {};
    var lang = resolveLang(ref), L = LBL[lang], f = ref.f || {};
    var c = { ref: ref, f: f, lang: lang, L: L, C: L.c, ar: lang === 'ar', tc: opts.titleCase !== false, suffix: suffix || '' };
    c.people = ref.orgMode ? [] : ref.authors.filter(function (p) { return p.family; });
    c.editorsList = (ref.editors || []).filter(function (p) { return p.family; });
    c.org = ref.orgMode ? trim(ref.org) : '';
    c.hasAuth = !!(c.org || c.people.length);

    c.v = function (k) { return trim(f[k]); };
    c.cap = function (s, mode) { /* mode: head → عنوان بحالة Title Case */
      s = trim(s);
      return mode === 'head' && c.tc && isLatin(s) ? headline(s) : s;
    };
    c.container = function () { return c.cap(f.container, 'head'); };           /* اسم مجلة / موقع */
    c.bookTitle = function (headline) { return headline ? c.cap(f.container, 'head') : trim(f.container); }; /* عنوان كتاب */
    c.yearRaw = function () {
      var y = c.v('year');
      if (!y || /^(n\.?d\.?|د\.?ت\.?)$/i.test(y)) return '';
      return y;
    };
    c.year = function () {
      var y = c.yearRaw();
      if (!y) return L.nd + (c.suffix ? '-' + c.suffix : '');
      return y + c.suffix;
    };
    c.doi = function () { return normDoi(f.doi); };
    c.url = function () { return normUrl(f.url); };
    c.edTxt = function (kind) {
      var e = trim(digits(f.edition));
      if (!e) return '';
      if (c.ar) {
        e = e.replace(/^(الطبعة|ط)\.?\s*/, '');
        return /^(1|الأولى|الاولى)$/.test(e) ? '' : 'ط. ' + e;
      }
      e = e.replace(/\s*(edition|edn\.?|ed\.?)$/i, '');
      if (/^(1|1st|first)$/i.test(e)) return '';
      if (/^\d+$/.test(e)) {
        var n = +e, m = n % 100, d = n % 10;
        e = n + (m >= 11 && m <= 13 ? 'th' : d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th');
      }
      return e + (kind === 'edn' ? ' edn.' : ' ed.');
    };
    c.volTxt = function () {
      var v = trim(digits(f.volume));
      if (!v) return '';
      v = v.replace(c.ar ? /^(مج|المجلد|ج|الجزء)\.?\s*/ : /^vol(ume)?\.?\s*/i, '');
      return L.vol + ' ' + v;
    };
    c.pagesNorm = function () {
      var p = trim(digits(f.pages));
      return p ? p.replace(/\s*[-\u2013\u2014]+\s*/g, '\u2013') : '';
    };
    c.pagesPref = function () { /* pp. 1–20 / p. 5 */
      var p = c.pagesNorm();
      if (!p) return '';
      return (/[\u2013,]/.test(p) ? L.pp : L.p) + ' ' + p;
    };
    c.monthName = function (m, mode) {
      var i = +m - 1;
      if (!(i >= 0 && i < 12)) return '';
      if (c.ar) return MONTHS.ar[i];
      return mode === 'abbr' ? MON_MLA[i] : MONTHS.en[i];
    };
    /* تاريخ النشر الكامل: year / month / day */
    c.pubDate = function (style) {
      var y = c.yearRaw(), m = c.v('month'), d = c.v('day');
      var mn = m ? c.monthName(m, style === 'mla' ? 'abbr' : 'full') : '';
      if (!y) return '';
      if (!mn) return y;
      var dd = d ? +d : 0;
      if (c.ar) return style === 'apa' ? y + '، ' + (dd ? dd + ' ' : '') + mn : (dd ? dd + ' ' : '') + mn + ' ' + y;
      if (style === 'apa') return y + ', ' + mn + (dd ? ' ' + dd : '');
      if (style === 'mla') return (dd ? dd + ' ' : '') + mn + ' ' + y;
      return mn + (dd ? ' ' + dd + ',' : '') + ' ' + y; /* chicago */
    };
    c.accDate = function (style) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.v('accessed'));
      if (!m) return '';
      var y = m[1], mi = +m[2] - 1, d = +m[3];
      if (mi < 0 || mi > 11) return '';
      if (c.ar) return d + ' ' + MONTHS.ar[mi] + ' ' + y;
      if (style === 'harvard') return d + ' ' + MONTHS.en[mi] + ' ' + y;
      if (style === 'mla') return d + ' ' + MON_MLA[mi] + ' ' + y;
      return MONTHS.en[mi] + ' ' + d + ', ' + y;
    };
    /* عنوان مقتبس: الإنجليزية داخل علامتين، العربية «» والترقيم خارجهما */
    c.quote = function (s, punct, single) {
      if (!s) return '';
      var endsP = /[.?!]$/.test(s);
      if (single) return c.ar ? '«' + esc(s) + '»' : '\u2018' + esc(s) + '\u2019';
      if (c.ar) return '«' + esc(s) + '»' + (!endsP && punct ? punct : '');
      return '\u201C' + esc(s) + (!endsP && punct ? punct : '') + '\u201D';
    };
    c.link = function (kind) {
      /* kind: full (APA/Chicago) · bare (MLA يحذف https://) */
      var d = c.doi(), u = d || c.url();
      if (!u) return '';
      return ltr(kind === 'bare' && !d ? u.replace(/^https?:\/\//i, '') : u);
    };
    c.authorPlain = function () {
      if (c.org) return c.org;
      return c.people.map(function (p) { return p.family; }).join(' ');
    };
    c.level = function (style) {
      var lv = LEVELS[c.v('level')] || LEVELS.master;
      if (c.ar) return lv.ar;
      return lv[{ apa: 'enApa', harvard: 'enHar', mla: 'enMla', chicago: 'enChi' }[style]] || lv.en;
    };
    c.kind = function () { var k = KINDS[c.v('kind')] || KINDS.report; return c.ar ? k.ar : k.en; };
    c.reportNo = function () {
      var n = c.v('reportNo');
      if (!n) return '';
      return c.kind() + ' ' + L.no_ + ' ' + n;
    };
    return c;
  }

  /* ------------------------------------------------------------------ قوائم الأسماء لكل نمط */
  function namesApa(c) {
    if (c.org) return esc(c.org);
    var P = c.people, L = c.L;
    if (!P.length) return '';
    var arr = P.map(function (p) { return inverted(p, 'init', c.C); });
    if (arr.length > 20) return arr.slice(0, 19).join(c.C + ' ') + c.C + ' . . . ' + arr[arr.length - 1];
    return joinNames(arr, c.ar ? L.and : L.amp, c.C, true, true);
  }
  function editorsApa(c) { /* الأحرف الأولى قبل اللقب: J. Smith (Ed.) */
    var E = c.editorsList, L = c.L;
    if (!E.length) return '';
    var arr = E.map(function (p) { return direct(p, 'init'); });
    return joinNames(arr, c.ar ? L.and : L.amp, c.C, false, true) + ' (' + (E.length > 1 ? L.edN : L.ed1) + ')';
  }
  function namesHarvard(c) {
    if (c.org) return esc(c.org);
    var P = c.people, L = c.L;
    if (!P.length) return '';
    if (P.length >= 4) return inverted(P[0], 'initc', c.C) + ' ' + (c.ar ? L.etal : 'et al.');
    return joinNames(P.map(function (p) { return inverted(p, 'initc', c.C); }), L.and, c.C, false, false);
  }
  function editorsHarvard(c) {
    var E = c.editorsList, L = c.L;
    if (!E.length) return '';
    var s = E.length >= 4 ? inverted(E[0], 'initc', c.C) + ' ' + L.etal
      : joinNames(E.map(function (p) { return inverted(p, 'initc', c.C); }), L.and, c.C, false, false);
    return s + ' (' + (E.length > 1 ? L.edNl : L.ed1l) + ')';
  }
  function namesMla(c) {
    if (c.org) return esc(c.org);
    var P = c.people, L = c.L;
    if (!P.length) return '';
    if (P.length >= 3) return inverted(P[0], 'full', c.C) + c.C + ' ' + L.etal;
    if (P.length === 2) return inverted(P[0], 'full', c.C) + c.C + ' ' + L.and + (c.ar ? '' : ' ') + direct(P[1], 'full');
    return inverted(P[0], 'full', c.C);
  }
  function editorsMla(c) { /* edited by A and B */
    var E = c.editorsList, L = c.L;
    if (!E.length) return '';
    if (E.length >= 3) return L.editedBy + ' ' + direct(E[0], 'full') + ' ' + L.etal;
    return L.editedBy + ' ' + joinNames(E.map(function (p) { return direct(p, 'full'); }), L.and, c.C, false, false);
  }
  function namesChicago(c) { /* قائمة المراجع */
    if (c.org) return esc(c.org);
    var P = c.people, L = c.L;
    if (!P.length) return '';
    var arr = P.map(function (p, i) { return i === 0 ? inverted(p, 'full', c.C) : direct(p, 'full'); });
    if (arr.length > 10) return arr.slice(0, 7).join(c.C + ' ') + c.C + ' ' + L.etal;
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(c.C + ' ') + c.C + ' ' + L.and + (c.ar ? '' : ' ') + arr[arr.length - 1];
  }
  function namesChicagoNote(c) { /* الحاشية: الاسم بالترتيب العادي */
    if (c.org) return esc(c.org);
    var P = c.people, L = c.L;
    if (!P.length) return '';
    if (P.length >= 4) return direct(P[0], 'full') + ' ' + L.etal;
    return joinNames(P.map(function (p) { return direct(p, 'full'); }), L.and, c.C, false, true);
  }
  function editorsChicago(c, abbr) { /* edited by A and B  |  ed. A and B */
    var E = c.editorsList, L = c.L;
    if (!E.length) return '';
    var s = E.length >= 4 ? direct(E[0], 'full') + ' ' + L.etal
      : joinNames(E.map(function (p) { return direct(p, 'full'); }), L.and, c.C, false, true);
    return (abbr ? (c.ar ? L.editedBy : 'ed.') : L.editedBy) + ' ' + s;
  }

  /* ------------------------------------------------------------------ مساعدات التجميع */
  function placePub(c) {
    var pl = c.v('place'), pb = c.v('publisher');
    if (pl && pb) return esc(pl) + ': ' + esc(pb);
    return esc(pb || pl);
  }

  /* ================================================================== APA 7 */
  /* الهيكل: المؤلف. (السنة). العنوان. الناشر. الرابط   — دون مؤلف: يتقدّم العنوان */
  function apaAssemble(c, ttlHtml, rest, dateTxt) {
    var y = '(' + esc(dateTxt || c.year()) + ').';
    var head = c.hasAuth ? [dot(namesApa(c)), y, dot(ttlHtml)] : [dot(ttlHtml), y];
    return J(head.concat(rest));
  }
  function apaLink(c) {
    var d = c.doi(), u = d || c.url();
    if (!u) return '';
    var acc = !d && c.accDate('apa');
    if (acc) return esc(c.L.retrieved) + ' ' + esc(acc) + c.C + ' ' + esc(c.L.from) + ' ' + ltr(u);
    return ltr(u);
  }
  var APA = {
    book: function (c) {
      var meta = J([c.edTxt('ed'), c.volTxt()], c.C + ' ');
      var ttl = I(c.v('title')) + (meta ? ' (' + esc(meta) + ')' : '');
      var pub = c.v('publisher') && c.v('publisher') !== c.authorPlain() ? dot(esc(c.v('publisher'))) : '';
      return apaAssemble(c, ttl, [pub, apaLink(c)]);
    },
    article: function (c) {
      var src = I(c.container()) + (c.v('volume') ? c.C + ' ' + I(digits(c.v('volume'))) : '') +
        (c.v('issue') ? '(' + esc(c.v('issue')) + ')' : '') + (c.pagesNorm() ? c.C + ' ' + esc(c.pagesNorm()) : '');
      return apaAssemble(c, esc(c.v('title')), [dot(src), apaLink(c)]);
    },
    website: function (c) {
      var site = c.v('container') && c.v('container') !== c.authorPlain() ? dot(esc(c.cap(c.v('container'), 'head'))) : '';
      return apaAssemble(c, I(c.v('title')), [site, apaLink(c)], c.pubDate('apa') ? c.pubDate('apa') + c.suffix : null);
    },
    thesis: function (c) {
      var inst = c.v('institution');
      var ttl = I(c.v('title')) + ' [' + esc(c.level('apa') + (inst ? c.C + ' ' + inst : '')) + ']';
      return apaAssemble(c, ttl, [apaLink(c)]);
    },
    chapter: function (c) {
      var meta = J([c.edTxt('ed'), c.volTxt(), c.pagesPref()], c.C + ' ');
      var ed = editorsApa(c);
      var book = I(c.bookTitle(false)) + (meta ? ' (' + esc(meta) + ')' : '');
      var inn = esc(c.L.inCap) + ' ' + (ed ? ed + c.C + ' ' : '') + book;
      var pub = c.v('publisher') && c.v('publisher') !== c.authorPlain() ? dot(esc(c.v('publisher'))) : '';
      return apaAssemble(c, esc(c.v('title')), [dot(inn), pub, apaLink(c)]);
    },
    report: function (c) {
      var no = c.reportNo();
      var ttl = I(c.v('title')) + (no ? ' (' + esc(no) + ')' : '');
      var pub = c.v('publisher') && c.v('publisher') !== c.authorPlain() ? dot(esc(c.v('publisher'))) : '';
      return apaAssemble(c, ttl, [pub, apaLink(c)]);
    }
  };

  /* ================================================================== Harvard (Cite Them Right) */
  /* الهيكل: المؤلف (السنة) العنوان. الطبعة. المكان: الناشر. Available at: URL (Accessed: date). */
  function hvAvail(c) {
    var d = c.doi(), u = d || c.url();
    if (!u) return '';
    var acc = !d && c.accDate('harvard');
    var s = esc(c.L.avail) + ' ' + ltr(u);
    if (acc) s += ' (' + esc(c.ar ? c.L.accessed : 'Accessed:') + ' ' + esc(acc) + ')';
    return s + (c.ar ? '' : '.');
  }
  function hvHead(c, ttlHtml, isQuoted) {
    /* يعيد [المقدمة, هل العنوان مستهلك داخلها] */
    if (c.hasAuth) return { lead: namesHarvard(c) + ' (' + esc(c.year()) + ')', titleDone: false };
    return { lead: ttlHtml + ' (' + esc(c.year()) + ')', titleDone: true };
  }
  var HARVARD = {
    book: function (c) {
      var t = I(c.v('title'));
      var h = hvHead(c, t);
      var parts = [h.lead + (h.titleDone ? '' : ' ' + t) + '.'];
      parts.push(dot(esc(c.edTxt('edn'))), dot(esc(c.volTxt())), dot(placePub(c)), hvAvail(c));
      return J(parts);
    },
    article: function (c) {
      var t = c.quote(c.v('title'), '', true);
      var src = I(c.container()) + (c.v('volume') ? c.C + ' ' + esc(c.v('volume')) + (c.v('issue') ? '(' + esc(c.v('issue')) + ')' : '') : (c.v('issue') ? c.C + ' (' + esc(c.v('issue')) + ')' : '')) +
        (c.pagesNorm() ? c.C + ' ' + esc(c.pagesPref()) : '');
      var lead = c.hasAuth ? namesHarvard(c) + ' (' + esc(c.year()) + ') ' + t + c.C : t + ' (' + esc(c.year()) + ')';
      return J([lead, dot(src), hvAvail(c)]);
    },
    website: function (c) {
      var t = I(c.v('title'));
      var h = hvHead(c, t);
      var site = c.v('container') && c.v('container') !== c.authorPlain() ? dot(esc(c.cap(c.v('container'), 'head'))) : '';
      return J([h.lead + (h.titleDone ? '' : ' ' + t) + '.', site, hvAvail(c)]);
    },
    thesis: function (c) {
      var t = I(c.v('title'));
      var h = hvHead(c, t);
      return J([h.lead + (h.titleDone ? '' : ' ' + t) + '.', dot(esc(c.level('harvard'))), dot(esc(c.v('institution'))), hvAvail(c)]);
    },
    chapter: function (c) {
      var t = c.quote(c.v('title'), '', true);
      var ed = editorsHarvard(c);
      var lead = c.hasAuth ? namesHarvard(c) + ' (' + esc(c.year()) + ') ' + t + c.C : t + ' (' + esc(c.year()) + ')';
      var inn = esc(c.L.inLow) + ' ' + (ed ? ed + ' ' : '') + I(c.bookTitle(false)) + '.';
      return J([lead, inn, dot(esc(c.edTxt('edn'))), dot(esc(c.volTxt())),
        (function () { var pp = c.pagesNorm() ? esc(c.pagesPref()) : ''; var pl = placePub(c); return pl && pp ? pl + c.C + ' ' + pp + '.' : dot(pl || pp); })(),
        hvAvail(c)]);
    },
    report: function (c) {
      var t = I(c.v('title'));
      var h = hvHead(c, t);
      return J([h.lead + (h.titleDone ? '' : ' ' + t) + '.', dot(esc(c.reportNo())), dot(placePub(c)), hvAvail(c)]);
    }
  };

  /* ================================================================== MLA 9 */
  /* الهيكل: المؤلف. العنوان. الحاوية، التفاصيل، الناشر، التاريخ، المكان. */
  function mlaAuthorHtml(c) {
    if (c.org && c.v('container') && c.org === c.v('container')) return '';
    return dot(namesMla(c));
  }
  function mlaLink(c) {
    var l = c.link('bare');
    return l ? l + '.' : '';
  }
  function mlaAcc(c) {
    var a = c.accDate('mla');
    return a ? esc(c.ar ? c.L.accessed : c.L.accessed) + ' ' + esc(a) + '.' : '';
  }
  var MLA = {
    book: function (c) {
      var core = J([esc(c.edTxt('ed')), esc(c.volTxt()), esc(c.v('publisher')), esc(c.yearRaw() || '')], c.C + ' ');
      return J([mlaAuthorHtml(c), dot(I(c.cap(c.v('title'), 'head'))), core ? core + '.' : '', mlaLink(c), mlaAcc(c)]);
    },
    article: function (c) {
      var core = J([I(c.container()), c.v('volume') ? esc(c.L.vol.replace('Vol.', 'vol.') + ' ' + c.v('volume')) : '', c.v('issue') ? esc(c.L.no + ' ' + c.v('issue')) : '', esc(c.yearRaw() || ''), c.pagesNorm() ? esc(c.pagesPref()) : ''], c.C + ' ');
      return J([mlaAuthorHtml(c), c.quote(c.cap(c.v('title'), 'head'), '.'), core ? core + '.' : '', mlaLink(c), mlaAcc(c)]);
    },
    website: function (c) {
      var site = c.v('container') ? I(c.cap(c.v('container'), 'head')) : '';
      var core = J([site, esc(c.pubDate('mla')), c.link('bare')], c.C + ' ');
      return J([mlaAuthorHtml(c), c.quote(c.cap(c.v('title'), 'head'), '.'), core ? core + '.' : '', mlaAcc(c)]);
    },
    thesis: function (c) {
      var tail = J([esc(c.v('institution')), esc(c.level('mla'))], c.C + ' ');
      return J([mlaAuthorHtml(c), dot(I(c.cap(c.v('title'), 'head'))), c.yearRaw() ? esc(c.yearRaw()) + '.' : '', tail ? dot(tail) : '', mlaLink(c), mlaAcc(c)]);
    },
    chapter: function (c) {
      var core = J([I(c.bookTitle(true)), editorsMla(c), esc(c.edTxt('ed')), esc(c.volTxt()), esc(c.v('publisher')), esc(c.yearRaw() || ''), c.pagesNorm() ? esc(c.pagesPref()) : ''], c.C + ' ');
      return J([mlaAuthorHtml(c), c.quote(c.cap(c.v('title'), 'head'), '.'), core ? core + '.' : '', mlaLink(c), mlaAcc(c)]);
    },
    report: function (c) {
      var core = J([esc(c.reportNo()), esc(c.v('publisher')), esc(c.yearRaw() || '')], c.C + ' ');
      return J([mlaAuthorHtml(c), dot(I(c.cap(c.v('title'), 'head'))), core ? core + '.' : '', mlaLink(c), mlaAcc(c)]);
    }
  };

  /* ================================================================== Chicago 17 — مؤلف/تاريخ */
  function chLink(c) {
    var l = c.link('full');
    return l ? l + '.' : '';
  }
  function chAcc(c) {
    var a = c.accDate('chicago');
    return a ? esc(c.ar ? c.L.accessed : c.L.accessed) + ' ' + esc(a) + '.' : '';
  }
  function chAdAssemble(c, ttlHtml, rest) {
    /* A. Y. Title. ...   |   دون مؤلف: Title. Y. ... */
    return c.hasAuth ? J([dot(namesChicago(c)), dot(esc(c.year())), dot(ttlHtml)].concat(rest))
      : J([dot(ttlHtml), dot(esc(c.year()))].concat(rest));
  }
  var CHICAGO_AD = {
    book: function (c) {
      var t = I(c.cap(c.v('title'), 'head'));
      return chAdAssemble(c, t, [dot(esc(c.edTxt('ed'))), dot(esc(c.volTxt())), dot(placePub(c)), chLink(c), chAcc(c)]);
    },
    article: function (c) {
      var vi = c.v('volume') ? esc(c.v('volume')) + (c.v('issue') ? ' (' + esc(c.v('issue')) + ')' : '') : (c.v('issue') ? '(' + esc(c.v('issue')) + ')' : '');
      var src = I(c.container()) + (vi ? ' ' + vi : '') + (c.pagesNorm() ? ': ' + esc(c.pagesNorm()) : '');
      return chAdAssemble(c, c.quote(c.cap(c.v('title'), 'head'), '.'), [dot(src), chLink(c), chAcc(c)]);
    },
    website: function (c) {
      var site = c.v('container') && c.v('container') !== c.authorPlain() ? dot(esc(c.cap(c.v('container'), 'head'))) : '';
      var pd = c.pubDate('chicago');
      return chAdAssemble(c, c.quote(c.cap(c.v('title'), 'head'), '.'), [site, pd && c.v('month') ? dot(esc(pd)) : '', chAcc(c), chLink(c)]);
    },
    thesis: function (c) {
      var tail = J([c.level('chicago') ? esc(c.level('chicago')) : '', esc(c.v('institution'))], c.C + ' ');
      return chAdAssemble(c, c.quote(c.cap(c.v('title'), 'head'), '.'), [dot(tail), chLink(c), chAcc(c)]);
    },
    chapter: function (c) {
      var ed = editorsChicago(c, false);
      var pg = c.pagesNorm();
      var inn = esc(c.L.inCap) + ' ' + J([I(c.bookTitle(true)), esc(c.edTxt('ed')), esc(c.volTxt()), ed, pg ? esc(pg) : ''], c.C + ' ');
      return chAdAssemble(c, c.quote(c.cap(c.v('title'), 'head'), '.'), [dot(inn), dot(placePub(c)), chLink(c), chAcc(c)]);
    },
    report: function (c) {
      var t = I(c.cap(c.v('title'), 'head'));
      return chAdAssemble(c, t, [dot(esc(c.reportNo())), dot(placePub(c)), chLink(c), chAcc(c)]);
    }
  };

  /* ================================================================== Chicago 17 — حواشي وقائمة مراجع */
  function pubYear(c, pl) { /* (Place: Publisher, Year) */
    var s = J([placePub(c), esc(c.yearRaw() || (c.ar ? c.L.nd : c.L.nd))], c.C + ' ');
    return s;
  }
  function nbAssemble(c, parts) { return J(parts); }
  var CHICAGO_NB = {
    book: function (c) {
      var t = I(c.cap(c.v('title'), 'head'));
      var tail = J([esc(c.edTxt('ed')), esc(c.volTxt())], c.C + ' ');
      var bib = (function () {
        var lead = c.hasAuth ? [dot(namesChicago(c)), dot(t)] : [dot(t)];
        return J(lead.concat([dot(esc(c.edTxt('ed'))), dot(esc(c.volTxt())), dot(pubYear(c)), chLink(c), chAcc(c)]));
      })();
      var note = (c.hasAuth ? namesChicagoNote(c) + c.C + ' ' : '') + t + (tail ? c.C + ' ' + tail : '') + ' (' + pubYear(c) + ')' + notePg(c) + chNoteLink(c) + '.';
      return { bib: bib, note: note };
    },
    article: function (c) {
      var t = c.quote(c.cap(c.v('title'), 'head'), '.');
      var tn = c.quote(c.cap(c.v('title'), 'head'), c.C);
      var vol = c.v('volume'), iss = c.v('issue');
      var vi = vol ? esc(vol) + (iss ? c.C + ' ' + esc(c.L.no) + ' ' + esc(iss) : '') : (iss ? esc(c.L.no) + ' ' + esc(iss) : '');
      var yr = c.yearRaw() ? '(' + esc(c.yearRaw()) + ')' : '(' + esc(c.L.nd) + ')';
      var pg = c.pagesNorm();
      var bibSrc = I(c.container()) + (vi ? ' ' + vi : '') + ' ' + yr + (pg ? ': ' + esc(pg) : '');
      var lead = c.hasAuth ? [dot(namesChicago(c)), t] : [t];
      var bib = J(lead.concat([dot(bibSrc), chLink(c), chAcc(c)]));
      var noteSrc = I(c.container()) + (vi ? ' ' + vi : '') + ' ' + yr + (c.notePage ? ': ' + esc(c.notePage) : (pg ? ': ' + esc(pg) : ''));
      var note = (c.hasAuth ? namesChicagoNote(c) + c.C + ' ' : '') + tn + ' ' + noteSrc + chNoteLink(c) + '.';
      return { bib: bib, note: note };
    },
    website: function (c) {
      var t = c.quote(c.cap(c.v('title'), 'head'), '.');
      var tn = c.quote(c.cap(c.v('title'), 'head'), c.C);
      var site = c.v('container') && c.v('container') !== c.authorPlain() ? c.cap(c.v('container'), 'head') : '';
      var pd = c.pubDate('chicago');
      var lead = c.hasAuth ? [dot(namesChicago(c)), t] : [t];
      var bib = J(lead.concat([site ? dot(esc(site)) : '', pd ? dot(esc(pd)) : '', chAcc(c), chLink(c)]));
      var noteTail = J([site ? esc(site) : '', pd ? esc(pd) : '', c.notePage ? esc(c.notePage) : '', c.link('full')], c.C + ' ');
      var note = (c.hasAuth ? namesChicagoNote(c) + c.C + ' ' : '') + tn + (noteTail ? ' ' + noteTail : '') + '.';
      return { bib: bib, note: note };
    },
    thesis: function (c) {
      var t = c.quote(c.cap(c.v('title'), 'head'), '.');
      var tn = c.quote(c.cap(c.v('title'), 'head'), '');
      var tail = J([esc(c.level('chicago')), esc(c.v('institution')), c.yearRaw() ? esc(c.yearRaw()) : ''], c.C + ' ');
      var lead = c.hasAuth ? [dot(namesChicago(c)), t] : [t];
      var bib = J(lead.concat([dot(tail), chLink(c), chAcc(c)]));
      var note = (c.hasAuth ? namesChicagoNote(c) + c.C + ' ' : '') + tn + ' (' + tail + ')' + notePg(c) + chNoteLink(c) + '.';
      return { bib: bib, note: note };
    },
    chapter: function (c) {
      var t = c.quote(c.cap(c.v('title'), 'head'), '.');
      var tn = c.quote(c.cap(c.v('title'), 'head'), c.C);
      var pg = c.pagesNorm();
      var edB = editorsChicago(c, false), edN = editorsChicago(c, true);
      var bibIn = esc(c.L.inCap) + ' ' + J([I(c.bookTitle(true)), esc(c.edTxt('ed')), esc(c.volTxt()), edB, pg ? esc(pg) : ''], c.C + ' ');
      var lead = c.hasAuth ? [dot(namesChicago(c)), t] : [t];
      var bib = J(lead.concat([dot(bibIn), dot(pubYear(c)), chLink(c), chAcc(c)]));
      var noteIn = esc(c.L.inLow) + ' ' + J([I(c.bookTitle(true)), esc(c.edTxt('ed')), esc(c.volTxt()), edN], c.C + ' ');
      var note = (c.hasAuth ? namesChicagoNote(c) + c.C + ' ' : '') + tn + ' ' + noteIn + ' (' + pubYear(c) + ')' + notePg(c) + chNoteLink(c) + '.';
      return { bib: bib, note: note };
    },
    report: function (c) {
      var t = I(c.cap(c.v('title'), 'head'));
      var rn = c.reportNo();
      var lead = c.hasAuth ? [dot(namesChicago(c)), dot(t)] : [dot(t)];
      var bib = J(lead.concat([dot(esc(rn)), dot(pubYear(c)), chLink(c), chAcc(c)]));
      var note = (c.hasAuth ? namesChicagoNote(c) + c.C + ' ' : '') + t + (rn ? c.C + ' ' + esc(rn) : '') + ' (' + pubYear(c) + ')' + notePg(c) + chNoteLink(c) + '.';
      return { bib: bib, note: note };
    }
  };
  function chNoteLink(c) { var l = c.link('full'); return l ? c.C + ' ' + l : ''; }
  function notePg(c) { return c.notePage ? c.C + ' ' + esc(c.notePage) : ''; } /* ، 15 بعد القوس */
  function chNbFix(h) { return h.replace(/\.\.$/, '.'); }

  var FMT = {
    apa: APA, harvard: HARVARD, mla: MLA, 'chicago-ad': CHICAGO_AD, 'chicago-nb': CHICAGO_NB
  };

  /* ------------------------------------------------------------------ واجهة التنسيق العامة */
  function format(ref, style, opts, suffix, notePage) {
    var r = sanitize(ref, true);
    if (!FMT[style]) style = 'apa';
    var c = makeCtx(r, opts, suffix);
    if (notePage) c.notePage = notePage; /* رقم الصفحة المقتبس منها: يُدرج في الحاشية فقط (Chicago حواشي) */
    var out = FMT[style][r.type](c), html, note = '';
    if (typeof out === 'object') { html = out.bib; note = chNbFix(out.note); }
    else html = out;
    html = chNbFix(html);
    return {
      id: r.id, lang: c.lang, dir: c.ar ? 'rtl' : 'ltr',
      html: html, text: strip(html),
      noteHtml: note, noteText: strip(note)
    };
  }

  /* ------------------------------------------------------------------ ترتيب + تمييز المؤلف/السنة المتطابقين (a, b, ج…) */
  function sortKey(r) {
    var rr = sanitize(r, true), s;
    if (rr.orgMode && rr.org) s = rr.org;
    else if (rr.authors.length && rr.authors[0].family) s = rr.authors[0].family + ' ' + (rr.authors[0].given || '');
    else s = rr.f.title || '';
    s = trim(s).toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/^ال(?=\S)/, '');
    return s;
  }
  var collator = (function () { try { return new Intl.Collator(['ar', 'en'], { sensitivity: 'base', numeric: true }); } catch (e) { return { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } }; } })();
  function sortItems(items, mode) {
    var arr = items.slice();
    if (mode === 'added') return arr.sort(function (a, b) { return (a.created || 0) - (b.created || 0); });
    if (mode === 'recent') return arr.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    return arr.sort(function (a, b) {
      var d = collator.compare(sortKey(a), sortKey(b));
      if (d) return d;
      var ya = trim((a.f || {}).year), yb = trim((b.f || {}).year);
      d = collator.compare(ya, yb);
      return d || collator.compare(trim((a.f || {}).title), trim((b.f || {}).title));
    });
  }
  /* حروف التمييز (a, b / أ، ب) للمؤلف والسنة المتطابقين؛ مشتركة بين القائمة والتوثيق داخل النص */
  function suffixMap(sorted, opts) {
    var suffix = {}, groups = {};
    sorted.forEach(function (r) {
      var c = makeCtx(sanitize(r, true), opts);
      var key = (c.org || c.people.map(function (p) { return p.family + '|' + p.given; }).join(';') || ('T:' + trim(c.f.title))).toLowerCase() + '#' + c.yearRaw();
      (groups[key] = groups[key] || []).push(r);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2) return;
      g.sort(function (a, b) { return collator.compare(trim((a.f || {}).title), trim((b.f || {}).title)); });
      g.forEach(function (r, i) {
        var ar = resolveLang(sanitize(r, true)) === 'ar';
        suffix[r.id] = ar ? AR_LETTERS.charAt(i % AR_LETTERS.length) : String.fromCharCode(97 + (i % 26));
      });
    });
    return suffix;
  }
  function formatList(items, style, opts) {
    var fam = STYLES[style] ? STYLES[style].family : 'ad';
    var sorted = sortItems(items, (opts && opts.sort) || 'alpha');
    var suffix = fam === 'ad' ? suffixMap(sorted, opts) : {};
    return sorted.map(function (r) { var o = format(r, style, opts, suffix[r.id]); o.ref = r; return o; });
  }

  /* ------------------------------------------------------------------ النص الغني للنسخ (Word يحافظ على المائل والاتجاه) */
  function clipboardHtml(results) {
    return results.map(function (o) {
      return '<p dir="' + o.dir + '" style="text-align:' + (o.dir === 'rtl' ? 'right' : 'left') + ';margin:0 0 8pt">' + o.html + '</p>';
    }).join('');
  }

  /* نسخة مضمّنة (بلا فقرة) تُلصق داخل سطر الكتابة في Word دون فصل الجملة */
  function clipboardInline(results) {
    return results.map(function (o) {
      return '<span dir="' + o.dir + '">' + o.html + '</span>';
    }).join(' ');
  }

  /* ================================================================== التوثيق داخل النص (In-text citation) */
  /* يُشتقّ دائماً من بيانات المرجع المحفوظ نفسها (لا إدخال مكرَّر)، ويتبع لغة المرجع وعدد مؤلفيه وقواعد كل نمط:
     APA 7 (اللقب، السنة) · Harvard (اللقب، السنة) · MLA (اللقب صفحة) · Chicago مؤلف-تاريخ (اللقب السنة، صفحة)
     Chicago حواشي: حاشية كاملة + حاشية مختصرة + المرجع في قائمة المراجع */
  var CITE_ITALIC = { /* أنواع تُكتب عناوينها مائلة في قائمة المراجع بكل نمط (وإلا تُوضع بين علامتين) */
    apa: { book: 1, website: 1, thesis: 1, report: 1 },
    harvard: { book: 1, website: 1, thesis: 1, report: 1 },
    mla: { book: 1, thesis: 1, report: 1 },
    chicago: { book: 1, report: 1 }
  };
  function citeFam(style) { return style === 'chicago-nb' || style === 'chicago-ad' ? 'chicago' : style; }

  /* رقم الصفحة: أرقام عربية→لاتينية، شرطة طويلة للمدى، أو أرقام رومانية، أو قائمة (15, 18) */
  function normPage(s) {
    return trim(digits(s)).replace(/\u060C/g, ',').replace(/\s*[-\u2013\u2014]+\s*/g, '\u2013').replace(/\s*,\s*/g, ', ');
  }
  function validPage(p) { return /^(\d+|[ivxlcdm]+)((\u2013|, )(\d+|[ivxlcdm]+))*$/i.test(p); }

  /* ألقاب المؤلفين فقط، حسب عددهم في كل نمط */
  function citeNames(c, fam) {
    if (c.org) return esc(c.org);
    var P = c.people, L = c.L;
    if (!P.length) return '';
    var arr = P.map(function (p) { return esc(p.family); });
    var etal = arr[0] + ' ' + L.etal;
    if (fam === 'apa') return arr.length >= 3 ? etal : joinNames(arr, c.ar ? L.and : '&amp;', c.C, false, false);
    if (fam === 'harvard') return arr.length >= 4 ? etal : joinNames(arr, L.and, c.C, false, false);
    if (fam === 'mla') return arr.length >= 3 ? etal : joinNames(arr, L.and, c.C, false, false);
    return arr.length >= 4 ? etal : joinNames(arr, L.and, c.C, false, !c.ar); /* Chicago: ثلاثة بفاصلة تسلسلية */
  }
  /* عنوان مختصر (للمرجع بلا مؤلف وللحاشية المختصرة): ما قبل النقطتين، وبحدّ أقصى أربع كلمات */
  function shortTitle(c) {
    var s = c.cap(c.v('title'), 'head').split(/:\s|\s[\u2013\u2014]\s/)[0], w = s.split(' ');
    if (w.length > 4) {
      w = w.slice(0, 4);
      while (w.length > 1 && MINOR.test(w[w.length - 1].replace(/[^A-Za-z.]+$/, ''))) w.pop(); /* لا ينتهي بحرف جر/عطف */
      s = w.join(' ');
    }
    return s.replace(/[,.;:\s]+$/, '');
  }
  function citeTitle(c, fam, punct) {
    var s = shortTitle(c);
    punct = punct || '';
    if (CITE_ITALIC[fam][c.ref.type]) return I(s) + punct;
    if (fam === 'harvard') return c.quote(s, '', true) + punct;
    return c.quote(s, punct);
  }
  function citePageTxt(c, fam, pg) {
    if (!pg) return '';
    if (fam === 'apa' || fam === 'harvard') return esc((/[\u2013,]/.test(pg) ? c.L.pp : c.L.p) + ' ' + pg);
    return esc(pg);
  }
  function buildParen(c, style, pg, ctx) {
    var fam = citeFam(style), has = c.hasAuth, au = has ? citeNames(c, fam) : '';
    var pt = citePageTxt(c, fam, pg), yr = esc(c.year()), C = c.C, inner;
    if (fam === 'apa' || fam === 'harvard') {
      inner = (has ? au + C + ' ' : citeTitle(c, fam, C) + ' ') + yr + (pt ? C + ' ' + pt : '');
    } else if (fam === 'mla') {
      if (has && ctx && ctx.mlaTitle) inner = au + C + ' ' + citeTitle(c, fam, pt ? C : '') + (pt ? ' ' + pt : ''); /* عدة أعمال للمؤلف نفسه */
      else inner = (has ? au : citeTitle(c, fam, '')) + (pt ? ' ' + pt : '');
    } else {
      inner = (has ? au : citeTitle(c, fam, '')) + ' ' + yr + (pt ? C + ' ' + pt : '');
    }
    return '(' + inner + ')';
  }
  function buildShortNote(c, pg) { /* Chicago: Smith, Short Title, 15. */
    var au = c.hasAuth ? citeNames(c, 'chicago') : '', pgp = pg ? esc(pg) : '';
    if (CITE_ITALIC.chicago[c.ref.type]) return J([au, I(shortTitle(c)), pgp], c.C + ' ') + '.';
    var q = c.quote(shortTitle(c), pg ? c.C : '.');
    return (au ? au + c.C + ' ' : '') + q + (pg ? ' ' + pgp + '.' : '');
  }

  /* سياق القائمة: حروف تمييز السنة (a/b) كما في قائمة المراجع، وتنبيه MLA لتعدّد أعمال المؤلف */
  function citeContext(items, style, opts) {
    var fam = STYLES[style] ? STYLES[style].family : 'ad', out = {};
    var suffix = fam === 'ad' ? suffixMap(sortItems(items, (opts && opts.sort) || 'alpha'), opts) : {};
    items.forEach(function (r) { out[r.id] = { suffix: suffix[r.id] || '' }; });
    if (style === 'mla') {
      var key = {}, cnt = {};
      items.forEach(function (r) {
        var c = makeCtx(sanitize(r, true), opts);
        var k = (c.org || c.people.map(function (p) { return p.family + '|' + p.given; }).join(';')).toLowerCase();
        key[r.id] = k;
        if (k) cnt[k] = (cnt[k] || 0) + 1;
      });
      items.forEach(function (r) { if (key[r.id] && cnt[key[r.id]] > 1) out[r.id].mlaTitle = true; });
    }
    return out;
  }

  /* kind: 'normal' | 'direct' (الأخير يتطلب page). ctx: من citeContext()[ref.id] */
  function cite(ref, style, kind, page, opts, ctx) {
    if (!FMT[style]) style = 'apa';
    kind = kind === 'direct' ? 'direct' : 'normal';
    var r = sanitize(ref, true), c = makeCtx(r, opts, ctx && ctx.suffix), pg = '';
    var res = { id: r.id, style: style, kind: kind, lang: c.lang, dir: c.ar ? 'rtl' : 'ltr', ok: true, empty: false, error: '', parts: [] };
    function part(key, label, html, block) { res.parts.push({ key: key, label: label, html: html, text: strip(html), block: !!block }); }
    if (kind === 'direct') {
      pg = normPage(page);
      if (!pg) { res.ok = false; res.empty = true; res.error = 'أدخل رقم الصفحة المقتبس منها ليظهر التوثيق.'; return res; }
      if (!validPage(pg)) { res.ok = false; res.error = 'أدخل رقم الصفحة بصيغة صحيحة، مثال: 15 أو 15-18.'; return res; }
    }
    if (!c.hasAuth && !trim(r.f.title)) { res.ok = false; res.error = 'بيانات المرجع غير كافية لإنشاء التوثيق.'; return res; }
    if (style === 'chicago-nb') {
      var f = format(r, 'chicago-nb', opts, undefined, pg);
      part('note', 'الحاشية السفلية (عند أول استشهاد)', f.noteHtml);
      part('short', 'الحاشية المختصرة (عند تكرار الاستشهاد)', buildShortNote(c, pg));
      part('bib', 'المرجع في قائمة المراجع', f.html, true);
    } else {
      part('main', kind === 'direct' ? 'التوثيق داخل النص (اقتباس مباشر)' : 'التوثيق داخل النص', '<bdi dir="' + res.dir + '">' + buildParen(c, style, pg, ctx) + '</bdi>');
    }
    return res;
  }

  return {
    TYPES: TYPES, TYPE_ORDER: TYPE_ORDER, STYLES: STYLES, STYLE_GROUPS: STYLE_GROUPS,
    LEVELS: LEVELS, KINDS: KINDS, MONTHS: MONTHS,
    newRef: newRef, sanitize: sanitize, validate: validate, hasAuthor: hasAuthor,
    format: format, formatList: formatList, sortItems: sortItems, clipboardHtml: clipboardHtml,
    cite: cite, citeContext: citeContext, clipboardInline: clipboardInline, normPage: normPage,
    resolveLang: resolveLang, strip: strip, esc: esc, uid: uid, F: F
  };
});
