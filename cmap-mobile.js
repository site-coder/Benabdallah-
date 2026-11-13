/* ==========================================================================
   cmap-mobile.js — «منشئ الخرائط المفاهيمية» (المرحلة 5): إظهار/إخفاء لوحة الأدوات ولوحة الخصائص
   - زران عائمان داخل مساحة الرسم: «الأدوات» و«الخصائص» (يعملان على الهاتف والحاسوب)
   - يحفظ تفضيل الإظهار في LocalStorage (تفضيل واجهة فقط؛ الخرائط نفسها في IndexedDB)
   - يتصل بالمحرر عبر CM.ext فقط
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM; if (!CM) return;
  var KEY = 'cm_ui_v1';
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var IC = {
    tools: ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>'),
    props: ic('<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/>')
  };
  function load() { try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  CM.ext = CM.ext || [];
  CM.ext.push(function (api) {
    var rootEl = api.root, canvas = api.canvas, pref = load();
    canvas.insertAdjacentHTML('beforeend',
      '<div class="cm-fabs">' +
      '<button type="button" class="cm-fab" data-mb="tools" aria-pressed="true" title="إظهار / إخفاء شريط الأدوات" aria-label="شريط الأدوات">' + IC.tools + '<span>الأدوات</span></button>' +
      '<button type="button" class="cm-fab" data-mb="props" aria-pressed="true" title="إظهار / إخفاء لوحة الخصائص" aria-label="لوحة الخصائص">' + IC.props + '<span>الخصائص</span></button></div>');
    var fabs = canvas.querySelector('.cm-fabs'), bTools = fabs.querySelector('[data-mb="tools"]'), bProps = fabs.querySelector('[data-mb="props"]');
    /* الضغط على الأزرار لا يبدأ سحباً على مساحة الرسم */
    ['pointerdown', 'dblclick', 'wheel'].forEach(function (ev) { fabs.addEventListener(ev, function (e) { e.stopPropagation(); }); });

    function narrow() { try { return matchMedia('(max-width: 820px)').matches; } catch (e) { return false; } }
    function sync() {
      var toolsOn = !rootEl.classList.contains('cm-tools-off');
      var propsOn = !rootEl.classList.contains('cm-props-off') && !rootEl.classList.contains('cm-props-closed');
      bTools.setAttribute('aria-pressed', toolsOn ? 'true' : 'false');
      bProps.setAttribute('aria-pressed', propsOn ? 'true' : 'false');
    }
    function setTools(on, remember) { rootEl.classList.toggle('cm-tools-off', !on); if (remember !== false) { pref.tools = on ? 1 : 0; save(pref); } sync(); }
    function setProps(on, remember) {
      rootEl.classList.toggle('cm-props-off', !on);
      if (on && rootEl.classList.contains('cm-props-closed')) { var sp = rootEl.querySelector('[data-act="showprops"]'); if (sp && !sp.disabled) sp.click(); }
      if (remember !== false) { pref.props = on ? 1 : 0; save(pref); } sync();
    }
    bTools.addEventListener('click', function () { setTools(rootEl.classList.contains('cm-tools-off')); });
    bProps.addEventListener('click', function () {
      var on = !rootEl.classList.contains('cm-props-off') && !rootEl.classList.contains('cm-props-closed');
      if (!on && !rootEl.classList.contains('cm-props-off') && rootEl.classList.contains('cm-props-closed')) { setProps(true); return; }
      setProps(!on);
    });
    /* فتح «المظهر» يُظهر لوحة الخصائص (يعرض نفسه في مكانها) */
    rootEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-xact="style"]'); if (b && rootEl.classList.contains('cm-props-off')) setProps(true, false);
      setTimeout(sync, 0);
    });
    new MutationObserver(sync).observe(rootEl, { attributes: true, attributeFilter: ['class'] });

    /* الحالة الأولية: الحاسوب يُظهر اللوحتين؛ الهاتف يُظهر الأدوات ويترك الخصائص تظهر عند التحديد */
    if (pref.tools === 0) setTools(false, false);
    /* على الشاشات الضيقة تبدأ لوحة الخصائص مغلقة (يُلمَّح لها بزر «الخصائص» عند التحديد) لتبقى مساحة الرسم كبيرة */
    if (pref.props === 0 || (pref.props === undefined && narrow())) setProps(false, false);
    sync();
    /* شريط الإجراءات على الشاشات الواسعة: إن ضاق عن أزراره يلتفّ على سطرين بدل أن تختفي أزرار خلف حافته (على الهاتف يبقى قابلاً للتمرير) */
    var acts = rootEl.querySelector('.cm-acts');
    function fitActs() {
      if (!acts) return;
      rootEl.classList.remove('cm-acts-wrap');
      if (!narrow() && acts.scrollWidth > acts.clientWidth + 1) rootEl.classList.add('cm-acts-wrap');
    }
    if (window.ResizeObserver) new ResizeObserver(fitActs).observe(rootEl); else window.addEventListener('resize', fitActs);
    setTimeout(fitActs, 0);
    api.panels = { setTools: setTools, setProps: setProps, narrow: narrow, fitActs: fitActs };
  });
})();
