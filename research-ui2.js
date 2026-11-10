/* ==========================================================================
   research-ui2.js — واجهة الأداة (2/2): الغلاف، المراجع، الصور والجداول،
   المعاينة، الإعدادات، الأدوات، التصدير + حوارات الصورة/الجدول/الإحالة
   ========================================================================== */
(function () {
  'use strict';
  var RS = window.RS, U = RS.u, M = RS.model, H = RS.html, D = RS.db, R = RS.refs, L = RS.layout, X = RS.exp, CV = RS.cover, UI = RS.ui, S = RS.S, esc = U.esc, I = UI.I;
  var UI2 = RS.ui2 = {};
  var PX = 96 / 25.4;
  function $(s, r) { return UI.$(s, r); }
  function $$(s, r) { return UI.$$(s, r); }
  var toast = UI.toast;
  function P() { return S.paper; }

  /* =================================================================== الغلاف */
  var cvSel = null, cvOp = null;
  function cvEl(id) { var c = P().cover; for (var i = 0; i < c.els.length; i++) if (c.els[i].id === id) return c.els[i]; return null; }
  function cvScale() { var b = $('#cvBox'); return b ? b.clientWidth / P().cover.W : 1; }
  UI2.cover = function (el) {
    var p = P(); L.ensureCss();
    el.innerHTML = '<div class="tl-box"><h3>تصميم الغلاف الجامعي</h3><label class="rs-chk"><input type="checkbox" id="cvOn"' + (p.coverOn !== false ? ' checked' : '') + '> تضمين الغلاف في المعاينة والتصدير</label>' +
      '<label class="tl-lbl">القالب</label><div class="tl-chips">' + CV.TPLS.map(function (t) { return '<button type="button" class="tl-chip' + (p.cover.tpl === t.id ? ' on' : '') + '" data-act="cvtpl" data-t="' + t.id + '">' + t.n + '</button>'; }).join('') + '</div>' +
      '<label class="tl-lbl">لون التزيين</label><div class="rs-sw">' + CV.ACCENTS.map(function (c) { return '<button type="button" class="rs-swc' + (p.cover.accent === c ? ' on' : '') + '" style="background:' + c + '" data-act="cvacc" data-c="' + c + '" aria-label="لون ' + c + '"></button>'; }).join('') + '<input type="color" id="cvAccIn" value="' + p.cover.accent + '" aria-label="لون مخصص"></div>' +
      '<p class="tl-hint">اختيار قالب أو لون يعيد بناء عناصر الغلاف من بيانات البحث (تُفقد تعديلاتك اليدوية على العناصر، لكن الشعار والصور المضافة تبقى).</p>' +
      '<div class="rs-btns"><button type="button" class="tl-btn sm pri" data-act="cvadd" data-k="text">' + I.plus + '<span>نص</span></button><button type="button" class="tl-btn sm pri" data-act="cvlogo">' + I.img + '<span>إضافة شعار الجامعة</span></button><button type="button" class="tl-btn sm" data-act="cvimg">' + I.img + '<span>إضافة صورة</span></button><button type="button" class="tl-btn sm" data-act="cvadd" data-k="rect">' + I.plus + '<span>إطار/مستطيل</span></button><button type="button" class="tl-btn sm" data-act="cvadd" data-k="line">' + I.plus + '<span>خط</span></button></div><input type="file" id="cvFile" accept="image/png,image/jpeg,image/webp" hidden></div>' +
      '<div class="rs-cvl"><div><div class="rs-cvbox" id="cvBox" tabindex="0" aria-label="لوحة تصميم الغلاف"><div id="cvWrap"></div></div><p class="tl-hint">اضغط عنصراً لتحديده ثم اسحبه لتحريكه، واسحب المربع الصغير في زاويته لتغيير حجمه. الأسهم تحرّك العنصر المحدد، وزر Delete يحذفه. النص بين ﹝ ﹞ هو حقل فارغ لم تملأه بعد ولا يظهر في الملف النهائي.</p></div><div class="tl-box" id="cvProps"></div></div>';
    cvRender(); cvProps();
    var box = $('#cvBox');
    box.addEventListener('pointerdown', cvDown); box.addEventListener('keydown', cvKey);
    window.addEventListener('resize', cvRender);
  };
  function cvRender() {
    var p = P(), c = p && p.cover, wrap = $('#cvWrap'), box = $('#cvBox'); if (!wrap || !box || S.tab !== 'cover') return;
    var sc = cvScale(); wrap.style.cssText = 'position:absolute;left:0;top:0;width:' + c.W + 'px;height:' + c.H + 'px;transform-origin:0 0;transform:scale(' + sc + ')';
    wrap.innerHTML = CV.html(c, p.meta, S.imgs, c.W, c.H, { placeholders: true }); box.style.height = (c.H * sc) + 'px';
    if (cvSel) { var e = cvEl(cvSel); if (!e) cvSel = null; else { var s = document.createElement('div'); s.className = 'cv-sel'; s.id = 'cvSelBox'; s.innerHTML = '<span class="cv-h" data-h="1"></span>'; wrap.appendChild(s); cvPlaceSel(); } }
  }
  function cvPlaceSel() { var s = $('#cvSelBox'), e = cvSel && cvEl(cvSel); if (!s || !e) return; s.style.cssText = 'left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;height:' + e.h + 'px'; var k = 1 / cvScale(); var h = s.firstChild; h.style.width = h.style.height = (16 * k) + 'px'; h.style.left = (-8 * k) + 'px'; h.style.bottom = (-8 * k) + 'px'; s.style.outlineWidth = (2 * k) + 'px'; }
  function cvDown(e) {
    var box = $('#cvBox'), c = P().cover, h = e.target.closest('[data-h]'), t = e.target.closest('.ce[data-id]'), sc = cvScale();
    if (h && cvSel) { var el = cvEl(cvSel); cvOp = { m: 'size', x: e.clientX, y: e.clientY, ow: el.w, oh: el.h, ex: el.x, ey: el.y }; }
    else if (t) { cvSel = t.dataset.id; var el2 = cvEl(cvSel); cvOp = { m: 'move', x: e.clientX, y: e.clientY, ox: el2.x, oy: el2.y }; cvRender(); cvProps(); }
    else { cvSel = null; cvRender(); cvProps(); return; }
    e.preventDefault(); box.setPointerCapture && box.setPointerCapture(e.pointerId);
    box.addEventListener('pointermove', cvMove); box.addEventListener('pointerup', cvUp); box.addEventListener('pointercancel', cvUp);
  }
  function cvMove(e) {
    if (!cvOp) return; var el = cvEl(cvSel), sc = cvScale(), dx = (e.clientX - cvOp.x) / sc, dy = (e.clientY - cvOp.y) / sc, node = $('.ce[data-id="' + cvSel + '"]');
    if (cvOp.m === 'move') { el.x = Math.round(cvOp.ox + dx); el.y = Math.round(cvOp.oy + dy); }
    else { el.w = Math.max(10, Math.round(cvOp.ow + dx)); el.h = Math.max(6, Math.round(cvOp.oh + dy)); if (el.k === 'img' && (e.shiftKey || el.lock)) { } }
    if (node) { node.style.left = el.x + 'px'; node.style.top = el.y + 'px'; node.style.width = el.w + 'px'; node.style.height = el.h + 'px'; } cvPlaceSel();
  }
  function cvUp(e) { var box = $('#cvBox'); box.removeEventListener('pointermove', cvMove); box.removeEventListener('pointerup', cvUp); box.removeEventListener('pointercancel', cvUp); cvOp = null; UI.markDirty(); cvProps(); }
  function cvKey(e) {
    if (!cvSel) return; var el = cvEl(cvSel), st = e.shiftKey ? 10 : 1, ok = true;
    if (e.key === 'ArrowLeft') el.x -= st; else if (e.key === 'ArrowRight') el.x += st; else if (e.key === 'ArrowUp') el.y -= st; else if (e.key === 'ArrowDown') el.y += st;
    else if (e.key === 'Delete' || e.key === 'Backspace') { P().cover.els = P().cover.els.filter(function (x) { return x.id !== cvSel; }); cvSel = null; } else ok = false;
    if (ok) { e.preventDefault(); UI.markDirty(); cvRender(); cvProps(); }
  }
  function cvProps() {
    var box = $('#cvProps'); if (!box) return; var el = cvSel && cvEl(cvSel);
    if (!el) { box.innerHTML = '<h3>خصائص العنصر</h3><p class="tl-empty">اختر عنصراً من الغلاف لتعديله.</p>'; return; }
    function num(k, lbl) { return '<div class="tl-fld"><label class="tl-lbl">' + lbl + '</label><input class="tl-in num" inputmode="decimal" data-cv="' + k + '" value="' + Math.round(el[k]) + '"></div>'; }
    var h = '<h3>' + ({ text: 'نص', rect: 'إطار/شكل', img: 'صورة' }[el.k]) + '</h3><div class="rs-grid">' + num('x', 'X') + num('y', 'Y') + num('w', 'العرض') + num('h', 'الارتفاع') + '</div>';
    if (el.k === 'text') {
      h += '<label class="tl-lbl">النص (يمكن استعمال الحقول)</label><textarea class="tl-ta" id="cvText" data-cv="text">' + esc(el.text) + '</textarea><div class="tl-chips">' + CV.FIELDS.map(function (f) { return '<button type="button" class="tl-chip" data-act="cvtok" data-k="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
        '<div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">الخط</label><select class="tl-sel" data-cv="ff">' + UI.FONTS.map(function (f) { return '<option' + (f === el.ff ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></div>' + num('fs', 'الحجم') + '<div class="tl-fld"><label class="tl-lbl">اللون</label><input type="color" class="tl-in" data-cv="color" value="' + el.color + '"></div><div class="tl-fld"><label class="tl-lbl">المحاذاة</label><select class="tl-sel" data-cv="al"><option value="right"' + (el.al === 'right' ? ' selected' : '') + '>يمين</option><option value="center"' + (el.al === 'center' ? ' selected' : '') + '>وسط</option><option value="left"' + (el.al === 'left' ? ' selected' : '') + '>يسار</option></select></div></div>' +
        '<div class="tl-chips"><button type="button" class="tl-chip' + (el.b ? ' on' : '') + '" data-act="cvfmt" data-k="b">عريض</button><button type="button" class="tl-chip' + (el.i ? ' on' : '') + '" data-act="cvfmt" data-k="i">مائل</button><button type="button" class="tl-chip' + (el.u ? ' on' : '') + '" data-act="cvfmt" data-k="u">تسطير</button></div>';
    } else if (el.k === 'rect') {
      h += '<div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">لون التعبئة</label><input type="color" class="tl-in" data-cv="bg" value="' + (el.bg || '#ffffff') + '"></div><div class="tl-fld"><label class="tl-lbl">لون الحد</label><input type="color" class="tl-in" data-cv="bc" value="' + (el.bc || '#000000') + '"></div>' + num('bw', 'سمك الحد') + '<div class="tl-fld"><label class="tl-lbl">نمط الحد</label><select class="tl-sel" data-cv="bs"><option value="solid"' + (el.bs === 'solid' ? ' selected' : '') + '>متصل</option><option value="double"' + (el.bs === 'double' ? ' selected' : '') + '>مزدوج</option><option value="dashed"' + (el.bs === 'dashed' ? ' selected' : '') + '>متقطع</option></select></div></div><div class="tl-chips"><button type="button" class="tl-chip" data-act="cvnobg">بلا تعبئة</button></div>';
    } else {
      h += '<div class="tl-chips"><button type="button" class="tl-chip' + (el.fit === 'cover' ? ' on' : '') + '" data-act="cvfit">ملء المساحة (قص)</button></div><div class="rs-btns"><button type="button" class="tl-btn sm" data-act="cvrepl">استبدال الصورة</button></div>';
    }
    h += '<div class="rs-btns"><button type="button" class="tl-btn sm" data-act="cvfront">للأمام</button><button type="button" class="tl-btn sm" data-act="cvback">للخلف</button><button type="button" class="tl-btn sm" data-act="cvdup">' + I.copy + '<span>تكرار</span></button><button type="button" class="tl-btn sm del" data-act="cvdel">' + I.trash + '<span>حذف</span></button></div>';
    box.innerHTML = h;
  }
  function cvRebuild(tpl, accent) {
    var p = P(), c = p.cover, keep = c.els.filter(function (e) { return e.k === 'img'; });
    c.tpl = tpl || c.tpl; c.accent = accent || c.accent; var fresh = CV.build(c.tpl, c.W, c.H, p.meta, c.accent); c.els = fresh.concat(keep); c.els.forEach(function (e, i) { e.z = i; });
    cvSel = null; UI.markDirty(); UI2.cover($('#rsTab'));
  }
  function cvAddImage(file, replaceId) {
    UI.fileToImage(file).then(function (rec) {
      return UI.storeImage(rec).then(function () {
        var c = P().cover, w = Math.min(130, rec.w), h = Math.round(w * rec.h / rec.w);
        if (replaceId) { var e = cvEl(replaceId); e.imgId = rec.id; }
        else { var el = { id: U.uid(), k: 'img', x: Math.round((c.W - w) / 2), y: Math.round(c.H * 0.215) + 10, w: w, h: h, imgId: rec.id, fit: 'contain', z: c.els.length }; c.els.push(el); cvSel = el.id; }
        UI.markDirty(); cvRender(); cvProps();
      });
    }).catch(function () { toast('تعذّر قراءة الصورة. الصيغ المدعومة: PNG وJPG وJPEG وWebP.'); });
  }
  var cvFileMode = null;
  /* ================================================================== المراجع */
  UI2.refs = function (el) {
    var p = P();
    el.innerHTML = '<div class="tl-box"><h3>نمط التوثيق</h3><div class="tl-chips">' + R.STYLES.map(function (s) { return '<button type="button" class="tl-chip' + (p.cite === s.k ? ' on' : '') + '" data-act="citest" data-t="' + s.k + '">' + s.n + '</button>'; }).join('') + '</div><p class="tl-hint">' + ({ apa: 'APA: الإحالة (اللقب، السنة).', mla: 'MLA: الإحالة (اللقب رقم الصفحة).', chicago: 'Chicago (المؤلف-التاريخ): الإحالة (اللقب سنة).', manual: 'توثيق يدوي: تكتب الإحالة بنفسك في المحرر، أو تُدرج الأداة رقم المرجع [n]، وتُنسَّق القائمة بالطريقة العربية التقليدية أو بنصك الخاص.' }[p.cite]) + '</p><label class="rs-chk"><input type="checkbox" data-set="groupRefs"' + (p.settings.groupRefs ? ' checked' : '') + '> تقسيم القائمة النهائية حسب النوع (كتب، مقالات، رسائل…)</label></div>' +
      '<div class="tl-box"><h3>المراجع والمصادر (' + p.refs.length + ')</h3><button type="button" class="tl-btn pri" data-act="refadd">' + I.plus + '<span>إضافة مرجع</span></button><div id="rfList"></div></div>' +
      '<div class="tl-box"><h3>القائمة النهائية كما ستظهر</h3><div class="rs-biblio" id="rfBib"></div><p class="tl-hint">لا تُنشئ الأداة أي بيانات: كل مرجع يُبنى حصراً من المعلومات التي تدخلها. تظهر القائمة في صفحة مستقلة في نهاية البحث.</p></div>';
    refsRender();
  };
  function refsRender() {
    var p = P(), l = $('#rfList'), b = $('#rfBib'); if (!l) return;
    l.innerHTML = p.refs.length ? R.sorted(p).map(function (r) { var n = R.usageCount(p, r.id); return '<div class="rs-ref-i"><div class="tl-grow"><span class="tl-tag">' + R.typeName(r.type) + '</span> ' + R.entryHtml(r, p.cite) + '<div class="tl-hint">' + (n ? 'مُستشهَد به ' + n + ' مرة في النص' : 'غير مستعمل في النص بعد') + '</div></div><button type="button" class="tl-btn sm" data-act="refedit" data-id="' + r.id + '">' + I.edit + '</button><button type="button" class="tl-btn sm del" data-act="refdel" data-id="' + r.id + '">' + I.trash + '</button></div>'; }).join('') : '<p class="tl-empty">لم تضف أي مرجع بعد.</p>';
    b.innerHTML = R.biblio(p).map(function (g) { return (g.head ? '<h4 class="rs-h4">' + g.head + '</h4>' : '') + g.items.map(function (it) { return '<p>' + it.html + '</p>'; }).join(''); }).join('') || '<p class="tl-empty">القائمة فارغة.</p>';
  }
  function refDialog(id) {
    var p = P(), ref = id ? U.clone(p.refs.filter(function (r) { return r.id === id; })[0]) : R.newRef('book');
    if (!ref.authors.length) ref.authors = [{ f: '', g: '' }];
    var m = UI.modal('<div id="rfForm"></div>', { wide: true, sticky: true });
    function draw() {
      var t = ref.type;
      function inp(k, lbl, extra) { return '<div class="tl-fld"><label class="tl-lbl">' + lbl + '</label><input class="tl-in" data-rf="' + k + '" maxlength="600" value="' + esc(ref[k] || '') + '"' + (extra || '') + '></div>'; }
      var h = '<h3>' + (id ? 'تعديل مرجع' : 'إضافة مرجع') + '</h3><label class="tl-lbl">نوع المصدر</label><select class="tl-sel" data-rf="type">' + R.TYPES.map(function (x) { return '<option value="' + x.k + '"' + (t === x.k ? ' selected' : '') + '>' + x.n + '</option>'; }).join('') + '</select>';
      h += '<label class="tl-lbl">المؤلفون (اللقب ثم الاسم)</label>' + ref.authors.map(function (a, i) { return '<div class="rs-inl"><input class="tl-in" placeholder="اللقب" data-af="' + i + '" value="' + esc(a.f) + '"><input class="tl-in" placeholder="الاسم" data-ag="' + i + '" value="' + esc(a.g) + '"><button type="button" class="tl-x" data-rfdel="' + i + '" aria-label="حذف">' + I.trash + '</button></div>'; }).join('') + '<button type="button" class="tl-btn sm" data-rfaddau>' + I.plus + '<span>إضافة مؤلف</span></button>';
      h += '<div class="rs-grid">' + inp('title', t === 'article' ? 'عنوان المقال' : 'العنوان') + inp('year', 'السنة (اتركها فارغة إن لم تُعرف)');
      if (t === 'book') h += inp('publisher', 'الناشر / دار النشر') + inp('place', 'مكان النشر') + inp('edition', 'الطبعة');
      if (t === 'article') h += inp('journal', 'المجلة') + inp('volume', 'المجلد') + inp('issue', 'العدد') + inp('pages', 'الصفحات (مثال: 12-30)');
      if (t === 'thesis' || t === 'dissertation') h += inp('univ', 'الجامعة') + inp('degree', t === 'thesis' ? 'الدرجة (ماجستير/ماستر)' : 'الدرجة (دكتوراه)');
      if (t === 'web') h += inp('site', 'اسم الموقع') + inp('accessed', 'تاريخ الاطلاع');
      if (t === 'other') h += inp('publisher', 'الجهة/الناشر');
      if (t === 'book') h += inp('pages', 'الصفحات المرجعية (اختياري)');
      h += inp('url', 'الرابط (عند وجوده)', ' dir="ltr"') + '</div>';
      if (p.cite === 'manual') h += '<label class="tl-lbl">نص التوثيق اليدوي (اختياري: إن تركته فارغاً يُبنى من الحقول)</label><textarea class="tl-ta" data-rf="manual">' + esc(ref.manual || '') + '</textarea>';
      h += '<div class="tl-msg" id="rfPrev"></div><div class="rs-btns"><button type="button" class="tl-btn pri" data-rfok>حفظ المرجع</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>';
      $('#rfForm', m.el).innerHTML = h; prev();
    }
    function prev() { var e = $('#rfPrev', m.el); if (e) e.innerHTML = '<b>المعاينة:</b> ' + R.entryHtml(ref, p.cite); }
    m.el.addEventListener('input', function (e) { var t = e.target; if (t.dataset.rf && t.dataset.rf !== 'type') ref[t.dataset.rf] = t.value; else if (t.dataset.af !== undefined) ref.authors[+t.dataset.af].f = t.value; else if (t.dataset.ag !== undefined) ref.authors[+t.dataset.ag].g = t.value; prev(); });
    m.el.addEventListener('change', function (e) { if (e.target.dataset.rf === 'type') { ref.type = e.target.value; draw(); } });
    m.el.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-rfaddau')) { ref.authors.push({ f: '', g: '' }); draw(); }
      else if (t.dataset.rfdel !== undefined) { ref.authors.splice(+t.dataset.rfdel, 1); if (!ref.authors.length) ref.authors.push({ f: '', g: '' }); draw(); }
      else if (t.hasAttribute('data-rfok')) {
        if (!(ref.title || '').trim()) { toast('عنوان المرجع مطلوب.'); return; }
        ref.authors = ref.authors.filter(function (a) { return (a.f || '').trim() || (a.g || '').trim(); });
        if (id) { var i = p.refs.map(function (r) { return r.id; }).indexOf(id); p.refs[i] = ref; } else p.refs.push(ref);
        UI.markDirty(); m.close(); refsRender();
      }
    });
    draw();
  }
  UI2.citeDialog = function () {
    var p = P(); if (!p.refs.length) { var m0 = UI.modal('<h3>لا توجد مراجع</h3><p class="rs-p">أضف مرجعاً أولاً من تبويب «المراجع» ثم أدرج الإحالة.</p><div class="rs-btns"><button type="button" class="tl-btn pri" data-go>الذهاب إلى المراجع</button><button type="button" class="tl-btn" data-close>إغلاق</button></div>'); m0.el.querySelector('[data-go]').addEventListener('click', function () { m0.close(); UI.setTab('refs'); }); return; }
    UI.restoreRange(); var m = UI.modal('<h3>إدراج إحالة</h3><label class="tl-lbl">المرجع</label><select class="tl-sel" id="ctR">' + R.sorted(p).map(function (r) { return '<option value="' + r.id + '">' + esc((R.surname(r) || '') + ' — ' + r.title) + '</option>'; }).join('') + '</select><label class="tl-lbl">رقم الصفحة (اختياري)</label><input class="tl-in" id="ctP" maxlength="30"><p class="tl-hint">تُكتب الإحالة وفق نمط التوثيق الحالي (' + R.STYLES.filter(function (s) { return s.k === p.cite; })[0].n + ') وتتحدث تلقائياً إن غيّرت النمط.</p><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>إدراج</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>');
    m.el.querySelector('[data-ok]').addEventListener('click', function () {
      var r = p.refs.filter(function (x) { return x.id === $('#ctR', m.el).value; })[0], pg = $('#ctP', m.el).value.trim(); m.close();
      UI.insertHtmlAtCaret('<span class="rs-cite" data-ref="' + r.id + '"' + (pg ? ' data-page="' + esc(pg) + '"' : '') + ' contenteditable="false">' + esc(R.citeText(p, r, pg)) + '</span>&#8203;');
    });
  };
  UI2.tableDialog = function () {
    UI.restoreRange(); var m = UI.modal('<h3>إدراج جدول</h3><div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">عدد الصفوف</label><input class="tl-in num" id="tbR" value="3" inputmode="numeric"></div><div class="tl-fld"><label class="tl-lbl">عدد الأعمدة</label><input class="tl-in num" id="tbC" value="3" inputmode="numeric"></div></div><label class="rs-chk"><input type="checkbox" id="tbH" checked> الصف الأول صف عناوين</label><label class="tl-lbl">عنوان الجدول (يُرقَّم تلقائياً)</label><input class="tl-in" id="tbT" maxlength="200"><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>إدراج</button><button type="button" class="tl-btn" data-close>إلغاء</button></div>');
    m.el.querySelector('[data-ok]').addEventListener('click', function () {
      var r = parseInt($('#tbR', m.el).value, 10), c = parseInt($('#tbC', m.el).value, 10); if (!(r >= 1 && r <= 100 && c >= 1 && c <= 12)) { toast('الصفوف من 1 إلى 100 والأعمدة من 1 إلى 12.'); return; }
      var tb = document.createElement('table'); tb.setAttribute('data-b', '1'); var cap = $('#tbT', m.el).value.trim(); if (cap) { var cp = document.createElement('caption'); cp.textContent = cap; tb.appendChild(cp); }
      var body = document.createElement('tbody'); for (var i = 0; i < r; i++) { var tr = document.createElement('tr'); for (var j = 0; j < c; j++) { var td = document.createElement(i === 0 && $('#tbH', m.el).checked ? 'th' : 'td'); td.innerHTML = '<br>'; tr.appendChild(td); } body.appendChild(tr); }
      tb.appendChild(body); m.close(); UI.insertBlockAfterCaret(tb);
    });
  };

  /* ===================================================== حوار إضافة/تعديل صورة */
  UI2.imageDialog = function (figId) {
    var p = P(), fig = figId ? p.figs.filter(function (f) { return f.id === figId; })[0] : null;
    UI.commit(); var st = { rec: null, menuTouched: !!fig, ok: !!fig, place: fig && fig.place ? U.clone(fig.place) : { sectionId: S.tab === 'edit' ? S.selId : 'intro', mode: 'end', n: 0, text: '' } };
    var cur = fig ? S.imgs[fig.imgId] : null, w = fig ? fig.w : 0, h = fig ? fig.h : 0, lock = fig ? fig.lock !== false : true;
    var nt = M.numberTree(p), secOpts = [{ id: 'intro', t: p.settings.introTitle || 'المقدمة' }].concat(nt.flat.map(function (r) { return { id: r.id, t: '— '.repeat(r.depth) + r.text }; })).concat([{ id: 'concl', t: p.settings.conclTitle || 'الخاتمة' }]);
    var m = UI.modal('<div id="imgDlg"></div>', { wide: true, sticky: true });
    function paras(sid) { return H.blocks(RS.place.htmlOf(p, sid) || '').filter(H.isPara); }
    function draw() {
      var im = st.rec || cur, pl = st.place, ps = paras(pl.sectionId);
      var hh = '<h3>' + (fig ? 'تعديل الصورة' : 'إضافة صورة') + '</h3>' +
        '<div class="rs-imgp"><div class="rs-prev">' + (im ? '<img alt="معاينة" src="' + im.data + '">' : '<span class="tl-hint">لم تُختر صورة بعد</span>') + '</div><div><button type="button" class="tl-btn sm pri" data-pick>' + I.img + '<span>' + (im ? 'استبدال الصورة' : 'اختيار صورة من الجهاز') + '</span></button><input type="file" id="imgFile" accept="image/png,image/jpeg,image/webp" hidden><p class="tl-hint">PNG وJPG وJPEG وWebP (تُحفظ الشفافية عند دعمها).</p></div></div>' +
        '<label class="tl-lbl">عنوان الصورة</label><input class="tl-in" id="imgT" maxlength="300" value="' + esc(fig ? fig.title : (st.title || '')) + '" placeholder="مثال: مراحل النمو الحركي لدى الطفل">' +
        '<h4 class="rs-h4">أين تريد وضع هذه الصورة؟</h4><div class="tl-box in"><b>الطريقة الأولى: التحديد من القوائم</b><label class="tl-lbl">القسم (الفصل / المبحث / المطلب)</label><select class="tl-sel" id="plS">' + secOpts.map(function (o) { return '<option value="' + o.id + '"' + (o.id === pl.sectionId ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select><label class="tl-lbl">الموضع داخل القسم</label><select class="tl-sel" id="plM"><option value="afterTitle"' + (pl.mode === 'afterTitle' ? ' selected' : '') + '>بعد العنوان مباشرة</option><option value="start"' + (pl.mode === 'start' ? ' selected' : '') + '>في بداية القسم</option><option value="afterPara"' + (pl.mode === 'afterPara' ? ' selected' : '') + '>بعد فقرة محددة</option><option value="beforePara"' + (pl.mode === 'beforePara' ? ' selected' : '') + '>قبل فقرة محددة</option><option value="end"' + (pl.mode === 'end' ? ' selected' : '') + '>في نهاية القسم</option></select>' +
        ((pl.mode === 'afterPara' || pl.mode === 'beforePara') ? (ps.length ? '<label class="tl-lbl">الفقرة</label><select class="tl-sel" id="plN">' + ps.map(function (b, i) { return '<option value="' + (i + 1) + '"' + (pl.n === i + 1 ? ' selected' : '') + '>الفقرة ' + (i + 1) + ': ' + esc(H.firstWords(b, 7)) + '…</option>'; }).join('') + '</select>' : '<p class="tl-msg warn">هذا القسم لا يحوي فقرات بعد؛ اكتب نصاً أولاً أو اختر موضعاً آخر.</p>') : '') + '</div>' +
        '<div class="tl-box in"><b>الطريقة الثانية: كتابة التعليمات</b><textarea class="tl-ta" id="plX" placeholder="مثال: ضع هذه الصورة في الفصل الأول، المبحث الأول، المطلب الثاني، بعد الفقرة الثانية">' + esc(pl.text || '') + '</textarea><div class="rs-btns"><button type="button" class="tl-btn sm" data-parse>تحليل الوصف</button></div><div id="plMsg"></div><p class="tl-hint">يُفهم الوصف بقواعد برمجية على الجهاز (بلا ذكاء اصطناعي). إن لم يتحدد المكان بدقة فلن تُوضع الصورة عشوائياً، وستُطلب منك قوائم التحديد.</p></div>' +
        '<h4 class="rs-h4">الحجم والمحاذاة</h4><div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">العرض (px)</label><input class="tl-in num" id="imW" inputmode="numeric" value="' + (w || '') + '"></div><div class="tl-fld"><label class="tl-lbl">الارتفاع (px)</label><input class="tl-in num" id="imH" inputmode="numeric" value="' + (h || '') + '"></div><div class="tl-fld"><label class="tl-lbl">المحاذاة</label><select class="tl-sel" id="imA"><option value="center"' + (!fig || fig.align === 'center' ? ' selected' : '') + '>وسط</option><option value="right"' + (fig && fig.align === 'right' ? ' selected' : '') + '>يمين</option><option value="left"' + (fig && fig.align === 'left' ? ' selected' : '') + '>يسار</option></select></div></div><label class="rs-chk"><input type="checkbox" id="imL"' + (lock ? ' checked' : '') + '> الحفاظ على نسبة العرض إلى الارتفاع</label>' +
        '<div class="tl-msg" id="plSum"></div><div class="rs-btns"><button type="button" class="tl-btn pri" data-ok>اعتماد الصورة</button>' + (fig ? '<button type="button" class="tl-btn del" data-del>' + I.trash + '<span>حذف الصورة</span></button>' : '') + '<button type="button" class="tl-btn" data-close>إلغاء</button></div>';
      $('#imgDlg', m.el).innerHTML = hh; sum();
    }
    function sum() { var e = $('#plSum', m.el); if (e) e.innerHTML = '<b>ستظهر الصورة في:</b> ' + esc(RS.place.describe(p, st.place)) + (st.menuTouched ? '' : ' <i>(راجع الموضع قبل الاعتماد)</i>'); }
    function msg(t, ok) { var e = $('#plMsg', m.el); e.innerHTML = '<div class="tl-msg ' + (ok ? 'ok' : 'bad') + '">' + esc(t) + '</div>'; }
    function grabForm() { var t = $('#imgT', m.el); if (t) { st.title = t.value; } var xx = $('#plX', m.el); if (xx) st.place.text = xx.value; var iw = $('#imW', m.el); if (iw) { w = parseInt(iw.value, 10) || 0; h = parseInt($('#imH', m.el).value, 10) || 0; lock = $('#imL', m.el).checked; } }
    draw();
    m.el.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-pick')) $('#imgFile', m.el).click();
      else if (t.hasAttribute('data-parse')) {
        grabForm(); var r = RS.place.parse(p, st.place.text);
        if (!r.ok) { msg(r.msg + ' حدّد القسم والفقرة من القوائم أعلاه.', false); st.ok = false; st.menuTouched = false; return; }
        st.place = { sectionId: r.sectionId, mode: r.mode, n: r.n, text: st.place.text }; st.ok = true; st.menuTouched = true; var tt = st.title; draw(); st.title = tt; msg('فُهم الوصف: ' + RS.place.describe(p, st.place) + ' — راجع الموضع ثم اعتمد.', true);
      }
      else if (t.hasAttribute('data-del')) { UI.confirm('حذف هذه الصورة من البحث؟', 'حذف', true).then(function (ok) { if (!ok) return; p.figs = p.figs.filter(function (f) { return f.id !== fig.id; }); UI.markDirty(); m.close(); afterFigChange(); }); }
      else if (t.hasAttribute('data-ok')) {
        grabForm(); var im = st.rec || cur; if (!im) { toast('اختر صورة أولاً.'); return; }
        var xt = (st.place.text || '').trim();
        if (xt && !st.ok && !st.menuTouched) { var r2 = RS.place.parse(p, xt); if (r2.ok) { st.place = { sectionId: r2.sectionId, mode: r2.mode, n: r2.n, text: xt }; st.ok = st.menuTouched = true; } else { msg(r2.msg + ' لن تُوضع الصورة عشوائياً: حدّد القسم والفقرة من القوائم ثم اعتمد.', false); st.menuTouched = false; $('#plS', m.el).focus(); return; } }
        if (!st.menuTouched && !fig) { toast('راجع موضع الصورة: غيّر القسم/الموضع في القوائم أو أكّد باختياره.'); st.menuTouched = true; sum(); return; }
        var pl = st.place; if ((pl.mode === 'afterPara' || pl.mode === 'beforePara') && !(pl.n >= 1 && pl.n <= paras(pl.sectionId).length)) { toast('اختر فقرة موجودة في القسم.'); return; }
        var obj = fig || { id: U.uid(), lock: true }; obj.imgId = (st.rec ? st.rec.id : (cur ? cur.id : obj.imgId)); obj.title = (st.title || '').trim(); obj.align = $('#imA', m.el).value; obj.lock = lock;
        if (!w) { w = Math.min(im.w, 420); } if (!h) h = Math.round(w * im.h / im.w); obj.w = w; obj.h = h; obj.place = { sectionId: pl.sectionId, mode: pl.mode, n: pl.n || 0, text: pl.text || '' };
        if (!fig) p.figs.push(obj); UI.markDirty(); m.close(); afterFigChange(); toast('تمت إضافة الصورة في: ' + RS.place.describe(p, obj.place), 3500);
      }
    });
    m.el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'imgFile') {
        var f = t.files[0]; if (!f) return; grabForm();
        UI.fileToImage(f).then(function (rec) { return UI.storeImage(rec).then(function () { st.rec = rec; if (!w || !fig || true) { w = Math.min(rec.w, 420); h = Math.round(w * rec.h / rec.w); } var tt = st.title; draw(); st.title = tt; }); }).catch(function () { toast('تعذّر قراءة الصورة. الصيغ المدعومة: PNG وJPG وJPEG وWebP.'); });
      } else if (t.id === 'plS') { st.place.sectionId = t.value; st.menuTouched = true; grabForm(); var tt = st.title; draw(); st.title = tt; }
      else if (t.id === 'plM') { st.place.mode = t.value; st.menuTouched = true; if ((t.value === 'afterPara' || t.value === 'beforePara') && !st.place.n) st.place.n = 1; grabForm(); var t2 = st.title; draw(); st.title = t2; }
      else if (t.id === 'plN') { st.place.n = +t.value; st.menuTouched = true; sum(); }
      else if (t.id === 'imA' || t.id === 'imL') { grabForm(); }
    });
    m.el.addEventListener('input', function (e) {
      var t = e.target, im = st.rec || cur;
      if ((t.id === 'imW' || t.id === 'imH') && im && $('#imL', m.el).checked) { var v = parseInt(t.value, 10); if (v > 0) { if (t.id === 'imW') $('#imH', m.el).value = Math.round(v * im.h / im.w); else $('#imW', m.el).value = Math.round(v * im.w / im.h); } }
      if (t.id === 'plX') { st.ok = false; }
    });
  };
  function afterFigChange() { if (S.tab === 'edit') { UI.refreshSide(); UI.loadSection(S.selId); } else if (S.tab === 'media') UI2.media($('#rsTab')); }

  /* =========================================================== الصور والجداول */
  function scanTables() {
    var out = [], p = P(), nt = M.numberTree(p), n = 0, nocap = 0;
    function scan(id, name, html) { H.blocks(html || '').forEach(function (b) { if (b.tagName === 'TABLE') { var c = b.querySelector('caption'), t = c ? c.textContent.trim() : ''; if (t) { n++; out.push({ no: n, title: t, sec: id, name: name, rows: b.rows.length }); } else nocap++; } }); }
    scan('intro', p.settings.introTitle || 'المقدمة', p.intro.html); nt.flat.forEach(function (r) { scan(r.id, r.text, r.sec.html); }); scan('concl', p.settings.conclTitle || 'الخاتمة', p.concl.html);
    return { list: out, nocap: nocap };
  }
  UI2.media = function (el) {
    var p = P(), tb = scanTables();
    el.innerHTML = '<div class="tl-box"><h3>الصور (' + p.figs.length + ')</h3><button type="button" class="tl-btn pri" data-act="figadd">' + I.plus + '<span>إضافة صورة</span></button>' +
      (p.figs.length ? p.figs.map(function (f) { var im = S.imgs[f.imgId]; return '<div class="rs-ref-i"><div class="rs-th">' + (im ? '<img alt="" src="' + im.data + '">' : '') + '</div><div class="tl-grow"><b>' + esc(f.title || 'بدون عنوان') + '</b><div class="tl-hint">' + (f.place ? esc(RS.place.describe(p, f.place)) : '<span style="color:var(--tl-bad)">غير مرتبطة بمكان — لن تظهر في التصدير حتى تحدد موضعها</span>') + '</div></div><button type="button" class="tl-btn sm" data-act="figedit" data-id="' + f.id + '">' + I.edit + '<span>تعديل / تغيير الموضع</span></button><button type="button" class="tl-btn sm del" data-act="figdel" data-id="' + f.id + '">' + I.trash + '</button></div>'; }).join('') : '<p class="tl-empty">لا توجد صور. يمكنك أيضاً إضافتها من زر الصورة في شريط أدوات المحرر.</p>') + '</div>' +
      '<div class="tl-box"><h3>الجداول (' + tb.list.length + ')</h3>' + (tb.list.length ? tb.list.map(function (t) { return '<div class="rs-ref-i"><div class="tl-grow"><b>الجدول ' + t.no + ': ' + esc(t.title) + '</b><div class="tl-hint">' + esc(t.name) + ' · ' + t.rows + ' صف</div></div><button type="button" class="tl-btn sm" data-act="gosec" data-id="' + t.sec + '">انتقال</button></div>'; }).join('') : '<p class="tl-empty">لا توجد جداول معنونة.</p>') + (tb.nocap ? '<p class="tl-hint">' + tb.nocap + ' جدول بلا عنوان (لا يُرقَّم ولا يدخل في قائمة الجداول). أضف عنواناً من شريط الجدول في المحرر.</p>' : '') + '<p class="tl-hint">تُرقَّم الجداول والصور تلقائياً بحسب ترتيبها في البحث.</p></div>';
  };

  /* ================================================================== المعاينة */
  var pv = { zoom: 0, res: null };
  function layoutOpts(extra) {
    var p = P(), o = { cover: p.coverOn !== false, plan: true, toc: p.toc.on, tocTables: p.toc.tables, tocFigs: p.toc.figs, refs: true, intro: true, concl: true };
    for (var k in extra || {}) o[k] = extra[k]; return o;
  }
  UI2.layoutOpts = layoutOpts;
  function renderPages(box, res, fitW) {
    var st = P().settings, d = M.pageMM(st), pw = d[0] * PX, ph = d[1] * PX, sc = pv.zoom || Math.min(1, (fitW - 16) / pw), sid = null;
    box.innerHTML = res.pages.map(function (pg, i) {
      var h1 = pg.querySelector('[data-sid]'); if (h1) sid = h1.getAttribute('data-sid'); var kind = res.kinds[i];
      var tgt = kind === 'cover' ? 'cover' : kind === 'refs' ? 'refs' : (kind === 'plan' || kind === 'toc') ? 'settings' : 'edit:' + (sid || 'intro');
      return '<div class="rs-pvw" data-pg="' + (i + 1) + '"><div class="rs-pvh"><span>صفحة ' + (i + 1) + ' من ' + res.count + '</span><button type="button" class="tl-btn sm" data-act="pvedit" data-t="' + tgt + '">' + I.edit + '<span>تعديل هذا الجزء</span></button></div><div class="rs-pvb" style="width:' + (pw * sc) + 'px;height:' + (ph * sc) + 'px"></div></div>';
    }).join('');
    $$('.rs-pvb', box).forEach(function (b, i) { var pg = res.pages[i]; pg.style.transformOrigin = '0 0'; pg.style.transform = 'scale(' + sc + ')'; b.appendChild(pg); });
  }
  function runPreview(box, fitW, done) {
    box.innerHTML = '<p class="tl-empty">جارٍ تجهيز صفحات المعاينة…</p>';
    setTimeout(function () {
      try { UI.commit(); var res = L.run(P(), S.imgs, layoutOpts()); pv.res = res; renderPages(box, res, fitW); if (done) done(res); }
      catch (e) { box.innerHTML = '<div class="tl-msg bad">تعذّر تجهيز المعاينة: ' + esc(e.message) + '</div>'; }
    }, 30);
  }
  UI2.preview = function (el) {
    el.innerHTML = '<div class="tl-box"><div class="rs-btns"><button type="button" class="tl-btn sm pri" data-act="pvref">' + I.srch + '<span>تحديث المعاينة</span></button><button type="button" class="tl-btn sm" data-act="pvz" data-z="-1">−</button><button type="button" class="tl-btn sm" data-act="pvz" data-z="0">ملاءمة العرض</button><button type="button" class="tl-btn sm" data-act="pvz" data-z="1">+</button><label class="tl-fld" style="flex:0 0 150px"><input class="tl-in num" id="pvGo" inputmode="numeric" placeholder="اذهب لصفحة رقم"></label></div><div id="pvInfo" class="tl-hint"></div></div><div class="rs-pvbox" id="pvBox"></div>';
    runPreview($('#pvBox'), $('#pvBox').clientWidth || 360, function (res) { var i = $('#pvInfo'); if (i) i.innerHTML = 'عدد الصفحات: <b>' + res.count + '</b>' + (res.warns.length ? '<br>' + res.warns.map(esc).join('<br>') : ''); });
  };
  UI2.sidePreview = function () { var b = $('#rsPvSide'); if (!b || S.tab !== 'edit') return; var old = pv.zoom; pv.zoom = 0; runPreview(b, b.clientWidth || 420); pv.zoom = old; };

  /* ================================================================== الإعدادات */
  function opt(v, cur, lbl) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + lbl + '</option>'; }
  function setNum(k, lbl, step) { var v = P().settings[k]; return '<div class="tl-fld"><label class="tl-lbl">' + lbl + '</label><input class="tl-in num" inputmode="decimal" data-set="' + k + '" data-ty="n" value="' + v + '"></div>'; }
  function setTxt(k, lbl) { return '<div class="tl-fld"><label class="tl-lbl">' + lbl + '</label><input class="tl-in" data-set="' + k + '" maxlength="120" value="' + esc(P().settings[k]) + '"></div>'; }
  function setChk(k, lbl) { return '<label class="rs-chk"><input type="checkbox" data-set="' + k + '"' + (P().settings[k] ? ' checked' : '') + '> ' + lbl + '</label>'; }
  UI2.settings = function (el) {
    var s = P().settings, tp = P().toc, ut = userTpl();
    el.innerHTML = '<div class="tl-box"><h3>الورقة</h3><div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">حجم الورق</label><select class="tl-sel" data-set="paper">' + ['A4', 'A5', 'Letter'].map(function (v) { return opt(v, s.paper, v); }).join('') + '</select></div><div class="tl-fld"><label class="tl-lbl">الاتجاه</label><select class="tl-sel" data-set="orient">' + opt('portrait', s.orient, 'عمودي') + opt('landscape', s.orient, 'أفقي') + '</select></div>' + setNum('mt', 'الهامش العلوي (سم)') + setNum('mb', 'الهامش السفلي (سم)') + setNum('mr', 'الهامش الأيمن (سم)') + setNum('ml', 'الهامش الأيسر (سم)') + '</div></div>' +
      '<div class="tl-box"><h3>الخط والنص</h3><div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">الخط</label><input class="tl-in" list="rsFonts" data-set="font" value="' + esc(s.font) + '"><datalist id="rsFonts">' + UI.FONTS.map(function (f) { return '<option value="' + f + '">'; }).join('') + '</datalist></div>' + setNum('fs', 'حجم النص') + setNum('h1', 'حجم عنوان الفصل') + setNum('h2', 'حجم عنوان المبحث') + setNum('h3', 'حجم عنوان المطلب') + setNum('h4', 'حجم العناوين الأخرى') + setNum('lh', 'تباعد الأسطر') + setNum('pgap', 'المسافة بين الفقرات (pt)') + setNum('indent', 'إزاحة أول سطر (سم)') + '<div class="tl-fld"><label class="tl-lbl">محاذاة النص</label><select class="tl-sel" data-set="align">' + opt('justify', s.align, 'ضبط') + opt('right', s.align, 'يمين') + opt('center', s.align, 'وسط') + opt('left', s.align, 'يسار') + '</select></div><div class="tl-fld"><label class="tl-lbl">لون النص</label><input type="color" class="tl-in" data-set="color" value="' + s.color + '"></div></div><p class="tl-hint">الخط الافتراضي Traditional Arabic متوفر في ويندوز وأوفيس؛ إن لم يكن مثبتاً على جهازك سيُستبدل تلقائياً بخط عربي مناسب في المعاينة والتصدير.</p></div>' +
      '<div class="tl-box"><h3>الصفحات والترقيم</h3>' + setChk('numOn', 'إظهار أرقام الصفحات') + '<div class="rs-grid"><div class="tl-fld"><label class="tl-lbl">مكان الرقم</label><select class="tl-sel" data-set="numPos">' + [['bottom-center', 'أسفل الوسط'], ['bottom-right', 'أسفل اليمين'], ['bottom-left', 'أسفل اليسار'], ['top-center', 'أعلى الوسط'], ['top-right', 'أعلى اليمين'], ['top-left', 'أعلى اليسار']].map(function (x) { return opt(x[0], s.numPos, x[1]); }).join('') + '</select></div><div class="tl-fld"><label class="tl-lbl">شكل الأرقام</label><select class="tl-sel" data-set="numStyle">' + opt('latin', s.numStyle, '1 2 3') + opt('indic', s.numStyle, '١ ٢ ٣') + '</select></div>' + setNum('numStart', 'يبدأ الترقيم من') + '</div>' + setChk('numCover', 'احتساب الغلاف ضمن الترقيم (دون إظهار رقمه)') + setChk('chapNewPage', 'بدء كل فصل في صفحة جديدة') + setChk('hdrTitle', 'عنوان البحث في ترويسة الصفحات') +
      '<div class="rs-grid">' + setTxt('header', 'نص الترويسة (اختياري)') + setTxt('footer', 'نص التذييل (اختياري)') + '</div></div>' +
      '<div class="tl-box"><h3>الفهرس والقوائم (اختياري)</h3><label class="rs-chk"><input type="checkbox" data-toc="on"' + (tp.on ? ' checked' : '') + '> إدراج الفهرس بعد خطة البحث وقبل المقدمة</label><label class="rs-chk"><input type="checkbox" data-toc="tables"' + (tp.tables ? ' checked' : '') + '> قائمة الجداول</label><label class="rs-chk"><input type="checkbox" data-toc="figs"' + (tp.figs ? ' checked' : '') + '> قائمة الصور والأشكال</label><p class="tl-hint">أرقام صفحات الفهرس تُحسب من التخطيط الفعلي للصفحات في كل معاينة وتصدير.</p></div>' +
      '<div class="tl-box"><h3>عناوين الأقسام الثابتة</h3><div class="rs-grid">' + setTxt('planTitle', 'عنوان صفحة الخطة') + setTxt('tocTitle', 'عنوان الفهرس') + setTxt('introTitle', 'عنوان المقدمة') + setTxt('conclTitle', 'عنوان الخاتمة') + setTxt('refsTitle', 'عنوان قائمة المراجع') + '</div></div>' +
      '<div class="tl-box"><h3>قوالب الإعدادات</h3><p class="tl-hint">لكل بحث إعداداته الخاصة، ولا تؤثر التعديلات في بحث آخر. احفظ إعداداتك الحالية (وهيكل الأقسام إن أردت) كقالب لتستعمله في بحوث جديدة.</p><div class="rs-btns"><button type="button" class="tl-btn" data-act="tplsave">' + I.save + '<span>حفظ إعداداتي كقالب</span></button><button type="button" class="tl-btn del" data-act="setreset">إرجاع الإعدادات الافتراضية</button></div>' + (ut.length ? '<label class="tl-lbl">تطبيق قالب محفوظ على هذا البحث</label><div class="tl-chips">' + ut.map(function (t, i) { return '<button type="button" class="tl-chip" data-act="tplapply" data-i="' + i + '">★ ' + esc(t.name) + '</button><button type="button" class="tl-x" data-act="tpldel" data-i="' + i + '" aria-label="حذف القالب">' + I.trash + '</button>'; }).join('') + '</div>' : '') + '</div>';
  };
  function userTpl() { try { return JSON.parse(localStorage.getItem('rs_user_tpls') || '[]'); } catch (e) { return []; } }
  function setUserTpl(a) { try { localStorage.setItem('rs_user_tpls', JSON.stringify(a)); return true; } catch (e) { return false; } }
  function applySetting(t) {
    var p = P(), k = t.dataset.set, v;
    if (t.type === 'checkbox') v = t.checked; else if (t.dataset.ty === 'n') { v = parseFloat(String(t.value).replace(',', '.')); if (!isFinite(v)) return; } else v = t.value;
    var lim = { fs: [6, 60], h1: [6, 80], h2: [6, 80], h3: [6, 80], h4: [6, 80], lh: [0.8, 4], pgap: [0, 60], indent: [0, 5], mt: [0, 8], mb: [0, 8], ml: [0, 8], mr: [0, 8], numStart: [1, 9999] };
    if (lim[k]) { if (v < lim[k][0] || v > lim[k][1]) { t.classList.add('bad'); return; } t.classList.remove('bad'); }
    p.settings[k] = v; if (k === 'paper' || k === 'orient') { var c = p.cover, d = M.pageMM(p.settings); c.W = Math.round(d[0] * PX); c.H = Math.round(d[1] * PX); cvRebuildSilent(); }
    UI.markDirty();
  }
  function cvRebuildSilent() { var p = P(), c = p.cover, keep = c.els.filter(function (e) { return e.k === 'img'; }); c.els = CV.build(c.tpl, c.W, c.H, p.meta, c.accent).concat(keep); }

  /* ==================================================================== الأدوات */
  UI2.tools = function (el) {
    var p = P(), st = M.paperStats(p), empties = st.per.filter(function (x) { return x.empty; });
    el.innerHTML = '<div class="tl-box"><h3>العدّاد</h3><div class="tl-stats"><div class="tl-stat"><b>' + st.words + '</b><small>كلمة</small></div><div class="tl-stat"><b>' + st.chars + '</b><small>حرف (بلا مسافات)</small></div><div class="tl-stat"><b>' + p.refs.length + '</b><small>مرجع</small></div></div><div class="rs-tablewrap"><table class="rs-tbl"><thead><tr><th>القسم</th><th>كلمات</th><th>حروف</th></tr></thead><tbody>' + st.per.map(function (x) { return '<tr data-act="gosec" data-id="' + x.id + '"><td>' + esc(x.name) + (x.empty ? ' <span class="tl-tag">فارغ</span>' : '') + '</td><td>' + x.words + '</td><td>' + x.chars + '</td></tr>'; }).join('') + '</tbody></table></div><p class="tl-hint">آخر تعديل: ' + U.fmtDT(p.modified) + '</p></div>' +
      '<div class="tl-box"><h3>فحص الأقسام الفارغة</h3>' + (empties.length ? '<div class="tl-msg warn">' + empties.length + ' قسم بلا نص:</div><div class="tl-chips">' + empties.map(function (x) { return '<button type="button" class="tl-chip" data-act="gosec" data-id="' + x.id + '">' + esc(x.name) + '</button>'; }).join('') + '</div>' : '<div class="tl-msg ok">لا توجد أقسام فارغة.</div>') + '</div>' +
      '<div class="tl-box"><h3>بحث واستبدال في كل البحث</h3><p class="tl-hint">افتح المحرر ثم اضغط زر البحث (أو Ctrl+F)، ثم استعمل «استبدال في كل البحث».</p><button type="button" class="tl-btn" data-act="gofind">' + I.srch + '<span>فتح البحث والاستبدال</span></button></div>' +
      '<div class="tl-box"><h3>سجل التعديلات ونقاط الاستعادة</h3><div class="rs-btns"><button type="button" class="tl-btn pri" data-act="snapnew">' + I.plus + '<span>إنشاء نقطة استعادة الآن</span></button></div><div id="snapList"></div><p class="tl-hint">تُنشأ نقطة تلقائية كل 15 دقيقة من العمل، وقبل الاستعادة وحذف الأقسام والاستبدال الشامل.</p></div>' +
      '<div class="tl-box"><h3>النسخ الاحتياطي</h3><div class="rs-btns"><button type="button" class="tl-btn pri" data-act="bakme">' + I.dl + '<span>تصدير نسخة احتياطية لهذا البحث</span></button><button type="button" class="tl-btn" data-act="impme">' + I.ul + '<span>استيراد نسخة احتياطية</span></button></div><p class="tl-hint">ملف JSON منظم يضم النصوص والصور والجداول والتنسيقات والمراجع، ويُتحقق من صحته قبل الاستيراد. احتفظ بعدة نسخ بتواريخ مختلفة، ويمكنك استعادتها على أي جهاز آخر.</p></div>' +
      '<div class="tl-box"><h3>التخزين</h3><div id="stoInfo" class="tl-hint">…</div><button type="button" class="tl-btn sm" data-act="cleanimg">تنظيف الصور غير المستعملة</button></div>';
    snapRender(); storageInfo();
  };
  function snapRender() {
    D.byPaper('snaps', P().id).then(function (a) {
      var e = $('#snapList'); if (!e) return; a.sort(function (x, y) { return y.time - x.time; });
      e.innerHTML = a.length ? a.map(function (s) { return '<div class="rs-ref-i"><div class="tl-grow"><b>' + U.fmtDT(s.time) + '</b> <span class="tl-tag">' + (s.auto ? 'تلقائية' : 'يدوية') + '</span> ' + esc(s.label || '') + '</div><button type="button" class="tl-btn sm" data-act="snaprest" data-id="' + s.id + '">استعادة</button><button type="button" class="tl-btn sm del" data-act="snapdel" data-id="' + s.id + '">' + I.trash + '</button></div>'; }).join('') : '<p class="tl-empty">لا توجد نقاط بعد.</p>';
    });
  }
  function storageInfo() {
    var e = $('#stoInfo'); if (!e) return; if (!(navigator.storage && navigator.storage.estimate)) { e.textContent = 'تقدير المساحة غير متاح في هذا المتصفح.'; return; }
    navigator.storage.estimate().then(function (r) { var mb = function (x) { return (x / 1048576).toFixed(1); }; e.textContent = 'المستعمل: ' + mb(r.usage || 0) + ' م.ب من نحو ' + mb(r.quota || 0) + ' م.ب المتاحة لهذا الموقع.'; });
  }
  function cleanImages() {
    var p = P(); Promise.all([D.byPaper('images', p.id), D.byPaper('snaps', p.id)]).then(function (r) {
      var used = {}; function use(pp) { (pp.figs || []).forEach(function (f) { used[f.imgId] = 1; }); (pp.cover && pp.cover.els || []).forEach(function (e) { if (e.imgId) used[e.imgId] = 1; }); }
      use(p); r[1].forEach(function (s) { use(s.paper); });
      var del = r[0].filter(function (im) { return !used[im.id]; }); return Promise.all(del.map(function (im) { delete S.imgs[im.id]; return D.del('images', im.id); })).then(function () { toast(del.length ? 'حُذفت ' + del.length + ' صورة غير مستعملة.' : 'لا توجد صور غير مستعملة.'); storageInfo(); });
    });
  }

  /* =================================================================== التصدير */
  var ex = { scope: 'all', sel: {}, cover: true, plan: true, toc: null, refs: true, coverImg: true, busy: false };
  UI2.export = function (el) {
    var p = P(), nt = M.numberTree(p); if (!Object.keys(ex.sel).length) { ex.sel.intro = ex.sel.concl = true; nt.flat.forEach(function (r) { ex.sel[r.id] = true; }); }
    function tree(arr, depth) { return arr.map(function (s) { return '<label class="rs-chk" style="padding-inline-start:' + depth * 16 + 'px"><input type="checkbox" data-exs="' + s.id + '"' + (ex.sel[s.id] ? ' checked' : '') + '> ' + esc(nt.map[s.id].text) + '</label>' + tree(s.children, depth + 1); }).join(''); }
    el.innerHTML = '<div class="tl-box"><h3>ما الذي تريد تصديره؟</h3><div class="tl-chips"><button type="button" class="tl-chip' + (ex.scope === 'all' ? ' on' : '') + '" data-act="exscope" data-t="all">البحث كاملاً</button><button type="button" class="tl-chip' + (ex.scope === 'sel' ? ' on' : '') + '" data-act="exscope" data-t="sel">أقسام محددة</button></div>' +
      (ex.scope === 'sel' ? '<div class="rs-sel"><label class="rs-chk"><input type="checkbox" data-exs="intro"' + (ex.sel.intro ? ' checked' : '') + '> ' + esc(p.settings.introTitle) + '</label>' + tree(p.body, 0) + '<label class="rs-chk"><input type="checkbox" data-exs="concl"' + (ex.sel.concl ? ' checked' : '') + '> ' + esc(p.settings.conclTitle) + '</label></div>' : '') +
      '<label class="rs-chk"><input type="checkbox" data-ex="cover"' + (ex.cover ? ' checked' : '') + '> تضمين الغلاف</label><label class="rs-chk"><input type="checkbox" data-ex="plan"' + (ex.plan ? ' checked' : '') + '> تضمين خطة البحث</label><label class="rs-chk"><input type="checkbox" data-ex="toc"' + ((ex.toc == null ? p.toc.on : ex.toc) ? ' checked' : '') + '> تضمين الفهرس</label><label class="rs-chk"><input type="checkbox" data-ex="refs"' + (ex.refs ? ' checked' : '') + '> تضمين قائمة المراجع</label></div>' +
      '<div class="tl-box"><h3>PDF</h3><button type="button" class="tl-btn pri block" data-act="expdf">' + I.dl + '<span>PDF نصي (الأفضل جودةً وقابلية للتحديد)</span></button><p class="tl-hint">تفتح نافذة الطباعة: اختر «حفظ بصيغة PDF» (أو Save as PDF). يحفظ العربية واتجاه RTL والصور والجداول وترقيم الصفحات، والنص قابل للتحديد والبحث. يناسب الأبحاث الطويلة.</p><button type="button" class="tl-btn block" data-act="expdfi">' + I.dl + '<span>PDF مباشر بتنزيل فوري (صفحات كصور)</span></button><p class="tl-hint">خيار احتياطي للهواتف: ينزّل الملف دون نافذة طباعة لكن النص صور غير قابلة للتحديد والحجم أكبر. للأبحاث الطويلة استعمل الخيار الأول.</p><button type="button" class="tl-btn sm" data-act="exopen">فتح صفحة الطباعة في تبويب جديد</button></div>' +
      '<div class="tl-box"><h3>Word (DOCX)</h3><label class="rs-chk"><input type="checkbox" data-ex="coverImg"' + (ex.coverImg ? ' checked' : '') + '> الغلاف كصورة (يحفظ التصميم كما هو؛ ألغِه ليصبح نصاً قابلاً للتعديل)</label><button type="button" class="tl-btn pri block" data-act="exdocx">' + I.dl + '<span>تنزيل ملف Word</span></button><p class="tl-hint">ملف قابل للتحرير بعناوين Word الحقيقية (تظهر في جزء التنقل)، يدعم RTL ويتضمن الصور والجداول. الفهرس حقل Word حقيقي: اضغط بزر الفأرة الأيمن ثم «تحديث الحقل» ليتوافق مع ترقيم Word.</p></div>' +
      '<div class="tl-box"><h3>نص عادي (TXT)</h3><button type="button" class="tl-btn block" data-act="extxt">' + I.dl + '<span>تنزيل ملف TXT</span></button><p class="tl-hint">يستخرج النصوص والعناوين بترتيب الأقسام ويتجاهل التنسيقات البصرية غير المدعومة.</p></div><div id="exMsg"></div>';
  };
  function exOpts() {
    var p = P(), o = layoutOpts({ cover: ex.cover && p.coverOn !== false, plan: ex.plan, toc: ex.toc == null ? p.toc.on : ex.toc, refs: ex.refs });
    if (ex.scope === 'sel') { o.secIds = {}; Object.keys(ex.sel).forEach(function (k) { if (ex.sel[k]) o.secIds[k] = true; }); o.intro = !!ex.sel.intro; o.concl = !!ex.sel.concl; }
    return o;
  }
  function busy(on, msg) { ex.busy = on; var m = $('#exMsg'); if (m) m.innerHTML = on ? '<div class="tl-msg">' + esc(msg || 'جارٍ التجهيز…') + '</div>' : ''; $$('#rsTab .tl-btn').forEach(function (b) { b.disabled = on; }); }
  function doExport(kind) {
    if (ex.busy) return; var p = P(), o = exOpts(); UI.commit(); UI.saveNow();
    if (ex.scope === 'sel' && !Object.keys(o.secIds).length) { toast('اختر قسماً واحداً على الأقل.'); return; }
    busy(true, 'جارٍ تجهيز الصفحات…');
    setTimeout(function () {
      var res, name = U.safeName(p.title);
      try { res = L.run(p, S.imgs, o); } catch (e) { busy(false); toast('تعذّر التخطيط: ' + e.message, 5000); return; }
      function fail(e) { busy(false); toast('تعذّر التصدير: ' + (e && e.message || ''), 6000); }
      if (kind === 'pdf') { L.print(res.pages, p.settings, name).then(function () { busy(false); }, function () { busy(false); if (!L.openTab(res.pages, p.settings, name)) toast('تعذّرت الطباعة. جرّب خيار PDF المباشر.'); else toast('فُتحت صفحة الطباعة: اطبعها أو احفظها من قائمة المتصفح.'); }); }
      else if (kind === 'open') { busy(false); if (L.openTab(res.pages, p.settings, name)) toast('افتح قائمة المتصفح ثم «طباعة» لحفظها PDF.', 4000); else toast('حُجبت النافذة المنبثقة؛ نُزّلت الصفحة كملف HTML يمكن طباعته.', 5000); }
      else if (kind === 'pdfi') { L.imagePdf(res.pages, p.settings, function (i, n) { busy(true, 'جارٍ تحويل الصفحة ' + i + ' من ' + n + '…'); }).then(function (blob) { U.download(blob, name + '.pdf'); busy(false); toast('تم تنزيل ملف PDF.'); }, fail); }
      else if (kind === 'txt') { U.download(new Blob([X.txt(p, S.imgs, o, res)], { type: 'text/plain;charset=utf-8' }), name + '.txt'); busy(false); toast('تم تنزيل ملف TXT.'); }
      else if (kind === 'docx') {
        var go = function (png) { try { o.coverPng = png; var blob = X.docx(p, S.imgs, o, res); U.download(blob, name + '.docx'); busy(false); toast('تم تنزيل ملف Word.'); } catch (e) { fail(e); } };
        if (res.hasCover && ex.coverImg) X.coverPng(res.pages[0], p.settings).then(go, function () { go(null); }); else go(null);
      }
    }, 40);
  }

  /* ================================================================ أحداث عامة */
  UI2.act = function (a, t, e) {
    var p = P();
    switch (a) {
      case 'cvtpl': cvRebuild(t.dataset.t, null); break;
      case 'cvacc': cvRebuild(null, t.dataset.c); break;
      case 'cvadd': { var c = p.cover, k = t.dataset.k, el = k === 'text' ? { id: U.uid(), k: 'text', x: Math.round(c.W * 0.1), y: Math.round(c.H * 0.5), w: Math.round(c.W * 0.8), h: 40, text: 'نص جديد', ff: 'Traditional Arabic', fs: 20, color: '#000000', b: false, i: false, u: false, al: 'center', need: [] } : k === 'line' ? { id: U.uid(), k: 'rect', x: Math.round(c.W * 0.2), y: Math.round(c.H * 0.5), w: Math.round(c.W * 0.6), h: 3, bg: c.accent, bc: '', bw: 0, bs: 'solid' } : { id: U.uid(), k: 'rect', x: Math.round(c.W * 0.1), y: Math.round(c.H * 0.4), w: Math.round(c.W * 0.8), h: 160, bg: '', bc: c.accent, bw: 3, bs: 'solid' }; el.z = c.els.length; c.els.push(el); cvSel = el.id; UI.markDirty(); cvRender(); cvProps(); break; }
      case 'cvlogo': case 'cvimg': cvFileMode = { repl: null }; $('#cvFile').click(); break;
      case 'cvrepl': cvFileMode = { repl: cvSel }; $('#cvFile').click(); break;
      case 'cvtok': { var ta = $('#cvText'), el2 = cvEl(cvSel); if (ta && el2) { var pos = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, pos) + '{{' + t.dataset.k + '}}' + ta.value.slice(pos); el2.text = ta.value; UI.markDirty(); cvRender(); } break; }
      case 'cvfmt': { var e3 = cvEl(cvSel); e3[t.dataset.k] = !e3[t.dataset.k]; UI.markDirty(); cvRender(); cvProps(); break; }
      case 'cvfit': { var e4 = cvEl(cvSel); e4.fit = e4.fit === 'cover' ? 'contain' : 'cover'; UI.markDirty(); cvRender(); cvProps(); break; }
      case 'cvnobg': { cvEl(cvSel).bg = ''; UI.markDirty(); cvRender(); cvProps(); break; }
      case 'cvfront': { var e5 = cvEl(cvSel), mx = 0; p.cover.els.forEach(function (x) { mx = Math.max(mx, x.z || 0); }); e5.z = mx + 1; UI.markDirty(); cvRender(); break; }
      case 'cvback': { var e6 = cvEl(cvSel), mn = 0; p.cover.els.forEach(function (x) { mn = Math.min(mn, x.z || 0); }); e6.z = mn - 1; UI.markDirty(); cvRender(); break; }
      case 'cvdup': { var e7 = U.clone(cvEl(cvSel)); e7.id = U.uid(); e7.x += 20; e7.y += 20; e7.z = (e7.z || 0) + 1; p.cover.els.push(e7); cvSel = e7.id; UI.markDirty(); cvRender(); cvProps(); break; }
      case 'cvdel': p.cover.els = p.cover.els.filter(function (x) { return x.id !== cvSel; }); cvSel = null; UI.markDirty(); cvRender(); cvProps(); break;
      case 'citest': UI.commit(); p.cite = t.dataset.t; UI.markDirty(); UI2.refs($('#rsTab')); break;
      case 'refadd': refDialog(null); break;
      case 'refedit': refDialog(t.dataset.id); break;
      case 'refdel': { var n = R.usageCount(p, t.dataset.id); UI.confirm(n ? 'هذا المرجع مُستشهَد به ' + n + ' مرة في النص؛ ستتحول إحالاته إلى «(مرجع محذوف)». حذفه؟' : 'حذف هذا المرجع؟', 'حذف', true).then(function (ok) { if (!ok) return; p.refs = p.refs.filter(function (r) { return r.id !== t.dataset.id; }); UI.markDirty(); refsRender(); }); break; }
      case 'figadd': UI2.imageDialog(); break;
      case 'figedit': UI2.imageDialog(t.dataset.id); break;
      case 'figdel': UI.confirm('حذف هذه الصورة من البحث؟', 'حذف', true).then(function (ok) { if (ok) { p.figs = p.figs.filter(function (f) { return f.id !== t.dataset.id; }); UI.markDirty(); UI2.media($('#rsTab')); } }); break;
      case 'gosec': S.tab = 'edit'; S.selId = t.dataset.id; UI.renderTab(); break;
      case 'gofind': S.tab = 'edit'; UI.renderTab(); setTimeout(function () { var b = $('[data-cmd="find"]'); if (b) b.click(); }, 50); break;
      case 'pvref': runPreview($('#pvBox'), $('#pvBox').clientWidth || 360, function (res) { var i = $('#pvInfo'); if (i) i.innerHTML = 'عدد الصفحات: <b>' + res.count + '</b>' + (res.warns.length ? '<br>' + res.warns.map(esc).join('<br>') : ''); }); break;
      case 'pvz': { var z = +t.dataset.z; if (!z) pv.zoom = 0; else pv.zoom = Math.max(0.2, Math.min(2, (pv.zoom || Math.min(1, ($('#pvBox').clientWidth - 16) / (M.pageMM(p.settings)[0] * PX))) + z * 0.15)); if (pv.res) renderPages($('#pvBox'), pv.res, $('#pvBox').clientWidth); break; }
      case 'pvedit': { var tg = t.dataset.t.split(':'); S.tab = tg[0]; if (tg[1]) S.selId = tg[1]; UI.renderTab(); break; }
      case 'tplsave': UI.prompt('حفظ كقالب', 'اسم القالب', '').then(function (name) { if (!name) return; var a = userTpl(); var strc = function (arr) { return arr.map(function (s) { return { t: s.type, title: s.title, c: strc(s.children) }; }); }; a.push({ name: name, settings: U.clone(p.settings), structure: strc(p.body) }); if (setUserTpl(a)) { toast('تم حفظ القالب.'); UI2.settings($('#rsTab')); } else toast('تعذّر حفظ القالب.'); }); break;
      case 'tplapply': { var ut = userTpl()[+t.dataset.i]; UI.confirm('سيُطبَّق القالب «' + ut.name + '» على إعدادات هذا البحث (الهيكل يبقى كما هو). المتابعة؟', 'تطبيق').then(function (ok) { if (!ok) return; for (var k in ut.settings) p.settings[k] = ut.settings[k]; UI.markDirty(); UI2.settings($('#rsTab')); }); break; }
      case 'tpldel': { var a2 = userTpl(); a2.splice(+t.dataset.i, 1); setUserTpl(a2); UI2.settings($('#rsTab')); break; }
      case 'setreset': UI.confirm('إرجاع كل إعدادات الصفحة والتنسيق إلى الافتراضية؟', 'إرجاع').then(function (ok) { if (!ok) return; p.settings = M.defaultSettings(); UI.markDirty(); UI2.settings($('#rsTab')); }); break;
      case 'snapnew': UI.prompt('نقطة استعادة', 'وصف (اختياري)', '').then(function (v) { if (v === null) return; UI.commit(); UI.makeSnap(v || 'يدوية', false).then(function () { toast('تم إنشاء نقطة الاستعادة.'); snapRender(); }); }); break;
      case 'snapdel': D.del('snaps', t.dataset.id).then(snapRender); break;
      case 'snaprest': D.get('snaps', t.dataset.id).then(function (s) { UI.confirm('ستُستعاد نسخة البحث بتاريخ ' + U.fmtDT(s.time) + '. تُنشأ نقطة للحالة الحالية قبل الاستعادة. المتابعة؟', 'استعادة').then(function (ok) { if (!ok) return; UI.commit(); UI.makeSnap('قبل الاستعادة', false).then(function () { var np = U.clone(s.paper); np.id = p.id; np.modified = Date.now(); S.paper = np; return D.put('papers', np); }).then(function () { toast('تمت الاستعادة.'); UI.openPaper(p.id, 'tools'); }); }); }); break;
      case 'bakme': UI.commit(); UI.saveNow().then(function () { UI.exportBackup(p.id); }); break;
      case 'impme': $('#rsImport').click(); break;
      case 'cleanimg': cleanImages(); break;
      case 'exscope': ex.scope = t.dataset.t; UI2.export($('#rsTab')); break;
      case 'expdf': doExport('pdf'); break; case 'expdfi': doExport('pdfi'); break; case 'exopen': doExport('open'); break; case 'exdocx': doExport('docx'); break; case 'extxt': doExport('txt'); break;
    }
  };
  UI2.change = function (e) {
    var t = e.target, p = P(); if (!p) return;
    if (t.id === 'cvOn') { p.coverOn = t.checked; UI.markDirty(); return; }
    if (t.id === 'cvAccIn') { cvRebuild(null, t.value); return; }
    if (t.id === 'cvFile') { var f = t.files[0]; t.value = ''; if (f) cvAddImage(f, cvFileMode && cvFileMode.repl); return; }
    if (t.dataset.cv && (t.tagName === 'SELECT' || t.type === 'color')) { cvApply(t); return; }
    if (t.dataset.set) { if (t.dataset.set === 'groupRefs') { p.settings.groupRefs = t.checked; UI.markDirty(); refsRender(); return; } applySetting(t); return; }
    if (t.dataset.toc) { p.toc[t.dataset.toc] = t.checked; UI.markDirty(); return; }
    if (t.dataset.ex) { ex[t.dataset.ex] = t.checked; return; }
    if (t.dataset.exs) { ex.sel[t.dataset.exs] = t.checked; var f2 = M.findSec(p, t.dataset.exs); if (f2) { M.walk(f2.sec.children, function (c) { ex.sel[c.id] = t.checked; }); UI2.export($('#rsTab')); } return; }
    if (t.id === 'pvGo') { var n = parseInt(t.value, 10), w = $('.rs-pvw[data-pg="' + n + '"]'); if (w) w.scrollIntoView({ block: 'start' }); }
  };
  UI2.input = function (e) {
    var t = e.target; if (!P()) return;
    if (t.dataset.cv) cvApply(t);
    else if (t.dataset.set && (t.type === 'text' || t.type === 'number' || t.dataset.ty === 'n' || t.tagName === 'INPUT')) { if (t.type !== 'color' && t.type !== 'checkbox') applySetting(t); }
  };
  function cvApply(t) {
    var el = cvSel && cvEl(cvSel); if (!el) return; var k = t.dataset.cv, v = t.value;
    if (['x', 'y', 'w', 'h', 'fs', 'bw'].indexOf(k) >= 0) { v = parseFloat(v); if (!isFinite(v)) return; if ((k === 'w' || k === 'h') && v < 1) return; if (k === 'fs' && v < 4) return; }
    el[k] = v; UI.markDirty(); cvRender();
  }
})();
