/* ==========================================================================
   auth.js — تسجيل الدخول عبر Google One Tap + حفظ حالة الطالب
   - نافذة «النقرة الواحدة» تظهر فور فتح الصفحة، وزر قوقل الاحتياطي داخل البطاقة
   - الجلسة محفوظة في localStorage وتتجدد مع كل فتح للتطبيق (لا يُطلب الدخول مجدداً)
   - يحفظ محلياً وبشكل دائم لكل طالب: البريد، التقدّم في المحاضرات، نتائج الاختبارات، الملاحظات
     (المفتاح: edu_data_<معرّف قوقل>) ولا تُحذف عند تسجيل الخروج، فتعود عند الدخول بنفس الحساب
   - يرسل الأحداث والتقدّم إلى Cloudflare Worker (/track) مع رمز Google ID Token
     (نصوص الملاحظات تبقى على الجهاز ولا تُرسل، يُرسل فقط حدث «تم حفظ ملاحظة» وطولها)
   - يوفّر window.EduAuth للاستخدام من أي ملف آخر
   ملاحظة: الموقع ثابت (GitHub Pages)، فالحالة المحفوظة هنا للعرض والتتبع فقط
   وليست وسيلة حماية. التحقق الحقيقي يتم في الـ Worker.
   ========================================================================== */
(function () {
  'use strict';

  var CLIENT_ID = '858808052749-2h3qrn3bsrqov6q4fdhvpm5viee8hc0n.apps.googleusercontent.com';

  /* Cloudflare Worker: نقطة استقبال الأحداث وتسجيل الدخول */
  var TRACK_URL = 'https://wild-wind-8577.mbenabdallah663.workers.dev/track';

  var GSI_SRC = 'https://accounts.google.com/gsi/client';
  var USER_KEY = 'edu_user';
  var QUEUE_KEY = 'edu_events';
  var TOKEN_KEY = 'edu_idt';
  var DATA_PREFIX = 'edu_data_';
  var SESSION_DAYS = 365;      /* جلسة متجددة: تمتد سنة كاملة من آخر فتح للتطبيق */
  var MAX_QUEUE = 200;
  var NOTE_MAX = 5000;

  var user = null;
  var data = null;             /* بيانات الطالب الحالي: { email, progress, notes, last } */
  var idToken = null;          /* صالح ساعة واحدة تقريباً (مدة صلاحية رمز قوقل) */
  var tokenExp = 0;
  var listeners = [];
  var gsiState = 'idle';       /* idle | loading | ready | failed */
  var gsiWaiters = [];
  var skipPrompt = false;      /* بعد الخروج اليدوي لا نعرض One Tap تلقائياً في نفس الصفحة */

  /* ------------------------------- storage ------------------------------- */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function loadUser() {
    try {
      var u = JSON.parse(get(USER_KEY) || 'null');
      if (!u || !u.id) return null;
      if (Date.now() - (u.lastSeen || u.loginAt || 0) > SESSION_DAYS * 864e5) { del(USER_KEY); return null; }
      return u;
    } catch (e) { return null; }
  }
  function persistUser() { if (user) set(USER_KEY, JSON.stringify(user)); }

  function saveToken() { set(TOKEN_KEY, JSON.stringify({ t: idToken, exp: tokenExp })); }
  function restoreToken() {
    try {
      var o = JSON.parse(get(TOKEN_KEY) || 'null');
      if (o && o.t && o.exp > Date.now()) { idToken = o.t; tokenExp = o.exp; } else del(TOKEN_KEY);
    } catch (e) { del(TOKEN_KEY); }
  }
  function validToken() { return !!idToken && tokenExp - 60000 > Date.now(); }

  /* ------------------------- بيانات الطالب (محلية دائمة) ------------------------- */
  function dataKey() { return DATA_PREFIX + user.id; }

  function loadData() {
    var d = null;
    if (user) { try { d = JSON.parse(get(dataKey()) || 'null'); } catch (e) { d = null; } }
    if (!d || typeof d !== 'object') d = {};
    if (!d.progress || typeof d.progress !== 'object') d.progress = {};
    if (!d.notes || typeof d.notes !== 'object') d.notes = {};
    if (!d.last || typeof d.last !== 'object') d.last = null;
    if (user) { d.email = user.email; d.name = user.name; }
    data = d;
  }

  function saveData() {
    if (!user || !data) return false;
    data.email = user.email;
    data.updatedAt = Date.now();
    return set(dataKey(), JSON.stringify(data));
  }

  function lecProgress(key) {
    var p = data.progress[key];
    if (!p || typeof p !== 'object') p = data.progress[key] = { tabs: {}, visits: 0 };
    if (!p.tabs) p.tabs = {};
    return p;
  }

  /* نسبة الإنجاز: قراءة الدرس + الملخص + الأسئلة العادية + إنهاء اختبار الاختيار من متعدد (٤ خطوات) */
  function percent(key) {
    var p = data && data.progress[key];
    if (!p) return 0;
    var n = 0;
    ['read', 'sum', 'faq'].forEach(function (t) { if (p.tabs && p.tabs[t]) n++; });
    if (p.quiz) n++;
    return Math.round(n / 4 * 100);
  }

  function markTab(key, tab) {
    if (!user || !data || !key || !tab) return;
    var p = lecProgress(key), first = !p.tabs[tab];
    p.tabs[tab] = Date.now();
    p.lastAt = Date.now();
    if (first && tab === 'read') p.visits = (p.visits || 0) + 1;
    saveData();
    if (first) track('tab_view', { lecture: key, tab: tab, pct: percent(key) });
  }

  function saveQuiz(key, right, total) {
    if (!user || !data || !key || !total) return;
    var p = lecProgress(key), q = p.quiz || { best: 0, attempts: 0 };
    q.last = right; q.total = total; q.best = Math.max(q.best || 0, right);
    q.attempts = (q.attempts || 0) + 1; q.ts = Date.now();
    p.quiz = q; p.lastAt = Date.now();
    saveData();
    track('quiz_done', { lecture: key, score: right, total: total, best: q.best, pct: percent(key) });
  }

  function setLast(s, l, tab) {
    if (!user || !data) return;
    data.last = { s: s, l: l, tab: tab || 'read', ts: Date.now() };
    saveData();
  }
  function getLast() { return data && data.last ? Object.assign({}, data.last) : null; }

  var noteSent = {};
  function getNote(key) {
    var n = data && data.notes[key];
    return n && n.t ? String(n.t) : '';
  }
  function hasNote(key) { return !!getNote(key); }
  function setNote(key, text) {
    if (!user || !data || !key) return false;
    text = String(text || '').slice(0, NOTE_MAX);
    if (!text.trim()) delete data.notes[key];
    else data.notes[key] = { t: text, ts: Date.now() };
    var ok = saveData();
    if (ok && text.trim() && Date.now() - (noteSent[key] || 0) > 60000) {
      noteSent[key] = Date.now();
      track('note_saved', { lecture: key, len: text.length });
    }
    return ok;
  }

  /* ملخص صغير للتقدّم يُرسل مع كل دفعة أحداث (بدون نصوص الملاحظات) */
  function snapshot() {
    if (!data) return null;
    var out = {};
    Object.keys(data.progress).forEach(function (k) {
      var p = data.progress[k], o = { pct: percent(k) };
      if (p.quiz) { o.best = p.quiz.best; o.total = p.quiz.total; o.attempts = p.quiz.attempts; }
      out[k] = o;
    });
    return { lectures: out, notes: Object.keys(data.notes).length, last: data.last };
  }

  /* --------------------------------- JWT --------------------------------- */
  /* فك ترميز آمن لليونيكود (الأسماء العربية) */
  function decodeJwt(token) {
    try {
      var p = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      var bin = atob(p), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (e) { return null; }
  }

  /* ------------------------------- tracking ------------------------------- */
  function readQueue() { try { return JSON.parse(get(QUEUE_KEY) || '[]'); } catch (e) { return []; } }

  function track(type, d) {
    if (!user) return;
    var q = readQueue();
    q.push({ t: type, d: d || {}, ts: Date.now(), uid: user.id });
    if (q.length > MAX_QUEUE) q = q.slice(q.length - MAX_QUEUE);
    set(QUEUE_KEY, JSON.stringify(q));
    flush();
  }

  var flushing = false, retryTimer = null, refreshTried = false;

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function () { retryTimer = null; flush(); }, 30000);
  }

  /* تجديد رمز قوقل بصمت قدر الإمكان (مرة واحدة لكل فتح للصفحة) */
  function refreshToken() {
    if (refreshTried || !user) return;
    refreshTried = true;
    loadGsi(function (ok) {
      if (!ok || !window.google || !google.accounts) return;
      try { google.accounts.id.prompt(); } catch (e) { /* ignore */ }
    });
  }

  function flush() {
    if (!TRACK_URL || !user || flushing || !navigator.onLine) return;
    var q = readQueue();
    if (!q.length) return;
    flushing = true;
    var sent = q.length;
    /* text/plain: طلب «بسيط» لا يحتاج preflight، والـ Worker يقرأ الجسم كـ JSON عادي */
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      body: JSON.stringify({
        app: 'eps-chlef-hub',
        user: { id: user.id, name: user.name, email: user.email },
        idToken: validToken() ? idToken : null,
        progress: snapshot(),
        events: q
      })
    }).then(function (r) {
      if (r.ok) {
        var rest = readQueue().slice(sent);
        set(QUEUE_KEY, JSON.stringify(rest));
        if (rest.length) setTimeout(flush, 300);   /* أحداث وصلت أثناء الإرسال: أرسلها فوراً */
      } else if (r.status === 401 || r.status === 403) {
        refreshToken();            /* تبقى الأحداث في الطابور حتى يصل رمز جديد */
      } else if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
        set(QUEUE_KEY, JSON.stringify(readQueue().slice(sent)));   /* طلب مرفوض نهائياً: لا نكرره */
      } else {
        scheduleRetry();
      }
    }).catch(function () { scheduleRetry(); })
      .then(function () { flushing = false; });
  }

  /* --------------------------------- events --------------------------------- */
  function notify(reason) {
    listeners.slice().forEach(function (fn) { try { fn(user); } catch (e) { /* ignore */ } });
    try { window.dispatchEvent(new CustomEvent('edu-auth', { detail: { user: user, reason: reason || 'change' } })); } catch (e) { /* ignore */ }
  }

  /* ----------------------------------- GSI ----------------------------------- */
  function loadGsi(cb) {
    if (gsiState === 'ready') return cb(true);
    if (gsiState === 'failed') gsiState = 'idle';
    gsiWaiters.push(cb);
    if (gsiState === 'loading') return;
    gsiState = 'loading';

    function done(ok) {
      gsiState = ok ? 'ready' : 'failed';
      var w = gsiWaiters; gsiWaiters = [];
      w.forEach(function (fn) { fn(ok); });
    }

    var s = document.createElement('script');
    s.src = GSI_SRC; s.async = true; s.defer = true;
    s.onload = function () {
      try {
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: onCredential,
          auto_select: true,              /* دخول صامت للحساب المعتمد سابقاً */
          cancel_on_tap_outside: false,   /* لا تُغلق النافذة بلمس أي مكان في البوابة */
          context: 'signin',
          itp_support: true
        });
        done(true);
      } catch (e) { done(false); }
    };
    s.onerror = function () { s.remove(); done(false); };
    document.head.appendChild(s);
  }

  function onCredential(resp) {
    var c = decodeJwt(resp && resp.credential);
    var okIss = c && (c.iss === 'https://accounts.google.com' || c.iss === 'accounts.google.com');
    if (!c || c.aud !== CLIENT_ID || !okIss || c.exp * 1000 < Date.now()) {
      setMsg('تعذّر التحقق من بيانات الدخول. حاول مرة أخرى.', true);
      return;
    }
    var renewal = !!(user && user.id === c.sub);
    idToken = resp.credential;
    tokenExp = c.exp * 1000;
    saveToken();
    if (renewal) { flush(); return; }   /* تجديد الرمز لنفس المستخدم: لا حدث دخول جديد */
    user = {
      id: c.sub,
      name: c.name || '',
      givenName: c.given_name || '',
      email: c.email || '',
      emailVerified: !!c.email_verified,
      picture: c.picture || '',
      loginAt: Date.now(),
      lastSeen: Date.now()
    };
    persistUser();
    loadData();                          /* تعود ملاحظاته وتقدّمه السابق إن وُجدت */
    saveData();
    applyGate();
    notify('login');
    track('login', {});
  }

  /* ------------------------------ login gate ------------------------------ */
  var root = document.documentElement;

  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    var m = $('authMsg');
    if (!m) return;
    m.textContent = text || ''; m.className = 'gate-msg' + (isErr ? ' err' : '');
  }

  /* نافذة «النقرة الواحدة» (One Tap) */
  function oneTap() {
    if (user || skipPrompt) return;
    try { google.accounts.id.prompt(); } catch (e) { /* ignore */ }
  }

  function renderGate() {
    var box = $('authGBtn'), retry = $('authRetry');
    if (!box || user) return;
    box.textContent = '';
    if (retry) retry.hidden = true;
    setMsg('جارٍ التحميل…');
    loadGsi(function (ok) {
      if (user) return;
      if (!ok) {
        setMsg(navigator.onLine ? 'تعذّر تحميل تسجيل الدخول. حاول مرة أخرى.' : 'يلزم اتصال بالإنترنت لتسجيل الدخول أول مرة.', true);
        if (retry) retry.hidden = false;
        return;
      }
      setMsg('');
      /* الزر الاحتياطي: يعمل دائماً حتى لو منع المتصفح نافذة One Tap */
      var wrap = document.createElement('div');
      wrap.className = 'gate-gwrap';
      box.appendChild(wrap);
      var light = root.getAttribute('data-theme') === 'light';
      google.accounts.id.renderButton(wrap, {
        type: 'standard', theme: light ? 'outline' : 'filled_black', size: 'large',
        text: 'signin_with', shape: 'pill', logo_alignment: 'left', locale: 'ar',
        width: Math.min(300, Math.max(200, (box.clientWidth || 300) - 20))
      });
      oneTap();
    });
  }

  /* يظهر الموقع فقط عند وجود مستخدم مسجَّل، وإلا تظهر البوابة */
  function applyGate() {
    if (user) { root.setAttribute('data-signed', '1'); }
    else { root.removeAttribute('data-signed'); renderGate(); }
  }

  function signOut() {
    track('logout', {});
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    /* تُحذف الجلسة فقط. ملاحظات الطالب وتقدّمه تبقى على الجهاز وتعود عند الدخول بنفس الحساب */
    user = null; data = null; idToken = null; tokenExp = 0; refreshTried = false;
    skipPrompt = true;
    del(USER_KEY); del(TOKEN_KEY);
    notify('logout');
    applyGate();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  /* ----------------------------------- API ----------------------------------- */
  window.EduAuth = {
    getUser: function () { return user ? Object.assign({}, user) : null; },
    getIdToken: function () { return validToken() ? idToken : null; },
    isSignedIn: function () { return !!user; },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    signIn: applyGate,
    signOut: signOut,
    track: track,
    /* التقدّم */
    markTab: markTab,
    saveQuiz: saveQuiz,
    percent: function (key) { return percent(key); },
    getProgress: function (key) {
      var p = data && data.progress[key];
      return p ? { pct: percent(key), tabs: Object.assign({}, p.tabs), quiz: p.quiz ? Object.assign({}, p.quiz) : null } : { pct: 0, tabs: {}, quiz: null };
    },
    setLast: setLast,
    getLast: getLast,
    /* الملاحظات */
    getNote: getNote,
    setNote: setNote,
    hasNote: hasNote,
    noteMax: NOTE_MAX
  };

  /* ---------------------------------- start ---------------------------------- */
  function start() {
    user = loadUser();
    if (user) {
      restoreToken();
      user.lastSeen = Date.now();       /* تجديد الجلسة مع كل فتح */
      persistUser();
      loadData();
    }
    var retry = $('authRetry');
    if (retry) retry.addEventListener('click', function () { gsiState = 'idle'; renderGate(); });
    applyGate();
    if (user) { notify('restore'); track('app_open', {}); }
  }
  window.addEventListener('online', function () { flush(); if (!user) renderGate(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
