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

  /* ---------- Intro: she peeks in, walks to the greeting, waves, then hops down ---------- */
  const caption = $('#caption');
  const captionText = $('#caption-text');
  const LINES = [
    "Hey, that's me!",
    "I'm Hailey. I run the plan, and I build with AI."
  ];
  const timers = [];
  const anims = [];
  const main = $('#top');
  const figure = $('#figure');
  const avatarSrc = $('#avatar');
  const pill = $('.hello p');
  let walker = null;
  let ended = false;

  function say(text) {
    captionText.textContent = text;
    caption.classList.add('has-text');
    caption.classList.remove('pop');
    void caption.offsetWidth; // restart the pop animation
    caption.classList.add('pop');
  }

  // Ends the intro right now (visitor acted, or the voice greeting took over).
  function finishIntro() {
    ended = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    anims.forEach((a) => { try { a.cancel(); } catch (_) {} });
    anims.length = 0;
    if (walker) { walker.remove(); walker = null; }
    root.classList.add('skip-intro', 'intro-done');
    if (pill) pill.classList.remove('wiggle');
    captionText.textContent = LINES[1];
    caption.classList.add('has-text');
  }

  const wait = (ms) => new Promise((res) => timers.push(setTimeout(res, ms)));

  async function runIntro() {
    if (ended) return;
    await Promise.race([document.fonts ? document.fonts.ready : null, wait(1500)]);
    await wait(500);
    if (ended) return;
    if (scrollY > 40 || !figure || !pill || !main || !avatarSrc) { finishIntro(); return; }

    const mb = main.getBoundingClientRect();
    const fb = figure.getBoundingClientRect();
    const W = fb.width, H = fb.height;
    walker = document.createElement('div');
    walker.className = 'walker';
    walker.setAttribute('aria-hidden', 'true');
    walker.style.width = W + 'px';
    walker.style.height = H + 'px';
    const svg = avatarSrc.cloneNode(true);
    svg.removeAttribute('id');
    walker.appendChild(svg);
    main.appendChild(walker);

    const pb = pill.getBoundingClientRect();
    const s0 = Math.min(0.42, Math.max(0.28, (pb.height * 2.2) / H));
    const half = (W * s0) / 2;
    const feetY = pb.top - mb.top + pb.height / 2 + (H * s0) / 2;
    let standX = pb.left - mb.left - half - 18;
    if (standX < half + 8) standX = half + 10; // narrow screens: stand at the greeting's left end
    const tf = (x, y, sx, sy, rot) =>
      'translate(' + (x - W / 2) + 'px,' + (y - H) + 'px) rotate(' + (rot || 0) + 'deg) scale(' + sx + ',' + sy + ')';
    const go = (frames, opts) => {
      if (ended) return Promise.reject(new Error('ended'));
      const a = walker.animate(frames, Object.assign({ fill: 'forwards' }, opts));
      anims.push(a);
      return a.finished;
    };
    const cls = (name, on) => svg.classList.toggle(name, on);

    try {
      // 1. Peek: slide in until about half of her is showing, and look around
      await go(
        [{ transform: tf(-half - 24, feetY, s0, s0, 0), opacity: 1 }, { transform: tf(4, feetY, s0, s0, 9), opacity: 1 }],
        { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      );
      cls('peeking', true);
      await wait(900);
      cls('peeking', false);

      // 2. Walk over to the greeting
      cls('walking', true);
      const dist = Math.abs(standX - 4);
      await go(
        [{ transform: tf(4, feetY, s0, s0, 9), opacity: 1 }, { transform: tf(standX, feetY, s0, s0, 0), opacity: 1 }],
        { duration: Math.min(2800, Math.max(1500, dist * 4.2)), easing: 'ease-in-out' }
      );
      cls('walking', false);

      // 3. Wave at it
      cls('waving', true);
      timers.push(setTimeout(() => { pill.classList.remove('wiggle'); void pill.offsetWidth; pill.classList.add('wiggle'); }, 350));
      await wait(1600);
      cls('waving', false);

      // 4. Hop down to the hero
      const f2 = figure.getBoundingClientRect();
      const m2 = main.getBoundingClientRect();
      const endX = f2.left - m2.left + W / 2;
      const endY = f2.bottom - m2.top;
      const midX = standX + (endX - standX) * 0.38;
      cls('crouch', true);
      timers.push(setTimeout(() => { cls('crouch', false); cls('air', true); }, 170));
      await go(
        [
          { transform: tf(standX, feetY, s0, s0, 0), offset: 0, easing: 'ease-in-out' },
          { transform: tf(standX, feetY, s0 * 1.1, s0 * 0.84, 0), offset: 0.15, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
          { transform: tf(midX, feetY - 100, s0 * 0.98, s0 * 1.06, -7), offset: 0.42, easing: 'cubic-bezier(0.5, 0, 0.9, 0.55)' },
          { transform: tf(endX, endY, 1, 1, 0), offset: 1 }
        ],
        { duration: 1150 }
      );
      cls('air', false);

      // 5. Land with a squash, wobble, and wave
      cls('landed', true);
      await go(
        [{ transform: tf(endX, endY, 1.08, 0.88, 0) }, { transform: tf(endX, endY, 0.98, 1.03, 3) }, { transform: tf(endX, endY, 1, 1, 0) }],
        { duration: 420, easing: 'ease-out' }
      );
      root.classList.add('intro-done');
      if (avatarSrc) { avatarSrc.classList.add('waving'); }
      walker.remove(); walker = null;
      ended = true;
      timers.push(setTimeout(() => say(LINES[0]), 250));
      timers.push(setTimeout(() => say(LINES[1]), 2500));
    } catch (_) {
      /* cancelled by finishIntro */
    }
  }

  if (reduce) {
    root.classList.add('intro-done');
    captionText.textContent = LINES[1];
    caption.classList.add('has-text');
  } else {
    runIntro();
    // Any real action ends the intro right away.
    const bail = () => {
      if (!ended) finishIntro();
      removeEventListener('wheel', bail);
      removeEventListener('touchmove', bail);
      removeEventListener('keydown', bail);
    };
    addEventListener('wheel', bail, { passive: true });
    addEventListener('touchmove', bail, { passive: true });
    addEventListener('keydown', bail);
  }

  /* ---------- Optional voice greeting: appears only if /audio/hello.mp3 exists ---------- */
  const hear = $('#hear');
  fetch('audio/hello.mp3', { method: 'HEAD' })
    .then((r) => {
      if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) return;
      const audio = new Audio('audio/hello.mp3');
      hear.hidden = false;
      const cues = [];
      hear.addEventListener('click', () => {
        finishIntro();
        cues.forEach(clearTimeout); cues.length = 0;
        audio.currentTime = 0;
        audio.play().catch(() => {});
        // Captions follow the voice: line two begins about 2.35 seconds into the recording.
        say(LINES[0]);
        cues.push(setTimeout(() => say(LINES[1]), 2350));
      });
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

  /* ---------- Resume link: appears only once the PDF is in the repo ---------- */
  const resume = $('#resume');
  if (resume) {
    fetch('Hailey-Cummings-Resume.pdf', { method: 'HEAD' })
      .then((r) => { if (r.ok && (r.headers.get('content-type') || '').includes('pdf')) resume.hidden = false; })
      .catch(() => {});
  }

  /* ---------- Now building: latest repositories from GitHub ---------- */
  const feed = $('#gh-feed');
  if (feed) {
    const ago = (iso) => {
      const d = Math.max(0, Math.round((Date.now() - new Date(iso)) / 864e5));
      if (d < 1) return 'today';
      if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
      const m = Math.round(d / 30);
      return m < 12 ? m + (m === 1 ? ' month ago' : ' months ago') : 'over a year ago';
    };
    fetch('https://api.github.com/users/HaileyCummings/repos?sort=pushed&per_page=12', { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((repos) => {
        const list = repos.filter((r) => !r.fork && r.name.toLowerCase() !== 'pm-arsenal').slice(0, 4);
        if (!list.length) return;
        feed.textContent = '';
        list.forEach((r) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = r.html_url; a.rel = 'noopener'; a.textContent = r.name;
          li.appendChild(a);
          if (r.description) { const p = document.createElement('p'); p.style.margin = '0'; p.textContent = r.description; li.appendChild(p); }
          const m = document.createElement('span');
          m.className = 'gh-meta';
          m.textContent = [r.language, 'updated ' + ago(r.pushed_at)].filter(Boolean).join(' · ');
          li.appendChild(m);
          feed.appendChild(li);
        });
      })
      .catch(() => {});
  }

  /* ---------- Chalkboard: she pulls out a board and sketches the plan ---------- */
  const scene = $('#board-scene');
  const sceneFig = $('#scene-fig');
  if (scene && sceneFig && avatarSrc) {
    const c = avatarSrc.cloneNode(true);
    c.removeAttribute('id');
    c.setAttribute('aria-hidden', 'true');
    const hand = $('.arm-r', c);
    if (hand) {
      const stick = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      stick.setAttribute('class', 'chalk-stick');
      stick.setAttribute('x', '155'); stick.setAttribute('y', '260');
      stick.setAttribute('width', '7'); stick.setAttribute('height', '24'); stick.setAttribute('rx', '2');
      hand.appendChild(stick);
    }
    sceneFig.appendChild(c);
    if (reduce || !('IntersectionObserver' in window)) {
      scene.classList.add('go');
    } else {
      const sio = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { scene.classList.add('go'); sio.disconnect(); } });
      }, { threshold: 0.4 });
      sio.observe(scene);
      setTimeout(() => scene.classList.add('go'), 12000);
    }
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
