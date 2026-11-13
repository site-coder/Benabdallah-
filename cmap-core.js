/* ==========================================================================
   cmap-core.js — أداة «منشئ الخرائط المفاهيمية» (1/2): النموذج والبيانات
   - لا يلمس DOM إطلاقاً: مستند (Doc) فيه العقد والتحديد وحالة العرض، مع أحداث بسيطة
   - كل الأسماء تحت window.CM فقط، فلا تتعارض مع سكربتات المنصة
   - المرحلة 1: بلا حفظ ولا تصدير ولا قوالب (البيانات في الذاكرة فقط)
   - المرحلة 2: الروابط والأسهم، التحديد المتعدد، التراجع/الإعادة، التجميع، القفل، المحاذاة، ترتيب الطبقات، البحث
   - المرحلة 3: مجموعات الألوان، حقول التنسيق (حدود/استدارة/شفافية/محاذاة/مسافات)، مظهر مساحة العمل، تحميل القوالب
     (ما زالت البيانات في الذاكرة فقط: لا حفظ ولا تصدير)
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM = window.CM || {};

  var U = CM.u = {
    clamp: function (v, a, b) { return Math.min(b, Math.max(a, v)); },
    uid: function (p) { return (p || 'n') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    /* تطبيع نص عربي للبحث: حذف التشكيل والتطويل وتوحيد الألف والياء */
    norm: function (t) { return String(t == null ? '' : t).toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim(); },
    esc: function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  };

  /* ---- ثوابت قابلة للتوسع في المراحل القادمة ---- */
  CM.LIMITS = { minW: 60, minH: 40, maxW: 1200, maxH: 900, minFs: 10, maxFs: 60, minK: 0.2, maxK: 3, minLw: 1, maxLw: 14, hist: 120 };

  CM.SHAPES = [
    { id: 'rect', label: 'مستطيل' },
    { id: 'round', label: 'مستطيل بزوايا دائرية' },
    { id: 'ellipse', label: 'دائرة / بيضاوي' }
  ];

  CM.FONTS = [
    { id: 'alex', label: 'Alexandria', css: "Alexandria,Tahoma,'Segoe UI',sans-serif" },
    { id: 'tahoma', label: 'Tahoma', css: "Tahoma,'Segoe UI',Arial,sans-serif" },
    { id: 'arial', label: 'Arial', css: "Arial,Helvetica,sans-serif" },
    { id: 'serif', label: 'Times', css: "'Times New Roman','Traditional Arabic',serif" },
    { id: 'mono', label: 'Courier', css: "'Courier New',monospace" }
  ];

  CM.SWATCHES = ['#7E22CE', '#A855F7', '#C4B5FD', '#F59E0B', '#FCD34D', '#34D399', '#38BDF8', '#F87171', '#FFFFFF', '#1A1030'];

  /* ---- المرحلة 3: حدود التنسيق الجديدة ---- */
  CM.LIMITS.minPad = 0; CM.LIMITS.maxPad = 48; CM.LIMITS.maxBw = 12; CM.LIMITS.maxBr = 80; CM.LIMITS.minOp = 0.1;
  CM.ALIGNS = ['right', 'center', 'left'];
  CM.FONTS.push({ id: 'naskh', label: 'Traditional Arabic', css: "'Traditional Arabic','Simplified Arabic','Times New Roman',serif" });
  CM.FONTS.push({ id: 'verdana', label: 'Verdana', css: "Verdana,Geneva,Tahoma,sans-serif" });

  /* ---- ألوان: دوال نقية ---- */
  CM.hex2rgb = function (h) {
    h = String(h || '').trim(); var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h); if (!m) return null;
    h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  CM.isHex = function (h) { return !!CM.hex2rgb(h); };
  CM.norm6 = function (h) { var c = CM.hex2rgb(h); if (!c) return ''; return '#' + c.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase(); };
  /* amt سالب = أغمق، موجب = أفتح */
  CM.shade = function (h, amt) {
    var c = CM.hex2rgb(h); if (!c) return h;
    var t = amt < 0 ? 0 : 255, a = Math.abs(amt);
    return '#' + c.map(function (v) { var x = Math.round(v + (t - v) * a); return (x < 16 ? '0' : '') + x.toString(16); }).join('').toUpperCase();
  };
  CM.lum = function (h) { var c = CM.hex2rgb(h); if (!c) return 1; return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
  CM.rgba = function (h, a) { var c = CM.hex2rgb(h); return c ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' : h; };

  /* ---- مجموعات الألوان: tones[0] للمفهوم المركزي، 1..5 للفروع؛ shape للأشكال الحرة وللعقد الورقية ---- */
  CM.PALETTES = [
    { id: 'platform', label: 'ألوان المنصة', desc: 'الألوان الافتراضية للأداة', bg: null, link: '',
      tones: [['#7E22CE', '#FFFFFF'], ['#F59E0B', '#1A1030'], ['#38BDF8', '#0B2538'], ['#C4B5FD', '#1A1030'], ['#34D399', '#062B1F'], ['#F87171', '#3A0A0A']], shape: ['#FFFFFF', '#1A1030'] },
    { id: 'academic', label: 'أكاديمية', desc: 'أزرق داكن وعنابي وذهبي هادئ', bg: '#FBF8F1', link: '#475569',
      tones: [['#1E3A5F', '#FFFFFF'], ['#2C6E91', '#FFFFFF'], ['#7A2E3A', '#FFFFFF'], ['#B58B3C', '#1F1606'], ['#3F7D6B', '#FFFFFF'], ['#5B4B8A', '#FFFFFF']], shape: ['#FFFFFF', '#1E293B'] },
    { id: 'calm', label: 'هادئة', desc: 'درجات باستيل مريحة للعين', bg: '#F3F6F4', link: '#7C8B97',
      tones: [['#5B7C99', '#FFFFFF'], ['#A8C3B5', '#1F3A2E'], ['#E4C9A8', '#4A3418'], ['#C7B8D9', '#3A2A52'], ['#9DC4CE', '#14414D'], ['#E8B4B0', '#4F1D1A']], shape: ['#FFFFFF', '#334155'] },
    { id: 'vivid', label: 'زاهية', desc: 'ألوان مشرقة ومتباينة', bg: '#FFFDF5', link: '#374151',
      tones: [['#E11D48', '#FFFFFF'], ['#F97316', '#2B1100'], ['#EAB308', '#2B2200'], ['#16A34A', '#FFFFFF'], ['#0EA5E9', '#04202E'], ['#8B5CF6', '#FFFFFF']], shape: ['#FFFFFF', '#111827'] },
    { id: 'dark', label: 'داكنة', desc: 'خلفية داكنة وألوان مضيئة', bg: '#0F172A', link: '#94A3B8',
      tones: [['#38BDF8', '#06202E'], ['#A78BFA', '#1B1038'], ['#34D399', '#052E22'], ['#FBBF24', '#2B1D00'], ['#F472B6', '#35091F'], ['#94A3B8', '#0F172A']], shape: ['#1E293B', '#E2E8F0'] },
    { id: 'pro', label: 'احترافية', desc: 'أزرق ورمادي للعروض الرسمية', bg: '#FFFFFF', link: '#64748B',
      tones: [['#0F4C81', '#FFFFFF'], ['#2563EB', '#FFFFFF'], ['#0891B2', '#FFFFFF'], ['#475569', '#FFFFFF'], ['#0D9488', '#FFFFFF'], ['#7C3AED', '#FFFFFF']], shape: ['#F1F5F9', '#0F172A'] }
  ];
  CM.palette = function (id) { for (var i = 0; i < CM.PALETTES.length; i++) if (CM.PALETTES[i].id === id) return CM.PALETTES[i]; return CM.PALETTES[0]; };
  CM.roleTone = function (role) { return role === 'main' ? 0 : (role === 'sub' ? 1 : 3); };
  /* ألوان عقدة (role / tone / leaf) في مجموعة ألوان: { bg, fg, bc } */
  CM.nodeColors = function (palId, n) {
    var p = CM.palette(palId), t, s = p.shape;
    if (n.role === 'shape' && n.tone == null) return { bg: s[0], fg: s[1], bc: CM.shade(s[0], CM.lum(s[0]) < 0.4 ? 0.3 : -0.28) };
    var idx = n.tone != null ? n.tone : CM.roleTone(n.role); t = p.tones[((idx % p.tones.length) + p.tones.length) % p.tones.length];
    if (n.leaf) return { bg: s[0], fg: s[1], bc: t[0] };
    return { bg: t[0], fg: t[1], bc: CM.shade(t[0], CM.lum(t[0]) < 0.4 ? 0.3 : -0.28) };
  };
  CM.defaultTheme = function () { return { pal: 'platform', bgMode: 'auto', bgColor: '#FFFFFF', link: '' }; };
  CM.BG_MODES = ['auto', 'white', 'custom', 'transparent'];

  /* أنواع العناصر القابلة للإضافة (role: رئيسية / فرعية / مستقلة / شكل حر) */
  CM.PRESETS = {
    main: { role: 'main', shape: 'round', w: 210, h: 86, bg: '#7E22CE', fg: '#FFFFFF', fs: 22, text: 'العقدة الرئيسية', label: 'عقدة رئيسية' },
    sub: { role: 'sub', shape: 'round', w: 170, h: 66, bg: '#F59E0B', fg: '#1A1030', fs: 17, text: 'عقدة فرعية', label: 'عقدة فرعية' },
    free: { role: 'free', shape: 'round', w: 170, h: 66, bg: '#C4B5FD', fg: '#1A1030', fs: 17, text: 'عقدة مستقلة', label: 'عقدة مستقلة' },
    rect: { role: 'shape', shape: 'rect', w: 180, h: 72, bg: '#FFFFFF', fg: '#1A1030', fs: 17, text: 'مستطيل', label: 'مستطيل' },
    round: { role: 'shape', shape: 'round', w: 180, h: 72, bg: '#FFFFFF', fg: '#1A1030', fs: 17, text: 'مستطيل دائري', label: 'مستطيل بزوايا دائرية' },
    circle: { role: 'shape', shape: 'ellipse', w: 120, h: 120, bg: '#FFFFFF', fg: '#1A1030', fs: 17, text: 'دائرة', label: 'دائرة' },
    oval: { role: 'shape', shape: 'ellipse', w: 190, h: 110, bg: '#FFFFFF', fg: '#1A1030', fs: 17, text: 'بيضاوي', label: 'بيضاوي' }
  };

  /* ---- الروابط (المرحلة 2) ---- */
  CM.LINK_STYLES = [
    { id: 'straight', label: 'مستقيم' },
    { id: 'curve', label: 'منحني' },
    { id: 'elbow', label: 'متعامد' }
  ];
  /* arrow: none = خط بلا سهم، end = سهم عند العقدة الثانية، start = سهم عند العقدة الأولى، both = سهمان */
  CM.ARROWS = ['none', 'end', 'start', 'both'];
  CM.LINK_DEFAULT = { color: '', width: 2.5, style: 'curve', arrow: 'none' }; /* color فارغ = لون المنصة التلقائي */
  CM.LINK_WORDS = ['يتكون من', 'ينقسم إلى', 'يؤدي إلى', 'يرتبط بـ', 'يشمل', 'ينتج عنه', 'يتمثل في', 'يتضمن', 'يعتمد على', 'يسبب', 'مثل', 'يُعرَّف بأنه'];

  /* ==========================================================================
     CM.geo — هندسة الروابط (دوال نقية بلا DOM): تحسب المسار ورؤوس الأسهم ومنتصف الرابط من عقدتين
     تُعاد الحسابة كلما تحركت العقدة أو تغيّر حجمها، لذلك لا ينفصل الرابط عنها أبداً
     ========================================================================== */
  var G = CM.geo = {};
  function ctr(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }
  function unit(dx, dy) { var l = Math.sqrt(dx * dx + dy * dy); return l < 1e-6 ? { x: 1, y: 0 } : { x: dx / l, y: dy / l }; }
  function r1(v) { return Math.round(v * 100) / 100; }

  /* نقطة تقاطع الشعاع الخارج من مركز العقدة نحو (tx,ty) مع حدّها (مستطيل أو بيضاوي) */
  G.border = function (n, tx, ty) {
    var c = ctr(n), dx = tx - c.x, dy = ty - c.y;
    if (!dx && !dy) return { x: c.x, y: c.y };
    var hw = n.w / 2, hh = n.h / 2, t;
    if (n.shape === 'ellipse') t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
    else t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: c.x + dx * t, y: c.y + dy * t };
  };
  G.headLen = function (w) { return U.clamp(9 + w * 2.4, 12, 30); };

  /* مسار مضلّع بزوايا مدوّرة اختيارية */
  function poly(pts, rad) {
    var d = 'M' + r1(pts[0].x) + ' ' + r1(pts[0].y), i;
    for (i = 1; i < pts.length; i++) {
      if (rad > 0 && i < pts.length - 1) {
        var p = pts[i - 1], c = pts[i], n = pts[i + 1];
        var l1 = Math.hypot(c.x - p.x, c.y - p.y), l2 = Math.hypot(n.x - c.x, n.y - c.y), r = Math.min(rad, l1 / 2, l2 / 2);
        if (r > 0.5) {
          var a = unit(p.x - c.x, p.y - c.y), b = unit(n.x - c.x, n.y - c.y);
          d += 'L' + r1(c.x + a.x * r) + ' ' + r1(c.y + a.y * r) + 'Q' + r1(c.x) + ' ' + r1(c.y) + ' ' + r1(c.x + b.x * r) + ' ' + r1(c.y + b.y * r);
          continue;
        }
      }
      d += 'L' + r1(pts[i].x) + ' ' + r1(pts[i].y);
    }
    return d;
  }
  function headPts(tip, dir, L, W) {
    var px = -dir.y, py = dir.x, bx = tip.x - dir.x * L, by = tip.y - dir.y * L;
    return r1(tip.x) + ',' + r1(tip.y) + ' ' + r1(bx + px * W) + ',' + r1(by + py * W) + ' ' + r1(bx - px * W) + ',' + r1(by - py * W);
  }

  /* يعيد { d: مسار الخط، heads: [نقاط رؤوس الأسهم], mid: منتصف الرابط، p1, p2: نقطتا التماس مع العقدتين } */
  G.route = function (a, b, style, arrow, width) {
    var ac = ctr(a), bc = ctr(b), dx = bc.x - ac.x, dy = bc.y - ac.y, p1, p2, s0, e0, pts = null, bez = null, mid;
    var hs = arrow === 'start' || arrow === 'both', he = arrow === 'end' || arrow === 'both';
    if (style === 'straight') {
      p1 = G.border(a, bc.x, bc.y); p2 = G.border(b, ac.x, ac.y);
      var u = unit(p2.x - p1.x, p2.y - p1.y); s0 = u; e0 = u; pts = [p1, p2];
      mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    } else {
      var horiz = Math.abs(dx) / (a.w + b.w) >= Math.abs(dy) / (a.h + b.h), sg;
      if (horiz) {
        sg = dx < 0 ? -1 : 1;
        p1 = { x: dx < 0 ? a.x : a.x + a.w, y: ac.y }; p2 = { x: dx < 0 ? b.x + b.w : b.x, y: bc.y };
        s0 = { x: sg, y: 0 }; e0 = s0;
      } else {
        sg = dy < 0 ? -1 : 1;
        p1 = { x: ac.x, y: dy < 0 ? a.y : a.y + a.h }; p2 = { x: bc.x, y: dy < 0 ? b.y + b.h : b.y };
        s0 = { x: 0, y: sg }; e0 = s0;
      }
      var m = horiz ? { x: (p1.x + p2.x) / 2 } : { y: (p1.y + p2.y) / 2 };
      if (style === 'elbow') {
        pts = horiz ? [p1, { x: m.x, y: p1.y }, { x: m.x, y: p2.y }, p2] : [p1, { x: p1.x, y: m.y }, { x: p2.x, y: m.y }, p2];
        /* حذف النقاط المكررة (عند التحاذي) */
        pts = pts.filter(function (q, i) { return !i || Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) > 0.01; });
        if (pts.length < 2) pts = [p1, p2];
        /* منتصف الرابط على طول المسار */
        var tot = 0, i; for (i = 1; i < pts.length; i++) tot += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        var half = tot / 2; mid = pts[0];
        for (i = 1; i < pts.length; i++) {
          var sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          if (half <= sl || i === pts.length - 1) { var f = sl ? half / sl : 0; mid = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f }; break; }
          half -= sl;
        }
        var f0 = unit(pts[1].x - pts[0].x, pts[1].y - pts[0].y), l0 = unit(pts[pts.length - 1].x - pts[pts.length - 2].x, pts[pts.length - 1].y - pts[pts.length - 2].y);
        s0 = f0; e0 = l0;
      } else {
        var c1 = horiz ? { x: m.x, y: p1.y } : { x: p1.x, y: m.y }, c2 = horiz ? { x: m.x, y: p2.y } : { x: p2.x, y: m.y };
        bez = { p1: p1, c1: c1, c2: c2, p2: p2 };
        mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
      }
    }
    /* رؤوس الأسهم: تُقصَّر نهاية الخط كي لا يبرز تحت السهم */
    var chord = Math.hypot(p2.x - p1.x, p2.y - p1.y), L0 = G.headLen(width), n = (hs ? 1 : 0) + (he ? 1 : 0);
    var L = n ? Math.max(5, Math.min(L0, chord / (n + 0.6))) : 0, W = L * 0.42, heads = [];
    var q1 = { x: p1.x, y: p1.y }, q2 = { x: p2.x, y: p2.y };
    if (hs) { heads.push(headPts(p1, { x: -s0.x, y: -s0.y }, L, W)); q1 = { x: p1.x + s0.x * L * 0.85, y: p1.y + s0.y * L * 0.85 }; }
    if (he) { heads.push(headPts(p2, e0, L, W)); q2 = { x: p2.x - e0.x * L * 0.85, y: p2.y - e0.y * L * 0.85 }; }
    var d;
    if (bez) d = 'M' + r1(q1.x) + ' ' + r1(q1.y) + 'C' + r1(bez.c1.x) + ' ' + r1(bez.c1.y) + ' ' + r1(bez.c2.x) + ' ' + r1(bez.c2.y) + ' ' + r1(q2.x) + ' ' + r1(q2.y);
    else { var pp = pts.slice(); pp[0] = q1; pp[pp.length - 1] = q2; d = poly(pp, style === 'elbow' ? 12 : 0); }
    return { d: d, heads: heads, mid: mid, p1: p1, p2: p2 };
  };

  /* ==========================================================================
     Doc — مستند الخريطة
     الأحداث: node:add / node:update / node:remove / link:add / link:update / link:remove / select / view / meta / reset / history
     ========================================================================== */
  function Doc() {
    this.name = 'خريطة مفاهيمية جديدة';
    this.nodes = [];
    this.byId = {};
    this.links = [];
    this.linkById = {};
    this.sel = null;      /* العقدة المحدّدة إن كان المحدّد عقدة واحدة فقط (توافق مع المرحلة 1) */
    this.selN = [];       /* معرّفات العقد المحدّدة */
    this.selL = [];       /* معرّفات الروابط المحدّدة */
    this.view = { x: 0, y: 0, k: 1 };
    this.grid = true;
    this.z = 1;
    this.clip = null;     /* حافظة النسخ/اللصق الداخلية */
    this.theme = CM.defaultTheme(); /* المرحلة 3: مجموعة الألوان ومظهر مساحة العمل (تدخل في سجل التراجع) */
    this._h = {};
    this._tx = 0; this._lk = ''; this._lt = 0;
    this.hist = [this._snap()]; this.hi = 0;
  }
  CM.Doc = Doc;
  var P = Doc.prototype;

  P.on = function (ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
  P.emit = function (ev, a, b) { var l = this._h[ev]; if (!l) return; for (var i = 0; i < l.length; i++) l[i](a, b); };

  P.get = function (id) { return this.byId[id] || null; };
  P.children = function (id) { return this.nodes.filter(function (n) { return n.parent === id; }); };

  /* إضافة عقدة من نوع جاهز. pos = مركز العقدة بإحداثيات العالم. parentId للعقد الفرعية فقط */
  P.add = function (presetKey, pos, parentId) {
    var p = CM.PRESETS[presetKey]; if (!p) return null;
    var n = {
      id: U.uid(), role: p.role, shape: p.shape, w: p.w, h: p.h, bg: p.bg, fg: p.fg, fs: p.fs, ff: 'alex',
      text: p.text, desc: '', parent: null, z: ++this.z, x: 0, y: 0, locked: false, group: null,
      tone: null, leaf: false, bold: true, al: 'center', pad: 10, bw: 0, bc: '', br: null, op: 1
    };
    var pc = CM.nodeColors(this.theme.pal, n); n.bg = pc.bg; n.fg = pc.fg; n.bc = pc.bc;
    var par = parentId ? this.get(parentId) : null;
    if (par && p.role === 'sub') {
      n.parent = par.id;
      var c = this.children(par.id).length, step = n.h + 24, k = Math.ceil(c / 2), off = c === 0 ? 0 : (c % 2 ? 1 : -1) * k * step;
      if (pos) { n.x = pos.x - n.w / 2; n.y = pos.y - n.h / 2; }
      else { n.x = par.x - n.w - 90; n.y = par.y + par.h / 2 - n.h / 2 + off; }
    } else {
      n.x = (pos ? pos.x : 0) - n.w / 2;
      n.y = (pos ? pos.y : 0) - n.h / 2;
    }
    n.x = Math.round(n.x); n.y = Math.round(n.y);
    var self = this;
    this.tx('إضافة عقدة', function () {
      self.nodes.push(n); self.byId[n.id] = n;
      self.emit('node:add', n);
      /* العقدة الفرعية ترتبط بأبيها برابط حقيقي يمكن تعديله أو حذفه دون حذف العقد */
      if (n.parent) self.addLink(n.parent, n.id, { style: 'curve', arrow: 'none' });
    });
    return n;
  };

  P.update = function (id, patch) {
    var n = this.get(id); if (!n) return null;
    var L = CM.LIMITS;
    var blocked = n.locked && patch.locked !== false; /* العقدة المقفلة لا تتحرك ولا يتغير حجمها */
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (blocked && (k === 'x' || k === 'y' || k === 'w' || k === 'h')) continue;
      n[k] = patch[k];
    }
    n.w = U.clamp(Math.round(+n.w || L.minW), L.minW, L.maxW);
    n.h = U.clamp(Math.round(+n.h || L.minH), L.minH, L.maxH);
    n.fs = U.clamp(Math.round(+n.fs || 16), L.minFs, L.maxFs);
    if ('bw' in patch) n.bw = U.clamp(Math.round(+n.bw || 0), 0, L.maxBw);
    if ('pad' in patch) n.pad = U.clamp(Math.round(isNaN(+n.pad) ? 10 : +n.pad), L.minPad, L.maxPad);
    if ('br' in patch) n.br = (n.br === null || n.br === '' || isNaN(+n.br)) ? null : U.clamp(Math.round(+n.br), 0, L.maxBr);
    if ('op' in patch) n.op = U.clamp(isNaN(+n.op) ? 1 : +n.op, L.minOp, 1);
    if ('al' in patch && CM.ALIGNS.indexOf(n.al) < 0) n.al = 'center';
    if ('bold' in patch) n.bold = !!n.bold;
    if ('bc' in patch && !CM.isHex(n.bc)) n.bc = '';
    this.emit('node:update', n, patch);
    return n;
  };

  P.remove = function (id) {
    var n = this.get(id); if (!n) return false;
    var self = this;
    this.tx('حذف عقدة', function () {
      var kids = self.children(id);
      for (var i = 0; i < kids.length; i++) kids[i].parent = null; /* الفرعية تبقى مستقلة ولا تُحذف */
      self.links.filter(function (l) { return l.from === id || l.to === id; }).forEach(function (l) { self._dropLink(l); });
      self.nodes = self.nodes.filter(function (x) { return x.id !== id; });
      delete self.byId[id];
      self._gc();
      self._pruneSel();
      self.emit('node:remove', n, kids);
    });
    return true;
  };

  /* حذف مجموعة عقد وروابط دفعة واحدة (خطوة تراجع واحدة) */
  P.removeItems = function (nids, lids) {
    var self = this;
    this.tx('حذف المحدّد', function () {
      (lids || []).forEach(function (id) { self.removeLink(id); });
      (nids || []).forEach(function (id) { self.remove(id); });
    });
  };

  P.duplicate = function (id) {
    var c = this._collect([id]); if (!c) return null;
    var ids = this.paste(c);
    return ids.length ? this.get(ids[0]) : null;
  };
  P.duplicateMany = function (ids) { var c = this._collect(ids); return c ? this.paste(c) : []; };

  /* ---- النسخ واللصق: الحافظة تحمل العقد المنسوخة والروابط التي بين المنسوخ منها فقط ---- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  P._collect = function (ids) {
    var set = {}, self = this;
    (ids || []).forEach(function (id) { if (self.byId[id]) set[id] = 1; });
    var ns = this.nodes.filter(function (n) { return set[n.id]; }).sort(function (a, b) { return a.z - b.z; }).map(clone);
    if (!ns.length) return null;
    var ls = this.links.filter(function (l) { return set[l.from] && set[l.to]; }).map(clone), outer = [];
    ns.forEach(function (n) {
      if (!n.parent || set[n.parent] || !self.byId[n.parent]) return;
      var l = self.links.filter(function (x) { return (x.from === n.parent && x.to === n.id) || (x.from === n.id && x.to === n.parent); })[0];
      if (l) outer.push({ pid: n.parent, nid: n.id, link: clone(l) });
    });
    return { nodes: ns, links: ls, outer: outer, n: 0 };
  };
  P.copyItems = function (ids) { var c = this._collect(ids); if (c) this.clip = c; return !!c; };
  P.hasClip = function () { return !!(this.clip && this.clip.nodes.length); };
  /* يلصق محتوى الحافظة (أو محتوى c) مع إزاحة تزداد عند كل لصقة، ويعيد معرّفات العقد الجديدة */
  P.paste = function (c) {
    c = c || this.clip; if (!c || !c.nodes.length) return [];
    c.n = (c.n || 0) + 1;
    var off = 32 * c.n, map = {}, gmap = {}, made = [], self = this;
    this.tx('لصق', function () {
      c.nodes.forEach(function (o) {
        var n = clone(o); n.id = U.uid(); map[o.id] = n.id;
        n.x = o.x + off; n.y = o.y + off; n.z = ++self.z; n.locked = false;
        if (o.group) { gmap[o.group] = gmap[o.group] || U.uid('g'); n.group = gmap[o.group]; } else n.group = null;
        self.nodes.push(n); self.byId[n.id] = n; made.push(n.id);
      });
      made.forEach(function (id, i) {
        var n = self.byId[id], o = c.nodes[i];
        n.parent = o.parent && map[o.parent] ? map[o.parent] : null;
        if (!n.parent && o.parent && self.byId[o.parent] && c.outer.some(function (x) { return x.nid === o.id; })) n.parent = o.parent;
      });
      self._gc();
      made.forEach(function (id) { self.emit('node:add', self.byId[id]); });
      c.links.forEach(function (l) { self.addLink(map[l.from], map[l.to], l); });
      c.outer.forEach(function (x) {
        if (!self.byId[x.pid] || !map[x.nid]) return;
        var l = x.link, from = l.from === x.pid ? x.pid : map[x.nid], to = l.to === x.pid ? x.pid : map[x.nid];
        self.addLink(from, to, l);
      });
    });
    return made;
  };

  /* ==========================================================================
     الروابط: كل رابط يحمل معرّفَي العقدتين فقط، ويُحسب مساره من مواضع العقد وأحجامها عند كل رسم
     ========================================================================== */
  P.getLink = function (id) { return this.linkById[id] || null; };
  P.linksOf = function (nodeId) { return this.links.filter(function (l) { return l.from === nodeId || l.to === nodeId; }); };
  P.linkBetween = function (a, b) { return this.links.filter(function (l) { return (l.from === a && l.to === b) || (l.from === b && l.to === a); })[0] || null; };

  function cleanLink(o, base) {
    var D = CM.LINK_DEFAULT, L = CM.LIMITS, r = base || {};
    if ('arrow' in o) r.arrow = CM.ARROWS.indexOf(o.arrow) >= 0 ? o.arrow : (r.arrow || D.arrow);
    if ('style' in o) r.style = CM.LINK_STYLES.some(function (x) { return x.id === o.style; }) ? o.style : (r.style || D.style);
    if ('color' in o) r.color = /^#[0-9a-f]{3,8}$/i.test(o.color || '') ? o.color : '';
    if ('width' in o) r.width = U.clamp(Math.round((+o.width || D.width) * 2) / 2, L.minLw, L.maxLw);
    if ('label' in o) r.label = String(o.label == null ? '' : o.label).slice(0, 120);
    return r;
  }
  /* ينشئ رابطاً بين عقدتين (يرفض الربط بالنفس وتكرار رابط بين الزوج نفسه) */
  P.addLink = function (from, to, opts) {
    var a = this.get(from), b = this.get(to);
    if (!a || !b || a === b || this.linkBetween(from, to)) return null;
    var D = CM.LINK_DEFAULT, o = opts || {};
    var l = cleanLink({ arrow: o.arrow || D.arrow, style: o.style || D.style, color: o.color || D.color, width: o.width || D.width, label: o.label || '' }, { id: U.uid('l'), from: from, to: to });
    this.links.push(l); this.linkById[l.id] = l;
    this.emit('link:add', l);
    this.commit('ربط عقدتين');
    return l;
  };
  P.updateLink = function (id, patch) {
    var l = this.linkById[id]; if (!l) return null;
    cleanLink(patch, l);
    this.emit('link:update', l, patch);
    return l;
  };
  /* عكس اتجاه السهم (سهم نحو العقدة الأولى بدل الثانية وبالعكس) */
  P.reverseLink = function (id) {
    var l = this.linkById[id]; if (!l) return null;
    var m = { none: 'none', both: 'both', end: 'start', start: 'end' };
    this.updateLink(id, { arrow: m[l.arrow] });
    this.commit('عكس الاتجاه');
    return l;
  };
  P._dropLink = function (l) {
    var self = this;
    this.links = this.links.filter(function (x) { return x.id !== l.id; });
    delete this.linkById[l.id];
    [[l.from, l.to], [l.to, l.from]].forEach(function (p) { var c = self.get(p[0]); if (c && c.parent === p[1]) c.parent = null; });
    this.selL = this.selL.filter(function (x) { return x !== l.id; });
    this.emit('link:remove', l);
  };
  /* حذف الرابط وحده: العقدتان المرتبطتان به تبقيان كما هما */
  P.removeLink = function (id) {
    var l = this.linkById[id]; if (!l) return false;
    var was = this.selL.length;
    this._dropLink(l);
    if (was !== this.selL.length) this._emitSel();
    this.commit('حذف رابط');
    return true;
  };

  /* ==========================================================================
     التحديد: عقد متعددة + روابط. sel = العقدة الوحيدة المحدّدة (وإلا null)
     ========================================================================== */
  P._emitSel = function () { this.sel = (this.selN.length === 1 && !this.selL.length) ? this.selN[0] : null; this.emit('select', this.sel); };
  function same(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  P.setSel = function (nids, lids) {
    var self = this, seen = {};
    nids = (nids || []).filter(function (id) { if (seen[id] || !self.byId[id]) return false; seen[id] = 1; return true; });
    seen = {};
    lids = (lids || []).filter(function (id) { if (seen[id] || !self.linkById[id]) return false; seen[id] = 1; return true; });
    if (same(nids, this.selN) && same(lids, this.selL)) return;
    this.selN = nids; this.selL = lids; this._emitSel();
  };
  P._pruneSel = function () {
    var self = this;
    var a = this.selN.filter(function (id) { return self.byId[id]; }), b = this.selL.filter(function (id) { return self.linkById[id]; });
    if (!same(a, this.selN) || !same(b, this.selL)) { this.selN = a; this.selL = b; this._emitSel(); }
  };
  /* توافق المرحلة 1: select(id) يحدّد عقدة واحدة أو يلغي التحديد. (لم يعد التحديد يرفع العقدة للأمام: للترتيب أدوات صريحة) */
  P.select = function (id) { this.setSel(id && this.get(id) ? [id] : [], []); };
  P.selectLink = function (id) { this.setSel([], id && this.linkById[id] ? [id] : []); };
  P.clearSel = function () { this.setSel([], []); };
  P.isSel = function (id) { return this.selN.indexOf(id) >= 0; };
  P.toggleNodes = function (ids) {
    var cur = this.selN.slice(), on = ids.every(function (id) { return cur.indexOf(id) >= 0; });
    if (on) cur = cur.filter(function (id) { return ids.indexOf(id) < 0; });
    else ids.forEach(function (id) { if (cur.indexOf(id) < 0) cur.push(id); });
    this.setSel(cur, this.selL);
  };
  P.selectAll = function () {
    this.setSel(this.nodes.map(function (n) { return n.id; }), this.links.map(function (l) { return l.id; }));
  };
  P.selectedNodes = function () { var self = this; return this.selN.map(function (id) { return self.byId[id]; }).filter(Boolean); };

  /* ==========================================================================
     التجميع / القفل / الترتيب / المحاذاة / التوزيع
     ========================================================================== */
  P.membersOf = function (gid) { return gid ? this.nodes.filter(function (n) { return n.group === gid; }).map(function (n) { return n.id; }) : []; };
  /* يوسّع قائمة معرّفات لتشمل كل أعضاء المجموعات التي تنتمي إليها */
  P.expand = function (ids) {
    var self = this, out = [], seen = {};
    ids.forEach(function (id) {
      var n = self.byId[id]; if (!n) return;
      (n.group ? self.membersOf(n.group) : [id]).forEach(function (m) { if (!seen[m]) { seen[m] = 1; out.push(m); } });
    });
    return out;
  };
  /* أي مجموعة فيها أقل من عضوين تُحلّ تلقائياً */
  P._gc = function () {
    var cnt = {}, self = this;
    this.nodes.forEach(function (n) { if (n.group) cnt[n.group] = (cnt[n.group] || 0) + 1; });
    this.nodes.forEach(function (n) { if (n.group && cnt[n.group] < 2) { n.group = null; if (self.byId[n.id]) self.emit('node:update', n, { group: null }); } });
  };
  P.group = function (ids) {
    var self = this, ns = (ids || []).map(function (id) { return self.byId[id]; }).filter(Boolean);
    if (ns.length < 2) return null;
    var gid = U.uid('g');
    this.tx('تجميع', function () {
      ns.forEach(function (n) { n.group = gid; self.emit('node:update', n, { group: gid }); });
      self._gc();
    });
    return gid;
  };
  P.ungroup = function (ids) {
    var self = this, gs = {}, any = false;
    (ids || []).forEach(function (id) { var n = self.byId[id]; if (n && n.group) gs[n.group] = 1; });
    this.tx('فك التجميع', function () {
      self.nodes.forEach(function (n) { if (n.group && gs[n.group]) { n.group = null; any = true; self.emit('node:update', n, { group: null }); } });
    });
    return any;
  };
  P.setLocked = function (ids, on) {
    var self = this;
    this.tx(on ? 'قفل' : 'إلغاء القفل', function () {
      (ids || []).forEach(function (id) { var n = self.byId[id]; if (n && !!n.locked !== !!on) { n.locked = !!on; self.emit('node:update', n, { locked: !!on }); } });
    });
  };
  /* ترتيب الطبقات: front / back / up / down */
  P.arrange = function (ids, how) {
    var set = {}, self = this; (ids || []).forEach(function (id) { set[id] = 1; });
    var all = this.nodes.slice().sort(function (a, b) { return a.z - b.z; });
    if (!all.some(function (n) { return set[n.id]; })) return false;
    var out, i, t;
    if (how === 'front') out = all.filter(function (n) { return !set[n.id]; }).concat(all.filter(function (n) { return set[n.id]; }));
    else if (how === 'back') out = all.filter(function (n) { return set[n.id]; }).concat(all.filter(function (n) { return !set[n.id]; }));
    else {
      out = all.slice();
      if (how === 'up') { for (i = out.length - 2; i >= 0; i--) if (set[out[i].id] && !set[out[i + 1].id]) { t = out[i]; out[i] = out[i + 1]; out[i + 1] = t; } }
      else { for (i = 1; i < out.length; i++) if (set[out[i].id] && !set[out[i - 1].id]) { t = out[i]; out[i] = out[i - 1]; out[i - 1] = t; } }
    }
    this.tx('ترتيب الطبقات', function () {
      out.forEach(function (n, k) { if (n.z !== k + 1) { n.z = k + 1; self.emit('node:update', n, { z: n.z }); } });
      self.z = out.length + 1;
    });
    return true;
  };
  function nbounds(ns) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ns.forEach(function (n) { x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  P.boundsOf = function (ids) { var self = this, ns = (ids || []).map(function (id) { return self.byId[id]; }).filter(Boolean); return ns.length ? nbounds(ns) : null; };
  /* محاذاة: left / hcenter / right (أفقياً)، top / vcenter / bottom (عمودياً). المقفلة لا تتحرك */
  P.align = function (ids, how) {
    var self = this, ns = (ids || []).map(function (id) { return self.byId[id]; }).filter(Boolean);
    if (ns.length < 2) return false;
    var b = nbounds(ns);
    this.tx('محاذاة', function () {
      ns.forEach(function (n) {
        if (n.locked) return;
        var o = {};
        if (how === 'left') o.x = b.x; else if (how === 'right') o.x = b.x + b.w - n.w; else if (how === 'hcenter') o.x = b.x + (b.w - n.w) / 2;
        else if (how === 'top') o.y = b.y; else if (how === 'bottom') o.y = b.y + b.h - n.h; else if (how === 'vcenter') o.y = b.y + (b.h - n.h) / 2;
        if ('x' in o) o.x = Math.round(o.x); if ('y' in o) o.y = Math.round(o.y);
        self.update(n.id, o);
      });
    });
    return true;
  };
  /* توزيع بمسافات متساوية بين الحواف: axis = h | v (يلزم 3 عناصر فأكثر؛ الأول والأخير ثابتان) */
  P.distribute = function (ids, axis) {
    var self = this, ns = (ids || []).map(function (id) { return self.byId[id]; }).filter(Boolean);
    if (ns.length < 3) return false;
    var h = axis === 'h', P0 = h ? 'x' : 'y', S = h ? 'w' : 'h';
    ns.sort(function (a, b) { return (a[P0] + a[S] / 2) - (b[P0] + b[S] / 2); });
    var first = ns[0], last = ns[ns.length - 1], total = 0;
    ns.forEach(function (n) { total += n[S]; });
    var gap = ((last[P0] + last[S]) - first[P0] - total) / (ns.length - 1), pos = first[P0] + first[S] + gap;
    this.tx('توزيع', function () {
      for (var i = 1; i < ns.length - 1; i++) {
        var n = ns[i], o = {}; o[P0] = Math.round(pos);
        if (!n.locked) self.update(n.id, o);
        pos += n[S] + gap;
      }
    });
    return true;
  };
  /* تحريك عقد بمقدار ثابت (المقفلة تبقى مكانها) */
  P.moveBy = function (ids, dx, dy) {
    var self = this, moved = false;
    (ids || []).forEach(function (id) { var n = self.byId[id]; if (n && !n.locked) { self.update(id, { x: n.x + dx, y: n.y + dy }); moved = true; } });
    return moved;
  };

  /* ==========================================================================
     المرحلة 3: المظهر والتنسيق والقوالب
     ========================================================================== */
  function setThemePal(th, palId, withBg) {
    var p = CM.palette(palId); th.pal = p.id; th.link = p.link || '';
    if (withBg) { if (p.bg) { th.bgMode = 'custom'; th.bgColor = p.bg; } else th.bgMode = 'auto'; }
  }
  /* تغيير مظهر مساحة العمل: pal / bgMode / bgColor / link */
  P.setTheme = function (patch, key) {
    var t = this.theme;
    if ('bgMode' in patch && CM.BG_MODES.indexOf(patch.bgMode) >= 0) t.bgMode = patch.bgMode;
    if ('bgColor' in patch && CM.isHex(patch.bgColor)) { t.bgColor = CM.norm6(patch.bgColor); if (!('bgMode' in patch)) t.bgMode = 'custom'; }
    if ('link' in patch) t.link = patch.link === '' ? '' : (CM.isHex(patch.link) ? CM.norm6(patch.link) : t.link);
    this.emit('meta'); this.commit('تغيير مظهر مساحة العمل', key || '');
  };
  /* تطبيق مجموعة ألوان كاملة على كل العقد والروابط (وخلفية العمل اختيارياً) في خطوة تراجع واحدة */
  P.applyPalette = function (palId, withBg) {
    var self = this;
    this.tx('تطبيق مجموعة ألوان', function () {
      setThemePal(self.theme, palId, withBg !== false);
      self.nodes.forEach(function (n) {
        var c = CM.nodeColors(self.theme.pal, n), o = { bg: c.bg, fg: c.fg, bc: c.bc };
        if (n.leaf && !(n.bw > 0)) o.bw = 2;
        self.update(n.id, o);
      });
      self.links.forEach(function (l) { l.color = ''; self.emit('link:update', l, { color: '' }); });
      self.emit('meta');
    });
  };
  /* تنسيق مجموعة عقد (لون/خط/حدود/استدارة/شفافية/محاذاة/مسافات). key يدمج التعديلات المتتالية في خطوة واحدة */
  P.styleNodes = function (ids, patch, key) {
    var self = this, any = false;
    (ids || []).forEach(function (id) { if (self.byId[id]) { self.update(id, patch); any = true; } });
    if (any) this.commit('تنسيق العقد', key || '');
    return any;
  };
  /* لون الروابط/الأسهم: لروابط محدّدة، أو لكل الروابط (مع تلقائي = لون المجموعة الحالية) */
  P.setLinkColor = function (color, ids) {
    var self = this, c = color === '' ? '' : CM.norm6(color);
    if (color !== '' && !c) return false;
    if (ids && ids.length) ids.forEach(function (id) { self.updateLink(id, { color: c }); });
    else {
      this.links.forEach(function (l) { l.color = ''; self.emit('link:update', l, { color: '' }); });
      this.theme.link = c || (CM.palette(this.theme.pal).link || '');
      this.emit('meta');
    }
    this.commit('لون الأسهم', 'linkcolor');
    return true;
  };

  /* يبني عقداً وروابط حقيقية من وصف قالب {nodes:[{k,x,y,...}], links:[{a,b,...}]} (x,y = مركز العقدة) دون لمس المستند */
  CM.materialize = function (spec, palId) {
    var nodes = [], links = [], map = {}, z = 1;
    (spec.nodes || []).forEach(function (s) {
      var role = s.role || 'sub', pre = CM.PRESETS[role === 'shape' ? 'rect' : role] || CM.PRESETS.sub, w = s.w || pre.w, h = s.h || pre.h;
      var n = { id: U.uid(), role: role, shape: s.shape || pre.shape, w: w, h: h, bg: '', fg: '', fs: s.fs || pre.fs, ff: 'alex',
        text: s.text || '', desc: s.desc || '', parent: null, z: ++z, x: Math.round(s.x - w / 2), y: Math.round(s.y - h / 2), locked: false, group: null,
        tone: s.tone == null ? null : s.tone, leaf: !!s.leaf, bold: true, al: 'center', pad: 10, bw: 0, bc: '', br: null, op: 1 };
      var c = CM.nodeColors(palId, n); n.bg = c.bg; n.fg = c.fg; n.bc = c.bc; if (n.leaf) n.bw = 2;
      map[s.k] = n.id; nodes.push(n);
    });
    nodes.forEach(function (n, i) { var p = spec.nodes[i].parent; if (p && map[p]) n.parent = map[p]; });
    (spec.links || []).forEach(function (l) {
      if (!map[l.a] || !map[l.b] || map[l.a] === map[l.b]) return;
      links.push(cleanLink({ arrow: l.arrow || 'none', style: l.style || 'curve', color: '', width: l.width || 2.5, label: l.label || '' }, { id: U.uid('l'), from: map[l.a], to: map[l.b] }));
    });
    return { nodes: nodes, links: links, z: z + 1 };
  };
  /* يستبدل محتوى الخريطة بقالب (خطوة تراجع واحدة). palId اختياري: مجموعة ألوان جديدة تُطبَّق مع خلفيتها */
  P.loadSpec = function (spec, label, palId) {
    var self = this;
    this.tx(label || 'إنشاء من قالب', function () {
      if (palId && CM.palette(palId).id === palId && palId !== self.theme.pal) setThemePal(self.theme, palId, true);
      var m = CM.materialize(spec, self.theme.pal);
      self.nodes = m.nodes; self.links = m.links; self.z = m.z; self.byId = {}; self.linkById = {};
      self.nodes.forEach(function (n) { self.byId[n.id] = n; });
      self.links.forEach(function (l) { self.linkById[l.id] = l; });
      self.selN = []; self.selL = []; self._lk = ''; self._lt = 0;
      self.emit('reset'); self.emit('meta'); self._emitSel();
    });
  };

  /* ==========================================================================
     السجل: تراجع / إعادة (لقطات كاملة للعقد والروابط)
     ========================================================================== */
  P._snap = function () { return JSON.stringify({ n: this.nodes, l: this.links, z: this.z, t: this.theme }); };
  P.commit = function (label, key) {
    if (this._tx) return;
    var s = this._snap(); if (s === this.hist[this.hi]) { this._lt = Date.now(); return; }
    var now = Date.now();
    if (key && key === this._lk && now - this._lt < 1200 && this.hi > 0) {
      this.hist[this.hi] = s;
      if (this.hist[this.hi - 1] === s) { this.hist.length = this.hi; this.hi--; }
    } else {
      this.hist.length = this.hi + 1; this.hist.push(s);
      if (this.hist.length > CM.LIMITS.hist) this.hist.shift();
      this.hi = this.hist.length - 1;
    }
    this._lk = key || ''; this._lt = now; this.hlabel = label || '';
    this.emit('history');
  };
  /* ينفّذ fn كعملية واحدة تُسجَّل خطوةً واحدة في السجل */
  P.tx = function (label, fn) {
    this._tx++;
    try { fn.call(this); } finally { this._tx--; }
    if (!this._tx) this.commit(label);
  };
  P.canUndo = function () { return this.hi > 0; };
  P.canRedo = function () { return this.hi < this.hist.length - 1; };
  P.undo = function () { if (!this.canUndo()) return false; this.hi--; this._restore(this.hist[this.hi]); return true; };
  P.redo = function () { if (!this.canRedo()) return false; this.hi++; this._restore(this.hist[this.hi]); return true; };
  P._restore = function (s) {
    var o = JSON.parse(s), self = this;
    this.nodes = o.n; this.links = o.l; this.z = o.z; this.byId = {}; this.linkById = {};
    this.theme = o.t || CM.defaultTheme();
    this.nodes.forEach(function (n) { self.byId[n.id] = n; });
    this.links.forEach(function (l) { self.linkById[l.id] = l; });
    this._lk = ''; this._lt = 0;
    this.selN = this.selN.filter(function (id) { return self.byId[id]; });
    this.selL = this.selL.filter(function (id) { return self.linkById[id]; });
    this.sel = (this.selN.length === 1 && !this.selL.length) ? this.selN[0] : null;
    this.emit('reset'); this.emit('meta'); this.emit('select', this.sel); this.emit('history');
  };

  /* ---- البحث: يعيد [{type:'node'|'link', id}] للعناصر التي يحوي نصها الاستعلام ---- */
  P.find = function (q) {
    q = U.norm(q); if (!q) return [];
    var r = [];
    this.nodes.forEach(function (n) { if (U.norm(n.text + ' ' + n.desc).indexOf(q) >= 0) r.push({ type: 'node', id: n.id }); });
    this.links.forEach(function (l) { if (l.label && U.norm(l.label).indexOf(q) >= 0) r.push({ type: 'link', id: l.id }); });
    return r;
  };

  P.setView = function (v) {
    var L = CM.LIMITS;
    this.view.k = U.clamp(v.k, L.minK, L.maxK);
    this.view.x = v.x; this.view.y = v.y;
    this.emit('view', this.view);
  };

  P.setName = function (t) { this.name = t; this.emit('meta'); };
  P.setGrid = function (on) { this.grid = !!on; this.emit('meta'); };

  /* حدود كل العقد بإحداثيات العالم (أو null إن كانت الخريطة فارغة) */
  P.bounds = function () {
    if (!this.nodes.length) return null;
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    this.nodes.forEach(function (n) {
      if (n.x < x1) x1 = n.x; if (n.y < y1) y1 = n.y;
      if (n.x + n.w > x2) x2 = n.x + n.w; if (n.y + n.h > y2) y2 = n.y + n.h;
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
})();
