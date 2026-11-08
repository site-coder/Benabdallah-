/* ==========================================================================
   chat-engine.js — محرك البحث والمعالجة النصية المحلي (بلا ذكاء اصطناعي)
   --------------------------------------------------------------------------
   ما يفعله هذا الملف:
     1) تطبيع النص العربي (همزات، تاء مربوطة، تشكيل، أرقام هندية ...).
     2) تقطيع المحاضرة إلى أقسام وفقرات ونقاط وبناء فهرس قابل لإعادة الاستخدام.
     3) تحليل السؤال (تعريف، أهداف، أنواع، مقارنة ...) مع اللهجة والمرادفات.
     4) ترتيب الفقرات (BM25 + وزن للعناوين + عبارات) واستخراج الإجابة منها.
     5) فحص كفاية المعلومات قبل الإجابة، وعدم الإجابة عند ضعف التطابق.
   المحرك لا يضيف أي معلومة من عنده: كل ما يعرضه مقتبس من نص المحاضرة.
   ========================================================================== */
(function (root) {
  'use strict';

  var VERSION = 5; /* ارفعه عند تغيير منطق التقطيع أو الجذور، فيُعاد بناء الفهارس المخزنة */
  var Dict = root.ChatDict || (typeof require === 'function' ? require('./chat-dict.js') : null);

  var MSG = {
    lecture: 'عذراً، لم أجد معلومات كافية للإجابة عن هذا السؤال في محتوى المحاضرة الحالية.',
    subject: 'لم أجد معلومات كافية للإجابة عن هذا السؤال في محاضرات هذا المقياس.',
    part: 'لم أجد معلومات كافية للإجابة عن هذا الجزء.',
    noTopic: 'لم أفهم موضوع سؤالك. اكتب سؤالك مع ذكر المصطلح الذي تقصده، مثل: «ما هي أهداف …؟» أو «عرّف …».',
    noContext: 'لا توجد نقاط سابقة في هذه المحادثة أستند إليها. اطرح سؤالك مع ذكر الموضوع.',
    emptyScope: 'لا توجد محاضرات مجهّزة للبحث بعد.'
  };

  /* ------------------------------------------------------------------ *
   * 1) التطبيع
   * ------------------------------------------------------------------ */
  var RE_DIAC = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  var RE_ZW = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

  function norm(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFKC'); } catch (e) { /* ignore */ }
    s = s.replace(RE_ZW, '');
    s = s.replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x660); });
    s = s.replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x6F0); });
    s = s.replace(RE_DIAC, '');
    s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
      .replace(/ک/g, 'ك').replace(/ی/g, 'ي').replace(/ڨ/g, 'ق').replace(/ڤ/g, 'ف').replace(/پ/g, 'ب').replace(/چ/g, 'ج').replace(/گ/g, 'ك').replace(/ە/g, 'ه');
    s = s.replace(/[A-Za-z\u00C0-\u024F]+/g, function (w) {
      var x = w;
      try { x = w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* ignore */ }
      return x.toLowerCase();
    });
    s = s.replace(/[^\u0621-\u064A0-9a-z]+/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------------------ *
   * 2) الجذور الخفيفة
   * ------------------------------------------------------------------ */
  var PREF = ['وبال', 'وكال', 'وفال', 'ولل', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
  var SUF1 = ['ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'كم', 'نا', 'تي', 'ته', 'تها', 'تهم', 'وا', 'ني'];
  var SUF2 = ['يه', 'ي', 'ه', 'ا'];

  function stemAr(t) {
    var s = t, i, p;
    for (i = 0; i < PREF.length; i++) {
      p = PREF[i];
      if (s.indexOf(p) === 0 && s.length - p.length >= 2) { s = s.slice(p.length); break; }
    }
    /* لواحق: الأطول أولاً */
    var best = '';
    for (i = 0; i < SUF1.length; i++) {
      p = SUF1[i];
      if (p.length > best.length && s.length - p.length >= 3 && s.slice(-p.length) === p) best = p;
    }
    if (best) s = s.slice(0, s.length - best.length);
    for (i = 0; i < SUF2.length; i++) {
      p = SUF2[i];
      if (s.length - p.length >= 3 && s.slice(-p.length) === p) { s = s.slice(0, s.length - p.length); break; }
    }
    return s;
  }

  function stemTok(t) {
    if (!t) return t;
    if (/^[0-9]+$/.test(t)) return t;
    if (/^[a-z]+$/.test(t)) return t.length > 3 && t.charAt(t.length - 1) === 's' ? t.slice(0, -1) : t;
    return stemAr(t);
  }

  /* صيغ بديلة بعد حذف حرف جرّ/عطف ملتصق (ب ل ك ف و س) — تُفهرَس بوزن أقل */
  function altStems(t, main) {
    var out = [];
    if (/^[\u0621-\u064A]+$/.test(t) && t.length >= 5 && 'وبلكفس'.indexOf(t.charAt(0)) !== -1 && t.indexOf('ال') !== 1) {
      var a = stemAr(t.slice(1));
      if (a && a !== main && a.length >= 2) out.push(a);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 3) تجهيز القاموس (مرة واحدة، ويُعاد عند extend)
   * ------------------------------------------------------------------ */
  var C = null, C_ver = -1;

  function compileDict() {
    if (C && C_ver === Dict.version) return C;
    var c = { stop: {}, qw: {}, darja: {}, phrases: [], typos: [], facetOf: {}, facetCanon: {}, groups: [], gIndex: {}, maxN: 1, ord: {} };
    Dict.stopwords.forEach(function (w) { norm(w).split(' ').forEach(function (x) { if (x) c.stop[x] = 1; }); });
    Dict.questionWords.forEach(function (w) { norm(w).split(' ').forEach(function (x) { if (x) c.qw[x] = 1; }); });
    Object.keys(Dict.darja).forEach(function (k) { c.darja[norm(k)] = norm(Dict.darja[k]); });
    Dict.darjaPhrases.forEach(function (p) { c.phrases.push([norm(p[0]), norm(p[1])]); });
    c.phrases.sort(function (a, b) { return b[0].length - a[0].length; });
    Object.keys(Dict.typos).forEach(function (k) { c.typos.push([norm(k), norm(Dict.typos[k])]); });
    c.typos.sort(function (a, b) { return b[0].length - a[0].length; });
    Object.keys(Dict.facets).forEach(function (f) {
      Dict.facets[f].forEach(function (w) {
        var n = norm(w);
        n.split(' ').forEach(function (x) { if (x) { c.facetOf[stemTok(x)] = f; c.facetCanon[x] = f; } });
      });
    });
    Object.keys(Dict.ordinals).forEach(function (k) { c.ord[norm(k)] = Dict.ordinals[k]; });
    Dict.synonyms.forEach(function (g, gi) {
      var members = [];
      g.forEach(function (m) {
        var stems = contentStems(m, c);
        if (!stems.length) return;
        var key = stems.join(' ');
        members.push({ stems: stems, key: key });
      });
      /* إزالة التكرار داخل المجموعة */
      var seen = {}, uniq = [];
      members.forEach(function (m) { if (!seen[m.key]) { seen[m.key] = 1; uniq.push(m); } });
      c.groups.push(uniq);
      uniq.forEach(function (m, mi) {
        if (!c.gIndex[m.key]) c.gIndex[m.key] = [];
        c.gIndex[m.key].push([gi, mi]);
        if (m.stems.length > c.maxN) c.maxN = m.stems.length;
      });
    });
    C = c; C_ver = Dict.version;
    return c;
  }

  function contentStems(text, c) {
    var toks = norm(text).split(' '), out = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t || (c && c.stop[t])) continue;
      if (t.length < 2 && !/[0-9]/.test(t)) continue;
      out.push(stemTok(t));
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 4) التقطيع: markdown / lesson / plain-text  →  وثيقة جاهزة للفهرسة
   * ------------------------------------------------------------------ */
  function cleanMd(s) {
    return String(s).replace(/<[^>]+>/g, ' ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\s+/g, ' ').trim();
  }

  var INCLUDE_TOP = ['نص المحاضرة'];  /* الأقسام التي تُفهرَس من lectures.json (غيّرها إن أردت إضافة «ملخص» مثلاً) */

  function parseMarkdown(md, include) {
    var inc = (include || INCLUDE_TOP).map(norm);
    var lines = String(md || '').split(/\r?\n/), hasTop = false, i;
    for (i = 0; i < lines.length; i++) if (/^##\s+/.test(lines[i]) && !/^###/.test(lines[i])) { hasTop = true; break; }
    var sections = [], cur = null, active = !hasTop;
    function open(h) { cur = { heading: cleanMd(h || ''), items: [] }; sections.push(cur); }
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (!ln.trim()) continue;
      var m = /^(#{1,6})\s+(.*)$/.exec(ln);
      if (m) {
        if (m[1].length <= 2) { active = !hasTop ? true : inc.indexOf(norm(m[2])) !== -1; cur = null; continue; }
        if (!active) continue;
        open(m[2]); continue;
      }
      if (!active) continue;
      if (!cur) open('');
      var b = /^\s*(?:[-*•▪●○◦]|\d+[.)\-]|[أ-ي][.)\-])\s+(.*)$/.exec(ln);
      if (b) cur.items.push({ kind: 'li', text: cleanMd(b[1]) });
      else cur.items.push({ kind: 'p', text: cleanMd(ln) });
    }
    return sections.filter(function (s) { return s.items.length || s.heading; });
  }

  function parseLesson(lesson) {
    var sections = [], cur = null;
    (lesson || []).forEach(function (row) {
      var h = row[0] || '', body = row[1];
      if (h || !cur) { cur = { heading: cleanMd(h), items: [] }; sections.push(cur); }
      if (Array.isArray(body)) body.forEach(function (t) { cur.items.push({ kind: 'li', text: cleanMd(t) }); });
      else if (body) cur.items.push({ kind: 'p', text: cleanMd(body) });
    });
    return sections;
  }

  /* نص خام (من PDF): عناوين قصيرة، نقاط، جداول، فقرات */
  function parsePlainText(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); });
    var sections = [], cur = null, para = [];
    function ensure() { if (!cur) { cur = { heading: '', items: [] }; sections.push(cur); } }
    function flush() {
      if (para.length) { ensure(); cur.items.push({ kind: 'p', text: para.join(' ') }); para = []; }
    }
    var BUL = /^(?:[-•▪●○◦–—*·]|\d+\s*[.)\-]|[أ-ي]\s*[.)\-])\s*(.+)$/;
    function laterContent(i) { for (var j = i + 1; j < lines.length; j++) if (lines[j]) return true; return false; }
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) { flush(); continue; }
      if (/^\d+$/.test(l)) continue; /* رقم صفحة */
      var b = BUL.exec(l);
      var words = l.split(' ').length;
      var prevBlank = i === 0 || !lines[i - 1];
      var looksHeading = !b && prevBlank && !para.length && words <= 9 && l.length <= 80 && !/[.،,؛;]$/.test(l) && l.indexOf(' | ') === -1 && laterContent(i);
      if (looksHeading && /[:：]$/.test(l) === false && /^[\u0600-\u06FFa-zA-Z0-9 ()\-/]+$/.test(l) === false) looksHeading = false;
      if (looksHeading) {
        flush();
        cur = { heading: l.replace(/[:：]$/, ''), items: [] }; sections.push(cur);
        continue;
      }
      if (b) { flush(); ensure(); cur.items.push({ kind: 'li', text: b[1].trim() }); continue; }
      if (l.indexOf(' | ') !== -1) {
        flush(); ensure();
        var cells = l.split(' | ').map(function (x) { return x.trim(); }).filter(Boolean);
        cur.items.push({ kind: 'li', text: cells.length > 1 ? cells[0] + ': ' + cells.slice(1).join('، ') : cells[0] });
        continue;
      }
      para.push(l);
      /* سطر ينتهي بنقطة وقصير: بند مستقل */
      if (/[.؟!]$/.test(l) && para.length === 1 && l.length <= 110) flush();
      else if (/[.؟!]$/.test(l) && para.join(' ').length > 260) flush();
    }
    flush();
    /* أسطر قصيرة متتالية بلا عنوان فاصل = قائمة */
    sections.forEach(function (sec) {
      var it = sec.items, i2 = 0;
      while (i2 < it.length) {
        var j2 = i2;
        while (j2 < it.length && it[j2].kind === 'p' && it[j2].text.length <= 110 && /[.؟!]$/.test(it[j2].text)) j2++;
        if (j2 - i2 >= 2) for (var k = i2; k < j2; k++) it[k].kind = 'li';
        i2 = Math.max(j2, i2 + 1);
      }
    });
    return sections.filter(function (s) { return s.items.length || s.heading; });
  }

  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36);
  }

  /* بدون lookbehind (لبعض المتصفحات القديمة) */
  function splitSent(t) {
    var res = [], cur = '', s = String(t);
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      cur += ch;
      if ((ch === '.' || ch === '!' || ch === '؟' || ch === '?') && (i === s.length - 1 || /\s/.test(s.charAt(i + 1)))) {
        res.push(cur.trim()); cur = '';
      }
    }
    if (cur.trim()) res.push(cur.trim());
    return res;
  }

  /* ------------------------------------------------------------------ *
   * 5) تجهيز وثيقة (يُخزَّن ناتجها في IndexedDB)
   * ------------------------------------------------------------------ */
  function addTerm(map, k, w) { map[k] = (map[k] || 0) + w; }

  function tokTerms(text, map, w, c) {
    var toks = norm(text).split(' '), n = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t || c.stop[t]) continue;
      if (t.length < 2 && !/[0-9]/.test(t)) continue;
      var st = stemTok(t);
      addTerm(map, st, w); n++;
      var al = altStems(t, st);
      for (var j = 0; j < al.length; j++) addTerm(map, al[j], w * 0.5);
    }
    return n;
  }

  function splitLabel(text) {
    var m = /^([^:：]{2,70})[:：]\s*(.+)$/.exec(text);
    if (m && m[1].trim().split(' ').length <= 8) return { label: m[1].trim(), body: m[2].trim() };
    return { label: '', body: text };
  }

  /* raw: { id, title, sections:[{heading, items:[{kind,text}]}] } */
  function prepareDoc(raw) {
    var c = compileDict();
    var doc = { v: VERSION, id: raw.id, title: raw.title || '', sections: [], chunks: [] };
    var allText = '';
    raw.sections.forEach(function (sec, si) {
      var s = { id: raw.id + '#' + si, heading: sec.heading || '', hStems: {}, hSeq: contentStems(sec.heading || '', c), items: [] };
      tokTerms(s.heading, s.hStems, 1, c);
      sec.items.forEach(function (it) {
        var txt = it.text;
        if (!txt) return;
        allText += txt + '\n';
        /* تقسيم الفقرات الطويلة جداً إلى مقاطع أصغر لتحسين الدقة */
        var pieces = [txt];
        if (it.kind === 'p' && txt.length > 900) {
          pieces = []; var cur = '';
          splitSent(txt).forEach(function (sn) {
            if (cur && (cur + ' ' + sn).length > 520) { pieces.push(cur); cur = sn; } else cur = cur ? cur + ' ' + sn : sn;
          });
          if (cur) pieces.push(cur);
        }
        pieces.forEach(function (pc) {
          var lb = it.kind === 'li' ? splitLabel(pc) : { label: '', body: pc };
          var ch = { doc: raw.id, sec: si, kind: it.kind, label: lb.label, body: lb.body, text: pc, tb: {}, th: {}, len: 0 };
          ch.len = tokTerms(lb.body, ch.tb, 1, c) + tokTerms(lb.label, ch.tb, 1, c);
          tokTerms(lb.label, ch.th, 1, c);
          for (var k in s.hStems) addTerm(ch.th, k, s.hStems[k]);
          s.items.push(doc.chunks.length);
          doc.chunks.push(ch);
        });
      });
      doc.sections.push({ id: s.id, heading: s.heading, hStems: s.hStems, hSeq: s.hSeq, items: s.items });
    });
    doc.hash = hashStr(allText + '|' + VERSION);
    return doc;
  }

  /* ------------------------------------------------------------------ *
   * 6) نطاق البحث: دمج وثائق مجهّزة في فهرس واحد
   * ------------------------------------------------------------------ */
  function buildScope(docs) {
    var scope = { docs: [], chunks: [], sections: [], df: {}, post: {}, N: 0, avgdl: 1, docIndex: {} };
    var totalLen = 0;
    docs.forEach(function (d) {
      var off = scope.chunks.length, soff = scope.sections.length;
      scope.docIndex[d.id] = scope.docs.length;
      scope.docs.push({ id: d.id, title: d.title });
      d.sections.forEach(function (s, si) {
        scope.sections.push({ id: s.id, doc: d.id, heading: s.heading, hStems: s.hStems, hSeq: s.hSeq || [], items: s.items.map(function (x) { return x + off; }), terms: {}, order: si });
      });
      d.chunks.forEach(function (ch) {
        var g = { doc: ch.doc, sec: ch.sec + soff, kind: ch.kind, label: ch.label, body: ch.body, text: ch.text, tb: ch.tb, th: ch.th, len: ch.len, idx: scope.chunks.length };
        scope.chunks.push(g);
        totalLen += g.len || 1;
      });
    });
    scope.N = scope.chunks.length;
    scope.avgdl = scope.N ? totalLen / scope.N : 1;
    scope.chunks.forEach(function (ch) {
      var seen = {}, k;
      for (k in ch.tb) seen[k] = 1;
      for (k in ch.th) seen[k] = 1;
      for (k in seen) {
        scope.df[k] = (scope.df[k] || 0) + 1;
        (scope.post[k] || (scope.post[k] = [])).push(ch.idx);
        scope.sections[ch.sec].terms[k] = 1;
      }
    });
    scope.sections.forEach(function (s) { for (var k in s.hStems) s.terms[k] = 1; });
    scope.vocab = Object.keys(scope.df);
    return scope;
  }

  /* تسلسل جذور الفقرة (بلا كلمات حشو) لفحص تجاور العبارات */
  function chunkSeq(ch) {
    if (ch._seq) return ch._seq;
    var c = compileDict(), toks = norm(ch.text).split(' '), out = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t || c.stop[t]) continue;
      if (t.length < 2 && !/[0-9]/.test(t)) continue;
      out.push(stemTok(t));
    }
    ch._seq = out; return out;
  }
  function seqHas(seq, stems) {
    if (stems.length < 2) return true;
    for (var i = 0; i < seq.length; i++) {
      if (seq[i] !== stems[0]) continue;
      var ok = true;
      for (var j = 1; j < stems.length; j++) if (seq[i + j] !== stems[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  function phraseInChunks(scope, stems, idxList, hSeqList) {
    var i;
    if (hSeqList) for (i = 0; i < hSeqList.length; i++) if (seqHas(hSeqList[i], stems)) return true;
    for (i = 0; i < idxList.length; i++) if (seqHas(chunkSeq(scope.chunks[idxList[i]]), stems)) return true;
    return false;
  }

  function idf(scope, st) {
    var df = scope.df[st] || 0, N = Math.max(scope.N, 1);
    return Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }
  function idfMax(scope) { return Math.log(1 + (Math.max(scope.N, 1) + 0.5) / 0.5); }

  /* ------------------------------------------------------------------ *
   * 7) تحليل السؤال
   * ------------------------------------------------------------------ */
  function applyTypos(n, c) {
    for (var i = 0; i < c.typos.length; i++) {
      var k = c.typos[i][0];
      if (k && (' ' + n + ' ').indexOf(' ' + k + ' ') !== -1) n = (' ' + n + ' ').split(' ' + k + ' ').join(' ' + c.typos[i][1] + ' ').trim();
    }
    return n;
  }
  function applyPhrases(n, c) {
    var s = ' ' + n + ' ';
    for (var i = 0; i < c.phrases.length; i++) {
      var k = ' ' + c.phrases[i][0] + ' ';
      if (s.indexOf(k) !== -1) s = s.split(k).join(' ' + c.phrases[i][1] + ' ');
    }
    return s.replace(/\s+/g, ' ').trim();
  }
  function applyDarja(toks, c) {
    var out = [];
    toks.forEach(function (t) {
      if (Object.prototype.hasOwnProperty.call(c.darja, t)) {
        var r = c.darja[t];
        if (r) r.split(' ').forEach(function (x) { if (x) out.push(x); });
      } else out.push(t);
    });
    return out;
  }

  var LIGHT = {};
  ['حدث', 'يحدث', 'حصل', 'يحصل', 'وقع', 'جري', 'يجري', 'يوجد', 'توجد', 'يسمي', 'تسمي', 'يطلق', 'يشمل', 'يتضمن', 'يضم', 'يحتوي', 'يقوم', 'تقوم', 'يعمل', 'يهتم', 'يستخدم', 'يستعمل', 'استخدم', 'نستخدم', 'نستعمل', 'تستخدم', 'تستعمل', 'يمكن', 'نستطيع', 'يستطيع', 'ممكن', 'سنه', 'سنوات', 'عام'].forEach(function (w) { LIGHT[stemTok(norm(w))] = 1; });

  /* توحيد جذور الكلمات الخفيفة (stemTok على الأفعال لا يغيّر كثيراً) */
  function isLight(stem) { return !!LIGHT[stem]; }

  var EXPL_LEVEL = [
    [/(?:^| )(?:مبسط|ببساطه|بسيط|بتبسيط|باختصار|مختصر|بايجاز|موجز)(?: |$)/, 'simple'],
    [/(?:^| )(?:بالتفصيل|مفصل|تفصيلي|بتوسع|موسع|بشكل مفصل|بالتفاصيل|كاملا)(?: |$)/, 'detailed']
  ];

  var LEVELW = {};
  ['مبسط', 'ببساطه', 'بسيط', 'بتبسيط', 'باختصار', 'مختصر', 'بايجاز', 'موجز', 'بالتفصيل', 'مفصل', 'تفصيلي', 'بتوسع', 'موسع', 'بالتفاصيل', 'كاملا', 'شكل'].forEach(function (w) { LEVELW[w] = 1; });

  /* يفكك السؤال إلى: نوع، وجه، وحدات بحث (units) */
  function analyze(text) {
    var c = compileDict();
    var n = norm(text);
    n = applyTypos(n, c);
    n = applyPhrases(n, c);
    var pre = n.split(' ').filter(Boolean).map(function (t) {
      if (t.length >= 3 && (t.charAt(0) === 'و' || t.charAt(0) === 'ف')) {
        var r = t.slice(1);
        if (c.stop[r] || c.qw[r] || Object.prototype.hasOwnProperty.call(c.darja, r)) return r;
      }
      return t;
    });
    var toks = applyDarja(pre, c);
    var tj = ' ' + toks.join(' ') + ' ';

    var A = { raw: text, norm: tj.trim(), toks: toks, units: [], facet: null, qtype: 'general', anaphora: false, ordinal: 0, level: null, topicText: '' };

    for (var li = 0; li < EXPL_LEVEL.length; li++) if (EXPL_LEVEL[li][0].test(tj)) A.level = EXPL_LEVEL[li][1];

    /* ترتيبي (النقطة الثانية) */
    for (var i = 0; i < toks.length; i++) {
      if (Object.prototype.hasOwnProperty.call(c.ord, toks[i])) { A.ordinal = c.ord[toks[i]]; }
      else if (/^[0-9]{1,2}$/.test(toks[i]) && /(?: نقطه| البند| رقم| الفقره| النقطه) /.test(tj)) { A.ordinal = parseInt(toks[i], 10); }
    }
    A.pointRef = /(?:^| )(?:النقطه|نقطه|البند|بند|الفقره|فقره|الفكره|فكره|العنصر|الجزئيه|الاولي منها|المذكوره|السابقه|السابق|الاخيره|الاخير)(?: |$)/.test(tj);

    /* نوع السؤال */
    var has = function (re) { return re.test(tj); };
    if (has(/ (?:الفرق|فرق|قارن|مقارنه|اوجه الشبه|اوجه الاختلاف|الاختلاف|ايهما) /) || (has(/ ام /) && toks.length >= 4)) A.qtype = 'compare';
    else if (has(/ (?:لخص|تلخيص|ملخص|خلاصه|اهم النقاط|اهم الافكار|اختصر) /)) A.qtype = 'summary';
    else if (has(/ (?:راجع|مراجعه) /)) A.qtype = 'review';
    else if (has(/ (?:ما هو|ما هي|ما هم|ما معني|ماذا يعني|ماذا تعني|ماذا يقصد|ما المقصود|المقصود|ما مفهوم|ما تعريف|عرف|تعريف|مفهوم|يقصد|تقصد|ما معني) /)) A.qtype = 'definition';
    else if (has(/ (?:اذكر|عدد|حدد|اعط|اعطني|استخرج) /)) A.qtype = 'list';
    else if (has(/ (?:اشرح|وضح|فسر|علل|كيف|لماذا|لم|بين|ناقش|ما دور|ما علاقه|ما اثر|ما تاثير|ما سبب) /)) A.qtype = 'explain';
    else if (has(/ (?:متي|اين|كم|من هو|من هي|من اول|في اي) /) || has(/ (?:ماذا حدث|ما حدث|ماذا جري) /)) A.qtype = 'fact';

    /* وحدات البحث: نزيل كلمات الحشو وكلمات السؤال، ونُبقي كلمات الوجه (facets) */
    var kept = [];
    for (var k = 0; k < toks.length; k++) {
      var t = toks[k];
      var isFacetCanon = Object.prototype.hasOwnProperty.call(c.facetCanon, t);
      if (c.stop[t] && !isFacetCanon) continue;
      if (c.qw[t] && !isFacetCanon) continue;
      if (t.length < 2 && !/^[0-9]$/.test(t)) continue;
      if (LEVELW[t]) continue;
      kept.push(t);
    }
    /* ضمائر لاصقة على كلمة وجه: أهدافه، خصائصها ... */
    kept.forEach(function (t) {
      var st = stemTok(t);
      if (!c.facetCanon[t] && c.facetOf[st] && /(?:ه|ها|هم|هما|هن)$/.test(t) && t.length > 4) A.anaphora = true;
    });
    if (has(/ (?:هذا|هذه|ذلك|تلك|هؤلاء|عنه|عنها|منه|منها|فيه|فيها|له|لها|به|بها|السابق|السابقه) /)) A.anaphora = true;

    var stems = kept.map(function (t) { return { t: t, st: stemTok(t) }; });
    var used = {}, units = [];
    for (var p = 0; p < stems.length; p++) {
      if (used[p]) continue;
      var matched = null;
      var maxN = Math.min(c.maxN, stems.length - p);
      for (var L = maxN; L >= 1 && !matched; L--) {
        var seq = [];
        for (var q = 0; q < L; q++) seq.push(stems[p + q].st);
        var key = seq.join(' ');
        if (c.gIndex[key]) { matched = { L: L, hits: c.gIndex[key], seq: seq }; }
      }
      var u;
      if (matched) {
        var syn = [], seenK = {}; seenK[matched.seq.join(' ')] = 1;
        matched.hits.forEach(function (h) {
          c.groups[h[0]].forEach(function (m) { if (!seenK[m.key]) { seenK[m.key] = 1; syn.push(m.stems); } });
        });
        u = { stems: matched.seq.slice(), syn: syn, text: stems.slice(p, p + matched.L).map(function (x) { return x.t; }).join(' ') };
        for (var z = 0; z < matched.L; z++) used[p + z] = 1;
      } else {
        u = { stems: [stems[p].st], syn: [], text: stems[p].t };
        used[p] = 1;
      }
      u.alt = [];
      if (u.stems.length === 1) { var al = altStems(stems[p].t, u.stems[0]); u.alt = al; }
      /* الوجه (facet) */
      var f = null;
      for (var sI = 0; sI < u.stems.length; sI++) if (c.facetOf[u.stems[sI]]) f = c.facetOf[u.stems[sI]];
      /* مرادفات وجه: الوحدة تُعدّ وجهاً إذا كانت أي صيغة من مجموعتها وجهاً */
      if (!f) u.syn.forEach(function (sq) { sq.forEach(function (x) { if (c.facetOf[x] && !f) f = c.facetOf[x]; }); });
      u.facet = f;
      u.num = /^[0-9]+$/.test(u.stems[0]) && u.stems.length === 1;
      u.light = u.stems.length === 1 && isLight(u.stems[0]);
      u.ordTok = stems[p] && Object.prototype.hasOwnProperty.call(c.ord, stems[p].t) && !matched;
      units.push(u);
    }
    /* الأعداد الترتيبية: تُعامل كإشارة لنقطة سابقة فقط عند وجود إشارة صريحة (النقطة/البند) أو غياب أي موضوع آخر */
    if (A.ordinal) {
      var otherTopic = units.filter(function (u) { return !u.ordTok && !u.light && !u.facet; }).length;
      if (A.pointRef || otherTopic === 0) units = units.filter(function (u) { return !u.ordTok; });
      else A.ordinal = 0;
    }
    A.units = units;
    var facets = units.filter(function (u) { return u.facet; });
    A.facet = facets.length ? facets[0].facet : null;
    A.facetUnits = facets;
    /* نص الموضوع كما كتبه الطالب (بلا كلمات الوجه) لاستعماله في أسئلة المتابعة والعرض */
    A.topicUnits = units.filter(function (u) { return !u.facet && !u.light; });
    A.topicText = A.topicUnits.map(function (u) { return u.text; }).join(' ');
    if (A.qtype === 'definition' && A.facet && A.facet !== 'definition' && !has(/ (?:تعريف|عرف|مفهوم|معني|يقصد|المقصود) /)) A.qtype = 'list';
    /* كلمات المستخدم الأصلية (لعرض موضوع السؤال كما كتبه) */
    var rawMap = {};
    String(text).split(/[\s،,؛;:!؟?.()«»"'\[\]]+/).forEach(function (w) { var nw = norm(w); if (nw && !rawMap[nw]) rawMap[nw] = w; });
    A.rawMap = rawMap;
    A.rawTopic = A.topicUnits.map(function (u) { return u.text.split(' ').map(function (x) { return rawMap[x] || x; }).join(' '); }).join(' ');
    A.rawFacet = facets.length ? (facets[0].text.split(' ').map(function (x) { return rawMap[x] || x; }).join(' ')) : '';
    return A;
  }

  /* ------------------------------------------------------------------ *
   * 8) ربط السؤال بالنطاق (idf + تصحيح إملائي + تغطية)
   * ------------------------------------------------------------------ */
  var CONF = ['صس', 'سص', 'ضظ', 'ظض', 'ذز', 'زذ', 'دذ', 'ذد', 'تط', 'طت', 'ثس', 'سث', 'حه', 'هح', 'كق', 'قك', 'عغ', 'غع', 'اي', 'يا', 'وا', 'اه', 'هو', 'ته', 'هت', 'جز'];
  function confusable(a, b) { return CONF.indexOf(a + b) !== -1; }

  function nearOne(a, b) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0;
    if (la === lb) {
      var diff = [];
      for (i = 0; i < la; i++) if (a.charAt(i) !== b.charAt(i)) { diff.push(i); if (diff.length > 2) return false; }
      if (diff.length === 1) return confusable(a.charAt(diff[0]), b.charAt(diff[0]));
      if (diff.length === 2 && diff[1] === diff[0] + 1) return a.charAt(diff[0]) === b.charAt(diff[1]) && a.charAt(diff[1]) === b.charAt(diff[0]);
      return false;
    }
    /* إدراج/حذف حرف واحد */
    var s = la < lb ? a : b, l = la < lb ? b : a;
    var x = 0, y = 0, skipped = 0;
    while (x < s.length && y < l.length) {
      if (s.charAt(x) === l.charAt(y)) { x++; y++; } else { if (++skipped > 1) return false; y++; }
    }
    return true;
  }

  function present(scope, st) { return !!scope.df[st]; }

  function bindQuery(scope, A) {
    var imax = idfMax(scope);
    A.units.forEach(function (u) {
      u.fixed = false;
      /* هل أي صيغة موجودة في النطاق؟ */
      var alts = [u.stems].concat(u.syn);
      var anyPresent = false;
      alts.forEach(function (a) { a.forEach(function (s) { if (present(scope, s)) anyPresent = true; }); });
      u.alt.forEach(function (s) { if (present(scope, s)) anyPresent = true; });
      if (!anyPresent && !u.num && u.stems.length >= 1) {
        /* محاولة تصحيح إملائي لكلمة واحدة */
        var fixedStems = u.stems.map(function (s) {
          if (present(scope, s) || s.length < 4 || /^[0-9a-z]+$/.test(s)) return s;
          var best = null, bestDf = 0;
          for (var i = 0; i < scope.vocab.length; i++) {
            var v = scope.vocab[i];
            if (v.length < 4 || Math.abs(v.length - s.length) > 1) continue;
            if (nearOne(s, v) && scope.df[v] > bestDf) { best = v; bestDf = scope.df[v]; }
          }
          return best || s;
        });
        if (fixedStems.join(' ') !== u.stems.join(' ')) { u.stems = fixedStems; u.fixed = true; }
      }
      /* أفضل صيغة حاضرة لتقدير الوزن */
      var bestA = null, bestScore = -1;
      [u.stems].concat(u.syn).forEach(function (a, ai) {
        var pres = 0, mass = 0;
        a.forEach(function (s) { if (present(scope, s)) { pres++; mass += idf(scope, s); } });
        var frac = a.length ? pres / a.length : 0;
        var sc = frac * 10 + (ai === 0 ? 0.5 : 0) + mass / 100;
        if (sc > bestScore) { bestScore = sc; bestA = a; }
      });
      var presAny = bestA.filter(function (s) { return present(scope, s); });
      u.coverable = presAny.length > 0;
      /* فعل مضارع غير موجود في النص (يساهم، يتعامل ...): وزنه أخف كي لا يُسقط سؤالاً صحيحاً */
      var vt = u.text || '';
      u.verbish = !u.coverable && u.stems.length === 1 && ((vt.charAt(0) === 'ي' && vt.length >= 4) || (vt.charAt(0) === 'ن' && vt.length >= 5));
      var mean = 0;
      if (presAny.length) { bestA.forEach(function (s) { mean += present(scope, s) ? idf(scope, s) : imax; }); mean /= bestA.length; }
      else mean = imax;
      u.idf = u.num ? Math.max(mean, imax * 0.9) : mean;
      if (u.verbish) u.idf *= 0.3;
      u.w = u.light ? 0.25 : (u.facet ? 0.6 : (u.num ? 1.5 : 1));
    });
    return A;
  }

  /* ------------------------------------------------------------------ *
   * 9) الترتيب
   * ------------------------------------------------------------------ */
  var K1 = 1.2, B = 0.75, HEAD_BOOST = 2.5;

  function bm25(scope, st, ch) {
    var tf = (ch.tb[st] || 0) + HEAD_BOOST * (ch.th[st] || 0);
    if (!tf) return 0;
    return idf(scope, st) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (ch.len || 1) / scope.avgdl));
  }

  /* حصة وحدة في فقرة: أفضل صيغة (الأصل، ثم المرادفات بوزن أقل) */
  function unitScoreChunk(scope, u, ch) {
    var best = 0, cov = 0;
    var alts = [{ s: u.stems, w: 1 }];
    u.syn.forEach(function (a) { alts.push({ s: a, w: 0.65 }); });
    u.alt.forEach(function (a) { alts.push({ s: [a], w: 0.5 }); });
    for (var i = 0; i < alts.length; i++) {
      var a = alts[i], sum = 0, pres = 0, massAll = 0, massPres = 0;
      for (var j = 0; j < a.s.length; j++) {
        var v = bm25(scope, a.s[j], ch), im = idf(scope, a.s[j]);
        massAll += (scope.df[a.s[j]] ? im : idfMax(scope));
        if (v > 0) { sum += v; pres++; massPres += im; }
      }
      if (!pres) continue;
      var frac = pres / a.s.length;
      var adj = 1;
      if (a.s.length >= 2 && pres === a.s.length) {
        var sq = scope.sections[ch.sec] ? scope.sections[ch.sec].hSeq : [];
        if (!seqHas(chunkSeq(ch), a.s) && !seqHas(sq || [], a.s)) adj = 0.5;
      }
      var val = sum * Math.pow(frac, 1.5) * a.w * adj;
      if (val > best) best = val;
      var cv = (massPres / massAll) * (a.w === 1 ? 1 : 0.85) * adj;
      if (cv > cov) cov = cv;
    }
    return { s: best, c: cov };
  }

  function candidateSet(scope, A) {
    var set = {}, out = [];
    A.units.forEach(function (u) {
      var all = [u.stems].concat(u.syn).concat(u.alt.map(function (x) { return [x]; }));
      all.forEach(function (a) { a.forEach(function (s) { (scope.post[s] || []).forEach(function (ci) { if (!set[ci]) { set[ci] = 1; out.push(ci); } }); }); });
    });
    return out;
  }

  function normText(t) { return ' ' + norm(t) + ' '; }

  function scoreChunks(scope, A, restrictDocs) {
    var cand = candidateSet(scope, A), res = [];
    var topic = A.units.filter(function (u) { return !u.light; });
    for (var i = 0; i < cand.length; i++) {
      var ch = scope.chunks[cand[i]];
      if (restrictDocs && restrictDocs.indexOf(ch.doc) === -1) continue;
      var tot = 0, covNum = 0, covDen = 0, nTopic = 0;
      for (var j = 0; j < A.units.length; j++) {
        var u = A.units[j], r = unitScoreChunk(scope, u, ch);
        tot += r.s * u.w;
        if (!u.facet && !u.light) { covNum += r.c * u.idf; covDen += u.idf; if (r.c > 0) nTopic++; }
      }
      /* مكافأة العبارة: ورود كلمات الموضوع متجاورة */
      var bonus = 0;
      if (topic.length >= 2) {
        var nt = normText(ch.text), phrase = topic.filter(function (u) { return !u.facet; }).map(function (u) { return u.text; }).join(' ');
        if (phrase && nt.indexOf(' ' + norm(phrase) + ' ') !== -1) bonus += tot * 0.25;
      }
      res.push({ idx: cand[i], score: tot + bonus, cov: covDen ? covNum / covDen : 1, nTopic: nTopic });
    }
    res.sort(function (a, b) { return b.score - a.score; });
    return res;
  }

  /* تغطية السؤال داخل مجموعة مصطلحات (قسم أو وثيقة) */
  function coverageIn(scope, A, termsSet, idxList, hSeqList) {
    var num = 0, den = 0;
    A.units.forEach(function (u) {
      if (u.facet || u.light) return;
      den += u.idf;
      var best = 0;
      [u.stems].concat(u.syn).forEach(function (a, ai) {
        var m = 0, all = 0;
        a.forEach(function (s) { all += (scope.df[s] ? idf(scope, s) : idfMax(scope)); if (termsSet[s]) m += idf(scope, s); });
        var f = all ? m / all : 0;
        if (a.length >= 2 && f > 0.999 && idxList && !phraseInChunks(scope, a, idxList, hSeqList)) f *= 0.5;
        f *= ai === 0 ? 1 : 0.85;
        if (f > best) best = f;
      });
      u.alt.forEach(function (s) { if (termsSet[s]) best = Math.max(best, 0.9); });
      num += best * u.idf;
    });
    return den ? num / den : 1;
  }

  function docTerms(scope, docId) {
    scope._dt = scope._dt || {};
    if (scope._dt[docId]) return scope._dt[docId];
    var t = {}, idx = [], hs = [];
    scope.sections.forEach(function (s) { if (s.doc === docId) { for (var k in s.terms) t[k] = 1; s.items.forEach(function (i) { idx.push(i); }); hs.push(s.hSeq || []); } });
    scope._dt[docId] = { terms: t, idx: idx, hs: hs }; return scope._dt[docId];
  }

  function facetPresentIn(c, scope, A, text, hStems) {
    /* هل وردت كلمات الوجه (أو مرادفاتها) في النص/العنوان؟ */
    if (!A.facetUnits.length) return true;
    var set = {};
    tokTerms(text, set, 1, c);
    for (var k in (hStems || {})) set[k] = 1;
    return A.facetUnits.some(function (u) {
      var alts = [u.stems].concat(u.syn);
      return alts.some(function (a) { return a.length && a.every(function (s) { return set[s]; }); });
    });
  }

  function sectionFacetInHeading(c, A, sec) {
    if (!A.facetUnits.length) return false;
    return A.facetUnits.some(function (u) {
      return [u.stems].concat(u.syn).some(function (a) { return a.length && a.every(function (s) { return sec.hStems[s]; }); });
    });
  }

  function headingTopicOverlap(scope, A, sec) {
    var num = 0, den = 0;
    A.units.forEach(function (u) {
      if (u.facet || u.light) return;
      den += u.idf;
      var best = 0;
      [u.stems].concat(u.syn).forEach(function (a, ai) {
        var m = 0, all = 0;
        a.forEach(function (s) { var im = scope.df[s] ? idf(scope, s) : idfMax(scope); all += im; if (sec.hStems[s]) m += im; });
        var f = all ? m / all : 0; f *= ai === 0 ? 1 : 0.9;
        if (f > best) best = f;
      });
      num += best * u.idf;
    });
    return den ? num / den : 0;
  }

  /* ------------------------------------------------------------------ *
   * 10) أدوات العرض
   * ------------------------------------------------------------------ */
  function itemOf(ch) {
    if (ch.kind === 'li' && ch.label) return { label: ch.label, text: ch.body };
    return { label: '', text: ch.text };
  }
  function itemPlain(it) { return typeof it === 'string' ? it : (it.label ? it.label + ': ' + it.text : it.text); }

  function pickSentences(text, A, maxChars) {
    if (text.length <= maxChars) return text;
    var ss = splitSent(text);
    if (ss.length <= 1) return text;
    var c = compileDict();
    var scored = ss.map(function (s, i) {
      var set = {}; tokTerms(s, set, 1, c);
      var sc = 0;
      A.units.forEach(function (u) { if (!u.facet && u.stems.some(function (x) { return set[x]; })) sc += 1; });
      return { s: s, i: i, sc: sc + (i === 0 ? 0.5 : 0) };
    });
    scored.sort(function (a, b) { return b.sc - a.sc || a.i - b.i; });
    var keep = [], len = 0;
    for (var i = 0; i < scored.length; i++) {
      if (len + scored[i].s.length > maxChars && keep.length) continue;
      keep.push(scored[i]); len += scored[i].s.length;
    }
    keep.sort(function (a, b) { return a.i - b.i; });
    return keep.map(function (x) { return x.s; }).join(' ');
  }

  var FACET_LABEL = {
    objectives: 'الأهداف', characteristics: 'الخصائص', types: 'الأنواع والأقسام', stages: 'المراحل', importance: 'الأهمية',
    tasks: 'المهام', causes: 'الأسباب', history: 'التاريخ', components: 'المكوّنات', conditions: 'الشروط', principles: 'المبادئ', definition: 'التعريف'
  };

  /* ------------------------------------------------------------------ *
   * 11) المحلل الرئيسي للإجابة
   * ------------------------------------------------------------------ */
  var COV_MIN = 0.7;

  function notFound(opts, why) {
    var text = opts.scopeKind === 'subject' ? MSG.subject : MSG.lecture;
    return { found: false, reason: why || 'low', blocks: [{ t: 'p', text: text }], meta: {} };
  }

  function sectionsFor(scope, A, ranked, o) {
    /* ترتيب الأقسام بدمج عنوان القسم ومحتواه */
    var c = compileDict();
    var secs = {}, maxChunk = ranked.length ? ranked[0].score : 1;
    ranked.slice(0, 60).forEach(function (r) {
      var ch = scope.chunks[r.idx], s = secs[ch.sec] || (secs[ch.sec] = { sec: ch.sec, top: 0, second: 0, cnt: 0 });
      if (r.score > s.top) { s.second = s.top; s.top = r.score; } else if (r.score > s.second) s.second = r.score;
      s.cnt++;
    });
    var out = [];
    scope.sections.forEach(function (sec, si) {
      var s = secs[si];
      var hs = headingTopicOverlap(scope, A, sec);
      var hf = sectionFacetInHeading(c, A, sec) ? 1 : 0;
      if (!s && hs === 0 && !hf) return;
      s = s || { top: 0, second: 0, cnt: 0 };
      var cs = maxChunk ? (s.top + 0.3 * s.second) / maxChunk : 0;
      var covSec = coverageIn(scope, A, sec.terms, sec.items, [sec.hSeq || []]);
      var dtm = docTerms(scope, sec.doc);
      var covDoc = coverageIn(scope, A, dtm.terms, dtm.idx, dtm.hs);
      var cov = covSec;
      /* عناوين مبتورة («مهامه»): الموضوع يُفهم من المحاضرة نفسها */
      if (hf && covDoc * 0.9 > cov) cov = covDoc * 0.9;
      var facetOk = A.facetUnits.length ? (hf || facetPresentIn(c, scope, A, sec.items.map(function (i) { return scope.chunks[i].text; }).join(' '), null)) : true;
      var score = 2.0 * hs + 1.5 * hf + 1.2 * cs + 0.8 * cov;
      /* عنوان يخص وجهاً آخر (أهداف) بينما يُسأل عن وجه مختلف (أنواع) */
      var conflict = false;
      var chc = 0, hfAny = false;
      for (var hk0 in sec.hStems) { if (c.facetOf[hk0]) hfAny = true; else if (!isLight(hk0)) chc++; }
      var tl = A.topicUnits.reduce(function (n, u) { return n + u.stems.length; }, 0);
      if (hs > 0.99 && chc <= tl) score += 0.8;
      if (!A.facet && hfAny) score *= 0.8;
      if (A.facet && A.facet !== 'definition') {
        var hfacets = {}, any = false;
        for (var hk in sec.hStems) if (c.facetOf[hk]) { hfacets[c.facetOf[hk]] = 1; any = true; }
        if (any && !hfacets[A.facet]) { conflict = true; score *= 0.55; }
      }
      out.push({ si: si, sec: sec, hs: hs, hf: hf, cs: cs, cov: cov, covSec: covSec, facetOk: !!facetOk, conflict: conflict, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  /* ---- تعريف ---- */
  var COPULA = { 'هو': 1, 'هي': 1, 'هم': 1, 'يعرف': 1, 'تعرف': 1, 'يعرفون': 1, 'يقصد': 1, 'عباره': 1, 'يعني': 1, 'تعني': 1, 'يطلق': 1, 'تتمثل': 1, 'يمثل': 1, 'تمثل': 1 };

  function definitionSentence(c, A, ch) {
    var ss = splitSent(ch.text), best = null;
    var tu = A.topicUnits;
    if (!tu.length) return null;
    for (var i = 0; i < ss.length; i++) {
      var toks = norm(ss[i]).split(' ').filter(Boolean);
      if (!toks.length) continue;
      /* موضع نهاية أول نص موضوع داخل أول 8 كلمات */
      var stems = toks.map(stemTok);
      var firstHit = -1, lastHit = -1;
      tu.forEach(function (u) {
        [u.stems].concat(u.syn).forEach(function (a) {
          if (!a.length) return;
          for (var p = 0; p < Math.min(stems.length, 10); p++) {
            var ok = true;
            for (var q = 0; q < a.length; q++) if (stems[p + q] !== a[q]) { ok = false; break; }
            if (ok) { if (firstHit === -1 || p < firstHit) firstHit = p; if (p + a.length - 1 > lastHit) lastHit = p + a.length - 1; }
          }
        });
      });
      if (firstHit === -1) continue;
      /* كل وحدات الموضوع داخل منطقة البداية؟ */
      var allIn = tu.every(function (u) {
        return [u.stems].concat(u.syn).some(function (a) {
          return a.length && a.every(function (s) { return stems.slice(0, Math.min(stems.length, lastHit + 6)).indexOf(s) !== -1; });
        });
      });
      if (!allIn) continue;
      for (var w = lastHit + 1; w <= Math.min(lastHit + 4, toks.length - 1); w++) {
        if (COPULA[toks[w]]) { best = { s: ss[i], i: i, hit: true }; break; }
      }
      if (best) break;
    }
    return best;
  }

  function levelOf(A, o) { return A.level || o.level || 'medium'; }

  function composeDefinition(scope, A, ranked, o) {
    var c = compileDict();
    if (!A.topicUnits.length) return { found: false, reason: 'no_topic', blocks: [{ t: 'p', text: MSG.noTopic }], meta: {} };
    var lvl = levelOf(A, o);
    var cands = ranked.slice(0, 25), best = null;
    cands.forEach(function (r) {
      var ch = scope.chunks[r.idx];
      var sec = scope.sections[ch.sec];
      var termsAll = {};
      for (var k in ch.tb) termsAll[k] = 1;
      for (var k2 in ch.th) termsAll[k2] = 1;
      var cov = coverageIn(scope, A, termsAll, [ch.idx], [sec.hSeq || []]);
      var defHead = /(?:^| )(?:تعريف|مفهوم|معني|ماهيه)(?: |$)/.test(norm(sec.heading)) ? 1 : 0;
      var ds = definitionSentence(c, A, ch);
      var lab = 0;
      if (ch.kind === 'li' && ch.label) {
        var ls = {}; tokTerms(ch.label, ls, 1, c);
        var lcov = coverageIn(scope, A, ls, null, null);
        var extra = Object.keys(ls).length - A.topicUnits.reduce(function (n, u) { return n + u.stems.length; }, 0);
        if (lcov >= 0.85) lab = extra <= 0 ? 1 : (extra <= 1 ? 0.6 : 0);
      }
      var val = r.score / (ranked[0].score || 1) + (ds ? 1.7 : 0) + defHead * 0.8 + lab * 1.3 + cov * 0.8;
      if (!best || val > best.val) best = { val: val, ch: ch, cov: cov, ds: ds, lab: lab, defHead: defHead, r: r, sec: sec };
    });
    if (!best) return notFound(o, 'none');
    if (best.cov < COV_MIN) return notFound(o, 'low_cov');
    var blocks = [], items = [];
    var maxC = lvl === 'simple' ? 220 : (lvl === 'detailed' ? 1400 : 520);
    if (best.lab && !best.ds) {
      /* عدة نقاط معنونة تطابق الموضوع (أنواع الاختبارات مثلاً): نعرض القائمة كلها لا نقطة واحدة */
      var sibs = best.sec.items.filter(function (i) {
        var x = scope.chunks[i]; if (x.kind !== 'li' || !x.label) return false;
        var ls2 = {}; tokTerms(x.label, ls2, 1, c);
        return coverageIn(scope, A, ls2, null, null) >= 0.85;
      });
      if (sibs.length >= 2) { var rl = composeList(scope, A, ranked, o, false); if (rl.found) return rl; }
      var it = itemOf(best.ch);
      blocks.push({ t: 'p', label: it.label, text: it.text });
      items.push(itemPlain(it));
    } else if (best.ds) {
      var sentences = splitSent(best.ch.text);
      var take = [sentences[best.ds.i]];
      if (lvl !== 'simple') {
        var j = best.ds.i + 1;
        while (j < sentences.length && take.join(' ').length < (lvl === 'detailed' ? 700 : 260)) { take.push(sentences[j]); j++; }
        if (lvl === 'medium' && take.length > 2) take = take.slice(0, 2);
      }
      blocks.push({ t: 'p', text: pickSentences(take.join(' '), A, maxC) });
    } else {
      /* لا توجد صيغة تعريف صريحة: أفضل فقرة ذات صلة */
      blocks.push({ t: 'p', text: pickSentences(best.ch.text, A, maxC) });
      if (lvl === 'detailed') extraRelated(scope, A, ranked, best.ch.idx, blocks, 2);
    }
    if (lvl === 'detailed' && best.defHead) extraRelated(scope, A, ranked, best.ch.idx, blocks, 2);
    return { found: true, blocks: blocks, meta: { qtype: 'definition', topic: A.topicText, items: items, docs: [best.ch.doc] } };
  }

  function extraRelated(scope, A, ranked, skipIdx, blocks, n) {
    var used = 0, top = ranked.length ? ranked[0].score : 1, seen = {};
    blocks.forEach(function (b) { if (b.text) seen[norm(b.text)] = 1; });
    for (var i = 0; i < ranked.length && used < n; i++) {
      var r = ranked[i];
      if (r.idx === skipIdx) continue;
      if (r.score < top * 0.45 || r.cov < COV_MIN) continue;
      var ch = scope.chunks[r.idx], key = norm(ch.text);
      if (seen[key]) continue; seen[key] = 1;
      blocks.push({ t: 'p', text: ch.text });
      used++;
    }
  }

  /* ---- قوائم (أهداف / أنواع / مهام ...) ---- */
  function renderSection(scope, sec, ordered, lvl) {
    var blocks = [], items = [], plain = [];
    var li = [];
    sec.items.forEach(function (ci) {
      var ch = scope.chunks[ci];
      if (ch.kind === 'li') li.push(ch);
      else {
        if (li.length) { blocks.push({ t: ordered ? 'ol' : 'ul', items: li.map(itemOf) }); li.forEach(function (x) { plain.push(itemPlain(itemOf(x))); }); li = []; }
        blocks.push({ t: 'p', text: ch.text });
      }
    });
    if (li.length) { blocks.push({ t: ordered ? 'ol' : 'ul', items: li.map(itemOf) }); li.forEach(function (x) { plain.push(itemPlain(itemOf(x))); }); }
    if (lvl === 'simple') {
      blocks.forEach(function (b) {
        if (b.items) b.items = b.items.map(function (it) { return it.label ? { label: it.label, text: splitSent(it.text)[0] || it.text } : { label: '', text: splitSent(it.text)[0] || it.text }; });
        else if (b.text) b.text = splitSent(b.text)[0] || b.text;
      });
    }
    return { blocks: blocks, plain: plain };
  }

  function topicDisplay(A) { return A.topicText; }

  function composeList(scope, A, ranked, o, ordered) {
    var c = compileDict();
    if (!A.topicUnits.length && !A.facetUnits.length) return { found: false, reason: 'no_topic', blocks: [{ t: 'p', text: MSG.noTopic }], meta: {} };
    var lvl = levelOf(A, o);
    var secs = sectionsFor(scope, A, ranked, o);
    /* قبول الأقسام */
    var ok = secs.filter(function (s) {
      if (s.cov < COV_MIN) return false;
      if (A.facetUnits.length && !s.facetOk) {
        /* «أنواع/مكونات» تكفي فيها نقاط معنونة تحت عنوان يطابق الموضوع */
        var relaxed = (A.facet === 'types' || A.facet === 'components') && s.hs >= 0.99 && s.sec.items.length >= 2 && !s.conflict;
        if (!relaxed) return false;
      }
      /* عنوان يحمل كلمات موضوع: يجب أن يطابق السؤال بدرجة كافية؛ العنوان المبتور («مهامه») يُستثنى */
      var contentHead = 0;
      for (var hk in s.sec.hStems) if (!c.facetOf[hk] && !isLight(hk)) contentHead++;
      if (contentHead > 0 && s.hs < 0.6) return false;
      return s.hs > 0 || s.hf > 0 || s.cs > 0.5;
    });
    if (!ok.length) return notFound(o, 'low_cov');
    var best = ok[0];
    /* لا نقبل قسماً لا يمس الموضوع عنواناً ولا يقل عن نصف أفضل درجة */
    var chosen = [best];
    var limit = o.scopeKind === 'subject' ? 3 : 2;
    for (var i = 1; i < ok.length && chosen.length < limit; i++) {
      var s = ok[i];
      if (!A.facetUnits.length) continue;
      if (s.score < best.score * 0.72) continue;
      if (A.facetUnits.length && !(s.hf || s.facetOk)) continue;
      if (s.hs + 0.001 < best.hs * 0.6) continue;
      chosen.push(s);
    }
    chosen.sort(function (a, b) { return scope.docIndex[a.sec.doc] - scope.docIndex[b.sec.doc] || a.si - b.si; });
    var blocks = [], items = [], docs = [], seen = {};
    chosen.forEach(function (s, idx) {
      var r = renderSection(scope, s.sec, ordered, lvl);
      /* حذف التكرار الحرفي بين الأقسام */
      var key = norm(r.plain.join(' | '));
      if (key && seen[key]) return; if (key) seen[key] = 1;
      if (idx > 0 && blocks.length) blocks.push({ t: 'hr' });
      r.blocks.forEach(function (b) { blocks.push(b); });
      r.plain.forEach(function (p) { items.push(p); });
      if (docs.indexOf(s.sec.doc) === -1) docs.push(s.sec.doc);
    });
    var lead = '';
    if (A.anaphora || !A.rawTopic || !A.rawFacet) lead = (A.facet && FACET_LABEL[A.facet]) ? FACET_LABEL[A.facet] + ':' : '';
    else if (A.rawFacet) lead = A.rawFacet + ' ' + A.rawTopic + ':';
    else lead = A.rawTopic + ':';
    var mm = { qtype: ordered ? 'stages' : 'list', topic: A.topicText, facet: A.facet, items: items, docs: docs };
    if (lead && blocks.length && blocks[0].t !== 'p') blocks.unshift({ t: 'p', text: lead, strong: true });
    if (lvl === 'detailed') {
      /* توسيع: فقرات مجاورة ذات صلة */
      extraRelated(scope, A, ranked, -1, blocks, 2);
    }
    return { found: true, blocks: blocks, meta: mm };
  }

  /* ---- شرح عام / سؤال حقائق ---- */
  function composeExplain(scope, A, ranked, o) {
    var c = compileDict();
    if (!A.topicUnits.length && !A.facetUnits.length) return { found: false, reason: 'no_topic', blocks: [{ t: 'p', text: MSG.noTopic }], meta: {} };
    var lvl = levelOf(A, o);
    if (!ranked.length) return notFound(o, 'none');
    var top = ranked[0];
    var maxK = lvl === 'simple' ? 1 : (lvl === 'detailed' ? 6 : 3);
    var picked = [];
    for (var i = 0; i < ranked.length && picked.length < maxK; i++) {
      var r = ranked[i];
      if (r.score < top.score * (lvl === 'detailed' ? 0.4 : 0.55)) break;
      if (r.cov < COV_MIN) continue;
      picked.push(r);
    }
    if (!picked.length) return notFound(o, 'low_cov');
    /* الوجه المطلوب يجب أن يظهر (مثل «أسباب» عند السؤال عن الأسباب) */
    if (A.facetUnits.length && A.facet !== 'definition') {
      var okF = picked.some(function (r) { var ch = scope.chunks[r.idx]; return facetPresentIn(c, scope, A, ch.text, scope.sections[ch.sec].hStems); });
      if (!okF) return notFound(o, 'facet');
    }
    picked.sort(function (a, b) { return a.idx - b.idx; });
    var blocks = [], items = [], docs = [], li = [];
    function flushLi() { if (li.length === 1) { var one = itemOf(li[0]); blocks.push({ t: 'p', label: one.label, text: one.text }); items.push(itemPlain(one)); li = []; } else if (li.length) { blocks.push({ t: 'ul', items: li.map(itemOf) }); li.forEach(function (x) { items.push(itemPlain(itemOf(x))); }); li = []; } }
    var maxC = lvl === 'simple' ? 240 : (lvl === 'detailed' ? 1400 : 600);
    picked.forEach(function (r) {
      var ch = scope.chunks[r.idx];
      if (docs.indexOf(ch.doc) === -1) docs.push(ch.doc);
      if (ch.kind === 'li') li.push(ch);
      else { flushLi(); blocks.push({ t: 'p', text: pickSentences(ch.text, A, maxC) }); items.push(ch.text); }
    });
    flushLi();
    return { found: true, blocks: blocks, meta: { qtype: 'explain', topic: A.topicText, items: items, docs: docs } };
  }

  /* ---- شرح موضوع مجرد (وضع الشرح): تعريف + الأقسام الأقرب ---- */
  function composeOverview(scope, A, ranked, o) {
    var lvl = levelOf(A, o);
    var d = composeDefinition(scope, A, ranked, o);
    if (!d.found || lvl === 'simple') return d;
    var secs = sectionsFor(scope, A, ranked, o).filter(function (s) { return s.cov >= COV_MIN && s.hs >= 0.6; });
    var blocks = d.blocks.slice(), items = (d.meta.items || []).slice(), seen = {};
    blocks.forEach(function (b) { if (b.text) seen[norm(b.text)] = 1; });
    var maxS = lvl === 'detailed' ? 4 : 2, added = 0;
    for (var i = 0; i < secs.length && added < maxS; i++) {
      var r = renderSection(scope, secs[i].sec, false, 'medium');
      var key = norm(r.plain.join(' | ') + ' ' + (r.blocks[0] && r.blocks[0].text || ''));
      if (!key || seen[key]) continue; seen[key] = 1;
      blocks.push({ t: 'hr' });
      r.blocks.forEach(function (b) { if (!(b.t === 'p' && seen[norm(b.text)] && blocks.length < 2)) blocks.push(b); });
      r.plain.forEach(function (x) { items.push(x); });
      added++;
    }
    d.blocks = blocks; d.meta.items = items; d.meta.qtype = 'overview';
    return d;
  }

  /* ---- مقارنة ---- */
  function splitCompareEntities(A) {
    var toks = A.toks.slice(), start = 0, i;
    for (i = 0; i < toks.length; i++) if (/^(?:الفرق|فرق|قارن|مقارنه|اوجه|الاختلاف)$/.test(toks[i])) { start = i + 1; break; }
    var rest = toks.slice(start);
    while (rest.length && (rest[0] === 'بين' || rest[0] === 'اوجه' || rest[0] === 'الشبه' || rest[0] === 'الاختلاف')) rest.shift();
    var cut = -1;
    for (i = 1; i < rest.length; i++) {
      if (rest[i] === 'و' || rest[i] === 'ام' || rest[i] === 'مقابل' || rest[i] === 'وبين') { cut = i; break; }
      if (/^وال/.test(rest[i])) { rest[i] = rest[i].slice(1); cut = i - 0.5; break; }
    }
    if (cut === -1) return null;
    var a, b;
    if (cut % 1 !== 0) { a = rest.slice(0, Math.ceil(cut)); b = rest.slice(Math.ceil(cut)); }
    else { a = rest.slice(0, cut); b = rest.slice(cut + 1); }
    if (!a.length || !b.length) return null;
    if (b.length === 1 && a.length >= 2) b = a.slice(0, a.length - 1).concat(b);
    return [{ text: a.join(' ') }, { text: b.join(' ') }];
  }

  function analyzeSubQuery(text) { var a = analyze(text); return a; }

  function composeCompare(scope, A, o) {
    var ents = splitCompareEntities(A);
    if (!ents) return { found: false, reason: 'compare_parse', blocks: [{ t: 'p', text: 'لم أتمكن من تحديد طرفي المقارنة. اكتب مثلاً: «الفرق بين … و …».' }], meta: {} };
    var res = ents.map(function (e) {
      var sub = analyzeSubQuery(e.text);
      bindQuery(scope, sub);
      var rk = scoreChunks(scope, sub, o.restrictDocs);
      var r = composeDefinition(scope, sub, rk, o);
      return { text: e.text, res: r, sub: sub, title: e.text.split(' ').map(function (x) { return A.rawMap[x] || x; }).join(' ') };
    });
    var cols = [], items = [], anyFound = false;
    res.forEach(function (r) {
      if (r.res.found) { anyFound = true; cols.push({ title: r.title, blocks: r.res.blocks.map(function (b) { return (b.label && norm(b.label) === norm(r.text)) ? { t: b.t, text: b.text } : b; }) }); (r.res.meta.items || []).forEach(function (x) { items.push(x); }); r.res.blocks.forEach(function (b) { if (b.text) items.push(b.text); }); }
      else cols.push({ title: r.title, blocks: [{ t: 'p', text: MSG.part }] });
    });
    if (!anyFound) return notFound(o, 'compare_none');
    return { found: true, blocks: [{ t: 'cmp', cols: cols }], meta: { qtype: 'compare', topic: ents[0].text, items: items } };
  }

  /* ---- مراجعة / تلخيص ---- */
  var REVIEW_ORDER = ['definition', 'objectives', 'importance', 'types', 'tasks', 'characteristics', 'stages', 'causes', 'components', 'conditions', 'principles', 'history', 'other'];
  var REVIEW_LABEL = { definition: 'التعريفات', objectives: 'الأهداف', importance: 'الأهمية', types: 'الأنواع والأقسام', tasks: 'المهام', characteristics: 'الخصائص', stages: 'المراحل', causes: 'الأسباب', components: 'المكوّنات', conditions: 'الشروط', principles: 'المبادئ', history: 'التاريخ', other: 'معلومات أساسية أخرى' };

  function composeReview(scope, A, ranked, o) {
    var c = compileDict();
    var lvl = levelOf(A, o);
    var wantFacet = A.facet && A.facet !== 'definition' ? A.facet : null;
    var wantAll = !A.topicUnits.length;
    var secs = scope.sections, groups = {}, any = false, items = [], docs = [];
    var topicSecs = null;
    if (!wantAll) {
      var rk = sectionsFor(scope, A, ranked, o).filter(function (s) { return s.cov >= COV_MIN && (s.hs > 0 || s.hf > 0 || s.cs > 0.5); });
      if (!rk.length) return notFound(o, 'low_cov');
      var bestSc = rk[0].score;
      topicSecs = {};
      rk.forEach(function (s) { if (s.score >= bestSc * 0.5) topicSecs[s.si] = 1; });
    }
    secs.forEach(function (sec, si) {
      if (topicSecs && !topicSecs[si]) return;
      if (!sec.items.length) return;
      var hs = norm(sec.heading);
      var f = 'other';
      REVIEW_ORDER.forEach(function (k) {
        if (f !== 'other' || k === 'other') return;
        var hit = (Dict.facets[k] || []).some(function (w) { var st = stemTok(norm(w).split(' ')[0]); return sec.hStems[st]; });
        if (hit) f = k;
      });
      if (/(?:^| )تعريف(?: |$)/.test(hs)) f = 'definition';
      if (wantFacet && f !== wantFacet) return;
      var chs = sec.items.map(function (i) { return scope.chunks[i]; });
      var g = groups[f] || (groups[f] = []);
      if (f === 'other' || f === 'definition') {
        /* أول جملة/نقطة فقط للمراجعة السريعة */
        var first = chs[0];
        var txt = first.kind === 'li' && first.label ? { label: first.label, text: first.body } : { label: '', text: splitSent(first.text)[0] || first.text };
        if (lvl === 'detailed') txt = itemOf(first);
        g.push(txt); items.push(itemPlain(txt));
      } else {
        chs.forEach(function (ch) {
          if (ch.kind === 'p' && lvl === 'simple') return;
          var it = ch.kind === 'li' ? itemOf(ch) : { label: '', text: splitSent(ch.text)[0] || ch.text };
          if (lvl === 'simple') it = { label: it.label, text: splitSent(it.text)[0] || it.text };
          g.push(it); items.push(itemPlain(it));
        });
      }
      if (docs.indexOf(sec.doc) === -1) docs.push(sec.doc);
      any = true;
    });
    if (!any) return notFound(o, 'review_none');
    var blocks = [];
    REVIEW_ORDER.forEach(function (k) {
      if (!groups[k] || !groups[k].length) return;
      blocks.push({ t: 'h', text: REVIEW_LABEL[k] });
      /* إزالة التكرار */
      var seen = {}, uniq = [];
      groups[k].forEach(function (it) { var key = norm(itemPlain(it)); if (!seen[key]) { seen[key] = 1; uniq.push(it); } });
      blocks.push({ t: 'ul', items: uniq.slice(0, lvl === 'detailed' ? 40 : 16) });
    });
    return { found: true, blocks: blocks, meta: { qtype: 'review', topic: A.topicText, items: items, docs: docs } };
  }

  /* ---- متابعة: «اشرح النقطة الثانية» ---- */
  function composeOrdinal(scope, A, o, ctx) {
    var items = ctx && ctx.items;
    if (!items || !items.length) return { found: false, reason: 'no_ctx', blocks: [{ t: 'p', text: MSG.noContext }], meta: {} };
    var n = A.ordinal === -1 ? items.length : A.ordinal;
    if (n < 1 || n > items.length) return { found: false, reason: 'ordinal_range', blocks: [{ t: 'p', text: 'الإجابة السابقة تحتوي على ' + items.length + ' نقطة فقط.' }], meta: { items: items, topic: ctx.topic } };
    var target = items[n - 1];
    var c = compileDict();
    /* نبحث عن مزيد من التفاصيل حول النقطة نفسها، دون إعادة النقطة ذاتها */
    var sub = analyze(target.replace(/[:：]/g, ' '));
    bindQuery(scope, sub);
    var tkey = norm(target);
    var rk = scoreChunks(scope, sub, o.restrictDocs).filter(function (r) { var k = norm(scope.chunks[r.idx].text); var lab = scope.chunks[r.idx].label ? norm(scope.chunks[r.idx].label + ' ' + scope.chunks[r.idx].body) : k; return k !== tkey && lab !== tkey && tkey.indexOf(k) === -1; });
    var blocks = [];
    var parts = target.split(/[:：]/);
    if (parts.length > 1 && parts[0].split(' ').length <= 8) blocks.push({ t: 'p', label: parts[0].trim(), text: parts.slice(1).join(':').trim() });
    else blocks.push({ t: 'p', text: target });
    var lvl = levelOf(A, o), added = 0, top = rk.length ? rk[0].score : 0;
    var maxAdd = lvl === 'simple' ? 0 : (lvl === 'detailed' ? 3 : 1);
    var labelStems = {}; tokTerms(parts[0], labelStems, 1, c);
    for (var i = 0; i < rk.length && added < maxAdd; i++) {
      var ch = scope.chunks[rk[i].idx];
      if (rk[i].cov < 0.8 || rk[i].score < top * 0.6) continue;
      /* لا نكرر نقاط القائمة السابقة نفسها */
      if (items.some(function (x) { return norm(x) === norm(itemPlain(itemOf(ch))); })) continue;
      blocks.push({ t: 'p', text: ch.text }); added++;
    }
    if (!added && maxAdd > 0) blocks.push({ t: 'p', text: 'هذا كل ما ورد في المحاضرة عن هذه النقطة.', muted: true });
    return { found: true, blocks: blocks, meta: { qtype: 'ordinal', topic: ctx.topic, items: [target] } };
  }

  /* ------------------------------------------------------------------ *
   * 12) تقسيم الأسئلة المركبة
   * ------------------------------------------------------------------ */
  function splitCompound(text) {
    var base = String(text).split(/[؟?]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    base.forEach(function (seg) {
      var n = ' ' + seg + ' ';
      /* قطع عند: «وما/وماذا/وكيف/ولماذا/واذكر/واشرح/ثم ...» */
      var re = /\s+(?:و|ثم\s+)?(?=(?:ما|ماذا|كيف|لماذا|متى|أين|هل|كم|اذكر|اشرح|عرّف|عرف|عدد|وضّح|وضح|قارن|لخّص|لخص|ما هي|ما هو)(?:\s|$))/;
      var pieces = [], rest = seg, m;
      while ((m = re.exec(rest)) && m.index > 8) {
        pieces.push(rest.slice(0, m.index).trim());
        rest = rest.slice(m.index + m[0].length - 0).trim();
        /* احتفظ بكلمة الاستفهام: m[0] لا تحتويها بسبب lookahead */
      }
      pieces.push(rest);
      pieces.forEach(function (p) { if (p) out.push(p); });
    });
    return out.length ? out : [String(text)];
  }

  /* ------------------------------------------------------------------ *
   * 13) الواجهة العامة: answer(scope, question, opts)
   * ------------------------------------------------------------------ */
  function answerOne(scope, question, o, ctx) {
    var c = compileDict();
    if (!scope || !scope.N) return { found: false, reason: 'empty', blocks: [{ t: 'p', text: MSG.emptyScope }], meta: {} };
    var A = analyze(question);
    var mode = o.mode || 'normal';

    /* سؤال متابعة بنقطة سابقة: «اشرح النقطة الثانية» */
    if (A.ordinal && ctx && ctx.items && ctx.items.length && (A.pointRef || !A.topicUnits.length)) {
      return composeOrdinal(scope, A, o, ctx);
    }
    if (A.ordinal && A.pointRef && !(ctx && ctx.items && ctx.items.length)) {
      return { found: false, reason: 'no_ctx', blocks: [{ t: 'p', text: MSG.noContext }], meta: {} };
    }

    /* ضمائر/غياب الموضوع: نستعير موضوع المحادثة السابقة */
    var needCtx = (A.anaphora || !A.topicUnits.length) && ctx && ctx.topic && A.qtype !== 'compare' && A.qtype !== 'summary' && A.qtype !== 'review';
    if (needCtx && A.topicUnits.length === 0) {
      var merged = question + ' ' + ctx.topic;
      A = analyze(merged);
    } else if (needCtx && A.anaphora && A.facetUnits.length && A.topicUnits.length === 0) {
      A = analyze(question + ' ' + ctx.topic);
    }
    bindQuery(scope, A);

    if (mode === 'review' || A.qtype === 'review' || A.qtype === 'summary') {
      if (A.qtype !== 'compare') {
        var rk0 = A.topicUnits.length ? scoreChunks(scope, A, o.restrictDocs) : [];
        return composeReview(scope, A, rk0, o);
      }
    }

    if (A.qtype === 'compare') return composeCompare(scope, A, o);

    /* لا موضوع ولا وجه: لا يمكن البحث */
    var searchable = A.units.filter(function (u) { return !u.light; });
    if (!searchable.length) return { found: false, reason: 'no_topic', blocks: [{ t: 'p', text: MSG.noTopic }], meta: {} };

    /* الوحدات غير المعروفة في النطاق: إن كان الجزء غير المغطّى كبيراً نرفض مباشرة */
    var ranked = scoreChunks(scope, A, o.restrictDocs);
    if (!ranked.length) return notFound(o, 'no_hits');

    var qtype = A.qtype;
    if (qtype === 'general') {
      qtype = A.facet && A.facet !== 'definition' ? 'list' : (A.topicUnits.length ? 'definition-or-explain' : 'explain');
    }
    var isHow = / (?:كيف|لماذا|علل|لم|ماذا يحدث|ما سبب) /.test(' ' + A.norm + ' ');
    if ((qtype === 'definition-or-explain' && mode === 'explain') || ((qtype === 'explain') && !A.facet && A.topicUnits.length && !isHow && (mode === 'explain' || A.qtype === 'explain'))) qtype = 'overview';

    var res;
    if (qtype === 'definition') res = composeDefinition(scope, A, ranked, o);
    else if (qtype === 'list') res = composeList(scope, A, ranked, o, A.facet === 'stages');
    else if (qtype === 'overview') res = composeOverview(scope, A, ranked, o);
    else if (qtype === 'definition-or-explain') {
      /* موضوع مجرد: جرّب التعريف ثم القسم الأقرب */
      res = composeDefinition(scope, A, ranked, o);
    } else if (qtype === 'fact') res = composeExplain(scope, A, ranked, o);
    else res = composeExplain(scope, A, ranked, o);

    /* وجه مطلوب مع نوع «شرح»: جرّب القائمة */
    if (!res.found && A.facetUnits.length && A.facet !== 'definition' && qtype !== 'list') {
      var r2 = composeList(scope, A, ranked, o, A.facet === 'stages');
      if (r2.found) res = r2;
    }
    if (res.found && !res.meta.topic) res.meta.topic = A.topicText;
    if (res.found && (!res.meta.topic) && ctx && ctx.topic) res.meta.topic = ctx.topic;
    res.meta.qtype = res.meta.qtype || qtype;
    if (res.found && !res.meta.items) res.meta.items = [];
    return res;
  }

  function answerCore(scope, question, opts) {
    opts = opts || {};
    var ctx = opts.ctx || null;
    var parts = splitCompound(question);
    /* لا نقسّم أسئلة المقارنة ولا أسئلة قصيرة */
    var single = parts.length < 2 || /(?:الفرق|قارن|مقارنه)/.test(norm(question));
    if (single) return answerOne(scope, question, opts, ctx);
    var blocks = [], items = [], found = 0, lastTopic = ctx && ctx.topic, topic = '', docs = [];
    parts.forEach(function (p, i) {
      var cx = ctx ? { items: ctx.items, topic: lastTopic } : (lastTopic ? { topic: lastTopic } : null);
      var r = answerOne(scope, p, opts, cx);
      blocks.push({ t: 'h', text: String(i + 1) + ') ' + p.replace(/[؟?]/g, '').trim() });
      if (r.found) {
        found++;
        r.blocks.forEach(function (b) { blocks.push(b); });
        (r.meta.items || []).forEach(function (x) { items.push(x); });
        if (r.meta.topic) { lastTopic = r.meta.topic; if (!topic) topic = r.meta.topic; }
        (r.meta.docs || []).forEach(function (d) { if (docs.indexOf(d) === -1) docs.push(d); });
      } else {
        blocks.push({ t: 'p', text: r.reason === 'no_topic' || r.reason === 'no_ctx' ? MSG.noTopic : MSG.part, muted: true });
      }
    });
    if (!found) return notFound(opts, 'compound_none');
    return { found: true, blocks: blocks, meta: { qtype: 'compound', topic: lastTopic || topic, items: items, docs: docs } };
  }


  /* ------------------------------------------------------------------ *
   * 12) طبقات احتياطية: (1) الأسئلة الشائعة/الملخص  (2) أقرب المقاطع
   * ------------------------------------------------------------------ */
  function chunkPreview(ch, A, max) {
    var t = ch.label ? ch.label + ': ' + ch.body : ch.text;
    return t.length > max ? pickSentences(t, A, max) : t;
  }

  /* بحث متساهل: لا يشترط تغطية كاملة للسؤال، بل يعرض أقرب المقاطع مع نسبتها إلى المحاضرة */
  function relatedAnswer(scope, question, opts, fromAux) {
    if (!scope || !scope.N) return null;
    var A = analyze(question);
    bindQuery(scope, A);
    var topic = A.units.filter(function (u) { return !u.light; });
    if (!topic.length) return null;
    /* مصطلح غير موجود في المحاضرات أصلًا: لا نعرض مقاطع بعيدة عنه */
    var A0 = analyze(question), real = 0, unseenN = 0;
    A0.units.forEach(function (u) {
      if (u.light || u.facet) return;
      var verbish = /^[ني][^ ]{4,}$/.test(u.text) && u.text.indexOf('ال') !== 0;
      if (verbish) return;
      real++;
      var ok = false;
      [u.stems].concat(u.syn || []).concat((u.alt || []).map(function (x) { return [x]; })).forEach(function (a) { a.forEach(function (st) { if (present(scope, st)) ok = true; }); });
      if (!ok) unseenN++;
    });
    /* مصطلحات جوهرية غائبة عن المحاضرات: لا نخمّن */
    if (real && unseenN && unseenN / real >= 0.33) return null;
    var ranked = scoreChunks(scope, A, null).filter(function (r) { return r.nTopic >= 1 && r.score > 0; });
    if (!ranked.length) return null;
    var top = ranked[0], need = A.topicUnits.length > 1 ? 0.34 : 0.2, picked = [], seen = {};
    for (var i = 0; i < ranked.length && picked.length < 3; i++) {
      var r = ranked[i];
      if (r.score < top.score * 0.45) break;
      if (r.cov < need) continue;
      var ch = scope.chunks[r.idx], key = norm(ch.text).slice(0, 90);
      if (seen[key]) continue; seen[key] = 1;
      picked.push(r);
    }
    if (!picked.length) return null;
    var items = [], docs = [], list = [];
    picked.forEach(function (r) {
      var ch = scope.chunks[r.idx], sec = scope.sections[ch.sec];
      if (docs.indexOf(ch.doc) === -1) docs.push(ch.doc);
      var txt = chunkPreview(ch, A, 420);
      var head = fromAux && sec && sec.heading && sec.heading !== 'حقائق من أسئلة التقييم' && ch.kind === 'p' && !ch.label ? sec.heading + ': ' : '';
      var full = head + txt;
      list.push(full); items.push(full);
    });
    var blocks = [{ t: 'p', text: 'لم أجد جوابًا مطابقًا تمامًا، وهذه أقرب المقاطع الواردة في المحاضرات:', muted: true }];
    if (list.length === 1) blocks.push({ t: 'p', text: list[0] });
    else blocks.push({ t: 'ul', items: list });
    return { found: true, blocks: blocks, meta: { qtype: 'related', topic: A.topicText, items: items, docs: docs, related: true } };
  }

  /* الفهرس المساعد أصغر؛ إن كان في السؤال مصطلح جوهري موجود في المحاضرات ومفقود منه فلا نعتمد عليه */
  function auxCovers(scope, question) {
    var A = analyze(question), ok = true;
    A.units.forEach(function (u) {
      if (u.light || u.facet) return;
      var inMain = false, inAux = false;
      [u.stems].concat(u.syn || []).concat((u.alt || []).map(function (x) { return [x]; })).forEach(function (a) {
        a.forEach(function (st) { if (present(scope, st)) inMain = true; if (present(scope.aux, st)) inAux = true; });
      });
      if (inMain && !inAux) ok = false;
    });
    return ok;
  }

  /* يتحقق أن جواب الفهرس المساعد يحوي (هو أو سؤاله الأصلي) كل مصطلح جوهري في السؤال */
  function verifyAux(scope, question, res) {
    var A0 = analyze(question), bn = ' ' + norm(blocksToText(res.blocks)) + ' ', heads = '';
    scope.aux.chunks.forEach(function (ch) {
      var t = norm(ch.text);
      if (t.length > 3 && bn.indexOf(t) !== -1) heads += ' ' + scope.aux.sections[ch.sec].heading;
    });
    var have = {};
    norm(bn + ' ' + heads).split(' ').forEach(function (t) {
      if (!t) return;
      var st = stemTok(t); have[st] = 1;
      altStems(t, st).forEach(function (x) { have[x] = 1; });
    });
    var ok = true;
    A0.units.forEach(function (u) {
      if (u.light || u.facet) return;
      var inMain = false, inRes = false;
      [u.stems].concat(u.syn || []).concat((u.alt || []).map(function (x) { return [x]; })).forEach(function (a) {
        if (a.every(function (st) { return have[st]; })) inRes = true;
        a.forEach(function (st) { if (present(scope, st)) inMain = true; });
      });
      if (inMain && !inRes) ok = false;
    });
    return ok;
  }

  function answer(scope, question, opts) {
    opts = opts || {};
    var res = answerCore(scope, question, opts);
    if (res && res.found) return res;
    var reason = res && res.reason;
    /* أسئلة لا تحتاج بحثًا إضافيًا (ضمائر بلا سياق، موضوع غامض) */
    if (reason === 'no_topic' || reason === 'no_ctx' || reason === 'empty') {
      if (!(scope && scope.aux)) return res;
    }
    try {
      /* 1) الأسئلة الشائعة والملخص وحقائق الاختبارات */
      if (scope && scope.aux && scope.aux.N && auxCovers(scope, question)) {
        var ra = answerCore(scope.aux, question, opts);
        if (ra && ra.found && verifyAux(scope, question, ra)) { ra.meta = ra.meta || {}; ra.meta.fromAux = true; return ra; }
      }
      /* 2) أقرب المقاطع (نص المحاضرة أولًا ثم الفهرس المساعد) */
      if (reason !== 'no_topic' && reason !== 'no_ctx') {
        var rl = relatedAnswer(scope, question, opts, false);
        if (!rl && scope && scope.aux) rl = relatedAnswer(scope.aux, question, opts, true);
        if (rl) return rl;
      }
    } catch (e) { /* أي خطأ في الطبقات الاحتياطية لا يكسر المحادثة */ }
    return res;
  }

  /* نص عادي للتصدير/النسخ */
  function blocksToText(blocks) {
    var out = [];
    (blocks || []).forEach(function (b) {
      if (b.t === 'p') out.push((b.label ? b.label + ': ' : '') + b.text);
      else if (b.t === 'h') out.push(b.text + ':');
      else if (b.t === 'hr') out.push('');
      else if (b.t === 'ul' || b.t === 'ol') b.items.forEach(function (it, i) { out.push((b.t === 'ol' ? (i + 1) + '. ' : '• ') + itemPlain(it)); });
      else if (b.t === 'cmp') b.cols.forEach(function (col) { out.push(col.title + ':'); out.push(blocksToText(col.blocks)); });
    });
    return out.join('\n');
  }

  /* عنوان تلقائي للمحادثة من أول سؤال */
  function autoTitle(q) {
    var A = analyze(q);
    var base = A.topicText || A.norm || String(q);
    base = base.replace(/\s+/g, ' ').trim();
    if (!base) base = String(q).trim();
    if (A.rawFacet && A.rawTopic) base = A.rawFacet + ' ' + A.rawTopic;
    else if (A.rawTopic) base = A.rawTopic;
    return base.length > 40 ? base.slice(0, 38).trim() + '…' : base;
  }

  /* مساعد: بناء وثيقة خام من مدخلات الموقع */
  function rawFrom(entry) {
    var sections = [];
    if (entry.markdown) sections = parseMarkdown(entry.markdown, entry.include);
    else if (entry.lesson) sections = parseLesson(entry.lesson);
    else if (entry.text) sections = parsePlainText(entry.text);
    else if (entry.sections) sections = entry.sections;
    return { id: entry.id, title: entry.title || '', sections: sections };
  }

  var API = {
    VERSION: VERSION, MSG: MSG, norm: norm, stem: stemTok, analyze: analyze, bindQuery: bindQuery,
    parseMarkdown: parseMarkdown, parseLesson: parseLesson, parsePlainText: parsePlainText, rawFrom: rawFrom,
    prepareDoc: prepareDoc, buildScope: buildScope, answer: answer, blocksToText: blocksToText, autoTitle: autoTitle,
    splitCompound: splitCompound, hashStr: hashStr, INCLUDE_TOP: INCLUDE_TOP, FACET_LABEL: FACET_LABEL
  };
  root.ChatEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
