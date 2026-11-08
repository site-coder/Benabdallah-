/* ==========================================================================
   chat-ui.js — واجهة المحادثة: شات المحاضرة + مساعد المقياس + إدارة المحادثات
   (بحث نصي محلي؛ لا اتصال بأي خدمة خارجية)
   ========================================================================== */
(function (root) {
  'use strict';
  var E = root.ChatEngine, S = root.ChatStore, D = root.ChatData;
  var st = { on: false, kind: 'lecture', sid: '', title: '', kicker: '', conv: null, convs: [], msgs: [], mode: 'normal', level: 'medium', busy: false, scopeP: null, info: null, lastSend: 0, filter: '', pushed: false };
  var el = {};

  function $(s, r) { return (r || document).querySelector(s); }
  function mk(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function scopeKey() { return st.kind + ':' + st.sid; }
  function fmtDate(ts) { try { return new Date(ts).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }); } catch (e) { return new Date(ts).toLocaleDateString(); } }
  function fmtTime(ts) { try { return new Date(ts).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }); } catch (e) { return new Date(ts).toLocaleString(); } }

  /* ---------------------------- بناء الهيكل ---------------------------- */
  function build() {
    if (el.root) return;
    var r = mk('div'); r.id = 'acChat'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true');
    r.innerHTML =
      '<div class="ac-head">' +
        '<button class="ac-ib" id="acBack" type="button" aria-label="رجوع">→</button>' +
        '<div class="ac-ttl"><div class="ac-kick" id="acKick"></div><div class="ac-name" id="acName"></div></div>' +
        '<button class="ac-ib ac-toggle" id="acTog" type="button" aria-label="المحادثات">☰</button>' +
        '<button class="ac-ib" id="acMore" type="button" aria-label="خيارات">⋮</button>' +
      '</div>' +
      '<div class="ac-menu" id="acMenu">' +
        '<button type="button" data-a="rename">إعادة تسمية المحادثة</button>' +
        '<button type="button" data-a="txt">تصدير TXT</button>' +
        '<button type="button" data-a="pdf">تصدير PDF</button>' +
        '<button type="button" data-a="del">حذف المحادثة الحالية</button>' +
      '</div>' +
      '<div class="ac-bar">' +
        '<div class="ac-seg" id="acModes" role="group" aria-label="وضع المحادثة">' +
          '<button type="button" data-m="normal" aria-pressed="true">عادي</button>' +
          '<button type="button" data-m="explain" aria-pressed="false">شرح</button>' +
          '<button type="button" data-m="review" aria-pressed="false">مراجعة</button>' +
        '</div>' +
        '<select class="ac-lvl" id="acLvl" aria-label="مستوى الشرح" hidden><option value="simple">مبسّط</option><option value="medium" selected>متوسط</option><option value="detailed">مفصّل</option></select>' +
        '<span class="ac-stat" id="acStat"></span>' +
      '</div>' +
      '<div class="ac-body">' +
        '<div class="ac-main">' +
          '<div class="ac-log" id="acLog" aria-live="polite"></div>' +
          '<div class="ac-comp"><textarea class="ac-in" id="acIn" rows="1" maxlength="700" placeholder="اكتب سؤالك هنا…"></textarea><button class="ac-send" id="acSend" type="button">إرسال</button></div>' +
        '</div>' +
        '<aside class="ac-side" id="acSide">' +
          '<div class="ac-sh"><button class="ac-new" id="acNew" type="button">＋ محادثة جديدة</button><input class="ac-search" id="acSearch" type="search" placeholder="ابحث في عناوين المحادثات"></div>' +
          '<div class="ac-list" id="acList"></div>' +
        '</aside>' +
      '</div>';
    document.body.appendChild(r);
    el.root = r;
    ['acBack', 'acKick', 'acName', 'acTog', 'acMore', 'acMenu', 'acModes', 'acLvl', 'acStat', 'acLog', 'acIn', 'acSend', 'acNew', 'acSearch', 'acList', 'acSide'].forEach(function (id) { el[id] = $('#' + id, r); });

    el.acBack.onclick = close;
    el.acTog.onclick = function () { el.acSide.classList.toggle('on'); };
    el.acMore.onclick = function (e) { e.stopPropagation(); el.acMenu.classList.toggle('on'); };
    r.addEventListener('click', function (e) { if (!e.target.closest('#acMenu') && !e.target.closest('#acMore')) el.acMenu.classList.remove('on'); });
    el.acMenu.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; el.acMenu.classList.remove('on'); menuAct(b.dataset.a); };
    el.acModes.onclick = function (e) { var b = e.target.closest('button'); if (b) setMode(b.dataset.m); };
    el.acLvl.onchange = function () { st.level = el.acLvl.value; saveConvMeta(); };
    el.acSend.onclick = send;
    el.acNew.onclick = function () { newChat(); el.acSide.classList.remove('on'); el.acIn.focus(); };
    el.acSearch.oninput = function () { st.filter = el.acSearch.value.trim(); renderList(); };
    el.acIn.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    el.acIn.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 160) + 'px'; });
    el.acList.onclick = onListClick;
    el.acLog.addEventListener('click', function (e) { var b = e.target.closest('.ac-cp'); if (b) copyMsg(b); });
    addEventListener('popstate', function (e) {
      if (!st.on) return;
      var s = e.state;
      if (s && (s.chat || s.t === 'ai')) return;
      hide();
    });
  }

  /* ---------------------------- فتح / إغلاق ---------------------------- */
  function subjName(i) { return (root.SUBJECTS && root.SUBJECTS[i] && root.SUBJECTS[i].alt) || ('المقياس ' + (i + 1)); }

  function openLecture(s, l) {
    st.kind = 'lecture'; st.sid = (s + 1) + '-' + l; st.kicker = 'شات المحاضرة'; st.title = 'محاضرة ' + l + ' · ' + subjName(s); st.pushed = false;
    start();
  }
  function openSubject(s) {
    st.kind = 'subject'; st.sid = String(s + 1); st.kicker = 'مساعد المقياس'; st.title = subjName(s);
    try { history.pushState({ v: 'list', s: s, l: 1, chat: 1 }, ''); st.pushed = true; } catch (e) { st.pushed = false; }
    start();
  }

  function start() {
    build();
    st.on = true; st.conv = null; st.msgs = []; st.busy = false; st.filter = ''; el.acSearch.value = '';
    el.root.classList.add('on'); document.body.classList.add('ac-lock');
    el.acKick.textContent = st.kicker; el.acName.textContent = st.title;
    el.acIn.placeholder = st.kind === 'lecture' ? 'اكتب سؤالك عن هذه المحاضرة…' : 'اسأل عن أي موضوع ضمن هذا المقياس…';
    el.acSide.classList.remove('on');
    setStat('جارٍ التجهيز…');
    st.scopeP = D.scopeFor(st.kind, st.sid, setStat).then(function (r) {
      st.info = r.info;
      var i = r.info;
      var msg;
      if (!i.lectures) msg = st.kind === 'lecture' ? 'لا يوجد نص مجهّز لهذه المحاضرة بعد' : 'لا توجد محاضرات مجهّزة لهذا المقياس بعد';
      else msg = st.kind === 'lecture' ? 'المحاضرة جاهزة للبحث (تعمل دون إنترنت)' : 'جاهز: ' + i.lectures + ' محاضرة (تعمل دون إنترنت)';
      if (i.scanned) msg += ' · ملف PDF مصوّر يحتاج معالجة OCR قبل استخدامه';
      setStat(msg);
      return r.scope;
    }).catch(function () {
      setStat('تعذّر التجهيز. اتصل بالإنترنت لتجهيز المحاضرة أولاً ثم أعد المحاولة.');
      return null;
    });
    S.listConvs(scopeKey()).then(function (list) {
      st.convs = list; sortConvs();
      if (list.length) return openConv(list[0].id); 
      newChat(); return null;
    }).then(function () { renderList(); });
    setTimeout(function () { el.acIn.focus(); }, 60);
  }

  function setStat(t) { if (el.acStat) el.acStat.textContent = t; }

  function hide() {
    if (!st.on) return;
    st.on = false; el.root.classList.remove('on'); document.body.classList.remove('ac-lock');
  }
  function close() {
    if (st.kind === 'lecture') {
      hide();
      var b = document.getElementById('backHub'); if (b) b.click();
    } else {
      var had = st.pushed; hide();
      if (had && history.state && history.state.chat) history.back();
    }
  }

  /* ---------------------------- المحادثات ---------------------------- */
  function sortConvs() { st.convs.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated; }); }

  function newChat() {
    st.conv = null; st.msgs = []; st.mode = 'normal'; st.level = 'medium';
    syncModeUI(); renderLog(); renderList();
  }

  function openConv(id) {
    return S.getConv(id).then(function (c) {
      if (!c || c.scope !== scopeKey()) return;
      st.conv = c; st.mode = c.mode || 'normal'; st.level = c.level || 'medium';
      return S.listMsgs(id).then(function (m) { st.msgs = m; syncModeUI(); renderLog(); renderList(); });
    });
  }

  function syncModeUI() {
    Array.prototype.forEach.call(el.acModes.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.m === st.mode ? 'true' : 'false'); });
    el.acLvl.hidden = st.mode !== 'explain'; el.acLvl.value = st.level;
  }
  function setMode(m) { st.mode = m; syncModeUI(); saveConvMeta(); }
  function saveConvMeta() { if (st.conv) { st.conv.mode = st.mode; st.conv.level = st.level; S.putConv(st.conv); } }

  function renderList() {
    el.acList.innerHTML = '';
    var q = st.filter ? E.norm(st.filter) : '';
    var shown = st.convs.filter(function (c) { return !q || E.norm(c.title).indexOf(q) !== -1; });
    if (!shown.length) { el.acList.appendChild(mk('div', 'ac-empty', q ? 'لا نتائج مطابقة' : 'لا توجد محادثات سابقة')); return; }
    shown.forEach(function (c) {
      var d = mk('div', 'ac-ci' + (st.conv && st.conv.id === c.id ? ' cur' : '')); d.dataset.id = c.id;
      var t = mk('div', 't'); t.appendChild(mk('b', '', (c.pinned ? '📌 ' : '') + c.title));
      t.appendChild(mk('small', '', 'أُنشئت ' + fmtDate(c.created) + ' · آخر نشاط ' + fmtTime(c.updated)));
      var ops = mk('div', 'ops');
      [['pin', c.pinned ? '📍' : '📌', 'تثبيت'], ['ren', '✏️', 'إعادة تسمية'], ['del', '🗑', 'حذف']].forEach(function (o) { var b = mk('button', '', o[1]); b.type = 'button'; b.dataset.op = o[0]; b.title = o[2]; b.setAttribute('aria-label', o[2]); ops.appendChild(b); });
      d.appendChild(t); d.appendChild(ops); el.acList.appendChild(d);
    });
  }

  function onListClick(e) {
    var item = e.target.closest('.ac-ci'); if (!item) return;
    var id = item.dataset.id, op = e.target.closest('button') && e.target.closest('button').dataset.op;
    var c = st.convs.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    if (op === 'pin') { c.pinned = !c.pinned; S.putConv(c).then(function () { sortConvs(); renderList(); }); }
    else if (op === 'ren') renameConv(c);
    else if (op === 'del') deleteConv(c);
    else { if (st.busy) return; openConv(id); el.acSide.classList.remove('on'); }
  }

  function renameConv(c) {
    var n = prompt('عنوان المحادثة:', c.title);
    if (n == null) return; n = n.trim().slice(0, 80); if (!n) return;
    c.title = n; c.titleAuto = false; S.putConv(c).then(renderList);
  }
  function deleteConv(c) {
    if (!confirm('حذف هذه المحادثة نهائياً؟')) return;
    S.deleteConv(c.id).then(function () {
      st.convs = st.convs.filter(function (x) { return x.id !== c.id; });
      if (st.conv && st.conv.id === c.id) { if (st.convs.length) openConv(st.convs[0].id); else newChat(); }
      renderList();
    });
  }

  function menuAct(a) {
    if (a === 'new') return newChat();
    if (!st.conv) { if (a !== 'rename') alert('لا توجد محادثة محفوظة بعد.'); return; }
    if (a === 'rename') renameConv(st.conv);
    else if (a === 'del') deleteConv(st.conv);
    else if (a === 'txt') exportTxt();
    else if (a === 'pdf') exportPdf();
  }

  /* ---------------------------- العرض ---------------------------- */
  function renderBlocks(blocks, host) {
    (blocks || []).forEach(function (b) {
      if (b.t === 'p') {
        var p = mk('p', (b.muted ? 'mut ' : '') + (b.strong ? 'strong' : ''));
        if (b.label) { p.appendChild(mk('span', 'lb', b.label + ': ')); }
        p.appendChild(document.createTextNode(b.text)); host.appendChild(p);
      } else if (b.t === 'h') host.appendChild(mk('h4', '', b.text));
      else if (b.t === 'hr') host.appendChild(mk('hr'));
      else if (b.t === 'ul' || b.t === 'ol') {
        var l = mk(b.t);
        b.items.forEach(function (it) {
          var li = mk('li');
          if (typeof it === 'string') li.textContent = it;
          else { if (it.label) li.appendChild(mk('span', 'lb', it.label + ': ')); li.appendChild(document.createTextNode(it.text)); }
          l.appendChild(li);
        });
        host.appendChild(l);
      } else if (b.t === 'cmp') {
        var g = mk('div', 'ac-cmp');
        b.cols.forEach(function (c) { var d = mk('div'); d.appendChild(mk('h4', '', c.title)); renderBlocks(c.blocks, d); g.appendChild(d); });
        host.appendChild(g);
      }
    });
  }

  function msgNode(m) {
    var d = mk('div', 'ac-m ' + (m.role === 'user' ? 'u' : 'b' + (m.found === false ? ' nf' : '')));
    if (m.role === 'user') { d.textContent = m.text; return d; }
    renderBlocks(m.blocks, d);
    if (m.found !== false) { var b = mk('button', 'ac-cp', 'نسخ الإجابة'); b.type = 'button'; b.dataset.id = m.id; d.appendChild(b); }
    return d;
  }

  function renderLog() {
    el.acLog.innerHTML = '';
    if (!st.msgs.length) {
      el.acLog.appendChild(mk('div', 'ac-hint', st.kind === 'lecture'
        ? 'اكتب أي سؤال عن هذه المحاضرة، وستأتيك الإجابة من نصها وحده.'
        : 'اكتب أي سؤال ضمن هذا المقياس، وسيبحث المساعد في محاضراته وحدها.'));
      return;
    }
    st.msgs.forEach(function (m) { el.acLog.appendChild(msgNode(m)); });
    down();
  }
  function down() { el.acLog.scrollTop = el.acLog.scrollHeight; }
  function dots(on) {
    var d = el.acLog.querySelector('.ac-dots');
    if (!on) { if (d) d.remove(); return; }
    if (d) return; d = mk('div', 'ac-dots'); d.innerHTML = '<i></i><i></i><i></i>'; el.acLog.appendChild(d); down();
  }

  function copyMsg(btn) {
    var m = st.msgs.filter(function (x) { return x.id === btn.dataset.id; })[0]; if (!m) return;
    var done = function () { var o = btn.textContent; btn.textContent = 'تم النسخ ✓'; setTimeout(function () { btn.textContent = o; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(m.text).then(done, fallback); else fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = m.text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } t.remove(); }
  }

  /* ---------------------------- الإرسال ---------------------------- */
  function ctxFromMsgs() {
    for (var i = st.msgs.length - 1; i >= 0; i--) {
      var m = st.msgs[i];
      if (m.role === 'assistant' && m.found && m.meta) return { topic: m.meta.topic || '', items: m.meta.items || [] };
    }
    return null;
  }

  function send() {
    var q = el.acIn.value.trim();
    var now = Date.now();
    if (st.busy || !q || (now - st.lastSend < 400)) return;
    st.lastSend = now; st.busy = true; el.acSend.disabled = true;
    el.acIn.value = ''; el.acIn.style.height = 'auto';
    var hint = el.acLog.querySelector('.ac-hint'); if (hint) hint.remove();

    var ensure = st.conv ? Promise.resolve(st.conv) : S.putConv({ id: S.uid(), scope: scopeKey(), kind: st.kind, sid: st.sid, title: E.autoTitle(q), titleAuto: true, pinned: false, created: now, updated: now, mode: st.mode, level: st.level }).then(function (c) { st.conv = c; st.convs.unshift(c); sortConvs(); return c; });
    var userMsg = { id: S.uid(), conv: null, role: 'user', text: q, ts: now, seq: st.msgs.length };
    ensure.then(function (c) {
      userMsg.conv = c.id;
      st.msgs.push(userMsg); el.acLog.appendChild(msgNode(userMsg)); down(); dots(true);
      return S.putMsg(userMsg);
    }).then(function () {
      return Promise.all([st.scopeP, new Promise(function (r) { setTimeout(r, 280); })]);
    }).then(function (arr) {
      var scope = arr[0], res;
      var ctx = ctxFromMsgs();
      /* السياق يُشتق من الرسائل قبل هذا السؤال */
      if (ctx && st.msgs.length) { /* آخر رد قبل userMsg */ }
      try {
        res = scope && scope.N ? E.answer(scope, q, { scopeKind: st.kind, mode: st.mode, level: st.level, ctx: ctx })
          : { found: false, blocks: [{ t: 'p', text: st.kind === 'lecture' ? 'لا يوجد نص مجهّز لهذه المحاضرة بعد. إن كنت غير متصل فاتصل بالإنترنت وأعد فتح المحاضرة لتجهيزها.' : 'لا توجد محاضرات مجهّزة لهذا المقياس بعد.' }], meta: {} };
      } catch (err) {
        res = { found: false, blocks: [{ t: 'p', text: 'حدث خطأ أثناء معالجة السؤال. أعد صياغته وحاول مرة أخرى.' }], meta: {} };
        if (root.console) console.error(err);
      }
      var am = { id: S.uid(), conv: st.conv.id, role: 'assistant', blocks: res.blocks, text: E.blocksToText(res.blocks), found: !!res.found, meta: res.found ? { topic: res.meta.topic || '', items: (res.meta.items || []).slice(0, 40), qtype: res.meta.qtype, docs: res.meta.docs } : { reason: res.reason }, ts: Date.now(), seq: st.msgs.length };
      st.msgs.push(am); dots(false); el.acLog.appendChild(msgNode(am)); down();
      st.conv.updated = am.ts; st.conv.mode = st.mode; st.conv.level = st.level;
      return S.putMsg(am).then(function () { return S.putConv(st.conv); });
    }).catch(function (e) { dots(false); if (root.console) console.error(e); })
      .then(function () { st.busy = false; el.acSend.disabled = false; sortConvs(); renderList(); el.acIn.focus(); });
  }

  /* ---------------------------- التصدير ---------------------------- */
  function safeName(t) { return (t || 'محادثة').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'محادثة'; }
  function exportText() {
    var out = [st.kicker + ': ' + st.title, 'المحادثة: ' + st.conv.title, 'أُنشئت: ' + fmtTime(st.conv.created) + ' — آخر نشاط: ' + fmtTime(st.conv.updated), '', '----------------------------------------', ''];
    st.msgs.forEach(function (m) { out.push((m.role === 'user' ? 'الطالب: ' : 'المساعد: ') + m.text); out.push(''); });
    return out.join('\n');
  }
  function exportTxt() {
    var blob = new Blob(['\ufeff' + exportText()], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = safeName(st.conv.title) + '.txt';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function exportPdf() {
    var rows = st.msgs.map(function (m) { return '<div class="m ' + (m.role === 'user' ? 'u' : 'b') + '"><b>' + (m.role === 'user' ? 'الطالب' : 'المساعد') + '</b><div>' + esc(m.text).replace(/\n/g, '<br>') + '</div></div>'; }).join('');
    var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + esc(safeName(st.conv.title)) + '</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#111}h1{font-size:18px;margin:0}p.s{color:#555;font-size:12px;margin:2px 0 14px}.m{border:1px solid #ccc;border-radius:10px;padding:8px 12px;margin:8px 0;page-break-inside:avoid}.u{background:#f1ebff}.m b{display:block;font-size:12px;color:#6d28d9}</style></head><body><h1>' + esc(st.kicker + ': ' + st.title) + '</h1><p class="s">' + esc(st.conv.title) + ' — ' + esc(fmtTime(st.conv.created)) + '</p>' + rows + '</body></html>';
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(function () { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(function () { f.remove(); }, 60000); }, 300);
  }

  root.AcadChat = { openLecture: openLecture, openSubject: openSubject, close: close, _st: st };
})(window);
