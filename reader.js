/* ==========================================================================
   reader.js — القارئ الأكاديمي التفاعلي (محلي 100% ودون إنترنت)
   - يفتح ملفات PDF من جهاز المستخدم ويعالجها محلياً عبر PDF.js و pdf-lib
   - التظليلات (5 ألوان) والتعليقات الموضعية محفوظة بإحداثيات مطبّعة [0..1]
     لتظل دقيقة وثابتة عند أي تكبير أو تغيير حجم شاشة أو على الهاتف
   - حفظ تلقائي لآخر موضع قراءة + دفتر ملاحظات + تصدير TXT و PDF ونسخة PDF مظلّلة
   ========================================================================== */
(function () {
  'use strict';

  var S = window.PDFShared;
  var ST = window.ReaderStore;
  var EX = window.ReaderExport;

  function ic(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  var I = {
    upload: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    book: ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    search: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    moon: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    bookmark: ic('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>'),
    thumbs: ic('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    panel: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>'),
    prev: ic('<path d="m9 18 6-6-6-6"/>'),
    next: ic('<path d="m15 18-6-6 6-6"/>'),
    zoomIn: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>'),
    zoomOut: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>'),
    fitW: ic('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    hl: ic('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
    pin: ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    close: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    refresh: ic('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>')
  };

  var st = {
    root: null,
    mode: 'library', /* library | reading */
    offlineState: 'checking', /* checking | ready | partial | busy | error */
    offlineMsg: 'جارٍ فحص جاهزية العمل دون إنترنت…',
    recentFiles: [],
    relinkTargetId: null,

    pdfjs: null,
    pdfDoc: null,
    rawBytes: null,
    fileMeta: null,
    bundle: { annotations: [], notes: [], bookmarks: [] },

    page: 1,
    numPages: 0,
    zoomMode: 'fit-width', /* fit-width | fit-page | custom */
    zoomScale: 1,
    renderedScale: 1,
    nightMode: false,

    activeColor: 'yellow',
    activeTool: 'select', /* select | box-hl | pin */
    showThumbs: false,
    showSide: false,
    sideTab: 'notebook', /* notebook | page-note | bookmarks | export */
    nbFilter: 'all',

    showSearch: false,
    searchQuery: '',
    searchBusy: false,
    searchMatches: [],
    searchIdx: -1,
    textCache: Object.create(null),

    pendingSel: null,
    flashAnnId: '',
    busyExport: false,
    pageRenderTask: null,
    pageTextLayer: null,
    thumbObserver: null,
    saveStateTimer: 0,
    saveNoteTimer: 0
  };

  var toastEl = null;
  var toastTimer = 0;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ar-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2400);
  }

  function copyText(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  /* ---------- فحص وتدفئة موارد الأوفلاين ---------- */
  var READER_OFFLINE_ASSETS = [
    './pdf-shared.js',
    './reader.css',
    './reader-store.js',
    './reader-export.js',
    './reader.js'
  ];

  async function refreshOfflineState() {
    st.offlineState = 'checking';
    st.offlineMsg = 'جارٍ فحص المكتبات المحلية…';
    if (st.mode === 'library') updateOfflineBanner();
    try {
      var res = await S.checkOfflineLibs(READER_OFFLINE_ASSETS);
      if (res.ready) {
        st.offlineState = 'ready';
        st.offlineMsg = 'جاهز 100% للعمل دون إنترنت (' + res.cached + '/' + res.total + ' ملفات محلية مخزّنة)';
      } else {
        st.offlineState = 'partial';
        st.offlineMsg = 'مخزّن جزئياً (' + res.cached + '/' + res.total + '). اضغط لتجهيز العمل الكامل دون إنترنت.';
      }
    } catch (e) {
      st.offlineState = 'partial';
      st.offlineMsg = 'تعذّر فحص الذاكرة المؤقتة؛ يعمل القارئ محلياً عبر موارد الموقع.';
    }
    if (st.mode === 'library') updateOfflineBanner();
  }

  async function warmOffline() {
    st.offlineState = 'busy';
    st.offlineMsg = 'جارٍ حفظ محرك القراءة للعمل دون إنترنت…';
    updateOfflineBanner();
    try {
      var res = await S.warmOfflineLibs(READER_OFFLINE_ASSETS);
      st.offlineState = res.ready ? 'ready' : 'partial';
      st.offlineMsg = res.ready
        ? 'تم حفظ كل مكتبات القارئ محلياً للعمل دون إنترنت ✓'
        : 'تم حفظ ' + res.cached + ' من ' + res.total + ' ملفات.';
      toast('تم تجهيز القارئ للعمل دون إنترنت ✓');
    } catch (e) {
      st.offlineState = 'error';
      st.offlineMsg = 'تعذّر حفظ بعض الموارد مؤقتاً: ' + (e && e.message ? e.message : '');
    }
    updateOfflineBanner();
  }

  function updateOfflineBanner() {
    if (!st.root) return;
    var box = st.root.querySelector('#arOfflineBox');
    if (!box) return;
    box.className = 'ar-offline-state ' + st.offlineState;
    box.querySelector('span').textContent = st.offlineMsg;
    var btn = st.root.querySelector('#arWarmBtn');
    if (btn) {
      btn.hidden = st.offlineState === 'ready';
      btn.disabled = st.offlineState === 'busy';
    }
  }

  /* ---------- عرض المكتبة (الشاشة الرئيسية للقارئ) ---------- */
  async function loadLibrary() {
    try {
      st.recentFiles = await ST.listRecentFiles();
    } catch (e) {
      st.recentFiles = [];
    }
    renderLibrary();
  }

  function renderLibrary() {
    if (!st.root) return;
    st.mode = 'library';
    st.root.classList.remove('ar-reading');

    var h = '';
    h += '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div>';
    h += '<h2 class="ptitle">القارئ الأكاديمي التفاعلي</h2>';
    h += '<div class="ar-home">';

    h += '<div class="ar-hero-card">';
    h += '<div class="ar-hero-top"><div><h3>اقرأ، ظلل، ودوّن ملاحظاتك محلياً</h3>';
    h += '<p class="ar-lead">افتح أي ملف PDF من جهازك مع دعم التظليل بخمسة ألوان، التعليقات الموضعية، ملاحظات كل صفحة، العلامات المرجعية، البحث في النصوص، القراءة الليلية، وتصدير نسخة PDF مظلّلة دون تعديل الملف الأصلي.</p>';
    h += '</div></div>';
    h += '<div class="ar-privacy">🔒 الخصوصية: جميع ملفاتك وتظليلاتك وتعليقاتك تُعالج وتُحفظ داخل متصفحك فقط، ولا يتم رفع أي مستند إلى أي خادم خارجي.</div>';
    h += '<div class="ar-offline-bar">';
    h += '<div class="ar-offline-state ' + st.offlineState + '" id="arOfflineBox"><i class="ar-dot"></i><div><strong>وضع العمل دون إنترنت</strong><span>' + S.esc(st.offlineMsg) + '</span></div></div>';
    h += '<button type="button" class="ar-btn sm pri" id="arWarmBtn"' + (st.offlineState === 'ready' ? ' hidden' : '') + '>تجهيز للأوفلاين</button>';
    h += '</div>';
    h += '</div>';

    h += '<div class="ar-card">';
    h += '<input type="file" id="arFileInput" accept=".pdf,application/pdf" hidden>';
    h += '<input type="file" id="arBackupInput" accept=".json,application/json" hidden>';
    h += '<label class="ar-dropzone" id="arDropZone" for="arFileInput" tabindex="0" role="button">';
    h += '<span class="ar-drop-ic">' + I.upload + '</span>';
    h += '<b>افتح ملف PDF من جهازك أو أسقطه هنا</b>';
    h += '<small>يدعم الهاتف والحاسوب • يستعيد تلقائياً موضع القراءة وتظليلاتك السابقة لنفس الملف حتى لو أعدت اختياره لاحقاً</small>';
    h += '</label>';
    h += '</div>';

    h += '<div class="ar-card">';
    h += '<div class="ar-card-head"><h3>الملفات المقروءة مؤخراً (' + st.recentFiles.length + ')</h3>';
    h += '<div class="ar-recent-acts">';
    h += '<button type="button" class="ar-btn sm" id="arExportBackupBtn">' + I.dl + '<span>نسخة احتياطية</span></button>';
    h += '<button type="button" class="ar-btn sm" id="arImportBackupBtn">' + I.upload + '<span>استعادة</span></button>';
    h += '</div></div>';

    if (!st.recentFiles.length) {
      h += '<p class="ar-empty">لم تفتح أي ملف PDF بعد. اختر ملفاً من الأعلى للبدء، وسيُحفظ هنا للعودة إليه بسرعة في أي وقت.</p>';
    } else {
      h += '<div class="ar-recents">';
      st.recentFiles.forEach(function (f) {
        var pct = f.pageCount ? Math.min(100, Math.round((f.lastPage || 1) * 100 / f.pageCount)) : 0;
        h += '<div class="ar-recent-item" data-fid="' + S.esc(f.id) + '">';
        h += '<div class="ar-recent-info"><b>' + S.esc(f.name) + '</b>';
        h += '<div class="ar-recent-meta">';
        h += '<span>صفحة ' + (f.lastPage || 1) + ' من ' + (f.pageCount || '—') + '</span>';
        if (f.size) h += '<span>' + S.formatBytes(f.size) + '</span>';
        h += '<span>تظليلات/تعليقات: ' + f.annCount + '</span>';
        h += '<span>ملاحظات: ' + f.noteCount + '</span>';
        h += '<span>علامات: ' + f.markCount + '</span>';
        if (f.lastOpenedAt) h += '<span>' + S.formatDateTime(f.lastOpenedAt) + '</span>';
        h += '</div>';
        if (f.pageCount) h += '<div class="ar-recent-prog"><i style="width:' + pct + '%"></i></div>';
        h += '</div>';
        h += '<div class="ar-recent-acts">';
        h += '<button type="button" class="ar-btn sm pri" data-act="open">' + (f.hasBlob ? 'متابعة القراءة' : 'ربط الملف من الجهاز') + '</button>';
        h += '<button type="button" class="ar-btn sm danger" data-act="del" aria-label="حذف من السجل">' + I.trash + '</button>';
        h += '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';

    st.root.innerHTML = h;
    bindLibraryEvents();
  }

  function bindLibraryEvents() {
    var fileIn = st.root.querySelector('#arFileInput');
    var dz = st.root.querySelector('#arDropZone');
    var warmBtn = st.root.querySelector('#arWarmBtn');
    var expBtn = st.root.querySelector('#arExportBackupBtn');
    var impBtn = st.root.querySelector('#arImportBackupBtn');
    var bkpIn = st.root.querySelector('#arBackupInput');

    if (warmBtn) warmBtn.onclick = warmOffline;

    if (fileIn) {
      fileIn.onchange = function () {
        var f = fileIn.files && fileIn.files[0];
        fileIn.value = '';
        if (f) handlePickedFile(f);
      };
    }

    if (dz) {
      dz.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn && fileIn.click(); }
      });
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.classList.remove('over');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handlePickedFile(f);
      });
    }

    st.root.querySelectorAll('.ar-recent-item').forEach(function (row) {
      var fid = row.dataset.fid;
      row.querySelector('[data-act="open"]').onclick = function () { openRecentById(fid); };
      row.querySelector('[data-act="del"]').onclick = async function () {
        if (!confirm('حذف هذا الملف وجميع تظليلاته وملاحظاته من القارئ؟ (لا يمس ملفك الأصلي على الجهاز)')) return;
        await ST.deleteFileAndData(fid);
        toast('تم الحذف من السجل');
        loadLibrary();
      };
    });

    if (expBtn) expBtn.onclick = openBackupModal;
    if (impBtn) impBtn.onclick = function () { bkpIn && bkpIn.click(); };
    if (bkpIn) {
      bkpIn.onchange = async function () {
        var f = bkpIn.files && bkpIn.files[0];
        bkpIn.value = '';
        if (!f) return;
        try {
          var txt = await f.text();
          var res = await ST.importBackup(txt);
          toast('تمت استعادة ' + res.files + ' ملف و ' + res.annotations + ' تظليل/تعليق');
          loadLibrary();
        } catch (err) {
          toast(err && err.message ? err.message : 'تعذّرت قراءة النسخة الاحتياطية', 3400);
        }
      };
    }
  }

  function openBackupModal() {
    openModal(
      '<h3>تصدير نسخة احتياطية محلية</h3>' +
      '<p style="font-size:13.5px;color:var(--muted);line-height:1.8">يمكنك حفظ جميع تظليلاتك وتعليقاتك وملاحظاتك وعلاماتك المرجعية في ملف JSON محلي لاستعادته على أي متصفح أو جهاز.</p>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;cursor:pointer">' +
      '<input type="checkbox" id="arBkpIncPdf"><span>تضمين ملفات PDF المحفوظة (حتى 25 م.ب للملف)</span></label>' +
      '<div class="ar-modal-acts">' +
      '<button type="button" class="ar-btn sm" data-mclose="1">إلغاء</button>' +
      '<button type="button" class="ar-btn sm pri" id="arBkpGo">تصدير JSON</button></div>',
      function (bg) {
        bg.querySelector('#arBkpGo').onclick = async function () {
          var inc = !!bg.querySelector('#arBkpIncPdf').checked;
          bg.querySelector('#arBkpGo').disabled = true;
          try {
            var data = await ST.exportBackup(inc);
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
            S.downloadBlob(blob, 'academic-reader-backup.json');
            closeModal();
            toast('تم تنزيل النسخة الاحتياطية');
          } catch (e) {
            closeModal();
            toast('تعذّر تصدير النسخة الاحتياطية');
          }
        };
      }
    );
  }

  /* ---------- فتح ملف PDF من الجهاز أو من السجل ---------- */
  async function handlePickedFile(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast('يرجى اختيار ملف PDF صالح');
      return;
    }
    toast('جارٍ فتح الملف محلياً…', 2000);
    try {
      var ab = await file.arrayBuffer();
      var bytes = new Uint8Array(ab);
      await openPdfBytes(bytes, {
        name: file.name,
        size: file.size || bytes.byteLength,
        lastModified: file.lastModified || Date.now()
      });
    } catch (e) {
      toast('تعذّر فتح ملف PDF: ' + (e && e.message ? e.message : 'ملف تالف أو مشفر بكلمة سر'), 3500);
    }
  }

  async function openRecentById(fileId) {
    try {
      var rec = await ST.getFile(fileId);
      if (!rec) { toast('السجل غير موجود'); loadLibrary(); return; }
      var bytes = await ST.getFileBytes(rec);
      if (!bytes) {
        st.relinkTargetId = fileId;
        toast('هذا السجل بدون نسخة PDF محفوظة — اختر نفس الملف من جهازك لاستعادة التظليلات', 3600);
        var fi = st.root && st.root.querySelector('#arFileInput');
        if (fi) fi.click();
        return;
      }
      await openPdfBytes(bytes, {
        id: rec.id,
        name: rec.name,
        size: rec.size || bytes.byteLength,
        lastModified: rec.lastModified
      });
    } catch (e) {
      toast('تعذّر استعادة الملف من الذاكرة المحلية');
    }
  }

  async function openPdfBytes(bytes, metaInput) {
    var fileId = metaInput.id || await S.computeFileId(bytes);
    var pdfjs = await S.loadPdfJs();
    var doc = await S.openPdfDoc(bytes);
    var numPages = doc.numPages || 1;

    var rec;
    try {
      rec = await ST.saveOrUpdateFile({
        id: fileId,
        name: metaInput.name || 'document.pdf',
        size: metaInput.size || bytes.byteLength,
        lastModified: metaInput.lastModified || Date.now(),
        pageCount: numPages
      }, bytes);
    } catch (e) {
      /* إذا امتلأت مساحة التخزين بالملف نفسه، نحفظ بيانات التتبع بدون Blob */
      rec = await ST.saveOrUpdateFile({
        id: fileId,
        name: metaInput.name || 'document.pdf',
        size: metaInput.size || bytes.byteLength,
        lastModified: metaInput.lastModified || Date.now(),
        pageCount: numPages
      }, null);
      toast('ملاحظة: تعذّر حفظ نسخة الملف لامتلاء المساحة، ولكن تظل تظليلاتك وملاحظاتك محفوظة');
    }

    var bundle = await ST.getFileBundle(fileId);
    closeActiveDoc();

    st.pdfjs = pdfjs;
    st.pdfDoc = doc;
    st.rawBytes = bytes.slice();
    st.fileMeta = rec;
    st.bundle = bundle;
    st.numPages = numPages;
    st.page = Math.max(1, Math.min(numPages, rec.lastPage || 1));
    st.zoomMode = rec.zoomMode || 'fit-width';
    st.zoomScale = rec.lastZoom || 1;
    st.nightMode = !!rec.nightMode;
    st.activeTool = 'select';
    st.showSearch = false;
    st.searchQuery = '';
    st.searchMatches = [];
    st.searchIdx = -1;
    st.textCache = Object.create(null);
    st.pendingSel = null;
    st.flashAnnId = '';
    st.relinkTargetId = null;

    /* فتح اللوحة الجانبية تلقائياً على الشاشات العريضة فقط */
    st.showSide = window.innerWidth >= 1140;
    st.showThumbs = window.innerWidth >= 1280;

    renderReaderShell();
    await renderCurrentPage();
  }

  function closeActiveDoc() {
    clearTimeout(st.saveStateTimer);
    clearTimeout(st.saveNoteTimer);
    if (st.pageRenderTask) { try { st.pageRenderTask.cancel(); } catch (e) {} st.pageRenderTask = null; }
    if (st.pageTextLayer) { try { st.pageTextLayer.cancel(); } catch (e) {} st.pageTextLayer = null; }
    if (st.thumbObserver) { try { st.thumbObserver.disconnect(); } catch (e) {} st.thumbObserver = null; }
    if (st.pdfDoc) { try { st.pdfDoc.destroy(); } catch (e) {} st.pdfDoc = null; }
    st.rawBytes = null;
    st.pendingSel = null;
    closeSelBar();
  }

  function scheduleSaveState() {
    if (!st.fileMeta) return;
    clearTimeout(st.saveStateTimer);
    st.saveStateTimer = setTimeout(function () {
      ST.updateFileState(st.fileMeta.id, {
        lastPage: st.page,
        lastZoom: st.zoomScale,
        zoomMode: st.zoomMode,
        nightMode: st.nightMode,
        lastOpenedAt: Date.now()
      }).catch(function () {});
    }, 240);
  }

  /* ---------- بناء واجهة القارئ الكاملة ---------- */
  function renderReaderShell() {
    if (!st.root || !st.fileMeta) return;
    st.mode = 'reading';
    st.root.classList.add('ar-reading');

    var hasDrawerOpen = (window.innerWidth <= 980) && (st.showThumbs || st.showSide);
    var h = '';
    h += '<div class="ar-ws' + (hasDrawerOpen ? ' has-drawer' : '') + '" id="arWs" data-night="' + (st.nightMode ? '1' : '0') + '" data-tool="' + st.activeTool + '">';

    /* 1) الشريط العلوي */
    h += '<div class="ar-topbar">';
    h += '<button type="button" class="ar-tbtn" id="arExitReader" title="العودة للمكتبة">' + I.prev + '<span>المكتبة</span></button>';
    h += '<div class="ar-doc-title" title="' + S.esc(st.fileMeta.name) + '">' + S.esc(st.fileMeta.name) + '</div>';
    h += '<button type="button" class="ar-tbtn' + (st.showThumbs ? ' on' : '') + '" id="arTogThumbs" title="مصغرات الصفحات">' + I.thumbs + '<span class="ar-lbl-hide-sm">المصغرات</span></button>';
    h += '<button type="button" class="ar-tbtn' + (st.showSearch ? ' on' : '') + '" id="arTogSearch" title="بحث في الملف">' + I.search + '<span class="ar-lbl-hide-sm">بحث</span></button>';
    h += '<button type="button" class="ar-tbtn' + (hasBookmarkOnPage(st.page) ? ' on' : '') + '" id="arBtnBookmark" title="علامة مرجعية لهذه الصفحة">' + I.bookmark + '<span class="ar-lbl-hide-sm">علامة</span></button>';
    h += '<button type="button" class="ar-tbtn' + (st.nightMode ? ' on' : '') + '" id="arBtnNight" title="وضع القراءة الليلية">' + I.moon + '<span class="ar-lbl-hide-sm">ليلي</span></button>';
    h += '<button type="button" class="ar-tbtn' + (st.showSide ? ' on' : '') + ' pri" id="arTogSide" title="الدفتر والملاحظات والتصدير">' + I.panel + '<span>الدفتر</span></button>';
    h += '</div>';

    /* 2) شريط التنقل والتكبير وأدوات التظليل */
    h += '<div class="ar-subbar">';
    h += '<div class="ar-grp">';
    h += '<button type="button" class="ar-tbtn" id="arPrevPage" aria-label="الصفحة السابقة">' + I.prev + '</button>';
    h += '<input type="text" inputmode="numeric" class="ar-page-in" id="arPageIn" aria-label="رقم الصفحة" value="' + st.page + '">';
    h += '<span class="ar-page-tot" id="arPageTot">/ ' + st.numPages + '</span>';
    h += '<button type="button" class="ar-tbtn" id="arNextPage" aria-label="الصفحة التالية">' + I.next + '</button>';
    h += '</div>';
    h += '<span class="ar-sep"></span>';
    h += '<div class="ar-grp">';
    h += '<button type="button" class="ar-tbtn" id="arZoomOut" aria-label="تصغير">' + I.zoomOut + '</button>';
    h += '<select class="ar-zoom-sel" id="arZoomSel" aria-label="مستوى التكبير">';
    h += '<option value="fit-width"' + (st.zoomMode === 'fit-width' ? ' selected' : '') + '>ملاءمة العرض</option>';
    h += '<option value="fit-page"' + (st.zoomMode === 'fit-page' ? ' selected' : '') + '>ملاءمة الصفحة</option>';
    [0.75, 1, 1.25, 1.5, 2, 2.5].forEach(function (z) {
      var sel = st.zoomMode === 'custom' && Math.abs(st.zoomScale - z) < 0.04;
      h += '<option value="' + z + '"' + (sel ? ' selected' : '') + '>' + Math.round(z * 100) + '%</option>';
    });
    if (st.zoomMode === 'custom' && ![0.75, 1, 1.25, 1.5, 2, 2.5].some(function (z) { return Math.abs(st.zoomScale - z) < 0.04; })) {
      h += '<option value="custom" selected>' + Math.round(st.zoomScale * 100) + '%</option>';
    }
    h += '</select>';
    h += '<button type="button" class="ar-tbtn" id="arZoomIn" aria-label="تكبير">' + I.zoomIn + '</button>';
    h += '</div>';
    h += '<span class="ar-sep"></span>';
    h += '<div class="ar-grp" title="لون التظليل">';
    h += '<div class="ar-color-row" id="arColorDots">';
    EX.COLOR_ORDER.forEach(function (cid) {
      var ci = EX.colorInfo(cid);
      h += '<button type="button" class="ar-cdot' + (st.activeColor === cid ? ' on' : '') + '" data-col="' + cid + '" style="background:' + ci.hex + '" title="' + ci.label + '" aria-label="لون ' + ci.label + '"></button>';
    });
    h += '</div></div>';
    h += '<span class="ar-sep"></span>';
    h += '<div class="ar-grp">';
    h += '<button type="button" class="ar-tbtn' + (st.activeTool === 'select' ? ' on' : '') + '" data-rtool="select" title="تحديد النص لتظليله">تحديد نص</button>';
    h += '<button type="button" class="ar-tbtn' + (st.activeTool === 'box-hl' ? ' on' : '') + '" data-rtool="box-hl" title="سحب مستطيل لتظليل أي موضع باللمس أو الماوس">' + I.hl + '<span>رسم تظليل</span></button>';
    h += '<button type="button" class="ar-tbtn' + (st.activeTool === 'pin' ? ' on' : '') + '" data-rtool="pin" title="انقر في أي موضع بالصفحة لإضافة تعليق جانبي">' + I.pin + '<span>تعليق موضعي</span></button>';
    h += '</div>';
    h += '</div>';

    /* 3) شريط البحث */
    h += '<div class="ar-searchbar" id="arSearchBar"' + (st.showSearch ? '' : ' hidden') + '>';
    h += '<input type="search" id="arSearchInput" placeholder="ابحث عن كلمة أو عبارة داخل الملف…" value="' + S.esc(st.searchQuery) + '">';
    h += '<button type="button" class="ar-btn sm pri" id="arSearchRun">بحث</button>';
    h += '<button type="button" class="ar-btn sm" id="arSearchPrev">السابق</button>';
    h += '<button type="button" class="ar-btn sm" id="arSearchNext">التالي</button>';
    h += '<span class="ar-search-meta" id="arSearchMeta"></span>';
    h += '<button type="button" class="ar-btn sm" id="arSearchClose" aria-label="إغلاق البحث">' + I.close + '</button>';
    h += '</div>';

    /* 4) مساحة العمل: مصغرات + صفحة PDF + الدفتر */
    h += '<div class="ar-body">';
    h += '<div class="ar-scrim" id="arScrim"></div>';

    /* المصغرات */
    h += '<aside class="ar-thumbs-pane" id="arThumbsPane"' + (st.showThumbs ? '' : ' hidden') + '></aside>';

    /* المسرح */
    h += '<main class="ar-stage" id="arStage">';
    if (st.activeTool === 'box-hl') {
      h += '<div class="ar-mode-banner"><span>اسحب بإصبعك أو الماوس فوق النص لتظليله باللون المختار</span><button type="button" class="ar-btn sm" id="arCancelTool">إنهاء</button></div>';
    } else if (st.activeTool === 'pin') {
      h += '<div class="ar-mode-banner"><span>انقر في أي موضع بالصفحة لوضع تعليق جانبي</span><button type="button" class="ar-btn sm" id="arCancelTool">إنهاء</button></div>';
    }
    h += '<div class="ar-page-shell" id="arPageShell">';
    h += '<div class="ar-page-box" id="arPageBox">';
    h += '<canvas class="ar-pdf-canvas" id="arPdfCanvas"></canvas>';
    h += '<div class="ar-text-layer" id="arTextLayer"></div>';
    h += '<div class="ar-ann-layer" id="arAnnLayer"></div>';
    h += '<div class="ar-draw-layer" id="arDrawLayer"></div>';
    h += '</div></div></main>';

    /* اللوحة الجانبية */
    h += '<aside class="ar-side-pane" id="arSidePane"' + (st.showSide ? '' : ' hidden') + '>';
    h += '<div class="ar-side-tabs">';
    h += '<button type="button" class="ar-side-tab' + (st.sideTab === 'notebook' ? ' on' : '') + '" data-stab="notebook">الدفتر</button>';
    h += '<button type="button" class="ar-side-tab' + (st.sideTab === 'page-note' ? ' on' : '') + '" data-stab="page-note">ملاحظة ص</button>';
    h += '<button type="button" class="ar-side-tab' + (st.sideTab === 'bookmarks' ? ' on' : '') + '" data-stab="bookmarks">العلامات</button>';
    h += '<button type="button" class="ar-side-tab' + (st.sideTab === 'export' ? ' on' : '') + '" data-stab="export">تصدير</button>';
    h += '</div>';
    h += '<div class="ar-side-body" id="arSideBody"></div>';
    h += '</aside>';

    h += '</div></div>';
    st.root.innerHTML = h;

    bindReaderEvents();
    if (st.showThumbs) buildThumbnails();
    renderSideBody();
  }

  function hasBookmarkOnPage(pg) {
    return st.bundle.bookmarks.some(function (b) { return b.page === pg; });
  }

  function syncToolbarUi() {
    if (!st.root) return;
    var ws = st.root.querySelector('#arWs');
    if (ws) {
      ws.dataset.night = st.nightMode ? '1' : '0';
      ws.dataset.tool = st.activeTool;
      var hasDrawer = (window.innerWidth <= 980) && (st.showThumbs || st.showSide);
      ws.classList.toggle('has-drawer', hasDrawer);
    }
    var pi = st.root.querySelector('#arPageIn');
    if (pi) pi.value = String(st.page);
    var prev = st.root.querySelector('#arPrevPage');
    var next = st.root.querySelector('#arNextPage');
    if (prev) prev.disabled = st.page <= 1;
    if (next) next.disabled = st.page >= st.numPages;

    var bmBtn = st.root.querySelector('#arBtnBookmark');
    if (bmBtn) bmBtn.classList.toggle('on', hasBookmarkOnPage(st.page));

    var nBtn = st.root.querySelector('#arBtnNight');
    if (nBtn) nBtn.classList.toggle('on', st.nightMode);

    var tBtn = st.root.querySelector('#arTogThumbs');
    if (tBtn) tBtn.classList.toggle('on', st.showThumbs);

    var sBtn = st.root.querySelector('#arTogSide');
    if (sBtn) sBtn.classList.toggle('on', st.showSide);

    var srBtn = st.root.querySelector('#arTogSearch');
    if (srBtn) srBtn.classList.toggle('on', st.showSearch);

    var tp = st.root.querySelector('#arThumbsPane');
    if (tp) {
      tp.hidden = !st.showThumbs;
      tp.querySelectorAll('.ar-thumb-card').forEach(function (c) {
        c.classList.toggle('on', Number(c.dataset.pg) === st.page);
      });
    }
    var sp = st.root.querySelector('#arSidePane');
    if (sp) sp.hidden = !st.showSide;

    var sb = st.root.querySelector('#arSearchBar');
    if (sb) sb.hidden = !st.showSearch;

    st.root.querySelectorAll('[data-col]').forEach(function (d) {
      d.classList.toggle('on', d.dataset.col === st.activeColor);
    });
    st.root.querySelectorAll('[data-rtool]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.rtool === st.activeTool);
    });
  }

  function bindReaderEvents() {
    var ws = st.root.querySelector('#arWs');

    ws.querySelector('#arExitReader').onclick = function () {
      closeActiveDoc();
      loadLibrary();
    };

    ws.querySelector('#arPrevPage').onclick = function () { goToPage(st.page - 1); };
    ws.querySelector('#arNextPage').onclick = function () { goToPage(st.page + 1); };

    var pIn = ws.querySelector('#arPageIn');
    pIn.onchange = function () {
      var n = parseInt(S.toLatinDigits(pIn.value), 10);
      if (isNaN(n)) { pIn.value = String(st.page); return; }
      goToPage(Math.max(1, Math.min(st.numPages, n)));
    };
    pIn.onkeydown = function (e) { if (e.key === 'Enter') { pIn.blur(); } };

    ws.querySelector('#arZoomIn').onclick = function () {
      st.zoomMode = 'custom';
      st.zoomScale = Math.min(3.5, Math.round((st.renderedScale + 0.2) * 100) / 100);
      updateZoomSelect();
      renderCurrentPage();
      scheduleSaveState();
    };
    ws.querySelector('#arZoomOut').onclick = function () {
      st.zoomMode = 'custom';
      st.zoomScale = Math.max(0.45, Math.round((st.renderedScale - 0.2) * 100) / 100);
      updateZoomSelect();
      renderCurrentPage();
      scheduleSaveState();
    };
    ws.querySelector('#arZoomSel').onchange = function () {
      var v = this.value;
      if (v === 'fit-width' || v === 'fit-page') {
        st.zoomMode = v;
      } else {
        var n = parseFloat(v);
        if (!isNaN(n)) { st.zoomMode = 'custom'; st.zoomScale = n; }
      }
      renderCurrentPage();
      scheduleSaveState();
    };

    ws.querySelector('#arBtnNight').onclick = function () {
      st.nightMode = !st.nightMode;
      syncToolbarUi();
      scheduleSaveState();
    };

    ws.querySelector('#arBtnBookmark').onclick = function () {
      openBookmarkModal(st.page);
    };

    ws.querySelector('#arTogThumbs').onclick = function () {
      st.showThumbs = !st.showThumbs;
      if (st.showThumbs && window.innerWidth <= 980) st.showSide = false;
      syncToolbarUi();
      if (st.showThumbs) buildThumbnails();
    };

    ws.querySelector('#arTogSide').onclick = function () {
      st.showSide = !st.showSide;
      if (st.showSide && window.innerWidth <= 980) st.showThumbs = false;
      syncToolbarUi();
      if (st.showSide) renderSideBody();
    };

    ws.querySelector('#arScrim').onclick = function () {
      st.showThumbs = false;
      st.showSide = false;
      syncToolbarUi();
    };

    ws.querySelector('#arTogSearch').onclick = function () {
      st.showSearch = !st.showSearch;
      syncToolbarUi();
      if (st.showSearch) {
        var si = ws.querySelector('#arSearchInput');
        if (si) setTimeout(function () { si.focus(); }, 40);
      }
    };

    ws.querySelector('#arSearchClose').onclick = function () {
      st.showSearch = false;
      st.searchMatches = [];
      st.searchIdx = -1;
      syncToolbarUi();
      renderOverlays();
    };
    ws.querySelector('#arSearchRun').onclick = runSearch;
    ws.querySelector('#arSearchInput').onkeydown = function (e) { if (e.key === 'Enter') runSearch(); };
    ws.querySelector('#arSearchNext').onclick = function () { stepSearch(1); };
    ws.querySelector('#arSearchPrev').onclick = function () { stepSearch(-1); };

    ws.querySelector('#arColorDots').onclick = function (e) {
      var b = e.target.closest('[data-col]');
      if (!b) return;
      st.activeColor = b.dataset.col;
      syncToolbarUi();
    };

    ws.querySelectorAll('[data-rtool]').forEach(function (b) {
      b.onclick = function () {
        st.activeTool = b.dataset.rtool;
        renderReaderShell();
        renderCurrentPage();
      };
    });

    var cancelTool = ws.querySelector('#arCancelTool');
    if (cancelTool) {
      cancelTool.onclick = function () {
        st.activeTool = 'select';
        renderReaderShell();
        renderCurrentPage();
      };
    }

    ws.querySelectorAll('.ar-side-tab').forEach(function (t) {
      t.onclick = function () {
        st.sideTab = t.dataset.stab;
        ws.querySelectorAll('.ar-side-tab').forEach(function (x) {
          x.classList.toggle('on', x.dataset.stab === st.sideTab);
        });
        renderSideBody();
      };
    });

    bindStageInteractions();
  }

  function updateZoomSelect() {
    if (!st.root) return;
    var sel = st.root.querySelector('#arZoomSel');
    if (!sel) return;
    var h = '';
    h += '<option value="fit-width"' + (st.zoomMode === 'fit-width' ? ' selected' : '') + '>ملاءمة العرض</option>';
    h += '<option value="fit-page"' + (st.zoomMode === 'fit-page' ? ' selected' : '') + '>ملاءمة الصفحة</option>';
    var matched = false;
    [0.75, 1, 1.25, 1.5, 2, 2.5].forEach(function (z) {
      var on = st.zoomMode === 'custom' && Math.abs(st.zoomScale - z) < 0.04;
      if (on) matched = true;
      h += '<option value="' + z + '"' + (on ? ' selected' : '') + '>' + Math.round(z * 100) + '%</option>';
    });
    if (st.zoomMode === 'custom' && !matched) {
      h += '<option value="custom" selected>' + Math.round(st.zoomScale * 100) + '%</option>';
    }
    sel.innerHTML = h;
  }

  /* ---------- عرض الصفحة الحالية + طبقة النصوص + الإحداثيات المطبّعة ---------- */
  async function goToPage(pg) {
    if (!st.pdfDoc) return;
    var target = Math.max(1, Math.min(st.numPages, pg));
    if (target === st.page && st.root && st.root.querySelector('#arPdfCanvas').width > 0) return;
    st.page = target;
    closeSelBar();
    syncToolbarUi();
    scheduleSaveState();
    await renderCurrentPage();
    if (st.showSide && st.sideTab === 'page-note') renderSideBody();
    var stage = st.root && st.root.querySelector('#arStage');
    if (stage) stage.scrollTop = 0;
  }

  async function renderCurrentPage() {
    if (!st.pdfDoc || !st.root) return;
    var stage = st.root.querySelector('#arStage');
    var pageBox = st.root.querySelector('#arPageBox');
    var canvas = st.root.querySelector('#arPdfCanvas');
    var textLayerDiv = st.root.querySelector('#arTextLayer');
    if (!stage || !pageBox || !canvas || !textLayerDiv) return;

    if (st.pageRenderTask) { try { st.pageRenderTask.cancel(); } catch (e) {} st.pageRenderTask = null; }
    if (st.pageTextLayer) { try { st.pageTextLayer.cancel(); } catch (e) {} st.pageTextLayer = null; }

    var reqPage = st.page;
    try {
      var page = await st.pdfDoc.getPage(reqPage);
      if (reqPage !== st.page || !st.pdfDoc) return;

      var baseVp = page.getViewport({ scale: 1 });
      var availW = Math.max(260, stage.clientWidth - (window.innerWidth < 640 ? 16 : 36));
      var availH = Math.max(280, stage.clientHeight - 36);

      var scale;
      if (st.zoomMode === 'fit-width') {
        scale = availW / baseVp.width;
      } else if (st.zoomMode === 'fit-page') {
        scale = Math.min(availW / baseVp.width, availH / baseVp.height);
      } else {
        scale = st.zoomScale || 1;
      }
      scale = Math.max(0.35, Math.min(4.0, scale));
      st.renderedScale = scale;

      var viewport = page.getViewport({ scale: scale });
      var dpr = Math.min(window.devicePixelRatio || 1, 2.25);

      var cssW = Math.floor(viewport.width);
      var cssH = Math.floor(viewport.height);
      pageBox.style.width = cssW + 'px';
      pageBox.style.height = cssH + 'px';
      pageBox.style.setProperty('--scale-factor', String(viewport.scale));

      canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
      canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
      var ctx = canvas.getContext('2d');
      /* مهم: خاصية direction في Canvas قيمتها الافتراضية "inherit" فتورث rtl من .ar-ws،
         فيعيد المتصفح ترتيب كل مقطع نصي يرسمه PDF.js ويُفسد الحروف العربية. نثبّتها LTR
         لأن PDF.js يضع كل حرف بإحداثياته الدقيقة ولا يحتاج Bidi من المتصفح. */
      try { ctx.direction = 'ltr'; } catch (e) {}
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var task = page.render({ canvasContext: ctx, viewport: viewport });
      st.pageRenderTask = task;
      await task.promise;
      if (reqPage !== st.page || !st.pdfDoc) return;

      /* طبقة النصوص القابلة للتحديد */
      textLayerDiv.innerHTML = '';
      var textContent = await getPageTextContent(reqPage, page);
      if (reqPage !== st.page || !st.pdfDoc) return;

      var tl = new st.pdfjs.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport
      });
      st.pageTextLayer = tl;
      await tl.render();

      renderOverlays();
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
    }
  }

  async function getPageTextContent(pg, pageObj) {
    if (st.textCache[pg]) return st.textCache[pg];
    var p = pageObj || await st.pdfDoc.getPage(pg);
    var tc = await p.getTextContent();
    st.textCache[pg] = tc;
    return tc;
  }

  /* ---------- رسم التظليلات ونتائج البحث ودبابيس التعليقات ---------- */
  function renderOverlays() {
    if (!st.root) return;
    var layer = st.root.querySelector('#arAnnLayer');
    if (!layer) return;

    var html = '';
    /* نتائج البحث في الصفحة الحالية */
    st.searchMatches.forEach(function (m, idx) {
      if (m.page !== st.page || !Array.isArray(m.rects)) return;
      var cls = 'ar-search-hit' + (idx === st.searchIdx ? ' cur' : '');
      m.rects.forEach(function (r) {
        html += '<div class="' + cls + '" style="left:' + (r.x * 100).toFixed(3) + '%;top:' + (r.y * 100).toFixed(3) + '%;width:' + (r.w * 100).toFixed(3) + '%;height:' + (r.h * 100).toFixed(3) + '%"></div>';
      });
    });

    /* التظليلات والتعليقات الموضعية في الصفحة الحالية */
    var pageAnns = st.bundle.annotations.filter(function (a) { return a.page === st.page; });
    var commentIdx = 0;
    pageAnns.forEach(function (ann) {
      var ci = EX.colorInfo(ann.color);
      var flash = st.flashAnnId === ann.id ? ' flash' : '';
      if (ann.type === 'highlight' && Array.isArray(ann.rects)) {
        ann.rects.forEach(function (r, rIdx) {
          html += '<div class="ar-hl-rect' + flash + '" data-ann="' + S.esc(ann.id) + '" title="' + S.esc(ann.note || ann.text || 'تظليل') + '" style="left:' + (r.x * 100).toFixed(3) + '%;top:' + (r.y * 100).toFixed(3) + '%;width:' + (r.w * 100).toFixed(3) + '%;height:' + (r.h * 100).toFixed(3) + '%;background:' + ci.css + '">' +
            (rIdx === 0 && ann.note && ann.note.trim() ? '<span style="position:absolute;top:-7px;inset-inline-end:-7px;width:14px;height:14px;border-radius:50%;background:' + ci.hex + ';border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>' : '') +
            '</div>';
        });
      } else if (ann.type === 'comment' && ann.anchor) {
        commentIdx++;
        html += '<button type="button" class="ar-pin' + flash + '" data-ann="' + S.esc(ann.id) + '" title="' + S.esc(ann.note || 'تعليق') + '" style="left:' + (ann.anchor.x * 100).toFixed(3) + '%;top:' + (ann.anchor.y * 100).toFixed(3) + '%;background:' + ci.hex + '">' + commentIdx + '</button>';
      }
    });

    layer.innerHTML = html;
  }

  /* ---------- تحديد النص + تظليل السحب + تعليق موضعي ---------- */
  var selCheckTimer = 0;
  function bindStageInteractions() {
    var ws = st.root.querySelector('#arWs');
    var pageBox = ws.querySelector('#arPageBox');
    var annLayer = ws.querySelector('#arAnnLayer');
    var drawLayer = ws.querySelector('#arDrawLayer');

    annLayer.addEventListener('click', function (e) {
      var el = e.target.closest('[data-ann]');
      if (!el) return;
      e.stopPropagation();
      openAnnotationModal(el.dataset.ann);
    });

    /* التقاط تحديد النص على الحاسوب والهاتف */
    function checkTextSelection() {
      if (st.mode !== 'reading' || st.activeTool !== 'select' || !st.root) return;
      var textLayer = st.root.querySelector('#arTextLayer');
      if (!textLayer) return;
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        st.pendingSel = null;
        closeSelBar();
        return;
      }
      var range = sel.getRangeAt(0);
      if (!textLayer.contains(range.commonAncestorContainer)) return;
      var text = sel.toString().replace(/\s+/g, ' ').trim();
      if (!text) return;

      var boxRect = pageBox.getBoundingClientRect();
      if (!boxRect.width || !boxRect.height) return;

      var rawRects = Array.prototype.slice.call(range.getClientRects());
      var normRects = normalizeClientRects(rawRects, boxRect);
      if (!normRects.length) return;

      st.pendingSel = { text: text, rects: normRects, page: st.page };
      showSelBar();
    }

    pageBox.addEventListener('mouseup', function () {
      clearTimeout(selCheckTimer);
      selCheckTimer = setTimeout(checkTextSelection, 60);
    });
    pageBox.addEventListener('touchend', function () {
      clearTimeout(selCheckTimer);
      selCheckTimer = setTimeout(checkTextSelection, 160);
    });

    /* رسم تظليل باللمس/الماوس أو وضع تعليق موضعي */
    var dragState = null;
    drawLayer.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      var rect = pageBox.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var nx = clamp01((e.clientX - rect.left) / rect.width);
      var ny = clamp01((e.clientY - rect.top) / rect.height);

      if (st.activeTool === 'pin') {
        e.preventDefault();
        openNewCommentModal(st.page, nx, ny);
        return;
      }
      if (st.activeTool === 'box-hl') {
        e.preventDefault();
        drawLayer.setPointerCapture(e.pointerId);
        var prev = document.createElement('div');
        prev.className = 'ar-draw-preview';
        prev.style.background = EX.colorInfo(st.activeColor).css;
        drawLayer.innerHTML = '';
        drawLayer.appendChild(prev);
        dragState = { sx: nx, sy: ny, rect: rect, el: prev };
      }
    });

    drawLayer.addEventListener('pointermove', function (e) {
      if (!dragState) return;
      var nx = clamp01((e.clientX - dragState.rect.left) / dragState.rect.width);
      var ny = clamp01((e.clientY - dragState.rect.top) / dragState.rect.height);
      var x = Math.min(dragState.sx, nx);
      var y = Math.min(dragState.sy, ny);
      var w = Math.abs(nx - dragState.sx);
      var h = Math.abs(ny - dragState.sy);
      dragState.el.style.left = (x * 100) + '%';
      dragState.el.style.top = (y * 100) + '%';
      dragState.el.style.width = (w * 100) + '%';
      dragState.el.style.height = (h * 100) + '%';
    });

    function finishDraw(e) {
      if (!dragState) return;
      var nx = clamp01((e.clientX - dragState.rect.left) / dragState.rect.width);
      var ny = clamp01((e.clientY - dragState.rect.top) / dragState.rect.height);
      var x = Math.min(dragState.sx, nx);
      var y = Math.min(dragState.sy, ny);
      var w = Math.abs(nx - dragState.sx);
      var h = Math.abs(ny - dragState.sy);
      drawLayer.innerHTML = '';
      dragState = null;

      if (w < 0.015 || h < 0.008) return;
      var guessed = extractTextInsideNormBox(st.page, { x: x, y: y, w: w, h: h });
      addHighlight(st.page, [{ x: x, y: y, w: w, h: h }], guessed, st.activeColor, '');
    }
    drawLayer.addEventListener('pointerup', finishDraw);
    drawLayer.addEventListener('pointercancel', function () { drawLayer.innerHTML = ''; dragState = null; });
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function normalizeClientRects(clientRects, boxRect) {
    var list = [];
    clientRects.forEach(function (r) {
      if (r.width < 3 || r.height < 3) return;
      var x1 = clamp01((r.left - boxRect.left) / boxRect.width);
      var y1 = clamp01((r.top - boxRect.top) / boxRect.height);
      var x2 = clamp01((r.right - boxRect.left) / boxRect.width);
      var y2 = clamp01((r.bottom - boxRect.top) / boxRect.height);
      if (x2 - x1 < 0.003 || y2 - y1 < 0.003) return;
      list.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    });
    if (list.length <= 1) return list;

    /* دمج المستطيلات المتداخلة على نفس السطر لإنتاج شريط تظليل نظيف */
    list.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    var merged = [list[0]];
    for (var i = 1; i < list.length; i++) {
      var cur = list[i];
      var last = merged[merged.length - 1];
      var sameLine = Math.abs(cur.y - last.y) < Math.max(last.h, cur.h) * 0.55;
      var overlapOrClose = cur.x <= (last.x + last.w + 0.018) && (cur.x + cur.w) >= (last.x - 0.018);
      if (sameLine && overlapOrClose) {
        var nx = Math.min(last.x, cur.x);
        var ny = Math.min(last.y, cur.y);
        var nx2 = Math.max(last.x + last.w, cur.x + cur.w);
        var ny2 = Math.max(last.y + last.h, cur.y + cur.h);
        last.x = nx; last.y = ny; last.w = nx2 - nx; last.h = ny2 - ny;
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  function extractTextInsideNormBox(pg, box) {
    var textLayer = st.root && st.root.querySelector('#arTextLayer');
    var pageBox = st.root && st.root.querySelector('#arPageBox');
    if (!textLayer || !pageBox) return '';
    var pRect = pageBox.getBoundingClientRect();
    if (!pRect.width || !pRect.height) return '';

    var bx1 = pRect.left + box.x * pRect.width;
    var by1 = pRect.top + box.y * pRect.height;
    var bx2 = bx1 + box.w * pRect.width;
    var by2 = by1 + box.h * pRect.height;

    var words = [];
    textLayer.querySelectorAll('span').forEach(function (sp) {
      var txt = sp.textContent;
      if (!txt || !txt.trim()) return;
      var r = sp.getBoundingClientRect();
      var cx = (r.left + r.right) / 2;
      var cy = (r.top + r.bottom) / 2;
      if (cx >= bx1 && cx <= bx2 && cy >= by1 && cy <= by2) {
        words.push(txt.trim());
      }
    });
    return words.join(' ').trim();
  }

  /* ---------- شريط الإجراءات العائم عند تحديد نص ---------- */
  var selBarEl = null;
  function closeSelBar() {
    if (selBarEl) { selBarEl.remove(); selBarEl = null; }
  }
  function showSelBar() {
    closeSelBar();
    if (!st.pendingSel) return;
    selBarEl = document.createElement('div');
    selBarEl.className = 'ar-sel-bar';

    var h = '<span>تظليل التحديد:</span>';
    EX.COLOR_ORDER.forEach(function (cid) {
      var ci = EX.colorInfo(cid);
      h += '<button type="button" class="ar-cdot" data-pickcol="' + cid + '" style="background:' + ci.hex + '" title="تظليل ' + ci.label + '" aria-label="تظليل ' + ci.label + '"></button>';
    });
    h += '<button type="button" class="ar-btn sm pri" id="arSelNote">+ تعليق</button>';
    h += '<button type="button" class="ar-btn sm" id="arSelCopy">نسخ</button>';
    h += '<button type="button" class="ar-btn sm" id="arSelCancel" aria-label="إغلاق">' + I.close + '</button>';
    selBarEl.innerHTML = h;
    document.body.appendChild(selBarEl);

    selBarEl.querySelectorAll('[data-pickcol]').forEach(function (btn) {
      btn.onclick = function () {
        var ps = st.pendingSel;
        if (!ps) return;
        st.activeColor = btn.dataset.pickcol;
        addHighlight(ps.page, ps.rects, ps.text, btn.dataset.pickcol, '');
        clearNativeSelection();
      };
    });

    selBarEl.querySelector('#arSelNote').onclick = async function () {
      var ps = st.pendingSel;
      if (!ps) return;
      var ann = await addHighlight(ps.page, ps.rects, ps.text, st.activeColor, '');
      clearNativeSelection();
      if (ann) openAnnotationModal(ann.id);
    };

    selBarEl.querySelector('#arSelCopy').onclick = async function () {
      if (!st.pendingSel) return;
      var ok = await copyText(st.pendingSel.text);
      toast(ok ? 'تم نسخ النص المحدد' : 'تعذّر النسخ');
      clearNativeSelection();
    };

    selBarEl.querySelector('#arSelCancel').onclick = clearNativeSelection;
  }

  function clearNativeSelection() {
    st.pendingSel = null;
    closeSelBar();
    try {
      var sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    } catch (e) {}
  }

  async function addHighlight(page, rects, text, color, note) {
    var ann = {
      id: S.uid('hl'),
      fileId: st.fileMeta.id,
      type: 'highlight',
      page: page,
      color: color || 'yellow',
      text: text || '',
      note: note || '',
      rects: rects,
      createdAt: Date.now()
    };
    st.bundle.annotations.push(ann);
    sortBundle();
    await ST.saveAnnotation(ann);
    renderOverlays();
    refreshThumbBadges(page);
    if (st.showSide) renderSideBody();
    toast('تم حفظ التظليل');
    return ann;
  }

  function sortBundle() {
    st.bundle.annotations.sort(function (a, b) {
      return (a.page - b.page) || ((a.createdAt || 0) - (b.createdAt || 0));
    });
    st.bundle.bookmarks.sort(function (a, b) { return a.page - b.page; });
    st.bundle.notes.sort(function (a, b) { return a.page - b.page; });
  }

  /* ---------- نوافذ تعديل التظليل والتعليق والعلامة المرجعية ---------- */
  function openNewCommentModal(page, nx, ny) {
    var chosenColor = st.activeColor;
    var dots = EX.COLOR_ORDER.map(function (cid) {
      var ci = EX.colorInfo(cid);
      return '<button type="button" class="ar-cdot' + (cid === chosenColor ? ' on' : '') + '" data-mcol="' + cid + '" style="background:' + ci.hex + '" title="' + ci.label + '"></button>';
    }).join('');

    openModal(
      '<h3>إضافة تعليق موضعي (صفحة ' + page + ')</h3>' +
      '<div class="ar-color-row">' + dots + '</div>' +
      '<textarea class="ar-textarea" id="arNewCommTxt" placeholder="اكتب تعليقك أو ملاحظتك المرتبطة بهذا الموضع…"></textarea>' +
      '<div class="ar-modal-acts">' +
      '<button type="button" class="ar-btn sm" data-mclose="1">إلغاء</button>' +
      '<button type="button" class="ar-btn sm pri" id="arNewCommSave">حفظ التعليق</button></div>',
      function (bg) {
        bg.querySelectorAll('[data-mcol]').forEach(function (d) {
          d.onclick = function () {
            chosenColor = d.dataset.mcol;
            bg.querySelectorAll('[data-mcol]').forEach(function (x) { x.classList.toggle('on', x.dataset.mcol === chosenColor); });
          };
        });
        bg.querySelector('#arNewCommSave').onclick = async function () {
          var txt = bg.querySelector('#arNewCommTxt').value.trim();
          if (!txt) { toast('اكتب نص التعليق قبل الحفظ'); return; }
          var ann = {
            id: S.uid('cm'),
            fileId: st.fileMeta.id,
            type: 'comment',
            page: page,
            color: chosenColor,
            note: txt,
            anchor: { x: nx, y: ny },
            createdAt: Date.now()
          };
          st.bundle.annotations.push(ann);
          sortBundle();
          await ST.saveAnnotation(ann);
          closeModal();
          renderOverlays();
          refreshThumbBadges(page);
          if (st.showSide) renderSideBody();
          toast('تمت إضافة التعليق');
        };
      }
    );
  }

  function openAnnotationModal(annId) {
    var ann = st.bundle.annotations.filter(function (a) { return a.id === annId; })[0];
    if (!ann) return;
    var chosenColor = ann.color || 'yellow';
    var dots = EX.COLOR_ORDER.map(function (cid) {
      var ci = EX.colorInfo(cid);
      return '<button type="button" class="ar-cdot' + (cid === chosenColor ? ' on' : '') + '" data-mcol="' + cid + '" style="background:' + ci.hex + '" title="' + ci.label + '"></button>';
    }).join('');

    var isHl = ann.type === 'highlight';
    openModal(
      '<h3>' + (isHl ? 'تعديل التظليل' : 'تعديل التعليق الجانبي') + ' (صفحة ' + ann.page + ')</h3>' +
      (ann.text ? '<div class="ar-ann-quote" style="background:var(--bg);padding:8px 10px;border-radius:10px;border:1px solid var(--line);max-height:110px;overflow:auto">' + S.esc(ann.text) + '</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
      '<span style="font-size:13px;color:var(--muted)">اللون:</span><div class="ar-color-row">' + dots + '</div></div>' +
      '<textarea class="ar-textarea" id="arEditAnnNote" placeholder="اكتب تعليقاً أو ملاحظة…">' + S.esc(ann.note || '') + '</textarea>' +
      '<div class="ar-modal-acts">' +
      '<button type="button" class="ar-btn sm danger" id="arDelAnn">حذف</button>' +
      (ann.text ? '<button type="button" class="ar-btn sm" id="arCopyAnn">نسخ النص</button>' : '') +
      '<button type="button" class="ar-btn sm" data-mclose="1">إغلاق</button>' +
      '<button type="button" class="ar-btn sm pri" id="arSaveAnn">حفظ</button></div>',
      function (bg) {
        bg.querySelectorAll('[data-mcol]').forEach(function (d) {
          d.onclick = function () {
            chosenColor = d.dataset.mcol;
            bg.querySelectorAll('[data-mcol]').forEach(function (x) { x.classList.toggle('on', x.dataset.mcol === chosenColor); });
          };
        });
        var cp = bg.querySelector('#arCopyAnn');
        if (cp) cp.onclick = async function () {
          var ok = await copyText(ann.text);
          toast(ok ? 'تم نسخ النص المظلل' : 'تعذّر النسخ');
        };
        bg.querySelector('#arDelAnn').onclick = async function () {
          st.bundle.annotations = st.bundle.annotations.filter(function (x) { return x.id !== ann.id; });
          await ST.deleteAnnotation(ann.id);
          closeModal();
          renderOverlays();
          refreshThumbBadges(ann.page);
          if (st.showSide) renderSideBody();
          toast('تم الحذف');
        };
        bg.querySelector('#arSaveAnn').onclick = async function () {
          var noteVal = bg.querySelector('#arEditAnnNote').value.trim();
          if (!isHl && !noteVal) { toast('اكتب نص التعليق أو احذفه'); return; }
          ann.color = chosenColor;
          ann.note = noteVal;
          await ST.saveAnnotation(ann);
          closeModal();
          renderOverlays();
          if (st.showSide) renderSideBody();
          toast('تم تحديث ' + (isHl ? 'التظليل' : 'التعليق'));
        };
      }
    );
  }

  function openBookmarkModal(pg, existingId) {
    var cur = existingId
      ? st.bundle.bookmarks.filter(function (b) { return b.id === existingId; })[0]
      : st.bundle.bookmarks.filter(function (b) { return b.page === pg; })[0];

    openModal(
      '<h3>' + (cur ? 'تعديل العلامة المرجعية' : 'إضافة علامة مرجعية') + ' (صفحة ' + pg + ')</h3>' +
      '<input class="ar-input" id="arBmTitle" maxlength="80" placeholder="اسم العلامة (مثال: تعريف مهم / فصل 2)" value="' + S.esc(cur ? cur.title : ('صفحة ' + pg)) + '">' +
      '<div class="ar-modal-acts">' +
      (cur ? '<button type="button" class="ar-btn sm danger" id="arBmDel">إزالة العلامة</button>' : '') +
      '<button type="button" class="ar-btn sm" data-mclose="1">إلغاء</button>' +
      '<button type="button" class="ar-btn sm pri" id="arBmSave">حفظ</button></div>',
      function (bg) {
        var del = bg.querySelector('#arBmDel');
        if (del && cur) {
          del.onclick = async function () {
            st.bundle.bookmarks = st.bundle.bookmarks.filter(function (b) { return b.id !== cur.id; });
            await ST.deleteBookmark(cur.id);
            closeModal();
            syncToolbarUi();
            refreshThumbBadges(cur.page);
            if (st.showSide) renderSideBody();
            toast('تمت إزالة العلامة المرجعية');
          };
        }
        bg.querySelector('#arBmSave').onclick = async function () {
          var title = bg.querySelector('#arBmTitle').value.trim() || ('صفحة ' + pg);
          var bm = cur ? Object.assign({}, cur, { title: title }) : {
            id: S.uid('bm'),
            fileId: st.fileMeta.id,
            page: pg,
            title: title,
            createdAt: Date.now()
          };
          if (!cur) st.bundle.bookmarks.push(bm);
          else {
            st.bundle.bookmarks = st.bundle.bookmarks.map(function (b) { return b.id === bm.id ? bm : b; });
          }
          sortBundle();
          await ST.saveBookmark(bm);
          closeModal();
          syncToolbarUi();
          refreshThumbBadges(pg);
          if (st.showSide) renderSideBody();
          toast('تم حفظ العلامة المرجعية');
        };
      }
    );
  }

  /* ---------- مصغرات الصفحات (مع تحميل كسول) ---------- */
  function buildThumbnails() {
    var pane = st.root && st.root.querySelector('#arThumbsPane');
    if (!pane || !st.pdfDoc) return;
    if (st.thumbObserver) { try { st.thumbObserver.disconnect(); } catch (e) {} }

    var h = '';
    for (var p = 1; p <= st.numPages; p++) {
      h += '<button type="button" class="ar-thumb-card' + (p === st.page ? ' on' : '') + '" data-pg="' + p + '">';
      h += '<div class="ar-thumb-img" id="arThumbImg_' + p + '"><span style="font-size:12px;color:var(--muted)">' + p + '</span></div>';
      h += '<div class="ar-thumb-foot"><span>' + p + '</span><span class="ar-thumb-badges" id="arThumbBadge_' + p + '">' + thumbBadgeText(p) + '</span></div>';
      h += '</button>';
    }
    pane.innerHTML = h;

    pane.querySelectorAll('.ar-thumb-card').forEach(function (card) {
      card.onclick = function () {
        var target = Number(card.dataset.pg);
        if (window.innerWidth <= 980) { st.showThumbs = false; syncToolbarUi(); }
        goToPage(target);
      };
    });

    if ('IntersectionObserver' in window) {
      st.thumbObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (ent) {
          if (!ent.isIntersecting) return;
          var pg = Number(ent.target.dataset.pg);
          st.thumbObserver.unobserve(ent.target);
          renderThumbPage(pg);
        });
      }, { root: pane, rootMargin: '200px 0px' });
      pane.querySelectorAll('.ar-thumb-card').forEach(function (c) { st.thumbObserver.observe(c); });
    } else {
      for (var k = 1; k <= Math.min(st.numPages, 24); k++) renderThumbPage(k);
    }
  }

  function thumbBadgeText(pg) {
    var bm = hasBookmarkOnPage(pg) ? '🔖' : '';
    var annCount = st.bundle.annotations.filter(function (a) { return a.page === pg; }).length;
    var hasNote = st.bundle.notes.some(function (n) { return n.page === pg && n.content && n.content.trim(); });
    return bm + (annCount ? ' ' + annCount : '') + (hasNote ? ' 📝' : '');
  }

  function refreshThumbBadges(pg) {
    var b = st.root && st.root.querySelector('#arThumbBadge_' + pg);
    if (b) b.textContent = thumbBadgeText(pg);
  }

  async function renderThumbPage(pg) {
    if (!st.pdfDoc || !st.root) return;
    var holder = st.root.querySelector('#arThumbImg_' + pg);
    if (!holder || holder.dataset.done === '1') return;
    holder.dataset.done = '1';
    try {
      var page = await st.pdfDoc.getPage(pg);
      if (!st.pdfDoc) return;
      var vp0 = page.getViewport({ scale: 1 });
      var scale = 148 / vp0.width;
      var vp = page.getViewport({ scale: scale });
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.floor(vp.width));
      cv.height = Math.max(1, Math.floor(vp.height));
      var tctx = cv.getContext('2d');
      try { tctx.direction = 'ltr'; } catch (e) {}
      await page.render({ canvasContext: tctx, viewport: vp }).promise;
      if (holder.isConnected) {
        holder.innerHTML = '';
        holder.appendChild(cv);
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- البحث داخل النصوص القابلة للبحث ---------- */
  async function runSearch() {
    var qIn = st.root && st.root.querySelector('#arSearchInput');
    var meta = st.root && st.root.querySelector('#arSearchMeta');
    if (!qIn || !st.pdfDoc) return;
    var raw = qIn.value.trim();
    st.searchQuery = raw;
    if (!raw) {
      st.searchMatches = [];
      st.searchIdx = -1;
      if (meta) meta.textContent = '';
      renderOverlays();
      return;
    }

    var normQ = S.normalizeArabic(raw);
    if (!normQ) return;

    st.searchBusy = true;
    if (meta) meta.textContent = 'جارٍ البحث…';
    var matches = [];

    for (var p = 1; p <= st.numPages; p++) {
      if (!st.pdfDoc || st.searchQuery !== raw) return;
      try {
        var page = await st.pdfDoc.getPage(p);
        var tc = await getPageTextContent(p, page);
        var vp = page.getViewport({ scale: 1 });
        var items = tc.items || [];
        var hitRects = [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (!it || !it.str) continue;
          if (S.normalizeArabic(it.str).indexOf(normQ) !== -1) {
            var r = textItemToNormRect(it, vp);
            if (r) hitRects.push(r);
          }
        }
        if (hitRects.length) {
          matches.push({ page: p, rects: hitRects, count: hitRects.length });
        } else {
          /* محاولة بحث عبر النص المجمّع للصفحة إذا كانت الكلمة موزعة على عنصرين */
          var fullStr = items.map(function (x) { return x.str || ''; }).join(' ');
          if (S.normalizeArabic(fullStr).indexOf(normQ) !== -1) {
            matches.push({ page: p, rects: [], count: 1 });
          }
        }
      } catch (e) { /* ignore */ }
      if (p % 6 === 0) await new Promise(function (r) { setTimeout(r, 0); });
    }

    st.searchBusy = false;
    st.searchMatches = matches;
    if (!matches.length) {
      st.searchIdx = -1;
      if (meta) meta.textContent = 'لا توجد نتائج';
      renderOverlays();
      return;
    }

    /* الانتقال لأول نتيجة من الصفحة الحالية أو الأولى عموماً */
    var firstIdx = 0;
    for (var k = 0; k < matches.length; k++) {
      if (matches[k].page >= st.page) { firstIdx = k; break; }
    }
    st.searchIdx = firstIdx;
    if (meta) meta.textContent = 'صفحة ' + (firstIdx + 1) + ' من ' + matches.length + ' صفحات مطابقة';
    await goToPage(matches[firstIdx].page);
  }

  function stepSearch(dir) {
    if (!st.searchMatches.length) { runSearch(); return; }
    st.searchIdx = (st.searchIdx + dir + st.searchMatches.length) % st.searchMatches.length;
    var m = st.searchMatches[st.searchIdx];
    var meta = st.root && st.root.querySelector('#arSearchMeta');
    if (meta) meta.textContent = 'صفحة ' + (st.searchIdx + 1) + ' من ' + st.searchMatches.length + ' صفحات مطابقة';
    goToPage(m.page);
  }

  function textItemToNormRect(item, viewport) {
    try {
      var tx = st.pdfjs.Util.transform(viewport.transform, item.transform);
      var h = Math.hypot(tx[2], tx[3]) || Math.abs(item.height * viewport.scale) || 12;
      var w = (item.width || 20) * viewport.scale;
      var x = tx[4];
      var y = tx[5] - h;
      return {
        x: clamp01(x / viewport.width),
        y: clamp01(y / viewport.height),
        w: Math.max(0.01, Math.min(1, w / viewport.width)),
        h: Math.max(0.012, Math.min(1, h * 1.15 / viewport.height))
      };
    } catch (e) {
      return null;
    }
  }

  /* ---------- اللوحة الجانبية: الدفتر / ملاحظة الصفحة / العلامات / التصدير ---------- */
  function renderSideBody() {
    var body = st.root && st.root.querySelector('#arSideBody');
    if (!body) return;

    if (st.sideTab === 'notebook') {
      renderNotebookTab(body);
    } else if (st.sideTab === 'page-note') {
      renderPageNoteTab(body);
    } else if (st.sideTab === 'bookmarks') {
      renderBookmarksTab(body);
    } else if (st.sideTab === 'export') {
      renderExportTab(body);
    }
  }

  function renderNotebookTab(body) {
    var anns = st.bundle.annotations;
    var notes = st.bundle.notes;
    var marks = st.bundle.bookmarks;

    var h = '';
    h += '<div class="ar-box"><h4>دفتر الملاحظات التفاعلي</h4>';
    h += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">تظليلات: ' +
      anns.filter(function (a) { return a.type === 'highlight'; }).length +
      ' • تعليقات: ' + anns.filter(function (a) { return a.type === 'comment'; }).length +
      ' • ملاحظات: ' + notes.length + ' • علامات: ' + marks.length + '</div>';
    h += '<div class="ar-filter-row">';
    [['all', 'الكل'], ['highlight', 'التظليلات'], ['comment', 'التعليقات'], ['notes', 'ملاحظات الصفحات']].forEach(function (f) {
      h += '<button type="button" class="ar-chip' + (st.nbFilter === f[0] ? ' on' : '') + '" data-nbflt="' + f[0] + '">' + f[1] + '</button>';
    });
    h += '</div></div>';

    var items = [];
    if (st.nbFilter === 'all' || st.nbFilter === 'highlight' || st.nbFilter === 'comment') {
      anns.forEach(function (a) {
        if (st.nbFilter === 'highlight' && a.type !== 'highlight') return;
        if (st.nbFilter === 'comment' && a.type !== 'comment' && !(a.note && a.note.trim())) return;
        items.push({ kind: 'ann', page: a.page, data: a });
      });
    }
    if (st.nbFilter === 'all' || st.nbFilter === 'notes') {
      notes.forEach(function (n) {
        if (n.content && n.content.trim()) items.push({ kind: 'note', page: n.page, data: n });
      });
    }
    items.sort(function (a, b) { return a.page - b.page; });

    if (!items.length) {
      h += '<p class="ar-empty">لا توجد عناصر مسجلة في هذا التصنيف بعد. حدّد نصاً لتظليله أو أضف تعليقاً أو ملاحظة صفحة.</p>';
    } else {
      items.forEach(function (it) {
        if (it.kind === 'ann') {
          var a = it.data;
          var ci = EX.colorInfo(a.color);
          h += '<div class="ar-ann-card" style="border-inline-start-color:' + ci.hex + '">';
          h += '<div class="ar-ann-top"><b>صفحة ' + a.page + ' · ' + (a.type === 'highlight' ? 'تظليل ' + ci.label : 'تعليق موضعي') + '</b></div>';
          if (a.text) h += '<div class="ar-ann-quote">' + S.esc(a.text) + '</div>';
          if (a.note) h += '<div class="ar-ann-note">💬 ' + S.esc(a.note) + '</div>';
          h += '<div class="ar-ann-acts">';
          h += '<button type="button" class="ar-btn sm pri" data-jump="' + a.page + '" data-flash="' + S.esc(a.id) + '">الانتقال</button>';
          h += '<button type="button" class="ar-btn sm" data-editann="' + S.esc(a.id) + '">تعديل</button>';
          h += '<button type="button" class="ar-btn sm danger" data-delann="' + S.esc(a.id) + '">حذف</button>';
          h += '</div></div>';
        } else {
          var n = it.data;
          h += '<div class="ar-ann-card" style="border-inline-start-color:#F59E0B">';
          h += '<div class="ar-ann-top"><b>صفحة ' + n.page + ' · ملاحظة صفحة</b></div>';
          h += '<div class="ar-ann-quote">' + S.esc(n.content) + '</div>';
          h += '<div class="ar-ann-acts"><button type="button" class="ar-btn sm pri" data-jump="' + n.page + '" data-open-note="1">فتح الملاحظة</button></div>';
          h += '</div>';
        }
      });
    }

    body.innerHTML = h;
    body.querySelectorAll('[data-nbflt]').forEach(function (b) {
      b.onclick = function () { st.nbFilter = b.dataset.nbflt; renderSideBody(); };
    });
    body.querySelectorAll('[data-jump]').forEach(function (b) {
      b.onclick = async function () {
        var pg = Number(b.dataset.jump);
        st.flashAnnId = b.dataset.flash || '';
        if (window.innerWidth <= 980 && !b.dataset.openNote) { st.showSide = false; syncToolbarUi(); }
        await goToPage(pg);
        if (b.dataset.openNote) {
          st.sideTab = 'page-note';
          renderReaderShell();
          await renderCurrentPage();
        }
        setTimeout(function () { st.flashAnnId = ''; renderOverlays(); }, 2200);
      };
    });
    body.querySelectorAll('[data-editann]').forEach(function (b) {
      b.onclick = function () { openAnnotationModal(b.dataset.editann); };
    });
    body.querySelectorAll('[data-delann]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.delann;
        var target = st.bundle.annotations.filter(function (x) { return x.id === id; })[0];
        st.bundle.annotations = st.bundle.annotations.filter(function (x) { return x.id !== id; });
        await ST.deleteAnnotation(id);
        renderOverlays();
        if (target) refreshThumbBadges(target.page);
        renderSideBody();
        toast('تم الحذف');
      };
    });
  }

  function renderPageNoteTab(body) {
    var existing = st.bundle.notes.filter(function (n) { return n.page === st.page; })[0];
    var val = existing ? existing.content : '';
    var h = '';
    h += '<div class="ar-box"><h4>ملاحظة الصفحة رقم ' + st.page + '</h4>';
    h += '<textarea class="ar-textarea" id="arPageNoteIn" style="min-height:190px" placeholder="دوّن أفكارك أو ملخص هذه الصفحة… تُحفظ تلقائياً في جهازك">' + S.esc(val) + '</textarea>';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px">';
    h += '<span id="arPageNoteStatus" style="font-size:12px;color:var(--muted)">جاهز للحفظ التلقائي</span>';
    h += '<button type="button" class="ar-btn sm pri" id="arSavePageNoteBtn">حفظ الآن</button>';
    h += '</div></div>';

    if (st.bundle.notes.length) {
      h += '<div class="ar-box"><h4>كل صفحات الملاحظات (' + st.bundle.notes.length + ')</h4><div style="display:grid;gap:6px">';
      st.bundle.notes.forEach(function (n) {
        h += '<button type="button" class="ar-btn sm" style="justify-content:space-between" data-notepg="' + n.page + '"><span>صفحة ' + n.page + '</span><span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">' + S.esc(n.content) + '</span></button>';
      });
      h += '</div></div>';
    }

    body.innerHTML = h;
    var ta = body.querySelector('#arPageNoteIn');
    var status = body.querySelector('#arPageNoteStatus');

    async function persistNote(showToast) {
      var pg = st.page;
      var txt = ta.value;
      st.bundle.notes = st.bundle.notes.filter(function (n) { return n.page !== pg; });
      if (txt.trim()) {
        st.bundle.notes.push({ id: st.fileMeta.id + '::' + pg, fileId: st.fileMeta.id, page: pg, content: txt, updatedAt: Date.now() });
      }
      sortBundle();
      await ST.savePageNote(st.fileMeta.id, pg, txt);
      refreshThumbBadges(pg);
      if (status) status.textContent = 'تم الحفظ محلياً ✓';
      if (showToast) toast('تم حفظ ملاحظة الصفحة ' + pg);
    }

    ta.oninput = function () {
      if (status) status.textContent = 'جارٍ الحفظ…';
      clearTimeout(st.saveNoteTimer);
      st.saveNoteTimer = setTimeout(function () { persistNote(false); }, 450);
    };
    body.querySelector('#arSavePageNoteBtn').onclick = function () { persistNote(true); };
    body.querySelectorAll('[data-notepg]').forEach(function (b) {
      b.onclick = function () { goToPage(Number(b.dataset.notepg)); };
    });
  }

  function renderBookmarksTab(body) {
    var marks = st.bundle.bookmarks;
    var h = '<div class="ar-box"><h4>العلامات المرجعية (' + marks.length + ')</h4>';
    h += '<button type="button" class="ar-btn sm pri" id="arAddBmCur" style="width:100%;margin-bottom:10px">+ إضافة / تعديل علامة للصفحة ' + st.page + '</button>';
    if (!marks.length) {
      h += '<p class="ar-empty">لا توجد علامات مرجعية لهذا الملف بعد.</p>';
    } else {
      h += '<div style="display:grid;gap:8px">';
      marks.forEach(function (m) {
        h += '<div class="ar-ann-card" style="border-inline-start-color:var(--g)">';
        h += '<div class="ar-ann-top"><b>🔖 ' + S.esc(m.title) + '</b><span>صفحة ' + m.page + '</span></div>';
        h += '<div class="ar-ann-acts">';
        h += '<button type="button" class="ar-btn sm pri" data-bmjump="' + m.page + '">انتقال</button>';
        h += '<button type="button" class="ar-btn sm" data-bmedit="' + S.esc(m.id) + '" data-bmpg="' + m.page + '">تسمية</button>';
        h += '<button type="button" class="ar-btn sm danger" data-bmdel="' + S.esc(m.id) + '">حذف</button>';
        h += '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    body.innerHTML = h;

    body.querySelector('#arAddBmCur').onclick = function () { openBookmarkModal(st.page); };
    body.querySelectorAll('[data-bmjump]').forEach(function (b) {
      b.onclick = function () { goToPage(Number(b.dataset.bmjump)); };
    });
    body.querySelectorAll('[data-bmedit]').forEach(function (b) {
      b.onclick = function () { openBookmarkModal(Number(b.dataset.bmpg), b.dataset.bmedit); };
    });
    body.querySelectorAll('[data-bmdel]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.bmdel;
        var t = st.bundle.bookmarks.filter(function (x) { return x.id === id; })[0];
        st.bundle.bookmarks = st.bundle.bookmarks.filter(function (x) { return x.id !== id; });
        await ST.deleteBookmark(id);
        syncToolbarUi();
        if (t) refreshThumbBadges(t.page);
        renderSideBody();
        toast('تم حذف العلامة');
      };
    });
  }

  function renderExportTab(body) {
    var extracted = EX.extractHighlightsText(st.bundle);
    var h = '';
    h += '<div class="ar-box"><h4>استخراج ونسخ النصوص المظللة</h4>';
    h += '<textarea class="ar-textarea" id="arExtArea" readonly style="min-height:110px" placeholder="ستظهر هنا جميع النصوص التي قمت بتظليلها…">' + S.esc(extracted) + '</textarea>';
    h += '<button type="button" class="ar-btn sm pri" id="arCopyAllHl" style="width:100%;margin-top:8px"' + (extracted ? '' : ' disabled') + '>' + I.copy + '<span>نسخ جميع النصوص المظللة</span></button>';
    h += '</div>';

    h += '<div class="ar-box"><h4>تصدير دفتر الملاحظات والتظليلات</h4>';
    h += '<div style="display:grid;gap:8px">';
    h += '<button type="button" class="ar-btn sm" id="arExpTxt">' + I.dl + '<span>تصدير الدفتر إلى ملف TXT</span></button>';
    h += '<button type="button" class="ar-btn sm pri" id="arExpNbPdf">' + I.dl + '<span>تصدير الدفتر إلى ملف PDF عربي</span></button>';
    h += '</div></div>';

    h += '<div class="ar-box"><h4>تصدير نسخة PDF جديدة مع التظليلات</h4>';
    h += '<p style="font-size:12.5px;color:var(--muted);line-height:1.75;margin-bottom:8px">ينشئ ملف PDF جديداً تماماً يتضمن التظليلات الملونة والتعليقات، دون تعديل ملفك الأصلي.</p>';
    h += '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:6px;cursor:pointer"><input type="checkbox" id="arOptDrawLabels" checked><span>عرض ملخص التعليق الجانبي مرئياً على الصفحة</span></label>';
    h += '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="arOptAppendNb" checked><span>إلحاق صفحات دفتر الملاحظات نهاية الملف</span></label>';
    h += '<button type="button" class="ar-btn accent" id="arExpAnnotatedPdf" style="width:100%">' + I.dl + '<span>تصدير نسخة PDF المظلّلة</span></button>';
    h += '</div>';

    body.innerHTML = h;

    body.querySelector('#arCopyAllHl').onclick = async function () {
      if (!extracted) return;
      var ok = await copyText(extracted);
      toast(ok ? 'تم نسخ جميع النصوص المظللة ✓' : 'تعذّر النسخ');
    };
    body.querySelector('#arExpTxt').onclick = function () {
      EX.exportNotebookTxt(st.fileMeta, st.bundle);
      toast('تم تصدير دفتر الملاحظات TXT');
    };
    body.querySelector('#arExpNbPdf').onclick = async function () {
      if (st.busyExport) return;
      st.busyExport = true;
      toast('جارٍ إنشاء ملف PDF لدفتر الملاحظات…', 2500);
      try {
        await EX.exportNotebookPdf(st.fileMeta, st.bundle);
        toast('تم تصدير دفتر الملاحظات PDF ✓');
      } catch (e) {
        toast('تعذّر تصدير PDF: ' + (e && e.message ? e.message : ''), 3200);
      } finally { st.busyExport = false; }
    };
    body.querySelector('#arExpAnnotatedPdf').onclick = async function () {
      if (st.busyExport || !st.rawBytes) return;
      st.busyExport = true;
      var btn = body.querySelector('#arExpAnnotatedPdf');
      btn.disabled = true;
      toast('جارٍ تجهيز نسخة PDF الجديدة بالتظليلات…', 2800);
      try {
        await EX.exportAnnotatedPdf(st.rawBytes, st.fileMeta, st.bundle, {
          drawCommentLabels: !!body.querySelector('#arOptDrawLabels').checked,
          appendNotebook: !!body.querySelector('#arOptAppendNb').checked
        });
        toast('تم تصدير نسخة PDF الجديدة بنجاح ✓');
      } catch (e) {
        toast('تعذّر تصدير نسخة PDF: ' + (e && e.message ? e.message : ''), 3500);
      } finally {
        st.busyExport = false;
        btn.disabled = false;
      }
    };
  }

  /* ---------- نافذة منبثقة عامة للقارئ ---------- */
  var modalBg = null;
  function closeModal() {
    if (modalBg) { modalBg.remove(); modalBg = null; }
  }
  function openModal(innerHtml, onMount) {
    closeModal();
    modalBg = document.createElement('div');
    modalBg.className = 'ar-modal-bg';
    modalBg.innerHTML = '<div class="ar-modal" role="dialog" aria-modal="true">' + innerHtml + '</div>';
    modalBg.addEventListener('click', function (e) {
      if (e.target === modalBg || e.target.closest('[data-mclose]')) closeModal();
    });
    document.body.appendChild(modalBg);
    if (onMount) onMount(modalBg);
  }

  /* ---------- استجابة تغيير حجم الشاشة والأسهم ---------- */
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    if (st.mode !== 'reading') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (st.mode === 'reading' && (st.zoomMode === 'fit-width' || st.zoomMode === 'fit-page')) {
        renderCurrentPage();
      }
    }, 180);
  });

  window.addEventListener('keydown', function (e) {
    if (st.mode !== 'reading') return;
    if (modalBg) { if (e.key === 'Escape') closeModal(); return; }
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') goToPage(st.page + 1);
    else if (e.key === 'ArrowRight') goToPage(st.page - 1);
  });

  /* ---------- التهيئة العامة المرتبطة بـ tools.js ---------- */
  window.AcademicReader = {
    init: function (rootEl) {
      st.root = rootEl;
      refreshOfflineState();
      loadLibrary();
    },
    refresh: function () {
      if (!st.root) return;
      if (st.mode === 'reading') {
        closeActiveDoc();
        loadLibrary();
      } else {
        refreshOfflineState();
        loadLibrary();
      }
    }
  };
})();
