/* ==========================================================================
   other-majors.js — واجهة وتدفق «محاضرات باقي التخصصات الجامعية»
   - بوابة الاختيار في #v-lectures: (التربية البدنية والرياضية | باقي التخصصات الجامعية)
   - رفع منفصل (ملف واحد أو عدة صور مع معاينة وحذف)
   - استخراج محلي + محرر معاينة RTL قابل للتعديل + زر «متابعة» إلزامي
   - 7 أدوات تعليمية مستقلة + تحكم في عدد الأسئلة + مكتبة المحاضرات المحفوظة في IndexedDB
   ========================================================================== */
(function (root) {
  'use strict';

  var E = root.OtherEngine;
  if (!E) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var state = {
    initialized: false,
    phase: 'home', // 'home' | 'preview' | 'hub' | 'tool'
    activeTool: null,
    mode: 'file', // 'file' | 'images' (never mixed)
    selectedFile: null,
    selectedImages: [], // [{ file, url }]
    ocrLang: 'ara+eng',
    busy: false,
    cancelSignal: null,
    errorMsg: '',
    currentRecord: null,
    generated: null,
    chatScope: null,
    chatScopeHash: '',
    savedList: [],
    toastTimer: 0
  };

  /* ---- Toast & In-DOM Confirm Modal (No window.alert / window.confirm) ---- */
  function showToast(msg) {
    var t = $('omToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'omToast';
      t.className = 'om-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function showConfirm(title, message, confirmLabel, onConfirm) {
    var prev = $('omModalBg');
    if (prev) prev.remove();
    var bg = document.createElement('div');
    bg.id = 'omModalBg';
    bg.className = 'om-modal-bg';
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    bg.innerHTML =
      '<div class="om-modal">' +
        '<h3>' + esc(title) + '</h3>' +
        '<p>' + esc(message) + '</p>' +
        '<div class="tl-btns">' +
          '<button type="button" class="tl-btn" id="omModNo">إلغاء</button>' +
          '<button type="button" class="tl-btn del" id="omModYes">' + esc(confirmLabel || 'تأكيد') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); };
    $('omModNo').onclick = close;
    bg.onclick = function (e) { if (e.target === bg) close(); };
    $('omModYes').onclick = function () { close(); if (typeof onConfirm === 'function') onConfirm(); };
  }

  /* ---- Slider helper (mirrors index.html quiz slider cleanly) ---- */
  function createSlider(host, cfg) {
    var n = cfg.count, i = 0;
    host.innerHTML =
      '<div class="quiz">' +
        '<div class="qhead"><span class="qcount"></span><span class="qextra"></span></div>' +
        '<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + n + '"><i></i></div>' +
        '<div class="qstage"></div>' +
        '<div class="qnav">' +
          '<button class="qbtn qprev" type="button">→ السابق</button>' +
          '<button class="qbtn pri qnext" type="button"></button>' +
        '</div>' +
      '</div>';
    var box = host.firstChild;
    var stage = box.querySelector('.qstage');
    var cnt = box.querySelector('.qcount');
    var ext = box.querySelector('.qextra');
    var bar = box.querySelector('.pbar');
    var fill = bar.firstChild;
    var prev = box.querySelector('.qprev');
    var next = box.querySelector('.qnext');

    function head() { ext.textContent = cfg.extra ? cfg.extra() : ''; }
    function paint(node, dir) {
      stage.innerHTML = '';
      stage.appendChild(node);
      stage.style.setProperty('--dx', ((dir || 0) * 28) + 'px');
      stage.classList.remove('enter');
      void stage.offsetWidth;
      stage.classList.add('enter');
    }
    function show(k, dir) {
      i = Math.max(0, Math.min(n - 1, k));
      box.classList.remove('fin');
      cnt.textContent = (cfg.itemLabel || 'سؤال') + ' ' + (i + 1) + ' من ' + n;
      fill.style.width = (((i + 1) / n) * 100) + '%';
      bar.setAttribute('aria-valuenow', String(i + 1));
      prev.disabled = i === 0;
      next.textContent = i === n - 1 ? (cfg.lastLabel || 'إنهاء') : 'التالي ←';
      head();
      paint(cfg.render(i), dir || 0);
    }
    function finish() {
      box.classList.add('fin');
      cnt.textContent = 'النتيجة';
      fill.style.width = '100%';
      paint(cfg.summary({
        review: function () { show(0, 1); },
        restart: function () { cfg.reset && cfg.reset(); show(0, 1); }
      }), -1);
    }
    next.onclick = function () {
      if (i < n - 1) show(i + 1, -1);
      else if (cfg.summary) finish();
      else { cfg.reset && cfg.reset(); show(0, 1); }
    };
    prev.onclick = function () { show(i - 1, 1); };
    show(0, 0);
    return { refresh: head, show: show };
  }

  /* ---- Gate inside #v-lectures ---- */
  function showChooserGate() {
    var ch = $('lecChooserWrap');
    var eps = $('lecEpsWrap');
    if (ch) ch.hidden = false;
    if (eps) eps.hidden = true;
  }

  function showEpsSubjects() {
    var ch = $('lecChooserWrap');
    var eps = $('lecEpsWrap');
    if (ch) ch.hidden = true;
    if (eps) eps.hidden = false;
  }

  function bindLecturesGate() {
    var ch = $('lecChooserWrap');
    var eps = $('lecEpsWrap');
    if (!ch || !eps) return;

    var btnEps = $('goEpsBtn');
    var btnOth = $('goOtherBtn');
    var backToChooser = $('backLecChooser');

    if (btnEps) btnEps.onclick = function () { showEpsSubjects(); };
    if (btnOth) btnOth.onclick = function () { open(); };
    if (backToChooser) backToChooser.onclick = function () { showChooserGate(); };

    /* عند العودة من قائمة محاضرات مقياس ما (#v-list)، نُظهر بطاقات المقاييس مباشرة */
    var backFromList = document.querySelector('#v-list [data-go="lectures"]');
    if (backFromList) {
      backFromList.addEventListener('click', function () {
        showEpsSubjects();
      });
    }

    /* عند الضغط على تبويب «المحاضرات» في الشريط السفلي نُظهر خيارَي القسمين */
    var navLec = document.querySelector('#bnav [data-nav="lectures"]');
    if (navLec) {
      navLec.addEventListener('click', function () {
        showChooserGate();
      });
    }
  }

  /* ---- Persistence Helpers ---- */
  function refreshSavedList() {
    if (!E.Store.isSupported()) {
      state.savedList = [];
      return Promise.resolve([]);
    }
    return E.Store.list().then(function (list) {
      state.savedList = list;
      return list;
    }).catch(function () {
      state.savedList = [];
      return [];
    });
  }

  function saveCurrentRecord() {
    if (!state.currentRecord) return Promise.resolve(null);
    if (!E.Store.isSupported()) {
      showToast('تنبيه: المتصفح لا يدعم IndexedDB، لن يُحفظ التعديل بعد إغلاق الصفحة.');
      return Promise.resolve(state.currentRecord);
    }
    state.currentRecord.updatedAt = Date.now();
    return E.Store.put(state.currentRecord).then(function (rec) {
      return refreshSavedList().then(function () { return rec; });
    }).catch(function (err) {
      showToast(err.message || 'تعذّر الحفظ المحلي');
      throw err;
    });
  }

  function saveToolScore(toolKey, score, total) {
    if (!state.currentRecord) return;
    state.currentRecord.results = state.currentRecord.results || {};
    state.currentRecord.results[toolKey] = { score: score, total: total, ts: Date.now() };
    saveCurrentRecord().catch(function () {});
  }

  function clearSelectedImages() {
    state.selectedImages.forEach(function (it) {
      if (it.url) { try { URL.revokeObjectURL(it.url); } catch (e) {} }
    });
    state.selectedImages = [];
  }

  function deriveTitleFromName(name) {
    return String(name || 'محاضرة جديدة').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || 'محاضرة جديدة';
  }

  function getActiveText() {
    if (!state.currentRecord) return '';
    return state.currentRecord.editedText || state.currentRecord.extractedText || '';
  }

  function ensureGenerated() {
    if (!state.currentRecord) return null;
    var txt = getActiveText();
    var cm = state.currentRecord.questionCount || 'auto';
    if (!state.generated || state.generated._txt !== txt || state.generated._cm !== cm) {
      state.generated = E.generateAllTools(txt, cm);
      state.generated._txt = txt;
      state.generated._cm = cm;
    }
    return state.generated;
  }

  /* ---- Extraction Actions ---- */
  function startFileExtraction() {
    if (state.busy) return;
    if (!state.selectedFile) {
      state.errorMsg = 'يرجى اختيار ملف واحد أولاً.';
      render();
      return;
    }
    var file = state.selectedFile;
    var val = E.validateFile(file);
    if (!val.ok) {
      state.errorMsg = val.error;
      render();
      return;
    }
    state.busy = true;
    state.errorMsg = '';
    state.cancelSignal = { cancelled: false };
    render();
    setProgress(5, 'جارٍ قراءة الملف…');

    E.extractFromFile(file, {
      ocrLang: state.ocrLang,
      signal: state.cancelSignal,
      onProgress: function (p) { setProgress(p.pct, p.text); }
    }).then(function (text) {
      var now = Date.now();
      var rec = {
        id: E.uid('om'),
        title: deriveTitleFromName(file.name),
        sourceKind: 'file',
        fileMeta: { name: file.name, mime: file.type || '', size: file.size, ext: val.ext },
        originalBlob: file,
        imagesMeta: null,
        imageBlobs: null,
        extractedText: text,
        editedText: text,
        confirmed: false,
        questionCount: 'auto',
        results: {},
        createdAt: now,
        updatedAt: now
      };
      state.currentRecord = rec;
      state.generated = null;
      state.selectedFile = null;
      return saveCurrentRecord().catch(function () {});
    }).then(function () {
      state.busy = false;
      state.phase = 'preview';
      render();
      showToast('تم استخراج النص بنجاح. راجعه ثم اضغط «متابعة».');
    }).catch(function (err) {
      state.busy = false;
      state.errorMsg = (err && err.message) || 'تعذّر استخراج النص من الملف.';
      render();
    });
  }

  function startImagesExtraction() {
    if (state.busy) return;
    var files = state.selectedImages.map(function (it) { return it.file; });
    var val = E.validateImages(files);
    if (!val.ok) {
      state.errorMsg = val.error;
      render();
      return;
    }
    state.busy = true;
    state.errorMsg = '';
    state.cancelSignal = { cancelled: false };
    render();
    setProgress(5, 'جارٍ التحضير لاستخراج النصوص من الصور…');

    E.extractFromImages(files, {
      ocrLang: state.ocrLang,
      signal: state.cancelSignal,
      onProgress: function (p) { setProgress(p.pct, p.text); }
    }).then(function (text) {
      var now = Date.now();
      var rec = {
        id: E.uid('om'),
        title: files.length === 1 ? deriveTitleFromName(files[0].name) : ('محاضرة مصورة (' + files.length + ' صور)'),
        sourceKind: 'images',
        fileMeta: null,
        originalBlob: null,
        imagesMeta: files.map(function (f) { return { name: f.name, type: f.type || '', size: f.size }; }),
        imageBlobs: files.slice(),
        extractedText: text,
        editedText: text,
        confirmed: false,
        questionCount: 'auto',
        results: {},
        createdAt: now,
        updatedAt: now
      };
      state.currentRecord = rec;
      state.generated = null;
      clearSelectedImages();
      return saveCurrentRecord().catch(function () {});
    }).then(function () {
      state.busy = false;
      state.phase = 'preview';
      render();
      showToast('تم استخراج النصوص من الصور. راجعها ثم اضغط «متابعة».');
    }).catch(function (err) {
      state.busy = false;
      state.errorMsg = (err && err.message) || 'تعذّر استخراج النصوص من الصور.';
      render();
    });
  }

  function setProgress(pct, txt) {
    var fill = $('omProgFill');
    var lbl = $('omProgLbl');
    var pctEl = $('omProgPct');
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
    if (lbl) lbl.textContent = txt || '';
    if (pctEl) pctEl.textContent = Math.round(pct || 0) + '%';
  }

  /* ---- Render Screens ---- */
  function render() {
    var host = $('v-other');
    if (!host) return;
    if (state.phase === 'home') renderHome(host);
    else if (state.phase === 'preview') renderPreview(host);
    else if (state.phase === 'hub') renderHub(host);
    else if (state.phase === 'tool') renderTool(host);
  }

  function renderHome(host) {
    var idbWarn = !E.Store.isSupported()
      ? '<div class="tl-msg bad" style="max-width:820px;margin:0 auto 14px">المتصفح الحالي لا يدعم IndexedDB، لذلك لن تُحفظ الملفات والنتائج بعد إغلاق الصفحة.</div>'
      : '';

    var fileBox = '';
    if (state.mode === 'file') {
      var fileChip = state.selectedFile
        ? '<div class="om-file-card">' +
            '<span class="om-file-badge">' + esc(E.extOf(state.selectedFile.name).toUpperCase()) + '</span>' +
            '<div class="om-file-info"><b>' + esc(state.selectedFile.name) + '</b><small>' + esc(E.formatBytes(state.selectedFile.size)) + '</small></div>' +
            '<button type="button" class="tl-btn sm del" id="omClearFile" ' + (state.busy ? 'disabled' : '') + '>إزالة</button>' +
          '</div>'
        : '';
      fileBox =
        '<label class="om-drop" id="omFileDrop">' +
          '<input type="file" id="omFileInput" accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.rtf" hidden>' +
          '<span class="om-drop-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg></span>' +
          '<b>اضغط لاختيار ملف محاضرة واحد أو اسحبه هنا</b>' +
          '<small>يُسمح برفع ملف واحد فقط في كل جلسة (لا تُخلط الملفات مع الصور)</small>' +
          '<div class="om-formats">PDF • DOCX • DOC • PPTX • PPT • TXT • RTF</div>' +
        '</label>' +
        fileChip +
        '<div class="om-opts-row">' +
          '<label>لغة OCR للملفات المصوّرة:' +
            '<select class="om-sel" id="omLangSel" ' + (state.busy ? 'disabled' : '') + '>' +
              '<option value="ara+eng"' + (state.ocrLang === 'ara+eng' ? ' selected' : '') + '>العربية والإنجليزية</option>' +
              '<option value="ara"' + (state.ocrLang === 'ara' ? ' selected' : '') + '>العربية فقط</option>' +
              '<option value="eng"' + (state.ocrLang === 'eng' ? ' selected' : '') + '>الإنجليزية فقط</option>' +
            '</select>' +
          '</label>' +
          '<button type="button" class="tl-btn pri" id="omRunFile" ' + (!state.selectedFile || state.busy ? 'disabled' : '') + '>استخراج النص</button>' +
        '</div>';
    } else {
      var imgsHtml = state.selectedImages.length
        ? '<div class="om-img-grid">' + state.selectedImages.map(function (it, idx) {
            return '<div class="om-img-item">' +
              '<img src="' + esc(it.url) + '" alt="' + esc(it.file.name) + '">' +
              '<span class="om-img-num">' + (idx + 1) + '</span>' +
              '<button type="button" class="om-img-del" data-rm-img="' + idx + '" aria-label="حذف الصورة" ' + (state.busy ? 'disabled' : '') + '>✕</button>' +
              '<div class="om-img-meta">' + esc(it.file.name) + '</div>' +
            '</div>';
          }).join('') + '</div>'
        : '';
      fileBox =
        '<label class="om-drop" id="omImgDrop">' +
          '<input type="file" id="omImgInput" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple hidden>' +
          '<span class="om-drop-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>' +
          '<b>اضغط لاختيار عدة صور للمحاضرة أو اسحبها هنا</b>' +
          '<small>يمكنك معاينة الصور وترتيبها وحذف أي صورة غير مرغوبة قبل المعالجة</small>' +
          '<div class="om-formats">JPG • JPEG • PNG • WEBP</div>' +
        '</label>' +
        imgsHtml +
        '<div class="om-opts-row">' +
          '<label>لغة التعرف الضوئي (OCR):' +
            '<select class="om-sel" id="omLangSel" ' + (state.busy ? 'disabled' : '') + '>' +
              '<option value="ara+eng"' + (state.ocrLang === 'ara+eng' ? ' selected' : '') + '>العربية والإنجليزية</option>' +
              '<option value="ara"' + (state.ocrLang === 'ara' ? ' selected' : '') + '>العربية فقط</option>' +
              '<option value="eng"' + (state.ocrLang === 'eng' ? ' selected' : '') + '>الإنجليزية فقط</option>' +
            '</select>' +
          '</label>' +
          '<div class="tl-row">' +
            (state.selectedImages.length ? '<button type="button" class="tl-btn sm del" id="omClearImgs" ' + (state.busy ? 'disabled' : '') + '>مسح الكل</button>' : '') +
            '<button type="button" class="tl-btn pri" id="omRunImgs" ' + (!state.selectedImages.length || state.busy ? 'disabled' : '') + '>استخراج النصوص (' + state.selectedImages.length + ')</button>' +
          '</div>' +
        '</div>';
    }

    var progHtml = state.busy
      ? '<div class="om-prog">' +
          '<div class="om-prog-top"><span id="omProgLbl">جارٍ المعالجة…</span><b id="omProgPct">0%</b></div>' +
          '<div class="tl-bar"><i id="omProgFill" style="width:5%"></i></div>' +
          '<div class="tl-btns"><button type="button" class="tl-btn sm del" id="omCancelExtract">إلغاء المعالجة</button></div>' +
        '</div>'
      : '';

    var errHtml = state.errorMsg
      ? '<div class="tl-msg bad" role="alert">' + esc(state.errorMsg) + '</div>'
      : '';

    var libHtml = state.savedList.length
      ? '<div class="om-lib">' + state.savedList.map(function (rec) {
          var txt = rec.editedText || rec.extractedText || '';
          var words = txt ? txt.trim().split(/\s+/).filter(Boolean).length : 0;
          var kindLabel = rec.sourceKind === 'images'
            ? ('صور (' + ((rec.imagesMeta && rec.imagesMeta.length) || 0) + ')')
            : ('ملف ' + ((rec.fileMeta && rec.fileMeta.ext) || '').toUpperCase());
          var dt = '';
          try { dt = new Date(rec.updatedAt || rec.createdAt).toLocaleDateString('ar-DZ-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) {}
          return '<div class="om-lib-item">' +
            '<div class="om-lib-info">' +
              '<b>' + esc(rec.title || 'محاضرة بدون عنوان') + '</b>' +
              '<small>' + esc(kindLabel) + ' · ' + words + ' كلمة · ' + (rec.confirmed ? 'جاهزة للدراسة' : 'بانتظار المراجعة') + (dt ? ' · ' + esc(dt) : '') + '</small>' +
            '</div>' +
            '<div class="om-lib-acts">' +
              '<button type="button" class="tl-btn sm pri" data-open-rec="' + esc(rec.id) + '">' + (rec.confirmed ? 'فتح الدراسة' : 'معاينة ومتابعة') + '</button>' +
              '<button type="button" class="tl-btn sm" data-edit-rec="' + esc(rec.id) + '">تعديل النص</button>' +
              '<button type="button" class="tl-btn sm del" data-del-rec="' + esc(rec.id) + '">حذف</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="tl-empty">لا توجد محاضرات محفوظة بعد. ارفع ملفاً أو صوراً أعلاه للبدء محلياً دون اتصال بالإنترنت.</div>';

    host.innerHTML =
      '<div class="om-topbar"><button class="back" type="button" id="omBackToChoices">← العودة لاختيار القسم</button></div>' +
      '<h2 class="ptitle">باقي التخصصات الجامعية</h2>' +
      '<p class="om-sub">ارفع محاضرتك كملف أو صور، راجع النص المستخرج وعدّله، ثم استخدم أدوات الدراسة والتقييم السبعة محلياً بالكامل على جهازك.</p>' +
      idbWarn +
      '<section class="om-box">' +
        '<div class="om-box-h"><h3>1. اختيار طريقة إدخال المحاضرة</h3></div>' +
        '<div class="om-seg" role="tablist" aria-label="طريقة الإدخال">' +
          '<button type="button" class="om-seg-btn" id="omModeFile" role="tab" aria-selected="' + (state.mode === 'file') + '">رفع ملف واحد</button>' +
          '<button type="button" class="om-seg-btn" id="omModeImages" role="tab" aria-selected="' + (state.mode === 'images') + '">رفع صور متعددة</button>' +
        '</div>' +
        fileBox +
        progHtml +
        errHtml +
      '</section>' +
      '<section class="om-box">' +
        '<div class="om-box-h"><h3>محاضراتي المحفوظة محلياً (' + state.savedList.length + ')</h3></div>' +
        libHtml +
      '</section>';

    $('omBackToChoices').onclick = function () {
      if (state.busy) return;
      showChooserGate();
      if (typeof root._omGoLectures === 'function') root._omGoLectures();
      else {
        var navL = document.querySelector('#bnav [data-nav="lectures"]');
        if (navL) navL.click();
      }
    };

    $('omModeFile').onclick = function () {
      if (state.busy || state.mode === 'file') return;
      clearSelectedImages();
      state.mode = 'file';
      state.errorMsg = '';
      render();
    };
    $('omModeImages').onclick = function () {
      if (state.busy || state.mode === 'images') return;
      state.selectedFile = null;
      state.mode = 'images';
      state.errorMsg = '';
      render();
    };

    var langSel = $('omLangSel');
    if (langSel) langSel.onchange = function () { state.ocrLang = langSel.value; };

    if (state.mode === 'file') {
      var fIn = $('omFileInput');
      var fDrop = $('omFileDrop');
      if (fIn) {
        fIn.onchange = function () {
          if (!fIn.files || !fIn.files.length) return;
          if (fIn.files.length > 1) {
            state.errorMsg = 'يُسمح برفع ملف واحد فقط في كل مرة.';
            state.selectedFile = null;
            render();
            return;
          }
          var f = fIn.files[0];
          var val = E.validateFile(f);
          if (!val.ok) {
            state.errorMsg = val.error;
            state.selectedFile = null;
          } else {
            state.errorMsg = '';
            state.selectedFile = f;
          }
          render();
        };
      }
      if (fDrop) {
        fDrop.ondragover = function (e) { e.preventDefault(); fDrop.classList.add('drag'); };
        fDrop.ondragleave = function () { fDrop.classList.remove('drag'); };
        fDrop.ondrop = function (e) {
          e.preventDefault();
          fDrop.classList.remove('drag');
          if (state.busy) return;
          var dt = e.dataTransfer && e.dataTransfer.files;
          if (!dt || !dt.length) return;
          if (dt.length > 1) {
            state.errorMsg = 'يُسمح برفع ملف واحد فقط في هذه الطريقة.';
            render();
            return;
          }
          var f = dt[0];
          var val = E.validateFile(f);
          if (!val.ok) { state.errorMsg = val.error; state.selectedFile = null; }
          else { state.errorMsg = ''; state.selectedFile = f; }
          render();
        };
      }
      var clrF = $('omClearFile');
      if (clrF) clrF.onclick = function () { state.selectedFile = null; state.errorMsg = ''; render(); };
      var runF = $('omRunFile');
      if (runF) runF.onclick = startFileExtraction;
    } else {
      var iIn = $('omImgInput');
      var iDrop = $('omImgDrop');
      function addImages(fileList) {
        var added = Array.prototype.slice.call(fileList || []);
        var combined = state.selectedImages.map(function (x) { return x.file; }).concat(added);
        var val = E.validateImages(combined);
        if (!val.ok) {
          state.errorMsg = val.error;
          render();
          return;
        }
        state.errorMsg = '';
        added.forEach(function (f) {
          state.selectedImages.push({ file: f, url: URL.createObjectURL(f) });
        });
        render();
      }
      if (iIn) {
        iIn.onchange = function () {
          if (iIn.files && iIn.files.length) addImages(iIn.files);
        };
      }
      if (iDrop) {
        iDrop.ondragover = function (e) { e.preventDefault(); iDrop.classList.add('drag'); };
        iDrop.ondragleave = function () { iDrop.classList.remove('drag'); };
        iDrop.ondrop = function (e) {
          e.preventDefault();
          iDrop.classList.remove('drag');
          if (state.busy) return;
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addImages(e.dataTransfer.files);
        };
      }
      Array.prototype.forEach.call(host.querySelectorAll('[data-rm-img]'), function (btn) {
        btn.onclick = function () {
          var idx = parseInt(btn.getAttribute('data-rm-img'), 10);
          var rm = state.selectedImages.splice(idx, 1)[0];
          if (rm && rm.url) { try { URL.revokeObjectURL(rm.url); } catch (e) {} }
          state.errorMsg = '';
          render();
        };
      });
      var clrI = $('omClearImgs');
      if (clrI) clrI.onclick = function () { clearSelectedImages(); state.errorMsg = ''; render(); };
      var runI = $('omRunImgs');
      if (runI) runI.onclick = startImagesExtraction;
    }

    var cancelBtn = $('omCancelExtract');
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        if (state.cancelSignal) state.cancelSignal.cancelled = true;
      };
    }

    /* Library buttons */
    Array.prototype.forEach.call(host.querySelectorAll('[data-open-rec]'), function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-open-rec');
        E.Store.get(id).then(function (rec) {
          if (!rec) { showToast('تعذّر العثور على المحاضرة'); return; }
          state.currentRecord = rec;
          state.generated = null;
          state.phase = rec.confirmed ? 'hub' : 'preview';
          render();
        }).catch(function (err) { showToast(err.message || 'تعذّر فتح المحاضرة'); });
      };
    });

    Array.prototype.forEach.call(host.querySelectorAll('[data-edit-rec]'), function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-edit-rec');
        E.Store.get(id).then(function (rec) {
          if (!rec) return;
          state.currentRecord = rec;
          state.generated = null;
          state.phase = 'preview';
          render();
        }).catch(function (err) { showToast(err.message || 'تعذّر فتح المحاضرة'); });
      };
    });

    Array.prototype.forEach.call(host.querySelectorAll('[data-del-rec]'), function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-del-rec');
        showConfirm('حذف المحاضرة', 'هل تريد حذف هذه المحاضرة وملفاتها المحفوظة محلياً نهائياً؟', 'حذف نهائي', function () {
          E.Store.remove(id).then(function () {
            return refreshSavedList();
          }).then(function () {
            render();
            showToast('تم حذف المحاضرة من الجهاز');
          }).catch(function (err) { showToast(err.message || 'تعذّر الحذف'); });
        });
      };
    });
  }

  function renderPreview(host) {
    var rec = state.currentRecord;
    if (!rec) { state.phase = 'home'; render(); return; }
    var textVal = rec.editedText || rec.extractedText || '';
    var srcDesc = rec.sourceKind === 'images'
      ? ('مصدر النص: ' + ((rec.imagesMeta && rec.imagesMeta.length) || 0) + ' صورة')
      : ('مصدر النص: ' + ((rec.fileMeta && rec.fileMeta.name) || 'ملف'));

    host.innerHTML =
      '<div class="om-topbar">' +
        '<button class="back" type="button" id="omPrevBack">← العودة للمكتبة</button>' +
      '</div>' +
      '<h2 class="ptitle">معاينة وتعديل النص المستخرج</h2>' +
      '<p class="om-sub">راجع النص وصحّح أي أخطاء إملائية أو طباعية قبل المتابعة؛ سيتم اعتماد النص المعدّل كمصدر وحيد للأدوات السبعة.</p>' +
      '<section class="om-box">' +
        '<div class="om-box-h"><h3>عنوان المحاضرة ومحتواها</h3><small style="color:var(--muted)">' + esc(srcDesc) + '</small></div>' +
        '<input type="text" class="om-title-in" id="omEditTitle" maxlength="100" value="' + esc(rec.title || '') + '" placeholder="عنوان المحاضرة">' +
        '<textarea class="om-editor" id="omEditor" dir="rtl" spellcheck="true" placeholder="النص المستخرج من المحاضرة…">' + esc(textVal) + '</textarea>' +
        '<div class="om-stats-bar" id="omEditStats"></div>' +
        '<div id="omPrevErr"></div>' +
        '<div class="tl-btns">' +
          '<button type="button" class="tl-btn" id="omRestoreOrig">استعادة النص الأصلي المستخرج</button>' +
          '<button type="button" class="tl-btn pri" id="omContinue">متابعة إلى أدوات الدراسة السبعة ←</button>' +
        '</div>' +
      '</section>';

    var ed = $('omEditor');
    var ttl = $('omEditTitle');
    var statsEl = $('omEditStats');

    function updateStats() {
      var v = ed.value || '';
      var words = v.trim() ? v.trim().split(/\s+/).filter(Boolean).length : 0;
      var lines = v.trim() ? v.split('\n').filter(Boolean).length : 0;
      statsEl.innerHTML = '<span>الكلمات: ' + words + '</span><span>الأحرف: ' + v.length + '</span><span>الأسطر: ' + lines + '</span>';
    }
    updateStats();
    ed.oninput = updateStats;

    $('omPrevBack').onclick = function () {
      state.phase = 'home';
      refreshSavedList().then(render);
    };
    $('omRestoreOrig').onclick = function () {
      ed.value = rec.extractedText || '';
      updateStats();
      showToast('تمت استعادة النص الأصلي المستخرج');
    };
    $('omContinue').onclick = function () {
      var clean = E.cleanExtractedText(ed.value || '');
      if (!clean || clean.replace(/\s+/g, '').length < 20) {
        $('omPrevErr').innerHTML = '<div class="tl-msg bad">النص قصير جداً أو فارغ. يرجى كتابة أو استخراج نص كافٍ قبل المتابعة.</div>';
        return;
      }
      rec.title = (ttl.value || '').trim() || rec.title || 'محاضرتي';
      rec.editedText = clean;
      rec.confirmed = true;
      state.generated = null;
      state.chatScope = null;
      saveCurrentRecord().catch(function () {}).then(function () {
        state.phase = 'hub';
        render();
      });
    };
  }

  var TOOLS_META = [
    { key: 'chat', name: 'الشات – اسأل عن محاضرتك', desc: 'محادثة محلية تجيب من نص المحاضرة فقط وتعرض المصدر', ic: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M8 14h.01"/><path d="M16 14h.01"/>' },
    { key: 'faq', name: 'أسئلة عادية', desc: 'بطاقات سؤال وجواب تفاعلية من مفاهيم المحاضرة', ic: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>' },
    { key: 'mcq', name: 'أسئلة اختيار من متعدد', desc: 'اختبر فهمك بخيارات مشتقة من نفس النص فقط', ic: '<path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>' },
    { key: 'tf', name: 'صح أو خطأ', desc: 'عبارات دقيقة للتحقق السريع مع التصحيح والمصدر', ic: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
    { key: 'blank', name: 'أكمل الفراغ', desc: 'استرجع المصطلح المفقود في جمل المحاضرة الأصلية', ic: '<path d="M4 20h16"/><path d="m14.5 4.5 5 5L8 21H3v-5Z"/>' },
    { key: 'order', name: 'ترتيب العناصر', desc: 'رتّب المراحل أو الخطوات الواردة في المحاضرة بتسلسلها الصحيح', ic: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>' },
    { key: 'match', name: 'المطابقة', desc: 'صل كل مفهوم أو مصطلح بما يطابقه من شرح أو وظيفة', ic: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' }
  ];

  function renderHub(host) {
    var rec = state.currentRecord;
    if (!rec || !rec.confirmed) {
      state.phase = rec ? 'preview' : 'home';
      render();
      return;
    }
    var cm = rec.questionCount || 'auto';
    var gen = ensureGenerated();
    var counts = ['auto', 10, 20, 30, 50];

    host.innerHTML =
      '<div class="om-topbar">' +
        '<button class="back" type="button" id="omHubBack">← مكتبة المحاضرات</button>' +
        '<button class="back" type="button" id="omHubEdit">✎ تعديل نص المحاضرة</button>' +
      '</div>' +
      '<h2 class="ptitle">' + esc(rec.title || 'محاضرتي') + '</h2>' +
      '<section class="om-box">' +
        '<div class="om-count-box">' +
          '<div class="om-count-label">عدد الأسئلة المطلوب' +
            '<small>التلقائي يضبط العدد حسب طول النص وجودة المعلومات، دون اختلاق أو تكرار أسئلة.</small>' +
          '</div>' +
          '<div class="om-counts" role="group" aria-label="عدد الأسئلة">' +
            counts.map(function (v) {
              var pressed = String(cm) === String(v);
              return '<button type="button" class="om-cnt-btn" data-cm="' + v + '" aria-pressed="' + pressed + '">' + (v === 'auto' ? 'تلقائي' : v) + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div class="tl-hub lhub" id="omToolsGrid">' +
        TOOLS_META.map(function (t) {
          var badge = '';
          if (t.key === 'faq') badge = ' (' + gen.faq.items.length + ')';
          else if (t.key === 'mcq') badge = ' (' + gen.mcq.items.length + ')';
          else if (t.key === 'tf') badge = ' (' + gen.tf.items.length + ')';
          else if (t.key === 'blank') badge = ' (' + gen.blank.items.length + ')';
          else if (t.key === 'order') badge = ' (' + gen.order.items.length + ')';
          else if (t.key === 'match') badge = ' (' + gen.match.usedPairs + ' زوج)';
          return '<button type="button" class="tl-card" data-om-tool="' + t.key + '">' +
            '<span class="tl-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t.ic + '</svg></span>' +
            '<span class="tl-grow"><b>' + esc(t.name + badge) + '</b><small>' + esc(t.desc) + '</small></span>' +
            '<span class="tl-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></span>' +
          '</button>';
        }).join('') +
      '</div>';

    $('omHubBack').onclick = function () {
      state.phase = 'home';
      refreshSavedList().then(render);
    };
    $('omHubEdit').onclick = function () {
      state.phase = 'preview';
      render();
    };
    Array.prototype.forEach.call(host.querySelectorAll('[data-cm]'), function (btn) {
      btn.onclick = function () {
        var val = btn.getAttribute('data-cm');
        rec.questionCount = val === 'auto' ? 'auto' : parseInt(val, 10);
        state.generated = null;
        saveCurrentRecord().catch(function () {});
        render();
      };
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-om-tool]'), function (btn) {
      btn.onclick = function () {
        var key = btn.getAttribute('data-om-tool');
        if (key === 'chat') {
          openChatTool();
          return;
        }
        state.activeTool = key;
        state.phase = 'tool';
        render();
      };
    });
  }

  /* ---- Tool 1: Local Chat via AcadChat.openCustom ---- */
  function openChatTool() {
    var rec = state.currentRecord;
    if (!rec) return;
    if (!root.AcadChat || typeof root.AcadChat.openCustom !== 'function') {
      showToast('واجهة الشات غير جاهزة بعد.');
      return;
    }
    var txt = getActiveText();
    root.AcadChat.openCustom({
      id: rec.id,
      title: rec.title || 'محاضرتي',
      kicker: 'الشات – اسأل عن محاضرتك',
      buildScope: function () {
        if (!state.chatScope || state.chatScopeHash !== txt) {
          state.chatScope = E.buildChatScope(rec.id, rec.title || 'محاضرتي', txt);
          state.chatScopeHash = txt;
        }
        return state.chatScope;
      },
      answerFn: function (scope, q, opts) {
        return E.answerCustomChat(scope, txt, q, opts);
      }
    });
  }

  /* ---- Render Active Tool (2–7) ---- */
  function renderTool(host) {
    var rec = state.currentRecord;
    var gen = ensureGenerated();
    var meta = TOOLS_META.filter(function (x) { return x.key === state.activeTool; })[0];
    if (!rec || !gen || !meta) { state.phase = 'hub'; render(); return; }

    host.innerHTML =
      '<div class="om-topbar"><button class="back" type="button" id="omToolBack">← العودة للأدوات السبعة</button></div>' +
      '<h2 class="ptitle">' + esc(meta.name) + '</h2>' +
      '<div id="omToolNotice"></div>' +
      '<section class="panel" id="omToolPanel"></section>';

    $('omToolBack').onclick = function () { state.phase = 'hub'; render(); };

    var panel = $('omToolPanel');
    var noticeEl = $('omToolNotice');

    function setShortfallNotice(pack, unitWord) {
      if (!pack) return;
      if (pack.shortfall && pack.items.length > 0) {
        noticeEl.innerHTML =
          '<div class="om-notice">تم توليد <b>' + pack.items.length + '</b> ' + unitWord +
          ' عالي الجودة فقط من أصل ' + pack.requested + ' لأن حجم النص والمعلومات الموثقة المتوفرة لا يسمح بإنشاء أسئلة إضافية دون تكرار أو اختلاق.</div>';
      }
    }

    if (state.activeTool === 'faq') {
      setShortfallNotice(gen.faq, 'بطاقة سؤال وجواب');
      renderFaqTool(panel, gen.faq.items);
    } else if (state.activeTool === 'mcq') {
      setShortfallNotice(gen.mcq, 'سؤال اختيار من متعدد');
      renderMcqTool(panel, gen.mcq.items);
    } else if (state.activeTool === 'tf') {
      setShortfallNotice(gen.tf, 'عبارة صح أو خطأ');
      renderTfTool(panel, gen.tf.items);
    } else if (state.activeTool === 'blank') {
      setShortfallNotice(gen.blank, 'سؤال أكمل الفراغ');
      renderBlankTool(panel, gen.blank.items);
    } else if (state.activeTool === 'order') {
      setShortfallNotice(gen.order, 'تمرين ترتيب');
      renderOrderTool(panel, gen.order.items);
    } else if (state.activeTool === 'match') {
      if (gen.match.shortfall && gen.match.usedPairs > 0) {
        noticeEl.innerHTML =
          '<div class="om-notice">تم استخراج <b>' + gen.match.usedPairs + '</b> زوجاً واضحاً للمطابقة فقط من أصل ' + gen.match.requested + ' لتجنّب تكرار أو خلط المصطلحات.</div>';
      }
      renderMatchTool(panel, gen.match.items);
    }
  }

  /* ---- Tool 2: Flashcards ---- */
  function renderFaqTool(host, cards) {
    if (!cards.length) {
      host.innerHTML = '<div class="tl-empty">لم يتم العثور على تعريفات أو نقاط كافية لإنشاء بطاقات أسئلة وأجوبة واضحة من هذا النص.</div>';
      return;
    }
    createSlider(host, {
      count: cards.length,
      itemLabel: 'بطاقة',
      lastLabel: 'إعادة المراجعة ↺',
      render: function (i) {
        var f = cards[i];
        var el = document.createElement('div');
        el.className = 'fc';
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-pressed', 'false');
        el.innerHTML =
          '<div class="fc-in">' +
            '<div class="fc-face fc-front">' +
              '<span class="fc-cat">' + esc(f.cat || 'سؤال') + '</span>' +
              '<div class="fc-txt"><div class="fc-q">' + esc(f.q) + '</div></div>' +
              '<span class="fc-hint">اضغط لإظهار الإجابة</span>' +
            '</div>' +
            '<div class="fc-face fc-back" aria-hidden="true">' +
              '<span class="fc-cat">الإجابة من المحاضرة</span>' +
              '<div class="fc-txt"><div class="fc-a">' + esc(f.a) + '</div></div>' +
              '<span class="fc-hint">اضغط للعودة إلى السؤال</span>' +
            '</div>' +
          '</div>';
        var front = el.querySelector('.fc-front');
        var back = el.querySelector('.fc-back');
        function flip() {
          var on = el.classList.toggle('on');
          el.setAttribute('aria-pressed', String(on));
          front.setAttribute('aria-hidden', String(on));
          back.setAttribute('aria-hidden', String(!on));
        }
        el.onclick = flip;
        el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
        return el;
      }
    });
  }

  /* ---- Tool 3: MCQ ---- */
  function renderMcqTool(host, Q) {
    if (!Q.length) {
      host.innerHTML = '<div class="tl-empty">النص لا يحتوي على مفاهيم وعناصر متعددة كافية لتكوين أسئلة اختيار من متعدد مع مشتّتات دقيقة من نفس النص.</div>';
      return;
    }
    var ans = Q.map(function () { return null; });
    var sl;
    function right() { return ans.filter(function (a, i) { return a === Q[i].a; }).length; }
    function done() { return ans.filter(function (a) { return a !== null; }).length; }

    sl = createSlider(host, {
      count: Q.length,
      lastLabel: 'إنهاء الاختبار',
      reset: function () { ans = Q.map(function () { return null; }); },
      extra: function () { return done() ? ('الصحيحة: ' + right()) : ''; },
      render: function (i) {
        var x = Q[i];
        var el = document.createElement('div');
        el.innerHTML =
          '<div class="mq-q">' + esc(x.q) + '</div>' +
          '<div class="mq-o">' + x.o.map(function (o, j) {
            return '<button class="opt" type="button" data-j="' + j + '">' + esc(o) + '</button>';
          }).join('') + '</div>' +
          '<div class="om-src" hidden><b>المصدر من النص:</b><span>' + esc(x.source) + '</span></div>';
        var btns = el.querySelectorAll('.opt');
        var srcBox = el.querySelector('.om-src');
        function mark() {
          var a = ans[i];
          if (a === null) return;
          Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
          btns[x.a].classList.add('ok');
          if (a !== x.a) btns[a].classList.add('no');
          srcBox.hidden = false;
        }
        Array.prototype.forEach.call(btns, function (b) {
          b.onclick = function () {
            ans[i] = parseInt(b.getAttribute('data-j'), 10);
            mark();
            sl.refresh();
          };
        });
        mark();
        return el;
      },
      summary: function (act) {
        var r = right(), n = Q.length, pc = (r / n) * 100;
        if (done()) saveToolScore('mcq', r, n);
        var el = document.createElement('div');
        el.className = 'sum';
        el.innerHTML =
          '<div class="big">' + r + ' / ' + n + '</div>' +
          '<div>' + (pc >= 80 ? 'ممتاز! أداء رائع' : pc >= 50 ? 'جيد، واصل المراجعة' : 'راجع المحاضرة وأعد المحاولة') + '</div>' +
          '<div class="st"><span>صحيحة: ' + r + '</span><span>خاطئة: ' + (done() - r) + '</span><span>دون إجابة: ' + (n - done()) + '</span></div>' +
          '<div class="acts"><button class="qbtn" type="button" data-a="review">مراجعة الأسئلة</button><button class="qbtn pri" type="button" data-a="restart">إعادة الاختبار</button></div>';
        el.querySelector('[data-a="review"]').onclick = act.review;
        el.querySelector('[data-a="restart"]').onclick = act.restart;
        return el;
      }
    });
  }

  /* ---- Tool 4: True / False ---- */
  function renderTfTool(host, items) {
    if (!items.length) {
      host.innerHTML = '<div class="tl-empty">لم يتم العثور على جمل واضحة ومكتملة لإنشاء أسئلة صح أو خطأ من هذا النص.</div>';
      return;
    }
    var ans = items.map(function () { return null; });
    var sl;
    function right() { return ans.filter(function (a, i) { return a === items[i].answer; }).length; }
    function done() { return ans.filter(function (a) { return a !== null; }).length; }

    sl = createSlider(host, {
      count: items.length,
      itemLabel: 'عبارة',
      lastLabel: 'إنهاء التمرين',
      reset: function () { ans = items.map(function () { return null; }); },
      extra: function () { return done() ? ('الصحيحة: ' + right()) : ''; },
      render: function (i) {
        var item = items[i];
        var el = document.createElement('div');
        el.innerHTML =
          '<div class="mq-q">' + esc(item.statement) + '</div>' +
          '<div class="om-tf-grid">' +
            '<button type="button" class="opt om-tf-btn" data-tf="true">صح ✓</button>' +
            '<button type="button" class="opt om-tf-btn" data-tf="false">خطأ ✗</button>' +
          '</div>' +
          '<div class="om-tf-note" hidden></div>' +
          '<div class="om-src" hidden><b>المصدر من المحاضرة:</b><span>' + esc(item.source) + '</span></div>';

        var bTrue = el.querySelector('[data-tf="true"]');
        var bFalse = el.querySelector('[data-tf="false"]');
        var note = el.querySelector('.om-tf-note');
        var src = el.querySelector('.om-src');

        function mark() {
          var a = ans[i];
          if (a === null) return;
          bTrue.disabled = true;
          bFalse.disabled = true;
          var okBtn = item.answer ? bTrue : bFalse;
          var pickBtn = a ? bTrue : bFalse;
          okBtn.classList.add('ok');
          if (a !== item.answer) pickBtn.classList.add('no');
          note.hidden = false;
          note.className = 'om-tf-note ' + (a === item.answer ? 'ok' : 'bad');
          note.textContent = item.correction;
          src.hidden = false;
        }
        bTrue.onclick = function () { ans[i] = true; mark(); sl.refresh(); };
        bFalse.onclick = function () { ans[i] = false; mark(); sl.refresh(); };
        mark();
        return el;
      },
      summary: function (act) {
        var r = right(), n = items.length;
        if (done()) saveToolScore('tf', r, n);
        var el = document.createElement('div');
        el.className = 'sum';
        el.innerHTML =
          '<div class="big">' + r + ' / ' + n + '</div>' +
          '<div>' + (r / n >= 0.8 ? 'ممتاز!' : 'راجع العبارات التي أخطأت فيها') + '</div>' +
          '<div class="st"><span>صحيحة: ' + r + '</span><span>خاطئة: ' + (done() - r) + '</span><span>دون إجابة: ' + (n - done()) + '</span></div>' +
          '<div class="acts"><button class="qbtn" type="button" data-a="review">مراجعة</button><button class="qbtn pri" type="button" data-a="restart">إعادة</button></div>';
        el.querySelector('[data-a="review"]').onclick = act.review;
        el.querySelector('[data-a="restart"]').onclick = act.restart;
        return el;
      }
    });
  }

  /* ---- Tool 5: Fill in the Blank ---- */
  function renderBlankTool(host, items) {
    if (!items.length) {
      host.innerHTML = '<div class="tl-empty">لم يتم العثور على جمل تحتوي على مصطلحات مناسبة لتمارين أكمل الفراغ.</div>';
      return;
    }
    var stateArr = items.map(function () { return { val: '', checked: false, ok: false }; });
    var sl;
    function right() { return stateArr.filter(function (s) { return s.checked && s.ok; }).length; }
    function done() { return stateArr.filter(function (s) { return s.checked; }).length; }

    sl = createSlider(host, {
      count: items.length,
      lastLabel: 'إنهاء التمرين',
      reset: function () { stateArr = items.map(function () { return { val: '', checked: false, ok: false }; }); },
      extra: function () { return done() ? ('الصحيحة: ' + right()) : ''; },
      render: function (i) {
        var item = items[i];
        var st = stateArr[i];
        var el = document.createElement('div');
        el.innerHTML =
          '<div class="om-blank-sent">' +
            esc(item.before) +
            '<span class="om-blank-gap">' + (st.checked ? esc(item.answer) : '______') + '</span>' +
            esc(item.after) +
          '</div>' +
          '<form class="om-blank-form">' +
            '<input type="text" dir="auto" placeholder="اكتب الكلمة أو المصطلح المفقود…" value="' + esc(st.val) + '" ' + (st.checked ? 'disabled' : '') + '>' +
            '<button type="submit" class="tl-btn pri" ' + (st.checked ? 'disabled' : '') + '>تحقق من الإجابة</button>' +
          '</form>' +
          '<div class="om-tf-note" hidden></div>' +
          '<div class="om-src" hidden><b>الجملة الأصلية:</b><span>' + esc(item.source) + '</span></div>';

        var form = el.querySelector('.om-blank-form');
        var input = form.querySelector('input');
        var btn = form.querySelector('button');
        var gap = el.querySelector('.om-blank-gap');
        var note = el.querySelector('.om-tf-note');
        var src = el.querySelector('.om-src');

        function paintChecked() {
          if (!st.checked) return;
          input.disabled = true;
          btn.disabled = true;
          gap.textContent = item.answer;
          note.hidden = false;
          note.className = 'om-tf-note ' + (st.ok ? 'ok' : 'bad');
          note.textContent = st.ok
            ? ('إجابة صحيحة ✓ (' + item.answer + ')')
            : ('إجابتك: «' + (st.val || 'فارغ') + '» — الكلمة الصحيحة هي: «' + item.answer + '»');
          src.hidden = false;
        }

        form.onsubmit = function (e) {
          e.preventDefault();
          if (st.checked) return;
          var raw = (input.value || '').trim();
          if (!raw) {
            showToast('اكتب إجابتك أولاً');
            input.focus();
            return;
          }
          st.val = raw;
          st.checked = true;
          var nu = E.normAr(raw);
          st.ok = item.accept.indexOf(nu) !== -1 || nu === E.normAr(item.answer);
          paintChecked();
          sl.refresh();
        };
        paintChecked();
        return el;
      },
      summary: function (act) {
        var r = right(), n = items.length;
        if (done()) saveToolScore('blank', r, n);
        var el = document.createElement('div');
        el.className = 'sum';
        el.innerHTML =
          '<div class="big">' + r + ' / ' + n + '</div>' +
          '<div>' + (r / n >= 0.75 ? 'أداء ممتاز في استرجاع المصطلحات!' : 'راجع النقاط التي فاتتك ثم أعد المحاولة') + '</div>' +
          '<div class="st"><span>صحيحة: ' + r + '</span><span>خاطئة: ' + (done() - r) + '</span><span>دون إجابة: ' + (n - done()) + '</span></div>' +
          '<div class="acts"><button class="qbtn" type="button" data-a="review">مراجعة</button><button class="qbtn pri" type="button" data-a="restart">إعادة</button></div>';
        el.querySelector('[data-a="review"]').onclick = act.review;
        el.querySelector('[data-a="restart"]').onclick = act.restart;
        return el;
      }
    });
  }

  /* ---- Tool 6: Ordering ---- */
  function renderOrderTool(host, sequences) {
    if (!sequences.length) {
      host.innerHTML =
        '<div class="tl-empty">' +
          '<b style="display:block;color:var(--g);margin-bottom:6px">لا يوجد تسلسل أو خطوات مرتبة واضحة في هذا النص</b>' +
          'أداة «ترتيب العناصر» تعمل فقط عندما تتضمن المحاضرة مراحل أو خطوات أو أحداثاً مرتبة صراحةً (مثل: أولاً، ثانياً، أو قوائم مرقمة 1، 2، 3 أو تسلسل زمني).' +
        '</div>';
      return;
    }
    var userOrders = sequences.map(function (s) { return { order: s.shuffledIndices.slice(), checked: false, ok: false }; });
    var sl;
    function right() { return userOrders.filter(function (u) { return u.checked && u.ok; }).length; }
    function done() { return userOrders.filter(function (u) { return u.checked; }).length; }

    sl = createSlider(host, {
      count: sequences.length,
      itemLabel: 'تمرين',
      lastLabel: 'عرض النتيجة',
      reset: function () {
        userOrders = sequences.map(function (s) { return { order: s.shuffledIndices.slice(), checked: false, ok: false }; });
      },
      extra: function () { return done() ? ('الصحيحة: ' + right()) : ''; },
      render: function (i) {
        var seq = sequences[i];
        var st = userOrders[i];
        var el = document.createElement('div');

        function drawList() {
          var listHtml = st.order.map(function (origIdx, pos) {
            var cls = st.checked ? (origIdx === pos ? ' ok' : ' no') : '';
            return '<div class="om-ord-item' + cls + '">' +
              '<span class="om-ord-num">' + (pos + 1) + '</span>' +
              '<span class="om-ord-txt">' + esc(seq.correctItems[origIdx]) + '</span>' +
              '<div class="om-ord-ctl">' +
                '<button type="button" class="om-ord-mv" data-mv="up" data-pos="' + pos + '" ' + (st.checked || pos === 0 ? 'disabled' : '') + ' aria-label="تحريك للأعلى">↑</button>' +
                '<button type="button" class="om-ord-mv" data-mv="down" data-pos="' + pos + '" ' + (st.checked || pos === st.order.length - 1 ? 'disabled' : '') + ' aria-label="تحريك للأسفل">↓</button>' +
              '</div>' +
            '</div>';
          }).join('');

          var noteHtml = '';
          if (st.checked) {
            noteHtml = '<div class="om-tf-note ' + (st.ok ? 'ok' : 'bad') + '">' +
              (st.ok ? 'الترتيب صحيح بالكامل ✓' : 'توجد عناصر في غير موضعها الصحيح. الترتيب الصحيح أدناه:') +
              '</div>' +
              '<div class="om-src"><b>الترتيب الصحيح من المحاضرة:</b><span>' +
                seq.correctItems.map(function (it, idx) { return (idx + 1) + ') ' + esc(it); }).join('<br>') +
              '</span></div>';
          }

          el.innerHTML =
            '<div class="mq-q">' + esc(seq.title) + '</div>' +
            '<div class="om-ord-list">' + listHtml + '</div>' +
            '<button type="button" class="tl-btn pri" id="omCheckOrd" ' + (st.checked ? 'disabled' : '') + '>تحقق من الترتيب</button>' +
            noteHtml;

          Array.prototype.forEach.call(el.querySelectorAll('.om-ord-mv'), function (b) {
            b.onclick = function () {
              if (st.checked) return;
              var pos = parseInt(b.getAttribute('data-pos'), 10);
              var dir = b.getAttribute('data-mv') === 'up' ? -1 : 1;
              var nxt = pos + dir;
              if (nxt < 0 || nxt >= st.order.length) return;
              var tmp = st.order[pos];
              st.order[pos] = st.order[nxt];
              st.order[nxt] = tmp;
              drawList();
            };
          });
          var chk = el.querySelector('#omCheckOrd');
          if (chk) {
            chk.onclick = function () {
              st.checked = true;
              st.ok = st.order.every(function (v, idx) { return v === idx; });
              drawList();
              sl.refresh();
            };
          }
        }
        drawList();
        return el;
      },
      summary: function (act) {
        var r = right(), n = sequences.length;
        if (done()) saveToolScore('order', r, n);
        var el = document.createElement('div');
        el.className = 'sum';
        el.innerHTML =
          '<div class="big">' + r + ' / ' + n + '</div>' +
          '<div>' + (r === n ? 'ممتاز! أتقنت ترتيب المراحل' : 'راجع الترتيب الصحيح وأعد المحاولة') + '</div>' +
          '<div class="acts"><button class="qbtn" type="button" data-a="review">مراجعة</button><button class="qbtn pri" type="button" data-a="restart">إعادة</button></div>';
        el.querySelector('[data-a="review"]').onclick = act.review;
        el.querySelector('[data-a="restart"]').onclick = act.restart;
        return el;
      }
    });
  }

  /* ---- Tool 7: Matching ---- */
  function renderMatchTool(host, rounds) {
    if (!rounds.length) {
      host.innerHTML = '<div class="tl-empty">النص لا يحتوي على أزواج واضحة كافية (مصطلح ↔ شرح/وظيفة) لتكوين تمرين مطابقة.</div>';
      return;
    }
    var roundStates = rounds.map(function (rd) {
      return { map: {}, selLeft: null, checked: false, score: 0, total: rd.pairs.length };
    });
    var sl;
    function totalRight() { return roundStates.reduce(function (s, r) { return s + (r.checked ? r.score : 0); }, 0); }
    function totalPairs() { return roundStates.reduce(function (s, r) { return s + r.total; }, 0); }
    function anyDone() { return roundStates.some(function (r) { return r.checked; }); }

    sl = createSlider(host, {
      count: rounds.length,
      itemLabel: 'مجموعة',
      lastLabel: 'إنهاء المطابقة',
      reset: function () {
        roundStates = rounds.map(function (rd) {
          return { map: {}, selLeft: null, checked: false, score: 0, total: rd.pairs.length };
        });
      },
      extra: function () { return anyDone() ? ('المطابقات الصحيحة: ' + totalRight()) : ''; },
      render: function (i) {
        var rd = rounds[i];
        var st = roundStates[i];
        var el = document.createElement('div');

        function draw() {
          var leftUsedBadge = {};
          var rightToLeft = {};
          Object.keys(st.map).forEach(function (lIdx) {
            var rIdx = st.map[lIdx];
            if (rIdx != null) {
              leftUsedBadge[lIdx] = parseInt(lIdx, 10) + 1;
              rightToLeft[rIdx] = parseInt(lIdx, 10);
            }
          });

          var leftCol = rd.pairs.map(function (p, lIdx) {
            var cls = 'om-match-card';
            if (st.selLeft === lIdx) cls += ' sel';
            if (st.map[lIdx] != null) cls += ' paired';
            if (st.checked) cls += (st.map[lIdx] === lIdx ? ' ok' : ' no');
            return '<button type="button" class="' + cls + '" data-left="' + lIdx + '" ' + (st.checked ? 'disabled' : '') + '>' +
              '<span>' + esc(p.left) + '</span>' +
              '<span class="om-pair-badge">' + (lIdx + 1) + '</span>' +
            '</button>';
          }).join('');

          var rightCol = rd.rightOrder.map(function (rOrigIdx) {
            var linkedLeft = rightToLeft[rOrigIdx];
            var cls = 'om-match-card';
            if (linkedLeft != null) cls += ' paired';
            if (st.checked) cls += (linkedLeft === rOrigIdx ? ' ok' : ' no');
            return '<button type="button" class="' + cls + '" data-right="' + rOrigIdx + '" ' + (st.checked ? 'disabled' : '') + '>' +
              '<span>' + esc(rd.pairs[rOrigIdx].right) + '</span>' +
              (linkedLeft != null ? '<span class="om-pair-badge">' + (linkedLeft + 1) + '</span>' : '') +
            '</button>';
          }).join('');

          var ansCount = Object.keys(st.map).length;
          var reviewHtml = '';
          if (st.checked) {
            reviewHtml =
              '<div class="om-tf-note ' + (st.score === st.total ? 'ok' : 'bad') + '">' +
                'النتيجة في هذه المجموعة: ' + st.score + ' من ' + st.total +
              '</div>' +
              '<div class="om-src"><b>المطابقات الصحيحة من المحاضرة:</b><span>' +
                rd.pairs.map(function (p, idx) { return (idx + 1) + ') <u>' + esc(p.left) + '</u> ↔ ' + esc(p.right); }).join('<br>') +
              '</span></div>';
          }

          el.innerHTML =
            '<div class="mq-q" style="font-size:16px">اختر مصطلحاً من العمود الأول ثم اضغط على الشرح المناسب له في العمود الثاني:</div>' +
            '<div class="om-match-grid">' +
              '<div class="om-match-col"><div class="om-match-col-h">المصطلح / العنصر</div>' + leftCol + '</div>' +
              '<div class="om-match-col"><div class="om-match-col-h">التعريف / الوصف</div>' + rightCol + '</div>' +
            '</div>' +
            '<div class="tl-btns">' +
              '<button type="button" class="tl-btn" id="omResetPair" ' + (st.checked || !ansCount ? 'disabled' : '') + '>إعادة التعيين</button>' +
              '<button type="button" class="tl-btn pri" id="omCheckMatch" ' + (st.checked || ansCount < rd.pairs.length ? 'disabled' : '') + '>تحقق من المطابقة (' + ansCount + '/' + rd.pairs.length + ')</button>' +
            '</div>' +
            reviewHtml;

          Array.prototype.forEach.call(el.querySelectorAll('[data-left]'), function (b) {
            b.onclick = function () {
              var lIdx = parseInt(b.getAttribute('data-left'), 10);
              st.selLeft = (st.selLeft === lIdx) ? null : lIdx;
              draw();
            };
          });
          Array.prototype.forEach.call(el.querySelectorAll('[data-right]'), function (b) {
            b.onclick = function () {
              var rIdx = parseInt(b.getAttribute('data-right'), 10);
              if (st.selLeft === null) {
                /* إن كان مرتبطاً مسبقاً، فك الارتباط لتسهيل التعديل */
                Object.keys(st.map).forEach(function (k) { if (st.map[k] === rIdx) delete st.map[k]; });
                draw();
                return;
              }
              Object.keys(st.map).forEach(function (k) { if (st.map[k] === rIdx) delete st.map[k]; });
              st.map[st.selLeft] = rIdx;
              st.selLeft = null;
              draw();
            };
          });
          var rst = el.querySelector('#omResetPair');
          if (rst) rst.onclick = function () { st.map = {}; st.selLeft = null; draw(); };
          var chk = el.querySelector('#omCheckMatch');
          if (chk) {
            chk.onclick = function () {
              st.checked = true;
              st.score = rd.pairs.filter(function (_, idx) { return st.map[idx] === idx; }).length;
              draw();
              sl.refresh();
            };
          }
        }
        draw();
        return el;
      },
      summary: function (act) {
        var r = totalRight(), n = totalPairs();
        if (anyDone()) saveToolScore('match', r, n);
        var el = document.createElement('div');
        el.className = 'sum';
        el.innerHTML =
          '<div class="big">' + r + ' / ' + n + '</div>' +
          '<div>' + (r / n >= 0.8 ? 'ممتاز! مطابقات دقيقة' : 'راجع المطابقات وأعد المحاولة') + '</div>' +
          '<div class="acts"><button class="qbtn" type="button" data-a="review">مراجعة</button><button class="qbtn pri" type="button" data-a="restart">إعادة</button></div>';
        el.querySelector('[data-a="review"]').onclick = act.review;
        el.querySelector('[data-a="restart"]').onclick = act.restart;
        return el;
      }
    });
  }

  /* ---- Entry Points ---- */
  function open() {
    if (typeof root._omGoOther === 'function') root._omGoOther();
    state.phase = 'home';
    state.errorMsg = '';
    refreshSavedList().then(render);
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    bindLecturesGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.OtherMajors = {
    init: init,
    open: open,
    showChooserGate: showChooserGate,
    showEpsSubjects: showEpsSubjects,
    _state: state
  };
})(window);
