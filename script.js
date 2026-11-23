(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const canHover = matchMedia('(hover: hover)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* шапка стає щільною після першого екрана */
  const hd = $('#hd');
  const onScroll = () => hd.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* меню на телефоні */
  const menuBtn = $('#menuBtn'), mnav = $('#mnav');
  const setMenu = (open) => {
    mnav.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.innerHTML = `<svg><use href="#i-${open ? 'close' : 'menu'}"/></svg>`;
    document.body.style.overflow = open ? 'hidden' : '';
    hd.classList.toggle('is-solid', open || scrollY > 40);
  };
  menuBtn.addEventListener('click', () => setMenu(mnav.hidden));
  $$('a', mnav).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* прожектор над заголовком головної: за курсором, а без мишки — сам блукає */
  const hero = $('#hero'), title = $('#heroT');
  if (title) {
    const lit = $('.t-lit', title);
    let idle;
    const auto = () => { if (!calm) title.classList.add('is-auto'); };
    auto();
    if (canHover) {
      let raf = 0, x = 0, y = 0;
      hero.addEventListener('pointermove', (e) => {
        x = e.clientX; y = e.clientY;
        title.classList.remove('is-auto');
        clearTimeout(idle);
        idle = setTimeout(auto, 2500);
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = lit.getBoundingClientRect();
          const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
          title.style.setProperty('--lx', cl((x - r.left) / r.width * 100, 0, 100).toFixed(1) + '%');
          title.style.setProperty('--ly', cl((y - r.top) / r.height * 100, 10, 90).toFixed(1) + '%');
        });
      });
    }
  }

  /* світло на картках і кнопках (делегуванням — працює й для карток, перебудованих з адмінки) */
  if (canHover) {
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('[data-spot]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* поява при гортанні */
  const io = new IntersectionObserver((ents) => {
    ents.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      if (en.target.id === 'phone') en.target.classList.add('is-on');
      io.unobserve(en.target);
    });
  }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
  $$('.rv').forEach((el) => {
    const sib = el.parentElement ? [...el.parentElement.children].filter(c => c.classList.contains('rv')) : [];
    const n = sib.indexOf(el);
    if (n > 0) el.style.transitionDelay = Math.min(n * 70, 420) + 'ms';
    io.observe(el);
  });

  /* телефон з ботом стоїть на місці, а повідомлення в ньому з'являються по черзі */
  const phone = $('#phone');
  if (phone) io.observe(phone);

  /* абонементи на телефоні: смужки під картками показують, яка відкрита */
  const plans = $('.plans');
  let buildDots = () => {};
  if (plans) {
    const dots = document.createElement('div');
    dots.className = 'plans__dots';
    dots.setAttribute('aria-hidden', 'true');
    plans.after(dots);
    let list = [];
    const padL = () => parseFloat(getComputedStyle(plans).paddingLeft) || 0;
    const mark = () => {
      const left = plans.getBoundingClientRect().left + padL();
      let best = 0, dist = Infinity;
      list.forEach((card, i) => {
        const d = Math.abs(card.getBoundingClientRect().left - left);
        if (d < dist) { dist = d; best = i; }
      });
      $$('button', dots).forEach((d, i) => d.classList.toggle('is-on', i === best));
    };
    const build = () => {
      list = $$('.plan', plans).sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
      dots.innerHTML = list.map(() => '<button type="button" tabindex="-1"></button>').join('');
      $$('button', dots).forEach((d, i) => d.addEventListener('click', () => {
        const shift = list[i].getBoundingClientRect().left - plans.getBoundingClientRect().left - padL();
        plans.scrollTo({ left: plans.scrollLeft + shift, behavior: 'smooth' });
      }));
      mark();
    };
    let raf = 0;
    plans.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; mark(); }); }, { passive: true });
    addEventListener('resize', build);
    build();
    buildDots = build;
  }

  /* розклад: вкладки днів тижня, відкривається сьогоднішній */
  const showDay = (d) => {
    $$('.day').forEach(b => b.setAttribute('aria-selected', String(b.dataset.day === String(d))));
    $$('.rows[data-day]').forEach(p => { p.hidden = p.dataset.day !== String(d); });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.day');
    if (b) showDay(b.dataset.day);
  });
  // Сьогоднішній день, а якщо сьогодні занять немає — найближчий наступний
  const openToday = () => {
    const have = $$('.day').map(b => Number(b.dataset.day));
    if (!have.length) return;
    const today = new Date().getDay();
    for (let i = 0; i < 7; i++) {
      const d = (today + i) % 7;
      if (have.includes(d)) { showDay(d); return; }
    }
  };
  openToday();

  // «Або одне заняття» в картці групи: відкриваємо в розкладі найближчий день цієї групи й підсвічуємо рядок
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-onegroup]');
    if (!a) return;
    const btns = $$('.rows [data-order^="single:' + a.dataset.onegroup + ':"]');
    if (!btns.length) return;
    const have = btns.map(b => Number(b.dataset.order.split(':')[2]));
    const today = new Date().getDay();
    let d = have[0];
    for (let i = 0; i < 7; i++) { const x = (today + i) % 7; if (have.includes(x)) { d = x; break; } }
    showDay(d);
    const row = btns[have.indexOf(d)].closest('.row');
    row.classList.toggle('is-flash', false);
    void row.offsetWidth;
    row.classList.add('is-flash');
  });

  // platform.js перебудував картки з адмінки — оновлюємо смужки й відкриваємо сьогоднішній день
  window.ADS = Object.assign(window.ADS || {}, { refresh: () => { buildDots(); openToday(); } });

  /* кнопка «Написати» в кутку (лише на комп'ютері): після першого екрана,
     ховається біля розкладу, контактів і підвалу */
  const fab = $('#fab');
  const top = hero || $('.phead');
  if (fab && top) {
    let topOn = true;
    const near = new Map();
    const upd = () => fab.classList.toggle('is-on', !topOn && ![...near.values()].some(Boolean));
    new IntersectionObserver(([e]) => { topOn = e.isIntersecting; upd(); }).observe(top);
    const endIo = new IntersectionObserver((ents) => { ents.forEach(e => near.set(e.target, e.isIntersecting)); upd(); });
    [$('.days') && $('.days').parentElement, $('.free'), $('#contact'), $('.ft')].forEach(el => el && endIo.observe(el));
  }

  /* оплата: та сама форма для підписки, заняття, консультації й запису.
     Замовлення йде в бота (функція tg-alexdance), він відповідає посиланням t.me/<бот>?start=<код>. */
  const API = document.body.dataset.api || '';
  const post = async (what, body) => {
    const r = await fetch(`${API}?api=${what}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || r.status);
    return j;
  };
  const errBox = (form) => {
    let el = $('.form__err', form);
    if (!el) { el = document.createElement('p'); el.className = 'form__err'; el.hidden = true; form.append(el); }
    return el;
  };
  const pay = $('#pay'), p1 = $('#pay1'), p2 = $('#pay2');
  let current = null;

  /* консультація: день і час обирають тут, до оплати. Вільний час дає бот (лише мітки часу, без імен) */
  const when = $('#payWhen');
  let whenList = [], whenAt = null, whenDay = null;
  const KYIV = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const WD = { Sun: 'Нд', Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб' };
  const MON = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  const MONG = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const kp = (ms) => { const p = {}; KYIV.formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; }); return p; };
  const dayKey = (ms) => { const p = kp(ms); return `${p.year}-${p.month}-${p.day}`; };
  const whenLabel = (ms) => { const p = kp(ms); return `${WD[p.weekday].toLowerCase()}, ${+p.day} ${MONG[+p.month - 1]} о ${p.hour}:${p.minute}`; };
  const isConsult = () => (current?.dataset.order || '').startsWith('consult:');
  const whenMeta = () => { $('#payMeta').textContent = whenAt ? `${whenLabel(whenAt)} · онлайн у Zoom` : current.dataset.meta; };
  function whenPaint(sel) {
    const days = [...new Set(whenList.map(dayKey))];
    whenDay = days.includes(sel) ? sel : days[0];
    $('#whenDays').innerHTML = days.map(k => {
      const p = kp(whenList.find(ms => dayKey(ms) === k));
      return `<button type="button" class="when__d" data-wd="${k}" aria-selected="${k === whenDay}">${WD[p.weekday]}<b>${+p.day}</b>${MON[+p.month - 1]}</button>`;
    }).join('');
    $('#whenTimes').innerHTML = whenList.filter(ms => dayKey(ms) === whenDay).map(ms => {
      const p = kp(ms);
      return `<button type="button" class="when__t" data-wt="${ms}" aria-selected="${ms === whenAt}">${p.hour}:${p.minute}</button>`;
    }).join('');
  }
  async function whenLoad(msg) {
    whenList = []; whenAt = null;
    when.classList.remove('is-bad');
    when.hidden = false;
    $('#whenDays').innerHTML = ''; $('#whenTimes').innerHTML = '';
    const note = $('#whenNote');
    note.textContent = 'Завантажую вільний час…'; note.hidden = false;
    try {
      const r = await fetch(`${API}?api=times`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json();
      whenList = (j.times || []).map(Number).filter(Boolean);
    } catch { whenList = []; }
    if (!isConsult()) return;
    if (!whenList.length) {
      // годин не вписано або все зайнято — оплата без часу, Олександра узгодить у боті
      when.hidden = true;
      $('#payAfter').textContent = 'Олександра напише тобі в боті, щоб узгодити час, і надішле посилання на Zoom.';
      return;
    }
    note.textContent = msg || ''; note.hidden = !msg;
    whenPaint();
    whenMeta();
  }
  when.addEventListener('click', (e) => {
    const d = e.target.closest('[data-wd]');
    if (d) { whenPaint(d.dataset.wd); return; }
    const t = e.target.closest('[data-wt]');
    if (t) { whenAt = Number(t.dataset.wt); when.classList.remove('is-bad'); $('#whenNote').hidden = true; whenPaint(whenDay); whenMeta(); }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-pay]');
    if (!b) return;
    current = b;
    errBox($('#payForm')).hidden = true;
    $('#payKind').textContent = b.dataset.kind;
    $('#payTitle').textContent = b.dataset.title;
    $('#payMeta').textContent = b.dataset.meta;
    const sub = b.hasAttribute('data-sub');
    const price = b.dataset.price.replace('/міс', '').replace(/ /g, ' ');
    $('#payBtn').textContent = sub ? 'Оформити підписку ·' : 'Оплатити';
    $('#payPrice').textContent = b.dataset.price;
    $('#payAfter').textContent = b.dataset.after;
    $('#payDone').textContent = sub ? 'Підписку оформлено' : 'Оплачено';
    const agree = $('#paySub');
    agree.hidden = !sub;
    agree.classList.remove('is-bad');
    $('input', agree).required = sub;
    $('input', agree).checked = false;
    $('#paySubPrice').textContent = price;
    // згода з офертою — щоразу заново
    const offer = $('#payAgree');
    if (offer) { offer.classList.remove('is-bad'); $('input', offer).checked = false; }
    p1.hidden = false; p2.hidden = true;
    whenAt = null;
    if (isConsult()) whenLoad(); else when.hidden = true;
    pay.showModal();
  });
  $$('[data-close]', pay).forEach(b => b.addEventListener('click', () => pay.close()));
  pay.addEventListener('click', (e) => { if (e.target === pay) pay.close(); });

  const check = (form) => {
    let ok = true;
    $$('[required]', form).forEach(inp => {
      const bad = inp.type === 'checkbox' ? !inp.checked : !inp.value.trim();
      inp.closest('.fld, .chk').classList.toggle('is-bad', bad);
      if (bad && ok) { inp.focus(); ok = false; }
    });
    return ok;
  };
  $('#payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!check(form)) return;
    const [kind, item, day] = (current?.dataset.order || '').split(':');
    const btn = $('button[type=submit]', form), err = errBox(form);
    if (isConsult() && !when.hidden && !whenAt) {
      when.classList.add('is-bad');
      err.textContent = 'Оберіть день і час консультації.';
      err.hidden = false;
      return;
    }
    btn.disabled = true; err.hidden = true;
    try {
      const j = await post('order', { kind, item, day, at: isConsult() && whenAt ? whenAt : undefined, name: form.elements.name.value, phone: form.elements.phone.value, tg: form.elements.tg.value });
      if (isConsult() && whenAt) {
        const w = whenLabel(whenAt);
        $('#payAfter').textContent = `${w[0].toUpperCase() + w.slice(1)}. Бот одразу надішле посилання на Zoom і нагадає за годину до початку.`;
      }
      const go = $('#pay2 .btn');
      go.href = j.bot; go.target = '_blank'; go.rel = 'noopener';
      $('.pay__demo', p2).hidden = !j.test;
      p1.hidden = true; p2.hidden = false;
    } catch (e) {
      if (String(e.message) === 'time') {
        await whenLoad('Цей час щойно зайняли — оберіть інший.');
      } else {
        err.textContent = 'Не вдалося оформити. Спробуй ще раз або напиши нам у Telegram.';
        err.hidden = false;
      }
    } finally {
      btn.disabled = false;
    }
  });

  /* форма звʼязку: заявка приходить студії в Telegram */
  const form = $('#form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!check(form)) return;
      const btn = $('button[type=submit]', form), err = errBox(form);
      btn.disabled = true; err.hidden = true;
      try {
        await post('lead', { name: form.elements.name.value, contact: form.elements.contact.value, msg: form.elements.msg.value });
        form.reset();
        $('.form__ok', form).hidden = false;
      } catch {
        err.textContent = 'Не вдалося надіслати. Спробуй ще раз або напиши нам у Telegram.';
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* Telegram студії ще невідомий */
  $$('[data-tg]').forEach(a => a.addEventListener('click', (e) => {
    if (a.getAttribute('href') === '#') e.preventDefault();
  }));
})();
