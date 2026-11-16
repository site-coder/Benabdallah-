/* ==========================================================================
   budget-store.js — طبقة التخزين المحلي IndexedDB لأداة «مدير الميزانية الجامعية»
   - تخزين محلي 100% في IndexedDB (الاسم: edu_budget_db_v1)
   - لا يرسل أي بيانات مالية لأي خادم خارجي
   - يدعم النسخ الاحتياطي والاستعادة (JSON) مع التحقق الصارم ومنع التكرار
   - يعالج المصروفات المتكررة تلقائياً مع منع التكرار عبر مفتاح الحدوث (recurringKey)
   ========================================================================== */
(function (root) {
  'use strict';

  var DB_NAME = 'edu_budget_db_v1';
  var DB_VER = 1;
  var STORES = {
    expenses: 'expenses',
    incomes: 'incomes',
    budgets: 'budgets',
    categories: 'categories',
    recurring: 'recurring',
    goals: 'goals',
    meta: 'meta'
  };

  var DEFAULT_CATEGORIES = [
    { id: 'food', name: 'الطعام والمشروبات', icon: 'utensils', color: '#F59E0B', isDefault: true, order: 1 },
    { id: 'transport', name: 'النقل والمواصلات', icon: 'bus', color: '#0F294A', isDefault: true, order: 2 },
    { id: 'books', name: 'الكتب والمراجع', icon: 'book', color: '#2563EB', isDefault: true, order: 3 },
    { id: 'printing', name: 'الطباعة والنسخ', icon: 'printer', color: '#0284C7', isDefault: true, order: 4 },
    { id: 'housing', name: 'الإقامة والكراء', icon: 'home', color: '#7C3AED', isDefault: true, order: 5 },
    { id: 'study', name: 'الدراسة والجامعة', icon: 'cap', color: '#10B981', isDefault: true, order: 6 },
    { id: 'internet', name: 'الإنترنت والهاتف', icon: 'wifi', color: '#06B6D4', isDefault: true, order: 7 },
    { id: 'clothes', name: 'الملابس', icon: 'shirt', color: '#EC4899', isDefault: true, order: 8 },
    { id: 'health', name: 'الصحة والأدوية', icon: 'heart', color: '#EF4444', isDefault: true, order: 9 },
    { id: 'fun', name: 'الترفيه', icon: 'smile', color: '#F97316', isDefault: true, order: 10 },
    { id: 'other', name: 'مصاريف أخرى', icon: 'tag', color: '#64748B', isDefault: true, order: 11 }
  ];

  var PAYMENT_METHODS = [
    { id: 'cash', label: 'نقداً' },
    { id: 'bank_card', label: 'بطاقة بنكية' },
    { id: 'baridimob', label: 'بريدي موب' },
    { id: 'other', label: 'أخرى' }
  ];

  var INCOME_SOURCES = [
    { id: 'scholarship', label: 'المنحة الجامعية' },
    { id: 'family', label: 'المساعدة العائلية' },
    { id: 'work', label: 'العمل' },
    { id: 'extra', label: 'دخل إضافي' },
    { id: 'other', label: 'مصادر أخرى' }
  ];

  var dbPromise = null;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function currentMonthStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function uid(prefix) {
    return (prefix || 'bm') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function roundMoney(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function addDaysStr(dateStr, days) {
    var p = String(dateStr).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addMonthsStr(dateStr, months) {
    var p = String(dateStr).split('-');
    var y = Number(p[0]), m = Number(p[1]) - 1, day = Number(p[2]);
    var targetMonth = m + months;
    var firstOfTarget = new Date(y, targetMonth, 1);
    var maxDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
    var clampedDay = Math.min(day, maxDay);
    return firstOfTarget.getFullYear() + '-' + pad(firstOfTarget.getMonth() + 1) + '-' + pad(clampedDay);
  }

  function advanceDateByFrequency(dateStr, freq) {
    if (freq === 'daily') return addDaysStr(dateStr, 1);
    if (freq === 'weekly') return addDaysStr(dateStr, 7);
    return addMonthsStr(dateStr, 1);
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) {
        reject(new Error('المتصفح لا يدعم التخزين المحلي IndexedDB'));
        return;
      }
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VER);
      } catch (err) {
        dbPromise = null;
        reject(new Error('تعذّر فتح قاعدة البيانات المحلية: ' + (err && err.message ? err.message : 'خطأ غير معروف')));
        return;
      }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORES.expenses)) {
          var es = db.createObjectStore(STORES.expenses, { keyPath: 'id' });
          es.createIndex('date', 'date', { unique: false });
          es.createIndex('month', 'month', { unique: false });
          es.createIndex('categoryId', 'categoryId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.incomes)) {
          var is = db.createObjectStore(STORES.incomes, { keyPath: 'id' });
          is.createIndex('date', 'date', { unique: false });
          is.createIndex('month', 'month', { unique: false });
          is.createIndex('source', 'source', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.budgets)) {
          db.createObjectStore(STORES.budgets, { keyPath: 'month' });
        }
        if (!db.objectStoreNames.contains(STORES.categories)) {
          db.createObjectStore(STORES.categories, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.recurring)) {
          db.createObjectStore(STORES.recurring, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.goals)) {
          db.createObjectStore(STORES.goals, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: 'key' });
        }
      };
      req.onsuccess = function (e) {
        var db = e.target.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = function (e) {
        dbPromise = null;
        reject((e.target && e.target.error) || new Error('فشل فتح قاعدة البيانات المحلية'));
      };
      req.onblocked = function () {
        dbPromise = null;
        reject(new Error('قاعدة البيانات قيد الاستخدام في نافذة أخرى'));
      };
    });
    return dbPromise;
  }

  function txPromise(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () {
        var err = tx.error;
        if (err && err.name === 'QuotaExceededError') {
          reject(new Error('مساحة التخزين المحلي ممتلئة. صدّر نسخة احتياطية واحذف بعض البيانات القديمة.'));
        } else {
          reject(err || new Error('تعذّر حفظ البيانات في التخزين المحلي'));
        }
      };
      tx.onabort = function () {
        reject(tx.error || new Error('تم إلغاء عملية الحفظ'));
      };
    });
  }

  function getAll(storeName) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error || new Error('تعذّرت قراءة البيانات')); };
      });
    });
  }

  function putItem(storeName, item) {
    return openDB().then(function (db) {
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
      return txPromise(tx).then(function () { return item; });
    });
  }

  function deleteItem(storeName, key) {
    return openDB().then(function (db) {
      var tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      return txPromise(tx);
    });
  }

  function getMeta(key, fallback) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORES.meta, 'readonly');
        var req = tx.objectStore(STORES.meta).get(key);
        req.onsuccess = function () { resolve(req.result ? req.result.value : fallback); };
        req.onerror = function () { resolve(fallback); };
      });
    }).catch(function () { return fallback; });
  }

  function setMeta(key, value) {
    return putItem(STORES.meta, { key: key, value: value });
  }

  function ensureDefaultCategories() {
    return Promise.all([getAll(STORES.categories), getMeta('seeded_categories', false)]).then(function (res) {
      var existing = res[0];
      var seeded = res[1];
      if (existing.length > 0 || seeded) {
        // ضمان وجود فئة «مصاريف أخرى» دائماً كفئة احتياطية
        var hasOther = existing.some(function (c) { return c.id === 'other'; });
        if (!hasOther) {
          var fallbackCat = clone(DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]);
          return putItem(STORES.categories, fallbackCat).then(function () {
            return existing.concat([fallbackCat]);
          });
        }
        return existing;
      }
      return openDB().then(function (db) {
        var tx = db.transaction([STORES.categories, STORES.meta], 'readwrite');
        var cs = tx.objectStore(STORES.categories);
        DEFAULT_CATEGORIES.forEach(function (cat) { cs.put(clone(cat)); });
        tx.objectStore(STORES.meta).put({ key: 'seeded_categories', value: true });
        return txPromise(tx).then(function () { return clone(DEFAULT_CATEGORIES); });
      });
    });
  }

  function deleteCategoryAndReassign(catId) {
    if (catId === 'other') {
      return Promise.reject(new Error('لا يمكن حذف التصنيف الافتراضي «مصاريف أخرى»'));
    }
    return openDB().then(function (db) {
      return Promise.all([getAll(STORES.expenses), getAll(STORES.recurring), getAll(STORES.budgets)]).then(function (res) {
        var expenses = res[0], recurring = res[1], budgets = res[2];
        var tx = db.transaction([STORES.categories, STORES.expenses, STORES.recurring, STORES.budgets], 'readwrite');
        tx.objectStore(STORES.categories).delete(catId);
        var expStore = tx.objectStore(STORES.expenses);
        expenses.forEach(function (ex) {
          if (ex.categoryId === catId) {
            ex.categoryId = 'other';
            ex.updatedAt = Date.now();
            expStore.put(ex);
          }
        });
        var recStore = tx.objectStore(STORES.recurring);
        recurring.forEach(function (r) {
          if (r.categoryId === catId) {
            r.categoryId = 'other';
            recStore.put(r);
          }
        });
        var budStore = tx.objectStore(STORES.budgets);
        budgets.forEach(function (b) {
          if (b.categoryBudgets && Object.prototype.hasOwnProperty.call(b.categoryBudgets, catId)) {
            delete b.categoryBudgets[catId];
            budStore.put(b);
          }
        });
        return txPromise(tx);
      });
    });
  }

  /* معالجة المصروفات المتكررة المستحقة دون تكرار */
  function processRecurringExpenses() {
    var today = todayStr();
    return Promise.all([getAll(STORES.recurring), getAll(STORES.expenses)]).then(function (res) {
      var rules = res[0];
      var expenses = res[1];
      var existingKeys = {};
      expenses.forEach(function (ex) {
        if (ex.recurringKey) existingKeys[ex.recurringKey] = true;
      });

      var generated = [];
      var updatedRules = [];

      rules.forEach(function (rule) {
        if (!rule || !rule.active) return;
        var next = rule.nextRunDate || rule.startDate;
        if (!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
        var changed = false;
        var guard = 0;
        while (next <= today && guard++ < 366) {
          var key = rule.id + '__' + next;
          if (!existingKeys[key]) {
            existingKeys[key] = true;
            var newExp = {
              id: uid('exp'),
              amount: roundMoney(rule.amount),
              categoryId: rule.categoryId || 'other',
              description: (rule.title || 'مصروف متكرر') + (rule.note ? ' — ' + rule.note : '') + ' (تلقائي)',
              date: next,
              month: next.slice(0, 7),
              paymentMethod: rule.paymentMethod || 'cash',
              recurringId: rule.id,
              recurringKey: key,
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            generated.push(newExp);
          }
          rule.lastRunDate = next;
          next = advanceDateByFrequency(next, rule.frequency);
          rule.nextRunDate = next;
          changed = true;
        }
        if (changed) {
          rule.updatedAt = Date.now();
          updatedRules.push(rule);
        }
      });

      if (!generated.length && !updatedRules.length) {
        return { generated: [], updatedRules: [] };
      }

      return openDB().then(function (db) {
        var tx = db.transaction([STORES.expenses, STORES.recurring], 'readwrite');
        var expStore = tx.objectStore(STORES.expenses);
        var recStore = tx.objectStore(STORES.recurring);
        generated.forEach(function (ex) { expStore.put(ex); });
        updatedRules.forEach(function (r) { recStore.put(r); });
        return txPromise(tx).then(function () {
          return { generated: generated, updatedRules: updatedRules };
        });
      });
    });
  }

  function loadAllData() {
    return ensureDefaultCategories().then(function () {
      return processRecurringExpenses();
    }).then(function (recResult) {
      return Promise.all([
        getAll(STORES.expenses),
        getAll(STORES.incomes),
        getAll(STORES.budgets),
        getAll(STORES.categories),
        getAll(STORES.recurring),
        getAll(STORES.goals),
        getMeta('dismissed_alerts', {})
      ]).then(function (res) {
        var cats = res[3].slice().sort(function (a, b) {
          return (a.order || 999) - (b.order || 999) || String(a.name).localeCompare(String(b.name), 'ar');
        });
        var budgetMap = {};
        res[2].forEach(function (b) { if (b && b.month) budgetMap[b.month] = b; });
        return {
          expenses: res[0],
          incomes: res[1],
          budgets: budgetMap,
          categories: cats,
          recurring: res[4],
          goals: res[5],
          dismissedAlerts: res[6] || {},
          autoGenerated: recResult.generated || []
        };
      });
    });
  }

  /* التحقق من صحة النسخة الاحتياطية قبل الاستيراد */
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.getFullYear() === Number(p[0]) && (d.getMonth() + 1) === Number(p[1]) && d.getDate() === Number(p[2]);
  }

  function isValidMonth(s) {
    return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  }

  function validateBackup(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'صيغة الملف غير صالحة: يجب أن يكون ملف JSON منظماً.' };
    }
    if (raw.app !== 'eps-chlef-budget') {
      return { ok: false, error: 'هذا الملف لا يخص أداة «مدير الميزانية الجامعية».' };
    }
    if (!Array.isArray(raw.expenses) || !Array.isArray(raw.incomes) || !Array.isArray(raw.categories) || !Array.isArray(raw.goals) || !Array.isArray(raw.recurring)) {
      return { ok: false, error: 'بنية النسخة الاحتياطية ناقصة أو تالفة.' };
    }
    var budgetsList = Array.isArray(raw.budgets) ? raw.budgets : Object.keys(raw.budgets || {}).map(function (k) { return raw.budgets[k]; });
    var i, x;

    for (i = 0; i < raw.categories.length; i++) {
      x = raw.categories[i];
      if (!x || typeof x.id !== 'string' || !x.id.trim() || typeof x.name !== 'string' || !x.name.trim()) {
        return { ok: false, error: 'يوجد تصنيف غير صالح داخل الملف (عنصر #' + (i + 1) + ').' };
      }
    }
    for (i = 0; i < raw.expenses.length; i++) {
      x = raw.expenses[i];
      if (!x || typeof x.id !== 'string' || !(Number(x.amount) > 0) || !isValidDate(x.date)) {
        return { ok: false, error: 'يوجد مصروف ببيانات غير صالحة (عنصر #' + (i + 1) + ').' };
      }
    }
    for (i = 0; i < raw.incomes.length; i++) {
      x = raw.incomes[i];
      if (!x || typeof x.id !== 'string' || !(Number(x.amount) > 0) || !isValidDate(x.date)) {
        return { ok: false, error: 'يوجد دخل ببيانات غير صالحة (عنصر #' + (i + 1) + ').' };
      }
    }
    for (i = 0; i < budgetsList.length; i++) {
      x = budgetsList[i];
      if (!x || !isValidMonth(x.month)) {
        return { ok: false, error: 'توجد ميزانية بشهر غير صالح (عنصر #' + (i + 1) + ').' };
      }
    }
    for (i = 0; i < raw.goals.length; i++) {
      x = raw.goals[i];
      if (!x || typeof x.id !== 'string' || typeof x.name !== 'string' || !x.name.trim() || !(Number(x.targetAmount) > 0) || Number(x.savedAmount) < 0 || !isFinite(Number(x.savedAmount))) {
        return { ok: false, error: 'يوجد هدف ادخار ببيانات غير صالحة (عنصر #' + (i + 1) + ').' };
      }
    }
    for (i = 0; i < raw.recurring.length; i++) {
      x = raw.recurring[i];
      if (!x || typeof x.id !== 'string' || !(Number(x.amount) > 0) || !isValidDate(x.startDate)) {
        return { ok: false, error: 'يوجد مصروف متكرر ببيانات غير صالحة (عنصر #' + (i + 1) + ').' };
      }
    }

    return {
      ok: true,
      normalized: {
        categories: raw.categories,
        expenses: raw.expenses.map(function (e) {
          var copy = clone(e);
          copy.amount = roundMoney(copy.amount);
          copy.month = copy.date.slice(0, 7);
          return copy;
        }),
        incomes: raw.incomes.map(function (inc) {
          var copy = clone(inc);
          copy.amount = roundMoney(copy.amount);
          copy.month = copy.date.slice(0, 7);
          return copy;
        }),
        budgets: budgetsList,
        recurring: raw.recurring.map(function (r) {
          var copy = clone(r);
          copy.amount = roundMoney(copy.amount);
          return copy;
        }),
        goals: raw.goals.map(function (g) {
          var copy = clone(g);
          copy.targetAmount = roundMoney(copy.targetAmount);
          copy.savedAmount = roundMoney(copy.savedAmount);
          if (!Array.isArray(copy.history)) copy.history = [];
          return copy;
        })
      }
    };
  }

  function exportBackup() {
    return loadAllData().then(function (data) {
      var budgetsArr = Object.keys(data.budgets).map(function (m) { return data.budgets[m]; });
      return {
        app: 'eps-chlef-budget',
        version: 1,
        exportedAt: new Date().toISOString(),
        categories: data.categories,
        expenses: data.expenses,
        incomes: data.incomes,
        budgets: budgetsArr,
        recurring: data.recurring,
        goals: data.goals
      };
    });
  }

  function importBackup(normalized, mode) {
    return loadAllData().then(function (current) {
      return openDB().then(function (db) {
        var tx = db.transaction([
          STORES.categories, STORES.expenses, STORES.incomes,
          STORES.budgets, STORES.recurring, STORES.goals, STORES.meta
        ], 'readwrite');

        var cs = tx.objectStore(STORES.categories);
        var es = tx.objectStore(STORES.expenses);
        var is = tx.objectStore(STORES.incomes);
        var bs = tx.objectStore(STORES.budgets);
        var rs = tx.objectStore(STORES.recurring);
        var gs = tx.objectStore(STORES.goals);
        var ms = tx.objectStore(STORES.meta);

        var stats = { added: 0, skipped: 0 };

        if (mode === 'replace') {
          cs.clear(); es.clear(); is.clear(); bs.clear(); rs.clear(); gs.clear();
          var hasOther = false;
          normalized.categories.forEach(function (c) {
            if (c.id === 'other') hasOther = true;
            cs.put(c); stats.added++;
          });
          if (!hasOther) cs.put(clone(DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]));
          normalized.expenses.forEach(function (e) { es.put(e); stats.added++; });
          normalized.incomes.forEach(function (inc) { is.put(inc); stats.added++; });
          normalized.budgets.forEach(function (b) { bs.put(b); stats.added++; });
          normalized.recurring.forEach(function (r) { rs.put(r); stats.added++; });
          normalized.goals.forEach(function (g) { gs.put(g); stats.added++; });
          ms.put({ key: 'seeded_categories', value: true });
        } else {
          // دمج ذكي مع منع التكرار حسب المعرّف والتوقيع
          var catIds = {}, expIds = {}, expSigs = {}, incIds = {}, incSigs = {}, recIds = {}, goalIds = {};
          current.categories.forEach(function (c) { catIds[c.id] = true; });
          current.expenses.forEach(function (e) {
            expIds[e.id] = true;
            expSigs[e.date + '|' + roundMoney(e.amount) + '|' + (e.categoryId || '') + '|' + (e.description || '').trim()] = true;
          });
          current.incomes.forEach(function (inc) {
            incIds[inc.id] = true;
            incSigs[inc.date + '|' + roundMoney(inc.amount) + '|' + (inc.source || '') + '|' + (inc.description || '').trim()] = true;
          });
          current.recurring.forEach(function (r) { recIds[r.id] = true; });
          current.goals.forEach(function (g) { goalIds[g.id] = true; });

          normalized.categories.forEach(function (c) {
            if (catIds[c.id]) { stats.skipped++; return; }
            catIds[c.id] = true; cs.put(c); stats.added++;
          });
          normalized.expenses.forEach(function (e) {
            var sig = e.date + '|' + roundMoney(e.amount) + '|' + (e.categoryId || '') + '|' + (e.description || '').trim();
            if (expIds[e.id] || expSigs[sig] || (e.recurringKey && current.expenses.some(function (x) { return x.recurringKey === e.recurringKey; }))) {
              stats.skipped++; return;
            }
            expIds[e.id] = true; expSigs[sig] = true; es.put(e); stats.added++;
          });
          normalized.incomes.forEach(function (inc) {
            var sig = inc.date + '|' + roundMoney(inc.amount) + '|' + (inc.source || '') + '|' + (inc.description || '').trim();
            if (incIds[inc.id] || incSigs[sig]) { stats.skipped++; return; }
            incIds[inc.id] = true; incSigs[sig] = true; is.put(inc); stats.added++;
          });
          normalized.budgets.forEach(function (b) {
            if (current.budgets[b.month]) { stats.skipped++; return; }
            bs.put(b); stats.added++;
          });
          normalized.recurring.forEach(function (r) {
            if (recIds[r.id]) { stats.skipped++; return; }
            recIds[r.id] = true; rs.put(r); stats.added++;
          });
          normalized.goals.forEach(function (g) {
            if (goalIds[g.id]) { stats.skipped++; return; }
            goalIds[g.id] = true; gs.put(g); stats.added++;
          });
        }

        return txPromise(tx).then(function () { return stats; });
      });
    });
  }

  root.BudgetStore = {
    STORES: STORES,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    PAYMENT_METHODS: PAYMENT_METHODS,
    INCOME_SOURCES: INCOME_SOURCES,
    todayStr: todayStr,
    currentMonthStr: currentMonthStr,
    addDaysStr: addDaysStr,
    addMonthsStr: addMonthsStr,
    advanceDateByFrequency: advanceDateByFrequency,
    uid: uid,
    roundMoney: roundMoney,
    isValidDate: isValidDate,
    isValidMonth: isValidMonth,
    loadAllData: loadAllData,
    putExpense: function (item) { return putItem(STORES.expenses, item); },
    deleteExpense: function (id) { return deleteItem(STORES.expenses, id); },
    putIncome: function (item) { return putItem(STORES.incomes, item); },
    deleteIncome: function (id) { return deleteItem(STORES.incomes, id); },
    putBudget: function (item) { return putItem(STORES.budgets, item); },
    putCategory: function (item) { return putItem(STORES.categories, item); },
    deleteCategory: deleteCategoryAndReassign,
    putRecurring: function (item) { return putItem(STORES.recurring, item); },
    deleteRecurring: function (id) { return deleteItem(STORES.recurring, id); },
    putGoal: function (item) { return putItem(STORES.goals, item); },
    deleteGoal: function (id) { return deleteItem(STORES.goals, id); },
    processRecurring: processRecurringExpenses,
    setMeta: setMeta,
    getMeta: getMeta,
    exportBackup: exportBackup,
    validateBackup: validateBackup,
    importBackup: importBackup
  };
})(window);
