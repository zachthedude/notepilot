(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let last = null;

  function profile() {
    const g = $('gpa').value, a = $('age').value, l = $('level').value.trim().toLowerCase();
    return { gpa: g === '' ? null : Number(g), age: a === '' ? null : Number(a), level: l || null };
  }

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function render(r) {
    $('status').textContent = r.notice.trim()
      ? `${r.items.length} items extracted, ${r.rejected.length} rejected by the source check.`
      : 'Paste a notice or load the sample to begin.';

    const items = $('items');
    items.replaceChildren();
    r.items.forEach(it => {
      const li = el('li');
      li.append(el('strong', it.label + ': '));
      li.append(el('span', Array.isArray(it.value) ? it.value.join(', ') : String(it.value)));
      const v = r.verdicts.find(x => x.itemId === it.id);
      if (v) li.append(el('span', ' ' + v.status.replace('_', ' '), 'badge ' + v.status));
      li.append(el('blockquote', `"${it.quote}" (line ${it.line})`));
      items.append(li);
    });
    if (!r.items.length) items.append(el('li', r.notice.trim() ? 'Nothing found.' : ''));

    const conflicts = $('conflicts');
    conflicts.replaceChildren();
    if (!r.conflicts.length) conflicts.append(el('li', 'No conflicts found.'));
    r.conflicts.forEach(c => conflicts.append(el('li',
      `Conflicting ${c.label} dates: ${c.values.join(' vs ')}. Confirm with the issuer; NoticePilot does not pick one.`, 'warn')));

    const plan = $('plan');
    plan.replaceChildren();
    r.plan.forEach(s => plan.append(el('li', s)));
    if (!r.plan.length) plan.append(el('li', 'Nothing to do yet.'));
  }

  function analyze() {
    last = NP.run($('notice').value, profile());
    render(last);
  }

  $('analyze').addEventListener('click', analyze);
  $('sample').addEventListener('click', () => { $('notice').value = SAMPLE_NOTICE; analyze(); });
  ['gpa', 'age', 'level'].forEach(id => $(id).addEventListener('input', analyze));

  $('copy').addEventListener('click', async () => {
    const header = 'NoticePilot checklist (rule-based; verify with the issuer)\n';
    const text = header + (last ? last.plan : []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    let msg = 'Copied.';
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      msg = 'Copy failed; select the list manually.';
    }
    $('copied').textContent = msg;
  });

  render({ notice: '', items: [], conflicts: [], verdicts: [], plan: [], rejected: [] });
})();
