/* ==========================================================================
   slides-canvas.js — محرك الرسم والتفاعل لشرائح «استوديو العروض»
   - يرسم العناصر: text | image (مع القص والحدود والزوايا) | shape (SVG متكامل)
     | table (تعديل مباشر للخلايا + تحديد نطاق + دمج) | chart (SVG: أعمدة/دائري/خطي)
   - يدعم: التحديد المتعدد، مربع التحديد، التجميع، الخطوط الإرشادية الذكية،
     قص الصور التفاعلي، النسخ واللصق، التكبير والتصغير، واللمس على الهاتف
   ========================================================================== */
(function () {
  'use strict';
  var E = window.SLE; if (!E) return;
  var S = {
    ctx: null, root: null, slideEl: null, cv: null, ov: null,
    selIds: [], editing: null, editingCell: null, cropId: null,
    cellSel: null, drag: null, ro: null, zoom: 1, guides: []
  };
  var GEN = ['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive', 'fantasy'];
  var clipboard = [];

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var I = {
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    lock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    unlock: ic('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
    up: ic('<path d="m18 15-6-6-6 6"/>'), down: ic('<path d="m6 9 6 6 6-6"/>'),
    group: ic('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M13 7h4a2 2 0 0 1 2 2v1"/><path d="M11 17H7a2 2 0 0 1-2-2v-1"/>'),
    ungroup: ic('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M14 4h6v6"/><path d="M4 14v6h6"/>'),
    check: ic('<polyline points="20 6 9 17 4 12"/>'),
    x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')
  };
  var SEL_NAMES = { text: 'نص', image: 'صورة', shape: 'شكل', table: 'جدول', chart: 'مخطط' };

  function hexRgba(hex, op) {
    if (!hex || hex === 'none') return 'transparent';
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var a = op == null ? 1 : Math.max(0, Math.min(1, op));
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function ff(n) { return GEN.indexOf(n) >= 0 ? n : '"' + String(n || 'Alexandria').replace(/"/g, '') + '",Tahoma,Arial,sans-serif'; }

  /* ---------- رسم الأشكال الهندسية SVG ---------- */
  function polyPoints(pts) { return pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function regularPoly(cx, cy, rx, ry, sides, offsetDeg) {
    var pts = [], off = (offsetDeg || -90) * Math.PI / 180;
    for (var i = 0; i < sides; i++) {
      var a = off + (i * 2 * Math.PI) / sides;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return polyPoints(pts);
  }
  function starPoints(cx, cy, rx, ry, points) {
    var pts = [], off = -Math.PI / 2;
    for (var i = 0; i < points * 2; i++) {
      var a = off + (i * Math.PI) / points;
      var k = i % 2 === 0 ? 1 : 0.44;
      pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
    }
    return polyPoints(pts);
  }
  function shapeSvg(it) {
    var w = Math.max(2, it.w), h = Math.max(2, it.h), sw = it.sw || 0;
    var f = it.fill === 'none' ? 'none' : it.fill, s = sw > 0 ? it.stroke : 'none', o = sw / 2;
    var b = '';
    if (it.kind === 'circle') {
      b = '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + Math.max(0, w / 2 - o) + '" ry="' + Math.max(0, h / 2 - o) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '"/>';
    } else if (it.kind === 'line' || it.kind === 'arrow' || it.kind === 'darrow') {
      var st = it.stroke || '#7C3AED', lw = Math.max(1, sw || 4);
      var L = Math.min(w * 0.42, Math.max(14, lw * 3.5)), W = L * 0.85, y = h / 2;
      var x1 = it.kind === 'darrow' ? L - 1 : 0;
      var x2 = (it.kind === 'arrow' || it.kind === 'darrow') ? w - L + 1 : w;
      b = '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + st + '" stroke-width="' + lw + '" stroke-linecap="round"/>';
      if (it.kind === 'arrow' || it.kind === 'darrow') {
        b += '<polygon points="' + w + ',' + y + ' ' + (w - L) + ',' + (y - W / 2) + ' ' + (w - L) + ',' + (y + W / 2) + '" fill="' + st + '"/>';
      }
      if (it.kind === 'darrow') {
        b += '<polygon points="0,' + y + ' ' + L + ',' + (y - W / 2) + ' ' + L + ',' + (y + W / 2) + '" fill="' + st + '"/>';
      }
    } else if (it.kind === 'triangle') {
      b = '<polygon points="' + polyPoints([[w / 2, o], [w - o, h - o], [o, h - o]]) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
    } else if (it.kind === 'diamond') {
      b = '<polygon points="' + polyPoints([[w / 2, o], [w - o, h / 2], [w / 2, h - o], [o, h / 2]]) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
    } else if (it.kind === 'pentagon') {
      b = '<polygon points="' + regularPoly(w / 2, h / 2, Math.max(1, w / 2 - o), Math.max(1, h / 2 - o), 5, -90) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
    } else if (it.kind === 'hexagon') {
      b = '<polygon points="' + regularPoly(w / 2, h / 2, Math.max(1, w / 2 - o), Math.max(1, h / 2 - o), 6, 0) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
    } else if (it.kind === 'star') {
      b = '<polygon points="' + starPoints(w / 2, h / 2, Math.max(1, w / 2 - o), Math.max(1, h / 2 - o), 5) + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
    } else if (it.kind === 'callout') {
      var bh = h * 0.78, rx = Math.min(18, w * 0.12, bh * 0.25);
      var path = 'M' + (o + rx) + ',' + o + ' H' + (w - o - rx) + ' Q' + (w - o) + ',' + o + ' ' + (w - o) + ',' + (o + rx) +
        ' V' + (bh - rx) + ' Q' + (w - o) + ',' + bh + ' ' + (w - o - rx) + ',' + bh +
        ' H' + (w * 0.38) + ' L' + (w * 0.22) + ',' + (h - o) + ' L' + (w * 0.26) + ',' + bh +
        ' H' + (o + rx) + ' Q' + o + ',' + bh + ' ' + o + ',' + (bh - rx) +
        ' V' + (o + rx) + ' Q' + o + ',' + o + ' ' + (o + rx) + ',' + o + ' Z';
      b = '<path d="' + path + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>';
    } else {
      var rad = it.kind === 'rrect' ? Math.min(it.radius != null ? it.radius : 20, w / 2, h / 2) : 0;
      b = '<rect x="' + o + '" y="' + o + '" width="' + Math.max(0, w - sw) + '" height="' + Math.max(0, h - sw) + '"' + (rad ? ' rx="' + rad + '"' : '') + ' fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '"/>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + b + '</svg>';
  }

  /* ---------- رسم المخططات البيانية SVG ---------- */
  function chartSvg(it) {
    var w = Math.max(120, it.w), h = Math.max(90, it.h);
    var cats = it.categories || [], series = it.series || [], s0 = series[0] || { name: '', color: '#7C3AED', values: [] };
    var pal = (it.palette && it.palette.length) ? it.palette : E.DEFAULT_PALETTE;
    var tc = it.textColor || '#1B0E3A';
    var bg = it.bg && it.bg !== 'none' ? it.bg : 'transparent';
    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="font-family:Alexandria,Tahoma,sans-serif" aria-hidden="true">';
    if (bg !== 'transparent') out += '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="10" fill="' + esc(bg) + '"/>';
    var topPad = it.title ? 38 : 16;
    if (it.title) {
      out += '<text x="' + (w / 2) + '" y="24" text-anchor="middle" font-size="15" font-weight="700" fill="' + esc(tc) + '">' + esc(it.title) + '</text>';
    }
    var legH = it.showLegend ? 28 : 8;
    var plotX = 46, plotY = topPad, plotW = Math.max(40, w - 64), plotH = Math.max(30, h - topPad - legH - 26);

    if (it.chartType === 'pie') {
      var vals = cats.map(function (_, i) { return Math.max(0, parseFloat(s0.values[i]) || 0); });
      var sum = vals.reduce(function (a, b) { return a + b; }, 0);
      var cx = w / 2, cy = plotY + plotH / 2 + 4, r = Math.max(16, Math.min(plotW, plotH) * 0.44);
      if (sum <= 0) {
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#E2E8F0"/>';
      } else {
        var ang = -Math.PI / 2;
        vals.forEach(function (v, idx) {
          if (v <= 0) return;
          var slice = (v / sum) * Math.PI * 2;
          var col = pal[idx % pal.length];
          if (slice >= Math.PI * 1.999) {
            out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + col + '"/>';
          } else {
            var x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
            var x2 = cx + r * Math.cos(ang + slice), y2 = cy + r * Math.sin(ang + slice);
            var large = slice > Math.PI ? 1 : 0;
            out += '<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) + ' Z" fill="' + col + '" stroke="' + (bg === 'transparent' ? '#fff' : bg) + '" stroke-width="2"/>';
          }
          if (it.showValues && v / sum >= 0.05) {
            var mid = ang + slice / 2, tx = cx + r * 0.64 * Math.cos(mid), ty = cy + r * 0.64 * Math.sin(mid);
            out += '<text x="' + tx.toFixed(1) + '" y="' + (ty + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">' + Math.round((v / sum) * 100) + '%</text>';
          }
          ang += slice;
        });
      }
      if (it.showLegend && cats.length) {
        var lx = 14, ly = h - 18, step = Math.min(115, (w - 24) / Math.max(1, cats.length));
        cats.forEach(function (c, idx) {
          var x = lx + idx * step;
          if (x + 20 > w) return;
          out += '<rect x="' + x + '" y="' + (ly - 9) + '" width="10" height="10" rx="2" fill="' + pal[idx % pal.length] + '"/>';
          out += '<text x="' + (x + 14) + '" y="' + ly + '" font-size="11" fill="' + esc(tc) + '">' + esc(String(c).slice(0, 11)) + '</text>';
        });
      }
    } else {
      var allVals = [];
      series.forEach(function (sr) { cats.forEach(function (_, i) { allVals.push(parseFloat(sr.values[i]) || 0); }); });
      var maxV = Math.max(10, Math.max.apply(null, allVals.length ? allVals : [10]));
      var minV = Math.min(0, Math.min.apply(null, allVals.length ? allVals : [0]));
      var span = Math.max(1, maxV - minV);
      /* شبكة أفقية ومحاور */
      for (var g = 0; g <= 4; g++) {
        var gy = plotY + (plotH * g) / 4;
        var gv = Math.round(maxV - (span * g) / 4);
        out += '<line x1="' + plotX + '" y1="' + gy.toFixed(1) + '" x2="' + (plotX + plotW) + '" y2="' + gy.toFixed(1) + '" stroke="' + esc(tc) + '" stroke-opacity="0.14" stroke-width="1"/>';
        out += '<text x="' + (plotX - 6) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' + esc(tc) + '" fill-opacity="0.72">' + gv + '</text>';
      }
      var zeroY = plotY + ((maxV - 0) / span) * plotH;
      out += '<line x1="' + plotX + '" y1="' + zeroY.toFixed(1) + '" x2="' + (plotX + plotW) + '" y2="' + zeroY.toFixed(1) + '" stroke="' + esc(tc) + '" stroke-opacity="0.45" stroke-width="1.2"/>';

      var nCats = Math.max(1, cats.length), grpW = plotW / nCats;
      if (it.chartType === 'bar') {
        var nSer = Math.max(1, series.length);
        var bw = Math.min(44, Math.max(8, (grpW * 0.68) / nSer));
        series.forEach(function (sr, si) {
          var sCol = sr.color || pal[si % pal.length];
          cats.forEach(function (_, ci) {
            var v = parseFloat(sr.values[ci]) || 0;
            var vy = plotY + ((maxV - v) / span) * plotH;
            var bx = plotX + ci * grpW + (grpW - bw * nSer) / 2 + si * bw;
            var bh = Math.abs(zeroY - vy), by = Math.min(vy, zeroY);
            var barCol = nSer === 1 ? pal[ci % pal.length] : sCol;
            out += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + Math.max(4, bw - 2).toFixed(1) + '" height="' + Math.max(2, bh).toFixed(1) + '" rx="4" fill="' + barCol + '"/>';
            if (it.showValues) {
              out += '<text x="' + (bx + (bw - 2) / 2).toFixed(1) + '" y="' + (by - 5).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="' + esc(tc) + '">' + v + '</text>';
            }
          });
        });
      } else {
        series.forEach(function (sr, si) {
          var sCol = sr.color || pal[si % pal.length];
          var pts = [];
          cats.forEach(function (_, ci) {
            var v = parseFloat(sr.values[ci]) || 0;
            var px = plotX + ci * grpW + grpW / 2;
            var py = plotY + ((maxV - v) / span) * plotH;
            pts.push([px, py, v]);
          });
          if (pts.length > 1) {
            var d = pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
            var area = d + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + zeroY.toFixed(1) + ' L' + pts[0][0].toFixed(1) + ',' + zeroY.toFixed(1) + ' Z';
            out += '<path d="' + area + '" fill="' + sCol + '" fill-opacity="0.14"/>';
            out += '<path d="' + d + '" fill="none" stroke="' + sCol + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
          }
          pts.forEach(function (p) {
            out += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5" fill="' + sCol + '" stroke="#FFFFFF" stroke-width="1.5"/>';
            if (it.showValues) {
              out += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 9).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="' + esc(tc) + '">' + p[2] + '</text>';
            }
          });
        });
      }
      cats.forEach(function (c, ci) {
        var cxLabel = plotX + ci * grpW + grpW / 2;
        out += '<text x="' + cxLabel.toFixed(1) + '" y="' + (plotY + plotH + 17).toFixed(1) + '" text-anchor="middle" font-size="11" fill="' + esc(tc) + '">' + esc(String(c).slice(0, 12)) + '</text>';
      });
      if (it.showLegend && series.length) {
        var sx = plotX, sy = h - 10;
        series.forEach(function (sr, si) {
          var x = sx + si * 115;
          out += '<rect x="' + x + '" y="' + (sy - 9) + '" width="10" height="10" rx="2" fill="' + (sr.color || pal[si % pal.length]) + '"/>';
          out += '<text x="' + (x + 14) + '" y="' + sy + '" font-size="11" fill="' + esc(tc) + '">' + esc(sr.name) + '</text>';
        });
      }
    }
    return out + '</svg>';
  }

  /* ---------- رسم الجدول ---------- */
  function tableHtml(it) {
    var bw = it.borderWidth != null ? it.borderWidth : 1;
    var bc = it.borderColor || '#CBD5E1';
    var fs = it.fontSize || 16;
    var dir = it.dir || 'auto';
    var h = '<table class="sl-tbl" dir="' + esc(dir) + '" style="border-collapse:collapse;width:100%;height:100%;table-layout:fixed;font-size:' + fs + 'px">';
    for (var r = 0; r < it.rows; r++) {
      h += '<tr>';
      for (var c = 0; c < it.cols; c++) {
        var cell = it.cells[r] && it.cells[r][c];
        if (!cell || cell.mergedTo) continue;
        var active = S.cellSel && S.cellSel.id === it.id &&
          r >= Math.min(S.cellSel.r, S.cellSel.r2) && r <= Math.max(S.cellSel.r, S.cellSel.r2) &&
          c >= Math.min(S.cellSel.c, S.cellSel.c2) && c <= Math.max(S.cellSel.c, S.cellSel.c2);
        var bg = cell.bg && cell.bg !== 'none' ? cell.bg : 'transparent';
        h += '<td class="sl-td' + (active ? ' on' : '') + '" data-r="' + r + '" data-c="' + c + '"' +
          (cell.rowSpan > 1 ? ' rowspan="' + cell.rowSpan + '"' : '') +
          (cell.colSpan > 1 ? ' colspan="' + cell.colSpan + '"' : '') +
          ' style="background:' + esc(bg) + ';color:' + esc(cell.color || '#1B0E3A') + ';font-weight:' + (cell.bold ? 700 : 400) +
          ';text-align:' + esc(cell.align || 'center') + ';border:' + bw + 'px solid ' + esc(bc) + '">' +
          '<div class="sl-td-in" dir="' + esc(dir) + '">' + esc(cell.text) + '</div></td>';
      }
      h += '</tr>';
    }
    return h + '</table>';
  }

  /* ---------- رسم النص والصورة والعنصر الكامل ---------- */
  function textHtml(it) {
    var bg = it.bg && it.bg !== 'none' ? hexRgba(it.bg, it.bgOp != null ? it.bgOp : 1) : 'transparent';
    var bw = it.borderWidth || 0;
    var bd = bw > 0 ? bw + 'px solid ' + (it.borderColor || '#7C3AED') : 'none';
    var pad = it.pad != null ? it.pad : 8;
    var lh = it.lh || 1.35;
    var ov = it.overflow === 'visible' ? 'visible' : (it.overflow === 'shrink' ? 'hidden' : 'auto');
    var dir = it.dir || 'auto';
    var dec = it.underline ? 'underline' : 'none';
    var size = it.size;
    if (it.overflow === 'shrink' && it.text) {
      /* تقدير أولي لمنع اختفاء النص الطويل؛ والتضييق الدقيق يحصل أيضاً بعد الرسم */
      var approxCharsPerLine = Math.max(6, Math.floor((it.w - pad * 2) / (size * 0.52)));
      var lines = Math.max(1, Math.ceil(it.text.length / approxCharsPerLine) + (it.text.match(/\n/g) || []).length);
      while (lines * size * lh > (it.h - pad * 2) && size > 10) {
        size = Math.max(10, size - 2);
        approxCharsPerLine = Math.max(6, Math.floor((it.w - pad * 2) / (size * 0.52)));
        lines = Math.max(1, Math.ceil(it.text.length / approxCharsPerLine) + (it.text.match(/\n/g) || []).length);
      }
    }
    return '<div class="sl-tx" dir="' + esc(dir) + '" style="font-family:' + esc(ff(it.font)) +
      ';font-size:' + size + 'px;line-height:' + lh + ';padding:' + pad + 'px;color:' + esc(it.color) +
      ';text-align:' + esc(it.align) + ';font-weight:' + (it.bold ? 700 : 400) +
      ';font-style:' + (it.italic ? 'italic' : 'normal') + ';text-decoration:' + dec +
      ';background:' + bg + ';border:' + bd + ';overflow-y:' + ov + '">' + esc(it.text) + '</div>';
  }
  function imageHtml(it) {
    if (!it.src) return '<div class="sl-img-miss">صورة مفقودة</div>';
    var c = it.crop || { x: 0, y: 0, w: 1, h: 1 };
    var bw = it.borderWidth || 0;
    var rad = it.radius || 0;
    var isCropping = S.cropId === it.id;
    var wrapStyle = 'width:100%;height:100%;position:relative;overflow:' + (isCropping ? 'visible' : 'hidden') +
      ';border-radius:' + rad + 'px;box-sizing:border-box;' + (bw > 0 ? 'border:' + bw + 'px solid ' + esc(it.borderColor || '#7C3AED') + ';' : '');
    var imgStyle = 'position:absolute;left:' + (-(c.x / c.w) * 100).toFixed(3) + '%;top:' + (-(c.y / c.h) * 100).toFixed(3) +
      '%;width:' + (100 / c.w).toFixed(3) + '%;height:' + (100 / c.h).toFixed(3) + '%;max-width:none;object-fit:fill;display:block;pointer-events:none;' +
      (isCropping ? 'opacity:0.45;' : '');
    var h = '<div class="sl-img-wrap" style="' + wrapStyle + '"><img src="' + esc(it.src) + '" alt="" draggable="false" style="' + imgStyle + '">';
    if (isCropping) {
      h += '<div class="sl-crop-win" style="position:absolute;inset:0;overflow:hidden;border:2px dashed #FBBF24;box-sizing:border-box">' +
        '<img src="' + esc(it.src) + '" alt="" draggable="false" style="position:absolute;left:' + (-(c.x / c.w) * 100).toFixed(3) + '%;top:' + (-(c.y / c.h) * 100).toFixed(3) + '%;width:' + (100 / c.w).toFixed(3) + '%;height:' + (100 / c.h).toFixed(3) + '%;max-width:none;object-fit:fill;pointer-events:none">' +
        '</div>';
    }
    return h + '</div>';
  }
  function innerHtml(it) {
    if (it.type === 'text') return textHtml(it);
    if (it.type === 'image') return imageHtml(it);
    if (it.type === 'table') return tableHtml(it);
    if (it.type === 'chart') return chartSvg(it);
    return shapeSvg(it);
  }
  function styleOf(it) {
    var op = it.op != null ? it.op : 1;
    return 'left:' + it.x + 'px;top:' + it.y + 'px;width:' + it.w + 'px;height:' + it.h + 'px;transform:rotate(' + (it.rot || 0) + 'deg);opacity:' + op;
  }
  function itemHtml(it) {
    return '<div class="sl-it sl-it-' + it.type + (it.locked ? ' lk' : '') + (it.group ? ' grp' : '') + '" data-id="' + it.id + '" style="' + styleOf(it) + '">' + innerHtml(it) + '</div>';
  }
  function renderSlide(cv, slide) {
    cv.innerHTML = slide.items.map(itemHtml).join('');
    var sl = cv.closest('.sl-slide');
    if (sl) sl.classList.toggle('has-items', slide.items.length > 0);
  }

  /* ---------- التحجيم والتكبير ---------- */
  function applyZoom() {
    if (!S.slideEl) return;
    var stage = S.ctx.stage();
    if (!stage) return;
    var sw = stage.clientWidth - 32, sh = stage.clientHeight - 32;
    var sz = S.ctx.size(), ratio = sz.w / sz.h;
    var baseW = Math.max(180, Math.min(sw, sh * ratio));
    S.slideEl.style.width = Math.round(baseW * S.zoom) + 'px';
    fit(stage);
  }
  function fit(scope) {
    [].forEach.call((scope || document).querySelectorAll('[data-fit]'), function (el) {
      var k = el.clientWidth / (+el.dataset.w || 1);
      if (!k) return;
      el.style.setProperty('--sl-k', k);
      [].forEach.call(el.children, function (c) {
        if (c.classList.contains('sl-cv') || c.classList.contains('sl-ov')) c.style.transform = 'scale(' + k + ')';
      });
      var clip = el.querySelector('.sl-clip > .sl-cv');
      if (clip) clip.style.transform = 'scale(' + k + ')';
    });
  }
  function fillThumbs(scope, proj) {
    [].forEach.call(scope.querySelectorAll('.sl-tp[data-sid]'), function (tp) {
      var s = proj.slides.filter(function (x) { return x.id === tp.dataset.sid; })[0], cv = tp.querySelector('.sl-cv');
      if (s && cv) renderSlide(cv, s);
    });
    fit(scope);
  }
  function refreshThumb(slide) {
    var tp = S.root && S.root.querySelector('.sl-tp[data-sid="' + slide.id + '"]'), cv = tp && tp.querySelector('.sl-cv');
    if (cv) { renderSlide(cv, slide); fit(tp.parentElement); }
  }

  /* ---------- التحديد والتجميع ---------- */
  function slide() { return S.ctx && S.ctx.slide(); }
  function selectedItems() {
    var s = slide(); if (!s) return [];
    return S.selIds.map(function (id) { return E.find(s, id); }).filter(Boolean);
  }
  function cur() { var arr = selectedItems(); return arr.length ? arr[0] : null; }
  function itemEl(id) { return S.cv && S.cv.querySelector('.sl-it[data-id="' + id + '"]'); }
  function expandGroupIds(s, ids) {
    var set = {};
    ids.forEach(function (id) {
      var it = E.find(s, id);
      if (!it) return;
      set[id] = true;
      if (it.group) E.getGroupMembers(s, it.group).forEach(function (m) { set[m.id] = true; });
    });
    return Object.keys(set);
  }
  function multiBounds(items) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(function (it) {
      var b = E.itemAABB(it);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  var HANDLES = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]];
  function drawSel() {
    if (!S.ov) return;
    var items = selectedItems();
    var bar = S.ctx.stage() && S.ctx.stage().querySelector('.sl-ctx');
    var h = '';

    /* خطوط إرشادية أثناء السحب */
    S.guides.forEach(function (g) {
      if (g.axis === 'x') h += '<div class="sl-guide sl-guide-v" style="left:' + g.pos + 'px"></div>';
      else h += '<div class="sl-guide sl-guide-h" style="top:' + g.pos + 'px"></div>';
    });

    if (S.drag && S.drag.mode === 'marq') {
      var mq = S.drag.rect;
      h += '<div class="sl-marquee" style="left:' + mq.x + 'px;top:' + mq.y + 'px;width:' + mq.w + 'px;height:' + mq.h + 'px"></div>';
    }

    if (!items.length) {
      S.ov.innerHTML = h;
      if (bar) { bar.hidden = true; bar.innerHTML = ''; }
      return;
    }

    if (items.length === 1) {
      var it = items[0];
      h += '<div class="sl-sel' + (it.locked ? ' lk' : '') + (S.editing || S.editingCell ? ' ed' : '') + (S.cropId === it.id ? ' crop' : '') + '" style="' + styleOf(it) + '">';
      if (!it.locked && !S.editing && !S.editingCell) {
        var line = it.type === 'shape' && (it.kind === 'line' || it.kind === 'arrow' || it.kind === 'darrow');
        HANDLES.forEach(function (d) {
          if (line && (d[1] === 0 || d[2] !== 0)) return;
          h += '<span class="sl-h h-' + d[0] + (S.cropId === it.id ? ' crop-h' : '') + '" data-h="' + d[1] + ',' + d[2] + '"></span>';
        });
        if (S.cropId !== it.id) h += '<span class="sl-h sl-rot" data-h="rot"></span>';
      }
      h += '</div>';
    } else {
      items.forEach(function (it) {
        h += '<div class="sl-sel sub' + (it.locked ? ' lk' : '') + '" style="' + styleOf(it) + '"></div>';
      });
      var mb = multiBounds(items);
      h += '<div class="sl-sel grp-box" style="left:' + mb.x + 'px;top:' + mb.y + 'px;width:' + mb.w + 'px;height:' + mb.h + 'px;transform:none"></div>';
    }

    S.ov.innerHTML = h;

    if (bar) {
      bar.hidden = false;
      if (S.cropId) {
        bar.innerHTML = '<span class="sl-ctx-n">قص الصورة</span>' +
          cbtn('crop-done', I.check, 'تأكيد القص') +
          cbtn('crop-reset', I.x, 'إلغاء القص');
      } else if (items.length === 1) {
        var it1 = items[0];
        bar.innerHTML = '<span class="sl-ctx-n">' + SEL_NAMES[it1.type] + '</span>' +
          cbtn('dup', I.copy, 'تكرار') +
          cbtn('lock', it1.locked ? I.unlock : I.lock, it1.locked ? 'إلغاء القفل' : 'قفل') +
          cbtn('forward', I.up, 'للأمام') +
          cbtn('backward', I.down, 'للخلف') +
          cbtn('del', I.trash, 'حذف العنصر', ' dng');
      } else {
        var hasGrp = items.some(function (x) { return !!x.group; });
        bar.innerHTML = '<span class="sl-ctx-n">' + items.length + ' عناصر</span>' +
          (hasGrp ? cbtn('ungroup', I.ungroup, 'فك التجميع') : cbtn('group', I.group, 'تجميع')) +
          cbtn('dup', I.copy, 'تكرار') +
          cbtn('forward', I.up, 'للأمام') +
          cbtn('backward', I.down, 'للخلف') +
          cbtn('del', I.trash, 'حذف المحدد', ' dng');
      }
    }
  }
  function cbtn(a, icon, label, x) { return '<button type="button" class="sl-cbtn' + (x || '') + '" data-pa="' + a + '" aria-label="' + label + '" title="' + label + '">' + icon + '</button>'; }

  function setSelection(ids) {
    var s = slide();
    if (!s) { S.selIds = []; drawSel(); return; }
    var next = expandGroupIds(s, ids || []);
    var same = next.length === S.selIds.length && next.every(function (v, i) { return v === S.selIds[i]; });
    if (same) return;
    if (S.editing && next.indexOf(S.editing) < 0) stopEdit();
    if (S.editingCell && next.indexOf(S.editingCell.id) < 0) stopCellEdit();
    if (S.cropId && next.indexOf(S.cropId) < 0) S.cropId = null;
    if (!next.length || (S.cellSel && next.indexOf(S.cellSel.id) < 0)) S.cellSel = null;
    S.selIds = next;
    drawSel();
    S.ctx.changed('select');
  }
  function select(id) { setSelection(id ? [id] : []); }

  function refreshItem(id, full) {
    var it = E.find(slide(), id), el = itemEl(id);
    if (!it || !el) return;
    if (full) el.outerHTML = itemHtml(it);
    else el.setAttribute('style', styleOf(it));
  }

  /* ---------- خطوط إرشادية ذكية ---------- */
  function computeGuides(s, movingIds, candBox) {
    var sz = S.ctx.size(), T = 5;
    var idSet = {}; movingIds.forEach(function (id) { idSet[id] = true; });
    var xs = [0, sz.w / 2, sz.w], ys = [0, sz.h / 2, sz.h];
    s.items.forEach(function (it) {
      if (idSet[it.id]) return;
      var b = E.itemAABB(it);
      xs.push(b.x, b.cx, b.x + b.w);
      ys.push(b.y, b.cy, b.y + b.h);
    });
    var mXs = [candBox.x, candBox.x + candBox.w / 2, candBox.x + candBox.w];
    var mYs = [candBox.y, candBox.y + candBox.h / 2, candBox.y + candBox.h];
    var bestDx = 0, minDx = T + 1, gx = null;
    mXs.forEach(function (mx) {
      xs.forEach(function (tx) {
        var d = tx - mx;
        if (Math.abs(d) < minDx) { minDx = Math.abs(d); bestDx = d; gx = tx; }
      });
    });
    var bestDy = 0, minDy = T + 1, gy = null;
    mYs.forEach(function (my) {
      ys.forEach(function (ty) {
        var d = ty - my;
        if (Math.abs(d) < minDy) { minDy = Math.abs(d); bestDy = d; gy = ty; }
      });
    });
    var guides = [];
    if (gx != null) guides.push({ axis: 'x', pos: gx });
    if (gy != null) guides.push({ axis: 'y', pos: gy });
    return { dx: gx != null ? bestDx : 0, dy: gy != null ? bestDy : 0, guides: guides };
  }

  /* ---------- المؤشر: سحب وتحجيم وتدوير وقص وتحديد مربع ---------- */
  function pt(e) {
    var r = S.slideEl.getBoundingClientRect(), k = r.width / S.ctx.size().w;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k, k: k };
  }
  function onDown(e) {
    if (e.button > 0) return;
    if (S.editing) { if (e.target.closest('.sl-it[data-id="' + S.editing + '"]')) return; stopEdit(); }
    if (S.editingCell) { if (e.target.closest('.sl-it[data-id="' + S.editingCell.id + '"] td')) return; stopCellEdit(); }

    var s = slide(); if (!s) return;
    var h = e.target.closest('[data-h]'), items = selectedItems(), p = pt(e);

    /* مقابض التحجيم / القص / التدوير */
    if (h && items.length === 1 && !items[0].locked) {
      var it = items[0], hv = h.dataset.h;
      var st = { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot || 0, crop: it.crop ? E.clone(it.crop) : { x: 0, y: 0, w: 1, h: 1 } };
      if (S.cropId === it.id && hv !== 'rot') {
        S.drag = { mode: 'crop', id: it.id, st: st, hx: +hv.split(',')[0], hy: +hv.split(',')[1], p0: p };
      } else {
        var kp = it.type === 'image' || (it.type === 'shape' && it.kind === 'square');
        S.drag = hv === 'rot' ? { mode: 'rot', id: it.id, st: st } : { mode: 'rs', id: it.id, st: st, hx: +hv.split(',')[0], hy: +hv.split(',')[1], keep: kp, p0: p };
      }
      try { S.slideEl.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
      return;
    }

    /* النقر على خلية جدول */
    var td = e.target.closest('.sl-td');
    var el = e.target.closest('.sl-it');
    if (el) {
      var id = el.dataset.id, was = S.selIds.indexOf(id) >= 0, t = E.find(s, id);
      if (S.cropId && S.cropId !== id) { S.cropId = null; refreshItem(S.cropId, true); }
      if (e.shiftKey) {
        var curIds = S.selIds.slice();
        if (was) curIds = curIds.filter(function (x) { return x !== id && (!t.group || E.find(s, x).group !== t.group); });
        else curIds.push(id);
        setSelection(curIds);
      } else if (!was) {
        setSelection([id]);
      }
      if (td && t && t.type === 'table') {
        var r = +td.dataset.r, c = +td.dataset.c;
        if (e.shiftKey && S.cellSel && S.cellSel.id === id) {
          S.cellSel.r2 = r; S.cellSel.c2 = c;
        } else {
          S.cellSel = { id: id, r: r, c: c, r2: r, c2: c };
        }
        refreshItem(id, true);
        S.ctx.changed('select');
      }
      var selNow = selectedItems().filter(function (x) { return !x.locked; });
      if (selNow.length) {
        var starts = {};
        selNow.forEach(function (x) { starts[x.id] = { x: x.x, y: x.y }; });
        S.drag = { mode: 'mv', id: id, starts: starts, box0: multiBounds(selNow), p0: p, moved: false, was: was, td: td };
        try { S.slideEl.setPointerCapture(e.pointerId); } catch (x) {}
      }
      e.preventDefault();
      return;
    }

    /* النقر على المساحة الفارغة -> إلغاء التحديد أو بدء مربع التحديد */
    if (S.cropId) { var cid = S.cropId; S.cropId = null; refreshItem(cid, true); }
    setSelection([]);
    S.drag = { mode: 'marq', p0: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } };
    try { S.slideEl.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }

  function onMove(e) {
    var d = S.drag; if (!d) return;
    var s = slide(); if (!s) return;
    var p = pt(e);
    if (d.mode === 'marq') {
      var x = Math.min(d.p0.x, p.x), y = Math.min(d.p0.y, p.y);
      d.rect = { x: x, y: y, w: Math.abs(p.x - d.p0.x), h: Math.abs(p.y - d.p0.y) };
      drawSel();
      return;
    }
    if (d.mode === 'mv') {
      var dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      if (!d.moved && Math.hypot(dx, dy) * p.k < 4) return;
      d.moved = true;
      var ids = Object.keys(d.starts);
      if (!e.altKey) {
        var cand = { x: d.box0.x + dx, y: d.box0.y + dy, w: d.box0.w, h: d.box0.h };
        var g = computeGuides(s, ids, cand);
        dx += g.dx; dy += g.dy;
        S.guides = g.guides;
      } else { S.guides = []; }
      ids.forEach(function (id) {
        E.move(s, id, d.starts[id].x + dx, d.starts[id].y + dy);
        refreshItem(id, false);
      });
    } else if (d.mode === 'rs') {
      E.setBox(s, d.id, E.calcResize(d.st, d.hx, d.hy, p.x - d.p0.x, p.y - d.p0.y, d.keep && !e.shiftKey));
      refreshItem(d.id, true);
    } else if (d.mode === 'rot') {
      E.rotate(s, d.id, E.calcRotate(d.st, p.x, p.y));
      refreshItem(d.id, false);
    } else if (d.mode === 'crop') {
      var dxC = (p.x - d.p0.x) / Math.max(1, d.st.w) * d.st.crop.w;
      var dyC = (p.y - d.p0.y) / Math.max(1, d.st.h) * d.st.crop.h;
      var c0 = d.st.crop, nc = { x: c0.x, y: c0.y, w: c0.w, h: c0.h };
      if (d.hx < 0) { var nx = Math.max(0, Math.min(c0.x + c0.w - 0.08, c0.x + dxC)); nc.w = c0.w - (nx - c0.x); nc.x = nx; }
      else if (d.hx > 0) { nc.w = Math.max(0.08, Math.min(1 - c0.x, c0.w + dxC)); }
      if (d.hy < 0) { var ny = Math.max(0, Math.min(c0.y + c0.h - 0.08, c0.y + dyC)); nc.h = c0.h - (ny - c0.y); nc.y = ny; }
      else if (d.hy > 0) { nc.h = Math.max(0.08, Math.min(1 - c0.y, c0.h + dyC)); }
      E.update(s, d.id, { crop: nc });
      refreshItem(d.id, true);
    }
    d.changed = true;
    drawSel();
    S.ctx.changed('live');
  }

  function onUp(e) {
    var d = S.drag; if (!d) return;
    S.drag = null;
    S.guides = [];
    try { S.slideEl.releasePointerCapture(e.pointerId); } catch (x) {}
    var s = slide();
    if (d.mode === 'marq') {
      if (s && (d.rect.w > 6 || d.rect.h > 6)) {
        var hit = s.items.filter(function (it) {
          var b = E.itemAABB(it);
          return b.x < d.rect.x + d.rect.w && b.x + b.w > d.rect.x && b.y < d.rect.y + d.rect.h && b.y + b.h > d.rect.y;
        }).map(function (it) { return it.id; });
        setSelection(hit);
      } else { drawSel(); }
      return;
    }
    var it = s && E.find(s, d.id);
    if (d.mode === 'mv' && !d.moved) {
      drawSel();
      if (d.was && it && !it.locked) {
        if (it.type === 'text') startEdit(d.id);
        else if (it.type === 'table' && d.td) startCellEdit(d.id, +d.td.dataset.r, +d.td.dataset.c);
      }
      return;
    }
    drawSel();
    if (d.changed) S.ctx.changed('commit');
  }

  /* ---------- تحرير النص مباشرة ---------- */
  function startEdit(id) {
    var el = itemEl(id), it = E.find(slide(), id), tx = el && el.querySelector('.sl-tx');
    if (!tx || !it || it.locked) return;
    S.editing = id;
    el.classList.add('ed');
    tx.setAttribute('contenteditable', 'plaintext-only');
    if (tx.contentEditable !== 'plaintext-only') tx.setAttribute('contenteditable', 'true');
    tx.setAttribute('spellcheck', 'false');
    drawSel();
    tx.focus();
    try { var r = document.createRange(); r.selectNodeContents(tx); var g = getSelection(); g.removeAllRanges(); g.addRange(r); } catch (x) {}
    tx.oninput = function () { E.update(slide(), id, { text: readText(tx) }); S.ctx.changed('live'); };
    tx.onkeydown = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); tx.blur(); } ev.stopPropagation(); };
    tx.onpaste = function (ev) { ev.preventDefault(); var t = (ev.clipboardData || window.clipboardData).getData('text'); document.execCommand('insertText', false, t); };
    tx.onblur = function () { if (S.editing === id) stopEdit(); };
  }
  function readText(tx) { return tx.innerText.replace(/\n$/, ''); }
  function stopEdit() {
    var id = S.editing; if (!id) return;
    S.editing = null;
    var el = itemEl(id), tx = el && el.querySelector('.sl-tx');
    if (tx) { E.update(slide(), id, { text: readText(tx) }); tx.onblur = null; tx.removeAttribute('contenteditable'); }
    refreshItem(id, true);
    drawSel();
    S.ctx.changed('commit');
  }

  /* ---------- تحرير خلايا الجدول مباشرة ---------- */
  function startCellEdit(id, r, c) {
    var s = slide(), it = E.find(s, id), el = itemEl(id);
    if (!it || it.type !== 'table' || it.locked || !el) return;
    var td = el.querySelector('.sl-td[data-r="' + r + '"][data-c="' + c + '"] .sl-td-in');
    if (!td) return;
    S.editingCell = { id: id, r: r, c: c };
    S.cellSel = { id: id, r: r, c: c, r2: r, c2: c };
    el.classList.add('ed');
    td.setAttribute('contenteditable', 'plaintext-only');
    if (td.contentEditable !== 'plaintext-only') td.setAttribute('contenteditable', 'true');
    drawSel();
    td.focus();
    td.oninput = function () { E.tableSetCell(it, r, c, { text: td.innerText.replace(/\n$/, '') }); S.ctx.changed('live'); };
    td.onkeydown = function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); td.blur(); }
      else if (ev.key === 'Tab') {
        ev.preventDefault();
        stopCellEdit();
        var nextC = c + (ev.shiftKey ? -1 : 1), nextR = r;
        if (nextC >= it.cols) { nextC = 0; nextR++; }
        if (nextC < 0) { nextC = it.cols - 1; nextR--; }
        if (nextR >= 0 && nextR < it.rows) {
          var cell = it.cells[nextR][nextC];
          if (cell && cell.mergedTo) { nextR = cell.mergedTo[0]; nextC = cell.mergedTo[1]; }
          startCellEdit(id, nextR, nextC);
        }
      }
      ev.stopPropagation();
    };
    td.onblur = function () { if (S.editingCell && S.editingCell.id === id) stopCellEdit(); };
  }
  function stopCellEdit() {
    var ec = S.editingCell; if (!ec) return;
    S.editingCell = null;
    var el = itemEl(ec.id), it = E.find(slide(), ec.id);
    var td = el && el.querySelector('.sl-td[data-r="' + ec.r + '"][data-c="' + ec.c + '"] .sl-td-in');
    if (td && it) { E.tableSetCell(it, ec.r, ec.c, { text: td.innerText.replace(/\n$/, '') }); td.onblur = null; td.removeAttribute('contenteditable'); }
    refreshItem(ec.id, true);
    drawSel();
    S.ctx.changed('commit');
  }

  /* ---------- معالجة الصور (إضافة واستبدال) ---------- */
  function readImageFile(file, onDone) {
    if (!file || !/^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.type)) {
      S.ctx.toast('نوع الصورة غير مدعوم (PNG أو JPG أو WebP أو GIF)');
      return;
    }
    if (file.size > 20 * 1048576) { S.ctx.toast('الصورة كبيرة جداً (الحد 20 ميغابايت)'); return; }
    var fr = new FileReader();
    fr.onerror = function () { S.ctx.toast('تعذّرت قراءة الصورة'); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { S.ctx.toast('الملف ليس صورة صالحة'); };
      img.onload = function () {
        var maxSide = 1600;
        var k = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'), alpha = /png|webp|gif|svg/i.test(file.type), url;
        if (!alpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
        g.drawImage(img, 0, 0, w, h);
        try {
          url = c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.86);
          if (alpha && url.length > 2400000) {
            g.globalCompositeOperation = 'destination-over';
            g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
            url = c.toDataURL('image/jpeg', 0.84);
          }
        } catch (x) { S.ctx.toast('تعذّرت معالجة الصورة'); return; }
        onDone(url, w, h);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------- العمليات ---------- */
  function afterAdd(it) {
    renderSlide(S.cv, slide());
    S.selIds = [it.id];
    S.cellSel = it.type === 'table' ? { id: it.id, r: 0, c: 0, r2: 0, c2: 0 } : null;
    drawSel();
    S.ctx.changed('commit');
    S.ctx.changed('select');
  }

  var A = {
    addText: function () { var s = slide(); if (!s) return; afterAdd(E.add(s, E.makeText(S.ctx.size(), s.bg))); },
    addShape: function (k) { var s = slide(); if (!s) return; afterAdd(E.add(s, E.makeShape(k, S.ctx.size()))); },
    addTable: function (rows, cols) { var s = slide(); if (!s) return; afterAdd(E.add(s, E.makeTable(S.ctx.size(), rows || 3, cols || 3))); },
    addChart: function (chartType) { var s = slide(); if (!s) return; afterAdd(E.add(s, E.makeChart(S.ctx.size(), chartType || 'bar', s.bg))); },
    addImage: function (file) {
      var s = slide(); if (!s) { S.ctx.toast('أضف شريحة أولاً'); return; }
      readImageFile(file, function (url, w, h) {
        if (slide() !== s) { S.ctx.toast('تغيّرت الشريحة قبل اكتمال التحميل'); return; }
        afterAdd(E.add(s, E.makeImage(S.ctx.size(), url, w, h)));
      });
    },
    replaceImage: function (file) {
      var s = slide(), it = cur();
      if (!s || !it || it.type !== 'image' || it.locked) return;
      readImageFile(file, function (url, nw, nh) {
        if (slide() !== s) return;
        var ratio = nw / nh;
        var newH = Math.max(16, Math.round(it.w / ratio));
        E.update(s, it.id, { src: url, nw: nw, nh: nh, crop: { x: 0, y: 0, w: 1, h: 1 } });
        E.setBox(s, it.id, { x: it.x, y: it.y, w: it.w, h: Math.min(S.ctx.size().h * 0.9, newH) });
        refreshItem(it.id, true); drawSel(); S.ctx.changed('commit');
      });
    },
    startCrop: function () {
      var it = cur(); if (!it || it.type !== 'image' || it.locked) return;
      S.cropId = it.id; refreshItem(it.id, true); drawSel();
      S.ctx.toast('اسحب مقابض الإطار لقص الصورة ثم اضغط ✓');
    },
    stopCrop: function () {
      if (!S.cropId) return;
      var id = S.cropId; S.cropId = null;
      refreshItem(id, true); drawSel(); S.ctx.changed('commit');
    },
    resetCrop: function () {
      var it = cur(); if (!it || it.type !== 'image' || it.locked) return;
      E.update(slide(), it.id, { crop: { x: 0, y: 0, w: 1, h: 1 } });
      S.cropId = null; refreshItem(it.id, true); drawSel(); S.ctx.changed('commit');
    },
    del: function () {
      var s = slide(), items = selectedItems(); if (!s || !items.length) return;
      var unlocked = items.filter(function (x) { return !x.locked; }).map(function (x) { return x.id; });
      if (!unlocked.length) { S.ctx.toast('العناصر المحددة مقفلة'); return; }
      E.removeMany(s, unlocked);
      S.selIds = []; S.cellSel = null; S.cropId = null;
      renderSlide(S.cv, s); drawSel(); S.ctx.changed('commit'); S.ctx.changed('select');
    },
    dup: function () {
      var s = slide(); if (!s || !S.selIds.length) return;
      var created = E.duplicateMany(s, S.selIds);
      renderSlide(S.cv, s);
      S.selIds = created.map(function (x) { return x.id; });
      drawSel(); S.ctx.changed('commit'); S.ctx.changed('select');
    },
    copy: function () {
      var items = selectedItems(); if (!items.length) return;
      clipboard = E.clone(items);
      S.ctx.toast('تم نسخ ' + (items.length === 1 ? 'العنصر' : items.length + ' عناصر'));
    },
    paste: function () {
      var s = slide(); if (!s || !clipboard.length) return;
      var grpMap = {}, newIds = [];
      clipboard.forEach(function (src) {
        var c = E.clone(src);
        c.id = E.uid(); c.x += 24; c.y += 24; c.locked = false;
        if (src.group) { if (!grpMap[src.group]) grpMap[src.group] = E.uid('g'); c.group = grpMap[src.group]; }
        E.add(s, c);
        newIds.push(c.id);
      });
      renderSlide(S.cv, s);
      S.selIds = newIds;
      drawSel(); S.ctx.changed('commit'); S.ctx.changed('select');
    },
    lock: function () {
      var s = slide(), items = selectedItems(); if (!s || !items.length) return;
      var allLocked = items.every(function (x) { return x.locked; });
      items.forEach(function (x) { x.locked = !allLocked; refreshItem(x.id, true); });
      if (S.editing) stopEdit();
      if (S.editingCell) stopCellEdit();
      drawSel(); S.ctx.changed('commit');
    },
    group: function () {
      var s = slide(); if (!s || S.selIds.length < 2) return;
      if (E.groupItems(s, S.selIds)) { drawSel(); S.ctx.changed('commit'); S.ctx.toast('تم تجميع العناصر'); }
    },
    ungroup: function () {
      var s = slide(); if (!s || !S.selIds.length) return;
      if (E.ungroupItems(s, S.selIds)) { drawSel(); S.ctx.changed('commit'); S.ctx.toast('تم فك التجميع'); }
    },
    align: function (mode) {
      var s = slide(); if (!s || !S.selIds.length) return;
      if (E.alignItems(s, S.selIds, S.ctx.size(), mode)) {
        S.selIds.forEach(function (id) { refreshItem(id, false); });
        drawSel(); S.ctx.changed('commit');
      }
    },
    distribute: function (axis) {
      var s = slide(); if (!s || S.selIds.length < 3) return;
      if (E.distributeItems(s, S.selIds, axis)) {
        S.selIds.forEach(function (id) { refreshItem(id, false); });
        drawSel(); S.ctx.changed('commit');
      }
    },
    order: function (op) {
      var s = slide(); if (!s || !S.selIds.length) return;
      if (E.orderMany(s, S.selIds, op)) { renderSlide(S.cv, s); drawSel(); S.ctx.changed('commit'); }
    },
    props: function (p, commitNow) {
      var s = slide(), it = cur(); if (!s || !it || it.locked) return;
      E.update(s, it.id, p);
      refreshItem(it.id, true);
      drawSel();
      S.ctx.changed(commitNow === false ? 'live' : 'panel');
    },
    tableOp: function (fn) {
      var s = slide(), it = cur(); if (!s || !it || it.type !== 'table' || it.locked) return;
      if (fn(it, S.cellSel)) {
        if (S.cellSel) {
          S.cellSel.r = Math.min(S.cellSel.r, it.rows - 1); S.cellSel.r2 = Math.min(S.cellSel.r2, it.rows - 1);
          S.cellSel.c = Math.min(S.cellSel.c, it.cols - 1); S.cellSel.c2 = Math.min(S.cellSel.c2, it.cols - 1);
        }
        refreshItem(it.id, true); drawSel(); S.ctx.changed('panel');
      }
    },
    box: function (b) {
      var s = slide(), it = cur(); if (!s || !it || it.locked) return;
      if ('rot' in b) E.rotate(s, it.id, b.rot);
      var nb = { x: 'x' in b ? b.x : it.x, y: 'y' in b ? b.y : it.y, w: 'w' in b ? b.w : it.w, h: 'h' in b ? b.h : it.h };
      E.setBox(s, it.id, nb);
      refreshItem(it.id, true); drawSel(); S.ctx.changed('panel');
    },
    nudge: function (dx, dy) {
      var s = slide(), items = selectedItems().filter(function (x) { return !x.locked; });
      if (!s || !items.length) return;
      items.forEach(function (it) { E.move(s, it.id, it.x + dx, it.y + dy); refreshItem(it.id, false); });
      drawSel(); S.ctx.changed('commit');
    },
    selectAll: function () {
      var s = slide(); if (!s) return;
      setSelection(s.items.filter(function (x) { return !x.locked; }).map(function (x) { return x.id; }));
    },
    setZoom: function (z) {
      S.zoom = z === 'fit' ? 1 : Math.max(0.5, Math.min(2.2, parseFloat(z) || 1));
      applyZoom();
      return S.zoom;
    },
    getZoom: function () { return S.zoom; }
  };

  var PA = {
    dup: A.dup, del: A.del, lock: A.lock, group: A.group, ungroup: A.ungroup,
    'crop-done': A.stopCrop, 'crop-reset': A.resetCrop,
    front: function () { A.order('front'); }, forward: function () { A.order('forward'); },
    backward: function () { A.order('backward'); }, back: function () { A.order('back'); },
    bold: function () { var it = cur(); if (it && it.type === 'text') A.props({ bold: !it.bold }); },
    italic: function () { var it = cur(); if (it && it.type === 'text') A.props({ italic: !it.italic }); },
    underline: function () { var it = cur(); if (it && it.type === 'text') A.props({ underline: !it.underline }); },
    'align-right': function () { A.props({ align: 'right' }); },
    'align-center': function () { A.props({ align: 'center' }); },
    'align-left': function () { A.props({ align: 'left' }); },
    'align-justify': function () { A.props({ align: 'justify' }); },
    'dir-auto': function () { A.props({ dir: 'auto' }); },
    'dir-rtl': function () { A.props({ dir: 'rtl' }); },
    'dir-ltr': function () { A.props({ dir: 'ltr' }); },
    'al-left': function () { A.align('left'); },
    'al-center': function () { A.align('center'); },
    'al-right': function () { A.align('right'); },
    'al-top': function () { A.align('top'); },
    'al-middle': function () { A.align('middle'); },
    'al-bottom': function () { A.align('bottom'); },
    'dist-h': function () { A.distribute('h'); },
    'dist-v': function () { A.distribute('v'); }
  };

  function onKey(e) {
    if (!S.slideEl || !document.body.contains(S.slideEl) || S.editing || S.editingCell) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (document.querySelector('.sl-pres-overlay:not([hidden]), .sl-modal:not([hidden])')) return;

    var k = e.key, ctrl = e.ctrlKey || e.metaKey, st = e.shiftKey ? 10 : 1;
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) S.ctx.redo && S.ctx.redo(); else S.ctx.undo && S.ctx.undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); S.ctx.redo && S.ctx.redo(); return; }
    if (ctrl && (k === 's' || k === 'S')) { e.preventDefault(); S.ctx.saveNow && S.ctx.saveNow(); return; }
    if (ctrl && (k === 'a' || k === 'A')) { e.preventDefault(); A.selectAll(); return; }
    if (ctrl && (k === 'v' || k === 'V')) { e.preventDefault(); A.paste(); return; }
    if (ctrl && (k === 'g' || k === 'G')) { e.preventDefault(); if (e.shiftKey) A.ungroup(); else A.group(); return; }

    var items = selectedItems();
    if (k === 'Escape') {
      if (S.cropId) { A.stopCrop(); return; }
      if (items.length) setSelection([]);
      return;
    }
    if (!items.length) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); A.del(); }
    else if (ctrl && (k === 'c' || k === 'C')) { e.preventDefault(); A.copy(); }
    else if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); A.dup(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); A.nudge(-st, 0); }
    else if (k === 'ArrowRight') { e.preventDefault(); A.nudge(st, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); A.nudge(0, -st); }
    else if (k === 'ArrowDown') { e.preventDefault(); A.nudge(0, st); }
    else if (k === 'Enter' && items.length === 1 && items[0].type === 'text') { e.preventDefault(); startEdit(items[0].id); }
  }

  /* ---------- الواجهة العامة ---------- */
  window.SLC = {
    attach: function (ctx, root) {
      if (S.root) return;
      S.ctx = ctx; S.root = root;
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pa]');
        if (b && PA[b.dataset.pa]) PA[b.dataset.pa](b);
      });
      document.addEventListener('keydown', onKey);
      addEventListener('resize', function () { applyZoom(); fit(S.root); });
    },
    mount: function (stage) {
      S.editing = null; S.editingCell = null; S.cropId = null; S.drag = null; S.guides = [];
      S.slideEl = stage.querySelector('.sl-slide');
      S.cv = S.slideEl && S.slideEl.querySelector('.sl-cv');
      S.ov = S.slideEl && S.slideEl.querySelector('.sl-ov');
      var s = slide();
      if (!S.slideEl || !s) { S.selIds = []; S.cellSel = null; S.cv = S.ov = null; return; }
      S.selIds = S.selIds.filter(function (id) { return !!E.find(s, id); });
      if (S.cellSel && !E.find(s, S.cellSel.id)) S.cellSel = null;
      renderSlide(S.cv, s);
      drawSel();
      applyZoom();
      S.slideEl.addEventListener('pointerdown', onDown);
      S.slideEl.addEventListener('pointermove', onMove);
      S.slideEl.addEventListener('pointerup', onUp);
      S.slideEl.addEventListener('pointercancel', onUp);
    },
    watch: function (ed) {
      if (S.ro) S.ro.disconnect();
      if (window.ResizeObserver) {
        S.ro = new ResizeObserver(function () { applyZoom(); fit(ed); });
        [].forEach.call(ed.querySelectorAll('.sl-stage,.sl-side'), function (n) { S.ro.observe(n); });
      }
    },
    fit: fit, fillThumbs: fillThumbs, refreshThumb: refreshThumb, renderSlide: renderSlide,
    chartSvg: chartSvg, shapeSvg: shapeSvg,
    selected: function () { return cur(); },
    selectedList: function () { return selectedItems(); },
    selectIds: function (ids) { setSelection(ids); },
    cellSelection: function () { return S.cellSel; },
    deselect: function () { S.selIds = []; S.editing = null; S.editingCell = null; S.cropId = null; S.cellSel = null; },
    stopEdit: function () { stopEdit(); stopCellEdit(); },
    hasClipboard: function () { return clipboard.length > 0; },
    actions: A
  };
})();
