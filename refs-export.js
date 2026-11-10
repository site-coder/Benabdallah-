/* ==========================================================================
   refs-export.js — تصدير قائمة المراجع: Word (DOCX حقيقي) · PDF · TXT · طباعة · نسخ الكل
   - بلا مكتبات خارجية ولا إنترنت ولا ذكاء اصطناعي (نفس منهج research-export.js / research-layout.js)
   - يعتمد على RF (refs-core.js): الترتيب الأبجدي وفق النمط + تنسيق كل مرجع + اتجاه كل مرجع (RTL/LTR)
   - لا يدرج أي زر أو عنصر واجهة في الملفات المصدَّرة: يبني وثيقة مستقلة من المراجع فقط
   - يُستدعى من refs-ui.js عبر RF.exp.run(kind, items, style, opts, notify)
   ========================================================================== */
(function (root) {
  'use strict';
  var RF = root.RF;
  if (!RF) return;
  var E = RF.exp = {};

  /* ------------------------------------------------------------------ الإعدادات */
  var KEY = 'tl_refs_exp_v1';
  var cfg = { hang: true, split: false };
  try {
    var saved = JSON.parse(root.localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') { cfg.hang = saved.hang !== false; cfg.split = saved.split === true; }
  } catch (e) { /* ignore */ }
  E.get = function () { return { hang: cfg.hang, split: cfg.split }; };
  E.set = function (k, v) {
    if (k !== 'hang' && k !== 'split') return;
    cfg[k] = !!v;
    try { root.localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  };

  /* عنوان القائمة وتباعد الأسطر لكل نمط (APA 7 · Harvard · MLA 9 · Chicago) */
  var AR_HEAD = 'قائمة المراجع';
  var STY = {
    apa: { en: 'References', ar: AR_HEAD, bold: true, center: true, line: 2, after: 0 },
    harvard: { en: 'Reference list', ar: AR_HEAD, bold: true, center: false, line: 1.5, after: 6 },
    mla: { en: 'Works Cited', ar: AR_HEAD, bold: false, center: true, line: 2, after: 0 },
    'chicago-ad': { en: 'References', ar: AR_HEAD, bold: false, center: true, line: 1, after: 12 },
    'chicago-nb': { en: 'Bibliography', ar: AR_HEAD, bold: false, center: true, line: 1, after: 12 }
  };

  var AR_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  var LAT_RE = /[A-Za-z0-9\u00C0-\u024F]/;

  /* ------------------------------------------------------------------ تحضير القائمة */
  /* دائماً أبجدية وفق قواعد النمط (بصرف النظر عن خيار الترتيب في الواجهة)، مع حروف التمييز a/b أو أ/ب */
  function prepare(items, style, opts) {
    var list = RF.formatList(items || [], style, { titleCase: !opts || opts.titleCase !== false, sort: 'alpha' });
    if (cfg.split) {
      var a = list.filter(function (o) { return o.dir === 'rtl'; }), b = list.filter(function (o) { return o.dir !== 'rtl'; });
      if (a.length && b.length) list = a.concat(b);
    }
    var nAr = list.filter(function (o) { return o.dir === 'rtl'; }).length;
    var ar = nAr >= list.length - nAr;
    var S = STY[style] || STY.apa;
    return { style: style, S: S, list: list, ar: ar, head: ar ? S.ar : S.en, hang: cfg.hang };
  }
  E.prepare = prepare;

  /* ------------------------------------------------------------------ HTML → مقاطع (مائل / اتجاه لاتيني ثابت) */
  function decode(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, '\u00A0').replace(/&amp;/g, '&');
  }
  function runsOf(html) {
    var parts = String(html || '').split(/(<[^>]*>)/), out = [], it = 0, bd = [];
    parts.forEach(function (p) {
      if (!p) return;
      if (p.charAt(0) === '<') {
        var m = /^<\s*(\/?)\s*([a-zA-Z0-9]+)([^>]*)>/.exec(p);
        if (!m) return;
        var tag = m[2].toLowerCase(), close = m[1] === '/';
        if (tag === 'i' || tag === 'em') it += close ? -1 : 1;
        else if (tag === 'bdi') { if (close) bd.pop(); else bd.push(/dir\s*=\s*["']?ltr/i.test(m[3])); }
        return;
      }
      var r = { t: decode(p), i: it > 0, ltr: bd.indexOf(true) > -1 }, last = out[out.length - 1];
      if (last && last.i === r.i && last.ltr === r.ltr) last.t += r.t; else out.push(r);
    });
    return out;
  }
  E._runsOf = runsOf;

  /* تقسيم النص إلى مقاطع عربية (rtl) ولاتينية/أرقام (ltr)؛ علامات الترقيم تتبع المقطع السابق */
  function segs(runs, paraRtl) {
    var out = [], cur = !!paraRtl;
    runs.forEach(function (r) {
      if (r.ltr) { out.push({ t: r.t, i: r.i, rtl: false, fixed: true }); cur = false; return; }
      for (var k = 0; k < r.t.length; k++) {
        var ch = r.t.charAt(k);
        if (AR_RE.test(ch)) cur = true; else if (LAT_RE.test(ch)) cur = false;
        var last = out[out.length - 1];
        if (last && !last.fixed && last.i === r.i && last.rtl === cur) last.t += ch;
        else out.push({ t: ch, i: r.i, rtl: cur });
      }
    });
    return out;
  }

  /* ------------------------------------------------------------------ ZIP (بلا ضغط) */
  var crcT = null;
  function crc32(u8) {
    if (!crcT) {
      crcT = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) crc = crcT[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files, mime) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, d = new Date();
    var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    var dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    });
    var csize = 0; central.forEach(function (c) { csize += c.byteLength || c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: mime });
  }

  /* ------------------------------------------------------------------ DOCX */
  function x(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  var FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';

  function wRun(t, o) {
    if (!t) return '';
    return '<w:r><w:rPr>' + FONT + (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') +
      '<w:sz w:val="' + (o.sz || 24) + '"/><w:szCs w:val="' + (o.szCs || 28) + '"/>' + (o.rtl ? '<w:rtl/>' : '') +
      '</w:rPr><w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
  }
  function wPara(o, P) {
    var S = P.S, rtl = o.dir === 'rtl';
    var ppr = '<w:pPr>' + (rtl ? '<w:bidi/>' : '') +
      '<w:spacing w:before="0" w:after="' + Math.round(S.after * 20) + '" w:line="' + Math.round(S.line * 240) + '" w:lineRule="auto"/>' +
      (P.hang ? '<w:ind w:left="720" w:hanging="720"/>' : '') + '</w:pPr>';
    var body = segs(runsOf(o.html), rtl).map(function (s) { return wRun(s.t, { i: s.i, rtl: s.rtl }); }).join('');
    return '<w:p>' + ppr + body + '</w:p>';
  }
  function wHeading(P) {
    var S = P.S, rtl = P.ar;
    var jc = S.center ? '<w:jc w:val="center"/>' : (rtl ? '' : '<w:jc w:val="left"/>');
    return '<w:p><w:pPr><w:keepNext/>' + (rtl ? '<w:bidi/>' : '') + '<w:spacing w:before="0" w:after="240" w:line="240" w:lineRule="auto"/>' + jc + '<w:outlineLvl w:val="0"/></w:pPr>' +
      segs([{ t: P.head, i: false, ltr: false }], rtl).map(function (s) { return wRun(s.t, { b: S.bold, rtl: s.rtl, sz: 28, szCs: 28 }); }).join('') + '</w:p>';
  }
  function docx(P) {
    var W = 'http://schemas.openxmlformats.org/', REL = W + 'package/2006/relationships', OD = W + 'officeDocument/2006/relationships';
    var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var doc = head + '<w:document ' + NS + '><w:body>' + wHeading(P) + P.list.map(function (o) { return wPara(o, P); }).join('') +
      '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    var styles = head + '<w:styles ' + NS + '><w:docDefaults><w:rPrDefault><w:rPr>' + FONT + '<w:sz w:val="24"/><w:szCs w:val="28"/>' +
      '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>';
    var footer = head + '<w:ftr ' + NS + '><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr>' + FONT + '<w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
    var ct = head + '<Types xmlns="' + W + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    var rels = head + '<Relationships xmlns="' + REL + '"><Relationship Id="rId1" Type="' + OD + '/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="' + W + 'package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
    var drels = head + '<Relationships xmlns="' + REL + '"><Relationship Id="rId1" Type="' + OD + '/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="' + OD + '/footer" Target="footer1.xml"/></Relationships>';
    var core = head + '<cp:coreProperties xmlns:cp="' + W + 'package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + x(P.head) + '</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>';
    return zip([
      { name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels }, { name: 'docProps/core.xml', data: core },
      { name: 'word/document.xml', data: doc }, { name: 'word/_rels/document.xml.rels', data: drels },
      { name: 'word/styles.xml', data: styles }, { name: 'word/footer1.xml', data: footer }
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  E._docx = docx;

  /* ------------------------------------------------------------------ TXT */
  function txt(P) {
    var s = P.head + '\r\n\r\n' + P.list.map(function (o) { return o.text; }).join('\r\n\r\n') + '\r\n';
    return new Blob(['\uFEFF' + s], { type: 'text/plain;charset=utf-8' });
  }

  /* ------------------------------------------------------------------ HTML للطباعة / PDF */
  function h(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var FF = '"Times New Roman","Noto Naskh Arabic","Traditional Arabic","Amiri",Tahoma,serif';
  function css(P, mode) {
    var S = P.S, ind = P.hang ? '0.5in' : '0';
    var c = 'html,body{margin:0;padding:0;background:#fff;color:#000}body{font-family:' + FF + ';font-size:12pt}' +
      '*{box-sizing:border-box}' +
      'h1{font-size:14pt;font-weight:' + (S.bold ? 700 : 400) + ';text-align:' + (S.center ? 'center' : 'start') + ';margin:0 0 12pt;line-height:1.3;page-break-after:avoid}' +
      'p.r{margin:0 0 ' + S.after + 'pt;line-height:' + S.line + ';font-size:12pt;text-align:start;padding-inline-start:' + ind + ';text-indent:-' + ind + ';overflow-wrap:anywhere;orphans:2;widows:2}' +
      'p.r[dir=rtl]{font-size:14pt}p.r i{font-style:italic}bdi{unicode-bidi:isolate}';
    if (mode === 'measure') c += 'body{width:602px}';
    return c;
  }
  function bodyHtml(P) {
    return '<h1 dir="' + (P.ar ? 'rtl' : 'ltr') + '">' + h(P.head) + '</h1>' + P.list.map(function (o) {
      return '<p class="r" dir="' + o.dir + '" lang="' + (o.lang || (o.dir === 'rtl' ? 'ar' : 'en')) + '">' + o.html + '</p>';
    }).join('');
  }
  function docHtml(P, mode) {
    var extra = mode === 'print' ? '@page{size:A4;margin:25.4mm}' : '';
    return '<!doctype html><html lang="' + (P.ar ? 'ar' : 'en') + '"><head><meta charset="utf-8"><title>' + h(P.head) + '</title><style>' + extra + css(P, mode) + '</style></head><body>' + bodyHtml(P) + '</body></html>';
  }

  /* ------------------------------------------------------------------ الطباعة (إطار مستقل: لا تظهر واجهة الأداة) */
  function printDoc(P) {
    return new Promise(function (resolve, reject) {
      var f = document.createElement('iframe'), fired = false;
      f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1');
      f.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(f);
      function rm() { setTimeout(function () { if (f.parentNode) f.remove(); }, 1000); }
      function fire() {
        if (fired) return; fired = true;
        try {
          var w = f.contentWindow; w.focus();
          w.onafterprint = function () { rm(); resolve(); };
          w.print();
          setTimeout(function () { rm(); resolve(); }, 120000);
        } catch (e) { rm(); reject(e); }
      }
      try {
        var d = f.contentDocument || f.contentWindow.document;
        d.open(); d.write(docHtml(P, 'print')); d.close();
      } catch (e) { rm(); reject(e); return; }
      f.onload = function () { setTimeout(fire, 150); };
      setTimeout(fire, 700);
    });
  }

  /* ------------------------------------------------------------------ PDF مباشر (صفحات A4 → JPEG → ملف PDF يدوي) */
  var PW = 794, PH = 1123, PM = 96, SC = 2; /* A4 بالبكسل عند 96dpi، هامش 1 بوصة، دقة ×2 */
  function paginate(P) {
    return new Promise(function (resolve, reject) {
      var f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + PW + 'px;height:' + PH + 'px;border:0;visibility:hidden';
      document.body.appendChild(f);
      function fail(e) { if (f.parentNode) f.remove(); reject(e); }
      try {
        var d = f.contentDocument; d.open(); d.write(docHtml(P, 'measure')); d.close();
      } catch (e) { fail(e); return; }
      function go() {
        try {
          var w = f.contentWindow, kids = [].slice.call(d.body.children), pages = [[]], y = 0, HH = PH - 2 * PM;
          kids.forEach(function (el) {
            var r = el.getBoundingClientRect().height, mb = parseFloat(w.getComputedStyle(el).marginBottom) || 0;
            if (y > 0 && y + r > HH) { pages.push([]); y = 0; }
            pages[pages.length - 1].push({ el: el, bottom: mb });
            y += r + mb;
          });
          for (var i = 0; i < pages.length - 1; i++) { /* لا يبقى العنوان وحيداً في آخر الصفحة */
            var pg = pages[i];
            if (pg.length > 1 && pg[pg.length - 1].el.tagName === 'H1') pages[i + 1].unshift(pg.pop());
          }
          var ser = new w.XMLSerializer();
          var out = pages.map(function (pg) { return pg.map(function (k) { return ser.serializeToString(k.el); }).join(''); });
          f.remove();
          resolve(out);
        } catch (e) { fail(e); }
      }
      if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { setTimeout(go, 60); }, function () { setTimeout(go, 150); });
      else setTimeout(go, 200);
    });
  }
  function pageCanvas(inner, n, P) {
    return new Promise(function (resolve, reject) {
      var style = css(P, 'pdf') + '.pg{position:relative;width:' + PW + 'px;height:' + PH + 'px;padding:' + PM + 'px;background:#fff;color:#000;font-family:' + FF + ';font-size:12pt}' +
        '.pn{position:absolute;left:0;right:0;bottom:44px;text-align:center;font-size:10pt;direction:ltr}';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + PW + '" height="' + PH + '"><foreignObject x="0" y="0" width="' + PW + '" height="' + PH + '">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" class="pg"><style>' + style + '</style>' + inner + '<div class="pn">' + n + '</div></div></foreignObject></svg>';
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = PW * SC; c.height = PH * SC;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL('image/jpeg', 0.9); /* قد يرمي استثناء أمنياً في بعض المتصفحات */
          c.width = c.height = 0;
          var bin = atob(url.split(',')[1]), u = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          resolve(u);
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('svg')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function buildPdf(jpgs, wpx, hpx, wpt, hpt) {
    var parts = [], off = [], len = 0, n = jpgs.length, kids = [], i;
    function str(t) { var u = new Uint8Array(t.length); for (var k = 0; k < t.length; k++) u[k] = t.charCodeAt(k) & 255; return u; }
    function push(v) { if (typeof v === 'string') v = str(v); parts.push(v); len += v.length; }
    for (i = 0; i < n; i++) kids.push((3 + 3 * i) + ' 0 R');
    push('%PDF-1.4\n'); off[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    off[2] = len; push('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n');
    for (i = 0; i < n; i++) {
      var pg = 3 + 3 * i, ct = 4 + 3 * i, im = 5 + 3 * i, cs = 'q ' + wpt + ' 0 0 ' + hpt + ' 0 0 cm /Im0 Do Q';
      off[pg] = len; push(pg + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + wpt + ' ' + hpt + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>\nendobj\n');
      off[ct] = len; push(ct + ' 0 obj\n<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream\nendobj\n');
      off[im] = len; push(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + wpx + ' /Height ' + hpx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpgs[i].length + ' >>\nstream\n');
      push(jpgs[i]); push('\nendstream\nendobj\n');
    }
    var total = 3 + 3 * n, xr = len, t = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (i = 1; i < total; i++) t += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
    push(t + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function pdf(P) {
    return paginate(P).then(function (pages) {
      var jpgs = [], i = 0;
      return new Promise(function (resolve, reject) {
        (function next() {
          if (i >= pages.length) { resolve(buildPdf(jpgs, PW * SC, PH * SC, 595.28, 841.89)); return; }
          pageCanvas(pages[i], i + 1, P).then(function (u) { jpgs.push(u); i++; setTimeout(next, 0); }, reject);
        })();
      });
    });
  }

  /* ------------------------------------------------------------------ تنزيل + نسخ HTML */
  function save(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { if (a.parentNode) a.remove(); URL.revokeObjectURL(u); }, 5000);
  }
  /* فقرات اللصق في Word: مسافة بادئة معلّقة + اتجاه كل مرجع */
  E.clipboardHtml = function (list, hang) {
    return list.map(function (o) {
      var rtl = o.dir === 'rtl';
      return '<p dir="' + o.dir + '" style="text-align:' + (rtl ? 'right' : 'left') + ';margin:0 0 8pt;' +
        (hang ? 'margin-' + (rtl ? 'right' : 'left') + ':36pt;text-indent:-36pt;' : '') + '">' + o.html + '</p>';
    }).join('');
  };
  /* كل المراجع (بدون تأثر بالبحث) مرتبة وفق النمط: للنسخ دفعة واحدة */
  E.listForCopy = function (items, style, opts) { return prepare(items, style, opts).list; };

  /* ------------------------------------------------------------------ نقطة الدخول */
  var busy = false;
  E.run = function (kind, items, style, opts, notify) {
    notify = notify || function () {};
    if (busy) return Promise.resolve();
    var P = prepare(items, style, opts);
    if (!P.list.length) { notify('لا توجد مراجع للتصدير'); return Promise.resolve(); }
    var base = 'references-' + style;
    busy = true;
    function fin() { busy = false; }
    function failMsg(e) { fin(); notify('تعذّر التصدير على هذا المتصفح. جرّب زر «طباعة» ثم «حفظ بصيغة PDF».'); try { console.error(e); } catch (x1) { /* ignore */ } }
    try {
      if (kind === 'docx') { save(docx(P), base + '.docx'); fin(); notify('تم تنزيل ملف Word'); return Promise.resolve(); }
      if (kind === 'txt') { save(txt(P), base + '.txt'); fin(); notify('تم تنزيل ملف TXT'); return Promise.resolve(); }
      if (kind === 'print') {
        return printDoc(P).then(fin, failMsg);
      }
      if (kind === 'pdf') {
        notify('جارٍ إنشاء ملف PDF…', 60000);
        return pdf(P).then(function (b) { save(b, base + '.pdf'); fin(); notify('تم تنزيل ملف PDF'); }, function (e) {
          /* بعض المتصفحات تمنع رسم الصفحة؛ نفتح نافذة الطباعة ليختار المستخدم «حفظ بصيغة PDF» */
          notify('تعذّر إنشاء PDF مباشرة هنا؛ ستُفتح الطباعة: اختر «حفظ بصيغة PDF».', 4000);
          return printDoc(P).then(fin, failMsg);
        });
      }
    } catch (e) { failMsg(e); }
    fin();
    return Promise.resolve();
  };
})(typeof window !== 'undefined' ? window : globalThis);
