/* ==========================================================================
   الصفحة الرئيسية (home.js) — «مركزك الجامعي»
   - يبني محتوى #v-home فقط، ولا يعدّل أي صفحة أو أداة أخرى
   - المقاييس: من المصفوفة SUBJECTS و CONTENT الموجودتين في الموقع
   - الإنجازات: من EduAuth.percent (تقدّم المحاضرات) ومن مفاتيح الأدوات
     tl_todo_v1 / tl_sched_v1 / tl_pomo_v1 في LocalStorage (قراءة فقط)
   - فتح الأدوات والمقاييس يتم بمحاكاة نقرة على عناصر التنقل الموجودة أصلاً
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('v-home');
  if (!root) return;

  /* ---------- أدوات مساعدة ---------- */
  function $(s) { return root.querySelector(s); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  var P = {
    cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    go: '<path d="m15 18-6-6 6-6"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
    timer: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15h.01"/><path d="M8 19h8"/>',
    list: '<path d="m3 7 2 2 4-4"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'
  };

  /* ==========================================================================
     بيانات «هل تعلم؟» — معلومات عامة متفق عليها في علوم الرياضة
     ========================================================================== */
  var FACTS = [
    ['وظائف الأعضاء', 'يضخ قلب الشخص البالغ وهو في حالة الراحة نحو 5 لترات من الدم في الدقيقة، ويرتفع هذا الحجم إلى عدة أضعاف أثناء الجهد البدني الشديد.'],
    ['وظائف الأعضاء', 'يعتمد أقصى استهلاك للأكسجين (VO₂max) على قدرة القلب والرئتين والدم والعضلات معاً على نقل الأكسجين واستخدامه، ويُعد من أهم مؤشرات اللياقة الهوائية.'],
    ['التدريب الرياضي', 'في الأسابيع الأولى من تدريب القوة يأتي معظم التحسّن من تكيّفات عصبية، كتجنيد وحدات حركية أكثر وتحسّن التناسق، قبل أن يظهر تضخّم العضلات.'],
    ['وظائف الأعضاء', 'نظام الفوسفاجين (ATP-PC) أسرع مصادر الطاقة في الجسم، ويكفي للجهد الأقصى لنحو 10 ثوانٍ تقريباً، كما في سباق 100 متر.'],
    ['علم الحركة', 'الانقباض اللامركزي، أي حين تستطيل العضلة وهي تقاوم الحمل كالنزول البطيء بالثقل، قد يولّد قوة أكبر من الانقباض المركزي، وهو أكثر ارتباطاً بالألم العضلي المتأخر.'],
    ['وظائف الأعضاء', 'يبلغ الألم العضلي المتأخر (DOMS) ذروته عادةً بين 24 و72 ساعة بعد جهد غير معتاد، ولا يعود سببه إلى تراكم حمض اللاكتيك كما يُشاع.'],
    ['اللياقة البدنية', 'توصي منظمة الصحة العالمية البالغين بما بين 150 و300 دقيقة أسبوعياً من النشاط الهوائي المعتدل، مع تمارين لتقوية العضلات يومين أو أكثر في الأسبوع.'],
    ['التشريح', 'أطول عظمة في جسم الإنسان هي عظم الفخذ، وأكبر عضلة من حيث الكتلة هي العضلة الألوية الكبرى.'],
    ['التشريح', 'يتكوّن الهيكل العظمي للبالغ من 206 عظام، بينما يولد الطفل بعدد أكبر من العظام يلتحم بعضها مع النمو.'],
    ['علم الحركة', 'يقفز الإنسان عادةً أعلى حين يسبق الوثبة بنزول سريع قصير، لأن العضلات والأوتار تخزّن طاقة مرنة وتعيدها؛ وهذا ما يُعرف بدورة الإطالة والتقصير.'],
    ['وظائف الأعضاء', 'تتكوّن العضلات من ألياف بطيئة (النوع I) مقاومة للتعب ومناسبة لسباقات التحمل، وألياف سريعة (النوع II) تولّد قوة أكبر لكنها تتعب أسرع.'],
    ['التدريب الرياضي', 'مبدأ الحمل الزائد يعني أن الجسم لا يتحسّن إلا إذا تعرّض لحمل أعلى مما اعتاده، بشرط أن يرتفع الحمل تدريجياً وأن تتخلله فترات استشفاء كافية.'],
    ['التدريب الرياضي', 'وفق مبدأ الخصوصية يكون التحسّن في نوع الجهد الذي تدرّبت عليه؛ فتدريب السباحة يطوّر التحمل للسباحة أكثر مما يطوّره للجري.'],
    ['التغذية والترطيب', 'فقدان نحو 2% من وزن الجسم على شكل سوائل قد يضعف الأداء البدني والتركيز، خاصةً في الأجواء الحارة.'],
    ['الصحة والاستشفاء', 'النوم الكافي جزء من التدريب، فجزء كبير من هرمون النمو الذي يساهم في إصلاح الأنسجة يُفرَز أثناء النوم العميق.'],
    ['التشريح', 'تعيد العظام تشكيل نفسها وفق الأحمال الواقعة عليها، ولذلك تدعم التمارين التي يتحمّل فيها الجسم وزنه، كالمشي والجري والقفز، كثافة العظام.'],
    ['وظائف الأعضاء', 'ينخفض معدل النبض في الراحة غالباً مع التدريب الهوائي المنتظم، لأن القلب يضخ حجماً أكبر من الدم مع كل نبضة.'],
    ['علم الحركة', 'مركز ثقل الجسم نقطة نظرية تتغيّر بتغيّر وضع الأطراف؛ ولهذا يخفض المصارع جسمه ليزداد ثباته.'],
    ['اللياقة البدنية', 'قد تنقص الإطالة الثابتة الطويلة (أكثر من دقيقة تقريباً) الأداء مؤقتاً في جهود القوة والسرعة، لذلك يُفضَّل الإحماء الديناميكي قبلها.'],
    ['التغذية والترطيب', 'يشكّل الماء نحو 60% تقريباً من وزن جسم البالغ، وتفقد العضلات النشطة جزءاً منه عبر العرق، فيجب تعويضه أثناء الجهد.'],
    ['وظائف الأعضاء', 'العتبة اللاهوائية هي الشدة التي يتراكم عندها اللاكتات في الدم أسرع من إزالته، ويرفعها التدريب فيتأخر ظهور التعب.'],
    ['علم الحركة', 'مفصلا الكتف والورك من النوع الكروي الحقّي، وهو أوسع أنواع المفاصل حركة لأنه يسمح بالحركة في ثلاثة مستويات.'],
    ['التدريب الرياضي', 'قد يحسّن التدريب المتقطع عالي الشدة (HIIT) اللياقة الهوائية في وقت أقل من التدريب المستمر المعتدل لدى كثير من الممارسين.'],
    ['وظائف الأعضاء', 'نفاد مخزون الغليكوجين في العضلات والكبد من أسباب التعب الشديد المعروف بـ«الاصطدام بالجدار» في سباقات التحمل الطويلة.']
  ];

  /* ==========================================================================
     بيانات «مصطلح جامعي اليوم» — [المصطلح، المقابل الأجنبي، التعريف]
     ========================================================================== */
  var TERMS = [
    ['الحمل التدريبي', 'Training Load', 'مجموع المثيرات البدنية التي يتعرض لها الرياضي في التدريب، ويُعبَّر عنه عادةً بالشدة والحجم والكثافة.'],
    ['الاستشفاء', 'Recovery', 'عودة الجسم إلى حالته الطبيعية أو أفضل بعد الجهد، عبر الراحة والنوم والتغذية والترطيب.'],
    ['التكيّف الفسيولوجي', 'Physiological Adaptation', 'تغيّرات تحدث في أجهزة الجسم استجابةً لتكرار الحمل التدريبي، وتجعله أقدر على تحمّل الجهد نفسه.'],
    ['القدرة العضلية', 'Muscular Power', 'القدرة على إنتاج قوة كبيرة في أقصر زمن ممكن، وتُحسب بحاصل القوة في السرعة.'],
    ['التحمّل الهوائي', 'Aerobic Endurance', 'القدرة على أداء جهد متوسط الشدة لفترة طويلة بالاعتماد على الأكسجين في إنتاج الطاقة.'],
    ['الميكانيكا الحيوية', 'Biomechanics', 'علم يدرس حركة الجسم الحي بتطبيق قوانين الميكانيكا عليها.'],
    ['علم الحركة', 'Kinesiology', 'دراسة الحركة الإنسانية من حيث التشريح والوظيفة والتحكم العصبي.'],
    ['النمط الجسمي', 'Somatotype', 'وصف لبنية الجسم بثلاثة مكوّنات هي الشحمي والعضلي والنحيف، ويُستعمل في المورفولوجيا الرياضية.'],
    ['السعة الحيوية', 'Vital Capacity', 'أقصى حجم من الهواء يمكن إخراجه من الرئتين بعد أقصى شهيق.'],
    ['الأيض القاعدي', 'Basal Metabolic Rate', 'كمية الطاقة التي يستهلكها الجسم في حالة الراحة التامة للحفاظ على وظائفه الحيوية.'],
    ['الإحماء', 'Warm-up', 'مرحلة تحضيرية قبل الجهد ترفع حرارة الجسم وتهيّئ الجهازين العضلي والدوري للعمل.'],
    ['الوحدة الحركية', 'Motor Unit', 'عصبون حركي واحد مع جميع الألياف العضلية التي يتحكم في انقباضها.'],
    ['العتبة اللاهوائية', 'Anaerobic Threshold', 'شدة الجهد التي يتراكم عندها اللاكتات في الدم بسرعة أكبر من إزالته.'],
    ['الرشاقة', 'Agility', 'القدرة على تغيير اتجاه الجسم أو وضعه بسرعة ودقة مع الحفاظ على التوازن.'],
    ['المراقبة الطبية الرياضية', 'Sports Medical Monitoring', 'متابعة صحية دورية للرياضي، بفحوص وقياسات، للوقاية من الإصابات والحفاظ على سلامته.'],
    ['النضج البيولوجي', 'Biological Maturity', 'درجة اكتمال نمو الجسم ووظائفه، وقد تختلف عن العمر الزمني عند الأطفال والمراهقين.'],
    ['الحمل الزائد', 'Overload', 'رفع الحمل التدريبي فوق المعتاد لإثارة تكيّف جديد في الجسم.'],
    ['المرونة', 'Flexibility', 'مدى الحركة المتاح في المفصل أو مجموعة من المفاصل.'],
    ['التوافق العضلي العصبي', 'Neuromuscular Coordination', 'انسجام عمل العضلات بإشراف الجهاز العصبي لإنتاج حركة دقيقة وفعّالة.'],
    ['مؤشر كتلة الجسم', 'Body Mass Index', 'نسبة الوزن بالكيلوغرام إلى مربع الطول بالمتر، ويُستعمل مؤشراً عاماً للوزن.'],
    ['معدل القلب الأقصى', 'Maximal Heart Rate', 'أعلى عدد من النبضات يبلغه القلب في الدقيقة أثناء جهد أقصى.'],
    ['نظام الطاقة', 'Energy System', 'مسار يولّد به الجسم الطاقة (ATP)؛ وأنظمته الثلاثة: الفوسفاجيني، واللاهوائي اللاكتيكي، والهوائي.'],
    ['التعب العضلي', 'Muscle Fatigue', 'انخفاض مؤقت في قدرة العضلة على إنتاج القوة بسبب استمرار الجهد.'],
    ['التدرّج في الحمل', 'Progressive Loading', 'زيادة الحمل التدريبي خطوة بعد خطوة لضمان التطور وتجنّب الإصابة.']
  ];

  /* ==========================================================================
     قراءة البيانات الحقيقية من الموقع
     ========================================================================== */
  function subjects() { return Array.isArray(window.SUBJECTS) ? window.SUBJECTS : []; }
  function content() { return (window.CONTENT && typeof window.CONTENT === 'object') ? window.CONTENT : {}; }
  function authOk() { return !!(window.EduAuth && typeof window.EduAuth.percent === 'function'); }
  function pct(k) { if (!authOk()) return 0; try { var v = +window.EduAuth.percent(k); return isFinite(v) ? v : 0; } catch (e) { return 0; } }

  function lecStats() {
    var keys = Object.keys(content()), per = [], done = 0, going = 0;
    subjects().forEach(function (s, i) {
      var ks = keys.filter(function (k) { return k.indexOf((i + 1) + '-') === 0; }), d = 0;
      ks.forEach(function (k) { if (pct(k) >= 100) d++; });
      per.push({ n: ks.length, d: d });
    });
    keys.forEach(function (k) { var p = pct(k); if (p >= 100) done++; else if (p > 0) going++; });
    return { total: keys.length, done: done, going: going, per: per, auth: authOk() };
  }
  function todoStats() {
    var s = lsGet('tl_todo_v1', null), a = (s && Array.isArray(s.tasks)) ? s.tasks.filter(function (t) { return t && t.id && t.title; }) : [];
    var done = a.filter(function (t) { return t.done; }).length;
    return { total: a.length, done: done, open: a.length - done };
  }
  function schedStats() {
    var s = lsGet('tl_sched_v1', null), a = (s && s.work && Array.isArray(s.work.sessions)) ? s.work.sessions : [];
    return { total: a.length, done: a.filter(function (x) { return x && x.done; }).length };
  }
  function pomoStats() {
    var s = lsGet('tl_pomo_v1', null), days = (s && s.days && typeof s.days === 'object') ? s.days : {}, n = 0, ms = 0, k;
    for (k in days) { if (days[k]) { n += +days[k].n || 0; ms += +days[k].s || 0; } }
    var t = days[todayKey()];
    return { n: n, min: Math.round(ms / 60000), today: t ? (+t.n || 0) : 0 };
  }
  function gpaStats() {
    var s = lsGet('tl_gpa_v1', null);
    return { saved: (s && Array.isArray(s.saved)) ? s.saved.length : 0 };
  }
  function userName() {
    try { var u = JSON.parse(localStorage.getItem('edu_user') || 'null'); return u ? String(u.givenName || u.name || '').trim() : ''; } catch (e) { return ''; }
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'صباح الخير' : (h < 18 ? 'مساء الخير' : 'مساء النور'); }
  function dur(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + ' ساعة' : '') + (h && m ? ' و ' : '') + (m || !h ? m + ' دقيقة' : ''); }

  /* ==========================================================================
     التنقل: محاكاة نقرات العناصر الموجودة (بدون تعديل منطق التنقل الحالي)
     ========================================================================== */
  function clickNav(name) { var b = document.querySelector('#bnav [data-nav="' + name + '"]'); if (b) b.click(); }
  function openTool(k) {
    clickNav('tools');
    var c = document.querySelector('#v-tools .tl-card[data-tool="' + k + '"]');
    if (c) c.click();
  }
  function openSubject(i) {
    clickNav('lectures');
    var c = document.querySelector('#subjects .card[data-s="' + i + '"]');
    if (c) c.click();
  }

  /* ==========================================================================
     بناء الهيكل (مرة واحدة)
     ========================================================================== */
  var QUICK = [
    ['sched', 'الجدول الدراسي', P.cal],
    ['todo', 'قائمة المهام', P.list],
    ['gpa', 'حساب المعدل', P.calc],
    ['pomo', 'مؤقت التركيز', P.timer]
  ];
  var showAll = false, queue = [], qi = 0, built = false;

  function build() {
    var h = '<div class="hm">';
    /* 1) الترحيب */
    h += '<section class="hm-hero" aria-labelledby="hmT">' +
      '<span class="hm-cap">' + ic(P.cap) + '</span>' +
      '<h1 id="hmT">مركزك الجامعي</h1>' +
      '<p class="hm-greet" id="hmGreet" hidden></p>' +
      '<p class="hm-lead">أهلاً بك في منصتك. هنا تجد أهم ما تحتاجه في دراستك: أدواتك ومقاييسك وتقدّمك، كلها في صفحة واحدة.</p>' +
      '<svg class="hm-ecg" id="hmEcg" viewBox="0 0 320 60" aria-hidden="true"><defs><linearGradient id="hmEcgG" x1="0" x2="1"><stop offset="0" stop-color="#A855F7"/><stop offset=".6" stop-color="#C084FC"/><stop offset="1" stop-color="#F59E0B"/></linearGradient></defs>' +
      '<path pathLength="1" d="M0 34H96l9-5 7 5h14l8-26 12 48 10-34 7 12h26l9-6 9 6H320"/></svg>' +
      '</section>';
    /* 2) هل تعلم؟ */
    h += '<section class="hm-fact" aria-labelledby="hmFactT">' +
      '<div class="hm-fact-head"><h2 class="hm-h" id="hmFactT">' + ic(P.bulb) + 'هل تعلم؟</h2><span class="hm-chip" id="hmFactCat"></span></div>' +
      '<p class="hm-fact-t" id="hmFactTx" aria-live="polite"></p>' +
      '<div class="hm-fact-foot"><button type="button" class="hm-btn" id="hmFactBtn">' + ic(P.refresh) + '<span>معلومة أخرى</span></button></div>' +
      '</section>';
    /* 3) الوصول السريع */
    h += '<section aria-labelledby="hmQT"><div class="hm-sec-top"><h2 class="hm-h" id="hmQT">' + ic(P.bolt) + 'الوصول السريع</h2></div><div class="hm-quick">';
    QUICK.forEach(function (q) {
      h += '<button type="button" class="hm-q" data-tool="' + q[0] + '"><span class="hm-q-ic">' + ic(q[2]) + '</span><b>' + q[1] + '</b><small id="hmQ-' + q[0] + '"></small></button>';
    });
    h += '</div></section>';
    /* 4) المقاييس */
    h += '<section aria-labelledby="hmST"><div class="hm-sec-top"><h2 class="hm-h" id="hmST">' + ic(P.layers) + 'المقاييس التي تتابعها</h2><button type="button" class="hm-toggle" id="hmSTog" aria-expanded="false" hidden></button></div><div class="hm-subj" id="hmSubj"></div></section>';
    /* 5) مصطلح جامعي اليوم */
    h += '<section class="hm-term" aria-labelledby="hmTT"><h2 class="hm-h" id="hmTT">' + ic(P.book) + 'مصطلح جامعي اليوم</h2>' +
      '<div class="hm-term-w"><b id="hmTerm"></b><span id="hmTermEn"></span></div><p id="hmTermDef"></p></section>';
    /* 6) الإنجازات */
    h += '<section aria-labelledby="hmAT"><div class="hm-sec-top"><h2 class="hm-h" id="hmAT">' + ic(P.trophy) + 'إنجازاتك الدراسية</h2></div><div class="hm-ach" id="hmAch"></div><p class="hm-hint" id="hmAchHint" hidden></p></section>';
    h += '</div>';
    root.innerHTML = h;
    root.classList.remove('page-empty');
    built = true;

    /* التفاعل */
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-tool]'))) { openTool(t.dataset.tool); return; }
      if ((t = e.target.closest('[data-subj]'))) { openSubject(+t.dataset.subj); return; }
      if (e.target.closest('[data-lec]')) { clickNav('lectures'); return; }
      if (e.target.closest('#hmSTog')) { showAll = !showAll; renderSubjects(); return; }
      if (e.target.closest('#hmFactBtn')) { nextFact(true); }
    });
    var tmo = $('#hmFactBtn');
    if (tmo) tmo.addEventListener('transitionend', function () { tmo.classList.remove('spin'); });
  }

  /* ==========================================================================
     هل تعلم؟ — طابور عشوائي لا يكرر معلومة قبل استعراض الجميع
     ========================================================================== */
  function shuffle() {
    var a = FACTS.map(function (_, i) { return i; }), i, j, t, last = queue.length ? queue[queue.length - 1] : -1;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    if (a[0] === last && a.length > 1) { t = a[0]; a[0] = a[1]; a[1] = t; }
    queue = a; qi = 0;
  }
  function nextFact(animate) {
    if (!queue.length || qi >= queue.length) shuffle();
    var f = FACTS[queue[qi++]], tx = $('#hmFactTx'), cat = $('#hmFactCat'), btn = $('#hmFactBtn');
    if (!tx) return;
    function put() { tx.textContent = f[1]; cat.textContent = f[0]; tx.classList.remove('out'); }
    if (animate && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      tx.classList.add('out'); if (btn) btn.classList.add('spin'); setTimeout(put, 180);
    } else put();
  }

  /* ==========================================================================
     مصطلح اليوم — يتغيّر يومياً بشكل ثابت خلال اليوم
     ========================================================================== */
  function renderTerm() {
    var d = new Date(), n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5), t = TERMS[n % TERMS.length];
    $('#hmTerm').textContent = t[0]; $('#hmTermEn').textContent = t[1]; $('#hmTermDef').textContent = t[2];
  }

  /* ==========================================================================
     الوصول السريع: حالة حقيقية لكل أداة
     ========================================================================== */
  function renderQuick() {
    var td = todoStats(), sc = schedStats(), pm = pomoStats(), gp = gpaStats(), el;
    el = $('#hmQ-sched'); if (el) el.textContent = sc.total ? (sc.done + ' من ' + sc.total + ' حصة منجزة') : 'أنشئ جدولك الأسبوعي';
    el = $('#hmQ-todo'); if (el) el.textContent = td.total ? (td.open ? td.open + ' مهمة قيد الإنجاز' : 'أنجزت كل مهامك') : 'أضف أول مهمة';
    el = $('#hmQ-gpa'); if (el) el.textContent = gp.saved ? (gp.saved + (gp.saved === 1 ? ' كشف محفوظ' : ' كشوف محفوظة')) : 'احسب معدل سداسيك';
    el = $('#hmQ-pomo'); if (el) el.textContent = pm.today ? (pm.today + (pm.today === 1 ? ' جلسة تركيز اليوم' : ' جلسات تركيز اليوم')) : 'ابدأ جلسة تركيز';
  }

  /* ==========================================================================
     المقاييس: من SUBJECTS و CONTENT الفعليتين
     ========================================================================== */
  function renderSubjects() {
    var box = $('#hmSubj'), tog = $('#hmSTog'), S = subjects(), st = lecStats(), LIMIT = 4;
    if (!box) return;
    if (!S.length) {
      box.innerHTML = '<div class="hm-empty">لا توجد مقاييس مسجّلة حالياً. ستظهر هنا فور إضافتها إلى الموقع.</div>';
      tog.hidden = true; return;
    }
    var list = showAll ? S : S.slice(0, LIMIT);
    box.innerHTML = list.map(function (s, i) {
      var p = st.per[i] || { n: 0, d: 0 }, name = esc(s.alt || ('المقياس ' + (i + 1)));
      var meta = p.n ? (st.auth ? (p.d + ' من ' + p.n + ' محاضرة مكتملة') : (p.n + (p.n === 1 ? ' محاضرة متاحة' : ' محاضرات متاحة'))) : 'لم تُنشر محاضرات هذا المقياس بعد';
      var bar = (p.n && st.auth) ? '<div class="hm-bar" aria-hidden="true"><i style="width:' + Math.round(p.d / p.n * 100) + '%"></i></div>' : '';
      var img = s.img ? '<img src="' + esc(s.img) + '" alt="" loading="lazy">' : esc((s.alt || '؟').charAt(0));
      return '<button type="button" class="hm-s" data-subj="' + i + '"><span class="hm-s-img">' + img + '</span><span class="hm-s-tx"><b>' + name + '</b><small>' + meta + '</small>' + bar + '</span><span class="hm-s-go">' + ic(P.go) + '</span></button>';
    }).join('');
    /* صورة تعذّر تحميلها (بدون إنترنت): نعرض الحرف الأول بدلاً منها */
    function noImg(im) { var w = im.parentNode, b = w && w.parentNode && w.parentNode.querySelector('b'); if (w) w.textContent = b ? b.textContent.charAt(0) : '؟'; }
    var imgs = Array.prototype.slice.call(box.querySelectorAll('.hm-s-img img'));
    imgs.forEach(function (im) { im.addEventListener('error', function () { noImg(im); }); });
    setTimeout(function () { imgs.forEach(function (im) { if (im.parentNode && im.complete && !im.naturalWidth) noImg(im); }); }, 4000);
    if (S.length > LIMIT) {
      tog.hidden = false; tog.setAttribute('aria-expanded', showAll ? 'true' : 'false');
      tog.textContent = showAll ? 'عرض أقل' : 'عرض الكل (' + S.length + ')';
    } else tog.hidden = true;
  }

  /* ==========================================================================
     الإنجازات: كلها من بيانات مسجّلة فعلاً
     ========================================================================== */
  function row(attr, label, val, total, note) {
    var bar = total ? '<div class="hm-bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(val / total * 100)) + '%"></i></div>' : '';
    var v = total ? val + '<small> / ' + total + '</small>' : val;
    return '<button type="button" class="hm-a" ' + attr + '><span class="hm-a-top"><b>' + label + '</b><em>' + v + '</em></span>' + bar + (note ? '<small class="hm-note">' + note + '</small>' : '') + '</button>';
  }
  function renderAch() {
    var box = $('#hmAch'), hint = $('#hmAchHint'), lc = lecStats(), td = todoStats(), sc = schedStats(), pm = pomoStats(), h = '';
    if (!box) return;
    h += row('data-lec="1"', 'المحاضرات المكتملة', lc.done, lc.total,
      !lc.total ? 'لا توجد محاضرات منشورة بعد' : (!lc.auth ? 'تعذّر تحميل تقدّمك حالياً' : (lc.going ? lc.going + ' محاضرة قيد المتابعة' : 'افتح محاضرة وأكمل دراستها ليسجَّل تقدّمك')));
    h += row('data-tool="todo"', 'المهام المنجزة', td.done, td.total, td.total ? '' : 'لم تضف أي مهمة بعد');
    h += row('data-tool="sched"', 'حصص الجدول الدراسي المنجزة', sc.done, sc.total, sc.total ? '' : 'لم تنشئ جدولاً دراسياً بعد');
    h += row('data-tool="pomo"', 'جلسات التركيز المكتملة', pm.n, 0, pm.n ? 'بمجموع ' + dur(pm.min) + ' من التركيز في آخر 60 يوماً' : 'لم تُكمل أي جلسة تركيز بعد');
    box.innerHTML = h;
    var any = lc.done || lc.going || td.total || sc.total || pm.n;
    hint.hidden = !!any;
    if (!any) hint.textContent = 'ابدأ بمحاضرة أو مهمة أو جلسة تركيز، وسيظهر تقدّمك هنا تلقائياً.';
  }

  /* ==========================================================================
     الترحيب الشخصي + تحديث شامل
     ========================================================================== */
  function renderGreet() {
    var g = $('#hmGreet'), n = userName();
    if (!g) return;
    if (n) { g.textContent = greeting() + '، ' + n; g.hidden = false; } else g.hidden = true;
  }
  function update() { if (!built) return; renderGreet(); renderQuick(); renderSubjects(); renderTerm(); renderAch(); }

  function playEcg() {
    var e = $('#hmEcg'); if (!e) return;
    e.classList.remove('go'); void e.getBoundingClientRect(); e.classList.add('go');
  }

  /* ==========================================================================
     التشغيل
     ========================================================================== */
  build();
  nextFact(false);
  update();
  playEcg();

  /* كلما عاد الطالب إلى الرئيسية: بيانات محدّثة + معلومة جديدة */
  var wasHidden = root.hidden;
  new MutationObserver(function () {
    if (wasHidden && !root.hidden) { update(); nextFact(false); }
    wasHidden = root.hidden;
  }).observe(root, { attributes: true, attributeFilter: ['hidden'] });

  /* تحديث عند تغيّر حالة الدخول أو بيانات التخزين أو العودة للتطبيق */
  addEventListener('edu-auth', function () { setTimeout(update, 0); });
  addEventListener('storage', function () { if (!root.hidden) update(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !root.hidden) update(); });
  /* قد يكتمل تحميل بيانات التقدّم بعد هذا السكربت */
  setTimeout(update, 1200);
})();
