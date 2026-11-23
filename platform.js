/* ============================================================
   Alex Dance Studio ↔ адмінка (платформа arawebsite, Supabase).

   Сайт працює й без бази: у HTML уже є всі групи, ціни й тексти.
   Цей файл підставляє те, що власниця змінила в адмінці:
     групи (абонементи й розклад), консультації, записи,
     data-txt="ключ"   — текст (рядки поля = рядки на сторінці)
     data-link="ключ"  — посилання (Telegram, Instagram, канали)
     data-photo="слот" — фото з «Фото на сайті»
     tel:-посилання    — за полем «Телефон»
   Збережене з минулого візиту застосовується одразу, свіже — за мить.
   Після перебудови кличе ADS.refresh() зі script.js (вкладки днів, смужки карток).
   ============================================================ */
(function () {
  'use strict';

  var SITE = 111;
  var DB = 'https://ortiatyxntdikaldepbp.supabase.co/rest/v1';
  var KEY = 'sb_publishable_UW1Z8ukEU1XWVCdQxIGkDw_firK4hpO'; /* відкритий ключ лише на читання */
  var CACHE = 'alexdance_cms_' + SITE;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var each = function (s, fn, r) { Array.prototype.forEach.call((r || document).querySelectorAll(s), fn); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var num = function (v) { return Number(String(v == null ? '' : v).replace(/[^\d]/g, '')) || 0; };
  var money = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  var icon = function (id) { return '<svg><use href="#i-' + id + '"/></svg>'; };
  // 1 заняття, 4 заняття, 8 занять
  var lessons = function (n) { var a = n % 10, b = n % 100; return n + ' ' + ((a >= 1 && a <= 4) && !(b >= 11 && b <= 14) ? 'заняття' : 'занять'); };

  /* ---------- розклад з тексту «Пн, Чт 19:00» ---------- */
  var DAY = { 'нд': 0, 'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6 };
  var SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var LONG = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
  var ORDER = [1, 2, 3, 4, 5, 6, 0];
  function parseSlots(text) {
    var out = [], days = [], re = /(нд|пн|вт|ср|чт|пт|сб)|(\d{1,2})[:.](\d{2})/giu, m;
    while ((m = re.exec(String(text || '')))) {
      if (m[1]) { days.push(DAY[m[1].toLowerCase()]); continue; }
      var t = (m[2].length === 1 ? '0' : '') + m[2] + ':' + m[3];
      days.forEach(function (d) { out.push([d, t]); });
      days = [];
    }
    return out;
  }
  var addMin = function (t, mins) {
    var p = t.split(':'), x = (+p[0]) * 60 + (+p[1]) + mins;
    return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
  };
  var span = function (t, mins) { return mins && mins !== 60 ? t + '–' + addMin(t, mins) : t; };
  function slotsLabel(g, sep) {
    var times = {};
    g.slots.forEach(function (s) { times[s[1]] = 1; });
    if (Object.keys(times).length === 1) {
      return g.slots.map(function (s) { return SHORT[s[0]]; }).join(', ') + (sep || ' · ') + span(g.slots[0][1], g.minutes);
    }
    return g.slots.map(function (s) { return SHORT[s[0]] + ' ' + span(s[1], g.minutes); }).join(sep === ' ' ? ', ' : ' · ');
  }
  var lengthLabel = function (m) { return m === 90 ? '1,5 години' : m === 120 ? '2 години' : m && m !== 60 ? m + ' хв' : ''; };

  /* ---------- дані ---------- */
  function groupsFrom(rows) {
    return rows.filter(function (r) { return r.extra && r.extra.id && !r.extra.hidden; }).map(function (r) {
      var e = r.extra, slots = parseSlots(e.slots);
      return {
        id: String(e.id), title: r.title, tag: e.tag || '', level: e.level || '', slots: slots,
        minutes: num(e.minutes) || 60, price: num(r.price), single: num(e.single), image: r.image_url || '',
      };
    }).filter(function (g) { return g.slots.length && g.price; });
  }
  var visible = function (rows) { return rows.filter(function (r) { return r.extra && r.extra.id && !r.extra.hidden && num(r.price); }); };

  /* ---------- абонементи ---------- */
  function paintPlans(groups) {
    var box = $('.plans');
    if (!box || !groups.length) return;
    box.innerHTML = groups.map(function (g) {
      var n = g.slots.length * 4, label = slotsLabel(g);
      return '<article class="plan" data-spot>' +
        '<div class="plan__ph ph" data-photo="group-' + esc(g.id) + '">' + (g.image ? '<img src="' + esc(g.image) + '" alt="' + esc(g.title) + '" loading="lazy">' : icon('photo')) + '</div>' +
        (g.tag ? '<span class="plan__tag">' + esc(g.tag) + '</span>' : '') +
        '<h3 class="plan__t">' + esc(g.title) + '</h3>' +
        (g.level ? '<p class="plan__lvl">' + esc(g.level) + '</p>' : '') +
        '<ul class="plan__list"><li>' + icon('clock') + esc(label) + '</li><li>' + icon('check') + lessons(n) + ' на місяць</li></ul>' +
        '<p class="plan__price"><b>' + money(g.price) + '</b> ₴ / місяць</p>' +
        '<button class="btn btn--line btn--full" data-pay data-order="sub:' + esc(g.id) + '" data-sub data-kind="Підписка" data-title="' + esc(g.title) +
        '" data-meta="' + esc(slotsLabel(g, ' ') + ' · ' + lessons(n) + ' щомісяця') + '" data-price="' + money(g.price) + ' ₴/міс"' +
        ' data-after="Бот підтвердить абонемент і нагадуватиме про заняття. Наступне списання — через місяць, скасувати можна в боті.">Оформити підписку</button>' +
        '<p class="plan__note">Автосписання щомісяця · скасувати можна будь-коли</p>' +
        (g.single ? '<a class="plan__one" href="#schedule" data-onegroup="' + esc(g.id) + '">Або одне заняття — ' + money(g.single) + ' ₴</a>' : '') +
        '</article>';
    }).join('');
  }

  /* ---------- розклад ---------- */
  function paintSchedule(groups) {
    var days = $('.days');
    if (!days || !groups.length) return;
    var wrap = days.parentElement;
    var byDay = {};
    groups.forEach(function (g) {
      g.slots.forEach(function (s) { (byDay[s[0]] = byDay[s[0]] || []).push({ g: g, t: s[1] }); });
    });
    var list = ORDER.filter(function (d) { return byDay[d]; });
    var html = '<div class="days" role="tablist" aria-label="День тижня" style="grid-template-columns:repeat(' + list.length + ',minmax(0,1fr))">' +
      list.map(function (d, i) { return '<button class="day" role="tab" data-day="' + d + '" aria-selected="' + (i ? 'false' : 'true') + '">' + SHORT[d] + '</button>'; }).join('') + '</div>';
    list.forEach(function (d, i) {
      var rows = byDay[d].sort(function (a, b) { return a.t.localeCompare(b.t); });
      html += '<ul class="rows" role="tabpanel" data-day="' + d + '" aria-label="' + LONG[d] + '"' + (i ? ' hidden' : '') + '>' + rows.map(function (x) {
        var g = x.g, sub = [g.tag, g.level, lengthLabel(g.minutes)].filter(Boolean).join(' · ');
        return '<li class="row" data-spot><span class="row__d"><b>' + x.t + '</b></span><div class="row__m"><h3>' + esc(g.title) + '</h3><p>' + esc(sub) + '</p></div>' +
          '<b class="row__p">' + money(g.single) + ' ₴</b>' +
          (g.single ? '<button class="btn btn--ac btn--sm" data-pay data-order="single:' + esc(g.id) + ':' + d + '" data-kind="Разове заняття" data-title="' + esc(g.title) +
            '" data-meta="' + esc(LONG[d] + ' · ' + span(x.t, g.minutes) + ' · студія в Полтаві') + '" data-price="' + money(g.single) + ' ₴"' +
            ' data-after="Чекаємо в студії. Бот нагадає за годину до заняття.">Оплатити</button>' : '') + '</li>';
      }).join('') + '</ul>';
    });
    wrap.innerHTML = html;
  }

  /* ---------- консультації й записи ---------- */
  function paintConsults(rows) {
    var box = $('.cons');
    rows = visible(rows);
    if (!box || !rows.length) return;
    box.innerHTML = rows.map(function (r) {
      var p = money(num(r.price));
      return '<article class="con" data-spot><h3 class="con__t">' + esc(r.title) + '</h3><p class="con__d">' + esc(r.text) + '</p>' +
        '<span class="con__m">' + icon('cam') + 'Zoom · день і час обираєте при записі</span><b class="con__p">' + p + ' ₴</b>' +
        '<button class="btn btn--ac" data-pay data-order="consult:' + esc(r.extra.id) + '" data-kind="Особиста консультація" data-title="' + esc(r.title) +
        '" data-meta="Олександра Шпіка · онлайн у Zoom" data-price="' + p + ' ₴" data-after="Бот одразу надішле посилання на Zoom і нагадає за годину до початку.">Обрати день і час</button></article>';
    }).join('');
  }
  function paintRecords(rows) {
    var box = $('.recs');
    rows = visible(rows);
    if (!box || !rows.length) return;
    box.innerHTML = rows.map(function (r) {
      var p = money(num(r.price));
      return '<article class="rec" data-spot><span class="rec__tag">' + icon('play') + 'Запис</span><h3 class="rec__t">' + esc(r.title) + '</h3>' +
        '<p class="rec__d">' + esc(r.text) + '</p><div class="rec__foot"><b class="rec__p">' + p + ' ₴</b>' +
        '<button class="btn btn--line btn--sm" data-pay data-order="record:' + esc(r.extra.id) + '" data-kind="Запис" data-title="' + esc(r.title) +
        '" data-meta="Доступ у Telegram одразу після оплати" data-price="' + p + ' ₴" data-after="Бот надішле доступ до запису в Telegram.">Купити</button></div></article>';
    }).join('');
  }

  /* ---------- тексти, посилання, телефон, фото ---------- */
  function paintTexts(T) {
    var has = function (k) { return Object.prototype.hasOwnProperty.call(T, k) && String(T[k]).trim() !== ''; };
    if (has('hero_title')) {
      var lines = String(T.hero_title).split('\n').map(function (s) { return esc(s.trim()); }).filter(Boolean).join('<br>');
      each('#heroT .t-base, #heroT .t-lit', function (el) { el.innerHTML = lines; });
      var h = $('#heroT');
      if (h) h.setAttribute('aria-label', String(T.hero_title).replace(/\s+/g, ' ').trim());
    }
    each('[data-txt]', function (el) {
      var k = el.getAttribute('data-txt');
      if (has(k)) el.innerHTML = String(T[k]).split('\n').map(function (s) { return esc(s.trim()); }).filter(Boolean).join('<br>');
    });
    if (has('phone')) {
      var d = String(T.phone).replace(/\D/g, '');
      var intl = d.length === 10 && d[0] === '0' ? '+38' + d : d.length === 12 ? '+' + d : '+' + d;
      each('a[href^="tel:"]', function (a) { a.setAttribute('href', 'tel:' + intl); });
    }
    each('[data-link]', function (a) {
      var k = a.getAttribute('data-link');
      if (has(k)) { a.setAttribute('href', String(T[k]).trim()); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    });
  }
  function paintPhotos(rows) {
    rows.forEach(function (r) {
      var slot = r.extra && r.extra.slot;
      if (!slot || !r.image_url) return;
      each('[data-photo="' + slot + '"]', function (el) {
        var img = $('img', el);
        if (!img) { img = document.createElement('img'); img.loading = 'lazy'; img.alt = ''; el.prepend(img); }
        img.src = r.image_url;
      });
    });
  }

  function paint(data) {
    var by = {};
    (data.items || []).forEach(function (r) { (by[r.collection] = by[r.collection] || []).push(r); });
    try {
      var groups = groupsFrom(by.groups || []);
      paintPlans(groups);
      paintSchedule(groups);
      paintConsults(by.consults || []);
      paintRecords(by.records || []);
      paintTexts(data.texts || {});
      paintPhotos(by.site_photos || []);
    } catch (e) { /* щось не так у даних — сторінка лишається як у HTML */ }
    if (window.ADS && window.ADS.refresh) window.ADS.refresh();
  }

  window.ADS = window.ADS || {};
  window.ADS.paint = paint; // для перевірки

  try {
    var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (cached) document.addEventListener('DOMContentLoaded', function () { paint(cached); });
  } catch (e) { /* немає сховища */ }

  var get = function (path) {
    return fetch(DB + path, { headers: { apikey: KEY } }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)); });
  };
  Promise.all([
    get('/items?site_id=eq.' + SITE + '&collection=in.(groups,consults,records,site_photos)&select=collection,title,text,price,image_url,extra&order=sort_order'),
    get('/texts?site_id=eq.' + SITE + '&select=key,value'),
  ]).then(function (res) {
    var texts = {};
    res[1].forEach(function (t) { texts[t.key] = t.value; });
    var data = { items: res[0], texts: texts };
    try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) { /* повне сховище */ }
    var go = function () { paint(data); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }).catch(function () { /* бази немає — сайт як у HTML */ });
})();
