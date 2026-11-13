/* ==========================================================================
   slides-export.js — محرك التصدير لـ «استوديو العروض» (المرحلة 5)
   1. تصدير PNG: رسم مباشر عالي الدقة على Canvas (الشريحة الحالية أو كل الشرائح)
   2. تصدير PDF: عبر إطار طباعة معزول يحافظ على مقاس الشريحة وترتيبها والعربية
   3. محوّل PowerPoint (PPTX Adapter): يجهّز البنية الكاملة القابلة للتحرير
      للتشغيل الفوري عند إضافة مكتبة PptxGenJS محلياً، دون إنشاء ملفات وهمية
   ========================================================================== */
(function (root) {
  'use strict';
  var E = root.SLE, C = root.SLC; if (!E) return;
  var RE_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  var RE_LTR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeName(n) { return String(n || 'presentation').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || 'presentation'; }
  function dirOf(s, pref) {
    if (pref === 'rtl' || pref === 'ltr') return pref;
    for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (RE_RTL.test(c)) return 'rtl'; if (RE_LTR.test(c)) return 'ltr'; }
    return 'rtl';
  }
  function hexRgba(hex, op) {
    if (!hex || hex === 'none') return 'transparent';
    var m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (op == null ? 1 : op) + ')';
  }
  function fontCss(name, size, bold, italic) {
    var fam = ['sans-serif', 'serif', 'monospace'].indexOf(name) >= 0 ? name : '"' + String(name || 'Alexandria').replace(/"/g, '') + '",Tahoma,Arial,sans-serif';
    return (italic ? 'italic ' : '') + (bold ? '700 ' : '400 ') + size + 'px ' + fam;
  }

  /* ---------- التفاف ورسم النص على Canvas ---------- */
  function wrapLines(ctx, text, maxW, prefDir) {
    var out = [], paras = String(text == null ? '' : text).replace(/\n+$/, '').split('\n');
    paras.forEach(function (p) {
      if (p === '') { out.push({ t: '', d: prefDir === 'ltr' ? 'ltr' : 'rtl' }); return; }
      var d = dirOf(p, prefDir), words = p.split(' '), line = '';
      function flush() { out.push({ t: line, d: d }); line = ''; }
      words.forEach(function (w) {
        var trial = line ? line + ' ' + w : w;
        if (ctx.measureText(trial).width <= maxW || (!line && ctx.measureText(w).width <= maxW)) { line = trial; return; }
        if (line) flush();
        if (ctx.measureText(w).width <= maxW) { line = w; return; }
        var chars = Array.from(w), cur = '';
        chars.forEach(function (ch) {
          if (cur && ctx.measureText(cur + ch).width > maxW) { out.push({ t: cur, d: d }); cur = ch; } else cur += ch;
        });
        line = cur;
      });
      flush();
    });
    return out;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function loadImg(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  /* ---------- رسم الأشكال على Canvas ---------- */
  function drawShape(ctx, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, sw = it.sw || 0, o = sw / 2;
    var hasFill = it.fill && it.fill !== 'none';
    var hasStroke = sw > 0 && it.stroke;

    if (it.kind === 'line' || it.kind === 'arrow' || it.kind === 'darrow') {
      var st = it.stroke || '#7C3AED', lw = Math.max(1, sw || 4);
      var L = Math.min(w * 0.42, Math.max(14, lw * 3.5)), W = L * 0.85, cy = y + h / 2;
      var x1 = x + (it.kind === 'darrow' ? L - 1 : 0);
      var x2 = x + ((it.kind === 'arrow' || it.kind === 'darrow') ? w - L + 1 : w);
      ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, cy); ctx.lineTo(x2, cy); ctx.stroke();
      ctx.fillStyle = st;
      if (it.kind === 'arrow' || it.kind === 'darrow') {
        ctx.beginPath(); ctx.moveTo(x + w, cy); ctx.lineTo(x + w - L, cy - W / 2); ctx.lineTo(x + w - L, cy + W / 2); ctx.closePath(); ctx.fill();
      }
      if (it.kind === 'darrow') {
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + L, cy - W / 2); ctx.lineTo(x + L, cy + W / 2); ctx.closePath(); ctx.fill();
      }
      return;
    }

    ctx.beginPath();
    if (it.kind === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2 - o), Math.max(1, h / 2 - o), 0, 0, Math.PI * 2);
    } else if (it.kind === 'triangle') {
      ctx.moveTo(x + w / 2, y + o); ctx.lineTo(x + w - o, y + h - o); ctx.lineTo(x + o, y + h - o); ctx.closePath();
    } else if (it.kind === 'diamond') {
      ctx.moveTo(x + w / 2, y + o); ctx.lineTo(x + w - o, y + h / 2); ctx.lineTo(x + w / 2, y + h - o); ctx.lineTo(x + o, y + h / 2); ctx.closePath();
    } else if (it.kind === 'pentagon' || it.kind === 'hexagon') {
      var sides = it.kind === 'pentagon' ? 5 : 6, off = (it.kind === 'pentagon' ? -90 : 0) * Math.PI / 180;
      var rx = Math.max(1, w / 2 - o), ry = Math.max(1, h / 2 - o), cx = x + w / 2, cy2 = y + h / 2;
      for (var i = 0; i < sides; i++) {
        var a = off + (i * 2 * Math.PI) / sides;
        if (i === 0) ctx.moveTo(cx + rx * Math.cos(a), cy2 + ry * Math.sin(a));
        else ctx.lineTo(cx + rx * Math.cos(a), cy2 + ry * Math.sin(a));
      }
      ctx.closePath();
    } else if (it.kind === 'star') {
      var sx = Math.max(1, w / 2 - o), sy = Math.max(1, h / 2 - o), scx = x + w / 2, scy = y + h / 2;
      for (var j = 0; j < 10; j++) {
        var ang = -Math.PI / 2 + (j * Math.PI) / 5, k = j % 2 === 0 ? 1 : 0.44;
        if (j === 0) ctx.moveTo(scx + sx * k * Math.cos(ang), scy + sy * k * Math.sin(ang));
        else ctx.lineTo(scx + sx * k * Math.cos(ang), scy + sy * k * Math.sin(ang));
      }
      ctx.closePath();
    } else if (it.kind === 'callout') {
      var bh = h * 0.78, rad = Math.min(18, w * 0.12, bh * 0.25);
      ctx.moveTo(x + o + rad, y + o);
      ctx.lineTo(x + w - o - rad, y + o); ctx.quadraticCurveTo(x + w - o, y + o, x + w - o, y + o + rad);
      ctx.lineTo(x + w - o, y + bh - rad); ctx.quadraticCurveTo(x + w - o, y + bh, x + w - o - rad, y + bh);
      ctx.lineTo(x + w * 0.38, y + bh); ctx.lineTo(x + w * 0.22, y + h - o); ctx.lineTo(x + w * 0.26, y + bh);
      ctx.lineTo(x + o + rad, y + bh); ctx.quadraticCurveTo(x + o, y + bh, x + o, y + bh - rad);
      ctx.lineTo(x + o, y + o + rad); ctx.quadraticCurveTo(x + o, y + o, x + o + rad, y + o);
      ctx.closePath();
    } else {
      var r = it.kind === 'rrect' ? (it.radius != null ? it.radius : 20) : 0;
      roundRectPath(ctx, x + o, y + o, Math.max(1, w - sw), Math.max(1, h - sw), r);
    }
    if (hasFill) { ctx.fillStyle = it.fill; ctx.fill(); }
    if (hasStroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = sw; ctx.lineJoin = 'round'; ctx.stroke(); }
  }

  function drawTextItem(ctx, it) {
    var pad = it.pad != null ? it.pad : 8;
    if (it.bg && it.bg !== 'none') {
      ctx.fillStyle = hexRgba(it.bg, it.bgOp != null ? it.bgOp : 1);
      ctx.fillRect(it.x, it.y, it.w, it.h);
    }
    if (it.borderWidth > 0) {
      ctx.strokeStyle = it.borderColor || '#7C3AED';
      ctx.lineWidth = it.borderWidth;
      ctx.strokeRect(it.x + it.borderWidth / 2, it.y + it.borderWidth / 2, Math.max(1, it.w - it.borderWidth), Math.max(1, it.h - it.borderWidth));
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(it.x, it.y, it.w, it.h);
    if (it.overflow !== 'visible') ctx.clip();

    var sz = it.size, lh = it.lh || 1.35, maxW = Math.max(10, it.w - pad * 2);
    ctx.font = fontCss(it.font, sz, it.bold, it.italic);
    var lines = wrapLines(ctx, it.text, maxW, it.dir || 'auto');
    if (it.overflow === 'shrink') {
      while (lines.length * sz * lh > (it.h - pad * 2) && sz > 10) {
        sz = Math.max(10, sz - 2);
        ctx.font = fontCss(it.font, sz, it.bold, it.italic);
        lines = wrapLines(ctx, it.text, maxW, it.dir || 'auto');
      }
    }
    ctx.fillStyle = it.color || '#1B0E3A';
    ctx.textBaseline = 'top';
    var y = it.y + pad, lineStep = sz * lh;
    var align = it.align === 'justify' ? 'right' : (it.align || 'right');
    lines.forEach(function (ln) {
      ctx.direction = ln.d;
      ctx.textAlign = align;
      var ax = align === 'right' ? (it.x + it.w - pad) : align === 'left' ? (it.x + pad) : (it.x + it.w / 2);
      ctx.fillText(ln.t, ax, y);
      if (it.underline && ln.t) {
        var tw = ctx.measureText(ln.t).width;
        var ux = align === 'right' ? ax - tw : align === 'left' ? ax : ax - tw / 2;
        ctx.fillRect(ux, y + sz * 1.05, tw, Math.max(1, sz * 0.07));
      }
      y += lineStep;
    });
    ctx.restore();
  }

  function drawTableItem(ctx, it) {
    var colW = it.w / it.cols, rowH = it.h / it.rows;
    var bw = it.borderWidth != null ? it.borderWidth : 1;
    var bc = it.borderColor || '#CBD5E1';
    var fs = it.fontSize || 16;
    for (var r = 0; r < it.rows; r++) {
      for (var c = 0; c < it.cols; c++) {
        var cell = it.cells[r] && it.cells[r][c];
        if (!cell || cell.mergedTo) continue;
        var cx = it.x + c * colW, cy = it.y + r * rowH;
        var cw = colW * (cell.colSpan || 1), ch = rowH * (cell.rowSpan || 1);
        if (cell.bg && cell.bg !== 'none') {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(cx, cy, cw, ch);
        }
        if (bw > 0) {
          ctx.strokeStyle = bc; ctx.lineWidth = bw;
          ctx.strokeRect(cx, cy, cw, ch);
        }
        if (cell.text) {
          ctx.save();
          ctx.beginPath(); ctx.rect(cx + 2, cy + 2, Math.max(1, cw - 4), Math.max(1, ch - 4)); ctx.clip();
          ctx.font = fontCss('Alexandria', fs, cell.bold, false);
          ctx.fillStyle = cell.color || '#1B0E3A';
          ctx.textBaseline = 'middle';
          var al = cell.align || 'center';
          ctx.direction = dirOf(cell.text, it.dir || 'auto');
          ctx.textAlign = al === 'justify' ? 'center' : al;
          var tx = al === 'right' ? cx + cw - 6 : al === 'left' ? cx + 6 : cx + cw / 2;
          ctx.fillText(cell.text, tx, cy + ch / 2);
          ctx.restore();
        }
      }
    }
  }

  function drawChartItem(ctx, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h;
    var cats = it.categories || [], series = it.series || [], s0 = series[0] || { name: '', color: '#7C3AED', values: [] };
    var pal = (it.palette && it.palette.length) ? it.palette : E.DEFAULT_PALETTE;
    var tc = it.textColor || '#1B0E3A';
    if (it.bg && it.bg !== 'none') {
      roundRectPath(ctx, x, y, w, h, 10);
      ctx.fillStyle = it.bg; ctx.fill();
    }
    var topPad = it.title ? 38 : 16;
    if (it.title) {
      ctx.font = fontCss('Alexandria', 15, true, false);
      ctx.fillStyle = tc; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'auto';
      ctx.fillText(it.title, x + w / 2, y + 24);
    }
    var legH = it.showLegend ? 28 : 8;
    var plotX = x + 46, plotY = y + topPad, plotW = Math.max(40, w - 64), plotH = Math.max(30, h - topPad - legH - 26);

    if (it.chartType === 'pie') {
      var vals = cats.map(function (_, i) { return Math.max(0, parseFloat(s0.values[i]) || 0); });
      var sum = vals.reduce(function (a, b) { return a + b; }, 0);
      var cx = x + w / 2, cy = plotY + plotH / 2 + 4, r = Math.max(16, Math.min(plotW, plotH) * 0.44);
      if (sum <= 0) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#E2E8F0'; ctx.fill();
      } else {
        var ang = -Math.PI / 2;
        vals.forEach(function (v, idx) {
          if (v <= 0) return;
          var slice = (v / sum) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, ang, ang + slice); ctx.closePath();
          ctx.fillStyle = pal[idx % pal.length]; ctx.fill();
          ctx.strokeStyle = it.bg && it.bg !== 'none' ? it.bg : '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
          if (it.showValues && v / sum >= 0.05) {
            var mid = ang + slice / 2;
            ctx.font = fontCss('Alexandria', 11, true, false); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round((v / sum) * 100) + '%', cx + r * 0.64 * Math.cos(mid), cy + r * 0.64 * Math.sin(mid));
          }
          ang += slice;
        });
      }
      if (it.showLegend && cats.length) {
        var lx = x + 14, ly = y + h - 18, step = Math.min(115, (w - 24) / Math.max(1, cats.length));
        cats.forEach(function (c, idx) {
          var px = lx + idx * step; if (px + 20 > x + w) return;
          ctx.fillStyle = pal[idx % pal.length]; ctx.fillRect(px, ly - 9, 10, 10);
          ctx.font = fontCss('Alexandria', 11, false, false); ctx.fillStyle = tc; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(String(c).slice(0, 11), px + 14, ly);
        });
      }
      return;
    }

    var allVals = [];
    series.forEach(function (sr) { cats.forEach(function (_, i) { allVals.push(parseFloat(sr.values[i]) || 0); }); });
    var maxV = Math.max(10, Math.max.apply(null, allVals.length ? allVals : [10]));
    var minV = Math.min(0, Math.min.apply(null, allVals.length ? allVals : [0]));
    var span = Math.max(1, maxV - minV);
    for (var g = 0; g <= 4; g++) {
      var gy = plotY + (plotH * g) / 4, gv = Math.round(maxV - (span * g) / 4);
      ctx.strokeStyle = hexRgba(tc, 0.14); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plotX, gy); ctx.lineTo(plotX + plotW, gy); ctx.stroke();
      ctx.font = fontCss('Alexandria', 10.5, false, false); ctx.fillStyle = hexRgba(tc, 0.72); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(gv), plotX - 6, gy + 4);
    }
    var zeroY = plotY + ((maxV - 0) / span) * plotH;
    ctx.strokeStyle = hexRgba(tc, 0.45); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(plotX, zeroY); ctx.lineTo(plotX + plotW, zeroY); ctx.stroke();

    var nCats = Math.max(1, cats.length), grpW = plotW / nCats;
    if (it.chartType === 'bar') {
      var nSer = Math.max(1, series.length), bw = Math.min(44, Math.max(8, (grpW * 0.68) / nSer));
      series.forEach(function (sr, si) {
        var sCol = sr.color || pal[si % pal.length];
        cats.forEach(function (_, ci) {
          var v = parseFloat(sr.values[ci]) || 0, vy = plotY + ((maxV - v) / span) * plotH;
          var bx = plotX + ci * grpW + (grpW - bw * nSer) / 2 + si * bw, bh = Math.abs(zeroY - vy), by = Math.min(vy, zeroY);
          ctx.fillStyle = nSer === 1 ? pal[ci % pal.length] : sCol;
          roundRectPath(ctx, bx, by, Math.max(4, bw - 2), Math.max(2, bh), 4); ctx.fill();
          if (it.showValues) {
            ctx.font = fontCss('Alexandria', 10.5, true, false); ctx.fillStyle = tc; ctx.textAlign = 'center';
            ctx.fillText(String(v), bx + (bw - 2) / 2, by - 5);
          }
        });
      });
    } else {
      series.forEach(function (sr, si) {
        var sCol = sr.color || pal[si % pal.length], pts = [];
        cats.forEach(function (_, ci) {
          var v = parseFloat(sr.values[ci]) || 0;
          pts.push([plotX + ci * grpW + grpW / 2, plotY + ((maxV - v) / span) * plotH, v]);
        });
        if (pts.length > 1) {
          ctx.beginPath();
          pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
          ctx.strokeStyle = sCol; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
        }
        pts.forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2); ctx.fillStyle = sCol; ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke();
          if (it.showValues) {
            ctx.font = fontCss('Alexandria', 10.5, true, false); ctx.fillStyle = tc; ctx.textAlign = 'center';
            ctx.fillText(String(p[2]), p[0], p[1] - 9);
          }
        });
      });
    }
    cats.forEach(function (c, ci) {
      ctx.font = fontCss('Alexandria', 11, false, false); ctx.fillStyle = tc; ctx.textAlign = 'center';
      ctx.fillText(String(c).slice(0, 12), plotX + ci * grpW + grpW / 2, plotY + plotH + 17);
    });
  }

  function renderSlideToCanvas(proj, slide, scale) {
    scale = scale || 2;
    var sz = E.size(proj.ratio);
    var cv = document.createElement('canvas');
    cv.width = Math.round(sz.w * scale);
    cv.height = Math.round(sz.h * scale);
    var ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = slide.bg || '#FFFFFF';
    ctx.fillRect(0, 0, sz.w, sz.h);

    var imgPromises = slide.items.map(function (it) {
      return it.type === 'image' ? loadImg(it.src) : Promise.resolve(null);
    });
    return Promise.all(imgPromises).then(function (imgs) {
      slide.items.forEach(function (it, idx) {
        ctx.save();
        ctx.globalAlpha = it.op != null ? it.op : 1;
        if (it.rot) {
          var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
          ctx.translate(cx, cy);
          ctx.rotate((it.rot * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }
        if (it.type === 'text') drawTextItem(ctx, it);
        else if (it.type === 'shape') drawShape(ctx, it);
        else if (it.type === 'table') drawTableItem(ctx, it);
        else if (it.type === 'chart') drawChartItem(ctx, it);
        else if (it.type === 'image') {
          var im = imgs[idx];
          if (im) {
            ctx.save();
            roundRectPath(ctx, it.x, it.y, it.w, it.h, it.radius || 0);
            ctx.clip();
            var cr = it.crop || { x: 0, y: 0, w: 1, h: 1 };
            var sx = cr.x * im.naturalWidth, sy = cr.y * im.naturalHeight;
            var sw = Math.max(1, cr.w * im.naturalWidth), sh = Math.max(1, cr.h * im.naturalHeight);
            ctx.drawImage(im, sx, sy, sw, sh, it.x, it.y, it.w, it.h);
            ctx.restore();
            if (it.borderWidth > 0) {
              roundRectPath(ctx, it.x + it.borderWidth / 2, it.y + it.borderWidth / 2, Math.max(1, it.w - it.borderWidth), Math.max(1, it.h - it.borderWidth), it.radius || 0);
              ctx.strokeStyle = it.borderColor || '#7C3AED';
              ctx.lineWidth = it.borderWidth;
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      });
      return cv;
    });
  }

  function downloadCanvasPng(cv, filename) {
    return new Promise(function (resolve) {
      cv.toBlob(function (blob) {
        if (!blob) { resolve(false); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); resolve(true); }, 220);
      }, 'image/png');
    });
  }

  function exportSlidePng(proj, slideIdx, scale) {
    if (!proj || !proj.slides || !proj.slides[slideIdx]) return Promise.resolve(false);
    var numStr = String(slideIdx + 1).padStart(2, '0');
    return renderSlideToCanvas(proj, proj.slides[slideIdx], scale || 2).then(function (cv) {
      return downloadCanvasPng(cv, safeName(proj.name) + '_slide_' + numStr + '.png');
    });
  }

  function exportAllPng(proj, scale) {
    if (!proj || !proj.slides || !proj.slides.length) return Promise.resolve(0);
    var i = 0, count = 0;
    function next() {
      if (i >= proj.slides.length) return Promise.resolve(count);
      var idx = i++;
      return exportSlidePng(proj, idx, scale).then(function (ok) {
        if (ok) count++;
        return new Promise(function (r) { setTimeout(r, 260); }).then(next);
      });
    }
    return next();
  }

  /* ---------- 2) تصدير PDF عبر الطباعة النظيفة في iframe معزول ---------- */
  function exportPdf(proj) {
    if (!proj || !proj.slides || !proj.slides.length) return Promise.resolve(false);
    var sz = E.size(proj.ratio);
    return new Promise(function (resolve) {
      var ifr = document.createElement('iframe');
      ifr.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + sz.w + 'px;height:' + sz.h + 'px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(ifr);

      var slidesMarkup = proj.slides.map(function (s) {
        var tmp = document.createElement('div');
        if (C && C.renderSlide) C.renderSlide(tmp, s);
        return '<div class="sl-print-page" style="background:' + esc(s.bg) + '">' + tmp.innerHTML + '</div>';
      }).join('');

      var cssLink = '';
      [].forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function (lk) {
        if (lk.href && lk.href.indexOf('fonts.googleapis.com') >= 0) cssLink += '<link rel="stylesheet" href="' + esc(lk.href) + '">';
      });

      var doc = ifr.contentDocument;
      doc.open();
      doc.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(proj.name) + '</title>' + cssLink +
        '<style>' +
        '@page{size:' + sz.w + 'px ' + sz.h + 'px;margin:0}' +
        '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        'html,body{margin:0;padding:0;background:#fff;font-family:Alexandria,Tahoma,Arial,sans-serif}' +
        '.sl-print-page{position:relative;width:' + sz.w + 'px;height:' + sz.h + 'px;overflow:hidden;page-break-after:always;break-after:page;direction:ltr}' +
        '.sl-print-page:last-child{page-break-after:auto;break-after:auto}' +
        '.sl-it{position:absolute;transform-origin:50% 50%;box-sizing:border-box}' +
        '.sl-it>svg,.sl-it>img{display:block;width:100%;height:100%}' +
        '.sl-tx{width:100%;height:100%;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden}' +
        '.sl-tbl td{padding:4px 6px;vertical-align:middle;word-break:break-word}' +
        '</style></head><body>' + slidesMarkup + '</body></html>');
      doc.close();

      function trigger() {
        var win = ifr.contentWindow;
        var done = false;
        function cleanup() {
          if (done) return; done = true;
          setTimeout(function () { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); resolve(true); }, 600);
        }
        try {
          win.focus();
          win.onafterprint = cleanup;
          win.print();
          setTimeout(cleanup, 3000);
        } catch (e) { cleanup(); }
      }
      setTimeout(function () {
        if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(trigger, trigger);
        else trigger();
      }, 350);
    });
  }

  /* ---------- 3) التصدير الحقيقي إلى PowerPoint (PPTX عبر PptxGenJS المحلي) ---------- */
  var PPTX_SHAPE_MAP = {
    rect: 'rect', rrect: 'roundRect', square: 'rect', circle: 'ellipse',
    line: 'line', arrow: 'line', darrow: 'line',
    triangle: 'triangle', diamond: 'diamond', pentagon: 'pentagon',
    hexagon: 'hexagon', star: 'star5', callout: 'wedgeRoundRectCallout'
  };

  function round3(v) { return Math.round((parseFloat(v) || 0) * 1000) / 1000; }
  function cleanHex(hex, fallback) {
    var s = String(hex || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (/^[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    return fallback || '000000';
  }
  function alphaPct(op) {
    var v = op == null ? 1 : parseFloat(op);
    if (!isFinite(v)) v = 1;
    return Math.max(0, Math.min(100, Math.round((1 - Math.max(0, Math.min(1, v))) * 100)));
  }
  function mapFontFace(name) {
    var f = String(name || 'Alexandria').trim();
    if (f === 'sans-serif') return 'Arial';
    if (f === 'serif') return 'Times New Roman';
    if (f === 'monospace') return 'Courier New';
    return f || 'Alexandria';
  }

  function ensurePptxGen() {
    if (typeof root.PptxGenJS === 'function') return Promise.resolve(root.PptxGenJS);
    if (typeof document === 'undefined') return Promise.reject(new Error('مكتبة PptxGenJS غير محمّلة'));
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-pptxgen-loader]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (typeof root.PptxGenJS === 'function') resolve(root.PptxGenJS);
          else reject(new Error('تعذّر تهيئة مكتبة PptxGenJS'));
        });
        existing.addEventListener('error', function () { reject(new Error('تعذّر تحميل مكتبة PptxGenJS المحلية')); });
        return;
      }
      var sc = document.createElement('script');
      sc.src = 'vendor/pptxgen.bundle.js';
      sc.async = true;
      sc.setAttribute('data-pptxgen-loader', '1');
      sc.onload = function () {
        if (typeof root.PptxGenJS === 'function') resolve(root.PptxGenJS);
        else reject(new Error('تعذّر تهيئة مكتبة PptxGenJS'));
      };
      sc.onerror = function () { reject(new Error('ملف مكتبة PptxGenJS المحلي غير متوفر')); };
      document.head.appendChild(sc);
    });
  }

  function prepareImageForPptx(it) {
    var src = String(it && it.src || '');
    if (!src) return Promise.resolve(null);
    var cr = it.crop || { x: 0, y: 0, w: 1, h: 1 };
    var hasCrop = Math.abs(cr.x || 0) > 0.002 || Math.abs(cr.y || 0) > 0.002 || Math.abs((cr.w == null ? 1 : cr.w) - 1) > 0.002 || Math.abs((cr.h == null ? 1 : cr.h) - 1) > 0.002;
    var hasStyle = (it.radius > 0) || (it.borderWidth > 0) || (it.op != null && it.op < 0.995);
    var isNativeFmt = /^data:image\/(png|jpe?g);base64,/i.test(src);
    if (isNativeFmt && !hasCrop && !hasStyle) return Promise.resolve(src);

    return loadImg(src).then(function (im) {
      if (!im || !im.naturalWidth || !im.naturalHeight) return isNativeFmt ? src : null;
      var sx = (cr.x || 0) * im.naturalWidth;
      var sy = (cr.y || 0) * im.naturalHeight;
      var sw = Math.max(1, (cr.w == null ? 1 : cr.w) * im.naturalWidth);
      var sh = Math.max(1, (cr.h == null ? 1 : cr.h) * im.naturalHeight);
      var targetScale = Math.max(2, Math.min(3, sw / Math.max(1, it.w)));
      var cw = Math.min(2048, Math.max(2, Math.round(it.w * targetScale)));
      var ch = Math.min(2048, Math.max(2, Math.round(it.h * targetScale)));
      var cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = ch;
      var ctx = cv.getContext('2d');
      var rScale = cw / Math.max(1, it.w);
      ctx.globalAlpha = it.op != null ? Math.max(0, Math.min(1, it.op)) : 1;
      ctx.save();
      roundRectPath(ctx, 0, 0, cw, ch, (it.radius || 0) * rScale);
      ctx.clip();
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
      ctx.restore();
      if (it.borderWidth > 0) {
        var bw = it.borderWidth * rScale;
        roundRectPath(ctx, bw / 2, bw / 2, Math.max(1, cw - bw), Math.max(1, ch - bw), (it.radius || 0) * rScale);
        ctx.strokeStyle = it.borderColor || '#7C3AED';
        ctx.lineWidth = bw;
        ctx.stroke();
      }
      return cv.toDataURL('image/png');
    });
  }

  function buildTextRuns(it, ptScale) {
    var raw = String(it.text == null ? '' : it.text).replace(/\r\n/g, '\n');
    var lines = raw.split('\n');
    if (!lines.length) lines = [''];
    var fallbackDir = dirOf(raw, it.dir || 'auto');
    var fontFace = mapFontFace(it.font);
    var fontSize = Math.max(6, Math.round((it.size || 24) * ptScale));
    var col = cleanHex(it.color, '1B0E3A');
    var align = it.align === 'justify' ? 'justify' : (it.align || (fallbackDir === 'rtl' ? 'right' : 'left'));
    var baseTr = alphaPct(it.op);

    return lines.map(function (ln, idx) {
      var pDir;
      if (it.dir === 'rtl' || it.dir === 'ltr') {
        pDir = it.dir;
      } else {
        pDir = '';
        for (var k = 0; k < ln.length; k++) {
          var ch = ln.charAt(k);
          if (RE_RTL.test(ch)) { pDir = 'rtl'; break; }
          if (RE_LTR.test(ch)) { pDir = 'ltr'; break; }
        }
        if (!pDir) pDir = fallbackDir;
      }
      var isRtl = pDir === 'rtl';
      var runOpts = {
        breakLine: idx < lines.length - 1,
        fontFace: fontFace,
        fontSize: fontSize,
        color: col,
        bold: !!it.bold,
        italic: !!it.italic,
        underline: it.underline ? { style: 'sng' } : undefined,
        align: align,
        rtlMode: isRtl,
        lang: isRtl ? 'ar-SA' : 'en-US'
      };
      if (baseTr > 0 && baseTr < 100) runOpts.transparency = baseTr;
      return { text: ln === '' && lines.length > 1 ? ' ' : ln, options: runOpts };
    });
  }

  function buildPptxSpec(proj) {
    var sz = E.size(proj.ratio);
    var inW = 10, inH = proj.ratio === '4:3' ? 7.5 : 5.625;
    var sx = inW / sz.w, sy = inH / sz.h, ptScale = 72 / 96;
    var counts = { slides: proj.slides.length, text: 0, image: 0, shape: 0, table: 0, chart: 0 };
    var hasAnyRtl = false;

    var slidesSpec = proj.slides.map(function (s, idx) {
      var objs = (s.items || []).map(function (it) {
        var box = {
          x: round3(it.x * sx),
          y: round3(it.y * sy),
          w: Math.max(0.05, round3(it.w * sx)),
          h: Math.max(0.05, round3(it.h * sy)),
          rotate: it.rot || 0
        };
        if (it.type === 'text') {
          counts.text++;
          var isBoxRtl = it.dir === 'rtl' || (it.dir !== 'ltr' && dirOf(it.text || '', 'rtl') === 'rtl');
          if (isBoxRtl) hasAnyRtl = true;
          var padPt = Math.max(0, Math.round((it.pad != null ? it.pad : 8) * ptScale));
          var boxOp = (it.op != null ? it.op : 1) * (it.bgOp != null ? it.bgOp : 1);
          var opts = {
            x: box.x, y: box.y, w: box.w, h: box.h, rotate: box.rotate,
            fontFace: mapFontFace(it.font),
            fontSize: Math.max(6, Math.round((it.size || 24) * ptScale)),
            color: cleanHex(it.color, '1B0E3A'),
            bold: !!it.bold, italic: !!it.italic,
            underline: it.underline ? { style: 'sng' } : undefined,
            align: it.align === 'justify' ? 'justify' : (it.align || 'right'),
            valign: 'top',
            wrap: true,
            rtlMode: isBoxRtl,
            lang: isBoxRtl ? 'ar-SA' : 'en-US',
            lineSpacingMultiple: Math.max(0.8, Math.min(3, parseFloat(it.lh) || 1.35)),
            margin: [padPt, padPt, padPt, padPt],
            fill: it.bg && it.bg !== 'none' ? { color: cleanHex(it.bg, 'FFFFFF'), transparency: alphaPct(boxOp) } : { type: 'none' }
          };
          if (it.borderWidth > 0) {
            opts.line = { color: cleanHex(it.borderColor, '7C3AED'), width: Math.max(0.5, round3(it.borderWidth * ptScale)), transparency: alphaPct(it.op) };
          }
          return {
            kind: 'text',
            runs: buildTextRuns(it, ptScale),
            options: opts
          };
        }
        if (it.type === 'image') {
          counts.image++;
          return {
            kind: 'image',
            item: it,
            options: { x: box.x, y: box.y, w: box.w, h: box.h, rotate: box.rotate }
          };
        }
        if (it.type === 'shape') {
          counts.shape++;
          if (it.kind === 'line' || it.kind === 'arrow' || it.kind === 'darrow') {
            return {
              kind: 'shape',
              shapeType: 'line',
              options: {
                x: box.x,
                y: round3(box.y + box.h / 2),
                w: box.w,
                h: 0,
                rotate: box.rotate,
                line: {
                  color: cleanHex(it.stroke, '7C3AED'),
                  width: Math.max(1, round3((it.sw || 6) * ptScale)),
                  beginArrowType: it.kind === 'darrow' ? 'triangle' : 'none',
                  endArrowType: (it.kind === 'arrow' || it.kind === 'darrow') ? 'triangle' : 'none',
                  transparency: alphaPct(it.op)
                }
              }
            };
          }
          var shOpts = {
            x: box.x, y: box.y, w: box.w, h: box.h, rotate: box.rotate,
            fill: (it.fill && it.fill !== 'none') ? { color: cleanHex(it.fill, '7C3AED'), transparency: alphaPct(it.op) } : { type: 'none' }
          };
          if (it.sw > 0 && it.stroke) {
            shOpts.line = { color: cleanHex(it.stroke, '1B0E3A'), width: Math.max(0.5, round3(it.sw * ptScale)), transparency: alphaPct(it.op) };
          }
          if (it.kind === 'rrect') {
            shOpts.rectRadius = Math.min(box.w / 2, box.h / 2, Math.max(0.02, round3((it.radius || 20) * sx)));
          }
          return {
            kind: 'shape',
            shapeType: PPTX_SHAPE_MAP[it.kind] || 'rect',
            options: shOpts
          };
        }
        if (it.type === 'table') {
          counts.table++;
          var rows = [];
          var colW = [];
          for (var ci = 0; ci < it.cols; ci++) colW.push(round3(box.w / Math.max(1, it.cols)));
          var rowH = [];
          for (var ri = 0; ri < it.rows; ri++) rowH.push(round3(box.h / Math.max(1, it.rows)));

          for (var r = 0; r < it.rows; r++) {
            var row = [];
            for (var c = 0; c < it.cols; c++) {
              var cell = it.cells[r] && it.cells[r][c];
              if (!cell || cell.mergedTo) continue;
              var cellRtl = dirOf(cell.text || '', it.dir || 'auto') === 'rtl';
              if (cellRtl) hasAnyRtl = true;
              row.push({
                text: cell.text || '',
                options: {
                  fill: cell.bg && cell.bg !== 'none' ? { color: cleanHex(cell.bg, 'FFFFFF') } : undefined,
                  color: cleanHex(cell.color, '1B0E3A'),
                  bold: !!cell.bold,
                  align: cell.align === 'justify' ? 'justify' : (cell.align || 'center'),
                  valign: 'middle',
                  fontFace: 'Alexandria',
                  fontSize: Math.max(6, Math.round((it.fontSize || 16) * ptScale)),
                  rtlMode: cellRtl,
                  lang: cellRtl ? 'ar-SA' : 'en-US',
                  rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
                  colspan: cell.colSpan > 1 ? cell.colSpan : undefined
                }
              });
            }
            if (row.length) rows.push(row);
          }
          return {
            kind: 'table',
            rows: rows,
            options: {
              x: box.x, y: box.y, w: box.w, h: box.h,
              colW: colW,
              rowH: rowH,
              fontFace: 'Alexandria',
              fontSize: Math.max(6, Math.round((it.fontSize || 16) * ptScale)),
              border: it.borderWidth > 0 ? { type: 'solid', pt: Math.max(0.5, round3(it.borderWidth * ptScale)), color: cleanHex(it.borderColor, 'CBD5E1') } : { type: 'none' }
            }
          };
        }
        if (it.type === 'chart') {
          counts.chart++;
          var cats = (it.categories && it.categories.length) ? it.categories.map(String) : ['الفئة 1', 'الفئة 2'];
          var rawSeries = (it.series && it.series.length) ? it.series : [{ name: 'البيانات', color: '#7C3AED', values: [10, 20] }];
          var pal = ((it.palette && it.palette.length) ? it.palette : E.DEFAULT_PALETTE).map(function (c) { return cleanHex(c, '7C3AED'); });
          var chType = (it.chartType === 'pie' || it.chartType === 'line') ? it.chartType : 'bar';
          var seriesData = (chType === 'pie' ? [rawSeries[0]] : rawSeries).map(function (sr) {
            return {
              name: sr.name || 'السلسلة',
              labels: cats,
              values: cats.map(function (_, vi) { var val = parseFloat(sr.values && sr.values[vi]); return isFinite(val) ? val : 0; })
            };
          });
          var chartColors;
          if (chType === 'pie' || rawSeries.length === 1) {
            chartColors = chType === 'pie' ? pal : [cleanHex(rawSeries[0].color || ('#' + pal[0]), pal[0])];
          } else {
            chartColors = rawSeries.map(function (sr, si) { return cleanHex(sr.color || ('#' + pal[si % pal.length]), pal[si % pal.length]); });
          }
          var tcHex = cleanHex(it.textColor, '1B0E3A');
          var bgHex = it.bg && it.bg !== 'none' ? cleanHex(it.bg, 'FFFFFF') : null;
          if (RE_RTL.test(it.title || '') || cats.some(function (c) { return RE_RTL.test(c); })) hasAnyRtl = true;
          var chOpts = {
            x: box.x, y: box.y, w: box.w, h: box.h,
            title: it.title || '',
            showTitle: !!it.title,
            titleColor: tcHex,
            titleFontFace: 'Alexandria',
            titleFontSize: 12,
            showLegend: !!it.showLegend,
            legendColor: tcHex,
            legendFontFace: 'Alexandria',
            legendFontSize: 10,
            legendPos: 'b',
            showValue: !!it.showValues,
            showPercent: chType === 'pie' ? !!it.showValues : false,
            dataLabelColor: chType === 'pie' ? 'FFFFFF' : tcHex,
            dataLabelFontFace: 'Alexandria',
            dataLabelFontSize: 9,
            catAxisLabelColor: tcHex,
            valAxisLabelColor: tcHex,
            catAxisLabelFontFace: 'Alexandria',
            valAxisLabelFontFace: 'Alexandria',
            catAxisLabelFontSize: 9,
            valAxisLabelFontSize: 9,
            chartColors: chartColors
          };
          if (chType === 'bar') {
            chOpts.barDir = 'col';
            chOpts.barGrouping = 'clustered';
          }
          return {
            kind: 'chart',
            chartType: chType,
            bgHex: bgHex,
            box: box,
            data: seriesData,
            options: chOpts
          };
        }
        return null;
      }).filter(Boolean);
      return {
        index: idx + 1,
        background: { color: cleanHex(s.bg, 'FFFFFF') },
        notes: s.notes || '',
        objects: objs
      };
    });

    return {
      format: 'pptxgenjs-v4',
      title: proj.name || 'presentation',
      layout: proj.ratio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9',
      rtlMode: hasAnyRtl,
      dimensionsInches: { w: inW, h: inH },
      counts: counts,
      slides: slidesSpec
    };
  }

  function exportPptx(proj) {
    if (!proj || !proj.slides || !proj.slides.length) {
      return Promise.resolve({ ready: false, error: 'لا توجد شرائح في العرض للتصدير' });
    }
    var spec = buildPptxSpec(proj);
    return ensurePptxGen().then(function (Pptx) {
      var imgTasks = [];
      spec.slides.forEach(function (sp) {
        sp.objects.forEach(function (obj) {
          if (obj.kind === 'image') {
            imgTasks.push(prepareImageForPptx(obj.item).then(function (dataUri) { obj.data = dataUri; }));
          }
        });
      });
      return Promise.all(imgTasks).then(function () {
        var pres = new Pptx();
        pres.layout = spec.layout;
        pres.title = spec.title;
        if (spec.rtlMode) pres.rtlMode = true;

        spec.slides.forEach(function (sp) {
          var sl = pres.addSlide();
          sl.background = sp.background;
          if (sp.notes) sl.addNotes(sp.notes);

          sp.objects.forEach(function (obj) {
            if (obj.kind === 'text') {
              sl.addText(obj.runs, obj.options);
            } else if (obj.kind === 'image') {
              if (obj.data) {
                sl.addImage({
                  data: obj.data,
                  x: obj.options.x,
                  y: obj.options.y,
                  w: obj.options.w,
                  h: obj.options.h,
                  rotate: obj.options.rotate
                });
              }
            } else if (obj.kind === 'shape') {
              var st = (pres.ShapeType && pres.ShapeType[obj.shapeType]) || obj.shapeType;
              sl.addShape(st, obj.options);
            } else if (obj.kind === 'table') {
              if (obj.rows && obj.rows.length) sl.addTable(obj.rows, obj.options);
            } else if (obj.kind === 'chart') {
              if (obj.bgHex) {
                sl.addShape((pres.ShapeType && pres.ShapeType.roundRect) || 'roundRect', {
                  x: obj.box.x, y: obj.box.y, w: obj.box.w, h: obj.box.h,
                  rectRadius: 0.08,
                  fill: { color: obj.bgHex }
                });
              }
              var ct = (pres.ChartType && pres.ChartType[obj.chartType]) || obj.chartType;
              sl.addChart(ct, obj.data, obj.options);
            }
          });
        });

        var fileName = safeName(proj.name) + '.pptx';
        return pres.writeFile({ fileName: fileName }).then(function () {
          return { ready: true, fileName: fileName, spec: spec };
        });
      });
    }).catch(function (err) {
      return { ready: false, error: (err && err.message) ? err.message : 'تعذّر إنشاء ملف PowerPoint', spec: spec };
    });
  }

  root.SLX = {
    renderSlideToCanvas: renderSlideToCanvas,
    png: { exportSlide: exportSlidePng, exportAll: exportAllPng },
    pdf: { exportPdf: exportPdf },
    pptx: {
      isAvailable: function () { return typeof root.PptxGenJS === 'function'; },
      buildSpec: buildPptxSpec,
      exportPptx: exportPptx
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
