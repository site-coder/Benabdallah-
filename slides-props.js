/* ==========================================================================
   slides-props.js — لوحة الخصائص التكيفية لـ «استوديو العروض»
   - تتغير ديناميكياً حسب التحديد: نص | صورة | شكل | جدول | مخطط | متعدد | شريحة
   - تدعم: اتجاه RTL/LTR، تباعد الأسطر، الهوامش، خلفية وحدود النص، قص/استبدال الصورة،
     إدارة الجدول ودمج الخلايا، محرر بيانات المخطط الفوري، المحاذاة والتوزيع، الانتقالات
   ========================================================================== */
(function () {
  'use strict';
  var E = window.SLE, C = window.SLC; if (!E || !C) return;
  var A = C.actions;
  var CAND = ['Alexandria', 'Tahoma', 'Arial', 'Verdana', 'Segoe UI', 'Calibri', 'Cambria', 'Times New Roman', 'Georgia', 'Trebuchet MS', 'Courier New', 'Helvetica', 'Roboto', 'Open Sans',
    'Noto Naskh Arabic', 'Noto Sans Arabic', 'Amiri', 'Cairo', 'Traditional Arabic', 'Simplified Arabic', 'Sakkal Majalla'];
  var GEN = [['sans-serif', 'خط النظام (بلا زوائد)'], ['serif', 'خط النظام (بزوائد)'], ['monospace', 'خط النظام (ثابت العرض)']];
  var SHAPE_NAMES = [
    ['rect', 'مستطيل'], ['rrect', 'مستطيل مستدير'], ['square', 'مربع'], ['circle', 'دائرة'],
    ['line', 'خط'], ['arrow', 'سهم'], ['darrow', 'سهم مزدوج'], ['triangle', 'مثلث'],
    ['diamond', 'معين'], ['pentagon', 'خماسي'], ['hexagon', 'سداسي'], ['star', 'نجمة'], ['callout', 'فقاعة شرح']
  ];
  var fontsCache = null;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var I = {
    x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    al: ic('<path d="M3 6h18"/><path d="M3 12h12"/><path d="M3 18h16"/>'),
    ac: ic('<path d="M3 6h18"/><path d="M6 12h12"/><path d="M5 18h14"/>'),
    ar: ic('<path d="M3 6h18"/><path d="M9 12h12"/><path d="M5 18h16"/>'),
    aj: ic('<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>'),
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    lock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    unlock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
    up: ic('<path d="m18 15-6-6-6 6"/>'), down: ic('<path d="m6 9 6 6 6-6"/>'),
    front: ic('<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>'), back: ic('<path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/>'),
    crop: ic('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
    group: ic('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M13 7h4a2 2 0 0 1 2 2v1"/><path d="M11 17H7a2 2 0 0 1-2-2v-1"/>'),
    ungroup: ic('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M14 4h6v6"/><path d="M4 14v6h6"/>')
  };
  var BGS = ['#FFFFFF', '#F6F1FF', '#1B0E3A', '#7C3AED', '#0F172A', '#FBBF24'];
  var TYPE_LABELS = { text: 'نص', image: 'صورة', shape: 'شكل', table: 'جدول', chart: 'مخطط بياني' };

  function installed() {
    if (fontsCache) return fontsCache;
    var out = [];
    try {
      var cv = document.createElement('canvas').getContext('2d'), T = 'mmmmmmmmlliWM١٢٣ عربيةÉàç', bases = ['monospace', 'serif', 'sans-serif'];
      var bw = bases.map(function (b) { cv.font = '72px ' + b; return cv.measureText(T).width; });
      CAND.forEach(function (n) {
        for (var i = 0; i < bases.length; i++) { cv.font = '72px "' + n + '",' + bases[i]; if (cv.measureText(T).width !== bw[i]) { out.push(n); return; } }
      });
    } catch (e) {}
    fontsCache = out; return out;
  }
  function fontOpts(cur) {
    var h = '', list = installed().slice(), seen = false;
    list.forEach(function (n) { var on = n === cur; if (on) seen = true; h += '<option value="' + esc(n) + '"' + (on ? ' selected' : '') + ' style="font-family:\'' + esc(n) + '\'">' + esc(n) + '</option>'; });
    GEN.forEach(function (g) { var on = g[0] === cur; if (on) seen = true; h += '<option value="' + g[0] + '"' + (on ? ' selected' : '') + '>' + g[1] + '</option>'; });
    if (!seen) h = '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>' + h;
    return h;
  }
  function pb(a, icon, label, on, dis) {
    return '<button type="button" class="sl-pb' + (on ? ' on' : '') + '" data-pa="' + a + '" aria-label="' + label + '" title="' + label + '" aria-pressed="' + (!!on) + '"' + (dis ? ' disabled' : '') + '>' + icon + '</button>';
  }
  function numField(k, lab, v, grp, dis, step, min, max) {
    return '<label class="sl-f"><span>' + lab + '</span><input type="number" class="sl-in" data-' + grp + '="' + k + '" value="' + (Math.round(v * 100) / 100) + '"' +
      (step ? ' step="' + step + '"' : '') + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') + (dis ? ' disabled' : '') + '></label>';
  }
  function alignBlock(isMulti) {
    return '<div class="sl-pg"><div class="sl-lbl">المحاذاة' + (isMulti ? ' والتوزيع' : ' مع الشريحة') + '</div><div class="sl-pbs">' +
      pb('al-right', '⇥', 'محاذاة لليمين') + pb('al-center', '↔', 'توسيط أفقي') + pb('al-left', '⇤', 'محاذاة لليسار') +
      pb('al-top', '⤒', 'محاذاة للأعلى') + pb('al-middle', '↕', 'توسيط عمودي') + pb('al-bottom', '⤓', 'محاذاة للأسفل') +
      (isMulti ? pb('dist-h', '⋯', 'توزيع أفقي') + pb('dist-v', '⋮', 'توزيع عمودي') : '') +
      '</div></div>';
  }

  function html(proj, slide, it, idx) {
    var items = C.selectedList ? C.selectedList() : (it ? [it] : []);
    var h = '<div class="sl-ph"><b>الخصائص</b><button type="button" class="sl-iconbtn sl-only-sm" data-act="panel" aria-label="إغلاق">' + I.x + '</button></div>';

    if (items.length > 1) {
      var hasGrp = items.some(function (x) { return !!x.group; });
      var allLocked = items.every(function (x) { return x.locked; });
      h += '<div class="sl-pg"><div class="sl-lbl">تحديد متعدد (' + items.length + ' عناصر)</div><div class="sl-pbs">' +
        (hasGrp ? pb('ungroup', I.ungroup, 'فك التجميع') : pb('group', I.group, 'تجميع العناصر')) +
        pb('dup', I.copy, 'تكرار المحدد') +
        pb('lock', allLocked ? I.unlock : I.lock, allLocked ? 'إلغاء القفل' : 'قفل المحدد', allLocked) +
        pb('del', I.trash, 'حذف المحدد') +
        '</div><div class="sl-lbl">الترتيب</div><div class="sl-pbs">' +
        pb('front', I.front, 'إلى الأمام تماماً') + pb('forward', I.up, 'للأمام') + pb('backward', I.down, 'للخلف') + pb('back', I.back, 'إلى الخلف تماماً') +
        '</div></div>' + alignBlock(true);
    } else if (it) {
      var d = it.locked;
      h += '<div class="sl-pg"><div class="sl-lbl">' + (TYPE_LABELS[it.type] || it.type) + (d ? ' — مقفل' : '') + '</div><div class="sl-pbs">' +
        pb('dup', I.copy, 'تكرار') + pb('lock', d ? I.unlock : I.lock, d ? 'إلغاء القفل' : 'قفل', d) + pb('del', I.trash, 'حذف العنصر', false, d) + '</div>' +
        '<div class="sl-lbl">الترتيب</div><div class="sl-pbs">' +
        pb('front', I.front, 'إلى الأمام تماماً') + pb('forward', I.up, 'للأمام') + pb('backward', I.down, 'للخلف') + pb('back', I.back, 'إلى الخلف تماماً') + '</div></div>';
      h += '<div class="sl-pg"><div class="sl-lbl">الموضع والحجم</div><div class="sl-fg">' +
        numField('x', 'X', it.x, 'g', d) + numField('y', 'Y', it.y, 'g', d) +
        numField('w', 'العرض', it.w, 'g', d) + numField('h', 'الارتفاع', it.h, 'g', d || (it.type === 'shape' && it.kind === 'square')) +
        numField('rot', 'التدوير°', it.rot || 0, 'g', d) +
        numField('op', 'الشفافية %', Math.round((it.op != null ? it.op : 1) * 100), 'op', d, 5, 0, 100) +
        '</div></div>' + alignBlock(false);

      if (it.type === 'text') {
        var noBg = !it.bg || it.bg === 'none';
        h += '<div class="sl-pg"><div class="sl-lbl">تنسيق النص</div>' +
          '<label class="sl-f wide"><span>الخط</span><select class="sl-in" data-t="font"' + (d ? ' disabled' : '') + '>' + fontOpts(it.font) + '</select></label>' +
          '<div class="sl-fg">' + numField('size', 'الحجم', it.size, 't', d, 1, 6, 400) +
          '<label class="sl-f"><span>اللون</span><input type="color" class="sl-in sl-col" data-t="color" value="' + esc(it.color) + '"' + (d ? ' disabled' : '') + '></label>' +
          numField('lh', 'تباعد الأسطر', it.lh || 1.35, 't', d, 0.05, 0.8, 3.5) +
          numField('pad', 'الهامش الداخلي', it.pad != null ? it.pad : 8, 't', d, 1, 0, 120) +
          '</div>' +
          '<div class="sl-pbs">' +
          pb('bold', '<b>B</b>', 'عريض', it.bold, d) +
          pb('italic', '<i>I</i>', 'مائل', it.italic, d) +
          pb('underline', '<u>U</u>', 'تحته خط', it.underline, d) +
          pb('align-right', I.ar, 'يمين', it.align === 'right', d) +
          pb('align-center', I.ac, 'وسط', it.align === 'center', d) +
          pb('align-left', I.al, 'يسار', it.align === 'left', d) +
          pb('align-justify', I.aj, 'ضبط', it.align === 'justify', d) +
          '</div>' +
          '<div class="sl-lbl">اتجاه النص ومعالجة الطول</div><div class="sl-pbs">' +
          pb('dir-auto', 'تلقائي', 'اتجاه تلقائي', (it.dir || 'auto') === 'auto', d) +
          pb('dir-rtl', 'RTL', 'من اليمين لليسار', it.dir === 'rtl', d) +
          pb('dir-ltr', 'LTR', 'من اليسار لليمين', it.dir === 'ltr', d) +
          '</div>' +
          '<label class="sl-f wide"><span>النص الطويل</span><select class="sl-in" data-t="overflow"' + (d ? ' disabled' : '') + '>' +
          '<option value="scroll"' + ((it.overflow || 'scroll') === 'scroll' ? ' selected' : '') + '>تمرير داخل المربع</option>' +
          '<option value="shrink"' + (it.overflow === 'shrink' ? ' selected' : '') + '>تصغير الخط تلقائياً</option>' +
          '<option value="visible"' + (it.overflow === 'visible' ? ' selected' : '') + '>إظهار كامل متمدد</option></select></label>' +
          '<div class="sl-lbl">خلفية وحدود مربع النص</div><div class="sl-fg">' +
          '<label class="sl-f"><span>الخلفية</span><input type="color" class="sl-in sl-col" data-t="bg" value="' + (noBg ? '#FFFFFF' : esc(it.bg)) + '"' + (d || noBg ? ' disabled' : '') + '></label>' +
          numField('bgOp', 'شفافية الخلفية %', Math.round((it.bgOp != null ? it.bgOp : 1) * 100), 'bgop', d || noBg, 5, 0, 100) +
          '<label class="sl-f"><span>لون الحدود</span><input type="color" class="sl-in sl-col" data-t="borderColor" value="' + esc(it.borderColor || '#7C3AED') + '"' + (d ? ' disabled' : '') + '></label>' +
          numField('borderWidth', 'سمك الحدود', it.borderWidth || 0, 't', d, 1, 0, 30) +
          '</div><label class="sl-chk"><input type="checkbox" data-t="nobg"' + (noBg ? ' checked' : '') + (d ? ' disabled' : '') + '> بدون خلفية</label>' +
          '</div>';
      } else if (it.type === 'image') {
        h += '<div class="sl-pg"><div class="sl-lbl">الصورة والقص</div><div class="sl-pbs">' +
          '<button type="button" class="sl-btn-sm" data-act="cropimg"' + (d ? ' disabled' : '') + '>' + I.crop + ' قص الصورة</button>' +
          '<button type="button" class="sl-btn-sm" data-act="resetcrop"' + (d ? ' disabled' : '') + '>إلغاء القص</button>' +
          '<button type="button" class="sl-btn-sm" data-act="replaceimg"' + (d ? ' disabled' : '') + '>استبدال</button>' +
          '</div><div class="sl-fg">' +
          '<label class="sl-f"><span>لون الحدود</span><input type="color" class="sl-in sl-col" data-im="borderColor" value="' + esc(it.borderColor || '#7C3AED') + '"' + (d ? ' disabled' : '') + '></label>' +
          numField('borderWidth', 'سمك الحدود', it.borderWidth || 0, 'im', d, 1, 0, 40) +
          numField('radius', 'تدوير الزوايا', it.radius || 0, 'im', d, 2, 0, 400) +
          '</div></div>';
      } else if (it.type === 'shape') {
        var line = it.kind === 'line' || it.kind === 'arrow' || it.kind === 'darrow', nf = it.fill === 'none';
        h += '<div class="sl-pg"><div class="sl-lbl">خصائص الشكل</div>' +
          '<label class="sl-f wide"><span>نوع الشكل</span><select class="sl-in" data-s="kind"' + (d ? ' disabled' : '') + '>' +
          SHAPE_NAMES.map(function (sn) { return '<option value="' + sn[0] + '"' + (it.kind === sn[0] ? ' selected' : '') + '>' + sn[1] + '</option>'; }).join('') +
          '</select></label><div class="sl-fg">' +
          (line ? '' : '<label class="sl-f"><span>التعبئة</span><input type="color" class="sl-in sl-col" data-s="fill" value="' + (nf ? '#7C3AED' : esc(it.fill)) + '"' + (d || nf ? ' disabled' : '') + '></label>') +
          '<label class="sl-f"><span>' + (line ? 'اللون' : 'الحدود') + '</span><input type="color" class="sl-in sl-col" data-s="stroke" value="' + esc(it.stroke) + '"' + (d ? ' disabled' : '') + '></label>' +
          numField('sw', line ? 'السماكة' : 'سمك الحدود', it.sw, 's', d, 1, 0, 40) +
          (it.kind === 'rrect' ? numField('radius', 'الزوايا', it.radius != null ? it.radius : 20, 's', d, 2, 0, 200) : '') +
          '</div>' + (line ? '' : '<label class="sl-chk"><input type="checkbox" data-s="nofill"' + (nf ? ' checked' : '') + (d ? ' disabled' : '') + '> بدون تعبئة</label>') + '</div>';
      } else if (it.type === 'table') {
        var cs = C.cellSelection && C.cellSelection().id === it.id ? C.cellSelection() : { r: 0, c: 0, r2: 0, c2: 0 };
        var ar = Math.min(cs.r, cs.r2), ac = Math.min(cs.c, cs.c2);
        var ar2 = Math.max(cs.r, cs.r2), ac2 = Math.max(cs.c, cs.c2);
        var cell = (it.cells[ar] && it.cells[ar][ac]) || { bg: '#FFFFFF', color: '#1B0E3A', bold: false, align: 'center', rowSpan: 1, colSpan: 1 };
        var canMerge = (ar2 > ar || ac2 > ac);
        var isMerged = (cell.rowSpan > 1 || cell.colSpan > 1 || !!cell.mergedTo);
        h += '<div class="sl-pg"><div class="sl-lbl">إدارة الجدول (' + it.rows + '×' + it.cols + ')</div><div class="sl-pbs">' +
          '<button type="button" class="sl-btn-sm" data-tbl="addrow"' + (d ? ' disabled' : '') + '>+ صف</button>' +
          '<button type="button" class="sl-btn-sm" data-tbl="delrow"' + (d || it.rows <= 1 ? ' disabled' : '') + '>- صف</button>' +
          '<button type="button" class="sl-btn-sm" data-tbl="addcol"' + (d ? ' disabled' : '') + '>+ عمود</button>' +
          '<button type="button" class="sl-btn-sm" data-tbl="delcol"' + (d || it.cols <= 1 ? ' disabled' : '') + '>- عمود</button>' +
          '</div><div class="sl-fg">' +
          '<label class="sl-f"><span>لون الحدود</span><input type="color" class="sl-in sl-col" data-tb="borderColor" value="' + esc(it.borderColor || '#CBD5E1') + '"' + (d ? ' disabled' : '') + '></label>' +
          numField('borderWidth', 'سمك الحدود', it.borderWidth != null ? it.borderWidth : 1, 'tb', d, 1, 0, 12) +
          numField('fontSize', 'حجم الخط', it.fontSize || 16, 'tb', d, 1, 8, 72) +
          '<label class="sl-f"><span>الاتجاه</span><select class="sl-in" data-tb="dir"' + (d ? ' disabled' : '') + '>' +
          '<option value="auto"' + ((it.dir || 'auto') === 'auto' ? ' selected' : '') + '>تلقائي</option>' +
          '<option value="rtl"' + (it.dir === 'rtl' ? ' selected' : '') + '>RTL</option>' +
          '<option value="ltr"' + (it.dir === 'ltr' ? ' selected' : '') + '>LTR</option></select></label></div></div>' +
          '<div class="sl-pg"><div class="sl-lbl">الخلية المحددة (' + (ar + 1) + '، ' + (ac + 1) + ')</div><div class="sl-fg">' +
          '<label class="sl-f"><span>لون الخلية</span><input type="color" class="sl-in sl-col" data-tc="bg" value="' + (cell.bg === 'none' ? '#FFFFFF' : esc(cell.bg)) + '"' + (d ? ' disabled' : '') + '></label>' +
          '<label class="sl-f"><span>لون النص</span><input type="color" class="sl-in sl-col" data-tc="color" value="' + esc(cell.color || '#1B0E3A') + '"' + (d ? ' disabled' : '') + '></label>' +
          '</div><div class="sl-pbs">' +
          '<button type="button" class="sl-pb' + (cell.bold ? ' on' : '') + '" data-tbl="cellbold"' + (d ? ' disabled' : '') + '><b>B</b></button>' +
          '<button type="button" class="sl-pb' + (cell.align === 'right' ? ' on' : '') + '" data-tbl="cellal:right"' + (d ? ' disabled' : '') + '>' + I.ar + '</button>' +
          '<button type="button" class="sl-pb' + (cell.align === 'center' ? ' on' : '') + '" data-tbl="cellal:center"' + (d ? ' disabled' : '') + '>' + I.ac + '</button>' +
          '<button type="button" class="sl-pb' + (cell.align === 'left' ? ' on' : '') + '" data-tbl="cellal:left"' + (d ? ' disabled' : '') + '>' + I.al + '</button>' +
          '</div><div class="sl-pbs">' +
          '<button type="button" class="sl-btn-sm" data-tbl="merge"' + (d || !canMerge ? ' disabled' : '') + '>دمج المحدد</button>' +
          '<button type="button" class="sl-btn-sm" data-tbl="mergeright"' + (d || ac + (cell.colSpan || 1) >= it.cols ? ' disabled' : '') + '>دمج لليمين</button>' +
          '<button type="button" class="sl-btn-sm" data-tbl="unmerge"' + (d || !isMerged ? ' disabled' : '') + '>فك الدمج</button>' +
          '</div><p class="sl-muted">لتحديد عدة خلايا للدمج: اضغط على خلية ثم Shift+نقر على الخلية المقابلة، ولتحرير النص انقر مرتين على الخلية.</p></div>';
      } else if (it.type === 'chart') {
        var cats = it.categories || [], s0 = (it.series && it.series[0]) || { name: 'السلسلة 1', color: '#7C3AED', values: [] };
        var pal = it.palette || E.DEFAULT_PALETTE;
        h += '<div class="sl-pg"><div class="sl-lbl">إعدادات المخطط</div>' +
          '<label class="sl-f wide"><span>نوع المخطط</span><select class="sl-in" data-ch="chartType"' + (d ? ' disabled' : '') + '>' +
          '<option value="bar"' + (it.chartType === 'bar' ? ' selected' : '') + '>مخطط أعمدة</option>' +
          '<option value="pie"' + (it.chartType === 'pie' ? ' selected' : '') + '>مخطط دائري</option>' +
          '<option value="line"' + (it.chartType === 'line' ? ' selected' : '') + '>مخطط خطي</option></select></label>' +
          '<label class="sl-f wide"><span>عنوان المخطط</span><input type="text" class="sl-in" data-ch="title" value="' + esc(it.title || '') + '"' + (d ? ' disabled' : '') + '></label>' +
          '<div class="sl-fg">' +
          '<label class="sl-f"><span>لون النص</span><input type="color" class="sl-in sl-col" data-ch="textColor" value="' + esc(it.textColor || '#1B0E3A') + '"' + (d ? ' disabled' : '') + '></label>' +
          '<label class="sl-f"><span>الخلفية</span><input type="color" class="sl-in sl-col" data-ch="bg" value="' + (it.bg === 'none' ? '#FFFFFF' : esc(it.bg || '#FFFFFF')) + '"' + (d || it.bg === 'none' ? ' disabled' : '') + '></label>' +
          '</div>' +
          '<label class="sl-chk"><input type="checkbox" data-ch="nobg"' + (it.bg === 'none' ? ' checked' : '') + (d ? ' disabled' : '') + '> خلفية شفافة</label>' +
          '<label class="sl-chk"><input type="checkbox" data-ch="showLegend"' + (it.showLegend ? ' checked' : '') + (d ? ' disabled' : '') + '> إظهار وسيلة الإيضاح</label>' +
          '<label class="sl-chk"><input type="checkbox" data-ch="showValues"' + (it.showValues ? ' checked' : '') + (d ? ' disabled' : '') + '> إظهار القيم</label>' +
          '</div><div class="sl-pg"><div class="sl-lbl">بيانات المخطط</div><div class="sl-ch-rows">' +
          cats.map(function (c, ri) {
            var val = s0.values[ri] != null ? s0.values[ri] : 0;
            var col = pal[ri % pal.length];
            return '<div class="sl-ch-row" data-ri="' + ri + '">' +
              '<input type="color" class="sl-in sl-col" data-chrow="color" value="' + esc(col) + '"' + (d ? ' disabled' : '') + '>' +
              '<input type="text" class="sl-in" data-chrow="cat" value="' + esc(c) + '" placeholder="الفئة"' + (d ? ' disabled' : '') + '>' +
              '<input type="number" class="sl-in" data-chrow="val" value="' + val + '" step="any"' + (d ? ' disabled' : '') + '>' +
              '<button type="button" class="sl-iconbtn sl-danger" data-chdel="' + ri + '" aria-label="حذف صف"' + (d || cats.length <= 1 ? ' disabled' : '') + '>' + I.x + '</button></div>';
          }).join('') +
          '</div><button type="button" class="sl-btn-sm wide" data-act="chaddrow"' + (d ? ' disabled' : '') + '>+ إضافة فئة جديدة</button></div>';
      }
    } else {
      h += '<div class="sl-pg"><div class="sl-lbl">معلومات العرض</div><div class="sl-kv"><span>المقاس</span><b>' + esc(proj.ratio) + '</b></div><div class="sl-kv"><span>عدد الشرائح</span><b>' + proj.slides.length + '</b></div></div>';
      if (slide) h += '<div class="sl-pg sl-soon"><p class="sl-muted">انقر على عنصر لتحديده وتعديله، أو اسحب على الشريحة لتحديد عدة عناصر معاً.</p></div>';
    }

    if (slide) {
      h += '<div class="sl-pg"><div class="sl-lbl">الشريحة ' + (idx + 1) + ' — الخلفية والانتقال</div><div class="sl-sw">' +
        BGS.map(function (c) { return '<button type="button" class="sl-swatch' + (slide.bg === c ? ' on' : '') + '" data-bg="' + c + '" style="background:' + c + '" aria-label="لون ' + c + '"></button>'; }).join('') +
        '<input type="color" class="sl-in sl-col sl-bg-pick" data-slide="bg" value="' + esc(slide.bg || '#FFFFFF') + '" title="لون مخصص">' +
        '</div><div class="sl-fg" style="margin-top:8px">' +
        '<label class="sl-f"><span>الانتقال</span><select class="sl-in" data-slide="transition">' +
        '<option value="none"' + ((slide.transition || 'none') === 'none' ? ' selected' : '') + '>بدون انتقال</option>' +
        '<option value="fade"' + (slide.transition === 'fade' ? ' selected' : '') + '>تلاشي (Fade)</option>' +
        '<option value="slide"' + (slide.transition === 'slide' ? ' selected' : '') + '>انزلاق (Slide)</option>' +
        '</select></label>' +
        numField('transDur', 'المدة (ث)', slide.transDur != null ? slide.transDur : 0.4, 'slide', false, 0.1, 0.1, 3) +
        '</div></div>';
    } else {
      h += '<p class="sl-muted">أضف شريحة لعرض خصائصها.</p>';
    }
    return h;
  }

  function sync(panel, it) {
    if (!panel || !it) return;
    [].forEach.call(panel.querySelectorAll('[data-g]'), function (i) {
      if (document.activeElement !== i && it[i.dataset.g] != null) i.value = Math.round(it[i.dataset.g] * 10) / 10;
    });
  }

  function onField(e, isCommit) {
    var t = e.target, k, v;
    if (!t.closest('.sl-props')) return;
    if (t.dataset.g) {
      k = t.dataset.g; v = parseFloat(t.value); if (!isFinite(v)) return;
      var o = {}; o[k] = v; A.box(o);
    } else if (t.dataset.op) {
      v = parseFloat(t.value); if (!isFinite(v)) return;
      A.props({ op: Math.max(0, Math.min(100, v)) / 100 }, isCommit);
    } else if (t.dataset.bgop) {
      v = parseFloat(t.value); if (!isFinite(v)) return;
      A.props({ bgOp: Math.max(0, Math.min(100, v)) / 100 }, isCommit);
    } else if (t.dataset.t) {
      k = t.dataset.t;
      if (k === 'nobg') { A.props({ bg: t.checked ? 'none' : '#FFFFFF' }, true); return; }
      var p = {};
      p[k] = (k === 'size' || k === 'lh' || k === 'pad' || k === 'borderWidth') ? parseFloat(t.value) : t.value;
      if ((k === 'size' || k === 'lh' || k === 'pad' || k === 'borderWidth') && !isFinite(p[k])) return;
      A.props(p, isCommit);
    } else if (t.dataset.im) {
      k = t.dataset.im;
      var imP = {};
      imP[k] = (k === 'borderWidth' || k === 'radius') ? parseFloat(t.value) : t.value;
      if ((k === 'borderWidth' || k === 'radius') && !isFinite(imP[k])) return;
      A.props(imP, isCommit);
    } else if (t.dataset.s) {
      k = t.dataset.s;
      if (k === 'nofill') { A.props({ fill: t.checked ? 'none' : '#7C3AED' }, true); return; }
      var q = {};
      q[k] = (k === 'sw' || k === 'radius') ? parseFloat(t.value) : t.value;
      if ((k === 'sw' || k === 'radius') && !isFinite(q[k])) return;
      A.props(q, isCommit || k === 'kind');
    } else if (t.dataset.tb) {
      k = t.dataset.tb;
      var tp = {};
      tp[k] = (k === 'borderWidth' || k === 'fontSize') ? parseFloat(t.value) : t.value;
      if ((k === 'borderWidth' || k === 'fontSize') && !isFinite(tp[k])) return;
      A.props(tp, isCommit || k === 'dir');
    } else if (t.dataset.tc) {
      k = t.dataset.tc;
      A.tableOp(function (it, cs) {
        if (!cs) cs = { r: 0, c: 0, r2: 0, c2: 0 };
        var r1 = Math.min(cs.r, cs.r2), r2 = Math.max(cs.r, cs.r2);
        var c1 = Math.min(cs.c, cs.c2), c2 = Math.max(cs.c, cs.c2);
        var patch = {}; patch[k] = t.value;
        for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) E.tableSetCell(it, r, c, patch);
        return true;
      });
    } else if (t.dataset.ch) {
      k = t.dataset.ch;
      if (k === 'nobg') { A.props({ bg: t.checked ? 'none' : '#FFFFFF' }, true); return; }
      var cp = {};
      if (k === 'showLegend' || k === 'showValues') cp[k] = t.checked;
      else cp[k] = t.value;
      A.props(cp, isCommit || t.type === 'checkbox' || t.tagName === 'SELECT');
    } else if (t.dataset.chrow) {
      var row = t.closest('.sl-ch-row'), ri = row ? +row.dataset.ri : -1;
      var it = C.selected();
      if (!it || it.type !== 'chart' || ri < 0) return;
      var kind = t.dataset.chrow;
      if (kind === 'cat') {
        var cats = it.categories.slice(); cats[ri] = t.value;
        A.props({ categories: cats }, isCommit);
      } else if (kind === 'val') {
        var val = parseFloat(t.value); if (!isFinite(val)) return;
        var sers = E.clone(it.series); if (!sers[0]) sers[0] = { name: 'السلسلة 1', color: '#7C3AED', values: [] };
        sers[0].values[ri] = val;
        A.props({ series: sers }, isCommit);
      } else if (kind === 'color') {
        var pal = (it.palette || E.DEFAULT_PALETTE).slice(); pal[ri] = t.value;
        var sers2 = E.clone(it.series); if (sers2[0] && ri === 0) sers2[0].color = t.value;
        A.props({ palette: pal, series: sers2 }, isCommit);
      }
    }
  }

  function onPropClick(e) {
    var b = e.target.closest('[data-tbl]');
    if (b) {
      var act = b.dataset.tbl;
      A.tableOp(function (it, cs) {
        if (!cs) cs = { r: 0, c: 0, r2: 0, c2: 0 };
        var r1 = Math.min(cs.r, cs.r2), r2 = Math.max(cs.r, cs.r2);
        var c1 = Math.min(cs.c, cs.c2), c2 = Math.max(cs.c, cs.c2);
        if (act === 'addrow') return E.tableAddRow(it, r2 + 1);
        if (act === 'delrow') return E.tableDelRow(it, r1);
        if (act === 'addcol') return E.tableAddCol(it, c2 + 1);
        if (act === 'delcol') return E.tableDelCol(it, c1);
        if (act === 'merge') return E.tableMerge(it, r1, c1, r2, c2);
        if (act === 'mergeright') {
          var cell = it.cells[r1][c1];
          return E.tableMerge(it, r1, c1, r1 + (cell.rowSpan || 1) - 1, c1 + (cell.colSpan || 1));
        }
        if (act === 'unmerge') return E.tableUnmerge(it, r1, c1);
        if (act === 'cellbold') {
          var curB = !!(it.cells[r1] && it.cells[r1][c1] && it.cells[r1][c1].bold);
          for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) E.tableSetCell(it, r, c, { bold: !curB });
          return true;
        }
        if (act.indexOf('cellal:') === 0) {
          var al = act.slice(7);
          for (var rr = r1; rr <= r2; rr++) for (var cc = c1; cc <= c2; cc++) E.tableSetCell(it, rr, cc, { align: al });
          return true;
        }
        return false;
      });
      return;
    }
    var delCh = e.target.closest('[data-chdel]');
    if (delCh) {
      var ri = +delCh.dataset.chdel, it = C.selected();
      if (it && it.type === 'chart' && it.categories.length > 1) {
        var cats = it.categories.slice(); cats.splice(ri, 1);
        var sers = E.clone(it.series); sers.forEach(function (s) { s.values.splice(ri, 1); });
        A.props({ categories: cats, series: sers }, true);
      }
      return;
    }
    var addCh = e.target.closest('[data-act="chaddrow"]');
    if (addCh) {
      var it2 = C.selected();
      if (it2 && it2.type === 'chart' && it2.categories.length < 24) {
        var cats2 = it2.categories.slice(); cats2.push('فئة ' + (cats2.length + 1));
        var sers2 = E.clone(it2.series); sers2.forEach(function (s) { s.values.push(25); });
        A.props({ categories: cats2, series: sers2 }, true);
      }
    }
  }

  window.SLP = {
    html: html, sync: sync,
    bind: function (root) {
      root.addEventListener('input', function (e) {
        if (e.target.closest('.sl-props') && e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') onField(e, false);
      });
      root.addEventListener('change', function (e) {
        if (e.target.closest('.sl-props')) onField(e, true);
      });
      root.addEventListener('click', function (e) {
        if (e.target.closest('.sl-props')) onPropClick(e);
      });
    }
  };
})();
