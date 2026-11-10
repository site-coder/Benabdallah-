/* ==========================================================================
   research-export.js — التصدير إلى Word (DOCX حقيقي) وTXT + النسخ الاحتياطي والاستيراد
   - مولّد ZIP/DOCX مكتوب يدوياً (بلا مكتبات خارجية ولا إنترنت)
   ========================================================================== */
(function () {
  'use strict';
  var RS = window.RS, U = RS.u, M = RS.model, H = RS.html, L = RS.layout;
  var X = RS.exp = {};
  var PX = 96 / 25.4;

  /* ------------------------------------------------------------------ ZIP */
  var crcT = null;
  function crc32(u8) {
    if (!crcT) { crcT = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) crc = crcT[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  var enc = new TextEncoder();
  X.zip = function (files, mime) {
    var parts = [], central = [], offset = 0, d = new Date();
    var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dt, true); lh.setUint16(12, dd, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    });
    var csize = 0; central.forEach(function (c) { csize += c.byteLength || c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: mime || 'application/zip' });
  };
  function dataUrlToU8(du) { var b = atob(du.split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  /* ------------------------------------------------------------ DOCX: أدوات */
  var x = U.esc;
  function tw(mm) { return Math.round(mm * 56.6929); }
  var NAMED = { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080', navy: '000080', teal: '008080', maroon: '800000' };
  function hex(c) {
    c = String(c || '').trim().toLowerCase(); if (!c || c === 'transparent') return '';
    var m = /^#([0-9a-f]{3})$/.exec(c); if (m) return (m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]).toUpperCase();
    m = /^#([0-9a-f]{6})/.exec(c); if (m) return m[1].toUpperCase();
    m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c); if (m) return [m[1], m[2], m[3]].map(function (v) { return ('0' + (+v).toString(16)).slice(-2); }).join('').toUpperCase();
    return NAMED[c] || '';
  }
  function parseStyle(s) { var o = {}; String(s || '').split(';').forEach(function (d) { var i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); }); return o; }
  var AR = '\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF';
  var reArPiece = new RegExp('[' + AR + ']+|[^' + AR + ']+', 'g'), reNeutral = /^[\s\u00A0.,:;!?()\[\]\-–—"'«»،؛؟\/\d٠-٩%+=*_&@#<>]*$/;
  function segments(t) {
    var pcs = t.match(reArPiece) || [], out = [];
    pcs.forEach(function (p) {
      var isAr = new RegExp('[' + AR + ']').test(p);
      if (isAr) { if (out.length && out[out.length - 1].rtl) out[out.length - 1].t += p; else out.push({ rtl: true, t: p }); }
      else if (reNeutral.test(p)) { if (out.length && out[out.length - 1].rtl) out[out.length - 1].t += p; else out.push({ rtl: true, t: p, neutral: true }); }
      else out.push({ rtl: false, t: p });
    });
    /* دمج الأجزاء المحايدة الأولى مع ما بعدها إن كان عربياً */
    for (var i = 0; i < out.length - 1; i++) if (out[i].neutral && out[i + 1].rtl) { out[i + 1].t = out[i].t + out[i + 1].t; out.splice(i, 1); i--; }
    return out;
  }
  function rPr(o) {
    var s = '';
    if (o.font) s += '<w:rFonts w:ascii="' + x(o.font) + '" w:hAnsi="' + x(o.font) + '" w:cs="' + x(o.font) + '" w:eastAsia="' + x(o.font) + '"/>';
    if (o.b) s += '<w:b/><w:bCs/>'; if (o.i) s += '<w:i/><w:iCs/>'; if (o.s) s += '<w:strike/>';
    if (o.color) s += '<w:color w:val="' + o.color + '"/>';
    if (o.sz) s += '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>';
    if (o.u) s += '<w:u w:val="single"/>';
    if (o.bg) s += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.bg + '"/>';
    if (o.sup) s += '<w:vertAlign w:val="superscript"/>'; if (o.sub) s += '<w:vertAlign w:val="subscript"/>';
    if (o.rtl) s += '<w:rtl/>';
    return s ? '<w:rPr>' + s + '</w:rPr>' : '';
  }
  function runs(text, o) {
    if (!text) return '';
    return segments(text).map(function (sg) {
      var oo = {}; for (var k in o) oo[k] = o[k]; oo.rtl = sg.rtl;
      return '<w:r>' + rPr(oo) + '<w:t xml:space="preserve">' + x(sg.t) + '</w:t></w:r>';
    }).join('');
  }
  function P(inner, o) {
    o = o || {}; var p = '';
    if (o.style) p += '<w:pStyle w:val="' + o.style + '"/>';
    if (o.keepNext) p += '<w:keepNext/>'; if (o.keepLines) p += '<w:keepLines/>';
    if (o.pbb) p += '<w:pageBreakBefore/>';
    if (o.numId) p += '<w:numPr><w:ilvl w:val="' + (o.ilvl || 0) + '"/><w:numId w:val="' + o.numId + '"/></w:numPr>';
    if (o.tabs) p += '<w:tabs>' + o.tabs + '</w:tabs>';
    if (o.ltr !== true) p += '<w:bidi/>';
    if (o.before != null || o.after != null || o.line) p += '<w:spacing' + (o.before != null ? ' w:before="' + Math.round(o.before) + '"' : '') + (o.after != null ? ' w:after="' + Math.round(o.after) + '"' : '') + (o.line ? ' w:line="' + Math.round(o.line) + '" w:lineRule="auto"' : '') + '/>';
    if (o.ind) p += '<w:ind' + (o.ind.left != null ? ' w:left="' + Math.round(o.ind.left) + '"' : '') + (o.ind.right != null ? ' w:right="' + Math.round(o.ind.right) + '"' : '') + (o.ind.first ? ' w:firstLine="' + Math.round(o.ind.first) + '"' : '') + (o.ind.hang ? ' w:hanging="' + Math.round(o.ind.hang) + '"' : '') + '/>';
    if (o.jc) p += '<w:jc w:val="' + o.jc + '"/>';
    if (o.outline != null) p += '<w:outlineLvl w:val="' + o.outline + '"/>';
    if (o.sect) p += o.sect;
    return '<w:p>' + (p ? '<w:pPr>' + p + '</w:pPr>' : '') + inner + '</w:p>';
  }
  /* محاذاة: في فقرة RTL تُفسَّر left/right بصورة معكوسة في Word (بداية/نهاية السطر) */
  function jcVal(al, ltr) {
    if (al === 'justify') return 'both'; if (al === 'center') return 'center';
    if (ltr) return al === 'right' ? 'right' : 'left';
    return al === 'left' ? 'right' : 'left'; /* بدايةً (يمين) = left في فقرة bidi */
  }

  /* ------------------------------------------------------------ بناء DOCX */
  X.docx = function (paper, imgs, opt, info) {
    opt = opt || {}; info = info || { nums: {} };
    var st = paper.settings, meta = paper.meta, dim = M.pageMM(st);
    var pgW = tw(dim[0]), pgH = tw(dim[1]), textW = pgW - tw((st.ml + st.mr) * 10);
    var textPx = (dim[0] - (st.ml + st.mr) * 10) * PX, textHpx = (dim[1] - (st.mt + st.mb) * 10) * PX;
    var font = st.font, baseSz = Math.round(st.fs * 2), lineVal = Math.round(st.lh * 240), beforeBase = st.pgap * 20, firstInd = Math.round((st.indent || 0) * 567);
    var media = [], rels = [], relId = 10, numDefs = [], numId = 3, bodyXml = [], nt = M.numberTree(paper);
    var tblNo = 0, figNo = 0, bmId = 100;
    var secSel = opt.secIds || null; function inSel(id) { return !secSel || secSel[id]; }

    function imgInfo(imgId) { return imgs[imgId] || null; }
    var imgCache = {};
    function addMedia(imgId) {
      if (imgCache[imgId]) return imgCache[imgId];
      var im = imgs[imgId]; if (!im) return null;
      var m = /^data:image\/(png|jpeg|jpg|gif);base64,/i.exec(im.data); if (!m) return null;
      var ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase(); var rid = 'rId' + (relId++), name = 'image' + (media.length + 1) + '.' + ext;
      media.push({ name: 'word/media/' + name, data: dataUrlToU8(im.data) }); rels.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + name + '"/>');
      imgCache[imgId] = { rid: rid, w: im.w, h: im.h }; return imgCache[imgId];
    }
    function drawing(rid, wpx, hpx, idn, name) {
      var cx = Math.round(wpx * 9525), cy = Math.round(hpx * 9525);
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + idn + '" name="' + x(name) + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="' + x(name) + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }
    var picId = 1;

    /* ---- النص المضمّن ---- */
    function baseProps() { return { font: font, sz: baseSz, color: hex(st.color) === '000000' ? '' : hex(st.color) }; }
    function inl(node, pr, ctx) {
      if (node.nodeType === 3) { return runs(node.nodeValue.replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' '), pr); }
      if (node.nodeType !== 1) return '';
      var t = node.tagName, p = {}; for (var k in pr) p[k] = pr[k];
      if (t === 'BR') return '<w:r><w:br/></w:r>';
      if (t === 'B' || t === 'STRONG') p.b = true; if (t === 'I' || t === 'EM') p.i = true; if (t === 'U') p.u = true; if (t === 'S' || t === 'STRIKE') p.s = true;
      if (t === 'SUP') p.sup = true; if (t === 'SUB') p.sub = true;
      var sty = parseStyle(node.getAttribute('style'));
      if (sty['font-weight'] && (/bold/.test(sty['font-weight']) || parseInt(sty['font-weight'], 10) >= 600)) p.b = true;
      if (sty['font-style'] === 'italic') p.i = true;
      if (sty['text-decoration'] && /underline/.test(sty['text-decoration'])) p.u = true; if (sty['text-decoration'] && /line-through/.test(sty['text-decoration'])) p.s = true;
      if (sty.color) { var cc = hex(sty.color); if (cc) p.color = cc; }
      if (sty['background-color']) { var bb = hex(sty['background-color']); if (bb) p.bg = bb; }
      if (sty['font-family']) { var ff = sty['font-family'].split(',')[0].replace(/["']/g, '').trim(); if (ff && !/^(serif|sans-serif|monospace)$/i.test(ff)) p.font = ff; }
      if (sty['font-size']) { var fm = /^([\d.]+)(pt|px|em|%)$/.exec(sty['font-size']); if (fm) { var v = parseFloat(fm[1]); p.sz = Math.max(8, Math.round((fm[2] === 'pt' ? v : fm[2] === 'px' ? v * 0.75 : fm[2] === 'em' ? v * st.fs : v / 100 * st.fs) * 2)); } }
      if (t === 'SPAN' && node.classList.contains('rs-cite')) return runs(node.textContent, p);
      var inner = ''; for (var c = node.firstChild; c; c = c.nextSibling) inner += inl(c, p, ctx);
      if (t === 'A') {
        var href = node.getAttribute('href'); if (href) { var rid = 'rId' + (relId++); rels.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + x(href) + '" TargetMode="External"/>'); var lp = {}; for (var k2 in p) lp[k2] = p[k2]; lp.u = true; lp.color = '1D4ED8'; var inner2 = ''; for (var c2 = node.firstChild; c2; c2 = c2.nextSibling) inner2 += inl(c2, lp, ctx); return '<w:hyperlink r:id="' + rid + '">' + inner2 + '</w:hyperlink>'; }
      }
      return inner;
    }
    function paraOpts(node, extra) {
      var sty = parseStyle(node.getAttribute && node.getAttribute('style')), o = extra || {};
      var ltr = node.getAttribute && node.getAttribute('dir') === 'ltr'; if (ltr) o.ltr = true;
      var al = sty['text-align'] || st.align; o.jc = jcVal(al, ltr);
      var lh = sty['line-height']; if (lh) { var m = /^([\d.]+)(pt|px|em|%)?$/.exec(lh); if (m) { var v = parseFloat(m[1]); o.line = !m[2] || m[2] === 'em' ? v * 240 : m[2] === '%' ? v / 100 * 240 : Math.round(v * 20 / (st.fs * 1.2) * 240 / 1); if (m[2] === 'pt' || m[2] === 'px') o.line = lineVal; } }
      if (!o.line) o.line = lineVal;
      var mt = sty['margin-top']; if (o.before == null) { if (mt) { var mm = /^(-?[\d.]+)(pt|px|em|cm)?$/.exec(mt); o.before = mm ? Math.max(0, parseFloat(mm[1]) * (mm[2] === 'px' ? 15 : mm[2] === 'cm' ? 567 : mm[2] === 'em' ? st.fs * 20 : 20)) : beforeBase; } else o.before = beforeBase; }
      if (o.after == null) o.after = 0;
      if (!o.ind) { var ti = sty['text-indent']; var f = ti ? parseFloat(ti) * (/cm/.test(ti) ? 567 : /px/.test(ti) ? 15 : /em/.test(ti) ? st.fs * 20 : 20) : firstInd; if (f) o.ind = { first: f }; }
      return o;
    }
    function inlineOf(node, pr) { var s = ''; for (var c = node.firstChild; c; c = c.nextSibling) s += inl(c, pr); return s; }

    /* ---- جدول ---- */
    function tableXml(tb) {
      var rows = Array.prototype.slice.call(tb.rows), occ = [], cells = [], ncols = 0;
      rows.forEach(function (tr, r) {
        occ[r] = occ[r] || []; var c = 0;
        Array.prototype.slice.call(tr.cells).forEach(function (td) {
          while (occ[r][c]) c++;
          var cs = Math.max(1, parseInt(td.getAttribute('colspan'), 10) || 1), rs = Math.max(1, parseInt(td.getAttribute('rowspan'), 10) || 1);
          for (var i = 0; i < rs; i++) { occ[r + i] = occ[r + i] || []; for (var j = 0; j < cs; j++) occ[r + i][c + j] = i === 0 && j === 0 ? 'o' : 'c'; }
          cells.push({ td: td, r: r, c: c, cs: cs, rs: rs }); c += cs; ncols = Math.max(ncols, c);
        });
      });
      if (!ncols) return '';
      var widths = [], known = 0, unk = 0;
      for (var ci = 0; ci < ncols; ci++) {
        var w = 0; cells.forEach(function (ce) { if (ce.c === ci && ce.cs === 1 && !w) { var m = /^([\d.]+)(%|px|pt|cm)$/.exec(parseStyle(ce.td.getAttribute('style')).width || ''); if (m) w = Math.round(m[2] === '%' ? parseFloat(m[1]) / 100 * textW : m[2] === 'px' ? parseFloat(m[1]) * 15 : m[2] === 'pt' ? parseFloat(m[1]) * 20 : parseFloat(m[1]) * 567); } });
        widths[ci] = w; if (w) known += w; else unk++;
      }
      var rest = Math.max(0, textW - known); for (ci = 0; ci < ncols; ci++) if (!widths[ci]) widths[ci] = Math.round(unk ? rest / unk : textW / ncols);
      var tot = widths.reduce(function (a, b) { return a + b; }, 0); if (tot > textW) widths = widths.map(function (w) { return Math.floor(w * textW / tot); });
      var bsz = tb.getAttribute('data-b') === '2' ? 12 : 4, bval = tb.getAttribute('data-b') === '0' ? 'none' : 'single';
      var bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) { return '<w:' + s + ' w:val="' + bval + '" w:sz="' + bsz + '" w:space="0" w:color="000000"/>'; }).join('');
      var xml = '<w:tbl><w:tblPr><w:tblW w:w="' + widths.reduce(function (a, b) { return a + b; }, 0) + '" w:type="dxa"/><w:bidiVisual/><w:tblBorders>' + bd + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>';
      var headRows = 0; while (headRows < rows.length && rows[headRows].querySelector('th') && !rows[headRows].querySelector('td')) headRows++;
      rows.forEach(function (tr, r) {
        xml += '<w:tr><w:trPr><w:cantSplit/>' + (r < headRows && tb.getAttribute('data-nohead') !== '1' ? '<w:tblHeader/>' : '') + '</w:trPr>';
        var c = 0;
        while (c < ncols) {
          var ce = cells.filter(function (q) { return q.r === r && q.c === c; })[0];
          if (ce) {
            var td = ce.td, isH = td.tagName === 'TH', w2 = 0; for (var q = 0; q < ce.cs; q++) w2 += widths[ce.c + q];
            var inner = '', blocks = td.querySelectorAll(':scope > p,:scope > h4,:scope > h5,:scope > h6,:scope > ul,:scope > ol');
            var cpr = baseProps(); if (isH) cpr.b = true;
            var tsty = parseStyle(td.getAttribute('style'));
            var cal = tsty['text-align'] || (td.style && td.style.textAlign) || '';
            if (blocks.length) { Array.prototype.forEach.call(td.childNodes, function (ch) { if (ch.nodeType === 1 && /^(P|H4|H5|H6|LI)$/.test(ch.tagName)) inner += P(inlineOf(ch, cpr), { before: 0, after: 0, line: lineVal, jc: jcVal(parseStyle(ch.getAttribute('style'))['text-align'] || cal || 'right', false) }); else if (ch.nodeType === 3 && ch.nodeValue.trim()) inner += P(inl(ch, cpr), { before: 0, after: 0, line: lineVal, jc: jcVal(cal || 'right', false) }); }); }
            else inner = P(inlineOf(td, cpr), { before: 0, after: 0, line: lineVal, jc: jcVal(cal || 'right', false) });
            if (!inner) inner = P('', { before: 0, after: 0 });
            xml += '<w:tc><w:tcPr><w:tcW w:w="' + w2 + '" w:type="dxa"/>' + (ce.cs > 1 ? '<w:gridSpan w:val="' + ce.cs + '"/>' : '') + (ce.rs > 1 ? '<w:vMerge w:val="restart"/>' : '') + (isH ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F1F1"/>' : '') + '</w:tcPr>' + inner + '</w:tc>';
            c += ce.cs;
          } else if (occ[r] && occ[r][c] === 'c') {
            var owner = cells.filter(function (q2) { return q2.c === c && q2.r < r && q2.r + q2.rs > r; })[0], cs2 = owner ? owner.cs : 1, w3 = 0; for (var q3 = 0; q3 < cs2; q3++) w3 += widths[c + q3];
            xml += '<w:tc><w:tcPr><w:tcW w:w="' + w3 + '" w:type="dxa"/>' + (cs2 > 1 ? '<w:gridSpan w:val="' + cs2 + '"/>' : '') + '<w:vMerge/></w:tcPr>' + P('', { before: 0, after: 0 }) + '</w:tc>'; c += cs2;
          } else { xml += '<w:tc><w:tcPr><w:tcW w:w="' + widths[c] + '" w:type="dxa"/></w:tcPr>' + P('', { before: 0, after: 0 }) + '</w:tc>'; c++; }
        }
        xml += '</w:tr>';
      });
      return xml + '</w:tbl>';
    }

    /* ---- قوائم ---- */
    function listXml(ul, level, ctx) {
      var ordered = ul.tagName === 'OL', nid = 1;
      if (ordered) { nid = numId++; numDefs.push('<w:num w:numId="' + nid + '"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="' + (parseInt(ul.getAttribute('start'), 10) || 1) + '"/></w:lvlOverride></w:num>'); }
      var s = '';
      Array.prototype.forEach.call(ul.children, function (li) {
        if (li.tagName !== 'LI') return;
        var inner = '', subs = '';
        Array.prototype.forEach.call(li.childNodes, function (ch) { if (ch.nodeType === 1 && (ch.tagName === 'UL' || ch.tagName === 'OL')) subs += listXml(ch, level + 1, ctx); else inner += inl(ch, baseProps()); });
        s += P(inner, paraOpts(li, { numId: nid, ilvl: Math.min(level, 2), before: 0, ind: {} }));
        s += subs;
      });
      return s;
    }

    /* ---- كتلة واحدة ---- */
    function blockXml(b, ctx) {
      var t = b.tagName; ctx = ctx || {};
      if (b.hasAttribute('data-pgbrk')) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (b.getAttribute('data-figid')) return figXml(b);
      if (t === 'P' || t === 'BLOCKQUOTE') { var o = paraOpts(b, {}); if (t === 'BLOCKQUOTE') o.ind = { left: 720, right: 720 }; var pr = baseProps(); if (t === 'BLOCKQUOTE') pr.i = true; return P(inlineOf(b, pr), o); }
      if (t === 'H4' || t === 'H5' || t === 'H6') { var hp = baseProps(); hp.b = true; if (t === 'H4') hp.sz = baseSz + 4; else if (t === 'H5') hp.sz = baseSz + 2; else hp.i = true; return P(inlineOf(b, hp), paraOpts(b, { keepNext: true, ind: {} })); }
      if (t === 'UL' || t === 'OL') return listXml(b, 0, ctx);
      if (t === 'TABLE') {
        var cap = b.querySelector('caption'), ct = cap ? cap.textContent.trim() : '', s = '';
        if (cap) cap.remove();
        if (ct) { tblNo++; var cpr = baseProps(); cpr.b = true; cpr.sz = Math.round(baseSz * 0.95); s += P(runs('الجدول ' + tblNo + ': ' + ct, cpr), { style: 'Caption', keepNext: true, jc: 'center', before: beforeBase, line: lineVal }); }
        return s + tableXml(b) + P('', { before: 0, after: 0, line: 120 });
      }
      return '';
    }
    function figXml(fe) {
      var f = fe._f, im = f && imgs[f.imgId], md = f && addMedia(f.imgId); if (!md) return '';
      var w = f.w || im.w || 300, h = f.h || Math.round(w * (im.h || 1) / (im.w || 1)), sc = 1;
      if (w > textPx) sc = textPx / w; if (h * sc > textHpx - 80) sc = (textHpx - 80) / h; w = Math.round(w * sc); h = Math.round(h * sc);
      var jc = f.align === 'left' ? 'left' : f.align === 'right' ? 'right' : 'center', s = P(drawing(md.rid, w, h, picId++, 'صورة'), { keepNext: !!f.title, jc: jc, ltr: true, before: beforeBase, line: 240 });
      if (f.title) { figNo++; var cpr = baseProps(); cpr.b = true; cpr.sz = Math.round(baseSz * 0.92); s += P(runs('الشكل ' + figNo + ': ' + f.title, cpr), { style: 'Caption', jc: 'center', before: 60, after: 0, line: 240 }); }
      return s;
    }
    function makeFig(f) { var e = document.createElement('figure'); e.setAttribute('data-figid', f.id); e._f = f; return e; }
    function sectionBlocks(id, html) {
      var bl = H.blocks(RS.refs.refreshCites(paper, html)).filter(function (b) { return b.hasAttribute('data-pgbrk') || H.isPara(b) || b.tagName === 'TABLE'; });
      var il = RS.place.interleave(paper, id, bl, makeFig);
      return il.out.map(function (b) { return blockXml(b); }).join('');
    }
    function headingP(text, level, sz, o) {
      var pr = baseProps(); pr.b = true; pr.sz = Math.round(sz * 2); pr.color = '';
      return P(runs(text, pr), { style: 'Heading' + level, outline: level - 1, keepNext: true, jc: o && o.center ? 'center' : jcVal('right', false), before: 240, after: 120, line: 276, pbb: !!(o && o.pbb) });
    }

    /* ---------- تجميع الأقسام ---------- */
    var sectCover = '', sectMain = '';
    var hasCover = opt.cover !== false && !!paper.cover;
    var coverXml = '';
    function coverBuild() {
      if (!hasCover) return '';
      var sect = '<w:sectPr><w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>';
      if (opt.coverPng) {
        var id = 'cv'; imgs[id] = { data: opt.coverPng, w: Math.round(dim[0] * PX), h: Math.round(dim[1] * PX) };
        var md = addMedia(id);
        if (md) return P(drawing(md.rid, Math.round(dim[0] * PX), Math.round(dim[1] * PX), picId++, 'غلاف البحث'), { ltr: true, before: 0, after: 0, line: 240, jc: 'center', sect: sect });
      }
      /* غلاف نصي قابل للتعديل */
      var els = paper.cover.els.filter(function (e) { return e.k === 'text' || e.k === 'img'; }).sort(function (a, b) { return a.y - b.y; }), s = '', prev = 0, any = false;
      els.forEach(function (e) {
        var gap = Math.max(0, e.y - prev) * 15 * 0.8; prev = e.y + e.h;
        if (e.k === 'text') {
          if (e.need && e.need.some(function (k) { return !RS.cover.tokenValue(meta, k); })) return;
          var txt = RS.cover.fill(e.text, meta, false); if (!txt.trim()) return;
          var pr = { font: e.ff, sz: Math.round(e.fs * 1.5), b: e.b, i: e.i, u: e.u, color: hex(e.color) };
          txt.split('\n').forEach(function (ln, li) { s += P(runs(ln, pr), { jc: e.al === 'center' ? 'center' : e.al === 'left' ? jcVal('left', false) : jcVal('right', false), before: li === 0 ? gap : 0, after: 0, line: 276 }); });
          any = true;
        } else if (e.imgId) { var m2 = addMedia(e.imgId); if (m2) { s += P(drawing(m2.rid, e.w, e.h, picId++, 'شعار'), { jc: 'center', ltr: true, before: gap, line: 240 }); any = true; } }
      });
      s += P('', { before: 0, after: 0, sect: '<w:sectPr><w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"/><w:pgMar w:top="' + tw(st.mt * 10) + '" w:right="' + tw(st.mr * 10) + '" w:bottom="' + tw(st.mb * 10) + '" w:left="' + tw(st.ml * 10) + '" w:header="' + tw(st.mt * 5) + '" w:footer="' + tw(st.mb * 5) + '" w:gutter="0"/><w:cols w:space="720"/><w:bidi/></w:sectPr>' });
      return s;
    }
    bodyXml.push(coverBuild());

    /* الخطة */
    var introOn = opt.intro !== false && inSel('intro'), conclOn = opt.concl !== false && inSel('concl');
    var secs = nt.flat.filter(function (r) { return inSel(r.id); });
    var biblio = (opt.refs !== false && (paper.refs || []).length) ? RS.refs.biblio(paper) : null;
    var tabR = '<w:tab w:val="right" w:leader="dot" w:pos="' + textW + '"/>';
    function plainTitle(text) { var pr = baseProps(); pr.b = true; pr.sz = Math.round(st.h1 * 2); return P(runs(text, pr), { style: 'PlanTitle', jc: 'center', keepNext: true, before: 0, after: 240, line: 276 }); }
    var firstContent = true;
    if (opt.plan !== false) {
      bodyXml.push(P(runs(st.planTitle || 'خطة البحث', Object.assign(baseProps(), { b: true, sz: Math.round(st.h1 * 2) })), { style: 'PlanTitle', jc: 'center', keepNext: true, before: 0, after: 240, line: 276, pbb: !hasCover ? false : false }));
      function pEnt(text, depth, bold) { var pr = baseProps(); pr.b = !!bold; return P(runs(text, pr), { jc: jcVal('right', false), before: 120, after: 0, line: 276, ind: { left: depth * 400 } }); }
      if (introOn) bodyXml.push(pEnt(st.introTitle || 'مقدمة', 0, true));
      secs.forEach(function (r) { bodyXml.push(pEnt(r.text, Math.min(4, r.depth), r.type === 'chapter')); });
      if (conclOn) bodyXml.push(pEnt(st.conclTitle || 'خاتمة', 0, true));
      if (biblio) bodyXml.push(pEnt(st.refsTitle || 'قائمة المراجع', 0, true));
      firstContent = false;
    }
    /* الفهرس: حقل TOC حقيقي مع نتيجة مخزّنة بأرقام الصفحات المحسوبة */
    if (opt.toc) {
      var tocPara = [], ents = info.toc || [];
      tocPara.push(P(runs(st.tocTitle || 'الفهرس', Object.assign(baseProps(), { b: true, sz: Math.round(st.h1 * 2) })), { style: 'PlanTitle', jc: 'center', before: 0, after: 240, line: 276, pbb: !firstContent || hasCover }));
      var begin = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-4" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>';
      ents.forEach(function (e, i) {
        var lvl = Math.min(4, e.depth + 1), pr = baseProps(); pr.b = !!e.bold;
        var inner = (i === 0 ? begin : '') + runs(e.text, pr) + '<w:r><w:tab/></w:r>' + '<w:r>' + rPr({ font: font, sz: baseSz }) + '<w:t>' + x(info.nums[e.hid] || '') + '</w:t></w:r>' + (i === ents.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : '');
        tocPara.push(P(inner, { style: 'TOC' + lvl, tabs: tabR, jc: jcVal('right', false), before: 100, after: 0, line: 276, ind: { left: (lvl - 1) * 400 } }));
      });
      if (!ents.length) tocPara.push(P('', {}));
      if (opt.tocTables && info.tblList && info.tblList.length) { tocPara.push(P(runs('قائمة الجداول', Object.assign(baseProps(), { b: true, sz: Math.round(st.h2 * 2) })), { jc: 'center', before: 240, after: 120, keepNext: true })); info.tblList.forEach(function (t) { tocPara.push(P(runs('الجدول ' + t.no + ': ' + t.title, baseProps()) + '<w:r><w:tab/></w:r>' + runs(String(info.nums[t.tid] || ''), baseProps()), { tabs: tabR, jc: jcVal('right', false), before: 80, line: 276 })); }); }
      if (opt.tocFigs && info.figList && info.figList.length) { tocPara.push(P(runs('قائمة الصور والأشكال', Object.assign(baseProps(), { b: true, sz: Math.round(st.h2 * 2) })), { jc: 'center', before: 240, after: 120, keepNext: true })); info.figList.forEach(function (t) { tocPara.push(P(runs('الشكل ' + t.no + ': ' + t.title, baseProps()) + '<w:r><w:tab/></w:r>' + runs(String(info.nums['f' + t.id] || ''), baseProps()), { tabs: tabR, jc: jcVal('right', false), before: 80, line: 276 })); }); }
      bodyXml.push(tocPara.join('')); firstContent = false;
    }
    /* المقدمة */
    if (introOn) { bodyXml.push(headingP(st.introTitle || 'مقدمة', 1, st.h1, { center: true, pbb: true })); bodyXml.push(sectionBlocks('intro', paper.intro.html)); }
    /* المتن */
    var firstBody = true;
    secs.forEach(function (r) {
      var lvl = r.type === 'chapter' ? 1 : r.type === 'mabhath' ? 2 : r.type === 'matlab' ? 3 : 4;
      bodyXml.push(headingP(r.text, lvl, M.headingFont(st, r.type, r.depth), { center: r.type === 'chapter', pbb: (r.type === 'chapter' && st.chapNewPage) || (firstBody && !introOn) }));
      firstBody = false; bodyXml.push(sectionBlocks(r.id, r.sec.html));
    });
    if (conclOn) { bodyXml.push(headingP(st.conclTitle || 'خاتمة', 1, st.h1, { center: true, pbb: true })); bodyXml.push(sectionBlocks('concl', paper.concl.html)); }
    if (biblio) {
      bodyXml.push(headingP(st.refsTitle || 'قائمة المراجع', 1, st.h1, { center: true, pbb: true }));
      biblio.forEach(function (g) {
        if (g.head) bodyXml.push(P(runs(g.head, Object.assign(baseProps(), { b: true })), { jc: jcVal('right', false), before: 200, line: lineVal, keepNext: true }));
        g.items.forEach(function (it) {
          var d = new DOMParser().parseFromString('<body>' + it.html + '</body>', 'text/html');
          bodyXml.push(P(inlineOf(d.body, baseProps()), { jc: jcVal('right', false), before: 120, line: lineVal, ind: { left: 567, hang: 567 } }));
        });
      });
    }

    var startNum = st.numStart + (hasCover && st.numCover ? 1 : 0);
    var finalSect = '<w:sectPr><w:headerReference w:type="default" r:id="rId4"/><w:footerReference w:type="default" r:id="rId5"/><w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"' + (st.orient === 'landscape' ? ' w:orient="landscape"' : '') + '/><w:pgMar w:top="' + tw(st.mt * 10) + '" w:right="' + tw(st.mr * 10) + '" w:bottom="' + tw(st.mb * 10) + '" w:left="' + tw(st.ml * 10) + '" w:header="' + tw(st.mt * 5) + '" w:footer="' + tw(st.mb * 5) + '" w:gutter="0"/><w:pgNumType w:start="' + startNum + '"' + (st.numStyle === 'indic' ? ' w:fmt="hindiNumbers"' : '') + '/><w:cols w:space="720"/><w:bidi/></w:sectPr>';
    /* قسم الغلاف يحتاج ترويسة/تذييل فارغين: نعرّفهما عبر مرجع مستقل */
    var docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + bodyXml.join('') + finalSect + '</w:body></w:document>';

    /* ترويسة وتذييل */
    var pos = st.numPos || 'bottom-center', slot = pos.split('-')[1], isTop = pos.indexOf('top') === 0;
    var numP = '<w:p><w:pPr><w:jc w:val="' + (slot === 'left' ? 'left' : slot === 'right' ? 'right' : 'center') + '"/></w:pPr><w:r>' + rPr({ font: font, sz: 24 }) + '<w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r>' + rPr({ font: font, sz: 24 }) + '<w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    var htxt = (st.header || (st.hdrTitle ? (paper.title || meta.title || '') : '')), ftxt = st.footer;
    var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    var hdrXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' + (st.numOn && isTop ? numP : '') + (htxt ? P(runs(htxt, { font: font, sz: 22 }), { jc: 'center', before: 0, after: 0 }) : '') + (!(st.numOn && isTop) && !htxt ? '<w:p/>' : '') + '</w:hdr>';
    var ftrXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' + (ftxt ? P(runs(ftxt, { font: font, sz: 22 }), { jc: 'center', before: 0, after: 0 }) : '') + (st.numOn && !isTop ? numP : '') + (!ftxt && !(st.numOn && !isTop) ? '<w:p/>' : '') + '</w:ftr>';

    /* الأنماط */
    var fnt = '<w:rFonts w:ascii="' + x(font) + '" w:hAnsi="' + x(font) + '" w:cs="' + x(font) + '" w:eastAsia="' + x(font) + '"/>';
    function hs(id, name, lvl, sz) { return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="' + lvl + '"/></w:pPr><w:rPr>' + fnt + '<w:b/><w:bCs/><w:sz w:val="' + sz * 2 + '"/><w:szCs w:val="' + sz * 2 + '"/></w:rPr></w:style>'; }
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' + fnt + '<w:sz w:val="' + baseSz + '"/><w:szCs w:val="' + baseSz + '"/><w:lang w:val="ar-SA" w:eastAsia="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="0" w:line="' + lineVal + '" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      hs('Heading1', 'heading 1', 0, st.h1) + hs('Heading2', 'heading 2', 1, st.h2) + hs('Heading3', 'heading 3', 2, st.h3) + hs('Heading4', 'heading 4', 3, st.h4) +
      '<w:style w:type="paragraph" w:styleId="PlanTitle"><w:name w:val="Plan Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="35"/><w:qFormat/><w:rPr><w:b/><w:bCs/></w:rPr></w:style>' +
      [1, 2, 3, 4].map(function (n) { return '<w:style w:type="paragraph" w:styleId="TOC' + n + '"><w:name w:val="toc ' + n + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/></w:style>'; }).join('') +
      '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1D4ED8"/><w:u w:val="single"/></w:rPr></w:style></w:styles>';
    var numXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>' + [0, 1, 2].map(function (l) { return '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + l * 360) + '" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="' + x(font) + '" w:hAnsi="' + x(font) + '" w:cs="' + x(font) + '"/></w:rPr></w:lvl>'; }).join('') + '</w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' + [0, 1, 2].map(function (l) { return '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%' + (l + 1) + '."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + (720 + l * 360) + '" w:hanging="360"/></w:pPr></w:lvl>'; }).join('') + '</w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' + numDefs.join('') + '</w:numbering>';
    var settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    var relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + rels.join('') + '</Relationships>';
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
    var iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    var core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(paper.title || meta.title || '') + '</dc:title><dc:creator>' + x((meta.students || [])[0] || '') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified></cp:coreProperties>';
    var files = [{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rootRels }, { name: 'docProps/core.xml', data: core }, { name: 'word/document.xml', data: docXml }, { name: 'word/styles.xml', data: styles }, { name: 'word/numbering.xml', data: numXml }, { name: 'word/settings.xml', data: settingsXml }, { name: 'word/header1.xml', data: hdrXml }, { name: 'word/footer1.xml', data: ftrXml }, { name: 'word/_rels/document.xml.rels', data: relsXml }].concat(media);
    return X.zip(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  };
  /* صورة الغلاف PNG للتضمين في Word */
  X.coverPng = function (pageEl, st) {
    return L.pageToCanvas(pageEl, st, 2).then(function (c) { return c.toDataURL('image/png'); });
  };

  /* ------------------------------------------------------------------ TXT */
  X.txt = function (paper, imgs, opt, info) {
    opt = opt || {}; var st = paper.settings, meta = paper.meta, nt = M.numberTree(paper), out = [], tblNo = 0, figNo = 0, sel = opt.secIds || null;
    function inSel(id) { return !sel || sel[id]; }
    function inlineText(n) { return (n.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim(); }
    function makeFig(f) { var e = document.createElement('figure'); e.setAttribute('data-figid', f.id); e._f = f; return e; }
    function blocks(id, html) {
      var bl = H.blocks(RS.refs.refreshCites(paper, html)).filter(function (b) { return H.isPara(b) || b.tagName === 'TABLE'; });
      var il = RS.place.interleave(paper, id, bl, makeFig), lines = [];
      il.out.forEach(function (b) {
        if (b.getAttribute && b.getAttribute('data-figid')) { var f = b._f; if (f && f.title) { figNo++; lines.push('[الشكل ' + figNo + ': ' + f.title + ']'); } else lines.push('[صورة]'); return; }
        var t = b.tagName;
        if (t === 'UL') Array.prototype.forEach.call(b.querySelectorAll('li'), function (li) { lines.push('- ' + inlineText(li)); });
        else if (t === 'OL') { var n = parseInt(b.getAttribute('start'), 10) || 1; Array.prototype.forEach.call(b.querySelectorAll('li'), function (li) { lines.push((n++) + '. ' + inlineText(li)); }); }
        else if (t === 'TABLE') {
          var cap = b.querySelector('caption'), ct = cap ? cap.textContent.trim() : ''; if (ct) { tblNo++; lines.push('الجدول ' + tblNo + ': ' + ct); }
          Array.prototype.forEach.call(b.rows, function (tr) { lines.push(Array.prototype.map.call(tr.cells, function (c) { return inlineText(c); }).join(' | ')); });
        } else lines.push(inlineText(b));
        lines.push('');
      });
      return lines;
    }
    var bar = '='.repeat(40);
    if (opt.cover !== false) {
      [['title', ''], ['university', ''], ['faculty', ''], ['dept', ''], ['major', 'التخصص: '], ['level', 'المستوى: '], ['group', 'الفوج: ']].forEach(function (f) { var v = RS.cover.tokenValue(meta, f[0]); if (v) out.push(f[1] + v); });
      var stu = RS.cover.tokenValue(meta, 'students'); if (stu) { out.push('من إعداد الطلبة:'); stu.split('\n').forEach(function (s) { out.push('  ' + s); }); }
      if (meta.supervisor) out.push('تحت إشراف الأستاذ: ' + meta.supervisor);
      var ex = RS.cover.tokenValue(meta, 'extra'); if (ex) out.push(ex);
      if (meta.year) out.push('السنة الجامعية: ' + meta.year);
      out.push(bar, '');
    }
    var introOn = opt.intro !== false && inSel('intro'), conclOn = opt.concl !== false && inSel('concl'), secs = nt.flat.filter(function (r) { return inSel(r.id); });
    if (opt.plan !== false) { out.push(st.planTitle || 'خطة البحث', ''); if (introOn) out.push(st.introTitle || 'مقدمة'); secs.forEach(function (r) { out.push('  '.repeat(Math.min(4, r.depth)) + r.text); }); if (conclOn) out.push(st.conclTitle || 'خاتمة'); if (opt.refs !== false && paper.refs.length) out.push(st.refsTitle || 'قائمة المراجع'); out.push('', bar, ''); }
    if (opt.toc) { out.push(st.tocTitle || 'الفهرس', ''); (info && info.toc || []).forEach(function (e) { out.push('  '.repeat(e.depth) + e.text + (info.nums && info.nums[e.hid] ? ' ........ ' + info.nums[e.hid] : '')); }); out.push('', bar, ''); }
    if (introOn) { out.push(st.introTitle || 'مقدمة', '-'.repeat(20)); out = out.concat(blocks('intro', paper.intro.html)); }
    secs.forEach(function (r) { out.push(r.text, '-'.repeat(Math.min(40, Math.max(10, r.text.length)))); out = out.concat(blocks(r.id, r.sec.html)); });
    if (conclOn) { out.push(st.conclTitle || 'خاتمة', '-'.repeat(20)); out = out.concat(blocks('concl', paper.concl.html)); }
    if (opt.refs !== false && paper.refs.length) {
      out.push(bar, st.refsTitle || 'قائمة المراجع', '');
      var n = 0; RS.refs.biblio(paper).forEach(function (g) { if (g.head) out.push(g.head + ':'); g.items.forEach(function (it) { n++; out.push(n + '. ' + it.text); }); });
    }
    return '\ufeff' + out.join('\r\n').replace(/\r\n{3,}/g, '\r\n\r\n') + '\r\n';
  };

  /* ------------------------------------------- النسخ الاحتياطي والاستيراد */
  X.backup = function (paper, imgRecs) {
    var used = {}, images = {};
    function use(id) { if (id) used[id] = 1; }
    (paper.figs || []).forEach(function (f) { use(f.imgId); });
    (paper.cover && paper.cover.els || []).forEach(function (e) { if (e.k === 'img') use(e.imgId); });
    imgRecs.forEach(function (r) { if (used[r.id]) images[r.id] = { data: r.data, mime: r.mime, w: r.w, h: r.h, name: r.name || '' }; });
    var obj = { format: 'edu-research-backup', version: 1, created: Date.now(), app: 'eps-chlef-hub', paper: paper, images: images };
    return new Blob([JSON.stringify(obj)], { type: 'application/json' });
  };
  var MAXIMG = 15 * 1024 * 1024;
  function num(v, d, lo, hi) { v = +v; if (!isFinite(v)) return d; return Math.min(hi, Math.max(lo, v)); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n || 2000) : ''; }
  X.parseBackup = function (text) {
    var o; try { o = JSON.parse(text); } catch (e) { return { ok: false, msg: 'الملف ليس نسخة احتياطية صالحة (تعذّرت قراءته).' }; }
    if (!o || o.format !== 'edu-research-backup' || !o.paper || typeof o.paper !== 'object') return { ok: false, msg: 'هذا الملف ليس نسخة احتياطية لأداة إنشاء البحث.' };
    if (!(o.version >= 1 && o.version <= 1)) return { ok: false, msg: 'إصدار النسخة الاحتياطية غير مدعوم.' };
    var p = o.paper, warn = [];
    if (!Array.isArray(p.body) || typeof p.intro !== 'object' || typeof p.concl !== 'object') return { ok: false, msg: 'بنية البحث داخل الملف غير سليمة.' };
    var np = M.newPaper({ title: str(p.title, 200) || 'بحث مستورد' });
    var imgMap = {}, newImgs = [], i;
    var ims = o.images && typeof o.images === 'object' ? o.images : {};
    Object.keys(ims).forEach(function (k) {
      var im = ims[k]; if (!im || typeof im.data !== 'string') return;
      if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(im.data) || im.data.length > MAXIMG * 1.4) { warn.push('تم تجاهل صورة غير صالحة.'); return; }
      var nid = U.uid(); imgMap[k] = nid; newImgs.push({ id: nid, paperId: np.id, data: im.data, mime: (/^data:(image\/[a-z]+);/.exec(im.data) || [0, 'image/png'])[1], w: num(im.w, 300, 1, 20000), h: num(im.h, 200, 1, 20000), name: str(im.name, 100) });
    });
    np.status = ['draft', 'doing', 'done'].indexOf(p.status) >= 0 ? p.status : 'draft';
    np.created = num(p.created, Date.now(), 0, 4e12); np.modified = num(p.modified, Date.now(), 0, 4e12);
    var m = p.meta || {}; ['title', 'major', 'level', 'group', 'year', 'university', 'faculty', 'dept', 'supervisor'].forEach(function (k) { np.meta[k] = str(m[k], 300); });
    np.meta.students = (Array.isArray(m.students) ? m.students : []).slice(0, 30).map(function (s) { return str(s, 200); });
    np.meta.extra = (Array.isArray(m.extra) ? m.extra : []).slice(0, 20).map(function (e) { return { k: str(e && e.k, 100), v: str(e && e.v, 300) }; });
    var ds = M.defaultSettings(), s0 = p.settings || {}, sn = np.settings;
    Object.keys(ds).forEach(function (k) {
      if (typeof ds[k] === 'number') sn[k] = num(s0[k], ds[k], -1000, 1000); else if (typeof ds[k] === 'boolean') sn[k] = typeof s0[k] === 'boolean' ? s0[k] : ds[k]; else sn[k] = typeof s0[k] === 'string' ? s0[k].slice(0, 200) : ds[k];
    });
    sn.paper = M.PAPERS[sn.paper] ? sn.paper : 'A4'; sn.orient = sn.orient === 'landscape' ? 'landscape' : 'portrait'; sn.fs = num(sn.fs, 16, 6, 60); sn.lh = num(sn.lh, 1.5, 0.8, 4);
    ['mt', 'mb', 'ml', 'mr'].forEach(function (k) { sn[k] = num(sn[k], 2.5, 0, 8); });
    if (['justify', 'right', 'left', 'center'].indexOf(sn.align) < 0) sn.align = 'justify';
    if (!/^#[0-9a-fA-F]{6}$/.test(sn.color)) sn.color = '#000000';
    var posOK = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']; if (posOK.indexOf(sn.numPos) < 0) sn.numPos = 'bottom-center';
    sn.numStyle = sn.numStyle === 'indic' ? 'indic' : 'latin';
    np.cite = ['apa', 'mla', 'chicago', 'manual'].indexOf(p.cite) >= 0 ? p.cite : 'apa';
    np.toc = { on: !!(p.toc && p.toc.on), tables: !!(p.toc && p.toc.tables), figs: !!(p.toc && p.toc.figs) };
    np.intro.html = H.clean(str(p.intro.html, 5e6)); np.concl.html = H.clean(str(p.concl.html, 5e6));
    var idMap = {}, count = 0;
    function secs(arr, depth) {
      if (!Array.isArray(arr) || depth > 8) return [];
      return arr.slice(0, 500).map(function (s) {
        if (!s || typeof s !== 'object' || ++count > 3000) return null;
        var ty = M.TYPES.filter(function (t) { return t.k === s.type; }).length ? s.type : 'qism', n = M.newSection(ty, str(s.title, 300), H.clean(str(s.html, 5e6)));
        if (typeof s.id === 'string') idMap[s.id] = n.id; n.children = secs(s.children, depth + 1).filter(Boolean); return n;
      }).filter(Boolean);
    }
    np.body = secs(p.body, 0);
    idMap.intro = 'intro'; idMap.concl = 'concl';
    var refMap = {};
    np.refs = (Array.isArray(p.refs) ? p.refs : []).slice(0, 2000).map(function (r) {
      if (!r || typeof r !== 'object') return null; var n = RS.refs.newRef(RS.refs.TYPES.filter(function (t) { return t.k === r.type; }).length ? r.type : 'other');
      ['title', 'year', 'publisher', 'place', 'edition', 'journal', 'volume', 'issue', 'pages', 'url', 'site', 'accessed', 'univ', 'degree', 'manual'].forEach(function (k) { n[k] = str(r[k], 600); });
      n.authors = (Array.isArray(r.authors) ? r.authors : []).slice(0, 30).map(function (a) { return { f: str(a && a.f, 100), g: str(a && a.g, 100) }; });
      if (typeof r.id === 'string') refMap[r.id] = n.id; return n;
    }).filter(Boolean);
    function fixHtml(h) { return h.replace(/data-ref="([^"]+)"/g, function (m0, id) { return 'data-ref="' + (refMap[id] || id) + '"'; }); }
    np.intro.html = fixHtml(np.intro.html); np.concl.html = fixHtml(np.concl.html); M.walk(np.body, function (s) { s.html = fixHtml(s.html); });
    np.figs = (Array.isArray(p.figs) ? p.figs : []).slice(0, 2000).map(function (f) {
      if (!f || typeof f !== 'object' || !imgMap[f.imgId]) return null;
      var pl = f.place && typeof f.place === 'object' ? { sectionId: idMap[f.place.sectionId] || null, mode: ['afterTitle', 'start', 'end', 'afterPara', 'beforePara'].indexOf(f.place.mode) >= 0 ? f.place.mode : 'end', n: num(f.place.n, 0, 0, 10000), text: str(f.place.text, 500) } : null;
      if (pl && !pl.sectionId) pl = null;
      return { id: U.uid(), imgId: imgMap[f.imgId], title: str(f.title, 300), align: ['right', 'left', 'center'].indexOf(f.align) >= 0 ? f.align : 'center', w: num(f.w, 300, 20, 5000), h: num(f.h, 200, 20, 5000), lock: f.lock !== false, place: pl };
    }).filter(Boolean);
    if (p.cover && typeof p.cover === 'object' && Array.isArray(p.cover.els)) {
      np.cover = { tpl: str(p.cover.tpl, 30) || 'classic', accent: /^#[0-9a-fA-F]{6}$/.test(p.cover.accent) ? p.cover.accent : '#4c1d95', W: num(p.cover.W, 794, 100, 4000), H: num(p.cover.H, 1123, 100, 6000), els: [] };
      p.cover.els.slice(0, 200).forEach(function (e, ix) {
        if (!e || ['text', 'rect', 'img'].indexOf(e.k) < 0) return;
        var c = { id: U.uid(), k: e.k, x: num(e.x, 0, -2000, 6000), y: num(e.y, 0, -2000, 8000), w: num(e.w, 100, 1, 6000), h: num(e.h, 40, 1, 8000), z: num(e.z, ix, -100, 1000) };
        if (e.k === 'text') { c.text = str(e.text, 2000); c.ff = str(e.ff, 60) || 'Traditional Arabic'; c.fs = num(e.fs, 18, 6, 200); c.color = /^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#000000'; c.b = !!e.b; c.i = !!e.i; c.u = !!e.u; c.al = ['right', 'left', 'center'].indexOf(e.al) >= 0 ? e.al : 'center'; c.need = (Array.isArray(e.need) ? e.need : []).filter(function (k) { return /^\w+$/.test(k); }).slice(0, 5); }
        else if (e.k === 'rect') { c.bg = /^#[0-9a-fA-F]{6}$/.test(e.bg) ? e.bg : ''; c.bc = /^#[0-9a-fA-F]{6}$/.test(e.bc) ? e.bc : ''; c.bw = num(e.bw, 0, 0, 40); c.bs = ['solid', 'double', 'dashed', 'dotted'].indexOf(e.bs) >= 0 ? e.bs : 'solid'; }
        else { if (!imgMap[e.imgId]) return; c.imgId = imgMap[e.imgId]; c.fit = e.fit === 'cover' ? 'cover' : 'contain'; }
        np.cover.els.push(c);
      });
    }
    return { ok: true, paper: np, images: newImgs, info: { created: num(o.created, 0, 0, 4e12), title: np.title, sections: count, refs: np.refs.length, figs: np.figs.length, warn: warn } };
  };
})();
