/* ==========================================================================
   ocr-export.js — التصدير المحلي (TXT، Word .docx حقيقي، الطباعة / حفظ PDF)
   - يولّد ملف Word (.docx) حقيقياً ببنية OOXML كاملة مع دعم العربية RTL والإنجليزية LTR
     عبر مولّد ZIP (CRC32 + Store) مدمج دون أي مكتبات خارجية أو اتصال بالإنترنت.
   ========================================================================== */
(function () {
  'use strict';

  var crcTable = null;
  function crc32(u8) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) {
      crc = crcTable[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  var utf8 = new TextEncoder();

  function buildZip(files, mime) {
    var parts = [];
    var central = [];
    var offset = 0;
    var d = new Date();
    var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    var dd = (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

    files.forEach(function (f) {
      var name = utf8.encode(f.name);
      var data = typeof f.data === 'string' ? utf8.encode(f.data) : f.data;
      var crc = crc32(data);

      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); /* UTF-8 filenames */
      lh.setUint16(8, 0, true);      /* STORE */
      lh.setUint16(10, dt, true);
      lh.setUint16(12, dd, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);

      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true);
      ch.setUint16(14, dd, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);

      offset += 30 + name.length + data.length;
    });

    var csize = 0;
    central.forEach(function (c) { csize += c.byteLength || c.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true);
    end.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [end.buffer]), {
      type: mime || 'application/zip'
    });
  }

  function escXml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escHtml(s) {
    return escXml(s);
  }

  /* تنظيف المحارف غير المسموح بها في XML 1.0 */
  function cleanXmlText(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  }

  var AR_RANGE = '\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF';
  var RE_AR_ANY = new RegExp('[' + AR_RANGE + ']');
  var RE_AR_PIECE = new RegExp('[' + AR_RANGE + ']+|[^' + AR_RANGE + ']+', 'g');
  var RE_NEUTRAL = /^[\s\u00A0.,:;!?()\[\]\-–—"'«»،؛؟\/\d٠-٩%+=*_&@#<>]*$/;

  function detectTextDir(text, preferredDir) {
    if (preferredDir === 'rtl' || preferredDir === 'ltr') return preferredDir;
    return RE_AR_ANY.test(text || '') ? 'rtl' : 'ltr';
  }

  function segmentRuns(text, paraRtl) {
    var clean = cleanXmlText(text);
    if (!clean) return [];
    var pcs = clean.match(RE_AR_PIECE) || [];
    var out = [];
    pcs.forEach(function (p) {
      var isAr = RE_AR_ANY.test(p);
      if (isAr) {
        if (out.length && out[out.length - 1].rtl) out[out.length - 1].t += p;
        else out.push({ rtl: true, t: p });
      } else if (RE_NEUTRAL.test(p)) {
        if (paraRtl) {
          if (out.length && out[out.length - 1].rtl) out[out.length - 1].t += p;
          else out.push({ rtl: true, t: p, neutral: true });
        } else {
          if (out.length && !out[out.length - 1].rtl) out[out.length - 1].t += p;
          else out.push({ rtl: false, t: p, neutral: true });
        }
      } else {
        if (out.length && !out[out.length - 1].rtl) out[out.length - 1].t += p;
        else out.push({ rtl: false, t: p });
      }
    });
    for (var i = 0; i < out.length - 1; i++) {
      if (out[i].neutral && out[i + 1].rtl === paraRtl) {
        out[i + 1].t = out[i].t + out[i + 1].t;
        out.splice(i, 1);
        i--;
      }
    }
    return out;
  }

  function makeRunsXml(text, opts) {
    opts = opts || {};
    var sz = opts.sz || 24; /* 12pt */
    var font = opts.font || 'Arial';
    var paraRtl = opts.rtl !== false;
    var segs = segmentRuns(text, paraRtl);
    if (!segs.length) return '';
    return segs.map(function (sg) {
      var rpr = '<w:rPr>' +
        '<w:rFonts w:ascii="' + escXml(font) + '" w:hAnsi="' + escXml(font) + '" w:cs="' + escXml(font) + '" w:eastAsia="' + escXml(font) + '"/>' +
        (opts.bold ? '<w:b/><w:bCs/>' : '') +
        (opts.color ? '<w:color w:val="' + escXml(opts.color) + '"/>' : '') +
        '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>' +
        (sg.rtl ? '<w:rtl/>' : '') +
        '</w:rPr>';
      return '<w:r>' + rpr + '<w:t xml:space="preserve">' + escXml(sg.t) + '</w:t></w:r>';
    }).join('');
  }

  function makeParaXml(text, opts) {
    opts = opts || {};
    var dir = detectTextDir(text, opts.dir);
    var isRtl = dir === 'rtl';
    var jc = opts.jc || (isRtl ? 'right' : 'left');
    var ppr = '<w:pPr>' +
      (opts.style ? '<w:pStyle w:val="' + escXml(opts.style) + '"/>' : '') +
      (opts.keepNext ? '<w:keepNext/>' : '') +
      (isRtl ? '<w:bidi/>' : '') +
      '<w:spacing w:before="' + (opts.before != null ? opts.before : 0) + '" w:after="' + (opts.after != null ? opts.after : 120) + '" w:line="320" w:lineRule="auto"/>' +
      '<w:jc w:val="' + jc + '"/>' +
      '</w:pPr>';
    var inner = makeRunsXml(text, {
      sz: opts.sz,
      font: opts.font,
      bold: opts.bold,
      color: opts.color,
      rtl: isRtl
    });
    return '<w:p>' + ppr + inner + '</w:p>';
  }

  function buildDocxBlob(pages, title) {
    var docTitle = cleanXmlText(title || 'نص مستخرج من الصور');
    var body = [];

    if (docTitle) {
      var titleDir = detectTextDir(docTitle, 'auto');
      body.push(makeParaXml(docTitle, {
        dir: titleDir,
        jc: 'center',
        sz: 34,
        bold: true,
        color: '4C1D95',
        before: 0,
        after: 220,
        keepNext: true
      }));
    }

    (pages || []).forEach(function (pg, idx) {
      if (idx > 0) {
        body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      }
      var heading = pg.heading || ('الصفحة ' + (idx + 1) + (pg.name ? ' — ' + pg.name : ''));
      if (heading && (pages.length > 1 || pg.showHeading)) {
        body.push(makeParaXml(heading, {
          dir: detectTextDir(heading, 'auto'),
          sz: 26,
          bold: true,
          color: '6D28D9',
          before: idx === 0 ? 40 : 0,
          after: 140,
          keepNext: true
        }));
      }

      var raw = String(pg.text || '').replace(/\r\n?/g, '\n');
      var lines = raw.split('\n');
      if (!raw.trim()) {
        body.push(makeParaXml('— لا يوجد نص مستخرج لهذه الصفحة —', {
          dir: 'rtl',
          color: '666666',
          after: 140
        }));
      } else {
        lines.forEach(function (line) {
          if (!line.trim()) {
            body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="100"/></w:pPr></w:p>');
            return;
          }
          var lineDir = pg.dir && pg.dir !== 'auto' ? pg.dir : detectTextDir(line, 'auto');
          body.push(makeParaXml(line, {
            dir: lineDir,
            sz: 24,
            after: 100
          }));
        });
      }
    });

    /* قطاع الصفحة (A4، هوامش 20mm) */
    var sectPr = '<w:sectPr>' +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>' +
      '<w:cols w:space="720"/>' +
      '<w:bidi/>' +
      '</w:sectPr>';

    var docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body.join('') + sectPr + '</w:body></w:document>';

    var stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>' +
      '<w:sz w:val="24"/><w:szCs w:val="24"/>' +
      '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>' +
      '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '</w:styles>';

    var settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:defaultTabStop w:val="720"/>' +
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
      '</w:settings>';

    var relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '</Relationships>';

    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>';

    var ctXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>';

    var iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    var coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + escXml(docTitle) + '</dc:title>' +
      '<dc:creator>محوّل الصور إلى نصوص (OCR)</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified>' +
      '</cp:coreProperties>';

    return buildZip([
      { name: '[Content_Types].xml', data: ctXml },
      { name: '_rels/.rels', data: rootRels },
      { name: 'docProps/core.xml', data: coreXml },
      { name: 'word/document.xml', data: docXml },
      { name: 'word/styles.xml', data: stylesXml },
      { name: 'word/settings.xml', data: settingsXml },
      { name: 'word/_rels/document.xml.rels', data: relsXml }
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function sanitizeFilename(name, ext) {
    var base = String(name || 'ocr-text').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim();
    if (!base) base = 'ocr-text';
    return base + '.' + ext;
  }

  function downloadTxt(text, filename) {
    var normalized = '\ufeff' + String(text || '').replace(/\r?\n/g, '\r\n');
    var blob = new Blob([normalized], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, sanitizeFilename(filename, 'txt'));
  }

  function downloadDocx(pages, filename, title) {
    var blob = buildDocxBlob(pages, title);
    triggerDownload(blob, sanitizeFilename(filename, 'docx'));
    return blob;
  }

  /* طباعة أو حفظ بصيغة PDF عبر إطار iframe مستقل تماماً كما في بقية أدوات المنصة */
  function printPages(pages, title) {
    var old = document.getElementById('ocrPrintFrame');
    if (old) old.remove();

    var css = '@page{size:A4;margin:14mm}*{box-sizing:border-box}' +
      'body{margin:0;padding:0;color:#111;background:#fff;font-family:"Alexandria",Tahoma,Arial,sans-serif;line-height:1.85;font-size:14px}' +
      '.doc-title{font-size:20px;font-weight:700;text-align:center;color:#4C1D95;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #ddd}' +
      '.page-block{margin-bottom:18px}.page-block.brk{page-break-before:always}' +
      '.page-head{font-size:15px;font-weight:700;color:#5B21B6;margin:0 0 8px;padding:4px 8px;background:#F5F3FF;border-inline-start:4px solid #7C3AED}' +
      '.page-text{white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;font-size:14px;line-height:1.9}' +
      '.empty{color:#666;font-style:italic}';

    var htmlBody = '';
    if (title) {
      htmlBody += '<h1 class="doc-title" dir="' + detectTextDir(title, 'auto') + '">' + escHtml(title) + '</h1>';
    }
    (pages || []).forEach(function (pg, idx) {
      var cls = 'page-block' + (idx > 0 ? ' brk' : '');
      var heading = pg.heading || ('الصفحة ' + (idx + 1) + (pg.name ? ' — ' + pg.name : ''));
      var dir = pg.dir && pg.dir !== 'auto' ? pg.dir : detectTextDir(pg.text || '', 'auto');
      htmlBody += '<section class="' + cls + '">';
      if (heading && (pages.length > 1 || pg.showHeading)) {
        htmlBody += '<h2 class="page-head" dir="rtl">' + escHtml(heading) + '</h2>';
      }
      if (String(pg.text || '').trim()) {
        htmlBody += '<div class="page-text" dir="' + dir + '">' + escHtml(pg.text) + '</div>';
      } else {
        htmlBody += '<p class="empty" dir="rtl">— لا يوجد نص مستخرج لهذه الصفحة —</p>';
      }
      htmlBody += '</section>';
    });

    var iframe = document.createElement('iframe');
    iframe.id = 'ocrPrintFrame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);

    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      try {
        var w = iframe.contentWindow;
        w.focus();
        w.onafterprint = function () {
          setTimeout(function () { if (iframe.parentNode) iframe.remove(); }, 800);
        };
        w.print();
        setTimeout(function () { if (iframe.parentNode) iframe.remove(); }, 120000);
      } catch (e) {
        if (iframe.parentNode) iframe.remove();
      }
    }

    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' +
        escHtml(title || 'نصوص مستخرجة') + '</title><style>' + css + '</style></head><body>' + htmlBody + '</body></html>');
      doc.close();
    } catch (e) {
      iframe.remove();
      throw e;
    }

    iframe.onload = function () { setTimeout(fire, 150); };
    setTimeout(fire, 500);
  }

  window.OCRExport = {
    detectTextDir: detectTextDir,
    buildDocxBlob: buildDocxBlob,
    downloadTxt: downloadTxt,
    downloadDocx: downloadDocx,
    printPages: printPages
  };
})();
