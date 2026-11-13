/* ==========================================================================
   slides-present.js — وضع تقديم العرض وفاحص جودة العروض (المرحلتان 5 و 6)
   - SLPres: تقديم ملء الشاشة مع انتقالات Fade و Slide و None، تنقل بالأسهم
     والنقر واللمس، رقم الشريحة، ودعم الهاتف والكمبيوتر
   - SLQA: فاحص جودة العروض (نصوص خارجة، تداخل، خروج عن الحدود، نصوص صغيرة،
     شرائح فارغة، صور مفقودة، عناصر مخفية، مشكلات التصدير) دون تعديل تلقائي
   ========================================================================== */
(function (root) {
  'use strict';
  var E = root.SLE, C = root.SLC; if (!E || !C) return;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var I = {
    x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    prev: ic('<path d="m9 18 6-6-6-6"/>'),
    next: ic('<path d="m15 18-6-6 6-6"/>'),
    fs: ic('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>')
  };

  /* ======================================================================
     1) وضع تقديم العرض بملء الشاشة (SLPres)
     ====================================================================== */
  var P = { overlay: null, proj: null, idx: 0, onClose: null, touchX: null, touchY: null };

  function fitPres() {
    if (!P.overlay) return;
    var stage = P.overlay.querySelector('.sl-pres-stage');
    var frame = P.overlay.querySelector('.sl-pres-frame');
    if (!stage || !frame || !P.proj) return;
    var sz = E.size(P.proj.ratio);
    var k = Math.min((stage.clientWidth - 16) / sz.w, (stage.clientHeight - 16) / sz.h);
    if (!isFinite(k) || k <= 0) k = 1;
    frame.style.width = Math.round(sz.w * k) + 'px';
    frame.style.height = Math.round(sz.h * k) + 'px';
    var cv = frame.querySelector('.sl-cv');
    if (cv) cv.style.transform = 'scale(' + k + ')';
  }

  function showSlide(nextIdx, dir) {
    if (!P.proj || !P.proj.slides.length) return;
    nextIdx = Math.max(0, Math.min(P.proj.slides.length - 1, nextIdx));
    var s = P.proj.slides[nextIdx];
    P.idx = nextIdx;
    var sz = E.size(P.proj.ratio);
    var frame = P.overlay.querySelector('.sl-pres-frame');
    var countEl = P.overlay.querySelector('.sl-pres-count');
    var prevBtn = P.overlay.querySelector('[data-pr="prev"]');
    var nextBtn = P.overlay.querySelector('[data-pr="next"]');
    if (countEl) countEl.textContent = (P.idx + 1) + ' / ' + P.proj.slides.length;
    if (prevBtn) prevBtn.disabled = P.idx === 0;
    if (nextBtn) nextBtn.disabled = P.idx === P.proj.slides.length - 1;

    frame.style.background = s.bg || '#FFFFFF';
    frame.style.transition = 'none';
    frame.style.opacity = '1';
    frame.style.transform = 'none';

    var cv = frame.querySelector('.sl-cv');
    cv.style.width = sz.w + 'px';
    cv.style.height = sz.h + 'px';
    C.renderSlide(cv, s);
    fitPres();

    var tr = s.transition || 'none', dur = (s.transDur != null ? s.transDur : 0.4);
    if (tr === 'fade') {
      frame.style.opacity = '0';
      void frame.offsetWidth;
      frame.style.transition = 'opacity ' + dur + 's ease';
      frame.style.opacity = '1';
    } else if (tr === 'slide') {
      frame.style.transform = 'translateX(' + (dir < 0 ? '-6%' : '6%') + ')';
      frame.style.opacity = '0.25';
      void frame.offsetWidth;
      frame.style.transition = 'transform ' + dur + 's cubic-bezier(0.16,1,0.3,1), opacity ' + dur + 's ease';
      frame.style.transform = 'none';
      frame.style.opacity = '1';
    }
  }

  function onPresKey(e) {
    if (!P.overlay) return;
    var k = e.key;
    if (k === 'Escape') { e.preventDefault(); closePres(); }
    else if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); showSlide(P.idx + 1, 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); showSlide(P.idx - 1, -1); }
    else if (k === 'Home') { e.preventDefault(); showSlide(0, -1); }
    else if (k === 'End') { e.preventDefault(); showSlide(P.proj.slides.length - 1, 1); }
  }

  function closePres() {
    if (!P.overlay) return;
    document.removeEventListener('keydown', onPresKey);
    root.removeEventListener('resize', fitPres);
    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen().catch(function () {}); } catch (e) {}
    }
    if (P.overlay.parentNode) P.overlay.parentNode.removeChild(P.overlay);
    P.overlay = null;
    if (typeof P.onClose === 'function') P.onClose(P.idx);
  }

  function openPres(proj, startIdx, onClose) {
    if (!proj || !proj.slides || !proj.slides.length) return;
    closePres();
    P.proj = proj;
    P.idx = Math.max(0, Math.min(proj.slides.length - 1, startIdx || 0));
    P.onClose = onClose;

    var ov = document.createElement('div');
    ov.className = 'sl-pres-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'وضع تقديم العرض');
    ov.innerHTML =
      '<div class="sl-pres-stage">' +
      '<div class="sl-pres-frame"><div class="sl-cv"></div></div>' +
      '</div>' +
      '<div class="sl-pres-bar">' +
      '<button type="button" class="sl-pres-btn" data-pr="prev" aria-label="الشريحة السابقة" title="السابقة">' + I.prev + '</button>' +
      '<span class="sl-pres-count">1 / ' + proj.slides.length + '</span>' +
      '<button type="button" class="sl-pres-btn" data-pr="next" aria-label="الشريحة التالية" title="التالية">' + I.next + '</button>' +
      '<span class="sl-pres-sep"></span>' +
      '<button type="button" class="sl-pres-btn" data-pr="fs" aria-label="ملء الشاشة" title="ملء الشاشة">' + I.fs + '</button>' +
      '<button type="button" class="sl-pres-btn dng" data-pr="exit" aria-label="إنهاء العرض" title="خروج (Esc)">' + I.x + '</button>' +
      '</div>';

    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pr]');
      if (b) {
        var act = b.dataset.pr;
        if (act === 'exit') closePres();
        else if (act === 'prev') showSlide(P.idx - 1, -1);
        else if (act === 'next') showSlide(P.idx + 1, 1);
        else if (act === 'fs') {
          if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
          else if (ov.requestFullscreen) ov.requestFullscreen().catch(function () {});
        }
        return;
      }
      if (e.target.closest('.sl-pres-stage')) showSlide(P.idx + 1, 1);
    });
    ov.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { P.touchX = e.touches[0].clientX; P.touchY = e.touches[0].clientY; }
    }, { passive: true });
    ov.addEventListener('touchend', function (e) {
      if (P.touchX == null || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - P.touchX;
      var dy = e.changedTouches[0].clientY - P.touchY;
      P.touchX = P.touchY = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) showSlide(P.idx + 1, 1); else showSlide(P.idx - 1, -1);
      }
    }, { passive: true });

    document.body.appendChild(ov);
    P.overlay = ov;
    document.addEventListener('keydown', onPresKey);
    root.addEventListener('resize', fitPres);
    showSlide(P.idx, 0);
    if (ov.requestFullscreen) { try { ov.requestFullscreen().catch(function () {}); } catch (e) {} }
  }

  /* ======================================================================
     2) فاحص جودة العروض (SLQA)
     ====================================================================== */
  function colorDist(h1, h2) {
    var m1 = /^#([0-9a-f]{6})$/i.exec(h1 || ''), m2 = /^#([0-9a-f]{6})$/i.exec(h2 || '');
    if (!m1 || !m2) return 999;
    var n1 = parseInt(m1[1], 16), n2 = parseInt(m2[1], 16);
    var dr = (n1 >> 16) - (n2 >> 16), dg = ((n1 >> 8) & 255) - ((n2 >> 8) & 255), db = (n1 & 255) - (n2 & 255);
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  function boxOverlapRatio(a, b) {
    var ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    var inter = ix * iy;
    if (inter <= 0) return 0;
    var minArea = Math.max(1, Math.min(a.w * a.h, b.w * b.h));
    return inter / minArea;
  }

  function analyzeProject(proj) {
    var issues = [];
    if (!proj || !Array.isArray(proj.slides)) return issues;
    var sz = E.size(proj.ratio), slideArea = sz.w * sz.h;

    /* حاوية مؤقتة لقياس تدفق النصوص بدقة */
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);

    proj.slides.forEach(function (s, sIdx) {
      var sNum = sIdx + 1;
      if (!s.items || !s.items.length) {
        issues.push({ level: 'warn', code: 'empty-slide', slideId: s.id, slideNum: sNum, itemId: null, msg: 'الشريحة فارغة ولا تحتوي على أي عناصر.' });
        return;
      }

      var boxes = [];
      s.items.forEach(function (it) {
        var b = E.itemAABB(it);
        boxes.push({ it: it, b: b });

        /* عناصر مخفية أو صغيرة جداً */
        if ((it.op != null && it.op < 0.1) || it.w < 16 || it.h < 16) {
          issues.push({ level: 'warn', code: 'hidden-item', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'عنصر مخفي تقريباً أو أبعاده صغيرة جداً (' + Math.round(it.w) + '×' + Math.round(it.h) + ').' });
        }

        /* خروج عن حدود الشريحة */
        if (b.x < -2 || b.y < -2 || b.x + b.w > sz.w + 2 || b.y + b.h > sz.h + 2) {
          issues.push({ level: 'warn', code: 'out-of-bounds', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'عنصر يتجاوز حدود الشريحة وقد يُقتطع عند التصدير إلى PNG أو PDF.' });
        }

        if (it.type === 'text') {
          if (it.size < 14) {
            issues.push({ level: 'info', code: 'tiny-text', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'حجم الخط صغير جداً (' + it.size + 'px) وقد يصعب قراءته أثناء العرض.' });
          }
          var effBg = (it.bg && it.bg !== 'none' && (it.bgOp == null || it.bgOp > 0.3)) ? it.bg : s.bg;
          if (colorDist(it.color, effBg) < 38) {
            issues.push({ level: 'err', code: 'contrast', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'لون النص قريب جداً من لون الخلفية مما يضعف وضوحه.' });
          }
          if (it.overflow !== 'visible' && it.overflow !== 'shrink') {
            var pad = it.pad != null ? it.pad : 8;
            probe.innerHTML = '<div style="width:' + it.w + 'px;height:' + it.h + 'px;padding:' + pad + 'px;box-sizing:border-box;font-family:' + esc(it.font || 'Alexandria') + ',Tahoma,sans-serif;font-size:' + it.size + 'px;line-height:' + (it.lh || 1.35) + ';font-weight:' + (it.bold ? 700 : 400) + ';white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden">' + esc(it.text) + '</div>';
            var d = probe.firstChild;
            if (d && d.scrollHeight > d.clientHeight + 4) {
              issues.push({ level: 'err', code: 'text-overflow', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'النص أطول من ارتفاع مربع النص؛ وسّع المربع أو فعّل «تصغير الخط تلقائياً».' });
            }
          }
        } else if (it.type === 'image') {
          if (!it.src || it.src.indexOf('data:image') !== 0 && it.src.indexOf('blob:') !== 0 && it.src.indexOf('http') !== 0) {
            issues.push({ level: 'err', code: 'missing-image', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'صورة مفقودة أو غير صالحة.' });
          }
        } else if (it.type === 'table') {
          if ((it.fontSize || 16) < 11) {
            issues.push({ level: 'info', code: 'tiny-text', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'حجم خط الجدول صغير جداً (' + it.fontSize + 'px).' });
          }
          if (it.rot && Math.abs(it.rot) > 1) {
            issues.push({ level: 'info', code: 'export-risk', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'تدوير الجداول قد لا يُدعم بنفس الزاوية عند التصدير إلى PowerPoint.' });
          }
        } else if (it.type === 'chart') {
          var vals = (it.series && it.series[0] && it.series[0].values) || [];
          var sum = vals.reduce(function (a, v) { return a + Math.abs(parseFloat(v) || 0); }, 0);
          if (sum === 0) {
            issues.push({ level: 'warn', code: 'export-risk', slideId: s.id, slideNum: sNum, itemId: it.id, msg: 'المخطط البياني يحتوي على قيم صفرية فقط.' });
          }
        }
      });

      /* اكتشاف التداخل بين العناصر (باستثناء أشكال الخلفية الكبيرة > 75% من الشريحة) */
      for (var i = 0; i < boxes.length; i++) {
        var a = boxes[i];
        if (a.it.type === 'shape' && (a.b.w * a.b.h) > slideArea * 0.7) continue;
        for (var j = i + 1; j < boxes.length; j++) {
          var bb = boxes[j];
          if (bb.it.type === 'shape' && (bb.b.w * bb.b.h) > slideArea * 0.7) continue;
          if (boxOverlapRatio(a.b, bb.b) > 0.25) {
            issues.push({ level: 'warn', code: 'overlap', slideId: s.id, slideNum: sNum, itemId: bb.it.id, msg: 'عنصران متداخلان بشكل ملحوظ في الشريحة، قد يغطي أحدهما الآخر.' });
            break;
          }
        }
      }
    });

    if (probe.parentNode) probe.parentNode.removeChild(probe);
    return issues;
  }

  root.SLPres = { open: openPres, close: closePres };
  root.SLQA = { analyze: analyzeProject };
})(typeof window !== 'undefined' ? window : globalThis);
