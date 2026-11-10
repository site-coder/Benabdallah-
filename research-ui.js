/* ==========================================================================
   research-ui.js — واجهة أداة «إنشاء بحث جامعي» (1/2): الهيكل، القائمة، الأقسام، المحرر
   ========================================================================== */
(function () {
  'use strict';
  var RS = window.RS, U = RS.u, M = RS.model, H = RS.html, D = RS.db, R = RS.refs, esc = U.esc;
  var S = RS.S = { paper: null, imgs: {}, selId: 'intro', tab: 'info', dirty: false, lastSave: 0, lastSnap: 0, range: null, nums: false, split: false, findOpen: false };
  var UI = RS.ui = {};
  var root = null;
  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  UI.$ = $; UI.$$ = $$;
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var I = UI.I = {
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'), trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'), copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    open: ic('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'), up: ic('<path d="m18 15-6-6-6 6"/>'), down: ic('<path d="m6 9 6 6 6-6"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'), ul: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
    img: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
    grip: ic('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
    aR: ic('<path d="M21 6H3"/><path d="M21 12H9"/><path d="M21 18H5"/>'), aL: ic('<path d="M3 6h18"/><path d="M3 12h12"/><path d="M3 18h16"/>'), aC: ic('<path d="M21 6H3"/><path d="M17 12H7"/><path d="M19 18H5"/>'), aJ: ic('<path d="M21 6H3"/><path d="M21 12H3"/><path d="M21 18H3"/>'),
    ulist: ic('<path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'), olist: ic('<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
    link: ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'), table: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>'),
    srch: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'), save: ic('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>'),
    quote: ic('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h3"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h3"/>'),
    menu: ic('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'), chev: ic('<path d="m15 18-6-6 6-6"/>'), x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'), brk: ic('<path d="M3 12h18"/><path d="M8 6l4-3 4 3"/><path d="M8 18l4 3 4-3"/>')
  };

  /* --------------------------------------------------------- إشعار/نوافذ */
  var toastEl = null, toastT = 0;
  function toast(m, ms) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'rs-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2600);
  }
  UI.toast = toast;
  var mstack = [];
  function openModal(html, o) {
    o = o || {}; var bg = document.createElement('div'); bg.className = 'rs-mbg';
    bg.innerHTML = '<div class="rs-modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(bg); var m = bg.firstChild, api = { el: m, close: function () { var i = mstack.indexOf(api); if (i >= 0) mstack.splice(i, 1); bg.remove(); if (o.onClose) o.onClose(); } };
    bg.addEventListener('mousedown', function (e) { if (e.target === bg && !o.sticky) api.close(); });
    m.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) api.close(); });
    mstack.push(api); var f = m.querySelector('input:not([type=file]):not([type=checkbox]),textarea'); if (f && !/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) setTimeout(function () { f.focus(); }, 30);
    return api;
  }
  UI.modal = openModal;
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && mstack.length) { mstack[mstack.length - 1].close(); } });
  function confirmBox(msg, ok, danger) {
    return new Promise(function (res) {
      var done = false, m = openModal('<h3>تأكيد</h3><p class="rs-p">' + esc(msg) + '</p><div class="rs-btns"><button type="button" class="tl-btn ' + (danger ? 'del' : 'pri') + '" data-ok>' + esc(ok || 'موافق') + '</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>', { onClose: function () { if (!done) { done = true; res(false); } } });
      m.el.querySelector('[data-ok]').addEventListener('click', function () { done = true; m.close(); res(true); });
    });
  }
  function promptBox(title, label, val, ph) {
    return new Promise(function (res) {
      var done = false, m = openModal('<h3>' + esc(title) + '</h3><label class="tl-lbl">' + esc(label) + '</label><input class="tl-in" maxlength="200" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>حفظ</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>', { onClose: function () { if (!done) { done = true; res(null); } } });
      var inp = m.el.querySelector('input'); function fin() { done = true; var v = inp.value.trim(); m.close(); res(v); }
      m.el.querySelector('[data-ok]').addEventListener('click', fin); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') fin(); });
    });
  }
  UI.confirm = confirmBox; UI.prompt = promptBox;

  /* ------------------------------------------------------------- الحفظ */
  var statusEl = null;
  function setStatus(t, cls) { var e = $('#rsSave'); if (e) { e.textContent = t; e.className = 'rs-save ' + (cls || ''); } }
  var saveDebounced = U.debounce(function () { saveNow(); }, 700);
  function markDirty() { if (!S.paper) return; S.dirty = true; S.paper.modified = Date.now(); setStatus('جارٍ الحفظ…', 'wait'); saveDebounced(); if (UI.onChange) UI.onChange(); }
  UI.markDirty = markDirty;
  function saveNow() {
    if (!S.paper) return Promise.resolve();
    saveDebounced.flush();
    var p = S.paper;
    return D.put('papers', p).then(function () {
      S.dirty = false; S.lastSave = Date.now(); setStatus('تم الحفظ ' + U.pad(new Date().getHours()) + ':' + U.pad(new Date().getMinutes()), 'ok');
      if (Date.now() - S.lastSnap > 15 * 60000) { S.lastSnap = Date.now(); makeSnap('تلقائية', true); }
    }).catch(function (e) {
      setStatus('تعذّر الحفظ!', 'bad');
      toast('تعذّر حفظ البحث (ربما المساحة ممتلئة). صدّر نسخة احتياطية الآن من تبويب «الأدوات».', 6000);
    });
  }
  UI.saveNow = function () { commitEditor(); return saveNow(); };
  function makeSnap(label, auto) {
    if (!S.paper) return Promise.resolve();
    var snap = { id: U.uid(), paperId: S.paper.id, time: Date.now(), label: label || '', auto: !!auto, paper: U.clone(S.paper) };
    return D.put('snaps', snap).then(function () { return D.byPaper('snaps', S.paper.id); }).then(function (all) {
      var autos = all.filter(function (s) { return s.auto; }).sort(function (a, b) { return b.time - a.time; });
      return Promise.all(autos.slice(12).map(function (s) { return D.del('snaps', s.id); }));
    }).catch(function () {});
  }
  UI.makeSnap = makeSnap;
  function flush() { if (S.paper && S.dirty) { commitEditor(); saveNow(); } }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  /* ------------------------------------------------ تخزين الصور (IndexedDB) */
  function loadImages(pid) {
    S.imgs = {};
    return D.byPaper('images', pid).then(function (a) { a.forEach(function (r) { S.imgs[r.id] = r; }); });
  }
  UI.fileToImage = function (file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) { rej(new Error('type')); return; }
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('read')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error('img')); };
        im.onload = function () {
          var w = im.naturalWidth, h = im.naturalHeight, mx = 1800, data = fr.result, mime = file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase();
          if (Math.max(w, h) > mx || file.size > 3.5 * 1024 * 1024) {
            var sc = Math.min(1, mx / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
            var cx = c.getContext('2d'); if (mime === 'image/jpeg') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); } cx.drawImage(im, 0, 0, c.width, c.height);
            data = c.toDataURL(mime === 'image/jpeg' ? 'image/jpeg' : mime === 'image/webp' ? 'image/webp' : 'image/png', 0.9);
            if (/^data:image\/png/.test(data) === false && mime === 'image/webp' && !/^data:image\/webp/.test(data)) mime = 'image/png'; else if (mime === 'image/webp' && /^data:image\/png/.test(data)) mime = 'image/png';
            w = c.width; h = c.height;
          }
          res({ id: U.uid(), paperId: S.paper.id, data: data, mime: mime, w: w, h: h, name: file.name || '' });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  UI.storeImage = function (rec) { S.imgs[rec.id] = rec; return D.put('images', rec); };

  /* ================================================================ القائمة */
  var listState = { q: '', sort: 'new' };
  var STAT = { draft: 'مسودة', doing: 'قيد الإنجاز', done: 'مكتمل' };
  UI.init = function (el) {
    root = el; RS.root = el; el.classList.add('rs-root');
    el.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><h2 class="ptitle">إنشاء بحث جامعي</h2><div id="rsMain"></div><input type="file" id="rsImport" accept=".json,application/json" hidden>';
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('input', onInput);
    $('#rsImport').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) UI.importFile(f); });
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    /* حفظ عند مغادرة الأداة */
    try { new MutationObserver(function () { if (el.hidden || el.offsetParent === null) flush(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] }); } catch (e) {}
    UI.showList();
  };
  UI.refresh = function () { if (!S.paper) UI.showList(); };
  function main() { return $('#rsMain'); }
  UI.showList = function () {
    commitEditor(); flush(); S.paper = null; S.imgs = {};
    D.ready().then(function (ok) {
      main().innerHTML = '<div class="tl-box"><div class="rs-btns"><button type="button" class="tl-btn pri" data-act="new">' + I.plus + '<span>إنشاء بحث جديد</span></button><button type="button" class="tl-btn" data-act="import">' + I.ul + '<span>استيراد نسخة احتياطية</span></button></div>' +
        (ok ? '' : '<div class="tl-msg warn">تعذّر تفعيل التخزين الدائم في هذا المتصفح (ربما وضع التصفح الخاص). ستعمل الأداة لكن بحوثك ستُفقد عند إغلاق الصفحة؛ صدّر نسخة احتياطية باستمرار.</div>') +
        '<div class="rs-row"><div class="tl-fld"><label class="tl-lbl">بحث عن بحث باسمه</label><input class="tl-in" id="rsQ" placeholder="اكتب اسم البحث" value="' + esc(listState.q) + '"></div><div class="tl-fld"><label class="tl-lbl">الترتيب</label><select class="tl-sel" id="rsSort"><option value="new">الأحدث أولاً</option><option value="old">الأقدم أولاً</option><option value="name">حسب الاسم</option></select></div></div></div><div id="rsList"></div>';
      $('#rsSort').value = listState.sort; renderList();
    });
  };
  function renderList() {
    D.all('papers').then(function (all) {
      var q = U.norm(listState.q).toLowerCase();
      var a = all.filter(function (p) { return !q || U.norm(p.title).toLowerCase().indexOf(q) >= 0; });
      a.sort(function (x, y) { return listState.sort === 'name' ? (x.title || '').localeCompare(y.title || '', 'ar') : listState.sort === 'old' ? x.modified - y.modified : y.modified - x.modified; });
      var el = $('#rsList'); if (!el) return;
      if (!a.length) { el.innerHTML = '<div class="tl-box"><p class="tl-empty">' + (all.length ? 'لا توجد بحوث بهذا الاسم.' : 'لم تنشئ أي بحث بعد. اضغط «إنشاء بحث جديد» للبدء.') + '</p></div>'; return; }
      el.innerHTML = a.map(function (p) {
        var w = M.paperStats(p).words;
        return '<div class="tl-box rs-paper" data-pid="' + p.id + '"><div class="rs-ph"><b class="rs-pt">' + esc(p.title || 'بدون عنوان') + '</b><select class="tl-sel rs-stat" data-act="status" aria-label="حالة البحث"><option value="draft"' + (p.status === 'draft' ? ' selected' : '') + '>مسودة</option><option value="doing"' + (p.status === 'doing' ? ' selected' : '') + '>قيد الإنجاز</option><option value="done"' + (p.status === 'done' ? ' selected' : '') + '>مكتمل</option></select></div>' +
          '<div class="rs-meta">أُنشئ: ' + U.fmtDate(p.created) + ' · آخر تعديل: ' + U.fmtDT(p.modified) + ' · ' + w + ' كلمة</div>' +
          '<div class="rs-btns"><button type="button" class="tl-btn pri sm" data-act="openp">' + I.open + '<span>فتح ومواصلة</span></button><button type="button" class="tl-btn sm" data-act="renp">' + I.edit + '<span>إعادة تسمية</span></button><button type="button" class="tl-btn sm" data-act="dupp">' + I.copy + '<span>نسخة</span></button><button type="button" class="tl-btn sm" data-act="bakp">' + I.dl + '<span>نسخة احتياطية</span></button><button type="button" class="tl-btn sm del" data-act="delp">' + I.trash + '<span>حذف</span></button></div></div>';
      }).join('');
    });
  }

  /* ============================================== نموذج إنشاء بحث جديد */
  function infoFields(meta) {
    var f = [['title', 'عنوان البحث'], ['major', 'التخصص'], ['level', 'المستوى الدراسي'], ['group', 'الفوج'], ['year', 'السنة الجامعية'], ['university', 'الجامعة'], ['faculty', 'الكلية'], ['dept', 'القسم'], ['supervisor', 'اسم الأستاذ المشرف']];
    var h = '<div class="rs-grid">' + f.map(function (x) { return '<div class="tl-fld"><label class="tl-lbl">' + x[1] + '</label><input class="tl-in" data-meta="' + x[0] + '" maxlength="300" value="' + esc(meta[x[0]] || '') + '"></div>'; }).join('') + '</div>';
    h += '<h4 class="rs-h4">الطالب والطلبة المشاركون</h4><div id="rsStu">' + (meta.students.length ? meta.students : ['']).map(function (s, i) { return stuRow(s, i); }).join('') + '</div><button type="button" class="tl-btn sm" data-act="addstu">' + I.plus + '<span>إضافة طالب</span></button>';
    h += '<h4 class="rs-h4">بيانات أخرى (اختياري)</h4><div id="rsExtra">' + (meta.extra || []).map(function (x, i) { return extraRow(x, i); }).join('') + '</div><button type="button" class="tl-btn sm" data-act="addextra">' + I.plus + '<span>إضافة بيان</span></button>';
    return h;
  }
  function stuRow(v, i) { return '<div class="rs-inl"><input class="tl-in" data-stu="' + i + '" placeholder="اسم الطالب" maxlength="200" value="' + esc(v) + '"><button type="button" class="tl-x" data-act="delstu" data-i="' + i + '" aria-label="حذف">' + I.trash + '</button></div>'; }
  function extraRow(x, i) { return '<div class="rs-inl"><input class="tl-in" data-exk="' + i + '" placeholder="العنوان (مثل: رقم التسجيل)" maxlength="100" value="' + esc(x.k) + '"><input class="tl-in" data-exv="' + i + '" placeholder="القيمة" maxlength="300" value="' + esc(x.v) + '"><button type="button" class="tl-x" data-act="delextra" data-i="' + i + '" aria-label="حذف">' + I.trash + '</button></div>'; }
  var draft = null;
  UI.showNew = function () {
    draft = { meta: { title: '', major: '', level: '', group: '', year: '', university: '', faculty: '', dept: '', students: [''], supervisor: '', extra: [] }, tpl: 'plain' };
    main().innerHTML = '<div class="tl-box"><button type="button" class="back" data-act="tolist">العودة للبحوث</button><h3>بحث جديد</h3>' + infoFields(draft.meta) + '<h4 class="rs-h4">قالب البحث</h4><div class="tl-chips" id="rsTpls">' + tplChips('plain') + '</div><p class="tl-hint" id="rsTplDesc"></p><div class="tl-btns"><button type="button" class="tl-btn pri" data-act="create">' + I.plus + '<span>إنشاء البحث</span></button></div></div>';
    tplDesc();
  };
  function userTpls() { try { return JSON.parse(localStorage.getItem('rs_user_tpls') || '[]'); } catch (e) { return []; } }
  function tplChips(sel) { return M.TEMPLATES.map(function (t) { return '<button type="button" class="tl-chip' + (sel === t.id ? ' on' : '') + '" data-act="tpl" data-t="' + t.id + '" aria-pressed="' + (sel === t.id) + '">' + esc(t.name) + '</button>'; }).concat(userTpls().map(function (t, i) { return '<button type="button" class="tl-chip' + (sel === 'u' + i ? ' on' : '') + '" data-act="tpl" data-t="u' + i + '">★ ' + esc(t.name) + '</button>'; })).join(''); }
  function tplDesc() { var e = $('#rsTplDesc'); if (!e) return; var t = M.TEMPLATES.filter(function (x) { return x.id === draft.tpl; })[0]; e.textContent = t ? t.desc + (t.id !== 'blank' ? ' — العناوين الجاهزة هيكلية عامة فقط وقابلة للتعديل، ولا يتضمن القالب أي محتوى علمي أو مراجع.' : '') : 'قالب محفوظ من إنشائك.'; }
  function createFromDraft() {
    var meta = draft.meta; if (!meta.title.trim()) { toast('اكتب عنوان البحث أولاً.'); var i = $('[data-meta="title"]'); if (i) i.classList.add('bad'); return; }
    meta.students = meta.students.filter(function (s) { return s.trim(); });
    var t = M.TEMPLATES.filter(function (x) { return x.id === draft.tpl; })[0], paper;
    if (t) paper = M.newPaper({ title: meta.title.trim(), meta: meta, structure: t.structure, tplName: t.name });
    else { var ut = userTpls()[+draft.tpl.slice(1)]; paper = M.newPaper({ title: meta.title.trim(), meta: meta, settings: ut && ut.settings, tplName: ut && ut.name }); if (ut && ut.structure) paper.body = M.buildStructure(ut.structure); }
    paper.meta.title = meta.title.trim(); paper.cover = RS.cover.newCover(paper.settings, paper.meta, 'classic', '#4c1d95');
    D.put('papers', paper).then(function () { UI.openPaper(paper.id, 'info'); }).catch(function () { toast('تعذّر إنشاء البحث: التخزين غير متاح.'); });
  }

  /* ================================================================ مساحة العمل */
  var TABS = [['info', 'البيانات'], ['edit', 'المحرر'], ['cover', 'الغلاف'], ['refs', 'المراجع'], ['media', 'الصور والجداول'], ['preview', 'المعاينة'], ['settings', 'الإعدادات'], ['tools', 'الأدوات'], ['export', 'التصدير']];
  UI.openPaper = function (id, tab) {
    D.get('papers', id).then(function (p) {
      if (!p) { toast('لم يُعثر على البحث.'); UI.showList(); return; }
      S.paper = p; S.selId = 'intro'; S.tab = tab || 'edit'; S.lastSnap = Date.now();
      if (!p.cover) p.cover = RS.cover.newCover(p.settings, p.meta, 'classic', '#4c1d95');
      return loadImages(p.id).then(function () { renderWork(); });
    });
  };
  function renderWork() {
    var p = S.paper;
    main().innerHTML = '<div class="rs-wtop"><button type="button" class="back" data-act="tolist">كل البحوث</button><b class="rs-wt" id="rsWT">' + esc(p.title) + '</b><span id="rsSave" class="rs-save ok">محفوظ</span><button type="button" class="tl-btn sm pri" data-act="savenow">' + I.save + '<span>حفظ البحث</span></button></div>' +
      '<div class="rs-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" class="rs-tab' + (S.tab === t[0] ? ' on' : '') + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="rsTab"></div>';
    renderTab();
  }
  function renderTab() {
    commitEditor(); var t = S.tab, el = $('#rsTab'); if (!el) return;
    $$('.rs-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    UI.onChange = null;
    if (t === 'info') renderInfo(el); else if (t === 'edit') renderEdit(el);
    else if (RS.ui2 && RS.ui2[t]) RS.ui2[t](el);
    scrollTo(0, 0);
  }
  UI.renderTab = renderTab; UI.setTab = function (t) { S.tab = t; renderTab(); };

  function renderInfo(el) {
    var p = S.paper;
    el.innerHTML = '<div class="tl-box"><h3>معلومات البحث</h3>' + infoFields(p.meta) + '<p class="tl-hint">تُستعمل هذه البيانات في الغلاف تلقائياً، وتُحفظ فور تعديلها.</p></div>';
  }

  /* ----------------------------------------------------- الأقسام (الشريط الجانبي) */
  function secRowHtml(sec, nt, depth) {
    var r = nt.map[sec.id], kids = sec.children || [], open = !sec.collapsed;
    var h = '<div class="rs-node" data-id="' + sec.id + '"><div class="rs-nrow' + (S.selId === sec.id ? ' on' : '') + '" data-act="selsec" data-id="' + sec.id + '" style="padding-inline-start:' + (depth * 14) + 'px"><span class="rs-grip" data-grip="' + sec.id + '" title="اسحب لإعادة الترتيب">' + I.grip + '</span>' +
      (kids.length ? '<button type="button" class="rs-tog' + (open ? ' open' : '') + '" data-act="togsec" data-id="' + sec.id + '" aria-label="طيّ/فتح">' + I.chev + '</button>' : '<span class="rs-tog sp"></span>') + '<span class="rs-nt">' + esc(r.text) + '</span></div>';
    if (kids.length && open) h += '<div class="rs-kids">' + kids.map(function (k) { return secRowHtml(k, nt, depth + 1); }).join('') + '</div>';
    return h + '</div>';
  }
  function sidebarHtml() {
    var p = S.paper, nt = M.numberTree(p);
    return '<div class="rs-side"><div class="rs-nrow' + (S.selId === 'intro' ? ' on' : '') + ' fixed" data-act="selsec" data-id="intro"><span class="rs-nt">' + esc(p.settings.introTitle || 'المقدمة') + '</span></div><div id="rsTree">' + p.body.map(function (s) { return secRowHtml(s, nt, 0); }).join('') + '</div>' +
      '<div class="rs-nrow' + (S.selId === 'concl' ? ' on' : '') + ' fixed" data-act="selsec" data-id="concl"><span class="rs-nt">' + esc(p.settings.conclTitle || 'الخاتمة') + '</span></div>' +
      '<div class="rs-sacts"><button type="button" class="tl-btn sm pri" data-act="addsec">' + I.plus + '<span>إضافة قسم</span></button>' +
      (S.selId !== 'intro' && S.selId !== 'concl' ? '<button type="button" class="tl-btn sm" data-act="secup" title="أعلى">' + I.up + '</button><button type="button" class="tl-btn sm" data-act="secdn" title="أسفل">' + I.down + '</button><button type="button" class="tl-btn sm" data-act="secout" title="إخراج من الأب">⇤</button><button type="button" class="tl-btn sm" data-act="secin" title="إدخال تحت السابق">⇥</button><button type="button" class="tl-btn sm" data-act="secdup" title="تكرار">' + I.copy + '</button><button type="button" class="tl-btn sm" data-act="secmove" title="نقل إلى موضع آخر">نقل</button><button type="button" class="tl-btn sm del" data-act="secdel" title="حذف">' + I.trash + '</button>' : '') + '</div><p class="tl-hint">اسحب المقبض ⋮⋮ لإعادة الترتيب أو لإدخال قسم داخل آخر (أفلته في منتصف القسم الهدف).</p></div>';
  }
  function refreshSide() { var s = $('.rs-side'); if (s) { var w = s.parentNode; var tmp = document.createElement('div'); tmp.innerHTML = sidebarHtml(); w.replaceChild(tmp.firstChild, s); } }

  /* ------------------------------------------------------------ المحرر */
  var FONTS = ['Traditional Arabic', 'Simplified Arabic', 'Arial', 'Times New Roman', 'Tahoma', 'Calibri', 'Amiri', 'Noto Naskh Arabic', 'Courier New'];
  UI.FONTS = FONTS;
  var SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36];
  function toolbarHtml() {
    function b(cmd, ico, title, extra) { return '<button type="button" class="rs-b" data-cmd="' + cmd + '" title="' + title + '" aria-label="' + title + '"' + (extra || '') + '>' + ico + '</button>'; }
    return '<div class="rs-tb" id="rsTb"><div class="rs-tbr">' +
      b('undo', '↶', 'تراجع') + b('redo', '↷', 'إعادة') + b('copy', I.copy, 'نسخ') + b('cut', '✂', 'قص') + b('paste', '📋', 'لصق') + '<span class="rs-sep"></span>' +
      '<select class="rs-s" id="tbFont" title="نوع الخط" aria-label="نوع الخط"><option value="">الخط</option>' + FONTS.map(function (f) { return '<option>' + f + '</option>'; }).join('') + '</select>' +
      '<select class="rs-s sm" id="tbSize" title="حجم الخط" aria-label="حجم الخط"><option value="">الحجم</option>' + SIZES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>' +
      b('bold', '<b>B</b>', 'عريض (Ctrl+B)') + b('italic', '<i>I</i>', 'مائل (Ctrl+I)') + b('underline', '<u>U</u>', 'تسطير (Ctrl+U)') + b('strikeThrough', '<s>S</s>', 'يتوسطه خط') +
      '<label class="rs-b col" title="لون النص">A<input type="color" id="tbColor" value="#000000" aria-label="لون النص"></label><label class="rs-b col hl" title="تمييز النص">▇<input type="color" id="tbHl" value="#ffeb3b" aria-label="تمييز النص"></label><span class="rs-sep"></span>' +
      b('justifyRight', I.aR, 'محاذاة لليمين') + b('justifyCenter', I.aC, 'توسيط') + b('justifyLeft', I.aL, 'محاذاة لليسار') + b('justifyFull', I.aJ, 'ضبط') + b('dir', 'LTR', 'تبديل اتجاه الفقرة') + '<span class="rs-sep"></span>' +
      b('insertUnorderedList', I.ulist, 'قائمة نقطية') + b('insertOrderedList', I.olist, 'قائمة رقمية') +
      '<select class="rs-s sm" id="tbHead" title="نمط الفقرة" aria-label="نمط الفقرة"><option value="p">فقرة</option><option value="h4">عنوان 1</option><option value="h5">عنوان 2</option><option value="h6">عنوان 3</option><option value="blockquote">اقتباس</option></select>' +
      '<select class="rs-s sm" id="tbLh" title="تباعد الأسطر" aria-label="تباعد الأسطر"><option value="">الأسطر</option><option>1</option><option>1.15</option><option>1.5</option><option>2</option><option>2.5</option><option>3</option></select>' +
      '<select class="rs-s sm" id="tbPg" title="المسافة بين الفقرات" aria-label="المسافة بين الفقرات"><option value="">الفقرات</option><option value="0">0</option><option value="3">3pt</option><option value="6">6pt</option><option value="12">12pt</option><option value="18">18pt</option><option value="24">24pt</option></select></div>' +
      '<div class="rs-tbr">' + b('link', I.link, 'إدراج رابط') + b('table', I.table, 'إدراج جدول') + b('image', I.img, 'إضافة صورة') + b('cite', I.quote, 'إدراج إحالة من المراجع') + b('pgbrk', I.brk, 'فاصل صفحة') + b('find', I.srch, 'بحث واستبدال (Ctrl+F)') + b('nums', '¶', 'إظهار أرقام الفقرات') + b('clear', 'Tx', 'إزالة التنسيق') + '</div>' +
      '<div class="rs-tbr rs-tbt" id="rsTbl" hidden></div></div>';
  }
  function renderEdit(el) {
    var wide = innerWidth >= 1100;
    el.innerHTML = '<div class="rs-ws' + (S.split && wide ? ' split' : '') + '"><button type="button" class="tl-btn sm rs-sidebtn" data-act="togside">' + I.menu + '<span>الأقسام</span></button><div class="rs-sidew" id="rsSideW">' + sidebarHtml() + '</div><div class="rs-edw"><div id="rsEdHead"></div>' + toolbarHtml() + '<div id="rsFind" hidden></div><div class="rs-sheet"><div class="rs-ed" id="rsEd" contenteditable="true" dir="rtl" spellcheck="true" role="textbox" aria-multiline="true" aria-label="محرر النص"></div></div><div class="rs-foot"><span id="rsCnt"></span>' + (wide ? '<button type="button" class="tl-btn sm" data-act="togsplit">' + I.srch + '<span>معاينة جانبية</span></button>' : '') + '</div></div>' + (S.split && wide ? '<div class="rs-pv" id="rsPvSide"></div>' : '') + '</div>';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, true); } catch (e) {}
    loadSection(S.selId);
    if (S.split && wide) { UI.onChange = U.debounce(function () { if (RS.ui2 && RS.ui2.sidePreview) RS.ui2.sidePreview(); }, 1600); if (RS.ui2 && RS.ui2.sidePreview) RS.ui2.sidePreview(); }
  }
  function curHtml() { var id = S.selId, p = S.paper; if (id === 'intro') return p.intro.html; if (id === 'concl') return p.concl.html; var f = M.findSec(p, id); return f ? f.sec.html : ''; }
  function setHtml(h) { var id = S.selId, p = S.paper; if (id === 'intro') p.intro.html = h; else if (id === 'concl') p.concl.html = h; else { var f = M.findSec(p, id); if (f) f.sec.html = h; } }
  function figEditorEl(f) {
    var im = S.imgs[f.imgId], fg = document.createElement('figure'); fg.className = 'rs-fig'; fg.setAttribute('data-fig', f.id); fg.setAttribute('contenteditable', 'false'); fg.style.textAlign = f.align === 'right' ? 'right' : f.align === 'left' ? 'left' : 'center';
    fg.innerHTML = (im ? '<img alt="" src="' + im.data + '" style="width:' + Math.min(f.w || 300, 560) + 'px;max-width:100%;height:auto">' : '<div class="rs-nofig">الصورة غير متوفرة</div>') + '<figcaption>' + esc(f.title || '') + '</figcaption><span class="rs-ftag" data-act="editfig" data-fid="' + f.id + '">' + I.edit + ' تعديل الصورة</span>';
    return fg;
  }
  function loadSection(id) {
    S.selId = id; var ed = $('#rsEd'); if (!ed) return;
    var html = R.refreshCites(S.paper, curHtml()), blocks = H.blocks(html);
    var il = RS.place.interleave(S.paper, id, blocks, figEditorEl);
    ed.innerHTML = '';
    il.out.forEach(function (b) {
      if (b.hasAttribute && b.hasAttribute('data-pgbrk')) { b.setAttribute('contenteditable', 'false'); b.textContent = ''; }
      Array.prototype.forEach.call(b.querySelectorAll ? b.querySelectorAll('.rs-cite') : [], function (c) { c.setAttribute('contenteditable', 'false'); });
      ed.appendChild(b);
    });
    if (!ed.children.length) ed.innerHTML = '<p><br></p>';
    var sx = S.paper.settings; ed.style.fontFamily = '"' + sx.font + '","Traditional Arabic","Simplified Arabic","Amiri","Noto Naskh Arabic",serif'; ed.style.fontSize = sx.fs + 'pt'; ed.style.lineHeight = sx.lh; ed.style.textAlign = sx.align; ed.style.setProperty('--pg', sx.pgap + 'pt');
    ed.classList.toggle('nums', !!S.nums); numberParas(); renderEdHead(); updateCount(); $$('.rs-nrow', $('#rsSideW')).forEach(function (r) { r.classList.toggle('on', r.dataset.id === id); });
    var tb = $('#rsTbl'); if (tb) tb.hidden = true;
  }
  function renderEdHead() {
    var h = $('#rsEdHead'), id = S.selId, p = S.paper; if (!h) return;
    if (id === 'intro' || id === 'concl') { h.innerHTML = '<div class="rs-eh"><b>' + esc(id === 'intro' ? (p.settings.introTitle || 'المقدمة') : (p.settings.conclTitle || 'الخاتمة')) + '</b><span class="tl-hint">تبدأ في صفحة مستقلة تلقائياً</span></div>'; return; }
    var f = M.findSec(p, id); if (!f) { h.innerHTML = ''; return; }
    var r = M.numberTree(p).map[id];
    h.innerHTML = '<div class="rs-eh"><div class="tl-fld" style="flex:0 0 150px"><label class="tl-lbl">نوع العنوان</label><select class="tl-sel" id="secType">' + M.TYPES.map(function (t) { return '<option value="' + t.k + '"' + (f.sec.type === t.k ? ' selected' : '') + '>' + t.n + '</option>'; }).join('') + '</select></div><div class="tl-fld"><label class="tl-lbl" id="secLbl">' + esc(r.label || 'العنوان') + '</label><input class="tl-in" id="secTitle" maxlength="300" placeholder="عنوان القسم" value="' + esc(f.sec.title) + '"></div></div>';
  }
  function numberParas() {
    var ed = $('#rsEd'); if (!ed) return; var n = 0;
    Array.prototype.forEach.call(ed.children, function (b) { b.removeAttribute('data-pn'); if (H.isPara(b)) { n++; b.setAttribute('data-pn', n); } });
  }
  function updateCount() { var e = $('#rsCnt'), ed = $('#rsEd'); if (!e || !ed) return; var t = ed.innerText || ''; e.textContent = U.countWords(t) + ' كلمة · ' + U.countChars(t) + ' حرف'; }
  /* يستخرج HTML المحرر (من دون الصور المرتبطة) ويحفظه في القسم الحالي */
  function commitEditor() {
    var ed = $('#rsEd'); if (!ed || !S.paper || S.tab !== 'edit') return;
    fixFonts(ed);
    var clean = H.clean(ed.innerHTML);
    if (clean !== curHtml()) { setHtml(clean); markDirty(); }
  }
  UI.commit = commitEditor;
  var commitDeb = U.debounce(function () { commitEditor(); numberParas(); updateCount(); }, 350);
  function fixFonts(ed) {
    Array.prototype.forEach.call(ed.querySelectorAll('font'), function (f) {
      var sp = document.createElement('span'), sz = f.getAttribute('size');
      if (f.style.cssText) sp.style.cssText = f.style.cssText; if (f.getAttribute('color')) sp.style.color = f.getAttribute('color'); if (f.getAttribute('face')) sp.style.fontFamily = f.getAttribute('face');
      if (sz === '7' && S.pendSize) sp.style.fontSize = S.pendSize + 'pt';
      while (f.firstChild) sp.appendChild(f.firstChild); f.parentNode.replaceChild(sp, f);
    });
    Array.prototype.forEach.call(ed.querySelectorAll('span[style*="font-size"]'), function (sp) { if (/xxx-large|xx-large|-webkit/.test(sp.style.fontSize) && S.pendSize) sp.style.fontSize = S.pendSize + 'pt'; });
  }
  document.addEventListener('selectionchange', function () {
    var ed = $ && root && $('#rsEd'); if (!ed) return; var s = getSelection();
    if (s.rangeCount && ed.contains(s.anchorNode)) { S.range = s.getRangeAt(0).cloneRange(); updateTableBar(); }
  });
  function restoreRange() {
    var ed = $('#rsEd'); if (!ed) return false; ed.focus();
    if (S.range) { var s = getSelection(); s.removeAllRanges(); s.addRange(S.range); return true; }
    var r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); var s2 = getSelection(); s2.removeAllRanges(); s2.addRange(r); return true;
  }
  function selBlocks() {
    var ed = $('#rsEd'), s = getSelection(); if (!s.rangeCount) return [];
    var r = s.getRangeAt(0), out = [];
    Array.prototype.forEach.call(ed.children, function (b) { if (b.nodeType === 1 && !b.hasAttribute('data-fig') && r.intersectsNode(b)) out.push(b); });
    return out;
  }
  function execCmd(cmd, val) {
    restoreRange(); var ed = $('#rsEd');
    if (cmd === 'paste') { if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { restoreRange(); document.execCommand('insertText', false, t); commitDeb(); }, function () { toast('اضغط Ctrl+V (أو اضغط مطولاً ثم «لصق») لأن المتصفح منع الوصول للحافظة.', 4500); }); else toast('اضغط Ctrl+V للصق.'); return; }
    if (cmd === 'dir') { selBlocks().forEach(function (b) { b.setAttribute('dir', b.getAttribute('dir') === 'ltr' ? 'rtl' : 'ltr'); }); commitDeb(); return; }
    if (cmd === 'clear') { document.execCommand('removeFormat'); commitDeb(); return; }
    if (cmd === 'fontSize') { S.pendSize = val; try { document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7'); document.execCommand('styleWithCSS', false, true); } catch (e) {} fixFonts(ed); commitDeb(); return; }
    if (cmd === 'formatBlock') { document.execCommand('formatBlock', false, val === 'p' ? 'p' : val); commitDeb(); return; }
    try { document.execCommand(cmd, false, val == null ? null : val); } catch (e) {}
    commitDeb();
  }
  function applyBlockStyle(prop, val) { selBlocks().forEach(function (b) { if (/^(P|H4|H5|H6|UL|OL|BLOCKQUOTE)$/.test(b.tagName)) b.style[prop] = val; }); commitDeb(); }
  UI.insertBlockAfterCaret = function (node) {
    var ed = $('#rsEd'); restoreRange(); var s = getSelection(), n = s.rangeCount ? s.anchorNode : null;
    while (n && n.parentNode !== ed) n = n.parentNode;
    if (!n) { ed.appendChild(node); } else ed.insertBefore(node, n.nextSibling);
    var next = node.nextSibling; if (!next || next.nodeType !== 1 || next.hasAttribute('data-fig')) { var p = document.createElement('p'); p.innerHTML = '<br>'; ed.insertBefore(p, node.nextSibling); }
    commitDeb();
  };
  UI.insertHtmlAtCaret = function (html) { restoreRange(); document.execCommand('insertHTML', false, html); commitDeb(); };

  /* ---- أدوات الجدول ---- */
  function curCell() { var ed = $('#rsEd'), s = getSelection(); if (!s.rangeCount || !ed || !ed.contains(s.anchorNode)) return null; var n = s.anchorNode; if (n.nodeType === 3) n = n.parentNode; return n.closest ? n.closest('td,th') : null; }
  function tgrid(tb) {
    var g = [], cells = [];
    Array.prototype.forEach.call(tb.rows, function (tr, r) {
      g[r] = g[r] || []; var c = 0;
      Array.prototype.forEach.call(tr.cells, function (td) {
        while (g[r][c]) c++;
        var cs = Math.max(1, parseInt(td.getAttribute('colspan'), 10) || 1), rs = Math.max(1, parseInt(td.getAttribute('rowspan'), 10) || 1), info = { td: td, r: r, c: c, cs: cs, rs: rs };
        for (var i = 0; i < rs; i++) { g[r + i] = g[r + i] || []; for (var j = 0; j < cs; j++) g[r + i][c + j] = info; }
        cells.push(info); c += cs;
      });
    });
    return { g: g, cells: cells, nr: tb.rows.length, nc: g.reduce(function (m, r) { return Math.max(m, r.length); }, 0) };
  }
  function newCell(tag) { var td = document.createElement(tag || 'td'); td.innerHTML = '<br>'; return td; }
  function tableOp(op, val) {
    var td = curCell(); if (!td) { toast('ضع المؤشر داخل خلية في الجدول أولاً.'); return; }
    var tb = td.closest('table'), G = tgrid(tb), me = G.cells.filter(function (x) { return x.td === td; })[0], ed = $('#rsEd');
    function row(i) { return tb.rows[i]; }
    if (op === 'rowAfter' || op === 'rowBefore') {
      var at = op === 'rowAfter' ? me.r + me.rs : me.r, tr = document.createElement('tr'), seen = [];
      var ref = G.g[Math.min(at, G.nr - 1)];
      for (var c = 0; c < G.nc; c++) {
        var cover = at > 0 && at < G.nr && G.g[at - 1][c] && G.g[at][c] && G.g[at - 1][c] === G.g[at][c] ? G.g[at][c] : null;
        if (cover) { if (seen.indexOf(cover) < 0) { cover.td.setAttribute('rowspan', cover.rs + 1); seen.push(cover); } continue; }
        tr.appendChild(newCell(at === 0 && row(0).querySelector('th') && op === 'rowBefore' ? 'td' : 'td'));
      }
      var anchor = at < tb.rows.length ? tb.rows[at] : null; (anchor ? anchor.parentNode : tb.tBodies[0] || tb).insertBefore(tr, anchor);
    } else if (op === 'colAfter' || op === 'colBefore') {
      var cc = op === 'colAfter' ? me.c + me.cs : me.c, seen2 = [];
      for (var r = 0; r < G.nr; r++) {
        var cv = cc > 0 && cc < G.nc && G.g[r][cc - 1] && G.g[r][cc] && G.g[r][cc - 1] === G.g[r][cc] ? G.g[r][cc] : null;
        if (cv) { if (seen2.indexOf(cv) < 0) { cv.td.setAttribute('colspan', cv.cs + 1); seen2.push(cv); } continue; }
        var own = G.g[r][cc - 1] || G.g[r][cc]; if (G.g[r][cc] && G.g[r][cc].r < r) continue; if (!G.g[r][cc] && G.g[r][cc - 1] && G.g[r][cc - 1].r < r) continue;
        var nc = newCell(tb.rows[r].cells[0] && tb.rows[r].cells[0].tagName === 'TH' && r === 0 ? 'th' : 'td'), tr2 = tb.rows[r], before = null;
        if (cc < G.nc && G.g[r][cc] && G.g[r][cc].r === r) before = G.g[r][cc].td; else { for (var k = cc; k < G.nc; k++) if (G.g[r][k] && G.g[r][k].r === r) { before = G.g[r][k].td; break; } }
        tr2.insertBefore(nc, before);
      }
    } else if (op === 'delRow') {
      if (G.cells.some(function (x) { return x.rs > 1 && x.r <= me.r && x.r + x.rs > me.r; }) || me.rs > 1) { toast('الصف يحوي خلايا مدموجة: افصل الدمج أولاً.'); return; }
      if (G.nr <= 1) { toast('لا يمكن حذف الصف الوحيد؛ احذف الجدول بدلاً من ذلك.'); return; }
      tb.rows[me.r].remove();
    } else if (op === 'delCol') {
      if (G.cells.some(function (x) { return x.cs > 1 && x.c <= me.c && x.c + x.cs > me.c; })) { toast('العمود يحوي خلايا مدموجة: افصل الدمج أولاً.'); return; }
      if (G.nc <= 1) { toast('لا يمكن حذف العمود الوحيد؛ احذف الجدول بدلاً من ذلك.'); return; }
      G.cells.forEach(function (x) { if (x.c === me.c) x.td.remove(); });
    } else if (op === 'mergeR') {
      var nx = G.g[me.r][me.c + me.cs]; if (!nx || nx.r !== me.r || nx.rs !== me.rs) { toast('لا توجد خلية مجاورة مناسبة للدمج.'); return; }
      if (nx.td.textContent.trim()) td.innerHTML += ' ' + nx.td.innerHTML; td.setAttribute('colspan', me.cs + nx.cs); nx.td.remove();
    } else if (op === 'mergeD') {
      var bl = G.g[me.r + me.rs] && G.g[me.r + me.rs][me.c]; if (!bl || bl.c !== me.c || bl.cs !== me.cs) { toast('لا توجد خلية أسفلها مناسبة للدمج.'); return; }
      if (bl.td.textContent.trim()) td.innerHTML += ' ' + bl.td.innerHTML; td.setAttribute('rowspan', me.rs + bl.rs); bl.td.remove();
    } else if (op === 'split') {
      if (me.cs === 1 && me.rs === 1) { toast('هذه الخلية غير مدموجة.'); return; }
      td.removeAttribute('colspan'); td.removeAttribute('rowspan');
      for (var rr = me.r; rr < me.r + me.rs; rr++) for (var c2 = me.c; c2 < me.c + me.cs; c2++) {
        if (rr === me.r && c2 === me.c) continue;
        var tr3 = tb.rows[rr], ins = null; for (var k2 = c2 + 1; k2 < G.nc; k2++) { var o = G.g[rr][k2]; if (o && o.r === rr && o !== me) { ins = o.td; break; } }
        tr3.insertBefore(newCell(), ins);
      }
    } else if (op === 'width') {
      var pc = parseFloat(val); if (!(pc > 0 && pc <= 100)) { toast('اكتب نسبة بين 1 و100.'); return; }
      G.cells.forEach(function (x) { if (x.c === me.c && x.cs === 1) x.td.style.width = pc + '%'; }); tb.setAttribute('data-fixed', '1');
    } else if (op === 'border') { tb.setAttribute('data-b', val); }
    else if (op === 'caption') {
      var cp = tb.querySelector('caption'); if (!cp) { cp = document.createElement('caption'); tb.insertBefore(cp, tb.firstChild); } cp.textContent = val; if (!val) cp.remove();
    } else if (op === 'del') { tb.remove(); if (!ed.children.length) ed.innerHTML = '<p><br></p>'; }
    else if (op === 'up' || op === 'down') { var sib = op === 'up' ? tb.previousElementSibling : tb.nextElementSibling; if (!sib) return; if (op === 'up') ed.insertBefore(tb, sib); else ed.insertBefore(sib, tb); }
    else if (op === 'head') { var firstRow = tb.rows[0]; Array.prototype.forEach.call(firstRow.cells, function (c) { var isH = c.tagName === 'TH', n = document.createElement(isH ? 'td' : 'th'); Array.prototype.slice.call(c.attributes).forEach(function (a) { n.setAttribute(a.name, a.value); }); n.innerHTML = c.innerHTML; c.parentNode.replaceChild(n, c); }); }
    commitDeb(); updateTableBar();
  }
  function updateTableBar() {
    var bar = $('#rsTbl'); if (!bar) return; var td = curCell();
    if (!td) { bar.hidden = true; return; }
    var tb = td.closest('table'), cp = tb.querySelector('caption');
    if (bar.dataset.for === 'on' && !bar.hidden) { var ci = bar.querySelector('#tbCap'); if (ci && document.activeElement !== ci) ci.value = cp ? cp.textContent : ''; return; }
    bar.hidden = false; bar.dataset.for = 'on';
    function tb_(op, t) { return '<button type="button" class="rs-b txt" data-tbl="' + op + '">' + t + '</button>'; }
    bar.innerHTML = '<span class="rs-tlab">الجدول:</span>' + tb_('rowBefore', 'صف قبل') + tb_('rowAfter', 'صف بعد') + tb_('colBefore', 'عمود قبل') + tb_('colAfter', 'عمود بعد') + tb_('delRow', 'حذف الصف') + tb_('delCol', 'حذف العمود') + tb_('mergeR', 'دمج مع المجاورة') + tb_('mergeD', 'دمج مع السفلية') + tb_('split', 'فصل الدمج') + tb_('head', 'صف العناوين') +
      '<input class="rs-s sm" id="tbW" inputmode="decimal" placeholder="عرض العمود %" aria-label="عرض العمود بالنسبة المئوية"><select class="rs-s sm" id="tbBorder" aria-label="الحدود"><option value="1">حدود رفيعة</option><option value="2">حدود سميكة</option><option value="0">بلا حدود</option></select><input class="rs-s" id="tbCap" placeholder="عنوان الجدول (يُرقَّم تلقائياً)" aria-label="عنوان الجدول" value="' + esc(cp ? cp.textContent : '') + '">' + tb_('del', 'حذف الجدول') + tb_('up', '↑ نقل') + tb_('down', '↓ نقل');
    var bs = bar.querySelector('#tbBorder'); bs.value = tb.getAttribute('data-b') || '1';
  }

  /* ---- بحث واستبدال ---- */
  function textMap(ed) {
    var w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentNode.closest('figure,[data-pgbrk]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), arr = [], pos = 0, full = '';
    while (w.nextNode()) { var n = w.currentNode; arr.push({ n: n, s: pos }); full += n.nodeValue; pos += n.nodeValue.length; }
    return { arr: arr, full: full };
  }
  function findIn(dir) {
    var ed = $('#rsEd'), q = ($('#fqF') || {}).value || ''; if (!q) { toast('اكتب النص المراد البحث عنه.'); return false; }
    var cs = $('#fqC') && $('#fqC').checked, tm = textMap(ed), full = cs ? tm.full : tm.full.toLowerCase(), needle = cs ? q : q.toLowerCase();
    var sel = getSelection(), start = 0;
    if (sel.rangeCount && ed.contains(sel.anchorNode)) { var r = sel.getRangeAt(0); tm.arr.forEach(function (a) { if (a.n === (dir > 0 ? r.endContainer : r.startContainer)) start = a.s + (dir > 0 ? r.endOffset : r.startOffset); }); }
    var i = dir > 0 ? full.indexOf(needle, start) : full.lastIndexOf(needle, Math.max(0, start - needle.length - 1));
    if (i < 0 && dir > 0) i = full.indexOf(needle); if (i < 0 && dir < 0) i = full.lastIndexOf(needle);
    var cnt = full.split(needle).length - 1; var ce = $('#fqCnt'); if (ce) ce.textContent = cnt ? cnt + ' نتيجة' : 'لا نتائج';
    if (i < 0) return false;
    function locate(off) { for (var k = tm.arr.length - 1; k >= 0; k--) if (tm.arr[k].s <= off) return { n: tm.arr[k].n, o: off - tm.arr[k].s }; }
    var a = locate(i), b = locate(i + needle.length - 1); var rg = document.createRange(); rg.setStart(a.n, a.o); rg.setEnd(b.n, b.o + 1);
    sel.removeAllRanges(); sel.addRange(rg); S.range = rg.cloneRange(); (a.n.parentNode.scrollIntoView || function () {}).call(a.n.parentNode, { block: 'center' }); return true;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  UI.replaceInHtml = function (html, q, rep, cs) {
    var d = new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + html + '</body></html>', 'text/html'), n = 0, re = new RegExp(escRe(q), cs ? 'g' : 'gi');
    var w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT, null), arr = []; while (w.nextNode()) arr.push(w.currentNode);
    arr.forEach(function (t) { if (t.parentNode.closest && t.parentNode.closest('.rs-cite')) return; var v = t.nodeValue; var m = v.match(re); if (m) { n += m.length; t.nodeValue = v.replace(re, function () { return rep; }); } });
    return { html: d.body.innerHTML, n: n };
  };
  function findPanel() {
    var f = $('#rsFind'); if (!f) return; S.findOpen = !S.findOpen; f.hidden = !S.findOpen;
    if (!S.findOpen) return;
    f.innerHTML = '<div class="rs-fp"><input class="tl-in" id="fqF" placeholder="بحث عن…"><input class="tl-in" id="fqR" placeholder="استبدال بـ…"><label class="rs-chk"><input type="checkbox" id="fqC"> مطابقة حالة الأحرف</label><span id="fqCnt" class="tl-hint"></span><div class="rs-btns"><button type="button" class="tl-btn sm" data-act="fnext">التالي</button><button type="button" class="tl-btn sm" data-act="fprev">السابق</button><button type="button" class="tl-btn sm" data-act="frep">استبدال</button><button type="button" class="tl-btn sm" data-act="frepall">استبدال الكل في القسم</button><button type="button" class="tl-btn sm" data-act="frepdoc">استبدال في كل البحث</button><button type="button" class="tl-btn sm" data-act="fclose">إغلاق</button></div></div>';
    var sel = getSelection(); if (sel.rangeCount && !sel.isCollapsed && $('#rsEd').contains(sel.anchorNode)) $('#fqF').value = sel.toString().slice(0, 100); $('#fqF').focus();
  }

  /* ---- الأقسام: عمليات ---- */
  function addSectionDialog() {
    var p = S.paper, nt = M.numberTree(p), selRec = nt.map[S.selId];
    var def = selRec ? M.nextType(selRec.type) : (p.body.length && p.body[0].type !== 'chapter' ? p.body[0].type : 'chapter');
    var m = openModal('<h3>إضافة قسم</h3><label class="tl-lbl">نوع العنوان</label><select class="tl-sel" id="asT">' + M.TYPES.map(function (t) { return '<option value="' + t.k + '"' + (t.k === def ? ' selected' : '') + '>' + t.n + '</option>'; }).join('') + '</select><label class="tl-lbl">العنوان (يمكن تركه فارغاً)</label><input class="tl-in" id="asN" maxlength="300"><label class="tl-lbl">الموضع</label><select class="tl-sel" id="asP"><option value="end">في نهاية المتن (مستوى أعلى)</option>' + (selRec ? '<option value="child" selected>داخل «' + esc(selRec.text) + '»</option><option value="after">بعد «' + esc(selRec.text) + '» (نفس المستوى)</option>' : '') + '</select><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>إضافة</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>');
    m.el.querySelector('[data-ok]').addEventListener('click', function () {
      var sec = M.newSection($('#asT', m.el).value, $('#asN', m.el).value.trim(), ''), pos = $('#asP', m.el).value;
      if (pos === 'child' && selRec) selRec.sec.children.push(sec);
      else if (pos === 'after' && selRec) { var f = M.findSec(p, selRec.id); f.arr.splice(f.idx + 1, 0, sec); }
      else p.body.push(sec);
      m.close(); markDirty(); S.selId = sec.id; refreshSide(); loadSection(sec.id);
    });
  }
  function secOp(op) {
    var p = S.paper, id = S.selId, f = M.findSec(p, id); if (!f) return;
    if (op === 'up' || op === 'dn') { var j = f.idx + (op === 'up' ? -1 : 1); if (j < 0 || j >= f.arr.length) return; var t = f.arr[j]; f.arr[j] = f.arr[f.idx]; f.arr[f.idx] = t; }
    else if (op === 'in') { if (f.idx === 0) { toast('لا يوجد قسم سابق لإدخاله تحته.'); return; } var prev = f.arr[f.idx - 1]; f.arr.splice(f.idx, 1); prev.children.push(f.sec); prev.collapsed = false; }
    else if (op === 'out') { if (!f.parent) { toast('هذا القسم في المستوى الأعلى.'); return; } var gp = M.findSec(p, f.parent.id); f.arr.splice(f.idx, 1); gp.arr.splice(gp.idx + 1, 0, f.sec); }
    else if (op === 'dup') {
      var cl = function (s) { var n = M.newSection(s.type, s.title, s.html); n.children = s.children.map(cl); return n; }, copy = cl(f.sec); copy.title = copy.title ? copy.title + ' (نسخة)' : '';
      var idm = {}; (function mp(a, b) { idm[a.id] = b.id; a.children.forEach(function (c, i) { mp(c, b.children[i]); }); })(f.sec, copy);
      (p.figs || []).slice().forEach(function (fg) { if (fg.place && idm[fg.place.sectionId]) { var nf = U.clone(fg); nf.id = U.uid(); nf.place.sectionId = idm[fg.place.sectionId]; p.figs.push(nf); } });
      f.arr.splice(f.idx + 1, 0, copy); S.selId = copy.id;
    } else if (op === 'del') {
      var cnt = 0; (function c(s) { cnt += U.countWords(U.textOf(s.html)); s.children.forEach(c); })(f.sec);
      var ids = []; (function c2(s) { ids.push(s.id); s.children.forEach(c2); })(f.sec);
      var fgs = (p.figs || []).filter(function (g) { return g.place && ids.indexOf(g.place.sectionId) >= 0; }).length;
      confirmBox('سيُحذف القسم «' + (M.numberTree(p).map[id].text) + '» مع أقسامه الفرعية' + (cnt ? ' (' + cnt + ' كلمة)' : '') + (fgs ? '، وستُفصل ' + fgs + ' صورة عن مكانها' : '') + '. لا يمكن التراجع إلا عبر نقطة استعادة. المتابعة؟', 'حذف', true).then(function (ok) {
        if (!ok) return; makeSnap('قبل حذف قسم', false);
        (p.figs || []).forEach(function (g) { if (g.place && ids.indexOf(g.place.sectionId) >= 0) g.place = null; });
        f.arr.splice(f.idx, 1); S.selId = 'intro'; markDirty(); refreshSide(); loadSection('intro');
      }); return;
    }
    markDirty(); refreshSide(); loadSection(S.selId);
  }
  function moveDialog() {
    var p = S.paper, nt = M.numberTree(p), me = nt.map[S.selId]; if (!me) return;
    var opts = nt.flat.filter(function (r) { return r.path.indexOf(S.selId) < 0; });
    var m = openModal('<h3>نقل القسم</h3><p class="rs-p">انقل «' + esc(me.text) + '» إلى:</p><label class="tl-lbl">القسم الهدف</label><select class="tl-sel" id="mvT"><option value="">— المستوى الأعلى —</option>' + opts.map(function (r) { return '<option value="' + r.id + '">' + '— '.repeat(r.depth) + esc(r.text) + '</option>'; }).join('') + '</select><label class="tl-lbl">الموضع بالنسبة له</label><select class="tl-sel" id="mvP"><option value="in">داخله (آخر فرع)</option><option value="before">قبله</option><option value="after">بعده</option></select><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>نقل</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>');
    m.el.querySelector('[data-ok]').addEventListener('click', function () {
      var tid = $('#mvT', m.el).value, pos = $('#mvP', m.el).value, f = M.findSec(p, S.selId); f.arr.splice(f.idx, 1);
      if (!tid) p.body.push(f.sec); else { var t = M.findSec(p, tid); if (pos === 'in') { t.sec.children.push(f.sec); t.sec.collapsed = false; } else t.arr.splice(t.idx + (pos === 'after' ? 1 : 0), 0, f.sec); }
      m.close(); markDirty(); refreshSide(); loadSection(S.selId);
    });
  }
  /* سحب وإفلات (فأرة ولمس) بمقبض ⋮⋮ */
  function startDrag(e, id) {
    e.preventDefault(); var p = S.paper, f0 = M.findSec(p, id); if (!f0) return;
    var ghost = document.createElement('div'); ghost.className = 'rs-ghost'; ghost.textContent = M.numberTree(p).map[id].text; document.body.appendChild(ghost);
    var ind = document.createElement('div'), target = null; ind.className = 'rs-dind'; document.body.appendChild(ind);
    function mv(ev) {
      ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 6 + 'px'; ghost.style.pointerEvents = 'none';
      var el = document.elementFromPoint(ev.clientX, ev.clientY), row = el && el.closest ? el.closest('.rs-nrow[data-id]') : null; target = null; ind.style.display = 'none';
      if (!row || row.classList.contains('fixed')) return; var tid = row.dataset.id; if (tid === id) return;
      var ids = []; (function c(s) { ids.push(s.id); s.children.forEach(c); })(f0.sec); if (ids.indexOf(tid) >= 0) return;
      var rc = row.getBoundingClientRect(), y = (ev.clientY - rc.top) / rc.height, z = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'in';
      target = { id: tid, z: z }; ind.style.display = 'block'; ind.style.left = rc.left + 'px'; ind.style.width = rc.width + 'px';
      if (z === 'in') { ind.style.top = rc.top + 'px'; ind.style.height = rc.height + 'px'; ind.className = 'rs-dind in'; } else { ind.className = 'rs-dind'; ind.style.height = '3px'; ind.style.top = (z === 'before' ? rc.top : rc.bottom) - 1 + 'px'; }
    }
    function up() {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); ghost.remove(); ind.remove();
      if (!target) return; var f = M.findSec(p, id); f.arr.splice(f.idx, 1); var t = M.findSec(p, target.id);
      if (target.z === 'in') { t.sec.children.push(f.sec); t.sec.collapsed = false; } else t.arr.splice(t.idx + (target.z === 'after' ? 1 : 0), 0, f.sec);
      markDirty(); refreshSide(); loadSection(S.selId);
    }
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up); mv(e);
  }

  /* ---------------- النسخ الاحتياطي (تصدير/استيراد) ---------------- */
  UI.exportBackup = function (pid) {
    return Promise.all([D.get('papers', pid), D.byPaper('images', pid)]).then(function (r) {
      var p = r[0]; if (!p) return; var blob = RS.exp.backup(p, r[1]), d = new Date();
      U.download(blob, 'نسخة-' + U.safeName(p.title) + '-' + d.getFullYear() + U.pad(d.getMonth() + 1) + U.pad(d.getDate()) + '-' + U.pad(d.getHours()) + U.pad(d.getMinutes()) + '.research.json');
      toast('تم تنزيل النسخة الاحتياطية.');
    });
  };
  UI.importFile = function (f) {
    if (f.size > 120 * 1024 * 1024) { toast('الملف كبير جداً.'); return; }
    var fr = new FileReader(); fr.onerror = function () { toast('تعذّرت قراءة الملف.'); };
    fr.onload = function () {
      var r = RS.exp.parseBackup(fr.result); if (!r.ok) { openModal('<h3>تعذّر الاستيراد</h3><p class="rs-p">' + esc(r.msg) + '</p><div class="rs-btns"><button type="button" class="tl-btn" data-close>حسناً</button></div>'); return; }
      var i = r.info, m = openModal('<h3>استيراد نسخة احتياطية</h3><p class="rs-p">تم التحقق من سلامة الملف.<br>البحث: <b>' + esc(i.title) + '</b><br>تاريخ إنشاء النسخة: ' + (i.created ? U.fmtDT(i.created) : 'غير معروف') + '<br>الأقسام: ' + i.sections + ' · المراجع: ' + i.refs + ' · الصور: ' + i.figs + '</p><p class="tl-hint">سيُضاف كبحث جديد ولن يستبدل أي بحث موجود.</p><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>استيراد</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>');
      m.el.querySelector('[data-ok]').addEventListener('click', function () {
        r.paper.title = r.paper.title + ' (مستورد)'; r.paper.modified = Date.now();
        Promise.all([D.put('papers', r.paper)].concat(r.images.map(function (im) { return D.put('images', im); }))).then(function () { m.close(); toast('تم الاستيراد.'); UI.showList(); }).catch(function () { toast('تعذّر الحفظ: المساحة غير كافية.', 5000); });
      });
    };
    fr.readAsText(f);
  };

  /* ================================================================ الأحداث */
  function onClick(e) {
    var t = e.target.closest('[data-act],[data-cmd],[data-tbl]'); if (!t) return;
    if (t.dataset.cmd) { e.preventDefault(); var c = t.dataset.cmd; if (c === 'link') linkDialog(); else if (c === 'table') RS.ui2.tableDialog(); else if (c === 'image') RS.ui2.imageDialog(); else if (c === 'cite') RS.ui2.citeDialog(); else if (c === 'pgbrk') { var d = document.createElement('div'); d.className = 'rs-pgbrk'; d.setAttribute('data-pgbrk', '1'); d.setAttribute('contenteditable', 'false'); UI.insertBlockAfterCaret(d); } else if (c === 'find') findPanel(); else if (c === 'nums') { S.nums = !S.nums; $('#rsEd').classList.toggle('nums', S.nums); t.classList.toggle('on', S.nums); } else execCmd(c); return; }
    if (t.dataset.tbl) { e.preventDefault(); var op = t.dataset.tbl; tableOp(op); return; }
    var a = t.dataset.act, pid = (e.target.closest('[data-pid]') || {}).dataset ? (e.target.closest('[data-pid]').dataset.pid) : null;
    switch (a) {
      case 'new': UI.showNew(); break;
      case 'import': $('#rsImport').click(); break;
      case 'tolist': UI.showList(); break;
      case 'tpl': draft.tpl = t.dataset.t; $('#rsTpls').innerHTML = tplChips(draft.tpl); tplDesc(); break;
      case 'create': createFromDraft(); break;
      case 'addstu': if (S.paper) { S.paper.meta.students.push(''); $('#rsStu').insertAdjacentHTML('beforeend', stuRow('', S.paper.meta.students.length - 1)); markDirty(); } else { draft.meta.students.push(''); $('#rsStu').insertAdjacentHTML('beforeend', stuRow('', draft.meta.students.length - 1)); } break;
      case 'delstu': { var arr = (S.paper || draft).meta.students; arr.splice(+t.dataset.i, 1); if (!arr.length) arr.push(''); $('#rsStu').innerHTML = arr.map(stuRow).join(''); if (S.paper) markDirty(); break; }
      case 'addextra': { var m0 = (S.paper || draft).meta; m0.extra = m0.extra || []; m0.extra.push({ k: '', v: '' }); $('#rsExtra').innerHTML = m0.extra.map(extraRow).join(''); if (S.paper) markDirty(); break; }
      case 'delextra': { var m1 = (S.paper || draft).meta; m1.extra.splice(+t.dataset.i, 1); $('#rsExtra').innerHTML = m1.extra.map(extraRow).join(''); if (S.paper) markDirty(); break; }
      case 'openp': UI.openPaper(pid, 'edit'); break;
      case 'renp': D.get('papers', pid).then(function (p) { promptBox('إعادة تسمية البحث', 'الاسم الجديد', p.title).then(function (v) { if (!v) return; p.title = v; p.meta.title = p.meta.title || v; p.modified = Date.now(); D.put('papers', p).then(renderList); }); }); break;
      case 'dupp': Promise.all([D.get('papers', pid), D.byPaper('images', pid)]).then(function (r) {
        var p = U.clone(r[0]), np = p, oldId = p.id; np.id = U.uid(); np.title = p.title + ' (نسخة)'; np.created = np.modified = Date.now();
        return D.put('papers', np).then(function () { return Promise.all(r[1].map(function (im) { var c = U.clone(im); c.paperId = np.id; return D.put('images', c); })); }).then(renderList).then(function () { toast('تم إنشاء نسخة من البحث.'); });
      }).catch(function () { toast('تعذّر إنشاء النسخة (المساحة؟).'); }); break;
      case 'bakp': UI.exportBackup(pid); break;
      case 'delp': D.get('papers', pid).then(function (p) { confirmBox('سيُحذف البحث «' + p.title + '» نهائياً مع صوره ونقاط استعادته من هذا الجهاز. يُنصح بتصدير نسخة احتياطية أولاً. المتابعة؟', 'حذف نهائي', true).then(function (ok) { if (ok) D.delPaper(pid).then(renderList); }); }); break;
      case 'tab': commitEditor(); S.tab = t.dataset.t; renderTab(); break;
      case 'savenow': UI.saveNow().then(function () { toast('تم حفظ البحث.'); }); break;
      case 'selsec': if (e.target.closest('[data-grip],[data-act="togsec"]')) break; commitEditor(); S.selId = t.dataset.id; refreshSide(); loadSection(S.selId); if (innerWidth < 900) { var sw = $('#rsSideW'); if (sw) sw.classList.remove('open'); } break;
      case 'togsec': { e.stopPropagation(); var f = M.findSec(S.paper, t.dataset.id); f.sec.collapsed = !f.sec.collapsed; markDirty(); refreshSide(); break; }
      case 'togside': $('#rsSideW').classList.toggle('open'); break;
      case 'addsec': commitEditor(); addSectionDialog(); break;
      case 'secup': commitEditor(); secOp('up'); break; case 'secdn': commitEditor(); secOp('dn'); break; case 'secin': commitEditor(); secOp('in'); break; case 'secout': commitEditor(); secOp('out'); break;
      case 'secdup': commitEditor(); secOp('dup'); break; case 'secdel': commitEditor(); secOp('del'); break; case 'secmove': commitEditor(); moveDialog(); break;
      case 'togsplit': S.split = !S.split; renderTab(); break;
      case 'fnext': findIn(1); break; case 'fprev': findIn(-1); break; case 'fclose': findPanel(); break;
      case 'frep': { var sel = getSelection(), q = $('#fqF').value; if (sel.rangeCount && q && (sel.toString().toLowerCase() === q.toLowerCase())) { restoreRange(); document.execCommand('insertText', false, $('#fqR').value); commitDeb(); } findIn(1); break; }
      case 'frepall': { commitEditor(); var q2 = $('#fqF').value; if (!q2) break; var r2 = UI.replaceInHtml(curHtml(), q2, $('#fqR').value, $('#fqC').checked); if (r2.n) { setHtml(H.clean(r2.html)); markDirty(); loadSection(S.selId); } toast(r2.n ? 'تم استبدال ' + r2.n + ' موضع.' : 'لا توجد نتائج.'); break; }
      case 'frepdoc': { commitEditor(); var q3 = $('#fqF').value; if (!q3) break; confirmBox('سيتم الاستبدال في كل أقسام البحث (المقدمة والمتن والخاتمة). المتابعة؟', 'استبدال').then(function (ok) { if (!ok) return; makeSnap('قبل استبدال شامل', false); var tot = 0; M.allHtmlHolders(S.paper).forEach(function (h) { var r3 = UI.replaceInHtml(h.html || '', q3, $('#fqR').value, $('#fqC').checked); if (r3.n) { h.html = H.clean(r3.html); tot += r3.n; } }); if (tot) markDirty(); loadSection(S.selId); toast(tot ? 'تم استبدال ' + tot + ' موضع.' : 'لا توجد نتائج.'); }); break; }
      case 'editfig': RS.ui2.imageDialog(t.dataset.fid); break;
      default: if (RS.ui2 && RS.ui2.act) RS.ui2.act(a, t, e);
    }
  }
  function onChange(e) {
    var t = e.target;
    if (t.id === 'rsSort') { listState.sort = t.value; renderList(); return; }
    if (t.dataset.act === 'status') { var pid = t.closest('[data-pid]').dataset.pid; D.get('papers', pid).then(function (p) { p.status = t.value; p.modified = Date.now(); D.put('papers', p); }); return; }
    if (t.id === 'tbFont') { if (t.value) execCmd('fontName', t.value); t.value = ''; return; }
    if (t.id === 'tbSize') { if (t.value) execCmd('fontSize', t.value); t.value = ''; return; }
    if (t.id === 'tbColor') { execCmd('foreColor', t.value); return; }
    if (t.id === 'tbHl') { execCmd('hiliteColor', t.value); return; }
    if (t.id === 'tbHead') { execCmd('formatBlock', t.value); return; }
    if (t.id === 'tbLh') { if (t.value) { restoreRange(); applyBlockStyle('lineHeight', t.value); } t.value = ''; return; }
    if (t.id === 'tbPg') { if (t.value !== '') { restoreRange(); applyBlockStyle('marginTop', t.value + 'pt'); } t.value = ''; return; }
    if (t.id === 'tbBorder') { tableOp('border', t.value); return; }
    if (t.id === 'tbW') { tableOp('width', t.value); t.value = ''; return; }
    if (t.id === 'tbCap') { tableOp('caption', t.value.trim()); return; }
    if (t.id === 'secType') { var f = M.findSec(S.paper, S.selId); if (f) { f.sec.type = t.value; markDirty(); refreshSide(); renderEdHead(); } return; }
    if (RS.ui2 && RS.ui2.change) RS.ui2.change(e);
  }
  function onInput(e) {
    var t = e.target;
    if (t.id === 'rsQ') { listState.q = t.value; renderList(); return; }
    if (t.id === 'rsEd' || (t.closest && t.closest('#rsEd'))) { commitDeb(); return; }
    if (t.id === 'secTitle') { var f = M.findSec(S.paper, S.selId); if (f) { f.sec.title = t.value; markDirty(); var row = $('.rs-nrow[data-id="' + S.selId + '"] .rs-nt'); if (row) row.textContent = M.numberTree(S.paper).map[S.selId].text; } return; }
    var m = t.dataset && t.dataset.meta;
    if (m !== undefined) { var tgt = (S.paper || draft).meta; tgt[m] = t.value; t.classList.remove('bad'); if (S.paper) { if (m === 'title') { S.paper.title = t.value || 'بحث بدون عنوان'; var wt = $('#rsWT'); if (wt) wt.textContent = S.paper.title; } markDirty(); } return; }
    if (t.dataset && t.dataset.stu !== undefined) { (S.paper || draft).meta.students[+t.dataset.stu] = t.value; if (S.paper) markDirty(); return; }
    if (t.dataset && (t.dataset.exk !== undefined || t.dataset.exv !== undefined)) { var mm = (S.paper || draft).meta; if (t.dataset.exk !== undefined) mm.extra[+t.dataset.exk].k = t.value; else mm.extra[+t.dataset.exv].v = t.value; if (S.paper) markDirty(); return; }
    if (RS.ui2 && RS.ui2.input) RS.ui2.input(e);
  }
  /* لصق آمن + سحب المقبض + اختصارات */
  document.addEventListener('paste', function (e) {
    var ed = root && $('#rsEd'); if (!ed || !ed.contains(e.target)) return;
    var cd = e.clipboardData; if (!cd) return; e.preventDefault();
    var html = cd.getData('text/html'), txt = cd.getData('text/plain'), out;
    if (html) { out = H.clean(html); var m = /^<p>([\s\S]*)<\/p>$/.exec(out); if (m && out.indexOf('<p', 3) < 0) out = m[1]; }
    else out = esc(txt).replace(/\r?\n/g, '<br>');
    document.execCommand('insertHTML', false, out); commitDeb();
  });
  document.addEventListener('pointerdown', function (e) { var g = e.target.closest && e.target.closest('[data-grip]'); if (g && root && root.contains(g)) startDrag(e, g.dataset.grip); });
  document.addEventListener('keydown', function (e) {
    var ed = root && $('#rsEd'); if (!ed) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.paper) { e.preventDefault(); UI.saveNow().then(function () { toast('تم حفظ البحث.'); }); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && ed.contains(document.activeElement)) { e.preventDefault(); if (!S.findOpen) findPanel(); else $('#fqF').focus(); }
    if (e.key === 'Tab' && ed.contains(document.activeElement) && curCell()) { e.preventDefault(); var td = curCell(), nx = e.shiftKey ? td.previousElementSibling : td.nextElementSibling; if (!nx) { var tr = td.parentNode, ntr = e.shiftKey ? tr.previousElementSibling : tr.nextElementSibling; if (ntr) nx = e.shiftKey ? ntr.lastElementChild : ntr.firstElementChild; } if (nx) { var r = document.createRange(); r.selectNodeContents(nx); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
  });
  function linkDialog() {
    restoreRange(); var m = openModal('<h3>إدراج رابط</h3><label class="tl-lbl">العنوان (يبدأ بـ https://)</label><input class="tl-in" id="lkU" dir="ltr" placeholder="https://"><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>إدراج</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>');
    m.el.querySelector('[data-ok]').addEventListener('click', function () {
      var u = $('#lkU', m.el).value.trim(); if (!/^(https?:\/\/|mailto:)/i.test(u)) { toast('اكتب رابطاً صحيحاً يبدأ بـ https://'); return; }
      m.close(); restoreRange(); var s = getSelection();
      if (s.isCollapsed) document.execCommand('insertHTML', false, '<a href="' + esc(u) + '">' + esc(u) + '</a>'); else document.execCommand('createLink', false, u); commitDeb();
    });
  }
  /* واجهات مشتركة للملف الثاني */
  UI.getPaper = function () { return S.paper; };
  UI.refreshSide = refreshSide; UI.loadSection = loadSection; UI.restoreRange = restoreRange; UI.curHtml = curHtml; UI.setHtml = setHtml; UI.reloadEditor = function () { if (S.tab === 'edit') loadSection(S.selId); };
  UI.openModalApi = openModal; UI.escRe = escRe;
})();
