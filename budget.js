/* ==========================================================================
   budget.js — أداة «مدير الميزانية الجامعية» (Student Budget Manager)
   - تعمل محلياً 100% دون إنترنت، بدون React/Vue، بدون API خارجي أو Backend
   - التخزين في IndexedDB عبر window.BudgetStore
   - الرسوم البيانية عبر Chart.js المحلية (vendor/chart.umd.min.js)
   ========================================================================== */
(function (root) {
  'use strict';

  var S = root.BudgetStore;
  if (!S) return;

  /* ---------- أيقونات SVG خفيفة ---------- */
  function ic(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  var CAT_ICONS = {
    utensils: ic('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>'),
    bus: ic('<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>'),
    book: ic('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    printer: ic('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    home: ic('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    cap: ic('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
    wifi: ic('<path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'),
    shirt: ic('<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>'),
    heart: ic('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
    smile: ic('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'),
    tag: ic('<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>'),
    coffee: ic('<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>'),
    bag: ic('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    laptop: ic('<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>')
  };

  var UI_ICONS = {
    dash: ic('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    exp: ic('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
    inc: ic('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
    plan: ic('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'),
    chart: ic('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'),
    goal: ic('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    rep: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>'),
    plus: ic('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    bell: ic('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    repeat: ic('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
    dl: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    ul: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    print: ic('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    warn: ic('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    calc: ic('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15h.01"/><path d="M8 19h8"/>'),
    wallet: ic('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
    trend: ic('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
    piggy: ic('<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>'),
    pause: ic('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'),
    play: ic('<polygon points="6 3 20 12 6 21 6 3"/>')
  };

  var CAT_COLORS = ['#0F294A', '#1E3A5F', '#10B981', '#F59E0B', '#EF4444', '#2563EB', '#7C3AED', '#06B6D4', '#EC4899', '#F97316', '#64748B'];

  /* ---------- حالة التطبيق ---------- */
  var state = {
    root: null,
    ready: false,
    storageError: '',
    tab: 'dash',
    month: S.currentMonthStr(),
    data: {
      expenses: [],
      incomes: [],
      budgets: {},
      categories: [],
      recurring: [],
      goals: [],
      dismissedAlerts: {},
      autoGenerated: []
    },
    expFilter: {
      q: '',
      cat: 'all',
      pay: 'all',
      from: '',
      to: '',
      sort: 'newest'
    },
    incFilter: {
      scope: 'month', // month | all
      source: 'all'
    },
    analytics: {
      period: 'month', // day | week | month | year | custom
      from: S.todayStr().slice(0, 7) + '-01',
      to: S.todayStr()
    },
    report: {
      type: 'monthly', // daily | weekly | monthly | yearly | category | income_expense
      date: S.todayStr(),
      month: S.currentMonthStr(),
      year: String(new Date().getFullYear()),
      catId: 'all'
    },
    openGoalHist: {},
    charts: {}
  };

  /* ---------- أدوات مساعدة ---------- */
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseNum(v) {
    var s = String(v == null ? '' : v).trim()
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; })
      .replace(/[,،٫]/g, '.');
    if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function fmtMoney(v) {
    var n = S.roundMoney(v);
    try {
      return n.toLocaleString('ar-DZ-u-nu-latn', { maximumFractionDigits: 2 }) + ' دج';
    } catch (e) {
      return n.toFixed(2) + ' دج';
    }
  }

  function fmtDateAr(dateStr) {
    if (!dateStr || !S.isValidDate(dateStr)) return dateStr || '';
    try {
      var p = dateStr.split('-');
      var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return d.toLocaleDateString('ar-DZ-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function fmtMonthAr(monthStr) {
    if (!monthStr || !S.isValidMonth(monthStr)) return monthStr || '';
    try {
      var p = monthStr.split('-');
      var d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
      return d.toLocaleDateString('ar-DZ-u-nu-latn', { month: 'long', year: 'numeric' });
    } catch (e) {
      return monthStr;
    }
  }

  function prevMonthStr(monthStr) {
    var p = monthStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 2, 1);
    return d.getFullYear() + '-' + ((d.getMonth() + 1) < 10 ? '0' : '') + (d.getMonth() + 1);
  }

  function daysInMonth(monthStr) {
    var p = monthStr.split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  }

  function payLabel(id) {
    var found = S.PAYMENT_METHODS.filter(function (x) { return x.id === id; })[0];
    return found ? found.label : 'نقداً';
  }

  function incSourceLabel(id) {
    var found = S.INCOME_SOURCES.filter(function (x) { return x.id === id; })[0];
    return found ? found.label : 'مصادر أخرى';
  }

  function getCategory(id) {
    var list = state.data.categories || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return { id: 'other', name: 'مصاريف أخرى', icon: 'tag', color: '#64748B' };
  }

  function catIconHtml(cat) {
    return CAT_ICONS[cat && cat.icon] || CAT_ICONS.tag;
  }

  function freqLabel(f) {
    return f === 'daily' ? 'يومي' : f === 'weekly' ? 'أسبوعي' : 'شهري';
  }

  function statusTone(pct) {
    if (pct >= 90) return 'bad';
    if (pct >= 70) return 'warn';
    return 'ok';
  }

  function weekRangeFor(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    // الأسبوع الجزائري: السبت (6) إلى الجمعة (5)
    var day = d.getDay(); // 0=Sun..6=Sat
    var diffFromSat = (day + 1) % 7;
    var start = S.addDaysStr(dateStr, -diffFromSat);
    var end = S.addDaysStr(start, 6);
    return { start: start, end: end };
  }

  /* ---------- Toast & Modal مستقلان ---------- */
  var toastEl = document.createElement('div');
  toastEl.className = 'tl-toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  var toastTimer = 0;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2600);
  }

  var mbg = document.createElement('div');
  mbg.className = 'tl-mbg';
  mbg.innerHTML = '<div class="tl-modal" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(mbg);
  var modalEl = mbg.firstChild;
  function openModal(html) {
    modalEl.innerHTML = html;
    mbg.classList.add('open');
  }
  function closeModal() {
    mbg.classList.remove('open');
    modalEl.innerHTML = '';
  }
  mbg.addEventListener('mousedown', function (e) { if (e.target === mbg) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mbg.classList.contains('open')) closeModal(); });

  /* ---------- المحرك الحسابي المالي ---------- */
  function getMonthBudget(monthStr) {
    var b = state.data.budgets[monthStr];
    if (b) return b;
    return {
      month: monthStr,
      monthlyBudget: 0,
      weeklyBudget: 0,
      dailyCap: 0,
      savingsAllocation: 0,
      categoryBudgets: {}
    };
  }

  function sumAmounts(list) {
    var tot = 0;
    for (var i = 0; i < list.length; i++) tot += Number(list[i].amount) || 0;
    return S.roundMoney(tot);
  }

  function computeSummary(monthStr) {
    var exps = state.data.expenses;
    var incs = state.data.incomes;
    var goals = state.data.goals;
    var budget = getMonthBudget(monthStr);
    var prevM = prevMonthStr(monthStr);

    var monthExps = exps.filter(function (e) { return e.month === monthStr; });
    var monthIncs = incs.filter(function (i) { return i.month === monthStr; });
    var prevExps = exps.filter(function (e) { return e.month === prevM; });
    var prevIncs = incs.filter(function (i) { return i.month === prevM; });

    var monthExpenseTotal = sumAmounts(monthExps);
    var monthIncomeTotal = sumAmounts(monthIncs);
    var prevExpenseTotal = sumAmounts(prevExps);
    var prevIncomeTotal = sumAmounts(prevIncs);

    var allExpenseTotal = sumAmounts(exps);
    var allIncomeTotal = sumAmounts(incs);
    var netCashAllTime = S.roundMoney(allIncomeTotal - allExpenseTotal);

    var totalGoalsSaved = 0;
    for (var g = 0; g < goals.length; g++) totalGoalsSaved += Number(goals[g].savedAmount) || 0;
    totalGoalsSaved = S.roundMoney(totalGoalsSaved);

    // الفصل الصريح بين الرصيد الفعلي المتاح والأموال المخصصة لأهداف الادخار
    var actualAvailableCash = S.roundMoney(netCashAllTime - totalGoalsSaved);

    var monthlyBudget = Number(budget.monthlyBudget) || 0;
    var remainingBudget = S.roundMoney(monthlyBudget - monthExpenseTotal);
    var budgetPct = monthlyBudget > 0 ? Math.round((monthExpenseTotal / monthlyBudget) * 1000) / 10 : 0;

    // حاسبة المصروف اليومي + توقع المصروفات
    var today = S.todayStr();
    var curM = S.currentMonthStr();
    var totalDays = daysInMonth(monthStr);
    var daysElapsed = 0;
    var daysRemaining = 0;

    if (monthStr === curM) {
      var dayNum = Number(today.slice(8, 10));
      daysElapsed = dayNum;
      daysRemaining = Math.max(1, totalDays - dayNum + 1);
    } else if (monthStr < curM) {
      daysElapsed = totalDays;
      daysRemaining = 0;
    } else {
      daysElapsed = 0;
      daysRemaining = totalDays;
    }

    var dailySuggested = (daysRemaining > 0 && remainingBudget > 0)
      ? S.roundMoney(remainingBudget / daysRemaining)
      : 0;

    var avgDailySpend = daysElapsed > 0 ? S.roundMoney(monthExpenseTotal / daysElapsed) : 0;
    var projectedExpenses = daysElapsed > 0
      ? S.roundMoney(Math.max(monthExpenseTotal, avgDailySpend * totalDays))
      : 0;
    var projectedBudgetPct = monthlyBudget > 0 ? Math.round((projectedExpenses / monthlyBudget) * 1000) / 10 : 0;

    // الأسبوع الحالي والإنفاق اليومي
    var wk = weekRangeFor(today);
    var weekExpenses = sumAmounts(exps.filter(function (e) { return e.date >= wk.start && e.date <= wk.end; }));
    var todayExpenses = sumAmounts(exps.filter(function (e) { return e.date === today; }));

    // المصروف حسب التصنيف في الشهر المختار
    var byCat = {};
    monthExps.forEach(function (e) {
      var cid = e.categoryId || 'other';
      byCat[cid] = S.roundMoney((byCat[cid] || 0) + (Number(e.amount) || 0));
    });

    // مقارنة بالشهر السابق
    var expDiff = S.roundMoney(monthExpenseTotal - prevExpenseTotal);
    var expDiffPct = prevExpenseTotal > 0 ? Math.round((expDiff / prevExpenseTotal) * 1000) / 10 : null;

    // آخر 5 عمليات مالية (مصروفات + دخل)
    var recentTx = [];
    exps.forEach(function (e) {
      recentTx.push({ kind: 'exp', id: e.id, date: e.date, createdAt: e.createdAt || 0, amount: e.amount, categoryId: e.categoryId, paymentMethod: e.paymentMethod, description: e.description });
    });
    incs.forEach(function (i) {
      recentTx.push({ kind: 'inc', id: i.id, date: i.date, createdAt: i.createdAt || 0, amount: i.amount, source: i.source, description: i.description });
    });
    recentTx.sort(function (a, b) {
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return {
      month: monthStr,
      prevMonth: prevM,
      budget: budget,
      monthlyBudget: monthlyBudget,
      monthExpenseTotal: monthExpenseTotal,
      monthIncomeTotal: monthIncomeTotal,
      monthNet: S.roundMoney(monthIncomeTotal - monthExpenseTotal),
      prevExpenseTotal: prevExpenseTotal,
      prevIncomeTotal: prevIncomeTotal,
      expDiff: expDiff,
      expDiffPct: expDiffPct,
      allExpenseTotal: allExpenseTotal,
      allIncomeTotal: allIncomeTotal,
      netCashAllTime: netCashAllTime,
      totalGoalsSaved: totalGoalsSaved,
      actualAvailableCash: actualAvailableCash,
      remainingBudget: remainingBudget,
      budgetPct: budgetPct,
      txCount: monthExps.length + monthIncs.length,
      monthExpCount: monthExps.length,
      monthIncCount: monthIncs.length,
      totalDays: totalDays,
      daysElapsed: daysElapsed,
      daysRemaining: daysRemaining,
      dailySuggested: dailySuggested,
      avgDailySpend: avgDailySpend,
      projectedExpenses: projectedExpenses,
      projectedBudgetPct: projectedBudgetPct,
      weekRange: wk,
      weekExpenses: weekExpenses,
      todayExpenses: todayExpenses,
      byCat: byCat,
      recent5: recentTx.slice(0, 5)
    };
  }

  /* ---------- التنبيهات المالية المحلية ---------- */
  function computeAlerts(sum) {
    var alerts = [];
    var b = sum.budget;
    var today = S.todayStr();

    if (sum.monthlyBudget > 0) {
      if (sum.budgetPct >= 100) {
        alerts.push({ id: 'm_100_' + sum.month, tone: 'bad', text: 'تجاوزت الميزانية الشهرية (' + sum.budgetPct + '%)! أنفقت ' + fmtMoney(sum.monthExpenseTotal) + ' من أصل ' + fmtMoney(sum.monthlyBudget) + '.' });
      } else if (sum.budgetPct >= 90) {
        alerts.push({ id: 'm_90_' + sum.month, tone: 'bad', text: 'تنبيه حرج: استهلكت ' + sum.budgetPct + '% من الميزانية الشهرية لشهر ' + fmtMonthAr(sum.month) + '.' });
      } else if (sum.budgetPct >= 70) {
        alerts.push({ id: 'm_70_' + sum.month, tone: 'warn', text: 'اقتربت من سقف الميزانية الشهرية (' + sum.budgetPct + '% مستهلكة).' });
      }
      if (sum.remainingBudget > 0 && sum.remainingBudget <= sum.monthlyBudget * 0.15) {
        alerts.push({ id: 'low_rem_' + sum.month, tone: 'warn', text: 'انخفاض المبلغ المتبقي من الميزانية: لم يتبقَ سوى ' + fmtMoney(sum.remainingBudget) + '.' });
      }
    }

    if (sum.allIncomeTotal > 0 && sum.actualAvailableCash < 2000) {
      alerts.push({ id: 'low_cash_' + sum.month, tone: sum.actualAvailableCash <= 0 ? 'bad' : 'warn', text: 'انخفاض الرصيد الفعلي المتاح (بعد فصل أموال الادخار): ' + fmtMoney(sum.actualAvailableCash) + '.' });
    }

    if (Number(b.weeklyBudget) > 0) {
      var wp = Math.round((sum.weekExpenses / Number(b.weeklyBudget)) * 1000) / 10;
      if (wp >= 100) alerts.push({ id: 'w_100_' + sum.weekRange.start, tone: 'bad', text: 'تجاوزت الميزانية الأسبوعية (' + wp + '%): ' + fmtMoney(sum.weekExpenses) + ' من ' + fmtMoney(b.weeklyBudget) + '.' });
      else if (wp >= 90) alerts.push({ id: 'w_90_' + sum.weekRange.start, tone: 'bad', text: 'وصلت إلى ' + wp + '% من الميزانية الأسبوعية.' });
      else if (wp >= 70) alerts.push({ id: 'w_70_' + sum.weekRange.start, tone: 'warn', text: 'استهلكت ' + wp + '% من الميزانية الأسبوعية.' });
    }

    if (Number(b.dailyCap) > 0 && sum.month === S.currentMonthStr()) {
      var dp = Math.round((sum.todayExpenses / Number(b.dailyCap)) * 1000) / 10;
      if (dp >= 100) alerts.push({ id: 'd_100_' + today, tone: 'bad', text: 'تجاوزت السقف اليومي للإنفاق اليوم (' + fmtMoney(sum.todayExpenses) + ' / ' + fmtMoney(b.dailyCap) + ').' });
      else if (dp >= 70) alerts.push({ id: 'd_70_' + today, tone: 'warn', text: 'استهلكت ' + dp + '% من السقف اليومي اليوم.' });
    }

    var cb = b.categoryBudgets || {};
    Object.keys(cb).forEach(function (cid) {
      var lim = Number(cb[cid]) || 0;
      if (lim <= 0) return;
      var spent = sum.byCat[cid] || 0;
      var pct = Math.round((spent / lim) * 1000) / 10;
      var cname = getCategory(cid).name;
      if (pct >= 100) alerts.push({ id: 'c_100_' + sum.month + '_' + cid, tone: 'bad', text: 'تجاوزت ميزانية تصنيف «' + cname + '» (' + pct + '%): ' + fmtMoney(spent) + ' / ' + fmtMoney(lim) + '.' });
      else if (pct >= 90) alerts.push({ id: 'c_90_' + sum.month + '_' + cid, tone: 'bad', text: 'تصنيف «' + cname + '» وصل إلى ' + pct + '% من ميزانيته.' });
      else if (pct >= 70) alerts.push({ id: 'c_70_' + sum.month + '_' + cid, tone: 'warn', text: 'تصنيف «' + cname + '» بلغ ' + pct + '% من ميزانيته.' });
    });

    if (state.data.autoGenerated && state.data.autoGenerated.length) {
      alerts.push({ id: 'rec_' + today + '_' + state.data.autoGenerated.length, tone: 'info', text: 'تم تسجيل ' + state.data.autoGenerated.length + ' مصروف متكرر مستحق تلقائياً اليوم.' });
    }

    // اقتراب موعد هدف الادخار (خلال 14 يوماً ولم يكتمل بعد)
    state.data.goals.forEach(function (g) {
      if (!g.targetDate || g.savedAmount >= g.targetAmount) return;
      var p1 = today.split('-'), p2 = g.targetDate.split('-');
      var d1 = new Date(Number(p1[0]), Number(p1[1]) - 1, Number(p1[2]));
      var d2 = new Date(Number(p2[0]), Number(p2[1]) - 1, Number(p2[2]));
      var diffDays = Math.ceil((d2 - d1) / 86400000);
      if (diffDays >= 0 && diffDays <= 14) {
        alerts.push({ id: 'g_due_' + g.id + '_' + g.targetDate, tone: 'warn', text: 'موعد هدف الادخار «' + g.name + '» يقترب (متبقٍ ' + diffDays + ' يوم، وينقص ' + fmtMoney(g.targetAmount - g.savedAmount) + ').' });
      } else if (diffDays < 0) {
        alerts.push({ id: 'g_past_' + g.id + '_' + g.targetDate, tone: 'bad', text: 'تجاوزت التاريخ المستهدف لهدف «' + g.name + '» وما زال متبقياً ' + fmtMoney(g.targetAmount - g.savedAmount) + '.' });
      }
    });

    var dismissed = state.data.dismissedAlerts || {};
    return alerts.filter(function (a) { return !dismissed[a.id]; });
  }

  /* ---------- البناء والعرض الرئيسي ---------- */
  function reloadAndRender() {
    return S.loadAllData().then(function (data) {
      state.data = data;
      state.storageError = '';
      render();
    }).catch(function (err) {
      state.storageError = (err && err.message) ? err.message : 'تعذّر الوصول إلى التخزين المحلي IndexedDB.';
      render();
    });
  }

  function destroyCharts() {
    Object.keys(state.charts).forEach(function (k) {
      try { if (state.charts[k]) state.charts[k].destroy(); } catch (e) {}
      delete state.charts[k];
    });
  }

  function render() {
    if (!state.root) return;
    destroyCharts();

    var sum = computeSummary(state.month);
    var alerts = computeAlerts(sum);

    var h = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div>';
    h += '<h2 class="ptitle">مدير الميزانية الجامعية</h2>';
    h += '<div class="bm-wrap">';

    if (state.storageError) {
      h += '<div class="bm-storage-err" role="alert">' + esc(state.storageError) + '</div>';
    }

    // شريط الرأس المالي
    h += '<div class="bm-headbar">';
    h += '<div class="bm-month-ctl"><label for="bmMonthPick">الشهر المحدد:</label>' +
      '<input class="bm-month-in" id="bmMonthPick" type="month" value="' + esc(state.month) + '"></div>';
    h += '<div class="bm-head-acts">' +
      '<button type="button" class="bm-hbtn exp" data-act="add-exp">' + UI_ICONS.plus + '<span>إضافة مصروف</span></button>' +
      '<button type="button" class="bm-hbtn inc" data-act="add-inc">' + UI_ICONS.plus + '<span>إضافة دخل</span></button>' +
      '<button type="button" class="bm-hbtn alert-btn" data-act="show-alerts">' + UI_ICONS.bell + '<span>التنبيهات</span>' +
      (alerts.length ? '<b class="bm-abadge">' + alerts.length + '</b>' : '') + '</button>' +
      '</div></div>';

    // التبويبات
    var tabs = [
      ['dash', 'لوحة التحكم', UI_ICONS.dash],
      ['expenses', 'المصروفات', UI_ICONS.exp],
      ['income', 'الدخل', UI_ICONS.inc],
      ['budgets', 'الميزانية والتكرار', UI_ICONS.plan],
      ['analytics', 'التحليلات', UI_ICONS.chart],
      ['goals', 'الادخار والأهداف', UI_ICONS.goal],
      ['reports', 'التقارير والنسخ', UI_ICONS.rep]
    ];
    h += '<div class="bm-tabs" role="tablist">';
    tabs.forEach(function (t) {
      h += '<button type="button" class="bm-tab" role="tab" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0] ? 'true' : 'false') + '">' + t[2] + '<span>' + t[1] + '</span></button>';
    });
    h += '</div>';

    // محتوى التبويب النشط
    if (state.tab === 'dash') h += renderDashboard(sum, alerts);
    else if (state.tab === 'expenses') h += renderExpensesTab(sum);
    else if (state.tab === 'income') h += renderIncomeTab(sum);
    else if (state.tab === 'budgets') h += renderBudgetsTab(sum);
    else if (state.tab === 'analytics') h += renderAnalyticsTab(sum);
    else if (state.tab === 'goals') h += renderGoalsTab(sum);
    else if (state.tab === 'reports') h += renderReportsTab(sum);

    h += '</div>';
    state.root.innerHTML = h;

    if (state.tab === 'analytics') {
      requestAnimationFrame(function () { renderAnalyticsCharts(sum); });
    }
  }

  /* ---------- 1) لوحة التحكم المالية ---------- */
  function renderDashboard(sum, alerts) {
    var h = '';
    var bTone = sum.monthlyBudget > 0 ? statusTone(sum.budgetPct) : 'navy';
    var remTone = sum.monthlyBudget > 0 ? (sum.remainingBudget < 0 ? 'red' : (sum.budgetPct >= 70 ? 'orange' : 'green')) : 'navy';
    var cashTone = sum.actualAvailableCash < 0 ? 'red' : (sum.actualAvailableCash > 0 ? 'green' : 'navy');

    h += '<div class="bm-grid g4">';
    h += kpiCard('الميزانية الشهرية', fmtMoney(sum.monthlyBudget), sum.monthlyBudget > 0 ? 'شهر ' + fmtMonthAr(sum.month) : 'غير محددة — اضغط في التخطيط', 'navy', UI_ICONS.plan);
    h += kpiCard('إجمالي الدخل', fmtMoney(sum.monthIncomeTotal), sum.monthIncCount + ' عملية دخل في الشهر', 'green', UI_ICONS.inc);
    h += kpiCard('إجمالي المصروفات', fmtMoney(sum.monthExpenseTotal), sum.monthExpCount + ' عملية مصروف في الشهر', sum.budgetPct >= 90 ? 'red' : 'orange', UI_ICONS.exp);
    h += kpiCard('المتبقي من الميزانية', fmtMoney(sum.remainingBudget), sum.monthlyBudget > 0 ? 'نسبة الاستهلاك: ' + sum.budgetPct + '%' : 'حدّد ميزانية لاحتساب المتبقي', remTone, UI_ICONS.wallet);
    h += kpiCard('الرصيد الفعلي المتاح', fmtMoney(sum.actualAvailableCash), 'صافي النقد بعد فصل ' + fmtMoney(sum.totalGoalsSaved) + ' للأهداف', cashTone, UI_ICONS.wallet);
    h += kpiCard('المبلغ المدخر', fmtMoney(sum.totalGoalsSaved), (sum.budget.savingsAllocation > 0 ? 'مخصص الشهر: ' + fmtMoney(sum.budget.savingsAllocation) : 'إجمالي أرصدة أهداف الادخار'), 'green', UI_ICONS.piggy);
    h += kpiCard('نسبة استهلاك الميزانية', (sum.monthlyBudget > 0 ? sum.budgetPct + '%' : '—'), sum.budgetPct >= 100 ? 'تجاوز للميزانية' : (sum.budgetPct >= 90 ? 'تنبيه حرج' : (sum.budgetPct >= 70 ? 'تحذير' : 'ضمن الحدود')), bTone === 'bad' ? 'red' : (bTone === 'warn' ? 'orange' : 'green'), UI_ICONS.trend);
    h += kpiCard('عدد العمليات المالية', String(sum.txCount), sum.monthExpCount + ' مصروف · ' + sum.monthIncCount + ' دخل', 'navy', UI_ICONS.rep);
    h += '</div>';

    // شريط تقدم الميزانية الشهرية
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.plan + ' استهلاك الميزانية لشهر ' + esc(fmtMonthAr(sum.month)) + '</h3>';
    if (sum.monthlyBudget > 0) {
      var stTxt = sum.budgetPct >= 100 ? 'تجاوزت الميزانية' : (sum.budgetPct >= 90 ? 'تنبيه 90%+' : (sum.budgetPct >= 70 ? 'تحذير 70%+' : 'وضع سليم'));
      h += '<span class="bm-badge ' + statusTone(sum.budgetPct) + '">' + esc(stTxt) + ' · ' + sum.budgetPct + '%</span>';
    } else {
      h += '<button type="button" class="tl-btn sm pri" data-jump="budgets">تحديد الميزانية</button>';
    }
    h += '</div>';
    if (sum.monthlyBudget > 0) {
      var wPct = Math.min(100, Math.max(0, sum.budgetPct));
      h += '<div class="bm-pbar-wrap"><div class="bm-pbar-meta"><span>المُنفق: <b>' + fmtMoney(sum.monthExpenseTotal) + '</b></span><span>الميزانية: <b>' + fmtMoney(sum.monthlyBudget) + '</b></span></div>';
      h += '<div class="bm-pbar ' + statusTone(sum.budgetPct) + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + wPct + '"><i style="width:' + wPct + '%"></i></div></div>';
    } else {
      h += '<p class="tl-hint">لم تحدّد ميزانية لشهر ' + esc(fmtMonthAr(sum.month)) + ' بعد. انتقل إلى تبويب «الميزانية والتكرار» لتحديد الميزانية الشهرية والأسقف اليومية والأسبوعية.</p>';
    }
    h += '</div>';

    // حاسبة المصروف اليومي + توقع المصروفات
    h += '<div class="bm-grid g2">';
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.calc + ' حاسبة المصروف اليومي</h3></div>';
    h += '<div class="bm-calc-box">';
    h += '<div class="bm-mini-stat"><span>الحد اليومي المقترح</span><b style="color:var(--bm-green)">' + fmtMoney(sum.dailySuggested) + '</b></div>';
    h += '<div class="bm-mini-stat"><span>الأيام المتبقية في الشهر</span><b>' + sum.daysRemaining + ' يوم</b></div>';
    h += '<div class="bm-mini-stat"><span>المتبقي من الميزانية</span><b>' + fmtMoney(Math.max(0, sum.remainingBudget)) + '</b></div>';
    h += '<div class="bm-mini-stat"><span>إنفاق اليوم الفعلي</span><b>' + fmtMoney(sum.todayExpenses) + '</b></div>';
    h += '</div>';
    h += '<p class="tl-hint">يُحسب تلقائياً بقسمة الميزانية المتبقية على عدد الأيام المتبقية حتى نهاية الشهر، ويتجدد فور كل عملية.</p></div>';

    // توقع المصروفات
    var riskText = 'غير محدد';
    var riskTone = 'navy';
    if (sum.monthlyBudget > 0 && sum.daysElapsed > 0) {
      if (sum.projectedExpenses > sum.monthlyBudget) { riskText = 'مرتفع (توقع تجاوز بـ ' + fmtMoney(sum.projectedExpenses - sum.monthlyBudget) + ')'; riskTone = 'bad'; }
      else if (sum.projectedBudgetPct >= 85) { riskText = 'متوسط (قريب من الحد)'; riskTone = 'warn'; }
      else { riskText = 'منخفض (ضمن الميزانية)'; riskTone = 'ok'; }
    }
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.trend + ' توقع المصروفات لنهاية الشهر</h3><span class="bm-badge ' + riskTone + '">' + esc(riskText) + '</span></div>';
    h += '<div class="bm-calc-box">';
    h += '<div class="bm-mini-stat"><span>ما تم إنفاقه</span><b>' + fmtMoney(sum.monthExpenseTotal) + '</b></div>';
    h += '<div class="bm-mini-stat"><span>متوسط الإنفاق اليومي</span><b>' + fmtMoney(sum.avgDailySpend) + '</b></div>';
    h += '<div class="bm-mini-stat"><span>المصروفات المتوقعة</span><b style="color:var(--bm-orange)">' + fmtMoney(sum.projectedExpenses) + '</b></div>';
    h += '<div class="bm-mini-stat"><span>الميزانية المتوقع استهلاكها</span><b>' + (sum.monthlyBudget > 0 ? sum.projectedBudgetPct + '%' : '—') + '</b></div>';
    h += '</div>';
    h += '<div class="bm-disclaimer">ملاحظة: هذه الأرقام تقديرات حسابية تعتمد على متوسط إنفاقك اليومي الحالي، وليست توقعات مضمونة.</div></div>';
    h += '</div>';

    // آخر 5 عمليات + مقارنة بالشهر السابق
    h += '<div class="bm-grid g2">';
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.rep + ' آخر 5 عمليات مالية</h3><button type="button" class="tl-btn sm" data-jump="expenses">كل المصروفات</button></div>';
    if (!sum.recent5.length) {
      h += '<div class="bm-empty">لا توجد عمليات مالية مسجلة بعد. ابدأ بإضافة مصروف أو دخل من الأزرار أعلاه.</div>';
    } else {
      h += '<div class="bm-tx-list">';
      sum.recent5.forEach(function (tx) {
        if (tx.kind === 'exp') {
          var cat = getCategory(tx.categoryId);
          h += '<div class="bm-tx"><div class="bm-tx-ic" style="background:' + esc(cat.color) + '">' + catIconHtml(cat) + '</div>' +
            '<div class="bm-tx-main"><div class="bm-tx-title">' + esc(cat.name) + (tx.description ? ' — ' + esc(tx.description) : '') + '</div>' +
            '<div class="bm-tx-meta"><span>' + esc(fmtDateAr(tx.date)) + '</span><span>' + esc(payLabel(tx.paymentMethod)) + '</span></div></div>' +
            '<div class="bm-tx-amt exp">- ' + fmtMoney(tx.amount) + '</div></div>';
        } else {
          h += '<div class="bm-tx"><div class="bm-tx-ic" style="background:var(--bm-green)">' + UI_ICONS.inc + '</div>' +
            '<div class="bm-tx-main"><div class="bm-tx-title">' + esc(incSourceLabel(tx.source)) + (tx.description ? ' — ' + esc(tx.description) : '') + '</div>' +
            '<div class="bm-tx-meta"><span>' + esc(fmtDateAr(tx.date)) + '</span><span>دخل</span></div></div>' +
            '<div class="bm-tx-amt inc">+ ' + fmtMoney(tx.amount) + '</div></div>';
        }
      });
      h += '</div>';
    }
    h += '</div>';

    // مقارنة بالشهر السابق + التنبيهات النشطة
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.chart + ' مقارنة بالشهر السابق (' + esc(fmtMonthAr(sum.prevMonth)) + ')</h3></div>';
    var diffLabel = sum.expDiff > 0 ? ('زيادة بـ ' + fmtMoney(sum.expDiff)) : (sum.expDiff < 0 ? ('انخفاض بـ ' + fmtMoney(Math.abs(sum.expDiff))) : 'مماثل للشهر السابق');
    var diffPctTxt = sum.expDiffPct !== null ? (' (' + (sum.expDiff > 0 ? '+' : '') + sum.expDiffPct + '%)') : '';
    h += '<div class="bm-calc-box" style="margin-bottom:12px">' +
      '<div class="bm-mini-stat"><span>مصروف هذا الشهر</span><b>' + fmtMoney(sum.monthExpenseTotal) + '</b></div>' +
      '<div class="bm-mini-stat"><span>مصروف الشهر السابق</span><b>' + fmtMoney(sum.prevExpenseTotal) + '</b></div>' +
      '<div class="bm-mini-stat"><span>دخل الشهر السابق</span><b>' + fmtMoney(sum.prevIncomeTotal) + '</b></div>' +
      '<div class="bm-mini-stat"><span>الفرق في المصروفات</span><b style="color:' + (sum.expDiff > 0 ? 'var(--bm-red)' : 'var(--bm-green)') + '">' + esc(diffLabel + diffPctTxt) + '</b></div>' +
      '</div>';

    h += '<div class="bm-card-h" style="margin-top:8px"><h3>' + UI_ICONS.bell + ' التنبيهات المالية</h3></div>';
    if (!alerts.length) {
      h += '<div class="bm-alert ok"><div class="bm-alert-body"><span class="bm-alert-ic">' + UI_ICONS.goal + '</span><span>لا توجد تنبيهات حرجة حالياً. وضعك المالي مستقر.</span></div></div>';
    } else {
      h += '<div class="bm-alerts">';
      alerts.slice(0, 4).forEach(function (al) {
        h += '<div class="bm-alert ' + al.tone + '"><div class="bm-alert-body"><span class="bm-alert-ic">' + UI_ICONS.warn + '</span><span>' + esc(al.text) + '</span></div>' +
          '<button type="button" class="bm-alert-x" data-dismiss-alert="' + esc(al.id) + '" aria-label="إخفاء التنبيه">✕</button></div>';
      });
      if (alerts.length > 4) {
        h += '<button type="button" class="tl-btn sm" data-act="show-alerts">عرض كل التنبيهات (' + alerts.length + ')</button>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';
    return h;
  }

  function kpiCard(label, val, sub, tone, icon) {
    return '<div class="bm-kpi ' + tone + '">' +
      '<div class="bm-kpi-top"><span>' + esc(label) + '</span><div class="bm-kpi-ic">' + icon + '</div></div>' +
      '<div class="bm-kpi-val">' + esc(val) + '</div>' +
      '<div class="bm-kpi-sub">' + esc(sub) + '</div></div>';
  }

  /* ---------- 2) إدارة المصروفات ---------- */
  function filteredExpenses() {
    var f = state.expFilter;
    var q = (f.q || '').trim().toLowerCase();
    var list = state.data.expenses.filter(function (ex) {
      if (f.cat !== 'all' && ex.categoryId !== f.cat) return false;
      if (f.pay !== 'all' && ex.paymentMethod !== f.pay) return false;
      if (f.from && ex.date < f.from) return false;
      if (f.to && ex.date > f.to) return false;
      if (q) {
        var cname = getCategory(ex.categoryId).name.toLowerCase();
        var desc = (ex.description || '').toLowerCase();
        var pl = payLabel(ex.paymentMethod).toLowerCase();
        var amt = String(ex.amount);
        if (cname.indexOf(q) === -1 && desc.indexOf(q) === -1 && pl.indexOf(q) === -1 && amt.indexOf(q) === -1) return false;
      }
      return true;
    });

    list.sort(function (a, b) {
      if (f.sort === 'oldest') {
        if (a.date !== b.date) return a.date > b.date ? 1 : -1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (f.sort === 'high') return (b.amount || 0) - (a.amount || 0);
      if (f.sort === 'low') return (a.amount || 0) - (b.amount || 0);
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  }

  function renderExpensesTab(sum) {
    var list = filteredExpenses();
    var totalFiltered = sumAmounts(list);
    var f = state.expFilter;

    var h = '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.exp + ' سجل المصروفات</h3>' +
      '<div class="tl-row"><button type="button" class="tl-btn sm" data-act="manage-cats">إدارة التصنيفات</button>' +
      '<button type="button" class="tl-btn sm pri" data-act="add-exp">' + UI_ICONS.plus + '<span>مصروف جديد</span></button></div></div>';

    // البحث والتصفية
    h += '<div class="bm-filters">';
    h += '<input type="search" class="tl-in" id="bmExpSearch" placeholder="ابحث في الوصف أو التصنيف أو المبلغ…" value="' + esc(f.q) + '">';
    h += '<select class="tl-sel" id="bmExpCat"><option value="all">كل التصنيفات</option>';
    state.data.categories.forEach(function (c) {
      h += '<option value="' + esc(c.id) + '"' + (f.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    h += '</select>';
    h += '<select class="tl-sel" id="bmExpPay"><option value="all">كل طرق الدفع</option>';
    S.PAYMENT_METHODS.forEach(function (p) {
      h += '<option value="' + esc(p.id) + '"' + (f.pay === p.id ? ' selected' : '') + '>' + esc(p.label) + '</option>';
    });
    h += '</select>';
    h += '<select class="tl-sel" id="bmExpSort">' +
      '<option value="newest"' + (f.sort === 'newest' ? ' selected' : '') + '>الأحدث إلى الأقدم</option>' +
      '<option value="oldest"' + (f.sort === 'oldest' ? ' selected' : '') + '>الأقدم إلى الأحدث</option>' +
      '<option value="high"' + (f.sort === 'high' ? ' selected' : '') + '>الأعلى مبلغاً</option>' +
      '<option value="low"' + (f.sort === 'low' ? ' selected' : '') + '>الأقل مبلغاً</option>' +
      '</select></div>';

    h += '<div class="tl-row" style="margin-bottom:12px">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExpFrom">من تاريخ</label><input type="date" class="tl-in" id="bmExpFrom" value="' + esc(f.from) + '"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExpTo">إلى تاريخ</label><input type="date" class="tl-in" id="bmExpTo" value="' + esc(f.to) + '"></div>' +
      '<div style="align-self:flex-end"><button type="button" class="tl-btn sm" id="bmExpMonthFilter">الشهر المحدد</button> ' +
      '<button type="button" class="tl-btn sm" id="bmExpResetFilter">الكل</button></div>' +
      '</div>';

    h += '<div class="bm-sep-banner"><span>العمليات المعروضة: <b>' + list.length + '</b> عملية</span>' +
      '<span>إجمالي الفترة المحددة: <b style="color:var(--bm-red)">' + fmtMoney(totalFiltered) + '</b></span></div>';

    if (!list.length) {
      h += '<div class="bm-empty">لا توجد مصروفات مطابقة للمعايير الحالية.</div>';
    } else {
      h += '<div class="bm-tx-list">';
      list.forEach(function (ex) {
        var cat = getCategory(ex.categoryId);
        h += '<div class="bm-tx">' +
          '<div class="bm-tx-ic" style="background:' + esc(cat.color) + '">' + catIconHtml(cat) + '</div>' +
          '<div class="bm-tx-main">' +
          '<div class="bm-tx-title">' + esc(cat.name) + (ex.description ? ' — ' + esc(ex.description) : '') + '</div>' +
          '<div class="bm-tx-meta"><span>' + esc(fmtDateAr(ex.date)) + '</span><span>' + esc(payLabel(ex.paymentMethod)) + '</span>' +
          (ex.recurringId ? '<span class="bm-badge navy">متكرر</span>' : '') + '</div></div>' +
          '<div class="bm-tx-amt exp">- ' + fmtMoney(ex.amount) + '</div>' +
          '<div class="bm-tx-acts">' +
          '<button type="button" class="bm-ibtn" data-edit-exp="' + esc(ex.id) + '" aria-label="تعديل المصروف">' + UI_ICONS.edit + '</button>' +
          '<button type="button" class="bm-ibtn del" data-del-exp="' + esc(ex.id) + '" aria-label="حذف المصروف">' + UI_ICONS.trash + '</button>' +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ---------- 3) إدارة الدخل ---------- */
  function renderIncomeTab(sum) {
    var f = state.incFilter;
    var list = state.data.incomes.filter(function (inc) {
      if (f.scope === 'month' && inc.month !== state.month) return false;
      if (f.source !== 'all' && inc.source !== f.source) return false;
      return true;
    }).sort(function (a, b) {
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    var scopeInc = sumAmounts(list);
    var scopeExp = f.scope === 'month' ? sum.monthExpenseTotal : sum.allExpenseTotal;
    var scopeNet = S.roundMoney(scopeInc - scopeExp);

    var h = '<div class="bm-grid g4">';
    h += kpiCard(f.scope === 'month' ? 'إجمالي دخل الشهر' : 'إجمالي كل الدخل', fmtMoney(scopeInc), list.length + ' عملية دخل', 'green', UI_ICONS.inc);
    h += kpiCard(f.scope === 'month' ? 'إجمالي مصروفات الشهر' : 'إجمالي كل المصروفات', fmtMoney(scopeExp), 'منفصل عن الدخل', 'red', UI_ICONS.exp);
    h += kpiCard('الرصيد الصافي (الدخل - المصروفات)', fmtMoney(scopeNet), f.scope === 'month' ? 'لشهر ' + fmtMonthAr(state.month) : 'تراكمي لكل الأشهر', scopeNet >= 0 ? 'green' : 'red', UI_ICONS.wallet);
    h += kpiCard('الرصيد الفعلي المتاح', fmtMoney(sum.actualAvailableCash), 'بعد خصم ' + fmtMoney(sum.totalGoalsSaved) + ' المخصصة للأهداف', sum.actualAvailableCash >= 0 ? 'navy' : 'red', UI_ICONS.piggy);
    h += '</div>';

    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.inc + ' سجل مصادر الدخل</h3>' +
      '<button type="button" class="tl-btn sm pri" data-act="add-inc">' + UI_ICONS.plus + '<span>إضافة دخل</span></button></div>';

    h += '<div class="tl-row" style="margin-bottom:12px">' +
      '<div class="tl-fld"><select class="tl-sel" id="bmIncScope">' +
      '<option value="month"' + (f.scope === 'month' ? ' selected' : '') + '>شهر ' + esc(fmtMonthAr(state.month)) + '</option>' +
      '<option value="all"' + (f.scope === 'all' ? ' selected' : '') + '>جميع الأشهر</option></select></div>' +
      '<div class="tl-fld"><select class="tl-sel" id="bmIncSrc"><option value="all">كل المصادر</option>';
    S.INCOME_SOURCES.forEach(function (src) {
      h += '<option value="' + esc(src.id) + '"' + (f.source === src.id ? ' selected' : '') + '>' + esc(src.label) + '</option>';
    });
    h += '</select></div></div>';

    if (!list.length) {
      h += '<div class="bm-empty">لا توجد عمليات دخل مسجلة في هذا النطاق.</div>';
    } else {
      h += '<div class="bm-tx-list">';
      list.forEach(function (inc) {
        h += '<div class="bm-tx">' +
          '<div class="bm-tx-ic" style="background:var(--bm-green)">' + UI_ICONS.inc + '</div>' +
          '<div class="bm-tx-main">' +
          '<div class="bm-tx-title">' + esc(incSourceLabel(inc.source)) + (inc.description ? ' — ' + esc(inc.description) : '') + '</div>' +
          '<div class="bm-tx-meta"><span>' + esc(fmtDateAr(inc.date)) + '</span></div></div>' +
          '<div class="bm-tx-amt inc">+ ' + fmtMoney(inc.amount) + '</div>' +
          '<div class="bm-tx-acts">' +
          '<button type="button" class="bm-ibtn" data-edit-inc="' + esc(inc.id) + '" aria-label="تعديل الدخل">' + UI_ICONS.edit + '</button>' +
          '<button type="button" class="bm-ibtn del" data-del-inc="' + esc(inc.id) + '" aria-label="حذف الدخل">' + UI_ICONS.trash + '</button>' +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ---------- 4) الميزانية والتخطيط + المصروفات المتكررة ---------- */
  function renderBudgetsTab(sum) {
    var b = sum.budget;
    var cb = b.categoryBudgets || {};
    var h = '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.plan + ' تخطيط ميزانية شهر ' + esc(fmtMonthAr(state.month)) + '</h3>' +
      '<button type="button" class="tl-btn sm" id="bmCopyPrevBudget">نسخ من الشهر السابق</button></div>';

    h += '<form id="bmBudgetForm">';
    h += '<div class="bm-form-grid two">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmBMonthly">الميزانية الشهرية (دج)</label><input class="tl-in num" id="bmBMonthly" inputmode="decimal" value="' + esc(b.monthlyBudget || '') + '" placeholder="مثال: 20000"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmBWeekly">الميزانية الأسبوعية (دج)</label><input class="tl-in num" id="bmBWeekly" inputmode="decimal" value="' + esc(b.weeklyBudget || '') + '" placeholder="مثال: 5000"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmBDaily">السقف اليومي للإنفاق (دج)</label><input class="tl-in num" id="bmBDaily" inputmode="decimal" value="' + esc(b.dailyCap || '') + '" placeholder="مثال: 800"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmBSave">مبلغ مخصص للادخار الشهري (دج)</label><input class="tl-in num" id="bmBSave" inputmode="decimal" value="' + esc(b.savingsAllocation || '') + '" placeholder="مثال: 3000"></div>' +
      '</div>';

    h += '<h4 style="margin:16px 0 8px;color:var(--g);font-size:15px">ميزانية مستقلة لكل تصنيف (اختياري)</h4>';
    h += '<div class="bm-grid g2">';
    state.data.categories.forEach(function (cat) {
      var lim = Number(cb[cat.id]) || 0;
      var spent = sum.byCat[cat.id] || 0;
      var pct = lim > 0 ? Math.round((spent / lim) * 1000) / 10 : 0;
      h += '<div class="bm-cat-pill" style="flex-direction:column;align-items:stretch">' +
        '<div class="tl-row" style="justify-content:space-between">' +
        '<div class="bm-cat-info"><span class="bm-cat-dot" style="background:' + esc(cat.color) + '">' + catIconHtml(cat) + '</span><b>' + esc(cat.name) + '</b></div>' +
        (lim > 0 ? '<span class="bm-badge ' + statusTone(pct) + '">' + pct + '%</span>' : '') +
        '</div>' +
        '<div class="tl-row"><input class="tl-in num" style="min-height:40px" data-cat-budget="' + esc(cat.id) + '" inputmode="decimal" placeholder="الحد (دج)" value="' + (lim > 0 ? esc(lim) : '') + '"></div>' +
        (lim > 0 ? '<div class="bm-pbar ' + statusTone(pct) + '"><i style="width:' + Math.min(100, pct) + '%"></i></div><small class="tl-hint" style="margin:0">المصروف: ' + fmtMoney(spent) + ' / ' + fmtMoney(lim) + '</small>' : '<small class="tl-hint" style="margin:0">المصروف الحالي: ' + fmtMoney(spent) + '</small>') +
        '</div>';
    });
    h += '</div>';

    h += '<div class="tl-btns"><button type="submit" class="tl-btn pri">حفظ ميزانية ' + esc(fmtMonthAr(state.month)) + '</button></div></form></div>';

    // بطاقة استهلاك الأسقف الحالية (شهري / أسبوعي / يومي)
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.trend + ' مراقبة الأسقف والتنبيهات (70% · 90% · 100%)</h3></div>';
    h += budgetBarRow('الميزانية الشهرية (' + fmtMonthAr(sum.month) + ')', sum.monthExpenseTotal, Number(b.monthlyBudget) || 0);
    h += budgetBarRow('الميزانية الأسبوعية (' + fmtDateAr(sum.weekRange.start) + ' - ' + fmtDateAr(sum.weekRange.end) + ')', sum.weekExpenses, Number(b.weeklyBudget) || 0);
    h += budgetBarRow('السقف اليومي (اليوم ' + fmtDateAr(S.todayStr()) + ')', sum.todayExpenses, Number(b.dailyCap) || 0);
    h += '</div>';

    // قسم المصروفات المتكررة
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.repeat + ' المصروفات المتكررة</h3>' +
      '<button type="button" class="tl-btn sm pri" data-act="add-rec">' + UI_ICONS.plus + '<span>إضافة مصروف متكرر</span></button></div>';
    if (!state.data.recurring.length) {
      h += '<div class="bm-empty">لا توجد مصروفات متكررة مسجلة (مثل: الإقامة، الإنترنت، الاشتراكات).</div>';
    } else {
      h += '<div class="bm-tx-list">';
      state.data.recurring.forEach(function (r) {
        var cat = getCategory(r.categoryId);
        h += '<div class="bm-tx">' +
          '<div class="bm-tx-ic" style="background:' + esc(cat.color) + '">' + catIconHtml(cat) + '</div>' +
          '<div class="bm-tx-main">' +
          '<div class="bm-tx-title">' + esc(r.title) + ' <span class="bm-badge ' + (r.active ? 'ok' : 'warn') + '">' + (r.active ? 'مفعّل' : 'متوقف') + '</span></div>' +
          '<div class="bm-tx-meta"><span>التكرار: ' + esc(freqLabel(r.frequency)) + '</span><span>التشغيل القادم: ' + esc(fmtDateAr(r.nextRunDate)) + '</span>' +
          (r.lastRunDate ? '<span>آخر تسجيل: ' + esc(fmtDateAr(r.lastRunDate)) + '</span>' : '') + '</div></div>' +
          '<div class="bm-tx-amt exp">' + fmtMoney(r.amount) + '</div>' +
          '<div class="bm-tx-acts">' +
          '<button type="button" class="bm-ibtn" data-toggle-rec="' + esc(r.id) + '" aria-label="' + (r.active ? 'إيقاف' : 'تفعيل') + '">' + (r.active ? UI_ICONS.pause : UI_ICONS.play) + '</button>' +
          '<button type="button" class="bm-ibtn" data-edit-rec="' + esc(r.id) + '" aria-label="تعديل">' + UI_ICONS.edit + '</button>' +
          '<button type="button" class="bm-ibtn del" data-del-rec="' + esc(r.id) + '" aria-label="حذف">' + UI_ICONS.trash + '</button>' +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function budgetBarRow(title, spent, limit) {
    if (limit <= 0) {
      return '<div style="margin-bottom:10px"><div class="bm-pbar-meta"><span>' + esc(title) + '</span><span class="tl-hint" style="margin:0">المُنفق: ' + fmtMoney(spent) + ' (لم يُحدد حد)</span></div></div>';
    }
    var pct = Math.round((spent / limit) * 1000) / 10;
    var tone = statusTone(pct);
    var msg = pct >= 100 ? 'تجاوز 100%' : (pct >= 90 ? 'تحذير 90%+' : (pct >= 70 ? 'تنبيه 70%+' : 'آمن'));
    return '<div style="margin-bottom:12px">' +
      '<div class="bm-pbar-meta"><span>' + esc(title) + '</span><span><b>' + fmtMoney(spent) + '</b> / ' + fmtMoney(limit) + ' <span class="bm-badge ' + tone + '">' + pct + '% · ' + msg + '</span></span></div>' +
      '<div class="bm-pbar ' + tone + '"><i style="width:' + Math.min(100, pct) + '%"></i></div></div>';
  }

  /* ---------- 5) التحليلات والرسوم البيانية (Chart.js المحلي) ---------- */
  function getAnalyticsRange() {
    var p = state.analytics.period;
    var today = S.todayStr();
    var start = today, end = today, prevStart = today, prevEnd = today;

    if (p === 'day') {
      start = today; end = today;
      prevStart = S.addDaysStr(today, -1); prevEnd = prevStart;
    } else if (p === 'week') {
      var wk = weekRangeFor(today);
      start = wk.start; end = wk.end;
      prevStart = S.addDaysStr(start, -7); prevEnd = S.addDaysStr(end, -7);
    } else if (p === 'month') {
      var m = state.month;
      start = m + '-01';
      end = m + '-' + (daysInMonth(m) < 10 ? '0' : '') + daysInMonth(m);
      var pm = prevMonthStr(m);
      prevStart = pm + '-01';
      prevEnd = pm + '-' + (daysInMonth(pm) < 10 ? '0' : '') + daysInMonth(pm);
    } else if (p === 'year') {
      var y = state.month.slice(0, 4);
      start = y + '-01-01'; end = y + '-12-31';
      var py = String(Number(y) - 1);
      prevStart = py + '-01-01'; prevEnd = py + '-12-31';
    } else {
      start = state.analytics.from || today;
      end = state.analytics.to || today;
      if (start > end) { var tmp = start; start = end; end = tmp; }
      var d1 = new Date(start + 'T00:00:00'), d2 = new Date(end + 'T00:00:00');
      var spanDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      prevEnd = S.addDaysStr(start, -1);
      prevStart = S.addDaysStr(prevEnd, -(spanDays - 1));
    }
    return { start: start, end: end, prevStart: prevStart, prevEnd: prevEnd };
  }

  function renderAnalyticsTab(sum) {
    var rng = getAnalyticsRange();
    var exps = state.data.expenses.filter(function (e) { return e.date >= rng.start && e.date <= rng.end; });
    var prevExps = state.data.expenses.filter(function (e) { return e.date >= rng.prevStart && e.date <= rng.prevEnd; });
    var tot = sumAmounts(exps);
    var prevTot = sumAmounts(prevExps);
    var chgPct = prevTot > 0 ? Math.round(((tot - prevTot) / prevTot) * 1000) / 10 : null;

    var catSums = {}, daySums = {};
    exps.forEach(function (e) {
      var cid = e.categoryId || 'other';
      catSums[cid] = S.roundMoney((catSums[cid] || 0) + (Number(e.amount) || 0));
      daySums[e.date] = S.roundMoney((daySums[e.date] || 0) + (Number(e.amount) || 0));
    });

    var topCat = Object.keys(catSums).sort(function (a, b) { return catSums[b] - catSums[a]; })[0];
    var topDays = Object.keys(daySums).sort(function (a, b) { return daySums[b] - daySums[a]; }).slice(0, 3);

    var h = '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.chart + ' خيارات الفترة التحليلية</h3></div>';
    h += '<div class="tl-chips" style="margin-bottom:10px">';
    [['day', 'يوم'], ['week', 'أسبوع'], ['month', 'شهر'], ['year', 'سنة'], ['custom', 'فترة مخصصة']].forEach(function (opt) {
      h += '<button type="button" class="tl-chip" data-an-period="' + opt[0] + '" aria-pressed="' + (state.analytics.period === opt[0] ? 'true' : 'false') + '">' + opt[1] + '</button>';
    });
    h += '</div>';

    if (state.analytics.period === 'custom') {
      h += '<div class="tl-row" style="margin-bottom:10px">' +
        '<div class="tl-fld"><label class="tl-lbl" for="bmAnFrom">من</label><input type="date" class="tl-in" id="bmAnFrom" value="' + esc(state.analytics.from) + '"></div>' +
        '<div class="tl-fld"><label class="tl-lbl" for="bmAnTo">إلى</label><input type="date" class="tl-in" id="bmAnTo" value="' + esc(state.analytics.to) + '"></div>' +
        '</div>';
    }
    h += '<div class="bm-sep-banner" style="margin-bottom:0"><span>الفترة: <b>' + esc(fmtDateAr(rng.start)) + ' — ' + esc(fmtDateAr(rng.end)) + '</b></span><span>الإجمالي: <b style="color:var(--bm-red)">' + fmtMoney(tot) + '</b></span></div>';
    h += '</div>';

    h += '<div class="bm-grid g3">';
    h += kpiCard('أكثر التصنيفات استهلاكاً', topCat ? getCategory(topCat).name : 'لا توجد بيانات', topCat ? (fmtMoney(catSums[topCat]) + ' (' + (tot > 0 ? Math.round((catSums[topCat] / tot) * 100) : 0) + '%)') : '—', 'orange', UI_ICONS.exp);
    h += kpiCard('اليوم الأكثر إنفاقاً', topDays.length ? fmtDateAr(topDays[0]) : 'لا توجد بيانات', topDays.length ? (fmtMoney(daySums[topDays[0]]) + (topDays[1] ? ' · يليه ' + fmtDateAr(topDays[1]) : '')) : '—', 'red', UI_ICONS.chart);
    h += kpiCard('التغير عن الفترة السابقة', chgPct !== null ? ((chgPct > 0 ? '+' : '') + chgPct + '%') : '—', 'السابقة: ' + fmtMoney(prevTot), chgPct !== null && chgPct > 0 ? 'red' : 'green', UI_ICONS.trend);
    h += '</div>';

    if (!root.Chart) {
      h += '<div class="bm-storage-err">تعذّر تحميل مكتبة الرسوم البيانية Chart.js المحلية.</div>';
      return h;
    }

    h += '<div class="bm-grid g2">';
    h += '<div class="bm-card"><div class="bm-card-h"><h3>توزيع المصروفات حسب التصنيف</h3></div><div class="bm-chart-box"><canvas id="bmChartCat"></canvas></div></div>';
    h += '<div class="bm-card"><div class="bm-card-h"><h3>مقارنة المصروفات الشهرية (آخر 6 أشهر)</h3></div><div class="bm-chart-box"><canvas id="bmChartMonthly"></canvas></div></div>';
    h += '<div class="bm-card"><div class="bm-card-h"><h3>تطور المصروفات اليومية</h3></div><div class="bm-chart-box"><canvas id="bmChartDaily"></canvas></div></div>';
    h += '<div class="bm-card"><div class="bm-card-h"><h3>مقارنة الميزانية بالمصروف الفعلي (' + esc(fmtMonthAr(sum.month)) + ')</h3></div><div class="bm-chart-box"><canvas id="bmChartBudget"></canvas></div></div>';
    h += '</div>';
    return h;
  }

  function renderAnalyticsCharts(sum) {
    if (!root.Chart) return;
    destroyCharts();
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var txtColor = light ? '#1B0E3A' : '#E9E2FF';
    var gridColor = light ? 'rgba(15,41,74,0.1)' : 'rgba(255,255,255,0.1)';
    var rng = getAnalyticsRange();
    var exps = state.data.expenses.filter(function (e) { return e.date >= rng.start && e.date <= rng.end; });

    // 1) مخطط دائري حسب التصنيف
    var c1 = document.getElementById('bmChartCat');
    if (c1) {
      var catMap = {};
      exps.forEach(function (e) { catMap[e.categoryId || 'other'] = (catMap[e.categoryId || 'other'] || 0) + e.amount; });
      var cids = Object.keys(catMap);
      state.charts.cat = new root.Chart(c1, {
        type: 'doughnut',
        data: {
          labels: cids.length ? cids.map(function (id) { return getCategory(id).name; }) : ['لا توجد مصروفات'],
          datasets: [{
            data: cids.length ? cids.map(function (id) { return S.roundMoney(catMap[id]); }) : [1],
            backgroundColor: cids.length ? cids.map(function (id) { return getCategory(id).color; }) : ['rgba(148,163,184,0.25)'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: txtColor, font: { family: 'Alexandria' } } }
          }
        }
      });
    }

    // 2) مخطط أعمدة مقارنة المصروفات الشهرية (آخر 6 أشهر)
    var c2 = document.getElementById('bmChartMonthly');
    if (c2) {
      var months = [], mCur = state.month;
      for (var i = 0; i < 6; i++) { months.unshift(mCur); mCur = prevMonthStr(mCur); }
      var mData = months.map(function (m) {
        return sumAmounts(state.data.expenses.filter(function (e) { return e.month === m; }));
      });
      state.charts.monthly = new root.Chart(c2, {
        type: 'bar',
        data: {
          labels: months.map(fmtMonthAr),
          datasets: [{
            label: 'المصروفات (دج)',
            data: mData,
            backgroundColor: '#1E3A5F',
            borderColor: '#38BDF8',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: txtColor, font: { family: 'Alexandria' } } } },
          scales: {
            x: { ticks: { color: txtColor }, grid: { color: gridColor } },
            y: { beginAtZero: true, ticks: { color: txtColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    // 3) مخطط خطي لتطور المصروفات اليومية
    var c3 = document.getElementById('bmChartDaily');
    if (c3) {
      var dayMap = {};
      exps.forEach(function (e) { dayMap[e.date] = S.roundMoney((dayMap[e.date] || 0) + e.amount); });
      var dKeys = Object.keys(dayMap).sort();
      // إن كانت الفترة شهراً أو أسبوعاً، نملأ الأيام المتسلسلة للرسم الخطي
      if (state.analytics.period === 'week' || state.analytics.period === 'month') {
        var seq = [], curD = rng.start, guard = 0;
        while (curD <= rng.end && guard++ < 35) { seq.push(curD); curD = S.addDaysStr(curD, 1); }
        dKeys = seq;
      }
      state.charts.daily = new root.Chart(c3, {
        type: 'line',
        data: {
          labels: dKeys.length ? dKeys.map(function (d) { return d.slice(5); }) : ['—'],
          datasets: [{
            label: 'الإنفاق اليومي (دج)',
            data: dKeys.length ? dKeys.map(function (d) { return dayMap[d] || 0; }) : [0],
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.18)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: txtColor, font: { family: 'Alexandria' } } } },
          scales: {
            x: { ticks: { color: txtColor }, grid: { color: gridColor } },
            y: { beginAtZero: true, ticks: { color: txtColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    // 4) مخطط مقارنة الميزانية بالمصروف الفعلي
    var c4 = document.getElementById('bmChartBudget');
    if (c4) {
      var cb = sum.budget.categoryBudgets || {};
      var bCats = state.data.categories.filter(function (c) { return (Number(cb[c.id]) || 0) > 0 || (sum.byCat[c.id] || 0) > 0; });
      var labels4, planned4, actual4;
      if (bCats.length) {
        labels4 = bCats.map(function (c) { return c.name; });
        planned4 = bCats.map(function (c) { return Number(cb[c.id]) || 0; });
        actual4 = bCats.map(function (c) { return sum.byCat[c.id] || 0; });
      } else {
        labels4 = ['الميزانية الشهرية'];
        planned4 = [sum.monthlyBudget];
        actual4 = [sum.monthExpenseTotal];
      }
      state.charts.budget = new root.Chart(c4, {
        type: 'bar',
        data: {
          labels: labels4,
          datasets: [
            { label: 'الميزانية المخططة', data: planned4, backgroundColor: '#10B981', borderRadius: 6 },
            { label: 'المصروف الفعلي', data: actual4, backgroundColor: '#EF4444', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: txtColor, font: { family: 'Alexandria' } } } },
          scales: {
            x: { ticks: { color: txtColor }, grid: { color: gridColor } },
            y: { beginAtZero: true, ticks: { color: txtColor }, grid: { color: gridColor } }
          }
        }
      });
    }
  }

  /* ---------- 6) نظام الادخار والأهداف المالية ---------- */
  function renderGoalsTab(sum) {
    var h = '<div class="bm-sep-banner">' +
      '<div><b>فصل الأرصدة لحماية الحسابات:</b><br>' +
      'إجمالي صافي الدخل والمصروفات: <b>' + fmtMoney(sum.netCashAllTime) + '</b> · ' +
      'المخصص لأهداف الادخار: <b style="color:var(--bm-green)">' + fmtMoney(sum.totalGoalsSaved) + '</b> · ' +
      'الرصيد الفعلي المتاح للإنفاق: <b style="color:var(--bm-blue)">' + fmtMoney(sum.actualAvailableCash) + '</b></div>' +
      '<button type="button" class="tl-btn sm pri" data-act="add-goal">' + UI_ICONS.plus + '<span>هدف ادخار جديد</span></button></div>';

    if (!state.data.goals.length) {
      h += '<div class="bm-card"><div class="bm-empty">لا توجد أهداف ادخار بعد (مثل: شراء حاسوب، هاتف، كتب دراسية). أضف هدفك الأول الآن.</div></div>';
      return h;
    }

    state.data.goals.forEach(function (g) {
      var pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 1000) / 10) : 0;
      var rem = Math.max(0, S.roundMoney(g.targetAmount - g.savedAmount));
      var done = g.savedAmount >= g.targetAmount;
      var histOpen = !!state.openGoalHist[g.id];

      h += '<div class="bm-goal">';
      h += '<div class="bm-goal-top"><div><h4>' + esc(g.name) + (done ? ' <span class="bm-badge ok">مكتمل ✓</span>' : '') + '</h4>' +
        (g.description ? '<div class="tl-hint" style="margin:0">' + esc(g.description) + '</div>' : '') +
        (g.targetDate ? '<div class="tl-hint" style="margin:0">التاريخ المستهدف: ' + esc(fmtDateAr(g.targetDate)) + '</div>' : '') +
        '</div><div class="bm-tx-acts">' +
        '<button type="button" class="bm-ibtn" data-edit-goal="' + esc(g.id) + '" aria-label="تعديل الهدف">' + UI_ICONS.edit + '</button>' +
        '<button type="button" class="bm-ibtn del" data-del-goal="' + esc(g.id) + '" aria-label="حذف الهدف">' + UI_ICONS.trash + '</button>' +
        '</div></div>';

      h += '<div class="bm-goal-nums">' +
        '<span>المدخر: <b style="color:var(--bm-green)">' + fmtMoney(g.savedAmount) + '</b></span>' +
        '<span>المستهدف: <b>' + fmtMoney(g.targetAmount) + '</b></span>' +
        '<span>المتبقي: <b style="color:var(--bm-orange)">' + fmtMoney(rem) + '</b></span>' +
        '<span>نسبة الإنجاز: <b>' + pct + '%</b></span></div>';

      h += '<div class="bm-pbar ' + (done ? 'ok' : (pct >= 70 ? 'ok' : 'warn')) + '"><i style="width:' + pct + '%"></i></div>';

      h += '<div class="tl-btns">' +
        '<button type="button" class="tl-btn sm pri" data-goal-op="deposit" data-goal-id="' + esc(g.id) + '">+ إضافة مبلغ</button>' +
        '<button type="button" class="tl-btn sm" data-goal-op="withdraw" data-goal-id="' + esc(g.id) + '"' + (g.savedAmount <= 0 ? ' disabled' : '') + '>- سحب مبلغ</button>' +
        '<button type="button" class="tl-btn sm" data-toggle-ghist="' + esc(g.id) + '">السجل (' + (g.history ? g.history.length : 0) + ')</button>' +
        '</div>';

      if (histOpen) {
        var hist = (g.history || []).slice().reverse();
        h += '<div class="bm-goal-hist">';
        if (!hist.length) {
          h += '<div class="tl-hint" style="margin:0">لا توجد حركات مسجلة لهذا الهدف بعد.</div>';
        } else {
          hist.forEach(function (item) {
            h += '<div class="bm-goal-hrow">' +
              '<span>' + (item.type === 'deposit' ? '<b style="color:var(--bm-green)">+ إيداع</b>' : '<b style="color:var(--bm-red)">- سحب</b>') +
              (item.note ? ' · ' + esc(item.note) : '') + '</span>' +
              '<span><b>' + fmtMoney(item.amount) + '</b> · ' + esc(fmtDateAr(item.date)) + '</span></div>';
          });
        }
        h += '</div>';
      }
      h += '</div>';
    });
    return h;
  }

  /* ---------- 7) التقارير والتصدير والنسخ الاحتياطي ---------- */
  function buildReportData() {
    var r = state.report;
    var exps = state.data.expenses;
    var incs = state.data.incomes;
    var title = '', rows = [], totalExp = 0, totalInc = 0;

    if (r.type === 'daily') {
      title = 'التقرير اليومي — ' + fmtDateAr(r.date);
      exps = exps.filter(function (e) { return e.date === r.date; });
      incs = incs.filter(function (i) { return i.date === r.date; });
    } else if (r.type === 'weekly') {
      var wk = weekRangeFor(r.date);
      title = 'التقرير الأسبوعي (' + fmtDateAr(wk.start) + ' إلى ' + fmtDateAr(wk.end) + ')';
      exps = exps.filter(function (e) { return e.date >= wk.start && e.date <= wk.end; });
      incs = incs.filter(function (i) { return i.date >= wk.start && i.date <= wk.end; });
    } else if (r.type === 'monthly') {
      title = 'التقرير الشهري — ' + fmtMonthAr(r.month);
      exps = exps.filter(function (e) { return e.month === r.month; });
      incs = incs.filter(function (i) { return i.month === r.month; });
    } else if (r.type === 'yearly') {
      title = 'التقرير السنوي — ' + r.year;
      exps = exps.filter(function (e) { return e.date.slice(0, 4) === r.year; });
      incs = incs.filter(function (i) { return i.date.slice(0, 4) === r.year; });
    } else if (r.type === 'category') {
      var cname = r.catId === 'all' ? 'جميع التصنيفات' : getCategory(r.catId).name;
      title = 'تقرير حسب التصنيف — ' + cname;
      if (r.catId !== 'all') exps = exps.filter(function (e) { return e.categoryId === r.catId; });
      incs = [];
    } else {
      title = 'تقرير الدخل والمصروفات الشامل';
    }

    exps.forEach(function (e) {
      totalExp += Number(e.amount) || 0;
      rows.push({ kind: 'مصروف', date: e.date, cat: getCategory(e.categoryId).name, amount: S.roundMoney(e.amount), pay: payLabel(e.paymentMethod), desc: e.description || '' });
    });
    incs.forEach(function (i) {
      totalInc += Number(i.amount) || 0;
      rows.push({ kind: 'دخل', date: i.date, cat: incSourceLabel(i.source), amount: S.roundMoney(i.amount), pay: '—', desc: i.description || '' });
    });
    rows.sort(function (a, b) { return b.date > a.date ? 1 : (b.date < a.date ? -1 : 0); });
    return {
      title: title,
      rows: rows,
      totalExp: S.roundMoney(totalExp),
      totalInc: S.roundMoney(totalInc),
      net: S.roundMoney(totalInc - totalExp)
    };
  }

  function renderReportsTab() {
    var r = state.report;
    var rep = buildReportData();

    var h = '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.rep + ' التقارير المالية</h3></div>';
    h += '<div class="tl-row" style="margin-bottom:12px">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRepType">نوع التقرير</label><select class="tl-sel" id="bmRepType">' +
      '<option value="daily"' + (r.type === 'daily' ? ' selected' : '') + '>تقرير يومي</option>' +
      '<option value="weekly"' + (r.type === 'weekly' ? ' selected' : '') + '>تقرير أسبوعي</option>' +
      '<option value="monthly"' + (r.type === 'monthly' ? ' selected' : '') + '>تقرير شهري</option>' +
      '<option value="yearly"' + (r.type === 'yearly' ? ' selected' : '') + '>تقرير سنوي</option>' +
      '<option value="category"' + (r.type === 'category' ? ' selected' : '') + '>تقرير حسب التصنيف</option>' +
      '<option value="income_expense"' + (r.type === 'income_expense' ? ' selected' : '') + '>تقرير الدخل والمصروفات</option>' +
      '</select></div>';

    if (r.type === 'daily' || r.type === 'weekly') {
      h += '<div class="tl-fld"><label class="tl-lbl" for="bmRepDate">' + (r.type === 'daily' ? 'اختر اليوم' : 'اختر يوماً من الأسبوع') + '</label><input type="date" class="tl-in" id="bmRepDate" value="' + esc(r.date) + '"></div>';
    } else if (r.type === 'monthly') {
      h += '<div class="tl-fld"><label class="tl-lbl" for="bmRepMonth">اختر الشهر</label><input type="month" class="tl-in" id="bmRepMonth" value="' + esc(r.month) + '"></div>';
    } else if (r.type === 'yearly') {
      h += '<div class="tl-fld"><label class="tl-lbl" for="bmRepYear">السنة</label><input type="number" class="tl-in num" id="bmRepYear" min="2000" max="2100" value="' + esc(r.year) + '"></div>';
    } else if (r.type === 'category') {
      h += '<div class="tl-fld"><label class="tl-lbl" for="bmRepCat">التصنيف</label><select class="tl-sel" id="bmRepCat"><option value="all">جميع التصنيفات</option>';
      state.data.categories.forEach(function (c) {
        h += '<option value="' + esc(c.id) + '"' + (r.catId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      });
      h += '</select></div>';
    }
    h += '</div>';

    h += '<div class="bm-calc-box" style="margin-bottom:12px">' +
      '<div class="bm-mini-stat"><span>إجمالي الدخل</span><b style="color:var(--bm-green)">' + fmtMoney(rep.totalInc) + '</b></div>' +
      '<div class="bm-mini-stat"><span>إجمالي المصروفات</span><b style="color:var(--bm-red)">' + fmtMoney(rep.totalExp) + '</b></div>' +
      '<div class="bm-mini-stat"><span>الصافي</span><b>' + fmtMoney(rep.net) + '</b></div>' +
      '<div class="bm-mini-stat"><span>عدد العمليات</span><b>' + rep.rows.length + '</b></div>' +
      '</div>';

    if (!rep.rows.length) {
      h += '<div class="bm-empty">لا توجد عمليات في هذا التقرير.</div>';
    } else {
      h += '<div class="bm-table-wrap"><table class="bm-table"><thead><tr><th>النوع</th><th>التاريخ</th><th>التصنيف / المصدر</th><th>المبلغ</th><th>طريقة الدفع</th><th>الوصف</th></tr></thead><tbody>';
      rep.rows.slice(0, 100).forEach(function (row) {
        h += '<tr><td>' + esc(row.kind) + '</td><td>' + esc(row.date) + '</td><td>' + esc(row.cat) + '</td>' +
          '<td style="font-weight:700;color:' + (row.kind === 'دخل' ? 'var(--bm-green)' : 'var(--bm-red)') + '">' + fmtMoney(row.amount) + '</td>' +
          '<td>' + esc(row.pay) + '</td><td>' + esc(row.desc) + '</td></tr>';
      });
      h += '</tbody></table></div>';
      if (rep.rows.length > 100) h += '<p class="tl-hint">يُعرض أول 100 سجل في المعاينة، ويُصدَّر الكل عند التحميل.</p>';
    }

    h += '<div class="tl-btns">' +
      '<button type="button" class="tl-btn pri" id="bmExportCsv">' + UI_ICONS.dl + '<span>تصدير CSV (Excel عربي)</span></button>' +
      '<button type="button" class="tl-btn" id="bmPrintReport">' + UI_ICONS.print + '<span>طباعة / PDF</span></button>' +
      '</div></div>';

    // النسخ الاحتياطي والاستعادة JSON
    h += '<div class="bm-card"><div class="bm-card-h"><h3>' + UI_ICONS.dl + ' النسخ الاحتياطي والاستعادة (JSON)</h3></div>';
    h += '<p class="tl-hint" style="margin-top:0">بياناتك محفوظة محلياً في IndexedDB على جهازك فقط. يمكنك تصدير نسخة احتياطية كاملة أو استعادتها لاحقاً مع التحقق من سلامة البيانات ومنع التكرار.</p>';
    h += '<div class="tl-btns">' +
      '<button type="button" class="tl-btn pri" id="bmExportJson">' + UI_ICONS.dl + '<span>تصدير نسخة احتياطية JSON</span></button>' +
      '<label class="tl-btn" style="cursor:pointer">' + UI_ICONS.ul + '<span>استيراد نسخة احتياطية JSON</span><input type="file" id="bmImportJson" accept=".json,application/json" hidden></label>' +
      '</div></div>';
    return h;
  }

  /* ---------- النوافذ المنبثقة (إضافة / تعديل / تأكيد) ---------- */
  function showExpenseModal(existing) {
    var ex = existing || { id: '', amount: '', categoryId: (state.data.categories[0] && state.data.categories[0].id) || 'food', description: '', date: S.todayStr(), paymentMethod: 'cash' };
    var catOpts = state.data.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (ex.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var payOpts = S.PAYMENT_METHODS.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (ex.paymentMethod === p.id ? ' selected' : '') + '>' + esc(p.label) + '</option>';
    }).join('');

    openModal(
      '<h3>' + (existing ? 'تعديل مصروف' : 'إضافة مصروف جديد') + '</h3>' +
      '<form id="bmExpForm" class="bm-form-grid">' +
      '<input type="hidden" name="itemId" value="' + esc(ex.id) + '">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExAmt">المبلغ (دج) *</label><input class="tl-in num" id="bmExAmt" name="amount" inputmode="decimal" required placeholder="مثال: 500" value="' + esc(ex.amount) + '"></div>' +
      '<div class="bm-form-grid two">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExCat">التصنيف *</label><select class="tl-sel" id="bmExCat" name="categoryId">' + catOpts + '</select></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExPay">طريقة الدفع *</label><select class="tl-sel" id="bmExPay" name="paymentMethod">' + payOpts + '</select></div>' +
      '</div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExDate">التاريخ *</label><input type="date" class="tl-in" id="bmExDate" name="date" required value="' + esc(ex.date) + '"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmExDesc">وصف (اختياري)</label><input type="text" class="tl-in" id="bmExDesc" name="description" maxlength="140" placeholder="مثال: غداء في المطعم الجامعي" value="' + esc(ex.description) + '"></div>' +
      '<div class="tl-btns"><button type="submit" class="tl-btn pri">حفظ المصروف</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>' +
      '</form>'
    );
  }

  function showIncomeModal(existing) {
    var inc = existing || { id: '', amount: '', source: 'scholarship', date: S.todayStr(), description: '' };
    var srcOpts = S.INCOME_SOURCES.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (inc.source === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');

    openModal(
      '<h3>' + (existing ? 'تعديل دخل' : 'إضافة دخل جديد') + '</h3>' +
      '<form id="bmIncForm" class="bm-form-grid">' +
      '<input type="hidden" name="itemId" value="' + esc(inc.id) + '">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmInAmt">المبلغ (دج) *</label><input class="tl-in num" id="bmInAmt" name="amount" inputmode="decimal" required placeholder="مثال: 6000" value="' + esc(inc.amount) + '"></div>' +
      '<div class="bm-form-grid two">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmInSrc">المصدر *</label><select class="tl-sel" id="bmInSrc" name="source">' + srcOpts + '</select></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmInDate">التاريخ *</label><input type="date" class="tl-in" id="bmInDate" name="date" required value="' + esc(inc.date) + '"></div>' +
      '</div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmInDesc">وصف (اختياري)</label><input type="text" class="tl-in" id="bmInDesc" name="description" maxlength="140" placeholder="تفاصيل إضافية" value="' + esc(inc.description) + '"></div>' +
      '<div class="tl-btns"><button type="submit" class="tl-btn pri">حفظ الدخل</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>' +
      '</form>'
    );
  }

  function showCategoriesModal(editCat) {
    var editing = editCat || { id: '', name: '', icon: 'tag', color: CAT_COLORS[0] };
    var h = '<h3>إدارة التصنيفات</h3>';
    h += '<form id="bmCatForm" class="bm-form-grid" style="margin-bottom:14px">' +
      '<input type="hidden" name="itemId" value="' + esc(editing.id) + '">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmCatName">' + (editing.id ? 'تعديل اسم التصنيف' : 'اسم التصنيف الجديد') + '</label>' +
      '<input class="tl-in" id="bmCatName" name="name" maxlength="40" required placeholder="مثال: مستلزمات رياضية" value="' + esc(editing.name) + '"></div>' +
      '<div><span class="tl-lbl">الأيقونة</span><div class="bm-icon-picker">';
    Object.keys(CAT_ICONS).forEach(function (ik) {
      h += '<button type="button" class="bm-ipick' + (editing.icon === ik ? ' on' : '') + '" data-pick-icon="' + ik + '">' + CAT_ICONS[ik] + '</button>';
    });
    h += '</div><input type="hidden" name="icon" id="bmCatIconVal" value="' + esc(editing.icon) + '"></div>';

    h += '<div><span class="tl-lbl">اللون</span><div class="bm-color-picker">';
    CAT_COLORS.forEach(function (col) {
      h += '<button type="button" class="bm-cpick' + (editing.color === col ? ' on' : '') + '" style="background:' + col + '" data-pick-color="' + col + '" aria-label="لون"></button>';
    });
    h += '</div><input type="hidden" name="color" id="bmCatColorVal" value="' + esc(editing.color) + '"></div>';

    h += '<div class="tl-btns"><button type="submit" class="tl-btn pri">' + (editing.id ? 'تحديث التصنيف' : 'إضافة التصنيف') + '</button>' +
      (editing.id ? '<button type="button" class="tl-btn" id="bmCatResetEdit">تصنيف جديد</button>' : '') +
      '<button type="button" class="tl-btn" data-close-modal>إغلاق</button></div></form>';

    h += '<div class="bm-cat-grid">';
    state.data.categories.forEach(function (c) {
      h += '<div class="bm-cat-pill"><div class="bm-cat-info"><span class="bm-cat-dot" style="background:' + esc(c.color) + '">' + catIconHtml(c) + '</span><span>' + esc(c.name) + '</span></div>' +
        '<div class="bm-tx-acts"><button type="button" class="bm-ibtn" data-edit-cat="' + esc(c.id) + '" aria-label="تعديل">' + UI_ICONS.edit + '</button>' +
        (c.id !== 'other' ? '<button type="button" class="bm-ibtn del" data-del-cat="' + esc(c.id) + '" aria-label="حذف">' + UI_ICONS.trash + '</button>' : '') +
        '</div></div>';
    });
    h += '</div>';
    openModal(h);
  }

  function showRecurringModal(existing) {
    var r = existing || { id: '', title: '', amount: '', categoryId: 'housing', paymentMethod: 'cash', frequency: 'monthly', startDate: S.todayStr(), active: true, note: '' };
    var catOpts = state.data.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (r.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var payOpts = S.PAYMENT_METHODS.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (r.paymentMethod === p.id ? ' selected' : '') + '>' + esc(p.label) + '</option>';
    }).join('');

    openModal(
      '<h3>' + (existing ? 'تعديل مصروف متكرر' : 'إضافة مصروف متكرر') + '</h3>' +
      '<form id="bmRecForm" class="bm-form-grid">' +
      '<input type="hidden" name="itemId" value="' + esc(r.id) + '">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecTitle">عنوان المصروف المتكرر *</label><input class="tl-in" id="bmRecTitle" name="title" required maxlength="80" placeholder="مثال: اشتراك الإنترنت" value="' + esc(r.title) + '"></div>' +
      '<div class="bm-form-grid two">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecAmt">المبلغ (دج) *</label><input class="tl-in num" id="bmRecAmt" name="amount" inputmode="decimal" required value="' + esc(r.amount) + '"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecFreq">التكرار *</label><select class="tl-sel" id="bmRecFreq" name="frequency">' +
      '<option value="daily"' + (r.frequency === 'daily' ? ' selected' : '') + '>يومي</option>' +
      '<option value="weekly"' + (r.frequency === 'weekly' ? ' selected' : '') + '>أسبوعي</option>' +
      '<option value="monthly"' + (r.frequency === 'monthly' ? ' selected' : '') + '>شهري</option></select></div>' +
      '</div>' +
      '<div class="bm-form-grid two">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecCat">التصنيف *</label><select class="tl-sel" id="bmRecCat" name="categoryId">' + catOpts + '</select></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecPay">طريقة الدفع *</label><select class="tl-sel" id="bmRecPay" name="paymentMethod">' + payOpts + '</select></div>' +
      '</div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecStart">تاريخ البدء *</label><input type="date" class="tl-in" id="bmRecStart" name="startDate" required value="' + esc(r.startDate) + '"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmRecNote">ملاحظة (اختياري)</label><input class="tl-in" id="bmRecNote" name="note" maxlength="100" value="' + esc(r.note) + '"></div>' +
      '<div class="tl-btns"><button type="submit" class="tl-btn pri">حفظ المصروف المتكرر</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>' +
      '</form>'
    );
  }

  function showGoalModal(existing) {
    var g = existing || { id: '', name: '', targetAmount: '', savedAmount: '0', targetDate: '', description: '' };
    openModal(
      '<h3>' + (existing ? 'تعديل هدف ادخار' : 'إنشاء هدف ادخار جديد') + '</h3>' +
      '<form id="bmGoalForm" class="bm-form-grid">' +
      '<input type="hidden" name="itemId" value="' + esc(g.id) + '">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmGlName">اسم الهدف *</label><input class="tl-in" id="bmGlName" name="name" required maxlength="80" placeholder="مثال: شراء حاسوب محمول" value="' + esc(g.name) + '"></div>' +
      '<div class="bm-form-grid two">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmGlTarget">المبلغ المستهدف (دج) *</label><input class="tl-in num" id="bmGlTarget" name="targetAmount" inputmode="decimal" required value="' + esc(g.targetAmount) + '"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmGlSaved">المبلغ المدخر حالياً (دج)</label><input class="tl-in num" id="bmGlSaved" name="savedAmount" inputmode="decimal" value="' + esc(g.savedAmount) + '"' + (existing ? ' readonly' : '') + '></div>' +
      '</div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmGlDate">التاريخ المستهدف (اختياري)</label><input type="date" class="tl-in" id="bmGlDate" name="targetDate" value="' + esc(g.targetDate || '') + '"></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmGlDesc">وصف (اختياري)</label><input class="tl-in" id="bmGlDesc" name="description" maxlength="140" value="' + esc(g.description || '') + '"></div>' +
      '<div class="tl-btns"><button type="submit" class="tl-btn pri">حفظ الهدف</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>' +
      '</form>'
    );
  }

  function showGoalOpModal(goal, op) {
    openModal(
      '<h3>' + (op === 'deposit' ? 'إضافة مبلغ إلى «' + esc(goal.name) + '»' : 'سحب مبلغ من «' + esc(goal.name) + '»') + '</h3>' +
      '<p class="tl-hint">المدخر حالياً في هذا الهدف: <b>' + fmtMoney(goal.savedAmount) + '</b></p>' +
      '<form id="bmGoalOpForm" class="bm-form-grid">' +
      '<input type="hidden" name="itemId" value="' + esc(goal.id) + '">' +
      '<input type="hidden" name="op" value="' + esc(op) + '">' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmOpAmt">المبلغ (دج) *</label><input class="tl-in num" id="bmOpAmt" name="amount" inputmode="decimal" required></div>' +
      '<div class="tl-fld"><label class="tl-lbl" for="bmOpNote">ملاحظة (اختياري)</label><input class="tl-in" id="bmOpNote" name="note" maxlength="100"></div>' +
      '<div class="tl-btns"><button type="submit" class="tl-btn pri">' + (op === 'deposit' ? 'تأكيد الإضافة' : 'تأكيد السحب') + '</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>' +
      '</form>'
    );
  }

  function showAlertsModal(alerts) {
    var h = '<h3>التنبيهات المالية (' + alerts.length + ')</h3>';
    if (!alerts.length) {
      h += '<div class="bm-empty">لا توجد تنبيهات نشطة حالياً.</div>';
    } else {
      h += '<div class="bm-alerts">';
      alerts.forEach(function (al) {
        h += '<div class="bm-alert ' + al.tone + '"><div class="bm-alert-body"><span class="bm-alert-ic">' + UI_ICONS.warn + '</span><span>' + esc(al.text) + '</span></div></div>';
      });
      h += '</div>';
    }
    h += '<div class="tl-btns"><button type="button" class="tl-btn" id="bmRestoreAlerts">إظهار كل التنبيهات المخفية</button><button type="button" class="tl-btn pri" data-close-modal>إغلاق</button></div>';
    openModal(h);
  }

  function showImportConfirmModal(normalized) {
    openModal(
      '<h3>استيراد نسخة احتياطية</h3>' +
      '<p class="tl-hint">تم التحقق من صحة الملف بنجاح. يحتوي الملف على:</p>' +
      '<div class="bm-calc-box" style="margin:10px 0">' +
      '<div class="bm-mini-stat"><span>المصروفات</span><b>' + normalized.expenses.length + '</b></div>' +
      '<div class="bm-mini-stat"><span>الدخل</span><b>' + normalized.incomes.length + '</b></div>' +
      '<div class="bm-mini-stat"><span>الميزانيات</span><b>' + normalized.budgets.length + '</b></div>' +
      '<div class="bm-mini-stat"><span>أهداف الادخار</span><b>' + normalized.goals.length + '</b></div>' +
      '<div class="bm-mini-stat"><span>المتكررة</span><b>' + normalized.recurring.length + '</b></div>' +
      '<div class="bm-mini-stat"><span>التصنيفات</span><b>' + normalized.categories.length + '</b></div>' +
      '</div>' +
      '<div class="bm-alert warn" style="margin-bottom:10px"><div class="bm-alert-body"><span class="bm-alert-ic">' + UI_ICONS.warn + '</span>' +
      '<span>اختر «دمج ذكي» لإضافة العناصر الجديدة ومنع تكرار المسجلة مسبقاً، أو فعّل خيار الاستبدال الكامل مع التأكيد.</span></div></div>' +
      '<label class="tl-sound" style="margin-bottom:10px"><input type="checkbox" class="tl-chk" id="bmConfirmReplace"><span>أؤكد رغبتي في مسح البيانات الحالية واستبدالها عند اختيار «استبدال كامل»</span></label>' +
      '<div class="tl-btns">' +
      '<button type="button" class="tl-btn pri" id="bmDoMerge">دمج ذكي (منع التكرار)</button>' +
      '<button type="button" class="tl-btn del" id="bmDoReplace">استبدال كامل</button>' +
      '<button type="button" class="tl-btn" data-close-modal>إلغاء</button>' +
      '</div>'
    );
    modalEl._pendingImport = normalized;
  }

  /* ---------- التصدير CSV و JSON والطباعة ---------- */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  function exportCsv() {
    var rep = buildReportData();
    var csvCell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [['النوع', 'التاريخ', 'التصنيف أو المصدر', 'المبلغ (دج)', 'طريقة الدفع', 'الوصف'].map(csvCell).join(',')];
    rep.rows.forEach(function (row) {
      lines.push([row.kind, row.date, row.cat, row.amount, row.pay, row.desc].map(csvCell).join(','));
    });
    // BOM UTF-8 لضمان فتح العربية بشكل سليم في Excel
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'budget-report-' + S.todayStr() + '.csv');
    toast('تم تصدير ملف CSV بنجاح');
  }

  function printReport() {
    var rep = buildReportData();
    var html = '<h1>' + esc(rep.title) + '</h1>' +
      '<p class="pm">إجمالي الدخل: ' + fmtMoney(rep.totalInc) + ' | إجمالي المصروفات: ' + fmtMoney(rep.totalExp) + ' | الصافي: ' + fmtMoney(rep.net) + '</p>' +
      '<table><thead><tr><th>النوع</th><th>التاريخ</th><th>التصنيف / المصدر</th><th>المبلغ</th><th>طريقة الدفع</th><th>الوصف</th></tr></thead><tbody>';
    rep.rows.forEach(function (row) {
      html += '<tr><td>' + esc(row.kind) + '</td><td>' + esc(row.date) + '</td><td>' + esc(row.cat) + '</td><td>' + fmtMoney(row.amount) + '</td><td>' + esc(row.pay) + '</td><td>' + esc(row.desc) + '</td></tr>';
    });
    html += '</tbody></table>';

    var old = document.getElementById('bmPrintFrame'); if (old) old.remove();
    var f = document.createElement('iframe');
    f.id = 'bmPrintFrame';
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(f);
    var d = f.contentDocument || f.contentWindow.document;
    d.open();
    d.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(rep.title) + '</title>' +
      '<style>@page{size:A4;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#000}h1{font-size:18px;margin:0 0 6px}.pm{font-size:13px;color:#333;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{border:1px solid #888;padding:5px 7px;text-align:right}th{background:#eee}</style>' +
      '</head><body>' + html + '</body></html>');
    d.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('تعذّرت الطباعة في هذا المتصفح'); }
    }, 200);
  }

  /* ---------- ربط الأحداث ---------- */
  function bindEvents() {
    state.root.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) { state.tab = tabBtn.dataset.tab; render(); return; }

      var jumpBtn = e.target.closest('[data-jump]');
      if (jumpBtn) { state.tab = jumpBtn.dataset.jump; render(); return; }

      var actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        var act = actBtn.dataset.act;
        if (act === 'add-exp') showExpenseModal(null);
        else if (act === 'add-inc') showIncomeModal(null);
        else if (act === 'manage-cats') showCategoriesModal(null);
        else if (act === 'add-rec') showRecurringModal(null);
        else if (act === 'add-goal') showGoalModal(null);
        else if (act === 'show-alerts') showAlertsModal(computeAlerts(computeSummary(state.month)));
        return;
      }

      var dis = e.target.closest('[data-dismiss-alert]');
      if (dis) {
        state.data.dismissedAlerts[dis.dataset.dismissAlert] = true;
        S.setMeta('dismissed_alerts', state.data.dismissedAlerts).then(render);
        return;
      }

      var edExp = e.target.closest('[data-edit-exp]');
      if (edExp) {
        var foundEx = state.data.expenses.filter(function (x) { return x.id === edExp.dataset.editExp; })[0];
        if (foundEx) showExpenseModal(foundEx);
        return;
      }

      var delExp = e.target.closest('[data-del-exp]');
      if (delExp) {
        var idEx = delExp.dataset.delExp;
        openModal('<h3>حذف المصروف</h3><p class="tl-hint">هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن الحذف.</p>' +
          '<div class="tl-btns"><button type="button" class="tl-btn del" data-confirm-del-exp="' + esc(idEx) + '">حذف</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>');
        return;
      }

      var edInc = e.target.closest('[data-edit-inc]');
      if (edInc) {
        var foundInc = state.data.incomes.filter(function (x) { return x.id === edInc.dataset.editInc; })[0];
        if (foundInc) showIncomeModal(foundInc);
        return;
      }

      var delInc = e.target.closest('[data-del-inc]');
      if (delInc) {
        var idInc = delInc.dataset.delInc;
        openModal('<h3>حذف الدخل</h3><p class="tl-hint">هل أنت متأكد من حذف هذه العملية؟</p>' +
          '<div class="tl-btns"><button type="button" class="tl-btn del" data-confirm-del-inc="' + esc(idInc) + '">حذف</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>');
        return;
      }

      var togRec = e.target.closest('[data-toggle-rec]');
      if (togRec) {
        var rec = state.data.recurring.filter(function (x) { return x.id === togRec.dataset.toggleRec; })[0];
        if (rec) {
          rec.active = !rec.active;
          rec.updatedAt = Date.now();
          S.putRecurring(rec).then(function () { return S.processRecurring(); }).then(reloadAndRender).then(function () {
            toast(rec.active ? 'تم تفعيل المصروف المتكرر' : 'تم إيقاف المصروف المتكرر');
          });
        }
        return;
      }

      var edRec = e.target.closest('[data-edit-rec]');
      if (edRec) {
        var recE = state.data.recurring.filter(function (x) { return x.id === edRec.dataset.editRec; })[0];
        if (recE) showRecurringModal(recE);
        return;
      }

      var delRec = e.target.closest('[data-del-rec]');
      if (delRec) {
        var idRec = delRec.dataset.delRec;
        openModal('<h3>حذف المصروف المتكرر</h3><p class="tl-hint">سيتم حذف قاعدة التكرار ولن تُسجل مصروفات مستقبلية جديدة منها.</p>' +
          '<div class="tl-btns"><button type="button" class="tl-btn del" data-confirm-del-rec="' + esc(idRec) + '">حذف</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>');
        return;
      }

      var gOpBtn = e.target.closest('[data-goal-op]');
      if (gOpBtn) {
        var goal = state.data.goals.filter(function (x) { return x.id === gOpBtn.dataset.goalId; })[0];
        if (goal) showGoalOpModal(goal, gOpBtn.dataset.goalOp);
        return;
      }

      var togHist = e.target.closest('[data-toggle-ghist]');
      if (togHist) {
        var gid = togHist.dataset.toggleGhist;
        state.openGoalHist[gid] = !state.openGoalHist[gid];
        render();
        return;
      }

      var edGoal = e.target.closest('[data-edit-goal]');
      if (edGoal) {
        var gE = state.data.goals.filter(function (x) { return x.id === edGoal.dataset.editGoal; })[0];
        if (gE) showGoalModal(gE);
        return;
      }

      var delGoal = e.target.closest('[data-del-goal]');
      if (delGoal) {
        var idG = delGoal.dataset.delGoal;
        openModal('<h3>حذف هدف الادخار</h3><p class="tl-hint">سيعود المبلغ المخصص لهذا الهدف إلى رصيدك الفعلي المتاح. هل تريد المتابعة؟</p>' +
          '<div class="tl-btns"><button type="button" class="tl-btn del" data-confirm-del-goal="' + esc(idG) + '">حذف</button><button type="button" class="tl-btn" data-close-modal>إلغاء</button></div>');
        return;
      }

      var anPer = e.target.closest('[data-an-period]');
      if (anPer) { state.analytics.period = anPer.dataset.anPeriod; render(); return; }

      if (e.target.id === 'bmExpMonthFilter') {
        state.expFilter.from = state.month + '-01';
        state.expFilter.to = state.month + '-' + (daysInMonth(state.month) < 10 ? '0' : '') + daysInMonth(state.month);
        render(); return;
      }
      if (e.target.id === 'bmExpResetFilter') {
        state.expFilter.from = ''; state.expFilter.to = ''; state.expFilter.cat = 'all'; state.expFilter.pay = 'all'; state.expFilter.q = '';
        render(); return;
      }
      if (e.target.id === 'bmCopyPrevBudget') {
        var prevB = state.data.budgets[prevMonthStr(state.month)];
        if (!prevB) { toast('لا توجد ميزانية مسجلة للشهر السابق'); return; }
        var copyB = JSON.parse(JSON.stringify(prevB));
        copyB.month = state.month; copyB.updatedAt = Date.now();
        S.putBudget(copyB).then(reloadAndRender).then(function () { toast('تم نسخ ميزانية الشهر السابق'); });
        return;
      }
      if (e.target.closest('#bmExportCsv')) { exportCsv(); return; }
      if (e.target.closest('#bmPrintReport')) { printReport(); return; }
      if (e.target.closest('#bmExportJson')) {
        S.exportBackup().then(function (bk) {
          var blob = new Blob([JSON.stringify(bk, null, 2)], { type: 'application/json;charset=utf-8' });
          downloadBlob(blob, 'eps-budget-backup-' + S.todayStr() + '.json');
          toast('تم تصدير النسخة الاحتياطية بنجاح');
        });
        return;
      }
    });

    state.root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'bmMonthPick' && S.isValidMonth(t.value)) { state.month = t.value; render(); }
      else if (t.id === 'bmExpCat') { state.expFilter.cat = t.value; render(); }
      else if (t.id === 'bmExpPay') { state.expFilter.pay = t.value; render(); }
      else if (t.id === 'bmExpSort') { state.expFilter.sort = t.value; render(); }
      else if (t.id === 'bmExpFrom') { state.expFilter.from = t.value; render(); }
      else if (t.id === 'bmExpTo') { state.expFilter.to = t.value; render(); }
      else if (t.id === 'bmIncScope') { state.incFilter.scope = t.value; render(); }
      else if (t.id === 'bmIncSrc') { state.incFilter.source = t.value; render(); }
      else if (t.id === 'bmAnFrom') { state.analytics.from = t.value; render(); }
      else if (t.id === 'bmAnTo') { state.analytics.to = t.value; render(); }
      else if (t.id === 'bmRepType') { state.report.type = t.value; render(); }
      else if (t.id === 'bmRepDate') { state.report.date = t.value; render(); }
      else if (t.id === 'bmRepMonth') { state.report.month = t.value; render(); }
      else if (t.id === 'bmRepYear') { state.report.year = t.value; render(); }
      else if (t.id === 'bmRepCat') { state.report.catId = t.value; render(); }
      else if (t.id === 'bmImportJson' && t.files && t.files[0]) {
        var file = t.files[0];
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = JSON.parse(String(reader.result || ''));
            var check = S.validateBackup(parsed);
            if (!check.ok) { toast(check.error, 4000); return; }
            showImportConfirmModal(check.normalized);
          } catch (err) {
            toast('ملف JSON غير صالح أو تالف', 3500);
          }
        };
        reader.readAsText(file, 'utf-8');
        t.value = '';
      }
    });

    state.root.addEventListener('input', function (e) {
      if (e.target.id === 'bmExpSearch') {
        state.expFilter.q = e.target.value;
        var pos = e.target.selectionStart;
        render();
        var el = document.getElementById('bmExpSearch');
        if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) {} }
      }
    });

    state.root.addEventListener('submit', function (e) {
      if (e.target.getAttribute('id') === 'bmBudgetForm') {
        e.preventDefault();
        var mVal = parseNum((document.getElementById('bmBMonthly') || {}).value) || 0;
        var wVal = parseNum((document.getElementById('bmBWeekly') || {}).value) || 0;
        var dVal = parseNum((document.getElementById('bmBDaily') || {}).value) || 0;
        var sVal = parseNum((document.getElementById('bmBSave') || {}).value) || 0;
        if (mVal < 0 || wVal < 0 || dVal < 0 || sVal < 0) { toast('القيم المالية لا يمكن أن تكون سالبة'); return; }
        var catBuds = {};
        Array.prototype.slice.call(state.root.querySelectorAll('[data-cat-budget]')).forEach(function (inp) {
          var v = parseNum(inp.value);
          if (v > 0) catBuds[inp.dataset.catBudget] = S.roundMoney(v);
        });
        S.putBudget({
          month: state.month,
          monthlyBudget: S.roundMoney(mVal),
          weeklyBudget: S.roundMoney(wVal),
          dailyCap: S.roundMoney(dVal),
          savingsAllocation: S.roundMoney(sVal),
          categoryBudgets: catBuds,
          updatedAt: Date.now()
        }).then(reloadAndRender).then(function () {
          toast('تم حفظ الميزانية والتعديلات');
        }).catch(function (err) { toast(err.message); });
      }
    });

    // أحداث النوافذ المنبثقة
    modalEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-modal]')) { closeModal(); return; }

      var pickIc = e.target.closest('[data-pick-icon]');
      if (pickIc) {
        Array.prototype.slice.call(modalEl.querySelectorAll('[data-pick-icon]')).forEach(function (b) { b.classList.remove('on'); });
        pickIc.classList.add('on');
        document.getElementById('bmCatIconVal').value = pickIc.dataset.pickIcon;
        return;
      }
      var pickCol = e.target.closest('[data-pick-color]');
      if (pickCol) {
        Array.prototype.slice.call(modalEl.querySelectorAll('[data-pick-color]')).forEach(function (b) { b.classList.remove('on'); });
        pickCol.classList.add('on');
        document.getElementById('bmCatColorVal').value = pickCol.dataset.pickColor;
        return;
      }
      if (e.target.id === 'bmCatResetEdit') { showCategoriesModal(null); return; }

      var edCat = e.target.closest('[data-edit-cat]');
      if (edCat) {
        var cFound = state.data.categories.filter(function (c) { return c.id === edCat.dataset.editCat; })[0];
        if (cFound) showCategoriesModal(cFound);
        return;
      }
      var delCat = e.target.closest('[data-del-cat]');
      if (delCat) {
        S.deleteCategory(delCat.dataset.delCat).then(reloadAndRender).then(function () {
          showCategoriesModal(null);
          toast('تم حذف التصنيف ونقل مصروفاته إلى «مصاريف أخرى»');
        }).catch(function (err) { toast(err.message); });
        return;
      }

      var cExp = e.target.closest('[data-confirm-del-exp]');
      if (cExp) {
        S.deleteExpense(cExp.dataset.confirmDelExp).then(function () { closeModal(); return reloadAndRender(); }).then(function () { toast('تم حذف المصروف'); });
        return;
      }
      var cInc = e.target.closest('[data-confirm-del-inc]');
      if (cInc) {
        S.deleteIncome(cInc.dataset.confirmDelInc).then(function () { closeModal(); return reloadAndRender(); }).then(function () { toast('تم حذف الدخل'); });
        return;
      }
      var cRec = e.target.closest('[data-confirm-del-rec]');
      if (cRec) {
        S.deleteRecurring(cRec.dataset.confirmDelRec).then(function () { closeModal(); return reloadAndRender(); }).then(function () { toast('تم حذف المصروف المتكرر'); });
        return;
      }
      var cGoal = e.target.closest('[data-confirm-del-goal]');
      if (cGoal) {
        S.deleteGoal(cGoal.dataset.confirmDelGoal).then(function () { closeModal(); return reloadAndRender(); }).then(function () { toast('تم حذف الهدف'); });
        return;
      }

      if (e.target.id === 'bmRestoreAlerts') {
        state.data.dismissedAlerts = {};
        S.setMeta('dismissed_alerts', {}).then(function () { closeModal(); render(); toast('تمت استعادة التنبيهات'); });
        return;
      }

      if (e.target.id === 'bmDoMerge' || e.target.id === 'bmDoReplace') {
        var mode = e.target.id === 'bmDoReplace' ? 'replace' : 'merge';
        if (mode === 'replace') {
          var chk = document.getElementById('bmConfirmReplace');
          if (!chk || !chk.checked) { toast('فعّل مربع التأكيد أولاً للاستبدال الكامل', 3000); return; }
        }
        S.importBackup(modalEl._pendingImport, mode).then(function (stats) {
          closeModal();
          return reloadAndRender().then(function () {
            toast('تم الاستيراد: أُضيف ' + stats.added + ' وتُجاهل ' + stats.skipped + ' عنصر مكرر');
          });
        }).catch(function (err) { toast(err.message); });
      }
    });

    modalEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var fid = f.getAttribute('id');
      var recId = (f.elements && f.elements.itemId && f.elements.itemId.value) || '';
      if (fid === 'bmExpForm') {
        var amt = parseNum(f.amount.value);
        var date = f.date.value;
        if (!(amt > 0)) { toast('أدخل مبلغاً أكبر من 0'); return; }
        if (!S.isValidDate(date)) { toast('اختر تاريخاً صحيحاً'); return; }
        var existEx = recId ? state.data.expenses.filter(function (x) { return x.id === recId; })[0] : null;
        var item = {
          id: recId || S.uid('exp'),
          amount: S.roundMoney(amt),
          categoryId: f.categoryId.value || 'other',
          paymentMethod: f.paymentMethod.value || 'cash',
          date: date,
          month: date.slice(0, 7),
          description: (f.description.value || '').trim(),
          recurringId: existEx ? existEx.recurringId : undefined,
          recurringKey: existEx ? existEx.recurringKey : undefined,
          createdAt: existEx ? existEx.createdAt : Date.now(),
          updatedAt: Date.now()
        };
        S.putExpense(item).then(function () {
          state.month = item.month;
          closeModal();
          return reloadAndRender();
        }).then(function () { toast(existEx ? 'تم تعديل المصروف' : 'تمت إضافة المصروف'); }).catch(function (err) { toast(err.message); });
      } else if (fid === 'bmIncForm') {
        var iAmt = parseNum(f.amount.value);
        var iDate = f.date.value;
        if (!(iAmt > 0)) { toast('أدخل مبلغاً أكبر من 0'); return; }
        if (!S.isValidDate(iDate)) { toast('اختر تاريخاً صحيحاً'); return; }
        var existInc = recId ? state.data.incomes.filter(function (x) { return x.id === recId; })[0] : null;
        var incItem = {
          id: recId || S.uid('inc'),
          amount: S.roundMoney(iAmt),
          source: f.source.value || 'other',
          date: iDate,
          month: iDate.slice(0, 7),
          description: (f.description.value || '').trim(),
          createdAt: existInc ? existInc.createdAt : Date.now(),
          updatedAt: Date.now()
        };
        S.putIncome(incItem).then(function () {
          state.month = incItem.month;
          closeModal();
          return reloadAndRender();
        }).then(function () { toast(existInc ? 'تم تعديل الدخل' : 'تمت إضافة الدخل'); }).catch(function (err) { toast(err.message); });
      } else if (fid === 'bmCatForm') {
        var cname = (f.name.value || '').trim();
        if (!cname) { toast('اكتب اسم التصنيف'); return; }
        var cid = recId || S.uid('cat');
        var existCat = state.data.categories.filter(function (x) { return x.id === cid; })[0];
        S.putCategory({
          id: cid,
          name: cname,
          icon: f.icon.value || 'tag',
          color: f.color.value || '#0F294A',
          isDefault: existCat ? !!existCat.isDefault : false,
          order: existCat ? existCat.order : (state.data.categories.length + 1)
        }).then(reloadAndRender).then(function () {
          showCategoriesModal(null);
          toast(existCat ? 'تم تحديث التصنيف' : 'تمت إضافة التصنيف');
        }).catch(function (err) { toast(err.message); });
      } else if (fid === 'bmRecForm') {
        var rAmt = parseNum(f.amount.value);
        var rStart = f.startDate.value;
        if (!f.title.value.trim()) { toast('اكتب عنوان المصروف المتكرر'); return; }
        if (!(rAmt > 0)) { toast('أدخل مبلغاً أكبر من 0'); return; }
        if (!S.isValidDate(rStart)) { toast('اختر تاريخ بدء صحيح'); return; }
        var existRec = recId ? state.data.recurring.filter(function (x) { return x.id === recId; })[0] : null;
        var nextRun = existRec ? (existRec.startDate !== rStart ? rStart : existRec.nextRunDate) : rStart;
        var recObj = {
          id: recId || S.uid('rec'),
          title: f.title.value.trim(),
          amount: S.roundMoney(rAmt),
          categoryId: f.categoryId.value || 'other',
          paymentMethod: f.paymentMethod.value || 'cash',
          frequency: f.frequency.value || 'monthly',
          startDate: rStart,
          nextRunDate: nextRun,
          lastRunDate: existRec ? existRec.lastRunDate : null,
          active: existRec ? existRec.active : true,
          note: (f.note.value || '').trim(),
          createdAt: existRec ? existRec.createdAt : Date.now(),
          updatedAt: Date.now()
        };
        S.putRecurring(recObj).then(function () {
          closeModal();
          return reloadAndRender();
        }).then(function () { toast(existRec ? 'تم تحديث المصروف المتكرر' : 'تم حفظ المصروف المتكرر'); }).catch(function (err) { toast(err.message); });
      } else if (fid === 'bmGoalForm') {
        var tAmt = parseNum(f.targetAmount.value);
        var sAmt = parseNum(f.savedAmount.value) || 0;
        if (!f.name.value.trim()) { toast('اكتب اسم الهدف'); return; }
        if (!(tAmt > 0)) { toast('المبلغ المستهدف يجب أن يكون أكبر من 0'); return; }
        if (sAmt < 0) { toast('المبلغ المدخر لا يمكن أن يكون سالباً'); return; }
        var existG = recId ? state.data.goals.filter(function (x) { return x.id === recId; })[0] : null;
        var hist = existG ? (existG.history || []) : (sAmt > 0 ? [{ id: S.uid('gh'), type: 'deposit', amount: S.roundMoney(sAmt), date: S.todayStr(), note: 'رصيد ابتدائي', ts: Date.now() }] : []);
        var goalObj = {
          id: recId || S.uid('goal'),
          name: f.name.value.trim(),
          targetAmount: S.roundMoney(tAmt),
          savedAmount: existG ? existG.savedAmount : S.roundMoney(sAmt),
          targetDate: f.targetDate.value || '',
          description: (f.description.value || '').trim(),
          history: hist,
          createdAt: existG ? existG.createdAt : Date.now(),
          updatedAt: Date.now()
        };
        S.putGoal(goalObj).then(function () {
          closeModal();
          return reloadAndRender();
        }).then(function () { toast(existG ? 'تم تعديل الهدف' : 'تم إنشاء هدف الادخار'); }).catch(function (err) { toast(err.message); });
      } else if (fid === 'bmGoalOpForm') {
        var opAmt = parseNum(f.amount.value);
        var op = f.op.value;
        var goalTgt = state.data.goals.filter(function (x) { return x.id === recId; })[0];
        if (!goalTgt) return;
        if (!(opAmt > 0)) { toast('أدخل مبلغاً أكبر من 0'); return; }
        if (op === 'withdraw' && opAmt > goalTgt.savedAmount) { toast('لا يمكنك سحب أكثر من المبلغ المدخر في الهدف'); return; }
        goalTgt.savedAmount = S.roundMoney(op === 'deposit' ? (goalTgt.savedAmount + opAmt) : (goalTgt.savedAmount - opAmt));
        if (!Array.isArray(goalTgt.history)) goalTgt.history = [];
        goalTgt.history.push({
          id: S.uid('gh'),
          type: op,
          amount: S.roundMoney(opAmt),
          date: S.todayStr(),
          note: (f.note.value || '').trim(),
          ts: Date.now()
        });
        goalTgt.updatedAt = Date.now();
        S.putGoal(goalTgt).then(function () {
          closeModal();
          return reloadAndRender();
        }).then(function () { toast(op === 'deposit' ? 'تمت إضافة المبلغ إلى الهدف' : 'تم سحب المبلغ من الهدف'); }).catch(function (err) { toast(err.message); });
      }
    });
  }

  /* ---------- مراقبة تغيير السمة (فاتح / داكن) لإعادة رسم الرسوم البيانية ---------- */
  var themeObs = null;
  function watchTheme() {
    if (themeObs || !root.MutationObserver) return;
    themeObs = new MutationObserver(function () {
      if (state.ready && state.tab === 'analytics' && !state.root.hidden) {
        renderAnalyticsCharts(computeSummary(state.month));
      }
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---------- التهيئة ---------- */
  function init(container) {
    state.root = container;
    if (!state.ready) {
      state.ready = true;
      bindEvents();
      watchTheme();
    }
    state.root.innerHTML = '<div class="tl-top"><button type="button" class="back tl-back">العودة للأدوات</button></div><h2 class="ptitle">مدير الميزانية الجامعية</h2><div class="bm-wrap"><div class="bm-card"><div class="bm-empty">جارٍ تحميل البيانات المالية المحلية…</div></div></div>';
    reloadAndRender();
  }

  function refresh() {
    if (state.root) reloadAndRender();
  }

  root.BudgetManager = {
    init: init,
    refresh: refresh,
    _computeSummary: computeSummary
  };
})(window);
