(() => {
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Captions (on by default; preference remembered when possible) ---------- */
  const cc = $('#cc');
  const ccState = $('#cc-state');
  let captionsOn = true;
  try { if (localStorage.getItem('captions') === 'off') captionsOn = false; } catch (_) {}

  function paintCaptions() {
    root.classList.toggle('caption-off', !captionsOn);
    cc.setAttribute('aria-pressed', String(captionsOn));
    ccState.textContent = captionsOn ? 'On' : 'Off';
  }
  cc.addEventListener('click', () => {
    captionsOn = !captionsOn;
    try { localStorage.setItem('captions', captionsOn ? 'on' : 'off'); } catch (_) {}
    paintCaptions();
  });
  paintCaptions();

  /* ---------- Intro sequence ---------- */
  const caption = $('#caption');
  const captionText = $('#caption-text');
  const LINES = [
    "Hey, that's me!",
    "I'm Hailey. I run the plan, and I build with AI."
  ];
  const timers = [];

  function say(text) {
    captionText.textContent = text;
    caption.classList.add('has-text');
    caption.classList.remove('pop');
    void caption.offsetWidth; // restart the pop animation
    caption.classList.add('pop');
  }

  function finishIntro() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    root.classList.add('skip-intro');
    captionText.textContent = LINES[1];
    caption.classList.add('has-text');
  }

  if (reduce) {
    captionText.textContent = LINES[1];
    caption.classList.add('has-text');
  } else {
    timers.push(setTimeout(() => say(LINES[0]), 3500));
    timers.push(setTimeout(() => say(LINES[1]), 5700));
    // Any real action ends the intro right away.
    const bail = () => {
      finishIntro();
      removeEventListener('wheel', bail);
      removeEventListener('touchmove', bail);
      removeEventListener('keydown', bail);
    };
    addEventListener('wheel', bail, { passive: true, once: true });
    addEventListener('touchmove', bail, { passive: true, once: true });
    addEventListener('keydown', bail, { once: true });
  }

  /* ---------- Optional voice greeting: appears only if /audio/hello.mp3 exists ---------- */
  const hear = $('#hear');
  fetch('audio/hello.mp3', { method: 'HEAD' })
    .then((r) => {
      if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) return;
      const audio = new Audio('audio/hello.mp3');
      hear.hidden = false;
      hear.addEventListener('click', () => { audio.currentTime = 0; audio.play(); });
    })
    .catch(() => {});

  /* ---------- Skills lens ---------- */
  const ledger = $('#ledger');
  $$('.lens button').forEach((btn) => {
    btn.addEventListener('click', () => {
      ledger.dataset.lens = btn.dataset.lens;
      $$('.lens button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });
  });

  /* ---------- Toolkit: tally and current stage ---------- */
  const tools = $$('.tk-tools li');
  const usedCount = tools.filter((li) => li.dataset.status === 'used').length;
  const tally = $('#tk-tally');
  if (tally) tally.textContent = usedCount + ' of ' + tools.length + ' tools in my work';

  const stageLinks = $$('.tk-steps a');
  if ('IntersectionObserver' in window && stageLinks.length) {
    const byId = new Map(stageLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const tio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        byId.forEach((a, id) => {
          if (id === e.target.id) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    $$('.tk-row').forEach((r) => tio.observe(r));
  }

  /* ---------- Reveals ---------- */
  const revealTargets = [...$$('.row'), ...$$('.tk-row'), ...$$('[data-reveal]')];
  if (reduce || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealTargets.forEach((el) => io.observe(el));
    // Safety net: never leave content hidden.
    setTimeout(() => revealTargets.forEach((el) => el.classList.add('in')), 6000);
  }

  /* ---------- Ask the assistant ---------- */
  const askForm = $('#ask-form');
  if (askForm) {
    const log = $('#ask-log');
    const input = $('#ask-input');
    const send = $('#ask-send');
    const chips = $('#ask-chips');
    const history = [];

    function add(text, kind) {
      const p = document.createElement('p');
      p.className = 'msg msg-' + kind;
      p.textContent = text;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return p;
    }

    async function ask(question) {
      const q = question.trim();
      if (!q) return;
      add(q, 'user');
      history.push({ role: 'user', content: q });
      input.value = '';
      input.disabled = true; send.disabled = true;
      chips.hidden = true;
      const wait = add('Thinking...', 'bot');
      wait.classList.add('msg-wait');
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-8) }),
        });
        const data = await res.json().catch(() => ({}));
        wait.remove();
        if (!res.ok || !data.reply) {
          history.pop();
          add(data.error || 'Something went wrong. Please try again.', 'error');
        } else {
          history.push({ role: 'assistant', content: data.reply });
          add(data.reply, 'bot');
        }
      } catch (_) {
        wait.remove();
        history.pop();
        add('I could not reach the assistant. Please try again.', 'error');
      } finally {
        input.disabled = false; send.disabled = false;
        input.focus();
      }
    }

    askForm.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) ask(b.textContent);
    });
  }

  /* ---------- Guide dock: a small Hailey who says what each section is ---------- */
  const dock = $('#dock');
  const dockFig = $('#dock-fig');
  const dockSay = $('#dock-say');
  const hero = $('.stage');
  const src = $('#avatar');
  if (src && dock) {
    const clone = src.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    dockFig.appendChild(clone);

    let currentLine = '';
    function setLine(text) {
      if (!text || text === currentLine) return;
      currentLine = text;
      if (reduce) { dockSay.textContent = text; return; }
      dockSay.classList.add('swap');
      setTimeout(() => { dockSay.textContent = text; dockSay.classList.remove('swap'); }, 160);
    }

    new IntersectionObserver((entries) => {
      entries.forEach((e) => dock.classList.toggle('on', !e.isIntersecting));
    }, { threshold: 0.35 }).observe(hero);

    const guided = $$('[data-guide]');
    const gio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setLine(e.target.dataset.guide); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    guided.forEach((s) => gio.observe(s));
  }
})();
