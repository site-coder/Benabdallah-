/* ==========================================================================
   cmap-ui.js — أداة «منشئ الخرائط المفاهيمية» (2/2): الواجهة ومساحة الرسم التفاعلية
   - العقد عناصر HTML (نص عربي حقيقي وقابل للتحرير مباشرة) فوق طبقة SVG للشبكة والروابط
   - تعمل بالفأرة واللمس (Pointer Events) بلا أي مكتبة ولا اتصال خارجي
   - المرحلة 2: الروابط والأسهم، التحديد المتعدد، التراجع/الإعادة، النسخ واللصق، التجميع، القفل، المحاذاة، الطبقات، البحث
   - المرحلة 3: القوالب والتنسيق البصري في cmap-ext.js (يتصل بهذا الملف عبر CM.ext وCM.styleNode فقط)
   - تُستدعى من tools.js عبر CM.ui.init(host) عند فتح الأداة لأول مرة
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM, U = CM.u, L = CM.LIMITS, esc = U.esc;
  var UI = CM.ui = {};

  function ic(p, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + p + '</svg>'; }
  var I = {
    back: ic('<path d="m9 18 6-6-6-6"/>'),
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    minus: ic('<path d="M5 12h14"/>'),
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    fit: ic('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
    grid: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>'),
    sliders: ic('<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>'),
    close: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    main: ic('<rect x="3" y="6" width="18" height="12" rx="5" fill="currentColor" fill-opacity=".35"/>'),
    sub: ic('<rect x="2" y="4" width="9" height="6" rx="2.5" fill="currentColor" fill-opacity=".35"/><rect x="13" y="14" width="9" height="6" rx="2.5"/><path d="M6.5 10v4.5a2 2 0 0 0 2 2H13"/>'),
    free: ic('<rect x="3" y="6" width="18" height="12" rx="5" stroke-dasharray="3 3"/>'),
    rect: ic('<rect x="3" y="6" width="18" height="12"/>'),
    round: ic('<rect x="3" y="6" width="18" height="12" rx="4"/>'),
    circle: ic('<circle cx="12" cy="12" r="8"/>'),
    oval: ic('<ellipse cx="12" cy="12" rx="10" ry="6.5"/>'),
    undo: ic('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
    redo: ic('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>'),
    paste: ic('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>'),
    dup: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><path d="M15.5 13.5v6"/><path d="M12.5 16.5h6"/>'),
    selall: ic('<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="m9 12 2 2 4-4"/>'),
    group: ic('<rect x="2.5" y="2.5" width="19" height="19" rx="2" stroke-dasharray="3 3"/><rect x="6" y="6" width="5" height="5" rx="1"/><rect x="13" y="13" width="5" height="5" rx="1"/>'),
    ungroup: ic('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M14 6h7"/><path d="M3 18h7"/>'),
    lock: ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
    front: ic('<path d="M5 3h14"/><path d="m18 13-6-6-6 6"/><path d="M12 7v14"/>'),
    back: ic('<path d="M19 21H5"/><path d="m6 11 6 6 6-6"/><path d="M12 17V3"/>'),
    up: ic('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
    down: ic('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
    pointer: ic('<path d="m4 4 7 17 2.5-7.5L21 11Z"/>'),
    marquee: ic('<path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/>'),
    line: ic('<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7 16.5 17 7.5"/>'),
    arrow: ic('<circle cx="5" cy="18" r="2.5"/><path d="M7 16.5 18 6"/><path d="M11 5.5h7.5V13"/>'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    help: ic('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
    flip: ic('<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>'),
    chevup: ic('<path d="m18 15-6-6-6 6"/>'),
    chevdown: ic('<path d="m6 9 6 6 6-6"/>'),
    left: ic('<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>'),
    hcenter: ic('<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>'),
    right: ic('<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>'),
    top: ic('<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>'),
    vcenter: ic('<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>'),
    bottom: ic('<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>'),
    disth: ic('<path d="M4 3v18"/><path d="M20 3v18"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>'),
    distv: ic('<path d="M3 4h18"/><path d="M3 20h18"/><rect x="7" y="9.5" width="10" height="5" rx="1"/>'),
    sstraight: ic('<path d="M4 18 20 6"/>'),
    scurve: ic('<path d="M4 18C10 18 14 6 20 6"/>'),
    selbow: ic('<path d="M4 18h8V6h8"/>')
  };

  /* أنماط التعامل: مؤشر (افتراضي) / تحديد متعدد / ربط بخط / ربط بسهم */
  var MODES = [
    { m: 'ptr', ic: 'pointer', t: 'مؤشر', title: 'مؤشر: اسحب العقد، واسحب الخلفية لتحريك مساحة العمل' },
    { m: 'sel', ic: 'marquee', t: 'تحديد', title: 'تحديد متعدد: اسحب على الخلفية لتحديد عدة عقد، وانقر عقدة لإضافتها أو إزالتها من التحديد' },
    { m: 'link', ic: 'line', t: 'رابط', title: 'ربط عقدتين بخط: اسحب من عقدة إلى أخرى (أو انقر الأولى ثم الثانية)' },
    { m: 'arrow', ic: 'arrow', t: 'سهم', title: 'ربط عقدتين بسهم: اسحب من العقدة الأولى إلى الثانية (أو انقر الأولى ثم الثانية)' }
  ];
  var TOOLS = [
    { k: 'main', t: 'رئيسية', title: 'إضافة عقدة رئيسية' },
    { k: 'sub', t: 'فرعية', title: 'إضافة عقدة فرعية للعقدة المحدّدة' },
    { k: 'free', t: 'مستقلة', title: 'إضافة عقدة مستقلة' },
    { sep: true },
    { k: 'rect', t: 'مستطيل', title: 'إضافة مستطيل' },
    { k: 'round', t: 'دائري الزوايا', title: 'إضافة مستطيل بزوايا دائرية' },
    { k: 'circle', t: 'دائرة', title: 'إضافة دائرة' },
    { k: 'oval', t: 'بيضاوي', title: 'إضافة شكل بيضاوي' }
  ];
  var ARROW_ORDER = ['none', 'end', 'start', 'both'];
  var HELP = [
    ['Ctrl + Z', 'تراجع'], ['Ctrl + Y  /  Ctrl + Shift + Z', 'إعادة'], ['Ctrl + C  /  X  /  V', 'نسخ / قص / لصق'], ['Ctrl + D', 'تكرار المحدّد'],
    ['Ctrl + A', 'تحديد الكل'], ['Delete', 'حذف المحدّد'], ['Ctrl + G  /  Ctrl + Shift + G', 'تجميع / فك التجميع'], ['Ctrl + Shift + L', 'قفل / إلغاء قفل'],
    ['Ctrl + ]  /  Ctrl + [', 'خطوة للأمام / للخلف'], ['Ctrl + Shift + ]  /  [', 'إلى الأمام / إلى الخلف'], ['الأسهم  (مع Shift)', 'تحريك المحدّد (بخطوة أكبر)'],
    ['Enter  /  F2', 'تعديل نص العنصر المحدّد'], ['Ctrl + F', 'بحث في الخريطة'], ['+  /  -  /  0', 'تكبير / تصغير / عرض الكل'], ['Shift + نقر', 'إضافة عنصر للتحديد'],
    ['Shift + سحب الخلفية', 'تحديد بمستطيل'], ['Escape', 'إلغاء الربط أو التحديد']
  ];

  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  UI.init = function (host) {
    if (host.__cm) return;
    host.__cm = true;
    var doc = UI.doc = new CM.Doc();
    var coarse = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) {}

    /* ---------------------------------------------------------------- الهيكل */
    function B(act, ik, text, title, cls, attrs) {
      return '<button type="button" class="cm-btn ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + ' title="' + esc(title || text) + '" aria-label="' + esc(title || text) + '">' + I[ik] + (text ? '<span>' + text + '</span>' : '') + '</button>';
    }
    function seg(items, attr, cls) {
      var h = '<div class="cm-seg ' + (cls || '') + '">';
      items.forEach(function (o) { h += '<button type="button" ' + attr + '="' + o.v + '" title="' + esc(o.title || o.t) + '" aria-label="' + esc(o.title || o.t) + '" aria-pressed="false">' + (o.ik ? I[o.ik] : '') + '<small>' + o.t + '</small></button>'; });
      return h + '</div>';
    }
    function swatches(attr, withAuto) {
      var h = '';
      CM.SWATCHES.forEach(function (c) { h += '<button type="button" class="cm-sw" ' + attr + '="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="' + c + '"></button>'; });
      if (withAuto) h += '<button type="button" class="cm-chip cm-auto" ' + attr + '="" title="لون المنصة التلقائي">تلقائي</button>';
      return h;
    }
    var t = '';
    t += '<div class="cm" dir="rtl">';
    t += '<header class="cm-top">';
    t += '<button type="button" class="cm-btn cm-backbtn tl-back" title="العودة للأدوات" aria-label="العودة للأدوات">' + I.back + '<span>الأدوات</span></button>';
    t += '<input type="text" class="cm-name" maxlength="80" value="' + esc(doc.name) + '" aria-label="اسم المشروع" placeholder="اسم المشروع" spellcheck="false">';
    t += '<div class="cm-topact">';
    t += B('search', 'search', 'بحث', 'بحث عن نص داخل الخريطة (Ctrl + F)');
    t += B('showprops', 'sliders', '', 'خصائص العنصر', 'cm-only-m', ' disabled');
    t += '</div></header>';

    /* شريط التحرير: تراجع/إعادة، نسخ/لصق، حذف، تحديد، تجميع، قفل، طبقات */
    t += '<div class="cm-acts" role="toolbar" aria-label="أدوات التحرير">';
    t += B('undo', 'undo', 'تراجع', 'تراجع عن آخر عملية (Ctrl + Z)') + B('redo', 'redo', 'إعادة', 'إعادة العملية (Ctrl + Y)');
    t += '<i class="cm-vs" role="separator"></i>';
    t += B('copy', 'copy', 'نسخ', 'نسخ المحدّد (Ctrl + C)') + B('paste', 'paste', 'لصق', 'لصق (Ctrl + V)') + B('dup', 'dup', 'تكرار', 'تكرار المحدّد مباشرة (Ctrl + D)') + B('del', 'trash', 'حذف', 'حذف المحدّد (Delete)', 'cm-danger');
    t += '<i class="cm-vs" role="separator"></i>';
    t += B('selall', 'selall', 'تحديد الكل', 'تحديد جميع العناصر (Ctrl + A)');
    t += '<i class="cm-vs" role="separator"></i>';
    t += B('group', 'group', 'تجميع', 'تجميع العقد المحدّدة (Ctrl + G)') + B('ungroup', 'ungroup', 'فك التجميع', 'فك تجميع المحدّد (Ctrl + Shift + G)') + B('lock', 'lock', 'قفل', 'قفل المحدّد ومنع تحريكه (Ctrl + Shift + L)', '', ' aria-pressed="false"');
    t += '<i class="cm-vs" role="separator"></i>';
    t += B('front', 'front', 'للأمام', 'إحضار المحدّد إلى أعلى كل العناصر') + B('up', 'up', 'خطوة للأمام', 'تقديم المحدّد خطوة (Ctrl + ])') + B('down', 'down', 'خطوة للخلف', 'تأخير المحدّد خطوة (Ctrl + [)') + B('back', 'back', 'للخلف', 'إرسال المحدّد خلف كل العناصر');
    t += '</div>';

    t += '<aside class="cm-tools" aria-label="شريط الأدوات">';
    MODES.forEach(function (o) {
      t += '<button type="button" class="cm-tool cm-mode" data-tool="' + o.m + '" aria-pressed="' + (o.m === 'ptr') + '" title="' + o.title + '" aria-label="' + o.title + '"><span class="cm-ti">' + I[o.ic] + '</span><span class="cm-tt">' + o.t + '</span></button>';
    });
    t += '<i class="cm-sep" role="separator"></i>';
    TOOLS.forEach(function (o) {
      if (o.sep) { t += '<i class="cm-sep" role="separator"></i>'; return; }
      t += '<button type="button" class="cm-tool" data-add="' + o.k + '" title="' + o.title + '" aria-label="' + o.title + '"><span class="cm-ti">' + I[o.k] + '</span><span class="cm-tt">' + o.t + '</span></button>';
    });
    t += '</aside>';

    t += '<main class="cm-canvas" tabindex="0" aria-label="مساحة الرسم" data-tool="ptr">';
    t += '<svg class="cm-bg" aria-hidden="true"><defs><pattern id="cmGridPat" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" class="cm-gl"/></pattern></defs><rect width="100%" height="100%" fill="url(#cmGridPat)"/></svg>';
    t += '<div class="cm-world"><div class="cm-gframes"></div><svg class="cm-links" aria-hidden="true"></svg><div class="cm-nodes"></div><div class="cm-labels"></div><div class="cm-selbox" hidden></div><svg class="cm-links cm-rb" aria-hidden="true"><path class="cm-rbp" d=""/></svg></div>';
    t += '<div class="cm-marq" hidden></div>';
    t += '<div class="cm-empty"><b>ابدأ خريطتك</b><span>أضف «عقدة رئيسية» من شريط الأدوات، ثم حدّدها وأضف لها عقداً فرعية. اربط أي عقدتين بأداة «رابط» أو «سهم».</span><small>اسحب الخلفية لتحريك مساحة العمل، و Ctrl + عجلة الفأرة أو القرص بإصبعين للتكبير.</small></div>';
    t += '<div class="cm-search" hidden role="search"><input type="search" class="cm-sin" placeholder="ابحث في نصوص الخريطة" aria-label="بحث في الخريطة" autocomplete="off" spellcheck="false"><span class="cm-scount" aria-live="polite"></span>' + B('sprev', 'chevup', '', 'النتيجة السابقة', 'cm-ib') + B('snext', 'chevdown', '', 'النتيجة التالية', 'cm-ib') + B('sclose', 'close', '', 'إغلاق البحث', 'cm-ib') + '</div>';
    t += '<div class="cm-help" hidden role="dialog" aria-label="اختصارات"><div class="cm-helpbox"><div class="cm-ph"><b>الاختصارات</b><button type="button" class="cm-x cm-xs" data-act="help" title="إغلاق" aria-label="إغلاق">' + I.close + '</button></div><dl>';
    HELP.forEach(function (h) { t += '<dt dir="ltr">' + esc(h[0]) + '</dt><dd>' + esc(h[1]) + '</dd>'; });
    t += '</dl></div></div>';
    t += '<div class="cm-toast" role="status" aria-live="polite"></div>';
    t += '</main>';

    t += '<aside class="cm-props" aria-label="خصائص العنصر">';
    t += '<div class="cm-ph"><b>الخصائص</b><button type="button" class="cm-x" data-act="closeprops" title="إخفاء" aria-label="إخفاء لوحة الخصائص">' + I.close + '</button></div>';
    t += '<div class="cm-pempty">حدّد عقدة أو رابطاً على مساحة الرسم لتعديل خصائصه.</div>';

    /* --- خصائص العقدة --- */
    t += '<div class="cm-pbody" hidden>';
    t += '<label class="cm-f"><span>النص</span><textarea data-f="text" rows="2" placeholder="نص العقدة"></textarea></label>';
    t += '<label class="cm-f"><span>الوصف (اختياري)</span><textarea data-f="desc" rows="3" placeholder="وصف يظهر داخل العقدة تحت العنوان"></textarea></label>';
    t += '<div class="cm-f"><span>الشكل</span><div class="cm-seg">';
    CM.SHAPES.forEach(function (sh) {
      var ik = sh.id === 'ellipse' ? 'oval' : sh.id;
      t += '<button type="button" data-shape="' + sh.id + '" title="' + sh.label + '" aria-label="' + sh.label + '">' + I[ik] + '<small>' + (sh.id === 'ellipse' ? 'بيضاوي' : (sh.id === 'round' ? 'دائري' : 'مستطيل')) + '</small></button>';
    });
    t += '</div></div>';
    ['bg', 'fg'].forEach(function (f) {
      t += '<div class="cm-f"><span>' + (f === 'bg' ? 'لون الخلفية' : 'لون النص') + '</span><div class="cm-colors"><input type="color" data-f="' + f + '" aria-label="' + (f === 'bg' ? 'لون الخلفية' : 'لون النص') + '">';
      CM.SWATCHES.forEach(function (c) { t += '<button type="button" class="cm-sw" data-c="' + f + '" data-v="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="' + c + '"></button>'; });
      t += '</div></div>';
    });
    t += '<div class="cm-f cm-two"><div><span>حجم الخط</span><div class="cm-step"><button type="button" data-fs="-1" aria-label="تصغير الخط">' + I.minus + '</button><input type="number" dir="ltr" data-f="fs" min="' + L.minFs + '" max="' + L.maxFs + '" inputmode="numeric" aria-label="حجم الخط"><button type="button" data-fs="1" aria-label="تكبير الخط">' + I.plus + '</button></div></div>';
    t += '<div><span>نوع الخط</span><select data-f="ff" aria-label="نوع الخط">';
    CM.FONTS.forEach(function (f) { t += '<option value="' + f.id + '">' + f.label + '</option>'; });
    t += '</select></div></div>';
    t += '<div class="cm-f cm-two"><label><span>العرض</span><input type="number" dir="ltr" data-f="w" min="' + L.minW + '" max="' + L.maxW + '" inputmode="numeric"></label><label><span>الارتفاع</span><input type="number" dir="ltr" data-f="h" min="' + L.minH + '" max="' + L.maxH + '" inputmode="numeric"></label></div>';
    t += '<p class="cm-note cm-lknote" hidden>العقدة مقفلة: لا يمكن تحريكها ولا تغيير حجمها.</p>';
    t += '<button type="button" class="cm-btn cm-wide" data-act="edit">' + I.edit + '<span>تعديل النص على الخريطة</span></button>';
    t += '<div class="cm-row2"><button type="button" class="cm-btn cm-wide" data-act="copy">' + I.copy + '<span>نسخ</span></button><button type="button" class="cm-btn cm-wide cm-danger" data-act="del">' + I.trash + '<span>حذف</span></button></div>';
    t += '</div>';

    /* --- خصائص الرابط --- */
    t += '<div class="cm-plink" hidden>';
    t += '<div class="cm-linfo"></div>';
    t += '<label class="cm-f"><span>النص التوضيحي على الرابط</span><input type="text" data-lf="label" maxlength="120" placeholder="مثال: يتكون من" autocomplete="off"></label>';
    t += '<div class="cm-f"><span>كلمات ربط جاهزة (انقر لاختيار)</span><div class="cm-chips">';
    CM.LINK_WORDS.forEach(function (w) { t += '<button type="button" class="cm-chip" data-word="' + esc(w) + '">' + esc(w) + '</button>'; });
    t += '</div></div>';
    t += '<div class="cm-row2"><button type="button" class="cm-btn cm-wide" data-act="ledit">' + I.edit + '<span>تعديل على الخريطة</span></button><button type="button" class="cm-btn cm-wide" data-act="lclear"><span>حذف النص</span></button></div>';
    t += '<div class="cm-f"><span>اتجاه السهم</span><div class="cm-seg cm-seg2 cm-arrows">';
    ARROW_ORDER.forEach(function (a) { t += '<button type="button" data-larrow="' + a + '" aria-pressed="false"></button>'; });
    t += '</div></div>';
    t += '<div class="cm-f"><span>شكل الخط</span>' + seg([{ v: 'straight', t: 'مستقيم', ik: 'sstraight' }, { v: 'curve', t: 'منحني', ik: 'scurve' }, { v: 'elbow', t: 'متعامد', ik: 'selbow' }], 'data-lstyle') + '</div>';
    t += '<div class="cm-f"><span>لون الخط</span><div class="cm-colors"><input type="color" data-lf="color" aria-label="لون الخط">' + swatches('data-lc', true) + '</div></div>';
    t += '<div class="cm-f"><span>سماكة الخط: <b class="cm-lwv" dir="ltr"></b></span><input type="range" class="cm-range" data-lf="width" min="' + L.minLw + '" max="' + L.maxLw + '" step="0.5" aria-label="سماكة الخط"></div>';
    t += '<button type="button" class="cm-btn cm-wide" data-act="lrev">' + I.flip + '<span>عكس اتجاه السهم</span></button>';
    t += '<button type="button" class="cm-btn cm-wide cm-danger" data-act="ldel">' + I.trash + '<span>حذف الرابط (تبقى العقدتان)</span></button>';
    t += '</div>';

    /* --- تحديد متعدد --- */
    t += '<div class="cm-pmulti" hidden>';
    t += '<div class="cm-minfo"></div>';
    t += '<div class="cm-f"><span>محاذاة أفقية</span>' + seg([{ v: 'right', t: 'يمين', ik: 'right' }, { v: 'hcenter', t: 'وسط', ik: 'hcenter' }, { v: 'left', t: 'يسار', ik: 'left' }], 'data-align') + '</div>';
    t += '<div class="cm-f"><span>محاذاة عمودية</span>' + seg([{ v: 'top', t: 'أعلى', ik: 'top' }, { v: 'vcenter', t: 'منتصف', ik: 'vcenter' }, { v: 'bottom', t: 'أسفل', ik: 'bottom' }], 'data-align') + '</div>';
    t += '<div class="cm-f"><span>توزيع بمسافات متساوية (3 عقد فأكثر)</span>' + seg([{ v: 'h', t: 'أفقياً', ik: 'disth', title: 'توزيع أفقي بمسافات متساوية' }, { v: 'v', t: 'عمودياً', ik: 'distv', title: 'توزيع عمودي بمسافات متساوية' }], 'data-dist', 'cm-seg2') + '</div>';
    t += '<div class="cm-f cm-mlink"><span>ربط العقدتين المحدّدتين (من الأولى إلى الثانية)</span><div class="cm-row2"><button type="button" class="cm-btn cm-wide" data-act="mkline">' + I.line + '<span>بخط</span></button><button type="button" class="cm-btn cm-wide" data-act="mkarrow">' + I.arrow + '<span>بسهم</span></button></div></div>';
    t += '<button type="button" class="cm-btn cm-wide cm-danger" data-act="del">' + I.trash + '<span>حذف المحدّد</span></button>';
    t += '</div>';
    t += '</aside>';

    t += '<footer class="cm-bottom">';
    t += '<div class="cm-zoom"><button type="button" class="cm-btn cm-ib" data-act="zout" title="تصغير" aria-label="تصغير">' + I.minus + '</button><button type="button" class="cm-btn cm-zval" data-act="z100" title="إعادة التكبير إلى 100%" aria-label="مستوى التكبير">100%</button><button type="button" class="cm-btn cm-ib" data-act="zin" title="تكبير" aria-label="تكبير">' + I.plus + '</button></div>';
    t += '<button type="button" class="cm-btn" data-act="fit" title="ملاءمة الخريطة كاملة داخل الشاشة" aria-label="ملاءمة الخريطة كاملة داخل الشاشة">' + I.fit + '<span>ملاءمة</span></button>';
    t += '<button type="button" class="cm-btn" data-act="grid" aria-pressed="true" title="إظهار / إخفاء الشبكة" aria-label="الشبكة">' + I.grid + '<span>الشبكة</span></button>';
    t += '<button type="button" class="cm-btn" data-act="help" title="اختصارات لوحة المفاتيح" aria-label="اختصارات لوحة المفاتيح">' + I.help + '<span>اختصارات</span></button>';
    t += '</footer>';
    t += '</div>';
    host.classList.add('cm-host');
    host.innerHTML = t;


    /* ---------------------------------------------------------------- مراجع */
    function $(s, r) { return (r || host).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || host).querySelectorAll(s)); }
    var rootEl = $('.cm'), canvas = $('.cm-canvas'), world = $('.cm-world'), nodesEl = $('.cm-nodes'), linksEl = $('.cm-links');
    var pattern = $('#cmGridPat'), gridLine = $('.cm-gl'), props = $('.cm-props'), toastEl = $('.cm-toast');
    var nameIn = $('.cm-name'), zval = $('.cm-zval');
    var labelsEl = $('.cm-labels'), gframesEl = $('.cm-gframes'), selbox = $('.cm-selbox'), marqEl = $('.cm-marq'), rbEl = $('.cm-rb'), rbPath = $('.cm-rbp');
    var searchEl = $('.cm-search'), sIn = $('.cm-sin'), sCount = $('.cm-scount'), helpEl = $('.cm-help');
    var els = {};            /* id -> عنصر العقدة */
    var lels = {};           /* id -> عناصر الرابط { g, halo, path, head, hit, label } */
    var editingId = null, editOrig = '';          /* تحرير نص عقدة */
    var editingLink = null, editLOrig = '';       /* تحرير نص رابط */
    var propsClosed = false;
    var tool = 'ptr', pending = null;             /* نمط التعامل، وعقدة مصدر مختارة بالنقر لإكمال الربط بنقرة ثانية */
    var NS = 'http://www.w3.org/2000/svg';

    function say(m) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(function () { toastEl.classList.remove('show'); }, 2300); }
    function cur() { return doc.sel ? doc.get(doc.sel) : null; }
    function canvasRect() { return canvas.getBoundingClientRect(); }
    function toWorld(cx, cy) { var r = canvasRect(), v = doc.view; return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k }; }
    function centerWorld() { var r = canvasRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }

    /* ---------------------------------------------------------------- العرض (تحريك/تكبير) */
    function applyView() {
      var v = doc.view;
      world.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.k + ')';
      canvas.style.setProperty('--inv', String(1 / v.k));
      pattern.setAttribute('patternTransform', 'translate(' + v.x + ' ' + v.y + ') scale(' + v.k + ')');
      gridLine.setAttribute('stroke-width', String(1 / v.k));
      canvas.classList.toggle('cm-gridfade', 24 * v.k < 9);
      zval.textContent = Math.round(v.k * 100) + '%';
    }
    function zoomAt(f, cx, cy) {
      var v = doc.view, nk = U.clamp(v.k * f, L.minK, L.maxK); f = nk / v.k;
      doc.setView({ k: nk, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f });
    }
    function zoomCenter(f) { var r = canvasRect(); zoomAt(f, r.width / 2, r.height / 2); }
    function fit() {
      var r = canvasRect(), b = doc.bounds();
      if (!b) { doc.setView({ k: 1, x: r.width / 2, y: r.height / 2 }); return; }
      var pad = Math.max(24, Math.min(64, r.width * 0.08));
      var k = U.clamp(Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h), L.minK, 1.5);
      doc.setView({ k: k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 - b.y * k });
    }

    /* ---------------------------------------------------------------- رسم العقد والروابط */
    function sv(name, cls) { var e = document.createElementNS(NS, name); if (cls) e.setAttribute('class', cls); return e; }
    function createNode(n) {
      var el = document.createElement('div');
      el.className = 'cm-node'; el.dataset.id = n.id;
      var h = '<div class="cm-body"><div class="cm-title" data-ph="اكتب هنا" spellcheck="false"></div><div class="cm-desc" hidden></div></div><i class="cm-lockic" aria-hidden="true">' + I.lock + '</i>';
      HANDLES.forEach(function (d) { h += '<i class="cm-h cm-h-' + d + '" data-d="' + d + '"></i>'; });
      el.innerHTML = h;
      els[n.id] = el; nodesEl.appendChild(el);
      if (doc.isSel(n.id)) el.classList.add('sel');
      paint(n);
    }
    function paint(n) {
      var el = els[n.id]; if (!el) return;
      var s = el.style, f = CM.FONTS.filter(function (x) { return x.id === n.ff; })[0] || CM.FONTS[0];
      s.left = n.x + 'px'; s.top = n.y + 'px'; s.width = n.w + 'px'; s.height = n.h + 'px';
      s.background = n.bg; s.color = n.fg; s.fontSize = n.fs + 'px'; s.fontFamily = f.css; s.zIndex = n.z;
      el.dataset.shape = n.shape; el.dataset.role = n.role;
      el.classList.toggle('locked', !!n.locked); el.classList.toggle('grouped', !!n.group);
      var ti = el.firstChild.firstChild, de = ti.nextSibling;
      if (editingId !== n.id && ti.textContent !== n.text) ti.textContent = n.text;
      if (de.textContent !== n.desc) de.textContent = n.desc;
      de.hidden = !n.desc;
      if (CM.styleNode) CM.styleNode(n, el); /* المرحلة 3: حدود/استدارة/شفافية/محاذاة/مسافات */
    }

    /* ---- الروابط: كل رابط عنصر SVG (خط + رأس سهم + منطقة نقر عريضة) وملصق نصي HTML ---- */
    function createLink(l) {
      var g = sv('g', 'cm-link'); g.setAttribute('data-lid', l.id);
      var halo = sv('path', 'cm-lhalo'), path = sv('path', 'cm-lpath'), head = sv('path', 'cm-lhead'), hit = sv('path', 'cm-lhit');
      hit.setAttribute('data-lid', l.id);
      g.appendChild(halo); g.appendChild(path); g.appendChild(head); g.appendChild(hit);
      linksEl.appendChild(g);
      var lb = document.createElement('div'); lb.className = 'cm-label'; lb.dataset.lid = l.id; lb.spellcheck = false;
      labelsEl.appendChild(lb);
      lels[l.id] = { g: g, halo: halo, path: path, head: head, hit: hit, label: lb };
      if (doc.selL.indexOf(l.id) >= 0) { g.classList.add('sel'); lb.classList.add('sel'); }
      paintLink(l);
    }
    function paintLink(l) {
      var e = lels[l.id], a = doc.get(l.from), b = doc.get(l.to); if (!e || !a || !b) return;
      var r = CM.geo.route(a, b, l.style, l.arrow, l.width), col = l.color || 'var(--cm-link)', hd = '';
      e.halo.setAttribute('d', r.d); e.path.setAttribute('d', r.d); e.hit.setAttribute('d', r.d);
      e.halo.style.strokeWidth = (l.width + 9) + 'px';
      e.path.style.strokeWidth = l.width + 'px'; e.path.style.stroke = col;
      e.hit.style.strokeWidth = Math.max(18, l.width + 12) + 'px';
      r.heads.forEach(function (h) { hd += 'M' + h.split(' ').join('L') + 'Z'; });
      e.head.setAttribute('d', hd); e.head.style.fill = col;
      var lb = e.label;
      if (editingLink !== l.id && lb.textContent !== l.label) lb.textContent = l.label;
      lb.hidden = !l.label && editingLink !== l.id;
      lb.style.left = Math.round(r.mid.x * 10) / 10 + 'px'; lb.style.top = Math.round(r.mid.y * 10) / 10 + 'px';
      lb.style.borderColor = col;
    }
    function removeLinkEl(l) {
      var e = lels[l.id]; if (!e) return;
      e.g.remove(); e.label.remove(); delete lels[l.id];
      if (editingLink === l.id) editingLink = null;
    }
    function repaintLinksOf(id) { doc.links.forEach(function (l) { if (l.from === id || l.to === id) paintLink(l); }); }
    function drawLinks() { doc.links.forEach(paintLink); }
    function refreshEmpty() { canvas.classList.toggle('cm-isempty', !doc.nodes.length); }

    /* إطارات المجموعات ومربع التحديد المتعدد */
    function drawGroups() {
      var gs = {}, h = '', g;
      doc.nodes.forEach(function (n) { if (n.group) (gs[n.group] = gs[n.group] || []).push(n); });
      for (g in gs) {
        var ns = gs[g], x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, all = true;
        ns.forEach(function (n) { x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h); if (!doc.isSel(n.id)) all = false; });
        h += '<div class="cm-gframe' + (all ? ' on' : '') + '" style="left:' + (x1 - 12) + 'px;top:' + (y1 - 12) + 'px;width:' + (x2 - x1 + 24) + 'px;height:' + (y2 - y1 + 24) + 'px"></div>';
      }
      gframesEl.innerHTML = h;
    }
    function updateSelBox() {
      var b = doc.selN.length > 1 ? doc.boundsOf(doc.selN) : null;
      selbox.hidden = !b;
      if (b) { selbox.style.left = (b.x - 7) + 'px'; selbox.style.top = (b.y - 7) + 'px'; selbox.style.width = (b.w + 14) + 'px'; selbox.style.height = (b.h + 14) + 'px'; }
    }
    function overlays() { drawGroups(); updateSelBox(); }
    function syncSel() {
      var i, id;
      for (id in els) { els[id].classList.toggle('sel', doc.isSel(id)); els[id].classList.toggle('solo', doc.sel === id); }
      for (id in lels) { var on = doc.selL.indexOf(id) >= 0; lels[id].g.classList.toggle('sel', on); lels[id].label.classList.toggle('sel', on); }
      overlays();
    }
    function rebuild() {
      editingId = null; editingLink = null;
      nodesEl.innerHTML = ''; labelsEl.innerHTML = ''; linksEl.innerHTML = '';
      els = {}; lels = {};
      doc.nodes.forEach(createNode); doc.links.forEach(createLink);
      refreshEmpty(); syncSel();
    }

    doc.on('node:add', function (n) { createNode(n); refreshEmpty(); overlays(); });
    doc.on('node:update', function (n, p) {
      paint(n); repaintLinksOf(n.id);
      if (n.id === doc.sel) fillProps();
      if (p && ('locked' in p || 'group' in p)) syncChrome();
      overlays();
    });
    doc.on('node:remove', function (n) { var el = els[n.id]; if (el) el.remove(); delete els[n.id]; if (editingId === n.id) editingId = null; if (pending === n.id) pending = null; refreshEmpty(); overlays(); });
    doc.on('link:add', function (l) { createLink(l); });
    doc.on('link:update', function (l) { paintLink(l); if (curLink() && curLink().id === l.id) fillLinkProps(); });
    doc.on('link:remove', function (l) { removeLinkEl(l); });
    doc.on('reset', function () { pending = null; hideRb(); rebuild(); });
    doc.on('history', function () { syncChrome(); if (!searchEl.hidden) runSearch(false); });
    doc.on('view', applyView);
    doc.on('meta', function () { host.querySelector('[data-act="grid"]').setAttribute('aria-pressed', doc.grid ? 'true' : 'false'); canvas.classList.toggle('cm-nogrid', !doc.grid); });
    doc.on('select', function () {
      propsClosed = false; syncSel(); syncChrome(); fillProps(); fillLinkProps(); fillMulti();
    });

    /* ---------------------------------------------------------------- لوحة الخصائص */
    function curLink() { return (doc.selL.length === 1 && !doc.selN.length) ? doc.getLink(doc.selL[0]) : null; }
    function kindOf() { var n = doc.selN.length, l = doc.selL.length; if (n === 1 && !l) return 'node'; if (!n && l === 1) return 'link'; return (n || l) ? 'multi' : 'none'; }
    function nm(id) { var n = doc.get(id), t = n ? String(n.text || '').replace(/\s+/g, ' ').trim() : ''; return t ? (t.length > 16 ? t.slice(0, 16) + '…' : t) : '(بلا نص)'; }
    function syncChrome() {
      var kind = kindOf(), nN = doc.selN.length, nL = doc.selL.length, has = kind !== 'none';
      rootEl.classList.toggle('cm-has-sel', has);
      rootEl.classList.toggle('cm-props-closed', propsClosed);
      $('.cm-pempty').hidden = has; $('.cm-pbody').hidden = kind !== 'node'; $('.cm-plink').hidden = kind !== 'link'; $('.cm-pmulti').hidden = kind !== 'multi';
      var sn = doc.selectedNodes(), anyGroup = sn.some(function (n) { return n.group; }), allLocked = sn.length > 0 && sn.every(function (n) { return n.locked; });
      function dis(acts, off) { acts.split(' ').forEach(function (a) { $$('[data-act="' + a + '"]').forEach(function (b) { b.disabled = off; }); }); }
      dis('showprops', !has); dis('undo', !doc.canUndo()); dis('redo', !doc.canRedo());
      dis('copy dup lock front up down back', !nN); dis('paste', !doc.hasClip()); dis('del', !(nN || nL));
      dis('group', nN < 2); dis('ungroup', !anyGroup);
      var lk = $('.cm-acts [data-act="lock"]');
      lk.setAttribute('aria-pressed', allLocked ? 'true' : 'false');
      lk.innerHTML = I[allLocked ? 'unlock' : 'lock'] + '<span>' + (allLocked ? 'إلغاء القفل' : 'قفل') + '</span>';
      $$('.cm-mode').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tool === tool ? 'true' : 'false'); });
    }
    function setField(el, v) { if (el && document.activeElement !== el) el.value = v; }
    function fillProps() {
      var n = cur(); if (!n) return;
      $$('[data-f]', props).forEach(function (el) { var f = el.dataset.f; setField(el, n[f]); });
      $$('[data-shape]', props).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.shape === n.shape ? 'true' : 'false'); });
      $$('.cm-sw[data-c]', props).forEach(function (b) { b.classList.toggle('on', b.dataset.v.toLowerCase() === String(n[b.dataset.c]).toLowerCase()); });
      $('.cm-lknote').hidden = !n.locked;
      ['w', 'h'].forEach(function (f) { $('[data-f="' + f + '"]', props).disabled = !!n.locked; });
    }
    function fillLinkProps() {
      var l = curLink(); if (!l) return;
      $('.cm-linfo').innerHTML = '<b>من</b> «' + esc(nm(l.from)) + '» <b>إلى</b> «' + esc(nm(l.to)) + '»';
      setField($('[data-lf="label"]', props), l.label);
      setField($('[data-lf="color"]', props), l.color || '#C084FC');
      setField($('[data-lf="width"]', props), l.width);
      $('.cm-lwv', props).textContent = l.width;
      var names = { none: 'بدون سهم (خط)', end: 'سهم نحو «' + nm(l.to) + '»', start: 'سهم نحو «' + nm(l.from) + '»', both: 'سهم في الاتجاهين' };
      $$('[data-larrow]', props).forEach(function (b) { b.innerHTML = '<small>' + esc(names[b.dataset.larrow]) + '</small>'; b.setAttribute('aria-pressed', b.dataset.larrow === l.arrow ? 'true' : 'false'); });
      $$('[data-lstyle]', props).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lstyle === l.style ? 'true' : 'false'); });
      $$('[data-lc]', props).forEach(function (b) { b.classList.toggle('on', String(b.dataset.lc).toLowerCase() === String(l.color || '').toLowerCase()); });
      $$('[data-word]', props).forEach(function (b) { b.classList.toggle('on', b.dataset.word === l.label); });
      $('[data-act="lrev"]', props).disabled = l.arrow === 'none' || l.arrow === 'both';
    }
    function fillMulti() {
      if (kindOf() !== 'multi') return;
      var nN = doc.selN.length, nL = doc.selL.length;
      $('.cm-minfo').textContent = 'تم تحديد ' + nN + ' عقدة' + (nL ? ' و ' + nL + ' رابط' : '');
      $$('[data-align]', props).forEach(function (b) { b.disabled = nN < 2; });
      $$('[data-dist]', props).forEach(function (b) { b.disabled = nN < 3; });
      $('.cm-mlink').hidden = !(nN === 2 && !nL);
    }
    function patch(k, v) { var n = cur(); if (!n) return; var o = {}; o[k] = v; doc.update(n.id, o); doc.commit('تعديل الخصائص', 'p:' + k + ':' + n.id); }
    function patchLink(o, key) { var l = curLink(); if (!l) return; doc.updateLink(l.id, o); doc.commit('تعديل الرابط', key ? 'lp:' + key + ':' + l.id : ''); }

    props.addEventListener('input', function (e) {
      var el = e.target, f = el.dataset.f, lf = el.dataset.lf;
      if (lf) {
        if (lf === 'label') patchLink({ label: el.value }, 'label');
        else if (lf === 'color') patchLink({ color: el.value }, 'color');
        else if (lf === 'width') patchLink({ width: parseFloat(el.value) }, 'width');
        return;
      }
      if (!f) return;
      if (f === 'text' || f === 'desc') patch(f, el.value);
      else if (f === 'bg' || f === 'fg') patch(f, el.value);
      else if (f === 'fs') { var v = parseInt(el.value, 10); if (!isNaN(v) && v >= L.minFs) patch('fs', v); }
    });
    props.addEventListener('change', function (e) {
      var el = e.target, f = el.dataset.f; if (!f) return;
      if (f === 'ff') patch('ff', el.value);
      else if (f === 'fs' || f === 'w' || f === 'h') { var v = parseInt(el.value, 10); if (!isNaN(v)) patch(f, v); el.value = cur() ? cur()[f] : ''; }
    });
    props.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var d = b.dataset;
      if (d.shape) { patch('shape', d.shape); return; }
      if (d.c) { patch(d.c, d.v); return; }
      if (d.fs) { var n = cur(); if (n) patch('fs', n.fs + parseInt(d.fs, 10)); return; }
      if (d.larrow) { patchLink({ arrow: d.larrow }); return; }
      if (d.lstyle) { patchLink({ style: d.lstyle }); return; }
      if ('lc' in d) { patchLink({ color: d.lc }); return; }
      if ('word' in d) { patchLink({ label: d.word }); return; }
      if (d.align) { stopEdits(true); if (!doc.align(doc.selN, d.align)) say('حدّد عقدتين على الأقل للمحاذاة'); return; }
      if (d.dist) { stopEdits(true); if (!doc.distribute(doc.selN, d.dist)) say('التوزيع بمسافات متساوية يلزمه 3 عقد على الأقل'); return; }
    });

    /* ---------------------------------------------------------------- إضافة / نسخ / لصق / حذف */
    function addNode(key, at) {
      var parentId = null;
      if (key === 'sub') {
        if (!cur()) { say('حدّد عقدة واحدة أولاً لإضافة عقدة فرعية لها'); return; }
        parentId = doc.sel;
      }
      var pos = at;
      if (!pos && !(key === 'sub')) {
        pos = centerWorld();
        var bump = true, guard = 0;
        while (bump && guard++ < 30) {
          bump = doc.nodes.some(function (n) { return Math.abs(n.x + n.w / 2 - pos.x) < 14 && Math.abs(n.y + n.h / 2 - pos.y) < 14; });
          if (bump) { pos.x += 30; pos.y += 30; }
        }
      }
      stopEdits(true);
      if (tool !== 'ptr') setTool('ptr');
      var n = doc.add(key, pos, parentId);
      if (!n) return;
      doc.select(n.id);
      if (!coarse) startEdit(n.id, true);
    }
    function copySel() { stopEdits(true); if (!doc.selN.length) return; if (doc.copyItems(doc.selN)) { say('تم نسخ ' + doc.selN.length + ' عنصر (استخدم «لصق»)'); syncChrome(); } }
    function cutSel() { stopEdits(true); if (!doc.selN.length) return; copySel(); delSel(); }
    function pasteSel() {
      stopEdits(true);
      if (!doc.hasClip()) { say('لا يوجد شيء منسوخ للصقه'); return; }
      var ids = doc.paste(); if (ids.length) { doc.setSel(ids, []); say('تم اللصق'); }
    }
    function dupSel() { stopEdits(true); if (!doc.selN.length) return; var ids = doc.duplicateMany(doc.selN); if (ids.length) doc.setSel(ids, []); }
    function delSel() { if (!doc.selN.length && !doc.selL.length) return; stopEdits(false); doc.removeItems(doc.selN.slice(), doc.selL.slice()); }
    function groupSel() { stopEdits(true); if (doc.group(doc.selN)) say('تم تجميع العناصر: تتحرك معاً'); else say('حدّد عقدتين على الأقل لتجميعهما'); }
    function ungroupSel() { stopEdits(true); if (doc.ungroup(doc.selN)) say('تم فك التجميع'); }
    function lockSel() {
      stopEdits(true);
      var ns = doc.selectedNodes(); if (!ns.length) return;
      var all = ns.every(function (n) { return n.locked; });
      doc.setLocked(doc.selN.slice(), !all); say(all ? 'تم إلغاء القفل' : 'تم قفل العناصر: لا يمكن تحريكها');
    }
    function undoAct() { stopEdits(true); clearPending(); if (!doc.undo()) say('لا توجد عملية للتراجع عنها'); }
    function redoAct() { stopEdits(true); clearPending(); if (!doc.redo()) say('لا توجد عملية لإعادتها'); }
    function makeLink(a, b, kind) {
      if (!a || !b || a === b) return null;
      var ex = doc.linkBetween(a, b);
      if (ex) { doc.selectLink(ex.id); say('يوجد رابط بين العقدتين مسبقاً — عدّله من لوحة الخصائص'); return ex; }
      var l = doc.addLink(a, b, { arrow: kind });
      if (l) { doc.selectLink(l.id); say(kind === 'end' ? 'تم ربط العقدتين بسهم' : 'تم ربط العقدتين بخط'); }
      return l;
    }

    /* ---------------------------------------------------------------- تحرير النص مباشرة (العقد + نصوص الروابط) */
    function readTitle(el) { return el.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, ''); }
    function selectContents(el, selectAll) {
      try {
        var r = document.createRange(); r.selectNodeContents(el);
        if (!selectAll) r.collapse(false);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      } catch (e) {}
    }
    function startEdit(id, selectAll) {
      var n = doc.get(id), el = els[id]; if (!n || !el) return;
      if (editingLink) stopEditLink(true);
      if (editingId && editingId !== id) stopEdit(true);
      var ti = el.firstChild.firstChild;
      editingId = id; editOrig = n.text;
      el.classList.add('editing'); ti.contentEditable = 'true';
      ti.focus();
      selectContents(ti, selectAll);
    }
    function stopEdit(commit) {
      if (!editingId) return;
      var id = editingId, el = els[id], n = doc.get(id);
      editingId = null;
      if (!el) return;
      var ti = el.firstChild.firstChild;
      var val = commit ? readTitle(ti) : editOrig;
      ti.contentEditable = 'false'; el.classList.remove('editing');
      ti.blur();
      if (n) { n.text = val; doc.update(id, { text: val }); if (commit) doc.commit('تعديل النص'); }
      ti.textContent = val;
    }
    function startEditLink(id) {
      var l = doc.getLink(id), e = lels[id]; if (!l || !e) return;
      if (editingId) stopEdit(true);
      if (editingLink && editingLink !== id) stopEditLink(true);
      editingLink = id; editLOrig = l.label;
      e.label.hidden = false; e.label.classList.add('editing'); e.label.contentEditable = 'true';
      e.label.focus(); selectContents(e.label, true);
    }
    function stopEditLink(commit) {
      if (!editingLink) return;
      var id = editingLink, e = lels[id], l = doc.getLink(id);
      editingLink = null;
      if (!e) return;
      var val = commit ? readTitle(e.label) : editLOrig;
      e.label.contentEditable = 'false'; e.label.classList.remove('editing'); e.label.blur();
      if (l) { doc.updateLink(id, { label: val }); e.label.textContent = l.label; paintLink(l); if (commit) doc.commit('تعديل نص الرابط'); }
    }
    function stopEdits(commit) { stopEdit(commit); stopEditLink(commit); }

    nodesEl.addEventListener('input', function (e) {
      var ti = e.target.closest('.cm-title'); if (!ti || !editingId) return;
      var n = doc.get(editingId); if (n) { n.text = readTitle(ti); doc.emit('node:update', n, { text: n.text }); }
    });
    labelsEl.addEventListener('input', function (e) {
      if (!editingLink || !e.target.closest('.cm-label')) return;
      doc.updateLink(editingLink, { label: readTitle(e.target.closest('.cm-label')) });
    });
    function editKeys(e, isLink) {
      if (isLink ? !editingLink : !editingId) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); stopEdits(true); canvas.focus({ preventScroll: true }); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopEdits(false); canvas.focus({ preventScroll: true }); }
    }
    nodesEl.addEventListener('keydown', function (e) { editKeys(e, false); });
    labelsEl.addEventListener('keydown', function (e) { editKeys(e, true); });
    function plainPaste(e, on) {
      if (!on) return;
      e.preventDefault();
      var tx = (e.clipboardData || window.clipboardData).getData('text') || '';
      document.execCommand('insertText', false, tx.replace(/\r/g, ''));
    }
    nodesEl.addEventListener('paste', function (e) { plainPaste(e, !!editingId); });
    labelsEl.addEventListener('paste', function (e) { plainPaste(e, !!editingLink); });
    nodesEl.addEventListener('focusout', function (e) {
      if (editingId && e.target.classList && e.target.classList.contains('cm-title')) setTimeout(function () { if (editingId && document.activeElement !== (els[editingId] && els[editingId].firstChild.firstChild)) stopEdit(true); }, 0);
    });
    labelsEl.addEventListener('focusout', function (e) {
      if (editingLink && e.target.classList && e.target.classList.contains('cm-label')) setTimeout(function () { if (editingLink && document.activeElement !== (lels[editingLink] && lels[editingLink].label)) stopEditLink(true); }, 0);
    });

    /* ---------------------------------------------------------------- التفاعل: سحب/تغيير حجم/تحريك/قرص/تحديد/ربط
       قاعدة منع التعارض: الضغط على عقدة = سحب العقدة (أو المحدّد كله)، الضغط على الخلفية = تحريك مساحة العمل،
       وتحديد مستطيل بـ Shift + سحب الخلفية أو بنمط «تحديد». كل ذلك يتقرر عند الضغط حسب العنصر المضغوط فقط. */
    var ptrs = {}, mode = null, lastTap = { id: null, t: 0, x: 0, y: 0 }, hoverTgt = null;
    function count() { return Object.keys(ptrs).length; }
    function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
    function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); }
    function union(a, b) { var o = a.slice(); b.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }

    function pinchStart() {
      var ids = Object.keys(ptrs), a = ptrs[ids[0]], b = ptrs[ids[1]];
      mode = { t: 'pinch', d0: Math.max(1, dist(a, b)), cx0: (a.x + b.x) / 2, cy0: (a.y + b.y) / 2, v0: { x: doc.view.x, y: doc.view.y, k: doc.view.k } };
      hideRb(); clearHover(); marqEl.hidden = true;
    }

    /* ---- نمط التعامل وأدوات الربط ---- */
    function setTool(t) {
      if (tool === t) return;
      clearPending(); tool = t; canvas.dataset.tool = t; syncChrome();
      if (t === 'link' || t === 'arrow') say('اسحب من عقدة إلى عقدة أخرى (أو انقر الأولى ثم الثانية) لربطهما');
      else if (t === 'sel') say('انقر العقد لتحديدها معاً، أو اسحب على الخلفية لتحديد مستطيل');
    }
    function clearPending() { if (pending && els[pending]) els[pending].classList.remove('cm-src'); pending = null; hideRb(); clearHover(); }
    function setPending(id) { clearPending(); pending = id; if (els[id]) els[id].classList.add('cm-src'); }
    function nodeAt(x, y) { var el = document.elementFromPoint(x, y), ne = el && el.closest && el.closest('.cm-node'); return ne && canvas.contains(ne) ? ne.dataset.id : null; }
    function showRb(srcId, cx, cy) {
      var sn = doc.get(srcId); if (!sn) return;
      var pt = toWorld(cx, cy), b = CM.geo.border(sn, pt.x, pt.y);
      rbPath.setAttribute('d', 'M' + b.x + ' ' + b.y + 'L' + pt.x + ' ' + pt.y); rbEl.style.display = 'block';
    }
    function hideRb() { if (rbEl) rbEl.style.display = 'none'; }
    function setHover(id) {
      if (hoverTgt === id) return;
      if (hoverTgt && els[hoverTgt]) els[hoverTgt].classList.remove('cm-tgt');
      hoverTgt = id; if (id && els[id]) els[id].classList.add('cm-tgt');
    }
    function clearHover() { setHover(null); }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
      var tg = e.target, nodeEl = tg.closest && tg.closest('.cm-node'), hEl = tg.closest && tg.closest('.cm-h');
      var lnEl = tg.closest && tg.closest('.cm-lhit,.cm-label'), lnId = lnEl ? lnEl.getAttribute('data-lid') : null;
      /* نقر داخل نص قيد التحرير (عقدة أو رابط): دع المتصفح يضع المؤشر */
      if (editingId && nodeEl && nodeEl.dataset.id === editingId && tg.closest('.cm-title') && e.button === 0) return;
      if (editingLink && lnEl && lnId === editingLink && lnEl.classList.contains('cm-label') && e.button === 0) return;
      if (editingId && !(nodeEl && nodeEl.dataset.id === editingId)) stopEdit(true);
      if (editingLink && !(lnEl && lnId === editingLink)) stopEditLink(true);
      if (document.activeElement && document.activeElement !== canvas && /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) document.activeElement.blur();
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (count() >= 2) { pinchStart(); return; }
      var additive = e.shiftKey || e.ctrlKey || e.metaKey || tool === 'sel', connecting = tool === 'link' || tool === 'arrow';
      if (hEl && nodeEl && doc.sel === nodeEl.dataset.id && !doc.get(doc.sel).locked) {
        var n = doc.get(nodeEl.dataset.id);
        mode = { t: 'resize', id: n.id, d: hEl.dataset.d, sx: e.clientX, sy: e.clientY, x: n.x, y: n.y, w: n.w, h: n.h };
      } else if (nodeEl && connecting) {
        var cid = nodeEl.dataset.id;
        mode = { t: 'connect', src: pending || cid, from: cid, sx: e.clientX, sy: e.clientY, moved: false };
        if (!pending) els[cid].classList.add('cm-src');
      } else if (nodeEl) {
        var nid = nodeEl.dataset.id, ids = doc.expand([nid]), was = doc.isSel(nid);
        if (!was) doc.setSel(additive ? union(doc.selN, ids) : ids, additive ? doc.selL : []);
        mode = {
          t: 'drag', id: nid, was: was, additive: additive, sx: e.clientX, sy: e.clientY, moved: false,
          starts: doc.selN.map(function (id) { var m = doc.get(id); return { id: id, x: m.x, y: m.y }; })
        };
      } else if (lnId) {
        /* رابط: يُحدَّد فوراً؛ السحب عليه يحرّك مساحة العمل والنقر المزدوج يعدّل نصه */
        if (additive) doc.setSel(doc.selN, doc.selL.indexOf(lnId) >= 0 ? doc.selL.filter(function (x) { return x !== lnId; }) : doc.selL.concat([lnId]));
        else doc.selectLink(lnId);
        mode = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: doc.view.x, vy: doc.view.y, moved: false, link: lnId, additive: additive };
      } else if (tool === 'sel' || e.shiftKey) {
        var mods = e.shiftKey || e.ctrlKey || e.metaKey;
        mode = { t: 'marq', sx: e.clientX, sy: e.clientY, base: mods ? doc.selN.slice() : [], moved: false, additive: mods };
      } else {
        mode = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: doc.view.x, vy: doc.view.y, moved: false, additive: additive };
      }
      canvas.classList.toggle('cm-grabbing', mode.t === 'pan' || (mode.t === 'drag'));
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (!mode) return;
      var v = doc.view;
      if (mode.t === 'pinch') {
        var ids = Object.keys(ptrs); if (ids.length < 2) return;
        var a = ptrs[ids[0]], b = ptrs[ids[1]], r = canvasRect();
        var k = U.clamp(mode.v0.k * dist(a, b) / mode.d0, L.minK, L.maxK);
        var wx = (mode.cx0 - r.left - mode.v0.x) / mode.v0.k, wy = (mode.cy0 - r.top - mode.v0.y) / mode.v0.k;
        var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        doc.setView({ k: k, x: cx - r.left - wx * k, y: cy - r.top - wy * k });
      } else if (mode.t === 'pan') {
        var dx = e.clientX - mode.sx, dy = e.clientY - mode.sy;
        if (!mode.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        mode.moved = true;
        doc.setView({ k: v.k, x: mode.vx + dx, y: mode.vy + dy });
      } else if (mode.t === 'drag') {
        var ddx = e.clientX - mode.sx, ddy = e.clientY - mode.sy;
        if (!mode.moved && Math.abs(ddx) + Math.abs(ddy) < 4) return;
        mode.moved = true;
        var free = 0;
        mode.starts.forEach(function (st) {
          var m = doc.get(st.id); if (!m) return;
          if (m.locked) return; free++;
          doc.update(st.id, { x: Math.round(st.x + ddx / v.k), y: Math.round(st.y + ddy / v.k) });
        });
        if (!free && !mode.said) { mode.said = true; say('العنصر مقفل: ألغِ القفل لتحريكه'); }
      } else if (mode.t === 'resize') {
        var rx = (e.clientX - mode.sx) / v.k, ry = (e.clientY - mode.sy) / v.k, d = mode.d;
        var x = mode.x, y = mode.y, w = mode.w, h = mode.h;
        if (d.indexOf('e') >= 0) w = mode.w + rx;
        if (d.indexOf('w') >= 0) { w = mode.w - rx; }
        if (d.indexOf('s') >= 0) h = mode.h + ry;
        if (d.indexOf('n') >= 0) { h = mode.h - ry; }
        w = U.clamp(w, L.minW, L.maxW); h = U.clamp(h, L.minH, L.maxH);
        if (d.indexOf('w') >= 0) x = mode.x + mode.w - w;
        if (d.indexOf('n') >= 0) y = mode.y + mode.h - h;
        doc.update(mode.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      } else if (mode.t === 'connect') {
        if (!mode.moved && Math.abs(e.clientX - mode.sx) + Math.abs(e.clientY - mode.sy) < 4) return;
        mode.moved = true;
        showRb(mode.src, e.clientX, e.clientY);
        var tn = nodeAt(e.clientX, e.clientY); setHover(tn && tn !== mode.src ? tn : null);
      } else if (mode.t === 'marq') {
        if (!mode.moved && Math.abs(e.clientX - mode.sx) + Math.abs(e.clientY - mode.sy) < 4) return;
        mode.moved = true;
        var cr = canvasRect(), x1 = Math.min(mode.sx, e.clientX), y1 = Math.min(mode.sy, e.clientY), x2 = Math.max(mode.sx, e.clientX), y2 = Math.max(mode.sy, e.clientY);
        marqEl.hidden = false;
        marqEl.style.left = (x1 - cr.left) + 'px'; marqEl.style.top = (y1 - cr.top) + 'px'; marqEl.style.width = (x2 - x1) + 'px'; marqEl.style.height = (y2 - y1) + 'px';
        var w1 = toWorld(x1, y1), w2 = toWorld(x2, y2);
        var hit = doc.nodes.filter(function (n) { return n.x < w2.x && n.x + n.w > w1.x && n.y < w2.y && n.y + n.h > w1.y; }).map(function (n) { return n.id; });
        doc.setSel(union(mode.base, doc.expand(hit)), mode.additive ? doc.selL : []);
      }
    });

    function endPtr(e, cancelled) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId];
      try { canvas.releasePointerCapture(e.pointerId); } catch (x) {}
      var m = mode;
      if (m && m.t === 'pinch') { if (count() < 2) mode = null; canvas.classList.remove('cm-grabbing'); return; }
      mode = null; canvas.classList.remove('cm-grabbing'); marqEl.hidden = true;
      if (!m) return;
      /* تسجيل الحركة في سجل التراجع مرة واحدة عند انتهاء السحب */
      if (m.t === 'drag' && m.moved) doc.commit(m.starts.length > 1 ? 'تحريك مجموعة' : 'تحريك عقدة');
      if (m.t === 'resize') doc.commit('تغيير الحجم');
      if (m.t === 'connect') {
        var tgt = cancelled ? null : nodeAt(e.clientX, e.clientY);
        hideRb(); clearHover();
        var kind = tool === 'arrow' ? 'end' : 'none';
        if (els[m.from] && !pending) els[m.from].classList.remove('cm-src');
        if (tgt && tgt !== m.src) { clearPending(); makeLink(m.src, tgt, kind); }
        else if (!m.moved && tgt === m.src && !pending && !cancelled) { setPending(m.src); say('الآن انقر العقدة الثانية لإكمال الربط'); }
        else clearPending();
        return;
      }
      if (cancelled) return;
      if (m.t === 'pan' && !m.moved) {
        if (m.link) {
          var tn = Date.now();
          if (lastTap.id === 'L' + m.link && tn - lastTap.t < 420) { lastTap.id = null; startEditLink(m.link); }
          else lastTap = { id: 'L' + m.link, t: tn, x: e.clientX, y: e.clientY };
        } else if (pending) clearPending();
        else if (!m.additive) doc.clearSel();
      }
      if (m.t === 'marq' && !m.moved && !m.additive) doc.clearSel();
      if (m.t === 'drag' && !m.moved) {
        propsClosed = false;
        var grp = doc.expand([m.id]);
        if (m.additive) { if (m.was) doc.toggleNodes(grp); }
        else if (m.was) {
          /* نقر على عنصر محدّد أصلاً: يضيّق التحديد (مجموعة كاملة → عقدة واحدة، تحديد متعدد → هذه العقدة أو مجموعتها) */
          if (doc.selN.length > 1) doc.setSel(grp.length > 1 && sameSet(grp, doc.selN) ? [m.id] : grp, []);
          else doc.setSel(doc.selN, []);
        }
        syncChrome();
        var now = Date.now();
        if (lastTap.id === m.id && now - lastTap.t < 420 && Math.abs(e.clientX - lastTap.x) + Math.abs(e.clientY - lastTap.y) < 24) { lastTap.id = null; if (!m.additive) startEdit(m.id, false); }
        else lastTap = { id: m.id, t: now, x: e.clientX, y: e.clientY };
      }
    }
    canvas.addEventListener('pointerup', function (e) { endPtr(e, false); });
    canvas.addEventListener('pointercancel', function (e) { endPtr(e, true); });
    canvas.addEventListener('lostpointercapture', function (e) { if (ptrs[e.pointerId] && mode && mode.t !== 'pinch') endPtr(e, true); });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = canvasRect(), k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? r.height : 1);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * k * 0.0025), e.clientX - r.left, e.clientY - r.top);
      } else {
        var dx = e.deltaX * k, dy = e.deltaY * k;
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }
        doc.setView({ k: doc.view.k, x: doc.view.x - dx, y: doc.view.y - dy });
      }
    }, { passive: false });

    canvas.addEventListener('contextmenu', function (e) { if (!e.target.closest('.cm-title')) e.preventDefault(); });

    /* ---------------------------------------------------------------- شريط الأدوات: نقر أو سحب وإفلات */
    var suppressClick = false;
    $('.cm-tools').addEventListener('click', function (e) {
      var m = e.target.closest('[data-tool]');
      if (m) { stopEdits(true); var t = m.dataset.tool; setTool((t === 'link' || t === 'arrow') && tool === t ? 'ptr' : t); return; }
      var b = e.target.closest('[data-add]'); if (!b) return;
      if (suppressClick) { suppressClick = false; return; }
      addNode(b.dataset.add);
    });
    $('.cm-tools').addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-add]');
      if (!b || e.pointerType !== 'mouse' || e.button !== 0) return;
      var key = b.dataset.add, sx = e.clientX, sy = e.clientY, ghost = null, pre = CM.PRESETS[key];
      function mv(ev) {
        if (!ghost && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) {
          ghost = document.createElement('div'); ghost.className = 'cm-ghost'; ghost.dataset.shape = pre.shape;
          ghost.style.cssText = 'width:' + pre.w * doc.view.k + 'px;height:' + pre.h * doc.view.k + 'px;background:' + pre.bg + ';color:' + pre.fg + ';font-size:' + pre.fs * doc.view.k + 'px';
          ghost.textContent = pre.text; rootEl.appendChild(ghost);
        }
        if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
      }
      function up(ev) {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!ghost) return;
        ghost.remove(); suppressClick = true; setTimeout(function () { suppressClick = false; }, 60);
        var r = canvasRect();
        if (ev.type === 'pointerup' && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) addNode(key, toWorld(ev.clientX, ev.clientY));
      }
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });

    /* ---------------------------------------------------------------- البحث داخل الخريطة */
    var sHits = [], sIdx = 0;
    function clearHitMarks() {
      var id; for (id in els) els[id].classList.remove('cm-hit'); for (id in lels) lels[id].label.classList.remove('cm-hit');
    }
    function centerOn(x, y) { var r = canvasRect(), k = doc.view.k; doc.setView({ k: k, x: r.width / 2 - x * k, y: r.height / 2 - y * k }); }
    function goHit(i) {
      var h = sHits[i]; if (!h) return;
      sIdx = i;
      if (h.type === 'node') {
        var n = doc.get(h.id); if (!n) return;
        doc.setSel([h.id], []); centerOn(n.x + n.w / 2, n.y + n.h / 2);
      } else {
        var l = doc.getLink(h.id), a = l && doc.get(l.from), b = l && doc.get(l.to); if (!a || !b) return;
        doc.selectLink(h.id); var rt = CM.geo.route(a, b, l.style, l.arrow, l.width); centerOn(rt.mid.x, rt.mid.y);
      }
      sCount.textContent = (i + 1) + ' / ' + sHits.length;
    }
    function runSearch(jump) {
      clearHitMarks();
      var q = sIn.value;
      sHits = doc.find(q);
      sHits.forEach(function (h) { if (h.type === 'node' && els[h.id]) els[h.id].classList.add('cm-hit'); else if (lels[h.id]) lels[h.id].label.classList.add('cm-hit'); });
      if (!q.trim()) { sCount.textContent = ''; return; }
      if (!sHits.length) { sCount.textContent = 'لا توجد نتائج'; return; }
      sIdx = Math.min(sIdx, sHits.length - 1);
      if (jump) goHit(sIdx); else sCount.textContent = (sIdx + 1) + ' / ' + sHits.length;
    }
    function openSearch() { stopEdits(true); searchEl.hidden = false; sIn.focus(); sIn.select(); if (sIn.value.trim()) runSearch(false); }
    function closeSearch() { searchEl.hidden = true; clearHitMarks(); sHits = []; sCount.textContent = ''; canvas.focus({ preventScroll: true }); }
    function stepSearch(d) {
      if (!sHits.length) { runSearch(true); return; }
      goHit((sIdx + d + sHits.length) % sHits.length);
    }
    sIn.addEventListener('input', function () { sIdx = 0; runSearch(true); });
    sIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); stepSearch(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSearch(); }
    });

    /* ---------------------------------------------------------------- الأزرار العامة */
    function toggleHelp() { helpEl.hidden = !helpEl.hidden; }
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      switch (b.dataset.act) {
        case 'undo': undoAct(); break;
        case 'redo': redoAct(); break;
        case 'copy': copySel(); break;
        case 'paste': pasteSel(); break;
        case 'dup': dupSel(); break;
        case 'del': delSel(); break;
        case 'selall': stopEdits(true); doc.selectAll(); break;
        case 'group': groupSel(); break;
        case 'ungroup': ungroupSel(); break;
        case 'lock': lockSel(); break;
        case 'front': case 'up': case 'down': case 'back': stopEdits(true); doc.arrange(doc.selN, b.dataset.act); break;
        case 'edit': { var n = cur(); if (n) { propsClosed = true; syncChrome(); startEdit(n.id, true); } break; }
        case 'mkline': case 'mkarrow': {
          if (doc.selN.length === 2 && !doc.selL.length) makeLink(doc.selN[0], doc.selN[1], b.dataset.act === 'mkarrow' ? 'end' : 'none');
          break;
        }
        case 'ledit': { var l = curLink(); if (l) { propsClosed = true; syncChrome(); startEditLink(l.id); } break; }
        case 'lclear': patchLink({ label: '' }); break;
        case 'lrev': { var lk = curLink(); if (lk) doc.reverseLink(lk.id); break; }
        case 'ldel': { var ld = curLink(); if (ld) { stopEdits(false); doc.removeLink(ld.id); say('تم حذف الرابط وبقيت العقدتان'); } break; }
        case 'search': if (searchEl.hidden) openSearch(); else closeSearch(); break;
        case 'sprev': stepSearch(-1); break;
        case 'snext': stepSearch(1); break;
        case 'sclose': closeSearch(); break;
        case 'help': toggleHelp(); break;
        case 'zin': zoomCenter(1.25); break;
        case 'zout': zoomCenter(0.8); break;
        case 'z100': { var r = canvasRect(); zoomAt(1 / doc.view.k, r.width / 2, r.height / 2); break; }
        case 'fit': fit(); break;
        case 'grid': doc.setGrid(!doc.grid); break;
        case 'closeprops': propsClosed = true; syncChrome(); break;
        case 'showprops': propsClosed = false; syncChrome(); break;
      }
    });
    helpEl.addEventListener('click', function (e) { if (e.target === helpEl) helpEl.hidden = true; });

    nameIn.addEventListener('input', function () { doc.setName(nameIn.value); });
    nameIn.addEventListener('blur', function () { if (!nameIn.value.trim()) { nameIn.value = 'خريطة مفاهيمية جديدة'; doc.setName(nameIn.value); } });
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });

    /* اختصارات لوحة المفاتيح (تعمل فقط والأداة ظاهرة ولا يُكتب في حقل). تعتمد e.code فتعمل مع لوحة المفاتيح العربية أيضاً */
    function editSelected() {
      var n = cur(); if (n) { startEdit(n.id, false); return; }
      var l = curLink(); if (l) startEditLink(l.id);
    }
    document.addEventListener('keydown', function (e) {
      if (host.hidden || !host.offsetWidth) return;
      var tg = e.target, typing = tg && (tg.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(tg.tagName));
      if (typing) return;
      var c = e.code, mod = e.ctrlKey || e.metaKey, onBtn = tg && tg.tagName === 'BUTTON';
      if (mod && !e.altKey) {
        var handled = true;
        switch (c) {
          case 'KeyZ': if (e.shiftKey) redoAct(); else undoAct(); break;
          case 'KeyY': redoAct(); break;
          case 'KeyC': copySel(); break;
          case 'KeyX': cutSel(); break;
          case 'KeyV': pasteSel(); break;
          case 'KeyD': dupSel(); break;
          case 'KeyA': stopEdits(true); doc.selectAll(); break;
          case 'KeyG': if (e.shiftKey) ungroupSel(); else groupSel(); break;
          case 'KeyL': if (e.shiftKey) lockSel(); else handled = false; break;
          case 'KeyF': openSearch(); break;
          case 'BracketRight': doc.arrange(doc.selN, e.shiftKey ? 'front' : 'up'); break;
          case 'BracketLeft': doc.arrange(doc.selN, e.shiftKey ? 'back' : 'down'); break;
          default: handled = false;
        }
        if (handled) e.preventDefault();
        return;
      }
      if (c === 'Delete' || c === 'Backspace') { if (doc.selN.length || doc.selL.length) { e.preventDefault(); delSel(); } }
      else if (c === 'Escape') {
        if (!helpEl.hidden) helpEl.hidden = true;
        else if (pending || tool !== 'ptr') { clearPending(); setTool('ptr'); }
        else if (!searchEl.hidden) closeSearch();
        else if (doc.selN.length || doc.selL.length) doc.clearSel();
      }
      else if ((c === 'Enter' || c === 'F2' || c === 'NumpadEnter') && !onBtn) { if (doc.selN.length + doc.selL.length === 1) { e.preventDefault(); editSelected(); } }
      else if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown') {
        if (!doc.selN.length) return;
        var st = e.shiftKey ? 10 : 1, dx = c === 'ArrowLeft' ? -st : (c === 'ArrowRight' ? st : 0), dy = c === 'ArrowUp' ? -st : (c === 'ArrowDown' ? st : 0);
        e.preventDefault();
        if (doc.moveBy(doc.selN, dx, dy)) doc.commit('تحريك بالأسهم', 'nudge');
      }
      else if (c === 'Equal' || c === 'NumpadAdd') zoomCenter(1.25);
      else if (c === 'Minus' || c === 'NumpadSubtract') zoomCenter(0.8);
      else if (c === 'Digit0' || c === 'Numpad0') fit();
    });

    /* ---------------------------------------------------------------- بدء التشغيل */
    syncChrome(); refreshEmpty(); applyView();
    requestAnimationFrame(function () { fit(); });
    /* المرحلة 3: نقطة اتصال للإضافات (القوالب والمظهر) */
    UI.api = { host: host, root: rootEl, canvas: canvas, fit: fit, say: say, stopEdits: stopEdits, clearPending: clearPending, setTool: setTool, nameIn: nameIn };
    (CM.ext || []).forEach(function (fn) { try { fn(UI.api, doc); } catch (err) { if (window.console) console.error('cmap ext', err); } });
  };

  UI.refresh = function () { /* عند إعادة فتح الأداة: لا شيء مطلوب، الحالة في الذاكرة */ };
})();
