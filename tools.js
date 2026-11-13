/* ==========================================================================
   أدوات الطالب (tools.js) — 5 أدوات تعمل محلياً بالكامل داخل قسم «الأدوات»
   - بلا أي API خارجي ولا ذكاء اصطناعي، والحفظ في LocalStorage فقط
   - مفاتيح الحفظ مستقلة لكل أداة: tl_sched_v1 / tl_pomo_v1 / tl_gpa_v1 / tl_todo_v1
   - كل الأسماء داخل IIFE واحدة وبالبادئة tl، فلا تتعارض مع سكربتات الموقع
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('v-tools');
  if (!root) return;

  /* ---------- أدوات مساعدة عامة ---------- */
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function num(v) { /* يقبل الأرقام العربية والفاصلة العشرية «،» أو «,» */
    var s = String(v == null ? '' : v).trim().replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; }).replace(/[,،٫]/g, '.');
    if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtDateTime(t) { try { return new Date(t).toLocaleDateString('ar-DZ-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function ic(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
  var I = {
    slides: ic('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    print: ic('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    save: ic('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>'),
    pdf: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>'),
    refresh: ic('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>'),
    chev: ic('<path d="m15 18-6-6 6-6"/>'),
    cal: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>'),
    timer: ic('<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>'),
    calc: ic('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15h.01"/><path d="M8 19h8"/>'),
    dumb: ic('<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/>'),
    doc: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>'),
    list: ic('<path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
    maps: ic('<rect x="9" y="9" width="6" height="6" rx="1.5"/><rect x="2" y="3" width="6" height="5" rx="1.5"/><rect x="16" y="3" width="6" height="5" rx="1.5"/><rect x="9" y="17" width="6" height="5" rx="1.5"/><path d="M5 8v1.5a1.5 1.5 0 0 0 1.5 1.5H9"/><path d="M19 8v1.5a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M12 15v2"/>'),
    refs: ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h5"/>')
  };

  /* ---------- إشعار صغير ---------- */
  var toastEl = document.createElement('div');
  toastEl.className = 'tl-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  var toastT = 0;
  function toast(m, ms) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2400); }

  /* ---------- نافذة منبثقة (Modal) ---------- */
  var mbg = document.createElement('div');
  mbg.className = 'tl-mbg'; mbg.innerHTML = '<div class="tl-modal" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(mbg);
  var modal = mbg.firstChild, modalOnClose = null;
  function openModal(html) { modal.innerHTML = html; mbg.classList.add('open'); var f = modal.querySelector('input,select,textarea'); if (f && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60); }
  function closeModal() { mbg.classList.remove('open'); modal.innerHTML = ''; modalOnClose = null; }
  mbg.addEventListener('mousedown', function (e) { if (e.target === mbg) closeModal(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && mbg.classList.contains('open')) closeModal(); });

  /* ---------- الطباعة / PDF (عبر نافذة الطباعة: «حفظ بصيغة PDF») ---------- */
  var printEl = document.createElement('div');
  printEl.id = 'tlPrint'; document.body.appendChild(printEl);
  function clearPrint() { document.body.classList.remove('tl-printing'); }
  addEventListener('afterprint', clearPrint);
  /* الطباعة تتم عبر إطار (iframe) مستقل يحوي صفحة الطباعة فقط؛ هذا أضمن على الهاتف والحاسوب
     من طباعة الصفحة نفسها. وإن تعذّر الإطار نستعمل الطريقة القديمة (إخفاء الصفحة مؤقتاً). */
  var PRINT_CSS = '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{direction:rtl;font-family:"Alexandria",Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;padding:0;line-height:1.8;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'h1{font-size:20px;margin:0 0 4px}.pm{color:#444;font-size:12.5px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}th,td{border:1px solid #888;padding:4px 8px;text-align:right;vertical-align:top}th{background:#eee}tr{page-break-inside:avoid}.dn td{color:#666;text-decoration:line-through}.brk td{color:#777;font-size:11.5px;text-align:center}.big{font-size:18px;font-weight:700;margin:8px 0}small{color:#555}';
  function printFallback(html) {
    printEl.innerHTML = html;
    document.body.classList.add('tl-printing');
    setTimeout(function () {
      try { window.print(); } catch (e) { clearPrint(); toast('تعذّرت الطباعة على هذا المتصفح'); return; }
      var off = function () { clearPrint(); removeEventListener('pointerdown', off, true); };
      addEventListener('pointerdown', off, true);
    }, 80);
  }
  function printIframe(html) {
    var old = document.getElementById('tlPrintFrame'); if (old) old.remove();
    var f = document.createElement('iframe'), fired = false;
    f.id = 'tlPrintFrame'; f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(f);
    function fire() {
      if (fired) return; fired = true;
      try {
        var w = f.contentWindow; w.focus();
        w.onafterprint = function () { setTimeout(function () { if (f.parentNode) f.remove(); }, 800); };
        w.print();
        setTimeout(function () { if (f.parentNode) f.remove(); }, 120000);
      } catch (e) { if (f.parentNode) f.remove(); printFallback(html); }
    }
    try {
      var d = f.contentDocument || f.contentWindow.document;
      d.open();
      d.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة</title><style>' + PRINT_CSS + '</style></head><body>' + html + '</body></html>');
      d.close();
    } catch (e) { f.remove(); printFallback(html); return; }
    f.onload = function () { setTimeout(fire, 150); };
    setTimeout(fire, 700);
  }

  /* ---- توليد PDF حقيقي داخل الموقع (بدون مكتبات ولا إنترنت) ----
     نرسم صفحة الطباعة إلى صورة عبر SVG ثم نقطّعها إلى صفحات A4 ونكتب ملف PDF يدوياً. */
  var PDF_CSS = '#tlPdfRoot{direction:rtl;font-family:Tahoma,Arial,"Noto Naskh Arabic",sans-serif;color:#000;background:#fff;line-height:1.8;font-size:14px}#tlPdfRoot *{box-sizing:border-box}' +
    '#tlPdfRoot h1{font-size:22px;margin:0 0 4px}#tlPdfRoot .pm{color:#444;font-size:13px;margin-bottom:10px}#tlPdfRoot table{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:12px}#tlPdfRoot th,#tlPdfRoot td{border:1px solid #888;padding:4px 8px;text-align:right;vertical-align:top}#tlPdfRoot th{background:#eee}#tlPdfRoot .dn td{color:#666;text-decoration:line-through}#tlPdfRoot .brk td{color:#777;font-size:12px;text-align:center}#tlPdfRoot .big{font-size:19px;font-weight:700;margin:8px 0}#tlPdfRoot small{color:#555}';
  function pdfCanvases(html) {
    return new Promise(function (resolve, reject) {
      var W = 794, PH = 1123, MT = 36, U = PH - 2 * MT, host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + W + 'px;visibility:hidden;pointer-events:none';
      host.innerHTML = '<style>' + PDF_CSS + '</style><div id="tlPdfRoot" style="box-sizing:border-box;width:' + W + 'px;padding:0 40px;">' + html + '</div>';
      document.body.appendChild(host);
      var rootEl = host.lastChild;
      function done(e) { if (host.parentNode) host.remove(); reject(e); }
      try {
        var H = Math.ceil(rootEl.scrollHeight) + 4, base = rootEl.getBoundingClientRect().top, cands = [0];
        $$('tr,h1,.pm,.big', rootEl).forEach(function (el) { cands.push(Math.round(el.getBoundingClientRect().bottom - base)); });
        cands.sort(function (a, b) { return a - b; });
        var xml = new XMLSerializer().serializeToString(rootEl), css = PDF_CSS.replace(/&/g, '&amp;');
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>' + css + '</style>' + xml + '</div></foreignObject></svg>';
        var sc = H * 2 > 15000 ? 1 : 2, img = new Image();
        img.onload = function () {
          try {
            var big = document.createElement('canvas'); big.width = W * sc; big.height = H * sc;
            var bx = big.getContext('2d'); bx.fillStyle = '#fff'; bx.fillRect(0, 0, big.width, big.height); bx.drawImage(img, 0, 0, W * sc, H * sc);
            var pages = [], start = 0, guard = 0;
            while (start < H - 2 && guard++ < 60) {
              var limit = start + U, end = Math.min(H, limit);
              if (H > limit) { var best = 0; cands.forEach(function (c) { if (c > start + 40 && c <= limit) best = c; }); end = best || limit; }
              var pc = document.createElement('canvas'); pc.width = W * sc; pc.height = PH * sc;
              var px = pc.getContext('2d'); px.fillStyle = '#fff'; px.fillRect(0, 0, pc.width, pc.height);
              px.drawImage(big, 0, start * sc, W * sc, (end - start) * sc, 0, MT * sc, W * sc, (end - start) * sc);
              pages.push(pc.toDataURL('image/jpeg', 0.92).split(',')[1]); start = end;
            }
            host.remove(); resolve(pages);
          } catch (e) { done(e); }
        };
        img.onerror = function () { done(new Error('svg')); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (e) { done(e); }
    });
  }
  function buildPdf(b64pages, wpx, hpx) {
    var parts = [], off = [], len = 0;
    function str(t) { var u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i) & 255; return u; }
    function push(x) { if (typeof x === 'string') x = str(x); parts.push(x); len += x.length; }
    function b64(t) { var bin = atob(t), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    var n = b64pages.length, kids = [], i;
    for (i = 0; i < n; i++) kids.push((3 + 3 * i) + ' 0 R');
    push('%PDF-1.4\n');
    off[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    off[2] = len; push('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n');
    for (i = 0; i < n; i++) {
      var pg = 3 + 3 * i, ct = 4 + 3 * i, im = 5 + 3 * i, jpg = b64(b64pages[i]), cs = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
      off[pg] = len; push(pg + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>\nendobj\n');
      off[ct] = len; push(ct + ' 0 obj\n<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream\nendobj\n');
      off[im] = len; push(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + wpx + ' /Height ' + hpx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); push(jpg); push('\nendstream\nendobj\n');
    }
    var total = 3 + 3 * n, xr = len, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (i = 1; i < total; i++) x += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function makePdf(html) {
    return pdfCanvases(html).then(function (pages) {
      var c = document.createElement('canvas'); /* أبعاد الصورة (نفس أبعاد كل الصفحات) */
      var sc = 2; return buildPdf(pages, 794 * sc, 1123 * sc);
    });
  }
  function savePdf(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }
  function openPdf(blob, name) {
    var u = URL.createObjectURL(blob), w = null;
    try { w = window.open(u, '_blank'); } catch (e) {}
    if (!w) savePdf(blob, name); else setTimeout(function () { URL.revokeObjectURL(u); }, 120000);
  }
  /* asPdf=true: تنزيل ملف PDF دائماً. asPdf=false: طباعة مباشرة على الحاسوب، وعلى الهاتف
     نولّد PDF ونفتح قائمة المشاركة (فيها «طباعة») أو نفتحه في تبويب جديد. */
  function doPrint(html, asPdf, name) {
    name = (name || 'document') + '.pdf';
    var touch = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
    if (!asPdf && !touch) { printIframe(html); return; }
    toast('جارٍ تجهيز الملف…', 1800);
    makePdf(html).then(function (blob) {
      if (asPdf) { savePdf(blob, name); toast('تم تنزيل ملف PDF'); return; }
      var file = null; try { file = new File([blob], name, { type: 'application/pdf' }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch(function (e) { if (!e || e.name !== 'AbortError') openPdf(blob, name); });
      } else openPdf(blob, name);
    }).catch(function () { if (asPdf) toast('تعذّر إنشاء PDF على هذا المتصفح، جرّب زر الطباعة'); else printIframe(html); });
  }

  /* ---------- التنقل بين الصفحات الداخلية للأدوات ---------- */
  var TOOLS = {
    sched: { title: 'إنشاء جدول دراسي', desc: 'وزّع موادك تلقائياً على أيامك وأوقات فراغك', icon: I.cal },
    pomo: { title: 'مؤقت بومودورو', desc: 'ركّز بجلسات دراسة وراحة منتظمة', icon: I.timer },
    gpa: { title: 'حساب المعدل الفصلي', desc: 'معدل السداسي بالمعاملات مع حفظ كشف النقاط', icon: I.calc },
    todo: { title: 'قائمة المهام', desc: 'نظّم واجباتك وامتحاناتك ومواعيد تسليمها', icon: I.list },
    fit: { title: 'الحاسبات الرياضية والتغذوية', desc: 'BMI والسعرات والبروتين والمغذيات وغيرها: 9 حاسبات لطالب التربية البدنية', icon: I.dumb },
    research: { title: 'إنشاء بحث جامعي', desc: 'اكتب بحثك بفصوله ومراجعه وغلافه، واحفظه على جهازك وصدّره PDF وWord وTXT', icon: I.doc },
    maps: { title: 'منشئ الخرائط المفاهيمية', desc: 'ارسم خريطتك بعقد وأشكال قابلة للتحريك والتعديل على مساحة عمل واسعة', icon: I.maps },
    slides: { title: 'استوديو العروض التقديمية', desc: 'أنشئ عروضك التقديمية بشرائح وخصائص منظمة، وتُحفظ مشاريعك على جهازك', icon: I.slides },
    refs: { title: 'مولّد المراجع الأكاديمية', desc: 'وثّق مراجعك بنمط APA وHarvard وMLA وChicago، واحفظ قائمتك على جهازك', icon: I.refs }
  };
  var ORDER = ['sched', 'pomo', 'gpa', 'todo', 'fit', 'research', 'refs', 'maps', 'slides'];
  var curTool = null, hub, views = {};

  function buildShell() {
    var h = '<div class="tl-view" id="tlHub"><h2 class="ptitle">الأدوات</h2><p class="tl-sub">أدوات تعمل على جهازك مباشرة، وبياناتها محفوظة عندك ولا تحتاج اتصالاً بالإنترنت.</p><div class="tl-hub">';
    ORDER.forEach(function (k) {
      h += '<button type="button" class="tl-card" data-tool="' + k + '"><span class="tl-ic">' + TOOLS[k].icon + '</span><span class="tl-grow"><b>' + TOOLS[k].title + '</b><small>' + TOOLS[k].desc + '</small></span><span class="tl-go">' + I.chev + '</span></button>';
    });
    h += '</div></div>';
    ORDER.forEach(function (k) { h += '<div class="tl-view" id="tl-' + k + '" hidden></div>'; });
    root.innerHTML = h;
    hub = $('#tlHub');
    ORDER.forEach(function (k) { views[k] = $('#tl-' + k); });
  }
  function topbar(title) {
    return '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><h2 class="ptitle">' + title + '</h2>';
  }
  var inited = {};
  function showTool(k, fromPop) {
    curTool = k;
    hub.hidden = !!k;
    ORDER.forEach(function (x) { views[x].hidden = x !== k; });
    if (k) {
      if (!inited[k]) { inited[k] = true; INIT[k](); }
      else if (REFRESH[k]) REFRESH[k]();
      scrollTo(0, 0);
      if (!fromPop) { var old = history.state || {}; try { history.pushState({ v: 'tools', s: old.s || 0, l: old.l || 1, t: k }, ''); } catch (e) {} }
    } else if (!fromPop) { scrollTo(0, 0); }
  }
  function leaveTool() { if (history.state && history.state.t) history.back(); else showTool(null, true); }

  root.addEventListener('click', function (e) {
    var c = e.target.closest('.tl-card');
    if (c) { showTool(c.dataset.tool); return; }
    if (e.target.closest('.tl-back')) leaveTool();
  });
  /* زر «الأدوات» في الشريط السفلي يعيد دائماً إلى بطاقات الأدوات */
  var bn = document.getElementById('bnav');
  if (bn) bn.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.nav === 'tools') { closeModal(); showTool(null, true); } });
  /* زر الرجوع في الهاتف/المتصفح */
  addEventListener('popstate', function (e) {
    var st = e.state;
    closeModal();
    if (st && st.v === 'tools') showTool(st.t || null, true);
  });
  var INIT = {}, REFRESH = {};
  buildShell();

  /* أداة «إنشاء بحث جامعي»: الشيفرة في research-*.js وتُحمَّل مع الصفحة (تعمل دون إنترنت) */
  INIT.research = function () {
    var v = views.research;
    if (window.RS && RS.ui && RS.ui.init) RS.ui.init(v);
    else v.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><div class="tl-box"><p class="tl-empty">تعذّر تحميل أداة البحث. حدّث الصفحة وأعد المحاولة.</p></div>';
  };
  REFRESH.research = function () { if (window.RS && RS.ui && RS.ui.refresh) RS.ui.refresh(); };

  /* أداة «مولّد المراجع الأكاديمية»: الشيفرة في refs-core.js + refs-ui.js (تعمل دون إنترنت) */
  INIT.refs = function () {
    var v = views.refs;
    if (window.RF && RF.ui && RF.ui.init) RF.ui.init(v);
    else v.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><div class="tl-box"><p class="tl-empty">تعذّر تحميل أداة المراجع. حدّث الصفحة وأعد المحاولة.</p></div>';
  };
  REFRESH.refs = function () { if (window.RF && RF.ui && RF.ui.refresh) RF.ui.refresh(); };

  /* أداة «استوديو العروض التقديمية»: الشيفرة في slides.js + slides.css (تعمل دون إنترنت) */
  INIT.slides = function () {
    var v = views.slides;
    if (window.SL && SL.init) SL.init(v);
    else v.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><div class="tl-box"><p class="tl-empty">تعذّر تحميل استوديو العروض. حدّث الصفحة وأعد المحاولة.</p></div>';
  };
  REFRESH.slides = function () { if (window.SL && SL.refresh) SL.refresh(); };

  /* أداة «منشئ الخرائط المفاهيمية»: الشيفرة في cmap-core.js + cmap-ui.js وتُحمَّل مع الصفحة (تعمل دون إنترنت) */
  INIT.maps = function () {
    var v = views.maps;
    if (window.CM && CM.ui && CM.ui.init) CM.ui.init(v);
    else v.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><div class="tl-box"><p class="tl-empty">تعذّر تحميل أداة الخرائط المفاهيمية. حدّث الصفحة وحاول مجدداً.</p></div>';
  };
  REFRESH.maps = function () { if (window.CM && CM.ui && CM.ui.refresh) CM.ui.refresh(); };

  /* ==========================================================================
     1) أداة إنشاء جدول دراسي أسبوعي
     ========================================================================== */
  var DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var IMP = { high: 'مرتفعة', mid: 'متوسطة', low: 'منخفضة' };
  var IMPW = { high: 3, mid: 2, low: 1 };
  var SK = 'tl_sched_v1';

  function tMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return NaN; var h = +m[1], mi = +m[2]; if (h > 24 || mi > 59 || (h === 24 && mi)) return NaN; return h * 60 + mi; }
  function tStr(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function durTxt(m) { var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' س' : '') + (h && r ? ' و ' : '') + (r || !h ? r + ' د' : ''); }

  function defSched() {
    var d = {}, i;
    for (i = 0; i < 7; i++) d[i] = { on: i <= 4, from: '16:00', to: '20:00' };
    return { name: '', subjects: [{ id: uid(), name: '', imp: 'mid', hours: '3', count: '' }], days: d, set: { sessionMin: '50', breakMin: '10', maxDay: '6', reviewOn: false, reviewMin: '60' }, sessions: [] };
  }
  var sch = (function () {
    var s = lsGet(SK, null), base = defSched();
    if (!s || typeof s !== 'object') s = { work: base, saved: [], curId: null };
    if (!s.work || !s.work.days || !s.work.set || !Array.isArray(s.work.subjects) || !Array.isArray(s.work.sessions)) s.work = base;
    if (!Array.isArray(s.saved)) s.saved = [];
    return s;
  })();
  function schPersist() {
    if (sch.curId) {
      var e = sch.saved.filter(function (x) { return x.id === sch.curId; })[0];
      if (e) { e.data = clone(sch.work); e.updated = Date.now(); if (sch.work.name && sch.work.name.trim()) e.name = sch.work.name.trim(); }
      else sch.curId = null;
    }
    return lsSet(SK, sch);
  }

  /* ----- الخوارزمية (JavaScript عادية بلا ذكاء اصطناعي) ----- */
  function schGenerate(w) {
    var err = [], warn = [], i, subs = [];
    var set = { sessionMin: num(w.set.sessionMin), breakMin: num(w.set.breakMin), maxDay: num(w.set.maxDay), reviewMin: num(w.set.reviewMin) };
    if (!(set.sessionMin >= 15 && set.sessionMin <= 240)) err.push('مدة الحصة يجب أن تكون بين 15 و240 دقيقة.');
    if (!(set.breakMin >= 0 && set.breakMin <= 60)) err.push('مدة الراحة يجب أن تكون بين 0 و60 دقيقة.');
    if (!(set.maxDay >= 1 && set.maxDay <= 16)) err.push('الحد الأقصى للدراسة يومياً يجب أن يكون بين 1 و16 ساعة.');
    if (w.set.reviewOn && !(set.reviewMin >= 15 && set.reviewMin <= 240)) err.push('مدة المراجعة الأسبوعية يجب أن تكون بين 15 و240 دقيقة.');
    w.subjects.forEach(function (s, n) {
      var nm = (s.name || '').trim(); if (!nm) { if (String(s.hours).trim() !== '' || String(s.count).trim() !== '') err.push('المادة رقم ' + (n + 1) + ' بلا اسم.'); return; }
      var h = num(s.hours), c = String(s.count).trim() === '' ? 0 : num(s.count);
      if (!(h > 0 && h <= 60)) { err.push('ساعات «' + nm + '» الأسبوعية غير صحيحة (أدخل رقماً أكبر من 0).'); return; }
      if (isNaN(c) || c < 0 || c !== Math.floor(c) || c > 60) { err.push('عدد حصص «' + nm + '» يجب أن يكون عدداً صحيحاً موجباً أو يُترك فارغاً.'); return; }
      subs.push({ id: s.id, name: nm, w: IMPW[s.imp] || 2, hours: h, count: c });
    });
    if (!subs.length) err.push('أضف مادة واحدة على الأقل مع اسمها وعدد ساعاتها الأسبوعية.');
    var days = [];
    for (i = 0; i < 7; i++) {
      var d = w.days[i]; if (!d || !d.on) continue;
      var f = tMin(d.from), t = tMin(d.to);
      if (isNaN(f) || isNaN(t)) { err.push('أدخل وقت البداية والنهاية ليوم ' + DAYS[i] + '.'); continue; }
      if (t - f < 15) { err.push('وقت النهاية يوم ' + DAYS[i] + ' يجب أن يكون بعد البداية بـ 15 دقيقة على الأقل.'); continue; }
      days.push({ i: i, from: f, to: t });
    }
    if (!days.length && !err.length) err.push('اختر يوماً واحداً على الأقل للدراسة.');
    if (err.length) return { ok: false, errors: err, warns: warn };

    /* 1) تحويل كل مادة إلى حصص (بوحدات 5 دقائق ليبقى مجموع الساعات دقيقاً) */
    var tasks = [];
    subs.forEach(function (s) {
      var units = Math.max(3, Math.round(s.hours * 60 / 5));
      var n = s.count > 0 ? s.count : Math.max(1, Math.round(s.hours * 60 / set.sessionMin));
      var maxN = Math.max(1, Math.floor(units / 3));
      if (n > maxN) { warn.push('خُفّض عدد حصص «' + s.name + '» إلى ' + maxN + ' لأن الحصة لا تقل عن 15 دقيقة.'); n = maxN; }
      var per = Math.floor(units / n), rem = units - per * n;
      s.list = [];
      for (var k = 0; k < n; k++) s.list.push({ sid: s.id, name: s.name, w: s.w, dur: (per + (k < rem ? 1 : 0)) * 5, type: 'study' });
    });
    function orderRounds() { /* الأهمية الأعلى أولاً، وتتوزع حصص المادة على جولات */
      var ss = subs.slice().sort(function (a, b) { return b.w - a.w || b.hours - a.hours; }), out = [], k = 0, more = true;
      while (more) { more = false; ss.forEach(function (s) { if (s.list[k]) { out.push(s.list[k]); more = true; } }); k++; }
      return out;
    }
    function orderLong() { return orderRounds().sort(function (a, b) { return b.dur - a.dur || b.w - a.w; }); }

    var cap = set.maxDay * 60, brk = set.breakMin;
    function attempt(order) {
      var D = days.map(function (d) { return { i: d.i, from: d.from, to: d.to, end: d.from, used: 0, list: [], subj: {} }; });
      var left = [];
      order.forEach(function (t) {
        var c = D.filter(function (d) { var st = d.list.length ? d.end + brk : d.from; return st + t.dur <= d.to && d.used + t.dur <= cap; });
        if (!c.length) { left.push(t); return; }
        c.sort(function (a, b) { return (a.subj[t.sid] || 0) - (b.subj[t.sid] || 0) || a.used - b.used || a.i - b.i; });
        var d = c[0]; d.end = (d.list.length ? d.end + brk : d.from) + t.dur; d.used += t.dur; d.list.push(t); d.subj[t.sid] = (d.subj[t.sid] || 0) + 1;
      });
      return { D: D, left: left, lack: left.reduce(function (a, t) { return a + t.dur; }, 0) };
    }
    var best = attempt(orderRounds());
    if (best.left.length) { var b2 = attempt(orderLong()); if (b2.lack < best.lack) best = b2; }

    /* 2) المراجعة الأسبوعية (إن طُلبت): في اليوم الأكثر فراغاً */
    var rev = null;
    if (!best.left.length && w.set.reviewOn) {
      var cands = best.D.filter(function (d) { var st = d.list.length ? d.end + brk : d.from; return st + set.reviewMin <= d.to && d.used + set.reviewMin <= cap; });
      if (cands.length) {
        cands.sort(function (a, b) { return (b.to - b.end) - (a.to - a.end) || b.i - a.i; });
        var d0 = cands[0]; rev = { sid: 'review', name: 'مراجعة أسبوعية', w: 0, dur: set.reviewMin, type: 'review' }; d0.list.push(rev); d0.used += set.reviewMin; d0.end = (d0.list.length > 1 ? d0.end + brk : d0.from) + set.reviewMin; d0.isRev = true;
      } else { best.left.push({ name: 'مراجعة أسبوعية', dur: set.reviewMin }); best.lack += set.reviewMin; }
    }
    if (best.left.length) {
      var by = {}; best.left.forEach(function (t) { by[t.name] = (by[t.name] || 0) + t.dur; });
      var names = Object.keys(by).map(function (n) { return '«' + n + '» (' + durTxt(by[n]) + ')'; }).join('، ');
      return { ok: false, errors: ['الوقت المتاح لا يكفي لتوزيع كل الساعات المطلوبة، لذلك لم يُنشأ الجدول. ينقصك نحو ' + durTxt(best.lack) + ' (المواد المتأثرة: ' + names + '). زد وقت الفراغ أو أضف أياماً أو قلّل الساعات أو مدة الراحة أو ارفع الحد الأقصى اليومي.'], warns: warn };
    }

    /* 3) ترتيب كل يوم بحسب الأهمية ثم احتساب التوقيت مع الراحة */
    var out = [];
    best.D.forEach(function (d) {
      d.list.sort(function (a, b) { if (a.type === 'review' || b.type === 'review') return a.type === 'review' ? 1 : -1; return b.w - a.w || (a.name < b.name ? -1 : 1); });
      var cur = d.from;
      d.list.forEach(function (t, n) {
        if (n) cur += brk;
        out.push({ id: uid(), day: d.i, start: cur, dur: t.dur, name: t.name, type: t.type, done: false });
        cur += t.dur;
      });
    });
    subs.forEach(function (s) {
      var ds = {}; out.forEach(function (x) { if (x.name === s.name && x.type === 'study') ds[x.day] = 1; });
      if (s.list.length > 1 && Object.keys(ds).length === 1 && days.length > 1) warn.push('حصص «' + s.name + '» وقعت كلها في يوم واحد لضيق الأوقات المتاحة.');
    });
    return { ok: true, sessions: out, warns: warn };
  }

  /* ----- واجهة أداة الجدول ----- */
  var schEl;
  function schFormHtml() {
    var w = sch.work, h = '';
    h += '<div class="tl-box"><h3>اسم الجدول</h3><input class="tl-in" id="schName" maxlength="60" placeholder="مثال: جدول الأسبوع الأول" value="' + esc(w.name) + '"><div class="tl-btns"><button type="button" class="tl-btn" id="schNew">' + I.plus + '<span>جدول جديد</span></button></div></div>';
    h += '<div class="tl-box"><h3>المواد الدراسية</h3><div id="schSubs">';
    w.subjects.forEach(function (s) { h += schSubHtml(s); });
    h += '</div><button type="button" class="tl-btn pri block" id="schAddSub">' + I.plus + '<span>إضافة مادة</span></button><p class="tl-hint">عدد الحصص اختياري: إن تركته فارغاً تُحسب الحصص من الساعات ÷ مدة الحصة. وإن حدّدته فتُقسَّم ساعات المادة على هذا العدد.</p></div>';
    h += '<div class="tl-box"><h3>أيام الدراسة وأوقات الفراغ</h3><p class="tl-hint" style="margin:-4px 0 10px">فعّل الأيام التي تدرس فيها وحدّد لكل يوم وقت بدايته ونهايته (تستطيع اختيار أوقات مختلفة لكل يوم).</p><div id="schDays">';
    for (var i = 0; i < 7; i++) h += schDayHtml(i);
    h += '</div><div class="tl-btns"><button type="button" class="tl-btn sm" id="schAllDays">كل الأيام</button><button type="button" class="tl-btn sm" id="schNoDays">مسح الاختيار</button></div></div>';
    var s = w.set;
    h += '<div class="tl-box"><h3>إعدادات الجدول</h3><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="schS1">مدة الحصة (دقيقة)</label><input class="tl-in num" id="schS1" data-s="sessionMin" inputmode="numeric" value="' + esc(s.sessionMin) + '"></div><div class="tl-fld"><label class="tl-lbl" for="schS2">الراحة بين الحصص (دقيقة)</label><input class="tl-in num" id="schS2" data-s="breakMin" inputmode="numeric" value="' + esc(s.breakMin) + '"></div><div class="tl-fld"><label class="tl-lbl" for="schS3">أقصى دراسة يومياً (ساعة)</label><input class="tl-in num" id="schS3" data-s="maxDay" inputmode="decimal" value="' + esc(s.maxDay) + '"></div></div>';
    h += '<div class="tl-row" style="margin-top:10px"><label class="tl-sound"><input type="checkbox" class="tl-chk" id="schRevOn"' + (s.reviewOn ? ' checked' : '') + '><span>تخصيص وقت للمراجعة الأسبوعية</span></label><div class="tl-fld" style="max-width:170px"><input class="tl-in num" id="schRevMin" data-s="reviewMin" inputmode="numeric" aria-label="مدة المراجعة بالدقائق" value="' + esc(s.reviewMin) + '"' + (s.reviewOn ? '' : ' disabled') + '></div><span class="tl-hint" style="margin:0">دقيقة</span></div></div>';
    return h;
  }
  function schSubHtml(s) {
    var o = '';
    ['high', 'mid', 'low'].forEach(function (k) { o += '<option value="' + k + '"' + (s.imp === k ? ' selected' : '') + '>' + IMP[k] + '</option>'; });
    return '<div class="tl-item" data-id="' + esc(s.id) + '"><div class="tl-row"><input class="tl-in tl-grow" data-f="name" maxlength="60" placeholder="اسم المادة" aria-label="اسم المادة" value="' + esc(s.name) + '"><button type="button" class="tl-x" data-del="1" aria-label="حذف المادة">' + I.trash + '</button></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl">الأهمية</label><select class="tl-sel" data-f="imp">' + o + '</select></div><div class="tl-fld"><label class="tl-lbl">ساعات أسبوعياً</label><input class="tl-in num" data-f="hours" inputmode="decimal" value="' + esc(s.hours) + '"></div><div class="tl-fld"><label class="tl-lbl">عدد الحصص (اختياري)</label><input class="tl-in num" data-f="count" inputmode="numeric" placeholder="تلقائي" value="' + esc(s.count) + '"></div></div></div>';
  }
  function schDayHtml(i) {
    var d = sch.work.days[i];
    return '<div class="tl-sw' + (d.on ? '' : ' off') + '" data-d="' + i + '"><label class="tl-dn"><input type="checkbox" class="tl-chk" data-f="on"' + (d.on ? ' checked' : '') + '><span>' + DAYS[i] + '</span></label><input type="time" class="tl-in" data-f="from" aria-label="من - ' + DAYS[i] + '" value="' + esc(d.from) + '"' + (d.on ? '' : ' disabled') + '><span class="tl-hint" style="margin:0">إلى</span><input type="time" class="tl-in" data-f="to" aria-label="إلى - ' + DAYS[i] + '" value="' + esc(d.to) + '"' + (d.on ? '' : ' disabled') + '></div>';
  }
  function schMsg(kind, arr) {
    var m = $('#schMsg', schEl); if (!m) return;
    if (!arr || !arr.length) { m.innerHTML = ''; return; }
    m.innerHTML = arr.map(function (t) { return '<div class="tl-msg ' + kind + '" role="alert">' + esc(t) + '</div>'; }).join('');
  }
  function cntTxt(n) { return n === 1 ? 'حصة واحدة' : n === 2 ? 'حصتان' : n <= 10 ? n + ' حصص' : n + ' حصة'; }
  function schStats() {
    var S = sch.work.sessions, done = S.filter(function (x) { return x.done; }).length, tot = S.length;
    return { tot: tot, done: done, left: tot - done, pct: tot ? Math.round(done * 100 / tot) : 0, min: S.reduce(function (a, x) { return a + x.dur; }, 0) };
  }
  function schSorted() { return sch.work.sessions.slice().sort(function (a, b) { return a.day - b.day || a.start - b.start; }); }
  function schResultHtml() {
    var w = sch.work, S = schSorted();
    if (!S.length) return '<div class="tl-box"><h3>الجدول الأسبوعي</h3><p class="tl-empty">لم يُنشأ جدول بعد. أدخل موادك وأوقاتك ثم اضغط «إنشاء الجدول»، أو أضف حصصاً يدوياً.</p><div class="tl-btns"><button type="button" class="tl-btn" id="schAddSes">' + I.plus + '<span>إضافة حصة</span></button></div></div>';
    var st = schStats(), h = '<div class="tl-box" id="schRes"><h3>الجدول الأسبوعي' + (w.name ? ' — ' + esc(w.name) : '') + '</h3>';
    h += '<div class="tl-stats"><div class="tl-stat ok"><b>' + st.done + '</b><small>حصص مكتملة</small></div><div class="tl-stat"><b>' + st.left + '</b><small>حصص متبقية</small></div><div class="tl-stat gold"><b>' + st.pct + '%</b><small>نسبة الإنجاز</small></div></div>';
    h += '<div class="tl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '"><i style="width:' + st.pct + '%"></i></div><p class="tl-hint">إجمالي الدراسة في الأسبوع: ' + durTxt(st.min) + ' في ' + st.tot + ' حصة.</p>';
    h += '<div class="tl-btns"><button type="button" class="tl-btn pri" id="schRegen">' + I.refresh + '<span>إعادة توزيع الجدول</span></button><button type="button" class="tl-btn" id="schAddSes">' + I.plus + '<span>إضافة حصة</span></button></div>';
    h += '<div style="margin-top:14px">';
    for (var d = 0; d < 7; d++) {
      var L = S.filter(function (x) { return x.day === d; }); if (!L.length) continue;
      var tot = L.reduce(function (a, x) { return a + x.dur; }, 0);
      h += '<div class="tl-day"><h4>' + DAYS[d] + '<small>' + cntTxt(L.length) + ' · ' + durTxt(tot) + '</small></h4>';
      L.forEach(function (x, n) {
        if (n) { var gap = x.start - (L[n - 1].start + L[n - 1].dur); if (gap > 0) h += '<div class="tl-brk">راحة ' + durTxt(gap) + '</div>'; }
        h += '<div class="tl-ses' + (x.done ? ' done' : '') + (x.type === 'review' ? ' rev' : '') + '"><input type="checkbox" class="tl-chk" data-sid="' + esc(x.id) + '" aria-label="تمّت الحصة"' + (x.done ? ' checked' : '') + '><div class="tl-t">' + tStr(x.start) + '–' + tStr(x.start + x.dur) + '</div><div class="tl-n"><b>' + esc(x.name) + '</b><small>' + durTxt(x.dur) + (x.type === 'review' ? ' · مراجعة' : '') + '</small></div><button type="button" class="tl-x" data-edit="' + esc(x.id) + '" aria-label="تعديل الحصة" style="color:var(--text)">' + I.edit + '</button></div>';
      });
      h += '</div>';
    }
    h += '</div><div class="tl-btns"><button type="button" class="tl-btn pri" id="schSave">' + I.save + '<span>حفظ الجدول</span></button><button type="button" class="tl-btn" id="schPrint">' + I.print + '<span>طباعة</span></button><button type="button" class="tl-btn" id="schPdf">' + I.pdf + '<span>تحميل PDF</span></button></div>';
    h += '<p class="tl-hint">«تحميل PDF» يفتح نافذة الطباعة؛ اختر منها «حفظ بصيغة PDF».' + (sch.curId ? ' التغييرات تُحفظ تلقائياً في الجدول المفتوح.' : ' تُحفظ تغييراتك تلقائياً على جهازك، واضغط «حفظ الجدول» لإضافته إلى قائمة جداولك.') + '</p></div>';
    return h;
  }
  function schSavedHtml() {
    if (!sch.saved.length) return '';
    var h = '<div class="tl-box"><h3>جداولي المحفوظة</h3>';
    sch.saved.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (e) {
      var S = e.data.sessions || [], dn = S.filter(function (x) { return x.done; }).length;
      h += '<div class="tl-saved" data-sv="' + esc(e.id) + '"><div class="tl-grow"><b>' + esc(e.name) + (e.id === sch.curId ? ' <small>(مفتوح)</small>' : '') + '</b><small>' + S.length + ' حصة · أُنجز ' + dn + ' · ' + fmtDateTime(e.updated) + '</small></div><button type="button" class="tl-btn sm pri" data-open="1">فتح</button><button type="button" class="tl-x" data-delsv="1" aria-label="حذف الجدول المحفوظ">' + I.trash + '</button></div>';
    });
    return h + '</div>';
  }
  function schRenderResult() {
    $('#schSaved', schEl).innerHTML = schSavedHtml();
    $('#schResult', schEl).innerHTML = schResultHtml();
  }
  function schRenderAll() {
    $('#schForm', schEl).innerHTML = schFormHtml();
    schRenderResult();
  }
  function schDo(regen) {
    var w = sch.work;
    if (regen && w.sessions.length && !confirm('سيُستبدل الجدول الحالي (بما فيه تعديلاتك اليدوية وعلامات الإنجاز) بجدول جديد وفق الإعدادات الحالية. متابعة؟')) return;
    var r = schGenerate(w);
    if (!r.ok) { schMsg('bad', r.errors); schMsg2(r.warns); $('#schMsg', schEl).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    w.sessions = r.sessions; schPersist(); schRenderResult();
    schMsg('ok', ['تم ' + (regen ? 'إعادة توزيع' : 'إنشاء') + ' الجدول: ' + r.sessions.length + ' حصة.']);
    if (r.warns.length) $('#schMsg', schEl).insertAdjacentHTML('beforeend', r.warns.map(function (t) { return '<div class="tl-msg warn" role="alert">' + esc(t) + '</div>'; }).join(''));
    var el = $('#schRes', schEl); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function schMsg2(warns) { if (warns && warns.length) $('#schMsg', schEl).insertAdjacentHTML('beforeend', warns.map(function (t) { return '<div class="tl-msg warn" role="alert">' + esc(t) + '</div>'; }).join('')); }

  function schSessionModal(id) {
    var w = sch.work, x = id ? w.sessions.filter(function (s) { return s.id === id; })[0] : null, isNew = !x;
    if (isNew) {
      var ad = 0, i; for (i = 0; i < 7; i++) if (w.days[i] && w.days[i].on) { ad = i; break; }
      var L = w.sessions.filter(function (s) { return s.day === ad; }), end = L.reduce(function (a, s) { return Math.max(a, s.start + s.dur); }, 0), brk = num(w.set.breakMin) || 0, dm = num(w.set.sessionMin) || 50;
      var st = L.length ? end + brk : (tMin(w.days[ad].from) || 960);
      x = { day: ad, start: Math.min(st, 1440 - dm), dur: dm, name: '' };
    }
    var dopt = ''; for (var d = 0; d < 7; d++) dopt += '<option value="' + d + '"' + (x.day === d ? ' selected' : '') + '>' + DAYS[d] + '</option>';
    openModal('<h3>' + (isNew ? 'إضافة حصة' : 'تعديل الحصة') + '</h3><label class="tl-lbl" for="smN">اسم المادة</label><input class="tl-in" id="smN" maxlength="60" value="' + esc(x.name) + '" placeholder="اسم المادة"><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="smD">اليوم</label><select class="tl-sel" id="smD">' + dopt + '</select></div><div class="tl-fld"><label class="tl-lbl" for="smT">وقت البداية</label><input type="time" class="tl-in" id="smT" value="' + tStr(x.start) + '"></div><div class="tl-fld"><label class="tl-lbl" for="smM">المدة (دقيقة)</label><input class="tl-in num" id="smM" inputmode="numeric" value="' + x.dur + '"></div></div><div id="smE"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="smOk">' + I.save + '<span>حفظ</span></button>' + (isNew ? '' : '<button type="button" class="tl-btn del" id="smDel">' + I.trash + '<span>حذف الحصة</span></button>') + '<button type="button" class="tl-btn" id="smNo">إلغاء</button></div>');
    $('#smNo', modal).onclick = closeModal;
    if (!isNew) $('#smDel', modal).onclick = function () { if (!confirm('حذف هذه الحصة؟')) return; w.sessions = w.sessions.filter(function (s) { return s.id !== id; }); schPersist(); closeModal(); schRenderResult(); toast('تم حذف الحصة'); };
    $('#smOk', modal).onclick = function () {
      var nm = $('#smN', modal).value.trim(), dy = +$('#smD', modal).value, st = tMin($('#smT', modal).value), du = num($('#smM', modal).value), e = '';
      if (!nm) e = 'اكتب اسم المادة.'; else if (isNaN(st)) e = 'أدخل وقت بداية صحيحاً.'; else if (!(du >= 5 && du <= 480) || du !== Math.floor(du)) e = 'المدة يجب أن تكون عدداً صحيحاً بين 5 و480 دقيقة.'; else if (st + du > 1440) e = 'الحصة تتجاوز منتصف الليل؛ قلّل المدة أو قدّم وقت البداية.';
      if (!e) { var clash = w.sessions.filter(function (s) { return s.id !== id && s.day === dy && st < s.start + s.dur && s.start < st + du; })[0]; if (clash) e = 'تتداخل مع حصة «' + clash.name + '» (' + tStr(clash.start) + '–' + tStr(clash.start + clash.dur) + ').'; }
      if (e) { $('#smE', modal).innerHTML = '<div class="tl-msg bad" role="alert">' + esc(e) + '</div>'; return; }
      if (isNew) w.sessions.push({ id: uid(), day: dy, start: st, dur: du, name: nm, type: 'study', done: false });
      else { var s0 = w.sessions.filter(function (s) { return s.id === id; })[0]; s0.name = nm; s0.day = dy; s0.start = st; s0.dur = du; }
      schPersist(); closeModal(); schRenderResult(); toast(isNew ? 'تمت إضافة الحصة' : 'تم تعديل الحصة');
    };
  }
  function schPrintHtml() {
    var w = sch.work, S = schSorted(), st = schStats();
    var h = '<h1>' + esc(w.name || 'جدولي الدراسي الأسبوعي') + '</h1><div class="pm">إنجاز: ' + st.done + ' / ' + st.tot + ' حصة (' + st.pct + '%) · إجمالي الدراسة: ' + durTxt(st.min) + '</div>';
    h += '<table><thead><tr><th>اليوم</th><th>التوقيت</th><th>المادة</th><th>المدة</th><th>تمّت</th></tr></thead><tbody>';
    for (var d = 0; d < 7; d++) {
      var L = S.filter(function (x) { return x.day === d; });
      L.forEach(function (x, n) {
        if (n) { var gap = x.start - (L[n - 1].start + L[n - 1].dur); if (gap > 0) h += '<tr class="brk"><td colspan="5">راحة ' + durTxt(gap) + '</td></tr>'; }
        h += '<tr' + (x.done ? ' class="dn"' : '') + '>' + (n ? '' : '<td rowspan="' + (L.length + L.reduce(function (a, y, k) { return a + (k && y.start - (L[k - 1].start + L[k - 1].dur) > 0 ? 1 : 0); }, 0)) + '"><b>' + DAYS[d] + '</b></td>') + '<td dir="ltr" style="text-align:center">' + tStr(x.start) + ' – ' + tStr(x.start + x.dur) + '</td><td>' + esc(x.name) + (x.type === 'review' ? ' (مراجعة)' : '') + '</td><td>' + durTxt(x.dur) + '</td><td style="text-align:center">' + (x.done ? '✓' : '☐') + '</td></tr>';
      });
    }
    return h + '</tbody></table>';
  }
  function schSave() {
    var w = sch.work;
    if (!w.sessions.length) { toast('أنشئ الجدول أولاً'); return; }
    var nm = (w.name || '').trim() || ('جدول ' + fmtDateTime(Date.now()));
    w.name = nm; var inp = $('#schName', schEl); if (inp) inp.value = nm;
    var e = sch.curId ? sch.saved.filter(function (x) { return x.id === sch.curId; })[0] : null;
    if (e) { e.name = nm; e.data = clone(w); e.updated = Date.now(); }
    else { e = { id: uid(), name: nm, data: clone(w), updated: Date.now() }; sch.saved.push(e); sch.curId = e.id; }
    if (!lsSet(SK, sch)) { toast('تعذّر الحفظ: مساحة التخزين ممتلئة'); return; }
    schRenderResult(); toast('تم حفظ الجدول «' + nm + '»');
  }

  INIT.sched = function () {
    var v = views.sched;
    v.innerHTML = topbar('إنشاء جدول دراسي') + '<div class="tl-wrap"><div id="schSaved"></div><div id="schForm"></div><div class="tl-box"><button type="button" class="tl-btn pri block" id="schGen" style="min-height:56px;font-size:17px">' + I.cal + '<span>إنشاء الجدول</span></button><div id="schMsg"></div></div><div id="schResult"></div></div>';
    schEl = v; schRenderAll();

    v.addEventListener('input', function (e) {
      var t = e.target, w = sch.work, row;
      if (t.id === 'schName') { w.name = t.value; schPersist(); return; }
      if (t.dataset.s) { w.set[t.dataset.s] = t.value; schPersist(); return; }
      if ((row = t.closest('.tl-item')) && t.dataset.f) { var s = w.subjects.filter(function (x) { return x.id === row.dataset.id; })[0]; if (s) { s[t.dataset.f] = t.value; schPersist(); } return; }
      if ((row = t.closest('.tl-sw')) && t.dataset.f && t.dataset.f !== 'on') { w.days[row.dataset.d][t.dataset.f] = t.value; schPersist(); }
    });
    v.addEventListener('change', function (e) {
      var t = e.target, w = sch.work, row;
      if (t.id === 'schRevOn') { w.set.reviewOn = t.checked; $('#schRevMin', v).disabled = !t.checked; schPersist(); return; }
      if ((row = t.closest('.tl-item')) && t.dataset.f === 'imp') { var s = w.subjects.filter(function (x) { return x.id === row.dataset.id; })[0]; if (s) { s.imp = t.value; schPersist(); } return; }
      if ((row = t.closest('.tl-sw')) && t.dataset.f === 'on') {
        w.days[row.dataset.d].on = t.checked; row.classList.toggle('off', !t.checked);
        $$('input[type=time]', row).forEach(function (x) { x.disabled = !t.checked; }); schPersist(); return;
      }
      if (t.dataset.sid) {
        var x = w.sessions.filter(function (q) { return q.id === t.dataset.sid; })[0]; if (x) { x.done = t.checked; schPersist(); schRenderResult(); }
      }
    });
    v.addEventListener('click', function (e) {
      var t = e.target, w = sch.work, b;
      if (t.closest('#schAddSub')) { var ns = { id: uid(), name: '', imp: 'mid', hours: '2', count: '' }; w.subjects.push(ns); schPersist(); $('#schSubs', v).insertAdjacentHTML('beforeend', schSubHtml(ns)); var f = $('#schSubs .tl-item:last-child input', v); if (f) f.focus(); return; }
      if ((b = t.closest('[data-del]')) && t.closest('.tl-item')) {
        var id = t.closest('.tl-item').dataset.id;
        if (w.subjects.length === 1 && !w.subjects[0].name.trim()) return;
        w.subjects = w.subjects.filter(function (x) { return x.id !== id; }); t.closest('.tl-item').remove(); schPersist(); return;
      }
      if (t.closest('#schAllDays') || t.closest('#schNoDays')) { var on = !!t.closest('#schAllDays'); for (var i = 0; i < 7; i++) w.days[i].on = on; $('#schDays', v).innerHTML = (function () { var h = ''; for (var k = 0; k < 7; k++) h += schDayHtml(k); return h; })(); schPersist(); return; }
      if (t.closest('#schGen')) { schDo(false); return; }
      if (t.closest('#schRegen')) { schDo(true); return; }
      if (t.closest('#schAddSes')) { schSessionModal(null); return; }
      if ((b = t.closest('[data-edit]'))) { schSessionModal(b.dataset.edit); return; }
      if (t.closest('#schSave')) { schSave(); return; }
      if (t.closest('#schPrint')) { doPrint(schPrintHtml(), false, 'جدول-دراسي'); return; }
      if (t.closest('#schPdf')) { doPrint(schPrintHtml(), true, 'جدول-دراسي'); return; }
      if (t.closest('#schNew')) {
        if (w.sessions.length && !sch.curId && !confirm('لم تحفظ الجدول الحالي. سيُمسح لبدء جدول جديد. متابعة؟')) return;
        sch.work = defSched(); sch.curId = null; schPersist(); schMsg('ok', []); schRenderAll(); toast('جدول جديد'); return;
      }
      var sv = t.closest('[data-sv]');
      if (sv && t.closest('[data-open]')) {
        var e1 = sch.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e1) return;
        sch.work = clone(e1.data); sch.curId = e1.id; lsSet(SK, sch); schMsg('ok', []); schRenderAll(); toast('تم فتح «' + e1.name + '»'); scrollTo(0, 0); return;
      }
      if (sv && t.closest('[data-delsv]')) {
        var e2 = sch.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e2) return;
        if (!confirm('حذف الجدول المحفوظ «' + e2.name + '» نهائياً؟')) return;
        sch.saved = sch.saved.filter(function (x) { return x.id !== e2.id; }); if (sch.curId === e2.id) sch.curId = null; lsSet(SK, sch); schRenderResult(); toast('تم حذف الجدول'); return;
      }
    });
  };
  REFRESH.sched = function () { schRenderResult(); };

  /* ==========================================================================
     2) مؤقت بومودورو
     - الدقة: يعتمد على وقت الانتهاء المطلق (Date.now) لا على إنقاص عدّاد كل ثانية،
       فيبقى صحيحاً عند التنقل بين الصفحات أو تعليق التبويب أو إغلاق الموقع وإعادة فتحه.
     - المحرّك يعمل منذ تحميل الموقع، حتى لو لم تُفتح صفحة الأداة.
     ========================================================================== */
  var PK = 'tl_pomo_v1';
  var PRE = {
    short: { n: 'التركيز القصير', f: 25, b: 5, l: 15, e: 4 },
    mid: { n: 'التركيز المتوسط', f: 45, b: 10, l: 20, e: 3 },
    deep: { n: 'التركيز العميق', f: 60, b: 15, l: 25, e: 2 }
  };
  var pm = (function () {
    var s = lsGet(PK, null);
    if (!s || typeof s !== 'object') s = {};
    s.mode = (PRE[s.mode] || s.mode === 'custom') ? s.mode : 'short';
    var c = s.custom || {}; s.custom = { n: 'مخصص', f: +c.f > 0 ? +c.f : 30, b: +c.b > 0 ? +c.b : 5, l: +c.l > 0 ? +c.l : 15, e: +c.e > 0 ? +c.e : 4 };
    s.sound = s.sound !== false;
    s.phase = (s.phase === 'break' || s.phase === 'long') ? s.phase : 'focus';
    s.done = +s.done >= 0 ? +s.done : 0;
    s.running = !!s.running; s.endAt = +s.endAt || 0; s.remaining = +s.remaining > 0 ? +s.remaining : 0;
    if (!s.days || typeof s.days !== 'object') s.days = {};
    return s;
  })();
  function pmCfg() { return pm.mode === 'custom' ? pm.custom : PRE[pm.mode]; }
  function pmDur(ph) { var c = pmCfg(); return (ph === 'focus' ? c.f : ph === 'break' ? c.b : c.l) * 60000; }
  function pmSave() { lsSet(PK, pm); }
  if (!pm.remaining) pm.remaining = pmDur(pm.phase);
  function dKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pmDay() {
    var k = dKey(); if (!pm.days[k]) {
      pm.days[k] = { s: 0, n: 0, b: 0 };
      var ks = Object.keys(pm.days).sort(); while (ks.length > 60) delete pm.days[ks.shift()];
    }
    return pm.days[k];
  }
  function pmRem() { return pm.running ? Math.max(0, pm.endAt - Date.now()) : pm.remaining; }
  function pmStarted() { return pm.running || pm.remaining < pmDur(pm.phase) || pm.done > 0 || pm.phase !== 'focus'; }

  var pmAC = null;
  function pmAudio() { try { if (!pmAC) { var C = window.AudioContext || window.webkitAudioContext; if (C) pmAC = new C(); } if (pmAC && pmAC.state === 'suspended') pmAC.resume(); } catch (e) {} return pmAC; }
  function pmBeep() {
    var a = pmAudio(); if (!a) return;
    try {
      [0, 0.3, 0.6].forEach(function (t, i) {
        var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
        o.type = 'sine'; o.frequency.value = i === 2 ? 880 : 660;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.28);
      });
    } catch (e) {}
  }
  function pmCredit(ms) { if (ms > 0) pmDay().s += ms; }
  function pmComplete() { /* انتهت المرحلة الحالية طبيعياً */
    var was = pm.phase, d = pmDay(), c = pmCfg();
    if (was === 'focus') { pmCredit(pmDur('focus')); d.n++; pm.done++; pm.phase = pm.done >= c.e ? 'long' : 'break'; }
    else { d.b++; if (was === 'long') pm.done = 0; pm.phase = 'focus'; }
    pm.remaining = pmDur(pm.phase);
    return was;
  }
  function pmTick() {
    if (pm.running && Date.now() >= pm.endAt) {
      var guard = 0, last = null, lastAt = 0;
      while (pm.running && Date.now() >= pm.endAt && guard++ < 400) {
        if (Date.now() - pm.endAt > 6 * 3600000) { pm.running = false; pm.phase = 'focus'; pm.done = 0; pm.remaining = pmDur('focus'); last = null; break; } /* مهجور منذ زمن: لا يُحتسب */
        var fin = pm.endAt; last = pmComplete(); lastAt = fin; pm.endAt = fin + pmDur(pm.phase);
      }
      pmSave();
      if (last && Date.now() - lastAt < 20000) {
        if (pm.sound) pmBeep();
        try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([200, 100, 200]); } catch (e) {}
        toast(last === 'focus' ? (pm.phase === 'long' ? 'أحسنت! حان وقت الاستراحة الطويلة' : 'انتهت جلسة التركيز، خذ استراحة قصيرة') : 'انتهت الراحة، حان وقت التركيز', 4500);
      }
    }
    pmRender();
  }
  var pmTimer = 0;
  function pmLoop() { if (pm.running && !pmTimer) pmTimer = setInterval(pmTick, 250); else if (!pm.running && pmTimer) { clearInterval(pmTimer); pmTimer = 0; } }
  function pmStart() { pmAudio(); pm.running = true; pm.endAt = Date.now() + pm.remaining; pmSave(); pmLoop(); pmRender(); }
  function pmPause() { pm.remaining = pmRem(); pm.running = false; pmSave(); pmLoop(); pmRender(); }
  function pmReset(keepStats) {
    if (pm.phase === 'focus') pmCredit(pmDur('focus') - pmRem());
    pm.running = false; pm.phase = 'focus'; pm.done = 0; pm.remaining = pmDur('focus'); pmSave(); pmLoop(); pmRender();
  }
  function pmSkip() {
    var rem = pmRem();
    if (pm.phase === 'focus') { pmCredit(pmDur('focus') - rem); pm.phase = 'break'; }
    else { if (pm.phase === 'long') pm.done = 0; pm.phase = 'focus'; }
    pm.remaining = pmDur(pm.phase);
    if (pm.running) pm.endAt = Date.now() + pm.remaining;
    pmSave(); pmRender();
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pmTick(); });
  addEventListener('pageshow', pmTick);
  addEventListener('pagehide', pmSave);
  pmLoop(); pmTick();

  var PMC = 2 * Math.PI * 90, pmEl = null, pmLast = {};
  function pmVisible() { return pmEl && !root.hidden && !views.pomo.hidden; }
  function minsTxt(ms) { var m = Math.floor(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' س ' + (m % 60) + ' د' : m + ' د'; }
  function pmSet(id, prop, val) { var k = id + prop; if (pmLast[k] === val) return; pmLast[k] = val; var el = $('#' + id, pmEl); if (el) { if (prop === 'text') el.textContent = val; else if (prop === 'html') el.innerHTML = val; else el[prop] = val; } }
  function pmRender() {
    if (!pmVisible()) return;
    var rem = pmRem(), dur = pmDur(pm.phase), c = pmCfg(), sec = Math.ceil(rem / 1000), d = pmDay();
    pmSet('pmClock', 'text', pad(Math.floor(sec / 60)) + ':' + pad(sec % 60));
    pmSet('pmPhase', 'text', pm.phase === 'focus' ? 'وقت التركيز' : pm.phase === 'break' ? 'راحة قصيرة' : 'استراحة طويلة');
    pmSet('pmInfo', 'text', pm.phase === 'focus' ? 'الجلسة ' + (pm.done + 1) + ' من ' + c.e : (pm.phase === 'long' ? 'أكملت ' + c.e + ' جلسات' : 'بعد ' + pm.done + ' من ' + c.e + ' جلسات'));
    var ring = $('#pmRing', pmEl), cls = 'tl-ring' + (pm.phase === 'break' ? ' brk' : pm.phase === 'long' ? ' lng' : ''); if (ring.className !== cls) ring.className = cls;
    var fg = $('#pmFg', pmEl); fg.style.strokeDasharray = PMC; fg.style.strokeDashoffset = (PMC * (1 - (dur ? rem / dur : 0))).toFixed(2);
    var dots = ''; for (var i = 0; i < c.e; i++) dots += '<i class="' + (i < pm.done ? 'on' : '') + '"></i>'; pmSet('pmDots', 'html', dots);
    var main = pm.running ? 'إيقاف مؤقت' : (pm.remaining < dur ? 'استئناف' : 'بدء المؤقت'); pmSet('pmMainT', 'text', main);
    var live = pm.phase === 'focus' ? Math.max(0, dur - rem) : 0;
    pmSet('pmN', 'text', String(d.n)); pmSet('pmS', 'text', minsTxt(d.s + live)); pmSet('pmB', 'text', String(d.b));
    pmSet('pmSound', 'checked', pm.sound);
    pmSet('pmModeDesc', 'text', c.n + ': ' + c.f + ' دقيقة دراسة، ' + c.b + ' دقائق راحة، وبعد ' + c.e + ' جلسات استراحة طويلة ' + c.l + ' دقيقة.');
    $$('.tl-mode', pmEl).forEach(function (b) { var on = b.dataset.m === pm.mode; if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', on); });
  }
  function pmModes() {
    var h = '';
    var short = { short: 'قصير', mid: 'متوسط', deep: 'عميق' };
    ['short', 'mid', 'deep'].forEach(function (k) { var p = PRE[k]; h += '<button type="button" class="tl-mode" data-m="' + k + '" aria-pressed="false" aria-label="' + p.n + '"><b>' + short[k] + '</b><small>' + p.f + ' / ' + p.b + '</small></button>'; });
    return h + '<button type="button" class="tl-mode" data-m="custom" aria-pressed="false" aria-label="وضع مخصص"><b>مخصص</b><small>بنفسك</small></button>';
  }
  function pmCustomHtml() {
    var c = pm.custom;
    return '<div class="tl-row" style="margin-top:12px"><div class="tl-fld"><label class="tl-lbl" for="pcF">الدراسة (د)</label><input class="tl-in num" id="pcF" inputmode="numeric" value="' + c.f + '"></div><div class="tl-fld"><label class="tl-lbl" for="pcB">الراحة (د)</label><input class="tl-in num" id="pcB" inputmode="numeric" value="' + c.b + '"></div></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="pcL">الاستراحة الطويلة (د)</label><input class="tl-in num" id="pcL" inputmode="numeric" value="' + c.l + '"></div><div class="tl-fld"><label class="tl-lbl" for="pcE">جلسات قبلها</label><input class="tl-in num" id="pcE" inputmode="numeric" value="' + c.e + '"></div></div><div id="pcMsg"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="pcApply">تطبيق المدد</button></div>';
  }
  function pmChangeConfig(apply) { /* apply(): يغيّر الوضع/المدد؛ نؤكد قبل إعادة ضبط مؤقت جارٍ */
    if (pmStarted() && !confirm('هذا التغيير سيعيد ضبط المؤقت الحالي. متابعة؟')) return false;
    if (pm.phase === 'focus') pmCredit(pmDur('focus') - pmRem());
    apply(); pm.running = false; pm.phase = 'focus'; pm.done = 0; pm.remaining = pmDur('focus'); pmSave(); pmLoop(); return true;
  }
  INIT.pomo = function () {
    var v = views.pomo; pmEl = v;
    v.innerHTML = topbar('مؤقت بومودورو') + '<div class="tl-pm-wrap"><div class="tl-box"><h3>اختر الوضع</h3><div class="tl-modes">' + pmModes() + '</div><p class="tl-hint" id="pmModeDesc"></p><div id="pmCustom" hidden>' + pmCustomHtml() + '</div></div>' +
      '<div class="tl-box"><div class="tl-ring" id="pmRing"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="bg" cx="100" cy="100" r="90"/><circle class="fg" id="pmFg" cx="100" cy="100" r="90"/></svg><div class="tl-mid"><div class="tl-phase" id="pmPhase"></div><div class="tl-clock" id="pmClock" role="timer" aria-live="off">00:00</div><div class="tl-hint" id="pmInfo" style="margin:0"></div></div></div><div class="tl-dots" id="pmDots"></div>' +
      '<div class="tl-ctl"><button type="button" class="tl-btn pri main" id="pmMain"><span id="pmMainT">بدء المؤقت</span></button><button type="button" class="tl-btn" id="pmReset">' + I.refresh + '<span>إعادة ضبط</span></button><button type="button" class="tl-btn" id="pmSkip">' + I.chev.replace('m15 18-6-6 6-6', 'm6 17 5-5-5-5M13 17l5-5-5-5') + '<span>تخطي الجلسة</span></button></div>' +
      '<label class="tl-sound" style="margin-top:10px"><input type="checkbox" class="tl-chk" id="pmSound"><span>إشعار صوتي عند انتهاء الجلسة</span></label></div>' +
      '<div class="tl-box"><h3>إحصائيات اليوم</h3><div class="tl-stats"><div class="tl-stat ok"><b id="pmN">0</b><small>جلسات مكتملة</small></div><div class="tl-stat gold"><b id="pmS">0 د</b><small>وقت الدراسة</small></div><div class="tl-stat"><b id="pmB">0</b><small>فترات الراحة</small></div></div><div class="tl-btns"><button type="button" class="tl-btn del sm" id="pmClear">' + I.trash + '<span>تصفير إحصائيات اليوم</span></button></div><p class="tl-hint">يستمر المؤقت في العمل إن انتقلت إلى صفحة أخرى داخل الموقع، وتُحفظ إحصائياتك على جهازك.</p></div></div>';
    $('#pmCustom', v).hidden = pm.mode !== 'custom';
    v.addEventListener('click', function (e) {
      var t = e.target, b;
      if (t.closest('#pmMain')) { if (pm.running) pmPause(); else pmStart(); return; }
      if (t.closest('#pmReset')) { if (pmStarted() && !confirm('إعادة ضبط المؤقت والبدء من جلسة التركيز الأولى؟')) return; pmReset(); return; }
      if (t.closest('#pmSkip')) { pmSkip(); return; }
      if (t.closest('#pmClear')) { if (!confirm('تصفير إحصائيات اليوم (الجلسات ووقت الدراسة والراحة)؟')) return; pm.days[dKey()] = { s: 0, n: 0, b: 0 }; pmSave(); pmRender(); toast('تم التصفير'); return; }
      if ((b = t.closest('.tl-mode'))) {
        var m = b.dataset.m;
        if (m === pm.mode) { $('#pmCustom', v).hidden = m !== 'custom'; return; }
        var okc = pmChangeConfig(function () { pm.mode = m; });
        $('#pmCustom', v).hidden = pm.mode !== 'custom'; if (okc) pmRender();
        return;
      }
      if (t.closest('#pcApply')) {
        var f = num($('#pcF', v).value), br = num($('#pcB', v).value), l = num($('#pcL', v).value), n = num($('#pcE', v).value), er = '';
        function bad(x, lo, hi) { return isNaN(x) || x !== Math.floor(x) || x < lo || x > hi; }
        if (bad(f, 1, 180)) er = 'مدة الدراسة بين 1 و180 دقيقة (عدد صحيح).'; else if (bad(br, 1, 60)) er = 'مدة الراحة بين 1 و60 دقيقة.'; else if (bad(l, 1, 90)) er = 'مدة الاستراحة الطويلة بين 1 و90 دقيقة.'; else if (bad(n, 1, 12)) er = 'عدد الجلسات قبل الاستراحة الطويلة بين 1 و12.';
        $('#pcMsg', v).innerHTML = er ? '<div class="tl-msg bad" role="alert">' + er + '</div>' : '';
        if (er) return;
        if (pmChangeConfig(function () { pm.custom = { n: 'مخصص', f: f, b: br, l: l, e: n }; pm.mode = 'custom'; })) { pmRender(); toast('تم تطبيق المدد المخصصة'); }
      }
    });
    v.addEventListener('change', function (e) {
      if (e.target.id === 'pmSound') { pm.sound = e.target.checked; pmSave(); if (pm.sound) { pmAudio(); pmBeep(); } }
    });
    pmLast = {}; pmRender();
  };
  REFRESH.pomo = function () { pmLast = {}; pmRender(); };

  /* ==========================================================================
     3) حاسبة المعدل الفصلي (سداسي واحد، معدل موزون بالمعاملات)
        المعدل = Σ(علامة × معامل) ÷ Σ المعاملات
     ========================================================================== */
  var GK = 'tl_gpa_v1';
  function defGpa() { return { name: 'السداسي الأول', rows: [{ id: uid(), name: '', mark: '', coef: '' }] }; }
  var gp = (function () {
    var s = lsGet(GK, null);
    if (!s || typeof s !== 'object') s = { work: defGpa(), saved: [], curId: null };
    if (!s.work || !Array.isArray(s.work.rows) || !s.work.rows.length) s.work = defGpa();
    if (!Array.isArray(s.saved)) s.saved = [];
    return s;
  })();
  function gpPersist() {
    if (gp.curId) {
      var e = gp.saved.filter(function (x) { return x.id === gp.curId; })[0];
      if (e) { e.data = clone(gp.work); e.updated = Date.now(); if (gp.work.name.trim()) e.name = gp.work.name.trim(); }
      else gp.curId = null;
    }
    return lsSet(GK, gp);
  }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function gpCalc(rows) {
    var out = { items: {}, nErr: 0, valid: [], sum: 0, coefs: 0, avg: null };
    rows.forEach(function (r) {
      var mS = String(r.mark).trim(), cS = String(r.coef).trim();
      if (mS === '' && cS === '') return; /* صف فارغ: يُتجاهل */
      var m = num(mS), c = num(cS), er = {};
      if (mS === '') er.mark = 'أدخل علامة المقياس.'; else if (isNaN(m)) er.mark = 'العلامة يجب أن تكون رقماً (مثل 12.5).'; else if (m < 0 || m > 20) er.mark = 'العلامة يجب أن تكون بين 0 و20.';
      if (cS === '') er.coef = 'أدخل معامل المقياس.'; else if (isNaN(c)) er.coef = 'المعامل يجب أن يكون رقماً.'; else if (c <= 0) er.coef = 'المعامل يجب أن يكون أكبر من الصفر.';
      if (er.mark || er.coef) { out.items[r.id] = er; out.nErr++; }
      else { out.valid.push({ r: r, m: m, c: c }); out.sum += m * c; out.coefs += c; }
    });
    if (out.valid.length && !out.nErr) out.avg = out.sum / out.coefs;
    return out;
  }
  function trimNum(x) { return String(parseFloat(x.toFixed(2))); }
  var gpEl;
  function gpRowHtml(r) {
    return '<div class="tl-item" data-id="' + esc(r.id) + '"><div class="tl-row"><input class="tl-in tl-grow" data-f="name" maxlength="60" placeholder="اسم المقياس" aria-label="اسم المقياس" value="' + esc(r.name) + '"><button type="button" class="tl-x" data-del="1" aria-label="حذف المقياس">' + I.trash + '</button></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl">العلامة (من 20)</label><input class="tl-in num" data-f="mark" inputmode="decimal" placeholder="مثال: 12.5" value="' + esc(r.mark) + '"></div><div class="tl-fld"><label class="tl-lbl">المعامل</label><input class="tl-in num" data-f="coef" inputmode="decimal" placeholder="مثال: 2" value="' + esc(r.coef) + '"></div></div><div class="tl-err" data-e></div></div>';
  }
  function gpResultHtml(c) {
    if (c.nErr) return '<div class="tl-msg bad" role="alert">يوجد ' + c.nErr + ' ' + (c.nErr === 1 ? 'مقياس ببيانات غير صحيحة' : 'مقاييس ببيانات غير صحيحة') + '. صحّحها (المعلّمة بالأحمر) ليظهر المعدل.</div>';
    if (c.avg === null) return '<p class="tl-empty">أدخل علامة ومعامل مقياس واحد على الأقل ليظهر المعدل الفصلي هنا تلقائياً.</p>';
    var a = r2(c.avg), ok = a >= 10;
    return '<div style="text-align:center;margin-bottom:12px"><div class="tl-hint" style="margin:0">المعدل الفصلي</div><div class="tl-clock" style="font-size:clamp(44px,13vw,60px);color:' + (ok ? 'var(--tl-ok)' : 'var(--tl-bad)') + '">' + a.toFixed(2) + '<small style="font-size:.4em;color:var(--muted);font-weight:400"> / 20</small></div><span class="tl-tag ' + (ok ? 'ok' : 'bad') + '" style="font-size:15px;padding:2px 18px">' + (ok ? 'ناجح' : 'راسب') + '</span></div>' +
      '<div class="tl-stats"><div class="tl-stat gold"><b>' + trimNum(c.coefs) + '</b><small>مجموع المعاملات</small></div><div class="tl-stat"><b>' + c.valid.length + '</b><small>عدد المقاييس</small></div><div class="tl-stat"><b>' + trimNum(c.sum) + '</b><small>مجموع النقاط الموزونة</small></div></div><p class="tl-hint">المعدل = مجموع (العلامة × المعامل) ÷ مجموع المعاملات. النجاح عند معدل 10/20 فأكثر.</p>';
  }
  function gpUpdate() { /* يحدّث النتيجة وأخطاء الصفوف دون إعادة بناء الحقول (للحفاظ على المؤشر) */
    var c = gpCalc(gp.work.rows);
    $$('.tl-item', gpEl).forEach(function (el) {
      var er = c.items[el.dataset.id] || {}, box = $('[data-e]', el);
      box.innerHTML = [er.mark, er.coef].filter(Boolean).map(esc).join('<br>');
      var im = $('[data-f=mark]', el), ic2 = $('[data-f=coef]', el); im.classList.toggle('bad', !!er.mark); ic2.classList.toggle('bad', !!er.coef);
    });
    $('#gpRes', gpEl).innerHTML = gpResultHtml(c);
    return c;
  }
  function gpSavedHtml() {
    if (!gp.saved.length) return '';
    var h = '<div class="tl-box"><h3>كشوف النقاط المحفوظة</h3>';
    gp.saved.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (e) {
      var c = gpCalc(e.data.rows), a = c.avg === null ? '—' : r2(c.avg).toFixed(2);
      h += '<div class="tl-saved" data-sv="' + esc(e.id) + '"><div class="tl-grow"><b>' + esc(e.name) + (e.id === gp.curId ? ' <small>(مفتوح للتعديل)</small>' : '') + '</b><small>المعدل ' + a + ' · ' + c.valid.length + ' مقياس · ' + fmtDateTime(e.updated) + '</small></div><button type="button" class="tl-btn sm pri" data-open="1">فتح / تعديل</button><button type="button" class="tl-x" data-delsv="1" aria-label="حذف الكشف المحفوظ">' + I.trash + '</button></div>';
    });
    return h + '</div>';
  }
  function gpRenderAll() {
    var w = gp.work;
    $('#gpForm', gpEl).innerHTML = '<div class="tl-box"><h3>السداسي</h3><input class="tl-in" id="gpName" maxlength="60" placeholder="مثال: السداسي الأول" aria-label="اسم السداسي" value="' + esc(w.name) + '"></div><div class="tl-box"><h3>المقاييس</h3><div id="gpRows">' + w.rows.map(gpRowHtml).join('') + '</div><button type="button" class="tl-btn pri block" id="gpAdd">' + I.plus + '<span>إضافة مقياس</span></button></div>';
    $('#gpSaved', gpEl).innerHTML = gpSavedHtml();
    gpUpdate();
  }
  function gpPrintHtml(c) {
    var w = gp.work, h = '<h1>كشف نقاط — ' + esc(w.name || 'السداسي') + '</h1><div class="pm">' + fmtDateTime(Date.now()) + '</div><table><thead><tr><th>#</th><th>المقياس</th><th>العلامة /20</th><th>المعامل</th><th>النقاط الموزونة</th></tr></thead><tbody>';
    c.valid.forEach(function (x, i) { h += '<tr><td>' + (i + 1) + '</td><td>' + esc(x.r.name || ('مقياس ' + (i + 1))) + '</td><td style="text-align:center">' + trimNum(x.m) + '</td><td style="text-align:center">' + trimNum(x.c) + '</td><td style="text-align:center">' + trimNum(x.m * x.c) + '</td></tr>'; });
    var a = r2(c.avg);
    return h + '<tr><th colspan="3">المجموع</th><th>' + trimNum(c.coefs) + '</th><th>' + trimNum(c.sum) + '</th></tr></tbody></table><div class="big">المعدل الفصلي: ' + a.toFixed(2) + ' / 20 — ' + (a >= 10 ? 'ناجح' : 'راسب') + '</div>';
  }
  function gpGuard() { /* يمنع الحفظ/الطباعة عند وجود أخطاء أو عدم وجود بيانات */
    var c = gpUpdate();
    if (c.nErr) { toast('صحّح البيانات الخاطئة أولاً'); return null; }
    if (c.avg === null) { toast('أدخل مقياساً واحداً على الأقل'); return null; }
    return c;
  }
  INIT.gpa = function () {
    var v = views.gpa; gpEl = v;
    v.innerHTML = topbar('حساب المعدل الفصلي') + '<div class="tl-wrap"><div id="gpSaved"></div><div id="gpForm"></div><div class="tl-box" id="gpResBox"><h3>النتيجة</h3><div id="gpRes"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="gpSave">' + I.save + '<span>حفظ كشف النقاط</span></button><button type="button" class="tl-btn" id="gpPrint">' + I.print + '<span>طباعة</span></button><button type="button" class="tl-btn" id="gpPdf">' + I.pdf + '<span>تحميل PDF</span></button><button type="button" class="tl-btn del" id="gpReset">' + I.refresh + '<span>إعادة ضبط</span></button></div><p class="tl-hint">«تحميل PDF» يفتح نافذة الطباعة؛ اختر منها «حفظ بصيغة PDF».</p></div></div>';
    gpRenderAll();
    v.addEventListener('input', function (e) {
      var t = e.target, row;
      if (t.id === 'gpName') { gp.work.name = t.value; gpPersist(); return; }
      if ((row = t.closest('.tl-item')) && t.dataset.f) {
        var r = gp.work.rows.filter(function (x) { return x.id === row.dataset.id; })[0]; if (!r) return;
        r[t.dataset.f] = t.value; gpPersist(); gpUpdate();
      }
    });
    v.addEventListener('click', function (e) {
      var t = e.target, w = gp.work, c;
      if (t.closest('#gpAdd')) { var nr = { id: uid(), name: '', mark: '', coef: '' }; w.rows.push(nr); gpPersist(); $('#gpRows', v).insertAdjacentHTML('beforeend', gpRowHtml(nr)); var f = $('#gpRows .tl-item:last-child input', v); if (f) f.focus(); return; }
      if (t.closest('[data-del]') && t.closest('.tl-item')) {
        var id = t.closest('.tl-item').dataset.id;
        if (w.rows.length === 1) { w.rows[0].name = ''; w.rows[0].mark = ''; w.rows[0].coef = ''; gpPersist(); gpRenderAll(); return; }
        w.rows = w.rows.filter(function (x) { return x.id !== id; }); t.closest('.tl-item').remove(); gpPersist(); gpUpdate(); return;
      }
      if (t.closest('#gpReset')) {
        if (!confirm('إعادة ضبط الحاسبة ومسح كل المقاييس المُدخلة؟ (الكشوف المحفوظة لا تتأثر)')) return;
        gp.work = defGpa(); gp.curId = null; lsSet(GK, gp); gpRenderAll(); toast('تمت إعادة الضبط'); return;
      }
      if (t.closest('#gpSave')) {
        if (!(c = gpGuard())) return;
        var nm = (w.name || '').trim() || 'كشف نقاط'; w.name = nm; var ni = $('#gpName', v); if (ni) ni.value = nm;
        var e1 = gp.curId ? gp.saved.filter(function (x) { return x.id === gp.curId; })[0] : null;
        if (e1) { e1.name = nm; e1.data = clone(w); e1.updated = Date.now(); }
        else { e1 = { id: uid(), name: nm, data: clone(w), updated: Date.now() }; gp.saved.push(e1); gp.curId = e1.id; }
        if (!lsSet(GK, gp)) { toast('تعذّر الحفظ: مساحة التخزين ممتلئة'); return; }
        $('#gpSaved', v).innerHTML = gpSavedHtml(); toast('تم حفظ كشف النقاط «' + nm + '»'); return;
      }
      if (t.closest('#gpPrint') || t.closest('#gpPdf')) { if ((c = gpGuard())) doPrint(gpPrintHtml(c), !!t.closest('#gpPdf'), 'كشف-نقاط'); return; }
      var sv = t.closest('[data-sv]');
      if (sv && t.closest('[data-open]')) {
        var e2 = gp.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e2) return;
        gp.work = clone(e2.data); gp.curId = e2.id; lsSet(GK, gp); gpRenderAll(); toast('تم فتح «' + e2.name + '» — تعديلاتك تُحفظ فيه تلقائياً'); scrollTo(0, 0); return;
      }
      if (sv && t.closest('[data-delsv]')) {
        var e3 = gp.saved.filter(function (x) { return x.id === sv.dataset.sv; })[0]; if (!e3) return;
        if (!confirm('حذف الكشف المحفوظ «' + e3.name + '» نهائياً؟')) return;
        gp.saved = gp.saved.filter(function (x) { return x.id !== e3.id; }); if (gp.curId === e3.id) gp.curId = null; lsSet(GK, gp); $('#gpSaved', v).innerHTML = gpSavedHtml(); toast('تم حذف الكشف');
      }
    });
  };
  REFRESH.gpa = function () { $('#gpSaved', gpEl).innerHTML = gpSavedHtml(); };

  /* ==========================================================================
     4) قائمة المهام الجامعية
     ========================================================================== */
  var TK = 'tl_todo_v1';
  var CATS = { study: 'دراسة ومراجعة', hw: 'واجبات جامعية', proj: 'بحوث ومشاريع', exam: 'امتحانات', pres: 'عروض تقديمية', other: 'مهام أخرى' };
  var PRI = { high: 'مرتفعة', mid: 'متوسطة', low: 'منخفضة' };
  var SECS = [['all', 'جميع المهام'], ['pending', 'غير المكتملة'], ['done', 'المكتملة'], ['today', 'مهام اليوم'], ['upcoming', 'القادمة'], ['late', 'المتأخرة']];
  var td = (function () {
    var s = lsGet(TK, null);
    if (!s || !Array.isArray(s.tasks)) s = { tasks: [] };
    s.tasks = s.tasks.filter(function (t) { return t && t.id && t.title && /^\d{4}-\d{2}-\d{2}$/.test(t.date || ''); });
    return s;
  })();
  var tdUi = { sec: 'all', q: '', cat: '', pri: '', st: '' }, tdEl = null;
  function tdSave() { return lsSet(TK, td); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dueTs(t) { var p = t.date.split('-'), tm = /^\d{1,2}:\d{2}$/.test(t.time || '') ? t.time.split(':') : null; return new Date(+p[0], +p[1] - 1, +p[2], tm ? +tm[0] : 23, tm ? +tm[1] : 59, tm ? 0 : 59, tm ? 0 : 999).getTime(); }
  function tdState(t, now) { if (t.done) return 'done'; var d = dueTs(t); if (d < now) return 'late'; if (d - now <= 86400000) return 'soon'; return 'ok'; }
  function dayDiff(dateStr) { var p = dateStr.split('-'), a = new Date(+p[0], +p[1] - 1, +p[2]), n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate()); return Math.round((a - n) / 86400000); }
  function relTxt(dateStr) { var k = dayDiff(dateStr); return k === 0 ? 'اليوم' : k === 1 ? 'غداً' : k === -1 ? 'أمس' : k > 1 ? 'بعد ' + k + ' يوماً' : 'قبل ' + (-k) + ' يوماً'; }
  function dateTxt(dateStr) { var p = dateStr.split('-'); try { return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('ar-DZ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return dateStr; } }
  function tdInSec(t, sec, now, today) {
    switch (sec) {
      case 'pending': return !t.done;
      case 'done': return t.done;
      case 'today': return t.date === today;
      case 'upcoming': return !t.done && t.date > today;
      case 'late': return tdState(t, now) === 'late';
      default: return true;
    }
  }
  function tdVisible() {
    var now = Date.now(), today = ymd(new Date()), q = tdUi.q.trim().toLowerCase();
    return td.tasks.filter(function (t) {
      if (!tdInSec(t, tdUi.sec, now, today)) return false;
      if (tdUi.cat && t.cat !== tdUi.cat) return false;
      if (tdUi.pri && t.pri !== tdUi.pri) return false;
      if (tdUi.st === 'pending' && t.done) return false;
      if (tdUi.st === 'done' && !t.done) return false;
      if (q && (t.title + ' ' + (t.desc || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return (a.done - b.done) || (dueTs(a) - dueTs(b)) || (IMPW[b.pri] - IMPW[a.pri]); });
  }
  function tdCardHtml(t, now) {
    var st = tdState(t, now), cls = 'tl-task p-' + t.pri + (t.done ? ' done' : '') + (st === 'late' ? ' late' : '') + (st === 'soon' ? ' soon' : '');
    var h = '<div class="' + cls + '" data-id="' + esc(t.id) + '"><input type="checkbox" class="tl-chk" data-tog="1" aria-label="إكمال المهمة"' + (t.done ? ' checked' : '') + ' style="margin-top:6px"><div class="tl-body"><div class="tl-tt">' + esc(t.title) + '</div>';
    if (t.desc) h += '<div class="tl-td">' + esc(t.desc) + '</div>';
    h += '<div class="tl-meta"><span class="tl-tag gold">' + (CATS[t.cat] || CATS.other) + '</span>';
    h += '<span class="tl-tag ' + (t.pri === 'high' ? 'bad' : t.pri === 'mid' ? 'warn' : 'ok') + '">أولوية ' + PRI[t.pri] + '</span>';
    h += '<span class="tl-tag">' + dateTxt(t.date) + (t.time ? ' · ' + esc(t.time) : '') + (t.done ? '' : ' · ' + relTxt(t.date)) + '</span>';
    if (st === 'late') h += '<span class="tl-tag bad">متأخرة</span>'; else if (st === 'soon') h += '<span class="tl-tag warn">يقترب موعدها</span>'; else if (t.done) h += '<span class="tl-tag ok">مكتملة</span>';
    return h + '</div></div><div class="tl-acts"><button type="button" class="tl-x" data-edit="1" aria-label="تعديل المهمة">' + I.edit + '</button><button type="button" class="tl-x del" data-del="1" aria-label="حذف المهمة">' + I.trash + '</button></div></div>';
  }
  function tdRender() {
    if (!tdEl) return;
    var now = Date.now(), today = ymd(new Date()), T = td.tasks;
    var done = T.filter(function (t) { return t.done; }).length, late = T.filter(function (t) { return tdState(t, now) === 'late'; }).length, tot = T.length, pct = tot ? Math.round(done * 100 / tot) : 0;
    $('#tdStats', tdEl).innerHTML = '<div class="tl-stats s5"><div class="tl-stat"><b>' + tot + '</b><small>إجمالي المهام</small></div><div class="tl-stat ok"><b>' + done + '</b><small>المكتملة</small></div><div class="tl-stat gold"><b>' + (tot - done) + '</b><small>المتبقية</small></div><div class="tl-stat bad"><b>' + late + '</b><small>المتأخرة</small></div><div class="tl-stat gold"><b>' + pct + '%</b><small>نسبة الإنجاز</small></div></div><div class="tl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>';
    var soon = T.filter(function (t) { return tdState(t, now) === 'soon'; }).sort(function (a, b) { return dueTs(a) - dueTs(b); });
    $('#tdAlert', tdEl).innerHTML = (soon.length ? '<div class="tl-msg warn" role="alert">⏰ ' + (soon.length === 1 ? 'مهمة يقترب موعدها خلال 24 ساعة: ' : soon.length + ' مهام يقترب موعدها خلال 24 ساعة: ') + soon.slice(0, 3).map(function (t) { return '«' + esc(t.title) + '»'; }).join('، ') + (soon.length > 3 ? ' …' : '') + '</div>' : '') + (late ? '<div class="tl-msg bad" role="alert">لديك ' + late + (late === 1 ? ' مهمة متأخرة' : ' مهام متأخرة') + '.</div>' : '');
    $('#tdTabs', tdEl).innerHTML = SECS.map(function (s) { var n = T.filter(function (t) { return tdInSec(t, s[0], now, today); }).length; return '<button type="button" class="tl-chip" data-sec="' + s[0] + '" aria-pressed="' + (tdUi.sec === s[0]) + '">' + s[1] + '<i>' + n + '</i></button>'; }).join('');
    var L = tdVisible();
    $('#tdList', tdEl).innerHTML = L.length ? L.map(function (t) { return tdCardHtml(t, now); }).join('') : '<p class="tl-empty">' + (T.length ? 'لا توجد مهام تطابق هذا العرض.' : 'لا توجد مهام بعد. اضغط «إضافة مهمة» لتسجيل أول مهمة جامعية.') + '</p>';
  }
  function tdModal(id) {
    var t = id ? td.tasks.filter(function (x) { return x.id === id; })[0] : null, isNew = !t;
    if (isNew) t = { title: '', desc: '', date: ymd(new Date()), time: '', pri: 'mid', cat: 'study' };
    function opts(o, cur) { return Object.keys(o).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + o[k] + '</option>'; }).join(''); }
    openModal('<h3>' + (isNew ? 'إضافة مهمة' : 'تعديل المهمة') + '</h3><label class="tl-lbl" for="tmT">عنوان المهمة</label><input class="tl-in" id="tmT" maxlength="120" placeholder="مثال: مراجعة محاضرة التشريح" value="' + esc(t.title) + '"><label class="tl-lbl" for="tmD">الوصف (اختياري)</label><textarea class="tl-ta" id="tmD" maxlength="600" placeholder="تفاصيل إضافية">' + esc(t.desc || '') + '</textarea><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="tmDt">تاريخ الإنجاز</label><input type="date" class="tl-in" id="tmDt" value="' + esc(t.date) + '"></div><div class="tl-fld"><label class="tl-lbl" for="tmTm">الوقت (اختياري)</label><input type="time" class="tl-in" id="tmTm" value="' + esc(t.time || '') + '"></div></div><div class="tl-row"><div class="tl-fld"><label class="tl-lbl" for="tmP">الأولوية</label><select class="tl-sel" id="tmP">' + opts(PRI, t.pri) + '</select></div><div class="tl-fld"><label class="tl-lbl" for="tmC">التصنيف</label><select class="tl-sel" id="tmC">' + opts(CATS, t.cat) + '</select></div></div><div id="tmE"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="tmOk">' + I.save + '<span>' + (isNew ? 'إضافة المهمة' : 'حفظ التعديلات') + '</span></button><button type="button" class="tl-btn" id="tmNo">إلغاء</button></div>');
    $('#tmNo', modal).onclick = closeModal;
    $('#tmOk', modal).onclick = function () {
      var ti = $('#tmT', modal).value.trim(), dt = $('#tmDt', modal).value, tm = $('#tmTm', modal).value, e = '';
      if (!ti) e = 'اكتب عنوان المهمة.'; else if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) e = 'اختر تاريخ إنجاز المهمة.';
      if (e) { $('#tmE', modal).innerHTML = '<div class="tl-msg bad" role="alert">' + e + '</div>'; return; }
      var data = { title: ti, desc: $('#tmD', modal).value.trim(), date: dt, time: tm || '', pri: $('#tmP', modal).value, cat: $('#tmC', modal).value };
      if (isNew) { data.id = uid(); data.done = false; data.created = Date.now(); td.tasks.push(data); }
      else for (var k in data) t[k] = data[k];
      if (!tdSave()) { toast('تعذّر الحفظ: مساحة التخزين ممتلئة'); return; }
      closeModal(); tdRender(); toast(isNew ? 'تمت إضافة المهمة' : 'تم حفظ التعديلات');
    };
  }
  function tdPrintHtml() {
    var L = tdVisible(), now = Date.now(), lbl = SECS.filter(function (s) { return s[0] === tdUi.sec; })[0][1];
    var h = '<h1>قائمة المهام الجامعية — ' + lbl + '</h1><div class="pm">' + fmtDateTime(now) + ' · ' + L.length + ' مهمة</div><table><thead><tr><th>تمّت</th><th>المهمة</th><th>التصنيف</th><th>الأولوية</th><th>الموعد</th></tr></thead><tbody>';
    L.forEach(function (t) { h += '<tr' + (t.done ? ' class="dn"' : '') + '><td style="text-align:center">' + (t.done ? '✓' : '☐') + '</td><td>' + esc(t.title) + (t.desc ? '<br><small>' + esc(t.desc) + '</small>' : '') + '</td><td>' + CATS[t.cat] + '</td><td>' + PRI[t.pri] + '</td><td>' + esc(t.date) + (t.time ? ' ' + esc(t.time) : '') + (tdState(t, now) === 'late' ? ' (متأخرة)' : '') + '</td></tr>'; });
    return h + '</tbody></table>';
  }
  INIT.todo = function () {
    var v = views.todo; tdEl = v;
    function o(m) { return Object.keys(m).map(function (k) { return '<option value="' + k + '">' + m[k] + '</option>'; }).join(''); }
    v.innerHTML = topbar('قائمة المهام') + '<div class="tl-wrap"><div class="tl-box"><div id="tdStats"></div><div id="tdAlert"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="tdAdd">' + I.plus + '<span>إضافة مهمة</span></button><button type="button" class="tl-btn" id="tdPrint">' + I.print + '<span>طباعة القائمة</span></button><button type="button" class="tl-btn del" id="tdClear">' + I.trash + '<span>مسح المكتملة</span></button></div></div>' +
      '<div class="tl-box"><div id="tdTabs" class="tl-tabs" role="group" aria-label="أقسام المهام"></div><input class="tl-in" id="tdQ" type="search" placeholder="ابحث عن مهمة بالاسم…" aria-label="بحث"><div class="tl-row" style="margin-top:10px"><div class="tl-fld"><label class="tl-lbl" for="tdFc">التصنيف</label><select class="tl-sel" id="tdFc"><option value="">الكل</option>' + o(CATS) + '</select></div><div class="tl-fld"><label class="tl-lbl" for="tdFp">الأولوية</label><select class="tl-sel" id="tdFp"><option value="">الكل</option>' + o(PRI) + '</select></div><div class="tl-fld"><label class="tl-lbl" for="tdFs">الحالة</label><select class="tl-sel" id="tdFs"><option value="">الكل</option><option value="pending">غير مكتملة</option><option value="done">مكتملة</option></select></div></div></div><div id="tdList"></div></div>';
    tdRender();
    v.addEventListener('input', function (e) { if (e.target.id === 'tdQ') { tdUi.q = e.target.value; tdRender(); } });
    v.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'tdFc') { tdUi.cat = t.value; tdRender(); } else if (t.id === 'tdFp') { tdUi.pri = t.value; tdRender(); } else if (t.id === 'tdFs') { tdUi.st = t.value; tdRender(); }
      else if (t.dataset.tog) {
        var id = t.closest('.tl-task').dataset.id, k = td.tasks.filter(function (x) { return x.id === id; })[0]; if (!k) return;
        k.done = t.checked; k.doneAt = t.checked ? Date.now() : 0; tdSave(); tdRender(); toast(t.checked ? 'أحسنت! تم إنجاز المهمة' : 'أُعيدت المهمة إلى غير المكتملة');
      }
    });
    v.addEventListener('click', function (e) {
      var t = e.target, b;
      if (t.closest('#tdAdd')) { tdModal(null); return; }
      if (t.closest('#tdPrint')) { doPrint(tdPrintHtml(), false, 'قائمة-المهام'); return; }
      if (t.closest('#tdClear')) {
        var n = td.tasks.filter(function (x) { return x.done; }).length;
        if (!n) { toast('لا توجد مهام مكتملة لمسحها'); return; }
        if (!confirm('سيتم حذف ' + n + (n === 1 ? ' مهمة مكتملة' : ' مهام مكتملة') + ' نهائياً. متابعة؟')) return;
        td.tasks = td.tasks.filter(function (x) { return !x.done; }); tdSave(); tdRender(); toast('تم مسح المهام المكتملة'); return;
      }
      if ((b = t.closest('[data-sec]'))) { tdUi.sec = b.dataset.sec; tdRender(); return; }
      var card = t.closest('.tl-task');
      if (card && t.closest('[data-edit]')) { tdModal(card.dataset.id); return; }
      if (card && t.closest('[data-del]')) {
        var k = td.tasks.filter(function (x) { return x.id === card.dataset.id; })[0]; if (!k) return;
        if (!confirm('حذف المهمة «' + k.title + '» نهائياً؟')) return;
        td.tasks = td.tasks.filter(function (x) { return x.id !== k.id; }); tdSave(); tdRender(); toast('تم حذف المهمة');
      }
    });
  };
  REFRESH.todo = function () { tdRender(); };
  setInterval(function () { if (tdEl && !root.hidden && !views.todo.hidden && !mbg.classList.contains('open')) tdRender(); }, 60000);


  /* ==========================================================================
     5) الحاسبات الرياضية والتغذوية — 9 حاسبات تعمل محلياً بـ JavaScript فقط (بلا ذكاء اصطناعي)
        كل حاسبة: مدخلاتها ومعادلتها ونتيجتها المستقلة. النتائج تقديرية وليست تشخيصاً طبياً.
        لا تحفظ شيئاً في التخزين، وكل الأسماء هنا بالبادئة fit/tc فلا تتعارض مع بقية الأدوات.
     ========================================================================== */
  var FI = {
    bmi: ic('<path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>'),
    fat: ic('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
    bmr: ic('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    tdee: ic('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    macro: ic('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'),
    prot: I.dumb,
    carb: ic('<path d="M12 22V8"/><path d="M12 8c-2-1-3-3-3-5 2 0 3 2 3 5z"/><path d="M12 8c2-1 3-3 3-5-2 0-3 2-3 5z"/><path d="M12 14c-2-1-4-1-5-3 2 0 4 1 5 3z"/><path d="M12 14c2-1 4-1 5-3-2 0-4 1-5 3z"/><path d="M12 19c-2-1-4-1-5-3 2 0 4 1 5 3z"/><path d="M12 19c2-1 4-1 5-3-2 0-4 1-5 3z"/>'),
    lipid: ic('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
    kcal: ic('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>')
  };
  function fx(x, d) { return String(parseFloat(Number(x).toFixed(d == null ? 1 : d))); }
  function optLabel(list, v) { var r = list.filter(function (o) { return o[0] === v; })[0]; return r ? r[1] : v; }
  var SEX = [['m', 'ذكر'], ['f', 'أنثى']];
  var F_SEX = { id: 'sex', t: 's', l: 'الجنس', o: SEX };
  var F_AGE = { id: 'age', l: 'العمر', u: 'سنة', min: 10, max: 100, ph: 'مثال: 21' };
  var F_W = { id: 'w', l: 'الوزن', u: 'كغ', min: 20, max: 300, ph: 'مثال: 70' };
  var F_H = { id: 'h', l: 'الطول', u: 'سم', min: 100, max: 250, ph: 'مثال: 175' };
  var ACT = [['1.2', 'قليل النشاط (عمل مكتبي، بلا تمارين)'], ['1.375', 'نشاط خفيف (تمارين 1–3 أيام أسبوعياً)'], ['1.55', 'نشاط متوسط (تمارين 3–5 أيام أسبوعياً)'], ['1.725', 'نشاط مرتفع (تمارين 6–7 أيام أسبوعياً)'], ['1.9', 'نشاط مرتفع جداً (تدريب شاق يومياً أو مرتين في اليوم)']];
  var DISC = 'النتيجة تقديرية للتوجيه العام ولا تُعد تشخيصاً طبياً؛ استشر مختصاً عند الحاجة.';

  function mifflin(sex, w, h, a) { return 10 * w + 6.25 * h - 5 * a + (sex === 'm' ? 5 : -161); }
  function ageNote(a, arr) { if (a < 18) arr.push('المعادلة مبنية على بيانات البالغين، فالنتيجة أقل دقة لمن هم دون 18 سنة.'); }

  var CALCS = [
    { id: 'bmi', ic: FI.bmi, title: 'مؤشر كتلة الجسم (BMI)', desc: 'قيّم علاقة وزنك بطولك واعرف التصنيف حسب منظمة الصحة العالمية.',
      fields: [F_W, F_H],
      how: 'المعادلة (منظمة الصحة العالمية): BMI = الوزن (كغ) ÷ مربع الطول (م²). التصنيف: أقل من 18.5 نحافة، 18.5–24.9 وزن طبيعي، 25–29.9 زيادة وزن، 30 فأكثر سمنة. المؤشر لا يفرّق بين الكتلة العضلية والدهون، فقد يبدو الرياضي ذو العضلات الكبيرة «زائد الوزن» وهو ليس كذلك.',
      calc: function (v) {
        var m = v.h / 100, b = v.w / (m * m), c, t;
        if (b < 16) { c = 'نحافة شديدة'; t = 'bad'; } else if (b < 17) { c = 'نحافة متوسطة'; t = 'warn'; } else if (b < 18.5) { c = 'نحافة خفيفة'; t = 'warn'; }
        else if (b < 25) { c = 'وزن طبيعي'; t = 'ok'; } else if (b < 30) { c = 'زيادة في الوزن'; t = 'warn'; } else if (b < 35) { c = 'سمنة من الدرجة الأولى'; t = 'bad'; } else if (b < 40) { c = 'سمنة من الدرجة الثانية'; t = 'bad'; } else { c = 'سمنة من الدرجة الثالثة'; t = 'bad'; }
        var lo = 18.5 * m * m, hi = 24.9 * m * m, rows = [['الوزن الطبيعي لطولك', fx(lo) + ' – ' + fx(hi) + ' كغ']];
        if (v.w < lo) rows.push(['ينقصك للوصول إلى الحد الأدنى', fx(lo - v.w) + ' كغ']); else if (v.w > hi) rows.push(['الزيادة عن الحد الأعلى', fx(v.w - hi) + ' كغ']);
        return { label: 'مؤشر كتلة الجسم', value: fx(b), unit: 'كغ/م²', tag: c, tt: t, rows: rows, detail: fx(v.w) + ' ÷ (' + fx(m, 2) + ')² = ' + fx(b, 2),
          notes: ['المؤشر مخصص للبالغين؛ وللرياضيين ذوي الكتلة العضلية العالية يُستحسن الاعتماد أيضاً على نسبة الدهون.'] };
      } },
    { id: 'fat', ic: FI.fat, title: 'نسبة الدهون في الجسم', desc: 'قدّر نسبة الدهون المئوية بطريقة البحرية الأمريكية أو بمعادلة BMI.',
      fields: [F_SEX, { id: 'm', t: 's', l: 'طريقة الحساب', o: [['navy', 'قياسات المحيطات (البحرية الأمريكية)'], ['bmi', 'معادلة BMI (ديورنبيرغ)']] },
        { id: 'age', l: 'العمر', u: 'سنة', min: 10, max: 100, ph: 'مثال: 21', show: function (r) { return r.m === 'bmi'; } }, F_W, F_H,
        { id: 'neck', l: 'محيط الرقبة', u: 'سم', min: 20, max: 80, ph: 'مثال: 38', show: function (r) { return r.m === 'navy'; } },
        { id: 'waist', l: 'محيط الخصر (عند السرّة)', u: 'سم', min: 40, max: 200, ph: 'مثال: 82', show: function (r) { return r.m === 'navy'; } },
        { id: 'hip', l: 'محيط الأرداف (أوسع نقطة)', u: 'سم', min: 50, max: 200, ph: 'مثال: 98', show: function (r) { return r.m === 'navy' && r.sex === 'f'; } }],
      how: 'طريقة البحرية الأمريكية (قياسات بالسنتيمتر): للرجال %الدهون = 495 ÷ (1.0324 − 0.19077×log10(الخصر − الرقبة) + 0.15456×log10(الطول)) − 450. للنساء = 495 ÷ (1.29579 − 0.35004×log10(الخصر + الأرداف − الرقبة) + 0.22100×log10(الطول)) − 450. معادلة ديورنبيرغ: %الدهون = 1.20×BMI + 0.23×العمر − 10.8×(1 للذكر، 0 للأنثى) − 5.4. التصنيف حسب مجلس التمارين الأمريكي (ACE). الطريقتان تقديريتان وقد تختلفان عن القياس المخبري.',
      calc: function (v) {
        var bf, f, nt = [], det;
        if (v.m === 'navy') {
          var d = v.sex === 'm' ? v.waist - v.neck : v.waist + v.hip - v.neck;
          if (!(d > 0)) return { err: v.sex === 'm' ? 'محيط الخصر يجب أن يكون أكبر من محيط الرقبة.' : 'مجموع محيطي الخصر والأرداف يجب أن يكون أكبر من محيط الرقبة.' };
          bf = v.sex === 'm' ? 495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(v.h)) - 450 : 495 / (1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(v.h)) - 450;
          det = 'طريقة البحرية الأمريكية (' + (v.sex === 'm' ? 'رجال' : 'نساء') + ')';
        } else {
          var bmi = v.w / Math.pow(v.h / 100, 2); bf = 1.2 * bmi + 0.23 * v.age - 10.8 * (v.sex === 'm' ? 1 : 0) - 5.4;
          det = 'معادلة ديورنبيرغ: 1.20×' + fx(bmi, 2) + ' + 0.23×' + v.age + ' − 10.8×' + (v.sex === 'm' ? 1 : 0) + ' − 5.4'; ageNote(v.age, nt);
        }
        if (!(bf > 0 && bf < 65)) return { err: 'النتيجة (' + fx(bf) + '%) غير منطقية؛ راجع القياسات المُدخلة (الوحدة بالسنتيمتر).' };
        var T = v.sex === 'm' ? [[6, 'دهون أساسية', 'warn'], [14, 'مستوى رياضيين', 'ok'], [18, 'لياقة جيدة', 'ok'], [25, 'متوسط', 'warn'], [999, 'مرتفع (سمنة)', 'bad']] : [[14, 'دهون أساسية', 'warn'], [21, 'مستوى رياضيات', 'ok'], [25, 'لياقة جيدة', 'ok'], [32, 'متوسط', 'warn'], [999, 'مرتفع (سمنة)', 'bad']];
        var c = T.filter(function (x) { return bf < x[0]; })[0], fm = v.w * bf / 100;
        return { label: 'نسبة الدهون', value: fx(bf), unit: '%', tag: c[1], tt: c[2], rows: [['كتلة الدهون', fx(fm) + ' كغ'], ['الكتلة الخالية من الدهون', fx(v.w - fm) + ' كغ'], ['الطريقة المعتمدة', v.m === 'navy' ? 'البحرية الأمريكية' : 'ديورنبيرغ']], detail: det, notes: nt };
      } },
    { id: 'bmr', ic: FI.bmr, title: 'معدل الأيض الأساسي (BMR)', desc: 'السعرات التي يحرقها جسمك في الراحة التامة خلال اليوم.',
      fields: [F_SEX, F_AGE, F_W, F_H],
      how: 'معادلة ميفلين–سانت جور (Mifflin-St Jeor): للرجال BMR = 10×الوزن(كغ) + 6.25×الطول(سم) − 5×العمر + 5. للنساء BMR = 10×الوزن + 6.25×الطول − 5×العمر − 161. النتيجة بالسعرات الحرارية في اليوم (kcal/day)، وهي تُعدّ من أدق المعادلات التقديرية للبالغين.',
      calc: function (v) {
        var b = mifflin(v.sex, v.w, v.h, v.age), nt = []; ageNote(v.age, nt);
        return { label: 'معدل الأيض الأساسي', value: String(Math.round(b)), unit: 'سعرة/يوم', rows: [['في الساعة الواحدة', fx(b / 24, 0) + ' سعرة']],
          detail: '10×' + fx(v.w) + ' + 6.25×' + fx(v.h) + ' − 5×' + v.age + (v.sex === 'm' ? ' + 5' : ' − 161') + ' = ' + fx(b, 1), notes: nt.concat(['هذا ما يحتاجه الجسم للحفاظ على وظائفه الحيوية فقط، ولا يشمل الحركة والتمارين (استعمل حاسبة TDEE لذلك).']) };
      } },
    { id: 'tdee', ic: FI.tdee, title: 'الاحتياج اليومي من السعرات (TDEE)', desc: 'إجمالي ما تحرقه يومياً بحسب مستوى نشاطك البدني.',
      fields: [{ id: 'mode', t: 's', l: 'مصدر BMR', o: [['auto', 'احسب BMR من بياناتي'], ['man', 'لدي قيمة BMR جاهزة']] },
        { id: 'sex', t: 's', l: 'الجنس', o: SEX, show: function (r) { return r.mode === 'auto'; } },
        { id: 'age', l: 'العمر', u: 'سنة', min: 10, max: 100, ph: 'مثال: 21', show: function (r) { return r.mode === 'auto'; } },
        { id: 'w', l: 'الوزن', u: 'كغ', min: 20, max: 300, ph: 'مثال: 70', show: function (r) { return r.mode === 'auto'; } },
        { id: 'h', l: 'الطول', u: 'سم', min: 100, max: 250, ph: 'مثال: 175', show: function (r) { return r.mode === 'auto'; } },
        { id: 'bmr', l: 'معدل الأيض الأساسي BMR', u: 'سعرة/يوم', min: 600, max: 5000, ph: 'مثال: 1700', show: function (r) { return r.mode === 'man'; } },
        { id: 'act', t: 's', l: 'مستوى النشاط البدني', o: ACT, d: '1.55' }],
      how: 'TDEE = BMR × معامل النشاط. المعاملات: 1.2 قليل النشاط، 1.375 خفيف، 1.55 متوسط، 1.725 مرتفع، 1.9 مرتفع جداً. يُحسب BMR بمعادلة ميفلين–سانت جور (أو تدخله بنفسك). النتيجة تقريبية؛ راقب وزنك أسبوعين وعدّل بحسبه.',
      calc: function (v) {
        var b, nt = [], det; if (v.mode === 'auto') { b = mifflin(v.sex, v.w, v.h, v.age); ageNote(v.age, nt); } else b = v.bmr;
        var f = parseFloat(v.act), t = b * f, loss = t - 500, gain = t + 300;
        det = 'BMR (' + Math.round(b) + ') × ' + f + ' = ' + fx(t, 1);
        if (loss < b) nt.push('هدف إنقاص الوزن (' + Math.round(loss) + ') أقل من BMR؛ لا يُنصح بالنزول تحت BMR دون إشراف مختص.');
        return { label: 'الاحتياج اليومي (TDEE)', value: String(Math.round(t)), unit: 'سعرة/يوم', rows: [['معدل الأيض الأساسي BMR', Math.round(b) + ' سعرة'], ['معامل النشاط', String(f)], ['للحفاظ على الوزن', Math.round(t) + ' سعرة'], ['لإنقاص الوزن تدريجياً (−500)', Math.round(loss) + ' سعرة'], ['لزيادة الوزن تدريجياً (+300)', Math.round(gain) + ' سعرة']],
          detail: det, notes: nt.concat(['عجز 500 سعرة يومياً يعادل نحو نصف كيلوغرام أسبوعياً تقريباً، وهو تقدير عام.']) };
      } },
    { id: 'macro', ic: FI.macro, title: 'توزيع المغذيات الكبرى', desc: 'وزّع سعراتك على البروتين والكربوهيدرات والدهون بالغرام.',
      fields: [{ id: 'kcal', l: 'السعرات المستهدفة يومياً', u: 'سعرة', min: 800, max: 8000, ph: 'مثال: 2500' },
        { id: 'pre', t: 's', l: 'نمط جاهز (اختياري)', o: [['', 'نسب مخصصة'], ['30-40-30', 'متوازن: 30 / 40 / 30'], ['25-50-25', 'رياضات التحمل: 25 / 50 / 25'], ['35-40-25', 'بناء العضلات: 35 / 40 / 25'], ['40-30-30', 'تنشيف: 40 / 30 / 30']], fill: true },
        { id: 'p', l: 'نسبة البروتين', u: '%', min: 0, max: 100, ph: '30', reset: true },
        { id: 'c', l: 'نسبة الكربوهيدرات', u: '%', min: 0, max: 100, ph: '40', reset: true },
        { id: 'f', l: 'نسبة الدهون', u: '%', min: 0, max: 100, ph: '30', reset: true }],
      how: 'غرام المغذي = (السعرات × نسبته) ÷ سعراته لكل غرام. معاملات أتواتر (Atwater) المعتمدة: البروتين 4 سعرات/غ، الكربوهيدرات 4 سعرات/غ، الدهون 9 سعرات/غ. يجب أن يكون مجموع النسب الثلاث 100%. النطاقات المقبولة (AMDR): بروتين 10–35%، كربوهيدرات 45–65%، دهون 20–35%.',
      calc: function (v) {
        var s = v.p + v.c + v.f; if (Math.abs(s - 100) > 0.01) return { err: 'مجموع النسب يجب أن يساوي 100% (مجموعها الحالي ' + fx(s, 2) + '%).' };
        var kp = v.kcal * v.p / 100, kc = v.kcal * v.c / 100, kf = v.kcal * v.f / 100, nt = [];
        if (v.f < 20 || v.f > 35) nt.push('نسبة الدهون خارج المدى الموصى به (20–35%).'); if (v.p > 35) nt.push('نسبة البروتين مرتفعة (أعلى من 35%)؛ تأكد أنها تناسب نظامك الرياضي.');
        return { label: 'توزيع السعرات', value: Math.round(v.kcal) + '', unit: 'سعرة/يوم', rows: [['البروتين', fx(kp / 4, 0) + ' غ  (' + Math.round(kp) + ' سعرة · ' + fx(v.p) + '%)'], ['الكربوهيدرات', fx(kc / 4, 0) + ' غ  (' + Math.round(kc) + ' سعرة · ' + fx(v.c) + '%)'], ['الدهون', fx(kf / 9, 0) + ' غ  (' + Math.round(kf) + ' سعرة · ' + fx(v.f) + '%)']],
          detail: 'بروتين ' + fx(kp, 0) + '÷4 ، كربوهيدرات ' + fx(kc, 0) + '÷4 ، دهون ' + fx(kf, 0) + '÷9', notes: nt };
      } },
    { id: 'prot', ic: FI.prot, title: 'الاحتياج اليومي من البروتين', desc: 'كمية البروتين اليومية بالغرام بحسب وزنك ونوع تدريبك وهدفك.',
      fields: [F_W, { id: 'tr', t: 's', l: 'مستوى النشاط / نوع التدريب', o: [['light', 'خفيف أو غير رياضي (0.8–1.0 غ/كغ)'], ['endu', 'تحمّل: جري، سباحة، دراجات (1.2–1.6 غ/كغ)'], ['team', 'رياضات جماعية ومختلطة (1.4–1.8 غ/كغ)'], ['str', 'قوة وبناء عضلي (1.6–2.2 غ/كغ)']], d: 'team' },
        { id: 'g', t: 's', l: 'الهدف الرياضي', o: [['keep', 'الحفاظ على الوزن'], ['gain', 'زيادة الكتلة العضلية'], ['loss', 'خسارة الدهون مع الحفاظ على العضلات']], d: 'keep' }],
      how: 'البروتين (غ/يوم) = الوزن (كغ) × المعدل (غ/كغ). النطاقات من توصيات الكلية الأمريكية للطب الرياضي ومنصّة ISSN 2017: غير رياضي 0.8–1.0، تحمّل 1.2–1.6، رياضات جماعية 1.4–1.8، قوة 1.6–2.2. الهدف يحدد موضع المعدل داخل النطاق: الحفاظ = منتصف النطاق، زيادة العضلات = ثلاثة أرباع النطاق، خسارة الدهون = أعلى النطاق للمحافظة على الكتلة العضلية.',
      calc: function (v) {
        var R = { light: [0.8, 1.0], endu: [1.2, 1.6], team: [1.4, 1.8], str: [1.6, 2.2] }[v.tr], lo = R[0], hi = R[1];
        var k = v.g === 'keep' ? (lo + hi) / 2 : v.g === 'gain' ? lo + 0.75 * (hi - lo) : hi, g = v.w * k;
        return { label: 'البروتين اليومي', value: fx(g, 0), unit: 'غرام/يوم', rows: [['المعدل المعتمد', fx(k, 2) + ' غ/كغ'], ['النطاق المناسب لك', fx(v.w * lo, 0) + ' – ' + fx(v.w * hi, 0) + ' غ'], ['السعرات من البروتين', Math.round(g * 4) + ' سعرة'], ['موزّعة على 4 وجبات', fx(g / 4, 0) + ' غ للوجبة تقريباً']],
          detail: fx(v.w) + ' كغ × ' + fx(k, 2) + ' غ/كغ = ' + fx(g, 1) + ' غ', notes: ['توزيع البروتين على وجبات اليوم أفضل للاستفادة منه. الإفراط الدائم فوق 2.2 غ/كغ غير ضروري.'] };
      } },
    { id: 'carb', ic: FI.carb, title: 'الاحتياج اليومي من الكربوهيدرات', desc: 'كمية الكربوهيدرات اليومية بحسب وزنك ومدة وشدة تدريبك.',
      fields: [F_W, { id: 'ld', t: 's', l: 'حمل التدريب اليومي', o: [['l1', 'خفيف: تمارين خفيفة أو مهارية (3–5 غ/كغ)'], ['l2', 'متوسط: نحو ساعة يومياً (5–7 غ/كغ)'], ['l3', 'مرتفع: 1–3 ساعات يومياً (6–10 غ/كغ)'], ['l4', 'مرتفع جداً: أكثر من 4 ساعات يومياً (8–12 غ/كغ)']], d: 'l2' }],
      how: 'الكربوهيدرات (غ/يوم) = الوزن (كغ) × المعدل (غ/كغ). النطاقات من توصيات الكلية الأمريكية للطب الرياضي والأكاديمية الأمريكية للتغذية (2016) واللجنة الأولمبية الدولية: تمارين خفيفة 3–5، نحو ساعة يومياً 5–7، من 1 إلى 3 ساعات 6–10، أكثر من 4 ساعات 8–12 غ/كغ. يُعتمد منتصف النطاق.',
      calc: function (v) {
        var R = { l1: [3, 5], l2: [5, 7], l3: [6, 10], l4: [8, 12] }[v.ld], k = (R[0] + R[1]) / 2, g = v.w * k;
        return { label: 'الكربوهيدرات اليومية', value: fx(g, 0), unit: 'غرام/يوم', rows: [['المعدل المعتمد', fx(k, 1) + ' غ/كغ'], ['النطاق المناسب لك', fx(v.w * R[0], 0) + ' – ' + fx(v.w * R[1], 0) + ' غ'], ['السعرات من الكربوهيدرات', Math.round(g * 4) + ' سعرة']],
          detail: fx(v.w) + ' كغ × ' + fx(k, 1) + ' غ/كغ = ' + fx(g, 1) + ' غ', notes: ['ارفع الكمية نحو أعلى النطاق في أيام التدريب الشاق أو قبل المنافسات، وخفّضها في أيام الراحة.'] };
      } },
    { id: 'lipid', ic: FI.lipid, title: 'الاحتياج اليومي من الدهون', desc: 'حوّل نسبة الطاقة المخصصة للدهون إلى غرامات يومية.',
      fields: [{ id: 'kcal', l: 'السعرات المستهدفة يومياً', u: 'سعرة', min: 800, max: 8000, ph: 'مثال: 2500' }, { id: 'pc', l: 'نسبة الطاقة من الدهون', u: '%', min: 10, max: 60, ph: 'الموصى به 20–35', d: '25' }],
      how: 'الدهون (غ) = (السعرات × النسبة ÷ 100) ÷ 9، لأن كل غرام دهون يعطي 9 سعرات. النسبة الموصى بها للبالغين 20–35% من الطاقة (AMDR)، ولا يُنصح عادة بأقل من 20% للرياضيين لأهمية الدهون للهرمونات والفيتامينات الذائبة فيها.',
      calc: function (v) {
        var kf = v.kcal * v.pc / 100, g = kf / 9, nt = [];
        if (v.pc < 20) nt.push('النسبة أقل من 20% وهي دون المدى الموصى به.'); else if (v.pc > 35) nt.push('النسبة أعلى من 35% وهي فوق المدى الموصى به.');
        return { label: 'الدهون اليومية', value: fx(g, 0), unit: 'غرام/يوم', rows: [['السعرات من الدهون', Math.round(kf) + ' سعرة'], ['النطاق الموصى به (20–35%)', fx(v.kcal * 0.2 / 9, 0) + ' – ' + fx(v.kcal * 0.35 / 9, 0) + ' غ']],
          detail: '(' + Math.round(v.kcal) + ' × ' + fx(v.pc) + '%) ÷ 9 = ' + fx(g, 1) + ' غ', notes: nt.concat(['يُفضّل أن تأتي معظم الدهون من مصادر غير مشبعة (زيت الزيتون، المكسرات، الأسماك).']) };
      } },
    { id: 'nutr', ic: FI.kcal, title: 'السعرات من المغذيات', desc: 'احسب سعرات وجبتك أو يومك من غرامات البروتين والكربوهيدرات والدهون.',
      fields: [{ id: 'p', l: 'البروتين', u: 'غ', min: 0, max: 2000, ph: 'مثال: 150' }, { id: 'c', l: 'الكربوهيدرات', u: 'غ', min: 0, max: 2000, ph: 'مثال: 300' }, { id: 'f', l: 'الدهون', u: 'غ', min: 0, max: 1000, ph: 'مثال: 70' }],
      how: 'السعرات = (بروتين × 4) + (كربوهيدرات × 4) + (دهون × 9) حسب معاملات أتووتر. تُحسب سعرات كل مغذٍّ على حدة ثم تُجمع، وتظهر نسبة كل مغذٍّ من المجموع.',
      calc: function (v) {
        var a = v.p * 4, b = v.c * 4, c = v.f * 9, t = a + b + c; if (!(t > 0)) return { err: 'أدخل كمية أكبر من صفر في مغذٍّ واحد على الأقل.' };
        function pc(x) { return fx(x * 100 / t, 1) + '%'; }
        return { label: 'مجموع السعرات', value: fx(t, 0), unit: 'سعرة', rows: [['من البروتين', fx(a, 0) + ' سعرة · ' + pc(a)], ['من الكربوهيدرات', fx(b, 0) + ' سعرة · ' + pc(b)], ['من الدهون', fx(c, 0) + ' سعرة · ' + pc(c)]],
          detail: fx(v.p) + '×4 + ' + fx(v.c) + '×4 + ' + fx(v.f) + '×9 = ' + fx(t, 1), notes: ['لا تشمل الحاسبة الكحول (7 سعرات/غ) ولا الألياف.'] };
      } }
  ];
  var FITM = {}; CALCS.forEach(function (c) { FITM[c.id] = c; });
  var fitCur = null, fitEl = null;
  function fid(c, f) { return 'fc_' + c.id + '_' + f.id; }

  function fitListHtml() {
    var h = '<p class="tl-sub">تسع حاسبات علمية لطلبة التربية البدنية والرياضة. اختر الحاسبة، أدخل بياناتك، واحصل على نتيجة فورية بمعادلة معروفة.</p><div class="tc-grid">';
    CALCS.forEach(function (c) { h += '<div class="tc-card"><span class="tl-ic">' + c.ic + '</span><b>' + c.title + '</b><small>' + c.desc + '</small><button type="button" class="tl-btn pri" data-open="' + c.id + '">ابدأ الحساب</button></div>'; });
    return h + '</div><p class="tl-hint" style="text-align:center">' + DISC + '</p>';
  }
  function fitFieldHtml(c, f) {
    var id = fid(c, f), h = '<div class="tl-fld" data-f="' + f.id + '"><label class="tl-lbl" for="' + id + '">' + f.l + (f.u ? ' <span class="tc-u">(' + f.u + ')</span>' : '') + '</label>';
    if (f.t === 's') {
      h += '<select class="tl-sel" id="' + id + '">' + f.o.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === (f.d != null ? f.d : f.o[0][0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
    } else h += '<input class="tl-in num" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="' + esc(f.ph || '') + '" value="' + esc(f.d || '') + '"' + (f.reset ? ' data-preset="1"' : '') + '>';
    return h + '<div class="tl-err" data-e></div></div>';
  }
  function fitRaw(c) { var r = {}; c.fields.forEach(function (f) { var el = $('#' + fid(c, f), fitEl); r[f.id] = el ? el.value : ''; }); return r; }
  function fitVis(c) {
    var r = fitRaw(c);
    c.fields.forEach(function (f) { var w = $('[data-f="' + f.id + '"]', fitEl); if (w) w.hidden = f.show ? !f.show(r) : false; });
  }
  function fitCalcHtml(c) {
    var h = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button><button type="button" class="back tc-back">كل الحاسبات</button></div>';
    h += '<h2 class="ptitle">' + c.title + '</h2><div class="tl-wrap"><div class="tl-box tc-head"><span class="tl-ic">' + c.ic + '</span><p>' + c.desc + '</p></div>';
    h += '<div class="tl-box"><h3>المدخلات</h3><div class="tl-row tc-form" id="tcForm">' + c.fields.map(function (f) { return fitFieldHtml(c, f); }).join('') + '</div><div id="tcMsg" aria-live="polite"></div><div class="tl-btns"><button type="button" class="tl-btn pri" id="tcGo" style="min-height:54px;font-size:17px">' + I.calc + '<span>احسب</span></button><button type="button" class="tl-btn" id="tcReset">' + I.refresh + '<span>إعادة تعيين</span></button></div></div>';
    h += '<div id="tcRes" aria-live="polite"></div><div class="tl-box"><h3>طريقة الحساب</h3><p class="tc-how">' + c.how + '</p></div></div>';
    return h;
  }
  function fitOpen(id) {
    fitCur = id && FITM[id] ? FITM[id] : null;
    var v = views.fit;
    if (!fitCur) v.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><h2 class="ptitle">' + TOOLS.fit.title + '</h2>' + fitListHtml();
    else { v.innerHTML = fitCalcHtml(fitCur); fitVis(fitCur); }
    scrollTo(0, 0);
  }
  function fitMsg(t) { $('#tcMsg', fitEl).innerHTML = t ? '<div class="tl-msg bad" role="alert">' + esc(t) + '</div>' : ''; }
  function fitResHtml(r) {
    var h = '<div class="tl-box tc-res"><h3>النتيجة</h3><div class="tc-main"><small>' + r.label + '</small><b><span dir="ltr">' + r.value + '</span> <i>' + r.unit + '</i></b>' + (r.tag ? '<span class="tl-tag ' + r.tt + '" style="font-size:15px;padding:2px 16px">' + r.tag + '</span>' : '') + '</div><div class="tc-rows">';
    r.rows.forEach(function (x) { h += '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; });
    h += '</div>' + (r.detail ? '<div class="tc-det"><small>تفاصيل الحساب</small><span dir="ltr">' + esc(r.detail) + '</span></div>' : '');
    (r.notes || []).forEach(function (n) { h += '<div class="tl-msg warn" style="color:var(--text)">' + esc(n) + '</div>'; });
    return h + '<p class="tl-hint">' + DISC + '</p></div>';
  }
  function fitRun() {
    var c = fitCur, raw = fitRaw(c), vals = {}, bad = 0;
    fitMsg(''); $('#tcRes', fitEl).innerHTML = '';
    c.fields.forEach(function (f) {
      var w = $('[data-f="' + f.id + '"]', fitEl), el = $('#' + fid(c, f), fitEl), er = $('[data-e]', w), m = '';
      el.classList.remove('bad'); er.textContent = '';
      if (w.hidden) return;
      if (f.t === 's') { vals[f.id] = el.value; return; }
      var s = String(el.value).trim(), n = num(s);
      if (s === '') m = 'هذا الحقل مطلوب.'; else if (isNaN(n)) m = 'أدخل رقماً صحيحاً (مثل 70 أو 70.5).'; else if (n < f.min || n > f.max) m = 'القيمة يجب أن تكون بين ' + f.min + ' و' + f.max + (f.u ? ' ' + f.u : '') + '.';
      if (m) { el.classList.add('bad'); er.textContent = m; bad++; } else vals[f.id] = n;
    });
    if (bad) { fitMsg('يرجى إكمال الحقول المعلّمة بالأحمر وتصحيحها.'); var b0 = $('.tl-in.bad', fitEl); if (b0) b0.focus(); return; }
    var r = c.calc(vals);
    if (r.err) { fitMsg(r.err); return; }
    var box = $('#tcRes', fitEl); box.innerHTML = fitResHtml(r); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function fitReset() {
    var c = fitCur;
    c.fields.forEach(function (f) { var el = $('#' + fid(c, f), fitEl), w = $('[data-f="' + f.id + '"]', fitEl); el.value = f.t === 's' ? (f.d != null ? f.d : f.o[0][0]) : (f.d || ''); el.classList.remove('bad'); $('[data-e]', w).textContent = ''; });
    fitMsg(''); $('#tcRes', fitEl).innerHTML = ''; fitVis(c); var f0 = $('input:not([hidden])', fitEl); if (f0 && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) f0.focus();
  }
  INIT.fit = function () {
    var v = views.fit; fitEl = v; fitOpen(null);
    v.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-open]'))) { fitOpen(b.dataset.open); return; }
      if (t.closest('.tc-back')) { fitOpen(null); return; }
      if (t.closest('#tcGo')) { fitRun(); return; }
      if (t.closest('#tcReset')) { fitReset(); }
    });
    v.addEventListener('change', function (e) {
      var t = e.target; if (!fitCur || t.tagName !== 'SELECT') return;
      var f = fitCur.fields.filter(function (x) { return fid(fitCur, x) === t.id; })[0];
      if (f && f.fill && t.value) { var p = t.value.split('-'); ['p', 'c', 'f'].forEach(function (k, i) { var el = $('#fc_' + fitCur.id + '_' + k, v); if (el) { el.value = p[i]; el.classList.remove('bad'); } }); }
      fitVis(fitCur);
    });
    v.addEventListener('input', function (e) {
      var t = e.target; if (!fitCur || !t.dataset.preset) return;
      var s = $('#fc_' + fitCur.id + '_pre', v); if (s) s.value = '';
    });
    v.addEventListener('keydown', function (e) { if (e.key === 'Enter' && fitCur && e.target.tagName === 'INPUT') { e.preventDefault(); fitRun(); } });
  };
  REFRESH.fit = function () { if (fitCur) fitOpen(null); };

})();
