(function (root) {
  'use strict';
  // Adapter for exam-registration notices. Emits the same item shape as pipeline.js:
  // { type, label, value, quote, start, end, line, id }, with quote === notice.slice(start, end).
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const DATE_RE = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;
  const DEADLINE_LINE_RE = /deadline|last date|registration closes/i;
  const FEE_LINE_RE = /fee/i;
  const FEE_RE = /(?:Tk\.?|BDT|৳)\s?[\d,]+(?:\.\d+)?/i;
  const CONTACT_LINE_RE = /contact|helpline|phone|call|tel/i;
  const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
  const PHONE_RE = /\+?\d[\d-]{7,}\d/g;
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function splitLines(text) {
    const out = [];
    let pos = 0;
    text.split('\n').forEach((t, i) => {
      out.push({ text: t, start: pos, num: i + 1 });
      pos += t.length + 1;
    });
    return out;
  }

  function make(type, label, value, m, line) {
    const quote = m[0];
    const start = line.start + m.index;
    return { type, label, value, quote, start, end: start + quote.length, line: line.num };
  }

  function isoDate(m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }

  // Spans index into `text` as given; CRLF is not normalized so offsets stay valid for the caller.
  function extract(text) {
    const notice = String(text || '');
    const items = [];
    splitLines(notice).forEach(line => {
      const t = line.text;
      let m;
      if (DEADLINE_LINE_RE.test(t) && (m = DATE_RE.exec(t))) items.push(make('deadline', 'deadline', isoDate(m), m, line));
      if (FEE_LINE_RE.test(t) && (m = FEE_RE.exec(t))) items.push(make('fee', 'fee', m[0], m, line));
      if ((m = EMAIL_RE.exec(t))) items.push(make('contact', 'email', m[0], m, line));
      if (CONTACT_LINE_RE.test(t) && (m = [...t.matchAll(PHONE_RE)].find(p => !ISO_DATE_RE.test(p[0])))) items.push(make('contact', 'phone', m[0], m, line));
    });
    items.forEach((it, i) => { it.id = 'e' + i; });
    return items;
  }

  const ExamNotice = { extract };
  root.ExamNoticeAdapter = ExamNotice;
  if (typeof module !== 'undefined' && module.exports) module.exports = ExamNotice;
})(typeof window !== 'undefined' ? window : globalThis);
