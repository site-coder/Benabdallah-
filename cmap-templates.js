/* ==========================================================================
   cmap-templates.js — «منشئ الخرائط المفاهيمية» (المرحلة 3): القوالب الجاهزة
   - كل قالب دالة build() تُنتج وصفاً لعقد وروابط حقيقية (مواضع وأحجام ونصوص وأسهم)،
     ثم يحوّلها CM.materialize إلى عقد وروابط فعلية قابلة للتعديل بالكامل مثل أي عقدة يرسمها المستخدم
   - لا صور ثابتة: المعاينة المصغرة في المعرض تُرسم من الوصف نفسه وبألوان المجموعة المختارة
   - الإحداثيات: (x,y) = مركز العقدة، والمركز (0,0) وسط الخريطة
   ========================================================================== */
(function () {
  'use strict';
  var CM = window.CM; if (!CM) return;

  function N(k, x, y, o) { o = o || {}; o.k = k; o.x = x; o.y = y; return o; }
  function K(a, b, o) { o = o || {}; o.a = a; o.b = b; return o; }

  /* 1) خريطة ذهنية: مفهوم مركزي + 6 فروع، لكل فرع فكرة فرعية */
  function mindmap() {
    var ns = [N('c', 0, 0, { role: 'main', shape: 'ellipse', w: 230, h: 112, fs: 24, text: 'الفكرة المركزية', tone: 0 })], ls = [];
    var pos = [[1, -190], [1, 0], [1, 190], [-1, -190], [-1, 0], [-1, 190]];
    var names = ['الفرع الأول', 'الفرع الثاني', 'الفرع الثالث', 'الفرع الرابع', 'الفرع الخامس', 'الفرع السادس'];
    pos.forEach(function (p, i) {
      var tone = 1 + (i % 5);
      ns.push(N('b' + i, p[0] * 320, p[1], { role: 'sub', w: 170, h: 64, text: names[i], tone: tone, parent: 'c' }));
      ns.push(N('l' + i, p[0] * 560, p[1], { role: 'sub', w: 150, h: 54, fs: 15, text: 'فكرة فرعية', tone: tone, leaf: true, parent: 'b' + i }));
      ls.push(K('c', 'b' + i, { style: 'curve' }));
      ls.push(K('b' + i, 'l' + i, { style: 'curve' }));
    });
    return { nodes: ns, links: ls };
  }

  /* 2) خريطة هرمية: جذر ← 3 فروع ← 6 مفاهيم فرعية (روابط متعامدة بأسهم) */
  function hierarchy() {
    var ns = [N('r', 0, 0, { role: 'main', shape: 'round', w: 240, h: 84, fs: 22, text: 'المفهوم الرئيسي', tone: 0 })], ls = [];
    var gx = [-475, -285, -95, 95, 285, 475];
    for (var i = 0; i < 3; i++) {
      var cx = (gx[i * 2] + gx[i * 2 + 1]) / 2, tone = i + 1;
      ns.push(N('m' + i, cx, 170, { role: 'sub', w: 190, h: 68, text: 'المستوى الثاني ' + (i + 1), tone: tone, parent: 'r' }));
      ls.push(K('r', 'm' + i, { style: 'elbow', arrow: 'end' }));
      for (var j = 0; j < 2; j++) {
        var id = 'g' + i + j;
        ns.push(N(id, gx[i * 2 + j], 340, { role: 'sub', w: 160, h: 56, fs: 15, text: 'المستوى الثالث', tone: tone, leaf: true, parent: 'm' + i }));
        ls.push(K('m' + i, id, { style: 'elbow', arrow: 'end' }));
      }
    }
    return { nodes: ns, links: ls };
  }

  /* 3) مخطط تسلسلي: 5 مراحل متتابعة من اليمين إلى اليسار (اتجاه القراءة العربية) */
  function flow() {
    var ns = [], ls = [], tones = [0, 1, 2, 4, 5];
    var names = ['البداية', 'الخطوة الثانية', 'الخطوة الثالثة', 'الخطوة الرابعة', 'النتيجة'];
    var descs = ['وصف مختصر للمرحلة', 'وصف مختصر للمرحلة', 'وصف مختصر للمرحلة', 'وصف مختصر للمرحلة', 'وصف مختصر للمرحلة'];
    for (var i = 0; i < 5; i++) {
      ns.push(N('s' + i, (2 - i) * 250, 0, { role: i === 0 ? 'main' : 'sub', shape: 'round', w: 190, h: 98, fs: i === 0 ? 20 : 18, text: names[i], desc: descs[i], tone: tones[i] }));
      if (i) ls.push(K('s' + (i - 1), 's' + i, { style: 'straight', arrow: 'end', width: 3 }));
    }
    return { nodes: ns, links: ls };
  }

  /* 4) خريطة مقارنة: ثلاثة مفاهيم (احذف أحدها للمقارنة بين اثنين) × ثلاث خصائص، ثم خلاصة تجمعها */
  function compare() {
    var ns = [N('t', 0, 0, { role: 'main', shape: 'ellipse', w: 240, h: 100, fs: 24, text: 'المقارنة', tone: 0 })], ls = [];
    var xs = [300, 0, -300];
    for (var i = 0; i < 3; i++) {
      var tone = i + 1, c = 'c' + i;
      ns.push(N(c, xs[i], 150, { role: 'sub', shape: 'round', w: 210, h: 76, text: 'المفهوم ' + ['الأول', 'الثاني', 'الثالث'][i], tone: tone }));
      ls.push(K('t', c, { style: 'curve' }));
      var prev = c;
      for (var j = 0; j < 3; j++) {
        var a = 'a' + i + j;
        ns.push(N(a, xs[i], 275 + j * 90, { role: 'sub', w: 200, h: 56, fs: 15, text: 'الخاصية ' + (j + 1), tone: tone, leaf: true }));
        ls.push(K(prev, a, { style: 'straight', arrow: 'end', width: 2 })); prev = a;
      }
      ls.push(K(prev, 'z', { style: 'curve', arrow: 'end' }));
    }
    ns.push(N('z', 0, 590, { role: 'sub', shape: 'round', w: 270, h: 72, fs: 18, text: 'الخلاصة والفروق الجوهرية', tone: 4 }));
    return { nodes: ns, links: ls };
  }

  /* 5) خريطة دورية: 5 مراحل على دائرة بيضاوية، أسهم متتابعة تُغلق الدورة، ومفهوم محوري في الوسط */
  function cycle() {
    var ns = [N('c', 0, 0, { role: 'main', shape: 'ellipse', w: 200, h: 100, fs: 20, text: 'المفهوم المحوري', tone: 0 })], ls = [];
    for (var i = 0; i < 5; i++) {
      var a = (-90 + i * 72) * Math.PI / 180;
      ns.push(N('p' + i, Math.round(Math.cos(a) * 330), Math.round(Math.sin(a) * 235), { role: 'sub', shape: 'round', w: 170, h: 66, text: 'المرحلة ' + (i + 1), tone: 1 + (i % 5) }));
    }
    for (var k = 0; k < 5; k++) ls.push(K('p' + k, 'p' + ((k + 1) % 5), { style: 'straight', arrow: 'end', width: 3 }));
    return { nodes: ns, links: ls };
  }

  /* 6) خريطة شبكية: 7 مفاهيم بعلاقات متنوعة (سهم واحد، سهمان، خط، وكلمات ربط) */
  function network() {
    var T = function (k, x, y, tone, o) { o = o || {}; o.role = o.role || 'sub'; o.w = o.w || 170; o.h = o.h || 64; o.tone = tone; return N(k, x, y, o); };
    var ns = [
      T('a', 0, -20, 0, { role: 'main', shape: 'ellipse', w: 220, h: 104, fs: 22, text: 'المفهوم المحوري' }),
      T('b', -340, -210, 1, { text: 'المفهوم 1' }), T('c', 340, -210, 2, { text: 'المفهوم 2' }),
      T('d', -440, 60, 3, { text: 'المفهوم 3' }), T('e', 440, 60, 4, { text: 'المفهوم 4' }),
      T('f', -190, 250, 5, { text: 'المفهوم 5' }), T('g', 190, 250, 1, { text: 'المفهوم 6' })
    ];
    var ls = [
      K('a', 'b', { style: 'curve', arrow: 'end', label: 'يشمل' }), K('a', 'c', { style: 'curve', arrow: 'end', label: 'يؤدي إلى' }),
      K('a', 'd', { style: 'straight', arrow: 'none', label: 'يرتبط بـ' }), K('a', 'e', { style: 'straight', arrow: 'end', label: 'يعتمد على' }),
      K('b', 'd', { style: 'curve', arrow: 'end', label: 'يسبب' }), K('c', 'e', { style: 'curve', arrow: 'end', label: 'ينتج عنه' }),
      K('d', 'f', { style: 'curve', arrow: 'end', label: 'يتضمن' }), K('e', 'g', { style: 'curve', arrow: 'end', label: 'مثل' }),
      K('f', 'g', { style: 'straight', arrow: 'both', label: 'يتبادلان التأثير' }), K('b', 'c', { style: 'straight', arrow: 'none', label: 'يرتبط بـ' }),
      K('a', 'g', { style: 'straight', arrow: 'end', label: 'يقود إلى' })
    ];
    return { nodes: ns, links: ls };
  }

  CM.TEMPLATES = [
    { id: 'mindmap', name: 'خريطة ذهنية', desc: 'مفهوم مركزي تتفرع منه الأفكار والأفكار الفرعية.', build: mindmap },
    { id: 'hierarchy', name: 'خريطة هرمية', desc: 'مفهوم رئيسي يتفرع إلى مستويات فرعية متدرجة.', build: hierarchy },
    { id: 'flow', name: 'مخطط تسلسلي', desc: 'خطوات ومراحل متتابعة بأسهم تحدد الاتجاه.', build: flow },
    { id: 'compare', name: 'خريطة مقارنة', desc: 'مقارنة بين مفهومين أو أكثر عبر خصائص متقابلة وخلاصة.', build: compare },
    { id: 'cycle', name: 'خريطة دورية', desc: 'مراحل مترابطة في دورة متكررة تعود إلى بدايتها.', build: cycle },
    { id: 'network', name: 'خريطة شبكية', desc: 'مفاهيم متعددة مترابطة بعلاقات وكلمات ربط مختلفة.', build: network }
  ];
})();
