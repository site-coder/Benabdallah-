/* ==========================================================================
   slides-engine.js — محرك بيانات «استوديو العروض» (بلا أي اعتماد على DOM)
   - نموذج الشريحة: { id, bg, items:[ عنصر... ], notes, transition, transDur }
   - العناصر المدعومة: text | image | shape | table | chart
   - يدعم: التجميع (group)، القص غير المتلف للصور، الجداول مع الدمج،
     المخططات البيانية، الانتقالات، ملاحظات المتحدث، المحاذاة والتوزيع، والتحقق الصارم
   ========================================================================== */
(function (root) {
  'use strict';
  var SIZE = { '16:9': { w: 960, h: 540 }, '4:3': { w: 800, h: 600 } };
  var MIN = 16, MAXI = 4000;
  var KINDS = ['rect', 'square', 'rrect', 'circle', 'line', 'arrow', 'darrow', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'callout'];
  var ALIGNS = ['right', 'center', 'left', 'justify'];
  var DIRS = ['auto', 'rtl', 'ltr'];
  var OVERFLOWS = ['scroll', 'shrink', 'visible'];
  var TRANSITIONS = ['none', 'fade', 'slide'];
  var CHART_TYPES = ['bar', 'pie', 'line'];
  var DEFAULT_PALETTE = ['#7C3AED', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#EF4444'];

  function uid(p) { return (p || 'i') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v, d, lo, hi) {
    v = parseFloat(v);
    if (!isFinite(v)) return d;
    if (lo != null && v < lo) v = lo;
    if (hi != null && v > hi) v = hi;
    return v;
  }
  function color(v, d) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toUpperCase() : d; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function size(ratio) { return SIZE[ratio] || SIZE['16:9']; }
  function isDark(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    var n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 140;
  }

  /* ---------- إنشاء الشرائح والعناصر ---------- */
  function newSlide() {
    return { id: uid('s'), bg: '#FFFFFF', items: [], notes: '', transition: 'none', transDur: 0.4 };
  }
  function base(type, sz, w, h) {
    return {
      id: uid(), type: type,
      x: Math.round((sz.w - w) / 2), y: Math.round((sz.h - h) / 2),
      w: w, h: h, rot: 0, locked: false, op: 1, group: null
    };
  }
  function makeText(sz, bg) {
    var t = base('text', sz, 420, 100);
    t.text = 'اكتب نصك هنا';
    t.font = 'Alexandria';
    t.size = 34;
    t.color = isDark(bg) ? '#FFFFFF' : '#1B0E3A';
    t.align = 'right';
    t.dir = 'auto';
    t.bold = false;
    t.italic = false;
    t.underline = false;
    t.lh = 1.35;
    t.pad = 8;
    t.bg = 'none';
    t.bgOp = 1;
    t.borderColor = '#7C3AED';
    t.borderWidth = 0;
    t.overflow = 'scroll';
    return t;
  }
  function makeShape(kind, sz) {
    if (KINDS.indexOf(kind) < 0) kind = 'rect';
    var dims = {
      rect: [300, 180], rrect: [300, 180], square: [200, 200], circle: [200, 200],
      line: [320, 24], arrow: [320, 36], darrow: [320, 36],
      triangle: [220, 190], diamond: [200, 200], pentagon: [210, 200],
      hexagon: [220, 200], star: [210, 210], callout: [280, 170]
    }[kind] || [220, 180];
    var s = base('shape', sz, dims[0], dims[1]);
    s.kind = kind;
    if (kind === 'line' || kind === 'arrow' || kind === 'darrow') {
      s.fill = 'none';
      s.stroke = '#7C3AED';
      s.sw = 6;
    } else {
      s.fill = '#7C3AED';
      s.stroke = '#1B0E3A';
      s.sw = 0;
    }
    s.radius = 20;
    return s;
  }
  function makeImage(sz, src, nw, nh) {
    nw = num(nw, 400, 1); nh = num(nh, 300, 1);
    var k = Math.min(1, (sz.w * 0.6) / nw, (sz.h * 0.6) / nh);
    var w = Math.max(MIN, Math.round(nw * k)), h = Math.max(MIN, Math.round(nh * k));
    var im = base('image', sz, w, h);
    im.src = src;
    im.nw = nw;
    im.nh = nh;
    im.borderColor = '#7C3AED';
    im.borderWidth = 0;
    im.radius = 0;
    im.crop = { x: 0, y: 0, w: 1, h: 1 };
    return im;
  }
  function makeCell(text, isHeader) {
    return {
      text: text || '',
      bg: isHeader ? '#7C3AED' : '#FFFFFF',
      color: isHeader ? '#FFFFFF' : '#1B0E3A',
      bold: !!isHeader,
      align: 'center',
      rowSpan: 1,
      colSpan: 1,
      mergedTo: null
    };
  }
  function makeTable(sz, rows, cols) {
    rows = Math.round(num(rows, 3, 1, 12));
    cols = Math.round(num(cols, 3, 1, 10));
    var w = Math.min(sz.w - 80, Math.max(240, cols * 150));
    var h = Math.min(sz.h - 80, Math.max(120, rows * 52));
    var t = base('table', sz, w, h);
    t.rows = rows;
    t.cols = cols;
    t.borderColor = '#CBD5E1';
    t.borderWidth = 1;
    t.fontSize = 16;
    t.dir = 'auto';
    t.cells = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        row.push(makeCell(r === 0 ? 'عنوان ' + (c + 1) : 'بيانات', r === 0));
      }
      t.cells.push(row);
    }
    return t;
  }
  function makeChart(sz, chartType, bg) {
    if (CHART_TYPES.indexOf(chartType) < 0) chartType = 'bar';
    var ch = base('chart', sz, 480, 300);
    ch.chartType = chartType;
    ch.title = 'عنوان المخطط البياني';
    ch.categories = ['الربع 1', 'الربع 2', 'الربع 3', 'الربع 4'];
    ch.series = [{ name: 'السلسلة 1', color: '#7C3AED', values: [35, 58, 44, 72] }];
    ch.palette = DEFAULT_PALETTE.slice();
    ch.showLegend = true;
    ch.showValues = true;
    ch.bg = isDark(bg) ? '#1B0E3A' : '#FFFFFF';
    ch.textColor = isDark(bg) ? '#F7F2FF' : '#1B0E3A';
    return ch;
  }

  /* ---------- عمليات على مصفوفة العناصر ---------- */
  function index(slide, id) {
    if (!slide || !Array.isArray(slide.items)) return -1;
    for (var i = 0; i < slide.items.length; i++) if (slide.items[i].id === id) return i;
    return -1;
  }
  function find(slide, id) { var i = index(slide, id); return i < 0 ? null : slide.items[i]; }
  function add(slide, item) { slide.items.push(item); return item; }
  function remove(slide, id) {
    var i = index(slide, id), it = i < 0 ? null : slide.items[i];
    if (!it || it.locked) return false;
    slide.items.splice(i, 1);
    cleanupGroups(slide);
    return true;
  }
  function removeMany(slide, ids) {
    var count = 0;
    (ids || []).slice().forEach(function (id) { if (remove(slide, id)) count++; });
    return count;
  }
  function duplicate(slide, id, dx, dy) {
    var i = index(slide, id); if (i < 0) return null;
    var c = clone(slide.items[i]);
    c.id = uid();
    c.x += (dx != null ? dx : 20);
    c.y += (dy != null ? dy : 20);
    c.locked = false;
    c.group = null;
    slide.items.splice(i + 1, 0, c);
    return c;
  }
  function duplicateMany(slide, ids, dx, dy) {
    if (!ids || !ids.length) return [];
    var idSet = {};
    ids.forEach(function (id) { idSet[id] = true; });
    var grpMap = {}, out = [];
    var ordered = slide.items.filter(function (it) { return idSet[it.id]; });
    ordered.forEach(function (it) {
      var c = clone(it);
      c.id = uid();
      c.x += (dx != null ? dx : 20);
      c.y += (dy != null ? dy : 20);
      c.locked = false;
      if (it.group) {
        if (!grpMap[it.group]) grpMap[it.group] = uid('g');
        c.group = grpMap[it.group];
      }
      slide.items.push(c);
      out.push(c);
    });
    cleanupGroups(slide);
    return out;
  }
  function order(slide, id, op) {
    var i = index(slide, id), n = slide.items.length; if (i < 0) return false;
    var j = op === 'front' ? n - 1 : op === 'back' ? 0 : op === 'forward' ? Math.min(n - 1, i + 1) : op === 'backward' ? Math.max(0, i - 1) : i;
    if (j === i) return false;
    var it = slide.items.splice(i, 1)[0];
    slide.items.splice(j, 0, it);
    return true;
  }
  function orderMany(slide, ids, op) {
    if (!ids || !ids.length) return false;
    if (ids.length === 1) return order(slide, ids[0], op);
    var idSet = {}; ids.forEach(function (id) { idSet[id] = true; });
    var sel = [], rest = [];
    slide.items.forEach(function (it) { (idSet[it.id] ? sel : rest).push(it); });
    if (!sel.length || !rest.length) return false;
    if (op === 'front') { slide.items = rest.concat(sel); return true; }
    if (op === 'back') { slide.items = sel.concat(rest); return true; }
    if (op === 'forward') {
      var moved = false;
      for (var i = slide.items.length - 2; i >= 0; i--) {
        if (idSet[slide.items[i].id] && !idSet[slide.items[i + 1].id]) {
          var t = slide.items[i]; slide.items[i] = slide.items[i + 1]; slide.items[i + 1] = t; moved = true;
        }
      }
      return moved;
    }
    if (op === 'backward') {
      var movedB = false;
      for (var k = 1; k < slide.items.length; k++) {
        if (idSet[slide.items[k].id] && !idSet[slide.items[k - 1].id]) {
          var t2 = slide.items[k]; slide.items[k] = slide.items[k - 1]; slide.items[k - 1] = t2; movedB = true;
        }
      }
      return movedB;
    }
    return false;
  }
  function toggleLock(slide, id) { var it = find(slide, id); if (!it) return null; it.locked = !it.locked; return it.locked; }
  function cloneSlide(slide) {
    var c = clone(slide);
    c.id = uid('s');
    var grpMap = {};
    c.items.forEach(function (it) {
      it.id = uid();
      if (it.group) {
        if (!grpMap[it.group]) grpMap[it.group] = uid('g');
        it.group = grpMap[it.group];
      }
    });
    return c;
  }

  /* ---------- التجميع (Group / Ungroup) ---------- */
  function cleanupGroups(slide) {
    if (!slide || !Array.isArray(slide.items)) return;
    var counts = {};
    slide.items.forEach(function (it) { if (it.group) counts[it.group] = (counts[it.group] || 0) + 1; });
    slide.items.forEach(function (it) { if (it.group && counts[it.group] < 2) it.group = null; });
  }
  function getGroupMembers(slide, groupId) {
    if (!slide || !groupId) return [];
    return slide.items.filter(function (it) { return it.group === groupId; });
  }
  function groupItems(slide, ids) {
    if (!slide || !ids || ids.length < 2) return null;
    var gid = uid('g'), count = 0;
    ids.forEach(function (id) {
      var it = find(slide, id);
      if (it) { it.group = gid; count++; }
    });
    cleanupGroups(slide);
    return count >= 2 ? gid : null;
  }
  function ungroupItems(slide, ids) {
    if (!slide || !ids || !ids.length) return 0;
    var gids = {}, count = 0;
    ids.forEach(function (id) {
      var it = find(slide, id);
      if (it && it.group) gids[it.group] = true;
    });
    slide.items.forEach(function (it) {
      if (it.group && gids[it.group]) { it.group = null; count++; }
    });
    return count;
  }

  /* ---------- الهندسة: نقل وتحجيم وتدوير ومحاذاة ---------- */
  function move(slide, id, x, y) {
    var it = find(slide, id); if (!it || it.locked) return false;
    it.x = num(x, it.x, -MAXI, MAXI);
    it.y = num(y, it.y, -MAXI, MAXI);
    return true;
  }
  function setBox(slide, id, b) {
    var it = find(slide, id); if (!it || it.locked) return false;
    var sq = it.type === 'shape' && it.kind === 'square';
    it.x = num(b.x, it.x, -MAXI, MAXI);
    it.y = num(b.y, it.y, -MAXI, MAXI);
    it.w = num(b.w, it.w, MIN, MAXI);
    it.h = sq ? it.w : num(b.h, it.h, MIN, MAXI);
    return true;
  }
  function rotate(slide, id, deg) {
    var it = find(slide, id); if (!it || it.locked) return false;
    deg = num(deg, it.rot);
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360;
    it.rot = Math.round(deg * 10) / 10;
    return true;
  }
  function calcResize(st, hx, hy, dx, dy, keep) {
    var a = st.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var ldx = dx * c + dy * s, ldy = -dx * s + dy * c;
    var dw = hx * ldx, dh = hy * ldy;
    if (keep && hx && hy) {
      var r = st.w / st.h;
      if (Math.abs(dw) / st.w > Math.abs(dh) / st.h) dh = dw / r; else dw = dh * r;
    }
    var w = Math.max(MIN, st.w + (hx ? dw : 0)), h = Math.max(MIN, st.h + (hy ? dh : 0));
    if (keep && hx && hy) {
      var rr = st.w / st.h;
      if (w / st.w < h / st.h) { h = Math.max(MIN, w / rr); w = h * rr; }
      else { w = Math.max(MIN, h * rr); h = w / rr; }
    }
    var cw = w - st.w, ch = h - st.h;
    var lx = hx * cw / 2, ly = hy * ch / 2;
    var cx = st.x + st.w / 2 + lx * c - ly * s, cy = st.y + st.h / 2 + lx * s + ly * c;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  function calcRotate(st, px, py) {
    var cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    var d = Math.atan2(px - cx, -(py - cy)) * 180 / Math.PI;
    var r = Math.round(d / 15) * 15;
    if (Math.abs(d - r) < 4) d = r;
    return d;
  }
  function itemAABB(it) {
    if (!it.rot) return { x: it.x, y: it.y, w: it.w, h: it.h, cx: it.x + it.w / 2, cy: it.y + it.h / 2 };
    var a = it.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    var nw = it.w * c + it.h * s, nh = it.w * s + it.h * c;
    var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh, cx: cx, cy: cy };
  }

  function alignItems(slide, ids, sz, mode) {
    var items = (ids || []).map(function (id) { return find(slide, id); }).filter(function (it) { return it && !it.locked; });
    if (!items.length) return false;
    var ref = { x: 0, y: 0, w: sz.w, h: sz.h };
    if (items.length > 1) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      items.forEach(function (it) {
        var b = itemAABB(it);
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      ref = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    items.forEach(function (it) {
      var b = itemAABB(it);
      var dx = 0, dy = 0;
      if (mode === 'left') dx = ref.x - b.x;
      else if (mode === 'right') dx = (ref.x + ref.w) - (b.x + b.w);
      else if (mode === 'center') dx = (ref.x + ref.w / 2) - b.cx;
      else if (mode === 'top') dy = ref.y - b.y;
      else if (mode === 'bottom') dy = (ref.y + ref.h) - (b.y + b.h);
      else if (mode === 'middle') dy = (ref.y + ref.h / 2) - b.cy;
      it.x = Math.round((it.x + dx) * 10) / 10;
      it.y = Math.round((it.y + dy) * 10) / 10;
    });
    return true;
  }
  function distributeItems(slide, ids, axis) {
    var items = (ids || []).map(function (id) { return find(slide, id); }).filter(function (it) { return it && !it.locked; });
    if (items.length < 3) return false;
    var boxes = items.map(function (it) { return { it: it, b: itemAABB(it) }; });
    if (axis === 'h') {
      boxes.sort(function (a, b) { return a.b.x - b.b.x; });
      var totalW = boxes.reduce(function (s, o) { return s + o.b.w; }, 0);
      var start = boxes[0].b.x, end = boxes[boxes.length - 1].b.x + boxes[boxes.length - 1].b.w;
      var gap = ((end - start) - totalW) / (boxes.length - 1);
      var curX = start;
      boxes.forEach(function (o) {
        o.it.x = Math.round((o.it.x + (curX - o.b.x)) * 10) / 10;
        curX += o.b.w + gap;
      });
    } else {
      boxes.sort(function (a, b) { return a.b.y - b.b.y; });
      var totalH = boxes.reduce(function (s, o) { return s + o.b.h; }, 0);
      var startY = boxes[0].b.y, endY = boxes[boxes.length - 1].b.y + boxes[boxes.length - 1].b.h;
      var gapY = ((endY - startY) - totalH) / (boxes.length - 1);
      var curY = startY;
      boxes.forEach(function (o) {
        o.it.y = Math.round((o.it.y + (curY - o.b.y)) * 10) / 10;
        curY += o.b.h + gapY;
      });
    }
    return true;
  }

  /* ---------- عمليات الجداول ---------- */
  function tableNormalize(it) {
    if (!it || it.type !== 'table') return;
    var rows = Math.max(1, it.rows || (it.cells ? it.cells.length : 1));
    var cols = Math.max(1, it.cols || (it.cells && it.cells[0] ? it.cells[0].length : 1));
    it.rows = rows; it.cols = cols;
    if (!Array.isArray(it.cells)) it.cells = [];
    for (var r = 0; r < rows; r++) {
      if (!Array.isArray(it.cells[r])) it.cells[r] = [];
      for (var c = 0; c < cols; c++) {
        var cell = it.cells[r][c];
        if (!cell || typeof cell !== 'object') cell = it.cells[r][c] = makeCell('', r === 0);
        cell.text = String(cell.text == null ? '' : cell.text).slice(0, 1000);
        cell.bg = cell.bg === 'none' ? 'none' : color(cell.bg, r === 0 ? '#7C3AED' : '#FFFFFF');
        cell.color = color(cell.color, r === 0 ? '#FFFFFF' : '#1B0E3A');
        cell.bold = !!cell.bold;
        if (ALIGNS.indexOf(cell.align) < 0) cell.align = 'center';
        cell.rowSpan = Math.max(1, Math.round(num(cell.rowSpan, 1, 1, rows - r)));
        cell.colSpan = Math.max(1, Math.round(num(cell.colSpan, 1, 1, cols - c)));
        cell.mergedTo = null;
      }
    }
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        var rootCell = it.cells[r2][c2];
        if (rootCell.mergedTo) { rootCell.rowSpan = 1; rootCell.colSpan = 1; continue; }
        for (var dr = 0; dr < rootCell.rowSpan; dr++) {
          for (var dc = 0; dc < rootCell.colSpan; dc++) {
            if (dr === 0 && dc === 0) continue;
            var target = it.cells[r2 + dr] && it.cells[r2 + dr][c2 + dc];
            if (target) { target.mergedTo = [r2, c2]; target.rowSpan = 1; target.colSpan = 1; }
          }
        }
      }
    }
  }
  function tableAddRow(it, atIdx) {
    if (!it || it.type !== 'table' || it.locked || it.rows >= 14) return false;
    var rIdx = atIdx == null ? it.rows : Math.max(0, Math.min(it.rows, atIdx));
    var newRow = [];
    for (var c = 0; c < it.cols; c++) newRow.push(makeCell('', false));
    it.cells.splice(rIdx, 0, newRow);
    it.rows += 1;
    it.h = Math.min(MAXI, it.h + Math.round(it.h / Math.max(1, it.rows - 1)));
    tableNormalize(it);
    return true;
  }
  function tableDelRow(it, rIdx) {
    if (!it || it.type !== 'table' || it.locked || it.rows <= 1) return false;
    rIdx = rIdx == null ? it.rows - 1 : Math.max(0, Math.min(it.rows - 1, rIdx));
    it.cells.splice(rIdx, 1);
    it.rows -= 1;
    tableNormalize(it);
    return true;
  }
  function tableAddCol(it, atIdx) {
    if (!it || it.type !== 'table' || it.locked || it.cols >= 12) return false;
    var cIdx = atIdx == null ? it.cols : Math.max(0, Math.min(it.cols, atIdx));
    for (var r = 0; r < it.rows; r++) {
      it.cells[r].splice(cIdx, 0, makeCell(r === 0 ? 'عمود' : '', r === 0));
    }
    it.cols += 1;
    tableNormalize(it);
    return true;
  }
  function tableDelCol(it, cIdx) {
    if (!it || it.type !== 'table' || it.locked || it.cols <= 1) return false;
    cIdx = cIdx == null ? it.cols - 1 : Math.max(0, Math.min(it.cols - 1, cIdx));
    for (var r = 0; r < it.rows; r++) it.cells[r].splice(cIdx, 1);
    it.cols -= 1;
    tableNormalize(it);
    return true;
  }
  function tableSetCell(it, r, c, patch) {
    if (!it || it.type !== 'table' || it.locked) return false;
    var cell = it.cells[r] && it.cells[r][c];
    if (!cell) return false;
    if (cell.mergedTo) { cell = it.cells[cell.mergedTo[0]][cell.mergedTo[1]]; if (!cell) return false; }
    if ('text' in patch) cell.text = String(patch.text == null ? '' : patch.text).slice(0, 1000);
    if ('bg' in patch) cell.bg = patch.bg === 'none' ? 'none' : color(patch.bg, cell.bg);
    if ('color' in patch) cell.color = color(patch.color, cell.color);
    if ('bold' in patch) cell.bold = !!patch.bold;
    if ('align' in patch && ALIGNS.indexOf(patch.align) >= 0) cell.align = patch.align;
    return true;
  }
  function tableMerge(it, r1, c1, r2, c2) {
    if (!it || it.type !== 'table' || it.locked) return false;
    var rMin = Math.max(0, Math.min(r1, r2)), rMax = Math.min(it.rows - 1, Math.max(r1, r2));
    var cMin = Math.max(0, Math.min(c1, c2)), cMax = Math.min(it.cols - 1, Math.max(c1, c2));
    if (rMin === rMax && cMin === cMax) return false;
    /* فك أي دمج متداخل داخل النطاق أولاً لضمان استقرار الشبكة */
    for (var r = rMin; r <= rMax; r++) {
      for (var c = cMin; c <= cMax; c++) {
        var cell = it.cells[r][c];
        if (cell.mergedTo) {
          var mr = cell.mergedTo[0], mc = cell.mergedTo[1];
          tableUnmerge(it, mr, mc);
        } else if (cell.rowSpan > 1 || cell.colSpan > 1) {
          tableUnmerge(it, r, c);
        }
      }
    }
    var texts = [];
    for (var rr = rMin; rr <= rMax; rr++) {
      for (var cc = cMin; cc <= cMax; cc++) {
        var t = (it.cells[rr][cc].text || '').trim();
        if (t && !(rr === rMin && cc === cMin)) texts.push(t);
      }
    }
    var anchor = it.cells[rMin][cMin];
    if (texts.length) anchor.text = ((anchor.text || '').trim() ? anchor.text.trim() + ' ' : '') + texts.join(' ');
    anchor.rowSpan = rMax - rMin + 1;
    anchor.colSpan = cMax - cMin + 1;
    anchor.mergedTo = null;
    tableNormalize(it);
    return true;
  }
  function tableUnmerge(it, r, c) {
    if (!it || it.type !== 'table' || it.locked) return false;
    var cell = it.cells[r] && it.cells[r][c];
    if (!cell) return false;
    if (cell.mergedTo) { r = cell.mergedTo[0]; c = cell.mergedTo[1]; cell = it.cells[r][c]; }
    if (!cell || (cell.rowSpan <= 1 && cell.colSpan <= 1)) return false;
    cell.rowSpan = 1; cell.colSpan = 1;
    tableNormalize(it);
    return true;
  }

  /* ---------- تعديل الخصائص مع التحقق ---------- */
  var RULES = {
    text: function (it, p) {
      if ('text' in p) it.text = String(p.text == null ? '' : p.text).slice(0, 8000);
      if ('font' in p) it.font = String(p.font || '').replace(/["'<>;{}]/g, '').slice(0, 60) || it.font;
      if ('size' in p) it.size = num(p.size, it.size, 6, 400);
      if ('color' in p) it.color = color(p.color, it.color);
      if ('align' in p && ALIGNS.indexOf(p.align) >= 0) it.align = p.align;
      if ('dir' in p && DIRS.indexOf(p.dir) >= 0) it.dir = p.dir;
      if ('bold' in p) it.bold = !!p.bold;
      if ('italic' in p) it.italic = !!p.italic;
      if ('underline' in p) it.underline = !!p.underline;
      if ('lh' in p) it.lh = num(p.lh, it.lh || 1.35, 0.8, 3.5);
      if ('pad' in p) it.pad = num(p.pad, it.pad != null ? it.pad : 8, 0, 120);
      if ('bg' in p) it.bg = p.bg === 'none' ? 'none' : color(p.bg, it.bg === 'none' ? '#FFFFFF' : it.bg);
      if ('bgOp' in p) it.bgOp = num(p.bgOp, it.bgOp != null ? it.bgOp : 1, 0, 1);
      if ('borderColor' in p) it.borderColor = color(p.borderColor, it.borderColor || '#7C3AED');
      if ('borderWidth' in p) it.borderWidth = num(p.borderWidth, it.borderWidth || 0, 0, 30);
      if ('op' in p) it.op = num(p.op, it.op != null ? it.op : 1, 0, 1);
      if ('overflow' in p && OVERFLOWS.indexOf(p.overflow) >= 0) it.overflow = p.overflow;
    },
    shape: function (it, p) {
      if ('kind' in p && KINDS.indexOf(p.kind) >= 0) it.kind = p.kind;
      if ('fill' in p) it.fill = p.fill === 'none' ? 'none' : color(p.fill, it.fill);
      if ('stroke' in p) it.stroke = color(p.stroke, it.stroke);
      if ('sw' in p) it.sw = num(p.sw, it.sw, 0, 40);
      if ('op' in p) it.op = num(p.op, it.op != null ? it.op : 1, 0, 1);
      if ('radius' in p) it.radius = num(p.radius, it.radius != null ? it.radius : 20, 0, 200);
    },
    image: function (it, p) {
      if ('src' in p && typeof p.src === 'string' && p.src) it.src = p.src;
      if ('nw' in p) it.nw = num(p.nw, it.nw, 1);
      if ('nh' in p) it.nh = num(p.nh, it.nh, 1);
      if ('op' in p) it.op = num(p.op, it.op != null ? it.op : 1, 0, 1);
      if ('borderColor' in p) it.borderColor = color(p.borderColor, it.borderColor || '#7C3AED');
      if ('borderWidth' in p) it.borderWidth = num(p.borderWidth, it.borderWidth || 0, 0, 40);
      if ('radius' in p) it.radius = num(p.radius, it.radius || 0, 0, 400);
      if ('crop' in p && p.crop && typeof p.crop === 'object') {
        var cx = num(p.crop.x, 0, 0, 0.9), cy = num(p.crop.y, 0, 0, 0.9);
        var cw = num(p.crop.w, 1, 0.05, 1 - cx), ch = num(p.crop.h, 1, 0.05, 1 - cy);
        it.crop = { x: cx, y: cy, w: cw, h: ch };
      }
    },
    table: function (it, p) {
      if ('borderColor' in p) it.borderColor = color(p.borderColor, it.borderColor || '#CBD5E1');
      if ('borderWidth' in p) it.borderWidth = num(p.borderWidth, it.borderWidth != null ? it.borderWidth : 1, 0, 12);
      if ('fontSize' in p) it.fontSize = num(p.fontSize, it.fontSize || 16, 8, 72);
      if ('dir' in p && DIRS.indexOf(p.dir) >= 0) it.dir = p.dir;
      if ('op' in p) it.op = num(p.op, it.op != null ? it.op : 1, 0, 1);
    },
    chart: function (it, p) {
      if ('chartType' in p && CHART_TYPES.indexOf(p.chartType) >= 0) it.chartType = p.chartType;
      if ('title' in p) it.title = String(p.title == null ? '' : p.title).slice(0, 200);
      if ('categories' in p && Array.isArray(p.categories)) {
        it.categories = p.categories.slice(0, 24).map(function (c) { return String(c == null ? '' : c).slice(0, 60); });
      }
      if ('series' in p && Array.isArray(p.series)) {
        it.series = p.series.slice(0, 6).map(function (s, idx) {
          return {
            name: String((s && s.name) || ('السلسلة ' + (idx + 1))).slice(0, 60),
            color: color(s && s.color, DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]),
            values: Array.isArray(s && s.values) ? s.values.slice(0, 24).map(function (v) { return num(v, 0, -1e9, 1e9); }) : []
          };
        });
      }
      if ('palette' in p && Array.isArray(p.palette)) {
        it.palette = p.palette.slice(0, 24).map(function (c, i) { return color(c, DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]); });
      }
      if ('showLegend' in p) it.showLegend = !!p.showLegend;
      if ('showValues' in p) it.showValues = !!p.showValues;
      if ('bg' in p) it.bg = p.bg === 'none' ? 'none' : color(p.bg, it.bg === 'none' ? '#FFFFFF' : it.bg);
      if ('textColor' in p) it.textColor = color(p.textColor, it.textColor || '#1B0E3A');
      if ('op' in p) it.op = num(p.op, it.op != null ? it.op : 1, 0, 1);
    }
  };

  function update(slide, id, p) {
    var it = find(slide, id);
    if (!it || it.locked) return false;
    if (RULES[it.type]) RULES[it.type](it, p);
    return true;
  }
  function setSlideBg(slide, c) { slide.bg = color(c, slide.bg); return slide.bg; }
  function setSlideTransition(slide, tr, dur) {
    if (TRANSITIONS.indexOf(tr) >= 0) slide.transition = tr;
    if (dur != null) slide.transDur = num(dur, slide.transDur || 0.4, 0.1, 3);
    return { transition: slide.transition, transDur: slide.transDur };
  }
  function setSlideNotes(slide, notes) {
    slide.notes = String(notes == null ? '' : notes).slice(0, 10000);
    return slide.notes;
  }

  /* ---------- الترقية والتحقق الصارم ---------- */
  function normalizeItem(it) {
    if (!it || typeof it !== 'object') return null;
    var types = ['text', 'image', 'shape', 'table', 'chart'];
    if (types.indexOf(it.type) < 0) return null;
    it.id = typeof it.id === 'string' && it.id ? it.id : uid();
    it.x = num(it.x, 40, -MAXI, MAXI);
    it.y = num(it.y, 40, -MAXI, MAXI);
    it.w = num(it.w, 200, MIN, MAXI);
    it.h = num(it.h, 100, MIN, MAXI);
    it.rot = num(it.rot, 0, -360, 360);
    it.locked = !!it.locked;
    it.op = num(it.op, 1, 0, 1);
    it.group = typeof it.group === 'string' && it.group ? it.group : null;

    if (it.type === 'text') {
      it.text = String(it.text == null ? '' : it.text).slice(0, 8000);
      it.font = it.font || 'Alexandria';
      it.size = num(it.size, 32, 6, 400);
      it.color = color(it.color, '#1B0E3A');
      if (ALIGNS.indexOf(it.align) < 0) it.align = 'right';
      if (DIRS.indexOf(it.dir) < 0) it.dir = 'auto';
      it.bold = !!it.bold;
      it.italic = !!it.italic;
      it.underline = !!it.underline;
      it.lh = num(it.lh, 1.35, 0.8, 3.5);
      it.pad = num(it.pad, 8, 0, 120);
      it.bg = it.bg === 'none' || !it.bg ? 'none' : color(it.bg, 'none');
      it.bgOp = num(it.bgOp, 1, 0, 1);
      it.borderColor = color(it.borderColor, '#7C3AED');
      it.borderWidth = num(it.borderWidth, 0, 0, 30);
      if (OVERFLOWS.indexOf(it.overflow) < 0) it.overflow = 'scroll';
    } else if (it.type === 'shape') {
      if (KINDS.indexOf(it.kind) < 0) it.kind = 'rect';
      it.fill = it.fill === 'none' ? 'none' : color(it.fill, '#7C3AED');
      it.stroke = color(it.stroke, '#1B0E3A');
      it.sw = num(it.sw, 0, 0, 40);
      it.radius = num(it.radius, 20, 0, 200);
    } else if (it.type === 'image') {
      it.src = typeof it.src === 'string' ? it.src : '';
      it.nw = num(it.nw, it.w, 1);
      it.nh = num(it.nh, it.h, 1);
      it.borderColor = color(it.borderColor, '#7C3AED');
      it.borderWidth = num(it.borderWidth, 0, 0, 40);
      it.radius = num(it.radius, 0, 0, 400);
      if (!it.crop || typeof it.crop !== 'object') it.crop = { x: 0, y: 0, w: 1, h: 1 };
      else RULES.image(it, { crop: it.crop });
    } else if (it.type === 'table') {
      it.borderColor = color(it.borderColor, '#CBD5E1');
      it.borderWidth = num(it.borderWidth, 1, 0, 12);
      it.fontSize = num(it.fontSize, 16, 8, 72);
      if (DIRS.indexOf(it.dir) < 0) it.dir = 'auto';
      tableNormalize(it);
    } else if (it.type === 'chart') {
      if (CHART_TYPES.indexOf(it.chartType) < 0) it.chartType = 'bar';
      it.title = String(it.title == null ? '' : it.title).slice(0, 200);
      if (!Array.isArray(it.categories) || !it.categories.length) it.categories = ['أ', 'ب', 'ج'];
      if (!Array.isArray(it.series) || !it.series.length) it.series = [{ name: 'السلسلة 1', color: '#7C3AED', values: [10, 20, 30] }];
      if (!Array.isArray(it.palette) || !it.palette.length) it.palette = DEFAULT_PALETTE.slice();
      it.showLegend = it.showLegend !== false;
      it.showValues = it.showValues !== false;
      it.bg = it.bg === 'none' ? 'none' : color(it.bg, '#FFFFFF');
      it.textColor = color(it.textColor, '#1B0E3A');
    }
    return it;
  }

  function normalizeProject(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.slides)) return p;
    p.id = typeof p.id === 'string' && p.id ? p.id : uid('p');
    p.name = String(p.name || 'عرض بدون عنوان').slice(0, 120);
    p.ratio = (p.ratio === '4:3' || p.ratio === '16:9') ? p.ratio : '16:9';
    p.created = num(p.created, Date.now(), 0);
    p.updated = num(p.updated, p.created, 0);
    p.slides = p.slides.map(function (s) {
      if (!s || typeof s !== 'object') return newSlide();
      s.id = typeof s.id === 'string' && s.id ? s.id : uid('s');
      s.bg = color(s.bg, '#FFFFFF');
      s.notes = typeof s.notes === 'string' ? s.notes.slice(0, 10000) : '';
      s.transition = TRANSITIONS.indexOf(s.transition) >= 0 ? s.transition : 'none';
      s.transDur = num(s.transDur, 0.4, 0.1, 3);
      s.items = Array.isArray(s.items) ? s.items.map(normalizeItem).filter(Boolean) : [];
      cleanupGroups(s);
      return s;
    });
    return p;
  }

  function validateProject(raw) {
    var obj = raw;
    if (obj && typeof obj === 'object' && obj.format === 'edu-slides-studio' && obj.project) obj = obj.project;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, msg: 'بنية ملف المشروع غير صالحة.' };
    }
    if (!Array.isArray(obj.slides)) {
      return { ok: false, msg: 'الملف لا يحتوي على قائمة شرائح صالحة (slides).' };
    }
    if (obj.slides.length > 300) {
      return { ok: false, msg: 'عدد الشرائح يتجاوز الحد الأقصى المسموح (300 شريحة).' };
    }
    for (var i = 0; i < obj.slides.length; i++) {
      var s = obj.slides[i];
      if (!s || typeof s !== 'object' || !Array.isArray(s.items)) {
        return { ok: false, msg: 'الشريحة رقم ' + (i + 1) + ' غير صالحة أو تفتقد قائمة العناصر.' };
      }
      if (s.items.length > 500) {
        return { ok: false, msg: 'الشريحة رقم ' + (i + 1) + ' تحتوي على عدد مفرط من العناصر.' };
      }
      for (var j = 0; j < s.items.length; j++) {
        var it = s.items[j];
        if (!it || typeof it !== 'object' || ['text', 'image', 'shape', 'table', 'chart'].indexOf(it.type) < 0) {
          return { ok: false, msg: 'عنصر غير معروف في الشريحة رقم ' + (i + 1) + '.' };
        }
        if (typeof it.x !== 'number' || typeof it.y !== 'number' || typeof it.w !== 'number' || typeof it.h !== 'number') {
          return { ok: false, msg: 'إحداثيات غير صالحة في الشريحة رقم ' + (i + 1) + '.' };
        }
      }
    }
    return { ok: true, project: normalizeProject(clone(obj)) };
  }

  root.SLE = {
    SIZE: SIZE, KINDS: KINDS, TRANSITIONS: TRANSITIONS, CHART_TYPES: CHART_TYPES, DEFAULT_PALETTE: DEFAULT_PALETTE,
    size: size, uid: uid, isDark: isDark, clone: clone, color: color, num: num,
    newSlide: newSlide, cloneSlide: cloneSlide,
    makeText: makeText, makeShape: makeShape, makeImage: makeImage, makeTable: makeTable, makeChart: makeChart,
    index: index, find: find, add: add, remove: remove, removeMany: removeMany,
    duplicate: duplicate, duplicateMany: duplicateMany, order: order, orderMany: orderMany, toggleLock: toggleLock,
    groupItems: groupItems, ungroupItems: ungroupItems, getGroupMembers: getGroupMembers, cleanupGroups: cleanupGroups,
    move: move, setBox: setBox, rotate: rotate, calcResize: calcResize, calcRotate: calcRotate, itemAABB: itemAABB,
    alignItems: alignItems, distributeItems: distributeItems,
    tableAddRow: tableAddRow, tableDelRow: tableDelRow, tableAddCol: tableAddCol, tableDelCol: tableDelCol,
    tableSetCell: tableSetCell, tableMerge: tableMerge, tableUnmerge: tableUnmerge, tableNormalize: tableNormalize,
    update: update, setSlideBg: setSlideBg, setSlideTransition: setSlideTransition, setSlideNotes: setSlideNotes,
    normalizeProject: normalizeProject, validateProject: validateProject
  };
  if (typeof module !== 'undefined') module.exports = root.SLE;
})(typeof window !== 'undefined' ? window : globalThis);
