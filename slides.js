/* ==========================================================================
   slides.js — المنسّق العام لـ «استوديو العروض التقديمية» (المراحل 1–6)
   - يربط: محرك البيانات (SLE) + الرسم والتفاعل (SLC) + الخصائص (SLP) +
     التخزين IndexedDB (SLS) + التصدير (SLX) + التقديم والجودة (SLPres, SLQA)
   - التراجع والإعادة الحقيقيان (Undo / Redo)، الحفظ التلقائي بحالة حقيقية،
     النسخ الاحتياطي JSON، ملاحظات المتحدث، فاحص الجودة، ووضع التقديم
   ========================================================================== */
(function () {
  'use strict';
  var E = window.SLE, C = window.SLC, P = window.SLP, ST = window.SLS, X = window.SLX;
  var RATIOS = {
    '16:9': { w: 16, h: 9, name: 'عريض', hint: 'الشاشات وأجهزة العرض الحديثة' },
    '4:3': { w: 4, h: 3, name: 'كلاسيكي', hint: 'العروض الجامعية التقليدية' }
  };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var I = {
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    folder: ic('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>'),
    slides: ic('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
    back: ic('<path d="m9 18 6-6-6-6"/>'),
    panel: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>'),
    text: ic('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'),
    image: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
    shape: ic('<path d="M8.3 10a.7.7 0 0 1-.6-1l3.7-6.1a.7.7 0 0 1 1.2 0l3.7 6.1a.7.7 0 0 1-.6 1z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>'),
    table: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>'),
    chart: ic('<path d="M3 3v18h18"/><path d="M7 16v-4"/><path d="M12 16V8"/><path d="M17 16v-6"/>'),
    play: ic('<polygon points="6 3 20 12 6 21 6 3"/>'),
    undo: ic('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
    redo: ic('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>'),
    download: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    upload: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    check: ic('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    notes: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'),
    x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
  };

  /* ---------- الحالة العامة ---------- */
  var projects = [], root = null, cur = null, selId = null, panelOpen = false, notesOpen = false;
  var saveState = 'saved'; /* saved | dirty | saving | error */
  var dirtyRev = 0, savedRev = 0, saveTimer = 0, thumbTimer = 0;
  var toastEl = null, toastT = 0, newRatio = '16:9';
  var undoStack = [], redoStack = [], lastSnapKey = '', MAX_UNDO = 60;

  function $(s, r) { return (r || root).querySelector(s); }
  function fmtDate(t) { try { return new Date(t).toLocaleDateString('ar-DZ-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function toast(m) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'sl-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2500);
  }
  function slideBy(id) { if (!cur) return -1; for (var i = 0; i < cur.slides.length; i++) if (cur.slides[i].id === id) return i; return -1; }

  /* ---------- التراجع والإعادة (Undo / Redo) ---------- */
  function makeSnap() {
    return {
      slides: E.clone(cur.slides),
      selId: selId,
      selIds: C.selectedList ? C.selectedList().map(function (x) { return x.id; }) : []
    };
  }
  function snapHash(sn) { return JSON.stringify(sn.slides); }
  function resetHistory() {
    undoStack = []; redoStack = [];
    if (cur) { var sn = makeSnap(); undoStack.push(sn); lastSnapKey = snapHash(sn); }
    updateUndoBtns();
  }
  function pushHistory() {
    if (!cur) return;
    var sn = makeSnap(), key = snapHash(sn);
    if (key === lastSnapKey) return;
    undoStack.push(sn);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    lastSnapKey = key;
    updateUndoBtns();
  }
  function applySnap(sn) {
    if (!cur || !sn) return;
    cur.slides = E.clone(sn.slides);
    selId = sn.selId && slideBy(sn.selId) >= 0 ? sn.selId : (cur.slides[0] ? cur.slides[0].id : null);
    lastSnapKey = snapHash(sn);
    touch();
    refresh();
    if (sn.selIds && sn.selIds.length && C.selectIds) C.selectIds(sn.selIds);
    updateUndoBtns();
  }
  function undo() {
    if (!cur || undoStack.length <= 1) return;
    var current = undoStack.pop();
    redoStack.push(current);
    applySnap(undoStack[undoStack.length - 1]);
  }
  function redo() {
    if (!cur || !redoStack.length) return;
    var next = redoStack.pop();
    undoStack.push(next);
    applySnap(next);
  }
  function updateUndoBtns() {
    if (!root) return;
    var u = $('[data-act="undo"]'), r = $('[data-act="redo"]');
    if (u) u.classList.toggle('off', undoStack.length <= 1);
    if (r) r.classList.toggle('off', redoStack.length === 0);
  }

  /* ---------- الحفظ التلقائي ---------- */
  function setSaveUI(state) {
    saveState = state;
    var el = root && $('#slSaveStatus');
    if (!el) return;
    var map = {
      saved: 'تم الحفظ',
      dirty: 'تغييرات غير محفوظة…',
      saving: 'جارٍ الحفظ…',
      error: 'تعذّر الحفظ'
    };
    el.textContent = map[state] || '';
    el.dataset.state = state;
  }
  function persistCur() {
    if (!cur || dirtyRev === savedRev) { setSaveUI('saved'); return Promise.resolve(true); }
    var targetRev = dirtyRev;
    setSaveUI('saving');
    return ST.saveProject(cur).then(function (ok) {
      if (ok) {
        if (dirtyRev === targetRev) { savedRev = targetRev; setSaveUI('saved'); }
        /* تحديث النسخة في الذاكرة */
        var found = false;
        for (var i = 0; i < projects.length; i++) if (projects[i].id === cur.id) { projects[i] = cur; found = true; break; }
        if (!found) projects.unshift(cur);
      } else {
        setSaveUI('error');
        toast('تعذّر الحفظ في التخزين المحلي');
      }
      return ok;
    });
  }
  function touch() {
    if (!cur) return;
    cur.updated = Date.now();
    dirtyRev++;
    setSaveUI('dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistCur, 550);
  }
  function flush() {
    clearTimeout(saveTimer); saveTimer = 0;
    return persistCur();
  }
  addEventListener('pagehide', flush);
  addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  /* ---------- النوافذ المنبثقة النظيفة (بديل alert/confirm/prompt) ---------- */
  function closeModal() {
    var m = document.getElementById('slModal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }
  function openModal(title, bodyHtml, onBind) {
    closeModal();
    var m = document.createElement('div');
    m.id = 'slModal';
    m.className = 'sl-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="sl-modal-bg" data-mclose></div><div class="sl-modal-card">' +
      '<div class="sl-modal-hd"><b>' + esc(title) + '</b><button type="button" class="sl-iconbtn" data-mclose aria-label="إغلاق">' + I.x + '</button></div>' +
      '<div class="sl-modal-bd">' + bodyHtml + '</div></div>';
    m.addEventListener('click', function (e) { if (e.target.closest('[data-mclose]')) closeModal(); });
    document.body.appendChild(m);
    if (onBind) onBind(m);
    return m;
  }

  /* ---------- شاشة البداية وإدارة المشاريع ---------- */
  function ratioCard(k) {
    var r = RATIOS[k];
    return '<button type="button" class="sl-ratio' + (newRatio === k ? ' on' : '') + '" data-ratio="' + k + '" aria-pressed="' + (newRatio === k) + '">' +
      '<span class="sl-rprev" style="aspect-ratio:' + r.w + '/' + r.h + '"></span><b>' + k + '</b><small>' + r.name + ' — ' + r.hint + '</small></button>';
  }
  function projCard(p) {
    var r = RATIOS[p.ratio] || RATIOS['16:9'], n = (p.slides || []).length;
    var s0 = (p.slides || [])[0] || { bg: '#FFFFFF', items: [] };
    var sz = E.size(p.ratio);
    return '<div class="sl-proj" data-id="' + esc(p.id) + '">' +
      '<button type="button" class="sl-proj-open" data-act="open" aria-label="فتح ' + esc(p.name) + '">' +
      '<span class="sl-pthumb" data-fit data-w="' + sz.w + '" style="aspect-ratio:' + r.w + '/' + r.h + ';background:' + esc(s0.bg || '#FFFFFF') + '"><span class="sl-cv" data-psid="' + esc(p.id) + '"></span></span>' +
      '<span class="sl-pinfo"><b>' + esc(p.name) + '</b><small>' + n + ' شريحة · ' + esc(p.ratio) + ' · ' + fmtDate(p.updated) + '</small></span></button>' +
      '<div class="sl-proj-acts">' +
      '<button type="button" class="sl-iconbtn" data-act="renproj" title="تعديل الاسم" aria-label="تعديل اسم المشروع">' + I.edit + '</button>' +
      '<button type="button" class="sl-iconbtn" data-act="dupproj" title="نسخ المشروع" aria-label="نسخ المشروع">' + I.copy + '</button>' +
      '<button type="button" class="sl-iconbtn" data-act="expjson" title="تصدير نسخة JSON" aria-label="تصدير JSON">' + I.download + '</button>' +
      '<button type="button" class="sl-iconbtn sl-danger" data-act="delproj" title="حذف المشروع" aria-label="حذف المشروع">' + I.trash + '</button>' +
      '</div></div>';
  }
  function renderProjectThumbs() {
    projects.forEach(function (p) {
      var cv = root && root.querySelector('.sl-cv[data-psid="' + p.id + '"]');
      var s0 = p.slides && p.slides[0];
      if (cv && s0 && C.renderSlide) {
        var sz = E.size(p.ratio);
        cv.style.width = sz.w + 'px'; cv.style.height = sz.h + 'px';
        C.renderSlide(cv, s0);
      }
    });
    if (C.fit) C.fit(root);
  }
  function renderHome(loading) {
    var lastId = ST.getLastOpen();
    var hasLast = lastId && projects.some(function (p) { return p.id === lastId; });
    var h = '<div class="sl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div>' +
      '<div class="sl-home"><header class="sl-hero"><span class="sl-hero-ic">' + I.slides + '</span><h2 class="ptitle">استوديو العروض التقديمية</h2>' +
      '<p>صمّم عروضك الجامعية باحترافية على جهازك مع الحفظ في IndexedDB والتصدير المتكامل دون إنترنت.</p></header>' +
      '<section class="sl-card" aria-labelledby="slNew"><h3 id="slNew">إنشاء عرض جديد</h3>' +
      '<label class="sl-lbl" for="slName">اسم العرض</label><input id="slName" class="sl-input" type="text" maxlength="80" placeholder="مثال: عرض مقياس علم النفس الرياضي" autocomplete="off">' +
      '<div class="sl-lbl">مقاس العرض</div><div class="sl-ratios">' + ratioCard('16:9') + ratioCard('4:3') + '</div>' +
      '<div class="sl-actions"><button type="button" class="sl-btn pri" data-act="create">' + I.plus + 'إنشاء العرض</button>' +
      '<button type="button" class="sl-btn" data-act="openlast">' + I.folder + (hasLast ? 'استعادة آخر عرض' : 'فتح آخر مشروع') + '</button>' +
      '<button type="button" class="sl-btn" data-act="impjson">' + I.upload + 'استيراد JSON</button></div></section>' +
      '<section class="sl-card" aria-labelledby="slPrev"><h3 id="slPrev">مشاريعي السابقة</h3><div id="slList">';
    if (loading) h += '<div class="sl-list" aria-busy="true" aria-label="جارٍ التحميل"><div class="sl-skel"></div><div class="sl-skel"></div></div>';
    else if (!projects.length) h += '<div class="sl-empty">' + I.folder + '<b>لا توجد مشاريع بعد</b><small>ابدأ بإنشاء أول عرض من النموذج أعلاه أو استورد ملف JSON.</small></div>';
    else h += '<div class="sl-list">' + projects.slice().sort(function (a, b) { return b.updated - a.updated; }).map(projCard).join('') + '</div>';
    root.innerHTML = h + '</div><input type="file" id="slImportFile" accept=".json,application/json" hidden></section></div>';
    if (!loading) renderProjectThumbs();
  }
  function home(loading) {
    C.stopEdit();
    flush();
    C.deselect();
    cur = null; selId = null; panelOpen = false;
    root.classList.remove('sl-editing');
    renderHome(!!loading);
  }

  /* ---------- المحرر ---------- */
  function thumbsHtml() {
    var r = RATIOS[cur.ratio];
    if (!cur.slides.length) return '<p class="sl-thumbs-empty">لا توجد شرائح</p>';
    return cur.slides.map(function (s, i) {
      return '<button type="button" class="sl-thumb' + (s.id === selId ? ' on' : '') + '" data-id="' + s.id + '" aria-label="الشريحة ' + (i + 1) + '" aria-current="' + (s.id === selId) + '">' +
        '<span class="sl-tn">' + (i + 1) + '</span><span class="sl-tp" data-fit data-w="' + E.size(cur.ratio).w + '" data-sid="' + s.id + '" style="aspect-ratio:' + r.w + '/' + r.h + ';background:' + esc(s.bg) + '"><span class="sl-cv"></span></span></button>';
    }).join('');
  }
  function stageHtml() {
    var r = RATIOS[cur.ratio], i = slideBy(selId);
    if (i < 0) return '<div class="sl-stage-empty">' + I.slides + '<b>العرض فارغ</b><small>أضف شريحتك الأولى لبدء التصميم.</small><button type="button" class="sl-btn pri" data-act="add">' + I.plus + 'إضافة شريحة</button></div>';
    return '<div class="sl-ctx" hidden></div><div class="sl-slide" data-fit data-w="' + E.size(cur.ratio).w + '" style="aspect-ratio:' + r.w + '/' + r.h + ';background:' + esc(cur.slides[i].bg) + '"><div class="sl-clip"><div class="sl-cv"></div></div><div class="sl-ov"></div><span class="sl-slide-hint">أضف نصاً أو صورة أو شكلاً أو جدولاً أو مخططاً من الشريط العلوي</span></div>';
  }
  function propsHtml() {
    var i = slideBy(selId);
    return P.html(cur, i < 0 ? null : cur.slides[i], i < 0 ? null : C.selected(), i);
  }
  function notesHtml() {
    var i = slideBy(selId), s = i >= 0 ? cur.slides[i] : null;
    return '<div class="sl-notes-hd"><button type="button" class="sl-notes-tog" data-act="tognotes">' + I.notes + '<span>ملاحظات المتحدث' + (s && s.notes ? ' •' : '') + '</span></button>' +
      '<div class="sl-zoom-bar">' +
      '<button type="button" class="sl-zbtn" data-act="zout" title="تصغير">−</button>' +
      '<button type="button" class="sl-zbtn" data-act="zfit" title="ملاءمة الشاشة"><span id="slZoomLbl">' + Math.round((C.actions.getZoom() || 1) * 100) + '%</span></button>' +
      '<button type="button" class="sl-zbtn" data-act="zin" title="تكبير">+</button>' +
      '</div></div>' +
      '<div class="sl-notes-bd"' + (notesOpen ? '' : ' hidden') + '><textarea id="slNotesIn" class="sl-notes-in" placeholder="اكتب ملاحظات المتحدث الخاصة بهذه الشريحة (لا تظهر في الشريحة أو التصدير)…"' + (s ? '' : ' disabled') + '>' + esc(s ? s.notes || '' : '') + '</textarea></div>';
  }

  var SHAPES = [
    ['rect', 'مستطيل'], ['rrect', 'مستطيل مستدير'], ['square', 'مربع'], ['circle', 'دائرة'],
    ['line', 'خط'], ['arrow', 'سهم'], ['darrow', 'سهم مزدوج'], ['triangle', 'مثلث'],
    ['diamond', 'معين'], ['pentagon', 'خماسي'], ['hexagon', 'سداسي'], ['star', 'نجمة'], ['callout', 'فقاعة شرح']
  ];
  function tb(act, icon, label, extra) {
    return '<button type="button" class="sl-tbtn' + (extra || '') + '" data-act="' + act + '" aria-label="' + label + '" title="' + label + '">' + icon + '<span>' + label + '</span></button>';
  }

  function renderEditor() {
    root.classList.add('sl-editing');
    var hasSel = slideBy(selId) >= 0;
    root.innerHTML = '<div data-r="' + cur.ratio + '" class="sl-ed' + (panelOpen ? ' panel-open' : '') + '" role="application" aria-label="محرر العروض">' +
      '<div class="sl-bar">' +
      '<button type="button" class="sl-iconbtn" data-act="exit" aria-label="العودة إلى استوديو العروض" title="العودة للمشاريع">' + I.back + '</button>' +
      '<input class="sl-title" id="slTitle" type="text" maxlength="80" value="' + esc(cur.name) + '" aria-label="اسم العرض">' +
      '<span class="sl-save-st" id="slSaveStatus" data-state="saved">تم الحفظ</span>' +
      '<span class="sl-sep"></span>' +
      tb('add', I.plus, 'شريحة', ' pri') +
      tb('dup', I.copy, 'نسخ', hasSel ? '' : ' off') +
      tb('del', I.trash, 'حذف', (hasSel ? '' : ' off') + ' dng') +
      '<span class="sl-sep sl-hide-sm"></span>' +
      '<span class="sl-tools">' +
      tb('addtext', I.text, 'نص', hasSel ? '' : ' off') +
      tb('addimg', I.image, 'صورة', hasSel ? '' : ' off') +
      tb('addshape', I.shape, 'شكل', hasSel ? '' : ' off') +
      tb('addtable', I.table, 'جدول', hasSel ? '' : ' off') +
      tb('addchart', I.chart, 'مخطط', hasSel ? '' : ' off') +
      '<span class="sl-sep sl-hide-sm"></span>' +
      tb('undo', I.undo, 'تراجع', ' off') +
      tb('redo', I.redo, 'إعادة', ' off') +
      tb('qa', I.check, 'فحص') +
      tb('export', I.download, 'تصدير') +
      tb('present', I.play, 'عرض', ' pri') +
      '</span>' +
      '<button type="button" class="sl-iconbtn sl-only-md" data-act="panel" aria-label="لوحة الخصائص">' + I.panel + '</button></div>' +
      '<div class="sl-body"><aside class="sl-side" aria-label="الشرائح"><div class="sl-thumbs" id="slThumbs">' + thumbsHtml() + '</div></aside>' +
      '<div class="sl-center"><main class="sl-stage" id="slStage">' + stageHtml() + '</main>' +
      '<section class="sl-notes" id="slNotes">' + notesHtml() + '</section></div>' +
      '<aside class="sl-props" id="slProps" aria-label="لوحة الخصائص">' + propsHtml() + '</aside></div>' +
      '<div class="sl-scrim" data-act="panel"></div>' +
      '<div class="sl-pop" id="slPop" hidden></div>' +
      '<input type="file" id="slFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>' +
      '<input type="file" id="slReplaceFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>' +
      '</div>';
    C.fillThumbs(root, cur);
    C.mount($('#slStage'));
    C.watch($('.sl-ed'));
    C.fit(root);
    updateUndoBtns();
    setSaveUI(saveState);
  }

  function refresh() {
    if (!cur || !$('#slThumbs')) return;
    C.stopEdit();
    $('#slThumbs').innerHTML = thumbsHtml();
    $('#slStage').innerHTML = stageHtml();
    $('#slNotes').innerHTML = notesHtml();
    C.fillThumbs(root, cur);
    C.mount($('#slStage'));
    $('#slProps').innerHTML = propsHtml();
    var has = slideBy(selId) >= 0;
    [].forEach.call(root.querySelectorAll('[data-act="dup"],[data-act="del"],[data-act="addtext"],[data-act="addimg"],[data-act="addshape"],[data-act="addtable"],[data-act="addchart"]'), function (b) {
      b.classList.toggle('off', !has);
    });
    var t = root.querySelector('.sl-thumb.on');
    if (t && t.scrollIntoView) { try { t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
  }

  function scheduleThumbRefresh(s) {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(function () { if (s) C.refreshThumb(s); }, 120);
  }

  var ctx = {
    slide: function () { var i = cur ? slideBy(selId) : -1; return i < 0 ? null : cur.slides[i]; },
    size: function () { return E.size(cur.ratio); },
    stage: function () { return $('#slStage'); },
    toast: toast,
    undo: undo,
    redo: redo,
    saveNow: function () { flush().then(function (ok) { if (ok) toast('تم حفظ المشروع'); }); },
    changed: function (k) {
      if (!cur) return;
      var pn = $('#slProps'), s = ctx.slide();
      if (k === 'live') { touch(); P.sync(pn, C.selected()); scheduleThumbRefresh(s); return; }
      if (k === 'select') { if (pn) pn.innerHTML = propsHtml(); return; }
      pushHistory();
      touch();
      if (s) C.refreshThumb(s);
      if (k === 'commit' && pn) pn.innerHTML = propsHtml();
      else if (k === 'panel' && pn) {
        /* نحافظ على التركيز في المدخل النشط عند تغيير اللون أو الكتابة */
        var ae = document.activeElement;
        if (!ae || !ae.closest('.sl-props') || ae.type === 'checkbox' || ae.tagName === 'SELECT') pn.innerHTML = propsHtml();
      }
    }
  };

  function openProject(p) {
    flush();
    C.deselect();
    cur = E.normalizeProject(p);
    selId = cur.slides.length ? cur.slides[0].id : null;
    panelOpen = false;
    dirtyRev = 0; savedRev = 0; saveState = 'saved';
    ST.setLastOpen(cur.id);
    renderEditor();
    resetHistory();
    scrollTo(0, 0);
  }

  /* ---------- القوائم والنوافذ: التصدير، الجودة، الأشكال، الجداول، المخططات ---------- */
  function openPop(anchorEl, html) {
    var pp = $('#slPop'); if (!pp) return;
    pp.innerHTML = html;
    pp.hidden = false;
    var r = anchorEl.getBoundingClientRect(), ed = $('.sl-ed').getBoundingClientRect();
    pp.style.top = (r.bottom - ed.top + 6) + 'px';
    var left = Math.max(8, Math.min(ed.width - 230, r.left - ed.left));
    pp.style.left = left + 'px';
    pp.style.right = 'auto';
  }

  function showExportModal() {
    var i = slideBy(selId);
    var body = '<div class="sl-exp-grid">' +
      '<div class="sl-exp-sec"><h4>تصدير صور PNG</h4>' +
      '<label class="sl-f wide"><span>جودة الصورة</span><select id="slPngQ" class="sl-in">' +
      '<option value="1">قياسية (1×)</option><option value="2" selected>عالية (2× — موصى بها)</option><option value="3">فائقة (3×)</option></select></label>' +
      '<div class="sl-actions"><button type="button" class="sl-btn" data-exp="png-one"' + (i < 0 ? ' disabled' : '') + '>الشريحة الحالية PNG</button>' +
      '<button type="button" class="sl-btn pri" data-exp="png-all">جميع الشرائح PNG</button></div></div>' +
      '<div class="sl-exp-sec"><h4>تصدير PDF للطباعة</h4><p class="sl-muted">تُطبع كل شريحة في صفحة مستقلة بمقاس العرض الحقيقي ودعم العربية، دون ملاحظات المتحدث أو واجهة الموقع.</p>' +
      '<button type="button" class="sl-btn pri" data-exp="pdf">تصدير PDF</button></div>' +
      '<div class="sl-exp-sec"><h4>تصدير PowerPoint (PPTX)</h4>' +
      '<p class="sl-muted">' + (X.pptx.isAvailable() ? 'مكتبة PptxGenJS متاحة محلياً وجاهزة لإنشاء ملف PPTX قابل للتحرير.' : 'محوّل PPTX جاهز (Export Adapter) ويحافظ على النصوص والصور والأشكال والجداول والمخططات العربية. يتطلب تفعيله وضع مكتبة PptxGenJS محلياً.') + '</p>' +
      '<button type="button" class="sl-btn" data-exp="pptx">' + (X.pptx.isAvailable() ? 'تصدير PPTX' : 'فحص وتجهيز PPTX') + '</button></div>' +
      '</div>';

    openModal('تصدير العرض التقديمي', body, function (m) {
      m.addEventListener('click', function (e) {
        var b = e.target.closest('[data-exp]'); if (!b) return;
        var kind = b.dataset.exp;
        var scale = parseInt(m.querySelector('#slPngQ').value, 10) || 2;
        if (kind === 'png-one') {
          b.disabled = true;
          X.png.exportSlide(cur, i, scale).then(function (ok) { b.disabled = false; toast(ok ? 'تم تنزيل صورة الشريحة PNG' : 'تعذّر تصدير الصورة'); });
        } else if (kind === 'png-all') {
          b.disabled = true; toast('جارٍ تجهيز صور الشرائح…');
          X.png.exportAll(cur, scale).then(function (n) { b.disabled = false; toast('تم تنزيل ' + n + ' صورة PNG'); });
        } else if (kind === 'pdf') {
          closeModal();
          X.pdf.exportPdf(cur);
        } else if (kind === 'pptx') {
          X.pptx.exportPptx(cur).then(function (res) {
            if (res.ready) { closeModal(); toast('تم تصدير ملف PPTX بنجاح'); return; }
            var c = res.spec.counts;
            var info = '<p class="sl-muted">لم يتم إنشاء ملف PPTX لأن مكتبة <b>PptxGenJS</b> غير مضافة محلياً بعد (لا نُنشئ ملفات وهمية لا تفتح).</p>' +
              '<div class="sl-kv"><span>الشرائح الجاهزة للتحويل</span><b>' + c.slides + '</b></div>' +
              '<div class="sl-kv"><span>نصوص قابلة للتحرير</span><b>' + c.text + '</b></div>' +
              '<div class="sl-kv"><span>صور · أشكال · جداول · مخططات</span><b>' + c.image + ' · ' + c.shape + ' · ' + c.table + ' · ' + c.chart + '</b></div>' +
              '<p class="sl-muted" style="margin-top:10px">لتفعيل التصدير الفعلي دون تعديل محرر الشرائح: ضع ملف <code>pptxgen.bundle.js</code> محلياً وأدرجه في <code>index.html</code> قبل <code>slides-export.js</code>.</p>' +
              '<div class="sl-actions"><button type="button" class="sl-btn" id="slDlSpec">تنزيل مواصفات PPTX (JSON)</button></div>';
            var m2 = openModal('محوّل PowerPoint (Export Adapter)', info, function (modal2) {
              modal2.querySelector('#slDlSpec').onclick = function () {
                var blob = new Blob([JSON.stringify(res.spec, null, 2)], { type: 'application/json;charset=utf-8' });
                var u = URL.createObjectURL(blob), a = document.createElement('a');
                a.href = u; a.download = 'pptx-adapter-spec.json'; document.body.appendChild(a); a.click();
                setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(u); }, 200);
              };
            });
            return m2;
          });
        }
      });
    });
  }

  function showQualityModal() {
    if (!window.SLQA) return;
    var issues = window.SLQA.analyze(cur);
    var body = '';
    if (!issues.length) {
      body = '<div class="sl-qa-ok"><b>العرض سليم وجاهز للتقديم والتصدير</b><p class="sl-muted">لم يتم العثور على نصوص خارجة عن الحدود، أو شرائح فارغة، أو تداخلات حرجة، أو صور مفقودة.</p></div>';
    } else {
      var errs = issues.filter(function (x) { return x.level === 'err'; }).length;
      var warns = issues.filter(function (x) { return x.level === 'warn'; }).length;
      body = '<p class="sl-muted" style="margin-bottom:10px">تم اكتشاف <b>' + issues.length + '</b> ملاحظة (' + errs + ' حرجة، ' + warns + ' تحذيرية). لن يتم تعديل أي محتوى تلقائياً.</p><div class="sl-qa-list">' +
        issues.map(function (iss) {
          return '<div class="sl-qa-item ' + iss.level + '"><div><b>شريحة ' + iss.slideNum + '</b><p>' + esc(iss.msg) + '</p></div>' +
            '<button type="button" class="sl-btn-sm" data-qago="' + esc(iss.slideId) + '" data-qait="' + esc(iss.itemId || '') + '">انتقال</button></div>';
        }).join('') + '</div>';
    }
    openModal('فاحص جودة العرض', body, function (m) {
      m.addEventListener('click', function (e) {
        var b = e.target.closest('[data-qago]'); if (!b) return;
        selId = b.dataset.qago;
        var itId = b.dataset.qait;
        closeModal();
        refresh();
        if (itId && C.selectIds) C.selectIds([itId]);
      });
    });
  }

  /* ---------- معالج النقرات ---------- */
  function onClick(e) {
    var a = e.target.closest('[data-act]'), t, pop = $('#slPop');
    if (pop && !pop.hidden && !e.target.closest('#slPop') && !(a && (a.dataset.act === 'addshape' || a.dataset.act === 'addtable' || a.dataset.act === 'addchart'))) {
      pop.hidden = true;
    }
    if (!a && (t = e.target.closest('.sl-ratio'))) {
      newRatio = t.dataset.ratio;
      [].forEach.call(root.querySelectorAll('.sl-ratio'), function (b) { var on = b.dataset.ratio === newRatio; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      return;
    }
    if (!a && (t = e.target.closest('.sl-thumb')) && cur) {
      flush();
      selId = t.dataset.id;
      C.deselect();
      refresh();
      return;
    }
    if (!a && (t = e.target.closest('.sl-swatch')) && cur) {
      var i = slideBy(selId);
      if (i >= 0) { E.setSlideBg(cur.slides[i], t.dataset.bg); pushHistory(); touch(); refresh(); }
      return;
    }
    if (!a) return;

    var act = a.dataset.act, id, p, i2, s;
    if (act === 'create') {
      var nm = ($('#slName').value || '').trim() || 'عرض بدون عنوان';
      p = E.normalizeProject({ id: uid(), name: nm, ratio: newRatio, created: Date.now(), updated: Date.now(), slides: [E.newSlide()] });
      projects.unshift(p);
      ST.saveProject(p).then(function () { openProject(p); });
    } else if (act === 'openlast') {
      if (!projects.length) { toast('لا توجد مشاريع محفوظة بعد'); return; }
      var lid = ST.getLastOpen();
      var target = (lid && projects.filter(function (x) { return x.id === lid; })[0]) || projects.slice().sort(function (x, y) { return y.updated - x.updated; })[0];
      if (target) openProject(target);
    } else if (act === 'open') {
      id = a.closest('.sl-proj').dataset.id;
      p = projects.filter(function (x) { return x.id === id; })[0];
      if (p) openProject(p);
    } else if (act === 'renproj') {
      id = a.closest('.sl-proj').dataset.id;
      p = projects.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      openModal('تعديل اسم المشروع', '<label class="sl-lbl" for="slRenIn">الاسم الجديد</label><input id="slRenIn" class="sl-input" type="text" maxlength="120" value="' + esc(p.name) + '">' +
        '<div class="sl-actions"><button type="button" class="sl-btn pri" id="slRenOk">حفظ الاسم</button><button type="button" class="sl-btn" data-mclose>إلغاء</button></div>', function (m) {
        var inp = m.querySelector('#slRenIn'); inp.focus(); inp.select();
        m.querySelector('#slRenOk').onclick = function () {
          var nv = inp.value.trim(); if (!nv) return;
          p.name = nv; p.updated = Date.now();
          ST.saveProject(p).then(function () { closeModal(); renderHome(false); toast('تم تحديث اسم المشروع'); });
        };
      });
    } else if (act === 'dupproj') {
      id = a.closest('.sl-proj').dataset.id;
      p = projects.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var copy = E.normalizeProject(E.clone(p));
      copy.id = uid(); copy.name = p.name + ' (نسخة)'; copy.created = Date.now(); copy.updated = Date.now();
      projects.unshift(copy);
      ST.saveProject(copy).then(function () { renderHome(false); toast('تم نسخ المشروع'); });
    } else if (act === 'expjson') {
      id = a.closest('.sl-proj').dataset.id;
      p = projects.filter(function (x) { return x.id === id; })[0];
      if (p && ST.exportJson(p)) toast('تم تنزيل نسخة المشروع الاحتياطية (JSON)');
    } else if (act === 'impjson') {
      $('#slImportFile').click();
    } else if (act === 'delproj') {
      id = a.closest('.sl-proj').dataset.id;
      p = projects.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      openModal('تأكيد الحذف', '<p class="sl-muted">هل تريد حذف المشروع «<b>' + esc(p.name) + '</b>» نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>' +
        '<div class="sl-actions"><button type="button" class="sl-btn dng" id="slDelOk">نعم، احذف المشروع</button><button type="button" class="sl-btn" data-mclose>إلغاء</button></div>', function (m) {
        m.querySelector('#slDelOk').onclick = function () {
          ST.deleteProject(id).then(function () {
            projects = projects.filter(function (x) { return x.id !== id; });
            if (ST.getLastOpen() === id) ST.setLastOpen('');
            closeModal(); renderHome(false); toast('تم حذف المشروع');
          });
        };
      });
    } else if (act === 'exit') {
      home(false);
    } else if (act === 'add') {
      s = E.newSlide(); i2 = slideBy(selId);
      cur.slides.splice(i2 < 0 ? cur.slides.length : i2 + 1, 0, s);
      selId = s.id; C.deselect(); pushHistory(); touch(); refresh();
    } else if (act === 'dup') {
      i2 = slideBy(selId); if (i2 < 0) return;
      s = E.cloneSlide(cur.slides[i2]); cur.slides.splice(i2 + 1, 0, s);
      selId = s.id; C.deselect(); pushHistory(); touch(); refresh(); toast('تم نسخ الشريحة');
    } else if (act === 'del') {
      i2 = slideBy(selId); if (i2 < 0) return;
      cur.slides.splice(i2, 1);
      selId = cur.slides.length ? cur.slides[Math.min(i2, cur.slides.length - 1)].id : null;
      C.deselect(); pushHistory(); touch(); refresh(); toast('تم حذف الشريحة');
    } else if (act === 'panel') {
      panelOpen = !panelOpen; var ed = $('.sl-ed'); if (ed) ed.classList.toggle('panel-open', panelOpen);
    } else if (act === 'addtext') {
      C.actions.addText();
    } else if (act === 'addimg') {
      if (slideBy(selId) >= 0) $('#slFile').click();
    } else if (act === 'replaceimg') {
      if (slideBy(selId) >= 0) $('#slReplaceFile').click();
    } else if (act === 'cropimg') {
      C.actions.startCrop();
    } else if (act === 'resetcrop') {
      C.actions.resetCrop();
    } else if (act === 'addshape') {
      if (slideBy(selId) < 0) return;
      openPop(a, '<div class="sl-pop-grid">' + SHAPES.map(function (k) { return '<button type="button" class="sl-popb" data-act="shape:' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>');
    } else if (act.indexOf('shape:') === 0) {
      C.actions.addShape(act.slice(6));
    } else if (act === 'addtable') {
      if (slideBy(selId) < 0) return;
      openPop(a, '<div class="sl-pop-pad"><div class="sl-fg">' +
        '<label class="sl-f"><span>الصفوف</span><input id="slTblR" class="sl-in" type="number" min="1" max="12" value="3"></label>' +
        '<label class="sl-f"><span>الأعمدة</span><input id="slTblC" class="sl-in" type="number" min="1" max="10" value="3"></label></div>' +
        '<button type="button" class="sl-btn-sm wide pri" data-act="mk-table">إدراج الجدول</button></div>');
    } else if (act === 'mk-table') {
      var tr = parseInt($('#slTblR').value, 10) || 3, tc = parseInt($('#slTblC').value, 10) || 3;
      C.actions.addTable(tr, tc);
    } else if (act === 'addchart') {
      if (slideBy(selId) < 0) return;
      openPop(a, '<button type="button" class="sl-popb" data-act="chart:bar">مخطط أعمدة</button>' +
        '<button type="button" class="sl-popb" data-act="chart:pie">مخطط دائري</button>' +
        '<button type="button" class="sl-popb" data-act="chart:line">مخطط خطي</button>');
    } else if (act.indexOf('chart:') === 0) {
      C.actions.addChart(act.slice(6));
    } else if (act === 'undo') {
      undo();
    } else if (act === 'redo') {
      redo();
    } else if (act === 'qa') {
      showQualityModal();
    } else if (act === 'export') {
      showExportModal();
    } else if (act === 'present') {
      if (!cur || !cur.slides.length) { toast('أضف شريحة واحدة على الأقل'); return; }
      flush();
      if (window.SLPres) window.SLPres.open(cur, Math.max(0, slideBy(selId)), function (endIdx) {
        if (cur && cur.slides[endIdx]) { selId = cur.slides[endIdx].id; refresh(); }
      });
    } else if (act === 'tognotes') {
      notesOpen = !notesOpen;
      var bd = $('.sl-notes-bd'); if (bd) bd.hidden = !notesOpen;
    } else if (act === 'zin') {
      var z1 = C.actions.setZoom((C.actions.getZoom() || 1) + 0.2);
      var lbl1 = $('#slZoomLbl'); if (lbl1) lbl1.textContent = Math.round(z1 * 100) + '%';
    } else if (act === 'zout') {
      var z2 = C.actions.setZoom((C.actions.getZoom() || 1) - 0.2);
      var lbl2 = $('#slZoomLbl'); if (lbl2) lbl2.textContent = Math.round(z2 * 100) + '%';
    } else if (act === 'zfit') {
      var z3 = C.actions.setZoom('fit');
      var lbl3 = $('#slZoomLbl'); if (lbl3) lbl3.textContent = Math.round(z3 * 100) + '%';
    }
  }

  function onInput(e) {
    if (!cur) return;
    if (e.target.id === 'slTitle') {
      cur.name = e.target.value.trim() || 'عرض بدون عنوان';
      touch();
    } else if (e.target.id === 'slNotesIn') {
      var s = ctx.slide();
      if (s) { E.setSlideNotes(s, e.target.value); touch(); }
    } else if (e.target.dataset.slide) {
      var s2 = ctx.slide(); if (!s2) return;
      var k = e.target.dataset.slide;
      if (k === 'bg') { E.setSlideBg(s2, e.target.value); var slEl = $('.sl-slide'); if (slEl) slEl.style.background = s2.bg; touch(); scheduleThumbRefresh(s2); }
      else if (k === 'transDur') { E.setSlideTransition(s2, s2.transition, e.target.value); touch(); }
    }
  }

  function onChange(e) {
    if (e.target.id === 'slFile') {
      var f = e.target.files && e.target.files[0]; e.target.value = '';
      if (f) C.actions.addImage(f);
    } else if (e.target.id === 'slReplaceFile') {
      var f2 = e.target.files && e.target.files[0]; e.target.value = '';
      if (f2) C.actions.replaceImage(f2);
    } else if (e.target.id === 'slImportFile') {
      var f3 = e.target.files && e.target.files[0]; e.target.value = '';
      if (!f3) return;
      ST.importJsonFile(f3, projects).then(function (res) {
        if (!res.ok) {
          openModal('تعذّر استيراد الملف', '<p class="sl-muted">' + esc(res.msg) + '</p><div class="sl-actions"><button type="button" class="sl-btn pri" data-mclose>حسناً</button></div>');
          return;
        }
        projects.unshift(res.project);
        renderHome(false);
        toast('تم استيراد العرض «' + res.project.name + '» بنجاح');
      });
    } else if (e.target.dataset.slide && cur) {
      var s = ctx.slide(); if (!s) return;
      var k = e.target.dataset.slide;
      if (k === 'transition') E.setSlideTransition(s, e.target.value, s.transDur);
      else if (k === 'transDur') E.setSlideTransition(s, s.transition, e.target.value);
      else if (k === 'bg') E.setSlideBg(s, e.target.value);
      pushHistory(); touch(); refresh();
    }
  }

  /* ---------- الواجهة العامة (يستدعيها tools.js) ---------- */
  var bound = false;
  window.SL = {
    init: function (view) {
      root = view;
      if (!bound) {
        bound = true;
        root.addEventListener('click', onClick);
        root.addEventListener('input', onInput);
        root.addEventListener('change', onChange);
        C.attach(ctx, root);
        P.bind(root);
      }
      root.classList.add('sl-host');
      home(true);
      ST.initAndList().then(function (list) {
        projects = list;
        if (!cur) renderHome(false);
      });
    },
    refresh: function () {
      if (!root) return;
      if (!cur) {
        ST.initAndList().then(function (list) { projects = list; if (!cur) renderHome(false); });
      }
    }
  };
})();
