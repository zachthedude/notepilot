(function (root) {
  'use strict';
  // Rule-based pipeline. Every extracted item carries an exact source span.
  // ponytail: regex extraction for one notice format, no NLP; add patterns per format.
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const DATE_RE = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;
  const FEE_RE = /(?:Tk|BDT|৳|\$)\s?[\d,]+(?:\.\d+)?/;
  const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
  const PHONE_RE = /\+?\d[\d-]{7,}\d/;
  const GPA_RE = /minimum GPA of\s*(\d+(?:\.\d+)?)/i;
  const AGE_RE = /under\s+(\d+)\s+years of age/i;
  const LEVEL_RE = /enrolled in an?\s+([a-z]+)\s+programme/i;
  const DOCS_RE = /^Required documents:\s*(.+)$/i;

  function splitLines(text) {
    const out = [];
    let pos = 0;
    text.split('\n').forEach((t, i) => {
      out.push({ text: t, start: pos, num: i + 1 });
      pos += t.length + 1;
    });
    return out;
  }

  function make(type, label, value, m, line, extra) {
    const quote = m[0];
    const start = line.start + m.index;
    return Object.assign({ type, label, value, quote, start, end: start + quote.length, line: line.num }, extra || {});
  }

  function isoDate(m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  function extract(notice) {
    const items = [];
    splitLines(notice).forEach(line => {
      const t = line.text;
      let m;
      if (/deadline/i.test(t) && (m = DATE_RE.exec(t))) items.push(make('deadline', 'deadline', isoDate(m), m, line));
      if (/fee/i.test(t) && (m = FEE_RE.exec(t))) items.push(make('fee', 'fee', m[0], m, line));
      if ((m = DOCS_RE.exec(t))) items.push(make('document', 'documents', m[1].split(',').map(s => s.trim()).filter(Boolean), m, line));
      if ((m = GPA_RE.exec(t))) items.push(make('rule', 'eligibility', `GPA >= ${Number(m[1])}`, m, line, { field: 'gpa', op: '>=', expected: Number(m[1]) }));
      if ((m = AGE_RE.exec(t))) items.push(make('rule', 'eligibility', `age < ${Number(m[1])}`, m, line, { field: 'age', op: '<', expected: Number(m[1]) }));
      if ((m = LEVEL_RE.exec(t))) items.push(make('rule', 'eligibility', `level = ${m[1].toLowerCase()}`, m, line, { field: 'level', op: '==', expected: m[1].toLowerCase() }));
      if ((m = EMAIL_RE.exec(t))) items.push(make('contact', 'email', m[0], m, line));
      if ((m = PHONE_RE.exec(t))) items.push(make('contact', 'phone', m[0], m, line));
    });
    items.forEach((it, i) => { it.id = 'e' + i; });
    return items;
  }

  // Drop any item whose quote does not match the notice at its span.
  function verifySpans(notice, items) {
    const valid = [], rejected = [];
    items.forEach(it => (it.quote && notice.slice(it.start, it.end) === it.quote ? valid : rejected).push(it));
    return { valid, rejected };
  }

  // Only deadlines are checked for conflicts in this MVP.
  function detectConflicts(items) {
    const deadlines = items.filter(i => i.type === 'deadline');
    const values = [...new Set(deadlines.map(d => d.value))];
    if (values.length > 1) return [{ type: 'conflict', label: 'deadline', values, itemIds: deadlines.map(d => d.id) }];
    return [];
  }

  // Unknown when no answer is given. Never infers a missing rule or answer.
  function compare(rules, profile) {
    return rules.map(r => {
      const raw = profile[r.field];
      if (raw === null || raw === undefined || raw === '' || Number.isNaN(raw)) {
        return { itemId: r.id, status: 'unknown', reason: 'no answer given' };
      }
      const ok = r.op === '>=' ? raw >= r.expected : r.op === '<' ? raw < r.expected : String(raw).toLowerCase() === r.expected;
      return { itemId: r.id, status: ok ? 'match' : 'no_match', reason: `your ${r.field} ${raw} vs notice: ${r.value}` };
    });
  }

  function plan(items, conflicts, verdicts) {
    const steps = [];
    conflicts.forEach(c => steps.push(`CONFIRM WITH ISSUER: ${c.label} conflict (${c.values.join(' vs ')})`));
    items.filter(i => i.type === 'deadline').sort((a, b) => a.value.localeCompare(b.value))
      .forEach(i => steps.push(`Deadline ${i.value} (line ${i.line})`));
    items.filter(i => i.type === 'document').forEach(i => steps.push(`Prepare: ${i.value.join(', ')}`));
    items.filter(i => i.type === 'fee').forEach(i => steps.push(`Fee: ${i.value}`));
    items.filter(i => i.type === 'rule').forEach(i => {
      const v = verdicts.find(x => x.itemId === i.id);
      steps.push(`Eligibility ${i.field}: ${v.status.replace('_', ' ')} (${v.reason})`);
    });
    items.filter(i => i.type === 'contact').forEach(i => steps.push(`Contact: ${i.value}`));
    return steps;
  }

  function run(text, profile) {
    const notice = String(text || '').replace(/\r\n/g, '\n');
    if (!notice.trim()) return { notice, items: [], rejected: [], conflicts: [], verdicts: [], plan: [] };
    const { valid, rejected } = verifySpans(notice, extract(notice));
    const conflicts = detectConflicts(valid);
    const verdicts = compare(valid.filter(i => i.type === 'rule'), profile || {});
    return { notice, items: valid, rejected, conflicts, verdicts, plan: plan(valid, conflicts, verdicts) };
  }

  const NP = { extract, verifySpans, detectConflicts, compare, plan, run };
  root.NP = NP;
  if (typeof module !== 'undefined' && module.exports) module.exports = NP;
})(typeof window !== 'undefined' ? window : globalThis);
