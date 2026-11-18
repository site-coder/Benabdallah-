/* ==========================================================================
   other-engine.js — محرك «باقي التخصصات الجامعية» (محلي 100% دون ذكاء اصطناعي)
   - التحقق من الملفات والصور، استخراج النصوص (PDF / PDF OCR / DOCX / DOC / PPTX / PPT / TXT / RTF / صور)
   - التخزين المحلي في IndexedDB (edu-other-majors)
   - استخراج المفاهيم والحقائق والتسلسلات وتوليد أسئلة الأدوات 2–7 محلياً بدقة مع حفظ المصدر
   ========================================================================== */
(function (root) {
  'use strict';

  var DB_NAME = 'edu-other-majors';
  var DB_VER = 1;
  var STORE_NAME = 'lectures';

  var FILE_EXTS = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'rtf'];
  var IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
  var MAX_FILE_BYTES = 35 * 1024 * 1024;
  var MAX_IMG_BYTES = 15 * 1024 * 1024;
  var MAX_IMGS = 30;
  var MAX_OCR_PDF_PAGES = 35;

  function baseUrl(rel) {
    if (root.PDFShared && typeof root.PDFShared.baseUrl === 'function') {
      return root.PDFShared.baseUrl(rel);
    }
    try { return new URL(rel, document.baseURI).href; } catch (e) { return rel; }
  }

  function uid(prefix) {
    return (prefix || 'om') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || '').trim());
    return m ? m[1].toLowerCase() : '';
  }

  function formatBytes(n) {
    if (root.PDFShared && typeof root.PDFShared.formatBytes === 'function') {
      return root.PDFShared.formatBytes(n);
    }
    if (!n || n < 1024) return (n || 0) + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  /* ==========================================================================
     1) IndexedDB Persistence (edu-other-majors)
     ========================================================================== */
  var _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('المتصفح لا يدعم IndexedDB، لذلك لا يمكن حفظ المحاضرات والملفات محلياً.'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var s = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) {
        _dbPromise = null;
        reject(e.target.error || new Error('تعذّر فتح قاعدة البيانات المحلية (IndexedDB).'));
      };
    });
    return _dbPromise;
  }

  function wrapDbErr(err) {
    if (err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''))) {
      return new Error('مساحة التخزين المحلي ممتلئة. يرجى حذف بعض المحاضرات المحفوظة ثم المحاولة مجدداً.');
    }
    return err instanceof Error ? err : new Error(String(err || 'خطأ في التخزين المحلي'));
  }

  var Store = {
    isSupported: function () {
      return typeof indexedDB !== 'undefined';
    },
    list: function () {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = function () {
            var rows = req.result || [];
            rows.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
            resolve(rows);
          };
          req.onerror = function () { reject(wrapDbErr(req.error)); };
        });
      });
    },
    get: function (id) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { reject(wrapDbErr(req.error)); };
        });
      });
    },
    put: function (record) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = function () { resolve(record); };
          tx.onerror = function () { reject(wrapDbErr(tx.error)); };
          tx.onabort = function () { reject(wrapDbErr(tx.error || new Error('تم إلغاء الحفظ المحلي'))); };
        });
      });
    },
    remove: function (id) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(wrapDbErr(tx.error)); };
        });
      });
    }
  };

  /* ==========================================================================
     2) Validation
     ========================================================================== */
  function validateFile(file) {
    if (!file) return { ok: false, error: 'يرجى اختيار ملف واحد أولاً.' };
    var ext = extOf(file.name);
    if (FILE_EXTS.indexOf(ext) === -1) {
      return {
        ok: false,
        error: 'صيغة الملف «' + (ext || 'غير معروفة') + '» غير مدعومة. الصيغ المسموحة: PDF، DOCX، DOC، PPTX، PPT، TXT، RTF.'
      };
    }
    var mime = String(file.type || '').toLowerCase();
    if (mime && (mime.indexOf('image/') === 0 || mime.indexOf('video/') === 0 || mime.indexOf('audio/') === 0)) {
      return { ok: false, error: 'نوع الملف لا يطابق الامتداد. في هذه الطريقة يُسمح بالمستندات فقط، وللصور استخدم «رفع صور».' };
    }
    if (ext === 'pdf' && mime && mime !== 'application/pdf' && mime !== 'application/x-pdf' && mime !== 'application/octet-stream') {
      return { ok: false, error: 'نوع الملف (' + mime + ') لا يتطابق مع ملف PDF.' };
    }
    if (!file.size) {
      return { ok: false, error: 'الملف المختار فارغ (0 بايت) ولا يمكن قراءته.' };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: 'حجم الملف (' + formatBytes(file.size) + ') يتجاوز الحد المسموح به (' + formatBytes(MAX_FILE_BYTES) + ').' };
    }
    return { ok: true, ext: ext };
  }

  function validateImages(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return { ok: false, error: 'يرجى اختيار صورة واحدة على الأقل.' };
    if (list.length > MAX_IMGS) {
      return { ok: false, error: 'الحد الأقصى للصور في الجلسة الواحدة هو ' + MAX_IMGS + ' صورة لتفادي استهلاك ذاكرة الجهاز.' };
    }
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var ext = extOf(f.name);
      var mime = String(f.type || '').toLowerCase();
      var okExt = IMG_EXTS.indexOf(ext) !== -1;
      var okMime = !mime || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png' || mime === 'image/webp';
      if (!okExt || !okMime) {
        return {
          ok: false,
          error: 'الصورة «' + f.name + '» بصيغة غير مدعومة. الصيغ المسموحة للصور: JPG، JPEG، PNG، WEBP فقط.'
        };
      }
      if (!f.size) {
        return { ok: false, error: 'الصورة «' + f.name + '» فارغة (0 بايت) ولا يمكن معالجتها.' };
      }
      if (f.size > MAX_IMG_BYTES) {
        return {
          ok: false,
          error: 'حجم الصورة «' + f.name + '» (' + formatBytes(f.size) + ') يتجاوز الحد المسموح (' + formatBytes(MAX_IMG_BYTES) + ').'
        };
      }
    }
    return { ok: true, files: list };
  }

  /* ==========================================================================
     3) Text Cleaning & Normalization
     ========================================================================== */
  var RE_DIAC = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  var RE_ZW = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

  function normAr(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) { /* ignore */ }
    s = s.replace(RE_ZW, '')
      .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x660); })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x6F0); })
      .replace(RE_DIAC, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ء/g, '')
      .toLowerCase();
    return s.replace(/[^\u0621-\u064A0-9a-z]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cleanExtractedText(text) {
    var s = String(text == null ? '' : text);
    try { s = s.normalize('NFKC'); } catch (e) { /* ignore */ }
    s = s.replace(/\r\n?/g, '\n')
      .replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    var lines = s.split('\n').map(function (ln) {
      return ln.replace(/[ \t\u00A0]+/g, ' ').trim();
    });
    var out = [], blankRun = 0;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) {
        if (out.length && blankRun === 0) { out.push(''); blankRun = 1; }
        continue;
      }
      blankRun = 0;
      out.push(l);
    }
    return out.join('\n').trim();
  }

  function cleanOcrText(text) {
    var base = cleanExtractedText(text);
    var lines = base.split('\n').filter(function (ln) {
      if (!ln) return true;
      /* تجاهل أسطر الضوضاء المعزولة مثل «|» أو «/ - _» */
      if (ln.length <= 2 && !/[\u0621-\u064A0-9a-zA-Z]/.test(ln)) return false;
      return true;
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ==========================================================================
     4) File Format Parsers (TXT, RTF, DOCX, PPTX, DOC/PPT, PDF, Images)
     ========================================================================== */
  function startsWithBytes(u8, arr) {
    if (!u8 || u8.length < arr.length) return false;
    for (var i = 0; i < arr.length; i++) if (u8[i] !== arr[i]) return false;
    return true;
  }

  function isZipMagic(u8) {
    return startsWithBytes(u8, [0x50, 0x4B, 0x03, 0x04]) || startsWithBytes(u8, [0x50, 0x4B, 0x05, 0x06]);
  }

  function isOleMagic(u8) {
    return startsWithBytes(u8, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  }

  function isPdfMagic(u8) {
    return startsWithBytes(u8, [0x25, 0x50, 0x44, 0x46]); // %PDF
  }

  function looksLikeRtf(u8) {
    var head = '';
    var i = 0;
    if (u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) i = 3;
    while (i < u8.length && (u8[i] === 0x20 || u8[i] === 0x09 || u8[i] === 0x0D || u8[i] === 0x0A)) i++;
    for (var k = 0; k < 6 && i + k < u8.length; k++) head += String.fromCharCode(u8[i + k]);
    return head.indexOf('{\\rtf') === 0;
  }

  function decodeTxtBytes(u8) {
    var nul = 0, ctrl = 0, sampleLen = Math.min(u8.length, 4096);
    for (var i = 0; i < sampleLen; i++) {
      var b = u8[i];
      if (b === 0) nul++;
      else if (b < 0x09 || (b > 0x0D && b < 0x20)) ctrl++;
    }
    if (nul > 2 || ctrl / Math.max(1, sampleLen) > 0.12) {
      throw new Error('يبدو أن ملف TXT يحتوي على بيانات ثنائية غير نصية ولا يمكن قراءته.');
    }
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
      return cleanExtractedText(new TextDecoder('utf-16le').decode(u8));
    }
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
      return cleanExtractedText(new TextDecoder('utf-16be').decode(u8));
    }
    try {
      return cleanExtractedText(new TextDecoder('utf-8', { fatal: true }).decode(u8));
    } catch (e) {
      try {
        return cleanExtractedText(new TextDecoder('windows-1256').decode(u8));
      } catch (e2) {
        return cleanExtractedText(new TextDecoder('utf-8').decode(u8));
      }
    }
  }

  /* ---- RTF Parser supporting Arabic (\uN and \'hh Windows-1256) ---- */
  function parseRtfBytes(u8) {
    var src = '';
    for (var i = 0; i < u8.length; i++) src += String.fromCharCode(u8[i]);
    var trimStart = src.replace(/^\u00EF\u00BB\u00BF/, '').trim();
    if (trimStart.indexOf('{\\rtf') !== 0) {
      throw new Error('ملف RTF غير صالح أو تالف.');
    }

    var codepage = 'windows-1256';
    var cpMatch = /\\ansicpg(\d+)/.exec(trimStart.slice(0, 500));
    if (cpMatch && cpMatch[1] === '1252') codepage = 'windows-1252';
    var hasArabicCpg = /\\ansicpg1256|\\fcharset178|\\rtlpar/.test(trimStart.slice(0, 4000));
    if (hasArabicCpg) codepage = 'windows-1256';

    var SKIP_DEST = {
      fonttbl: 1, colortbl: 1, stylesheet: 1, info: 1, pict: 1, object: 1,
      header: 1, headerl: 1, headerr: 1, headerf: 1,
      footer: 1, footerl: 1, footerr: 1, footerf: 1,
      listtable: 1, listoverridetable: 1, revtbl: 1, rsidtbl: 1,
      generator: 1, xmlnstbl: 1, themedata: 1, colorschememapping: 1,
      datastore: 1, latentstyles: 1, mmathPr: 1
    };

    var dec1256 = null;
    try { dec1256 = new TextDecoder(codepage); } catch (e) { dec1256 = new TextDecoder('utf-8'); }

    var stack = [{ uc: 1, skip: false }];
    var out = [];
    var hexRun = [];
    var skipNext = 0;

    function flushHex() {
      if (!hexRun.length) return;
      out.push(dec1256.decode(new Uint8Array(hexRun)));
      hexRun = [];
    }

    var len = trimStart.length;
    for (var pos = 0; pos < len; pos++) {
      var ch = trimStart.charAt(pos);
      var st = stack[stack.length - 1];

      if (ch === '{') {
        flushHex();
        stack.push({ uc: st.uc, skip: st.skip });
        continue;
      }
      if (ch === '}') {
        flushHex();
        if (stack.length > 1) stack.pop();
        continue;
      }
      if (ch === '\r' || ch === '\n') continue;

      if (ch === '\\') {
        pos++;
        if (pos >= len) break;
        var next = trimStart.charAt(pos);

        if (next === '\\' || next === '{' || next === '}') {
          flushHex();
          if (!st.skip) {
            if (skipNext > 0) skipNext--;
            else out.push(next);
          }
          continue;
        }
        if (next === '*') {
          flushHex();
          st.skip = true;
          continue;
        }
        if (next === "'") {
          var hx = trimStart.slice(pos + 1, pos + 3);
          if (/^[0-9a-fA-F]{2}$/.test(hx)) {
            pos += 2;
            if (!st.skip) {
              if (skipNext > 0) skipNext--;
              else hexRun.push(parseInt(hx, 16));
            }
          }
          continue;
        }
        if (next === '~') { flushHex(); if (!st.skip) out.push(' '); continue; }
        if (next === '_' || next === '-') { flushHex(); if (!st.skip) out.push('-'); continue; }
        if (next === '\n' || next === '\r') { flushHex(); if (!st.skip) out.push('\n'); continue; }

        /* Control word */
        flushHex();
        var cw = '';
        while (pos < len && /[a-zA-Z]/.test(trimStart.charAt(pos))) {
          cw += trimStart.charAt(pos);
          pos++;
        }
        var paramStr = '';
        if (pos < len && (trimStart.charAt(pos) === '-' || /[0-9]/.test(trimStart.charAt(pos)))) {
          paramStr += trimStart.charAt(pos);
          pos++;
          while (pos < len && /[0-9]/.test(trimStart.charAt(pos))) {
            paramStr += trimStart.charAt(pos);
            pos++;
          }
        }
        if (pos < len && trimStart.charAt(pos) === ' ') {
          /* consume delimiter space */
        } else {
          pos--;
        }

        if (SKIP_DEST[cw]) {
          st.skip = true;
          continue;
        }
        if (st.skip) continue;

        if (cw === 'uc') {
          st.uc = paramStr !== '' ? Math.max(0, parseInt(paramStr, 10)) : 1;
        } else if (cw === 'u' && paramStr !== '') {
          var code = parseInt(paramStr, 10);
          if (code < 0) code += 65536;
          if (code >= 0) out.push(String.fromCharCode(code));
          skipNext = st.uc;
        } else if (cw === 'par' || cw === 'line' || cw === 'row') {
          out.push('\n');
        } else if (cw === 'tab') {
          out.push('\t');
        } else if (cw === 'cell') {
          out.push(' | ');
        } else if (cw === 'emdash') {
          out.push('—');
        } else if (cw === 'endash') {
          out.push('–');
        } else if (cw === 'lquote' || cw === 'rquote') {
          out.push("'");
        } else if (cw === 'ldblquote' || cw === 'rdblquote') {
          out.push('"');
        } else if (cw === 'bullet') {
          out.push('• ');
        }
        continue;
      }

      flushHex();
      if (st.skip) continue;
      if (skipNext > 0) {
        skipNext--;
        continue;
      }
      out.push(ch);
    }
    flushHex();
    return cleanExtractedText(out.join(''));
  }

  /* ---- Ensure JSZip (already bundled inside vendor/pptxgen.bundle.js) ---- */
  var _jszipPromise = null;
  function ensureJSZip() {
    if (root.JSZip) return Promise.resolve(root.JSZip);
    if (typeof require === 'function') {
      try {
        var mod = require('jszip');
        if (mod) return Promise.resolve(mod);
      } catch (e) { /* ignore */ }
    }
    if (_jszipPromise) return _jszipPromise;
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('مكتبة JSZip المحلية غير متوفرة في هذه البيئة.'));
    }
    _jszipPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src*="pptxgen.bundle.js"]');
      if (existing) {
        if (root.JSZip) { resolve(root.JSZip); return; }
        existing.addEventListener('load', function () {
          if (root.JSZip) resolve(root.JSZip);
          else reject(new Error('تعذّر تحميل أداة فك حزم الملفات المحلية.'));
        });
        existing.addEventListener('error', function () {
          _jszipPromise = null;
          reject(new Error('تعذّر تحميل vendor/pptxgen.bundle.js محلياً.'));
        });
        return;
      }
      var s = document.createElement('script');
      s.src = baseUrl('./vendor/pptxgen.bundle.js');
      s.onload = function () {
        if (root.JSZip) resolve(root.JSZip);
        else reject(new Error('تعذّر تهيئة أداة قراءة DOCX/PPTX المحلية.'));
      };
      s.onerror = function () {
        _jszipPromise = null;
        reject(new Error('تعذّر تحميل vendor/pptxgen.bundle.js.'));
      };
      document.head.appendChild(s);
    });
    return _jszipPromise;
  }

  function parseXmlDoc(xmlText) {
    if (typeof DOMParser !== 'undefined') {
      return new DOMParser().parseFromString(xmlText, 'text/xml');
    }
    return null;
  }

  /* خفيف واحتياطي لبيئة Node أثناء الاختبار إذا غاب DOMParser */
  function regexStripXmlTags(xml, paraTag, textTag) {
    var paraRe = new RegExp('<' + paraTag + '\\b[\\s\\S]*?<\\/' + paraTag + '>', 'g');
    var tRe = new RegExp('<' + textTag + '\\b[^>]*>([\\s\\S]*?)<\\/' + textTag + '>', 'g');
    var decodeEnt = function (s) {
      return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    };
    var lines = [], pm;
    while ((pm = paraRe.exec(xml))) {
      var block = pm[0], tm, txt = '';
      tRe.lastIndex = 0;
      while ((tm = tRe.exec(block))) txt += decodeEnt(tm[1]);
      if (txt.trim()) lines.push(txt.trim());
    }
    return lines.join('\n');
  }

  function docxXmlToText(xmlText) {
    var doc = parseXmlDoc(xmlText);
    if (!doc || !doc.documentElement) {
      return regexStripXmlTags(xmlText, 'w:p', 'w:t');
    }
    var out = [];
    function extractPara(pNode) {
      var parts = [];
      function walk(n) {
        if (!n) return;
        if (n.nodeType === 1) {
          var ln = n.localName || n.nodeName.replace(/^.*:/, '');
          if (ln === 't' || ln === 'delText') {
            parts.push(n.textContent || '');
            return;
          }
          if (ln === 'tab') { parts.push(' '); return; }
          if (ln === 'br' || ln === 'cr') { parts.push('\n'); return; }
          for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
        }
      }
      walk(pNode);
      return parts.join('').replace(/[ \t]+/g, ' ').trim();
    }

    function walkBody(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        var ln = c.localName || c.nodeName.replace(/^.*:/, '');
        if (ln === 'p') {
          var line = extractPara(c);
          if (line) out.push(line);
          else if (out.length && out[out.length - 1] !== '') out.push('');
        } else if (ln === 'tbl') {
          var rows = c.getElementsByTagNameNS ? c.getElementsByTagNameNS('*', 'tr') : c.getElementsByTagName('w:tr');
          for (var r = 0; r < rows.length; r++) {
            var cells = rows[r].getElementsByTagNameNS ? rows[r].getElementsByTagNameNS('*', 'tc') : rows[r].getElementsByTagName('w:tc');
            var rowText = [];
            for (var k = 0; k < cells.length; k++) {
              var ps = cells[k].getElementsByTagNameNS ? cells[k].getElementsByTagNameNS('*', 'p') : cells[k].getElementsByTagName('w:p');
              var cellParts = [];
              for (var pi = 0; pi < ps.length; pi++) {
                var pt = extractPara(ps[pi]);
                if (pt) cellParts.push(pt);
              }
              if (cellParts.length) rowText.push(cellParts.join(' '));
            }
            if (rowText.length) out.push(rowText.join(' | '));
          }
          out.push('');
        } else {
          walkBody(c);
        }
      }
    }
    walkBody(doc.documentElement);
    return out.join('\n');
  }

  function pptxXmlToText(xmlText) {
    var doc = parseXmlDoc(xmlText);
    if (!doc || !doc.documentElement) {
      return regexStripXmlTags(xmlText, 'a:p', 'a:t');
    }
    var out = [];
    var paras = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS('*', 'p') : doc.getElementsByTagName('a:p');
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var parts = [];
      (function walk(n) {
        for (var c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType !== 1) continue;
          var ln = c.localName || c.nodeName.replace(/^.*:/, '');
          if (ln === 't') parts.push(c.textContent || '');
          else if (ln === 'br') parts.push('\n');
          else walk(c);
        }
      })(p);
      var t = parts.join('').replace(/[ \t]+/g, ' ').trim();
      if (t) out.push(t);
    }
    return out.join('\n');
  }

  async function extractDocx(buf, onProgress) {
    var u8 = new Uint8Array(buf);
    if (looksLikeRtf(u8)) return parseRtfBytes(u8);
    if (isOleMagic(u8)) {
      throw new Error('هذا الملف محفوظ بصيغة DOC قديمة رغم أن امتداده DOCX. يرجى إعادة حفظه بصيغة DOCX حديثة أو PDF.');
    }
    if (!isZipMagic(u8)) {
      throw new Error('ملف DOCX تالف أو غير صالح.');
    }
    if (onProgress) onProgress({ pct: 35, text: 'جارٍ قراءة مستند DOCX محلياً…' });
    var JSZip = await ensureJSZip();
    var zip = await JSZip.loadAsync(buf);
    var docEntry = zip.file('word/document.xml');
    if (!docEntry) {
      throw new Error('تعذّر العثور على المحتوى النصي داخل ملف DOCX.');
    }
    var chunks = [docxXmlToText(await docEntry.async('string'))];
    var extras = ['word/footnotes.xml', 'word/endnotes.xml'];
    for (var i = 0; i < extras.length; i++) {
      var f = zip.file(extras[i]);
      if (f) {
        var extraTxt = docxXmlToText(await f.async('string'));
        if (extraTxt && extraTxt.trim()) chunks.push(extraTxt);
      }
    }
    var finalText = cleanExtractedText(chunks.join('\n\n'));
    if (!finalText) throw new Error('ملف DOCX لا يحتوي على نص قابل للاستخراج.');
    return finalText;
  }

  async function extractPptx(buf, onProgress) {
    var u8 = new Uint8Array(buf);
    if (isOleMagic(u8)) {
      throw new Error('هذا الملف محفوظ بصيغة PPT قديمة رغم أن امتداده PPTX. يرجى إعادة حفظه بصيغة PPTX حديثة أو PDF.');
    }
    if (!isZipMagic(u8)) {
      throw new Error('ملف PPTX تالف أو غير صالح.');
    }
    if (onProgress) onProgress({ pct: 35, text: 'جارٍ قراءة شرائح PPTX محلياً…' });
    var JSZip = await ensureJSZip();
    var zip = await JSZip.loadAsync(buf);
    var slideFiles = [];
    zip.forEach(function (relPath, entry) {
      var m = /^ppt\/slides\/slide(\d+)\.xml$/i.exec(relPath);
      if (m && !entry.dir) slideFiles.push({ num: parseInt(m[1], 10), entry: entry });
    });
    slideFiles.sort(function (a, b) { return a.num - b.num; });
    if (!slideFiles.length) {
      throw new Error('تعذّر العثور على شرائح نصية داخل ملف PPTX.');
    }
    var parts = [];
    for (var i = 0; i < slideFiles.length; i++) {
      var sf = slideFiles[i];
      if (onProgress) {
        onProgress({ pct: 35 + Math.round(((i + 1) / slideFiles.length) * 55), text: 'استخراج الشريحة ' + (i + 1) + ' من ' + slideFiles.length + '…' });
      }
      var slideTxt = pptxXmlToText(await sf.entry.async('string'));
      var noteFile = zip.file('ppt/notesSlides/notesSlide' + sf.num + '.xml');
      var noteTxt = noteFile ? pptxXmlToText(await noteFile.async('string')) : '';
      /* إزالة رقم الشريحة المعزول من الملاحظات إن وجد */
      noteTxt = noteTxt.replace(/^\d+$/gm, '').trim();
      if (slideTxt || noteTxt) {
        parts.push((slideTxt || '') + (noteTxt ? '\n' + noteTxt : ''));
      }
    }
    var finalText = cleanExtractedText(parts.join('\n\n'));
    if (!finalText) throw new Error('عرض PPTX لا يحتوي على نصوص قابلة للاستخراج (قد يكون مكوّناً من صور فقط).');
    return finalText;
  }

  /* ---- Legacy DOC & PPT ---- */
  function extractLegacyBinaryDocOrPpt(buf, ext) {
    var u8 = new Uint8Array(buf);
    if (looksLikeRtf(u8)) return parseRtfBytes(u8);
    if (isZipMagic(u8)) {
      return ext === 'ppt' ? extractPptx(buf) : extractDocx(buf);
    }
    var failMsg = ext === 'ppt'
      ? 'ملفات PPT الثنائية القديمة لا يمكن استخراج نصوصها بدقة وموثوقية عالية محلياً. يرجى فتح الملف وحفظه بصيغة PPTX أو PDF ثم إعادة رفعه.'
      : 'ملفات DOC الثنائية القديمة لا يمكن استخراج نصوصها بدقة وموثوقية عالية محلياً. يرجى فتح الملف وحفظه بصيغة DOCX أو PDF ثم إعادة رفعه.';

    if (!isOleMagic(u8)) {
      /* قد يكون نصاً عادياً أُعطي امتداد doc */
      try {
        var plain = decodeTxtBytes(u8);
        if (plain && plain.replace(/\s+/g, '').length >= 40) return plain;
      } catch (e) { /* ignore */ }
      throw new Error(failMsg);
    }

    /* محاولة حذرة لاستخراج النصوص الواضحة بترميز UTF-16LE من التدفق الثنائي لملف OLE2 */
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var runs = [], cur = '';
    var isReadableCp = function (cp) {
      return (cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x0020 && cp <= 0x007E) || cp === 0x000A || cp === 0x000D || cp === 0x0009;
    };
    for (var offset = 0; offset + 1 < u8.length; offset += 2) {
      var code = dv.getUint16(offset, true);
      if (isReadableCp(code)) {
        cur += code === 0x000D ? '\n' : String.fromCharCode(code);
      } else {
        if (cur.trim().length >= 24) runs.push(cur.trim());
        cur = '';
      }
    }
    if (cur.trim().length >= 24) runs.push(cur.trim());

    var NOISE_RE = /(?:Root Entry|SummaryInformation|DocumentSummaryInformation|WordDocument|Current User|PowerPoint Document|Times New Roman|Calibri|Tahoma|Arial|Cambria|Normal\.dot|Microsoft|bjbj|Hyperlink|^\s*[0-9A-F\-{}]{8,}\s*$)/i;
    var filtered = runs.filter(function (r) {
      if (NOISE_RE.test(r)) return false;
      var words = r.match(/[\u0621-\u064Aa-zA-Z]{2,}/g) || [];
      return words.length >= 4;
    });
    var joined = cleanExtractedText(filtered.join('\n'));
    var cleanChars = joined.replace(/\s+/g, '').length;
    var letterChars = (joined.match(/[\u0621-\u064Aa-zA-Z0-9]/g) || []).length;
    var ratio = cleanChars ? letterChars / cleanChars : 0;
    if (cleanChars >= 80 && ratio >= 0.72) {
      return joined;
    }
    throw new Error(failMsg);
  }

  /* ---- OCR Availability & Shared Worker Helper ---- */
  function detectOcrBase() {
    return baseUrl('./vendor/tesseract');
  }

  async function ensureOcrReady() {
    if (!root.Tesseract || typeof root.Tesseract.createWorker !== 'function') {
      throw new Error('محرك التعرف الضوئي المحلي (Tesseract.js) غير جاهز بعد.');
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false && root.OCRStore && typeof root.OCRStore.checkReadiness === 'function') {
      var rd = await root.OCRStore.checkReadiness();
      if (!rd.ready && !rd.cacheUnsupported) {
        throw new Error('التعرف الضوئي أوفلاين غير مهيّأ على هذا الجهاز. اتصل بالإنترنت مرة واحدة أو جهّز ملفات OCR أولاً.');
      }
    }
  }

  async function createOcrWorker(lang) {
    await ensureOcrReady();
    var tb = detectOcrBase();
    return root.Tesseract.createWorker(lang || 'ara+eng', 1, {
      workerPath: tb + '/worker.min.js',
      corePath: tb,
      langPath: tb + '/lang',
      workerBlobURL: false,
      gzip: true,
      logger: function () {}
    });
  }

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
        reject(new Error('تعذّر قراءة ملف الصورة.'));
      };
      img.src = url;
    });
  }

  function imageToCanvas(img, maxEdge) {
    var w = img.naturalWidth || img.width || 1;
    var h = img.naturalHeight || img.height || 1;
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    var ctx = cv.getContext('2d', { willReadFrequently: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    return cv;
  }

  function releaseCanvas(cv) {
    if (!cv) return;
    try { cv.width = 0; cv.height = 0; } catch (e) { /* ignore */ }
  }

  /* ---- PDF Text + Memory-Safe Scanned PDF OCR ---- */
  function pageItemsToText(items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var str = it.str;
      try { str = str.normalize('NFKC'); } catch (e) { /* ignore */ }
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
      var rtl = /[\u0600-\u06FF]/.test(joined);
      r.cells.sort(function (a, b) { return rtl ? b.x - a.x : a.x - b.x; });
      var line = '', last = null;
      r.cells.forEach(function (c) {
        if (last) {
          var gap = rtl ? (last.x - (c.x + c.w)) : (c.x - (last.x + last.w));
          if (gap > medH * 0.9) line += ' | ';
          else if (gap > medH * 0.15 && !/\s$/.test(line) && !/^\s/.test(c.s)) line += ' ';
        }
        line += c.s;
        last = c;
      });
      line = line.replace(/\s+/g, ' ').trim();
      if (!line) return;
      if (prevY !== null && prevY - r.y > medH * 1.9) out.push('');
      out.push(line);
      prevY = r.y;
    });
    return out.join('\n');
  }

  async function extractPdf(buf, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function () {};
    var signal = opts.signal || { cancelled: false };
    var u8 = new Uint8Array(buf);
    if (!isPdfMagic(u8)) {
      throw new Error('الملف لا يحمل ترويسة PDF صالحة أو أنه تالف.');
    }
    if (!root.PDFShared || typeof root.PDFShared.openPdfDoc !== 'function') {
      throw new Error('أداة PDF.js المحلية غير متوفرة.');
    }
    onProgress({ pct: 10, text: 'جارٍ فتح ملف PDF محلياً…' });
    var pdf = await root.PDFShared.openPdfDoc(u8.slice());
    try {
      var n = pdf.numPages || 0;
      if (!n) throw new Error('ملف PDF فارغ ولا يحتوي على صفحات.');
      var texts = [];
      for (var p = 1; p <= n; p++) {
        if (signal.cancelled) throw new Error('تم إلغاء المعالجة.');
        onProgress({ pct: 10 + Math.round((p / n) * 45), text: 'قراءة الصفحة ' + p + ' من ' + n + '…' });
        var page = await pdf.getPage(p);
        var tc = await page.getTextContent();
        texts.push(pageItemsToText(tc.items || []));
        if (typeof page.cleanup === 'function') page.cleanup();
      }
      var raw = cleanExtractedText(texts.join('\n\n'));
      var chars = raw.replace(/\s+/g, '').length;
      if (chars >= 25 && (chars / n) >= 30) {
        return raw;
      }

      /* PDF مصور: محاولة استخراج النص عبر OCR المحلي صفحة بصفحة بذاكرة محدودة */
      var ocrPages = Math.min(n, MAX_OCR_PDF_PAGES);
      onProgress({ pct: 58, text: 'يبدو أن الملف مصوّر، جارٍ تشغيل OCR المحلي على ' + ocrPages + ' صفحة…' });
      var worker = await createOcrWorker(opts.ocrLang || 'ara+eng');
      var ocrTexts = [];
      var cv = null;
      try {
        for (var op = 1; op <= ocrPages; op++) {
          if (signal.cancelled) throw new Error('تم إلغاء المعالجة.');
          onProgress({
            pct: 58 + Math.round((op / ocrPages) * 40),
            text: 'استخراج النص (OCR) من الصفحة ' + op + ' من ' + ocrPages + '…'
          });
          var pg = await pdf.getPage(op);
          var baseVp = pg.getViewport({ scale: 1 });
          var maxDim = Math.max(baseVp.width, baseVp.height) || 1000;
          var scale = Math.min(1.9, Math.max(1.1, 1450 / maxDim));
          var vp = pg.getViewport({ scale: scale });
          cv = document.createElement('canvas');
          cv.width = Math.round(vp.width);
          cv.height = Math.round(vp.height);
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cv.width, cv.height);
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          var rec = await worker.recognize(cv);
          var pageOcr = cleanOcrText(rec && rec.data && rec.data.text ? rec.data.text : '');
          if (pageOcr) ocrTexts.push(pageOcr);
          releaseCanvas(cv);
          cv = null;
          if (typeof pg.cleanup === 'function') pg.cleanup();
        }
      } finally {
        releaseCanvas(cv);
        try { await worker.terminate(); } catch (e) { /* ignore */ }
      }

      var mergedOcr = cleanExtractedText(ocrTexts.join('\n\n'));
      if (!mergedOcr || mergedOcr.replace(/\s+/g, '').length < 15) {
        throw new Error('تعذّر استخراج نص واضح من صفحات PDF المصوّر. جرّب صور أوضح أو صيغة نصية.');
      }
      if (n > MAX_OCR_PDF_PAGES) {
        mergedOcr += '\n\n[ملاحظة: تمت معالجة أول ' + MAX_OCR_PDF_PAGES + ' صفحة فقط للحفاظ على ذاكرة الجهاز.]';
      }
      return mergedOcr;
    } finally {
      try { pdf.destroy(); } catch (e) { /* ignore */ }
    }
  }

  async function extractFromFile(file, opts) {
    opts = opts || {};
    var v = validateFile(file);
    if (!v.ok) throw new Error(v.error);
    var onProgress = opts.onProgress || function () {};
    onProgress({ pct: 5, text: 'جارٍ قراءة الملف…' });
    var buf = await file.arrayBuffer();
    if (opts.signal && opts.signal.cancelled) throw new Error('تم إلغاء المعالجة.');
    var ext = v.ext;
    var text = '';
    if (ext === 'txt') {
      onProgress({ pct: 50, text: 'جارٍ فك ترميز الملف النصي…' });
      text = decodeTxtBytes(new Uint8Array(buf));
    } else if (ext === 'rtf') {
      onProgress({ pct: 50, text: 'جارٍ قراءة مستند RTF…' });
      text = parseRtfBytes(new Uint8Array(buf));
    } else if (ext === 'docx') {
      text = await extractDocx(buf, onProgress);
    } else if (ext === 'pptx') {
      text = await extractPptx(buf, onProgress);
    } else if (ext === 'doc' || ext === 'ppt') {
      onProgress({ pct: 40, text: 'جارٍ فحص بنية الملف…' });
      text = await extractLegacyBinaryDocOrPpt(buf, ext);
    } else if (ext === 'pdf') {
      text = await extractPdf(buf, opts);
    }
    text = cleanExtractedText(text);
    if (!text || text.replace(/\s+/g, '').length < 12) {
      throw new Error('الملف لا يحتوي على نص كافٍ قابل للدراسة. تأكد من سلامة الملف أو وضوحه.');
    }
    onProgress({ pct: 100, text: 'اكتمل استخراج النص' });
    return text;
  }

  async function extractFromImages(files, opts) {
    opts = opts || {};
    var v = validateImages(files);
    if (!v.ok) throw new Error(v.error);
    var list = v.files;
    var onProgress = opts.onProgress || function () {};
    var signal = opts.signal || { cancelled: false };
    onProgress({ pct: 8, text: 'جارٍ تهيئة محرك OCR المحلي…' });
    var worker = await createOcrWorker(opts.ocrLang || 'ara+eng');
    var results = [];
    var cv = null;
    try {
      for (var i = 0; i < list.length; i++) {
        if (signal.cancelled) throw new Error('تم إلغاء المعالجة.');
        onProgress({
          pct: 12 + Math.round(((i + 0.5) / list.length) * 85),
          text: 'استخراج النص من الصورة ' + (i + 1) + ' من ' + list.length + '…'
        });
        var img = await loadImageFromBlob(list[i]);
        cv = imageToCanvas(img, 1600);
        var rec = await worker.recognize(cv);
        releaseCanvas(cv);
        cv = null;
        var pageTxt = cleanOcrText(rec && rec.data && rec.data.text ? rec.data.text : '');
        if (pageTxt) results.push(pageTxt);
      }
    } finally {
      releaseCanvas(cv);
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }
    var merged = cleanExtractedText(results.join('\n\n'));
    if (!merged || merged.replace(/\s+/g, '').length < 12) {
      throw new Error('لم يتم العثور على نص واضح قابل للقراءة في الصور المختارة. جرّب صوراً أكثر وضوحاً وإضاءة.');
    }
    onProgress({ pct: 100, text: 'اكتمل استخراج النصوص من الصور' });
    return merged;
  }

  /* ==========================================================================
     5) Local NLP Knowledge Extraction & Question Generation (Tools 2-7)
     ========================================================================== */
  var AR_STOP = {
    'في': 1, 'من': 1, 'الي': 1, 'على': 1, 'عن': 1, 'مع': 1, 'هو': 1, 'هي': 1, 'هم': 1, 'هن': 1,
    'هذا': 1, 'هذه': 1, 'ذلك': 1, 'تلك': 1, 'الذي': 1, 'التي': 1, 'الذين': 1, 'ان': 1, 'او': 1, 'ثم': 1,
    'لكن': 1, 'بل': 1, 'قد': 1, 'كان': 1, 'كانت': 1, 'يكون': 1, 'تكون': 1, 'ليس': 1, 'ليست': 1, 'لا': 1,
    'لم': 1, 'لن': 1, 'ما': 1, 'ماذا': 1, 'لماذا': 1, 'كيف': 1, 'متي': 1, 'اين': 1, 'هل': 1, 'كم': 1, 'اي': 1,
    'بعد': 1, 'قبل': 1, 'بين': 1, 'حول': 1, 'خلال': 1, 'عند': 1, 'اذا': 1, 'حيث': 1, 'كل': 1, 'بعض': 1,
    'ايضا': 1, 'كذلك': 1, 'هنا': 1, 'هناك': 1, 'جدا': 1, 'فقط': 1, 'حتي': 1, 'منذ': 1, 'تم': 1, 'يتم': 1,
    'يمكن': 1, 'يجب': 1, 'وفق': 1, 'حسب': 1, 'مثل': 1, 'عده': 1, 'اخر': 1, 'اخري': 1, 'بينما': 1,
    'كما': 1, 'لان': 1, 'بسبب': 1, 'اجل': 1, 'نحو': 1, 'غير': 1, 'دون': 1, 'فوق': 1, 'تحت': 1,
    'the': 1, 'and': 1, 'for': 1, 'are': 1, 'was': 1, 'were': 1, 'that': 1, 'this': 1, 'with': 1, 'from': 1,
    'into': 1, 'have': 1, 'has': 1, 'had': 1, 'not': 1, 'but': 1, 'can': 1, 'will': 1, 'also': 1, 'such': 1,
    'which': 1, 'when': 1, 'where': 1, 'who': 1, 'what': 1, 'their': 1, 'they': 1, 'them': 1, 'its': 1
  };

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function shuffleWithSeed(arr, seed) {
    var out = arr.slice();
    var s = (seed >>> 0) || 1234567;
    for (var i = out.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      var j = s % (i + 1);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function splitSentences(text) {
    var res = [], cur = '', s = String(text || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      cur += ch;
      if ((ch === '.' || ch === '!' || ch === '؟' || ch === '?') && (i === s.length - 1 || /\s/.test(s.charAt(i + 1)))) {
        if (cur.trim()) res.push(cur.trim());
        cur = '';
      }
    }
    if (cur.trim()) res.push(cur.trim());
    return res;
  }

  function trimSentenceEnd(s) {
    return String(s || '').replace(/^[\s\-•▪●*·]+/, '').replace(/[\s]+/g, ' ').trim();
  }

  /* استخراج بنية النص: عناوين، تعريفات، قوائم مرتبة، جمل حقائق، أزواج، مصطلحات */
  function extractKnowledge(rawText) {
    var text = cleanExtractedText(rawText);
    var lines = text.split('\n');

    var sections = [];
    var curSec = { heading: '', lines: [] };
    sections.push(curSec);

    var BUL_RE = /^(?:[-•▪●○◦*·]|\u2013|\u2014)\s+(.+)$/;
    var ORD_NUM_RE = /^(\d{1,2})\s*[.)\-:]\s+(.+)$/;
    var ORD_AR_RE = /^(?:أولاً|اولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا|الخطوة\s+\S+|المرحلة\s+\S+)\s*[:\-–—]?\s*(.+)$/;
    var ORD_EN_RE = /^(?:step\s+\d+|phase\s+\d+|stage\s+\d+|first(?:ly)?|second(?:ly)?|third(?:ly)?|fourth(?:ly)?|fifth(?:ly)?|finally)\s*[:.\-–—]\s*(.+)$/i;

    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) continue;
      if (/^\d{1,3}$/.test(l)) continue;
      var words = l.split(' ').length;
      var prevBlank = i === 0 || !lines[i - 1];
      var nextNonEmpty = '';
      for (var k = i + 1; k < lines.length; k++) { if (lines[k]) { nextNonEmpty = lines[k]; break; } }
      var isBullet = BUL_RE.test(l) || ORD_NUM_RE.test(l) || ORD_AR_RE.test(l) || ORD_EN_RE.test(l);
      var looksHeading = !isBullet && prevBlank && words <= 9 && l.length <= 75 && !/[.،,؛;؟?!]$/.test(l) && l.indexOf(' | ') === -1 && !!nextNonEmpty;
      if (looksHeading) {
        curSec = { heading: l.replace(/[:：]$/, '').trim(), lines: [] };
        sections.push(curSec);
      } else {
        curSec.lines.push(l);
      }
    }

    var defs = [];
    var facts = [];
    var pairs = [];
    var sequences = [];
    var termBank = {};
    var seenFact = {};
    var seenDef = {};

    function addTerm(t, kind) {
      t = String(t || '').replace(/^[:\-–—«»"']+|[:\-–—«»"'.،؛]+$/g, '').trim();
      var nt = normAr(t);
      if (!nt || nt.length < 3 || t.length > 65 || t.split(' ').length > 6 || AR_STOP[nt]) return;
      if (!termBank[nt]) termBank[nt] = { raw: t, norm: nt, kind: kind || 'term', count: 0 };
      termBank[nt].count++;
    }

    function addDef(term, def, source, heading) {
      term = trimSentenceEnd(term).replace(/[:：]+$/, '');
      def = trimSentenceEnd(def);
      var nt = normAr(term), nd = normAr(def);
      if (!nt || !nd || nt.length < 2 || nd.length < 10) return;
      if (term.split(' ').length > 7 || def.length > 260) return;
      if (nt === nd || nd.indexOf(nt) === 0 && nd.length - nt.length < 8) return;
      var key = nt + '=>' + nd.slice(0, 60);
      if (seenDef[key]) return;
      seenDef[key] = 1;
      addTerm(term, 'def');
      defs.push({ term: term, def: def, source: source, heading: heading || '' });
      if (def.length <= 135) {
        pairs.push({ left: term, right: def, source: source });
      }
    }

    function addFact(sent, source, heading) {
      sent = trimSentenceEnd(sent);
      if (sent.length < 25 || sent.length > 240) return;
      /* استبعاد الجمل المبهمة التي تبدأ بضمير معلق دون سياق كافٍ */
      if (/^(?:وهذا|وهذه|وذلك|وتلك|حيث أنه|كما سبق|مما سبق|it is|this is|they are)\b/i.test(sent)) return;
      var ns = normAr(sent);
      if (!ns || ns.split(' ').length < 5 || seenFact[ns]) return;
      seenFact[ns] = 1;
      facts.push({ sentence: sent, source: source || sent, heading: heading || '' });
    }

    /* تعريفات: «X هو ...»، «يعرف X بأنه ...»، «X عبارة عن ...»، «X refers to / is defined as ...» */
    var DEF_PATTERNS = [
      /^(.{3,55}?)\s+(?:هو|هي|هم)\s+(.{12,240})$/,
      /^(?:يُ?عر[ّ]?ف|تُ?عر[ّ]?ف)\s+(.{3,55}?)\s+(?:بأنه|بأنها|على أنه|على أنها)\s+(.{12,240})$/,
      /^(?:يُ?قصد بـ?|المقصود بـ?)\s+(.{3,55}?)\s*[:：]?\s*(.{12,240})$/,
      /^(.{3,55}?)\s+(?:عبارة عن|يشير إلى|تشير إلى|يتمثل في|تتمثل في)\s+(.{12,240})$/,
      /^(.{3,55}?)\s+(?:is defined as|refers to|means|is the study of|is a process of)\s+(.{10,240})$/i
    ];

    sections.forEach(function (sec) {
      var seqBuf = [];
      var seqKind = '';
      var seqTitle = sec.heading || '';
      var chronoBuf = [];

      function flushSeq() {
        if (seqBuf.length >= 3 && seqBuf.length <= 7) {
          sequences.push({
            title: seqTitle || 'الترتيب الصحيح للعناصر وفق المحاضرة',
            items: seqBuf.slice(),
            source: seqBuf.join(' ← ')
          });
        }
        seqBuf = [];
        seqKind = '';
      }

      /* تجميع الجمل وجمع النقاط المرتبة */
      for (var li = 0; li < sec.lines.length; li++) {
        var ln = sec.lines[li];
        if (!ln) { flushSeq(); continue; }

        /* 1. كشف عناصر التسلسل والترتيب */
        var mNum = ORD_NUM_RE.exec(ln);
        var mOrdAr = ORD_AR_RE.exec(ln);
        var mOrdEn = ORD_EN_RE.exec(ln);
        var mBul = BUL_RE.exec(ln);

        if (mNum) {
          if (seqKind && seqKind !== 'num') flushSeq();
          seqKind = 'num';
          seqBuf.push(trimSentenceEnd(mNum[2]));
        } else if (mOrdAr) {
          if (seqKind && seqKind !== 'ord_ar') flushSeq();
          seqKind = 'ord_ar';
          seqBuf.push(trimSentenceEnd(ln));
        } else if (mOrdEn) {
          if (seqKind && seqKind !== 'ord_en') flushSeq();
          seqKind = 'ord_en';
          seqBuf.push(trimSentenceEnd(ln));
        } else {
          flushSeq();
        }

        /* 2. فحص جدول A | B */
        if (ln.indexOf(' | ') !== -1) {
          var cols = ln.split(' | ').map(trimSentenceEnd).filter(Boolean);
          if (cols.length >= 2 && cols[0].length <= 60 && cols[1].length >= 8 && !/^(?:المصطلح|الاسم|العنصر|term|item)$/i.test(cols[0])) {
            var rest = cols.slice(1).join(' — ');
            addDef(cols[0], rest, ln, sec.heading);
            addFact(cols[0] + ': ' + rest, ln, sec.heading);
          }
          continue;
        }

        /* 3. كشف التواريخ المتسلسلة (مثال 1896: ... / 1913: ...) */
        var mYear = /^(\d{4})\s*(?:م|هـ)?\s*[:\-–—]\s*(.{8,140})$/.exec(ln.replace(/^[-•*]\s+/, ''));
        if (mYear) {
          chronoBuf.push({ year: parseInt(mYear[1], 10), text: trimSentenceEnd(mYear[0]) });
        }

        /* 4. تقسيم السطر إلى جمل */
        var bodyLine = mNum ? mNum[2] : (mBul ? mBul[1] : ln);
        var sents = splitSentences(bodyLine);
        sents.forEach(function (sn) {
          sn = trimSentenceEnd(sn);
          if (!sn) return;

          /* مطابقة نمط Label: Value */
          var mColon = /^([^:：]{3,55})[:：]\s*(.{10,240})$/.exec(sn);
          if (mColon && mColon[1].split(' ').length <= 7 && !/^(?:ملاحظة|تنبيه|مثال|note|example)$/i.test(mColon[1].trim())) {
            addDef(mColon[1], mColon[2], sn, sec.heading);
          } else {
            for (var p = 0; p < DEF_PATTERNS.length; p++) {
              var dm = DEF_PATTERNS[p].exec(sn);
              if (dm && dm[1].trim().split(' ').length <= 7) {
                addDef(dm[1], dm[2], sn, sec.heading);
                break;
              }
            }
          }
          addFact(sn, sn, sec.heading);
        });
      }
      flushSeq();
      if (chronoBuf.length >= 3) {
        /* ترتيب زمني واضح إن كانت السنوات مرتبة تصاعدياً */
        var asc = true;
        for (var ci = 1; ci < chronoBuf.length; ci++) {
          if (chronoBuf[ci].year <= chronoBuf[ci - 1].year) { asc = false; break; }
        }
        if (asc && chronoBuf.length <= 7) {
          sequences.push({
            title: (sec.heading ? sec.heading + ' — ' : '') + 'الترتيب الزمني للأحداث',
            items: chronoBuf.map(function (c) { return c.text; }),
            source: chronoBuf.map(function (c) { return c.text; }).join(' ← ')
          });
        }
      }
    });

    /* استخراج مصطلحات إضافية متكررة أو مميزة للملء والاختيارات */
    var wordsFreq = {};
    var tokens = text.match(/[\u0621-\u064A]{4,}|[A-Za-z]{4,}|\d{2,4}/g) || [];
    tokens.forEach(function (tk) {
      var nt = normAr(tk);
      if (!nt || AR_STOP[nt] || nt.length < 3) return;
      if (!wordsFreq[nt]) wordsFreq[nt] = { raw: tk, norm: nt, count: 0 };
      wordsFreq[nt].count++;
    });

    Object.keys(wordsFreq).forEach(function (k) {
      if (wordsFreq[k].count >= 2) addTerm(wordsFreq[k].raw, 'keyword');
    });

    return {
      text: text,
      sections: sections,
      defs: defs,
      facts: facts,
      pairs: pairs,
      sequences: sequences,
      terms: Object.keys(termBank).map(function (k) { return termBank[k]; }),
      wordsFreq: wordsFreq
    };
  }

  function autoTargetCount(text) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    if (words < 90) return 6;
    if (words < 220) return 10;
    if (words < 500) return 15;
    if (words < 1000) return 20;
    return 25;
  }

  function applyCountLimit(pool, countMode, text) {
    var requested = countMode === 'auto' ? autoTargetCount(text) : parseInt(countMode, 10) || 10;
    var items = pool.slice(0, requested);
    return {
      items: items,
      requested: countMode === 'auto' ? 'auto' : requested,
      targetNum: requested,
      available: pool.length,
      shortfall: countMode !== 'auto' && pool.length < requested
    };
  }

  /* ---- Tool 2: Flashcards ---- */
  function generateFlashcards(K, countMode) {
    var pool = [], seenQ = {};
    K.defs.forEach(function (d) {
      var q = 'ما المقصود بـ «' + d.term + '»؟';
      var k = normAr(q);
      if (seenQ[k]) return;
      seenQ[k] = 1;
      pool.push({ q: q, a: d.def, cat: d.heading || 'تعريف ومفهوم', source: d.source });
    });

    K.sections.forEach(function (sec) {
      if (sec.heading && sec.lines.length >= 2 && sec.lines.length <= 7) {
        var isQ = /[؟?]$/.test(sec.heading);
        var q = isQ ? sec.heading : ('اذكر أهم ما ورد حول: ' + sec.heading);
        var k = normAr(q);
        if (!seenQ[k]) {
          seenQ[k] = 1;
          var body = sec.lines.slice(0, 5).join(' • ');
          if (body.length >= 18 && body.length <= 360) {
            pool.push({ q: q, a: body, cat: sec.heading, source: body });
          }
        }
      }
    });

    K.facts.forEach(function (f) {
      var m = /^(.{4,55}?)\s+(?:تهدف إلى|يهدف إلى|تساعد في|يساعد في|تتكون من|يتكون من|يؤدي إلى|تؤدي إلى)\s+(.{10,200})$/.exec(f.sentence);
      if (m) {
        var q = 'ما دور أو مكونات «' + m[1].trim() + '»؟';
        var k = normAr(q);
        if (!seenQ[k]) {
          seenQ[k] = 1;
          pool.push({ q: q, a: f.sentence, cat: f.heading || 'فكرة رئيسية', source: f.source });
        }
      }
    });

    return applyCountLimit(pool, countMode, K.text);
  }

  /* ---- Tool 3: MCQ (Strict same-text distractors, zero invented fake choices) ---- */
  function pickDistractors(correctText, poolCandidates, count) {
    var nc = normAr(correctText);
    var out = [], used = {};
    used[nc] = 1;
    var cLen = correctText.length;
    /* ترتيب حسب القرب في الطول دون تطابق */
    var sorted = poolCandidates.slice().sort(function (a, b) {
      return Math.abs(a.length - cLen) - Math.abs(b.length - cLen);
    });
    for (var i = 0; i < sorted.length && out.length < count; i++) {
      var cand = trimSentenceEnd(sorted[i]);
      var nk = normAr(cand);
      if (!nk || used[nk]) continue;
      /* استبعاد الخيارات المتداخلة جزئياً بشكل فاضح مع الإجابة */
      if (nk.length >= 4 && nc.length >= 4 && (nk.indexOf(nc) !== -1 || nc.indexOf(nk) !== -1)) continue;
      used[nk] = 1;
      out.push(cand);
    }
    return out;
  }

  function generateMCQ(K, countMode) {
    var pool = [], seenQ = {};
    var termPool = K.defs.map(function (d) { return d.term; });
    K.terms.forEach(function (t) { if (termPool.indexOf(t.raw) === -1) termPool.push(t.raw); });
    var defPool = K.defs.map(function (d) { return d.def; }).filter(function (s) { return s.length <= 125; });

    /* النوع 1: تعريف -> اختر المصطلح */
    K.defs.forEach(function (d) {
      var dist = pickDistractors(d.term, termPool, 3);
      if (dist.length < 3) return;
      var q = 'ما المصطلح الذي يشير إلى: «' + d.def + '»؟';
      var k = normAr(q);
      if (seenQ[k]) return;
      seenQ[k] = 1;
      var opts = shuffleWithSeed([d.term].concat(dist), hashSeed(q));
      pool.push({ q: q, o: opts, a: opts.indexOf(d.term), source: d.source });
    });

    /* النوع 2: مصطلح -> اختر الوصف الدقيق (للشروحات القصيرة) */
    K.defs.forEach(function (d) {
      if (d.def.length > 125) return;
      var dist = pickDistractors(d.def, defPool, 3);
      if (dist.length < 3) return;
      var q = 'أي العبارات الآتية تصف «' + d.term + '» وفق النص؟';
      var k = normAr(q);
      if (seenQ[k]) return;
      seenQ[k] = 1;
      var opts = shuffleWithSeed([d.def].concat(dist), hashSeed(q));
      pool.push({ q: q, o: opts, a: opts.indexOf(d.def), source: d.source });
    });

    /* النوع 3: إكمال جملة حقيقية من خيارات نفس المحاضرة */
    K.facts.forEach(function (f) {
      var bestTok = null;
      for (var i = 0; i < K.terms.length; i++) {
        var tk = K.terms[i].raw;
        if (tk.length < 4) continue;
        var idx = f.sentence.indexOf(tk);
        if (idx > 0 && f.sentence.indexOf(tk, idx + 1) === -1) {
          bestTok = tk;
          break;
        }
      }
      if (!bestTok) return;
      var dist = pickDistractors(bestTok, termPool, 3);
      if (dist.length < 3) return;
      var stem = f.sentence.replace(bestTok, ' ( ...... ) ');
      var q = 'أكمل العبارة الآتية من محتوى المحاضرة: ' + stem;
      var k = normAr(q);
      if (seenQ[k]) return;
      seenQ[k] = 1;
      var opts = shuffleWithSeed([bestTok].concat(dist), hashSeed(q));
      pool.push({ q: q, o: opts, a: opts.indexOf(bestTok), source: f.source });
    });

    return applyCountLimit(pool, countMode, K.text);
  }

  /* ---- Tool 4: True / False (Controlled transformations only, zero ambiguity) ---- */
  var ANTONYMS = [
    ['يزيد', 'ينقص'], ['تزيد', 'تنقص'], ['يزداد', 'يقل'], ['تزداد', 'تقل'],
    ['ارتفاع', 'انخفاض'], ['مرتفع', 'منخفض'], ['مرتفعة', 'منخفضة'],
    ['أكبر', 'أصغر'], ['أعلى', 'أدنى'], ['إيجابي', 'سلبي'], ['إيجابية', 'سلبية'],
    ['مباشر', 'غير مباشر'], ['مباشرة', 'غير مباشرة'],
    ['داخلي', 'خارجي'], ['داخلية', 'خارجية'],
    ['هوائي', 'لاهوائي'], ['هوائية', 'لاهوائية'],
    ['طردي', 'عكسي'], ['طردية', 'عكسية'],
    ['زيادة', 'نقصان'], ['بسيط', 'معقد'], ['بسيطة', 'معقدة'],
    ['إلزامي', 'اختياري'], ['ضروري', 'ثانوي'],
    ['قبل', 'بعد'], ['أول', 'آخر'], ['بداية', 'نهاية'],
    ['increases', 'decreases'], ['increase', 'decrease'], ['higher', 'lower'],
    ['direct', 'indirect'], ['internal', 'external'], ['positive', 'negative'],
    ['active', 'passive'], ['aerobic', 'anaerobic']
  ];

  function makeControlledFalse(item, defs, allNums) {
    /* 1) استبدال متضاد صريح بحدود كلمات واضحة */
    var s = item.sentence;
    for (var i = 0; i < ANTONYMS.length; i++) {
      var a = ANTONYMS[i][0], b = ANTONYMS[i][1];
      var reA = new RegExp('(^|[\\s،.(])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s،.)؛]|$)', 'i');
      var reB = new RegExp('(^|[\\s،.(])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s،.)؛]|$)', 'i');
      if (reA.test(s)) {
        return {
          statement: s.replace(reA, '$1' + b),
          correction: 'العبارة خاطئة؛ الصواب هو «' + a + '» وليس «' + b + '».',
          source: item.source
        };
      }
      if (reB.test(s)) {
        return {
          statement: s.replace(reB, '$1' + a),
          correction: 'العبارة خاطئة؛ الصواب هو «' + b + '» وليس «' + a + '».',
          source: item.source
        };
      }
    }

    /* 2) استبدال رقم/سنة مميزة برقم آخر مختلف بوضوح */
    var numMatch = /(?:^|\s)(\d{2,4})(?:\s|%|$)/.exec(s);
    if (numMatch) {
      var origNum = parseInt(numMatch[1], 10);
      var altNum = null;
      for (var ni = 0; ni < allNums.length; ni++) {
        if (allNums[ni] !== origNum && Math.abs(allNums[ni] - origNum) >= 2) {
          altNum = allNums[ni];
          break;
        }
      }
      if (altNum === null) altNum = origNum >= 1900 ? origNum + 15 : origNum + 10;
      return {
        statement: s.replace(numMatch[1], String(altNum)),
        correction: 'العبارة خاطئة؛ القيمة الصحيحة الواردة في النص هي ' + origNum + ' وليس ' + altNum + '.',
        source: item.source
      };
    }

    /* 3) نسب تعريف مصطلح A إلى مصطلح B مختلف تماماً من نفس المحاضرة */
    if (item.term && defs.length >= 2) {
      for (var di = 0; di < defs.length; di++) {
        if (normAr(defs[di].term) !== normAr(item.term) && normAr(defs[di].def) !== normAr(item.def)) {
          return {
            statement: defs[di].term + ': ' + item.def,
            correction: 'العبارة خاطئة؛ هذا الوصف يخص «' + item.term + '» وليس «' + defs[di].term + '».',
            source: item.source
          };
        }
      }
    }
    return null;
  }

  function generateTrueFalse(K, countMode) {
    var allNums = [];
    (K.text.match(/\b\d{2,4}\b/g) || []).forEach(function (n) {
      var v = parseInt(n, 10);
      if (allNums.indexOf(v) === -1) allNums.push(v);
    });

    var candidates = [];
    var usedBase = {};

    K.defs.forEach(function (d) {
      var stmt = d.term + ': ' + d.def;
      var key = normAr(stmt);
      if (stmt.length > 220 || usedBase[key]) return;
      usedBase[key] = 1;
      candidates.push({ sentence: stmt, term: d.term, def: d.def, source: d.source });
    });

    K.facts.forEach(function (f) {
      var key = normAr(f.sentence);
      if (usedBase[key]) return;
      usedBase[key] = 1;
      candidates.push({ sentence: f.sentence, source: f.source });
    });

    var pool = [];
    var falseQuota = 0, trueQuota = 0;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var wantFalse = falseQuota <= trueQuota;
      if (wantFalse) {
        var fObj = makeControlledFalse(c, K.defs, allNums);
        if (fObj) {
          falseQuota++;
          pool.push({
            statement: fObj.statement,
            answer: false,
            correction: fObj.correction,
            source: fObj.source
          });
          continue;
        }
      }
      trueQuota++;
      pool.push({
        statement: c.sentence,
        answer: true,
        correction: 'العبارة صحيحة ومطابقة لما ورد في المحاضرة.',
        source: c.source
      });
    }

    var ordered = shuffleWithSeed(pool, hashSeed(K.text.slice(0, 120)));
    return applyCountLimit(ordered, countMode, K.text);
  }

  /* ---- Tool 5: Fill in the Blank ---- */
  function generateFillBlank(K, countMode) {
    var pool = [], seen = {};
    var termSet = K.terms.map(function (t) { return t.raw; }).sort(function (a, b) { return b.length - a.length; });

    function pickBlankWord(sentence) {
      for (var ti = 0; ti < termSet.length; ti++) {
        var tk = termSet[ti];
        if (tk.length < 3 || tk.split(' ').length > 2) continue;
        var pos = sentence.indexOf(tk);
        if (pos >= 0 && sentence.indexOf(tk, pos + 1) === -1) {
          /* تأكد أن الحذف يترك جملة واضحة ذات معنى */
          var leftOk = pos === 0 || /\s/.test(sentence.charAt(pos - 1));
          var rightCh = sentence.charAt(pos + tk.length);
          var rightOk = !rightCh || /[\s.،؛:!؟?]/.test(rightCh);
          if (leftOk && rightOk) return tk;
        }
      }
      /* احتياط: كلمة مفتاحية طويلة فريدة داخل الجملة */
      var words = sentence.match(/[\u0621-\u064A]{5,}|[A-Za-z]{5,}|\d{2,4}/g) || [];
      for (var wi = words.length - 1; wi >= 0; wi--) {
        var w = words[wi];
        var nw = normAr(w);
        if (AR_STOP[nw]) continue;
        if (sentence.indexOf(w) === sentence.lastIndexOf(w)) return w;
      }
      return null;
    }

    K.defs.forEach(function (d) {
      var full = d.term + ': ' + d.def;
      if (full.length > 210 || d.term.split(' ').length > 3) return;
      var k = normAr(d.term);
      if (seen[k]) return;
      seen[k] = 1;
      pool.push({
        before: '',
        after: ': ' + d.def,
        answer: d.term,
        accept: [k],
        source: d.source
      });
    });

    K.facts.forEach(function (f) {
      if (f.sentence.length < 30 || f.sentence.length > 220) return;
      var target = pickBlankWord(f.sentence);
      if (!target) return;
      var k = normAr(f.sentence);
      if (seen[k]) return;
      seen[k] = 1;
      var idx = f.sentence.indexOf(target);
      pool.push({
        before: f.sentence.slice(0, idx),
        after: f.sentence.slice(idx + target.length),
        answer: target,
        accept: [normAr(target)],
        source: f.source
      });
    });

    return applyCountLimit(pool, countMode, K.text);
  }

  /* ---- Tool 6: Ordering (Only when genuine sequence exists) ---- */
  function generateOrdering(K, countMode) {
    var pool = [];
    K.sequences.forEach(function (seq, idx) {
      var items = seq.items.slice(0, 7);
      if (items.length < 3) return;
      /* إزالة الأرقام/الترتيب الصريح من بداية العنصر حتى لا تكشف الإجابة مجاناً */
      var cleaned = items.map(function (it) {
        return it.replace(/^(?:\d+[.)\-:]|أولاً|اولاً|أولا|ثانياً|ثانيا|ثالثاً|ثالثا|رابعاً|رابعا|خامساً|خامسا|سادساً|سادسا|سابعاً|سابعا)\s*[:\-–—]?\s*/, '').trim();
      });
      var indices = cleaned.map(function (_, i) { return i; });
      var shuffled = shuffleWithSeed(indices, hashSeed(seq.title + idx));
      /* ضمان اختلاف الترتيب المخلوط عن الترتيب الصحيح */
      var same = shuffled.every(function (v, i) { return v === i; });
      if (same && shuffled.length >= 2) {
        var tmp = shuffled[0]; shuffled[0] = shuffled[1]; shuffled[1] = tmp;
      }
      pool.push({
        title: seq.title,
        correctItems: cleaned,
        shuffledIndices: shuffled,
        source: seq.source
      });
    });
    return applyCountLimit(pool, countMode, K.text);
  }

  /* ---- Tool 7: Matching ---- */
  function generateMatching(K, countMode) {
    var uniquePairs = [], usedL = {}, usedR = {};
    K.pairs.forEach(function (p) {
      var nl = normAr(p.left), nr = normAr(p.right);
      if (!nl || !nr || nl === nr || usedL[nl] || usedR[nr]) return;
      usedL[nl] = 1;
      usedR[nr] = 1;
      uniquePairs.push({
        left: p.left,
        right: p.right.length > 120 ? p.right.slice(0, 117).trim() + '…' : p.right,
        source: p.source
      });
    });

    var requestedPairs = countMode === 'auto' ? Math.min(18, uniquePairs.length) : (parseInt(countMode, 10) || 10);
    var usable = uniquePairs.slice(0, requestedPairs);
    var rounds = [];
    if (usable.length >= 3) {
      var chunkSize = usable.length <= 6 ? usable.length : 5;
      for (var i = 0; i < usable.length; i += chunkSize) {
        var grp = usable.slice(i, i + chunkSize);
        if (grp.length < 2 && rounds.length) {
          rounds[rounds.length - 1].pairs = rounds[rounds.length - 1].pairs.concat(grp);
        } else if (grp.length >= 2) {
          var rightOrder = shuffleWithSeed(grp.map(function (_, idx) { return idx; }), hashSeed(grp[0].left + i));
          if (rightOrder.every(function (v, idx) { return v === idx; }) && rightOrder.length >= 2) {
            var t = rightOrder[0]; rightOrder[0] = rightOrder[1]; rightOrder[1] = t;
          }
          rounds.push({ pairs: grp, rightOrder: rightOrder });
        }
      }
    }
    return {
      items: rounds,
      requested: countMode === 'auto' ? 'auto' : requestedPairs,
      availablePairs: uniquePairs.length,
      usedPairs: usable.length,
      shortfall: countMode !== 'auto' && uniquePairs.length < requestedPairs
    };
  }

  function generateAllTools(rawText, countMode) {
    var K = extractKnowledge(rawText);
    return {
      knowledge: K,
      countMode: countMode || 'auto',
      faq: generateFlashcards(K, countMode || 'auto'),
      mcq: generateMCQ(K, countMode || 'auto'),
      tf: generateTrueFalse(K, countMode || 'auto'),
      blank: generateFillBlank(K, countMode || 'auto'),
      order: generateOrdering(K, countMode || 'auto'),
      match: generateMatching(K, countMode || 'auto')
    };
  }

  /* ==========================================================================
     6) Tool 1: Local Chat Wrapper (ChatEngine + Strict Source Excerpts)
     ========================================================================== */
  function buildChatScope(id, title, text) {
    var CE = root.ChatEngine;
    if (!CE) throw new Error('محرك الشات المحلي (ChatEngine) غير متاح.');
    var sections = CE.parsePlainText(text);
    var doc = CE.prepareDoc({ id: id, title: title || 'محاضرتي', sections: sections });
    return CE.buildScope([doc]);
  }

  function appendSourceBlocks(blocks, scope, res, rawText) {
    var out = (blocks || []).slice();
    var snippets = [];
    if (res && res.meta && Array.isArray(res.meta.items) && res.meta.items.length) {
      res.meta.items.slice(0, 2).forEach(function (it) {
        var s = String(it || '').trim();
        if (s && snippets.indexOf(s) === -1) snippets.push(s);
      });
    }
    if (!snippets.length && out.length) {
      out.forEach(function (b) {
        if (b.t === 'p' && !b.muted && b.text && snippets.length < 2) snippets.push(b.text);
      });
    }
    if (snippets.length && rawText) {
      out.push({ t: 'hr' });
      out.push({ t: 'p', muted: true, text: 'المقطع المعتمد من نص المحاضرة: «' + snippets[0].slice(0, 200) + (snippets[0].length > 200 ? '…' : '') + '»' });
    }
    return out;
  }

  /* بحث إنجليزي/بسيط مساند داخل نفس النص فقط عندما يفشل التطابق النحوي العربي */
  function fallbackLexicalSearch(rawText, question) {
    var qNorm = normAr(question);
    var qWords = qNorm.split(' ').filter(function (w) { return w.length >= 3 && !AR_STOP[w]; });
    if (!qWords.length) return null;
    var sents = splitSentences(cleanExtractedText(rawText).replace(/\n+/g, '. '));
    var scored = [];
    sents.forEach(function (s) {
      var sn = normAr(s);
      if (!sn || s.length < 15) return;
      var hits = 0;
      qWords.forEach(function (w) {
        if (sn.indexOf(w) !== -1 || (w.length > 4 && sn.indexOf(w.slice(0, w.length - 1)) !== -1)) hits++;
      });
      var cov = hits / qWords.length;
      if (hits >= 1 && cov >= 0.55) {
        scored.push({ s: trimSentenceEnd(s), hits: hits, cov: cov });
      }
    });
    if (!scored.length) return null;
    scored.sort(function (a, b) { return b.cov - a.cov || b.hits - a.hits; });
    var top = scored.slice(0, 2).map(function (x) { return x.s; });
    var blocks = top.map(function (t) { return { t: 'p', text: t }; });
    blocks.push({ t: 'hr' });
    blocks.push({ t: 'p', muted: true, text: 'المقطع المعتمد من نص المحاضرة: «' + top[0].slice(0, 200) + '»' });
    return {
      found: true,
      blocks: blocks,
      meta: { qtype: 'lexical', topic: qWords.join(' '), items: top }
    };
  }

  function answerCustomChat(scope, rawText, question, opts) {
    var CE = root.ChatEngine;
    if (!CE || !scope || !scope.N) {
      return {
        found: false,
        reason: 'empty',
        blocks: [{ t: 'p', text: 'لا يوجد نص محاضرة جاهز للبحث بعد.' }],
        meta: {}
      };
    }
    var res = CE.answer(scope, question, opts || {});
    if (res && res.found) {
      return {
        found: true,
        blocks: appendSourceBlocks(res.blocks, scope, res, rawText),
        meta: res.meta || {}
      };
    }
    var lex = fallbackLexicalSearch(rawText, question);
    if (lex) return lex;
    return {
      found: false,
      reason: (res && res.reason) || 'not_found',
      blocks: [{ t: 'p', text: 'لم أجد معلومات كافية للإجابة عن هذا السؤال داخل نص محاضرتك المرفوع والمعدّل.' }],
      meta: {}
    };
  }

  var API = {
    FILE_EXTS: FILE_EXTS,
    IMG_EXTS: IMG_EXTS,
    MAX_FILE_BYTES: MAX_FILE_BYTES,
    MAX_IMG_BYTES: MAX_IMG_BYTES,
    MAX_IMGS: MAX_IMGS,
    uid: uid,
    extOf: extOf,
    formatBytes: formatBytes,
    normAr: normAr,
    cleanExtractedText: cleanExtractedText,
    validateFile: validateFile,
    validateImages: validateImages,
    decodeTxtBytes: decodeTxtBytes,
    parseRtfBytes: parseRtfBytes,
    extractDocx: extractDocx,
    extractPptx: extractPptx,
    extractLegacyBinaryDocOrPpt: extractLegacyBinaryDocOrPpt,
    extractFromFile: extractFromFile,
    extractFromImages: extractFromImages,
    extractKnowledge: extractKnowledge,
    generateFlashcards: generateFlashcards,
    generateMCQ: generateMCQ,
    generateTrueFalse: generateTrueFalse,
    generateFillBlank: generateFillBlank,
    generateOrdering: generateOrdering,
    generateMatching: generateMatching,
    generateAllTools: generateAllTools,
    buildChatScope: buildChatScope,
    answerCustomChat: answerCustomChat,
    Store: Store
  };

  root.OtherEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
