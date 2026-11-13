/* ==========================================================================
   ocr.js — أداة «محوّل الصور إلى نصوص (OCR)»
   - معالجة محلية 100% عبر Tesseract.js + WebAssembly + بيانات ara/eng المحلية
   - بدون ذكاء اصطناعي، بدون API مدفوع، بدون خادم خلفي
   - تدعم: رفع وسحب صور متعددة، إعادة الترتيب، التحسين غير المتلف (تدوير/قص/إضاءة/تباين/رمادي/توضيح/تنقية)،
     الاستخراج الدفعي أو الفردي، الإيقاف النظيف، التعديل والدمج، تصدير TXT/DOCX/PDF، الحفظ في IndexedDB، والعمل دون إنترنت.
   ========================================================================== */
(function () {
  'use strict';

  var ST = window.OCRStore;
  var EX = window.OCRExport;

  var LANGS = [
    { id: 'ara', label: 'العربية', short: 'ara' },
    { id: 'eng', label: 'الإنجليزية', short: 'eng' },
    { id: 'ara+eng', label: 'العربية + الإنجليزية', short: 'ara+eng' }
  ];

  var PSMS = [
    { id: '6', label: 'صفحة / فقرة موحّدة (الأدق للكتب)' },
    { id: '3', label: 'تخطيط تلقائي متعدد الأعمدة' }
  ];

  var ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
  var ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
  var MAX_OCR_EDGE = 1850;
  var MAX_OCR_EDGE_MOBILE = 1550;
  var MERGE_DIV_RE = /^---\s*الصفحة\s+\d+(?:\s*:\s*.*?)?\s*---$/m;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid() {
    return 'ocr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function ic(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  var I = {
    upload: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    play: ic('<polygon points="6 3 20 12 6 21 6 3"/>'),
    stop: ic('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
    wand: ic('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/>'),
    refresh: ic('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>'),
    up: ic('<path d="m18 15-6-6-6 6"/>'),
    down: ic('<path d="m6 9 6 6 6-6"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    copy: ic('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    doc: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>'),
    print: ic('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    download: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    offline: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>')
  };

  function defaultPrep() {
    return {
      rot90: 0,
      fineDeg: 0,
      crop: null, /* { x, y, w, h } 0..1 */
      brightness: 0,
      contrast: 0,
      grayscale: false,
      sharpen: false,
      denoise: false
    };
  }

  function hasPrepEdits(p) {
    if (!p) return false;
    return !!(p.rot90 || p.fineDeg || p.crop || p.brightness || p.contrast || p.grayscale || p.sharpen || p.denoise);
  }

  /* ---------- الحالة العامة ---------- */
  var state = {
    root: null,
    items: [],
    lang: 'ara',
    psm: '6',
    activeTab: 'cards', /* cards | merged */
    selectedId: null,
    mergedDirty: false,
    mergedText: '',
    running: false,
    stopRequested: false,
    batchDone: 0,
    batchTotal: 0,
    currentItemId: null,
    currentStage: '',
    currentItemPct: 0,
    offlineStatus: 'checking', /* checking | ready | partial | downloading | error */
    offlineDetail: 'جارٍ فحص الموارد المحلية…',
    activeWorker: null,
    activeWorkerLang: null,
    activeWorkerPsm: null,
    dragIndex: -1
  };

  var toastEl = null;
  var toastTimer = 0;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'tl-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2600);
  }

  var modalBg = null;
  var modalEl = null;
  function ensureModal() {
    if (modalBg) return;
    modalBg = document.createElement('div');
    modalBg.className = 'tl-mbg';
    modalBg.innerHTML = '<div class="tl-modal" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(modalBg);
    modalEl = modalBg.firstChild;
    modalBg.addEventListener('mousedown', function (e) {
      if (e.target === modalBg) closeModal();
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalBg && modalBg.classList.contains('open')) closeModal();
    });
  }

  function openModal(html, extraClass) {
    ensureModal();
    modalEl.className = 'tl-modal' + (extraClass ? ' ' + extraClass : '');
    modalEl.innerHTML = html;
    modalBg.classList.add('open');
  }

  function closeModal() {
    if (!modalBg) return;
    modalBg.classList.remove('open');
    modalEl.innerHTML = '';
    modalEl.className = 'tl-modal';
  }

  /* ---------- معالجة الصور بالـ Canvas (تحسين غير متلف) ---------- */
  function loadImageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('تعذّرت قراءة ملف الصورة'));
      };
      img.src = url;
    });
  }

  function clampByte(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  function isConstrainedDevice() {
    var mem = navigator.deviceMemory;
    var cores = navigator.hardwareConcurrency;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return !!(coarse || (mem && mem <= 4) || (cores && cores <= 4));
  }

  function computeOcrScale(sw, sh) {
    var maxSide = Math.max(sw, sh);
    var minSide = Math.min(sw, sh);
    if (!maxSide || !minSide) return 1;

    var constrained = isConstrainedDevice();
    var capMax = constrained ? MAX_OCR_EDGE_MOBILE : MAX_OCR_EDGE;
    var maxPixels = constrained ? 2800000 : 3800000;
    var scale = 1;

    if (maxSide > capMax) {
      scale = capMax / maxSide;
      /* الحفاظ على وضوح السطور العربية في الصور الطولية أو الشرائط الضيقة */
      if (minSide >= 650 && minSide * scale < 1050) {
        scale = Math.min(1, 1050 / minSide, 2400 / maxSide);
      }
    } else if (maxSide < 780 && minSide < 650) {
      /* تكبير لطيف للقطات الشاشة والقصاصات صغيرة الأبعاد كي لا تتشوه الحروف */
      scale = Math.min(2.0, 1050 / maxSide);
    }

    var scaledPixels = (sw * scale) * (sh * scale);
    if (scaledPixels > maxPixels) {
      scale *= Math.sqrt(maxPixels / scaledPixels);
    }
    return scale;
  }

  function buildBrightnessContrastLut(brightness, contrast) {
    var lut = new Uint8Array(256);
    var bOff = (brightness || 0) * 2.1;
    var cVal = (contrast || 0) * 2.55;
    var cFactor = contrast ? (259 * (cVal + 255)) / (255 * (259 - cVal)) : 1;
    for (var v = 0; v < 256; v++) {
      var val = v + bOff;
      if (contrast) val = cFactor * (val - 128) + 128;
      lut[v] = val < 0 ? 0 : (val > 255 ? 255 : (val + 0.5) | 0);
    }
    return lut;
  }

  function applyConvolution3x3(data, w, h, kernel, divisor, bias) {
    var src = new Uint8ClampedArray(data);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var r = 0, g = 0, b = 0, k = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var idx = ((y + dy) * w + (x + dx)) * 4;
            var wt = kernel[k++];
            r += src[idx] * wt;
            g += src[idx + 1] * wt;
            b += src[idx + 2] * wt;
          }
        }
        var outIdx = (y * w + x) * 4;
        data[outIdx] = clampByte(r / divisor + bias);
        data[outIdx + 1] = clampByte(g / divisor + bias);
        data[outIdx + 2] = clampByte(b / divisor + bias);
      }
    }
  }

  function renderPreprocessedCanvas(img, prep, maxEdge, skipCropBox, forOcr) {
    prep = prep || defaultPrep();
    var sw = img.naturalWidth || img.width;
    var sh = img.naturalHeight || img.height;
    var rot90 = ((prep.rot90 || 0) % 360 + 360) % 360;
    var scale = 1;

    if (forOcr && !maxEdge) {
      if (!skipCropBox && prep.crop && prep.crop.w > 0.02 && prep.crop.h > 0.02) {
        var effW = (rot90 === 90 || rot90 === 270) ? sh : sw;
        var effH = (rot90 === 90 || rot90 === 270) ? sw : sh;
        var cropW = Math.max(16, effW * prep.crop.w);
        var cropH = Math.max(16, effH * prep.crop.h);
        scale = Math.min(2.0, computeOcrScale(cropW, cropH));
        var prePixels = (sw * scale) * (sh * scale);
        if (prePixels > 12000000) scale *= Math.sqrt(12000000 / prePixels);
      } else {
        scale = computeOcrScale(sw, sh);
      }
    } else {
      var cap = maxEdge || MAX_OCR_EDGE;
      if (Math.max(sw, sh) > cap) scale = cap / Math.max(sw, sh);
    }

    var rw = Math.max(1, Math.round(sw * scale));
    var rh = Math.max(1, Math.round(sh * scale));

    var angleRad = (((prep.rot90 || 0) + (prep.fineDeg || 0)) * Math.PI) / 180;
    var absCos = Math.abs(Math.cos(angleRad));
    var absSin = Math.abs(Math.sin(angleRad));
    var rotW = Math.max(1, Math.round(rw * absCos + rh * absSin));
    var rotH = Math.max(1, Math.round(rw * absSin + rh * absCos));

    var rotCanvas = document.createElement('canvas');
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;
    var rctx = rotCanvas.getContext('2d', { willReadFrequently: true });
    rctx.fillStyle = '#ffffff';
    rctx.fillRect(0, 0, rotW, rotH);
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = 'high';
    rctx.save();
    rctx.translate(rotW / 2, rotH / 2);
    rctx.rotate(angleRad);
    rctx.drawImage(img, -rw / 2, -rh / 2, rw, rh);
    rctx.restore();

    var outCanvas = rotCanvas;
    if (!skipCropBox && prep.crop && prep.crop.w > 0.02 && prep.crop.h > 0.02) {
      var cx = Math.max(0, Math.round(prep.crop.x * rotW));
      var cy = Math.max(0, Math.round(prep.crop.y * rotH));
      var cw = Math.max(16, Math.min(rotW - cx, Math.round(prep.crop.w * rotW)));
      var ch = Math.max(16, Math.min(rotH - cy, Math.round(prep.crop.h * rotH)));
      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = cw;
      cropCanvas.height = ch;
      cropCanvas.getContext('2d', { willReadFrequently: true }).drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, cw, ch);
      outCanvas = cropCanvas;
    }

    var needLut = !!(prep.brightness || prep.contrast || prep.grayscale);
    var needPixels = needLut || !!prep.sharpen || !!prep.denoise;
    if (needPixels) {
      var ctx = outCanvas.getContext('2d', { willReadFrequently: true });
      var w = outCanvas.width;
      var h = outCanvas.height;
      var imgData = ctx.getImageData(0, 0, w, h);
      var d = imgData.data;

      if (prep.denoise) {
        applyConvolution3x3(d, w, h, [1, 2, 1, 2, 4, 2, 1, 2, 1], 16, 0);
      }

      if (needLut) {
        var lut = buildBrightnessContrastLut(prep.brightness, prep.contrast);
        if (prep.grayscale) {
          for (var i = 0; i < d.length; i += 4) {
            var r = lut[d[i]];
            var g = lut[d[i + 1]];
            var b = lut[d[i + 2]];
            var lum = (77 * r + 150 * g + 29 * b) >> 8;
            d[i] = d[i + 1] = d[i + 2] = lum;
          }
        } else {
          for (var j = 0; j < d.length; j += 4) {
            d[j] = lut[d[j]];
            d[j + 1] = lut[d[j + 1]];
            d[j + 2] = lut[d[j + 2]];
          }
        }
      }

      if (prep.sharpen) {
        applyConvolution3x3(d, w, h, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1, 0);
      }

      ctx.putImageData(imgData, 0, 0);
    }

    return outCanvas;
  }

  /* تقييم سريع للإضاءة وتوحيد الخلفية الورقية موضعياً دون تشويه النقط والحروف العربية */
  function analyzeLightingQuick(canvas) {
    var sw = 48;
    var sh = 48;
    var sc = document.createElement('canvas');
    sc.width = sw;
    sc.height = sh;
    var sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(canvas, 0, 0, sw, sh);
    var sd = sctx.getImageData(0, 0, sw, sh).data;
    var lums = new Uint8Array(sw * sh);
    for (var i = 0, p = 0; i < sd.length; i += 4, p++) {
      lums[p] = (77 * sd[i] + 150 * sd[i + 1] + 29 * sd[i + 2]) >> 8;
    }
    var sorted = Array.prototype.slice.call(lums).sort(function (a, b) { return a - b; });
    var n = sorted.length;
    var p40 = sorted[Math.floor(n * 0.40)];
    var p65 = sorted[Math.floor(n * 0.65)];
    var p85 = sorted[Math.floor(n * 0.85)];
    var p95 = sorted[Math.floor(n * 0.95)];
    var isDarkMode = p65 < 72 && (p95 - p65) > 65;
    var isCleanWhite = !isDarkMode && p85 >= 238 && (p95 - p40) <= 18;
    return { isDarkMode: isDarkMode, isCleanWhite: isCleanWhite };
  }

  function flattenPaperLightingInPlace(canvas, isDarkMode) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var imgData = ctx.getImageData(0, 0, w, h);
    var d = imgData.data;

    if (isDarkMode) {
      for (var k = 0; k < d.length; k += 4) {
        var dlum = (77 * d[k] + 150 * d[k + 1] + 29 * d[k + 2]) >> 8;
        var inv = 255 - dlum;
        d[k] = d[k + 1] = d[k + 2] = inv;
      }
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    var STEP = 20;
    var gw = Math.max(1, Math.ceil(w / STEP));
    var gh = Math.max(1, Math.ceil(h / STEP));
    var bgRaw = new Uint8Array(gw * gh);

    for (var gy = 0; gy < gh; gy++) {
      var y0 = gy * STEP;
      var y1 = Math.min(h, y0 + STEP);
      for (var gx = 0; gx < gw; gx++) {
        var x0 = gx * STEP;
        var x1 = Math.min(w, x0 + STEP);
        var maxL = 0;
        for (var yy = y0; yy < y1; yy += 2) {
          var rowOff = yy * w;
          for (var xx = x0; xx < x1; xx += 2) {
            var idx = (rowOff + xx) * 4;
            var l = (77 * d[idx] + 150 * d[idx + 1] + 29 * d[idx + 2]) >> 8;
            if (l > maxL) maxL = l;
          }
        }
        bgRaw[gy * gw + gx] = maxL;
      }
    }

    /* توسيع حد الخلفية 3x3 ثم تنعيم سريع لتلافي الهالات حول العناوين العريضة */
    var bgDil = new Uint8Array(gw * gh);
    var gy2, gx2, dy, dx;
    for (gy2 = 0; gy2 < gh; gy2++) {
      for (gx2 = 0; gx2 < gw; gx2++) {
        var m = 0;
        for (dy = -1; dy <= 1; dy++) {
          var ny = gy2 + dy;
          if (ny < 0 || ny >= gh) continue;
          for (dx = -1; dx <= 1; dx++) {
            var nx = gx2 + dx;
            if (nx < 0 || nx >= gw) continue;
            var v = bgRaw[ny * gw + nx];
            if (v > m) m = v;
          }
        }
        bgDil[gy2 * gw + gx2] = m;
      }
    }

    var bgSmooth = new Uint8Array(gw * gh);
    for (gy2 = 0; gy2 < gh; gy2++) {
      for (gx2 = 0; gx2 < gw; gx2++) {
        var sum = 0;
        var cnt = 0;
        for (dy = -1; dy <= 1; dy++) {
          var sy = gy2 + dy;
          if (sy < 0 || sy >= gh) continue;
          for (dx = -1; dx <= 1; dx++) {
            var sx = gx2 + dx;
            if (sx < 0 || sx >= gw) continue;
            sum += bgDil[sy * gw + sx];
            cnt++;
          }
        }
        bgSmooth[gy2 * gw + gx2] = Math.max(48, Math.round(sum / cnt));
      }
    }

    var invStep = 1 / STEP;
    for (var y = 0; y < h; y++) {
      var fy = y * invStep - 0.5;
      var iy0 = fy < 0 ? 0 : Math.floor(fy);
      var iy1 = iy0 + 1 < gh ? iy0 + 1 : iy0;
      var ty = fy - iy0;
      if (ty < 0) ty = 0;
      var row0 = iy0 * gw;
      var row1 = iy1 * gw;
      var rowPix = y * w;

      for (var x = 0; x < w; x++) {
        var fx = x * invStep - 0.5;
        var ix0 = fx < 0 ? 0 : Math.floor(fx);
        var ix1 = ix0 + 1 < gw ? ix0 + 1 : ix0;
        var tx = fx - ix0;
        if (tx < 0) tx = 0;

        var b00 = bgSmooth[row0 + ix0];
        var b10 = bgSmooth[row0 + ix1];
        var b01 = bgSmooth[row1 + ix0];
        var b11 = bgSmooth[row1 + ix1];
        var bg = (b00 + (b10 - b00) * tx) + ((b01 + (b11 - b01) * tx) - (b00 + (b10 - b00) * tx)) * ty;

        var pi = (rowPix + x) * 4;
        var plum = (77 * d[pi] + 150 * d[pi + 1] + 29 * d[pi + 2]) >> 8;
        var norm = (plum * 255) / bg;
        var outVal;
        if (norm >= 222) {
          outVal = 255;
        } else if (norm <= 85) {
          outVal = (norm * 0.72) | 0;
        } else {
          outVal = Math.min(255, Math.round(61 + ((norm - 85) * 194) / 137));
        }
        d[pi] = d[pi + 1] = d[pi + 2] = outVal;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function prepareOcrCanvas(img, prep) {
    prep = prep || defaultPrep();
    var canvas = renderPreprocessedCanvas(img, prep, null, false, true);

    var light = analyzeLightingQuick(canvas);
    if (light.isDarkMode || (!light.isCleanWhite && !prep.brightness && !prep.contrast)) {
      flattenPaperLightingInPlace(canvas, light.isDarkMode);
    }

    /* إضافة هامش أبيض آمن لتجنب قص الحروف القريبة من حافة الصورة */
    var pad = 22;
    var padded = document.createElement('canvas');
    padded.width = canvas.width + pad * 2;
    padded.height = canvas.height + pad * 2;
    var pctx = padded.getContext('2d');
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, padded.width, padded.height);
    pctx.drawImage(canvas, pad, pad);
    return padded;
  }

  function makeThumbDataUrl(img, prep) {
    var c = renderPreprocessedCanvas(img, prep, 240, false, false);
    return c.toDataURL('image/jpeg', 0.8);
  }

  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) {
          if (b) resolve(b);
          else reject(new Error('تعذّر تحويل الصورة للمعالجة'));
        }, 'image/png');
      } else {
        try {
          var du = canvas.toDataURL('image/png');
          var bin = atob(du.split(',')[1]);
          var u8 = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          resolve(new Blob([u8], { type: 'image/png' }));
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  /* ---------- إحصاءات النصوص والدمج ---------- */
  function countWords(text) {
    var t = String(text || '').trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  function buildMergedText() {
    if (!state.items.length) return '';
    return state.items.map(function (it, idx) {
      var header = '--- الصفحة ' + (idx + 1) + ': ' + it.name + ' ---';
      var body = (it.text || '').trim();
      if (!body && it.status === 'done' && it.noText) body = '[لم يُكتشف نص واضح في هذه الصورة]';
      return header + '\n' + body;
    }).join('\n\n');
  }

  function getMergedText() {
    return state.mergedDirty ? state.mergedText : buildMergedText();
  }

  function buildExportPages(singleItem) {
    if (singleItem) {
      return [{
        name: singleItem.name,
        heading: singleItem.name,
        showHeading: true,
        text: singleItem.text || '',
        dir: singleItem.dir || 'auto'
      }];
    }
    if (state.mergedDirty && state.mergedText.trim()) {
      /* تقسيم النص الموحّد المعدّل يدوياً حسب فواصل الصفحات إن وُجدت */
      var raw = state.mergedText.replace(/\r\n?/g, '\n');
      var parts = raw.split(/\n*(?=---\s*الصفحة\s+\d+(?:\s*:[^\n]*)?\s*---)/g).filter(Boolean);
      if (parts.length > 1) {
        return parts.map(function (block, idx) {
          var lines = block.split('\n');
          var first = lines[0] || '';
          var heading = 'الصفحة ' + (idx + 1);
          var text = block;
          if (MERGE_DIV_RE.test(first)) {
            heading = first.replace(/^---\s*|\s*---$/g, '').trim();
            text = lines.slice(1).join('\n').trim();
          }
          return { name: heading, heading: heading, showHeading: true, text: text, dir: 'auto' };
        });
      }
      return [{ name: 'النص الموحّد', heading: 'النص الموحّد', showHeading: false, text: raw, dir: 'auto' }];
    }
    return state.items.map(function (it, idx) {
      return {
        name: it.name,
        heading: 'الصفحة ' + (idx + 1) + ' — ' + it.name,
        showHeading: true,
        text: it.text || '',
        dir: it.dir || 'auto'
      };
    });
  }

  /* ---------- محرك Tesseract المحلي ---------- */
  function translateStage(status) {
    switch (status) {
      case 'loading tesseract core': return 'تحميل نواة WebAssembly';
      case 'initializing tesseract': return 'تهيئة محرك Tesseract';
      case 'loading language traineddata': return 'تحميل ملفات اللغة';
      case 'initializing api': return 'تهيئة نموذج التعرف';
      case 'recognizing text': return 'استخراج النص من الصورة';
      default: return 'جارٍ التحضير…';
    }
  }

  function ensureTesseractLoaded() {
    if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
      return Promise.resolve(window.Tesseract);
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ST.baseUrl('./vendor/tesseract/tesseract.min.js');
      s.onload = function () {
        if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
          resolve(window.Tesseract);
        } else {
          reject(new Error('تعذّر تهيئة مكتبة Tesseract.js المحلية'));
        }
      };
      s.onerror = function () {
        reject(new Error('تعذّر تحميل ملف ./vendor/tesseract/tesseract.min.js'));
      };
      document.head.appendChild(s);
    });
  }

  function cleanExtractedText(raw) {
    return String(raw || '')
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function terminateActiveWorker() {
    var w = state.activeWorker;
    state.activeWorker = null;
    state.activeWorkerLang = null;
    state.activeWorkerPsm = null;
    if (w) {
      try { await w.terminate(); } catch (e) {}
    }
  }

  async function getWorkerForLang(lang, psm) {
    var targetPsm = psm || '6';
    var worker = state.activeWorker;

    if (!worker) {
      var Tess = await ensureTesseractLoaded();
      var coreDir = ST.baseUrl('./vendor/tesseract');
      var langDir = ST.baseUrl('./vendor/tesseract/lang');
      var workerPath = ST.baseUrl('./vendor/tesseract/worker.min.js');

      worker = await Tess.createWorker(lang, 1 /* OEM.LSTM_ONLY */, {
        workerPath: workerPath,
        corePath: coreDir,
        langPath: langDir,
        workerBlobURL: false,
        gzip: true,
        cacheMethod: 'write',
        errorHandler: function (err) {
          if (state.stopRequested) return;
          console.error('[OCR worker error]', err);
        },
        logger: function (m) {
          if (!state.running || state.stopRequested) return;
          state.currentStage = translateStage(m.status);
          if (typeof m.progress === 'number') {
            state.currentItemPct = Math.round(Math.max(0, Math.min(1, m.progress)) * 100);
          }
          updateProgressUI();
        }
      });

      if (state.stopRequested) {
        try { await worker.terminate(); } catch (e) {}
        throw new Error('STOPPED');
      }

      state.activeWorker = worker;
      state.activeWorkerLang = lang;
      state.activeWorkerPsm = null;
    } else if (state.activeWorkerLang !== lang) {
      /* إعادة استخدام نفس الـ Worker ونواة WASM عند تبديل اللغة دون إعادة إنشاء أو تحميل */
      state.currentStage = 'تغيير بيانات اللغة…';
      updateProgressUI();
      await worker.reinitialize(lang, 1);
      if (state.stopRequested) throw new Error('STOPPED');
      state.activeWorkerLang = lang;
      state.activeWorkerPsm = null;
    }

    if (state.activeWorkerPsm !== targetPsm) {
      await worker.setParameters({
        tessedit_pageseg_mode: targetPsm,
        user_defined_dpi: '300',
        preserve_interword_spaces: '0',
        tessedit_char_blacklist: lang === 'ara+eng' ? '|' : ''
      });
      if (state.stopRequested) throw new Error('STOPPED');
      state.activeWorkerPsm = targetPsm;
    }

    return worker;
  }

  async function processSingleItem(item, lang, psm) {
    item.status = 'processing';
    item.errorMsg = '';
    item.noText = false;
    state.currentItemId = item.id;
    state.currentItemPct = 5;
    state.currentStage = 'تجهيز الصورة وتحسينها…';
    updateQueueItemUI(item);
    updateProgressUI();

    var img = await loadImageFromBlob(item.blob);
    var prepCanvas = prepareOcrCanvas(img, item.prep);
    var pngBlob = await canvasToPngBlob(prepCanvas);
    await new Promise(function (r) { setTimeout(r, 0); });

    if (state.stopRequested) throw new Error('STOPPED');

    var worker = await getWorkerForLang(lang, psm);
    if (state.stopRequested) throw new Error('STOPPED');

    var res = await worker.recognize(pngBlob);
    if (state.stopRequested) throw new Error('STOPPED');

    var extracted = cleanExtractedText(res && res.data ? res.data.text : '');
    item.text = extracted;
    item.noText = !extracted;
    item.confidence = res && res.data && typeof res.data.confidence === 'number' ? Math.round(res.data.confidence) : null;
    item.langUsed = lang;
    item.psmUsed = psm || '6';
    item.status = 'done';
    item.editedByUser = false;
    item.errorMsg = '';
    await ST.putItem(item);
  }

  async function runQueue(targetIds) {
    if (state.running) return;
    var queue = targetIds
      ? state.items.filter(function (it) { return targetIds.indexOf(it.id) !== -1; })
      : state.items.filter(function (it) { return it.status !== 'done' || !it.editedByUser; });

    if (!queue.length) {
      toast('لا توجد صور بحاجة إلى معالجة');
      return;
    }

    if (!navigator.onLine) {
      var readiness = await ST.checkReadiness();
      var neededKeys = ['lib', 'worker', 'core'].concat(state.lang.split('+'));
      var missingNeeded = readiness.missing.filter(function (m) { return neededKeys.indexOf(m.key) !== -1; });
      if (missingNeeded.length) {
        toast('الجهاز غير متصل وبعض موارد OCR المحلية (' + missingNeeded.map(function (m) { return m.label; }).join('، ') + ') غير مخزنة للعمل أوفلاين بعد.', 4200);
        return;
      }
    }

    state.running = true;
    state.stopRequested = false;
    state.batchDone = 0;
    state.batchTotal = queue.length;
    state.currentItemPct = 0;
    state.currentStage = 'بدء تشغيل محرك OCR…';
    renderControls();
    updateProgressUI();

    var successCount = 0;
    var failCount = 0;

    try {
      for (var i = 0; i < queue.length; i++) {
        if (state.stopRequested) break;
        var item = queue[i];
        try {
          await processSingleItem(item, state.lang, state.psm);
          successCount++;
        } catch (err) {
          if (state.stopRequested || (err && err.message === 'STOPPED')) {
            item.status = 'waiting';
            await ST.putItem(item);
            break;
          }
          failCount++;
          item.status = 'error';
          item.errorMsg = (err && err.message) ? err.message : 'تعذّر استخراج النص من هذه الصورة';
          await ST.putItem(item);
        }
        state.batchDone = i + 1;
        state.currentItemPct = 100;
        updateQueueItemUI(item);
        updateProgressUI();
      }
    } finally {
      state.running = false;
      state.currentItemId = null;
      state.currentStage = '';
      if (state.stopRequested) {
        await terminateActiveWorker();
        toast('تم إيقاف عملية الاستخراج');
      } else {
        /* بعد انتهاء الدفعة نحدّث حالة الجاهزية دون إنترنت لأن اللغة المستخدمة قد حُمّلت */
        refreshOfflineStatus();
        if (failCount === 0) {
          toast('اكتملت معالجة ' + successCount + ' ' + (successCount === 1 ? 'صورة' : 'صور'));
        } else {
          toast('اكتملت المعالجة مع ' + failCount + ' خطأ', 3200);
        }
      }
      state.stopRequested = false;
      renderAll();
    }
  }

  async function stopRun() {
    if (!state.running) return;
    state.stopRequested = true;
    state.currentStage = 'جارٍ إيقاف المعالجة…';
    updateProgressUI();
    await terminateActiveWorker();
  }

  /* ---------- إضافة وحذف وإعادة ترتيب الصور ---------- */
  async function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    var added = 0;
    var rejected = 0;
    var maxOrder = state.items.reduce(function (m, it) { return Math.max(m, it.order || 0); }, 0);

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!ALLOWED_MIME.test(f.type) && !ALLOWED_EXT.test(f.name || '')) {
        rejected++;
        continue;
      }
      try {
        var img = await loadImageFromBlob(f);
        var prep = defaultPrep();
        var thumb = makeThumbDataUrl(img, prep);
        var item = {
          id: uid(),
          name: f.name || ('image-' + (state.items.length + 1) + '.png'),
          size: f.size || 0,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          blob: f,
          thumb: thumb,
          prep: prep,
          text: '',
          dir: 'auto',
          status: 'waiting',
          noText: false,
          confidence: null,
          editedByUser: false,
          errorMsg: '',
          order: ++maxOrder
        };
        state.items.push(item);
        await ST.putItem(item);
        added++;
      } catch (e) {
        rejected++;
      }
    }

    if (added && !state.selectedId && state.items.length) {
      state.selectedId = state.items[0].id;
    }
    if (added) {
      state.mergedDirty = false;
      renderAll();
      toast('تمت إضافة ' + added + (added === 1 ? ' صورة' : ' صور'));
    }
    if (rejected) {
      toast('تم تجاهل ' + rejected + ' ملف غير صالح (الصيغ المدعومة: JPG وJPEG وPNG وWEBP)', 3400);
    }
  }

  async function moveItem(index, delta) {
    if (state.running) return;
    var next = index + delta;
    if (next < 0 || next >= state.items.length) return;
    var tmp = state.items[index];
    state.items[index] = state.items[next];
    state.items[next] = tmp;
    state.items.forEach(function (it, i) { it.order = i + 1; });
    await ST.putAllItems(state.items);
    renderQueue();
    renderResults();
  }

  async function reorderByIndex(fromIdx, toIdx) {
    if (state.running || fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    var moved = state.items.splice(fromIdx, 1)[0];
    state.items.splice(toIdx, 0, moved);
    state.items.forEach(function (it, i) { it.order = i + 1; });
    await ST.putAllItems(state.items);
    renderQueue();
    renderResults();
  }

  async function removeItem(id) {
    if (state.running) return;
    state.items = state.items.filter(function (it) { return it.id !== id; });
    if (state.selectedId === id) state.selectedId = state.items[0] ? state.items[0].id : null;
    await ST.deleteItem(id);
    renderAll();
    toast('تم حذف الصورة من القائمة');
  }

  /* ---------- نافذة تحسين الصورة (Canvas غير متلف) ---------- */
  async function openPreprocessModal(item) {
    if (!item || !item.blob) return;
    var img;
    try {
      img = await loadImageFromBlob(item.blob);
    } catch (e) {
      toast('تعذّرت قراءة الصورة الأصلية');
      return;
    }

    var draft = JSON.parse(JSON.stringify(item.prep || defaultPrep()));
    var cropDragging = false;
    var cropStart = null;

    openModal(
      '<h3>تحسين الصورة قبل الاستخراج</h3>' +
      '<p class="tl-hint" style="margin-top:0">تبقى الصورة الأصلية محفوظة كما هي، ويمكنك إعادة الضبط في أي وقت. اسحب على المعاينة لتحديد منطقة قص.</p>' +
      '<div class="ocr-prep-stage"><canvas id="ocrPrepCanvas"></canvas></div>' +
      '<div class="tl-row" style="justify-content:center;margin-bottom:6px">' +
        '<button type="button" class="tl-btn sm" data-act="rotL">تدوير -90°</button>' +
        '<button type="button" class="tl-btn sm" data-act="rotR">تدوير +90°</button>' +
        '<button type="button" class="tl-btn sm" data-act="rot180">قلب 180°</button>' +
        '<button type="button" class="tl-btn sm" data-act="clearCrop">إلغاء القص</button>' +
      '</div>' +
      '<div class="ocr-prep-grid">' +
        '<div class="ocr-prep-ctrl"><label>ميلان دقيق <b id="ocrValFine">0°</b></label><input id="ocrRngFine" type="range" min="-15" max="15" step="0.5" value="' + (draft.fineDeg || 0) + '"></div>' +
        '<div class="ocr-prep-ctrl"><label>السطوع <b id="ocrValBright">0</b></label><input id="ocrRngBright" type="range" min="-50" max="50" step="2" value="' + (draft.brightness || 0) + '"></div>' +
        '<div class="ocr-prep-ctrl"><label>التباين <b id="ocrValContrast">0</b></label><input id="ocrRngContrast" type="range" min="-40" max="90" step="2" value="' + (draft.contrast || 0) + '"></div>' +
      '</div>' +
      '<div class="ocr-prep-toggles">' +
        '<label class="ocr-prep-chk"><input type="checkbox" id="ocrChkGray"' + (draft.grayscale ? ' checked' : '') + '> تدرج رمادي</label>' +
        '<label class="ocr-prep-chk"><input type="checkbox" id="ocrChkSharp"' + (draft.sharpen ? ' checked' : '') + '> زيادة حدة النص</label>' +
        '<label class="ocr-prep-chk"><input type="checkbox" id="ocrChkDenoise"' + (draft.denoise ? ' checked' : '') + '> تقليل التشويش</label>' +
      '</div>' +
      '<div class="tl-btns">' +
        '<button type="button" class="tl-btn" data-act="reset">إعادة للأصل</button>' +
        '<button type="button" class="tl-btn" data-act="cancel">إغلاق</button>' +
        '<button type="button" class="tl-btn pri" data-act="save">حفظ التحسينات</button>' +
        '<button type="button" class="tl-btn pri" data-act="saveRun">حفظ وإعادة الاستخراج</button>' +
      '</div>',
      'ocr-prep-modal'
    );

    var canvas = modalEl.querySelector('#ocrPrepCanvas');
    var rngFine = modalEl.querySelector('#ocrRngFine');
    var rngBright = modalEl.querySelector('#ocrRngBright');
    var rngContrast = modalEl.querySelector('#ocrRngContrast');
    var chkGray = modalEl.querySelector('#ocrChkGray');
    var chkSharp = modalEl.querySelector('#ocrChkSharp');
    var chkDenoise = modalEl.querySelector('#ocrChkDenoise');

    function syncLabels() {
      modalEl.querySelector('#ocrValFine').textContent = (draft.fineDeg || 0) + '°';
      modalEl.querySelector('#ocrValBright').textContent = String(draft.brightness || 0);
      modalEl.querySelector('#ocrValContrast').textContent = String(draft.contrast || 0);
      rngFine.value = String(draft.fineDeg || 0);
      rngBright.value = String(draft.brightness || 0);
      rngContrast.value = String(draft.contrast || 0);
      chkGray.checked = !!draft.grayscale;
      chkSharp.checked = !!draft.sharpen;
      chkDenoise.checked = !!draft.denoise;
    }

    function drawPreview() {
      syncLabels();
      var preview = renderPreprocessedCanvas(img, draft, 900, true, false);
      canvas.width = preview.width;
      canvas.height = preview.height;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(preview, 0, 0);

      if (draft.crop && draft.crop.w > 0.01 && draft.crop.h > 0.01) {
        var cx = Math.round(draft.crop.x * canvas.width);
        var cy = Math.round(draft.crop.y * canvas.height);
        var cw = Math.round(draft.crop.w * canvas.width);
        var ch = Math.round(draft.crop.h * canvas.height);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.fillRect(0, 0, canvas.width, cy);
        ctx.fillRect(0, cy + ch, canvas.width, canvas.height - (cy + ch));
        ctx.fillRect(0, cy, cx, ch);
        ctx.fillRect(cx + cw, cy, canvas.width - (cx + cw), ch);
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));
        ctx.strokeRect(cx, cy, cw, ch);
        ctx.restore();
      }
    }

    function normPoint(e) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      return {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      };
    }

    canvas.addEventListener('pointerdown', function (e) {
      cropDragging = true;
      cropStart = normPoint(e);
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!cropDragging || !cropStart) return;
      var pt = normPoint(e);
      var x = Math.min(cropStart.x, pt.x);
      var y = Math.min(cropStart.y, pt.y);
      var w = Math.abs(pt.x - cropStart.x);
      var h = Math.abs(pt.y - cropStart.y);
      if (w > 0.02 && h > 0.02) {
        draft.crop = { x: x, y: y, w: w, h: h };
        drawPreview();
      }
    });

    function endCrop(e) {
      if (!cropDragging) return;
      cropDragging = false;
      if (canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }
    canvas.addEventListener('pointerup', endCrop);
    canvas.addEventListener('pointercancel', endCrop);

    rngFine.addEventListener('input', function () { draft.fineDeg = parseFloat(rngFine.value) || 0; drawPreview(); });
    rngBright.addEventListener('input', function () { draft.brightness = parseInt(rngBright.value, 10) || 0; drawPreview(); });
    rngContrast.addEventListener('input', function () { draft.contrast = parseInt(rngContrast.value, 10) || 0; drawPreview(); });
    chkGray.addEventListener('change', function () { draft.grayscale = chkGray.checked; drawPreview(); });
    chkSharp.addEventListener('change', function () { draft.sharpen = chkSharp.checked; drawPreview(); });
    chkDenoise.addEventListener('change', function () { draft.denoise = chkDenoise.checked; drawPreview(); });

    modalEl.addEventListener('click', async function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'rotL') { draft.rot90 = (draft.rot90 - 90 + 360) % 360; draft.crop = null; drawPreview(); }
      else if (act === 'rotR') { draft.rot90 = (draft.rot90 + 90) % 360; draft.crop = null; drawPreview(); }
      else if (act === 'rot180') { draft.rot90 = (draft.rot90 + 180) % 360; draft.crop = null; drawPreview(); }
      else if (act === 'clearCrop') { draft.crop = null; drawPreview(); }
      else if (act === 'reset') { draft = defaultPrep(); drawPreview(); }
      else if (act === 'cancel') { closeModal(); }
      else if (act === 'save' || act === 'saveRun') {
        item.prep = draft;
        item.thumb = makeThumbDataUrl(img, draft);
        if (act === 'save' && item.status !== 'done') item.status = 'waiting';
        await ST.putItem(item);
        closeModal();
        renderQueue();
        if (act === 'saveRun') {
          runQueue([item.id]);
        } else {
          toast('تم حفظ إعدادات تحسين الصورة');
        }
      }
    });

    drawPreview();
  }

  /* ---------- مسح جميع بيانات العمل ---------- */
  function confirmClearAll() {
    if (state.running) {
      toast('أوقف المعالجة الجارية أولاً قبل مسح البيانات');
      return;
    }
    openModal(
      '<h3>مسح جميع بيانات العمل</h3>' +
      '<p class="tl-hint" style="margin:6px 0 14px">سيتم حذف جميع الصور المرفوعة والنصوص المستخرجة وتعديلاتك المحفوظة محلياً نهائياً. هل تريد المتابعة؟</p>' +
      '<div class="tl-btns">' +
        '<button type="button" class="tl-btn" id="ocrClearCancel">إلغاء</button>' +
        '<button type="button" class="tl-btn del" id="ocrClearYes">نعم، امسح الكل</button>' +
      '</div>'
    );
    modalEl.querySelector('#ocrClearCancel').onclick = closeModal;
    modalEl.querySelector('#ocrClearYes').onclick = async function () {
      closeModal();
      await ST.clearAllData();
      state.items = [];
      state.selectedId = null;
      state.mergedDirty = false;
      state.mergedText = '';
      state.lang = 'ara';
      state.psm = '6';
      renderAll();
      toast('تم مسح جميع بيانات العمل المحفوظة');
    };
  }

  /* ---------- إدارة الجاهزية دون إنترنت ---------- */
  async function refreshOfflineStatus() {
    try {
      var res = await ST.checkReadiness();
      if (res.cacheUnsupported) {
        state.offlineStatus = 'error';
        state.offlineDetail = 'ذاكرة Cache API غير متاحة في وضع التصفح الحالي';
      } else if (res.ready) {
        state.offlineStatus = 'ready';
        state.offlineDetail = 'جميع موارد OCR واللغتين العربية والإنجليزية مخزّنة وجاهزة دون إنترنت (' + res.cachedCount + '/' + res.total + ')';
      } else {
        state.offlineStatus = 'partial';
        state.offlineDetail = 'جاهز جزئياً (' + res.cachedCount + '/' + res.total + ') — اضغط لتخزين المحرك واللغات للعمل دون إنترنت';
      }
    } catch (e) {
      state.offlineStatus = 'error';
      state.offlineDetail = 'تعذّر فحص حالة التخزين دون إنترنت';
    }
    renderOfflineBar();
  }

  async function handlePrepareOffline() {
    if (state.offlineStatus === 'downloading') return;
    if (!navigator.onLine) {
      var chk = await ST.checkReadiness();
      if (chk.ready) {
        refreshOfflineStatus();
        toast('الموارد جاهزة مسبقاً للعمل دون إنترنت');
      } else {
        toast('أنت غير متصل بالإنترنت حالياً؛ اتصل مؤقتاً لتحميل موارد OCR محلياً', 3400);
      }
      return;
    }

    state.offlineStatus = 'downloading';
    state.offlineDetail = 'جارٍ تجهيز الملفات المحلية…';
    renderOfflineBar();

    try {
      await ST.prepareOffline(function (p) {
        state.offlineDetail = 'جارٍ التنزيل والتخزين (' + p.done + '/' + p.total + '): ' + p.current;
        renderOfflineBar();
      });
      await refreshOfflineStatus();
      toast('تم تجهيز موارد OCR للعمل الكامل دون إنترنت');
    } catch (err) {
      state.offlineStatus = 'error';
      state.offlineDetail = err && err.message ? err.message : 'حدث خطأ أثناء تجهيز الموارد';
      renderOfflineBar();
      toast('تعذّر تجهيز بعض الموارد دون إنترنت', 3200);
    }
  }

  /* ---------- التصدير والنسخ ---------- */
  async function copyTextToClipboard(text) {
    var val = String(text || '');
    if (!val.trim()) {
      toast('لا يوجد نص لنسخه');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(val);
      } else {
        var ta = document.createElement('textarea');
        ta.value = val;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast('تم نسخ النص إلى الحافظة');
    } catch (e) {
      toast('تعذّر النسخ التلقائي؛ يمكنك التحديد والنسخ يدوياً');
    }
  }

  /* ---------- العرض وتحديث DOM ---------- */
  function buildShellHtml() {
    return (
      '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div>' +
      '<h2 class="ptitle">محوّل الصور إلى نصوص (OCR)</h2>' +
      '<div class="ocr-shell">' +
        '<section class="ocr-header">' +
          '<div class="ocr-header-top">' +
            '<div>' +
              '<p class="ocr-lead">ارفع صور صفحات المحاضرات والكتب لاستخراج النصوص العربية والإنجليزية محلياً داخل جهازك دون ذكاء اصطناعي أو خوادم خارجية، مع إمكانية التعديل والتصدير بصيغ Word وTXT وPDF.</p>' +
              '<p class="ocr-disclaimer">ملاحظة: تعتمد دقة الاستخراج على وضوح الصورة وإضاءتها ومحاذاة السطور؛ يمكنك استخدام أداة «تحسين الصورة» وتعديل النص المستخرج قبل التصدير.</p>' +
            '</div>' +
          '</div>' +
          '<div class="ocr-offline-bar" id="ocrOfflineBar"></div>' +
        '</section>' +
        '<div class="ocr-grid">' +
          '<section class="ocr-panel">' +
            '<h3 class="ocr-sec-title"><span>1. الصور والإعدادات</span><span class="ocr-sec-meta" id="ocrQueueCount"></span></h3>' +
            '<div class="ocr-drop" id="ocrDropZone" tabindex="0" role="button" aria-label="اختر أو اسحب صوراً لبدء استخراج النصوص">' +
              '<input class="ocr-file-input" id="ocrFileInput" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple>' +
              '<div class="ocr-drop-ic">' + I.upload + '</div>' +
              '<h4>اسحب الصور هنا أو اضغط للاختيار</h4>' +
              '<p>يدعم رفع صورة واحدة أو عدة صور بصيغ JPG · JPEG · PNG · WEBP</p>' +
              '<span class="tl-btn pri sm" style="pointer-events:none">اختيار صور من الجهاز</span>' +
            '</div>' +
            '<div class="ocr-controls" id="ocrControls"></div>' +
            '<div class="ocr-queue" id="ocrQueue"></div>' +
          '</section>' +
          '<section class="ocr-panel">' +
            '<div class="ocr-tabs" role="tablist">' +
              '<button type="button" class="ocr-tab-btn" id="ocrTabCards" role="tab" aria-selected="true" data-tab="cards">نصوص الصور الفردية</button>' +
              '<button type="button" class="ocr-tab-btn" id="ocrTabMerged" role="tab" aria-selected="false" data-tab="merged">النص الموحّد والتصدير الشامل</button>' +
            '</div>' +
            '<div id="ocrResultsArea"></div>' +
          '</section>' +
        '</div>' +
      '</div>'
    );
  }

  function renderOfflineBar() {
    var el = state.root && state.root.querySelector('#ocrOfflineBar');
    if (!el) return;
    var cls = 'ocr-res-state';
    var title = 'فحص الموارد المحلية';
    if (state.offlineStatus === 'ready') { cls += ' ready'; title = 'حالة موارد OCR: جاهزة'; }
    else if (state.offlineStatus === 'downloading') { cls += ' busy'; title = 'حالة موارد OCR: جارٍ التنزيل'; }
    else if (state.offlineStatus === 'error') { cls += ' error'; title = 'حالة موارد OCR: تعذّر التحميل'; }
    else if (state.offlineStatus === 'partial') { title = 'حالة موارد OCR: غير جاهزة بالكامل'; }

    var btnDisabled = state.offlineStatus === 'downloading' ? ' disabled' : '';
    var btnText = state.offlineStatus === 'ready'
      ? 'تأكيد الجاهزية دون إنترنت'
      : (state.offlineStatus === 'downloading' ? 'جارٍ التجهيز…' : 'تجهيز للعمل دون إنترنت');

    el.innerHTML =
      '<div class="' + cls + '">' +
        '<span class="ocr-dot" aria-hidden="true"></span>' +
        '<div class="ocr-res-text"><strong>' + title + '</strong><span>' + esc(state.offlineDetail) + '</span></div>' +
      '</div>' +
      '<button type="button" class="tl-btn sm" id="ocrPrepOfflineBtn"' + btnDisabled + '>' + I.offline + ' ' + btnText + '</button>';
  }

  function renderControls() {
    var el = state.root && state.root.querySelector('#ocrControls');
    if (!el) return;
    var hasItems = state.items.length > 0;
    var canStart = hasItems && !state.running;

    var langButtons = LANGS.map(function (lg) {
      return '<button type="button" class="ocr-lang-btn" data-lang="' + lg.id + '" aria-pressed="' + (state.lang === lg.id ? 'true' : 'false') + '"' + (state.running ? ' disabled' : '') + '>' + lg.label + '</button>';
    }).join('');

    var psmButtons = PSMS.map(function (pm) {
      return '<button type="button" class="ocr-lang-btn ocr-psm-btn" data-psm="' + pm.id + '" aria-pressed="' + (state.psm === pm.id ? 'true' : 'false') + '"' + (state.running ? ' disabled' : '') + '>' + pm.label + '</button>';
    }).join('');

    var pct = state.batchTotal > 0
      ? Math.min(100, Math.round(((state.batchDone + (state.running ? state.currentItemPct / 100 : 0)) / state.batchTotal) * 100))
      : 0;
    if (state.batchDone >= state.batchTotal && state.batchTotal > 0 && !state.running) pct = 100;

    el.innerHTML =
      '<div class="ocr-lang-row">' +
        '<span class="ocr-lang-label">لغة استخراج النص:</span>' +
        '<div class="ocr-lang-group">' + langButtons + '</div>' +
      '</div>' +
      '<div class="ocr-lang-row">' +
        '<span class="ocr-lang-label">تخطيط الصفحة (PSM):</span>' +
        '<div class="ocr-lang-group cols-2">' + psmButtons + '</div>' +
      '</div>' +
      '<div class="ocr-run-row">' +
        '<button type="button" class="tl-btn pri" id="ocrStartBtn"' + (canStart ? '' : ' disabled') + '>' + I.play + ' بدء استخراج النصوص</button>' +
        (state.running
          ? '<button type="button" class="tl-btn del" id="ocrStopBtn">' + I.stop + ' إيقاف المعالجة</button>'
          : '<button type="button" class="tl-btn" id="ocrRerunAllBtn"' + (hasItems ? '' : ' disabled') + '>' + I.refresh + ' إعادة استخراج الكل</button>') +
      '</div>' +
      ((state.running || state.batchTotal > 0) ? (
        '<div class="ocr-batch-prog" id="ocrBatchProg">' +
          '<div class="ocr-prog-head"><span id="ocrBatchStage">' + esc(state.currentStage || (state.running ? 'جارٍ التنفيذ…' : 'اكتملت الدفعة')) + '</span><small id="ocrBatchNums">' + state.batchDone + ' / ' + state.batchTotal + ' · ' + pct + '%</small></div>' +
          '<div class="tl-bar"><i id="ocrBatchBarFill" style="width:' + pct + '%"></i></div>' +
        '</div>'
      ) : '') +
      (hasItems ? (
        '<div class="ocr-footer-danger">' +
          '<span class="ocr-sec-meta">المحفوظ محلياً في جهازك</span>' +
          '<button type="button" class="tl-btn sm del" id="ocrClearAllBtn"' + (state.running ? ' disabled' : '') + '>' + I.trash + ' مسح جميع بيانات العمل</button>' +
        '</div>'
      ) : '');
  }

  function updateProgressUI() {
    if (!state.root) return;
    var stageEl = state.root.querySelector('#ocrBatchStage');
    var numsEl = state.root.querySelector('#ocrBatchNums');
    var fillEl = state.root.querySelector('#ocrBatchBarFill');
    if (!stageEl || !numsEl || !fillEl) return;

    var curFrac = state.running && state.batchDone < state.batchTotal ? (state.currentItemPct / 100) : 0;
    var pct = state.batchTotal > 0 ? Math.min(100, Math.round(((state.batchDone + curFrac) / state.batchTotal) * 100)) : 0;
    stageEl.textContent = state.currentStage || (state.running ? 'جارٍ التنفيذ…' : 'اكتملت المعالجة');
    numsEl.textContent = state.batchDone + ' / ' + state.batchTotal + ' · ' + pct + '%';
    fillEl.style.width = pct + '%';

    if (state.currentItemId) {
      var itemBar = state.root.querySelector('[data-qbar="' + state.currentItemId + '"]');
      var itemSt = state.root.querySelector('[data-qst="' + state.currentItemId + '"]');
      if (itemBar) itemBar.style.width = state.currentItemPct + '%';
      if (itemSt) itemSt.textContent = 'قيد المعالجة (' + state.currentItemPct + '%)';
    }
  }

  function itemStatusHtml(it) {
    if (it.status === 'processing') {
      return '<span class="st-work" data-qst="' + esc(it.id) + '">قيد المعالجة (' + (state.currentItemId === it.id ? state.currentItemPct : 0) + '%)</span>';
    }
    if (it.status === 'done') {
      return '<span class="st-done" data-qst="' + esc(it.id) + '">' + (it.noText ? 'اكتملت · لا يوجد نص واضح' : 'اكتملت · ' + countWords(it.text) + ' كلمة') + '</span>';
    }
    if (it.status === 'error') {
      return '<span class="st-err" data-qst="' + esc(it.id) + '">حدث خطأ: ' + esc(it.errorMsg || 'فشل الاستخراج') + '</span>';
    }
    return '<span data-qst="' + esc(it.id) + '">في الانتظار</span>';
  }

  function buildQueueItemInnerHtml(it, idx, total) {
    var isCurrent = state.running && state.currentItemId === it.id;
    var prepLabel = hasPrepEdits(it.prep) ? 'تحسين (معدّلة)' : 'تحسين';
    var dimLabel = (it.width && it.height) ? (it.width + '×' + it.height) : '';
    return (
      '<button type="button" class="ocr-thumb-btn" data-qact="prep" data-id="' + esc(it.id) + '" title="معاينة وتحسين الصورة">' +
        (it.thumb ? '<img src="' + it.thumb + '" alt="' + esc(it.name) + '">' : '') +
      '</button>' +
      '<div class="ocr-q-body">' +
        '<div class="ocr-q-top">' +
          '<div class="ocr-q-name" title="' + esc(it.name) + '">' + (idx + 1) + '. ' + esc(it.name) + '</div>' +
        '</div>' +
        '<div class="ocr-q-meta">' +
          itemStatusHtml(it) +
          (dimLabel ? ' · ' + dimLabel : '') +
        '</div>' +
        (isCurrent ? '<div class="tl-bar"><i data-qbar="' + esc(it.id) + '" style="width:' + state.currentItemPct + '%"></i></div>' : '') +
        '<div class="ocr-q-acts">' +
          '<button type="button" class="ocr-icon-btn" data-qact="up" data-id="' + esc(it.id) + '" aria-label="تحريك لأعلى"' + (state.running || idx === 0 ? ' disabled' : '') + '>' + I.up + '</button>' +
          '<button type="button" class="ocr-icon-btn" data-qact="down" data-id="' + esc(it.id) + '" aria-label="تحريك لأسفل"' + (state.running || idx === total - 1 ? ' disabled' : '') + '>' + I.down + '</button>' +
          '<button type="button" class="ocr-icon-btn" data-qact="prep" data-id="' + esc(it.id) + '"' + (state.running ? ' disabled' : '') + '>' + I.wand + ' ' + prepLabel + '</button>' +
          '<button type="button" class="ocr-icon-btn" data-qact="run1" data-id="' + esc(it.id) + '"' + (state.running ? ' disabled' : '') + '>' + I.refresh + '</button>' +
          '<button type="button" class="ocr-icon-btn del" data-qact="del" data-id="' + esc(it.id) + '" aria-label="حذف"' + (state.running ? ' disabled' : '') + '>' + I.trash + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function updateQueueItemUI(it) {
    if (!state.root) return;
    var row = state.root.querySelector('.ocr-q-item[data-id="' + it.id + '"]');
    if (!row) return;
    var idx = state.items.indexOf(it);
    row.className = 'ocr-q-item' + (state.running && state.currentItemId === it.id ? ' is-active' : '');
    row.innerHTML = buildQueueItemInnerHtml(it, idx, state.items.length);
  }

  function renderQueue() {
    if (!state.root) return;
    var countEl = state.root.querySelector('#ocrQueueCount');
    var qEl = state.root.querySelector('#ocrQueue');
    if (!qEl) return;

    if (countEl) {
      countEl.textContent = state.items.length ? (state.items.length + (state.items.length === 1 ? ' صورة' : ' صور')) : 'فارغة';
    }

    if (!state.items.length) {
      qEl.innerHTML = '<div class="ocr-empty-state">لم تُضف أي صور بعد.<br>اسحب صفحات المحاضرة أو الكتاب أو اخترها من جهازك للبدء.</div>';
      return;
    }

    qEl.innerHTML = state.items.map(function (it, idx) {
      var cls = 'ocr-q-item' + (state.running && state.currentItemId === it.id ? ' is-active' : '');
      return '<div class="' + cls + '" draggable="' + (!state.running ? 'true' : 'false') + '" data-id="' + esc(it.id) + '" data-idx="' + idx + '">' +
        buildQueueItemInnerHtml(it, idx, state.items.length) +
      '</div>';
    }).join('');
  }

  function effectiveDir(it) {
    if (it.dir === 'rtl' || it.dir === 'ltr') return it.dir;
    var t = String(it.text || '').trim();
    if (!t) return state.lang === 'eng' ? 'ltr' : 'rtl';
    return EX.detectTextDir(t, 'auto');
  }

  function renderResults() {
    if (!state.root) return;
    var tabCards = state.root.querySelector('#ocrTabCards');
    var tabMerged = state.root.querySelector('#ocrTabMerged');
    if (tabCards) tabCards.setAttribute('aria-selected', state.activeTab === 'cards' ? 'true' : 'false');
    if (tabMerged) tabMerged.setAttribute('aria-selected', state.activeTab === 'merged' ? 'true' : 'false');

    var area = state.root.querySelector('#ocrResultsArea');
    if (!area) return;

    if (!state.items.length) {
      area.innerHTML = '<div class="ocr-empty-state">ستظهر هنا النصوص المستخرجة لكل صورة مع أدوات التعديل والدمج والتصدير بصيغ Word وTXT وPDF.</div>';
      return;
    }

    if (state.activeTab === 'merged') {
      var mergedVal = getMergedText();
      var totalWords = countWords(mergedVal);
      var mergedDir = mergedVal.trim() ? EX.detectTextDir(mergedVal, 'auto') : (state.lang === 'eng' ? 'ltr' : 'rtl');
      area.innerHTML =
        '<div class="ocr-res-card">' +
          '<div class="ocr-res-head">' +
            '<div>' +
              '<div class="ocr-res-name">المستند الموحّد (' + state.items.length + ' صفحات)</div>' +
              '<div class="ocr-res-sub">' + totalWords + ' كلمة · مرتب حسب ترتيب الصور الحالي</div>' +
            '</div>' +
            '<button type="button" class="tl-btn sm" id="ocrRebuildMergedBtn">' + I.refresh + ' تحديث التجميع من الصفحات</button>' +
          '</div>' +
          '<textarea class="ocr-ta merged" id="ocrMergedTa" dir="' + mergedDir + '" placeholder="سيُجمّع النص المستخرج من جميع الصور هنا تلقائياً…">' + esc(mergedVal) + '</textarea>' +
          '<div class="ocr-export-bar">' +
            '<button type="button" class="tl-btn sm" id="ocrCopyAllBtn">' + I.copy + ' نسخ الكل</button>' +
            '<button type="button" class="tl-btn sm" id="ocrExpTxtAll">' + I.download + ' تصدير TXT</button>' +
            '<button type="button" class="tl-btn sm pri" id="ocrExpDocxAll">' + I.doc + ' تصدير Word (.docx)</button>' +
            '<button type="button" class="tl-btn sm" id="ocrPrintAll">' + I.print + ' طباعة / حفظ PDF</button>' +
          '</div>' +
        '</div>';
      return;
    }

    area.innerHTML =
      '<div class="ocr-results-list">' +
      state.items.map(function (it, idx) {
        var dir = effectiveDir(it);
        var words = countWords(it.text);
        var subParts = [];
        if (it.status === 'waiting') subParts.push('بانتظار الاستخراج');
        else if (it.status === 'processing') subParts.push('جارٍ الاستخراج الآن…');
        else if (it.status === 'error') subParts.push('فشل الاستخراج');
        else if (it.noText) subParts.push('لم يُكتشف نص واضح');
        else subParts.push(words + ' كلمة');
        if (it.editedByUser) subParts.push('تم التعديل يدوياً');

        return (
          '<article class="ocr-res-card" data-card-id="' + esc(it.id) + '">' +
            '<div class="ocr-res-head">' +
              '<div class="ocr-res-title">' +
                '<span class="ocr-res-num">' + (idx + 1) + '</span>' +
                '<div style="min-width:0">' +
                  '<div class="ocr-res-name" title="' + esc(it.name) + '">' + esc(it.name) + '</div>' +
                  '<div class="ocr-res-sub" data-card-sub="' + esc(it.id) + '">' + esc(subParts.join(' · ')) + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="ocr-dir-group" role="group" aria-label="اتجاه النص">' +
                '<button type="button" class="ocr-dir-btn" data-ract="dir" data-dir="auto" data-id="' + esc(it.id) + '" aria-pressed="' + ((it.dir || 'auto') === 'auto' ? 'true' : 'false') + '">تلقائي</button>' +
                '<button type="button" class="ocr-dir-btn" data-ract="dir" data-dir="rtl" data-id="' + esc(it.id) + '" aria-pressed="' + (it.dir === 'rtl' ? 'true' : 'false') + '">عربي</button>' +
                '<button type="button" class="ocr-dir-btn" data-ract="dir" data-dir="ltr" data-id="' + esc(it.id) + '" aria-pressed="' + (it.dir === 'ltr' ? 'true' : 'false') + '">EN</button>' +
              '</div>' +
            '</div>' +
            (it.noText && it.status === 'done' ? '<div class="tl-msg warn" style="margin:0">لم يُكتشف نص واضح في هذه الصورة. جرّب تدويرها أو تحسين التباين عبر زر «تحسين» ثم إعادة الاستخراج.</div>' : '') +
            (it.status === 'error' ? '<div class="tl-msg bad" style="margin:0">' + esc(it.errorMsg || 'حدث خطأ أثناء معالجة الصورة') + '</div>' : '') +
            '<textarea class="ocr-ta" dir="' + dir + '" data-ta-id="' + esc(it.id) + '" placeholder="النص المستخرج لهذه الصفحة يظهر هنا ويمكنك تعديله بحرية…">' + esc(it.text || '') + '</textarea>' +
            '<div class="ocr-res-actions">' +
              '<button type="button" class="tl-btn sm" data-ract="copy" data-id="' + esc(it.id) + '">' + I.copy + ' نسخ</button>' +
              '<button type="button" class="tl-btn sm" data-ract="txt" data-id="' + esc(it.id) + '">' + I.download + ' TXT</button>' +
              '<button type="button" class="tl-btn sm pri" data-ract="docx" data-id="' + esc(it.id) + '">' + I.doc + ' Word</button>' +
              '<button type="button" class="tl-btn sm" data-ract="rerun" data-id="' + esc(it.id) + '"' + (state.running ? ' disabled' : '') + '>' + I.refresh + ' إعادة الاستخراج</button>' +
            '</div>' +
          '</article>'
        );
      }).join('') +
      '</div>';
  }

  function renderAll() {
    renderOfflineBar();
    renderControls();
    renderQueue();
    renderResults();
  }

  /* ---------- ربط الأحداث ---------- */
  function findItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function bindEvents() {
    var root = state.root;
    var drop = root.querySelector('#ocrDropZone');
    var fileIn = root.querySelector('#ocrFileInput');

    drop.addEventListener('click', function () {
      if (state.running) return;
      fileIn.click();
    });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!state.running) fileIn.click();
      }
    });
    fileIn.addEventListener('change', function () {
      if (fileIn.files && fileIn.files.length) handleFiles(fileIn.files);
      fileIn.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.remove('drag');
      });
    });
    drop.addEventListener('drop', function (e) {
      if (state.running) return;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    });

    /* سحب لإعادة ترتيب الصور في القائمة */
    var queueEl = root.querySelector('#ocrQueue');
    queueEl.addEventListener('dragstart', function (e) {
      var row = e.target.closest('.ocr-q-item');
      if (!row || state.running) return;
      state.dragIndex = parseInt(row.dataset.idx, 10);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    queueEl.addEventListener('dragover', function (e) {
      var row = e.target.closest('.ocr-q-item');
      if (!row || state.dragIndex < 0) return;
      e.preventDefault();
      row.classList.add('is-dragover');
    });
    queueEl.addEventListener('dragleave', function (e) {
      var row = e.target.closest('.ocr-q-item');
      if (row) row.classList.remove('is-dragover');
    });
    queueEl.addEventListener('drop', function (e) {
      var row = e.target.closest('.ocr-q-item');
      if (!row) return;
      row.classList.remove('is-dragover');
      var toIdx = parseInt(row.dataset.idx, 10);
      var fromIdx = state.dragIndex;
      state.dragIndex = -1;
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        e.preventDefault();
        reorderByIndex(fromIdx, toIdx);
      }
    });

    root.addEventListener('click', function (e) {
      var offlineBtn = e.target.closest('#ocrPrepOfflineBtn');
      if (offlineBtn) { handlePrepareOffline(); return; }

      var langBtn = e.target.closest('.ocr-lang-btn[data-lang]');
      if (langBtn && !state.running) {
        state.lang = langBtn.dataset.lang;
        ST.setMeta('lang', state.lang).catch(function () {});
        renderAll();
        return;
      }

      var psmBtn = e.target.closest('.ocr-psm-btn[data-psm]');
      if (psmBtn && !state.running) {
        state.psm = psmBtn.dataset.psm;
        ST.setMeta('psm', state.psm).catch(function () {});
        renderControls();
        return;
      }

      if (e.target.closest('#ocrStartBtn')) { runQueue(null); return; }
      if (e.target.closest('#ocrStopBtn')) { stopRun(); return; }
      if (e.target.closest('#ocrRerunAllBtn')) {
        runQueue(state.items.map(function (it) { return it.id; }));
        return;
      }
      if (e.target.closest('#ocrClearAllBtn')) { confirmClearAll(); return; }

      var tabBtn = e.target.closest('.ocr-tab-btn[data-tab]');
      if (tabBtn) {
        state.activeTab = tabBtn.dataset.tab;
        renderResults();
        return;
      }

      var qBtn = e.target.closest('[data-qact]');
      if (qBtn) {
        var qid = qBtn.dataset.id;
        var qact = qBtn.dataset.qact;
        var item = findItem(qid);
        if (!item) return;
        var idx = state.items.indexOf(item);
        if (qact === 'up') moveItem(idx, -1);
        else if (qact === 'down') moveItem(idx, 1);
        else if (qact === 'prep') openPreprocessModal(item);
        else if (qact === 'run1') runQueue([item.id]);
        else if (qact === 'del') removeItem(item.id);
        return;
      }

      var rBtn = e.target.closest('[data-ract]');
      if (rBtn) {
        var rid = rBtn.dataset.id;
        var ract = rBtn.dataset.ract;
        var rit = findItem(rid);
        if (!rit) return;
        if (ract === 'dir') {
          rit.dir = rBtn.dataset.dir || 'auto';
          ST.putItem(rit).catch(function () {});
          renderResults();
        } else if (ract === 'copy') {
          copyTextToClipboard(rit.text);
        } else if (ract === 'txt') {
          EX.downloadTxt(rit.text, rit.name);
          toast('تم تصدير ملف TXT');
        } else if (ract === 'docx') {
          EX.downloadDocx(buildExportPages(rit), rit.name, rit.name);
          toast('تم تصدير ملف Word (.docx)');
        } else if (ract === 'rerun') {
          runQueue([rit.id]);
        }
        return;
      }

      if (e.target.closest('#ocrRebuildMergedBtn')) {
        state.mergedDirty = false;
        state.mergedText = buildMergedText();
        renderResults();
        toast('تم إعادة تجميع النص حسب ترتيب الصور');
        return;
      }
      if (e.target.closest('#ocrCopyAllBtn')) {
        copyTextToClipboard(getMergedText());
        return;
      }
      if (e.target.closest('#ocrExpTxtAll')) {
        EX.downloadTxt(getMergedText(), 'ocr-merged-pages');
        toast('تم تصدير النص الموحّد (TXT)');
        return;
      }
      if (e.target.closest('#ocrExpDocxAll')) {
        EX.downloadDocx(buildExportPages(null), 'ocr-merged-pages', 'النصوص المستخرجة من الصور');
        toast('تم تصدير ملف Word (.docx)');
        return;
      }
      if (e.target.closest('#ocrPrintAll')) {
        try {
          EX.printPages(buildExportPages(null), 'النصوص المستخرجة من الصور');
        } catch (err) {
          toast('تعذّرت الطباعة على هذا المتصفح');
        }
      }
    });

    /* حفظ فوري لتعديلات الطالب في IndexedDB دون استنزاف الأداء */
    var saveTimers = {};
    root.addEventListener('input', function (e) {
      var ta = e.target.closest('textarea[data-ta-id]');
      if (ta) {
        var id = ta.dataset.taId;
        var it = findItem(id);
        if (!it) return;
        it.text = ta.value;
        it.editedByUser = true;
        it.noText = !it.text.trim();
        if ((it.dir || 'auto') === 'auto') ta.dir = EX.detectTextDir(it.text, 'auto');
        var sub = root.querySelector('[data-card-sub="' + id + '"]');
        if (sub) sub.textContent = countWords(it.text) + ' كلمة · تم التعديل يدوياً';
        clearTimeout(saveTimers[id]);
        saveTimers[id] = setTimeout(function () {
          ST.putItem(it).catch(function () {});
        }, 250);
        return;
      }

      if (e.target && e.target.id === 'ocrMergedTa') {
        state.mergedDirty = true;
        state.mergedText = e.target.value;
      }
    });

    addEventListener('online', refreshOfflineStatus);
    addEventListener('offline', refreshOfflineStatus);
    addEventListener('beforeunload', function () {
      terminateActiveWorker();
    });
  }

  /* ---------- التهيئة والتكامل مع tools.js ---------- */
  async function init(container) {
    state.root = container;
    container.innerHTML = buildShellHtml();
    bindEvents();

    try {
      var savedLang = await ST.getMeta('lang', 'ara');
      if (savedLang && LANGS.some(function (l) { return l.id === savedLang; })) {
        state.lang = savedLang;
      }
      var savedPsm = await ST.getMeta('psm', '6');
      if (savedPsm && PSMS.some(function (p) { return p.id === savedPsm; })) {
        state.psm = savedPsm;
      }
      var items = await ST.getAllItems();
      state.items = (items || []).map(function (it) {
        if (it.status === 'processing') it.status = 'waiting';
        return it;
      });
    } catch (e) {
      state.items = [];
    }

    renderAll();
    refreshOfflineStatus();
  }

  function refresh() {
    if (!state.root) return;
    renderOfflineBar();
    refreshOfflineStatus();
  }

  window.OCR = {
    init: init,
    refresh: refresh
  };
})();
