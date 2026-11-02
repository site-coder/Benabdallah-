/* ==========================================================================
   ai-engine.js — تبويب «الذكاء الاصطناعي» داخل كل محاضرة
   لا تحتوي هذه النسخة على أي مفتاح. الاتصال يتم عبر Cloudflare Worker.
   ========================================================================== */
(function () {
  'use strict';

  var AI_PROXY_URL = 'https://curly-firefly-2cb6.mbenabdallah663.workers.dev';
  var LECTURES_URL = 'lectures.json';
  var FRIENDLY_FAIL = 'الخدمة مشغولة حالياً بسبب كثرة الاستخدام. أعد المحاولة بعد لحظات.';

  var histories = {};   /* لكل محاضرة سجلها الخاص */
  var lectures = null;
  var busy = false;

  var css =
  '#panel.ai-panel{padding:14px 12px}' +
  '.ai-chat{display:flex;flex-direction:column;height:min(70vh,560px);height:min(70dvh,560px);min-height:360px}' +
  '.ai-title{text-align:center;font-size:13px;color:var(--muted);padding:0 4px 10px;border-bottom:1px solid var(--line);margin-bottom:6px}' +
  '.ai-log{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 2px;display:flex;flex-direction:column;gap:10px}' +
  '.ai-m{max-width:90%;padding:10px 14px;border-radius:16px;font-size:15px;line-height:1.85;overflow-wrap:anywhere}' +
  '.ai-m.u{align-self:flex-start;background:linear-gradient(135deg,var(--p),var(--p2));color:#fff}' +
  '.ai-m.b{align-self:flex-end;background:var(--bg);border:1px solid var(--line)}' +
  '.ai-m ul{padding-inline-start:20px;margin:4px 0}' +
  '.ai-hint{text-align:center;color:var(--muted);font-size:14px;padding:18px 8px}' +
  '.ai-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}' +
  '.ai-chip{padding:7px 12px;border:1px solid var(--line);border-radius:99px;background:var(--bg);font-size:13px;cursor:pointer}' +
  '.ai-dots{align-self:flex-end;display:flex;gap:5px;padding:13px 16px;background:var(--bg);border:1px solid var(--line);border-radius:16px}' +
  '.ai-dots i{width:8px;height:8px;border-radius:50%;background:var(--p2);animation:aib 1.1s infinite ease-in-out}' +
  '.ai-dots i:nth-child(2){animation-delay:.18s}.ai-dots i:nth-child(3){animation-delay:.36s}' +
  '@keyframes aib{0%,80%,100%{opacity:.25;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}' +
  '.ai-f{display:flex;gap:8px;align-items:flex-end;padding-top:10px;border-top:1px solid var(--line)}' +
  '.ai-in{flex:1;min-height:44px;max-height:120px;resize:none;padding:10px 14px;border-radius:14px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit;font-size:16px;line-height:1.6}' +
  '.ai-send{flex:none;height:44px;padding:0 18px;border-radius:14px;border:0;background:linear-gradient(135deg,var(--p),var(--p2));color:#fff;font-weight:600;cursor:pointer}' +
  '.ai-send:disabled{opacity:.5;cursor:not-allowed}';

  var styled = false;
  function addCss() {
    if (styled) return; styled = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(t) {
    var lines = esc(t).split('\n'), out = '', inList = false;
    lines.forEach(function (ln) {
      var m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(ln);
      if (m) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + m[1] + '</li>'; }
      else { if (inList) { out += '</ul>'; inList = false; } if (ln.trim()) out += '<div>' + ln + '</div>'; }
    });
    if (inList) out += '</ul>';
    return out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  function mount(panel, id) {
    addCss();
    busy = false;
    panel.classList.add('ai-panel');
    panel.innerHTML =
      '<div class="ai-chat">' +
        '<div class="ai-title">اسأل عن هذه المحاضرة، وستأتي الإجابة من نصها فقط</div>' +
        '<div class="ai-log" aria-live="polite"></div>' +
        '<div class="ai-f"><textarea class="ai-in" rows="1" maxlength="700" placeholder="اكتب سؤالك عن هذه المحاضرة…"></textarea>' +
        '<button class="ai-send" type="button">إرسال</button></div>' +
      '</div>';

    var log = panel.querySelector('.ai-log'),
        inp = panel.querySelector('.ai-in'),
        btn = panel.querySelector('.ai-send'),
        hist = histories[id] = histories[id] || [];

    function down() { log.scrollTop = log.scrollHeight; }
    function add(role, text) {
      var d = document.createElement('div');
      d.className = 'ai-m ' + (role === 'user' ? 'u' : 'b');
      if (role === 'user') d.textContent = text; else d.innerHTML = fmt(text);
      log.appendChild(d); down();
    }
    function dots(on) {
      var d = log.querySelector('.ai-dots');
      if (!on) { if (d) d.remove(); return; }
      if (d) return;
      d = document.createElement('div'); d.className = 'ai-dots'; d.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(d); down();
    }

    if (!hist.length) {
      log.innerHTML = '<div class="ai-hint">اطرح أي سؤال عن هذه المحاضرة.' +
        '<div class="ai-chips"><button class="ai-chip" type="button">لخّص لي المحاضرة</button>' +
        '<button class="ai-chip" type="button">ما أهم النقاط للامتحان؟</button></div></div>';
    } else {
      hist.forEach(function (m) { add(m.role, m.content); });
    }

    function send() {
      var q = inp.value.trim();
      if (busy || !q) return;
      var hint = log.querySelector('.ai-hint'); if (hint) hint.remove();
      add('user', q);
      inp.value = ''; inp.style.height = 'auto';
      busy = true; btn.disabled = true; dots(true);

      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 70000);
      fetch(AI_PROXY_URL, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId: id, question: q, history: hist.slice(-6) })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok || !x.j.answer) throw new Error('fail');
          hist.push({ role: 'user', content: q }, { role: 'assistant', content: x.j.answer });
          dots(false); add('assistant', x.j.answer);
        })
        .catch(function () { dots(false); add('assistant', FRIENDLY_FAIL); })
        .then(function () { clearTimeout(timer); busy = false; btn.disabled = false; });
    }

    btn.onclick = send;
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    inp.addEventListener('input', function () {
      this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    log.addEventListener('click', function (e) {
      var c = e.target.closest('.ai-chip'); if (c) { inp.value = c.textContent; send(); }
    });
  }

  window.AIChat = { mount: mount };
})();
