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
  var money = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }; // нерозривний пробіл: «2 000» не рветься
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
        minutes: num(e.minutes) || 60, price: num(r.price), single: num(e.single), image: r.image_url || '', classPrice: num(e.class_price), cap: num(e.capacity), offline: num(e.offline),
        photos: [r.image_url].concat(Array.isArray(e.photos) ? e.photos : []).filter(Boolean),
      };
    }).filter(function (g) { return g.slots.length && g.price; });
  }
  var visible = function (rows) { return rows.filter(function (r) { return r.extra && r.extra.id && !r.extra.hidden && num(r.price); }); };

  /* ---------- абонемент на місяць: рахуємо одразу тут, тим самим правилом, що й бот (subOffer) ----------
     Посеред місяця — лишилось занять × ціна заняття (або місяць / кількість занять), не більше за місяць;
     занять цього місяця вже немає — продаємо наступний повністю. Час — за Києвом. */
  var MON_G = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var MON_L = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні'];
  var NB = '\u00a0';
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  function kyivNowStr() {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }
  function monthLessons(slots, y, m, after) {
    var n = 0, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (var d = 1; d <= days; d++) {
      var dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(), day = y + '-' + p2(m) + '-' + p2(d) + 'T';
      slots.forEach(function (s) { if (s[0] === dow && (!after || day + s[1] > after)) n++; });
    }
    return n;
  }
  function monthOffer(g) {
    var now = kyivNowStr(), y = +now.slice(0, 4), m = +now.slice(5, 7);
    var ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    var total = monthLessons(g.slots, y, m, ''), left = monthLessons(g.slots, y, m, now), next = monthLessons(g.slots, ny, nm, '');
    if (!left) return { amount: g.price, lessons: next, full: true, fromNext: true, m: nm, nm: nm, next: next };
    var per = g.classPrice || Math.round(g.price / Math.max(total, 1)), full = left >= total;
    return { amount: full ? g.price : Math.min(g.price, left * per), lessons: left, total: total, full: full, fromNext: false, m: m, nm: nm, next: next };
  }
  // «Вільних місць у листопаді: 11 із 13» (cap 0 — без обмеження, рядка немає)
  function spotsText(cap, taken, mon) {
    var free = Math.max(cap - taken, 0);
    return '<span>' + (free ? 'Вільних місць у' + NB + mon + ': <b>' + free + '</b> із ' + cap : 'У' + NB + mon + ' місць немає') + '</span>';
  }
  function spotsHtml(cap, taken, mon) {
    if (!(cap > 0)) return '<p class="plan__spots" hidden></p>';
    return '<p class="plan__spots' + (cap - taken <= 2 ? ' is-low' : '') + '">' + spotsText(cap, taken, mon) + '</p>';
  }
  function offerHtml(g) {
    var o = monthOffer(g), price, left, meta;
    if (o.fromNext) {
      price = '<b>' + money(g.price) + NB + '₴</b><span class="plan__for">за весь місяць</span>';
      left = 'Набір з 1' + NB + MON_G[o.nm - 1] + ' · ' + lessons(o.next) + ' у' + NB + MON_L[o.nm - 1];
      meta = 'З 1 ' + MON_G[o.nm - 1] + ' · ' + lessons(o.next);
    } else if (o.full) {
      price = '<b>' + money(g.price) + NB + '₴</b><span class="plan__for">за весь місяць</span>';
      left = lessons(o.lessons) + ' у' + NB + MON_L[o.m - 1] + ' · далі ' + money(g.price) + NB + '₴ щомісяця';
      meta = 'Увесь місяць · ' + lessons(o.lessons);
    } else {
      price = '<b>' + money(o.amount) + NB + '₴</b><span class="plan__for">за ' + lessons(o.lessons) + ', що ' +
        (o.lessons === 1 ? 'лишилось' : 'лишились') + ' у' + NB + MON_L[o.m - 1] + '</span>';
      left = 'З 1' + NB + MON_G[o.nm - 1] + ' — <b>' + money(g.price) + NB + '₴</b> за весь місяць (' + lessons(o.next) + ')';
      meta = lessons(o.lessons) + ' до кінця ' + MON_G[o.m - 1];
    }
    // перше автосписання — 1-го числа наступного оплаченого місяця
    var rm = o.fromNext ? o.nm % 12 + 1 : o.nm;
    return { o: o, price: price, left: left, meta: meta + ' · ' + slotsLabel(g, ' '), renew: '1' + NB + MON_G[rm - 1], mon: MON_L[(o.fromNext ? o.nm : o.m) - 1] };
  }

  /* ---------- абонементи ---------- */
  function paintPlans(groups) {
    var box = $('.plans');
    if (!box || !groups.length) return;
    box.innerHTML = groups.map(function (g) {
      var label = slotsLabel(g), of = offerHtml(g);
      var ph = g.photos.length > 1
        ? '<div class="plan__ph ph phs" data-photo="group-' + esc(g.id) + '" title="Наступне фото">' +
          g.photos.map(function (u, i) { return '<img src="' + esc(u) + '" alt="' + esc(g.title) + '" loading="lazy"' + (i ? '' : ' class="is-on"') + '>'; }).join('') +
          '<span class="phs__dots">' + g.photos.map(function (u, i) { return '<i' + (i ? '' : ' class="is-on"') + '></i>'; }).join('') + '</span></div>'
        : '<div class="plan__ph ph" data-photo="group-' + esc(g.id) + '">' + (g.image ? '<img src="' + esc(g.image) + '" alt="' + esc(g.title) + '" loading="lazy">' : icon('photo')) + '</div>';
      return '<article class="plan" data-spot data-group="' + esc(g.id) + '" data-mon="' + of.mon + '" data-cap="' + (g.cap || 0) + '" data-off="' + (g.offline || 0) + '">' + ph +
        (g.tag ? '<span class="plan__tag">' + esc(g.tag) + '</span>' : '') +
        '<h3 class="plan__t">' + esc(g.title) + '</h3>' +
        (g.level ? '<p class="plan__lvl">' + esc(g.level) + '</p>' : '') +
        '<ul class="plan__list"><li>' + icon('clock') + esc(label) + '</li></ul>' +
        '<p class="plan__price">' + of.price + '</p><p class="plan__left">' + of.left + '</p>' + spotsHtml(g.cap, g.offline, of.mon) +
        '<button class="btn btn--line btn--full" data-pay data-order="sub:' + esc(g.id) + '" data-sub data-month="' + money(g.price) + ' ₴" data-renew="' + of.renew + '" data-kind="Абонемент" data-title="' + esc(g.title) +
        '" data-meta="' + esc(of.meta) + '" data-price="' + money(of.o.amount) + ' ₴"' +
        ' data-after="Бот підтвердить абонемент і нагадуватиме про заняття.">Оплатити абонемент</button>' +
        '<p class="plan__note" data-txt="plan_note">Автосписання — за бажанням, вимкнути можна будь-коли</p>' +
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
        '<span class="con__m">' + icon('cam') + '<span data-txt="consult_meta">Zoom · день і час обираєте при записі</span></span><b class="con__p">' + p + ' ₴</b>' +
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
    if (has('email')) each('a[data-mail]', function (a) { a.setAttribute('href', 'mailto:' + String(T.email).trim()); });
    each('[data-link]', function (a) {
      var k = a.getAttribute('data-link');
      if (has(k)) { a.setAttribute('href', String(T[k]).trim()); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    });
  }
  /* ---------- документи: оферта, повернення, політика — текстом з адмінки ----------
     «## » — заголовок, «- » — пункт, порожній рядок — абзац, **жирний**, [текст](адреса),
     {{sellerName}} {{sellerCode}} {{sellerAddress}} {{email}} {{phone}} — реквізити */
  function paintDocs(T) {
    var val = function (k, d) { var v = String(T[k] == null ? '' : T[k]).trim(); return v || d; };
    var tok = {
      sellerName: esc(val('seller_name', 'ФОП Прізвище Ім’я По батькові')),
      sellerCode: esc(val('seller_code', '0000000000')),
      sellerAddress: esc(val('seller_address', 'м. Полтава, вул. Назва, 1')),
      email: (function (e) { return '<a href="mailto:' + esc(e) + '">' + esc(e) + '</a>'; })(val('email', 'email@alexshpika.com.ua')),
      phone: esc(val('phone', '050 343 05 31')),
    };
    var inline = function (x) {
      x = esc(x).replace(/\{\{(\w+)\}\}/g, function (m, k) { return tok[k] || m; });
      x = x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      return x.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
        return /^(https?:\/\/|mailto:|tel:|[\w-]+\.html)/.test(u) ? '<a href="' + u + '">' + t + '</a>' : t;
      });
    };
    each('[data-doc]', function (box) {
      var src = String(T[box.getAttribute('data-doc')] || '').replace(/\r/g, '').trim();
      if (!src) return; // в адмінці порожньо — лишається текст сторінки
      box.innerHTML = src.split(/\n\s*\n/).map(function (blk) {
        var lines = blk.trim().split('\n'), out = '';
        if (/^## /.test(lines[0])) { out += '<h2>' + inline(lines.shift().slice(3)) + '</h2>'; if (!lines.length) return out; }
        if (lines.every(function (l) { return /^- /.test(l); })) {
          return out + '<ul>' + lines.map(function (l) { return '<li>' + inline(l.slice(2)) + '</li>'; }).join('') + '</ul>';
        }
        var req = /^\{\{sellerName\}\}/.test(lines[0]) ? ' class="doc__req"' : '';
        return out + '<p' + req + '>' + lines.map(inline).join('<br>') + '</p>';
      }).join('');
    });
  }

  /* ---------- танцетерапія: заняття з датою з адмінки, оплата → закритий чат ---------- */
  var MONTHS_G = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var kyivNow = function () {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  };
  function paintEvents(rows) {
    var box = $('[data-events]');
    if (!box) return;
    var now = kyivNow();
    var list = rows.filter(function (r) {
      var e = r.extra || {};
      return e.id && !e.hidden && num(r.price) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(e.at || '') && String(e.at).slice(0, 16) > now;
    }).sort(function (a, b) { return String(a.extra.at).localeCompare(String(b.extra.at)); });
    box.hidden = !list.length;
    box.innerHTML = list.map(function (r) {
      var e = r.extra, m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(e.at);
      var dow = WD[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
      var when = dow + ', ' + (+m[3]) + ' ' + MONTHS_G[+m[2] - 1] + ' о ' + m[4];
      var p = money(num(r.price)), title = r.title || 'Танцетерапія';
      return '<article class="ev" data-spot data-event="' + esc(e.id) + '">' +
        '<div class="ev__d"><b>' + (+m[3]) + '</b><span>' + MONTHS_G[+m[2] - 1] + '</span></div>' +
        '<div class="ev__m"><h3>' + esc(title) + '</h3><p>' + esc(dow + ' · ' + m[4] + (e.place ? ' · ' + e.place : '')) + '</p>' +
        (r.text ? '<p class="ev__t">' + esc(r.text) + '</p>' : '') + '<p class="ev__spots" hidden></p></div>' +
        '<div class="ev__buy"><b class="ev__p">' + p + ' ₴</b>' +
        '<button class="btn btn--ac btn--sm" data-pay data-order="event:' + esc(e.id) + '" data-kind="Танцетерапія" data-title="' + esc(title) +
        '" data-meta="' + esc(when + (e.place ? ' · ' + e.place : '')) + '" data-price="' + p + ' ₴" data-after="Після оплати бот одразу надішле посилання на закритий чат танцетерапії й нагадає напередодні.">Оплатити</button></div></article>';
    }).join('');
  }

  /* ---------- абонемент на місяць і вільні місця: рахує бот (?api=groups) ---------- */
  var offers = null, evSpots = null, SPOTS = 'alexdance_spots_' + SITE;
  try { var sc = JSON.parse(localStorage.getItem(SPOTS) || 'null'); if (sc) { offers = sc.g; evSpots = sc.e; } } catch (e) { /* немає сховища */ }
  function paintOffers() {
    if (!offers) return;
    each('.plan[data-group]', function (card) {
      var o = offers[card.getAttribute('data-group')];
      if (!o) return;
      // ціну рахує сама сторінка (offerHtml), від бота — лише місця
      var btn = $('[data-pay]', card), spots = $('.plan__spots', card);
      var capN = +card.getAttribute('data-cap') || o.cap || 0;
      var online = o.online != null ? o.online : Math.max((o.taken || 0) - (o.offline || 0), 0);
      var takenN = (+card.getAttribute('data-off') || 0) + online;
      var cap = capN > 0, full = cap && takenN >= capN;
      if (spots) {
        spots.hidden = !cap;
        spots.className = 'plan__spots' + (cap && capN - takenN <= 2 ? ' is-low' : '');
        spots.innerHTML = cap ? spotsText(capN, takenN, card.getAttribute('data-mon') || 'цьому місяці') : '';
      }
      if (btn) {
        btn.disabled = full;
        btn.textContent = full ? 'Місць немає' : 'Оплатити абонемент';
      }
    });
    // танцетерапія: «Вільно N із M», коли місць немає — без оплати
    each('.ev[data-event]', function (card) {
      var o = evSpots && evSpots[card.getAttribute('data-event')], tag = $('.ev__spots', card), btn = $('[data-pay]', card);
      if (!o || !(o.cap > 0)) return;
      if (tag) { tag.hidden = false; tag.textContent = o.free ? 'Вільно ' + o.free + ' із ' + o.cap : 'Місць немає'; tag.classList.toggle('is-low', o.free <= 2); }
      if (btn) { btn.disabled = !o.free; btn.textContent = o.free ? 'Оплатити' : 'Місць немає'; }
    });
    // розклад: разове заняття займає місце лише свого дня
    each('.rows [data-order^="single:"]', function (btn) {
      var p = btn.getAttribute('data-order').split(':'), o = offers[p[1]];
      if (!o || !(o.cap > 0)) return;
      var free = o.single && o.single[p[2]];
      if (free == null || free < 0) return;
      var row = btn.closest('.row'), tag = row && $('.row__free', row);
      if (row && !tag) { tag = document.createElement('span'); tag.className = 'row__free'; ($('.row__m', row) || row).append(tag); }
      if (tag) { tag.textContent = free ? 'Вільно ' + free : 'Місць немає'; tag.classList.toggle('is-low', free <= 2); }
      btn.disabled = !free;
      btn.textContent = free ? 'Оплатити' : 'Місць немає';
    });
  }
  window.ADS = window.ADS || {};
  window.ADS.loadOffers = function () {
    var api = document.body.getAttribute('data-api');
    if (!api || !$('.plan[data-group], .rows, [data-events]')) return;
    fetch(api + '?api=groups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        offers = j.groups; evSpots = j.events || {};
        try { localStorage.setItem(SPOTS, JSON.stringify({ g: offers, e: evSpots })); } catch (e) { /* немає сховища */ }
        paintOffers();
      })
      .catch(function () { /* бота не чути — лишається місячна ціна з адмінки */ });
  };

  /* біографія: «16 років — студії в Полтаві», кожен рядок — окремий факт */
  function paintFacts(T) {
    each('[data-facts]', function (ul) {
      var src = String(T[ul.getAttribute('data-facts')] || '').trim();
      if (!src) return;
      ul.innerHTML = src.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
        var m = l.split(/\s*[—|–-]\s+|\s*\|\s*/);
        return '<li><b>' + esc(m[0]) + '</b>' + (m.length > 1 ? '<span>' + esc(m.slice(1).join(' ')) + '</span>' : '') + '</li>';
      }).join('');
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
      paintEvents(by.therapy_events || []);
      paintTexts(data.texts || {});
      paintDocs(data.texts || {});
      paintFacts(data.texts || {});
      paintPhotos(by.site_photos || []);
      paintOffers();
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
    get('/items?site_id=eq.' + SITE + '&collection=in.(groups,consults,records,site_photos,therapy_events)&select=collection,title,text,price,image_url,extra&order=sort_order'),
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
