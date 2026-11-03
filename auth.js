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
    renderFab();
    notify('login');
    track('login', {});
    closeSheet();
  }

  /* ------------------------------------ UI ------------------------------------ */
  var css =
    '.auth-fab{position:fixed;z-index:60;top:calc(env(safe-area-inset-top,0px) + 84px);left:14px;width:38px;height:38px;padding:0;display:grid;place-items:center;overflow:hidden;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--p2);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);transition:transform .2s,box-shadow .2s}' +
    '.auth-fab:active{transform:scale(.94)}' +
    '.auth-fab svg{width:20px;height:20px}' +
    '.auth-fab img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.auth-fab .ini{font-weight:800;font-size:16px;color:var(--text)}' +
    '.auth-body{padding:20px 18px calc(22px + env(safe-area-inset-bottom,0px));text-align:center;overflow-y:auto}' +
    '.auth-lead{font-size:14px;color:var(--muted);line-height:1.9;margin-bottom:16px}' +
    '.auth-gbtn{display:flex;justify-content:center;min-height:44px}' +
    '.auth-msg{margin-top:12px;font-size:13px;color:var(--muted);min-height:20px}' +
    '.auth-msg.err{color:#F87171}' +
    '.auth-av{width:84px;height:84px;margin:0 auto 12px;border-radius:50%;overflow:hidden;display:grid;place-items:center;border:2px solid var(--p2);background:var(--card);box-shadow:var(--glow)}' +
    '.auth-av img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.auth-av .ini{font-size:34px;font-weight:800}' +
    '.auth-name{font-size:18px;font-weight:700}' +
    '.auth-mail{font-size:13px;color:var(--muted);direction:ltr;overflow-wrap:anywhere;margin-top:2px}' +
    '.auth-out{margin-top:20px;padding:10px 26px;border-radius:99px;border:1px solid var(--line);background:var(--card);cursor:pointer;font-weight:600}' +
    '@media(hover:hover){.auth-out:hover{border-color:var(--g)}}';

  var fab, bg, body, uiBuilt = false;

  var ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  function initial(name) { return (name || '?').trim().charAt(0).toUpperCase() || '?'; }

  function avatarInto(el, u) {
    el.textContent = '';
    if (u && u.picture) {
      var img = document.createElement('img');
      img.alt = ''; img.referrerPolicy = 'no-referrer'; img.src = u.picture;
      img.onerror = function () { el.textContent = ''; var s = document.createElement('span'); s.className = 'ini'; s.textContent = initial(u.name); el.appendChild(s); };
      el.appendChild(img);
    } else if (u) {
      var sp = document.createElement('span'); sp.className = 'ini'; sp.textContent = initial(u.name); el.appendChild(sp);
    } else {
      el.innerHTML = ICON_USER;
    }
  }

  function buildUi() {
    if (uiBuilt) return; uiBuilt = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    fab = document.getElementById('authSlot');   /* زر الهيدر الموجود في index.html */
    if (fab) {
      fab.classList.add('auth-fab');
    } else {
      fab = document.createElement('button');
      fab.type = 'button'; fab.className = 'auth-fab';
      document.body.appendChild(fab);
    }
    fab.addEventListener('click', openSheet);

    bg = document.createElement('div');
    bg.className = 'sheet-bg'; bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="authT">' +
        '<div class="sheet-h"><div><h2 id="authT">حسابي</h2></div>' +
        '<button class="sheet-x" type="button" aria-label="إغلاق">✕</button></div>' +
        '<div class="auth-body"></div>' +
      '</div>';
    document.body.appendChild(bg);
    body = bg.querySelector('.auth-body');
    bg.querySelector('.sheet-x').addEventListener('click', closeSheet);
    bg.addEventListener('click', function (e) { if (e.target === bg) closeSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  }

  function renderFab() {
    if (!fab) return;
    avatarInto(fab, user);
    fab.setAttribute('aria-label', user ? ('حسابي: ' + user.name) : 'تسجيل الدخول');
  }

  function setMsg(text, isErr) {
    var m = body && body.querySelector('.auth-msg');
    if (!m) return;
    m.textContent = text || ''; m.className = 'auth-msg' + (isErr ? ' err' : '');
  }

  function renderSheet() {
    body.textContent = '';
    if (user) {
      var av = document.createElement('div'); av.className = 'auth-av'; avatarInto(av, user);
      var nm = document.createElement('div'); nm.className = 'auth-name'; nm.textContent = user.name;
      var ml = document.createElement('div'); ml.className = 'auth-mail'; ml.textContent = user.email;
      var out = document.createElement('button'); out.type = 'button'; out.className = 'auth-out'; out.textContent = 'تسجيل الخروج';
      out.addEventListener('click', signOut);
      body.appendChild(av); body.appendChild(nm); body.appendChild(ml); body.appendChild(out);
      return;
    }
    body.innerHTML =
      '<p class="auth-lead">سجّل الدخول باستخدام قوقل لتسجيل بياناتك ومتابعة محاضراتك.</p>' +
      '<div class="auth-gbtn" id="authGBtn"></div>' +
      '<div class="auth-msg" role="status" aria-live="polite">جارٍ التحميل…</div>';
    loadGsi(function (ok) {
      if (user || !body.querySelector('#authGBtn')) return;
      if (!ok) { setMsg('يلزم اتصال بالإنترنت لتسجيل الدخول. حاول لاحقاً.', true); return; }
      setMsg('');
      google.accounts.id.renderButton(body.querySelector('#authGBtn'), {
        type: 'standard', theme: 'filled_blue', size: 'large',
        text: 'signin_with', shape: 'pill', logo_alignment: 'left', locale: 'ar',
        width: Math.min(300, Math.max(200, (body.clientWidth || 300) - 36))
      });
    });
  }

  function openSheet() {
    buildUi(); renderSheet();
    bg.classList.add('open'); bg.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    if (!bg) return;
    bg.classList.remove('open'); bg.setAttribute('aria-hidden', 'true');
  }

  function signOut() {
    track('logout', {});
    flush();
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    user = null; idToken = null; tokenExp = 0; refreshTried = false;
    del(USER_KEY); del(TOKEN_KEY);
    renderFab(); notify('logout'); renderSheet();
  }

  /* ----------------------------------- API ----------------------------------- */
  window.EduAuth = {
    getUser: function () { return user ? Object.assign({}, user) : null; },
    getIdToken: function () { return validToken() ? idToken : null; },
    isSignedIn: function () { return !!user; },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    signIn: openSheet,
    signOut: signOut,
    track: track
  };

  /* ---------------------------------- start ---------------------------------- */
  function start() {
    user = loadUser();
    if (user) restoreToken();
    buildUi();
    renderFab();
    if (user) { notify('restore'); track('app_open', {}); }
  }
  window.addEventListener('online', flush);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
