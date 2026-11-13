/* ==========================================================================
   cmap-export.js — «منشئ الخرائط المفاهيمية» (المرحلة 5): تصدير PNG وPDF والطباعة
   - تُرسم الخريطة من بيانات المستند مباشرة على Canvas (لا لقطة شاشة)، فلا تظهر أي أدوات من المحرر
   - النصوص العربية تُرسم بحرف المتصفح نفسه (تشكيل وRTL)، والألوان والخطوط والأسهم كما في المحرر
   - PDF: ملف يُكتب يدوياً (بلا مكتبات): صورة غير مفقودة الجودة (Flate) داخل صفحة A4/A3 مع ملاءمة كاملة بلا اقتطاع
   - الطباعة: عبر iframe مخفي فيه الخريطة فقط (لا تتأثر بقواعد الطباعة في بقية المنصة)
   - لا إنترنت ولا مكتبات خارجية ولا خدمات: يعمل دون اتصال بالكامل
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM; if (!CM || !CM.geo || !CM.Doc) return;
  var U = CM.u, esc = U.esc;
  var EXP = CM.exp = {};

  var PAPER = { A4: [595.276, 841.89], A3: [841.89, 1190.551] };
  var MARGIN_MM = 10, MM = 72 / 25.4;
  function userErr(m) { var e = new Error(m); e.user = true; return e; }
  function coarse() { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } }
  function maxPixels() { return coarse() ? 12e6 : 36e6; }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ======================================================================
     1) القياس والرسم
     ====================================================================== */
  var mcv = null;
  function mctx() { if (!mcv) mcv = document.createElement('canvas').getContext('2d'); return mcv; }
  function fontOf(n) { var id = n.ff, i; for (i = 0; i < CM.FONTS.length; i++) if (CM.FONTS[i].id === id) return CM.FONTS[i]; return CM.FONTS[0]; }
  var LBL = { fs: 14, lh: 21, padX: 10, padY: 2, bw: 1.5, maxW: 240, r: 9 };
  function lblFont() { return '600 ' + LBL.fs + 'px ' + CM.FONTS[0].css; }

  /* اتجاه الفقرة بحسب أول حرف قوي (كما يفعل unicode-bidi:plaintext في المحرر) */
  var RE_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/, RE_LTR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
  function dirOf(s) {
    for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (RE_RTL.test(c)) return 'rtl'; if (RE_LTR.test(c)) return 'ltr'; }
    return 'rtl';
  }
  /* التفاف نص بعرض أقصى (يحترم الأسطر الجديدة ويكسر الكلمة الطويلة عند الحاجة) */
  function wrap(ctx, text, maxW) {
    var out = [], paras = String(text == null ? '' : text).replace(/\n+$/, '').split('\n');
    paras.forEach(function (p) {
      if (p === '') { out.push({ t: '', d: 'rtl' }); return; }
      var d = dirOf(p), words = p.split(' '), line = '';
      function flush() { out.push({ t: line, d: d }); line = ''; }
      words.forEach(function (w) {
        var trial = line ? line + ' ' + w : w;
        if (ctx.measureText(trial).width <= maxW || !line && ctx.measureText(w).width <= maxW) { line = trial; return; }
        if (line) { flush(); }
        if (ctx.measureText(w).width <= maxW) { line = w; return; }
        var chars = Array.from(w), cur = '';
        chars.forEach(function (ch) {
          if (cur && ctx.measureText(cur + ch).width > maxW) { out.push({ t: cur, d: d }); cur = ch; } else cur += ch;
        });
        line = cur;
      });
      flush();
    });
    if (out.length === 1 && out[0].t === '') return [];
    return out;
  }
  var metrics = {};
  function baseline(ctx, top, lh) {
    var k = ctx.font, m = metrics[k];
    if (!m) { var t = ctx.measureText('Hg'); m = metrics[k] = { a: t.fontBoundingBoxAscent, d: t.fontBoundingBoxDescent }; }
    if (typeof m.a === 'number' && typeof m.d === 'number') { ctx.textBaseline = 'alphabetic'; return top + (lh - (m.a + m.d)) / 2 + m.a; }
    ctx.textBaseline = 'middle'; return top + lh / 2;
  }
  function putLine(ctx, line, x, w, top, lh, al) {
    ctx.direction = line.d;
    ctx.textAlign = al === 'right' ? 'right' : (al === 'left' ? 'left' : 'center');
    var ax = al === 'right' ? x + w : (al === 'left' ? x : x + w / 2);
    ctx.fillText(line.t, ax, baseline(ctx, top, lh));
  }

  function labelLayout(ctx, l, mid) {
    ctx.font = lblFont();
    var lines = wrap(ctx, l.label, LBL.maxW - LBL.padX * 2 - LBL.bw * 2), tw = 0;
    if (!lines.length) lines = [{ t: '', d: 'rtl' }];
    lines.forEach(function (ln) { tw = Math.max(tw, ctx.measureText(ln.t).width); });
    var w = Math.min(LBL.maxW, Math.ceil(tw) + LBL.padX * 2 + LBL.bw * 2), h = lines.length * LBL.lh + LBL.padY * 2 + LBL.bw * 2;
    return { lines: lines, w: w, h: h, x: mid.x - w / 2, y: mid.y - h / 2 };
  }
  function linkGeo(doc) {
    var ctx = mctx(), out = [];
    doc.links.forEach(function (l) {
      var a = doc.get(l.from), b = doc.get(l.to); if (!a || !b) return;
      var r = CM.geo.route(a, b, l.style, l.arrow, l.width), lab = l.label ? labelLayout(ctx, l, r.mid) : null;
      out.push({ l: l, r: r, lab: lab });
    });
    return out;
  }

  /* حدود المحتوى: كل العقد + مربعات نصوص الروابط */
  EXP.contentBounds = function (doc, lg) {
    if (!doc.nodes.length) return null;
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    doc.nodes.forEach(function (n) { x1 = Math.min(x1, n.x - 4); y1 = Math.min(y1, n.y - 4); x2 = Math.max(x2, n.x + n.w + 4); y2 = Math.max(y2, n.y + n.h + 8); });
    (lg || linkGeo(doc)).forEach(function (g) { if (g.lab) { x1 = Math.min(x1, g.lab.x); y1 = Math.min(y1, g.lab.y); x2 = Math.max(x2, g.lab.x + g.lab.w); y2 = Math.max(y2, g.lab.y + g.lab.h); } });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  /* منطقة التصدير بإحداثيات العالم: all = الخريطة كاملة بهامش، view = الجزء الظاهر الآن في مساحة العمل */
  EXP.region = function (doc, scope, canvasEl, margin) {
    if (scope === 'view' && canvasEl) {
      var r = canvasEl.getBoundingClientRect(), v = doc.view;
      if (r.width > 0 && r.height > 0) return { x: -v.x / v.k, y: -v.y / v.k, w: r.width / v.k, h: r.height / v.k };
    }
    var b = EXP.contentBounds(doc); if (!b) return null;
    var m = margin == null ? 40 : margin;
    return { x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 };
  };

  function rrPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function shapePath(ctx, n, inset) {
    var x = n.x + inset, y = n.y + inset, w = n.w - inset * 2, h = n.h - inset * 2;
    if (n.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2); ctx.closePath(); }
    else rrPath(ctx, x, y, w, h, (n.br != null ? n.br : (n.shape === 'round' ? 16 : 3)) - inset);
  }

  function nodeText(ctx, n) {
    var f = fontOf(n), bw = n.bw || 0, pad = n.pad == null ? 10 : n.pad;
    var padX = n.shape === 'ellipse' ? Math.max(pad, Math.round(n.w * 0.16)) : pad;
    var cx = n.x + bw + padX, cw = Math.max(4, n.w - bw * 2 - padX * 2), top = n.y + bw + pad, ih = n.h - bw * 2 - pad * 2;
    var fs = n.fs, tl = fs * 1.45, dfs = fs * 0.74, dl = dfs * 1.5, al = n.al || 'center';
    var tfont = (n.bold === false ? 400 : 700) + ' ' + fs + 'px ' + f.css, dfont = '400 ' + dfs + 'px ' + f.css;
    ctx.font = tfont; var tls = wrap(ctx, n.text, cw);
    ctx.font = dfont; var dls = n.desc ? wrap(ctx, n.desc, cw) : [];
    var H = tls.length * tl + (dls.length ? 3 + dls.length * dl : 0), y = top + (ih - H) / 2;
    ctx.save(); shapePath(ctx, n, bw); ctx.clip();
    ctx.fillStyle = n.fg;
    ctx.font = tfont; tls.forEach(function (ln, i) { putLine(ctx, ln, cx, cw, y + i * tl, tl, al); });
    if (dls.length) {
      ctx.font = dfont; ctx.globalAlpha = 0.88;
      dls.forEach(function (ln, i) { putLine(ctx, ln, cx, cw, y + tls.length * tl + 3 + i * dl, dl, al); });
    }
    ctx.restore();
  }

  function drawNode(ctx, n) {
    var op = n.op == null ? 1 : n.op, bw = n.bw || 0;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 10 * ctx.__s; ctx.shadowOffsetY = 3 * ctx.__s;
    shapePath(ctx, n, 0); ctx.fillStyle = op < 1 ? CM.rgba(n.bg, op) : n.bg; ctx.fill();
    ctx.restore();
    ctx.save(); shapePath(ctx, n, 0.75); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.stroke(); ctx.restore();
    if (bw > 0) { ctx.save(); shapePath(ctx, n, bw / 2); ctx.lineWidth = bw; ctx.strokeStyle = CM.isHex(n.bc) ? n.bc : n.fg; ctx.stroke(); ctx.restore(); }
    nodeText(ctx, n);
  }

  function themeBg(doc) {
    var t = doc.theme || {};
    return t.bgMode === 'custom' && CM.isHex(t.bgColor) ? t.bgColor : '#FFFFFF';
  }
  /* يرسم المنطقة rect بمقياس s على سياق ctx (الحجم الكامل للـ canvas) */
  function paint(ctx, doc, rect, s, bg, lg) {
    var W = Math.ceil(rect.w * s), H = Math.ceil(rect.h * s), fill = null;
    if (bg === 'white') fill = '#FFFFFF'; else if (bg === 'workspace') fill = themeBg(doc);
    var pill = fill || '#FFFFFF', ink = CM.lum(pill) < 0.5 ? '#F1F5F9' : '#1A1030';
    ctx.save();
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H); }
    ctx.scale(s, s); ctx.translate(-rect.x, -rect.y); ctx.__s = s;
    var th = doc.theme || CM.defaultTheme(), pal = CM.palette(th.pal), base = th.link || pal.link || '#7E22CE';
    lg.forEach(function (g) {
      var l = g.l, col = l.color || base;
      ctx.lineWidth = l.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.stroke(new Path2D(g.r.d));
      g.r.heads.forEach(function (h) { ctx.fill(new Path2D('M' + h.split(' ').join('L') + 'Z')); });
    });
    doc.nodes.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (n) { drawNode(ctx, n); });
    lg.forEach(function (g) {
      var b = g.lab; if (!b) return;
      var col = g.l.color || base;
      rrPath(ctx, b.x, b.y, b.w, b.h, LBL.r); ctx.fillStyle = pill; ctx.fill();
      rrPath(ctx, b.x + LBL.bw / 2, b.y + LBL.bw / 2, b.w - LBL.bw, b.h - LBL.bw, LBL.r - LBL.bw / 2); ctx.lineWidth = LBL.bw; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = ink; ctx.font = lblFont();
      var cx = b.x + LBL.bw + LBL.padX, cw = b.w - (LBL.bw + LBL.padX) * 2;
      b.lines.forEach(function (ln, i) { putLine(ctx, ln, cx, cw, b.y + LBL.bw + LBL.padY + i * LBL.lh, LBL.lh, 'center'); });
    });
    ctx.restore();
  }

  function ensureFonts(doc) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var seen = {}, ps = [];
    doc.nodes.forEach(function (n) { seen[fontOf(n).id] = fontOf(n); }); seen.base = CM.FONTS[0];
    Object.keys(seen).forEach(function (k) {
      ['700', '400', '600'].forEach(function (w) { ps.push(document.fonts.load(w + ' 20px ' + seen[k].css, 'عأبAa').catch(function () { return 0; })); });
    });
    return Promise.race([Promise.all(ps), delay(2500)]);
  }
  /* أكبر مقياس مسموح لا يتجاوز حد البكسلات (يحمي ذاكرة الهاتف) */
  EXP.fitScale = function (w, h, want, maxPx) {
    var cap = Math.sqrt((maxPx || maxPixels()) / Math.max(1, w * h)), s = Math.min(want, cap);
    return { s: s, reduced: s < want - 1e-6 };
  };
  /* يرسم المنطقة ويعيد canvas */
  EXP.renderCanvas = function (doc, rect, s, bg) {
    var W = Math.max(1, Math.ceil(rect.w * s)), H = Math.max(1, Math.ceil(rect.h * s));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    if (!ctx) throw userErr('تعذّر إنشاء لوحة الرسم في هذا المتصفح.');
    paint(ctx, doc, rect, s, bg, linkGeo(doc));
    return c;
  };

  /* ======================================================================
     2) PNG
     ====================================================================== */
  function toBlob(c, type, q) {
    return new Promise(function (res, rej) {
      try { c.toBlob(function (b) { b ? res(b) : rej(userErr('تعذّر إنشاء الصورة. جرّب دقة أقل.')); }, type, q); } catch (e) { rej(userErr('تعذّر إنشاء الصورة. جرّب دقة أقل.')); }
    });
  }

  /* ======================================================================
     3) PDF يدوي (بلا مكتبات): صفحة واحدة تحوي صورة الخريطة مُلاءَمة بالكامل
     ====================================================================== */
  var enc = new TextEncoder();
  function hex16(s) { var h = 'FEFF', i, c; for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); h += ('0000' + c.toString(16)).slice(-4); } return '<' + h.toUpperCase() + '>'; }
  function deflate(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try { return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
    catch (e) { return Promise.resolve(null); }
  }
  /* الصفحة: paper + orient → [العرض, الارتفاع] بالنقاط (1 نقطة = 1/72 بوصة) */
  EXP.page = function (paper, orient, w, h) {
    var p = PAPER[paper] || PAPER.A4, land = orient === 'landscape' || (orient !== 'portrait' && w >= h);
    return land ? { w: p[1], h: p[0], land: true } : { w: p[0], h: p[1], land: false };
  };
  /* مكان الخريطة داخل منطقة الطباعة (هامش 10مم) محافظاً على النسبة وبلا اقتطاع */
  EXP.place = function (pg, w, h) {
    var m = MARGIN_MM * MM, bw = pg.w - m * 2, bh = pg.h - m * 2, k = Math.min(bw / w, bh / h);
    var pw = w * k, ph = h * k;
    return { x: (pg.w - pw) / 2, y: (pg.h - ph) / 2, w: pw, h: ph, k: k };
  };
  function r3(v) { return Math.round(v * 1000) / 1000; }
  EXP.pdfFromCanvas = async function (cv, paper, orient, title) {
    var W = cv.width, H = cv.height, pg = EXP.page(paper, orient, W, H), pl = EXP.place(pg, W, H);
    var data = null, filter, body;
    try {
      var id = cv.getContext('2d').getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3), i, j;
      for (i = 0, j = 0; i < id.length; i += 4, j += 3) { rgb[j] = id[i]; rgb[j + 1] = id[i + 1]; rgb[j + 2] = id[i + 2]; }
      data = await deflate(rgb);
      if (data) { filter = '/Filter /FlateDecode'; body = data; }
    } catch (e) { data = null; }
    if (!data) {
      var jb = await toBlob(cv, 'image/jpeg', 0.95);
      body = new Uint8Array(await jb.arrayBuffer()); filter = '/Filter /DCTDecode';
    }
    var parts = [], len = 0, offs = [];
    function push(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; }
    function obj(n, s) { offs[n] = len; push(n + ' 0 obj\n' + s + '\nendobj\n'); }
    push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + r3(pg.w) + ' ' + r3(pg.h) + '] /Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 4 0 R >>');
    var cs = 'q ' + r3(pl.w) + ' 0 0 ' + r3(pl.h) + ' ' + r3(pl.x) + ' ' + r3(pl.y) + ' cm /Im0 Do Q';
    obj(4, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    offs[5] = len; push('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + W + ' /Height ' + H + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 ' + filter + ' /Length ' + body.length + ' >>\nstream\n');
    push(body); push('\nendstream\nendobj\n');
    obj(6, '<< /Title ' + hex16(String(title || 'خريطة مفاهيمية')) + ' /Producer (Concept Map Builder) /Creator (Concept Map Builder) >>');
    var xref = len, x = 'xref\n0 7\n0000000000 65535 f \n', k;
    for (k = 1; k <= 6; k++) x += ('0000000000' + offs[k]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return { blob: new Blob(parts, { type: 'application/pdf' }), page: pg, place: pl, flate: !!data };
  };

  /* ======================================================================
     4) الطباعة: صفحة HTML مستقلة (الخريطة فقط) تُطبع من iframe مخفي
     ====================================================================== */
  EXP.printHTML = function (url, paper, orient, w, h, title) {
    var pg = EXP.page(paper, orient, w, h), pwmm = Math.round(pg.w / MM), phmm = Math.round(pg.h / MM);
    var bw = pwmm - MARGIN_MM * 2, bh = phmm - MARGIN_MM * 2 - 1;
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title || 'خريطة مفاهيمية') + '</title><style>' +
      '@page{size:' + paper + ' ' + (pg.land ? 'landscape' : 'portrait') + ';margin:' + MARGIN_MM + 'mm}' +
      'html,body{margin:0;padding:0;background:#fff}' +
      '.cm-pp{width:' + bw + 'mm;height:' + bh + 'mm;display:flex;align-items:center;justify-content:center;overflow:hidden;break-inside:avoid;page-break-inside:avoid}' +
      '.cm-pp img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '</style></head><body><div class="cm-pp"><img id="m" alt="' + esc(title || 'خريطة مفاهيمية') + '" src="' + url + '"></div></body></html>';
  };
  function printFrame(html, url) {
    return new Promise(function (resolve, reject) {
      var old = document.getElementById('cmPrintFrame'); if (old) old.remove();
      var f = document.createElement('iframe'), fired = false;
      f.id = 'cmPrintFrame'; f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1'); f.title = 'طباعة الخريطة';
      f.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:700px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(f);
      function clean() { setTimeout(function () { if (f.parentNode) f.remove(); URL.revokeObjectURL(url); }, 800); }
      function fire() {
        if (fired) return; fired = true;
        var d = f.contentDocument, im = d && d.getElementById('m');
        function go() {
          try { var w = f.contentWindow; w.focus(); w.onafterprint = clean; w.print(); setTimeout(function () { if (f.parentNode) { f.remove(); URL.revokeObjectURL(url); } }, 180000); resolve(true); }
          catch (e) { clean(); reject(userErr('تعذّر فتح نافذة الطباعة في هذا المتصفح. جرّب «تنزيل PDF» ثم اطبعه.')); }
        }
        if (im && im.decode) im.decode().then(go, go); else go();
      }
      try { var d = f.contentDocument; d.open(); d.write(html); d.close(); } catch (e) { f.remove(); reject(userErr('تعذّر تجهيز الطباعة في هذا المتصفح.')); return; }
      f.onload = function () { setTimeout(fire, 100); };
      setTimeout(fire, 900);
    });
  }

  /* ======================================================================
     5) واجهة واحدة لكل شيء: make(opts) → ملف جاهز (أو طباعة)
     opts: { fmt: png|pdf|print, scope: all|view, bg: white|transparent|workspace, scale (png), paper, orient, dpi }
     ====================================================================== */
  function baseName(doc) { return String(doc.name || 'خريطة').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'خريطة'; }
  EXP.make = async function (doc, canvasEl, o) {
    var fmt = o.fmt || 'png';
    if (!doc.nodes.length) throw userErr('الخريطة فارغة: أضف عقداً أولاً ثم صدّرها.');
    await ensureFonts(doc);
    var rect = EXP.region(doc, o.scope || 'all', canvasEl, 40);
    if (!rect) throw userErr('الخريطة فارغة: أضف عقداً أولاً ثم صدّرها.');
    var bg = o.bg || 'white'; if (fmt !== 'png' && bg === 'transparent') bg = 'white';
    var name = baseName(doc), s, red, c;
    if (fmt === 'png') {
      var fs = EXP.fitScale(rect.w, rect.h, o.scale || 2); s = fs.s; red = fs.reduced;
      c = EXP.renderCanvas(doc, rect, s, bg);
      return { blob: await toBlob(c, 'image/png'), name: name + '.png', width: c.width, height: c.height, scale: s, reduced: red, type: 'png' };
    }
    var pg = EXP.page(o.paper || 'A4', o.orient || 'auto', rect.w, rect.h), pl = EXP.place(pg, rect.w, rect.h);
    var dpi = fmt === 'print' ? 200 : (o.dpi || 200), want = (pl.w / 72 * dpi) / rect.w;
    var f2 = EXP.fitScale(rect.w, rect.h, want, Math.min(maxPixels(), 24e6)); s = f2.s; red = f2.reduced;
    c = EXP.renderCanvas(doc, rect, s, bg);
    if (fmt === 'pdf') {
      var r = await EXP.pdfFromCanvas(c, o.paper || 'A4', o.orient || 'auto', doc.name);
      return { blob: r.blob, name: name + '.pdf', width: c.width, height: c.height, scale: s, reduced: red, type: 'pdf', page: r.page, place: r.place, flate: r.flate };
    }
    var pb = await toBlob(c, 'image/png'), url = URL.createObjectURL(pb);
    return { html: EXP.printHTML(url, o.paper || 'A4', o.orient || 'auto', c.width, c.height, doc.name), url: url, width: c.width, height: c.height, scale: s, reduced: red, type: 'print' };
  };
  EXP.print = function (made) { return printFrame(made.html, made.url); };
  EXP.save = function (blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(u); }, 5000);
  };

  /* ======================================================================
     6) نافذة «تصدير وطباعة» داخل المحرر
     ====================================================================== */
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var IC = {
    exp: ic('<path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h14"/><path d="M19 12v9"/>'),
    close: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    print: ic('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>')
  };
  function seg(key, items) {
    var h = '<div class="cm-seg cm-seg2" role="group" data-xk="' + key + '">';
    items.forEach(function (o) { h += '<button type="button" data-xv="' + o.v + '" aria-pressed="false"' + (o.title ? ' title="' + esc(o.title) + '"' : '') + '><small>' + o.t + '</small></button>'; });
    return h + '</div>';
  }
  function row(cls, label, inner) { return '<div class="cm-f cm-xr ' + cls + '"><span>' + label + '</span>' + inner + '</div>'; }

  CM.ext = CM.ext || [];
  CM.ext.push(function (api, doc) {
    var rootEl = api.root;
    function $(s, r) { return (r || rootEl).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || rootEl).querySelectorAll(s)); }

    $('.cm-topact').insertAdjacentHTML('afterbegin', '<button type="button" class="cm-btn" data-xp="open" title="تصدير الخريطة (PNG / PDF) أو طباعتها" aria-label="تصدير وطباعة">' + IC.exp + '<span>تصدير</span></button>');
    rootEl.insertAdjacentHTML('beforeend',
      '<div class="cm-xp" hidden role="dialog" aria-modal="true" aria-label="تصدير وطباعة"><div class="cm-xpbox">' +
      '<div class="cm-ph"><b>تصدير وطباعة</b><button type="button" class="cm-x cm-xs" data-xp="close" title="إغلاق" aria-label="إغلاق">' + IC.close + '</button></div>' +
      '<div class="cm-xpbody"><div class="cm-xpprev"><div class="cm-xpcv"><canvas aria-label="معاينة"></canvas></div><small class="cm-xpinfo" aria-live="polite"></small></div>' +
      '<div class="cm-xpopts">' +
      row('', 'الصيغة', seg('fmt', [{ v: 'png', t: 'صورة PNG' }, { v: 'pdf', t: 'ملف PDF' }, { v: 'print', t: 'طباعة' }])) +
      row('', 'المنطقة', seg('scope', [{ v: 'all', t: 'الخريطة كاملة', title: 'كل العقد والروابط بهامش، بغض النظر عن التكبير الحالي' }, { v: 'view', t: 'الجزء الظاهر', title: 'ما يظهر الآن في مساحة العمل فقط' }])) +
      row('', 'الخلفية', seg('bg', [{ v: 'white', t: 'بيضاء' }, { v: 'transparent', t: 'شفافة', title: 'متاحة لصور PNG فقط' }, { v: 'workspace', t: 'كمساحة العمل', title: 'لون خلفية الخريطة الحالي' }])) +
      row('cm-xo-png', 'الدقة والجودة', seg('scale', [{ v: '1', t: 'عادية 1×' }, { v: '2', t: 'عالية 2×' }, { v: '3', t: 'عالية جداً 3×' }])) +
      row('cm-xo-page', 'حجم الورقة', seg('paper', [{ v: 'A4', t: 'A4' }, { v: 'A3', t: 'A3' }])) +
      row('cm-xo-page', 'الاتجاه', seg('orient', [{ v: 'auto', t: 'تلقائي' }, { v: 'landscape', t: 'أفقي' }, { v: 'portrait', t: 'عمودي' }])) +
      row('cm-xo-pdf', 'جودة PDF', seg('dpi', [{ v: '150', t: 'عادية 150' }, { v: '200', t: 'جيدة 200' }, { v: '300', t: 'عالية 300' }])) +
      '</div></div>' +
      '<p class="cm-xpmsg" role="status" aria-live="polite"></p>' +
      '<div class="cm-xpact"><button type="button" class="cm-btn cm-pri" data-xp="go"></button><button type="button" class="cm-btn" data-xp="close2">إغلاق</button></div>' +
      '</div></div>');
    var pop = $('.cm-xp'), pcv = $('.cm-xpcv canvas'), pinfo = $('.cm-xpinfo'), pmsg = $('.cm-xpmsg'), goBtn = $('[data-xp="go"]');
    var O = { fmt: 'png', scope: 'all', bg: 'white', scale: '2', paper: 'A4', orient: 'auto', dpi: '200' };
    var opener = null, busy = false, pvTimer = 0, pvSeq = 0;

    function msg(t, bad) { pmsg.textContent = t || ''; pmsg.classList.toggle('bad', !!bad); }
    function sync() {
      $$('[data-xk]', pop).forEach(function (g) {
        var k = g.dataset.xk;
        $$('[data-xv]', g).forEach(function (b) {
          b.setAttribute('aria-pressed', b.dataset.xv === O[k] ? 'true' : 'false');
          if (k === 'bg' && b.dataset.xv === 'transparent') b.disabled = O.fmt !== 'png';
        });
      });
      if (O.fmt !== 'png' && O.bg === 'transparent') O.bg = 'white';
      $('.cm-xo-png', pop).hidden = O.fmt !== 'png';
      $$('.cm-xo-page', pop).forEach(function (e) { e.hidden = O.fmt === 'png'; });
      $('.cm-xo-pdf', pop).hidden = O.fmt !== 'pdf';
      goBtn.innerHTML = (O.fmt === 'print' ? IC.print : IC.exp) + '<span>' + (O.fmt === 'png' ? 'تنزيل صورة PNG' : O.fmt === 'pdf' ? 'تنزيل ملف PDF' : 'طباعة الخريطة') + '</span>';
      $$('[data-xk]', pop).forEach(function (g) { $$('[data-xv]', g).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.xv === O[g.dataset.xk] ? 'true' : 'false'); }); });
      pcv.parentNode.classList.toggle('cm-xpt', O.bg === 'transparent');
      preview();
    }

    /* معاينة: الخريطة كما ستُصدَّر، ومع PDF/الطباعة داخل ورقة بيضاء بالاتجاه والملاءمة الفعليين */
    function preview() { clearTimeout(pvTimer); pvTimer = setTimeout(drawPreview, 120); }
    async function drawPreview() {
      var seq = ++pvSeq, ctx = pcv.getContext('2d');
      if (!doc.nodes.length) { pcv.width = 300; pcv.height = 120; ctx.clearRect(0, 0, 300, 120); pinfo.textContent = 'الخريطة فارغة: أضف عقداً أولاً.'; return; }
      try {
        await ensureFonts(doc);
        if (seq !== pvSeq) return;
        var rect = EXP.region(doc, O.scope, api.canvas, 40);
        if (!rect) return;
        var bg = O.fmt !== 'png' && O.bg === 'transparent' ? 'white' : O.bg, box = 340, info = '';
        if (O.fmt === 'png') {
          var s = Math.min(box / rect.w, box / rect.h, 1), full = EXP.fitScale(rect.w, rect.h, +O.scale);
          var c = EXP.renderCanvas(doc, rect, Math.max(s, 0.02), bg);
          pcv.width = c.width; pcv.height = c.height; ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(c, 0, 0);
          info = 'الحجم الناتج: ' + Math.ceil(rect.w * full.s) + ' × ' + Math.ceil(rect.h * full.s) + ' بكسل' + (full.reduced ? ' (خُفّضت الدقة تلقائياً لحماية ذاكرة الجهاز)' : '');
        } else {
          var pg = EXP.page(O.paper, O.orient, rect.w, rect.h), pl = EXP.place(pg, rect.w, rect.h), k = box / Math.max(pg.w, pg.h);
          var pw = Math.round(pg.w * k), ph = Math.round(pg.h * k), c2 = EXP.renderCanvas(doc, rect, Math.max(pl.k * k, 0.02), bg);
          pcv.width = pw; pcv.height = ph; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pw, ph);
          ctx.drawImage(c2, pl.x * k, ph - (pl.y + pl.h) * k, pl.w * k, pl.h * k);
          ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.setLineDash([4, 3]); ctx.strokeRect(MARGIN_MM * MM * k, MARGIN_MM * MM * k, pw - 2 * MARGIN_MM * MM * k, ph - 2 * MARGIN_MM * MM * k);
          info = O.paper + ' ' + (pg.land ? 'أفقي' : 'عمودي') + ' — الخريطة كاملة داخل الصفحة بهامش 10 مم';
        }
        pinfo.textContent = info;
      } catch (e) { pinfo.textContent = ''; }
    }

    function open() {
      api.stopEdits(true); api.clearPending();
      opener = document.activeElement; msg('');
      pop.hidden = false; rootEl.classList.add('cm-xp-open');
      sync();
      goBtn.focus({ preventScroll: true });
    }
    function close() {
      if (pop.hidden) return;
      pop.hidden = true; rootEl.classList.remove('cm-xp-open'); msg('');
      try { (opener && opener.offsetParent ? opener : api.canvas).focus({ preventScroll: true }); } catch (e) {}
    }
    async function go() {
      if (busy) return;
      busy = true; goBtn.disabled = true; msg('جارٍ التجهيز…');
      try {
        await delay(30);
        var m = await EXP.make(doc, api.canvas, { fmt: O.fmt, scope: O.scope, bg: O.bg, scale: +O.scale, paper: O.paper, orient: O.orient, dpi: +O.dpi });
        if (m.type === 'print') { await EXP.print(m); msg('فُتحت نافذة الطباعة: ستُطبع الخريطة فقط.'); }
        else {
          EXP.save(m.blob, m.name);
          msg('تم التنزيل: ' + m.name + ' (' + m.width + ' × ' + m.height + ' بكسل' + (m.reduced ? '، خُفّضت الدقة تلقائياً لحماية الذاكرة' : '') + ')');
          api.say('تم تنزيل ' + m.name);
        }
      } catch (e) {
        if (window.console && !(e && e.user)) console.error('cmap export', e);
        msg(e && e.user ? e.message : 'تعذّر التصدير على هذا الجهاز. جرّب دقة أقل أو الجزء الظاهر فقط.', true);
      }
      busy = false; goBtn.disabled = false;
    }

    rootEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.xp === 'open') { open(); return; }
      if (!pop.contains(b)) return;
      if (b.dataset.xp === 'close' || b.dataset.xp === 'close2') { close(); return; }
      if (b.dataset.xp === 'go') { go(); return; }
      var g = b.closest('[data-xk]');
      if (g && b.dataset.xv != null) { O[g.dataset.xk] = b.dataset.xv; msg(''); sync(); }
    });
    pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
    window.addEventListener('keydown', function (e) {
      if (pop.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        var fs = $$('button:not([disabled])', pop).filter(function (x) { return x.offsetParent !== null; });
        if (fs.length) {
          var first = fs[0], last = fs[fs.length - 1];
          if (!pop.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
          else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      e.stopPropagation();
    }, true);
    /* تحديث المعاينة إن تغيّرت الخريطة أثناء فتح النافذة (لا يحدث عادةً) */
    doc.on('history', function () { if (!pop.hidden) preview(); });

    EXP.open = open; EXP.options = O;
  });
})();
