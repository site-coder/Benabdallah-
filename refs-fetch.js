/* ==========================================================================
   refs-fetch.js — جلب بيانات المرجع تلقائياً (إضافة اختيارية فوق «مولّد المراجع الأكاديمية»)
   - مقال علمي: إدخال DOI ← واجهة Crossref المجانية (api.crossref.org، تدعم CORS)
   - موقع إلكتروني: إدخال رابط ← قراءة وسوم الصفحة (og: / citation_ / dc. / JSON-LD / <title>) من المتصفح مباشرة
   - بلا ذكاء اصطناعي، بلا مفاتيح ولا اشتراكات، بلا خادم خاص بنا
   - لا يحفظ شيئاً: يكتب في «المسودّة» فقط، والحفظ يبقى بزر «إضافة المرجع» في refs-ui.js
   - لا يستبدل قيمة كتبها المستخدم: الحقل الفارغ يُملأ، والمختلف يُعرض للموافقة حقلاً بحقل
   - يعتمد على: RF (refs-core.js) + RF.ui (refs-ui.js: getDraft / refreshForm / on('form'))
   - الدوال الصرفة (التحقق والتحليل) متاحة في RF.fetchTools للاختبار
   ========================================================================== */
(function (root) {
  'use strict';
  var RF = root.RF;
  if (!RF) return;
  var H = RF.fetchTools = {};
  var esc = RF.esc;

  var CROSSREF = 'https://api.crossref.org/works/';
  var PROXY = 'https://api.allorigins.win/raw?url='; /* وسيط مجاني اختياري: لا يُستعمل إلا بضغطة صريحة من المستخدم */
  var TIMEOUT = 15000, MAX_BYTES = 700 * 1024, MAX_AUTHORS = 100;
  var AR_RE = /[\u0600-\u06FF\u0750-\u077F]/;

  function trim(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function norm(s) { return trim(s).toLowerCase(); }
  function cleanText(s) { /* يزيل وسوم HTML/JATS ويفكّ الكيانات (DOMParser لا ينفّذ سكربتات ولا يحمّل صوراً) */
    s = String(s == null ? '' : s);
    try {
      if (typeof DOMParser === 'undefined') throw 0;
      s = new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html').body.textContent || '';
    } catch (e) {
      s = s.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    }
    return trim(s);
  }

  /* ======================================================================
     1) التحقق من المدخلات
     ====================================================================== */
  H.parseDoi = function (input) {
    var s = trim(input);
    if (!s) return { ok: false, error: 'أدخل DOI أولاً.' };
    s = s.replace(/^doi:\s*/i, '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    try { s = decodeURIComponent(s); } catch (e) { /* نُبقيه كما هو */ }
    s = s.replace(/[.,;]+$/, '');
    if (!/^10\.\d{4,9}\/\S+$/.test(s)) {
      return { ok: false, error: 'صيغة DOI غير صحيحة. يبدأ بـ 10. ثم رقم ثم / ثم المعرّف، مثال: 10.1000/xyz123 (يُقبل أيضاً الرابط https://doi.org/…).' };
    }
    return { ok: true, doi: s };
  };

  H.parseUrl = function (input) {
    var s = trim(input), u;
    if (!s) return { ok: false, error: 'أدخل رابط الصفحة أولاً.' };
    if (/\s/.test(s)) return { ok: false, error: 'الرابط لا يجوز أن يحتوي على مسافات.' };
    if (s.length > 2000) return { ok: false, error: 'الرابط طويل جداً.' };
    if (/^(javascript|data|vbscript|file|blob|mailto|tel):/i.test(s) || (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s))) {
      return { ok: false, error: 'يُقبل فقط رابط صفحة ويب يبدأ بـ http:// أو https://' };
    }
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    try { u = new URL(s); } catch (e) { return { ok: false, error: 'صيغة الرابط غير صحيحة، مثال: https://example.com/article' }; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname || u.hostname.indexOf('.') < 1 || /\.$/.test(u.hostname) || u.hostname.charAt(0) === '.') {
      return { ok: false, error: 'صيغة الرابط غير صحيحة، مثال: https://example.com/article' };
    }
    return { ok: true, href: u.href, host: u.hostname, protocol: u.protocol };
  };

  /* ======================================================================
     2) أدوات التحليل: التاريخ والأسماء
     ====================================================================== */
  H.parseDate = function (s) {
    s = trim(s);
    if (!s) return null;
    var m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s), y, mo = 0, d = 0;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{4})[-\/.](\d{1,2})$/.exec(s))) { y = +m[1]; mo = +m[2]; }
    else if ((m = /^(\d{4})$/.exec(s))) { y = +m[1]; }
    else return null;
    if (!(y >= 1800 && y <= new Date().getFullYear() + 1)) return null;
    if (!(mo >= 1 && mo <= 12)) { mo = 0; d = 0; }
    if (!(d >= 1 && d <= 31)) d = 0;
    return { year: String(y), month: mo ? String(mo) : '', day: d ? String(d) : '' };
  };

  H.parseName = function (raw) {
    var n = trim(raw).replace(/^(?:by|بقلم|كتبه|للكاتب|المؤلف)(?:\s*[:：]\s*|\s+)/i, '');
    if (!n) return null;
    if (!AR_RE.test(n) && n.indexOf(',') > 0) { /* Smith, John */
      var p = n.split(',');
      return { family: trim(p[0]), given: trim(p.slice(1).join(' ')) };
    }
    var t = n.split(' ');
    if (AR_RE.test(n) || t.length === 1) return { family: n, given: '' }; /* ترتيب الاسم العربي لا يُخمَّن: يراجعه المستخدم */
    return { family: t[t.length - 1], given: t.slice(0, -1).join(' ') };
  };

  H.splitAuthors = function (list) {
    var out = [], seen = {};
    (list || []).forEach(function (raw) {
      raw = trim(raw);
      if (!raw || raw.length > 160 || /^https?:/i.test(raw) || /^(admin|administrator|staff|editor|editors|editorial team|team|المحرر|فريق التحرير|إدارة الموقع)$/i.test(raw)) return;
      var parts;
      if (/;|\s+(?:and|&)\s+|\s+و\s+|،/.test(raw)) parts = raw.split(/\s*;\s*|\s+(?:and|&)\s+|\s+و\s+|\s*،\s*/);
      else if (!AR_RE.test(raw) && (raw.match(/,/g) || []).length >= 2) parts = raw.split(/\s*,\s*/);
      else parts = [raw];
      parts.forEach(function (x) {
        var p = H.parseName(x);
        if (!p || !p.family) return;
        var k = norm(p.family + '|' + p.given);
        if (seen[k]) return;
        seen[k] = 1; out.push(p);
      });
    });
    return out.slice(0, MAX_AUTHORS);
  };

  /* ======================================================================
     3) Crossref → بيانات المرجع
     ====================================================================== */
  var CR_TYPES = {
    'book-chapter': 'فصل من كتاب', book: 'كتاب', 'proceedings-article': 'ورقة مؤتمر', report: 'تقرير', dissertation: 'أطروحة',
    'posted-content': 'نسخة أولية (Preprint)', 'edited-book': 'كتاب محرَّر', monograph: 'كتاب', 'reference-entry': 'مدخل في مرجع', dataset: 'مجموعة بيانات'
  };
  function crYear(m) {
    var keys = ['issued', 'published-print', 'published-online', 'published', 'created'], i, dp;
    for (i = 0; i < keys.length; i++) {
      dp = m[keys[i]] && m[keys[i]]['date-parts'] && m[keys[i]]['date-parts'][0];
      if (dp && dp[0] && /^\d{4}$/.test(String(dp[0]))) return String(dp[0]);
    }
    return '';
  }
  H.parseCrossref = function (m) {
    m = m || {};
    var out = { fields: {}, authors: [], orgName: '', notes: [], type: m.type || '', hasData: false }, f = out.fields;
    var title = m.title && m.title[0] ? cleanText(m.title[0]) : '';
    var sub = m.subtitle && m.subtitle[0] ? cleanText(m.subtitle[0]) : '';
    if (title && sub && norm(title).indexOf(norm(sub)) < 0) title += ': ' + sub;
    if (title) f.title = title;
    var c = m['container-title'] && m['container-title'][0] ? cleanText(m['container-title'][0]) : '';
    if (c) f.container = c;
    var y = crYear(m); if (y) f.year = y;
    if (m.volume) f.volume = trim(m.volume);
    if (m.issue) f.issue = trim(m.issue);
    if (m.page) f.pages = trim(m.page).replace(/\s+/g, '');
    if (m.DOI) f.doi = trim(m.DOI);

    var persons = [], orgs = [];
    (m.author || []).forEach(function (a) {
      if (!a) return;
      if (a.family) persons.push({ family: cleanText(a.family), given: cleanText(a.given || '') });
      else if (a.name) orgs.push(cleanText(a.name));
    });
    if (persons.length) {
      orgs.forEach(function (o) { persons.push({ family: o, given: '' }); });
      if (persons.length > MAX_AUTHORS) { persons = persons.slice(0, MAX_AUTHORS); out.notes.push('عدد المؤلفين كبير؛ أُخذ أول ' + MAX_AUTHORS + ' فقط.'); }
      out.authors = persons;
    } else if (orgs.length === 1) out.orgName = orgs[0];
    else if (orgs.length > 1) out.authors = orgs.slice(0, MAX_AUTHORS).map(function (o) { return { family: o, given: '' }; });

    if (m.type && m.type !== 'journal-article') {
      out.notes.push('هذا الـ DOI مسجّل كنوع «' + (CR_TYPES[m.type] || m.type) + '» وليس مقالاً في مجلة؛ عُبّئت الحقول المشتركة فقط. إن لزم غيّر نوع المرجع من الأعلى.');
    }
    out.hasData = !!(f.title || out.authors.length || out.orgName);
    return out;
  };

  /* ======================================================================
     4) صفحة ويب → بيانات المرجع (يتطلب DOMParser: متصفح فقط)
     ====================================================================== */
  var AUTHOR_SRC = [['citation_author'], ['author'], ['dc.creator', 'dcterms.creator'], ['article:author'], ['parsely-author', 'sailthru.author']];
  var DATE_SRC = ['article:published_time', 'citation_publication_date', 'citation_date', 'citation_online_date', 'dc.date', 'dc.date.issued',
    'dcterms.created', 'dcterms.issued', 'dcterms.date', 'datepublished', 'date', 'pubdate', 'publish-date', 'publishdate', 'og:pubdate'];

  H.parseHtml = function (html, href) {
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    var map = {};
    Array.prototype.forEach.call(doc.getElementsByTagName('meta'), function (m) {
      var v = trim(m.getAttribute('content'));
      if (!v) return;
      ['name', 'property', 'itemprop'].forEach(function (a) {
        var k = (m.getAttribute(a) || '').toLowerCase();
        if (k) (map[k] = map[k] || []).push(v);
      });
    });
    function first(names) { for (var i = 0; i < names.length; i++) if (map[names[i]]) return map[names[i]][0]; return ''; }
    function all(names) { var o = []; names.forEach(function (n) { if (map[n]) o = o.concat(map[n]); }); return o; }

    /* JSON-LD */
    var ld = [];
    function collect(o) {
      if (!o) return;
      if (Array.isArray(o)) { o.forEach(collect); return; }
      if (typeof o !== 'object') return;
      ld.push(o);
      if (o['@graph']) collect(o['@graph']);
    }
    Array.prototype.forEach.call(doc.querySelectorAll('script[type="application/ld+json"]'), function (s) {
      try { collect(JSON.parse(s.textContent)); } catch (e) { /* JSON غير صالح: يُتجاهل */ }
    });
    function ldType(o) { return [].concat(o['@type'] || []).join(' '); }
    var art = null, site = null;
    ld.forEach(function (o) {
      var t = ldType(o);
      if (!art && /Article|BlogPosting|Report|WebPage|CreativeWork/i.test(t)) art = o;
      if (!site && /WebSite/i.test(t)) site = o;
    });
    function nm(x) { return !x ? '' : typeof x === 'string' ? x : (x.name || ''); }
    var ldAuthors = [];
    if (art && art.author) [].concat(art.author).forEach(function (a) { var n = nm(a); if (n) ldAuthors.push(n); });

    /* العنوان */
    var title = first(['citation_title', 'og:title', 'twitter:title', 'dc.title', 'dcterms.title']) || (art && trim(art.headline || art.name)) || '';
    var fromTag = false;
    if (!title) { title = trim(doc.title); fromTag = true; }

    /* اسم الموقع */
    var siteName = first(['og:site_name', 'application-name']) || nm(site) || (art && nm(art.publisher)) || '';
    siteName = trim(siteName);
    if (fromTag && title && siteName) { /* "عنوان | اسم الموقع" → "عنوان" */
      var re = new RegExp('\\s*[|\\-\\u2013\\u2014\\u00B7:]\\s*' + siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
      title = trim(title.replace(re, '')) || title;
    }
    if (title.length > 300) title = title.slice(0, 300);

    /* الكاتب: أول مصدر يعطي أسماء صالحة */
    var authors = [], i;
    for (i = 0; i < AUTHOR_SRC.length && !authors.length; i++) authors = H.splitAuthors(all(AUTHOR_SRC[i]));
    if (!authors.length) authors = H.splitAuthors(ldAuthors);

    /* تاريخ النشر */
    var date = null, cands = all(DATE_SRC);
    if (art && art.datePublished) cands.push(String(art.datePublished));
    var tm = doc.querySelector('time[itemprop="datePublished"][datetime]');
    if (tm) cands.push(tm.getAttribute('datetime'));
    for (i = 0; i < cands.length && !date; i++) date = H.parseDate(cands[i]);

    var out = { fields: {}, authors: authors, orgName: '', notes: [], hasData: false };
    if (title) out.fields.title = title;
    if (siteName) out.fields.container = siteName;
    if (date) { out.fields.year = date.year; if (date.month) out.fields.month = date.month; if (date.day) out.fields.day = date.day; }
    out.hasData = !!(title || siteName || authors.length || date);
    if (out.hasData && href) out.fields.url = href;
    if (authors.length) out.notes.push('تحقّق من اسم الكاتب: قد يكون جهة (مثل موقع إخباري) لا شخصاً، وقد يحتاج ترتيب اللقب والاسم الأول إلى تصحيح.');
    return out;
  };

  /* ======================================================================
     5) الشبكة
     ====================================================================== */
  function withDeadline(ms, work) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timedOut = false;
    var timer = setTimeout(function () { timedOut = true; if (ctl) ctl.abort(); }, ms);
    return work(ctl ? ctl.signal : undefined).then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); if (timedOut) { var t = new Error('timeout'); t.timeout = true; throw t; } throw e; }
    );
  }
  function baseInit(signal, extra) {
    var o = { signal: signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }, k;
    for (k in extra) o[k] = extra[k];
    return o;
  }
  var MSG_OFFLINE = 'لا يوجد اتصال بالإنترنت. اتصل بالشبكة ثم أعد المحاولة، أو أدخل البيانات يدوياً في الحقول أدناه.';
  var MSG_TIMEOUT = 'انتهت مهلة الاتصال (15 ثانية) دون ردّ. تحقّق من اتصالك وأعد المحاولة، أو أدخل البيانات يدوياً.';

  function fetchDoi(doi) {
    return withDeadline(TIMEOUT, function (signal) {
      return fetch(CROSSREF + encodeURIComponent(doi), baseInit(signal, {})).then(function (r) {
        if (r.status === 404) return { ok: false, msg: 'لم يُعثر على بيانات لهذا الـ DOI في Crossref. تأكد من صحته، وقد يكون مسجّلاً لدى جهة أخرى. يمكنك إدخال البيانات يدوياً.' };
        if (r.status === 429 || r.status >= 500) return { ok: false, msg: 'خدمة Crossref مشغولة أو غير متاحة حالياً. حاول بعد قليل، أو أدخل البيانات يدوياً.' };
        if (!r.ok) return { ok: false, msg: 'ردّت خدمة Crossref بخطأ غير متوقع (' + r.status + '). أدخل البيانات يدوياً أو أعد المحاولة لاحقاً.' };
        return r.json().then(function (j) {
          var res = j && j.message ? H.parseCrossref(j.message) : null;
          if (!res || !res.hasData) return { ok: false, msg: 'وُجد السجل لكنه لا يحتوي بيانات كافية (لا عنوان ولا مؤلفين). أدخل البيانات يدوياً.' };
          return { ok: true, res: res };
        });
      });
    }).catch(function (e) {
      if (e && e.timeout) return { ok: false, msg: MSG_TIMEOUT };
      if (e instanceof TypeError) return { ok: false, msg: 'تعذّر الاتصال بخدمة Crossref. تحقّق من اتصالك بالإنترنت ثم أعد المحاولة، أو أدخل البيانات يدوياً.' };
      return { ok: false, msg: 'تعذّرت معالجة ردّ Crossref. أدخل البيانات يدوياً.' };
    });
  }

  function readHtml(r) {
    var ct = r.headers.get('content-type') || '', cs = /charset=["']?([\w-]+)/i.exec(ct);
    if (!r.body || !r.body.getReader) return r.text().then(function (t) { return t.slice(0, MAX_BYTES); });
    var reader = r.body.getReader(), chunks = [], total = 0;
    function pump() {
      return reader.read().then(function (x) {
        if (x.done) return;
        chunks.push(x.value); total += x.value.length;
        if (total >= MAX_BYTES) { try { reader.cancel(); } catch (e) { /* ignore */ } return; }
        return pump();
      });
    }
    return pump().then(function () {
      var buf = new Uint8Array(total), off = 0;
      chunks.forEach(function (c) { buf.set(c, off); off += c.length; });
      buf = buf.subarray(0, MAX_BYTES);
      var label = cs ? cs[1] : '';
      if (!label) {
        var m = /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(String.fromCharCode.apply(null, buf.subarray(0, 2048)));
        label = m ? m[1] : 'utf-8';
      }
      try { return new TextDecoder(label).decode(buf); } catch (e) { return new TextDecoder('utf-8').decode(buf); }
    });
  }

  function fetchWeb(href, viaProxy) {
    var target = viaProxy ? PROXY + encodeURIComponent(href) : href;
    return withDeadline(TIMEOUT, function (signal) {
      return fetch(target, baseInit(signal, { redirect: 'follow' })).then(function (r) {
        if (!r.ok) {
          var why = r.status === 404 ? 'الصفحة غير موجودة (404). تأكد من الرابط.' :
            (r.status === 401 || r.status === 403) ? 'الموقع يرفض الوصول إلى هذه الصفحة (' + r.status + ').' :
            'ردّ الموقع بخطأ (' + r.status + ').';
          return { ok: false, msg: why + ' يمكنك إدخال البيانات يدوياً.' };
        }
        var ct = r.headers.get('content-type') || '';
        if (ct && !/html|xml/i.test(ct)) return { ok: false, msg: 'الرابط لا يشير إلى صفحة ويب (نوع المحتوى: ' + ct.split(';')[0] + '). أدخل البيانات يدوياً.' };
        return readHtml(r).then(function (html) {
          var res = H.parseHtml(html, href);
          if (!res.hasData) return { ok: false, msg: 'قُرئت الصفحة لكن لم نجد فيها بيانات وصفية (عنوان أو كاتب أو تاريخ). أكمل الحقول يدوياً.' };
          return { ok: true, res: res };
        });
      });
    }).catch(function (e) {
      if (e && e.timeout) return { ok: false, msg: MSG_TIMEOUT };
      if (e instanceof TypeError) {
        if (viaProxy) return { ok: false, msg: 'تعذّر الاتصال بالخدمة الوسيطة (قد تكون متوقفة أو محجوبة). أدخل البيانات يدوياً في الحقول أدناه.' };
        var mixed = /^http:/i.test(href) && root.location && root.location.protocol === 'https:';
        return {
          ok: false, canProxy: true,
          msg: 'تعذّر جلب بيانات هذه الصفحة. أغلب المواقع تمنع المتصفح من قراءة صفحاتها من موقع آخر (سياسة CORS)، وقد يكون السبب انقطاع الاتصال.' +
            (mixed ? ' كما أن الرابط يبدأ بـ http والمتصفح يمنعه من موقع آمن؛ جرّب نسخة https منه.' : '') +
            ' يمكنك إدخال البيانات يدوياً في الحقول أدناه.'
        };
      }
      return { ok: false, msg: 'حدث خطأ غير متوقع أثناء قراءة الصفحة. أدخل البيانات يدوياً.' };
    });
  }

  H.fetchDoi = fetchDoi;
  H.fetchWeb = fetchWeb;

  /* ======================================================================
     6) الواجهة (تعمل فقط داخل المتصفح بعد تحميل refs-ui.js)
     ====================================================================== */
  var ui = RF.ui;
  if (!ui || typeof document === 'undefined') return;

  var S = { draft: null, kind: '', in: { doi: '', web: '' }, err: '', busy: false, status: null, notes: [], conflicts: [], canProxy: false };

  function clearResults() { S.err = ''; S.busy = false; S.status = null; S.notes = []; S.conflicts = []; S.canProxy = false; }
  function lbl(l) { return String(l || '').replace(/\s*\(اختياري\)\s*/, ''); }
  function personText(p) { return p.family + (p.given ? '، ' + p.given : ''); }
  function authText(res) { return res.orgName || res.authors.map(personText).join(' ؛ '); }
  function curAuthText(d) {
    if (d.orgMode) return trim(d.org);
    return d.authors.filter(function (p) { return trim(p.family) || trim(p.given); }).map(function (p) { return personText({ family: trim(p.family), given: trim(p.given) }); }).join(' ؛ ');
  }

  /* مقارنة ما جُلب بما في النموذج: فارغ ← يُملأ، مطابق ← يُتجاهل، مختلف ← تعارض يحتاج موافقة */
  function buildEntries(res) {
    var d = ui.getDraft(), T = RF.TYPES[d.type], list = [];
    if (res.orgName || res.authors.length) {
      list.push({ key: '__au', label: lbl(T.authors && T.authors.label) || 'المؤلفون', value: authText(res), show: authText(res), cur: curAuthText(d), res: res });
    }
    T.fields.forEach(function (fd) {
      var v = res.fields[fd.k];
      if (!v) return;
      list.push({
        key: fd.k, label: lbl(fd.l), value: String(v), cur: trim(d.f[fd.k]),
        show: fd.k === 'month' ? (RF.MONTHS.ar[+v - 1] || v) : String(v)
      });
    });
    list.forEach(function (e) {
      e.curShow = e.key === 'month' && e.cur ? (RF.MONTHS.ar[+e.cur - 1] || e.cur) : e.cur;
      e.state = !e.cur ? 'fill' : (norm(e.cur) === norm(e.value) ? 'same' : 'conflict');
    });
    return list;
  }
  function applyEntry(e) {
    var d = ui.getDraft();
    if (e.key === '__au') {
      if (e.res.orgName) { d.orgMode = true; d.org = e.res.orgName; }
      else { d.orgMode = false; d.authors = e.res.authors.map(function (p) { return { family: p.family, given: p.given }; }); }
    } else d.f[e.key] = e.value;
  }
  function markFilled(entries) { /* تمييز الحقول المعبّأة تلقائياً حتى يعدّلها المستخدم */
    var box = document.getElementById('rfFormBox');
    if (!box) return;
    entries.forEach(function (e) {
      var el = box.querySelector(e.key === '__au' ? '.rf-people[data-fw="authors"]' : '.tl-fld[data-fw="' + e.key + '"]');
      if (!el) return;
      el.classList.add('rf-auto');
      el.addEventListener('input', function () { el.classList.remove('rf-auto'); }, { once: true });
      el.addEventListener('change', function () { el.classList.remove('rf-auto'); }, { once: true });
    });
  }
  function missingLabels(res) {
    var d = ui.getDraft(), T = RF.TYPES[d.type], want = d.type === 'article' ? ['title', 'container', 'year', 'volume', 'issue', 'pages'] : ['title', 'container', 'year'], out = [];
    if (!(res.orgName || res.authors.length)) out.push(d.type === 'website' ? 'الكاتب' : 'المؤلفون');
    want.forEach(function (k) {
      if (res.fields[k]) return;
      T.fields.forEach(function (fd) { if (fd.k === k) out.push(k === 'year' && d.type === 'website' ? 'تاريخ النشر' : lbl(fd.l)); });
    });
    return out;
  }
  function labelsOf(list) { return list.map(function (e) { return e.label; }).join('، '); }

  function showResult(res) {
    var entries = buildEntries(res);
    var fill = entries.filter(function (e) { return e.state === 'fill'; });
    var conf = entries.filter(function (e) { return e.state === 'conflict'; });
    var same = entries.filter(function (e) { return e.state === 'same'; });
    fill.forEach(applyEntry);
    S.conflicts = conf.map(function (e) { e.checked = false; return e; });
    S.notes = res.notes.slice();
    var miss = missingLabels(res), h = '';
    if (fill.length) h += 'تمت تعبئة الحقول الفارغة: <b>' + esc(labelsOf(fill)) + '</b>.';
    else if (!conf.length) h += 'البيانات المجلوبة مطابقة لما أدخلته أصلاً، فلم يتغيّر شيء.';
    if (conf.length) h += (h ? ' ' : '') + 'ولم تُغيَّر الحقول التي كتبتَ فيها قيماً مختلفة (انظر أدناه).';
    if (miss.length) h += '<br>لم تتوفر في المصدر، أكملها يدوياً إن لزم: ' + esc(miss.join('، ')) + '.';
    h += '<br>راجع الحقول وعدّلها قبل الضغط على «إضافة المرجع» — لم يُحفظ شيء بعد.';
    S.status = { kind: 'ok', html: h };
    ui.refreshForm();
    markFilled(fill);
    if (same.length && !fill.length && !conf.length) { /* لا شيء آخر */ }
  }
  function applyConflicts() {
    var chosen = S.conflicts.filter(function (e) { return e.checked; });
    if (!chosen.length) { S.status = { kind: 'warn', html: 'لم تحدّد أي حقل للاستبدال؛ بقيت قيمك كما هي.' }; S.conflicts = []; mount(); return; }
    chosen.forEach(applyEntry);
    S.status = { kind: 'ok', html: 'تم استبدال: <b>' + esc(labelsOf(chosen)) + '</b>. راجعها قبل الإضافة — لم يُحفظ شيء بعد.' };
    S.conflicts = [];
    ui.refreshForm();
    markFilled(chosen);
  }

  function statusHtml() {
    if (S.busy) return '<div class="tl-msg">جارٍ جلب البيانات…</div>';
    var h = '';
    if (S.status) h += '<div class="tl-msg ' + S.status.kind + '" role="' + (S.status.kind === 'bad' ? 'alert' : 'status') + '">' + S.status.html + '</div>';
    S.notes.forEach(function (n) { h += '<div class="tl-msg warn">' + esc(n) + '</div>'; });
    if (S.conflicts.length) {
      h += '<div class="rf-conf"><div class="tl-msg warn">وجدنا قيماً تختلف عمّا كتبتَه. حدّد ما تريد استبداله بالقيمة المجلوبة (الافتراضي: إبقاء قيمك):</div>';
      S.conflicts.forEach(function (e, i) {
        h += '<label class="rf-cf"><input type="checkbox" class="tl-chk" data-fc="' + i + '"' + (e.checked ? ' checked' : '') + '>' +
          '<span><b>' + esc(e.label) + '</b><small>الحالية: <span dir="auto">' + esc(e.curShow) + '</span></small>' +
          '<small class="rf-new">المجلوبة: <span dir="auto">' + esc(e.show) + '</span></small></span></label>';
      });
      h += '<div class="tl-btns"><button type="button" class="tl-btn sm pri" data-fa="apply-conf">استبدال المحدد</button><button type="button" class="tl-btn sm" data-fa="skip-conf">إبقاء قيمي كلها</button></div></div>';
    }
    if (S.canProxy) {
      h += '<div class="rf-proxy"><p class="tl-hint">خيار اختياري: يمكن محاولة الجلب عبر خدمة وسيطة مجانية (allorigins.win). سيُرسَل رابط الصفحة إلى هذه الخدمة الخارجية، وقد لا تنجح مع كل المواقع.</p>' +
        '<button type="button" class="tl-btn sm" data-fa="proxy">جرّب عبر الخدمة الوسيطة</button></div>';
    }
    return h;
  }

  function mount() {
    var slot = document.getElementById('rfFetchSlot');
    if (!slot) return;
    var d = ui.getDraft();
    if (S.draft !== d) { S.draft = d; S.kind = ''; S.in = { doi: '', web: '' }; clearResults(); } /* مسودّة جديدة (بعد إضافة/إلغاء/مسح) */
    var kind = d.type === 'article' ? 'doi' : d.type === 'website' ? 'web' : '';
    if (S.kind !== kind) { S.kind = kind; clearResults(); }
    if (!kind) { slot.innerHTML = ''; slot.onclick = slot.oninput = slot.onkeydown = slot.onchange = null; return; }

    var isDoi = kind === 'doi';
    slot.innerHTML =
      '<div class="rf-fetch" role="group" aria-label="' + (isDoi ? 'جلب بيانات المقال عبر DOI' : 'جلب بيانات الموقع من الرابط') + '">' +
      '<label class="tl-lbl" for="rfFetchIn">' + (isDoi ? 'جلب البيانات تلقائياً عبر DOI (اختياري)' : 'جلب البيانات تلقائياً من رابط الصفحة (اختياري)') + '</label>' +
      '<div class="rf-frow"><input class="tl-in rf-ltr' + (S.err ? ' bad' : '') + '" id="rfFetchIn" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="2000" inputmode="' + (isDoi ? 'text' : 'url') + '" ' +
      'placeholder="' + (isDoi ? '10.1234/abcd أو https://doi.org/10.1234/abcd' : 'https://example.com/article') + '" value="' + esc(S.in[kind]) + '"' + (S.busy ? ' disabled' : '') + '>' +
      '<button type="button" class="tl-btn pri" data-fa="go"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'جارٍ الجلب…' : 'جلب البيانات') + '</button></div>' +
      '<div class="tl-err" id="rfFetchErr" role="alert"' + (S.err ? '' : ' hidden') + '>' + esc(S.err) + '</div>' +
      '<p class="tl-hint">' + (isDoi
        ? 'تُجلب بيانات المقال من خدمة Crossref المجانية وتُعبّأ في الحقول الفارغة فقط.'
        : 'تُقرأ بيانات الصفحة مباشرة من المتصفح، وكثير من المواقع تمنع ذلك؛ وعندها تُكمل الحقول يدوياً.') +
      ' لا يُحفظ شيء حتى تضغط «إضافة المرجع»، ولا تُستبدل قيمة كتبتَها دون موافقتك.</p>' +
      '<div class="rf-fstat" aria-live="polite">' + statusHtml() + '</div></div>';

    slot.onclick = function (e) {
      var b = e.target.closest('[data-fa]');
      if (!b || b.disabled) return;
      var a = b.dataset.fa;
      if (a === 'go') run(false);
      else if (a === 'proxy') run(true);
      else if (a === 'apply-conf') applyConflicts();
      else if (a === 'skip-conf') { S.conflicts = []; S.status = { kind: 'ok', html: 'بقيت قيمك كما هي دون تغيير.' }; mount(); }
    };
    slot.oninput = function (e) {
      if (e.target.id !== 'rfFetchIn') return;
      S.in[S.kind] = e.target.value;
      if (S.err) { S.err = ''; e.target.classList.remove('bad'); var er = document.getElementById('rfFetchErr'); if (er) { er.hidden = true; er.textContent = ''; } }
    };
    slot.onkeydown = function (e) {
      if (e.key !== 'Enter' || e.target.id !== 'rfFetchIn') return;
      e.preventDefault();
      e.stopPropagation(); /* وإلا التقطه مستمع النموذج وأضاف المرجع! */
      if (!e.isComposing) run(false);
    };
    slot.onchange = function (e) {
      var i = e.target.getAttribute && e.target.getAttribute('data-fc');
      if (i != null && S.conflicts[+i]) S.conflicts[+i].checked = e.target.checked;
    };
  }

  function focusInput() { var i = document.getElementById('rfFetchIn'); if (i) { try { i.focus(); } catch (e) { /* ignore */ } } }

  function run(viaProxy) {
    if (S.busy) return;
    var kind = S.kind, v = kind === 'doi' ? H.parseDoi(S.in.doi) : H.parseUrl(S.in.web);
    clearResults();
    if (!v.ok) { S.err = v.error; mount(); focusInput(); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { S.status = { kind: 'bad', html: esc(MSG_OFFLINE) }; mount(); return; }
    var d = ui.getDraft(), type = d.type;
    S.busy = true; mount();
    (kind === 'doi' ? fetchDoi(v.doi) : fetchWeb(v.href, viaProxy)).then(function (r) {
      S.busy = false;
      if (ui.getDraft() !== d || d.type !== type) { mount(); return; } /* غيّر المستخدم النوع أو المسودّة أثناء الجلب: لا نكتب شيئاً */
      if (!r.ok) { S.status = { kind: 'bad', html: esc(r.msg) }; S.canProxy = !!r.canProxy; mount(); return; }
      showResult(r.res);
    });
  }

  ui.on('form', mount);
})(typeof window !== 'undefined' ? window : globalThis);
