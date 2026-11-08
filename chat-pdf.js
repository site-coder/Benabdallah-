/* ==========================================================================
   chat-pdf.js — استخراج نص ملفات PDF محلياً بمكتبة PDF.js (vendor/)
   - تُحمَّل المكتبة عند الحاجة فقط (لا تُحمَّل مع الصفحة).
   - تقرأ كل الصفحات، وتحافظ على ترتيب الأسطر، وتفصل خلايا الجداول بـ « | ».
   - الملف المصوَّر (بلا نص) لا يُدّعى قراءته: يُرجَع scanned=true.
   ========================================================================== */
(function (root) {
  'use strict';
  var lib = null;

  function load() {
    if (lib) return lib;
    lib = import('./vendor/pdf.min.mjs').then(function (m) {
      m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', document.baseURI).href;
      return m;
    });
    lib.catch(function () { lib = null; });
    return lib;
  }

  function isArabic(s) { return /[\u0600-\u06FF]/.test(s); }

  /* يحوّل عناصر الصفحة إلى أسطر مرتبة (من الأعلى للأسفل) */
  function pageToText(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str || !it.str.trim()) { return; }
      var str = it.str; try { str = str.normalize('NFKC'); } catch (e) { /* ignore */ }
      var x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
      var row = null;
      for (var i = rows.length - 1; i >= 0 && i >= rows.length - 6; i--) {
        if (Math.abs(rows[i].y - y) <= h * 0.45) { row = rows[i]; break; }
      }
      if (!row) { row = { y: y, h: h, cells: [] }; rows.push(row); }
      row.cells.push({ x: x, w: it.width || 0, s: str });
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    var heights = rows.map(function (r) { return r.h; }).sort(function (a, b) { return a - b; });
    var medH = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
    var out = [], prevY = null;
    rows.forEach(function (r) {
      var joined = r.cells.map(function (c) { return c.s; }).join('');
      var rtl = isArabic(joined);
      r.cells.sort(function (a, b) { return rtl ? b.x - a.x : a.x - b.x; });
      var line = '', last = null;
      r.cells.forEach(function (c) {
        if (last) {
          var gap = rtl ? (last.x - (c.x + c.w)) : (c.x - (last.x + last.w));
          if (gap > medH * 0.9) line += ' | ';
          else if (gap > medH * 0.15 && !/\s$/.test(line) && !/^\s/.test(c.s)) line += ' ';
        }
        line += c.s; last = c;
      });
      line = line.replace(/\s+/g, ' ').trim();
      if (!line) return;
      if (prevY !== null && prevY - r.y > medH * 1.9) out.push('');
      out.push(line); prevY = r.y;
    });
    return out.join('\n');
  }

  /* src: رابط أو ArrayBuffer. onProgress(done,total) اختياري */
  function extract(src, onProgress) {
    return load().then(function (pdfjs) {
      var task = pdfjs.getDocument(typeof src === 'string' ? { url: src } : { data: src });
      return task.promise.then(function (pdf) {
        var n = pdf.numPages, texts = [], chain = Promise.resolve();
        for (var p = 1; p <= n; p++) (function (pn) {
          chain = chain.then(function () {
            return pdf.getPage(pn).then(function (page) { return page.getTextContent(); }).then(function (tc) {
              texts.push(pageToText(tc.items));
              if (onProgress) onProgress(pn, n);
            });
          });
        })(p);
        return chain.then(function () {
          var text = texts.join('\n\n').trim();
          var chars = text.replace(/\s+/g, '').length;
          var res = { pages: n, text: text, chars: chars, scanned: n > 0 && chars / n < 30 };
          try { pdf.destroy(); } catch (e) { /* ignore */ }
          return res;
        });
      });
    });
  }

  root.ChatPDF = { extract: extract };
})(window);
