/* ==========================================================================
   auth.js — تسجيل الدخول بطريقتين (Google One Tap  |  الاسم + رقم التسجيل)
   - الطريقة 1: Google (One Tap تلقائياً + زر احتياطي داخل البطاقة)
   - الطريقة 2: الاسم واللقب + رقم التسجيل الجامعي (تعمل حتى بدون إنترنت)
   - يُنشأ معرّف موحّد للطالب: Google → معرّف قوقل (sub) ، يدوي → m_<بصمة الاسم+الرقم>
   - الجلسة، التقدّم، نتائج الاختبارات، الملاحظات: تُحفظ دائماً في localStorage
     (المفتاح: edu_data_<المعرّف>) ولا تُحذف عند الخروج، وتعود عند الدخول بنفس الطريقة
   - كل شيء يُرسل في الخلفية إلى الـ Worker عبر /track (الأحداث + التقدّم + الملاحظات)
   - عند إعادة فتح التطبيق: تُتجاوز شاشة الدخول تلقائياً وتُسترجع الملاحظات والتقدّم
   - يوفّر window.EduAuth للاستخدام من أي ملف آخر (نفس الواجهة السابقة)
   ملاحظة: الموقع ثابت (GitHub Pages) فالدخول هنا للتتبع وحفظ التقدّم وليس وسيلة حماية.
   ========================================================================== */
(function () {
  'use strict';

  var CLIENT_ID = '858808052749-2h3qrn3bsrqov6q4fdhvpm5viee8hc0n.apps.googleusercontent.com';

  /* Cloudflare Worker: نقطة استقبال الأحداث والتقدّم والملاحظات */
  var TRACK_URL = 'https://wild-wind-8577.mbenabdallah663.workers.dev/track';

  var GSI_SRC = 'https://accounts.google.com/gsi/client';
  var USER_KEY = 'edu_user';
  var QUEUE_KEY = 'edu_events';
  var TOKEN_KEY = 'edu_idt';
  var DIRTY_KEY = 'edu_dirty';      /* توجد بيانات (تقدّم/ملاحظات) لم تصل للخادم بعد */
  var DATA_PREFIX = 'edu_data_';
  var SESSION_DAYS = 365;           /* جلسة متجددة: تمتد سنة كاملة من آخر فتح للتطبيق */
  var MAX_QUEUE = 200;
  var NOTE_MAX = 5000;

  var user = null;
  var data = null;                  /* بيانات الطالب الحالي: { email, name, progress, notes, last } */
  var idToken = null;               /* خاص بطريقة Google فقط (صالح ساعة تقريباً) */
  var tokenExp = 0;
  var listeners = [];
  var gsiState = 'idle';            /* idle | loading | ready | failed */
  var gsiWaiters = [];
  var skipPrompt = false;           /* بعد الخروج اليدوي لا نعرض One Tap تلقائياً في نفس الصفحة */

  /* ------------------------------- storage ------------------------------- */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function loadUser() {
    try {
      var u = JSON.parse(get(USER_KEY) || 'null');
      if (!u || !u.id) return null;
      if (Date.now() - (u.lastSeen || u.loginAt || 0) > SESSION_DAYS * 864e5) { del(USER_KEY); return null; }
      if (!u.method) u.method = 'google';   /* جلسات قديمة قبل هذا التحديث */
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
    set(DIRTY_KEY, '1');
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
    scheduleSync();
  }
  function getLast() { return data && data.last ? Object.assign({}, data.last) : null; }

  var noteTimer = null;
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
    var ok = saveData();                 /* محلياً فوراً وبشكل دائم */
    if (ok) {                            /* وللخادم في الخلفية بعد توقف الكتابة */
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { track('note_saved', { lecture: key, len: text.length }); }, 4000);
    }
    return ok;
  }

  /* ملخص صغير للتقدّم + الحالة الكاملة (بما فيها نصوص الملاحظات) تُرسل مع كل دفعة */
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
  function fullState() {
    if (!data) return null;
    return { progress: data.progress, notes: data.notes, last: data.last, updatedAt: data.updatedAt || 0 };
  }

  /* ------------------- المعرّف الموحّد للدخول بالاسم + الرقم ------------------- */
  function normDigits(s) {   /* ٠١٢٣٤٥٦٧٨٩ و ۰۱۲۳۴۵۶۷۸۹ → 0123456789 */
    return String(s || '').replace(/[\u0660-\u0669]/g, function (c) { return c.charCodeAt(0) - 0x660; })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return c.charCodeAt(0) - 0x6F0; });
  }
  function normName(s) {
    return normDigits(s).replace(/[\u064B-\u065F\u0670\u0640]/g, '')   /* التشكيل والتطويل */
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function normReg(s) { return normDigits(s).replace(/[\s\-_\/\.]/g, '').toUpperCase(); }

  /* بصمة 53-بت (cyrb53) — ثابتة وسريعة وتعمل بدون إنترنت */
  function hash53(str, seed) {
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function manualId(name, reg) {
    var s = normName(name) + '|' + normReg(reg);
    return 'm_' + hash53(s, 1).toString(36) + hash53(s, 7).toString(36);
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

  /* مزامنة الحالة (آخر موضع/تقدّم) بعد هدوء قصير حتى لا نرسل مع كل نقرة */
  var syncTimer = null;
  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(flush, 5000);
  }

  var flushing = false, retryTimer = null, refreshTried = false;

  function scheduleRetry(ms) {
    if (retryTimer) return;
    retryTimer = setTimeout(function () { retryTimer = null; flush(); }, ms || 30000);
    /* مزامنة خلفية: يوقظ الـ Service Worker الصفحة عند عودة الاتصال */
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg && reg.sync) reg.sync.register('edu-flush').catch(function () { /* ignore */ });
        }).catch(function () { /* ignore */ });
      }
    } catch (e) { /* ignore */ }
  }

  /* تجديد رمز قوقل بصمت قدر الإمكان (مرة واحدة لكل فتح للصفحة) — لمستخدمي Google فقط */
  function refreshToken() {
    if (refreshTried || !user || user.method !== 'google') return;
    refreshTried = true;
    loadGsi(function (ok) {
      if (!ok || !window.google || !google.accounts) return;
      try { google.accounts.id.prompt(); } catch (e) { /* ignore */ }
    });
  }

  /* دمج حالة وصلت من الخادم (إن أعادها الـ Worker): الأحدث يفوز، ولا يُحذف شيء محلي */
  function mergeRemote(st) {
    if (!st || typeof st !== 'object' || !data) return;
    var changed = false;
    if (st.notes && typeof st.notes === 'object') {
      Object.keys(st.notes).forEach(function (k) {
        var r = st.notes[k], l = data.notes[k];
        if (r && r.t && (!l || (r.ts || 0) > (l.ts || 0))) { data.notes[k] = { t: String(r.t).slice(0, NOTE_MAX), ts: r.ts || Date.now() }; changed = true; }
      });
    }
    if (st.progress && typeof st.progress === 'object') {
      Object.keys(st.progress).forEach(function (k) {
        var r = st.progress[k], l = data.progress[k];
        if (r && typeof r === 'object' && (!l || (r.lastAt || 0) > (l.lastAt || 0))) { data.progress[k] = r; changed = true; }
      });
    }
    if (st.last && (!data.last || (st.last.ts || 0) > (data.last.ts || 0))) { data.last = st.last; changed = true; }
    if (changed) { set(dataKey(), JSON.stringify(data)); notify('sync'); }
  }

  function flush() {
    if (!TRACK_URL || !user || flushing || !navigator.onLine) return;
    var q = readQueue();
    var dirty = get(DIRTY_KEY) === '1';
    if (!q.length && !dirty) return;
    flushing = true;
    var sent = q.length;
    var stamp = data ? data.updatedAt : 0;
    /* text/plain: طلب «بسيط» لا يحتاج preflight، والـ Worker يقرأ الجسم كـ JSON عادي */
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      body: JSON.stringify({
        app: 'eps-chlef-hub',
        method: user.method,                       /* 'google' | 'manual' */
        user: { id: user.id, name: user.name, email: user.email, regNo: user.regNo || null, method: user.method },
        idToken: (user.method === 'google' && validToken()) ? idToken : null,
        progress: snapshot(),
        state: fullState(),                        /* التقدّم + الملاحظات كاملة */
        events: q
      })
    }).then(function (r) {
      if (r.ok) {
        var rest = readQueue().slice(sent);
        set(QUEUE_KEY, JSON.stringify(rest));
        if (data && data.updatedAt === stamp) del(DIRTY_KEY);   /* لم يتغيّر شيء أثناء الإرسال */
        r.json().then(function (j) { if (j && j.state) mergeRemote(j.state); }).catch(function () { /* ignore */ });
        if (rest.length) setTimeout(flush, 300);   /* أحداث وصلت أثناء الإرسال: أرسلها فوراً */
      } else if (r.status === 401 || r.status === 403) {
        if (user && user.method === 'google') refreshToken();   /* تبقى الأحداث حتى يصل رمز جديد */
        else scheduleRetry(300000);                              /* دخول يدوي: أعد المحاولة بعد 5 دقائق */
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

  /* بعد نجاح أي طريقة دخول */
  function startSession(u, reason) {
    user = u;
    persistUser();
    loadData();                          /* تعود ملاحظاته وتقدّمه السابق إن وُجدت */
    saveData();
    skipPrompt = false;
    applyGate();
    notify('login');
    track('login', { method: u.method });
    flush();
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
    startSession({
      id: c.sub,                         /* نفس المعرّف السابق: لا يضيع تقدّم من دخلوا من قبل */
      method: 'google',
      name: c.name || '',
      givenName: c.given_name || '',
      email: c.email || '',
      emailVerified: !!c.email_verified,
      picture: c.picture || '',
      loginAt: Date.now(),
      lastSeen: Date.now()
    });
  }

  /* الدخول بالاسم واللقب + رقم التسجيل الجامعي */
  function manualLogin(name, reg) {
    name = String(name || '').replace(/\s+/g, ' ').trim();
    var regN = normReg(reg);
    if (name.length < 3 || !/[A-Za-z\u0621-\u064A]/.test(name)) return { ok: false, msg: 'اكتب اسمك ولقبك كاملين.' };
    if (!/^[A-Z0-9]{4,20}$/.test(regN)) return { ok: false, msg: 'رقم التسجيل غير صحيح (أرقام أو حروف لاتينية، من 4 إلى 20 خانة).' };
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.cancel(); } catch (e) { /* ignore */ }
    idToken = null; tokenExp = 0; del(TOKEN_KEY);
    startSession({
      id: manualId(name, regN),
      method: 'manual',
      name: name,
      givenName: name.split(' ')[0],
      email: '',
      regNo: regN,
      loginAt: Date.now(),
      lastSeen: Date.now()
    });
    return { ok: true };
  }

  /* ------------------------------ login gate ------------------------------ */
  var root = document.documentElement;

  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    var m = $('authMsg');
    if (!m) return;
    m.textContent = text || ''; m.className = 'gate-msg' + (isErr ? ' err' : '');
  }
  function setMsg2(text) {
    var m = $('authMsg2');
    if (m) m.textContent = text || '';
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
        setMsg(navigator.onLine ? 'تعذّر تحميل دخول قوقل. يمكنك الدخول بالاسم ورقم التسجيل أدناه.' : 'دخول قوقل يحتاج إنترنت. يمكنك الدخول بالاسم ورقم التسجيل أدناه.', true);
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
    flush();
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    /* تُحذف الجلسة فقط. ملاحظات الطالب وتقدّمه تبقى على الجهاز وتعود عند الدخول بنفس الطريقة */
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
    signInManual: manualLogin,
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
  function bindManualForm() {
    var form = $('authForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setMsg2('');
      var r = manualLogin(($('authName') || {}).value, ($('authReg') || {}).value);
      if (!r.ok) setMsg2(r.msg);
    });
  }

  function start() {
    user = loadUser();
    if (user) {
      if (user.method === 'google') restoreToken();
      user.lastSeen = Date.now();       /* تجديد الجلسة مع كل فتح */
      persistUser();
      loadData();
    }
    /* اطلب من المتصفح عدم حذف بيانات الموقع تلقائياً (حماية الملاحظات والتقدّم) */
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

    var retry = $('authRetry');
    if (retry) retry.addEventListener('click', function () { gsiState = 'idle'; renderGate(); });
    bindManualForm();
    applyGate();
    if (user) { notify('restore'); track('app_open', {}); }
  }

  window.addEventListener('online', function () { flush(); if (!user) renderGate(); });
  /* عند إغلاق التطبيق أو إخفائه: أرسل ما تبقّى فوراً */
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  /* الـ Service Worker يوقظ الصفحة عند عودة الاتصال (Background Sync) */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'FLUSH') flush();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
