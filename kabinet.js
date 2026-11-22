// Кабінет студії: міні-застосунок у Telegram. Дані — з функції бота (tg-alexdance?app=…),
// доступ — за підписом Telegram (initData), лише для чатів студії.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TG = window.Telegram?.WebApp;
  const API = document.body.dataset.api;
  const view = $('#view');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;

  if (TG) {
    TG.ready();
    TG.expand();
    try { TG.setHeaderColor('#0b0a10'); TG.setBackgroundColor('#0b0a10'); TG.setBottomBarColor?.('#0b0a10'); } catch { /* старі клієнти */ }
    const u = TG.initDataUnsafe?.user;
    if (u?.first_name) $('#who').textContent = `${u.first_name} · Alex Dance Studio`;
  }
  const haptic = (t = 'success') => { try { TG?.HapticFeedback?.notificationOccurred(t); } catch { /* немає */ } };

  async function api(action, extra = {}) {
    const r = await fetch(`${API}?app=${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: TG?.initData || '', ...extra }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'net' }));
    if (!j.ok) throw Object.assign(new Error(j.error || 'error'), { code: j.error });
    return j;
  }

  let toastT;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function fail(e) {
    if (e.code === 'auth') {
      view.innerHTML = `<div class="msg"><b>Відкрийте кабінет через бота</b><p>У чаті з @Alex_Dance_Bot — кнопка «Кабінет» зліва від поля вводу.</p></div>`;
    } else if (e.code === 'forbidden') {
      view.innerHTML = `<div class="msg"><b>Кабінет лише для студії</b><p>Цей Telegram не підключений до студії.</p></div>`;
    } else {
      view.innerHTML = `<div class="msg"><b>Не вдалося завантажити</b><p>Перевірте інтернет і спробуйте ще раз.</p><button class="btn btn--sm" id="retry" style="margin:16px auto 0">Оновити</button></div>`;
      $('#retry')?.addEventListener('click', () => show(tab));
    }
  }

  // Людина: ім'я, підпис і кнопки «подзвонити» / «написати в Telegram»
  const who = (p, note = '') => `
    <div class="who">
      <div class="who__n"><b>${esc(p.name)}</b>${note ? `<small>${note}</small>` : p.phone ? `<small>${esc(p.phone)}</small>` : ''}</div>
      <div class="who__a">
        ${p.phone ? `<a class="icon" href="tel:${esc(p.phone)}" aria-label="Подзвонити">${icon('phone')}</a>` : ''}
        ${p.username ? `<a class="icon icon--ac" href="https://t.me/${esc(p.username)}" aria-label="Написати в Telegram">${icon('tg')}</a>` : ''}
      </div>
    </div>`;

  /* ---------- Розклад на день ---------- */
  let day = '';
  async function showDay() {
    const d = await api('day', day ? { date: day } : {});
    day = d.date;
    const cards = d.items.map((x) => {
      if (x.kind === 'consult') {
        return `<article class="card cls cls--consult">
          <div class="cls__time">${x.time}<small>Zoom</small></div>
          <div><div class="cls__t">Консультація</div><div class="cls__meta">${esc(x.title)}</div>
            <div class="cls__people">${x.people.map((p) => who(p)).join('')}</div>
            ${x.zoom ? `<a class="btn btn--sm" href="${esc(x.zoom)}" target="_blank" rel="noopener" style="margin-top:8px">${icon('cam')} Відкрити Zoom</a>` : ''}
          </div></article>`;
      }
      const n = x.people.length;
      return `<article class="card cls">
        <div class="cls__time">${x.time}<small>${x.minutes} хв</small></div>
        <div><div class="cls__t">${esc(x.title)}</div>
          <div class="cls__meta"><span class="tag ${n ? '' : 'tag--mute'}">${n ? `${n} ${n === 1 ? 'людина' : n < 5 ? 'людини' : 'людей'}` : 'поки ніхто'}</span>${esc(x.who)}</div>
          ${n ? `<div class="cls__people">${x.people.map((p) => who(p, p.single ? 'разове заняття' : '')).join('')}</div>` : ''}
        </div></article>`;
    }).join('');
    view.innerHTML = `
      <div class="daybar">
        <button class="icon" data-day="${d.prev}" aria-label="Попередній день">${icon('left')}</button>
        <h1 class="h">${esc(d.label)}</h1>
        <button class="icon" data-day="${d.next}" aria-label="Наступний день">${icon('right')}</button>
      </div>
      ${d.isToday ? '' : '<button class="chip today" data-day="">Сьогодні</button>'}
      <div class="sec">${cards || '<div class="empty">Цього дня занять немає</div>'}</div>`;
    $$('[data-day]', view).forEach((b) => b.addEventListener('click', () => { day = b.dataset.day; load(showDay); }));
  }

  /* ---------- Абонементи ---------- */
  let subsGroup = 'all', subsQuery = '';
  async function showSubs() {
    const d = await api('subs');
    const total = d.list.length;
    view.innerHTML = `
      <h1 class="h">Абонементи</h1><p class="sub">Діють зараз: ${total}</p>
      <div class="sec">
        <label class="search">${icon('search')}<input type="search" placeholder="Ім'я або телефон" value="${esc(subsQuery)}" id="q"></label>
        <div class="chips">
          <button class="chip ${subsGroup === 'all' ? 'is-on' : ''}" data-g="all">Усі · ${total}</button>
          ${d.groups.map((g) => `<button class="chip ${subsGroup === g.id ? 'is-on' : ''}" data-g="${g.id}">${esc(g.title)} · ${g.count}</button>`).join('')}
        </div>
        <div class="list" id="subsList"></div>
      </div>`;
    const render = () => {
      const q = subsQuery.toLowerCase().replace(/\s/g, '');
      const rows = d.list.filter((s) => (subsGroup === 'all' || s.group === subsGroup) &&
        (!q || `${s.name}${s.phone}${s.username}`.toLowerCase().replace(/\s/g, '').includes(q)));
      $('#subsList').innerHTML = rows.length ? rows.map((s) => `
        <div class="item">
          <div class="item__m"><b>${esc(s.name)}</b><small>${esc(s.groupTitle)}</small></div>
          <div class="item__r">${s.status === 'cancelled' ? '<span class="tag tag--warn">скасовано</span>' : `<b>${esc(s.amount)}</b>`}<small>до ${esc(s.until)}</small></div>
          ${s.phone ? `<a class="icon" href="tel:${esc(s.phone)}" aria-label="Подзвонити">${icon('phone')}</a>` : ''}
        </div>`).join('') : '<div class="empty">Нікого не знайдено</div>';
    };
    render();
    $('#q').addEventListener('input', (e) => { subsQuery = e.target.value; render(); });
    $$('[data-g]', view).forEach((b) => b.addEventListener('click', () => {
      subsGroup = b.dataset.g;
      $$('[data-g]', view).forEach((x) => x.classList.toggle('is-on', x === b));
      render();
    }));
  }

  /* ---------- Оплати ---------- */
  let ordersKind = 'all';
  const KINDS = [['all', 'Усі'], ['sub', 'Підписки'], ['single', 'Разові'], ['consult', 'Консультації'], ['record', 'Записи']];
  async function showOrders() {
    const d = await api('orders');
    view.innerHTML = `
      <div class="card total"><span>За ${esc(d.monthName)}</span><b>${esc(d.monthTotal)}</b></div>
      <div class="sec">
        <div class="chips">${KINDS.map(([k, t]) => `<button class="chip ${ordersKind === k ? 'is-on' : ''}" data-k="${k}">${t}</button>`).join('')}</div>
        <div class="list" id="ordersList"></div>
      </div>`;
    const render = () => {
      const rows = d.list.filter((o) => ordersKind === 'all' || o.kind === ordersKind);
      $('#ordersList').innerHTML = rows.length ? rows.map((o) => `
        <div class="item">
          <div class="item__m"><span class="tag">${esc(o.kindLabel)}</span><b style="margin-top:6px">${esc(o.title)}</b>
            <small>${esc(o.name)}${o.when ? ` · заняття ${esc(o.when)}` : ''}</small></div>
          <div class="item__r"><b>${esc(o.amount)}</b><small>${esc(o.at)}</small></div>
        </div>`).join('') : '<div class="empty">Оплат поки немає</div>';
    };
    render();
    $$('[data-k]', view).forEach((b) => b.addEventListener('click', () => {
      ordersKind = b.dataset.k;
      $$('[data-k]', view).forEach((x) => x.classList.toggle('is-on', x === b));
      render();
    }));
  }

  /* ---------- Консультації ---------- */
  let consults = [];
  async function showConsults() {
    const d = await api('consults');
    consults = d.list;
    const block = (title, rows) => rows.length ? `<div class="sec"><h2 class="sec__t">${title}</h2>${rows.map(card).join('')}</div>` : '';
    function card(c) {
      return `<article class="card">
        <div class="cons__top">${who(c, esc(c.title)).replace('class="who"', 'class="who" style="padding:0;border:0;flex:1"')}</div>
        <p class="cons__when ${c.at ? '' : 'is-none'}">${c.at ? esc(c.label) : 'Час ще не призначено'}</p>
        <div class="cons__actions">
          ${c.past ? '' : `<button class="btn btn--sm ${c.at ? '' : 'btn--ac'}" data-set="${c.code}">${c.at ? 'Змінити час' : 'Призначити час'}</button>`}
          ${c.zoom ? `<a class="btn btn--sm" href="${esc(c.zoom)}" target="_blank" rel="noopener">${icon('cam')} Zoom</a>` : ''}
        </div>
        ${c.linked ? '' : '<p class="cons__note">Клієнтка ще не відкрила бота — отримає час, щойно відкриє.</p>'}
      </article>`;
    }
    view.innerHTML = `<h1 class="h">Консультації</h1>` + (consults.length
      ? block('Без часу', consults.filter((c) => !c.at)) + block('Заплановані', consults.filter((c) => c.at && !c.past)) + block('Минулі', consults.filter((c) => c.past))
      : '<div class="sec"><div class="empty">Оплачених консультацій поки немає</div></div>');
    $$('[data-set]', view).forEach((b) => b.addEventListener('click', () => openSheet(consults.find((c) => c.code === b.dataset.set))));
  }

  // Київ: дата й час → мс UTC (так само, як на сервері; телефон може бути в іншому часовому поясі)
  const kyivParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function kyivToUtc(y, m, d, h, mi) {
    const want = Date.UTC(y, m - 1, d, h, mi);
    let g = want - 7200000;
    for (let i = 0; i < 3; i++) {
      const p = Object.fromEntries(kyivParts.formatToParts(new Date(g)).map((x) => [x.type, x.value]));
      g += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    }
    return g;
  }
  const kyivNow = () => Object.fromEntries(kyivParts.formatToParts(new Date()).map((x) => [x.type, x.value]));

  let sheetCode = '';
  function openSheet(c) {
    sheetCode = c.code;
    const f = $('#sheetForm');
    $('#sheetTitle').textContent = c.at ? 'Змінити час' : 'Призначити час';
    $('#sheetSub').textContent = `${c.name} · ${c.title}`;
    const n = kyivNow();
    f.date.min = `${n.year}-${n.month}-${n.day}`;
    if (c.at) {
      const p = Object.fromEntries(kyivParts.formatToParts(new Date(c.at)).map((x) => [x.type, x.value]));
      f.date.value = `${p.year}-${p.month}-${p.day}`;
      f.time.value = `${p.hour}:${p.minute}`;
    } else {
      f.date.value = `${n.year}-${n.month}-${n.day}`;
      f.time.value = '';
    }
    f.zoom.value = c.zoom || '';
    $('#sheet').hidden = false;
  }
  const closeSheet = () => { $('#sheet').hidden = true; };
  $$('[data-close]', $('#sheet')).forEach((b) => b.addEventListener('click', closeSheet));
  $('#sheetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.date.value || !f.time.value) { toast('Оберіть дату й час'); return; }
    const zoom = f.zoom.value.trim();
    if (zoom && !/^https?:\/\/\S+$/.test(zoom)) { toast('Посилання на Zoom має починатися з https://'); return; }
    const [y, m, d] = f.date.value.split('-').map(Number);
    const [h, mi] = f.time.value.split(':').map(Number);
    const btn = $('button[type=submit]', f);
    btn.disabled = true;
    try {
      const r = await api('setConsult', { code: sheetCode, at: kyivToUtc(y, m, d, h, mi), zoom });
      haptic();
      closeSheet();
      toast(r.sent ? 'Збережено й надіслано клієнтці' : 'Збережено — клієнтка отримає, щойно відкриє бота');
      load(showConsults);
    } catch (err) {
      toast(err.code === 'date' ? 'Ця дата вже минула' : 'Не вдалося зберегти');
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Ще: написати групі, записи ---------- */
  let sendGroup = '';
  async function showMore() {
    const [subs, recs] = await Promise.all([api('subs'), api('records')]);
    const people = (g) => g === 'all' ? new Set(subs.list.map((s) => s.name + s.phone)).size : (subs.groups.find((x) => x.id === g)?.count ?? 0);
    view.innerHTML = `
      <h1 class="h">Написати групі</h1>
      <p class="sub">Повідомлення прийде в бот усім, у кого діє абонемент.</p>
      <div class="sec">
        <div class="chips">
          ${subs.groups.map((g) => `<button class="chip ${sendGroup === g.id ? 'is-on' : ''}" data-sg="${g.id}">${esc(g.title)} · ${g.count}</button>`).join('')}
          <button class="chip ${sendGroup === 'all' ? 'is-on' : ''}" data-sg="all">Усім · ${people('all')}</button>
        </div>
        <label class="field"><span>Текст</span><textarea id="sgText" placeholder="Наприклад: сьогодні заняття о 19:30"></textarea></label>
        <button class="btn btn--ac" id="sgSend" style="margin-top:12px">Надіслати</button>
      </div>
      <div class="sec">
        <h1 class="h">Записи</h1>
        <p class="sub">Посилання, яке бот надсилає після оплати. Ті, хто вже оплатив і чекає, отримають його одразу.</p>
        ${recs.list.map((r) => `
          <div class="card" style="margin-top:12px">
            <b>${esc(r.title)}</b> ${r.url ? '<span class="tag">є посилання</span>' : '<span class="tag tag--warn">немає посилання</span>'}
            <label class="field"><span>Посилання</span><input type="url" inputmode="url" value="${esc(r.url)}" placeholder="https://t.me/+…" data-rec="${r.id}"></label>
            <button class="btn btn--sm" data-save="${r.id}" style="margin-top:10px">Зберегти</button>
          </div>`).join('')}
      </div>`;
    $$('[data-sg]', view).forEach((b) => b.addEventListener('click', () => {
      sendGroup = b.dataset.sg;
      $$('[data-sg]', view).forEach((x) => x.classList.toggle('is-on', x === b));
    }));
    $('#sgSend').addEventListener('click', () => {
      const text = $('#sgText').value.trim();
      if (!sendGroup) { toast('Оберіть групу'); return; }
      if (!text) { toast('Напишіть текст'); return; }
      const n = people(sendGroup);
      if (!n) { toast('У цій групі поки немає нікого з абонементом'); return; }
      const go = async (yes) => {
        if (!yes) return;
        try {
          const r = await api('send', { group: sendGroup, text });
          haptic();
          $('#sgText').value = '';
          toast(`Надіслано: ${r.sent}`);
        } catch { toast('Не вдалося надіслати'); }
      };
      const q = `Надіслати повідомлення ${n} ${n === 1 ? 'людині' : 'людям'}?`;
      if (TG?.showConfirm) TG.showConfirm(q, go); else go(confirm(q));
    });
    $$('[data-save]', view).forEach((b) => b.addEventListener('click', async () => {
      const url = $(`[data-rec="${b.dataset.save}"]`, view).value.trim();
      if (!/^https?:\/\/\S+$/.test(url)) { toast('Посилання має починатися з https://'); return; }
      b.disabled = true;
      try {
        const r = await api('setRecord', { id: b.dataset.save, url });
        haptic();
        toast(r.sent ? `Збережено. Надіслано тим, хто чекав: ${r.sent}` : 'Збережено');
        load(showMore);
      } catch { toast('Не вдалося зберегти'); } finally { b.disabled = false; }
    }));
  }

  /* ---------- вкладки ---------- */
  const SCREENS = { day: showDay, subs: showSubs, orders: showOrders, consults: showConsults, more: showMore };
  let tab = 'day';
  async function load(fn) {
    if (!view.children.length) view.innerHTML = '<div class="load">Завантаження…</div>';
    try { await fn(); } catch (e) { fail(e); }
  }
  function show(name) {
    tab = name;
    $$('.tab').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === name));
    view.innerHTML = '<div class="load">Завантаження…</div>';
    window.scrollTo(0, 0);
    load(SCREENS[name]);
  }
  $$('.tab').forEach((b) => b.addEventListener('click', () => { try { TG?.HapticFeedback?.selectionChanged(); } catch { /* немає */ } show(b.dataset.tab); }));
  show('day');
})();
