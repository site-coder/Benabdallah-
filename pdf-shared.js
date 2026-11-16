/* ==========================================================================
   pdf-shared.js — أدوات مشتركة محلية لقراءة ومعالجة ملفات PDF
   - يستفيد من مكتبة PDF.js الموجودة مسبقاً في vendor/ دون تكرارها
   - يحمّل pdf-lib.min.js محلياً عند الحاجة دون أي CDN أو اتصال خارجي
   - يوفّر بصمة ثابتة لكل ملف (SHA-256) لضمان عدم اختلاط الملفات متشابهة الأسماء
   - يوفّر أدوات الرسم العربي RTL على Canvas ومولّد أرشيف ZIP محلي
   ========================================================================== */
(function (root) {
  'use strict';

  var pdfjsPromise = null;
  var pdfLibPromise = null;

  function baseUrl(rel) {
    try {
      return new URL(rel, document.baseURI).href;
    } catch (e) {
      return rel;
    }
  }

  function loadPdfJs() {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = import(baseUrl('./vendor/pdf.min.mjs')).then(function (m) {
      if (m && m.GlobalWorkerOptions) {
        m.GlobalWorkerOptions.workerSrc = baseUrl('./vendor/pdf.worker.min.mjs');
      }
      return m;
    });
    pdfjsPromise.catch(function () { pdfjsPromise = null; });
    return pdfjsPromise;
  }

  function loadPdfLib() {
    if (root.PDFLib && root.PDFLib.PDFDocument) {
      return Promise.resolve(root.PDFLib);
    }
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-pdflib="1"]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (root.PDFLib) resolve(root.PDFLib);
          else reject(new Error('تعذّر تهيئة مكتبة pdf-lib المحلية'));
        });
        existing.addEventListener('error', function () {
          pdfLibPromise = null;
          reject(new Error('تعذّر تحميل ملف vendor/pdf-lib.min.js'));
        });
        return;
      }
      var s = document.createElement('script');
      s.src = baseUrl('./vendor/pdf-lib.min.js');
      s.setAttribute('data-pdflib', '1');
      s.onload = function () {
        if (root.PDFLib && root.PDFLib.PDFDocument) resolve(root.PDFLib);
        else {
          pdfLibPromise = null;
          reject(new Error('تعذّر تهيئة مكتبة pdf-lib المحلية'));
        }
      };
      s.onerror = function () {
        pdfLibPromise = null;
        reject(new Error('تعذّر تحميل ملف vendor/pdf-lib.min.js'));
      };
      document.head.appendChild(s);
    });
    return pdfLibPromise;
  }

  /* فتح مستند PDF عبر نسخة من البيانات كي لا يتعطّل المخزن الأصلي عند نقله للـ Worker */
  function openPdfDoc(bytes, extraOpts) {
    return loadPdfJs().then(function (pdfjs) {
      var copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes).slice();
      var opts = Object.assign({ data: copy, verbosity: 0 }, extraOpts || {});
      return pdfjs.getDocument(opts).promise;
    });
  }

  /* معرّف ثابت للملف بالبصمة الرقمية لمحتواه + حجمه */
  async function computeFileId(u8) {
    var bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
    var len = bytes.byteLength;
    if (root.crypto && root.crypto.subtle && typeof root.crypto.subtle.digest === 'function') {
      try {
        var digest = await root.crypto.subtle.digest('SHA-256', bytes);
        var arr = new Uint8Array(digest);
        var hex = '';
        for (var i = 0; i < arr.length; i++) {
          hex += (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
        }
        return 'pdf_' + hex.slice(0, 32) + '_' + len;
      } catch (e) { /* fallback below */ }
    }
    /* بديل حتمي في حال عدم توفر WebCrypto */
    var h1 = 0x811c9dc5;
    var h2 = 0x01000193;
    var step = Math.max(1, Math.floor(len / 8192));
    for (var j = 0; j < len; j += step) {
      h1 ^= bytes[j];
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= bytes[len - 1 - j];
      h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    }
    return 'pdf_' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + '_' + len;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function toLatinDigits(str) {
    return String(str == null ? '' : str)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); });
  }

  function normalizeArabic(s) {
    return toLatinDigits(String(s || '').toLowerCase())
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  }

  function formatBytes(bytes) {
    var b = Number(bytes) || 0;
    if (b < 1024) return b + ' بايت';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' ك.ب';
    return (b / 1048576).toFixed(2) + ' م.ب';
  }

  function formatDateTime(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString('ar-DZ-u-nu-latn', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  function sanitizeFilename(name, ext) {
    var base = String(name || 'document')
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    if (!base) base = 'document';
    return ext ? (base + '.' + ext) : base;
  }

  function downloadBlob(blob, filename) {
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

  function dataUrlToU8(dataUrl) {
    var parts = String(dataUrl || '').split(',');
    var bin = atob(parts[1] || '');
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function hasArabic(text) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || ''));
  }

  /* تحليل نطاقات الصفحات: مثال "1-3, 5, 8-10" (يدعم الأرقام والفاصلة العربية) */
  function parsePageRanges(input, maxPage) {
    var raw = toLatinDigits(String(input || '').trim())
      .replace(/[،؛]/g, ',')
      .replace(/[–—]/g, '-');
    if (!raw) return { ok: false, pages: [], error: 'أدخل أرقام أو نطاقات الصفحات (مثال: 1-3, 5).' };
    var tokens = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!tokens.length) return { ok: false, pages: [], error: 'أدخل أرقام الصفحات بشكل صحيح.' };

    var pages = [];
    var seen = Object.create(null);
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      var mRange = /^(\d+)\s*-\s*(\d+)$/.exec(tk);
      if (mRange) {
        var a = parseInt(mRange[1], 10);
        var b = parseInt(mRange[2], 10);
        if (a < 1 || b < 1 || a > maxPage || b > maxPage) {
          return { ok: false, pages: [], error: 'النطاق «' + tk + '» خارج حدود الصفحات (1 إلى ' + maxPage + ').' };
        }
        var step = a <= b ? 1 : -1;
        for (var p = a; step > 0 ? p <= b : p >= b; p += step) {
          if (!seen[p]) { seen[p] = true; pages.push(p); }
        }
      } else if (/^\d+$/.test(tk)) {
        var single = parseInt(tk, 10);
        if (single < 1 || single > maxPage) {
          return { ok: false, pages: [], error: 'الصفحة رقم ' + single + ' خارج حدود الملف (1 إلى ' + maxPage + ').' };
        }
        if (!seen[single]) { seen[single] = true; pages.push(single); }
      } else {
        return { ok: false, pages: [], error: 'صيغة غير مفهومة في «' + tk + '». استخدم أرقاماً ونطاقات مثل 1-4, 6.' };
      }
    }
    return { ok: true, pages: pages, error: '' };
  }

  /* تحويل اللون السداسي إلى RGB بين 0 و 1 لمكتبة pdf-lib */
  function hexToRgb01(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) {
      var m3 = /^#?([0-9a-f]{3})$/i.exec(String(hex || '').trim());
      if (!m3) return { r: 0, g: 0, b: 0 };
      var s = m3[1];
      return {
        r: parseInt(s[0] + s[0], 16) / 255,
        g: parseInt(s[1] + s[1], 16) / 255,
        b: parseInt(s[2] + s[2], 16) / 255
      };
    }
    var n = m[1];
    return {
      r: parseInt(n.slice(0, 2), 16) / 255,
      g: parseInt(n.slice(2, 4), 16) / 255,
      b: parseInt(n.slice(4, 6), 16) / 255
    };
  }

  /* رسم نص (عربي RTL أو مختلط) على Canvas بدقة عالية وإرجاعه كصورة PNG لدمجه في PDF */
  function renderTextToPng(opts) {
    opts = opts || {};
    var text = String(opts.text || '');
    var fontSize = Math.max(8, Number(opts.fontSize) || 14);
    var scale = Math.max(1, Math.min(4, Number(opts.scale) || 3));
    var fontFamily = opts.fontFamily || 'Alexandria, Tahoma, Arial, sans-serif';
    var bold = !!opts.bold;
    var color = opts.color || '#111111';
    var padX = opts.paddingX != null ? opts.paddingX : 6;
    var padY = opts.paddingY != null ? opts.paddingY : 4;
    var rtl = opts.rtl != null ? !!opts.rtl : hasArabic(text);
    var maxW = opts.maxWidth ? Math.max(40, Number(opts.maxWidth)) : 0;

    var probe = document.createElement('canvas');
    var pctx = probe.getContext('2d');
    var fontSpec = (bold ? '700 ' : '400 ') + fontSize + 'px ' + fontFamily;
    pctx.font = fontSpec;

    var rawLines = text.replace(/\r/g, '').split('\n');
    var lines = [];
    rawLines.forEach(function (ln) {
      if (!maxW || pctx.measureText(ln).width <= maxW) {
        lines.push(ln);
        return;
      }
      var words = ln.split(/\s+/).filter(Boolean);
      var cur = '';
      words.forEach(function (w) {
        var cand = cur ? (cur + ' ' + w) : w;
        if (pctx.measureText(cand).width <= maxW) {
          cur = cand;
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      });
      if (cur) lines.push(cur);
    });
    if (!lines.length) lines.push('');

    var maxLineW = 1;
    lines.forEach(function (ln) {
      var w = pctx.measureText(ln).width;
      if (w > maxLineW) maxLineW = w;
    });

    var lineHeight = Math.round(fontSize * 1.45);
    var logicalW = Math.ceil((maxW && opts.fixedWidth ? maxW : maxLineW) + padX * 2);
    var logicalH = Math.ceil(lines.length * lineHeight + padY * 2);

    var cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.ceil(logicalW * scale));
    cv.height = Math.max(2, Math.ceil(logicalH * scale));
    var ctx = cv.getContext('2d');
    ctx.scale(scale, scale);

    if (opts.bgColor) {
      ctx.fillStyle = opts.bgColor;
      if (opts.radius) {
        var r = Math.min(opts.radius, logicalW / 2, logicalH / 2);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(logicalW - r, 0);
        ctx.quadraticCurveTo(logicalW, 0, logicalW, r);
        ctx.lineTo(logicalW, logicalH - r);
        ctx.quadraticCurveTo(logicalW, logicalH, logicalW - r, logicalH);
        ctx.lineTo(r, logicalH);
        ctx.quadraticCurveTo(0, logicalH, 0, logicalH - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, logicalW, logicalH);
      }
    }
    if (opts.borderColor) {
      ctx.strokeStyle = opts.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, logicalW - 1, logicalH - 1);
    }

    ctx.font = fontSpec;
    ctx.fillStyle = color;
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textBaseline = 'middle';

    var align = opts.align || (rtl ? 'right' : 'left');
    ctx.textAlign = align;
    var tx = align === 'center' ? logicalW / 2 : (align === 'right' ? logicalW - padX : padX);

    lines.forEach(function (ln, idx) {
      var ty = padY + lineHeight * (idx + 0.5);
      ctx.fillText(ln, tx, ty);
    });

    return {
      bytes: dataUrlToU8(cv.toDataURL('image/png')),
      width: logicalW,
      height: logicalH,
      pixelW: cv.width,
      pixelH: cv.height
    };
  }

  /* مولّد أرشيف ZIP محلي (CRC32 + Store) لتنزيل ملفات متعددة دفعة واحدة */
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
    for (var i = 0; i < u8.length; i++) crc = crcTable[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(files, mime) {
    var utf8 = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;
    var d = new Date();
    var dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    var dd = (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

    files.forEach(function (f) {
      var name = utf8.encode(f.name);
      var data = typeof f.data === 'string' ? utf8.encode(f.data) : (f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data));
      var crc = crc32(data);

      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
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

    return new Blob(parts.concat(central, [end.buffer]), { type: mime || 'application/zip' });
  }

  /* فحص جاهزية مكتبات PDF للعمل دون إنترنت */
  async function checkOfflineLibs(extraUrls) {
    var rels = [
      './vendor/pdf.min.mjs',
      './vendor/pdf.worker.min.mjs',
      './vendor/pdf-lib.min.js'
    ].concat(extraUrls || []);
    if (!('caches' in root)) return { ready: false, cached: 0, total: rels.length };
    var cached = 0;
    for (var i = 0; i < rels.length; i++) {
      try {
        var u = baseUrl(rels[i]);
        var hit = await caches.match(u, { ignoreVary: true });
        if (hit && hit.ok) cached++;
      } catch (e) { /* ignore */ }
    }
    return { ready: cached === rels.length, cached: cached, total: rels.length };
  }

  async function warmOfflineLibs(extraUrls) {
    var rels = [
      './vendor/pdf.min.mjs',
      './vendor/pdf.worker.min.mjs',
      './vendor/pdf-lib.min.js'
    ].concat(extraUrls || []);
    if (!('caches' in root)) throw new Error('Cache API غير متاح');
    var cache = await caches.open('edu-hub-pdf-tools-v1');
    for (var i = 0; i < rels.length; i++) {
      var u = baseUrl(rels[i]);
      var existing = await caches.match(u, { ignoreVary: true });
      if (!existing || !existing.ok) {
        var res = await fetch(new Request(u, { credentials: 'same-origin' }));
        if (res && res.ok) await cache.put(u, res.clone());
      }
    }
    return checkOfflineLibs(extraUrls);
  }

  root.PDFShared = {
    baseUrl: baseUrl,
    loadPdfJs: loadPdfJs,
    loadPdfLib: loadPdfLib,
    openPdfDoc: openPdfDoc,
    computeFileId: computeFileId,
    esc: esc,
    uid: uid,
    toLatinDigits: toLatinDigits,
    normalizeArabic: normalizeArabic,
    formatBytes: formatBytes,
    formatDateTime: formatDateTime,
    sanitizeFilename: sanitizeFilename,
    downloadBlob: downloadBlob,
    dataUrlToU8: dataUrlToU8,
    hasArabic: hasArabic,
    parsePageRanges: parsePageRanges,
    hexToRgb01: hexToRgb01,
    renderTextToPng: renderTextToPng,
    buildZip: buildZip,
    checkOfflineLibs: checkOfflineLibs,
    warmOfflineLibs: warmOfflineLibs
  };
})(window);
