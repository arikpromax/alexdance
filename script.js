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

  /* світло на картках і кнопках */
  if (canHover) {
    $$('[data-spot]').forEach(el => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
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
  if (plans) {
    const cards = $$('.plan', plans);
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
      list = cards.slice().sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
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
  }

  /* розклад: вкладки днів тижня, відкривається сьогоднішній */
  const days = $$('.day'), panels = $$('.rows[data-day]');
  if (days.length) {
    const showDay = (d) => {
      days.forEach(b => b.setAttribute('aria-selected', String(b.dataset.day === String(d))));
      panels.forEach(p => { p.hidden = p.dataset.day !== String(d); });
    };
    days.forEach(b => b.addEventListener('click', () => showDay(b.dataset.day)));
    const today = new Date().getDay();
    showDay(today === 0 ? 1 : today);
  }

  /* кнопка «Написати» в кутку: після першого екрана, ховається біля розкладу, контактів і підвалу */
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

  /* оплата (демо): та сама форма для підписки, заняття, консультації й запису */
  const pay = $('#pay'), p1 = $('#pay1'), p2 = $('#pay2');
  $$('[data-pay]').forEach(b => b.addEventListener('click', () => {
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
    p1.hidden = false; p2.hidden = true;
    pay.showModal();
  }));
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
  $('#payForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!check(e.target)) return;
    p1.hidden = true; p2.hidden = false;
  });

  /* форма звʼязку (демо: поки нікуди не відправляє) */
  const form = $('#form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!check(form)) return;
      form.reset();
      $('.form__ok', form).hidden = false;
    });
  }

  /* Telegram студії ще невідомий */
  $$('[data-tg]').forEach(a => a.addEventListener('click', (e) => {
    if (a.getAttribute('href') === '#') e.preventDefault();
  }));
})();
