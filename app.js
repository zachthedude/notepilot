(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 900px)');
  let last = null;

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  // ---- Feature explorer: scroll (or chip click) picks a step; the sample notice highlights it ----
  const EXPLORE = [
    { chip: 'Notice', word: 'notices.', text: 'Paste any public notice. It stays in your browser; nothing is uploaded or saved.' },
    { chip: 'Requirements', word: 'requirements.', text: 'Deadlines, fees, required documents, eligibility rules and contacts, each marked where it appears.' },
    { chip: 'Sources', word: 'sources.', text: 'Every item keeps the exact sentence it came from, with its line number. No quote, no item.' },
    { chip: 'Conflicts', word: 'conflicts.', text: 'Two dates for one deadline get flagged. NoticePilot tells you to confirm with the issuer instead of picking one.' },
    { chip: 'Eligibility', word: 'eligibility.', text: 'Answer up to three questions. Each rule comes back as match, no match or unknown.' },
    { chip: 'Checklist', word: 'checklist.', text: 'Conflicts first, then deadlines, documents, fees and contacts, ready to copy.' },
  ];
  // Which explorer steps light up each sample line (first matching pattern wins).
  const STEP_TAGS = [
    [/deadline/i, '2 3 4'],
    [/fee/i, '2'],
    [/Required documents/i, '2'],
    [/Eligibility|enrolled/i, '3 5'],
    [/Contact/i, '2'],
  ];
  let current = 0;

  function buildExplorer() {
    SAMPLE_NOTICE.split('\n').forEach(line => {
      const p = el('p', line, 'line');
      const tag = STEP_TAGS.find(([re]) => re.test(line));
      p.dataset.steps = tag ? tag[1] : '';
      $('stage-text').append(p);
    });
    NP.run(SAMPLE_NOTICE, { gpa: 3.7, age: 24, level: 'undergraduate' }).plan
      .forEach(s => $('stage-plan').append(el('li', s)));
    EXPLORE.forEach((s, i) => {
      const b = el('button', s.chip, 'chip');
      b.type = 'button';
      b.addEventListener('click', () => goToStep(i));
      $('chips').append(b);
    });
    setStep(1, true);
  }

  function setStep(n, instant) {
    current = n;
    const s = EXPLORE[n - 1];
    $('stage').dataset.step = n;
    document.querySelectorAll('#stage-text .line').forEach(p =>
      p.classList.toggle('on', (' ' + p.dataset.steps + ' ').includes(' ' + n + ' ')));
    document.querySelectorAll('.chip').forEach((c, i) => c.setAttribute('aria-current', String(i === n - 1)));
    $('explore-desc').textContent = s.text;
    $('ghost-word').textContent = s.word;
    const word = $('explore-word');
    if (instant || reduceMotion) { word.textContent = s.word; return; }
    word.classList.add('swap');
    setTimeout(() => { word.textContent = s.word; word.classList.remove('swap'); }, 180);
  }

  function segment() {
    const sec = $('explore');
    return (sec.offsetHeight - innerHeight) / EXPLORE.length;
  }

  function goToStep(i) {
    if (narrow.matches) { setStep(i + 1); return; }
    const sec = $('explore');
    scrollTo({ top: sec.offsetTop + segment() * i + 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('progress').style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
    if (narrow.matches) return;
    const top = -$('explore').getBoundingClientRect().top;
    const i = Math.min(EXPLORE.length - 1, Math.max(0, Math.floor(top / segment())));
    if (i + 1 !== current) setStep(i + 1);
  }

  // ---- Hero: the logo tilts toward the pointer ----
  function initHero() {
    const hero = $('top'), plane = document.querySelector('.plane');
    if (reduceMotion || !plane) return;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      plane.style.setProperty('--ry', (x * 14).toFixed(1) + 'deg');
      plane.style.setProperty('--rx', (-y * 10).toFixed(1) + 'deg');
      plane.style.setProperty('--rz', (-6 + x * 4).toFixed(1) + 'deg');
    });
    hero.addEventListener('pointerleave', () => ['--rx', '--ry', '--rz'].forEach(v => plane.style.removeProperty(v)));
  }

  // ---- Demo ----
  function profile() {
    const g = $('gpa').value, a = $('age').value, l = $('level').value.trim().toLowerCase();
    return { gpa: g === '' ? null : Number(g), age: a === '' ? null : Number(a), level: l || null };
  }

  function render(r) {
    $('status').textContent = r.notice.trim()
      ? `${r.items.length} items found, ${r.rejected.length} dropped because they couldn't be quoted.`
      : 'Paste a notice or load the sample to see results here.';

    const items = $('items');
    items.replaceChildren();
    r.items.forEach(it => {
      const li = el('li');
      li.append(el('strong', it.label + ': '));
      li.append(el('span', Array.isArray(it.value) ? it.value.join(', ') : String(it.value)));
      const v = r.verdicts.find(x => x.itemId === it.id);
      if (v) li.append(el('span', v.status.replace('_', ' '), 'badge ' + v.status));
      li.append(el('blockquote', `"${it.quote}" (line ${it.line})`));
      items.append(li);
    });
    if (!r.items.length) items.append(el('li', r.notice.trim() ? 'Nothing found that could be quoted.' : 'Nothing yet.', 'muted'));

    const conflicts = $('conflicts');
    conflicts.replaceChildren();
    if (!r.conflicts.length) conflicts.append(el('li', 'No conflicts found.', 'muted'));
    r.conflicts.forEach(c => conflicts.append(el('li',
      `Two ${c.label} dates: ${c.values.join(' and ')}. Confirm with the issuer; NoticePilot does not pick one.`, 'warn')));

    const plan = $('plan');
    plan.replaceChildren();
    r.plan.forEach(s => plan.append(el('li', s)));
    if (!r.plan.length) plan.append(el('li', 'Your checklist appears here.', 'muted'));
  }

  function analyze() {
    last = NP.run($('notice').value, profile());
    render(last);
  }

  function loadSample() {
    $('notice').value = SAMPLE_NOTICE;
    analyze();
  }

  $('analyze').addEventListener('click', analyze);
  $('sample').addEventListener('click', loadSample);
  ['gpa', 'age', 'level'].forEach(id => $(id).addEventListener('input', analyze));

  $('copy').addEventListener('click', async () => {
    const header = 'NoticePilot checklist (rule-based; confirm with the issuer)\n';
    const text = header + (last ? last.plan : []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    let msg = 'Copied.';
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      msg = 'Copy failed. Select the list and copy it manually.';
    }
    $('copied').textContent = msg;
  });

  // ---- Guided tour: a spotlight walks through each control ----
  const ensureSample = () => { if (!$('notice').value.trim()) loadSample(); };
  const TOUR = [
    { sel: '.top', title: 'Your flight plan', body: 'This bar stays with you. Jump to how it works, try it, or restart this tour any time.' },
    { sel: '#chips', title: 'Explore the features', body: 'Each chip is one thing NoticePilot finds. Scroll, or click a chip, and the sample notice lights up where it appears.', scroll: () => scrollTo({ top: $('explore').offsetTop, behavior: 'auto' }) },
    { sel: '#notice', title: 'Paste a notice here', body: 'Any scholarship or exam notice as plain text. It never leaves this page.' },
    { sel: '#sample', title: 'Or use the sample', body: 'The sample is an invented scholarship notice with one deliberate deadline conflict.', action: { label: 'Load it for me', run: loadSample } },
    { sel: '#fields', title: 'Add your details', body: 'Optional. Skip one and that rule stays unknown; NoticePilot never guesses.', before: ensureSample },
    { sel: '#items-panel', title: 'Every item has a quote', body: 'Each deadline, fee and rule shows the exact sentence and line it came from.', before: ensureSample },
    { sel: '#conflicts-panel', title: 'Conflicts are flagged', body: 'When a notice gives two dates for one deadline, you are told to confirm with the issuer.', before: ensureSample },
    { sel: '#plan-panel', title: 'Copy your checklist', body: 'An ordered list you can paste into notes or a message. That is the whole flow.', before: ensureSample },
  ];
  let ti = -1, tourTarget = null, opener = null;

  function placeTour() {
    if (ti < 0 || !tourTarget) return;
    const r = tourTarget.getBoundingClientRect(), pad = 8;
    const spot = $('tour-spot'), card = $('tour-card');
    Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 16;
    let top = r.bottom + pad + gap;
    if (top + ch > innerHeight - 16) top = r.top - pad - gap - ch;
    if (top < 16) top = Math.min(innerHeight - ch - 16, Math.max(16, r.top + 16));
    const left = Math.min(innerWidth - cw - 16, Math.max(16, r.left));
    Object.assign(card.style, { left: left + 'px', top: top + 'px' });
  }

  function showTour(i) {
    ti = i;
    const s = TOUR[i];
    if (s.before) s.before();
    tourTarget = document.querySelector(s.sel);
    if (s.scroll) s.scroll();
    else if (s.sel !== '.top') tourTarget.scrollIntoView({ block: 'center', behavior: 'auto' });
    $('tour-count').textContent = `Stop ${i + 1} of ${TOUR.length}`;
    $('tour-title').textContent = s.title;
    $('tour-body').textContent = s.body;
    $('tour-fill').style.width = ((i + 1) / TOUR.length * 100) + '%';
    $('tour-back').disabled = i === 0;
    $('tour-next').textContent = i === TOUR.length - 1 ? 'Finish' : 'Next';
    const act = $('tour-act');
    act.hidden = !s.action;
    if (s.action) act.textContent = s.action.label;
    $('tour-spot').hidden = false;
    $('tour-card').hidden = false;
    requestAnimationFrame(placeTour);
    $('tour-next').focus();
  }

  function startTour(e) { opener = e && e.currentTarget; showTour(0); }
  function endTour() {
    ti = -1; tourTarget = null;
    $('tour-spot').hidden = true;
    $('tour-card').hidden = true;
    if (opener) opener.focus();
  }

  document.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', startTour));
  $('tour-next').addEventListener('click', () => (ti < TOUR.length - 1 ? showTour(ti + 1) : endTour()));
  $('tour-back').addEventListener('click', () => ti > 0 && showTour(ti - 1));
  $('tour-end').addEventListener('click', endTour);
  $('tour-act').addEventListener('click', () => { TOUR[ti].action.run(); placeTour(); });
  document.addEventListener('keydown', e => {
    if (ti < 0) return;
    if (e.key === 'Escape') endTour();
    else if (e.key === 'ArrowRight') $('tour-next').click();
    else if (e.key === 'ArrowLeft') $('tour-back').click();
  });

  addEventListener('scroll', () => { onScroll(); placeTour(); }, { passive: true });
  addEventListener('resize', () => { onScroll(); placeTour(); });

  buildExplorer();
  initHero();
  render({ notice: '', items: [], conflicts: [], verdicts: [], plan: [], rejected: [] });
  onScroll();
})();
