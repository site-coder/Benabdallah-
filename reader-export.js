/* ==========================================================================
   reader-export.js — التصدير المحلي للقارئ الأكاديمي التفاعلي
   - استخراج النصوص المظللة ونسخها
   - تصدير دفتر الملاحظات والتظليلات إلى TXT أو PDF (عربي RTL دقيق عبر Canvas + pdf-lib)
   - تصدير نسخة PDF جديدة تتضمن التظليلات والتعليقات دون المساس بالملف الأصلي
   ========================================================================== */
(function (root) {
  'use strict';

  var HIGHLIGHT_COLORS = {
    yellow: { id: 'yellow', label: 'أصفر', hex: '#FACC15', css: 'rgba(250, 204, 21, 0.42)', rgb: [0.98, 0.80, 0.08] },
    green:  { id: 'green',  label: 'أخضر', hex: '#4ADE80', css: 'rgba(74, 222, 128, 0.40)', rgb: [0.29, 0.87, 0.50] },
    blue:   { id: 'blue',   label: 'أزرق', hex: '#60A5FA', css: 'rgba(96, 165, 250, 0.40)', rgb: [0.38, 0.65, 0.98] },
    pink:   { id: 'pink',   label: 'وردي', hex: '#F472B6', css: 'rgba(244, 114, 182, 0.40)', rgb: [0.96, 0.45, 0.71] },
    purple: { id: 'purple', label: 'بنفسجي', hex: '#C084FC', css: 'rgba(192, 132, 252, 0.42)', rgb: [0.75, 0.52, 0.99] }
  };

  var COLOR_ORDER = ['yellow', 'green', 'blue', 'pink', 'purple'];

  function colorInfo(id) {
    return HIGHLIGHT_COLORS[id] || HIGHLIGHT_COLORS.yellow;
  }

  function extractHighlightsText(bundle) {
    var anns = (bundle && bundle.annotations) || [];
    var highlights = anns.filter(function (a) { return a.type === 'highlight' && a.text && a.text.trim(); });
    if (!highlights.length) return '';
    return highlights.map(function (h) {
      var ci = colorInfo(h.color);
      var line = '[صفحة ' + h.page + ' · ' + ci.label + '] ' + h.text.trim();
      if (h.note && h.note.trim()) line += '\n   ↳ تعليق: ' + h.note.trim();
      return line;
    }).join('\n\n');
  }

  function buildNotebookTxt(fileMeta, bundle) {
    var S = root.PDFShared;
    var lines = [];
    lines.push('==================================================');
    lines.push('دفتر القراءة الأكاديمي: ' + (fileMeta.name || 'مستند PDF'));
    lines.push('عدد الصفحات: ' + (fileMeta.pageCount || '—') + ' | تاريخ التصدير: ' + S.formatDateTime(Date.now()));
    lines.push('==================================================');
    lines.push('');

    var marks = (bundle && bundle.bookmarks) || [];
    if (marks.length) {
      lines.push('--- العلامات المرجعية (' + marks.length + ') ---');
      marks.forEach(function (m) {
        lines.push('• صفحة ' + m.page + (m.title ? ' — ' + m.title : ''));
      });
      lines.push('');
    }

    var anns = (bundle && bundle.annotations) || [];
    var highlights = anns.filter(function (a) { return a.type === 'highlight'; });
    var comments = anns.filter(function (a) { return a.type === 'comment' || (a.note && a.note.trim()); });

    if (highlights.length) {
      lines.push('--- التظليلات (' + highlights.length + ') ---');
      highlights.forEach(function (h, idx) {
        var ci = colorInfo(h.color);
        lines.push((idx + 1) + '. [صفحة ' + h.page + ' · ' + ci.label + ']');
        if (h.text && h.text.trim()) lines.push('   "' + h.text.trim() + '"');
        if (h.note && h.note.trim()) lines.push('   التعليق: ' + h.note.trim());
        lines.push('');
      });
    }

    var pointComments = comments.filter(function (c) { return c.type === 'comment'; });
    if (pointComments.length) {
      lines.push('--- التعليقات الجانبية (' + pointComments.length + ') ---');
      pointComments.forEach(function (c, idx) {
        lines.push((idx + 1) + '. [صفحة ' + c.page + '] ' + (c.note || '').trim());
      });
      lines.push('');
    }

    var notes = (bundle && bundle.notes) || [];
    if (notes.length) {
      lines.push('--- ملاحظات الصفحات (' + notes.length + ') ---');
      notes.forEach(function (n) {
        lines.push('[صفحة ' + n.page + ']');
        lines.push(n.content.trim());
        lines.push('');
      });
    }

    if (!marks.length && !anns.length && !notes.length) {
      lines.push('لا توجد تظليلات أو تعليقات أو ملاحظات مسجلة لهذا الملف بعد.');
    }
    return lines.join('\n');
  }

  function exportNotebookTxt(fileMeta, bundle) {
    var S = root.PDFShared;
    var txt = '\ufeff' + buildNotebookTxt(fileMeta, bundle).replace(/\r?\n/g, '\r\n');
    var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    S.downloadBlob(blob, S.sanitizeFilename(fileMeta.name, '') + '-دفتر-الملاحظات.txt');
  }

  /* رسم صفحات دفتر الملاحظات على Canvas باللغة العربية RTL ثم تجميعها في PDF عبر pdf-lib */
  function renderNotebookCanvases(fileMeta, bundle) {
    var S = root.PDFShared;
    var W = 1240, H = 1754, M = 96, CW = W - 2 * M, BOT = H - M - 40;
    var F = 'Alexandria, Tahoma, Arial, sans-serif';
    var pages = [], cv, ctx, y;

    function newPage() {
      cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      ctx = cv.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7C3AED';
      ctx.fillRect(0, 0, W, 12);
      pages.push(cv);
      y = M;
    }

    function isLtr(s) {
      var m = /[A-Za-z\u0600-\u06FF]/.exec(String(s || ''));
      return !!m && /[A-Za-z]/.test(m[0]);
    }

    function wrapLines(text, font, maxW) {
      ctx.font = font;
      var out = [];
      String(text || '').replace(/\r/g, '').split('\n').forEach(function (para) {
        if (!para.trim()) { out.push(''); return; }
        var words = para.split(/\s+/).filter(Boolean);
        var cur = '';
        words.forEach(function (w) {
          var cand = cur ? (cur + ' ' + w) : w;
          if (ctx.measureText(cand).width <= maxW) {
            cur = cand;
          } else {
            if (cur) out.push(cur);
            if (ctx.measureText(w).width > maxW) {
              var s = '';
              Array.from(w).forEach(function (ch) {
                if (ctx.measureText(s + ch).width > maxW) { out.push(s); s = ch; }
                else s += ch;
              });
              cur = s;
            } else {
              cur = w;
            }
          }
        });
        if (cur) out.push(cur);
      });
      return out;
    }

    function drawTextBlock(text, opts) {
      opts = opts || {};
      var font = opts.font || ('400 26px ' + F);
      var color = opts.color || '#1E1B2E';
      var lh = opts.lh || 44;
      var padX = opts.padX || 0;
      var accent = opts.accent || '';
      var bg = opts.bg || '';
      var lines = wrapLines(text, font, CW - padX * 2);
      if (!lines.length) return;

      var idx = 0;
      while (idx < lines.length) {
        if (y + lh + 16 > BOT) newPage();
        var fitCount = Math.max(1, Math.floor((BOT - y - 12) / lh));
        var chunk = lines.slice(idx, idx + fitCount);
        var boxH = chunk.length * lh + (bg ? 18 : 0);

        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(M, y - 4, CW, boxH);
        }
        if (accent) {
          ctx.fillStyle = accent;
          ctx.fillRect(W - M - 8, y - 4, 8, boxH);
        }

        var ty = y + (bg ? 8 : 0);
        chunk.forEach(function (ln) {
          if (ln) {
            var ltr = opts.forceRtl ? false : isLtr(ln);
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.direction = ltr ? 'ltr' : 'rtl';
            ctx.textAlign = ltr ? 'left' : 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(ln, ltr ? (M + padX) : (W - M - padX - (accent ? 12 : 0)), ty + lh * 0.5);
          }
          ty += lh;
        });

        y += boxH + 8;
        idx += fitCount;
      }
    }

    function drawSectionTitle(title) {
      if (y + 80 > BOT) newPage();
      y += 10;
      drawTextBlock(title, { font: '700 32px ' + F, color: '#5B21B6', lh: 48, forceRtl: true });
      ctx.fillStyle = '#E5DEFF';
      ctx.fillRect(M, y - 4, CW, 3);
      y += 16;
    }

    newPage();
    drawTextBlock('دفتر القراءة الأكاديمي', { font: '700 44px ' + F, color: '#4C1D95', lh: 62, forceRtl: true });
    drawTextBlock(fileMeta.name || 'مستند PDF', { font: '700 30px ' + F, color: '#1E1B2E', lh: 48 });
    drawTextBlock('الصفحات: ' + (fileMeta.pageCount || '—') + '  •  التصدير: ' + S.formatDateTime(Date.now()), {
      font: '400 22px ' + F, color: '#645A7A', lh: 36, forceRtl: true
    });
    y += 10;

    var marks = (bundle && bundle.bookmarks) || [];
    if (marks.length) {
      drawSectionTitle('العلامات المرجعية (' + marks.length + ')');
      marks.forEach(function (m) {
        drawTextBlock('🔖 صفحة ' + m.page + (m.title ? ' — ' + m.title : ''), {
          font: '400 25px ' + F, lh: 40, bg: '#F8F6FF', accent: '#F59E0B', padX: 16, forceRtl: true
        });
      });
    }

    var anns = (bundle && bundle.annotations) || [];
    var highlights = anns.filter(function (a) { return a.type === 'highlight'; });
    if (highlights.length) {
      drawSectionTitle('التظليلات (' + highlights.length + ')');
      highlights.forEach(function (h) {
        var ci = colorInfo(h.color);
        var header = 'صفحة ' + h.page + ' · تظليل ' + ci.label;
        drawTextBlock(header, { font: '700 22px ' + F, color: '#5E5378', lh: 34, forceRtl: true });
        if (h.text && h.text.trim()) {
          drawTextBlock(h.text.trim(), {
            font: '400 25px ' + F, lh: 42, bg: '#FAF9FF', accent: ci.hex, padX: 18
          });
        }
        if (h.note && h.note.trim()) {
          drawTextBlock('💬 تعليق: ' + h.note.trim(), {
            font: '400 23px ' + F, color: '#4C1D95', lh: 38, padX: 18, forceRtl: true
          });
        }
        y += 6;
      });
    }

    var pointComments = anns.filter(function (a) { return a.type === 'comment'; });
    if (pointComments.length) {
      drawSectionTitle('التعليقات الجانبية (' + pointComments.length + ')');
      pointComments.forEach(function (c) {
        drawTextBlock('💬 [صفحة ' + c.page + '] ' + (c.note || '').trim(), {
          font: '400 25px ' + F, lh: 42, bg: '#F5F3FF', accent: '#8B5CF6', padX: 18, forceRtl: true
        });
      });
    }

    var notes = (bundle && bundle.notes) || [];
    if (notes.length) {
      drawSectionTitle('ملاحظات الصفحات (' + notes.length + ')');
      notes.forEach(function (n) {
        drawTextBlock('📝 صفحة ' + n.page, { font: '700 24px ' + F, color: '#B45309', lh: 38, forceRtl: true });
        drawTextBlock(n.content.trim(), {
          font: '400 25px ' + F, lh: 42, bg: '#FFFBEB', accent: '#F59E0B', padX: 18
        });
      });
    }

    if (!marks.length && !anns.length && !notes.length) {
      drawTextBlock('لا توجد تظليلات أو تعليقات أو ملاحظات مسجلة لهذا الملف بعد.', {
        font: '400 26px ' + F, color: '#645A7A', lh: 44, forceRtl: true
      });
    }

    pages.forEach(function (c, idx) {
      var k = c.getContext('2d');
      k.font = '400 20px ' + F;
      k.fillStyle = '#7A7094';
      k.direction = 'rtl';
      k.textAlign = 'center';
      k.fillText('صفحة ' + (idx + 1) + ' من ' + pages.length, W / 2, H - 46);
    });
    return pages;
  }

  async function appendCanvasesToPdfDoc(pdfDoc, canvases) {
    var S = root.PDFShared;
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      var jpgDataUrl = c.toDataURL('image/jpeg', 0.92);
      var jpgBytes = S.dataUrlToU8(jpgDataUrl);
      var img = await pdfDoc.embedJpg(jpgBytes);
      var pg = pdfDoc.addPage([595.28, 841.89]); /* A4 */
      pg.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
  }

  async function exportNotebookPdf(fileMeta, bundle) {
    var S = root.PDFShared;
    var PDFLib = await S.loadPdfLib();
    try { await document.fonts.ready; } catch (e) {}
    var canvases = renderNotebookCanvases(fileMeta, bundle);
    var pdfDoc = await PDFLib.PDFDocument.create();
    await appendCanvasesToPdfDoc(pdfDoc, canvases);
    var outBytes = await pdfDoc.save();
    var blob = new Blob([outBytes], { type: 'application/pdf' });
    S.downloadBlob(blob, S.sanitizeFilename(fileMeta.name, '') + '-دفتر-الملاحظات.pdf');
  }

  /* تحويل نقطة من إحداثيات العرض المطبّعة [0..1] (أصلها أعلى اليسار) إلى إحداثيات صفحة PDF */
  function normPointToPdfPoint(nx, ny, box, rotation) {
    var rot = ((rotation % 360) + 360) % 360;
    var bx = box.x || 0, by = box.y || 0, bw = box.width, bh = box.height;
    if (rot === 90)  return { x: bx + ny * bw, y: by + nx * bh };
    if (rot === 180) return { x: bx + (1 - nx) * bw, y: by + ny * bh };
    if (rot === 270) return { x: bx + (1 - ny) * bw, y: by + (1 - nx) * bh };
    return { x: bx + nx * bw, y: by + (1 - ny) * bh };
  }

  function normRectToPdfRect(r, box, rotation) {
    var p1 = normPointToPdfPoint(r.x, r.y, box, rotation);
    var p2 = normPointToPdfPoint(r.x + r.w, r.y + r.h, box, rotation);
    return {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      width: Math.max(2, Math.abs(p2.x - p1.x)),
      height: Math.max(2, Math.abs(p2.y - p1.y))
    };
  }

  /* إضافة تعليق PDF أصيل (/Text annotation) يدعم النصوص العربية UTF-16BE */
  function attachPdfTextAnnotation(PDFLib, pdfDoc, page, x, y, title, contents, rgbArr) {
    try {
      var ctx = pdfDoc.context;
      var annotDict = ctx.obj({
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [x - 10, y - 10, x + 10, y + 10],
        Contents: PDFLib.PDFHexString.fromText(String(contents || '')),
        T: PDFLib.PDFHexString.fromText(String(title || 'تعليق')),
        C: rgbArr || [0.96, 0.62, 0.04],
        Name: 'Comment',
        Open: false
      });
      var annotRef = ctx.register(annotDict);
      var annots = page.node.lookupMaybe(PDFLib.PDFName.of('Annots'), PDFLib.PDFArray);
      if (!annots) {
        annots = ctx.obj([]);
        page.node.set(PDFLib.PDFName.of('Annots'), annots);
      }
      annots.push(annotRef);
    } catch (e) { /* تجاهل بهدوء إذا كان القالب غير قياسي */ }
  }

  async function exportAnnotatedPdf(originalBytes, fileMeta, bundle, options) {
    var opts = options || {};
    var S = root.PDFShared;
    var PDFLib = await S.loadPdfLib();
    try { await document.fonts.ready; } catch (e) {}

    /* تحميل نسخة مستقلة تماماً من الملف الأصلي */
    var pdfDoc = await PDFLib.PDFDocument.load(originalBytes.slice(), { ignoreEncryption: true });
    var pages = pdfDoc.getPages();
    var anns = (bundle && bundle.annotations) || [];
    var notes = (bundle && bundle.notes) || [];

    var byPage = Object.create(null);
    anns.forEach(function (a) {
      if (!byPage[a.page]) byPage[a.page] = [];
      byPage[a.page].push(a);
    });

    for (var p = 1; p <= pages.length; p++) {
      var list = byPage[p];
      if (!list || !list.length) continue;
      var page = pages[p - 1];
      var box = page.getCropBox() || page.getMediaBox();
      var rot = page.getRotation().angle || 0;

      for (var i = 0; i < list.length; i++) {
        var ann = list[i];
        var ci = colorInfo(ann.color);
        var cRgb = PDFLib.rgb(ci.rgb[0], ci.rgb[1], ci.rgb[2]);

        if (ann.type === 'highlight' && Array.isArray(ann.rects)) {
          ann.rects.forEach(function (r) {
            var pr = normRectToPdfRect(r, box, rot);
            page.drawRectangle({
              x: pr.x,
              y: pr.y,
              width: pr.width,
              height: pr.height,
              color: cRgb,
              opacity: 0.34,
              borderWidth: 0
            });
          });
          if (ann.note && ann.note.trim()) {
            var firstR = ann.rects[0];
            if (firstR) {
              var pt = normPointToPdfPoint(firstR.x, firstR.y, box, rot);
              page.drawCircle({
                x: Math.max(box.x + 8, Math.min(box.x + box.width - 8, pt.x)),
                y: Math.max(box.y + 8, Math.min(box.y + box.height - 8, pt.y)),
                size: 6,
                color: PDFLib.rgb(0.55, 0.25, 0.92),
                borderColor: PDFLib.rgb(1, 1, 1),
                borderWidth: 1.2,
                opacity: 0.92
              });
              var msg = ann.note.trim() + (ann.text ? '\n\nالنص المظلل:\n"' + ann.text.trim() + '"' : '');
              attachPdfTextAnnotation(PDFLib, pdfDoc, page, pt.x, pt.y, 'تعليق على تظليل', msg, ci.rgb);
            }
          }
        } else if (ann.type === 'comment' && ann.anchor) {
          var apt = normPointToPdfPoint(ann.anchor.x, ann.anchor.y, box, rot);
          var ax = Math.max(box.x + 12, Math.min(box.x + box.width - 12, apt.x));
          var ay = Math.max(box.y + 12, Math.min(box.y + box.height - 12, apt.y));

          page.drawCircle({
            x: ax,
            y: ay,
            size: 8.5,
            color: cRgb,
            borderColor: PDFLib.rgb(1, 1, 1),
            borderWidth: 1.5,
            opacity: 0.92
          });
          if (ann.note && ann.note.trim()) {
            attachPdfTextAnnotation(PDFLib, pdfDoc, page, ax, ay, 'تعليق جانبي', ann.note.trim(), ci.rgb);
            /* رسم بطاقة صغيرة مرئية بجانب العلامة عند التصدير إذا كانت قصيرة */
            if (opts.drawCommentLabels) {
              var snippet = ann.note.trim().slice(0, 48) + (ann.note.trim().length > 48 ? '…' : '');
              var png = S.renderTextToPng({
                text: snippet,
                fontSize: 10,
                color: '#1A1030',
                bgColor: 'rgba(255, 251, 235, 0.95)',
                borderColor: ci.hex,
                radius: 4,
                paddingX: 6,
                paddingY: 3,
                maxWidth: 170,
                scale: 2.5
              });
              var emb = await pdfDoc.embedPng(png.bytes);
              var drawX = Math.max(box.x + 6, Math.min(box.x + box.width - png.width - 6, ax - png.width / 2));
              var drawY = Math.max(box.y + 6, Math.min(box.y + box.height - png.height - 6, ay + 10));
              page.drawImage(emb, { x: drawX, y: drawY, width: png.width, height: png.height });
            }
          }
        }
      }
    }

    var hasContent = anns.length || notes.length || ((bundle && bundle.bookmarks && bundle.bookmarks.length));
    if (opts.appendNotebook !== false && hasContent) {
      var nbCanvases = renderNotebookCanvases(fileMeta, bundle);
      await appendCanvasesToPdfDoc(pdfDoc, nbCanvases);
    }

    var outBytes = await pdfDoc.save({ useObjectStreams: true });
    var blob = new Blob([outBytes], { type: 'application/pdf' });
    S.downloadBlob(blob, S.sanitizeFilename(fileMeta.name, '') + '-مع-التظليلات.pdf');
  }

  root.ReaderExport = {
    HIGHLIGHT_COLORS: HIGHLIGHT_COLORS,
    COLOR_ORDER: COLOR_ORDER,
    colorInfo: colorInfo,
    extractHighlightsText: extractHighlightsText,
    buildNotebookTxt: buildNotebookTxt,
    exportNotebookTxt: exportNotebookTxt,
    exportNotebookPdf: exportNotebookPdf,
    exportAnnotatedPdf: exportAnnotatedPdf,
    normRectToPdfRect: normRectToPdfRect
  };
})(window);
