/* ==========================================================================
   refs-ui.js — واجهة «مولّد المراجع الأكاديمية» (بادئة rf-)
   - تُركَّب داخل قسم «الأدوات» عبر RF.ui.init(view) على نمط أداة البحث (research-*.js)
   - المشاريع: عدة مشاريع بحث مستقلة؛ لكل مشروع قائمة مراجع ونمط توثيق وإعدادات خاصة به (المنطق في refs-projects.js → RF.proj)
   - الحفظ: localStorage بالمفتاح tl_refs_projects_v1 فقط (يُرحَّل إليه المفتاح القديم tl_refs_v1 تلقائياً دون حذفه)
   - المراجع تُخزَّن كبيانات خام؛ التنسيق يُشتقّ منها في كل مرة (لذلك تغيير النمط يعيد تنسيق الكل)
   - التوثيق داخل النص: زر «توثيق داخل النص» تحت كل مرجع محفوظ؛ يُشتقّ من بيانات المرجع نفسها عبر RF.cite (refs-core.js)
     وحالة اللوحة (مفتوحة/النوع/الصفحة) مؤقتة في الذاكرة ولا تُحفظ
   - لا شبكة ولا ذكاء اصطناعي. المرحلة الثانية (جلب تلقائي / تصدير) تُضاف دون لمس هذا الملف:
     اربطها بـ RF.ui.on('items', fn) وبدوال RF.formatList / RF.clipboardHtml في refs-core.js
   ========================================================================== */
(function () {
  'use strict';
  var RF = window.RF;
  if (!RF) return;

  var P = RF.proj;
  var esc = RF.esc;

  /* ---------- أدوات صغيرة ---------- */
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var I = {
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
    print: ic('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>'),
    x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    check: ic('<path d="M20 6 9 17l-5-5"/>'),
    quote: ic('<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>')
  };
  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function reduceMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  /* ---------- الحالة ---------- */
  var root = null, store = null, st = null, draft = null, editing = null, filter = '', saveOk = true, flashId = null;
  var listeners = { items: [], form: [] };
  var citeUI = {}, citeRes = {}, citeCtx = {}; /* حالة لوحة التوثيق داخل النص لكل مرجع (مؤقتة) */

  /* st = المشروع المفتوح حالياً (كائن داخل store.projects): { id, name, style, chicago, sort, titleCase, exp, items[] } */
  function findProject(id) {
    for (var i = 0; i < store.projects.length; i++) if (store.projects[i].id === id) return store.projects[i];
    return null;
  }
  function applyExp() { /* إعدادات التصدير الخاصة بالمشروع تُطبَّق على محرّك التصدير */
    if (RF.exp && st && st.exp) { RF.exp.set('hang', st.exp.hang); RF.exp.set('split', st.exp.split); }
  }
  function loadStore() {
    var keep = st && st.id;
    store = P.load();
    st = (keep && findProject(keep)) || P.active(store);
    store.active = st.id;
    applyExp();
  }
  function fireItems() {
    listeners.items.forEach(function (fn) { try { fn(st.items.slice()); } catch (e) { /* ignore */ } });
  }
  function fireForm() {
    listeners.form.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  function persist() {
    st.updated = Date.now();
    saveOk = P.save(store);
    fireItems();
    renderProjects();
    return saveOk;
  }
  function opts() { return { titleCase: st.titleCase, sort: st.sort }; }

  /* ---------- إشعار + نافذة تأكيد ---------- */
  var toastEl = null, toastT = 0;
  function toast(m, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'tl-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = m; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2200);
  }
  var dlg = null, dlgCb = null, dlgFrom = null;
  function closeDlg() {
    if (!dlg) return;
    dlg.classList.remove('open'); dlgCb = null;
    if (dlgFrom && dlgFrom.focus) { try { dlgFrom.focus(); } catch (e) { /* ignore */ } }
  }
  function confirmDlg(title, msg, okLabel, cb) {
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.className = 'tl-mbg rf-dlg';
      dlg.innerHTML = '<div class="tl-modal" role="alertdialog" aria-modal="true" aria-labelledby="rfDT" aria-describedby="rfDM"><h3 id="rfDT"></h3><p id="rfDM" class="rf-dmsg"></p><div class="tl-btns"><button type="button" class="tl-btn del" data-d="ok"></button><button type="button" class="tl-btn" data-d="no">إلغاء</button></div></div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) {
        var b = e.target.closest('[data-d]');
        if (e.target === dlg || (b && b.dataset.d === 'no')) { closeDlg(); return; }
        if (b && b.dataset.d === 'ok') { var f = dlgCb; closeDlg(); if (f) f(); }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dlg.classList.contains('open')) closeDlg(); });
    }
    dlgFrom = document.activeElement; dlgCb = cb;
    $('#rfDT', dlg).textContent = title;
    $('#rfDM', dlg).textContent = msg;
    $('[data-d="ok"]', dlg).textContent = okLabel;
    dlg.classList.add('open');
    $('[data-d="no"]', dlg).focus();
  }

  /* ---------- النسخ ---------- */
  function copyResults(results, what, inline, hang) {
    var html = inline ? RF.clipboardInline(results) : (hang && RF.exp ? RF.exp.clipboardHtml(results, true) : RF.clipboardHtml(results));
    var text = results.map(function (o) { return o.text; }).join('\n\n');
    function ok() { toast(what || 'تم النسخ'); }
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var done = document.execCommand('copy');
        document.body.removeChild(ta);
        done ? ok() : toast('تعذّر النسخ. حدّد النص وانسخه يدوياً.');
      } catch (e) { toast('تعذّر النسخ. حدّد النص وانسخه يدوياً.'); }
    }
    function plain() {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, legacy);
      else legacy();
    }
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      try {
        navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]).then(ok, plain);
        return;
      } catch (e) { /* يتابع إلى النص العادي */ }
    }
    plain();
  }

  /* ---------- الحالة الافتراضية للمسودّة ---------- */
  function ensureDefaults() {
    if (draft.type === 'thesis' && !draft.f.level) draft.f.level = 'master';
    if (draft.type === 'report' && !draft.f.kind) draft.f.kind = 'report';
    if (!draft.authors.length) draft.authors = [{ family: '', given: '' }];
  }
  function freshDraft(keepFrom) {
    var d = RF.newRef(keepFrom ? keepFrom.type : 'book');
    if (keepFrom) { d.lang = keepFrom.lang; }
    return d;
  }

  /* ======================================================================
     بناء الواجهة
     ====================================================================== */
  var TIPS = {
    apa: 'APA 7: اكتب عناوين الكتب والمقالات بحالة الجملة (حرف كبير للكلمة الأولى وأسماء الأعلام فقط)، أما أسماء المجلات فتُضبط تلقائياً.',
    harvard: 'Harvard: اكتب عناوين الأعمال بحالة الجملة كما تريدها أن تظهر، وتُضبط أسماء المجلات تلقائياً.',
    mla: 'MLA: تُكتب العناوين اللاتينية بحالة العنوان (Title Case) وتُضبط تلقائياً عند تفعيل الخيار أدناه.',
    'chicago-nb': 'Chicago (حواشي): تظهر لكل مرجع عبارة قائمة المراجع، وتحتها الحاشية الأولى جاهزة؛ ولإضافة رقم الصفحة المقتبس منها استعمل «توثيق داخل النص» تحت المرجع.',
    'chicago-ad': 'Chicago (مؤلف-تاريخ): يُستشهد في المتن بـ (اللقب سنة)، وتُرتَّب القائمة أبجدياً.'
  };

  function build() {
    root.innerHTML =
      '<div class="rf-root">' +
      '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div>' +
      '<h2 class="ptitle">مولّد المراجع الأكاديمية</h2>' +
      '<p class="tl-sub">أدخل بيانات المرجع فيُنسَّق فوراً وفق النمط الذي تختاره، وتبقى قائمتك محفوظة على هذا الجهاز.</p>' +
      '<div id="rfProjBox" class="tl-box"></div><input type="file" id="rfImpFile" accept=".json,application/json" hidden>' +
      '<div id="rfStyleBox"></div><div id="rfFormBox" class="tl-box"></div>' +
      '<div class="tl-box" id="rfPrevBox"><h3>معاينة المرجع</h3><div id="rfPrev" class="rf-prev" aria-live="polite"></div><div class="tl-btns" id="rfPrevAct"></div></div>' +
      '<div id="rfListBox" class="tl-box"></div></div>';
    renderProjects(); renderStyle(); renderForm(); renderPreview(); renderList();
  }

  /* ----- نمط التوثيق ----- */
  function renderStyle() {
    var cur = st.style, grp = cur.indexOf('chicago') === 0 ? 'chicago' : cur;
    var h = '<div class="tl-box"><h3>نمط التوثيق</h3><div class="tl-chips" role="group" aria-label="نمط التوثيق">';
    RF.STYLE_GROUPS.forEach(function (g) {
      var key = g.id === 'chicago' ? st.chicago : g.keys[0];
      h += '<button type="button" class="tl-chip" data-act="style" data-v="' + key + '" aria-pressed="' + (grp === g.id) + '">' + esc(g.label) + '</button>';
    });
    h += '</div>';
    if (grp === 'chicago') {
      h += '<div class="rf-sub"><div class="tl-lbl">نوع Chicago</div><div class="tl-chips" role="group" aria-label="نوع Chicago">' +
        '<button type="button" class="tl-chip" data-act="style" data-v="chicago-nb" aria-pressed="' + (cur === 'chicago-nb') + '">Notes &amp; Bibliography<i>حواشي وقائمة</i></button>' +
        '<button type="button" class="tl-chip" data-act="style" data-v="chicago-ad" aria-pressed="' + (cur === 'chicago-ad') + '">Author-Date<i>مؤلف وتاريخ</i></button></div></div>';
    }
    h += '<p class="tl-hint" id="rfTip">' + esc(TIPS[cur]) + '</p>' +
      '<label class="rf-chk"><input type="checkbox" class="tl-chk" data-pref="titleCase"' + (st.titleCase ? ' checked' : '') + '> ضبط حالة أحرف العناوين اللاتينية تلقائياً (لا يُغيَّر شيء في العناوين العربية)</label></div>';
    $('#rfStyleBox').innerHTML = h;
  }

  /* ----- النموذج ----- */
  function peopleHtml(which, cfg) {
    var isAu = which === 'authors', list = draft[which];
    var h = '<div class="rf-people" data-fw="' + which + '"><div class="rf-ph"><span class="tl-lbl">' + esc(cfg.label) + (cfg.req ? ' <b class="rf-req">*</b>' : '') + '</span>';
    if (isAu) h += '<label class="rf-chk"><input type="checkbox" class="tl-chk" data-top="orgMode"' + (draft.orgMode ? ' checked' : '') + '> المؤلف جهة / مؤسسة</label>';
    h += '</div>';
    if (isAu && draft.orgMode) {
      h += '<input class="tl-in" dir="auto" data-top="org" autocomplete="off" maxlength="200" placeholder="اسم الجهة، مثال: منظمة الصحة العالمية" aria-label="اسم الجهة" value="' + esc(draft.org) + '">';
    } else {
      list.forEach(function (p, i) {
        var n = i + 1;
        h += '<div class="rf-prow">' +
          '<input class="tl-in" dir="auto" data-p="' + which + '" data-i="' + i + '" data-k="family" autocomplete="off" maxlength="80" placeholder="اللقب" aria-label="لقب ' + (isAu ? 'المؤلف ' : 'المحرر ') + n + '" value="' + esc(p.family) + '">' +
          '<input class="tl-in" dir="auto" data-p="' + which + '" data-i="' + i + '" data-k="given" autocomplete="off" maxlength="80" placeholder="الاسم الأول" aria-label="الاسم الأول ' + (isAu ? 'للمؤلف ' : 'للمحرر ') + n + '" value="' + esc(p.given) + '">' +
          '<button type="button" class="tl-x" data-act="rmp" data-p="' + which + '" data-i="' + i + '" aria-label="حذف ' + (isAu ? 'المؤلف ' : 'المحرر ') + n + '"' + (isAu && list.length === 1 ? ' disabled' : '') + '>' + I.x + '</button></div>';
      });
      h += '<button type="button" class="tl-btn sm" data-act="addp" data-p="' + which + '">' + I.plus + (isAu ? 'إضافة مؤلف' : 'إضافة محرر') + '</button>';
      if (isAu) h += '<p class="tl-hint">اللقب في الخانة الأولى (مثال: بن عبد الله أو Smith) والاسم الأول في الثانية. يمكنك إضافة أي عدد من المؤلفين بترتيب ظهورهم في الغلاف.</p>';
    }
    h += '<div class="tl-err" hidden></div></div>';
    return h;
  }
  function fieldHtml(d) {
    var id = 'rf-f-' + d.k, val = draft.f[d.k] || '', inner = '', i;
    if (d.kind === 'month') {
      inner = '<select class="tl-sel" id="' + id + '" data-f="month"><option value="">—</option>';
      for (i = 0; i < 12; i++) inner += '<option value="' + (i + 1) + '"' + (String(val) === String(i + 1) ? ' selected' : '') + '>' + RF.MONTHS.ar[i] + ' (' + RF.MONTHS.en[i] + ')</option>';
      inner += '</select>';
    } else if (d.kind === 'level') {
      var L = [['licence', 'مذكرة ليسانس'], ['master', 'مذكرة ماستر'], ['magister', 'رسالة ماجستير'], ['phd', 'أطروحة دكتوراه']];
      inner = '<select class="tl-sel" id="' + id + '" data-f="level">' + L.map(function (o) { return '<option value="' + o[0] + '"' + (val === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    } else if (d.kind === 'kind') {
      var K = [['report', 'تقرير'], ['study', 'دراسة'], ['working', 'ورقة عمل']];
      inner = '<select class="tl-sel" id="' + id + '" data-f="kind">' + K.map(function (o) { return '<option value="' + o[0] + '"' + (val === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    } else if (d.kind === 'date') {
      inner = '<input class="tl-in" type="date" id="' + id + '" data-f="' + d.k + '" value="' + esc(val) + '">';
    } else {
      var ltr = d.k === 'url' || d.k === 'doi';
      inner = '<input class="tl-in' + (ltr ? ' rf-ltr' : '') + '" id="' + id + '" data-f="' + d.k + '" autocomplete="off" maxlength="400"' +
        (ltr ? ' dir="ltr" inputmode="' + (d.k === 'url' ? 'url' : 'text') + '" autocapitalize="off" spellcheck="false"' : ' dir="auto"') +
        (d.inputmode && !ltr ? ' inputmode="' + d.inputmode + '"' : '') +
        (d.ph ? ' placeholder="' + esc(d.ph) + '"' : '') + ' value="' + esc(val) + '">';
    }
    return '<div class="tl-fld' + (d.wide ? ' rf-w' : '') + '" data-fw="' + d.k + '"><label class="tl-lbl" for="' + id + '">' + esc(d.l) + (d.req ? ' <b class="rf-req">*</b>' : '') + '</label>' + inner + '<div class="tl-err" hidden></div></div>';
  }
  function renderForm() {
    ensureDefaults();
    var T = RF.TYPES[draft.type];
    var h = '<h3>' + (editing ? 'تعديل المرجع' : 'إضافة مرجع جديد') + '</h3>';
    h += '<div class="tl-lbl">نوع المرجع</div><div class="tl-chips" role="group" aria-label="نوع المرجع">';
    RF.TYPE_ORDER.forEach(function (k) {
      h += '<button type="button" class="tl-chip" data-act="type" data-v="' + k + '" aria-pressed="' + (draft.type === k) + '">' + esc(RF.TYPES[k].label) + '</button>';
    });
    h += '</div>';
    h += '<div class="rf-langrow"><label class="tl-lbl" for="rfLang">لغة المرجع</label><select class="tl-sel" id="rfLang" data-top="lang">' +
      [['auto', 'تلقائي (حسب عنوان المرجع)'], ['ar', 'عربي'], ['en', 'لاتيني (بتنسيق إنجليزي)']].map(function (o) { return '<option value="' + o[0] + '"' + (draft.lang === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div>';
    h += '<div id="rfFetchSlot"></div>'; /* مكان لوحة الجلب التلقائي (refs-fetch.js) */
    h += peopleHtml('authors', T.authors);
    if (T.editors) h += peopleHtml('editors', T.editors);
    h += '<div class="rf-grid">' + T.fields.map(fieldHtml).join('') + '</div>';
    h += '<div class="tl-btns rf-fbtns"><button type="button" class="tl-btn pri" data-act="add">' + (editing ? I.check + 'حفظ التعديلات' : I.plus + 'إضافة المرجع') + '</button>' +
      (editing ? '<button type="button" class="tl-btn" data-act="cancel">' + I.x + 'إلغاء التعديل</button>' : '<button type="button" class="tl-btn" data-act="reset">مسح الحقول</button>') + '</div>';
    $('#rfFormBox').innerHTML = h;
    fireForm();
  }

  /* ----- المعاينة ----- */
  function refInner(o) {
    return '<div class="rf-ref" dir="' + o.dir + '">' + o.html + '</div>' +
      (o.noteHtml ? '<div class="rf-note"><small>الحاشية الأولى (Note)</small><div class="rf-ref" dir="' + o.dir + '">' + o.noteHtml + '</div></div>' : '');
  }
  var prevRes = null;
  function renderPreview() {
    var box = $('#rfPrev'), act = $('#rfPrevAct');
    if (!box) return;
    var r = RF.sanitize(draft, true);
    if (!RF.hasAuthor(r) && !r.f.title) {
      prevRes = null;
      box.innerHTML = '<p class="tl-empty">ستظهر معاينة المرجع هنا أثناء إدخال البيانات.</p>';
      act.innerHTML = '';
      return;
    }
    prevRes = RF.format(r, st.style, opts());
    box.innerHTML = refInner(prevRes);
    var a = '<button type="button" class="tl-btn sm" data-act="copy-prev">' + I.copy + 'نسخ المعاينة</button>';
    if (prevRes.noteHtml) a += '<button type="button" class="tl-btn sm" data-act="copy-prev-note">' + I.copy + 'نسخ الحاشية</button>';
    act.innerHTML = a;
  }

  /* ----- القائمة ----- */
  /* ---------- تصدير القائمة (refs-export.js) ---------- */
  function exportBarHtml() {
    if (!RF.exp) return '';
    var c = RF.exp.get();
    function b(a, ico, t) { return '<button type="button" class="tl-btn sm" data-act="' + a + '">' + ico + t + '</button>'; }
    return '<div class="rf-exp"><div class="tl-lbl">تصدير القائمة (مرتبة أبجدياً وفق النمط المختار)</div>' +
      '<div class="tl-btns rf-lbtns">' + b('exp-docx', I.dl, 'Word') + b('exp-pdf', I.dl, 'PDF') + b('exp-txt', I.dl, 'TXT') + b('exp-print', I.print, 'طباعة') + '</div>' +
      '<label class="rf-chk"><input type="checkbox" class="tl-chk" data-xpref="hang"' + (c.hang ? ' checked' : '') + '> مسافة بادئة معلّقة (Hanging Indent)</label>' +
      '<label class="rf-chk"><input type="checkbox" class="tl-chk" data-xpref="split"' + (c.split ? ' checked' : '') + '> فصل المراجع العربية عن الأجنبية</label></div>';
  }
  function doExport(kind) {
    if (!RF.exp) { toast('وحدة التصدير غير محمّلة'); return; }
    RF.exp.run(kind, st.items, st.style, opts(), toast);
  }
  function renderList() {
    var box = $('#rfListBox');
    if (!box) return;
    var total = st.items.length;
    var h = '<h3>مراجع «' + esc(st.name) + '» <span class="rf-count">(' + total + ')</span></h3>';
    if (!saveOk) h += '<div class="tl-msg bad" role="alert">تعذّر الحفظ على هذا الجهاز (التخزين ممتلئ أو معطّل في المتصفح). ستبقى المراجع ظاهرة حتى تغلق الصفحة فقط.</div>';
    if (!total) {
      h += '<p class="tl-empty">لا توجد مراجع بعد. أضف مرجعك الأول من النموذج أعلاه وسيظهر هنا.</p>';
      box.innerHTML = h; return;
    }
    h += '<div class="rf-tools"><input type="search" class="tl-in" data-filter placeholder="بحث داخل المراجع…" aria-label="بحث داخل المراجع" value="' + esc(filter) + '" dir="auto">' +
      '<select class="tl-sel" data-sort aria-label="ترتيب القائمة">' +
      [['alpha', 'ترتيب أبجدي'], ['added', 'حسب الإضافة (الأقدم أولاً)'], ['recent', 'الأحدث تعديلاً أولاً']].map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
    h += '<div class="tl-btns rf-lbtns"><button type="button" class="tl-btn sm" data-act="copy-all">' + I.copy + 'نسخ جميع المراجع</button><button type="button" class="tl-btn sm del" data-act="del-all">' + I.trash + 'حذف الكل</button></div>';
    h += exportBarHtml();
    h += '<div id="rfItems"></div>';
    box.innerHTML = h;
    renderItems();
  }
  /* ----- التوثيق داخل النص ----- */
  var CITE_HINT = {
    apa: 'APA 7: لقب المؤلف والسنة، وعند ثلاثة مؤلفين فأكثر يُكتب الأول وآخرون (et al.) من أول استشهاد. الاقتباس المباشر يتطلب رقم الصفحة.',
    harvard: 'Harvard: تُذكر ألقاب حتى ثلاثة مؤلفين، ومن أربعة فأكثر يُكتب الأول وآخرون (et al.). الاقتباس المباشر يتطلب رقم الصفحة.',
    mla: 'MLA: المؤلف ورقم الصفحة دون سنة. يُفضَّل ذكر الصفحة دائماً، فاستعمل «اقتباس مباشر» عند الحاجة إليها.',
    'chicago-ad': 'Chicago (مؤلف-تاريخ): (اللقب سنة، صفحة) دون فاصلة بين اللقب والسنة.',
    'chicago-nb': 'Chicago (حواشي): ضع رقماً مرتفعاً في المتن ثم الحاشية أسفل الصفحة؛ الكاملة عند أول ذكر والمختصرة عند التكرار.'
  };
  function cu(id) { return citeUI[id] || (citeUI[id] = { open: false, kind: 'normal', page: '' }); }
  function citeEl(id) { var a = $$('.rf-cite'); for (var i = 0; i < a.length; i++) if (a[i].dataset.cid === id) return a[i]; return null; }
  function citeResHtml(id) {
    var i = findItem(id);
    if (i < 0) return '';
    var u = cu(id), res = RF.cite(st.items[i], st.style, u.kind, u.page, opts(), citeCtx[id]);
    citeRes[id] = res;
    if (!res.ok) return res.empty ? '<p class="tl-hint">' + esc(res.error) + '</p>' : '<div class="tl-err" role="alert">' + esc(res.error) + '</div>';
    return res.parts.map(function (p, k) {
      return '<div class="rf-cpart"><small>' + esc(p.label) + '</small><div class="rf-cline"><div class="rf-ref" dir="' + res.dir + '">' + p.html + '</div>' +
        '<button type="button" class="tl-btn sm" data-act="cite-copy" data-id="' + esc(id) + '" data-part="' + k + '">' + I.copy + 'نسخ</button></div></div>';
    }).join('');
  }
  function citePanelHtml(id) {
    var u = cu(id), e = esc(id);
    function chip(v, l) { return '<button type="button" class="tl-chip" data-act="cite-kind" data-id="' + e + '" data-v="' + v + '" aria-pressed="' + (u.kind === v) + '">' + l + '</button>'; }
    return '<div class="rf-cite" data-cid="' + e + '"><div class="rf-ch"><b>التوثيق داخل النص</b><span class="rf-badge">' + esc(RF.STYLES[st.style].full) + '</span></div>' +
      '<div class="tl-chips" role="group" aria-label="نوع التوثيق">' + chip('normal', 'توثيق عادي') + chip('direct', 'اقتباس مباشر (مع الصفحة)') + '</div>' +
      (u.kind === 'direct' ? '<div class="tl-fld rf-cpg"><label class="tl-lbl" for="rfCp-' + e + '">رقم الصفحة المقتبس منها <b class="rf-req">*</b></label>' +
        '<input class="tl-in rf-ltr" id="rfCp-' + e + '" data-cpage data-id="' + e + '" dir="ltr" autocomplete="off" maxlength="30" placeholder="مثال: 15 أو 15-18" value="' + esc(u.page) + '"></div>' : '') +
      '<div class="rf-cres" aria-live="polite">' + citeResHtml(id) + '</div><p class="tl-hint">' + esc(CITE_HINT[st.style]) + '</p></div>';
  }
  function copyCite(id, k) {
    var res = citeRes[id], p = res && res.parts[k];
    if (!p) return;
    copyResults([{ html: p.html, text: p.text, dir: res.dir }], p.key === 'bib' ? 'تم نسخ المرجع' : (p.key === 'main' ? 'تم نسخ التوثيق' : 'تم نسخ الحاشية'), !p.block);
  }

  var shown = [];
  function renderItems() {
    var wrap = $('#rfItems');
    if (!wrap) return;
    var all = RF.formatList(st.items, st.style, opts());
    citeCtx = RF.citeContext(st.items, st.style, opts());
    var q = filter.trim().toLowerCase();
    shown = q ? all.filter(function (o) { return (o.text + ' ' + o.noteText).toLowerCase().indexOf(q) > -1; }) : all;
    if (!shown.length) { wrap.innerHTML = '<p class="tl-empty">لا توجد نتائج مطابقة لبحثك.</p>'; return; }
    wrap.innerHTML = shown.map(function (o) {
      var isEd = editing === o.id;
      return '<article class="rf-item' + (flashId === o.id ? ' rf-flash' : '') + (isEd ? ' rf-editing' : '') + '" data-id="' + esc(o.id) + '">' +
        '<div class="rf-itop"><span class="rf-badge">' + esc(RF.TYPES[o.ref.type].label) + '</span>' + (isEd ? '<span class="rf-badge rf-on">قيد التعديل</span>' : '') + '</div>' +
        refInner(o) +
        '<div class="rf-acts">' +
        '<button type="button" class="tl-btn sm" data-act="copy" data-id="' + esc(o.id) + '">' + I.copy + 'نسخ</button>' +
        (o.noteHtml ? '<button type="button" class="tl-btn sm" data-act="copy-note" data-id="' + esc(o.id) + '">' + I.copy + 'الحاشية</button>' : '') +
        '<button type="button" class="tl-btn sm" data-act="cite" data-id="' + esc(o.id) + '" aria-expanded="' + !!(citeUI[o.id] && citeUI[o.id].open) + '">' + I.quote + 'توثيق داخل النص</button>' +
        '<button type="button" class="tl-btn sm" data-act="edit" data-id="' + esc(o.id) + '">' + I.edit + 'تعديل</button>' +
        '<button type="button" class="tl-btn sm del" data-act="del" data-id="' + esc(o.id) + '">' + I.trash + 'حذف</button></div>' +
        (citeUI[o.id] && citeUI[o.id].open ? citePanelHtml(o.id) : '') + '</article>';
    }).join('');
    if (flashId) {
      var el = $('.rf-item[data-id="' + flashId + '"]', wrap);
      if (el) { try { el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) { /* ignore */ } }
      flashId = null;
    }
  }
  function resultFor(id) { for (var i = 0; i < shown.length; i++) if (shown[i].id === id) return shown[i]; return null; }
  function findItem(id) { for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return i; return -1; }

  /* ======================================================================
     التحقق + إضافة/تعديل
     ====================================================================== */
  function clearErr(key) {
    var w = $('[data-fw="' + key + '"]');
    if (!w) return;
    var e = $('.tl-err', w);
    if (e) { e.hidden = true; e.textContent = ''; }
    $$('.tl-in.bad', w).forEach(function (x) { x.classList.remove('bad'); });
  }
  function showErrors(errors) {
    $$('.tl-err', $('#rfFormBox')).forEach(function (e) { e.hidden = true; e.textContent = ''; });
    $$('.tl-in.bad,.tl-sel.bad', $('#rfFormBox')).forEach(function (x) { x.classList.remove('bad'); });
    var first = null;
    Object.keys(errors).forEach(function (k) {
      var w = $('#rfFormBox [data-fw="' + k + '"]');
      if (!w) return;
      var e = $('.tl-err', w);
      if (e) { e.textContent = errors[k]; e.hidden = false; }
      $$('.tl-in', w).forEach(function (x) { if (!x.value.trim() || k !== 'authors') x.classList.add('bad'); });
      if (!first) first = w;
    });
    if (first) {
      var f = $('input,select', first);
      try { first.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
      if (f) f.focus({ preventScroll: true });
    }
  }
  function addRef() {
    var r = RF.sanitize(draft, true);
    var v = RF.validate(r);
    if (!v.ok) { showErrors(v.errors); toast('أكمل الحقول المطلوبة المعلَّمة'); return; }
    var now = Date.now();
    if (editing) {
      var idx = findItem(editing);
      if (idx > -1) { r.id = editing; r.created = st.items[idx].created; r.updated = now; st.items[idx] = r; }
      else { r.created = r.updated = now; st.items.push(r); }
    } else {
      r.created = r.updated = now;
      st.items.push(r);
    }
    var wasEdit = !!editing;
    if (!wasEdit) cu(r.id).open = true; /* بعد إضافة مرجع جديد تُفتح لوحة توثيقه مباشرة */
    flashId = r.id;
    editing = null;
    persist();
    draft = freshDraft(draft);
    renderForm(); renderPreview(); renderList();
    toast(wasEdit ? 'تم حفظ التعديلات' : (saveOk ? 'تمت إضافة المرجع وحفظه' : 'تمت الإضافة، لكن تعذّر الحفظ على الجهاز'));
  }
  function startEdit(id) {
    var i = findItem(id);
    if (i < 0) return;
    draft = RF.sanitize(clone(st.items[i]), false);
    editing = id;
    renderForm(); renderPreview(); renderItems();
    var fb = $('#rfFormBox');
    try { fb.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
    var f = $('input.tl-in', fb);
    if (f) f.focus({ preventScroll: true });
  }
  function cancelEdit() {
    editing = null; draft = freshDraft(draft);
    renderForm(); renderPreview(); renderItems();
  }
  function delRef(id) {
    var i = findItem(id);
    if (i < 0) return;
    st.items.splice(i, 1);
    delete citeUI[id]; delete citeRes[id];
    if (editing === id) { editing = null; draft = freshDraft(draft); renderForm(); renderPreview(); }
    persist(); renderList();
    toast('تم حذف المرجع');
  }

  /* ======================================================================
     الأحداث
     ====================================================================== */
  function onField(t) {
    if (t.dataset.f) {
      draft.f[t.dataset.f] = t.value; clearErr(t.dataset.f); renderPreview(); return true;
    }
    if (t.dataset.p) {
      var p = draft[t.dataset.p][+t.dataset.i];
      if (p) { p[t.dataset.k] = t.value; clearErr(t.dataset.p); renderPreview(); }
      return true;
    }
    if (t.dataset.top === 'org') { draft.org = t.value; clearErr('authors'); renderPreview(); return true; }
    if (t.dataset.top === 'lang') { draft.lang = t.value; renderPreview(); return true; }
    return false;
  }
  function handleAct(btn) {
    var act = btn.dataset.act, id = btn.dataset.id, r;
    switch (act) {
      case 'style':
        st.style = btn.dataset.v;
        if (st.style.indexOf('chicago') === 0) st.chicago = st.style;
        persist(); renderStyle(); renderPreview(); renderItems(); break;
      case 'type':
        if (draft.type !== btn.dataset.v) { draft.type = btn.dataset.v; renderForm(); renderPreview(); }
        break;
      case 'addp':
        draft[btn.dataset.p].push({ family: '', given: '' });
        renderForm();
        var rows = $$('[data-p="' + btn.dataset.p + '"][data-k="family"]');
        if (rows.length) rows[rows.length - 1].focus();
        break;
      case 'rmp':
        draft[btn.dataset.p].splice(+btn.dataset.i, 1);
        renderForm(); renderPreview(); break;
      case 'add': addRef(); break;
      case 'reset':
        draft = freshDraft(draft); renderForm(); renderPreview(); break;
      case 'cancel': cancelEdit(); break;
      case 'copy-prev': if (prevRes) copyResults([prevRes], 'تم نسخ المرجع'); break;
      case 'copy-prev-note': if (prevRes) copyResults([{ html: prevRes.noteHtml, text: prevRes.noteText, dir: prevRes.dir }], 'تم نسخ الحاشية'); break;
      case 'copy': r = resultFor(id); if (r) copyResults([r], 'تم نسخ المرجع'); break;
      case 'copy-note': r = resultFor(id); if (r) copyResults([{ html: r.noteHtml, text: r.noteText, dir: r.dir }], 'تم نسخ الحاشية'); break;
      case 'copy-all':
        var every = RF.exp ? RF.exp.listForCopy(st.items, st.style, opts()) : shown;
        if (every.length) copyResults(every, 'تم نسخ ' + every.length + ' مرجعاً', false, RF.exp && RF.exp.get().hang);
        break;
      case 'exp-docx': case 'exp-pdf': case 'exp-txt': case 'exp-print': doExport(act.slice(4)); break;
      case 'cite':
        cu(id).open = !cu(id).open;
        renderItems();
        var cb = $$('[data-act="cite"]').filter(function (x) { return x.dataset.id === id; })[0];
        if (cb) cb.focus({ preventScroll: true });
        break;
      case 'cite-kind':
        if (cu(id).kind !== btn.dataset.v) {
          cu(id).kind = btn.dataset.v;
          var pe = citeEl(id);
          if (pe) {
            pe.outerHTML = citePanelHtml(id);
            var pi = $$('[data-cpage]').filter(function (x) { return x.dataset.id === id; })[0];
            if (pi) pi.focus({ preventScroll: true });
          }
        }
        break;
      case 'cite-copy': copyCite(id, +btn.dataset.part); break;
      case 'edit': startEdit(id); break;
      case 'del':
        r = resultFor(id);
        confirmDlg('حذف المرجع', 'سيُحذف هذا المرجع نهائياً من هذا الجهاز:\n' + (r ? r.text.slice(0, 140) + (r.text.length > 140 ? '…' : '') : ''), 'نعم، احذف', function () { delRef(id); });
        break;
      case 'p-new':
        nameDialog('مشروع بحث جديد', 'اسم المشروع', '', 'إنشاء المشروع', function (v) {
          var r = P.create(store, v);
          if (!r.ok) return r.error;
          openProject(r.project.id);
          return true;
        });
        break;
      case 'p-open': openProject(id); break;
      case 'p-rename':
        r = findProject(id);
        if (r) nameDialog('إعادة تسمية المشروع', 'الاسم الجديد', r.name, 'حفظ الاسم', function (v) {
          var x = P.rename(store, id, v);
          if (!x.ok) return x.error;
          saveOk = P.save(store); renderProjects(); renderList(); toast('تمت إعادة تسمية المشروع');
          return true;
        });
        break;
      case 'p-del': delProject(id); break;
      case 'p-export': exportBackup(); break;
      case 'p-import': pickImport(); break;
      case 'del-all':
        confirmDlg('حذف كل المراجع', 'سيتم حذف جميع مراجع المشروع «' + st.name + '» (' + st.items.length + ') نهائياً من هذا الجهاز ولا يمكن التراجع.', 'نعم، احذف الكل', function () {
          st.items = []; citeUI = {}; citeRes = {}; editing = null; draft = freshDraft(draft); persist(); renderForm(); renderPreview(); renderList(); toast('تم حذف كل المراجع');
        });
        break;
    }
  }
  /* ======================================================================
     مشاريع البحث: إنشاء · فتح · إعادة تسمية · حذف · نسخة احتياطية · استيراد
     ====================================================================== */
  I.up = ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>');
  function countLabel(n) {
    if (!n) return 'لا مراجع';
    if (n === 1) return 'مرجع واحد';
    if (n === 2) return 'مرجعان';
    return n + (n <= 10 ? ' مراجع' : ' مرجعاً');
  }
  function renderAll() { renderProjects(); renderStyle(); renderForm(); renderPreview(); renderList(); }
  function syncFromStorage() {
    loadStore();
    if (editing && findItem(editing) < 0) { editing = null; draft = freshDraft(draft); renderForm(); }
    renderProjects(); renderStyle(); renderPreview(); renderList();
  }
  function renderProjects() {
    var box = $('#rfProjBox');
    if (!box || !store) return;
    var h = '<h3>مشاريع البحث <span class="rf-count">(' + store.projects.length + ')</span></h3>' +
      '<p class="tl-hint">لكل مشروع قائمة مراجع ونمط توثيق وإعدادات خاصة به، ويُحفظ كل شيء تلقائياً على هذا الجهاز.</p>';
    if (!saveOk) h += '<div class="tl-msg bad" role="alert">تعذّر الحفظ على هذا الجهاز (التخزين ممتلئ أو معطّل في المتصفح). صدّر نسخة احتياطية كي لا تضيع بياناتك.</div>';
    h += '<ul class="rf-plist">';
    store.projects.forEach(function (p) {
      var cur = p.id === st.id, e = esc(p.id), nm = esc(p.name);
      h += '<li class="rf-pitem' + (cur ? ' cur' : '') + '"><div class="rf-pinfo"><span class="rf-pname" dir="auto">' + nm + '</span>' +
        '<small>' + countLabel(p.items.length) + ' · ' + esc(RF.STYLES[p.style].full) + (cur ? ' · <b class="rf-badge rf-on">مفتوح</b>' : '') + '</small></div><div class="rf-pacts">' +
        (cur ? '' : '<button type="button" class="tl-btn sm pri" data-act="p-open" data-id="' + e + '" aria-label="فتح المشروع ' + nm + '">فتح</button>') +
        '<button type="button" class="tl-btn sm" data-act="p-rename" data-id="' + e + '" aria-label="إعادة تسمية المشروع ' + nm + '">' + I.edit + 'إعادة تسمية</button>' +
        '<button type="button" class="tl-btn sm del" data-act="p-del" data-id="' + e + '" aria-label="حذف المشروع ' + nm + '">' + I.trash + '</button></div></li>';
    });
    h += '</ul><div class="tl-btns rf-pbar">' +
      '<button type="button" class="tl-btn pri" data-act="p-new">' + I.plus + 'مشروع جديد</button>' +
      '<button type="button" class="tl-btn" data-act="p-export">' + I.dl + 'نسخة احتياطية (JSON)</button>' +
      '<button type="button" class="tl-btn" data-act="p-import">' + I.up + 'استيراد نسخة</button></div>';
    box.innerHTML = h;
  }
  function openProject(id) {
    var p = findProject(id);
    if (!p) return;
    store.active = id; st = p;
    editing = null; filter = ''; citeUI = {}; citeRes = {}; citeCtx = {};
    draft = freshDraft(draft);
    applyExp();
    saveOk = P.save(store);
    fireItems();
    renderAll();
    toast('تم فتح «' + p.name + '»');
  }
  function delProject(id) {
    var p = findProject(id);
    if (!p) return;
    var last = store.projects.length === 1;
    confirmDlg('حذف المشروع',
      'سيُحذف المشروع «' + p.name + '» و' + countLabel(p.items.length) + ' فيه نهائياً من هذا الجهاز ولا يمكن التراجع.' +
      (last ? '\nلأنه آخر مشروع سيُنشأ مشروع فارغ بدلاً منه.' : '') + '\nيُنصح بتصدير نسخة احتياطية أولاً.',
      'نعم، احذف المشروع', function () {
        var wasCur = id === st.id;
        P.remove(store, id);
        if (wasCur) {
          st = P.active(store); store.active = st.id;
          editing = null; filter = ''; citeUI = {}; citeRes = {}; citeCtx = {};
          draft = freshDraft(draft); applyExp();
        }
        saveOk = P.save(store); fireItems(); renderAll();
        toast('تم حذف المشروع');
      });
  }

  /* ----- نافذة عامة (تُملأ بمحتوى كل مرة) ----- */
  var mdl = null, mdlFrom = null;
  function closeMdl() {
    if (!mdl) return;
    mdl.classList.remove('open'); mdl.innerHTML = '';
    if (mdlFrom && mdlFrom.focus) { try { mdlFrom.focus(); } catch (e) { /* ignore */ } }
  }
  function openMdl(html) {
    if (!mdl) {
      mdl = document.createElement('div');
      mdl.className = 'tl-mbg rf-dlg rf-pdlg';
      document.body.appendChild(mdl);
      mdl.addEventListener('click', function (e) { if (e.target === mdl) closeMdl(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mdl.classList.contains('open')) closeMdl(); });
    }
    mdlFrom = document.activeElement;
    mdl.innerHTML = '<div class="tl-modal" role="dialog" aria-modal="true" aria-labelledby="rfMT">' + html + '</div>';
    mdl.classList.add('open');
    return mdl;
  }
  /* submit(value) يرجع true عند النجاح أو نص الخطأ ليبقى الحوار مفتوحاً */
  function nameDialog(title, label, value, okLabel, submit) {
    var m = openMdl('<h3 id="rfMT">' + esc(title) + '</h3><div class="tl-fld"><label class="tl-lbl" for="rfPName">' + esc(label) + '</label>' +
      '<input class="tl-in" id="rfPName" dir="auto" autocomplete="off" maxlength="' + P.MAX_NAME + '" placeholder="مثال: بحث التخرج" value="' + esc(value) + '">' +
      '<div class="tl-err" id="rfPErr" role="alert" hidden></div></div>' +
      '<div class="tl-btns"><button type="button" class="tl-btn pri" data-m="ok">' + esc(okLabel) + '</button><button type="button" class="tl-btn" data-m="no">إلغاء</button></div>');
    var inp = $('#rfPName', m), err = $('#rfPErr', m);
    function go() {
      var r = submit(inp.value);
      if (r === true) { closeMdl(); return; }
      err.textContent = r; err.hidden = false; inp.classList.add('bad'); inp.focus();
    }
    $('[data-m="ok"]', m).addEventListener('click', go);
    $('[data-m="no"]', m).addEventListener('click', closeMdl);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(); } });
    inp.focus(); inp.select();
  }

  /* ----- نسخة احتياطية ----- */
  function exportBackup() {
    try {
      var blob = new Blob([P.backupJson(store)], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob), a = document.createElement('a'), d = new Date();
      function z(n) { return (n < 10 ? '0' : '') + n; }
      a.href = url; a.download = 'refs-backup-' + d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      toast('تم تصدير نسخة احتياطية (' + store.projects.length + ' مشروع)');
    } catch (e) { toast('تعذّر إنشاء النسخة الاحتياطية.'); }
  }

  /* ----- استيراد: قراءة ← تحقق كامل (دون أي تغيير) ← معاينة وموافقة ← دمج آمن ← حفظ ثم تطبيق ----- */
  function pickImport() { var f = $('#rfImpFile'); if (f) { f.value = ''; f.click(); } }
  function importError(msg) {
    var m = openMdl('<h3 id="rfMT">تعذّر استيراد الملف</h3><div class="tl-msg bad" role="alert">' + esc(msg) + '</div>' +
      '<p class="rf-dmsg">لم يتم تغيير أي بيانات.</p><div class="tl-btns"><button type="button" class="tl-btn" data-m="no">حسناً</button></div>');
    $('[data-m="no"]', m).addEventListener('click', closeMdl); $('[data-m="no"]', m).focus();
  }
  function onImportFile(input) {
    var file = input.files && input.files[0];
    input.value = ''; /* يسمح باختيار الملف نفسه مرة أخرى لاحقاً */
    if (!file) return;
    if (file.size > P.MAX_BYTES) { importError('الملف كبير جداً (الحد 8 ميغابايت).'); return; }
    var rd = new FileReader();
    rd.onerror = function () { importError('تعذّرت قراءة الملف.'); };
    rd.onload = function () { showImport(P.parseBackup(String(rd.result || ''))); };
    rd.readAsText(file, 'utf-8');
  }
  function applyImport(res, mode) {
    var r = P.merge(store, res.projects, mode);
    if (!r.added && !r.replaced) { toast('لم يُستورد شيء: كل المشاريع متعارضة وتم تخطيها.', 4000); return true; }
    if (r.replaced) { /* نسخة أمان تلقائية قبل أي استبدال؛ إن تعذّر حفظها لا نستبدل */
      try { localStorage.setItem(P.KEY + '_before_import', JSON.stringify(store)); }
      catch (e) { toast('تعذّر حفظ نسخة أمان قبل الاستبدال؛ صدّر نسخة احتياطية يدوياً أولاً.', 4500); return false; }
    }
    if (!P.save(r.store)) { toast('تعذّر الحفظ (التخزين ممتلئ)؛ لم يتم تغيير أي شيء.', 4500); return false; }
    var keep = st.id;
    store = r.store; st = findProject(keep) || P.active(store); store.active = st.id;
    if (editing && findItem(editing) < 0) { editing = null; draft = freshDraft(draft); }
    applyExp(); saveOk = true; fireItems(); renderAll();
    toast('تم الاستيراد: ' + r.added + ' مشروع مضاف' + (r.replaced ? '، ' + r.replaced + ' مستبدَل' : '') + (r.skipped ? '، ' + r.skipped + ' متخطّى' : '') + ' (' + r.items + ' مرجع)', 4500);
    return true;
  }
  function showImport(res) {
    if (!res.ok) { importError(res.error); return; }
    var conf = P.conflicts(store, res.projects), cid = {};
    conf.forEach(function (c) { cid[c.id] = 1; });
    var h = '<h3 id="rfMT">استيراد نسخة احتياطية</h3>' +
      '<p class="rf-dmsg">الملف صالح: ' + res.projects.length + ' مشروع و' + countLabel(res.total) + '.\nلن يُحذف أي شيء من مشاريعك الحالية دون موافقتك.</p>';
    res.warnings.forEach(function (w) { h += '<div class="tl-msg warn">' + esc(w) + '</div>'; });
    h += '<ul class="rf-plist rf-implist">' + res.projects.map(function (p) {
      return '<li class="rf-pitem"><div class="rf-pinfo"><span class="rf-pname" dir="auto">' + esc(p.name) + '</span><small>' + countLabel(p.items.length) +
        (cid[p.id] ? ' · <b class="rf-badge">موجود مسبقاً</b>' : '') + '</small></div></li>';
    }).join('') + '</ul>';
    if (conf.length) {
      h += '<div class="tl-msg warn">يوجد ' + conf.length + ' مشروع من الملف موجود مسبقاً على هذا الجهاز. اختر ما يُفعل بها:</div>' +
        '<div class="rf-modes" role="radiogroup" aria-label="التعامل مع المشاريع الموجودة">' +
        '<label class="rf-chk"><input type="radio" name="rfMode" value="both" class="tl-chk" checked> احتفظ بالنسختين (يُضاف المستورد باسم جديد) — الخيار الأكثر أماناً</label>' +
        '<label class="rf-chk"><input type="radio" name="rfMode" value="skip" class="tl-chk"> تخطَّ المشاريع الموجودة ولا تستورد إلا الجديد</label>' +
        '<label class="rf-chk"><input type="radio" name="rfMode" value="replace" class="tl-chk"> استبدل المشاريع الموجودة بنسخها من الملف</label></div>' +
        '<div class="rf-agree" hidden><div class="tl-msg bad">سيُستبدل محتوى المشاريع الموجودة المطابقة بما في الملف، وتُفقد أي مراجع أضفتها إليها بعد تاريخ النسخة. تُحفظ نسخة أمان تلقائية، لكن يُفضَّل تصدير نسخة احتياطية الآن.</div>' +
        '<div class="tl-btns"><button type="button" class="tl-btn sm" data-m="bk">' + I.dl + 'تصدير نسخة من الحالي الآن</button></div>' +
        '<label class="rf-chk"><input type="checkbox" class="tl-chk" id="rfAgree"> أوافق على استبدال المشاريع الموجودة</label></div>';
    }
    h += '<div class="tl-btns"><button type="button" class="tl-btn pri" data-m="ok">استيراد</button><button type="button" class="tl-btn" data-m="no">إلغاء</button></div>';
    var m = openMdl(h), ok = $('[data-m="ok"]', m), agree = $('.rf-agree', m), chk = $('#rfAgree', m);
    function mode() { var r = $('input[name="rfMode"]:checked', m); return r ? r.value : 'both'; }
    function sync() {
      var rp = mode() === 'replace';
      if (agree) agree.hidden = !rp;
      ok.disabled = rp && !(chk && chk.checked);
    }
    $$('input[name="rfMode"]', m).forEach(function (x) { x.addEventListener('change', sync); });
    if (chk) chk.addEventListener('change', sync);
    var bk = $('[data-m="bk"]', m); if (bk) bk.addEventListener('click', exportBackup);
    $('[data-m="no"]', m).addEventListener('click', closeMdl);
    ok.addEventListener('click', function () { if (applyImport(res, mode())) closeMdl(); });
    sync(); $('[data-m="no"]', m).focus();
  }

  function bind() {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b && root.contains(b) && !b.disabled) handleAct(b);
    });
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-filter')) { filter = t.value; renderItems(); return; }
      if (t.hasAttribute('data-cpage')) {
        cu(t.dataset.id).page = t.value;
        var pel = citeEl(t.dataset.id);
        if (pel) { var rs = $('.rf-cres', pel); if (rs) rs.innerHTML = citeResHtml(t.dataset.id); }
        return;
      }
      onField(t);
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.top === 'orgMode') { draft.orgMode = t.checked; clearErr('authors'); renderForm(); renderPreview(); return; }
      if (t.id === 'rfImpFile') { onImportFile(t); return; }
      if (t.hasAttribute('data-xpref')) {
        if (RF.exp) RF.exp.set(t.dataset.xpref, t.checked);
        if (st.exp && (t.dataset.xpref === 'hang' || t.dataset.xpref === 'split')) { st.exp[t.dataset.xpref] = t.checked; persist(); }
        return;
      }
      if (t.dataset.pref === 'titleCase') { st.titleCase = t.checked; persist(); renderPreview(); renderItems(); return; }
      if (t.hasAttribute('data-sort')) { st.sort = t.value; persist(); renderItems(); return; }
      onField(t);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing && e.target.matches && e.target.matches('#rfFormBox input.tl-in:not([type="date"])')) {
        e.preventDefault(); addRef();
      }
    });
    /* مزامنة تبويبات المتصفح */
    window.addEventListener('storage', function (e) {
      if (e.key !== P.KEY || !root) return;
      syncFromStorage();
    });
  }

  /* ---------- الواجهة العامة ---------- */
  RF.ui = {
    init: function (view) {
      root = view; loadStore(); draft = RF.newRef('book'); editing = null; filter = '';
      build(); bind();
    },
    refresh: function () {
      if (!root || !st) return;
      if (saveOk) syncFromStorage(); /* إن تعذّر التخزين نُبقي مراجع الجلسة في الذاكرة */
    },
    /* نقاط توسعة للمرحلة الثانية */
    getItems: function () { return st ? st.items.slice() : []; },
    /* تستعملها وحدة الجلب التلقائي: المسودّة الحية (لا تُحفظ إلا بزر «إضافة المرجع») + إعادة رسم النموذج والمعاينة */
    getDraft: function () { return draft; },
    refreshForm: function () { if (!root || !draft) return; renderForm(); renderPreview(); },
    toast: toast,
    getStyle: function () { return st ? st.style : 'apa'; },
    on: function (ev, fn) { if (listeners[ev] && typeof fn === 'function') listeners[ev].push(fn); }
  };
})();
