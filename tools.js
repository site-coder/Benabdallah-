/* ==========================================================================
   أدوات الطالب (tools.js) — 4 أدوات تعمل محلياً بالكامل داخل قسم «الأدوات»
   - بلا أي API خارجي ولا ذكاء اصطناعي، والحفظ في LocalStorage فقط
   - مفاتيح الحفظ مستقلة لكل أداة: tl_sched_v1 / tl_pomo_v1 / tl_gpa_v1 / tl_todo_v1
   - كل الأسماء داخل IIFE واحدة وبالبادئة tl، فلا تتعارض مع سكربتات الموقع
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('v-tools');
  if (!root) return;

  /* ---------- أدوات مساعدة عامة ---------- */
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function num(v) { /* يقبل الأرقام العربية والفاصلة العشرية «،» أو «,» */
    var s = String(v == null ? '' : v).trim().replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; }).replace(/[,،٫]/g, '.');
    if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtDateTime(t) { try { return new Date(t).toLocaleDateString('ar-DZ-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function ic(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
  var I = {
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    print: ic('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    save: ic('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>'),
    pdf: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>'),
    refresh: ic('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>'),
    chev: ic('<path d="m15 18-6-6 6-6"/>'),
    cal: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>'),
    timer: ic('<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>'),
    calc: ic('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15h.01"/><path d="M8 19h8"/>'),
    list: ic('<path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>')
  };

  /* ---------- إشعار صغير ---------- */
  var toastEl = document.createElement('div');
  toastEl.className = 'tl-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  var toastT = 0;
  function toast(m, ms) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2400); }

  /* ---------- نافذة منبثقة (Modal) ---------- */
  var mbg = document.createElement('div');
  mbg.className = 'tl-mbg'; mbg.innerHTML = '<div class="tl-modal" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(mbg);
  var modal = mbg.firstChild, modalOnClose = null;
  function openModal(html) { modal.innerHTML = html; mbg.classList.add('open'); var f = modal.querySelector('input,select,textarea'); if (f && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60); }
  function closeModal() { mbg.classList.remove('open'); modal.innerHTML = ''; modalOnClose = null; }
  mbg.addEventListener('mousedown', function (e) { if (e.target === mbg) closeModal(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && mbg.classList.contains('open')) closeModal(); });

  /* ---------- الطباعة / PDF (عبر نافذة الطباعة: «حفظ بصيغة PDF») ---------- */
  var printEl = document.createElement('div');
  printEl.id = 'tlPrint'; document.body.appendChild(printEl);
  function clearPrint() { document.body.classList.remove('tl-printing'); }
  addEventListener('afterprint', clearPrint);
  function doPrint(html, asPdf) {
    printEl.innerHTML = html;
    document.body.classList.add('tl-printing');
    if (asPdf) toast('في نافذة الطباعة اختر «حفظ بصيغة PDF» كوجهة الطباعة', 4200);
    setTimeout(function () {
      try { window.print(); } catch (e) { clearPrint(); toast('تعذّرت الطباعة على هذا المتصفح'); return; }
      /* احتياط للمتصفحات التي لا تطلق afterprint: نزيل الصنف عند أول لمسة لاحقة */
      var off = function () { clearPrint(); removeEventListener('pointerdown', off, true); };
      addEventListener('pointerdown', off, true);
    }, 80);
  }

  /* ---------- التنقل بين الصفحات الداخلية للأدوات ---------- */
  var TOOLS = {
    sched: { title: 'إنشاء جدول دراسي', desc: 'وزّع موادك تلقائياً على أيامك وأوقات فراغك', icon: I.cal },
    pomo: { title: 'مؤقت بومودورو', desc: 'ركّز بجلسات دراسة وراحة منتظمة', icon: I.timer },
    gpa: { title: 'حساب المعدل الفصلي', desc: 'معدل السداسي بالمعاملات مع حفظ كشف النقاط', icon: I.calc },
    todo: { title: 'قائمة المهام', desc: 'نظّم واجباتك وامتحاناتك ومواعيد تسليمها', icon: I.list }
  };
  var ORDER = ['sched', 'pomo', 'gpa', 'todo'];
  var curTool = null, hub, views = {};

  function buildShell() {
    var h = '<div class="tl-view" id="tlHub"><h2 class="ptitle">الأدوات</h2><p class="tl-sub">أدوات تعمل على جهازك مباشرة، وبياناتها محفوظة عندك ولا تحتاج اتصالاً بالإنترنت.</p><div class="tl-hub">';
    ORDER.forEach(function (k) {
      h += '<button type="button" class="tl-card" data-tool="' + k + '"><span class="tl-ic">' + TOOLS[k].icon + '</span><span class="tl-grow"><b>' + TOOLS[k].title + '</b><small>' + TOOLS[k].desc + '</small></span><span class="tl-go">' + I.chev + '</span></button>';
    });
    h += '</div></div>';
    ORDER.forEach(function (k) { h += '<div class="tl-view" id="tl-' + k + '" hidden></div>'; });
    root.innerHTML = h;
    hub = $('#tlHub');
    ORDER.forEach(function (k) { views[k] = $('#tl-' + k); });
  }
  function topbar(title) {
    return '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><h2 class="ptitle">' + title + '</h2>';
  }
  var inited = {};
  function showTool(k, fromPop) {
    curTool = k;
    hub.hidden = !!k;
    ORDER.forEach(function (x) { views[x].hidden = x !== k; });
    if (k) {
      if (!inited[k]) { inited[k] = true; INIT[k](); }
      else if (REFRESH[k]) REFRESH[k]();
      scrollTo(0, 0);
      if (!fromPop) { var old = history.state || {}; try { history.pushState({ v: 'tools', s: old.s || 0, l: old.l || 1, t: k }, ''); } catch (e) {} }
    } else if (!fromPop) { scrollTo(0, 0); }
  }
  function leaveTool() { if (history.state && history.state.t) history.back(); else showTool(null, true); }

  root.addEventListener('click', function (e) {
    var c = e.target.closest('.tl-card');
    if (c) { showTool(c.dataset.tool); return; }
    if (e.target.closest('.tl-back')) leaveTool();
  });
  /* زر «الأدوات» في الشريط السفلي يعيد دائماً إلى بطاقات الأدوات */
  var bn = document.getElementById('bnav');
  if (bn) bn.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.nav === 'tools') { closeModal(); showTool(null, true); } });
  /* زر الرجوع في الهاتف/المتصفح */
  addEventListener('popstate', function (e) {
    var st = e.state;
    closeModal();
    if (st && st.v === 'tools') showTool(st.t || null, true);
  });
  var INIT = {}, REFRESH = {};
  buildShell();

  /* ==========================================================================
     1) أداة إنشاء جدول دراسي أسبوعي
     ========================================================================== */
  var DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var IMP = { high: 'مرتفعة', mid: 'متوسطة', low: 'منخفضة' };
  var IMPW = { high: 3, mid: 2, low: 1 };
  var SK = 'tl_sched_v1';

  function tMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return NaN; var h = +m[1], mi = +m[2]; if (h > 24 || mi > 59 || (h === 24 && mi)) return NaN; return h * 60 + mi; }
  function tStr(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function durTxt(m) { var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' س' : '') + (h && r ? ' و ' : '') + (r || !h ? r + ' د' : ''); }

  function defSched() {
    var d = {}, i;
    for (i = 0; i < 7; i++) d[i] = { on: i <= 4, from: '16:00', to: '20:00' };
    return { name: '', subjects: [{ id: uid(), name: '', imp: 'mid', hours: '3', count: '' }], days: d, set: { sessionMin: '50', breakMin: '10', maxDay: '6', reviewOn: false, reviewMin: '60' }, sessions: [] };
  }
  var sch = (function () {
    var s = lsGet(SK, null), base = defSched();
    if (!s || typeof s !== 'object') s = { work: base, saved: [], curId: null };
    if (!s.work || !s.work.days || !s.work.set || !Array.isArray(s.work.subjects) || !Array.isArray(s.work.sessions)) s.work = base;
    if (!Array.isArray(s.saved)) s.saved = [];
    return s;
  })();
  function schPersist() {
    if (sch.curId) {
      var e = sch.saved.filter(function (x) { return x.id === sch.curId; })[0];
      if (e) { e.data = clone(sch.work); e.updated = Date.now(); if (sch.work.name && sch.work.name.trim()) e.name = sch.work.name.trim(); }
      else sch.curId = null;
    }
    return lsSet(SK, sch);
  }

  /* ----- الخوارزمية (JavaScript عادية بلا ذكاء اصطناعي) ----- */
  function schGenerate(w) {
    var err = [], warn = [], i, subs = [];
    var set = { sessionMin: num(w.set.sessionMin), breakMin: num(w.set.breakMin), maxDay: num(w.set.maxDay), reviewMin: num(w.set.reviewMin) };
    if (!(set.sessionMin >= 15 && set.sessionMin <= 240)) err.push('مدة الحصة يجب أن تكون بين 15 و240 دقيقة.');
    if (!(set.breakMin >= 0 && set.breakMin <= 60)) err.push('مدة الراحة يجب أن تكون بين 0 و60 دقيقة.');
    if (!(set.maxDay >= 1 && set.maxDay <= 16)) err.push('الحد الأقصى للدراسة يومياً يجب أن يكون بين 1 و16 ساعة.');
    if (w.set.reviewOn && !(set.reviewMin >= 15 && set.reviewMin <= 240)) err.push('مدة المراجعة الأسبوعية يجب أن تكون بين 15 و240 دقيقة.');
    w.subjects.forEach(function (s, n) {
      var nm = (s.name || '').trim(); if (!nm) { if (String(s.hours).trim() !== '' || String(s.count).trim() !== '') err.push('المادة رقم ' + (n + 1) + ' بلا اسم.'); return; }
      var h = num(s.hours), c = String(s.count).trim() === '' ? 0 : num(s.count);
      if (!(h > 0 && h <= 60)) { err.push('ساعات «' + nm + '» الأسبوعية غير صحيحة (أدخل رقماً أكبر من 0).'); return; }
      if (isNaN(c) || c < 0 || c !== Math.floor(c) || c > 60) { err.push('عدد حصص «' + nm + '» يجب أن يكون عدداً صحيحاً موجباً أو يُترك فارغاً.'); return; }
      subs.push({ id: s.id, name: nm, w: IMPW[s.imp] || 2, hours: h, count: c });
    });
    if (!subs.length) err.push('أضف مادة واحدة على الأقل مع اسمها وعدد ساعاتها الأسبوعية.');
    var days = [];
    for (i = 0; i < 7; i++) {
      var d = w.days[i]; if (!d || !d.on) continue;
      var f = tMin(d.from), t = tMin(d.to);
      if (isNaN(f) || isNaN(t)) { err.push('أدخل وقت البداية والنهاية ليوم ' + DAYS[i] + '.'); continue; }
      if (t - f < 15) { err.push('وقت النهاية يوم ' + DAYS[i] + ' يجب أن يكون بعد البداية بـ 15 دقيقة على الأقل.'); continue; }
      days.push({ i: i, from: f, to: t });
    }
    if (!days.length && !err.length) err.push('اختر يوماً واحداً على الأقل للدراسة.');
    if (err.length) return { ok: false, errors: err, warns: warn };

    /* 1) تحويل كل مادة إلى حصص (بوحدات 5 دقائق ليبقى مجموع الساعات دقيقاً) */
    var tasks = [];
    subs.forEach(function (s) {
      var units = Math.max(3, Math.round(s.hours * 60 / 5));
      var n = s.count > 0 ? s.count : Math.max(1, Math.round(s.hours * 60 / set.sessionMin));
      var maxN = Math.max(1, Math.floor(units / 3));
      if (n > maxN) { warn.push('خُفّض عدد حصص «' + s.name + '» إلى ' + maxN + ' لأن الحصة لا تقل عن 15 دقيقة.'); n = maxN; }
      var per = Math.floor(units / n), rem = units - per * n;
      s.list = [];
      for (var k = 0; k < n; k++) s.list.push({ sid: s.id, name: s.name, w: s.w, dur: (per + (k < rem ? 1 : 0)) * 5, type: 'study' });
    });
    function orderRounds() { /* الأهمية الأعلى أولاً، وتتوزع حصص المادة على جولات */
      var ss = subs.slice().sort(function (a, b) { return b.w - a.w || b.hours - a.hours; }), out = [], k = 0, more = true;
      while (more) { more = false; ss.forEach(function (s) { if (s.list[k]) { out.push(s.list[k]); more = true; } }); k++; }
      return out;
    }
    function orderLong() { return orderRounds().sort(function (a, b) { return b.dur - a.dur || b.w - a.w; }); }

    var cap = set.maxDay * 60, brk = set.breakMin;
    function attempt(order) {
      var D = days.map(function (d) { return { i: d.i, from: d.from, to: d.to, end: d.from, used: 0, list: [], subj: {} }; });
      var left = [];
      order.forEach(function (t) {
        var c = D.filter(function (d) { var st = d.list.length ? d.end + brk : d.from; return st + t.dur <= d.to && d.used + t.dur <= cap; });
        if (!c.length) { left.push(t); return; }
        c.sort(function (a, b) { return (a.subj[t.sid] || 0) - (b.subj[t.sid] || 0) || a.used - b.used || a.i - b.i; });
        var d = c[0]; d.end = (d.list.length ? d.end + brk : d.from) + t.dur; d.used += t.dur; d.list.push(t); d.subj[t.sid] = (d.subj[t.sid] || 0) + 1;
      });
      return { D: D, left: left, lack: left.reduce(function (a, t) { return a + t.dur; }, 0) };
    }
    var best = attempt(orderRounds());
    if (best.left.length) { var b2 = attempt(orderLong()); if (b2.lack < best.lack) best = b2; }

    /* 2) المراجعة الأسبوعية (إن طُلبت): في اليوم الأكثر فراغاً */
    var rev = null;
    if (!best.left.length && w.set.reviewOn) {
      var cands = best.D.filter(function (d) { var st = d.list.length ? d.end + brk : d.from; return st + set.reviewMin <= d.to && d.used + set.reviewMin <= cap; });
      if (cands.length) {
        cands.sort(function (a, b) { return (b.to - b.end) - (a.to - a.end) || b.i - a.i; });
        var d0 = cands[0]; rev = { sid: 'review', name: 'مراجعة أسبوعية', w: 0, dur: set.reviewMin, type: 'review' }; d0.list.push(rev); d0.used += set.reviewMin; d0.end = (d0.list.length > 1 ? d0.end + brk : d0.from) + set.reviewMin; d0.isRev = true;
      } else { best.left.push({ name: 'مراجعة أسبوعية', dur: set.reviewMin }); best.lack += set.reviewMin; }
    }
    if (best.left.length) {
      var by = {}; best.left.forEach(function (t) { by[t.name] = (by[t.name] || 0) + t.dur; });
      var names = Object.keys(by).map(function (n) { return '«' + n + '» (' + durTxt(by[n]) + ')'; }).join('، ');
      return { ok: false, errors: ['الوقت المتاح لا يكفي لتوزيع كل الساعات المطلوبة، لذلك لم يُنشأ الجدول. ينقصك نحو ' + durTxt(best.lack) + ' (المواد المتأثرة: ' + names + '). زد وقت الفراغ أو أضف أياماً أو قلّل الساعات أو مدة الراحة أو ارفع الحد الأقصى اليومي.'], warns: warn };
    }

    /* 3) ترتيب كل يوم بحسب الأهمية ثم احتساب التوقيت مع الراحة */
    var out = [];
    best.D.forEach(function (d) {
      d.list.sort(function (a, b) { if (a.type === 'review' || b.type === 'review') return a.type === 'review' ? 1 : -1; return b.w - a.w || (a.name < b.name ? -1 : 1); });
      var cur = d.from;
      d.list.forEach(function (t, n) {
        if (n) cur += brk;
        out.push({ id: uid(), day: d.i, start: cur, dur: t.dur, name: t.name, type: t.type, done: false });
        cur += t.dur;
      });
    });
    subs.forEach(function (s) {
      var ds = {}; out.forEach(function (x) { if (x.name === s.name && x.type === 'study') ds[x.day] = 1; });
      if (s.list.length > 1 && Object.keys(ds).length === 1 && days.length > 1) warn.push('حصص «' + s.name + '» وقعت كلها في يوم واحد لضيق الأوقات المتاحة.');
    });
    return { ok: true, sessions: out, warns: warn };
  }

  /* ----- واجهة أداة الجدول ----- */
  var schEl;
  function schFormHtml() {
    var w = sch.work, h = '';
    h += '<div class="tl-box"><h3>اسم الجدول</h3><input class="tl-in" id="schName" maxlength="60" placeholder="مثال: جدول الأسبوع الأول" value="' + esc(w.name) + '"><div class="tl-btns"><button type="button" class="tl-btn" id="schNew">' + I.plus + '<span>جدول جديد</span></button></div></div>';
    h += '<div class="tl-box"><h3>المواد الدراسية</h3><div id="schSubs">';
    w.subjects.forEach(function (s) { h += schSubHtml(s); });
    h += '</div><button type="button" class="tl-btn pri block" id="schAddSub">' + I.plus + '<span>إضافة مادة</span></button><p class="tl-hint">عدد الحصص اختياري: إن تركته فارغاً تُحسب الحصص من الساعات ÷ مدة الحصة. وإن حدّدته فتُقسَّم ساعات المادة على هذا العدد.</p></div>';
    h += '<div class="tl-box"><h3>أيام الدراسة وأوقات الفراغ</h3><p class="tl-hint" style="margin:-4px 0 10px">فعّل الأيام التي تدرس فيها وحدّد لكل يوم وقت بدايته ونهايته (تستطيع اختيار أوقات مختلفة لكل يوم).</p><div id="schDays">';
    for (var i = 0; i < 7; i++) h += schDayHtml(i);
    h += '</div><div class="tl-btns"><button type="button" class="tl-btn sm" id="schAllDays">كل الأيام</button><button type="button" class="tl-btn sm" id="schNoDays">مسح الاختيار</button></div></div>';
    var s = w.set;
    h += '<div class="tl-box"><h3>إعدادات الجدول</h3><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="schS1">مدة الحصة (دقيقة)</label><input class="tl-in num" id="schS1" data-s="sessionMin" inputmode="numeric" value="' + esc(s.sessionMin) + '"></div><div class="tl-fld"><label class="tl-lbl" for="schS2">الراحة بين الحصص (دقيقة)</label><input class="tl-in num" id="schS2" data-s="breakMin" inputmode="numeric" value="' + esc(s.breakMin) + '"></div><div class="tl-fld"><label class="tl-lbl" for="schS3">أقصى دراسة يومياً (ساعة)</label><input class="tl-in num" id="schS3" data-s="maxDay" inputmode="decimal" value="' + esc(s.maxDay) + '"></div></div>';
    h += '<div class="tl-row" style="margin-top:10px"><label class="tl-sound"><input type="checkbox" class="tl-chk" id="schRevOn"' + (s.reviewOn ? ' checked' : '') + '><span>تخصيص وقت للمراجعة الأسبوعية</span></label><div class="tl-fld" style="max-width:170px"><input class="tl-in num" id="schRevMin" data-s="reviewMin" inputmode="numeric" aria-label="مدة المراجعة بالدقائق" value="' + esc(s.reviewMin) + '"' + (s.reviewOn ? '' : ' disabled') + '></div><span class="tl-hint" style="margin:0">دقيقة</span></div></div>';
    return h;
  }
  function schSubHtml(s) {
    var o = '';
    ['high', 'mid', 'low'].forEach(function (k) { o += '<option value="' + k + '"' + (s.imp === k ? ' selected' : '') + '>' + IMP[k] + '</option>'; });
    return '<div class="tl-item" data-id="' + esc(s.id) + '"><div class="tl-row"><input class="tl-in tl-grow" data-f="name" maxlength="60" placeholder="اسم المادة" aria-label="اسم المادة" value="' + esc(s.name) + '"><button type="button" class="tl-x" data-del="1" aria-label="حذف المادة">' + I.trash + '</button></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl">الأهمية</label><select class="tl-sel" data-f="imp">' + o + '</select></div><div class="tl-fld"><label class="tl-lbl">ساعات أسبوعياً</label><input class="tl-in num" data-f="hours" inputmode="decimal" value="' + esc(s.hours) + '"></div><div class="tl-fld"><label class="tl-lbl">عدد الحصص (اختياري)</label><input class="tl-in num" data-f="count" inputmode="numeric" placeholder="تلقائي" value="' + esc(s.count) + '"></div></div></div>';
  }
  function schDayHtml(i) {
    var d = sch.work.days[i];
    return '<div class="tl-sw' + (d.on ? '' : ' off') + '" data-d="' + i + '"><label class="tl-dn"><input type="checkbox" class="tl-chk" data-f="on"' + (d.on ? ' checked' : '') + '><span>' + DAYS[i] + '</span></label><input type="time" class="tl-in" data-f="from" aria-label="من - ' + DAYS[i] + '" value="' + esc(d.from) + '"' + (d.on ? '' : ' disabled') + '><span class="tl-hint" style="margin:0">إلى</span><input type="time" class="tl-in" data-f="to" aria-label="إلى - ' + DAYS[i] + '" value="' + esc(d.to) + '"' + (d.on ? '' : ' disabled') + '></div>';
  }
  function schMsg(kind, arr) {
    var m = $('#schMsg', schEl); if (!m) return;
    if (!arr || !arr.length) { m.innerHTML = ''; return; }
    m.innerHTML = arr.map(function (t) { return '<div class="tl-msg ' + kind + '" role="alert">' + esc(t) + '</div>'; }).join('');
  }
  function cntTxt(n) { return n === 1 ? 'حصة واحدة' : n === 2 ? 'حصتان' : n <= 10 ? n + ' حصص' : n + ' حصة'; }
  function schStats() {
    var S = sch.work.sessions, done = S.filter(function (x) { return x.done; }).length, tot = S.length;
    return { tot: tot, done: done, left: tot - done, pct: tot ? Math.round(done * 100 / tot) : 0, min: S.reduce(function (a, x) { return a + x.dur; }, 0) };
  }
  function schSorted() { return sch.work.sessions.slice().sort(function (a, b) { return a.day - b.day || a.start - b.start; }); }
  function schResultHtml() {
    var w = sch.work, S = schSorted();
    if (!S.length) return '<div class="tl-box"><h3>الجدول الأسبوعي</h3><p class="tl-empty">لم يُنشأ جدول بعد. أدخل موادك وأوقاتك ثم اضغط «إنشاء الجدول»، أو أضف حصصاً يدوياً.</p><div class="tl-btns"><button type="button" class="tl-btn" id="schAddSes">' + I.plus + '<span>إضافة حصة</span></button></div></div>';
    var st = schStats(), h = '<div class="tl-box" id="schRes"><h3>الجدول الأسبوعي' + (w.name ? ' — ' + esc(w.name) : '') + '</h3>';
    h += '<div class="tl-stats"><div class="tl-stat ok"><b>' + st.done + '</b><small>حصص مكتملة</small></div><div class="tl-stat"><b>' + st.left + '</b><small>حصص متبقية</small></div><div class="tl-stat gold"><b>' + st.pct + '%</b><small>نسبة الإنجاز</small></div></div>';
    h += '<div class="tl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '"><i style="width:' + st.pct + '%"></i></div><p class="tl-hint">إجمالي الدراسة في الأسبوع: ' + durTxt(st.min) + ' في ' + st.tot + ' حصة.</p>';
    h += '<div class="tl-btns"><button type="button" class="tl-btn pri" id="schRegen">' + I.refresh + '<span>إعادة توزيع الجدول</span></button><button type="button" class="tl-btn" id="schAddSes">' + I.plus + '<span>إضافة حصة</span></button></div>';
    h += '<div style="margin-top:14px">';
    for (var d = 0; d < 7; d++) {
      var L = S.filter(function (x) { return x.day === d; }); if (!L.length) continue;
      var tot = L.reduce(function (a, x) { return a + x.dur; }, 0);
      h += '<div class="tl-day"><h4>' + DAYS[d] + '<small>' + cntTxt(L.length) + ' · ' + durTxt(tot) + '</small></h4>';
      L.forEach(function (x, n) {
        if (n) { var gap = x.start - (L[n - 1].start + L[n - 1].dur); if (gap > 0) h += '<div class="tl-brk">راحة ' + durTxt(gap) + '</div>'; }
        h += '<div class="tl-ses' + (x.done ? ' done' : '') + (x.type === 'review' ? ' rev' : '') + '"><input type="checkbox" class="tl-chk" data-sid="' + esc(x.id) + '" aria-label="تمّت الحصة"' + (x.done ? ' checked' : '') + '><div class="tl-t">' + tStr(x.start) + '–' + tStr(x.start + x.dur) + '</div><div class="tl-n"><b>' + esc(x.name) + '</b><small>' + durTxt(x.dur) + (x.type === 'review' ? ' · مراجعة' : '') + '</small></div><button type="button" class="tl-x" data-edit="' + esc(x.id) + '" aria-label="تعديل الحصة" style="color:var(--text)">' + I.edit + '</button></div>';
      });
      h += '</div>';
    }
    h += '</div><div class="tl-btns"><button type="button" class="tl-btn pri" id="schSave">' + I.save + '<span>حفظ الجدول</span></button><button type="button" class="tl-btn" id="schPrint">' + I.print + '<span>طباعة</span></button><button type="button" class="tl-btn" id="schPdf">' + I.pdf + '<span>تحميل PDF</span></button></div>';
    h += '<p class="tl-hint">«تحميل PDF» يفتح نافذة الطباعة؛ اختر منها «حفظ بصيغة PDF».' + (sch.curId ? ' التغييرات تُحفظ تلقائياً في الجدول المفتوح.' : ' تُحفظ تغييراتك تلقائياً على جهازك، واضغط «حفظ الجدول» لإضافته إلى قائمة جداولك.') + '</p></div>';
    return h;
  }
  function schSavedHtml() {
    if (!sch.saved.length) return '';
    var h = '<div class="tl-box"><h3>جداولي المحفوظة</h3>';
    sch.saved.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (e) {
      var S = e.data.sessions || [], dn = S.filter(function (x) { return x.done; }).length;
      h += '<div class="tl-saved" data-sv="' + esc(e.id) + '"><div class="tl-grow"><b>' + esc(e.name) + (e.id === sch.curId ? ' <small>(مفتوح)</small>' : '') + '</b><small>' + S.length + ' حصة · أُنجز ' + dn + ' · ' + fmtDateTime(e.updated) + '</small></div><button type="button" class="tl-btn sm pri" data-open="1">فتح</button><button type="button" class="tl-x" data-delsv="1" aria-label="حذف الجدول المحفوظ">' + I.trash + '</button></div>';
    });
    return h + '</div>';
  }
  function schRenderResult() {
    $('#schSaved', schEl).innerHTML = schSavedHtml();
    $('#schResult', schEl).innerHTML = schResultHtml();
  }
  function schRenderAll() {
    $('#schForm', schEl).innerHTML = schFormHtml();
    schRenderResult();
  }
  function schDo(regen) {
    var w = sch.work;
    if (regen && w.sessions.length && !confirm('سيُستبدل الجدول الحالي (بما فيه تعديلاتك اليدوية وعلامات الإنجاز) بجدول جديد وفق الإعدادات الحالية. متابعة؟')) return;
    var r = schGenerate(w);
    if (!r.ok) { schMsg('bad', r.errors); schMsg2(r.warns); $('#schMsg', schEl).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    w.sessions = r.sessions; schPersist(); schRenderResult();
    schMsg('ok', ['تم ' + (regen ? 'إعادة توزيع' : 'إنشاء') + ' الجدول: ' + r.sessions.length + ' حصة.']);
    if (r.warns.length) $('#schMsg', schEl).insertAdjacentHTML('beforeend', r.warns.map(function (t) { return '<div class="tl-msg warn" role="alert">' + esc(t) + '</div>'; }).join(''));
    var el = $('#schRes', schEl); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function schMsg2(warns) { if (warns && warns.length) $('#schMsg', schEl).insertAdjacentHTML('beforeend', warns.map(function (t) { return '<div class="tl-msg warn" role="alert">' + esc(t) + '</div>'; }).join('')); }

  function schSessionModal(id) {
    var w = sch.work, x = id ? w.sessions.filter(function (s) { return s.id === id; })[0] : null, isNew = !x;
    if (isNew) {
      var ad = 0, i; for (i = 0; i < 7; i++) if (w.days[i] && w.days[i].on) { ad = i; break; }
      var L = w.sessions.filter(function (s) { return s.day === ad; }), end = L.reduce(function (a, s) { return Math.max(a, s.start + s.dur); }, 0), brk = num(w.set.breakMin) || 0, dm = num(w.set.sessionMin) || 50;
      var st = L.length ? end + brk : (tMin(w.days[ad].from) || 960);
      x = { day: ad, start: Math.min(st, 1440 - dm), dur: dm, name: '' };
    }
    var dopt = ''; for (var d = 0; d < 7; d++) dopt += '<option value="' + d + '"' + (x.day === d ? ' selected' : '') + '>' + DAYS[d] + '</option>';
    openModal('<h3>' + (isNew ? 'إضافة حصة' : 'تعديل الحصة') + '</h3><label class="tl-lbl" for="smN">اسم المادة</label><input class="tl-in" id="smN" maxlength="60" value="' + esc(x.name) + '" placeholder="اسم المادة"><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="smD">اليوم</label><select class="tl-sel" id="smD">' + dopt + '</select></div><div class="tl-fld"><label class="tl-lbl" for="smT">وقت البداية</label><input type="time" class="tl-in" id="smT" value="' + tStr(x.start) + '"></div><div class="tl-fld"><label class="tl-lbl" for="smM">المدة (دقيقة)</label><input class="tl-in num" id="smM" inputmode="numeric" value="' + x.dur + '"></div></div><div id="smE"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="smOk">' + I.save + '<span>حفظ</span></button>' + (isNew ? '' : '<button type="button" class="tl-btn del" id="smDel">' + I.trash + '<span>حذف الحصة</span></button>') + '<button type="button" class="tl-btn" id="smNo">إلغاء</button></div>');
    $('#smNo', modal).onclick = closeModal;
    if (!isNew) $('#smDel', modal).onclick = function () { if (!confirm('حذف هذه الحصة؟')) return; w.sessions = w.sessions.filter(function (s) { return s.id !== id; }); schPersist(); closeModal(); schRenderResult(); toast('تم حذف الحصة'); };
    $('#smOk', modal).onclick = function () {
      var nm = $('#smN', modal).value.trim(), dy = +$('#smD', modal).value, st = tMin($('#smT', modal).value), du = num($('#smM', modal).value), e = '';
      if (!nm) e = 'اكتب اسم المادة.'; else if (isNaN(st)) e = 'أدخل وقت بداية صحيحاً.'; else if (!(du >= 5 && du <= 480) || du !== Math.floor(du)) e = 'المدة يجب أن تكون عدداً صحيحاً بين 5 و480 دقيقة.'; else if (st + du > 1440) e = 'الحصة تتجاوز منتصف الليل؛ قلّل المدة أو قدّم وقت البداية.';
      if (!e) { var clash = w.sessions.filter(function (s) { return s.id !== id && s.day === dy && st < s.start + s.dur && s.start < st + du; })[0]; if (clash) e = 'تتداخل مع حصة «' + clash.name + '» (' + tStr(clash.start) + '–' + tStr(clash.start + clash.dur) + ').'; }
      if (e) { $('#smE', modal).innerHTML = '<div class="tl-msg bad" role="alert">' + esc(e) + '</div>'; return; }
      if (isNew) w.sessions.push({ id: uid(), day: dy, start: st, dur: du, name: nm, type: 'study', done: false });
      else { var s0 = w.sessions.filter(function (s) { return s.id === id; })[0]; s0.name = nm; s0.day = dy; s0.start = st; s0.dur = du; }
      schPersist(); closeModal(); schRenderResult(); toast(isNew ? 'تمت إضافة الحصة' : 'تم تعديل الحصة');
    };
  }
  function schPrintHtml() {
    var w = sch.work, S = schSorted(), st = schStats();
    var h = '<h1>' + esc(w.name || 'جدولي الدراسي الأسبوعي') + '</h1><div class="pm">إنجاز: ' + st.done + ' / ' + st.tot + ' حصة (' + st.pct + '%) · إجمالي الدراسة: ' + durTxt(st.min) + '</div>';
    h += '<table><thead><tr><th>اليوم</th><th>التوقيت</th><th>المادة</th><th>المدة</th><th>تمّت</th></tr></thead><tbody>';
    for (var d = 0; d < 7; d++) {
      var L = S.filter(function (x) { return x.day === d; });
      L.forEach(function (x, n) {
        if (n) { var gap = x.start - (L[n - 1].start + L[n - 1].dur); if (gap > 0) h += '<tr class="brk"><td colspan="5">راحة ' + durTxt(gap) + '</td></tr>'; }
        h += '<tr' + (x.done ? ' class="dn"' : '') + '>' + (n ? '' : '<td rowspan="' + (L.length + L.reduce(function (a, y, k) { return a + (k && y.start - (L[k - 1].start + L[k - 1].dur) > 0 ? 1 : 0); }, 0)) + '"><b>' + DAYS[d] + '</b></td>') + '<td dir="ltr" style="text-align:center">' + tStr(x.start) + ' – ' + tStr(x.start + x.dur) + '</td><td>' + esc(x.name) + (x.type === 'review' ? ' (مراجعة)' : '') + '</td><td>' + durTxt(x.dur) + '</td><td style="text-align:center">' + (x.done ? '✓' : '☐') + '</td></tr>';
      });
    }
    return h + '</tbody></table>';
  }
  function schSave() {
    var w = sch.work;
    if (!w.sessions.length) { toast('أنشئ الجدول أولاً'); return; }
    var nm = (w.name || '').trim() || ('جدول ' + fmtDateTime(Date.now()));
    w.name = nm; var inp = $('#schName', schEl); if (inp) inp.value = nm;
    var e = sch.curId ? sch.saved.filter(function (x) { return x.id === sch.curId; })[0] : null;
    if (e) { e.name = nm; e.data = clone(w); e.updated = Date.now(); }
    else { e = { id: uid(), name: nm, data: clone(w), updated: Date.now() }; sch.saved.push(e); sch.curId = e.id; }
    if (!lsSet(SK, sch)) { toast('تعذّر الحفظ: مساحة التخزين ممتلئة'); return; }
    schRenderResult(); toast('تم حفظ الجدول «' + nm + '»');
  }

  INIT.sched = function () {
    var v = views.sched;
    v.innerHTML = topbar('إنشاء جدول دراسي') + '<div class="tl-wrap"><div id="schSaved"></div><div id="schForm"></div><div class="tl-box"><button type="button" class="tl-btn pri block" id="schGen" style="min-height:56px;font-size:17px">' + I.cal + '<span>إنشاء الجدول</span></button><div id="schMsg"></div></div><div id="schResult"></div></div>';
    schEl = v; schRenderAll();

    v.addEventListener('input', function (e) {
      var t = e.target, w = sch.work, row;
      if (t.id === 'schName') { w.name = t.value; schPersist(); return; }
      if (t.dataset.s) { w.set[t.dataset.s] = t.value; schPersist(); return; }
      if ((row = t.closest('.tl-item')) && t.dataset.f) { var s = w.subjects.filter(function (x) { return x.id === row.dataset.id; })[0]; if (s) { s[t.dataset.f] = t.value; schPersist(); } return; }
      if ((row = t.closest('.tl-sw')) && t.dataset.f && t.dataset.f !== 'on') { w.days[row.dataset.d][t.dataset.f] = t.value; schPersist(); }
    });
    v.addEventListener('change', function (e) {
      var t = e.target, w = sch.work, row;
      if (t.id === 'schRevOn') { w.set.reviewOn = t.checked; $('#schRevMin', v).disabled = !t.checked; schPersist(); return; }
      if ((row = t.closest('.tl-item')) && t.dataset.f === 'imp') { var s = w.subjects.filter(function (x) { return x.id === row.dataset.id; })[0]; if (s) { s.imp = t.value; schPersist(); } return; }
      if ((row = t.closest('.tl-sw')) && t.dataset.f === 'on') {
        w.days[row.dataset.d].on = t.checked; row.classList.toggle('off', !t.checked);
        $$('input[type=time]', row).forEach(function (x) { x.disabled = !t.checked; }); schPersist(); return;
      }
      if (t.dataset.sid) {
        var x = w.sessions.filter(function (q) { return q.id === t.dataset.sid; })[0]; if (x) { x.done = t.checked; schPersist(); schRenderResult(); }
      }
    });
    v.addEventListener('click', function (e) {
      var t = e.target, w = sch.work, b;
      if (t.closest('#schAddSub')) { var ns = { id: uid(), name: '', imp: 'mid', hours: '2', count: '' }; w.subjects.push(ns); schPersist(); $('#schSubs', v).insertAdjacentHTML('beforeend', schSubHtml(ns)); var f = $('#schSubs .tl-item:last-child input', v); if (f) f.focus(); return; }
      if ((b = t.closest('[data-del]')) && t.closest('.tl-item')) {
        var id = t.closest('.tl-item').dataset.id;
        if (w.subjects.length === 1 && !w.subjects[0].name.trim()) return;
        w.subjects = w.subjects.filter(function (x) { return x.id !== id; }); t.closest('.tl-item').remove(); schPersist(); return;
      }
      if (t.closest('#schAllDays') || t.closest('#schNoDays')) { var on = !!t.closest('#schAllDays'); for (var i = 0; i < 7; i++) w.days[i].on = on; $('#schDays', v).innerHTML = (function () { var h = ''; for (var k = 0; k < 7; k++) h += schDayHtml(k); return h; })(); schPersist(); return; }
      if (t.closest('#schGen')) { schDo(false); return; }
      if (t.closest('#schRegen')) { schDo(true); return; }
      if (t.closest('#schAddSes')) { schSessionModal(null); return; }
      if ((b = t.closest('[data-edit]'))) { schSessionModal(b.dataset.edit); return; }
      if (t.closest('#schSave')) { schSave(); return; }
      if (t.closest('#schPrint')) { doPrint(schPrintHtml(), false); return; }
      if (t.closest('#schPdf')) { doPrint(schPrintHtml(), true); return; }
      if (t.closest('#schNew')) {
        if (w.sessions.length && !sch.curId && !confirm('لم تحفظ الجدول الحالي. سيُمسح لبدء جدول جديد. متابعة؟')) return;
        sch.work = defSched(); sch.curId = null; schPersist(); schMsg('ok', []); schRenderAll(); toast('جدول جديد'); return;
      }
      var sv = t.closest('[data-sv]');
      if (sv && t.closest('[data-open]')) {
        var e1 = sch.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e1) return;
        sch.work = clone(e1.data); sch.curId = e1.id; lsSet(SK, sch); schMsg('ok', []); schRenderAll(); toast('تم فتح «' + e1.name + '»'); scrollTo(0, 0); return;
      }
      if (sv && t.closest('[data-delsv]')) {
        var e2 = sch.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e2) return;
        if (!confirm('حذف الجدول المحفوظ «' + e2.name + '» نهائياً؟')) return;
        sch.saved = sch.saved.filter(function (x) { return x.id !== e2.id; }); if (sch.curId === e2.id) sch.curId = null; lsSet(SK, sch); schRenderResult(); toast('تم حذف الجدول'); return;
      }
    });
  };
  REFRESH.sched = function () { schRenderResult(); };

  /* ==========================================================================
     2) مؤقت بومودورو
     - الدقة: يعتمد على وقت الانتهاء المطلق (Date.now) لا على إنقاص عدّاد كل ثانية،
       فيبقى صحيحاً عند التنقل بين الصفحات أو تعليق التبويب أو إغلاق الموقع وإعادة فتحه.
     - المحرّك يعمل منذ تحميل الموقع، حتى لو لم تُفتح صفحة الأداة.
     ========================================================================== */
  var PK = 'tl_pomo_v1';
  var PRE = {
    short: { n: 'التركيز القصير', f: 25, b: 5, l: 15, e: 4 },
    mid: { n: 'التركيز المتوسط', f: 45, b: 10, l: 20, e: 3 },
    deep: { n: 'التركيز العميق', f: 60, b: 15, l: 25, e: 2 }
  };
  var pm = (function () {
    var s = lsGet(PK, null);
    if (!s || typeof s !== 'object') s = {};
    s.mode = (PRE[s.mode] || s.mode === 'custom') ? s.mode : 'short';
    var c = s.custom || {}; s.custom = { n: 'مخصص', f: +c.f > 0 ? +c.f : 30, b: +c.b > 0 ? +c.b : 5, l: +c.l > 0 ? +c.l : 15, e: +c.e > 0 ? +c.e : 4 };
    s.sound = s.sound !== false;
    s.phase = (s.phase === 'break' || s.phase === 'long') ? s.phase : 'focus';
    s.done = +s.done >= 0 ? +s.done : 0;
    s.running = !!s.running; s.endAt = +s.endAt || 0; s.remaining = +s.remaining > 0 ? +s.remaining : 0;
    if (!s.days || typeof s.days !== 'object') s.days = {};
    return s;
  })();
  function pmCfg() { return pm.mode === 'custom' ? pm.custom : PRE[pm.mode]; }
  function pmDur(ph) { var c = pmCfg(); return (ph === 'focus' ? c.f : ph === 'break' ? c.b : c.l) * 60000; }
  function pmSave() { lsSet(PK, pm); }
  if (!pm.remaining) pm.remaining = pmDur(pm.phase);
  function dKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pmDay() {
    var k = dKey(); if (!pm.days[k]) {
      pm.days[k] = { s: 0, n: 0, b: 0 };
      var ks = Object.keys(pm.days).sort(); while (ks.length > 60) delete pm.days[ks.shift()];
    }
    return pm.days[k];
  }
  function pmRem() { return pm.running ? Math.max(0, pm.endAt - Date.now()) : pm.remaining; }
  function pmStarted() { return pm.running || pm.remaining < pmDur(pm.phase) || pm.done > 0 || pm.phase !== 'focus'; }

  var pmAC = null;
  function pmAudio() { try { if (!pmAC) { var C = window.AudioContext || window.webkitAudioContext; if (C) pmAC = new C(); } if (pmAC && pmAC.state === 'suspended') pmAC.resume(); } catch (e) {} return pmAC; }
  function pmBeep() {
    var a = pmAudio(); if (!a) return;
    try {
      [0, 0.3, 0.6].forEach(function (t, i) {
        var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
        o.type = 'sine'; o.frequency.value = i === 2 ? 880 : 660;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.28);
      });
    } catch (e) {}
  }
  function pmCredit(ms) { if (ms > 0) pmDay().s += ms; }
  function pmComplete() { /* انتهت المرحلة الحالية طبيعياً */
    var was = pm.phase, d = pmDay(), c = pmCfg();
    if (was === 'focus') { pmCredit(pmDur('focus')); d.n++; pm.done++; pm.phase = pm.done >= c.e ? 'long' : 'break'; }
    else { d.b++; if (was === 'long') pm.done = 0; pm.phase = 'focus'; }
    pm.remaining = pmDur(pm.phase);
    return was;
  }
  function pmTick() {
    if (pm.running && Date.now() >= pm.endAt) {
      var guard = 0, last = null, lastAt = 0;
      while (pm.running && Date.now() >= pm.endAt && guard++ < 400) {
        if (Date.now() - pm.endAt > 6 * 3600000) { pm.running = false; pm.phase = 'focus'; pm.done = 0; pm.remaining = pmDur('focus'); last = null; break; } /* مهجور منذ زمن: لا يُحتسب */
        var fin = pm.endAt; last = pmComplete(); lastAt = fin; pm.endAt = fin + pmDur(pm.phase);
      }
      pmSave();
      if (last && Date.now() - lastAt < 20000) {
        if (pm.sound) pmBeep();
        try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([200, 100, 200]); } catch (e) {}
        toast(last === 'focus' ? (pm.phase === 'long' ? 'أحسنت! حان وقت الاستراحة الطويلة' : 'انتهت جلسة التركيز، خذ استراحة قصيرة') : 'انتهت الراحة، حان وقت التركيز', 4500);
      }
    }
    pmRender();
  }
  var pmTimer = 0;
  function pmLoop() { if (pm.running && !pmTimer) pmTimer = setInterval(pmTick, 250); else if (!pm.running && pmTimer) { clearInterval(pmTimer); pmTimer = 0; } }
  function pmStart() { pmAudio(); pm.running = true; pm.endAt = Date.now() + pm.remaining; pmSave(); pmLoop(); pmRender(); }
  function pmPause() { pm.remaining = pmRem(); pm.running = false; pmSave(); pmLoop(); pmRender(); }
  function pmReset(keepStats) {
    if (pm.phase === 'focus') pmCredit(pmDur('focus') - pmRem());
    pm.running = false; pm.phase = 'focus'; pm.done = 0; pm.remaining = pmDur('focus'); pmSave(); pmLoop(); pmRender();
  }
  function pmSkip() {
    var rem = pmRem();
    if (pm.phase === 'focus') { pmCredit(pmDur('focus') - rem); pm.phase = 'break'; }
    else { if (pm.phase === 'long') pm.done = 0; pm.phase = 'focus'; }
    pm.remaining = pmDur(pm.phase);
    if (pm.running) pm.endAt = Date.now() + pm.remaining;
    pmSave(); pmRender();
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pmTick(); });
  addEventListener('pageshow', pmTick);
  addEventListener('pagehide', pmSave);
  pmLoop(); pmTick();

  var PMC = 2 * Math.PI * 90, pmEl = null, pmLast = {};
  function pmVisible() { return pmEl && !root.hidden && !views.pomo.hidden; }
  function minsTxt(ms) { var m = Math.floor(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' س ' + (m % 60) + ' د' : m + ' د'; }
  function pmSet(id, prop, val) { var k = id + prop; if (pmLast[k] === val) return; pmLast[k] = val; var el = $('#' + id, pmEl); if (el) { if (prop === 'text') el.textContent = val; else if (prop === 'html') el.innerHTML = val; else el[prop] = val; } }
  function pmRender() {
    if (!pmVisible()) return;
    var rem = pmRem(), dur = pmDur(pm.phase), c = pmCfg(), sec = Math.ceil(rem / 1000), d = pmDay();
    pmSet('pmClock', 'text', pad(Math.floor(sec / 60)) + ':' + pad(sec % 60));
    pmSet('pmPhase', 'text', pm.phase === 'focus' ? 'وقت التركيز' : pm.phase === 'break' ? 'راحة قصيرة' : 'استراحة طويلة');
    pmSet('pmInfo', 'text', pm.phase === 'focus' ? 'الجلسة ' + (pm.done + 1) + ' من ' + c.e : (pm.phase === 'long' ? 'أكملت ' + c.e + ' جلسات' : 'بعد ' + pm.done + ' من ' + c.e + ' جلسات'));
    var ring = $('#pmRing', pmEl), cls = 'tl-ring' + (pm.phase === 'break' ? ' brk' : pm.phase === 'long' ? ' lng' : ''); if (ring.className !== cls) ring.className = cls;
    var fg = $('#pmFg', pmEl); fg.style.strokeDasharray = PMC; fg.style.strokeDashoffset = (PMC * (1 - (dur ? rem / dur : 0))).toFixed(2);
    var dots = ''; for (var i = 0; i < c.e; i++) dots += '<i class="' + (i < pm.done ? 'on' : '') + '"></i>'; pmSet('pmDots', 'html', dots);
    var main = pm.running ? 'إيقاف مؤقت' : (pm.remaining < dur ? 'استئناف' : 'بدء المؤقت'); pmSet('pmMainT', 'text', main);
    var live = pm.phase === 'focus' ? Math.max(0, dur - rem) : 0;
    pmSet('pmN', 'text', String(d.n)); pmSet('pmS', 'text', minsTxt(d.s + live)); pmSet('pmB', 'text', String(d.b));
    pmSet('pmSound', 'checked', pm.sound);
    pmSet('pmModeDesc', 'text', c.n + ': ' + c.f + ' دقيقة دراسة، ' + c.b + ' دقائق راحة، وبعد ' + c.e + ' جلسات استراحة طويلة ' + c.l + ' دقيقة.');
    $$('.tl-mode', pmEl).forEach(function (b) { var on = b.dataset.m === pm.mode; if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', on); });
  }
  function pmModes() {
    var h = '';
    var short = { short: 'قصير', mid: 'متوسط', deep: 'عميق' };
    ['short', 'mid', 'deep'].forEach(function (k) { var p = PRE[k]; h += '<button type="button" class="tl-mode" data-m="' + k + '" aria-pressed="false" aria-label="' + p.n + '"><b>' + short[k] + '</b><small>' + p.f + ' / ' + p.b + '</small></button>'; });
    return h + '<button type="button" class="tl-mode" data-m="custom" aria-pressed="false" aria-label="وضع مخصص"><b>مخصص</b><small>بنفسك</small></button>';
  }
  function pmCustomHtml() {
    var c = pm.custom;
    return '<div class="tl-row" style="margin-top:12px"><div class="tl-fld"><label class="tl-lbl" for="pcF">الدراسة (د)</label><input class="tl-in num" id="pcF" inputmode="numeric" value="' + c.f + '"></div><div class="tl-fld"><label class="tl-lbl" for="pcB">الراحة (د)</label><input class="tl-in num" id="pcB" inputmode="numeric" value="' + c.b + '"></div></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="pcL">الاستراحة الطويلة (د)</label><input class="tl-in num" id="pcL" inputmode="numeric" value="' + c.l + '"></div><div class="tl-fld"><label class="tl-lbl" for="pcE">جلسات قبلها</label><input class="tl-in num" id="pcE" inputmode="numeric" value="' + c.e + '"></div></div><div id="pcMsg"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="pcApply">تطبيق المدد</button></div>';
  }
  function pmChangeConfig(apply) { /* apply(): يغيّر الوضع/المدد؛ نؤكد قبل إعادة ضبط مؤقت جارٍ */
    if (pmStarted() && !confirm('هذا التغيير سيعيد ضبط المؤقت الحالي. متابعة؟')) return false;
    if (pm.phase === 'focus') pmCredit(pmDur('focus') - pmRem());
    apply(); pm.running = false; pm.phase = 'focus'; pm.done = 0; pm.remaining = pmDur('focus'); pmSave(); pmLoop(); return true;
  }
  INIT.pomo = function () {
    var v = views.pomo; pmEl = v;
    v.innerHTML = topbar('مؤقت بومودورو') + '<div class="tl-pm-wrap"><div class="tl-box"><h3>اختر الوضع</h3><div class="tl-modes">' + pmModes() + '</div><p class="tl-hint" id="pmModeDesc"></p><div id="pmCustom" hidden>' + pmCustomHtml() + '</div></div>' +
      '<div class="tl-box"><div class="tl-ring" id="pmRing"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="bg" cx="100" cy="100" r="90"/><circle class="fg" id="pmFg" cx="100" cy="100" r="90"/></svg><div class="tl-mid"><div class="tl-phase" id="pmPhase"></div><div class="tl-clock" id="pmClock" role="timer" aria-live="off">00:00</div><div class="tl-hint" id="pmInfo" style="margin:0"></div></div></div><div class="tl-dots" id="pmDots"></div>' +
      '<div class="tl-ctl"><button type="button" class="tl-btn pri main" id="pmMain"><span id="pmMainT">بدء المؤقت</span></button><button type="button" class="tl-btn" id="pmReset">' + I.refresh + '<span>إعادة ضبط</span></button><button type="button" class="tl-btn" id="pmSkip">' + I.chev.replace('m15 18-6-6 6-6', 'm6 17 5-5-5-5M13 17l5-5-5-5') + '<span>تخطي الجلسة</span></button></div>' +
      '<label class="tl-sound" style="margin-top:10px"><input type="checkbox" class="tl-chk" id="pmSound"><span>إشعار صوتي عند انتهاء الجلسة</span></label></div>' +
      '<div class="tl-box"><h3>إحصائيات اليوم</h3><div class="tl-stats"><div class="tl-stat ok"><b id="pmN">0</b><small>جلسات مكتملة</small></div><div class="tl-stat gold"><b id="pmS">0 د</b><small>وقت الدراسة</small></div><div class="tl-stat"><b id="pmB">0</b><small>فترات الراحة</small></div></div><div class="tl-btns"><button type="button" class="tl-btn del sm" id="pmClear">' + I.trash + '<span>تصفير إحصائيات اليوم</span></button></div><p class="tl-hint">يستمر المؤقت في العمل إن انتقلت إلى صفحة أخرى داخل الموقع، وتُحفظ إحصائياتك على جهازك.</p></div></div>';
    $('#pmCustom', v).hidden = pm.mode !== 'custom';
    v.addEventListener('click', function (e) {
      var t = e.target, b;
      if (t.closest('#pmMain')) { if (pm.running) pmPause(); else pmStart(); return; }
      if (t.closest('#pmReset')) { if (pmStarted() && !confirm('إعادة ضبط المؤقت والبدء من جلسة التركيز الأولى؟')) return; pmReset(); return; }
      if (t.closest('#pmSkip')) { pmSkip(); return; }
      if (t.closest('#pmClear')) { if (!confirm('تصفير إحصائيات اليوم (الجلسات ووقت الدراسة والراحة)؟')) return; pm.days[dKey()] = { s: 0, n: 0, b: 0 }; pmSave(); pmRender(); toast('تم التصفير'); return; }
      if ((b = t.closest('.tl-mode'))) {
        var m = b.dataset.m;
        if (m === pm.mode) { $('#pmCustom', v).hidden = m !== 'custom'; return; }
        var okc = pmChangeConfig(function () { pm.mode = m; });
        $('#pmCustom', v).hidden = pm.mode !== 'custom'; if (okc) pmRender();
        return;
      }
      if (t.closest('#pcApply')) {
        var f = num($('#pcF', v).value), br = num($('#pcB', v).value), l = num($('#pcL', v).value), n = num($('#pcE', v).value), er = '';
        function bad(x, lo, hi) { return isNaN(x) || x !== Math.floor(x) || x < lo || x > hi; }
        if (bad(f, 1, 180)) er = 'مدة الدراسة بين 1 و180 دقيقة (عدد صحيح).'; else if (bad(br, 1, 60)) er = 'مدة الراحة بين 1 و60 دقيقة.'; else if (bad(l, 1, 90)) er = 'مدة الاستراحة الطويلة بين 1 و90 دقيقة.'; else if (bad(n, 1, 12)) er = 'عدد الجلسات قبل الاستراحة الطويلة بين 1 و12.';
        $('#pcMsg', v).innerHTML = er ? '<div class="tl-msg bad" role="alert">' + er + '</div>' : '';
        if (er) return;
        if (pmChangeConfig(function () { pm.custom = { n: 'مخصص', f: f, b: br, l: l, e: n }; pm.mode = 'custom'; })) { pmRender(); toast('تم تطبيق المدد المخصصة'); }
      }
    });
    v.addEventListener('change', function (e) {
      if (e.target.id === 'pmSound') { pm.sound = e.target.checked; pmSave(); if (pm.sound) { pmAudio(); pmBeep(); } }
    });
    pmLast = {}; pmRender();
  };
  REFRESH.pomo = function () { pmLast = {}; pmRender(); };

  /* ==========================================================================
     3) حاسبة المعدل الفصلي (سداسي واحد، معدل موزون بالمعاملات)
        المعدل = Σ(علامة × معامل) ÷ Σ المعاملات
     ========================================================================== */
  var GK = 'tl_gpa_v1';
  function defGpa() { return { name: 'السداسي الأول', rows: [{ id: uid(), name: '', mark: '', coef: '' }] }; }
  var gp = (function () {
    var s = lsGet(GK, null);
    if (!s || typeof s !== 'object') s = { work: defGpa(), saved: [], curId: null };
    if (!s.work || !Array.isArray(s.work.rows) || !s.work.rows.length) s.work = defGpa();
    if (!Array.isArray(s.saved)) s.saved = [];
    return s;
  })();
  function gpPersist() {
    if (gp.curId) {
      var e = gp.saved.filter(function (x) { return x.id === gp.curId; })[0];
      if (e) { e.data = clone(gp.work); e.updated = Date.now(); if (gp.work.name.trim()) e.name = gp.work.name.trim(); }
      else gp.curId = null;
    }
    return lsSet(GK, gp);
  }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function gpCalc(rows) {
    var out = { items: {}, nErr: 0, valid: [], sum: 0, coefs: 0, avg: null };
    rows.forEach(function (r) {
      var mS = String(r.mark).trim(), cS = String(r.coef).trim();
      if (mS === '' && cS === '') return; /* صف فارغ: يُتجاهل */
      var m = num(mS), c = num(cS), er = {};
      if (mS === '') er.mark = 'أدخل علامة المقياس.'; else if (isNaN(m)) er.mark = 'العلامة يجب أن تكون رقماً (مثل 12.5).'; else if (m < 0 || m > 20) er.mark = 'العلامة يجب أن تكون بين 0 و20.';
      if (cS === '') er.coef = 'أدخل معامل المقياس.'; else if (isNaN(c)) er.coef = 'المعامل يجب أن يكون رقماً.'; else if (c <= 0) er.coef = 'المعامل يجب أن يكون أكبر من الصفر.';
      if (er.mark || er.coef) { out.items[r.id] = er; out.nErr++; }
      else { out.valid.push({ r: r, m: m, c: c }); out.sum += m * c; out.coefs += c; }
    });
    if (out.valid.length && !out.nErr) out.avg = out.sum / out.coefs;
    return out;
  }
  function trimNum(x) { return String(parseFloat(x.toFixed(2))); }
  var gpEl;
  function gpRowHtml(r) {
    return '<div class="tl-item" data-id="' + esc(r.id) + '"><div class="tl-row"><input class="tl-in tl-grow" data-f="name" maxlength="60" placeholder="اسم المقياس" aria-label="اسم المقياس" value="' + esc(r.name) + '"><button type="button" class="tl-x" data-del="1" aria-label="حذف المقياس">' + I.trash + '</button></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl">العلامة (من 20)</label><input class="tl-in num" data-f="mark" inputmode="decimal" placeholder="مثال: 12.5" value="' + esc(r.mark) + '"></div><div class="tl-fld"><label class="tl-lbl">المعامل</label><input class="tl-in num" data-f="coef" inputmode="decimal" placeholder="مثال: 2" value="' + esc(r.coef) + '"></div></div><div class="tl-err" data-e></div></div>';
  }
  function gpResultHtml(c) {
    if (c.nErr) return '<div class="tl-msg bad" role="alert">يوجد ' + c.nErr + ' ' + (c.nErr === 1 ? 'مقياس ببيانات غير صحيحة' : 'مقاييس ببيانات غير صحيحة') + '. صحّحها (المعلّمة بالأحمر) ليظهر المعدل.</div>';
    if (c.avg === null) return '<p class="tl-empty">أدخل علامة ومعامل مقياس واحد على الأقل ليظهر المعدل الفصلي هنا تلقائياً.</p>';
    var a = r2(c.avg), ok = a >= 10;
    return '<div style="text-align:center;margin-bottom:12px"><div class="tl-hint" style="margin:0">المعدل الفصلي</div><div class="tl-clock" style="font-size:clamp(44px,13vw,60px);color:' + (ok ? 'var(--tl-ok)' : 'var(--tl-bad)') + '">' + a.toFixed(2) + '<small style="font-size:.4em;color:var(--muted);font-weight:400"> / 20</small></div><span class="tl-tag ' + (ok ? 'ok' : 'bad') + '" style="font-size:15px;padding:2px 18px">' + (ok ? 'ناجح' : 'راسب') + '</span></div>' +
      '<div class="tl-stats"><div class="tl-stat gold"><b>' + trimNum(c.coefs) + '</b><small>مجموع المعاملات</small></div><div class="tl-stat"><b>' + c.valid.length + '</b><small>عدد المقاييس</small></div><div class="tl-stat"><b>' + trimNum(c.sum) + '</b><small>مجموع النقاط الموزونة</small></div></div><p class="tl-hint">المعدل = مجموع (العلامة × المعامل) ÷ مجموع المعاملات. النجاح عند معدل 10/20 فأكثر.</p>';
  }
  function gpUpdate() { /* يحدّث النتيجة وأخطاء الصفوف دون إعادة بناء الحقول (للحفاظ على المؤشر) */
    var c = gpCalc(gp.work.rows);
    $$('.tl-item', gpEl).forEach(function (el) {
      var er = c.items[el.dataset.id] || {}, box = $('[data-e]', el);
      box.innerHTML = [er.mark, er.coef].filter(Boolean).map(esc).join('<br>');
      var im = $('[data-f=mark]', el), ic2 = $('[data-f=coef]', el); im.classList.toggle('bad', !!er.mark); ic2.classList.toggle('bad', !!er.coef);
    });
    $('#gpRes', gpEl).innerHTML = gpResultHtml(c);
    return c;
  }
  function gpSavedHtml() {
    if (!gp.saved.length) return '';
    var h = '<div class="tl-box"><h3>كشوف النقاط المحفوظة</h3>';
    gp.saved.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (e) {
      var c = gpCalc(e.data.rows), a = c.avg === null ? '—' : r2(c.avg).toFixed(2);
      h += '<div class="tl-saved" data-sv="' + esc(e.id) + '"><div class="tl-grow"><b>' + esc(e.name) + (e.id === gp.curId ? ' <small>(مفتوح للتعديل)</small>' : '') + '</b><small>المعدل ' + a + ' · ' + c.valid.length + ' مقياس · ' + fmtDateTime(e.updated) + '</small></div><button type="button" class="tl-btn sm pri" data-open="1">فتح / تعديل</button><button type="button" class="tl-x" data-delsv="1" aria-label="حذف الكشف المحفوظ">' + I.trash + '</button></div>';
    });
    return h + '</div>';
  }
  function gpRenderAll() {
    var w = gp.work;
    $('#gpForm', gpEl).innerHTML = '<div class="tl-box"><h3>السداسي</h3><input class="tl-in" id="gpName" maxlength="60" placeholder="مثال: السداسي الأول" aria-label="اسم السداسي" value="' + esc(w.name) + '"></div><div class="tl-box"><h3>المقاييس</h3><div id="gpRows">' + w.rows.map(gpRowHtml).join('') + '</div><button type="button" class="tl-btn pri block" id="gpAdd">' + I.plus + '<span>إضافة مقياس</span></button></div>';
    $('#gpSaved', gpEl).innerHTML = gpSavedHtml();
    gpUpdate();
  }
  function gpPrintHtml(c) {
    var w = gp.work, h = '<h1>كشف نقاط — ' + esc(w.name || 'السداسي') + '</h1><div class="pm">' + fmtDateTime(Date.now()) + '</div><table><thead><tr><th>#</th><th>المقياس</th><th>العلامة /20</th><th>المعامل</th><th>النقاط الموزونة</th></tr></thead><tbody>';
    c.valid.forEach(function (x, i) { h += '<tr><td>' + (i + 1) + '</td><td>' + esc(x.r.name || ('مقياس ' + (i + 1))) + '</td><td style="text-align:center">' + trimNum(x.m) + '</td><td style="text-align:center">' + trimNum(x.c) + '</td><td style="text-align:center">' + trimNum(x.m * x.c) + '</td></tr>'; });
    var a = r2(c.avg);
    return h + '<tr><th colspan="3">المجموع</th><th>' + trimNum(c.coefs) + '</th><th>' + trimNum(c.sum) + '</th></tr></tbody></table><div class="big">المعدل الفصلي: ' + a.toFixed(2) + ' / 20 — ' + (a >= 10 ? 'ناجح' : 'راسب') + '</div>';
  }
  function gpGuard() { /* يمنع الحفظ/الطباعة عند وجود أخطاء أو عدم وجود بيانات */
    var c = gpUpdate();
    if (c.nErr) { toast('صحّح البيانات الخاطئة أولاً'); return null; }
    if (c.avg === null) { toast('أدخل مقياساً واحداً على الأقل'); return null; }
    return c;
  }
  INIT.gpa = function () {
    var v = views.gpa; gpEl = v;
    v.innerHTML = topbar('حساب المعدل الفصلي') + '<div class="tl-wrap"><div id="gpSaved"></div><div id="gpForm"></div><div class="tl-box" id="gpResBox"><h3>النتيجة</h3><div id="gpRes"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="gpSave">' + I.save + '<span>حفظ كشف النقاط</span></button><button type="button" class="tl-btn" id="gpPrint">' + I.print + '<span>طباعة</span></button><button type="button" class="tl-btn" id="gpPdf">' + I.pdf + '<span>تحميل PDF</span></button><button type="button" class="tl-btn del" id="gpReset">' + I.refresh + '<span>إعادة ضبط</span></button></div><p class="tl-hint">«تحميل PDF» يفتح نافذة الطباعة؛ اختر منها «حفظ بصيغة PDF».</p></div></div>';
    gpRenderAll();
    v.addEventListener('input', function (e) {
      var t = e.target, row;
      if (t.id === 'gpName') { gp.work.name = t.value; gpPersist(); return; }
      if ((row = t.closest('.tl-item')) && t.dataset.f) {
        var r = gp.work.rows.filter(function (x) { return x.id === row.dataset.id; })[0]; if (!r) return;
        r[t.dataset.f] = t.value; gpPersist(); gpUpdate();
      }
    });
    v.addEventListener('click', function (e) {
      var t = e.target, w = gp.work, c;
      if (t.closest('#gpAdd')) { var nr = { id: uid(), name: '', mark: '', coef: '' }; w.rows.push(nr); gpPersist(); $('#gpRows', v).insertAdjacentHTML('beforeend', gpRowHtml(nr)); var f = $('#gpRows .tl-item:last-child input', v); if (f) f.focus(); return; }
      if (t.closest('[data-del]') && t.closest('.tl-item')) {
        var id = t.closest('.tl-item').dataset.id;
        if (w.rows.length === 1) { w.rows[0].name = ''; w.rows[0].mark = ''; w.rows[0].coef = ''; gpPersist(); gpRenderAll(); return; }
        w.rows = w.rows.filter(function (x) { return x.id !== id; }); t.closest('.tl-item').remove(); gpPersist(); gpUpdate(); return;
      }
      if (t.closest('#gpReset')) {
        if (!confirm('إعادة ضبط الحاسبة ومسح كل المقاييس المُدخلة؟ (الكشوف المحفوظة لا تتأثر)')) return;
        gp.work = defGpa(); gp.curId = null; lsSet(GK, gp); gpRenderAll(); toast('تمت إعادة الضبط'); return;
      }
      if (t.closest('#gpSave')) {
        if (!(c = gpGuard())) return;
        var nm = (w.name || '').trim() || 'كشف نقاط'; w.name = nm; var ni = $('#gpName', v); if (ni) ni.value = nm;
        var e1 = gp.curId ? gp.saved.filter(function (x) { return x.id === gp.curId; })[0] : null;
        if (e1) { e1.name = nm; e1.data = clone(w); e1.updated = Date.now(); }
        else { e1 = { id: uid(), name: nm, data: clone(w), updated: Date.now() }; gp.saved.push(e1); gp.curId = e1.id; }
        if (!lsSet(GK, gp)) { toast('تعذّر الحفظ: مساحة التخزين ممتلئة'); return; }
        $('#gpSaved', v).innerHTML = gpSavedHtml(); toast('تم حفظ كشف النقاط «' + nm + '»'); return;
      }
      if (t.closest('#gpPrint') || t.closest('#gpPdf')) { if ((c = gpGuard())) doPrint(gpPrintHtml(c), !!t.closest('#gpPdf')); return; }
      var sv = t.closest('[data-sv]');
      if (sv && t.closest('[data-open]')) {
        var e2 = gp.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e2) return;
        gp.work = clone(e2.data); gp.curId = e2.id; lsSet(GK, gp); gpRenderAll(); toast('تم فتح «' + e2.name + '» — تعديلاتك تُحفظ فيه تلقائياً'); scrollTo(0, 0); return;
      }
      if (sv && t.closest('[data-delsv]')) {
        var e3 = gp.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e3) return;
        if (!confirm('حذف الكشف المحفوظ «' + e3.name + '» نهائياً؟')) return;
        gp.saved = gp.saved.filter(function (x) { return x.id !== e3.id; }); if (gp.curId === e3.id) gp.curId = null; lsSet(GK, gp); $('#gpSaved', v).innerHTML = gpSavedHtml(); toast('تم حذف الكشف');
      }
    });
  };
  REFRESH.gpa = function () { $('#gpSaved', gpEl).innerHTML = gpSavedHtml(); };

  /* ==========================================================================
     4) قائمة المهام الجامعية
     ========================================================================== */
  var TK = 'tl_todo_v1';
  var CATS = { study: 'دراسة ومراجعة', hw: 'واجبات جامعية', proj: 'بحوث ومشاريع', exam: 'امتحانات', pres: 'عروض تقديمية', other: 'مهام أخرى' };
  var PRI = { high: 'مرتفعة', mid: 'متوسطة', low: 'منخفضة' };
  var SECS = [['all', 'جميع المهام'], ['pending', 'غير المكتملة'], ['done', 'المكتملة'], ['today', 'مهام اليوم'], ['upcoming', 'القادمة'], ['late', 'المتأخرة']];
  var td = (function () {
    var s = lsGet(TK, null);
    if (!s || !Array.isArray(s.tasks)) s = { tasks: [] };
    s.tasks = s.tasks.filter(function (t) { return t && t.id && t.title && /^\d{4}-\d{2}-\d{2}$/.test(t.date || ''); });
    return s;
  })();
  var tdUi = { sec: 'all', q: '', cat: '', pri: '', st: '' }, tdEl = null;
  function tdSave() { return lsSet(TK, td); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dueTs(t) { var p = t.date.split('-'), tm = /^\d{1,2}:\d{2}$/.test(t.time || '') ? t.time.split(':') : null; return new Date(+p[0], +p[1] - 1, +p[2], tm ? +tm[0] : 23, tm ? +tm[1] : 59, tm ? 0 : 59, tm ? 0 : 999).getTime(); }
  function tdState(t, now) { if (t.done) return 'done'; var d = dueTs(t); if (d < now) return 'late'; if (d - now <= 86400000) return 'soon'; return 'ok'; }
  function dayDiff(dateStr) { var p = dateStr.split('-'), a = new Date(+p[0], +p[1] - 1, +p[2]), n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate()); return Math.round((a - n) / 86400000); }
  function relTxt(dateStr) { var k = dayDiff(dateStr); return k === 0 ? 'اليوم' : k === 1 ? 'غداً' : k === -1 ? 'أمس' : k > 1 ? 'بعد ' + k + ' يوماً' : 'قبل ' + (-k) + ' يوماً'; }
  function dateTxt(dateStr) { var p = dateStr.split('-'); try { return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('ar-DZ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return dateStr; } }
  function tdInSec(t, sec, now, today) {
    switch (sec) {
      case 'pending': return !t.done;
      case 'done': return t.done;
      case 'today': return t.date === today;
      case 'upcoming': return !t.done && t.date > today;
      case 'late': return tdState(t, now) === 'late';
      default: return true;
    }
  }
  function tdVisible() {
    var now = Date.now(), today = ymd(new Date()), q = tdUi.q.trim().toLowerCase();
    return td.tasks.filter(function (t) {
      if (!tdInSec(t, tdUi.sec, now, today)) return false;
      if (tdUi.cat && t.cat !== tdUi.cat) return false;
      if (tdUi.pri && t.pri !== tdUi.pri) return false;
      if (tdUi.st === 'pending' && t.done) return false;
      if (tdUi.st === 'done' && !t.done) return false;
      if (q && (t.title + ' ' + (t.desc || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return (a.done - b.done) || (dueTs(a) - dueTs(b)) || (IMPW[b.pri] - IMPW[a.pri]); });
  }
  function tdCardHtml(t, now) {
    var st = tdState(t, now), cls = 'tl-task p-' + t.pri + (t.done ? ' done' : '') + (st === 'late' ? ' late' : '') + (st === 'soon' ? ' soon' : '');
    var h = '<div class="' + cls + '" data-id="' + esc(t.id) + '"><input type="checkbox" class="tl-chk" data-tog="1" aria-label="إكمال المهمة"' + (t.done ? ' checked' : '') + ' style="margin-top:6px"><div class="tl-body"><div class="tl-tt">' + esc(t.title) + '</div>';
    if (t.desc) h += '<div class="tl-td">' + esc(t.desc) + '</div>';
    h += '<div class="tl-meta"><span class="tl-tag gold">' + (CATS[t.cat] || CATS.other) + '</span>';
    h += '<span class="tl-tag ' + (t.pri === 'high' ? 'bad' : t.pri === 'mid' ? 'warn' : 'ok') + '">أولوية ' + PRI[t.pri] + '</span>';
    h += '<span class="tl-tag">' + dateTxt(t.date) + (t.time ? ' · ' + esc(t.time) : '') + (t.done ? '' : ' · ' + relTxt(t.date)) + '</span>';
    if (st === 'late') h += '<span class="tl-tag bad">متأخرة</span>'; else if (st === 'soon') h += '<span class="tl-tag warn">يقترب موعدها</span>'; else if (t.done) h += '<span class="tl-tag ok">مكتملة</span>';
    return h + '</div></div><div class="tl-acts"><button type="button" class="tl-x" data-edit="1" aria-label="تعديل المهمة">' + I.edit + '</button><button type="button" class="tl-x del" data-del="1" aria-label="حذف المهمة">' + I.trash + '</button></div></div>';
  }
  function tdRender() {
    if (!tdEl) return;
    var now = Date.now(), today = ymd(new Date()), T = td.tasks;
    var done = T.filter(function (t) { return t.done; }).length, late = T.filter(function (t) { return tdState(t, now) === 'late'; }).length, tot = T.length, pct = tot ? Math.round(done * 100 / tot) : 0;
    $('#tdStats', tdEl).innerHTML = '<div class="tl-stats s5"><div class="tl-stat"><b>' + tot + '</b><small>إجمالي المهام</small></div><div class="tl-stat ok"><b>' + done + '</b><small>المكتملة</small></div><div class="tl-stat gold"><b>' + (tot - done) + '</b><small>المتبقية</small></div><div class="tl-stat bad"><b>' + late + '</b><small>المتأخرة</small></div><div class="tl-stat gold"><b>' + pct + '%</b><small>نسبة الإنجاز</small></div></div><div class="tl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>';
    var soon = T.filter(function (t) { return tdState(t, now) === 'soon'; }).sort(function (a, b) { return dueTs(a) - dueTs(b); });
    $('#tdAlert', tdEl).innerHTML = (soon.length ? '<div class="tl-msg warn" role="alert">⏰ ' + (soon.length === 1 ? 'مهمة يقترب موعدها خلال 24 ساعة: ' : soon.length + ' مهام يقترب موعدها خلال 24 ساعة: ') + soon.slice(0, 3).map(function (t) { return '«' + esc(t.title) + '»'; }).join('، ') + (soon.length > 3 ? ' …' : '') + '</div>' : '') + (late ? '<div class="tl-msg bad" role="alert">لديك ' + late + (late === 1 ? ' مهمة متأخرة' : ' مهام متأخرة') + '.</div>' : '');
    $('#tdTabs', tdEl).innerHTML = SECS.map(function (s) { var n = T.filter(function (t) { return tdInSec(t, s[0], now, today); }).length; return '<button type="button" class="tl-chip" data-sec="' + s[0] + '" aria-pressed="' + (tdUi.sec === s[0]) + '">' + s[1] + '<i>' + n + '</i></button>'; }).join('');
    var L = tdVisible();
    $('#tdList', tdEl).innerHTML = L.length ? L.map(function (t) { return tdCardHtml(t, now); }).join('') : '<p class="tl-empty">' + (T.length ? 'لا توجد مهام تطابق هذا العرض.' : 'لا توجد مهام بعد. اضغط «إضافة مهمة» لتسجيل أول مهمة جامعية.') + '</p>';
  }
  function tdModal(id) {
    var t = id ? td.tasks.filter(function (x) { return x.id === id; })[0] : null, isNew = !t;
    if (isNew) t = { title: '', desc: '', date: ymd(new Date()), time: '', pri: 'mid', cat: 'study' };
    function opts(o, cur) { return Object.keys(o).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + o[k] + '</option>'; }).join(''); }
    openModal('<h3>' + (isNew ? 'إضافة مهمة' : 'تعديل المهمة') + '</h3><label class="tl-lbl" for="tmT">عنوان المهمة</label><input class="tl-in" id="tmT" maxlength="120" placeholder="مثال: مراجعة محاضرة التشريح" value="' + esc(t.title) + '"><label class="tl-lbl" for="tmD">الوصف (اختياري)</label><textarea class="tl-ta" id="tmD" maxlength="600" placeholder="تفاصيل إضافية">' + esc(t.desc || '') + '</textarea><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="tmDt">تاريخ الإنجاز</label><input type="date" class="tl-in" id="tmDt" value="' + esc(t.date) + '"></div><div class="tl-fld"><label class="tl-lbl" for="tmTm">الوقت (اختياري)</label><input type="time" class="tl-in" id="tmTm" value="' + esc(t.time || '') + '"></div></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="tmP">الأولوية</label><select class="tl-sel" id="tmP">' + opts(PRI, t.pri) + '</select></div><div class="tl-fld"><label class="tl-lbl" for="tmC">التصنيف</label><select class="tl-sel" id="tmC">' + opts(CATS, t.cat) + '</select></div></div><div id="tmE"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="tmOk">' + I.save + '<span>' + (isNew ? 'إضافة المهمة' : 'حفظ التعديلات') + '</span></button><button type="button" class="tl-btn" id="tmNo">إلغاء</button></div>');
    $('#tmNo', modal).onclick = closeModal;
    $('#tmOk', modal).onclick = function () {
      var ti = $('#tmT', modal).value.trim(), dt = $('#tmDt', modal).value, tm = $('#tmTm', modal).value, e = '';
      if (!ti) e = 'اكتب عنوان المهمة.'; else if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) e = 'اختر تاريخ إنجاز المهمة.';
      if (e) { $('#tmE', modal).innerHTML = '<div class="tl-msg bad" role="alert">' + e + '</div>'; return; }
      var data = { title: ti, desc: $('#tmD', modal).value.trim(), date: dt, time: tm || '', pri: $('#tmP', modal).value, cat: $('#tmC', modal).value };
      if (isNew) { data.id = uid(); data.done = false; data.created = Date.now(); td.tasks.push(data); }
      else for (var k in data) t[k] = data[k];
      if (!tdSave()) { toast('تعذّر الحفظ: مساحة التخزين ممتلئة'); return; }
      closeModal(); tdRender(); toast(isNew ? 'تمت إضافة المهمة' : 'تم حفظ التعديلات');
    };
  }
  function tdPrintHtml() {
    var L = tdVisible(), now = Date.now(), lbl = SECS.filter(function (s) { return s[0] === tdUi.sec; })[0][1];
    var h = '<h1>قائمة المهام الجامعية — ' + lbl + '</h1><div class="pm">' + fmtDateTime(now) + ' · ' + L.length + ' مهمة</div><table><thead><tr><th>تمّت</th><th>المهمة</th><th>التصنيف</th><th>الأولوية</th><th>الموعد</th></tr></thead><tbody>';
    L.forEach(function (t) { h += '<tr' + (t.done ? ' class="dn"' : '') + '><td style="text-align:center">' + (t.done ? '✓' : '☐') + '</td><td>' + esc(t.title) + (t.desc ? '<br><small>' + esc(t.desc) + '</small>' : '') + '</td><td>' + CATS[t.cat] + '</td><td>' + PRI[t.pri] + '</td><td>' + esc(t.date) + (t.time ? ' ' + esc(t.time) : '') + (tdState(t, now) === 'late' ? ' (متأخرة)' : '') + '</td></tr>'; });
    return h + '</tbody></table>';
  }
  INIT.todo = function () {
    var v = views.todo; tdEl = v;
    function o(m) { return Object.keys(m).map(function (k) { return '<option value="' + k + '">' + m[k] + '</option>'; }).join(''); }
    v.innerHTML = topbar('قائمة المهام') + '<div class="tl-wrap"><div class="tl-box"><div id="tdStats"></div><div id="tdAlert"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="tdAdd">' + I.plus + '<span>إضافة مهمة</span></button><button type="button" class="tl-btn" id="tdPrint">' + I.print + '<span>طباعة القائمة</span></button><button type="button" class="tl-btn del" id="tdClear">' + I.trash + '<span>مسح المكتملة</span></button></div></div>' +
      '<div class="tl-box"><div id="tdTabs" class="tl-tabs" role="group" aria-label="أقسام المهام"></div><input class="tl-in" id="tdQ" type="search" placeholder="ابحث عن مهمة بالاسم…" aria-label="بحث"><div class="tl-row" style="margin-top:10px"><div class="tl-fld"><label class="tl-lbl" for="tdFc">التصنيف</label><select class="tl-sel" id="tdFc"><option value="">الكل</option>' + o(CATS) + '</select></div><div class="tl-fld"><label class="tl-lbl" for="tdFp">الأولوية</label><select class="tl-sel" id="tdFp"><option value="">الكل</option>' + o(PRI) + '</select></div><div class="tl-fld"><label class="tl-lbl" for="tdFs">الحالة</label><select class="tl-sel" id="tdFs"><option value="">الكل</option><option value="pending">غير مكتملة</option><option value="done">مكتملة</option></select></div></div></div><div id="tdList"></div></div>';
    tdRender();
    v.addEventListener('input', function (e) { if (e.target.id === 'tdQ') { tdUi.q = e.target.value; tdRender(); } });
    v.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'tdFc') { tdUi.cat = t.value; tdRender(); } else if (t.id === 'tdFp') { tdUi.pri = t.value; tdRender(); } else if (t.id === 'tdFs') { tdUi.st = t.value; tdRender(); }
      else if (t.dataset.tog) {
        var id = t.closest('.tl-task').dataset.id, k = td.tasks.filter(function (x) { return x.id === id; })[0]; if (!k) return;
        k.done = t.checked; k.doneAt = t.checked ? Date.now() : 0; tdSave(); tdRender(); toast(t.checked ? 'أحسنت! تم إنجاز المهمة' : 'أُعيدت المهمة إلى غير المكتملة');
      }
    });
    v.addEventListener('click', function (e) {
      var t = e.target, b;
      if (t.closest('#tdAdd')) { tdModal(null); return; }
      if (t.closest('#tdPrint')) { doPrint(tdPrintHtml(), false); return; }
      if (t.closest('#tdClear')) {
        var n = td.tasks.filter(function (x) { return x.done; }).length;
        if (!n) { toast('لا توجد مهام مكتملة لمسحها'); return; }
        if (!confirm('سيتم حذف ' + n + (n === 1 ? ' مهمة مكتملة' : ' مهام مكتملة') + ' نهائياً. متابعة؟')) return;
        td.tasks = td.tasks.filter(function (x) { return !x.done; }); tdSave(); tdRender(); toast('تم مسح المهام المكتملة'); return;
      }
      if ((b = t.closest('[data-sec]'))) { tdUi.sec = b.dataset.sec; tdRender(); return; }
      var card = t.closest('.tl-task');
      if (card && t.closest('[data-edit]')) { tdModal(card.dataset.id); return; }
      if (card && t.closest('[data-del]')) {
        var k = td.tasks.filter(function (x) { return x.id === card.dataset.id; })[0]; if (!k) return;
        if (!confirm('حذف المهمة «' + k.title + '» نهائياً؟')) return;
        td.tasks = td.tasks.filter(function (x) { return x.id !== k.id; }); tdSave(); tdRender(); toast('تم حذف المهمة');
      }
    });
  };
  REFRESH.todo = function () { tdRender(); };
  setInterval(function () { if (tdEl && !root.hidden && !views.todo.hidden && !mbg.classList.contains('open')) tdRender(); }, 60000);

})();
