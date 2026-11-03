/* ==========================================================================
   auth.js — تسجيل الدخول عبر Google (Google Identity Services) + حفظ حالة الطالب
   - يحمّل مكتبة قوقل عند الحاجة فقط (لا يعطّل الموقع ولا وضع الأوفلاين)
   - يستلم الاسم والبريد والصورة من رمز الهوية (ID Token) ويحفظها محلياً
   - يوفّر window.EduAuth للاستخدام من أي ملف آخر
   - يرسل الأحداث (دخول، خروج، فتح التطبيق، فتح المحاضرات) إلى Cloudflare Worker (/track)
     مع رمز Google ID Token ليتحقق منه الـ Worker من جهة الخادم
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
  var SESSION_DAYS = 30;
  var MAX_QUEUE = 200;

  var user = null;
  var idToken = null;          /* صالح ساعة واحدة تقريباً (مدة صلاحية رمز قوقل) */
  var tokenExp = 0;
  var listeners = [];
  var gsiState = 'idle';       /* idle | loading | ready | failed */
  var gsiWaiters = [];

  /* ------------------------------- storage ------------------------------- */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function loadUser() {
    try {
      var u = JSON.parse(get(USER_KEY) || 'null');
      if (!u || !u.id) return null;
      if (Date.now() - (u.loginAt || 0) > SESSION_DAYS * 864e5) { del(USER_KEY); return null; }
      return u;
    } catch (e) { return null; }
  }

  function saveToken() { set(TOKEN_KEY, JSON.stringify({ t: idToken, exp: tokenExp })); }
  function restoreToken() {
    try {
      var o = JSON.parse(get(TOKEN_KEY) || 'null');
      if (o && o.t && o.exp > Date.now()) { idToken = o.t; tokenExp = o.exp; } else del(TOKEN_KEY);
    } catch (e) { del(TOKEN_KEY); }
  }
  function validToken() { return !!idToken && tokenExp - 60000 > Date.now(); }

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

  function track(type, data) {
    if (!user) return;
    var q = readQueue();
    q.push({ t: type, d: data || {}, ts: Date.now(), uid: user.id });
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
        events: q
      })
    }).then(function (r) {
      if (r.ok) {
        set(QUEUE_KEY, JSON.stringify(readQueue().slice(sent)));
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
          auto_select: true,
          cancel_on_tap_outside: true,
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
      loginAt: Date.now()
    };
    set(USER_KEY, JSON.stringify(user));
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
      google.accounts.id.renderButton(box, {
        type: 'standard', theme: 'filled_blue', size: 'large',
        text: 'signin_with', shape: 'pill', logo_alignment: 'left', locale: 'ar',
        width: Math.min(300, Math.max(200, (box.clientWidth || 300) - 20))
      });
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
    user = null; idToken = null; tokenExp = 0; refreshTried = false;
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
    track: track
  };

  /* ---------------------------------- start ---------------------------------- */
  function start() {
    user = loadUser();
    if (user) restoreToken();
    var retry = $('authRetry');
    if (retry) retry.addEventListener('click', function () { gsiState = 'idle'; renderGate(); });
    applyGate();
    if (user) { notify('restore'); track('app_open', {}); }
  }
  window.addEventListener('online', function () { flush(); if (!user) renderGate(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
