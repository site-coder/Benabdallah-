/* ==========================================================================
   pdflab.js — مختبر ملفات PDF (محلي 100% ودون إنترنت)
   المجموعات الوظيفية:
   أ. إدارة الصفحات والملفات:
      - دمج عدة ملفات PDF
      - تقسيم ملف PDF إلى عدة ملفات (نطاقات مخصصة أو كل N صفحات)
      - تنظيم الصفحات: استخراج، حذف، إعادة ترتيب بالسحب/اللمس، تدوير، تكرار،
        واستخراج كل صفحة في ملف مستقل (فردي أو ZIP)
   ب. أدوات التنسيق:
      - ترقيم الصفحات (مواضع 6، حجم، لون، شكل، بداية الترقيم، استثناء الغلاف + معاينة)
      - العلامات المائية (نص عربي/إنجليزي أو صورة، حجم، لون، شفافية، ميلان، تكرار + معاينة)
   ج. أدوات إضافية:
      - تحويل صور JPG/PNG إلى PDF
      - تحويل صفحات PDF إلى صور PNG/JPG (+ ZIP)
      - ضغط ملفات PDF محلياً (هيكلي دون فقدان أو ضغط صوري مع مقارنة الحجم)
      - فحص وتعديل معلومات وبيانات PDF الوصفية
      - إضافة نصوص وصور/تواقيع على صفحات PDF بالنقر على المعاينة
      - إضافة رأس وتذييل للصفحات مع {page} و {total} + معاينة حية
   ========================================================================== */
(function () {
  'use strict';

  var S = window.PDFShared;

  function ic(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  var I = {
    upload: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    rotR: ic('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
    dup: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>')
  };

  var GROUPS = [
    {
      id: 'pages',
      title: 'أ. إدارة الصفحات والملفات',
      tools: [
        { id: 'merge', label: 'دمج ملفات PDF' },
        { id: 'split', label: 'تقسيم ملف PDF' },
        { id: 'organize', label: 'إدارة الصفحات (ترتيب/حذف/تدوير/استخراج/تكرار)' }
      ]
    },
    {
      id: 'format',
      title: 'ب. أدوات التنسيق',
      tools: [
        { id: 'number', label: 'ترقيم الصفحات' },
        { id: 'watermark', label: 'العلامات المائية' }
      ]
    },
    {
      id: 'extra',
      title: 'ج. أدوات إضافية',
      tools: [
        { id: 'img2pdf', label: 'صور إلى PDF' },
        { id: 'pdf2img', label: 'PDF إلى صور' },
        { id: 'compress', label: 'ضغط ملف PDF' },
        { id: 'meta', label: 'معلومات وبيانات PDF' },
        { id: 'annotate', label: 'إضافة نصوص وصور' },
        { id: 'headerfooter', label: 'رأس وتذييل الصفحات' }
      ]
    }
  ];

  var LAB_OFFLINE_ASSETS = ['./pdf-shared.js', './pdflab.css', './pdflab.js'];

  var st = {
    root: null,
    group: 'pages',
    tool: 'merge',
    offlineState: 'checking',
    offlineMsg: 'جارٍ فحص المكتبات المحلية…',

    /* حالة دمج الملفات */
    mergeFiles: [], /* { id, name, size, pages, bytes } */
    mergeOutName: 'ملف-مدمج.pdf',

    /* حالة الملف المشترك الفردي للتقسيم/التنظيم/التنسيق/التحويل/الضغط/المعلومات/الإضافة */
    activePdf: null, /* { name, size, bytes, numPages, doc } */
    busy: false,

    /* تقسيم */
    splitMode: 'ranges', /* ranges | every */
    splitRanges: '1-2; 3-4',
    splitEvery: 2,
    splitResults: [], /* { name, bytes, pageCount } */

    /* استوديو تنظيم الصفحات */
    orgItems: [], /* { id, origPage, rot, selected, thumbUrl } */
    orgExtractRange: '',

    /* ترقيم الصفحات */
    numV: 'bottom', /* top | bottom */
    numH: 'center', /* right | center | left */
    numSize: 13,
    numColor: '#1E1B2E',
    numFmt: 'page_of', /* n | n_slash_t | dash | page | page_of | en_of */
    numStart: 1,
    numSkipFirst: false,
    numPreviewPage: 1,

    /* علامة مائية */
    wmType: 'text', /* text | image */
    wmText: 'نسخة دراسية - منصة EPS',
    wmSize: 34,
    wmColor: '#7C3AED',
    wmOpacity: 0.25,
    wmAngle: -35,
    wmTiled: false,
    wmPagesMode: 'all', /* all | skip1 | custom */
    wmRange: '',
    wmImgBytes: null,
    wmImgMime: '',
    wmImgUrl: '',
    wmImgScale: 0.35,
    wmPreviewPage: 1,

    /* صور -> PDF */
    imgList: [], /* { id, name, bytes, mime, url, width, height, rot } */
    imgPageSize: 'a4', /* fit | a4 | letter */
    imgOrient: 'auto', /* auto | portrait | landscape */
    imgMargin: 18,

    /* PDF -> صور */
    p2iFormat: 'png', /* png | jpeg */
    p2iScale: 2,
    p2iPagesMode: 'all',
    p2iRange: '',
    p2iOutputs: [], /* { page, name, blob, url } */

    /* ضغط */
    cmpMode: 'lossless', /* lossless | raster */
    cmpScale: 1.2,
    cmpQuality: 0.72,
    cmpResult: null, /* { origSize, newSize, bytes, name } */

    /* معلومات وتعديل Metadata */
    metaInfo: null, /* { title, author, subject, keywords, creator, producer, pages: [...] } */

    /* إضافة نصوص وصور */
    annPage: 1,
    annKind: 'text', /* text | image */
    annText: 'ملاحظة مهمة',
    annFontSize: 18,
    annColor: '#DC2626',
    annBg: false,
    annNx: 0.5,
    annNy: 0.2,
    annAllPages: false,
    annImgBytes: null,
    annImgMime: '',
    annImgUrl: '',
    annImgEl: null,
    annImgW: 120,
    annItems: [], /* { id, kind, page, allPages, nx, ny, text, fontSize, color, bg, imgBytes, imgMime, imgUrl, imgW } */

    /* رأس وتذييل */
    hfHRight: '',
    hfHCenter: '',
    hfHLeft: '',
    hfFRight: '',
    hfFCenter: 'صفحة {page} من {total}',
    hfFLeft: '',
    hfSize: 11,
    hfColor: '#374151',
    hfLine: true,
    hfSkipFirst: false,
    hfPreviewPage: 1
  };

  var toastEl = null;
  var toastT = 0;
  function toast(m, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pl-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = m;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2500);
  }

  /* ---------- جاهزية الأوفلاين ---------- */
  async function refreshOfflineState() {
    st.offlineState = 'checking';
    st.offlineMsg = 'جارٍ فحص مكتبات PDF المحلية…';
    updateOfflineUi();
    try {
      var res = await S.checkOfflineLibs(LAB_OFFLINE_ASSETS);
      st.offlineState = res.ready ? 'ready' : 'partial';
      st.offlineMsg = res.ready
        ? 'جميع مكتبات المعالجة المحلية جاهزة دون إنترنت (' + res.cached + '/' + res.total + ')'
        : 'مخزّن جزئياً (' + res.cached + '/' + res.total + '). اضغط لتجهيز الأوفلاين.';
    } catch (e) {
      st.offlineState = 'partial';
      st.offlineMsg = 'يعمل المختبر محلياً من موارد الموقع المحملة.';
    }
    updateOfflineUi();
  }

  async function warmOffline() {
    st.offlineState = 'busy';
    st.offlineMsg = 'جارٍ حفظ مكتبات PDF للعمل دون إنترنت…';
    updateOfflineUi();
    try {
      var res = await S.warmOfflineLibs(LAB_OFFLINE_ASSETS);
      st.offlineState = res.ready ? 'ready' : 'partial';
      st.offlineMsg = res.ready ? 'مختبر PDF جاهز 100% دون إنترنت ✓' : 'تم حفظ ' + res.cached + ' من ' + res.total;
      toast('تم تجهيز مختبر PDF للعمل دون إنترنت ✓');
    } catch (e) {
      st.offlineState = 'error';
      st.offlineMsg = 'تعذّر حفظ بعض الملفات مؤقتاً.';
    }
    updateOfflineUi();
  }

  function updateOfflineUi() {
    if (!st.root) return;
    var el = st.root.querySelector('#plOfflineState');
    if (!el) return;
    el.className = 'pl-offline-state ' + st.offlineState;
    el.querySelector('span').textContent = st.offlineMsg;
    var b = st.root.querySelector('#plWarmBtn');
    if (b) { b.hidden = st.offlineState === 'ready'; b.disabled = st.offlineState === 'busy'; }
  }

  /* ---------- تحميل ملف PDF الفردي المشترك ---------- */
  async function loadActivePdfFile(file) {
    if (!file || (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')) {
      toast('يرجى اختيار ملف PDF صالح');
      return;
    }
    toast('جارٍ قراءة الملف محلياً…', 1800);
    try {
      var ab = await file.arrayBuffer();
      var bytes = new Uint8Array(ab);
      var doc = await S.openPdfDoc(bytes);
      if (st.activePdf && st.activePdf.doc) {
        try { st.activePdf.doc.destroy(); } catch (e) {}
      }
      st.activePdf = {
        name: file.name,
        size: file.size || bytes.byteLength,
        bytes: bytes,
        numPages: doc.numPages || 1,
        doc: doc
      };
      st.splitResults = [];
      st.cmpResult = null;
      st.p2iOutputs = [];
      st.annItems = [];
      st.numPreviewPage = 1;
      st.wmPreviewPage = 1;
      st.hfPreviewPage = 1;
      st.annPage = 1;
      await rebuildOrgItems();
      await extractMetadataInfo();
      render();
      toast('تم تحميل «' + file.name + '» (' + st.activePdf.numPages + ' صفحة)');
    } catch (e) {
      toast('تعذّر قراءة ملف PDF: ' + (e && e.message ? e.message : 'ملف تالف أو محمي'), 3500);
    }
  }

  async function rebuildOrgItems() {
    if (!st.activePdf) { st.orgItems = []; return; }
    var items = [];
    for (var p = 1; p <= st.activePdf.numPages; p++) {
      items.push({ id: S.uid('pg'), origPage: p, rot: 0, selected: false, thumbUrl: '' });
    }
    st.orgItems = items;
  }

  async function extractMetadataInfo() {
    if (!st.activePdf) { st.metaInfo = null; return; }
    try {
      var PDFLib = await S.loadPdfLib();
      var pdfDoc = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
      var pages = pdfDoc.getPages().map(function (pg, idx) {
        var sz = pg.getSize();
        var rot = pg.getRotation().angle || 0;
        var visW = (rot % 180 !== 0) ? sz.height : sz.width;
        var visH = (rot % 180 !== 0) ? sz.width : sz.height;
        return {
          page: idx + 1,
          wPt: Math.round(visW),
          hPt: Math.round(visH),
          wMm: Math.round(visW * 25.4 / 72),
          hMm: Math.round(visH * 25.4 / 72),
          orient: visW > visH ? 'أفقي' : 'عمودي',
          rot: rot
        };
      });
      var hasSearchableText = false;
      try {
        var p1 = await st.activePdf.doc.getPage(1);
        var tc = await p1.getTextContent();
        hasSearchableText = (tc.items || []).some(function (it) { return it.str && it.str.trim(); });
      } catch (e) {}

      st.metaInfo = {
        title: pdfDoc.getTitle() || '',
        author: pdfDoc.getAuthor() || '',
        subject: pdfDoc.getSubject() || '',
        keywords: pdfDoc.getKeywords() || '',
        creator: pdfDoc.getCreator() || '',
        producer: pdfDoc.getProducer() || '',
        hasText: hasSearchableText,
        pages: pages
      };
    } catch (e) {
      st.metaInfo = null;
    }
  }

  /* ---------- رسم واجهة المختبر ---------- */
  function render() {
    if (!st.root) return;
    var h = '';
    h += '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div>';
    h += '<h2 class="ptitle">مختبر ملفات PDF</h2>';
    h += '<div class="pl-shell">';

    /* بطاقة التعريف والخصوصية والأوفلاين */
    h += '<div class="pl-card">';
    h += '<h3>معالجة شاملة لملفات PDF داخل متصفحك</h3>';
    h += '<p class="pl-lead">ادمج وقسّم وأعد ترتيب الصفحات، أضف ترقيماً وعلامات مائية ونصوصاً وترويسات، حوّل الصور واضغط الملفات مع معاينة فورية قبل التصدير.</p>';
    h += '<div class="pl-privacy">🔒 الخصوصية والأصل محفوظ: تتم جميع العمليات محلياً داخل جهازك دون رفع الملفات لأي خادم، وتُحفظ النتائج كملف جديد دون تغيير الملف الأصلي.</div>';
    h += '<div class="pl-offline-bar">';
    h += '<div class="pl-offline-state ' + st.offlineState + '" id="plOfflineState"><i class="pl-dot"></i><div><strong>الجاهزية دون إنترنت</strong><span>' + S.esc(st.offlineMsg) + '</span></div></div>';
    h += '<button type="button" class="pl-btn sm pri" id="plWarmBtn"' + (st.offlineState === 'ready' ? ' hidden' : '') + '>تجهيز للأوفلاين</button>';
    h += '</div></div>';

    /* شريط المجموعات الثلاث */
    h += '<div class="pl-groups" role="tablist">';
    GROUPS.forEach(function (g) {
      h += '<button type="button" class="pl-gtab' + (st.group === g.id ? ' on' : '') + '" data-grp="' + g.id + '">' + g.title + '</button>';
    });
    h += '</div>';

    /* أدوات المجموعة النشطة */
    var curGroup = GROUPS.filter(function (g) { return g.id === st.group; })[0] || GROUPS[0];
    h += '<div class="pl-subtools">';
    curGroup.tools.forEach(function (t) {
      h += '<button type="button" class="pl-tool-btn' + (st.tool === t.id ? ' on' : '') + '" data-ltool="' + t.id + '">' + t.label + '</button>';
    });
    h += '</div>';

    /* لوحة الأداة النشطة */
    h += '<div id="plStage">' + renderActiveToolHtml() + '</div>';
    h += '</div>';

    st.root.innerHTML = h;
    bindShellEvents();
    bindActiveToolEvents();
  }

  function bindShellEvents() {
    var warm = st.root.querySelector('#plWarmBtn');
    if (warm) warm.onclick = warmOffline;

    st.root.querySelectorAll('[data-grp]').forEach(function (b) {
      b.onclick = function () {
        st.group = b.dataset.grp;
        var grp = GROUPS.filter(function (g) { return g.id === st.group; })[0];
        if (grp && grp.tools[0]) st.tool = grp.tools[0].id;
        render();
      };
    });

    st.root.querySelectorAll('[data-ltool]').forEach(function (b) {
      b.onclick = function () {
        st.tool = b.dataset.ltool;
        render();
      };
    });
  }

  function renderActivePdfBanner(promptText) {
    var h = '<div class="pl-card">';
    h += '<input type="file" id="plSinglePdfIn" accept=".pdf,application/pdf" hidden>';
    if (!st.activePdf) {
      h += '<label class="pl-drop" id="plSingleDrop" for="plSinglePdfIn" tabindex="0">';
      h += '<b>' + S.esc(promptText || 'اختر ملف PDF للعمل عليه') + '</b>';
      h += '<small>انقر للاختيار من الجهاز أو اسحب الملف وأفلته هنا — يبقى ملفك الأصلي سليماً</small>';
      h += '</label>';
    } else {
      h += '<div class="pl-row" style="justify-content:space-between">';
      h += '<div><b>📄 ' + S.esc(st.activePdf.name) + '</b><div style="font-size:12.5px;color:var(--muted)">' + st.activePdf.numPages + ' صفحة · ' + S.formatBytes(st.activePdf.size) + '</div></div>';
      h += '<label class="pl-btn sm pri" for="plSinglePdfIn" style="cursor:pointer">' + I.upload + '<span>تغيير الملف</span></label>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function bindSinglePdfPicker() {
    var fi = st.root.querySelector('#plSinglePdfIn');
    var dz = st.root.querySelector('#plSingleDrop');
    if (fi) {
      fi.onchange = function () {
        var f = fi.files && fi.files[0];
        fi.value = '';
        if (f) loadActivePdfFile(f);
      };
    }
    if (dz) {
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
      dz.addEventListener('drop', function (e) {
        e.preventDefault(); dz.classList.remove('over');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) loadActivePdfFile(f);
      });
    }
  }

  /* ---------- توزيع واجهات الأدوات ---------- */
  function renderActiveToolHtml() {
    switch (st.tool) {
      case 'merge': return renderMergeHtml();
      case 'split': return renderSplitHtml();
      case 'organize': return renderOrganizeHtml();
      case 'number': return renderNumberHtml();
      case 'watermark': return renderWatermarkHtml();
      case 'img2pdf': return renderImg2PdfHtml();
      case 'pdf2img': return renderPdf2ImgHtml();
      case 'compress': return renderCompressHtml();
      case 'meta': return renderMetaHtml();
      case 'annotate': return renderAnnotateHtml();
      case 'headerfooter': return renderHeaderFooterHtml();
      default: return '';
    }
  }

  function bindActiveToolEvents() {
    switch (st.tool) {
      case 'merge': bindMergeEvents(); break;
      case 'split': bindSinglePdfPicker(); bindSplitEvents(); break;
      case 'organize': bindSinglePdfPicker(); bindOrganizeEvents(); break;
      case 'number': bindSinglePdfPicker(); bindNumberEvents(); break;
      case 'watermark': bindSinglePdfPicker(); bindWatermarkEvents(); break;
      case 'img2pdf': bindImg2PdfEvents(); break;
      case 'pdf2img': bindSinglePdfPicker(); bindPdf2ImgEvents(); break;
      case 'compress': bindSinglePdfPicker(); bindCompressEvents(); break;
      case 'meta': bindSinglePdfPicker(); bindMetaEvents(); break;
      case 'annotate': bindSinglePdfPicker(); bindAnnotateEvents(); break;
      case 'headerfooter': bindSinglePdfPicker(); bindHeaderFooterEvents(); break;
    }
  }

  /* ==========================================================================
     1) دمج عدة ملفات PDF
     ========================================================================== */
  function renderMergeHtml() {
    var totalPages = st.mergeFiles.reduce(function (a, f) { return a + f.pages; }, 0);
    var h = '<div class="pl-card"><h3>دمج عدة ملفات PDF في ملف واحد</h3>';
    h += '<input type="file" id="plMergeIn" accept=".pdf,application/pdf" multiple hidden>';
    h += '<label class="pl-drop" id="plMergeDrop" for="plMergeIn"><b>+ أضف ملفات PDF للدمج (يمكن اختيار أكثر من ملف)</b><small>اسحب الملفات لإعادة ترتيبها أو استخدم الأسهم على الهاتف، وحدد نطاق صفحات اختياري لكل ملف</small></label>';

    if (st.mergeFiles.length) {
      h += '<div class="pl-file-list" id="plMergeList" style="margin-top:12px">';
      st.mergeFiles.forEach(function (f, idx) {
        h += '<div class="pl-file-item" draggable="true" data-midx="' + idx + '">';
        h += '<span class="pl-handle" title="اسحب للترتيب">⋮⋮</span>';
        h += '<div style="flex:1 1 180px;min-width:0"><b>' + (idx + 1) + '. ' + S.esc(f.name) + '</b><div style="font-size:12px;color:var(--muted)">' + f.pages + ' صفحة · ' + S.formatBytes(f.size) + '</div></div>';
        h += '<input type="text" class="pl-in" data-mrange="' + idx + '" style="width:130px;min-height:36px" placeholder="كل الصفحات (أو 1-3)" value="' + S.esc(f.range || '') + '">';
        h += '<div class="pl-row" style="gap:4px">';
        h += '<button type="button" class="pl-btn sm" data-mmove="-1" data-idx="' + idx + '"' + (idx === 0 ? ' disabled' : '') + ' title="أعلى">↑</button>';
        h += '<button type="button" class="pl-btn sm" data-mmove="1" data-idx="' + idx + '"' + (idx === st.mergeFiles.length - 1 ? ' disabled' : '') + ' title="أسفل">↓</button>';
        h += '<button type="button" class="pl-btn sm danger" data-mdel="' + idx + '" aria-label="إزالة">' + I.trash + '</button>';
        h += '</div></div>';
      });
      h += '</div>';

      h += '<div class="pl-grid2" style="margin-top:12px">';
      h += '<div class="pl-fld"><label class="pl-lbl">اسم الملف الناتج</label><input class="pl-in" id="plMergeOutName" value="' + S.esc(st.mergeOutName) + '"></div>';
      h += '<div class="pl-fld"><label class="pl-lbl">ملخص الدمج</label><div class="pl-msg">عدد الملفات: ' + st.mergeFiles.length + ' · إجمالي الصفحات التقريبي: ' + totalPages + '</div></div>';
      h += '</div>';
      h += '<div class="pl-row" style="margin-top:12px">';
      h += '<button type="button" class="pl-btn accent" id="plMergeRun">' + I.dl + '<span>دمج وتنزيل PDF</span></button>';
      h += '<button type="button" class="pl-btn danger" id="plMergeClear">مسح القائمة</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function bindMergeEvents() {
    var fi = st.root.querySelector('#plMergeIn');
    var dz = st.root.querySelector('#plMergeDrop');
    async function addFiles(files) {
      if (!files || !files.length) return;
      var PDFLib = await S.loadPdfLib();
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') continue;
        try {
          var bytes = new Uint8Array(await f.arrayBuffer());
          var doc = await PDFLib.PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
          st.mergeFiles.push({
            id: S.uid('mf'),
            name: f.name,
            size: bytes.byteLength,
            pages: doc.getPageCount(),
            bytes: bytes,
            range: ''
          });
        } catch (e) {
          toast('تعذّر قراءة الملف: ' + f.name);
        }
      }
      render();
    }
    if (fi) fi.onchange = function () { addFiles(fi.files); fi.value = ''; };
    if (dz) {
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
      dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('over'); addFiles(e.dataTransfer && e.dataTransfer.files); });
    }

    var dragFrom = -1;
    st.root.querySelectorAll('[data-midx]').forEach(function (el) {
      el.addEventListener('dragstart', function () { dragFrom = Number(el.dataset.midx); el.classList.add('dragging'); });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); dragFrom = -1; });
      el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('drop-target'); });
      el.addEventListener('dragleave', function () { el.classList.remove('drop-target'); });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); el.classList.remove('drop-target');
        var to = Number(el.dataset.midx);
        if (dragFrom >= 0 && dragFrom !== to) {
          var moved = st.mergeFiles.splice(dragFrom, 1)[0];
          st.mergeFiles.splice(to, 0, moved);
          render();
        }
      });
    });

    st.root.querySelectorAll('[data-mrange]').forEach(function (inp) {
      inp.oninput = function () { st.mergeFiles[Number(inp.dataset.mrange)].range = inp.value; };
    });
    st.root.querySelectorAll('[data-mmove]').forEach(function (b) {
      b.onclick = function () {
        var idx = Number(b.dataset.idx);
        var dir = Number(b.dataset.mmove);
        var nxt = idx + dir;
        if (nxt < 0 || nxt >= st.mergeFiles.length) return;
        var tmp = st.mergeFiles[idx];
        st.mergeFiles[idx] = st.mergeFiles[nxt];
        st.mergeFiles[nxt] = tmp;
        render();
      };
    });
    st.root.querySelectorAll('[data-mdel]').forEach(function (b) {
      b.onclick = function () { st.mergeFiles.splice(Number(b.dataset.mdel), 1); render(); };
    });
    var onIn = st.root.querySelector('#plMergeOutName');
    if (onIn) onIn.oninput = function () { st.mergeOutName = onIn.value; };

    var clr = st.root.querySelector('#plMergeClear');
    if (clr) clr.onclick = function () { st.mergeFiles = []; render(); };

    var run = st.root.querySelector('#plMergeRun');
    if (run) {
      run.onclick = async function () {
        if (st.mergeFiles.length < 1) return;
        run.disabled = true;
        toast('جارٍ دمج الملفات محلياً…', 2400);
        try {
          var PDFLib = await S.loadPdfLib();
          var merged = await PDFLib.PDFDocument.create();
          for (var i = 0; i < st.mergeFiles.length; i++) {
            var mf = st.mergeFiles[i];
            var src = await PDFLib.PDFDocument.load(mf.bytes.slice(), { ignoreEncryption: true });
            var indices = [];
            if (mf.range && mf.range.trim()) {
              var pr = S.parsePageRanges(mf.range, src.getPageCount());
              if (!pr.ok) { toast(mf.name + ': ' + pr.error, 3400); run.disabled = false; return; }
              indices = pr.pages.map(function (p) { return p - 1; });
            } else {
              for (var k = 0; k < src.getPageCount(); k++) indices.push(k);
            }
            var copied = await merged.copyPages(src, indices);
            copied.forEach(function (pg) { merged.addPage(pg); });
          }
          var outBytes = await merged.save({ useObjectStreams: true });
          S.downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), S.sanitizeFilename(st.mergeOutName || 'merged', 'pdf'));
          toast('تم دمج الملفات وتنزيل الملف الجديد ✓');
        } catch (e) {
          toast('تعذّر الدمج: ' + (e && e.message ? e.message : ''), 3400);
        } finally {
          run.disabled = false;
        }
      };
    }
  }

  /* ==========================================================================
     2) تقسيم ملف PDF
     ========================================================================== */
  function renderSplitHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لتقسيمه إلى عدة ملفات');
    if (!st.activePdf) return h;

    h += '<div class="pl-card"><h3>إعدادات التقسيم (' + st.activePdf.numPages + ' صفحة)</h3>';
    h += '<div class="pl-row" style="margin-bottom:10px">';
    h += '<label class="pl-btn sm' + (st.splitMode === 'ranges' ? ' pri' : '') + '"><input type="radio" name="plSplitM" value="ranges"' + (st.splitMode === 'ranges' ? ' checked' : '') + '><span>حسب نطاقات مخصصة</span></label>';
    h += '<label class="pl-btn sm' + (st.splitMode === 'every' ? ' pri' : '') + '"><input type="radio" name="plSplitM" value="every"' + (st.splitMode === 'every' ? ' checked' : '') + '><span>تقسيم متساوٍ كل N صفحات</span></label>';
    h += '</div>';

    if (st.splitMode === 'ranges') {
      h += '<div class="pl-fld"><label class="pl-lbl">اكتب النطاقات (افصل كل ملف بفاصلة منقوطة «;» أو سطر جديد)</label>';
      h += '<textarea class="pl-ta" id="plSplitRanges" placeholder="مثال:\n1-3; 4-6; 7-10">' + S.esc(st.splitRanges) + '</textarea>';
      h += '<small style="color:var(--muted);font-size:12px">مثال: «1-3; 4-5; 6» يُنتج 3 ملفات PDF مستقلة.</small></div>';
    } else {
      h += '<div class="pl-fld" style="max-width:240px"><label class="pl-lbl">عدد الصفحات في كل جزء</label>';
      h += '<input type="number" min="1" max="' + st.activePdf.numPages + '" class="pl-in" id="plSplitEvery" value="' + st.splitEvery + '"></div>';
    }

    h += '<div class="pl-row" style="margin-top:12px">';
    h += '<button type="button" class="pl-btn accent" id="plSplitRun">معاينة وتنفيذ التقسيم</button>';
    if (st.splitResults.length) {
      h += '<button type="button" class="pl-btn pri" id="plSplitZip">' + I.dl + '<span>تنزيل الكل (ZIP)</span></button>';
    }
    h += '</div>';

    if (st.splitResults.length) {
      h += '<div class="pl-file-list" style="margin-top:12px">';
      st.splitResults.forEach(function (part, i) {
        h += '<div class="pl-file-item"><div style="flex:1"><b>' + S.esc(part.name) + '</b><div style="font-size:12px;color:var(--muted)">' + part.pageCount + ' صفحة · ' + S.formatBytes(part.bytes.byteLength) + '</div></div>';
        h += '<button type="button" class="pl-btn sm pri" data-spdl="' + i + '">' + I.dl + '<span>تنزيل</span></button></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function bindSplitEvents() {
    if (!st.activePdf) return;
    st.root.querySelectorAll('input[name="plSplitM"]').forEach(function (r) {
      r.onchange = function () { st.splitMode = r.value; render(); };
    });
    var sr = st.root.querySelector('#plSplitRanges');
    if (sr) sr.oninput = function () { st.splitRanges = sr.value; };
    var se = st.root.querySelector('#plSplitEvery');
    if (se) se.oninput = function () { st.splitEvery = Math.max(1, parseInt(se.value, 10) || 1); };

    var run = st.root.querySelector('#plSplitRun');
    if (run) {
      run.onclick = async function () {
        var maxP = st.activePdf.numPages;
        var groups = [];
        if (st.splitMode === 'ranges') {
          var chunks = st.splitRanges.split(/[;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
          if (!chunks.length) { toast('أدخل نطاقاً واحداً على الأقل'); return; }
          for (var i = 0; i < chunks.length; i++) {
            var pr = S.parsePageRanges(chunks[i], maxP);
            if (!pr.ok) { toast('في الجزء ' + (i + 1) + ': ' + pr.error, 3400); return; }
            groups.push(pr.pages);
          }
        } else {
          var n = Math.max(1, Number(st.splitEvery) || 1);
          for (var p = 1; p <= maxP; p += n) {
            var g = [];
            for (var k = p; k < Math.min(maxP + 1, p + n); k++) g.push(k);
            groups.push(g);
          }
        }

        run.disabled = true;
        toast('جارٍ تقسيم الملف محلياً…');
        try {
          var PDFLib = await S.loadPdfLib();
          var src = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
          var base = S.sanitizeFilename(st.activePdf.name, '');
          var outs = [];
          for (var gi = 0; gi < groups.length; gi++) {
            var nd = await PDFLib.PDFDocument.create();
            var copied = await nd.copyPages(src, groups[gi].map(function (x) { return x - 1; }));
            copied.forEach(function (pg) { nd.addPage(pg); });
            var outBytes = await nd.save({ useObjectStreams: true });
            outs.push({
              name: base + '-جزء-' + (gi + 1) + '.pdf',
              pageCount: groups[gi].length,
              bytes: outBytes
            });
          }
          st.splitResults = outs;
          render();
          toast('تم تجهيز ' + outs.length + ' ملفاً ✓');
        } catch (e) {
          toast('تعذّر التقسيم: ' + (e && e.message ? e.message : ''), 3400);
        } finally {
          run.disabled = false;
        }
      };
    }

    st.root.querySelectorAll('[data-spdl]').forEach(function (b) {
      b.onclick = function () {
        var part = st.splitResults[Number(b.dataset.spdl)];
        if (part) S.downloadBlob(new Blob([part.bytes], { type: 'application/pdf' }), part.name);
      };
    });

    var zipBtn = st.root.querySelector('#plSplitZip');
    if (zipBtn) {
      zipBtn.onclick = function () {
        var files = st.splitResults.map(function (p) { return { name: p.name, data: p.bytes }; });
        var blob = S.buildZip(files);
        S.downloadBlob(blob, S.sanitizeFilename(st.activePdf.name, '') + '-تقسيم.zip');
        toast('تم تنزيل الأرشيف ZIP ✓');
      };
    }
  }

  /* ==========================================================================
     3) استوديو تنظيم الصفحات (إعادة ترتيب، حذف، تدوير، تكرار، استخراج، استخراج كل صفحة)
     ========================================================================== */
  function renderOrganizeHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لإدارة صفحاته (ترتيب، حذف، تدوير، تكرار، استخراج)');
    if (!st.activePdf) return h;

    var selCount = st.orgItems.filter(function (x) { return x.selected; }).length;

    h += '<div class="pl-card"><h3>إدارة الصفحات (' + st.orgItems.length + ' صفحة حالياً)</h3>';
    h += '<div class="pl-row" style="margin-bottom:10px">';
    h += '<button type="button" class="pl-btn sm" id="plOrgSelAll">تحديد الكل</button>';
    h += '<button type="button" class="pl-btn sm" id="plOrgSelNone">إلغاء التحديد</button>';
    h += '<button type="button" class="pl-btn sm" id="plOrgRotSel"' + (selCount ? '' : ' disabled') + '>' + I.rotR + '<span>تدوير المحدد +90°</span></button>';
    h += '<button type="button" class="pl-btn sm" id="plOrgDupSel"' + (selCount ? '' : ' disabled') + '>' + I.dup + '<span>تكرار المحدد</span></button>';
    h += '<button type="button" class="pl-btn sm danger" id="plOrgDelSel"' + (selCount ? '' : ' disabled') + '>' + I.trash + '<span>حذف المحدد</span></button>';
    h += '<button type="button" class="pl-btn sm pri" id="plOrgExtSel"' + (selCount ? '' : ' disabled') + '>' + I.dl + '<span>استخراج المحدد كـ PDF</span></button>';
    h += '<button type="button" class="pl-btn sm" id="plOrgReset">استرجاع الأصل</button>';
    h += '</div>';

    h += '<div class="pl-row" style="margin-bottom:10px">';
    h += '<input class="pl-in" id="plOrgRangeIn" style="max-width:260px;min-height:38px" placeholder="أو استخراج نطاق (مثال: 1, 3-5)" value="' + S.esc(st.orgExtractRange) + '">';
    h += '<button type="button" class="pl-btn sm" id="plOrgExtRangeBtn">استخراج النطاق كـ PDF</button>';
    h += '<button type="button" class="pl-btn sm pri" id="plOrgBurstZip">' + I.dl + '<span>استخراج كل صفحة في ملف مستقل (ZIP)</span></button>';
    h += '</div>';

    h += '<div class="pl-pages-grid" id="plOrgGrid">';
    st.orgItems.forEach(function (it, idx) {
      h += '<div class="pl-pg-card' + (it.selected ? ' selected' : '') + '" draggable="true" data-oidx="' + idx + '">';
      h += '<div class="pl-pg-top"><label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" data-osel="' + idx + '"' + (it.selected ? ' checked' : '') + '><span>#' + (idx + 1) + '</span></label>';
      h += '<span style="font-size:11px;color:var(--muted)">أصل ' + it.origPage + (it.rot ? ' · ' + it.rot + '°' : '') + '</span></div>';
      h += '<div class="pl-pg-thumb" data-opgthumb="' + idx + '">';
      if (it.thumbUrl) h += '<img src="' + it.thumbUrl + '" alt="صفحة ' + it.origPage + '" style="transform:rotate(' + it.rot + 'deg)">';
      else h += '<span style="font-size:12px;color:var(--muted)">' + it.origPage + '</span>';
      h += '</div>';
      h += '<div class="pl-pg-acts">';
      h += '<button type="button" class="pl-pg-mini" data-omove="-1" data-idx="' + idx + '" title="تحريك لليمين"' + (idx === 0 ? ' disabled' : '') + '>→</button>';
      h += '<button type="button" class="pl-pg-mini" data-omove="1" data-idx="' + idx + '" title="تحريك لليسار"' + (idx === st.orgItems.length - 1 ? ' disabled' : '') + '>←</button>';
      h += '<button type="button" class="pl-pg-mini" data-orot="' + idx + '" title="تدوير 90°">↻</button>';
      h += '<button type="button" class="pl-pg-mini" data-odup="' + idx + '" title="تكرار">+</button>';
      h += '<button type="button" class="pl-pg-mini dng" data-odel="' + idx + '" title="حذف">✕</button>';
      h += '</div></div>';
    });
    h += '</div>';

    h += '<div class="pl-row" style="margin-top:14px">';
    h += '<button type="button" class="pl-btn accent" id="plOrgSaveAll">' + I.dl + '<span>تطبيق التعديلات وتنزيل PDF الجديد (' + st.orgItems.length + ' صفحة)</span></button>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  async function hydrateOrgThumbnails() {
    if (!st.activePdf || !st.root) return;
    var doc = st.activePdf.doc;
    var renderedByOrig = Object.create(null);
    st.orgItems.forEach(function (it) { if (it.thumbUrl) renderedByOrig[it.origPage] = it.thumbUrl; });

    for (var i = 0; i < st.orgItems.length; i++) {
      var it = st.orgItems[i];
      if (!st.root || st.tool !== 'organize' || !st.activePdf) return;
      if (it.thumbUrl) continue;
      if (!renderedByOrig[it.origPage]) {
        try {
          var page = await doc.getPage(it.origPage);
          var vp0 = page.getViewport({ scale: 1 });
          var vp = page.getViewport({ scale: 140 / vp0.width });
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.floor(vp.width));
          cv.height = Math.max(1, Math.floor(vp.height));
          await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          renderedByOrig[it.origPage] = cv.toDataURL('image/jpeg', 0.8);
        } catch (e) { /* ignore */ }
      }
      it.thumbUrl = renderedByOrig[it.origPage] || '';
      var holder = st.root.querySelector('[data-opgthumb="' + i + '"]');
      if (holder && it.thumbUrl) {
        holder.innerHTML = '<img src="' + it.thumbUrl + '" alt="صفحة ' + it.origPage + '" style="transform:rotate(' + it.rot + 'deg)">';
      }
    }
  }

  function bindOrganizeEvents() {
    if (!st.activePdf) return;
    hydrateOrgThumbnails();

    st.root.querySelectorAll('[data-osel]').forEach(function (chk) {
      chk.onchange = function () {
        st.orgItems[Number(chk.dataset.osel)].selected = chk.checked;
        render();
      };
    });

    st.root.querySelector('#plOrgSelAll').onclick = function () { st.orgItems.forEach(function (x) { x.selected = true; }); render(); };
    st.root.querySelector('#plOrgSelNone').onclick = function () { st.orgItems.forEach(function (x) { x.selected = false; }); render(); };
    st.root.querySelector('#plOrgReset').onclick = function () { rebuildOrgItems().then(render); };

    st.root.querySelector('#plOrgRotSel').onclick = function () {
      st.orgItems.forEach(function (x) { if (x.selected) x.rot = (x.rot + 90) % 360; });
      render();
    };
    st.root.querySelector('#plOrgDupSel').onclick = function () {
      var next = [];
      st.orgItems.forEach(function (x) {
        next.push(x);
        if (x.selected) next.push({ id: S.uid('pg'), origPage: x.origPage, rot: x.rot, selected: false, thumbUrl: x.thumbUrl });
      });
      st.orgItems = next;
      render();
    };
    st.root.querySelector('#plOrgDelSel').onclick = function () {
      var keep = st.orgItems.filter(function (x) { return !x.selected; });
      if (!keep.length) { toast('يجب الإبقاء على صفحة واحدة على الأقل'); return; }
      st.orgItems = keep;
      render();
    };

    st.root.querySelectorAll('[data-omove]').forEach(function (b) {
      b.onclick = function () {
        var idx = Number(b.dataset.idx), dir = Number(b.dataset.omove), nxt = idx + dir;
        if (nxt < 0 || nxt >= st.orgItems.length) return;
        var tmp = st.orgItems[idx]; st.orgItems[idx] = st.orgItems[nxt]; st.orgItems[nxt] = tmp;
        render();
      };
    });
    st.root.querySelectorAll('[data-orot]').forEach(function (b) {
      b.onclick = function () {
        var it = st.orgItems[Number(b.dataset.orot)];
        it.rot = (it.rot + 90) % 360;
        render();
      };
    });
    st.root.querySelectorAll('[data-odup]').forEach(function (b) {
      b.onclick = function () {
        var idx = Number(b.dataset.odup), it = st.orgItems[idx];
        st.orgItems.splice(idx + 1, 0, { id: S.uid('pg'), origPage: it.origPage, rot: it.rot, selected: false, thumbUrl: it.thumbUrl });
        render();
      };
    });
    st.root.querySelectorAll('[data-odel]').forEach(function (b) {
      b.onclick = function () {
        if (st.orgItems.length <= 1) { toast('لا يمكن حذف آخر صفحة متبقية'); return; }
        st.orgItems.splice(Number(b.dataset.odel), 1);
        render();
      };
    });

    /* السحب والإفلات لترتيب البطاقات */
    var dragFrom = -1;
    st.root.querySelectorAll('.pl-pg-card').forEach(function (card) {
      card.addEventListener('dragstart', function () { dragFrom = Number(card.dataset.oidx); card.classList.add('dragging'); });
      card.addEventListener('dragend', function () { card.classList.remove('dragging'); dragFrom = -1; });
      card.addEventListener('dragover', function (e) { e.preventDefault(); card.classList.add('drop-target'); });
      card.addEventListener('dragleave', function () { card.classList.remove('drop-target'); });
      card.addEventListener('drop', function (e) {
        e.preventDefault(); card.classList.remove('drop-target');
        var to = Number(card.dataset.oidx);
        if (dragFrom >= 0 && dragFrom !== to) {
          var mv = st.orgItems.splice(dragFrom, 1)[0];
          st.orgItems.splice(to, 0, mv);
          render();
        }
      });
    });

    async function exportOrgSubset(items, suffix) {
      if (!items.length) return;
      toast('جارٍ إنشاء الملف…', 2000);
      var PDFLib = await S.loadPdfLib();
      var src = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
      var out = await PDFLib.PDFDocument.create();
      var copied = await out.copyPages(src, items.map(function (x) { return x.origPage - 1; }));
      copied.forEach(function (pg, i) {
        var extra = items[i].rot || 0;
        if (extra) {
          var cur = pg.getRotation().angle || 0;
          pg.setRotation(PDFLib.degrees((cur + extra) % 360));
        }
        out.addPage(pg);
      });
      var bytes = await out.save({ useObjectStreams: true });
      S.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), S.sanitizeFilename(st.activePdf.name, '') + suffix + '.pdf');
      toast('تم التصدير بنجاح ✓');
    }

    st.root.querySelector('#plOrgExtSel').onclick = function () {
      var sel = st.orgItems.filter(function (x) { return x.selected; });
      if (sel.length) exportOrgSubset(sel, '-مقتطف');
    };

    var rIn = st.root.querySelector('#plOrgRangeIn');
    rIn.oninput = function () { st.orgExtractRange = rIn.value; };
    st.root.querySelector('#plOrgExtRangeBtn').onclick = function () {
      var pr = S.parsePageRanges(st.orgExtractRange, st.activePdf.numPages);
      if (!pr.ok) { toast(pr.error, 3200); return; }
      exportOrgSubset(pr.pages.map(function (p) { return { origPage: p, rot: 0 }; }), '-صفحات-مستخرجة');
    };

    st.root.querySelector('#plOrgBurstZip').onclick = async function () {
      toast('جارٍ استخراج كل صفحة في ملف مستقل…', 2400);
      var PDFLib = await S.loadPdfLib();
      var src = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
      var base = S.sanitizeFilename(st.activePdf.name, '');
      var zipEntries = [];
      for (var i = 0; i < st.orgItems.length; i++) {
        var it = st.orgItems[i];
        var nd = await PDFLib.PDFDocument.create();
        var copied = await nd.copyPages(src, [it.origPage - 1]);
        var pg = copied[0];
        if (it.rot) pg.setRotation(PDFLib.degrees(((pg.getRotation().angle || 0) + it.rot) % 360));
        nd.addPage(pg);
        zipEntries.push({ name: base + '-صفحة-' + (i + 1) + '.pdf', data: await nd.save({ useObjectStreams: true }) });
      }
      S.downloadBlob(S.buildZip(zipEntries), base + '-كل-صفحة-بمفردها.zip');
      toast('تم تنزيل أرشيف الصفحات المستقلة ZIP ✓');
    };

    st.root.querySelector('#plOrgSaveAll').onclick = function () {
      exportOrgSubset(st.orgItems, '-منظم');
    };
  }

  /* ==========================================================================
     أدوات مساعدة مشتركة لرسم التنسيقات على المعاينة وعلى PDF مع دعم كل التدوير
     ========================================================================== */
  async function renderPdfPagePreviewCanvas(canvas, pageNum, postDrawFn) {
    if (!st.activePdf || !canvas) return;
    var page = await st.activePdf.doc.getPage(pageNum);
    var vp0 = page.getViewport({ scale: 1 });
    var scale = Math.min(1.5, 440 / vp0.width);
    var vp = page.getViewport({ scale: scale });
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    if (postDrawFn) await postDrawFn(ctx, vp.width, vp.height, scale, vp0.width, vp0.height);
  }

  function normCenterToPdf(nx, ny, box, rot) {
    rot = ((rot % 360) + 360) % 360;
    var bx = box.x || 0, by = box.y || 0, bw = box.width, bh = box.height;
    if (rot === 90)  return { x: bx + ny * bw, y: by + nx * bh };
    if (rot === 180) return { x: bx + (1 - nx) * bw, y: by + ny * bh };
    if (rot === 270) return { x: bx + (1 - ny) * bw, y: by + (1 - nx) * bh };
    return { x: bx + nx * bw, y: by + (1 - ny) * bh };
  }

  /* رسم صورة مدمجة متمركزة عند (cxNorm, cyNorm) بإحداثيات مرئية [0..1] مع دعم التدوير والدوران الإضافي */
  function drawVisualCenteredImage(PDFLib, page, img, cxNorm, cyNorm, visW, visH, opacity, extraDeg) {
    var box = page.getCropBox() || page.getMediaBox();
    var rot = ((page.getRotation().angle || 0) % 360 + 360) % 360;
    var visPageW = (rot % 180 !== 0) ? box.height : box.width;
    var visPageH = (rot % 180 !== 0) ? box.width : box.height;

    /* نقطة أسفل-يسار المستطيل قبل التدوير الإضافي حول مركزه */
    var rad = (extraDeg || 0) * Math.PI / 180;
    var dx = -visW / 2, dy = visH / 2; /* في نظام الشاشة: اليسار = -visW/2، الأسفل = +visH/2 */
    /* تدوير بصري عكس عقارب الساعة بمقدار extraDeg: Y شاشة تتجه لأسفل، فالتدوير موجب يرفع اليمين */
    var cos = Math.cos(-rad), sin = Math.sin(-rad);
    var rdx = dx * cos - dy * sin;
    var rdy = dx * sin + dy * cos;

    var blNx = cxNorm + (rdx / visPageW);
    var blNy = cyNorm + (rdy / visPageH);
    var pt = normCenterToPdf(blNx, blNy, box, rot);

    var pdfBaseDeg = rot === 90 ? 90 : (rot === 180 ? 180 : (rot === 270 ? -90 : 0));
    page.drawImage(img, {
      x: pt.x,
      y: pt.y,
      width: visW,
      height: visH,
      opacity: opacity != null ? opacity : 1,
      rotate: PDFLib.degrees(pdfBaseDeg + (extraDeg || 0))
    });
  }

  /* ==========================================================================
     4) ترقيم الصفحات
     ========================================================================== */
  function formatPageNumberLabel(idx1Based, total) {
    var num = st.numStart + (idx1Based - 1);
    var effTotal = st.numStart + (total - 1);
    if (st.numFmt === 'n') return String(num);
    if (st.numFmt === 'n_slash_t') return num + ' / ' + effTotal;
    if (st.numFmt === 'dash') return '- ' + num + ' -';
    if (st.numFmt === 'page') return 'صفحة ' + num;
    if (st.numFmt === 'en_of') return 'Page ' + num + ' of ' + effTotal;
    return 'صفحة ' + num + ' من ' + effTotal;
  }

  function renderNumberHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لإضافة ترقيم الصفحات');
    if (!st.activePdf) return h;

    h += '<div class="pl-workspace">';
    h += '<div class="pl-card"><h3>إعدادات ترقيم الصفحات</h3>';
    h += '<div class="pl-grid2">';
    h += '<div class="pl-fld"><label class="pl-lbl">الموضع الرأسي</label><select class="pl-sel" id="plNumV"><option value="top"' + (st.numV === 'top' ? ' selected' : '') + '>أعلى الصفحة</option><option value="bottom"' + (st.numV === 'bottom' ? ' selected' : '') + '>أسفل الصفحة</option></select></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الموضع الأفقي</label><select class="pl-sel" id="plNumH"><option value="right"' + (st.numH === 'right' ? ' selected' : '') + '>يمين</option><option value="center"' + (st.numH === 'center' ? ' selected' : '') + '>وسط</option><option value="left"' + (st.numH === 'left' ? ' selected' : '') + '>يسار</option></select></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">شكل الترقيم</label><select class="pl-sel" id="plNumFmt">' +
      [['page_of', 'صفحة 1 من 10'], ['page', 'صفحة 1'], ['n_slash_t', '1 / 10'], ['n', '1'], ['dash', '- 1 -'], ['en_of', 'Page 1 of 10']].map(function (o) {
        return '<option value="' + o[0] + '"' + (st.numFmt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">بداية الترقيم</label><input type="number" class="pl-in" id="plNumStart" min="1" value="' + st.numStart + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">حجم الخط (px)</label><input type="number" class="pl-in" id="plNumSize" min="8" max="42" value="' + st.numSize + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">اللون</label><input type="color" class="pl-in" id="plNumColor" value="' + st.numColor + '"></div>';
    h += '</div>';
    h += '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="plNumSkip1"' + (st.numSkipFirst ? ' checked' : '') + '><span>استثناء صفحة الغلاف (الصفحة الأولى لا تُرقَّم)</span></label>';
    h += '<div class="pl-row" style="margin-top:14px"><button type="button" class="pl-btn accent" id="plNumExport">' + I.dl + '<span>تطبيق وتنزيل PDF المرقّم</span></button></div>';
    h += '</div>';

    h += '<div class="pl-preview-box">';
    h += '<div class="pl-row" style="justify-content:space-between;width:100%"><b>معاينة حية</b><div class="pl-row" style="gap:6px"><label style="font-size:12.5px">صفحة:</label><input type="number" class="pl-in" id="plNumPrevPg" style="width:68px;min-height:32px" min="1" max="' + st.activePdf.numPages + '" value="' + st.numPreviewPage + '"></div></div>';
    h += '<div class="pl-preview-canvas-wrap"><canvas id="plNumPreviewCv"></canvas></div>';
    h += '</div></div>';
    return h;
  }

  function paintNumberPreview() {
    var cv = st.root && st.root.querySelector('#plNumPreviewCv');
    if (!cv || !st.activePdf) return;
    var pg = Math.max(1, Math.min(st.activePdf.numPages, st.numPreviewPage));
    renderPdfPagePreviewCanvas(cv, pg, function (ctx, w, h, scale) {
      if (st.numSkipFirst && pg === 1) return;
      var effectiveIdx = st.numSkipFirst ? (pg - 1) : pg;
      var effectiveTot = st.numSkipFirst ? Math.max(1, st.activePdf.numPages - 1) : st.activePdf.numPages;
      var txt = formatPageNumberLabel(effectiveIdx, effectiveTot);
      var pxSize = Math.max(8, st.numSize * scale);
      ctx.font = '700 ' + pxSize + 'px Alexandria, Tahoma, Arial, sans-serif';
      ctx.fillStyle = st.numColor;
      ctx.direction = S.hasArabic(txt) ? 'rtl' : 'ltr';
      ctx.textBaseline = 'middle';
      var mx = 28 * scale, my = 22 * scale;
      var y = st.numV === 'top' ? my : (h - my);
      var x = st.numH === 'left' ? mx : (st.numH === 'right' ? (w - mx) : w / 2);
      ctx.textAlign = st.numH;
      ctx.fillText(txt, x, y);
    });
  }

  function bindNumberEvents() {
    if (!st.activePdf) return;
    paintNumberPreview();
    var bind = function (id, fn) { var el = st.root.querySelector(id); if (el) el.oninput = el.onchange = function () { fn(el); paintNumberPreview(); }; };
    bind('#plNumV', function (el) { st.numV = el.value; });
    bind('#plNumH', function (el) { st.numH = el.value; });
    bind('#plNumFmt', function (el) { st.numFmt = el.value; });
    bind('#plNumStart', function (el) { st.numStart = Math.max(1, parseInt(el.value, 10) || 1); });
    bind('#plNumSize', function (el) { st.numSize = Math.max(8, Math.min(48, parseInt(el.value, 10) || 13)); });
    bind('#plNumColor', function (el) { st.numColor = el.value; });
    bind('#plNumSkip1', function (el) { st.numSkipFirst = el.checked; });
    bind('#plNumPrevPg', function (el) { st.numPreviewPage = Math.max(1, Math.min(st.activePdf.numPages, parseInt(el.value, 10) || 1)); });

    st.root.querySelector('#plNumExport').onclick = async function () {
      var btn = this; btn.disabled = true;
      toast('جارٍ ترقيم الصفحات محلياً…', 2400);
      try {
        var PDFLib = await S.loadPdfLib();
        var pdfDoc = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
        var pages = pdfDoc.getPages();
        var totalEff = st.numSkipFirst ? Math.max(1, pages.length - 1) : pages.length;

        for (var i = 0; i < pages.length; i++) {
          if (st.numSkipFirst && i === 0) continue;
          var idx1 = st.numSkipFirst ? i : (i + 1);
          var txt = formatPageNumberLabel(idx1, totalEff);
          var png = S.renderTextToPng({ text: txt, fontSize: st.numSize, bold: true, color: st.numColor, scale: 3, paddingX: 6, paddingY: 3 });
          var emb = await pdfDoc.embedPng(png.bytes);

          var pg = pages[i];
          var box = pg.getCropBox() || pg.getMediaBox();
          var rot = ((pg.getRotation().angle || 0) % 360 + 360) % 360;
          var vw = (rot % 180 !== 0) ? box.height : box.width;
          var vh = (rot % 180 !== 0) ? box.width : box.height;

          var cy = st.numV === 'top' ? (22 / vh) : (1 - 22 / vh);
          var cx = st.numH === 'left' ? ((28 + png.width / 2) / vw) : (st.numH === 'right' ? (1 - (28 + png.width / 2) / vw) : 0.5);
          drawVisualCenteredImage(PDFLib, pg, emb, cx, cy, png.width, png.height, 1, 0);
        }
        var out = await pdfDoc.save({ useObjectStreams: true });
        S.downloadBlob(new Blob([out], { type: 'application/pdf' }), S.sanitizeFilename(st.activePdf.name, '') + '-مرقم.pdf');
        toast('تم ترقيم الصفحات وتنزيل الملف ✓');
      } catch (e) {
        toast('تعذّر الترقيم: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };
  }

  /* ==========================================================================
     5) العلامات المائية
     ========================================================================== */
  function renderWatermarkHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لإضافة علامة مائية (نص أو صورة)');
    if (!st.activePdf) return h;

    h += '<div class="pl-workspace">';
    h += '<div class="pl-card"><h3>إعدادات العلامة المائية</h3>';
    h += '<div class="pl-row" style="margin-bottom:10px">';
    h += '<label class="pl-btn sm' + (st.wmType === 'text' ? ' pri' : '') + '"><input type="radio" name="plWmType" value="text"' + (st.wmType === 'text' ? ' checked' : '') + '><span>علامة نصية</span></label>';
    h += '<label class="pl-btn sm' + (st.wmType === 'image' ? ' pri' : '') + '"><input type="radio" name="plWmType" value="image"' + (st.wmType === 'image' ? ' checked' : '') + '><span>علامة صورة (PNG/JPG)</span></label>';
    h += '</div>';

    if (st.wmType === 'text') {
      h += '<div class="pl-fld"><label class="pl-lbl">نص العلامة المائية</label><input class="pl-in" id="plWmText" value="' + S.esc(st.wmText) + '"></div>';
      h += '<div class="pl-grid2" style="margin-top:8px">';
      h += '<div class="pl-fld"><label class="pl-lbl">الحجم (' + st.wmSize + 'px)</label><input type="range" id="plWmSize" min="14" max="90" value="' + st.wmSize + '"></div>';
      h += '<div class="pl-fld"><label class="pl-lbl">اللون</label><input type="color" class="pl-in" id="plWmColor" value="' + st.wmColor + '"></div>';
      h += '</div>';
    } else {
      h += '<div class="pl-fld"><label class="pl-lbl">اختيار صورة العلامة (PNG أو JPG)</label><input type="file" id="plWmImgIn" accept="image/png,image/jpeg" class="pl-in"></div>';
      h += '<div class="pl-fld" style="margin-top:8px"><label class="pl-lbl">نسبة عرض الصورة من الصفحة (' + Math.round(st.wmImgScale * 100) + '%)</label><input type="range" id="plWmImgScale" min="10" max="85" value="' + Math.round(st.wmImgScale * 100) + '"></div>';
    }

    h += '<div class="pl-grid2" style="margin-top:8px">';
    h += '<div class="pl-fld"><label class="pl-lbl">الشفافية (' + Math.round(st.wmOpacity * 100) + '%)</label><input type="range" id="plWmOp" min="5" max="100" value="' + Math.round(st.wmOpacity * 100) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الزاوية (' + st.wmAngle + '°)</label><input type="range" id="plWmAng" min="-90" max="90" value="' + st.wmAngle + '"></div>';
    h += '</div>';

    h += '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="plWmTiled"' + (st.wmTiled ? ' checked' : '') + '><span>تكرار العلامة المائية على شكل شبكة بالصفحة</span></label>';

    h += '<div class="pl-grid2" style="margin-top:10px">';
    h += '<div class="pl-fld"><label class="pl-lbl">الصفحات المستهدفة</label><select class="pl-sel" id="plWmPgMode"><option value="all"' + (st.wmPagesMode === 'all' ? ' selected' : '') + '>كل الصفحات</option><option value="skip1"' + (st.wmPagesMode === 'skip1' ? ' selected' : '') + '>استثناء الغلاف</option><option value="custom"' + (st.wmPagesMode === 'custom' ? ' selected' : '') + '>نطاق مخصص</option></select></div>';
    h += '<div class="pl-fld"' + (st.wmPagesMode === 'custom' ? '' : ' hidden') + ' id="plWmRangeBox"><label class="pl-lbl">النطاق (مثال: 1-3, 5)</label><input class="pl-in" id="plWmRange" value="' + S.esc(st.wmRange) + '"></div>';
    h += '</div>';

    h += '<div class="pl-row" style="margin-top:14px"><button type="button" class="pl-btn accent" id="plWmExport">' + I.dl + '<span>تطبيق وتنزيل PDF بعلامة مائية</span></button></div>';
    h += '</div>';

    h += '<div class="pl-preview-box"><b>معاينة حية للعلامة المائية</b><div class="pl-preview-canvas-wrap"><canvas id="plWmPreviewCv"></canvas></div></div>';
    h += '</div>';
    return h;
  }

  var wmLoadedImg = null;
  function paintWatermarkPreview() {
    var cv = st.root && st.root.querySelector('#plWmPreviewCv');
    if (!cv || !st.activePdf) return;
    renderPdfPagePreviewCanvas(cv, 1, function (ctx, w, h, scale) {
      var centers = st.wmTiled ? [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]] : [[0.5, 0.5]];
      ctx.save();
      ctx.globalAlpha = st.wmOpacity;
      var rad = (-st.wmAngle) * Math.PI / 180;
      centers.forEach(function (c) {
        ctx.save();
        ctx.translate(c[0] * w, c[1] * h);
        ctx.rotate(rad);
        if (st.wmType === 'text' && st.wmText.trim()) {
          ctx.font = '700 ' + (st.wmSize * scale) + 'px Alexandria, Tahoma, Arial, sans-serif';
          ctx.fillStyle = st.wmColor;
          ctx.direction = S.hasArabic(st.wmText) ? 'rtl' : 'ltr';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(st.wmText, 0, 0);
        } else if (st.wmType === 'image' && wmLoadedImg) {
          var dw = w * st.wmImgScale;
          var dh = dw * (wmLoadedImg.naturalHeight / Math.max(1, wmLoadedImg.naturalWidth));
          ctx.drawImage(wmLoadedImg, -dw / 2, -dh / 2, dw, dh);
        }
        ctx.restore();
      });
      ctx.restore();
    });
  }

  function bindWatermarkEvents() {
    if (!st.activePdf) return;
    paintWatermarkPreview();

    st.root.querySelectorAll('input[name="plWmType"]').forEach(function (r) {
      r.onchange = function () { st.wmType = r.value; render(); };
    });

    var bind = function (id, fn) { var el = st.root.querySelector(id); if (el) el.oninput = el.onchange = function () { fn(el); paintWatermarkPreview(); }; };
    bind('#plWmText', function (el) { st.wmText = el.value; });
    bind('#plWmSize', function (el) { st.wmSize = Number(el.value) || 34; });
    bind('#plWmColor', function (el) { st.wmColor = el.value; });
    bind('#plWmOp', function (el) { st.wmOpacity = (Number(el.value) || 25) / 100; });
    bind('#plWmAng', function (el) { st.wmAngle = Number(el.value) || 0; });
    bind('#plWmTiled', function (el) { st.wmTiled = el.checked; });
    bind('#plWmImgScale', function (el) { st.wmImgScale = (Number(el.value) || 35) / 100; });

    var pm = st.root.querySelector('#plWmPgMode');
    if (pm) pm.onchange = function () {
      st.wmPagesMode = pm.value;
      var rb = st.root.querySelector('#plWmRangeBox');
      if (rb) rb.hidden = st.wmPagesMode !== 'custom';
    };
    var ri = st.root.querySelector('#plWmRange');
    if (ri) ri.oninput = function () { st.wmRange = ri.value; };

    var ii = st.root.querySelector('#plWmImgIn');
    if (ii) {
      ii.onchange = async function () {
        var f = ii.files && ii.files[0];
        if (!f) return;
        st.wmImgBytes = new Uint8Array(await f.arrayBuffer());
        st.wmImgMime = f.type || (/\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg');
        if (st.wmImgUrl) URL.revokeObjectURL(st.wmImgUrl);
        st.wmImgUrl = URL.createObjectURL(f);
        var im = new Image();
        im.onload = function () { wmLoadedImg = im; paintWatermarkPreview(); };
        im.src = st.wmImgUrl;
      };
    }

    st.root.querySelector('#plWmExport').onclick = async function () {
      if (st.wmType === 'text' && !st.wmText.trim()) { toast('اكتب نص العلامة المائية'); return; }
      if (st.wmType === 'image' && !st.wmImgBytes) { toast('اختر صورة للعلامة المائية'); return; }

      var targetSet = Object.create(null);
      if (st.wmPagesMode === 'custom') {
        var pr = S.parsePageRanges(st.wmRange, st.activePdf.numPages);
        if (!pr.ok) { toast(pr.error, 3200); return; }
        pr.pages.forEach(function (p) { targetSet[p] = true; });
      } else {
        for (var p = 1; p <= st.activePdf.numPages; p++) {
          if (st.wmPagesMode === 'skip1' && p === 1) continue;
          targetSet[p] = true;
        }
      }

      var btn = this; btn.disabled = true;
      toast('جارٍ تطبيق العلامة المائية…', 2400);
      try {
        var PDFLib = await S.loadPdfLib();
        var pdfDoc = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
        var emb, baseW, baseH;
        if (st.wmType === 'text') {
          var png = S.renderTextToPng({ text: st.wmText.trim(), fontSize: st.wmSize, bold: true, color: st.wmColor, scale: 3, paddingX: 10, paddingY: 6 });
          emb = await pdfDoc.embedPng(png.bytes);
          baseW = png.width; baseH = png.height;
        } else {
          emb = st.wmImgMime.indexOf('png') !== -1 ? await pdfDoc.embedPng(st.wmImgBytes) : await pdfDoc.embedJpg(st.wmImgBytes);
          baseW = emb.width; baseH = emb.height;
        }

        var centers = st.wmTiled ? [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]] : [[0.5, 0.5]];
        var pages = pdfDoc.getPages();
        pages.forEach(function (pg, idx) {
          if (!targetSet[idx + 1]) return;
          var box = pg.getCropBox() || pg.getMediaBox();
          var rot = ((pg.getRotation().angle || 0) % 360 + 360) % 360;
          var vw = (rot % 180 !== 0) ? box.height : box.width;
          var drawW = st.wmType === 'image' ? (vw * st.wmImgScale) : baseW;
          var drawH = st.wmType === 'image' ? (drawW * (baseH / Math.max(1, baseW))) : baseH;
          centers.forEach(function (c) {
            drawVisualCenteredImage(PDFLib, pg, emb, c[0], c[1], drawW, drawH, st.wmOpacity, -st.wmAngle);
          });
        });

        var out = await pdfDoc.save({ useObjectStreams: true });
        S.downloadBlob(new Blob([out], { type: 'application/pdf' }), S.sanitizeFilename(st.activePdf.name, '') + '-علامة-مائية.pdf');
        toast('تمت إضافة العلامة المائية ✓');
      } catch (e) {
        toast('تعذّر تطبيق العلامة المائية: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };
  }

  /* ==========================================================================
     6) تحويل صور JPG/PNG إلى PDF
     ========================================================================== */
  function renderImg2PdfHtml() {
    var h = '<div class="pl-card"><h3>تحويل الصور (JPG / PNG / WebP) إلى PDF</h3>';
    h += '<input type="file" id="plImgIn" accept="image/jpeg,image/png,image/webp" multiple hidden>';
    h += '<label class="pl-drop" id="plImgDrop" for="plImgIn"><b>+ اختر صوراً أو أسقطها هنا</b><small>رتّب الصور كما تريد ودوّرها ثم صدّرها في ملف PDF واحد</small></label>';

    if (st.imgList.length) {
      h += '<div class="pl-grid3" style="margin-top:12px">';
      h += '<div class="pl-fld"><label class="pl-lbl">حجم الصفحة</label><select class="pl-sel" id="plI2pSize"><option value="a4"' + (st.imgPageSize === 'a4' ? ' selected' : '') + '>A4 قياسي</option><option value="letter"' + (st.imgPageSize === 'letter' ? ' selected' : '') + '>Letter</option><option value="fit"' + (st.imgPageSize === 'fit' ? ' selected' : '') + '>مطابق لمقاس الصورة</option></select></div>';
      h += '<div class="pl-fld"><label class="pl-lbl">الاتجاه</label><select class="pl-sel" id="plI2pOri"><option value="auto"' + (st.imgOrient === 'auto' ? ' selected' : '') + '>تلقائي حسب الصورة</option><option value="portrait"' + (st.imgOrient === 'portrait' ? ' selected' : '') + '>عمودي</option><option value="landscape"' + (st.imgOrient === 'landscape' ? ' selected' : '') + '>أفقي</option></select></div>';
      h += '<div class="pl-fld"><label class="pl-lbl">الهامش (pt)</label><input type="number" class="pl-in" id="plI2pMargin" min="0" max="72" value="' + st.imgMargin + '"></div>';
      h += '</div>';

      h += '<div class="pl-pages-grid">';
      st.imgList.forEach(function (im, i) {
        h += '<div class="pl-pg-card" draggable="true" data-iidx="' + i + '">';
        h += '<div class="pl-pg-top"><span>#' + (i + 1) + '</span><span style="font-size:11px;color:var(--muted);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + S.esc(im.name) + '</span></div>';
        h += '<div class="pl-pg-thumb"><img src="' + im.url + '" alt="" style="transform:rotate(' + im.rot + 'deg)"></div>';
        h += '<div class="pl-pg-acts">';
        h += '<button type="button" class="pl-pg-mini" data-imove="-1" data-idx="' + i + '"' + (i === 0 ? ' disabled' : '') + '>→</button>';
        h += '<button type="button" class="pl-pg-mini" data-imove="1" data-idx="' + i + '"' + (i === st.imgList.length - 1 ? ' disabled' : '') + '>←</button>';
        h += '<button type="button" class="pl-pg-mini" data-irot="' + i + '">↻</button>';
        h += '<button type="button" class="pl-pg-mini dng" style="grid-column:span 2" data-idel="' + i + '">حذف</button>';
        h += '</div></div>';
      });
      h += '</div>';

      h += '<div class="pl-row" style="margin-top:14px">';
      h += '<button type="button" class="pl-btn accent" id="plI2pRun">' + I.dl + '<span>إنشاء وتنزيل PDF (' + st.imgList.length + ' صورة)</span></button>';
      h += '<button type="button" class="pl-btn danger" id="plI2pClear">مسح الصور</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function bindImg2PdfEvents() {
    var fi = st.root.querySelector('#plImgIn');
    var dz = st.root.querySelector('#plImgDrop');
    async function addImgs(files) {
      if (!files || !files.length) return;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) continue;
        var url = URL.createObjectURL(f);
        var dims = await new Promise(function (res) {
          var im = new Image();
          im.onload = function () { res({ w: im.naturalWidth, h: im.naturalHeight, el: im }); };
          im.onerror = function () { res({ w: 800, h: 600, el: null }); };
          im.src = url;
        });
        st.imgList.push({
          id: S.uid('im'),
          name: f.name,
          mime: f.type,
          bytes: new Uint8Array(await f.arrayBuffer()),
          url: url,
          width: dims.w,
          height: dims.h,
          rot: 0
        });
      }
      render();
    }
    if (fi) fi.onchange = function () { addImgs(fi.files); fi.value = ''; };
    if (dz) {
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
      dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('over'); addImgs(e.dataTransfer && e.dataTransfer.files); });
    }

    var sz = st.root.querySelector('#plI2pSize'); if (sz) sz.onchange = function () { st.imgPageSize = sz.value; };
    var ori = st.root.querySelector('#plI2pOri'); if (ori) ori.onchange = function () { st.imgOrient = ori.value; };
    var mg = st.root.querySelector('#plI2pMargin'); if (mg) oninputOrChange(mg, function () { st.imgMargin = Math.max(0, Math.min(72, parseInt(mg.value, 10) || 0)); });

    st.root.querySelectorAll('[data-imove]').forEach(function (b) {
      b.onclick = function () {
        var idx = Number(b.dataset.idx), nxt = idx + Number(b.dataset.imove);
        if (nxt < 0 || nxt >= st.imgList.length) return;
        var t = st.imgList[idx]; st.imgList[idx] = st.imgList[nxt]; st.imgList[nxt] = t; render();
      };
    });
    st.root.querySelectorAll('[data-irot]').forEach(function (b) {
      b.onclick = function () { var im = st.imgList[Number(b.dataset.irot)]; im.rot = (im.rot + 90) % 360; render(); };
    });
    st.root.querySelectorAll('[data-idel]').forEach(function (b) {
      b.onclick = function () {
        var rm = st.imgList.splice(Number(b.dataset.idel), 1)[0];
        if (rm && rm.url) URL.revokeObjectURL(rm.url);
        render();
      };
    });
    var clr = st.root.querySelector('#plI2pClear');
    if (clr) clr.onclick = function () { st.imgList.forEach(function (x) { if (x.url) URL.revokeObjectURL(x.url); }); st.imgList = []; render(); };

    var dragFrom = -1;
    st.root.querySelectorAll('[data-iidx]').forEach(function (el) {
      el.addEventListener('dragstart', function () { dragFrom = Number(el.dataset.iidx); el.classList.add('dragging'); });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); dragFrom = -1; });
      el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('drop-target'); });
      el.addEventListener('dragleave', function () { el.classList.remove('drop-target'); });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); el.classList.remove('drop-target');
        var to = Number(el.dataset.iidx);
        if (dragFrom >= 0 && dragFrom !== to) {
          var mv = st.imgList.splice(dragFrom, 1)[0];
          st.imgList.splice(to, 0, mv);
          render();
        }
      });
    });

    var run = st.root.querySelector('#plI2pRun');
    if (run) {
      run.onclick = async function () {
        if (!st.imgList.length) return;
        run.disabled = true;
        toast('جارٍ تحويل الصور إلى PDF…', 2400);
        try {
          var PDFLib = await S.loadPdfLib();
          var doc = await PDFLib.PDFDocument.create();
          for (var i = 0; i < st.imgList.length; i++) {
            var item = st.imgList[i];
            var pngOrJpgBytes = item.bytes;
            var isPng = item.mime.indexOf('png') !== -1;
            /* إذا كان هناك تدوير أو WebP نعيد رسم الصورة بزاويتها على Canvas نظيف */
            if (item.rot !== 0 || item.mime.indexOf('webp') !== -1) {
              pngOrJpgBytes = await rasterizeRotatedImage(item.url, item.rot, isPng ? 'image/png' : 'image/jpeg');
            }
            var emb = isPng ? await doc.embedPng(pngOrJpgBytes) : await doc.embedJpg(pngOrJpgBytes);
            var iw = emb.width, ih = emb.height;
            var pw, ph;
            if (st.imgPageSize === 'fit') {
              pw = iw + st.imgMargin * 2;
              ph = ih + st.imgMargin * 2;
            } else {
              var base = st.imgPageSize === 'letter' ? [612, 792] : [595.28, 841.89];
              var wantLand = st.imgOrient === 'landscape' || (st.imgOrient === 'auto' && iw > ih);
              pw = wantLand ? base[1] : base[0];
              ph = wantLand ? base[0] : base[1];
            }
            var pg = doc.addPage([pw, ph]);
            var availW = Math.max(20, pw - st.imgMargin * 2);
            var availH = Math.max(20, ph - st.imgMargin * 2);
            var sc = Math.min(availW / iw, availH / ih);
            var dw = iw * sc, dh = ih * sc;
            pg.drawImage(emb, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
          }
          var out = await doc.save({ useObjectStreams: true });
          S.downloadBlob(new Blob([out], { type: 'application/pdf' }), 'صور-إلى-PDF.pdf');
          toast('تم إنشاء ملف PDF من الصور ✓');
        } catch (e) {
          toast('تعذّر التحويل: ' + (e && e.message ? e.message : ''), 3400);
        } finally { run.disabled = false; }
      };
    }
  }

  function oninputOrChange(el, fn) { el.oninput = fn; el.onchange = fn; }

  function rasterizeRotatedImage(url, rotDeg, outMime) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () {
        var r = ((rotDeg % 360) + 360) % 360;
        var swap = r === 90 || r === 270;
        var cv = document.createElement('canvas');
        cv.width = swap ? im.naturalHeight : im.naturalWidth;
        cv.height = swap ? im.naturalWidth : im.naturalHeight;
        var ctx = cv.getContext('2d');
        ctx.translate(cv.width / 2, cv.height / 2);
        ctx.rotate(r * Math.PI / 180);
        ctx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
        resolve(S.dataUrlToU8(cv.toDataURL(outMime || 'image/jpeg', 0.92)));
      };
      im.onerror = reject;
      im.src = url;
    });
  }

  /* ==========================================================================
     7) تحويل PDF إلى صور PNG / JPG
     ========================================================================== */
  function renderPdf2ImgHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لتحويل صفحاته إلى صور PNG أو JPG');
    if (!st.activePdf) return h;

    h += '<div class="pl-card"><h3>تحويل الصفحات إلى صور (' + st.activePdf.numPages + ' صفحة)</h3>';
    h += '<div class="pl-grid3">';
    h += '<div class="pl-fld"><label class="pl-lbl">صيغة الصورة</label><select class="pl-sel" id="plP2iFmt"><option value="png"' + (st.p2iFormat === 'png' ? ' selected' : '') + '>PNG (دقة عالية غير مضغوطة)</option><option value="jpeg"' + (st.p2iFormat === 'jpeg' ? ' selected' : '') + '>JPG (حجم أصغر)</option></select></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الدقة</label><select class="pl-sel" id="plP2iScale"><option value="1"' + (st.p2iScale === 1 ? ' selected' : '') + '>1x قياسي</option><option value="1.5"' + (st.p2iScale === 1.5 ? ' selected' : '') + '>1.5x متوسط</option><option value="2"' + (st.p2iScale === 2 ? ' selected' : '') + '>2x عالي الدقة</option><option value="3"' + (st.p2iScale === 3 ? ' selected' : '') + '>3x فائق</option></select></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الصفحات</label><select class="pl-sel" id="plP2iMode"><option value="all"' + (st.p2iPagesMode === 'all' ? ' selected' : '') + '>كل الصفحات</option><option value="custom"' + (st.p2iPagesMode === 'custom' ? ' selected' : '') + '>نطاق مخصص</option></select></div>';
    h += '</div>';
    h += '<div class="pl-fld" id="plP2iRangeBox" style="margin-top:8px"' + (st.p2iPagesMode === 'custom' ? '' : ' hidden') + '><label class="pl-lbl">نطاق الصفحات (مثال: 1-3, 5)</label><input class="pl-in" id="plP2iRange" value="' + S.esc(st.p2iRange) + '"></div>';

    h += '<div class="pl-row" style="margin-top:12px">';
    h += '<button type="button" class="pl-btn accent" id="plP2iRun">تحويل ومعاينة الصور</button>';
    if (st.p2iOutputs.length) {
      h += '<button type="button" class="pl-btn pri" id="plP2iZip">' + I.dl + '<span>تنزيل جميع الصور (ZIP)</span></button>';
    }
    h += '</div>';

    if (st.p2iOutputs.length) {
      h += '<div class="pl-pages-grid">';
      st.p2iOutputs.forEach(function (out, idx) {
        h += '<div class="pl-pg-card"><div class="pl-pg-top"><span>صفحة ' + out.page + '</span><span style="font-size:11px;color:var(--muted)">' + S.formatBytes(out.blob.size) + '</span></div>';
        h += '<div class="pl-pg-thumb"><img src="' + out.url + '" alt="صفحة ' + out.page + '"></div>';
        h += '<button type="button" class="pl-btn sm pri" data-p2idl="' + idx + '">' + I.dl + '<span>تنزيل</span></button></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function bindPdf2ImgEvents() {
    if (!st.activePdf) return;
    st.root.querySelector('#plP2iFmt').onchange = function () { st.p2iFormat = this.value; };
    st.root.querySelector('#plP2iScale').onchange = function () { st.p2iScale = Number(this.value) || 2; };
    st.root.querySelector('#plP2iMode').onchange = function () {
      st.p2iPagesMode = this.value;
      st.root.querySelector('#plP2iRangeBox').hidden = st.p2iPagesMode !== 'custom';
    };
    var ri = st.root.querySelector('#plP2iRange');
    if (ri) ri.oninput = function () { st.p2iRange = ri.value; };

    st.root.querySelector('#plP2iRun').onclick = async function () {
      var pages = [];
      if (st.p2iPagesMode === 'custom') {
        var pr = S.parsePageRanges(st.p2iRange, st.activePdf.numPages);
        if (!pr.ok) { toast(pr.error, 3200); return; }
        pages = pr.pages;
      } else {
        for (var p = 1; p <= st.activePdf.numPages; p++) pages.push(p);
      }

      var btn = this; btn.disabled = true;
      toast('جارٍ تحويل ' + pages.length + ' صفحة إلى صور…', 2500);
      try {
        st.p2iOutputs.forEach(function (o) { if (o.url) URL.revokeObjectURL(o.url); });
        var outs = [];
        var ext = st.p2iFormat === 'jpeg' ? 'jpg' : 'png';
        var mime = st.p2iFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        var base = S.sanitizeFilename(st.activePdf.name, '');

        for (var i = 0; i < pages.length; i++) {
          var pgNum = pages[i];
          var pg = await st.activePdf.doc.getPage(pgNum);
          var vp = pg.getViewport({ scale: st.p2iScale });
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.floor(vp.width));
          cv.height = Math.max(1, Math.floor(vp.height));
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cv.width, cv.height);
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          var blob = await new Promise(function (res) { cv.toBlob(res, mime, 0.92); });
          outs.push({ page: pgNum, name: base + '-صفحة-' + pgNum + '.' + ext, blob: blob, url: URL.createObjectURL(blob) });
        }
        st.p2iOutputs = outs;
        render();
        toast('تم تحويل ' + outs.length + ' صفحة إلى صور ✓');
      } catch (e) {
        toast('تعذّر التحويل: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };

    st.root.querySelectorAll('[data-p2idl]').forEach(function (b) {
      b.onclick = function () {
        var o = st.p2iOutputs[Number(b.dataset.p2idl)];
        if (o) S.downloadBlob(o.blob, o.name);
      };
    });
    var zip = st.root.querySelector('#plP2iZip');
    if (zip) {
      zip.onclick = async function () {
        var entries = [];
        for (var i = 0; i < st.p2iOutputs.length; i++) {
          entries.push({ name: st.p2iOutputs[i].name, data: new Uint8Array(await st.p2iOutputs[i].blob.arrayBuffer()) });
        }
        S.downloadBlob(S.buildZip(entries), S.sanitizeFilename(st.activePdf.name, '') + '-صور.zip');
        toast('تم تنزيل الأرشيف ZIP ✓');
      };
    }
  }

  /* ==========================================================================
     8) ضغط ملفات PDF محلياً
     ========================================================================== */
  function renderCompressHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لضغطه محلياً وتقليل حجمه');
    if (!st.activePdf) return h;

    h += '<div class="pl-card"><h3>ضغط ملف PDF محلياً</h3>';
    h += '<div class="pl-grid2">';
    h += '<label class="pl-btn' + (st.cmpMode === 'lossless' ? ' pri' : '') + '" style="justify-content:flex-start"><input type="radio" name="plCmpM" value="lossless"' + (st.cmpMode === 'lossless' ? ' checked' : '') + '><span><b>ضغط هيكلي (يحافظ على النصوص القابلة للبحث)</b></span></label>';
    h += '<label class="pl-btn' + (st.cmpMode === 'raster' ? ' pri' : '') + '" style="justify-content:flex-start"><input type="radio" name="plCmpM" value="raster"' + (st.cmpMode === 'raster' ? ' checked' : '') + '><span><b>ضغط صوري قوي (للملفات الثقيلة والممسوحة ضوئياً)</b></span></label>';
    h += '</div>';

    if (st.cmpMode === 'raster') {
      h += '<div class="pl-grid2" style="margin-top:10px">';
      h += '<div class="pl-fld"><label class="pl-lbl">دقة الصفحات (' + st.cmpScale + 'x)</label><select class="pl-sel" id="plCmpScale"><option value="0.9"' + (st.cmpScale === 0.9 ? ' selected' : '') + '>منخفضة (أصغر حجم)</option><option value="1.2"' + (st.cmpScale === 1.2 ? ' selected' : '') + '>متوسطة (متوازنة)</option><option value="1.6"' + (st.cmpScale === 1.6 ? ' selected' : '') + '>جيدة</option></select></div>';
      h += '<div class="pl-fld"><label class="pl-lbl">جودة الضغط (' + Math.round(st.cmpQuality * 100) + '%)</label><input type="range" id="plCmpQual" min="45" max="88" value="' + Math.round(st.cmpQuality * 100) + '"></div>';
      h += '</div>';
      h += '<div class="pl-msg warn" style="margin-top:8px">ملاحظة: الضغط الصوري يعيد رسم الصفحات كصور JPEG مضغوطة لتقليص الحجم كثيراً، مما يحوّل النصوص إلى صور.</div>';
    }

    h += '<div class="pl-row" style="margin-top:12px"><button type="button" class="pl-btn accent" id="plCmpRun">تنفيذ الضغط وحساب التوفير</button></div>';

    if (st.cmpResult) {
      var diff = st.cmpResult.origSize - st.cmpResult.newSize;
      var pct = st.cmpResult.origSize ? Math.round(diff * 100 / st.cmpResult.origSize) : 0;
      h += '<div class="pl-stats-bar" style="margin-top:12px">';
      h += '<div class="pl-stat"><b>' + S.formatBytes(st.cmpResult.origSize) + '</b><span>الحجم الأصلي</span></div>';
      h += '<div class="pl-stat"><b>' + S.formatBytes(st.cmpResult.newSize) + '</b><span>الحجم بعد الضغط</span></div>';
      h += '<div class="pl-stat"><b>' + (pct >= 0 ? pct + '%' : '0%') + '</b><span>نسبة التوفير</span></div>';
      h += '</div>';
      h += '<div class="pl-row" style="margin-top:10px"><button type="button" class="pl-btn pri" id="plCmpDl">' + I.dl + '<span>تنزيل الملف المضغوط</span></button></div>';
    }
    h += '</div>';
    return h;
  }

  function bindCompressEvents() {
    if (!st.activePdf) return;
    st.root.querySelectorAll('input[name="plCmpM"]').forEach(function (r) {
      r.onchange = function () { st.cmpMode = r.value; st.cmpResult = null; render(); };
    });
    var sc = st.root.querySelector('#plCmpScale'); if (sc) sc.onchange = function () { st.cmpScale = Number(sc.value) || 1.2; };
    var ql = st.root.querySelector('#plCmpQual'); if (ql) ql.oninput = function () { st.cmpQuality = (Number(ql.value) || 72) / 100; };

    st.root.querySelector('#plCmpRun').onclick = async function () {
      var btn = this; btn.disabled = true;
      toast('جارٍ ضغط الملف محلياً…', 2500);
      try {
        var PDFLib = await S.loadPdfLib();
        var outBytes;
        if (st.cmpMode === 'lossless') {
          var src = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
          var clean = await PDFLib.PDFDocument.create();
          var idxs = [];
          for (var i = 0; i < src.getPageCount(); i++) idxs.push(i);
          var copied = await clean.copyPages(src, idxs);
          copied.forEach(function (pg) { clean.addPage(pg); });
          outBytes = await clean.save({ useObjectStreams: true, addDefaultPage: false });
        } else {
          var newDoc = await PDFLib.PDFDocument.create();
          for (var p = 1; p <= st.activePdf.numPages; p++) {
            var pg = await st.activePdf.doc.getPage(p);
            var vp0 = pg.getViewport({ scale: 1 });
            var vp = pg.getViewport({ scale: st.cmpScale });
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.floor(vp.width));
            cv.height = Math.max(1, Math.floor(vp.height));
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cv.width, cv.height);
            await pg.render({ canvasContext: ctx, viewport: vp }).promise;
            var jpgBytes = S.dataUrlToU8(cv.toDataURL('image/jpeg', st.cmpQuality));
            var emb = await newDoc.embedJpg(jpgBytes);
            var outPg = newDoc.addPage([vp0.width, vp0.height]);
            outPg.drawImage(emb, { x: 0, y: 0, width: vp0.width, height: vp0.height });
          }
          outBytes = await newDoc.save({ useObjectStreams: true });
        }
        st.cmpResult = {
          origSize: st.activePdf.size,
          newSize: outBytes.byteLength,
          bytes: outBytes,
          name: S.sanitizeFilename(st.activePdf.name, '') + '-مضغوط.pdf'
        };
        render();
        toast('اكتمل الضغط — يمكنك معاينة التوفير وتنزيل الملف ✓');
      } catch (e) {
        toast('تعذّر الضغط: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };

    var dl = st.root.querySelector('#plCmpDl');
    if (dl && st.cmpResult) {
      dl.onclick = function () { S.downloadBlob(new Blob([st.cmpResult.bytes], { type: 'application/pdf' }), st.cmpResult.name); };
    }
  }

  /* ==========================================================================
     9) عرض وتعديل معلومات وبيانات PDF
     ========================================================================== */
  function renderMetaHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لفحص أبعاده وبياناته الوصفية أو تعديلها');
    if (!st.activePdf || !st.metaInfo) return h;

    var m = st.metaInfo;
    h += '<div class="pl-card"><h3>بطاقة فحص الملف</h3>';
    h += '<div class="pl-stats-bar">';
    h += '<div class="pl-stat"><b>' + st.activePdf.numPages + '</b><span>عدد الصفحات</span></div>';
    h += '<div class="pl-stat"><b>' + S.formatBytes(st.activePdf.size) + '</b><span>الحجم</span></div>';
    h += '<div class="pl-stat"><b>' + (m.hasText ? 'نعم' : 'صور/ممسوح') + '</b><span>قابلية البحث النصي</span></div>';
    h += '</div></div>';

    h += '<div class="pl-card"><h3>تعديل البيانات الوصفية (Metadata) وحفظ نسخة جديدة</h3>';
    h += '<div class="pl-grid2">';
    h += '<div class="pl-fld"><label class="pl-lbl">العنوان (Title)</label><input class="pl-in" id="plMtTitle" value="' + S.esc(m.title) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">المؤلف (Author)</label><input class="pl-in" id="plMtAuthor" value="' + S.esc(m.author) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الموضوع (Subject)</label><input class="pl-in" id="plMtSubject" value="' + S.esc(m.subject) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الكلمات المفتاحية (Keywords)</label><input class="pl-in" id="plMtKeywords" value="' + S.esc(m.keywords) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">أداة الإنشاء (Creator)</label><input class="pl-in" id="plMtCreator" value="' + S.esc(m.creator) + '"></div>';
    h += '</div>';
    h += '<div class="pl-row" style="margin-top:12px"><button type="button" class="pl-btn accent" id="plMtSave">' + I.dl + '<span>حفظ وتنزيل PDF محدث البيانات</span></button></div>';
    h += '</div>';

    h += '<div class="pl-card"><h3>مقاسات الصفحات</h3><div style="max-height:240px;overflow:auto"><table class="pl-table"><thead><tr><th>الصفحة</th><th>المقاس (mm)</th><th>المقاس (pt)</th><th>الاتجاه</th><th>التدوير</th></tr></thead><tbody>';
    m.pages.forEach(function (pg) {
      h += '<tr><td>' + pg.page + '</td><td>' + pg.wMm + ' × ' + pg.hMm + '</td><td>' + pg.wPt + ' × ' + pg.hPt + '</td><td>' + pg.orient + '</td><td>' + pg.rot + '°</td></tr>';
    });
    h += '</tbody></table></div></div>';
    return h;
  }

  function bindMetaEvents() {
    if (!st.activePdf || !st.metaInfo) return;
    st.root.querySelector('#plMtSave').onclick = async function () {
      var btn = this; btn.disabled = true;
      try {
        var PDFLib = await S.loadPdfLib();
        var doc = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
        var title = st.root.querySelector('#plMtTitle').value;
        var author = st.root.querySelector('#plMtAuthor').value;
        var subject = st.root.querySelector('#plMtSubject').value;
        var kw = st.root.querySelector('#plMtKeywords').value;
        var creator = st.root.querySelector('#plMtCreator').value;
        doc.setTitle(title);
        doc.setAuthor(author);
        doc.setSubject(subject);
        doc.setKeywords(kw ? kw.split(/[,،]+/).map(function (s) { return s.trim(); }).filter(Boolean) : []);
        doc.setCreator(creator);
        var out = await doc.save({ useObjectStreams: true });
        S.downloadBlob(new Blob([out], { type: 'application/pdf' }), S.sanitizeFilename(st.activePdf.name, '') + '-بيانات-محدثة.pdf');
        toast('تم تحديث البيانات الوصفية وتنزيل الملف ✓');
      } catch (e) {
        toast('تعذّر حفظ البيانات: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };
  }

  /* ==========================================================================
     10) إضافة نصوص وصور على صفحات PDF
     ========================================================================== */
  function renderAnnotateHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لإضافة نصوص أو صور/تواقيع على صفحاته');
    if (!st.activePdf) return h;

    h += '<div class="pl-workspace">';
    h += '<div class="pl-card"><h3>إضافة عنصر على الصفحة</h3>';
    h += '<div class="pl-row" style="margin-bottom:10px">';
    h += '<label class="pl-btn sm' + (st.annKind === 'text' ? ' pri' : '') + '"><input type="radio" name="plAnnK" value="text"' + (st.annKind === 'text' ? ' checked' : '') + '><span>إضافة نص</span></label>';
    h += '<label class="pl-btn sm' + (st.annKind === 'image' ? ' pri' : '') + '"><input type="radio" name="plAnnK" value="image"' + (st.annKind === 'image' ? ' checked' : '') + '><span>إضافة صورة / توقيع</span></label>';
    h += '</div>';

    h += '<div class="pl-grid2">';
    h += '<div class="pl-fld"><label class="pl-lbl">الصفحة (1 إلى ' + st.activePdf.numPages + ')</label><input type="number" class="pl-in" id="plAnnPg" min="1" max="' + st.activePdf.numPages + '" value="' + st.annPage + '"></div>';
    h += '<label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="plAnnAll"' + (st.annAllPages ? ' checked' : '') + '><span>تطبيق على جميع الصفحات</span></label>';
    h += '</div>';

    if (st.annKind === 'text') {
      h += '<div class="pl-fld" style="margin-top:8px"><label class="pl-lbl">النص المراد إضافته</label><textarea class="pl-ta" id="plAnnText" style="min-height:68px">' + S.esc(st.annText) + '</textarea></div>';
      h += '<div class="pl-grid2" style="margin-top:8px">';
      h += '<div class="pl-fld"><label class="pl-lbl">حجم الخط (' + st.annFontSize + 'px)</label><input type="range" id="plAnnSize" min="10" max="48" value="' + st.annFontSize + '"></div>';
      h += '<div class="pl-fld"><label class="pl-lbl">اللون</label><input type="color" class="pl-in" id="plAnnColor" value="' + st.annColor + '"></div>';
      h += '</div>';
      h += '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="plAnnBg"' + (st.annBg ? ' checked' : '') + '><span>خلفية بيضاء خفيفة خلف النص</span></label>';
    } else {
      h += '<div class="pl-fld" style="margin-top:8px"><label class="pl-lbl">اختيار صورة (PNG أو JPG)</label><input type="file" id="plAnnImgIn" accept="image/png,image/jpeg" class="pl-in"></div>';
      h += '<div class="pl-fld" style="margin-top:8px"><label class="pl-lbl">عرض الصورة (pt: ' + st.annImgW + ')</label><input type="range" id="plAnnImgW" min="40" max="420" value="' + st.annImgW + '"></div>';
    }

    h += '<div class="pl-grid2" style="margin-top:8px">';
    h += '<div class="pl-fld"><label class="pl-lbl">الموضع الأفقي X (' + Math.round(st.annNx * 100) + '%)</label><input type="range" id="plAnnX" min="5" max="95" value="' + Math.round(st.annNx * 100) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">الموضع الرأسي Y (' + Math.round(st.annNy * 100) + '%)</label><input type="range" id="plAnnY" min="5" max="95" value="' + Math.round(st.annNy * 100) + '"></div>';
    h += '</div>';

    h += '<div class="pl-row" style="margin-top:10px">';
    h += '<button type="button" class="pl-btn pri" id="plAnnAddItem">' + I.plus + '<span>تثبيت العنصر في القائمة (' + st.annItems.length + ')</span></button>';
    h += '<button type="button" class="pl-btn accent" id="plAnnExport"' + (st.annItems.length ? '' : ' disabled') + '>' + I.dl + '<span>تصدير PDF مع العناصر</span></button>';
    h += '</div>';

    if (st.annItems.length) {
      h += '<div class="pl-file-list" style="margin-top:10px">';
      st.annItems.forEach(function (it, i) {
        h += '<div class="pl-file-item"><div style="flex:1;font-size:13px"><b>' + (it.kind === 'text' ? 'نص: ' + S.esc(it.text.slice(0, 28)) : 'صورة مضافة') + '</b><div style="font-size:11.5px;color:var(--muted)">' + (it.allPages ? 'كل الصفحات' : ('صفحة ' + it.page)) + '</div></div>';
        h += '<button type="button" class="pl-btn sm danger" data-adel="' + i + '">' + I.trash + '</button></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    h += '<div class="pl-preview-box"><b>انقر على الصفحة لتحديد الموضع مباشرة</b><div class="pl-preview-canvas-wrap" id="plAnnCanvasWrap"><canvas id="plAnnPreviewCv"></canvas></div></div>';
    h += '</div>';
    return h;
  }

  function paintAnnotatePreview() {
    var cv = st.root && st.root.querySelector('#plAnnPreviewCv');
    if (!cv || !st.activePdf) return;
    renderPdfPagePreviewCanvas(cv, st.annPage, function (ctx, w, h, scale) {
      function drawEntry(entry, isDraft) {
        ctx.save();
        var cx = entry.nx * w, cy = entry.ny * h;
        if (entry.kind === 'text' && entry.text.trim()) {
          var pImg = S.renderTextToPng({
            text: entry.text,
            fontSize: entry.fontSize,
            bold: true,
            color: entry.color,
            bgColor: entry.bg ? 'rgba(255,255,255,0.92)' : '',
            scale: 2,
            paddingX: 6,
            paddingY: 4
          });
          var dw = pImg.width * scale, dh = pImg.height * scale;
          if (entry.bg) {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
          }
          ctx.font = '700 ' + (entry.fontSize * scale) + 'px Alexandria, Tahoma, Arial, sans-serif';
          ctx.fillStyle = entry.color;
          ctx.direction = S.hasArabic(entry.text) ? 'rtl' : 'ltr';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var lines = entry.text.replace(/\r/g, '').split('\n');
          var lh = entry.fontSize * 1.45 * scale;
          lines.forEach(function (ln, idx) {
            var oy = cy + (idx - (lines.length - 1) / 2) * lh;
            ctx.fillText(ln, cx, oy);
          });
        } else if (entry.kind === 'image' && entry.imgEl) {
          var iw = entry.imgW * scale;
          var ih = iw * (entry.imgEl.naturalHeight / Math.max(1, entry.imgEl.naturalWidth));
          ctx.drawImage(entry.imgEl, cx - iw / 2, cy - ih / 2, iw, ih);
        }
        if (isDraft) {
          ctx.strokeStyle = '#7C3AED';
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(cx - 18, cy - 12, 36, 24);
        }
        ctx.restore();
      }

      st.annItems.forEach(function (it) {
        if (it.allPages || it.page === st.annPage) drawEntry(it, false);
      });
      drawEntry({
        kind: st.annKind,
        text: st.annText,
        fontSize: st.annFontSize,
        color: st.annColor,
        bg: st.annBg,
        nx: st.annNx,
        ny: st.annNy,
        imgEl: st.annImgEl,
        imgW: st.annImgW
      }, true);
    });
  }

  function bindAnnotateEvents() {
    if (!st.activePdf) return;
    paintAnnotatePreview();

    st.root.querySelectorAll('input[name="plAnnK"]').forEach(function (r) {
      r.onchange = function () { st.annKind = r.value; render(); };
    });

    var pgIn = st.root.querySelector('#plAnnPg');
    pgIn.onchange = pgIn.oninput = function () {
      st.annPage = Math.max(1, Math.min(st.activePdf.numPages, parseInt(pgIn.value, 10) || 1));
      paintAnnotatePreview();
    };
    st.root.querySelector('#plAnnAll').onchange = function () { st.annAllPages = this.checked; };

    var bind = function (id, fn) { var el = st.root.querySelector(id); if (el) el.oninput = el.onchange = function () { fn(el); paintAnnotatePreview(); }; };
    bind('#plAnnText', function (el) { st.annText = el.value; });
    bind('#plAnnSize', function (el) { st.annFontSize = Number(el.value) || 18; });
    bind('#plAnnColor', function (el) { st.annColor = el.value; });
    bind('#plAnnBg', function (el) { st.annBg = el.checked; });
    bind('#plAnnImgW', function (el) { st.annImgW = Number(el.value) || 120; });
    bind('#plAnnX', function (el) { st.annNx = (Number(el.value) || 50) / 100; });
    bind('#plAnnY', function (el) { st.annNy = (Number(el.value) || 20) / 100; });

    var imgIn = st.root.querySelector('#plAnnImgIn');
    if (imgIn) {
      imgIn.onchange = async function () {
        var f = imgIn.files && imgIn.files[0];
        if (!f) return;
        st.annImgBytes = new Uint8Array(await f.arrayBuffer());
        st.annImgMime = f.type || (/\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg');
        if (st.annImgUrl) URL.revokeObjectURL(st.annImgUrl);
        st.annImgUrl = URL.createObjectURL(f);
        var im = new Image();
        im.onload = function () { st.annImgEl = im; paintAnnotatePreview(); };
        im.src = st.annImgUrl;
      };
    }

    var wrap = st.root.querySelector('#plAnnCanvasWrap');
    wrap.addEventListener('click', function (e) {
      var rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      st.annNx = Math.max(0.04, Math.min(0.96, (e.clientX - rect.left) / rect.width));
      st.annNy = Math.max(0.04, Math.min(0.96, (e.clientY - rect.top) / rect.height));
      var rx = st.root.querySelector('#plAnnX'); if (rx) rx.value = String(Math.round(st.annNx * 100));
      var ry = st.root.querySelector('#plAnnY'); if (ry) ry.value = String(Math.round(st.annNy * 100));
      paintAnnotatePreview();
    });

    st.root.querySelector('#plAnnAddItem').onclick = function () {
      if (st.annKind === 'text' && !st.annText.trim()) { toast('اكتب النص أولاً'); return; }
      if (st.annKind === 'image' && !st.annImgBytes) { toast('اختر صورة أولاً'); return; }
      st.annItems.push({
        id: S.uid('ai'),
        kind: st.annKind,
        page: st.annPage,
        allPages: st.annAllPages,
        nx: st.annNx,
        ny: st.annNy,
        text: st.annText,
        fontSize: st.annFontSize,
        color: st.annColor,
        bg: st.annBg,
        imgBytes: st.annImgBytes ? st.annImgBytes.slice() : null,
        imgMime: st.annImgMime,
        imgEl: st.annImgEl,
        imgW: st.annImgW
      });
      render();
      toast('تمت إضافة العنصر — يمكنك إضافة المزيد أو التصدير');
    };

    st.root.querySelectorAll('[data-adel]').forEach(function (b) {
      b.onclick = function () { st.annItems.splice(Number(b.dataset.adel), 1); render(); };
    });

    st.root.querySelector('#plAnnExport').onclick = async function () {
      if (!st.annItems.length) return;
      var btn = this; btn.disabled = true;
      toast('جارٍ دمج العناصر في PDF…', 2400);
      try {
        var PDFLib = await S.loadPdfLib();
        var doc = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
        var pages = doc.getPages();

        for (var k = 0; k < st.annItems.length; k++) {
          var it = st.annItems[k];
          var emb, dw, dh;
          if (it.kind === 'text') {
            var png = S.renderTextToPng({
              text: it.text,
              fontSize: it.fontSize,
              bold: true,
              color: it.color,
              bgColor: it.bg ? 'rgba(255,255,255,0.92)' : '',
              scale: 3,
              paddingX: 8,
              paddingY: 5
            });
            emb = await doc.embedPng(png.bytes);
            dw = png.width; dh = png.height;
          } else {
            emb = it.imgMime.indexOf('png') !== -1 ? await doc.embedPng(it.imgBytes) : await doc.embedJpg(it.imgBytes);
            dw = it.imgW;
            dh = dw * (emb.height / Math.max(1, emb.width));
          }

          pages.forEach(function (pg, idx) {
            if (!it.allPages && (idx + 1) !== it.page) return;
            drawVisualCenteredImage(PDFLib, pg, emb, it.nx, it.ny, dw, dh, 1, 0);
          });
        }
        var out = await doc.save({ useObjectStreams: true });
        S.downloadBlob(new Blob([out], { type: 'application/pdf' }), S.sanitizeFilename(st.activePdf.name, '') + '-بعناصر-مضافة.pdf');
        toast('تم تصدير الملف الجديد ✓');
      } catch (e) {
        toast('تعذّر التصدير: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };
  }

  /* ==========================================================================
     11) إضافة رأس وتذييل للصفحات
     ========================================================================== */
  function resolveHfTokens(tpl, pgNum, total) {
    return String(tpl || '').replace(/\{page\}/gi, String(pgNum)).replace(/\{total\}/gi, String(total));
  }

  function renderHeaderFooterHtml() {
    var h = renderActivePdfBanner('اختر ملف PDF لإضافة رأس وتذييل على الصفحات');
    if (!st.activePdf) return h;

    h += '<div class="pl-workspace">';
    h += '<div class="pl-card"><h3>إعدادات الرأس والتذييل</h3>';
    h += '<p style="font-size:12.5px;color:var(--muted);margin-bottom:8px">استعمل <code>{page}</code> لرقم الصفحة و<code>{total}</code> لإجمالي الصفحات.</p>';
    h += '<div class="pl-grid3">';
    h += '<div class="pl-fld"><label class="pl-lbl">رأس يمين</label><input class="pl-in" id="plHfHR" value="' + S.esc(st.hfHRight) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">رأس وسط</label><input class="pl-in" id="plHfHC" value="' + S.esc(st.hfHCenter) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">رأس يسار</label><input class="pl-in" id="plHfHL" value="' + S.esc(st.hfHLeft) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">تذييل يمين</label><input class="pl-in" id="plHfFR" value="' + S.esc(st.hfFRight) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">تذييل وسط</label><input class="pl-in" id="plHfFC" value="' + S.esc(st.hfFCenter) + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">تذييل يسار</label><input class="pl-in" id="plHfFL" value="' + S.esc(st.hfFLeft) + '"></div>';
    h += '</div>';

    h += '<div class="pl-grid2" style="margin-top:8px">';
    h += '<div class="pl-fld"><label class="pl-lbl">حجم الخط (px)</label><input type="number" class="pl-in" id="plHfSize" min="8" max="24" value="' + st.hfSize + '"></div>';
    h += '<div class="pl-fld"><label class="pl-lbl">اللون</label><input type="color" class="pl-in" id="plHfColor" value="' + st.hfColor + '"></div>';
    h += '</div>';

    h += '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="plHfLine"' + (st.hfLine ? ' checked' : '') + '><span>إضافة خط فاصل خفيف للرأس والتذييل</span></label>';
    h += '<label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="plHfSkip1"' + (st.hfSkipFirst ? ' checked' : '') + '><span>استثناء صفحة الغلاف (الأولى)</span></label>';

    h += '<div class="pl-row" style="margin-top:12px"><button type="button" class="pl-btn accent" id="plHfExport">' + I.dl + '<span>تطبيق وتنزيل PDF</span></button></div>';
    h += '</div>';

    h += '<div class="pl-preview-box"><b>معاينة حية للرأس والتذييل</b><div class="pl-preview-canvas-wrap"><canvas id="plHfPreviewCv"></canvas></div></div>';
    h += '</div>';
    return h;
  }

  function paintHfPreview() {
    var cv = st.root && st.root.querySelector('#plHfPreviewCv');
    if (!cv || !st.activePdf) return;
    var pg = st.hfSkipFirst && st.activePdf.numPages > 1 ? 2 : 1;
    renderPdfPagePreviewCanvas(cv, pg, function (ctx, w, h, scale) {
      if (st.hfSkipFirst && pg === 1) return;
      var tot = st.activePdf.numPages;
      var mx = 28 * scale, topY = 20 * scale, botY = h - 20 * scale;
      ctx.font = '600 ' + (st.hfSize * scale) + 'px Alexandria, Tahoma, Arial, sans-serif';
      ctx.fillStyle = st.hfColor;
      ctx.textBaseline = 'middle';

      var slots = [
        [st.hfHRight, w - mx, topY, 'right'],
        [st.hfHCenter, w / 2, topY, 'center'],
        [st.hfHLeft, mx, topY, 'left'],
        [st.hfFRight, w - mx, botY, 'right'],
        [st.hfFCenter, w / 2, botY, 'center'],
        [st.hfFLeft, mx, botY, 'left']
      ];
      slots.forEach(function (s) {
        var txt = resolveHfTokens(s[0], pg, tot).trim();
        if (!txt) return;
        ctx.direction = S.hasArabic(txt) ? 'rtl' : 'ltr';
        ctx.textAlign = s[3];
        ctx.fillText(txt, s[1], s[2]);
      });

      if (st.hfLine) {
        ctx.strokeStyle = st.hfColor;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = Math.max(1, scale);
        if (st.hfHRight || st.hfHCenter || st.hfHLeft) {
          ctx.beginPath(); ctx.moveTo(mx, 34 * scale); ctx.lineTo(w - mx, 34 * scale); ctx.stroke();
        }
        if (st.hfFRight || st.hfFCenter || st.hfFLeft) {
          ctx.beginPath(); ctx.moveTo(mx, h - 34 * scale); ctx.lineTo(w - mx, h - 34 * scale); ctx.stroke();
        }
      }
    });
  }

  function bindHeaderFooterEvents() {
    if (!st.activePdf) return;
    paintHfPreview();
    var bind = function (id, fn) { var el = st.root.querySelector(id); if (el) el.oninput = el.onchange = function () { fn(el); paintHfPreview(); }; };
    bind('#plHfHR', function (el) { st.hfHRight = el.value; });
    bind('#plHfHC', function (el) { st.hfHCenter = el.value; });
    bind('#plHfHL', function (el) { st.hfHLeft = el.value; });
    bind('#plHfFR', function (el) { st.hfFRight = el.value; });
    bind('#plHfFC', function (el) { st.hfFCenter = el.value; });
    bind('#plHfFL', function (el) { st.hfFLeft = el.value; });
    bind('#plHfSize', function (el) { st.hfSize = Math.max(8, Math.min(24, Number(el.value) || 11)); });
    bind('#plHfColor', function (el) { st.hfColor = el.value; });
    bind('#plHfLine', function (el) { st.hfLine = el.checked; });
    bind('#plHfSkip1', function (el) { st.hfSkipFirst = el.checked; });

    st.root.querySelector('#plHfExport').onclick = async function () {
      var btn = this; btn.disabled = true;
      toast('جارٍ تطبيق الرأس والتذييل…', 2400);
      try {
        var PDFLib = await S.loadPdfLib();
        var doc = await PDFLib.PDFDocument.load(st.activePdf.bytes.slice(), { ignoreEncryption: true });
        var pages = doc.getPages();
        var total = pages.length;

        for (var i = 0; i < total; i++) {
          if (st.hfSkipFirst && i === 0) continue;
          var pg = pages[i];
          var box = pg.getCropBox() || pg.getMediaBox();
          var rot = ((pg.getRotation().angle || 0) % 360 + 360) % 360;
          var vw = (rot % 180 !== 0) ? box.height : box.width;
          var vh = (rot % 180 !== 0) ? box.width : box.height;

          var topCy = 20 / vh, botCy = 1 - 20 / vh;
          var slots = [
            { tpl: st.hfHRight, hAlign: 'right', cy: topCy },
            { tpl: st.hfHCenter, hAlign: 'center', cy: topCy },
            { tpl: st.hfHLeft, hAlign: 'left', cy: topCy },
            { tpl: st.hfFRight, hAlign: 'right', cy: botCy },
            { tpl: st.hfFCenter, hAlign: 'center', cy: botCy },
            { tpl: st.hfFLeft, hAlign: 'left', cy: botCy }
          ];

          for (var s = 0; s < slots.length; s++) {
            var sl = slots[s];
            var txt = resolveHfTokens(sl.tpl, i + 1, total).trim();
            if (!txt) continue;
            var png = S.renderTextToPng({ text: txt, fontSize: st.hfSize, bold: true, color: st.hfColor, scale: 3, paddingX: 5, paddingY: 3 });
            var emb = await doc.embedPng(png.bytes);
            var cx = sl.hAlign === 'left' ? ((28 + png.width / 2) / vw) : (sl.hAlign === 'right' ? (1 - (28 + png.width / 2) / vw) : 0.5);
            drawVisualCenteredImage(PDFLib, pg, emb, cx, sl.cy, png.width, png.height, 1, 0);
          }

          if (st.hfLine) {
            var rgb = S.hexToRgb01(st.hfColor);
            var lineCol = PDFLib.rgb(rgb.r, rgb.g, rgb.b);
            if (st.hfHRight || st.hfHCenter || st.hfHLeft) {
              var p1 = normCenterToPdf(28 / vw, 34 / vh, box, rot);
              var p2 = normCenterToPdf(1 - 28 / vw, 34 / vh, box, rot);
              pg.drawLine({ start: p1, end: p2, thickness: 0.7, color: lineCol, opacity: 0.35 });
            }
            if (st.hfFRight || st.hfFCenter || st.hfFLeft) {
              var b1 = normCenterToPdf(28 / vw, 1 - 34 / vh, box, rot);
              var b2 = normCenterToPdf(1 - 28 / vw, 1 - 34 / vh, box, rot);
              pg.drawLine({ start: b1, end: b2, thickness: 0.7, color: lineCol, opacity: 0.35 });
            }
          }
        }
        var out = await doc.save({ useObjectStreams: true });
        S.downloadBlob(new Blob([out], { type: 'application/pdf' }), S.sanitizeFilename(st.activePdf.name, '') + '-رأس-وتذييل.pdf');
        toast('تمت إضافة الرأس والتذييل وتنزيل الملف ✓');
      } catch (e) {
        toast('تعذّر تطبيق الترويسة: ' + (e && e.message ? e.message : ''), 3400);
      } finally { btn.disabled = false; }
    };
  }

  /* ---------- التهيئة العامة المرتبطة بـ tools.js ---------- */
  window.PDFLab = {
    init: function (rootEl) {
      st.root = rootEl;
      refreshOfflineState();
      render();
    },
    refresh: function () {
      if (!st.root) return;
      refreshOfflineState();
    }
  };
})();
