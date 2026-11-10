/* ==========================================================================
   research-layout.js — الغلاف + محرّك ترقيم الصفحات (A4 حقيقي) + الطباعة/PDF
   - المعاينة والتصدير يستعملان نفس محرّك التخطيط، فأرقام الصفحات والفهرس حقيقية
   - PDF النصي: عبر طباعة المتصفح (نص عربي قابل للتحديد والبحث) دون أي خدمة خارجية
   ========================================================================== */
(function () {
  'use strict';
  var RS = window.RS, U = RS.u, M = RS.model, H = RS.html;
  var PX = 96 / 25.4; /* بكسل لكل مليمتر */

  /* ----------------------------------------------------------- تنسيق الورقة */
  RS.paperCss = [
    '.rs-pg{position:relative;background:#fff;color:var(--c);direction:rtl;overflow:hidden;box-sizing:border-box;font-family:var(--ff);font-size:var(--fs);line-height:var(--lh);text-align:var(--al);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.rs-pg *{box-sizing:border-box}',
    '.rs-bd{position:absolute;overflow:hidden;direction:rtl;top:var(--mt);bottom:var(--mb);left:var(--ml);right:var(--mr)}',
    '.rs-bd>*{margin-top:0;margin-bottom:0}',
    '.rs-bd>*{margin-top:var(--pg)}.rs-bd .rs-h{margin-top:1em}.rs-bd .rs-h+*{margin-top:.6em}.rs-bd>*:first-child{margin-top:0!important}',
    '.rs-bd p{text-indent:var(--ind);overflow-wrap:anywhere}.rs-bd p.rs-c{text-indent:0}',
    '.rs-bd h4,.rs-bd h5,.rs-bd h6{font-weight:700;line-height:1.5;text-indent:0}.rs-bd h4{font-size:1.12em}.rs-bd h5{font-size:1.05em}.rs-bd h6{font-size:1em;font-style:italic}',
    '.rs-bd ul,.rs-bd ol{padding:0;padding-inline-start:2em;margin-bottom:0}.rs-bd li{overflow-wrap:anywhere}',
    '.rs-bd blockquote{margin-inline:1.5em;font-style:italic}',
    '.rs-bd a{color:#1d4ed8;text-decoration:underline}',
    '.rs-bd table{border-collapse:collapse;width:100%;line-height:1.5}.rs-bd td,.rs-bd th{padding:3px 6px;vertical-align:top;overflow-wrap:anywhere;text-indent:0}.rs-bd th{font-weight:700;background:#f1f1f1}',
    '.rs-bd table[data-b="1"] td,.rs-bd table[data-b="1"] th{border:1px solid #000}.rs-bd table[data-b="2"] td,.rs-bd table[data-b="2"] th{border:2px solid #000}.rs-bd table[data-b="0"] td,.rs-bd table[data-b="0"] th{border:0}',
    '.rs-bd table[data-fixed="1"]{table-layout:fixed}',
    '.rs-bd td p,.rs-bd th p{margin:0;text-indent:0}',
    '.rs-bd .rs-h{font-weight:700;line-height:1.45;text-indent:0;color:#000}.rs-bd .rs-h.chapter,.rs-bd .rs-h.big{text-align:center}',
    '.rs-bd .rs-h.t0{text-align:center}',
    '.rs-bd .rs-cap{font-weight:700;text-align:center;text-indent:0;font-size:.95em}',
    '.rs-bd figure.rs-fig{margin-left:0;margin-right:0;text-align:center;text-indent:0}.rs-bd figure.rs-fig img{display:inline-block;max-width:100%}',
    '.rs-bd figure.rs-fig figcaption{font-size:.92em;font-weight:700;margin-top:4px;line-height:1.4}',
    '.rs-bd .rs-pe{text-indent:0;text-align:right}.rs-bd .rs-pe.b{font-weight:700}',
    '.rs-bd .rs-te{display:flex;align-items:baseline;gap:.4em;text-indent:0;text-align:right}.rs-bd .rs-te .tt{flex:0 1 auto}.rs-bd .rs-te .ld{flex:1 1 auto;border-bottom:1.5px dotted #000;min-width:1em;transform:translateY(-.25em)}.rs-bd .rs-te .pn{flex:none;min-width:1.6em;text-align:left;direction:ltr}',
    '.rs-bd .rs-ref{text-indent:0;text-align:right;padding-inline-start:0}.rs-bd .rs-rh{font-weight:700;text-indent:0;text-align:right}',
    '.rs-bd .rs-cite{white-space:normal}',
    '.rs-hd,.rs-ft{position:absolute;left:var(--ml);right:var(--mr);font-size:11pt;line-height:1.4;color:#000;direction:rtl}',
    '.rs-hd{top:calc(var(--mt) / 2 - .55cm)}.rs-ft{bottom:calc(var(--mb) / 2 - .55cm)}',
    '.rs-nr{display:flex;justify-content:space-between;direction:ltr;font-size:12pt}.rs-nr span{flex:1}.rs-nr .l{text-align:left}.rs-nr .c{text-align:center}.rs-nr .r{text-align:right}',
    '.rs-ht{text-align:center;border-bottom:1px solid #666;padding-bottom:2px;margin-top:2px}.rs-ftx{text-align:center;margin-bottom:2px;border-top:1px solid #666;padding-top:2px}',
    '.rs-cvw{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;background:#fff}',
    '.rs-cvw .ce{position:absolute;box-sizing:border-box;direction:rtl;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.35}'
  ].join('\n');

  RS.layout = {};
  var cssDone = false;
  RS.layout.ensureCss = function () {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style'); s.id = 'rsPaperCss'; s.textContent = RS.paperCss; document.head.appendChild(s);
  };
  RS.layout.pageVars = function (st) {
    var d = M.pageMM(st), ff = '"' + st.font + '","Traditional Arabic","Simplified Arabic","Amiri","Noto Naskh Arabic","Times New Roman",serif';
    return 'width:' + d[0] + 'mm;height:' + d[1] + 'mm;--c:' + st.color + ';--ff:' + ff + ';--fs:' + st.fs + 'pt;--lh:' + st.lh + ';--al:' + (st.align === 'justify' ? 'justify' : st.align) + ';--pg:' + st.pgap + 'pt;--ind:' + (st.indent || 0) + 'cm;--mt:' + st.mt + 'cm;--mb:' + st.mb + 'cm;--ml:' + st.ml + 'cm;--mr:' + st.mr + 'cm;';
  };

  /* ---------------------------------------------------------------- الغلاف */
  var CV = RS.cover = {};
  CV.FIELDS = [['title', 'عنوان البحث'], ['university', 'الجامعة'], ['faculty', 'الكلية'], ['dept', 'القسم'], ['major', 'التخصص'], ['level', 'المستوى'], ['group', 'الفوج'], ['year', 'السنة الجامعية'], ['students', 'الطلبة'], ['supervisor', 'الأستاذ المشرف'], ['extra', 'بيانات إضافية']];
  CV.tokenValue = function (meta, k) {
    if (k === 'students') return (meta.students || []).filter(function (x) { return (x || '').trim(); }).join('\n');
    if (k === 'extra') return (meta.extra || []).filter(function (x) { return x && (x.v || '').trim(); }).map(function (x) { return (x.k ? x.k + ': ' : '') + x.v; }).join('\n');
    return (meta[k] == null ? '' : String(meta[k])).trim();
  };
  CV.fill = function (text, meta, ph) {
    return String(text || '').replace(/\{\{(\w+)\}\}/g, function (m0, k) { var v = CV.tokenValue(meta, k); return v || (ph ? '﹝' + (CV.FIELDS.filter(function (f) { return f[0] === k; })[0] || [0, k])[1] + '﹞' : ''); });
  };
  CV.ACCENTS = ['#4c1d95', '#1e3a8a', '#065f46', '#7f1d1d', '#111827', '#92400e'];
  CV.TPLS = [{ id: 'classic', n: 'رسمي كلاسيكي' }, { id: 'frame', n: 'إطار مزدوج' }, { id: 'band', n: 'شريط علوي' }, { id: 'side', n: 'شريط جانبي' }, { id: 'minimal', n: 'بسيط' }];
  function titleSize(t) { var n = (t || '').length; return n <= 40 ? 30 : n <= 70 ? 26 : n <= 110 ? 22 : 18; }
  function T(x, y, w, h, text, o) { o = o || {}; return { id: U.uid(), k: 'text', x: x, y: y, w: w, h: h, text: text, ff: o.ff || 'Traditional Arabic', fs: o.fs || 18, color: o.color || '#000000', b: !!o.b, i: false, u: false, al: o.al || 'center', need: o.need || [] }; }
  function Rc(x, y, w, h, o) { o = o || {}; return { id: U.uid(), k: 'rect', x: x, y: y, w: w, h: h, bg: o.bg || '', bc: o.bc || '', bw: o.bw || 0, bs: o.bs || 'solid' }; }
  CV.build = function (tpl, W, H, meta, accent) {
    accent = accent || '#4c1d95'; var els = [], m = Math.round(W * 0.04), cx = Math.round(W * 0.1), cw = W - 2 * cx;
    var tsz = titleSize(meta.title), ty = Math.round(H * 0.40), th = Math.round(H * 0.17);
    function header(y, color) {
      els.push(T(cx, y, cw, 30, 'الجمهورية الجزائرية الديمقراطية الشعبية', { fs: 19, b: 1, color: color }));
      els.push(T(cx, y + 30, cw, 28, 'وزارة التعليم العالي والبحث العلمي', { fs: 17, b: 1, color: color }));
      els.push(T(cx, y + 64, cw, 30, '{{university}}', { fs: 19, b: 1, color: color, need: ['university'] }));
      els.push(T(cx, y + 96, cw, 28, '{{faculty}}', { fs: 17, color: color, need: ['faculty'] }));
      els.push(T(cx, y + 124, cw, 28, '{{dept}}', { fs: 17, color: color, need: ['dept'] }));
    }
    function footer(y, color) {
      els.push(T(cx, y, cw * 0.48, 130, 'من إعداد الطلبة:\n{{students}}', { fs: 17, al: 'right', color: color, need: ['students'], b: 0 }));
      els.push(T(cx + cw * 0.52, y, cw * 0.48, 130, 'تحت إشراف الأستاذ:\n{{supervisor}}', { fs: 17, al: 'left', color: color, need: ['supervisor'] }));
      els.push(T(cx, H - Math.round(H * 0.115), cw, 30, 'السنة الجامعية: {{year}}', { fs: 18, b: 1, color: color, need: ['year'] }));
    }
    function info(y, color) {
      els.push(T(cx, y, cw, 26, 'التخصص: {{major}}', { fs: 17, color: color, need: ['major'] }));
      els.push(T(cx, y + 26, cw, 26, 'المستوى: {{level}}', { fs: 17, color: color, need: ['level'] }));
      els.push(T(cx, y + 52, cw, 26, 'الفوج: {{group}}', { fs: 17, color: color, need: ['group'] }));
    }
    if (tpl === 'frame') {
      els.push(Rc(m, m, W - 2 * m, H - 2 * m, { bc: accent, bw: 6, bs: 'double' }));
      els.push(Rc(m + 14, m + 14, W - 2 * m - 28, H - 2 * m - 28, { bc: accent, bw: 1 }));
      header(m + 40, '#000000');
      els.push(Rc(cx, ty, cw, th, { bc: accent, bw: 2 })); els.push(T(cx + 10, ty + 6, cw - 20, th - 12, '{{title}}', { fs: tsz, b: 1, color: accent, need: ['title'] }));
      info(ty + th + 24, '#000000'); footer(Math.round(H * 0.70), '#000000');
    } else if (tpl === 'band') {
      var bh = Math.round(H * 0.25);
      els.push(Rc(0, 0, W, bh, { bg: accent }));
      header(Math.round(bh * 0.1), '#ffffff');
      els.push(Rc(cx, ty + 10, cw, 4, { bg: accent })); els.push(T(cx, ty + 24, cw, th, '{{title}}', { fs: tsz, b: 1, color: accent, need: ['title'] })); els.push(Rc(cx, ty + th + 36, cw, 4, { bg: accent }));
      info(ty + th + 60, '#000000'); footer(Math.round(H * 0.72), '#000000');
      els.push(Rc(0, H - 16, W, 16, { bg: accent }));
    } else if (tpl === 'side') {
      var sw = Math.round(W * 0.11);
      els.push(Rc(W - sw, 0, sw, H, { bg: accent })); els.push(Rc(W - sw - 10, 0, 4, H, { bg: accent }));
      var cx2 = Math.round(W * 0.08), cw2 = W - sw - 2 * cx2 - 10;
      var hd = [T(cx2, 60, cw2, 30, 'الجمهورية الجزائرية الديمقراطية الشعبية', { fs: 18, b: 1 }), T(cx2, 90, cw2, 28, 'وزارة التعليم العالي والبحث العلمي', { fs: 16, b: 1 }), T(cx2, 128, cw2, 30, '{{university}}', { fs: 19, b: 1, need: ['university'], color: accent }), T(cx2, 160, cw2, 28, '{{faculty}}', { fs: 16, need: ['faculty'] }), T(cx2, 188, cw2, 28, '{{dept}}', { fs: 16, need: ['dept'] })];
      els = els.concat(hd);
      els.push(T(cx2, ty, cw2, th, '{{title}}', { fs: tsz, b: 1, color: accent, need: ['title'] }));
      els.push(Rc(cx2 + Math.round(cw2 * 0.3), ty + th + 14, Math.round(cw2 * 0.4), 3, { bg: accent }));
      els.push(T(cx2, ty + th + 34, cw2, 26, 'التخصص: {{major}}', { fs: 17, need: ['major'] })); els.push(T(cx2, ty + th + 60, cw2, 26, 'المستوى: {{level}}', { fs: 17, need: ['level'] })); els.push(T(cx2, ty + th + 86, cw2, 26, 'الفوج: {{group}}', { fs: 17, need: ['group'] }));
      var fy = Math.round(H * 0.72);
      els.push(T(cx2, fy, cw2 * 0.5, 130, 'من إعداد الطلبة:\n{{students}}', { fs: 17, al: 'right', need: ['students'] })); els.push(T(cx2 + cw2 * 0.5, fy, cw2 * 0.5, 130, 'تحت إشراف الأستاذ:\n{{supervisor}}', { fs: 17, al: 'left', need: ['supervisor'] }));
      els.push(T(cx2, H - Math.round(H * 0.1), cw2, 30, 'السنة الجامعية: {{year}}', { fs: 18, b: 1, need: ['year'] }));
    } else if (tpl === 'minimal') {
      header(Math.round(H * 0.06), '#000000');
      els.push(T(cx, ty - 10, cw, th, '{{title}}', { fs: tsz + 2, b: 1, color: accent, need: ['title'] }));
      els.push(Rc(cx + Math.round(cw * 0.25), ty + th + 6, Math.round(cw * 0.5), 2, { bg: accent }));
      info(ty + th + 30, '#333333'); footer(Math.round(H * 0.72), '#000000');
    } else { /* classic */
      els.push(Rc(m, m, W - 2 * m, H - 2 * m, { bc: accent, bw: 3 }));
      header(m + 36, '#000000');
      els.push(Rc(cx, ty, cw, th, { bc: '#000000', bw: 2 })); els.push(T(cx + 10, ty + 6, cw - 20, th - 12, '{{title}}', { fs: tsz, b: 1, need: ['title'] }));
      info(ty + th + 24, '#000000'); footer(Math.round(H * 0.70), '#000000');
    }
    els.forEach(function (e, i) { e.z = i; });
    return els;
  };
  CV.newCover = function (st, meta, tpl, accent) {
    var d = M.pageMM(st), W = Math.round(d[0] * PX), Hh = Math.round(d[1] * PX);
    return { tpl: tpl || 'classic', accent: accent || '#4c1d95', W: W, H: Hh, els: CV.build(tpl || 'classic', W, Hh, meta, accent) };
  };
  /* HTML الغلاف بأنماط مضمّنة بالكامل (يصلح للمعاينة والطباعة وتحويله إلى صورة) */
  CV.html = function (cover, meta, imgs, pageW, pageH, opt) {
    opt = opt || {};
    var sc = Math.min(pageW / cover.W, pageH / cover.H);
    var ox = (pageW - cover.W * sc) / 2, oy = (pageH - cover.H * sc) / 2;
    var h = '<div class="rs-cvw" style="width:' + cover.W + 'px;height:' + cover.H + 'px;transform:translate(' + ox + 'px,' + oy + 'px) scale(' + sc + ')">';
    cover.els.slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }).forEach(function (e) {
      var base = 'left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;height:' + e.h + 'px;';
      if (e.k === 'text') {
        var txt = CV.fill(e.text, meta, opt.placeholders);
        if (e.need && e.need.length && !opt.placeholders && e.need.some(function (k) { return !CV.tokenValue(meta, k); })) return;
        h += '<div class="ce" data-id="' + e.id + '" style="' + base + 'font-family:\'' + U.esc(e.ff) + '\',\'Traditional Arabic\',serif;font-size:' + e.fs + 'px;color:' + e.color + ';font-weight:' + (e.b ? 700 : 400) + ';font-style:' + (e.i ? 'italic' : 'normal') + ';text-decoration:' + (e.u ? 'underline' : 'none') + ';text-align:' + e.al + '">' + U.esc(txt) + '</div>';
      } else if (e.k === 'rect') {
        h += '<div class="ce" data-id="' + e.id + '" style="' + base + (e.bg ? 'background:' + e.bg + ';' : '') + (e.bw ? 'border:' + e.bw + 'px ' + (e.bs || 'solid') + ' ' + (e.bc || '#000') + ';' : '') + '"></div>';
      } else if (e.k === 'img') {
        var im = imgs && imgs[e.imgId];
        if (im) h += '<div class="ce" data-id="' + e.id + '" style="' + base + '"><img src="' + im.data + '" style="width:100%;height:100%;object-fit:' + (e.fit || 'contain') + ';display:block"></div>';
      }
    });
    return h + '</div>';
  };

  /* --------------------------------------------------------- محرّك التخطيط */
  var L = RS.layout;
  function mmpx(mm) { return mm * PX; }
  function fitsIn(bd) { return bd.scrollHeight <= bd.clientHeight + 1; }
  function usedH(bd) { var l = bd.lastElementChild; return l ? l.offsetTop + l.offsetHeight : 0; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* قصّ كتلة نصية إلى كلمات [from,to) مع الحفاظ على التنسيق الداخلي */
  function wordsOf(txt) { return txt.split(/(\s+)/); }
  function countWordsEl(node) {
    var n = 0, w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) { var t = wordsOf(w.currentNode.nodeValue); for (var i = 0; i < t.length; i++) if (t[i] && !/^\s+$/.test(t[i])) n++; }
    return n;
  }
  function sliceWords2(src, from, to) {
    var c = src.cloneNode(true), idx = 0, begun = false, w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, null), list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(function (tn) {
      var parts = wordsOf(tn.nodeValue), out = '';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; if (!p) continue;
        if (/^\s+$/.test(p)) { if (begun && idx < to) out += p; continue; }
        if (idx >= from && idx < to) { out += p; begun = true; }
        idx++;
      }
      tn.nodeValue = out;
    });
    pruneEmpty(c);
    return c;
  }
  function pruneEmpty(root) {
    var changed = true;
    while (changed) {
      changed = false;
      var all = root.querySelectorAll('*');
      for (var i = all.length - 1; i >= 0; i--) {
        var e = all[i];
        if (/^(BR|IMG|HR|TD|TH|TR|TABLE|THEAD|TBODY|LI|UL|OL)$/.test(e.tagName)) continue;
        if (e.classList.contains('rs-cite')) continue;
        if (!e.textContent.trim() && !e.querySelector('br,img,.rs-cite')) { e.remove(); changed = true; }
      }
    }
  }

  L.run = function (paper, imgs, opt) {
    opt = opt || {};
    L.ensureCss();
    var st = paper.settings, meta = paper.meta, dim = M.pageMM(st);
    var bdW = (dim[0] - (st.ml + st.mr) * 10) * PX, bdH = (dim[1] - (st.mt + st.mb) * 10) * PX;
    var vars = L.pageVars(st);
    var host = el('div'); host.style.cssText = 'position:fixed;left:-30000px;top:0;visibility:hidden;pointer-events:none'; document.body.appendChild(host);
    var pages = [], cur = null, warns = [], lineH = st.fs * 1.333 * st.lh;
    var sel = opt.secIds ? opt.secIds : null; /* مجموعة معرّفات الأقسام المختارة (أو null = الكل) */
    function inSel(id) { return !sel || sel[id]; }

    function newPage(kind) {
      var pg = el('section', 'rs-pg'); pg.style.cssText = vars; pg.setAttribute('data-kind', kind || 'body');
      var bd = el('div', 'rs-bd'); pg.appendChild(el('div', 'rs-hd')); pg.appendChild(bd); pg.appendChild(el('div', 'rs-ft'));
      host.appendChild(pg); cur = { el: pg, bd: bd, kind: kind || 'body' }; pages.push(cur); return cur;
    }
    function isEmptyPage() { return !cur || cur.bd.children.length === 0; }
    function shrink(blk) {
      /* كتلة أكبر من الصفحة: نقلّص الصور أو نقيس بالتصغير */
      var im = blk.querySelector && blk.querySelector('img');
      if (im) { im.style.maxHeight = Math.max(60, bdH - 90) + 'px'; im.style.width = 'auto'; im.style.height = 'auto'; return; }
      blk.style.transformOrigin = 'top right'; var r = Math.max(0.3, (bdH - 4) / Math.max(1, blk.scrollHeight)); blk.style.transform = 'scale(' + r + ')'; blk.style.width = (100 / r) + '%'; blk.style.height = (bdH - 4) + 'px'; blk.style.overflow = 'hidden';
    }
    function splittable(b) {
      var t = b.tagName;
      if (t === 'P' || t === 'BLOCKQUOTE' || t === 'H4' || t === 'H5' || t === 'H6') return !b.hasAttribute('data-kwn') && b.className.indexOf('rs-h') < 0;
      if (t === 'UL' || t === 'OL') return b.children.length > 1;
      if (t === 'TABLE') { return !b.querySelector('[rowspan]') && b.rows.length > 1; }
      return false;
    }
    function splitToFit(b) {
      var t = b.tagName, bd = cur.bd, first, rest;
      if (t === 'UL' || t === 'OL') {
        var items = Array.prototype.slice.call(b.children), shell = b.cloneNode(false), k = 0;
        bd.appendChild(shell);
        for (k = 0; k < items.length; k++) { shell.appendChild(items[k].cloneNode(true)); if (!fitsIn(bd)) { shell.removeChild(shell.lastChild); break; } }
        bd.removeChild(shell);
        if (k === 0 || k >= items.length) return null;
        first = b.cloneNode(false); items.slice(0, k).forEach(function (i) { first.appendChild(i.cloneNode(true)); });
        rest = b.cloneNode(false); items.slice(k).forEach(function (i) { rest.appendChild(i.cloneNode(true)); });
        if (t === 'OL') { var s0 = parseInt(b.getAttribute('start'), 10) || 1; rest.setAttribute('start', s0 + k); }
        return { first: first, rest: rest };
      }
      if (t === 'TABLE') {
        var rows = Array.prototype.slice.call(b.rows), headN = 0;
        while (headN < rows.length && rows[headN].querySelector('th') && !rows[headN].querySelector('td')) headN++;
        if (b.getAttribute('data-nohead') === '1') headN = 0;
        var mk = function (arr, withHead) { var tb = b.cloneNode(false); var body = document.createElement('tbody'); if (withHead) rows.slice(0, headN).forEach(function (r) { body.appendChild(r.cloneNode(true)); }); arr.forEach(function (r) { body.appendChild(r.cloneNode(true)); }); tb.appendChild(body); return tb; };
        var lo = headN, hi = rows.length - 1, best = -1;
        /* أكبر عدد من الصفوف يتسع */
        var sh = mk(rows.slice(0, 1), false); bd.appendChild(sh); sh.firstChild.innerHTML = ''; 
        var cnt = 0; for (var r = 0; r < rows.length; r++) { sh.firstChild.appendChild(rows[r].cloneNode(true)); if (!fitsIn(bd)) { sh.firstChild.removeChild(sh.firstChild.lastChild); break; } cnt++; }
        bd.removeChild(sh);
        if (cnt <= headN || cnt >= rows.length) return null;
        return { first: mk(rows.slice(0, cnt), false), rest: mk(rows.slice(cnt), true) };
      }
      /* فقرة: بحث ثنائي عن أكبر عدد كلمات يتسع */
      var total = countWordsEl(b); if (total < 4) return null;
      var lo2 = 1, hi2 = total - 1, bestK = 0;
      while (lo2 <= hi2) {
        var mid = (lo2 + hi2) >> 1, part = sliceWords2(b, 0, mid); part.classList.add('rs-split');
        bd.appendChild(part); var ok = fitsIn(bd); bd.removeChild(part);
        if (ok) { bestK = mid; lo2 = mid + 1; } else hi2 = mid - 1;
      }
      if (!bestK) return null;
      first = sliceWords2(b, 0, bestK); bd.appendChild(first); var hFirst = first.offsetHeight; bd.removeChild(first);
      if (hFirst < lineH * 1.9 && total > 12) return null; /* لا نترك سطراً يتيماً */
      rest = sliceWords2(b, bestK, Infinity); rest.classList.add('rs-c');
      if (st.align === 'justify') first.style.textAlignLast = 'justify';
      return { first: first, rest: rest };
    }
    function place(b, depth) {
      depth = depth || 0;
      if (b.hasAttribute && b.hasAttribute('data-pgbrk')) { if (!isEmptyPage()) newPage(cur.kind); return; }
      if (!cur) newPage('body');
      var kwn = b.hasAttribute && b.hasAttribute('data-kwn'), extra = kwn ? lineH * 2.2 : 0;
      cur.bd.appendChild(b);
      if (fitsIn(cur.bd) && (!extra || usedH(cur.bd) + extra <= cur.bd.clientHeight + 1)) return;
      var overflow = !fitsIn(cur.bd);
      cur.bd.removeChild(b);
      if (depth > 400) { cur.bd.appendChild(b); return; }
      if (kwn && !isEmptyPage() ) { newPage(cur.kind); place(b, depth + 1); return; }
      if (kwn && isEmptyPage()) { cur.bd.appendChild(b); return; }
      if (overflow && splittable(b)) {
        var sp = splitToFit(b);
        if (sp) { cur.bd.appendChild(sp.first); newPage(cur.kind); place(sp.rest, depth + 1); return; }
      }
      if (!isEmptyPage()) { newPage(cur.kind); place(b, depth + 1); return; }
      cur.bd.appendChild(b); if (!fitsIn(cur.bd)) { if (splittable(b)) { cur.bd.removeChild(b); var sp2 = splitToFit(b); if (sp2) { cur.bd.appendChild(sp2.first); newPage(cur.kind); place(sp2.rest, depth + 1); return; } cur.bd.appendChild(b); } shrink(b); }
    }
    function startSeg(kind) { if (!cur || cur.bd.children.length || cur.kind === 'cover') newPage(kind); else cur.kind = kind; cur.el.setAttribute('data-kind', kind); }

    /* ------------ تحويل أقسام البحث إلى كتل (قبل أي توزيع) ------------ */
    var nt = M.numberTree(paper), tblNo = 0, figNo = 0, tblList = [], figList = [], hidSeq = 0;
    function mkHeading(text, cls, size, hid, sid) {
      var h = el('div', 'rs-h ' + cls); h.setAttribute('data-kwn', '1'); if (hid) h.setAttribute('data-hid', hid); if (sid) h.setAttribute('data-sid', sid); h.style.fontSize = size + 'pt'; h.textContent = text; return h;
    }
    function figEl(f) {
      var im = imgs && imgs[f.imgId]; var fig = el('figure', 'rs-fig'); fig.setAttribute('data-figid', f.id);
      if (!im) { fig.textContent = '(الصورة غير متوفرة)'; return fig; }
      var w = f.w || im.w || 300, hh = f.h || Math.round(w * (im.h || 1) / (im.w || 1));
      var sc = 1; if (w > bdW) sc = bdW / w; if (hh * sc > bdH - 80) sc = (bdH - 80) / hh;
      w = Math.round(w * sc); hh = Math.round(hh * sc);
      fig.style.textAlign = f.align === 'right' ? 'right' : f.align === 'left' ? 'left' : 'center';
      fig.innerHTML = '<img alt="" src="' + im.data + '" style="width:' + w + 'px;height:' + hh + 'px">' + (f.title ? '<figcaption data-ft="' + U.esc(f.title) + '"></figcaption>' : '');
      fig._f = f;
      return fig;
    }
    function bodyBlocks(secId, html) {
      var blocks = H.blocks(R_refresh(html)), res = [];
      blocks.forEach(function (b) {
        if (!(b.hasAttribute && b.hasAttribute('data-pgbrk')) && !H.isPara(b) && b.tagName !== 'TABLE') return; /* نتجاهل الفقرات الفارغة */
        if (b.tagName === 'TABLE') {
          var cap = b.querySelector('caption'), ct = cap ? cap.textContent.trim() : ''; if (cap) cap.remove();
          if (ct) { tblNo++; var cp = el('p', 'rs-cap'); cp.setAttribute('data-kwn', '1'); cp.setAttribute('data-tid', 't' + tblNo); cp.textContent = 'الجدول ' + tblNo + ': ' + ct; tblList.push({ no: tblNo, title: ct, tid: 't' + tblNo }); res.push(cp); }
          var rows = b.rows; if (!rows.length) return;
        }
        res.push(b);
      });
      var il = RS.place.interleave(paper, secId, res, figEl);
      il.out.forEach(function (n) {
        if (n.getAttribute && n.getAttribute('data-figid')) {
          var cp2 = n.querySelector('figcaption');
          if (cp2) { figNo++; cp2.textContent = 'الشكل ' + figNo + ': ' + cp2.getAttribute('data-ft'); cp2.removeAttribute('data-ft'); figList.push({ no: figNo, title: n._f.title, id: n._f.id }); }
        }
      });
      il.warn.forEach(function (w) { warns.push('الصورة «' + w + '» لها موضع فقرة غير موجودة الآن فأُدرجت في نهاية القسم.'); });
      return il.out;
    }
    function R_refresh(html) { return RS.refs.refreshCites(paper, html); }

    /* ------------------------------ الأقسام النهائية ------------------------------ */
    var segs = []; /* مصفوفة {kind, nodes} */
    function secList() { return nt.flat.filter(function (r) { return inSel(r.id); }); }
    var tocEntries = []; /* {hid,text,depth,bold} */

    var intro = null, concl = null, body = [];
    if (opt.intro !== false && inSel('intro')) { hidSeq++; var hi = 'h' + hidSeq; intro = { hid: hi, nodes: [mkHeading(st.introTitle || 'مقدمة', 'big', st.h1, hi, 'intro')].concat(bodyBlocks('intro', paper.intro.html)) }; tocEntries.push({ hid: hi, text: st.introTitle || 'مقدمة', depth: 0, bold: 1 }); }
    secList().forEach(function (r, i) {
      hidSeq++; var hid = 'h' + hidSeq, sec = r.sec, cls = r.type === 'chapter' ? 'chapter' : '';
      var nodes = [];
      if (r.type === 'chapter' && st.chapNewPage && (intro || i > 0)) { var pb = el('div'); pb.setAttribute('data-pgbrk', '1'); nodes.push(pb); }
      nodes.push(mkHeading(r.text, cls, M.headingFont(st, r.type, r.depth), hid, r.id));
      nodes = nodes.concat(bodyBlocks(sec.id, sec.html));
      body.push({ hid: hid, nodes: nodes, id: r.id }); tocEntries.push({ hid: hid, text: r.text, depth: Math.min(3, r.depth), bold: r.type === 'chapter' });
    });
    if (opt.concl !== false && inSel('concl')) { hidSeq++; var hc = 'h' + hidSeq; concl = { hid: hc, nodes: [mkHeading(st.conclTitle || 'خاتمة', 'big', st.h1, hc, 'concl')].concat(bodyBlocks('concl', paper.concl.html)) }; tocEntries.push({ hid: hc, text: st.conclTitle || 'خاتمة', depth: 0, bold: 1 }); }
    var biblio = (opt.refs !== false && (paper.refs || []).length) ? RS.refs.biblio(paper) : null, refsHid = null;
    if (biblio) { hidSeq++; refsHid = 'h' + hidSeq; tocEntries.push({ hid: refsHid, text: st.refsTitle || 'قائمة المراجع', depth: 0, bold: 1 }); }

    /* ------------------------------ 1) الغلاف ------------------------------ */
    if (opt.cover !== false && paper.cover) {
      var cp = newPage('cover'); var pw = dim[0] * PX, ph = dim[1] * PX;
      cp.el.innerHTML = CV.html(paper.cover, meta, imgs, pw, ph, {});
      cur = cp;
    }
    /* ------------------------------ 2) الخطة ------------------------------ */
    if (opt.plan !== false) {
      startSeg('plan');
      place(mkHeading(st.planTitle || 'خطة البحث', 't0', st.h1, null));
      function pe(text, depth, bold) { var p = el('p', 'rs-pe' + (bold ? ' b' : '')); p.style.paddingInlineStart = (depth * 1.4) + 'em'; p.style.marginTop = '.5em'; p.textContent = text; return p; }
      if (intro) place(pe(st.introTitle || 'مقدمة', 0, true));
      secList().forEach(function (r) { place(pe(r.text, Math.min(4, r.depth), r.type === 'chapter')); });
      if (concl) place(pe(st.conclTitle || 'خاتمة', 0, true));
      if (biblio) place(pe(st.refsTitle || 'قائمة المراجع', 0, true));
    }
    /* ------------------------------ 3) الفهرس (أرقام مؤقتة) ------------------------------ */
    var tocPages = [];
    if (opt.toc) {
      startSeg('toc');
      place(mkHeading(st.tocTitle || 'الفهرس', 't0', st.h1, null));
      var teMk = function (text, depth, bold, key) { var d = el('div', 'rs-te' + (bold ? ' b' : '')); d.style.paddingInlineStart = (depth * 1.4) + 'em'; d.style.marginTop = '.45em'; if (bold) d.style.fontWeight = 700; d.innerHTML = '<span class="tt"></span><span class="ld"></span><span class="pn" data-pk="' + key + '">000</span>'; d.firstChild.textContent = text; return d; };
      tocEntries.forEach(function (t) { place(teMk(t.text, t.depth, t.bold, t.hid)); });
      if (opt.tocTables && tblList.length) { place(mkHeading('قائمة الجداول', 't0', st.h2, null)); tblList.forEach(function (t) { place(teMk('الجدول ' + t.no + ': ' + t.title, 0, 0, t.tid)); }); }
      if (opt.tocFigs && figList.length) { place(mkHeading('قائمة الصور والأشكال', 't0', st.h2, null)); figList.forEach(function (t) { place(teMk('الشكل ' + t.no + ': ' + t.title, 0, 0, 'f' + t.id)); }); }
    }
    /* ------------------------------ 4) المقدمة ------------------------------ */
    if (intro) { startSeg('intro'); intro.nodes.forEach(function (n) { place(n); }); }
    /* ------------------------------ 5) المتن ------------------------------ */
    if (body.length) {
      startSeg('body');
      body.forEach(function (s, i) { s.nodes.forEach(function (n) { place(n); }); });
    }
    /* ------------------------------ 6) الخاتمة ------------------------------ */
    if (concl) { startSeg('concl'); concl.nodes.forEach(function (n) { place(n); }); }
    /* ------------------------------ 7) المراجع ------------------------------ */
    if (biblio) {
      startSeg('refs'); place(mkHeading(st.refsTitle || 'قائمة المراجع', 'big', st.h1, refsHid));
      biblio.forEach(function (g) {
        if (g.head) { var gh = el('p', 'rs-rh'); gh.setAttribute('data-kwn', '1'); gh.style.marginTop = '.8em'; gh.textContent = g.head; place(gh); }
        g.items.forEach(function (it) { var p = el('p', 'rs-ref'); p.style.marginTop = '.5em'; p.style.paddingInlineStart = '2em'; p.style.textIndent = '-2em'; p.innerHTML = it.html; place(p); });
      });
    } else if (opt.refs !== false && opt.refsEmpty) { startSeg('refs'); place(mkHeading(st.refsTitle || 'قائمة المراجع', 'big', st.h1, null)); }

    /* ------------------------------ الترقيم والترويسة ------------------------------ */
    var hasCover = pages.length && pages[0].kind === 'cover';
    var first = hasCover && !st.numCover ? 1 : 0, numOf = {};
    pages.forEach(function (p, i) {
      var n = st.numStart + (i - first); p.num = n; p.shown = st.numOn && p.kind !== 'cover' && !(hasCover && i === 0);
      if (p.kind === 'cover') return;
      var txt = st.numStyle === 'indic' ? U.indic(n) : String(n);
      var pos = st.numPos || 'bottom-center', hd = p.el.querySelector('.rs-hd'), ft = p.el.querySelector('.rs-ft');
      var slot = pos.split('-')[1], row = '<div class="rs-nr"><span class="l">' + (slot === 'left' ? txt : '') + '</span><span class="c">' + (slot === 'center' ? txt : '') + '</span><span class="r">' + (slot === 'right' ? txt : '') + '</span></div>';
      var top = '', bot = '';
      if (p.shown && pos.indexOf('top') === 0) top += row;
      if (st.header || st.hdrTitle) top += '<div class="rs-ht">' + U.esc(st.header || paper.title || meta.title || '') + '</div>';
      if (st.footer) bot += '<div class="rs-ftx">' + U.esc(st.footer) + '</div>';
      if (p.shown && pos.indexOf('bottom') === 0) bot += row;
      hd.innerHTML = top; ft.innerHTML = bot;
      p.disp = txt;
    });
    /* أرقام الصفحات الحقيقية داخل الفهرس */
    var where = {};
    pages.forEach(function (p, i) { p.el.querySelectorAll('[data-hid],[data-tid],[data-figid]').forEach(function (e) { var k = e.getAttribute('data-hid') || e.getAttribute('data-tid') || ('f' + e.getAttribute('data-figid')); if (where[k] == null) where[k] = i; }); });
    host.querySelectorAll('[data-pk]').forEach(function (e) {
      var k = e.getAttribute('data-pk'), pi = where[k]; var pgx = pi != null ? pages[pi] : null;
      e.textContent = pgx ? (pgx.disp != null ? pgx.disp : String(pgx.num)) : '';
    });
    var nums = {}; Object.keys(where).forEach(function (k) { var pg = pages[where[k]]; nums[k] = pg.disp != null ? pg.disp : String(pg.num); });
    /* لا نبقي الصفحات داخل المضيف المخفي: نعيدها بدون مضيف */
    pages.forEach(function (p) { p.el.parentNode.removeChild(p.el); });
    host.remove();
    return { pages: pages.map(function (p) { return p.el; }), kinds: pages.map(function (p) { return p.kind; }), warns: warns, nums: nums, toc: tocEntries, tblList: tblList, figList: figList, count: pages.length, bdW: bdW, bdH: bdH, hasCover: hasCover };
  };

  /* ------------------------------------------------------------- الطباعة */
  L.docHtml = function (pages, st, title) {
    var d = M.pageMM(st);
    return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + U.esc(title || 'بحث') + '</title><style>@page{size:' + d[0] + 'mm ' + d[1] + 'mm;margin:0}html,body{margin:0;padding:0;background:#fff}body{direction:rtl}.rs-pg{page-break-after:always;break-after:page}.rs-pg:last-child{page-break-after:auto;break-after:auto}' + RS.paperCss + '</style></head><body>' + pages.map(function (p) { return p.outerHTML; }).join('') + '</body></html>';
  };
  L.print = function (pages, st, title) {
    var html = L.docHtml(pages, st, title);
    return new Promise(function (resolve, reject) {
      var f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
      var done = false;
      function fin() { if (done) return; done = true; setTimeout(function () { if (f.parentNode) f.remove(); }, 1500); resolve(); }
      f.onload = function () {
        try {
          var w = f.contentWindow; w.addEventListener('afterprint', fin);
          setTimeout(function () { try { w.focus(); w.print(); } catch (e) { reject(e); } }, 250);
          setTimeout(fin, 120000);
        } catch (e) { reject(e); }
      };
      document.body.appendChild(f); f.srcdoc = html;
    });
  };
  L.openTab = function (pages, st, title) {
    var blob = new Blob([L.docHtml(pages, st, title)], { type: 'text/html;charset=utf-8' }), u = URL.createObjectURL(blob), w = null;
    try { w = window.open(u, '_blank'); } catch (e) {}
    if (!w) U.download(blob, U.safeName(title) + '.html'); else setTimeout(function () { URL.revokeObjectURL(u); }, 300000);
    return !!w;
  };

  /* ---------------- PDF مباشر (صور JPEG) — خيار احتياطي للهواتف ---------------- */
  L.pageToCanvas = function (pageEl, st, scale) {
    return new Promise(function (resolve, reject) {
      var d = M.pageMM(st), W = Math.round(d[0] * PX), Hh = Math.round(d[1] * PX);
      var xml = new XMLSerializer().serializeToString(pageEl), css = RS.paperCss.replace(/&/g, '&amp;');
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + Hh + '"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>' + css + '</style>' + xml + '</div></foreignObject></svg>';
      var img = new Image();
      img.onload = function () {
        try { var c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(Hh * scale); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); resolve(c); } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('svg')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  };
  L.buildImagePdf = function (jpgs, wpx, hpx, wpt, hpt) {
    var parts = [], off = [], len = 0;
    function str(t) { var u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i) & 255; return u; }
    function push(x) { if (typeof x === 'string') x = str(x); parts.push(x); len += x.length; }
    var n = jpgs.length, kids = [], i;
    for (i = 0; i < n; i++) kids.push((3 + 3 * i) + ' 0 R');
    push('%PDF-1.4\n'); off[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    off[2] = len; push('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n');
    for (i = 0; i < n; i++) {
      var pg = 3 + 3 * i, ct = 4 + 3 * i, im = 5 + 3 * i, cs = 'q ' + wpt + ' 0 0 ' + hpt + ' 0 0 cm /Im0 Do Q';
      off[pg] = len; push(pg + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + wpt + ' ' + hpt + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>\nendobj\n');
      off[ct] = len; push(ct + ' 0 obj\n<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream\nendobj\n');
      off[im] = len; push(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + wpx + ' /Height ' + hpx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpgs[i].length + ' >>\nstream\n'); push(jpgs[i]); push('\nendstream\nendobj\n');
    }
    var total = 3 + 3 * n, xr = len, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (i = 1; i < total; i++) x += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  };
  L.imagePdf = function (pages, st, onProgress) {
    var d = M.pageMM(st), wpt = +(d[0] / 25.4 * 72).toFixed(2), hpt = +(d[1] / 25.4 * 72).toFixed(2), sc = pages.length > 60 ? 1.3 : 1.7, jpgs = [], i = 0, wpx = 0, hpx = 0;
    function b64u8(t) { var bin = atob(t), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return u; }
    return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= pages.length) { resolve(L.buildImagePdf(jpgs, wpx, hpx, wpt, hpt)); return; }
        if (onProgress) onProgress(i + 1, pages.length);
        L.pageToCanvas(pages[i], st, sc).then(function (c) { wpx = c.width; hpx = c.height; jpgs.push(b64u8(c.toDataURL('image/jpeg', 0.88).split(',')[1])); c.width = c.height = 0; i++; setTimeout(next, 0); }, reject);
      })();
    });
  };
})();
