(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let last = null;

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  // ---- Scroll story: highlight sample lines for the step in view ----
  // Which story steps light up each sample line (first matching pattern wins).
  const STEP_TAGS = [
    [/deadline/i, '2 3 4'],
    [/fee/i, '2'],
    [/Required documents/i, '2'],
    [/Eligibility|enrolled/i, '3 5'],
    [/Contact/i, '2'],
  ];

  function buildStage() {
    const box = $('stage-text');
    SAMPLE_NOTICE.split('\n').forEach(line => {
      const p = el('p', line, 'line');
      const tag = STEP_TAGS.find(([re]) => re.test(line));
      p.dataset.steps = tag ? tag[1] : '';
      box.append(p);
    });
    NP.run(SAMPLE_NOTICE, { gpa: 3.7, age: 24, level: 'undergraduate' }).plan
      .forEach(s => $('stage-plan').append(el('li', s)));
  }

  function setStep(n) {
    $('stage').dataset.step = n;
    document.querySelectorAll('#stage-text .line').forEach(p =>
      p.classList.toggle('on', (' ' + p.dataset.steps + ' ').includes(' ' + n + ' ')));
    document.querySelectorAll('.step').forEach(s => s.classList.toggle('is-active', s.dataset.step === String(n)));
    // On small screens the notice box scrolls; bring the highlighted lines (or checklist) into view.
    const stage = $('stage');
    if (stage.scrollHeight > stage.clientHeight) {
      const target = n >= 5 ? stage.querySelector('.stage-out') : stage.querySelector('.line.on');
      stage.scrollTo({ top: target ? Math.max(0, target.offsetTop - 40) : 0, behavior: 'smooth' });
    }
  }

  function initStory() {
    buildStage();
    setStep(1);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setStep(e.target.dataset.step); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('.step').forEach(s => io.observe(s));
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

  $('analyze').addEventListener('click', analyze);
  $('sample').addEventListener('click', () => { $('notice').value = SAMPLE_NOTICE; analyze(); });
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

  initStory();
  render({ notice: '', items: [], conflicts: [], verdicts: [], plan: [], rejected: [] });
})();
