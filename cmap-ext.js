/* ==========================================================================
   cmap-ext.js — «منشئ الخرائط المفاهيمية» (المرحلة 3): واجهة القوالب والتنسيق البصري
   - معرض القوالب (معاينة حية + اسم + وصف + «خريطة فارغة») وإنشاء خريطة فعلية من القالب
   - لوحة «المظهر»: مجموعات ألوان جاهزة، تخصيص ألوان العقد/النص/الحدود/الأسهم، تنسيق الخط والعقد، خلفية مساحة العمل
   - تنسيق متقدم داخل لوحة خصائص العقدة ولوحة التحديد المتعدد
   - يتصل بالمحرر عبر CM.ext (يُستدعى في نهاية CM.ui.init) وCM.styleNode (يُستدعى من رسم العقدة) دون تعديل منطق المرحلتين السابقتين
   - لا حفظ ولا تصدير في هذه المرحلة: «خلفية شفافة» خيار يُخزَّن في المستند ويُطبَّق عند إضافة التصدير
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM; if (!CM) return;
  var U = CM.u, esc = U.esc, L = CM.LIMITS;

  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var X = {
    tpl: ic('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>'),
    pal: ic('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.8-9-7.8Z"/><circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1" fill="currentColor"/>'),
    close: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    minus: ic('<path d="M5 12h14"/>'), plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>')
  };
  var DEF_LINK = '#9A7BD0';

  /* ======================================================================
     رسم العقدة: الحقول الجديدة (حدود، استدارة، شفافية، عريض، محاذاة، مسافات داخلية)
     تُستدعى من paint() في cmap-ui.js بعد الرسم الأساسي، فتنطبق عند الإنشاء والتراجع والتحديث
     ====================================================================== */
  CM.styleNode = function (n, el) {
    var s = el.style, body = el.firstChild, ti = body.firstChild, de = ti.nextSibling;
    var op = n.op == null ? 1 : n.op;
    s.background = op < 1 ? CM.rgba(n.bg, op) : n.bg;
    var bw = n.bw || 0;
    body.style.border = bw > 0 ? bw + 'px solid ' + (CM.isHex(n.bc) ? n.bc : n.fg) : '0';
    if (n.shape !== 'ellipse' && n.br != null) s.borderRadius = n.br + 'px'; else s.borderRadius = '';
    var pad = n.pad == null ? 10 : n.pad;
    body.style.padding = n.shape === 'ellipse' ? pad + 'px ' + Math.max(pad, Math.round(n.w * 0.16)) + 'px' : pad + 'px';
    var al = n.al || 'center';
    body.style.textAlign = al;
    body.style.alignItems = al === 'right' ? 'flex-start' : (al === 'left' ? 'flex-end' : 'center');
    ti.style.width = '100%'; de.style.width = '100%';
    ti.style.fontWeight = n.bold === false ? '400' : '700';
  };

  /* ======================================================================
     معاينة مصغّرة حية للقالب (SVG يُرسم من بيانات القالب نفسها وبألوان المجموعة)
     ====================================================================== */
  function previewSVG(spec, palId) {
    var m = CM.materialize(spec, palId), p = CM.palette(palId);
    if (!m.nodes.length) return '<svg viewBox="0 0 120 80" aria-hidden="true"><rect x="22" y="14" width="76" height="52" rx="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 4" opacity=".55"/><path d="M60 30v20M50 40h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>';
    var byId = {}, x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, lc = p.link || DEF_LINK, h = '';
    m.nodes.forEach(function (n) { byId[n.id] = n; x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h); });
    var pad = 36; x1 -= pad; y1 -= pad; x2 += pad; y2 += pad;
    h += '<svg viewBox="' + x1 + ' ' + y1 + ' ' + (x2 - x1) + ' ' + (y2 - y1) + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">';
    m.links.forEach(function (l) {
      var a = byId[l.from], b = byId[l.to], r = CM.geo.route(a, b, l.style, l.arrow, 5);
      h += '<path d="' + r.d + '" fill="none" stroke="' + lc + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
      r.heads.forEach(function (pts) { h += '<polygon points="' + pts + '" fill="' + lc + '"/>'; });
      if (l.label) h += '<rect x="' + (r.mid.x - 34) + '" y="' + (r.mid.y - 11) + '" width="68" height="22" rx="11" fill="' + (p.bg || '#FFFFFF') + '" stroke="' + lc + '" stroke-width="3"/>';
    });
    m.nodes.forEach(function (n) {
      var st = n.bw > 0 ? ' stroke="' + n.bc + '" stroke-width="' + (n.bw * 1.6) + '"' : '';
      if (n.shape === 'ellipse') h += '<ellipse cx="' + (n.x + n.w / 2) + '" cy="' + (n.y + n.h / 2) + '" rx="' + n.w / 2 + '" ry="' + n.h / 2 + '" fill="' + n.bg + '"' + st + '/>';
      else h += '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + (n.shape === 'round' ? 16 : 3) + '" fill="' + n.bg + '"' + st + '/>';
      var cx = n.x + n.w / 2, cy = n.y + n.h / 2, tw = Math.min(n.w * 0.62, Math.max(30, n.text.length * n.fs * 0.4)), th = Math.max(8, n.fs * 0.42), dy = n.desc ? -th * 0.9 : 0;
      h += '<rect x="' + (cx - tw / 2) + '" y="' + (cy + dy - th / 2) + '" width="' + tw + '" height="' + th + '" rx="' + th / 2 + '" fill="' + n.fg + '" opacity=".82"/>';
      if (n.desc) h += '<rect x="' + (cx - tw * 0.4) + '" y="' + (cy + th * 0.9 - th * 0.3) + '" width="' + tw * 0.8 + '" height="' + th * 0.6 + '" rx="' + th * 0.3 + '" fill="' + n.fg + '" opacity=".5"/>';
    });
    return h + '</svg>';
  }

  CM.ext = CM.ext || [];
  CM.ext.push(function (api, doc) {
    var host = api.host, rootEl = api.root, canvas = api.canvas;
    function $(s, r) { return (r || rootEl).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || rootEl).querySelectorAll(s)); }

    /* ------------------------------------------------------------ الهيكل */
    function seg(items, attr, cls) {
      var h = '<div class="cm-seg ' + (cls || '') + '">';
      items.forEach(function (o) { h += '<button type="button" ' + attr + '="' + o.v + '" aria-pressed="false" title="' + esc(o.title || o.t) + '"><small>' + o.t + '</small></button>'; });
      return h + '</div>';
    }
    function range(f, label, min, max, step) {
      return '<label class="cm-f"><span>' + label + ': <b class="cm-fv" data-fv="' + f + '" dir="ltr"></b></span><input type="range" class="cm-range" data-fmt="' + f + '" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" aria-label="' + label + '"></label>';
    }
    function colorRow(f, label) {
      return '<div class="cm-f"><span>' + label + '</span><div class="cm-colors"><input type="color" data-fmt="' + f + '" aria-label="' + label + '"><span class="cm-pq" data-pq="' + f + '"></span></div></div>';
    }
    function fmtHTML(kind) {
      var h = '';
      if (kind === 'node') h += colorRow('bc', 'لون الحدود');
      h += '<div class="cm-f cm-two"><div><span>نوع الخط</span><select data-fmt="ff" aria-label="نوع الخط">';
      CM.FONTS.forEach(function (f) { h += '<option value="' + f.id + '">' + f.label + '</option>'; });
      h += '</select></div><div><span>حجم الخط</span><div class="cm-step"><button type="button" data-fmtstep="-1" aria-label="تصغير الخط">' + X.minus + '</button><input type="number" dir="ltr" data-fmt="fs" min="' + L.minFs + '" max="' + L.maxFs + '" inputmode="numeric" aria-label="حجم الخط"><button type="button" data-fmtstep="1" aria-label="تكبير الخط">' + X.plus + '</button></div></div></div>';
      h += '<div class="cm-f cm-two"><div><span>الوزن</span>' + seg([{ v: '1', t: 'عريض' }, { v: '0', t: 'عادي' }], 'data-fmtb', 'cm-seg2') + '</div><div><span>المحاذاة</span>' + seg([{ v: 'right', t: 'يمين' }, { v: 'center', t: 'وسط' }, { v: 'left', t: 'يسار' }], 'data-fmtal') + '</div></div>';
      h += range('pad', 'المسافة الداخلية', L.minPad, L.maxPad) + range('bw', 'سماكة الحدود', 0, L.maxBw) + range('br', 'استدارة الزوايا', 0, L.maxBr) + range('op', 'شفافية العقدة %', Math.round(L.minOp * 100), 100, 5);
      return h;
    }
    function box(kind, inner) { return '<div class="cm-fmt" data-fmtbox="' + kind + '">' + inner + '</div>'; }

    /* لوحة خصائص العقدة: تنسيق متقدم لعقدة واحدة */
    var pbody = $('.cm-pbody');
    pbody.insertAdjacentHTML('beforeend', '<div class="cm-xsec"><b>تنسيق متقدم</b></div>' + box('node', fmtHTML('node')));
    /* التحديد المتعدد: لون وتنسيق كل العقد المحدّدة دفعة واحدة */
    var pmulti = $('.cm-pmulti');
    pmulti.insertAdjacentHTML('beforeend', '<div class="cm-xsec"><b>تنسيق العقد المحدّدة</b></div>' + box('multi', colorRow('bg', 'لون العقدة') + colorRow('fg', 'لون النص') + colorRow('bc', 'لون الحدود') + fmtHTML('multi')));

    /* أزرار الشريط العلوي + دعوة البدء في الحالة الفارغة */
    $('.cm-topact').insertAdjacentHTML('afterbegin',
      '<button type="button" class="cm-btn" data-xact="tpl" title="معرض القوالب الجاهزة" aria-label="معرض القوالب الجاهزة">' + X.tpl + '<span>القوالب</span></button>' +
      '<button type="button" class="cm-btn" data-xact="style" aria-pressed="false" title="المظهر: مجموعات الألوان وتنسيق العناصر وخلفية العمل" aria-label="المظهر والتنسيق">' + X.pal + '<span>المظهر</span></button>');
    var empty = $('.cm-empty');
    empty.insertAdjacentHTML('beforeend', '<button type="button" class="cm-btn cm-tplcta" data-xact="tpl">' + X.tpl + '<span>اختر قالباً جاهزاً</span></button>');
    $('.cm-tplcta').addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    /* لوحة «المظهر» */
    var pals = '';
    CM.PALETTES.forEach(function (p) {
      var dots = '';
      p.tones.forEach(function (t) { dots += '<i style="background:' + t[0] + '"></i>'; });
      pals += '<button type="button" class="cm-pc" data-pid="' + p.id + '" aria-pressed="false" title="' + esc(p.desc) + '"><span class="cm-pcd" style="background:' + (p.bg || 'var(--bg)') + '">' + dots + '</span><b>' + esc(p.label) + '</b></button>';
    });
    var drawer = '<aside class="cm-style" hidden aria-label="المظهر والتنسيق">' +
      '<div class="cm-ph"><b>المظهر والتنسيق</b><button type="button" class="cm-x cm-xs" data-xact="styleclose" title="إغلاق" aria-label="إغلاق لوحة المظهر">' + X.close + '</button></div><div class="cm-sbody">' +
      '<section class="cm-ssec"><h4>مجموعات الألوان</h4><div class="cm-pals">' + pals + '</div><p class="cm-snote">تلوّن المجموعة كل العقد والروابط وخلفية العمل، ويمكنك التراجع عنها.</p></section>' +
      '<section class="cm-ssec"><h4>تنسيق العقد</h4><div class="cm-scope"><p class="cm-note cm-scnote"></p>' + seg([{ v: 'sel', t: 'المحدّد', title: 'تطبيق على العقد المحدّدة' }, { v: 'all', t: 'كل العقد', title: 'تطبيق على كل عقد الخريطة' }], 'data-scope', 'cm-seg2') + '</div>' +
      box('drawer', colorRow('bg', 'لون العقدة') + colorRow('fg', 'لون النص') + colorRow('bc', 'لون الحدود') + fmtHTML('drawer')) + '</section>' +
      '<section class="cm-ssec"><h4>الأسهم والروابط</h4><div class="cm-f"><span>لون الأسهم والروابط <em class="cm-lkscope"></em></span><div class="cm-colors"><input type="color" data-lk="color" aria-label="لون الأسهم والروابط"><span class="cm-pq" data-pq="lk"></span><button type="button" class="cm-chip cm-auto" data-lkauto title="لون المجموعة الحالية">تلقائي</button></div></div></section>' +
      '<section class="cm-ssec"><h4>خلفية مساحة العمل</h4>' + seg([{ v: 'auto', t: 'المنصة', title: 'خلفية المنصة التلقائية' }, { v: 'white', t: 'بيضاء' }, { v: 'custom', t: 'لون مخصص' }, { v: 'transparent', t: 'شفافة', title: 'شفافة عند التصدير' }], 'data-bgm', 'cm-seg2 cm-seg4') +
      '<div class="cm-f cm-bgrow"><span>لون الخلفية المخصص</span><div class="cm-colors"><input type="color" data-bgc aria-label="لون الخلفية المخصص"></div></div>' +
      '<p class="cm-note cm-bgtn" hidden>الخلفية الشفافة تظهر كمربعات رمادية أثناء التحرير، وتُطبَّق عند التصدير (يُضاف التصدير في مرحلة لاحقة).</p>' +
      '<button type="button" class="cm-btn cm-wide" data-xact="grid" aria-pressed="true">' + ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>') + '<span>الشبكة الخفيفة</span></button></section>' +
      '</div></aside>';
    rootEl.insertAdjacentHTML('beforeend', drawer);
    var drawerEl = $('.cm-style'), styleBtn = $('[data-xact="style"]');

    /* معرض القوالب */
    var gal = '<div class="cm-tpl" hidden role="dialog" aria-modal="true" aria-label="معرض القوالب"><div class="cm-tplbox">' +
      '<div class="cm-ph"><b>القوالب الجاهزة</b><button type="button" class="cm-x cm-xs" data-xact="tplclose" title="إغلاق" aria-label="إغلاق المعرض">' + X.close + '</button></div>' +
      '<p class="cm-note cm-tplnote" hidden>سيحلّ القالب محلّ الخريطة الحالية. يمكنك التراجع عنه فوراً بـ Ctrl + Z.</p>' +
      '<div class="cm-tplpal" role="group" aria-label="ألوان القالب"><span>ألوان القالب:</span><div class="cm-chips">';
    CM.PALETTES.forEach(function (p) { gal += '<button type="button" class="cm-chip" data-tpal="' + p.id + '" aria-pressed="false">' + esc(p.label) + '</button>'; });
    gal += '</div></div><div class="cm-tplgrid"></div></div></div>';
    rootEl.insertAdjacentHTML('beforeend', gal);
    var galEl = $('.cm-tpl'), gridEl = $('.cm-tplgrid');

    /* ------------------------------------------------------------ المعرض */
    var gpal = null, galOpener = null;
    function renderGallery() {
      var pal = CM.palette(gpal || doc.theme.pal), h = '';
      h += '<button type="button" class="cm-tc cm-tc-blank" data-tid="">' +
        '<span class="cm-tcp" style="background:' + (pal.bg || '') + '">' + previewSVG({ nodes: [], links: [] }, pal.id) + '</span><b>خريطة فارغة</b><small>ابدأ من مساحة بيضاء وأضف عقدك بنفسك.</small><span class="cm-tcgo">ابدأ بخريطة فارغة</span></button>';
      CM.TEMPLATES.forEach(function (t) {
        h += '<button type="button" class="cm-tc" data-tid="' + t.id + '"><span class="cm-tcp" style="background:' + (pal.bg || '') + '">' + previewSVG(t.build(), pal.id) + '</span><b>' + esc(t.name) + '</b><small>' + esc(t.desc) + '</small><span class="cm-tcgo">استخدام القالب</span></button>';
      });
      gridEl.innerHTML = h;
      $$('[data-tpal]', galEl).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tpal === pal.id ? 'true' : 'false'); b.classList.toggle('on', b.dataset.tpal === pal.id); });
    }
    function openGallery(opener) {
      api.stopEdits(true); api.clearPending();
      galOpener = opener || null; gpal = doc.theme.pal;
      $('.cm-tplnote').hidden = !doc.nodes.length;
      renderGallery(); galEl.hidden = false;
      var f = $('.cm-tc:not(.cm-tc-blank)', galEl) || $('.cm-tc', galEl); if (f) f.focus({ preventScroll: true });
    }
    function closeGallery() { if (galEl.hidden) return; galEl.hidden = true; var o = galOpener || $('[data-xact="tpl"]'); galOpener = null; try { (o && o.offsetParent ? o : canvas).focus({ preventScroll: true }); } catch (e) {} }
    function useTemplate(id) {
      var t = CM.TEMPLATES.filter(function (x) { return x.id === id; })[0];
      api.stopEdits(false); api.clearPending();
      if (api.setTool) api.setTool('ptr');
      doc.loadSpec(t ? t.build() : { nodes: [], links: [] }, t ? 'قالب: ' + t.name : 'خريطة فارغة', gpal);
      galEl.hidden = true; galOpener = null;
      requestAnimationFrame(function () { api.fit(); });
      api.say(t ? 'تم إنشاء «' + t.name + '»: انقر أي عقدة أو رابط لتعديله (Ctrl + Z للتراجع)' : 'خريطة فارغة جاهزة');
      try { canvas.focus({ preventScroll: true }); } catch (e) {}
    }
    galEl.addEventListener('click', function (e) {
      if (e.target === galEl) { closeGallery(); return; }
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.xact === 'tplclose') { closeGallery(); return; }
      if (b.dataset.tpal) { gpal = b.dataset.tpal; renderGallery(); return; }
      if ('tid' in b.dataset) useTemplate(b.dataset.tid);
    });
    /* لوحة المفاتيح: أثناء فتح المعرض لا تصل الاختصارات (حذف/تراجع...) إلى الخريطة خلفه */
    window.addEventListener('keydown', function (e) {
      if (galEl.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeGallery(); }
      e.stopPropagation();
    }, true);

    /* ------------------------------------------------------------ خلفية مساحة العمل */
    function applyWorkspace() {
      var t = doc.theme, c = canvas, bg = null, ink = null, grid = null, lab = null;
      c.classList.toggle('cm-bgtransp', t.bgMode === 'transparent');
      if (t.bgMode === 'white') bg = '#FFFFFF'; else if (t.bgMode === 'custom') bg = t.bgColor;
      if (bg) {
        var dark = CM.lum(bg) < 0.5; lab = bg;
        ink = dark ? '#F1F5F9' : '#1A1030'; grid = dark ? 'rgba(255,255,255,.10)' : 'rgba(30,20,60,.12)';
        c.style.background = bg;
      } else {
        c.style.background = '';
        if (t.bgMode === 'transparent') { lab = '#FFFFFF'; ink = '#1A1030'; grid = 'rgba(30,20,60,.14)'; }
      }
      function setv(k, v) { if (v) c.style.setProperty(k, v); else c.style.removeProperty(k); }
      setv('--cm-canvas', lab); setv('--cm-ink', ink); setv('--cm-grid', grid);
      setv('--cm-ink-m', ink ? CM.rgba(ink.indexOf('#') === 0 ? ink : '#1A1030', 0.62) : null);
      setv('--cm-link', t.link ? CM.rgba(t.link, 0.9) : null);
    }

    /* ------------------------------------------------------------ تعبئة الحقول */
    var scopeMode = 'sel';
    function targetsFor(kind) {
      if (kind === 'node') return doc.sel ? [doc.sel] : [];
      if (kind === 'multi') return doc.selN.slice();
      if (scopeMode === 'sel' && doc.selN.length) return doc.selN.slice();
      return doc.nodes.map(function (n) { return n.id; });
    }
    function setv(el, v) { if (el && document.activeElement !== el) el.value = v; }
    function col6(c, d) { return CM.norm6(c) || d; }
    function fillBox(bx) {
      var kind = bx.dataset.fmtbox, ids = targetsFor(kind), n = ids.length ? doc.get(ids[0]) : null;
      bx.classList.toggle('cm-off', !n);
      if (!n) return;
      var allEll = ids.every(function (id) { return doc.get(id).shape === 'ellipse'; });
      $$('[data-fmt]', bx).forEach(function (el) {
        var f = el.dataset.fmt, v;
        switch (f) {
          case 'bg': v = col6(n.bg, '#FFFFFF'); break;
          case 'fg': v = col6(n.fg, '#000000'); break;
          case 'bc': v = col6(n.bc, col6(n.fg, '#000000')); break;
          case 'ff': v = n.ff || 'alex'; break;
          case 'fs': v = n.fs; break;
          case 'pad': v = n.pad == null ? 10 : n.pad; break;
          case 'bw': v = n.bw || 0; break;
          case 'br': v = n.br == null ? (n.shape === 'round' ? 16 : 3) : n.br; el.disabled = allEll; break;
          case 'op': v = Math.round((n.op == null ? 1 : n.op) * 100); break;
        }
        setv(el, v);
        var fv = $('[data-fv="' + f + '"]', bx); if (fv) fv.textContent = f === 'op' ? v + '%' : v + (f === 'pad' || f === 'bw' || f === 'br' ? 'px' : '');
      });
      $$('[data-fmtb]', bx).forEach(function (b) { b.setAttribute('aria-pressed', (n.bold !== false) === (b.dataset.fmtb === '1') ? 'true' : 'false'); });
      $$('[data-fmtal]', bx).forEach(function (b) { b.setAttribute('aria-pressed', (n.al || 'center') === b.dataset.fmtal ? 'true' : 'false'); });
      $$('.cm-sw[data-fmtc]', bx).forEach(function (b) { var f = b.dataset.fmtc, cur = f === 'bg' ? n.bg : (f === 'fg' ? n.fg : n.bc); b.classList.toggle('on', String(cur).toLowerCase() === b.dataset.v.toLowerCase()); });
    }
    function fillDrawer() {
      var t = doc.theme, nsel = doc.selN.length, nall = doc.nodes.length;
      $$('[data-pid]', drawerEl).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.pid === t.pal ? 'true' : 'false'); });
      $$('[data-scope]', drawerEl).forEach(function (b) { var on = b.dataset.scope === scopeMode || (!nsel && b.dataset.scope === 'all'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); if (b.dataset.scope === 'sel') b.disabled = !nsel; });
      var eff = (scopeMode === 'sel' && nsel) ? nsel : nall;
      $('.cm-scnote', drawerEl).textContent = !nall ? 'لا توجد عقد بعد: أضف عقدة أو اختر قالباً.' : ((scopeMode === 'sel' && nsel) ? 'يُطبَّق على ' + nsel + ' عقدة محدّدة.' : 'يُطبَّق على كل العقد (' + eff + ').');
      $('.cm-lkscope', drawerEl).textContent = doc.selL.length ? '(للروابط المحدّدة)' : '(لكل الروابط)';
      var lkIn = $('[data-lk="color"]', drawerEl), lk = doc.selL.length === 1 ? doc.getLink(doc.selL[0]) : null;
      setv(lkIn, col6(lk && lk.color ? lk.color : (t.link || CM.palette(t.pal).link), '#9A7BD0'));
      $$('[data-bgm]', drawerEl).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.bgm === t.bgMode ? 'true' : 'false'); });
      setv($('[data-bgc]', drawerEl), col6(t.bgColor, '#FFFFFF'));
      $('.cm-bgrow', drawerEl).classList.toggle('cm-dim', t.bgMode !== 'custom');
      $('.cm-bgtn', drawerEl).hidden = t.bgMode !== 'transparent';
      var gb = $('[data-xact="grid"]', drawerEl); gb.setAttribute('aria-pressed', doc.grid ? 'true' : 'false');
    }
    function fillAll() { $$('[data-fmtbox]').forEach(fillBox); fillDrawer(); }
    var raf = 0;
    function soon() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; fillAll(); }); }

    /* ألوان سريعة مأخوذة من مجموعة الألوان الحالية */
    function swatchColors() {
      var p = CM.palette(doc.theme.pal), seen = {}, out = [];
      function add(c) { var k = c.toUpperCase(); if (!seen[k]) { seen[k] = 1; out.push(k); } }
      p.tones.forEach(function (t) { add(t[0]); }); add(p.shape[0]); add(p.shape[1]); p.tones.forEach(function (t) { add(t[1]); });
      if (p.bg) add(p.bg);
      return out.slice(0, 14);
    }
    function refreshSwatches() {
      var cs = swatchColors();
      $$('.cm-pq').forEach(function (q) {
        var f = q.dataset.pq, attr = f === 'lk' ? 'data-lkc' : 'data-fmtc="' + f + '"', h = '';
        cs.forEach(function (c) { h += '<button type="button" class="cm-sw" ' + attr + ' data-v="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="' + c + '"></button>'; });
        q.innerHTML = h;
      });
    }

    /* ------------------------------------------------------------ التعديل */
    function applyFmt(bx, patch, key) {
      var ids = targetsFor(bx.dataset.fmtbox);
      if (!ids.length) { api.say('لا توجد عقد لتنسيقها: حدّد عقدة أولاً'); return; }
      doc.styleNodes(ids, patch, 'fmt:' + key);
    }
    rootEl.addEventListener('input', function (e) {
      var el = e.target, d = el.dataset; if (!d) return;
      if (d.fmt) {
        var bx = el.closest('[data-fmtbox]'); if (!bx) return;
        var v = el.value, o = {}, f = d.fmt;
        if (f === 'bg' || f === 'fg' || f === 'bc' || f === 'ff') o[f] = v;
        else if (f === 'fs') { var q = parseInt(v, 10); if (isNaN(q) || q < L.minFs) return; o.fs = q; }
        else if (f === 'op') o.op = parseInt(v, 10) / 100;
        else o[f] = parseInt(v, 10);
        applyFmt(bx, o, f);
      } else if ('lk' in d) {
        doc.setLinkColor(el.value, doc.selL.length ? doc.selL.slice() : null);
      } else if ('bgc' in d) {
        doc.setTheme({ bgColor: el.value }, 'bgc');
      }
    });
    rootEl.addEventListener('change', function (e) {
      var el = e.target; if (el.dataset && el.dataset.fmt === 'fs') fillAll();
    });
    rootEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return; var d = b.dataset;
      var bx = b.closest('[data-fmtbox]');
      if (bx && !b.closest('.cm-tpl')) {
        if ('fmtb' in d) { applyFmt(bx, { bold: d.fmtb === '1' }, 'bold'); return; }
        if (d.fmtal) { applyFmt(bx, { al: d.fmtal }, 'al'); return; }
        if (d.fmtc) { var o = {}; o[d.fmtc] = d.v; applyFmt(bx, o, d.fmtc); return; }
        if (d.fmtstep) { var ids = targetsFor(bx.dataset.fmtbox), n = ids.length ? doc.get(ids[0]) : null; if (n) applyFmt(bx, { fs: n.fs + parseInt(d.fmtstep, 10) }, 'fs'); return; }
      }
      if ('lkc' in d) { doc.setLinkColor(d.v, doc.selL.length ? doc.selL.slice() : null); return; }
      if ('lkauto' in d) { doc.setLinkColor('', doc.selL.length ? doc.selL.slice() : null); api.say(doc.selL.length ? 'عاد لون الرابط إلى لون المجموعة' : 'عاد لون الأسهم إلى لون المجموعة'); return; }
      if (d.pid) { api.stopEdits(true); doc.applyPalette(d.pid, true); api.say('تم تطبيق مجموعة «' + CM.palette(d.pid).label + '»'); return; }
      if (d.scope) { scopeMode = d.scope; fillAll(); return; }
      if (d.bgm) { doc.setTheme({ bgMode: d.bgm }); return; }
      switch (d.xact) {
        case 'tpl': openGallery(b); break;
        case 'style': toggleDrawer(); break;
        case 'styleclose': toggleDrawer(false); break;
        case 'grid': doc.setGrid(!doc.grid); fillDrawer(); break;
      }
    });
    function toggleDrawer(on) {
      on = on == null ? drawerEl.hidden : on;
      drawerEl.hidden = !on; rootEl.classList.toggle('cm-style-open', on);
      styleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) fillAll();
    }
    /* لوحة المفاتيح: Escape يغلق لوحة المظهر إن كان التركيز داخلها */
    drawerEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); toggleDrawer(false); styleBtn.focus(); } });

    /* ------------------------------------------------------------ الربط بالمستند */
    doc.on('meta', function () { applyWorkspace(); refreshSwatches(); soon(); });
    doc.on('reset', function () { applyWorkspace(); refreshSwatches(); soon(); });
    doc.on('select', soon);
    doc.on('node:update', soon);
    doc.on('node:add', soon);
    doc.on('node:remove', soon);
    doc.on('link:update', soon);
    doc.on('history', soon);

    applyWorkspace(); refreshSwatches(); fillAll();
  });
})();
