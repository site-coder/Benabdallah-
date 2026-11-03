/* ==========================================================================
   auth.js — دخول سريع بالاسم + رقم التسجيل الجامعي، وحفظ دائم لبيانات الطالب
   - يحفظ الطالب وتقدّمه وملاحظاته في LocalStorage ولا يحذفها عند الخروج أو إغلاق التطبيق
   - يتذكّر الطالب تلقائياً عند إعادة فتح التطبيق (لا بوابة دخول مجدداً)
   - يرسل الدخول والحضور والتقدّم في الخلفية إلى Cloudflare Worker (/track)
   - يوفّر window.EduAuth للاستخدام من أي ملف آخر
   ملاحظة: الموقع ثابت، فهذا النظام للتعريف والتتبّع وليس وسيلة حماية.
   ========================================================================== */
(function () {
  'use strict';

  var TRACK_URL = 'https://wild-wind-8577.mbenabdallah663.workers.dev/track';

  var USER_KEY = 'edu_user';          /* الجلسة الحالية (تُزال عند «تسجيل الخروج» فقط) */
  var PROFILE_KEY = 'edu_profile';    /* آخر طالب: لا يُحذف أبداً، ويستعمله الإرسال بعد الخروج */
  var DATA_PREFIX = 'edu_data_';      /* بيانات كل طالب: التقدّم والملاحظات (دائمة) */
  var QUEUE_KEY = 'edu_events';
  var MAX_QUEUE = 200;

  var user = null;
  var listeners = [];
  var flushing = false, retryTimer = null;

  /* ------------------------------- storage ------------------------------- */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function readJson(k, fallback) { try { var v = JSON.parse(get(k)); return v == null ? fallback : v; } catch (e) { return fallback; } }

  /* طلب تخزين دائم كي لا يمسح المتصفح البيانات عند ضيق المساحة */
  function persistStorage() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  }

  function loadUser() {
    var u = readJson(USER_KEY, null);
    return u && u.id ? u : null;
  }

  /* ------------------------- student data (progress/notes) ------------------------- */
  function dataKey(id) { return DATA_PREFIX + id; }

  function readData(id) {
    var d = readJson(dataKey(id), null);
    if (!d || typeof d !== 'object') d = {};
    if (!d.progress || typeof d.progress !== 'object') d.progress = {};
    if (!d.notes || typeof d.notes !== 'object') d.notes = {};
    return d;
  }

  function writeData(id, d) { set(dataKey(id), JSON.stringify(d)); }

  function recordLecture(data) {
    if (!user || !data) return;
    var d = readData(user.id);
    var key = data.subject + '-' + data.lecture;
    var lec = d.progress.lectures || (d.progress.lectures = {});
    var rec = lec[key] || { opens: 0 };
    rec.opens += 1;
    rec.last = Date.now();
    lec[key] = rec;
    d.progress.last = { subject: data.subject, lecture: data.lecture, ts: rec.last };
    writeData(user.id, d);
  }

  /* --------------------------------- input --------------------------------- */
  /* تحويل الأرقام العربية/الفارسية إلى لاتينية وتنظيف المسافات */
  function normDigits(s) {
    return String(s || '')
      .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); });
  }
  function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function cleanReg(s) { return normDigits(s).replace(/[\s\-_/]+/g, '').toLowerCase(); }

  /* ------------------------------- tracking ------------------------------- */
  function readQueue() { var q = readJson(QUEUE_KEY, []); return Array.isArray(q) ? q : []; }

  function identity() {
    var p = user || readJson(PROFILE_KEY, null);
    return p && p.id ? { id: p.id, name: p.name, regNo: p.regNo } : null;
  }

  function track(type, data) {
    if (!user) return;
    if (type === 'lecture_open') recordLecture(data);
    var q = readQueue();
    q.push({ t: type, d: data || {}, ts: Date.now(), uid: user.id });
    if (q.length > MAX_QUEUE) q = q.slice(q.length - MAX_QUEUE);
    set(QUEUE_KEY, JSON.stringify(q));
    flush();
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function () { retryTimer = null; flush(); }, 30000);
  }

  function flush() {
    var who = identity();
    if (!TRACK_URL || !who || flushing || !navigator.onLine) return;
    var q = readQueue();
    if (!q.length) return;
    flushing = true;
    var sent = q.length;
    var data = readData(who.id);
    /* text/plain: طلب «بسيط» لا يحتاج preflight، والـ Worker يقرأ الجسم كـ JSON عادي */
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      body: JSON.stringify({
        app: 'eps-chlef-hub',
        user: who,
        progress: data.progress,
        events: q
      })
    }).then(function (r) {
      if (r.ok) {
        set(QUEUE_KEY, JSON.stringify(readQueue().slice(sent)));
      } else if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
        set(QUEUE_KEY, JSON.stringify(readQueue().slice(sent)));   /* مرفوض نهائياً: لا نكرره */
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

  /* ------------------------------ login gate ------------------------------ */
  var root = document.documentElement;
  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    var m = $('authMsg');
    if (!m) return;
    m.textContent = text || ''; m.className = 'gate-msg' + (isErr ? ' err' : '');
  }

  function applyGate() {
    if (user) root.setAttribute('data-signed', '1');
    else root.removeAttribute('data-signed');
  }

  function signIn(name, regNo) {
    name = cleanName(name);
    regNo = cleanReg(regNo);
    if (name.length < 3 || name.split(' ').length < 2) {
      setMsg('أدخل الاسم واللقب كاملين.', true); return false;
    }
    if (!/^[a-z0-9]{4,20}$/.test(regNo)) {
      setMsg('رقم التسجيل غير صالح (4 إلى 20 رقماً أو حرفاً).', true); return false;
    }
    user = {
      id: regNo,
      name: name,
      regNo: regNo,
      loginAt: Date.now()
    };
    set(USER_KEY, JSON.stringify(user));
    set(PROFILE_KEY, JSON.stringify({ id: user.id, name: user.name, regNo: user.regNo }));
    var d = readData(user.id);              /* استرجاع التقدّم والملاحظات السابقة إن وُجدت */
    d.profile = { name: user.name, regNo: user.regNo };
    writeData(user.id, d);
    persistStorage();
    setMsg('');
    applyGate();
    notify('login');
    track('login', {});
    return true;
  }

  function signOut() {
    track('logout', {});
    /* نحذف الجلسة فقط؛ التقدّم والملاحظات تبقى محفوظة ويستعيدها الطالب عند دخوله مجدداً */
    user = null;
    del(USER_KEY);
    notify('logout');
    applyGate();
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  /* ----------------------------------- API ----------------------------------- */
  window.EduAuth = {
    getUser: function () { return user ? Object.assign({}, user) : null; },
    isSignedIn: function () { return !!user; },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    signIn: signIn,
    signOut: signOut,
    track: track,
    /* التقدّم: مفتاح/قيمة قابلة للتحويل إلى JSON */
    getProgress: function () { return user ? JSON.parse(JSON.stringify(readData(user.id).progress)) : {}; },
    setProgress: function (key, value) {
      if (!user || !key) return;
      var d = readData(user.id); d.progress[key] = value; writeData(user.id, d); flush();
    },
    /* الملاحظات: لكل محاضرة نص مستقل */
    getNote: function (key) { return user ? (readData(user.id).notes[key] || '') : ''; },
    getNotes: function () { return user ? JSON.parse(JSON.stringify(readData(user.id).notes)) : {}; },
    setNote: function (key, text) {
      if (!user || !key) return;
      var d = readData(user.id);
      if (text) d.notes[key] = String(text); else delete d.notes[key];
      writeData(user.id, d);
    }
  };

  /* ---------------------------------- start ---------------------------------- */
  function start() {
    user = loadUser();
    var form = $('authForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      signIn(($('authName') || {}).value, ($('authReg') || {}).value);
    });
    applyGate();
    if (user) { persistStorage(); notify('restore'); track('app_open', {}); }
  }
  window.addEventListener('online', flush);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
