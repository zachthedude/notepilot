// Self-check: run with `node check.js`. Exits non-zero on failure.
const assert = require('assert');
const NP = require('./pipeline.js');
const SAMPLE = require('./sample.js');
const fs = require('fs');
const path = require('path');
const ExamNotice = require('./adapters/exam-notice.js');

const ITEM_KEYS = ['end', 'id', 'label', 'line', 'quote', 'start', 'type', 'value'];
// Every item must quote the notice exactly at its span and use the pipeline item shape.
function assertSpans(notice, items, ctx) {
  items.forEach(it => {
    assert.strictEqual(it.quote, notice.slice(it.start, it.end), `${ctx}: quote matches span for ${it.id}`);
    ITEM_KEYS.forEach(k => assert.ok(k in it, `${ctx}: ${it.id} has ${k}`));
  });
}

const r = NP.run(SAMPLE, { gpa: 3.7, age: 24, level: 'undergraduate' });
const count = t => r.items.filter(i => i.type === t).length;

assert.strictEqual(count('deadline'), 2, 'two deadlines');
assert.strictEqual(count('fee'), 1, 'one fee');
assert.strictEqual(count('document'), 1, 'one document line');
assert.strictEqual(count('rule'), 3, 'three eligibility rules');
assert.strictEqual(count('contact'), 2, 'email and phone');
assert.strictEqual(r.rejected.length, 0, 'no span failures on clean extraction');
assert.deepStrictEqual(r.conflicts[0].values, ['2026-12-15', '2026-12-20'], 'deadline conflict detected');
assert.ok(r.verdicts.every(v => v.status === 'match'), 'all rules match a qualifying profile');
assert.match(r.plan[0], /CONFIRM WITH ISSUER/, 'conflict listed first');
assertSpans(SAMPLE, NP.extract(SAMPLE), 'scholarship sample');

// Span guard rejects an item whose quote does not match its span.
const tampered = NP.extract(SAMPLE).map((it, i) => (i === 0 ? { ...it, quote: 'made up' } : it));
const guard = NP.verifySpans(SAMPLE, tampered);
assert.strictEqual(guard.rejected.length, 1, 'tampered item rejected');

// Missing answers give unknown, never a guess.
const blank = NP.run(SAMPLE, {});
assert.ok(blank.verdicts.every(v => v.status === 'unknown'), 'no answers -> unknown');

// A failing answer gives no_match.
const low = NP.run(SAMPLE, { gpa: 3.0, age: 24, level: 'undergraduate' });
assert.strictEqual(low.verdicts.find(v => v.reason.startsWith('your gpa')).status, 'no_match', 'low GPA -> no match');

// Empty input does not crash.
const empty = NP.run('', {});
assert.strictEqual(empty.items.length, 0);
assert.strictEqual(empty.plan.length, 0);

// Exam-registration adapter on the invented fixture.
const EXAM = fs.readFileSync(path.join(__dirname, 'fixtures', 'exam-notice.txt'), 'utf8').replace(/\r\n/g, '\n');
const exam = ExamNotice.extract(EXAM);
assertSpans(EXAM, exam, 'exam fixture');
assert.ok(exam.every(it => ITEM_KEYS.every(k => k in it) && Object.keys(it).length === ITEM_KEYS.length), 'exam items use the pipeline item shape');
assert.deepStrictEqual(exam.filter(i => i.type === 'deadline').map(i => i.value), ['2026-11-30'], 'exam date is not a deadline');
assert.deepStrictEqual(exam.filter(i => i.type === 'fee').map(i => i.value), ['BDT 1,200'], 'exam fee');
assert.deepStrictEqual(exam.filter(i => i.type === 'contact').map(i => i.value), ['exams@example.org', '+880-1800-111111'], 'exam contacts');
assert.strictEqual(NP.verifySpans(EXAM, exam).rejected.length, 0, 'span guard accepts adapter items');

// Regression: conflicting deadline dates are both kept and flagged.
const CONFLICT = 'Registration deadline: 30 November 2026.\nCorrigendum: the registration deadline is now 5 December 2026.';
const conflictItems = ExamNotice.extract(CONFLICT);
assertSpans(CONFLICT, conflictItems, 'conflicting dates');
assert.deepStrictEqual(NP.detectConflicts(conflictItems)[0].values, ['2026-11-30', '2026-12-05'], 'conflicting deadlines detected');

// Regression: a notice with no deadline yields no deadline item and no conflict.
const NO_DEADLINE = 'Registration fee: BDT 800.\nExamination date: 10 January 2027.\nContact: exams@example.org';
const noDeadline = ExamNotice.extract(NO_DEADLINE);
assertSpans(NO_DEADLINE, noDeadline, 'missing deadline');
assert.strictEqual(noDeadline.filter(i => i.type === 'deadline').length, 0, 'missing deadline not invented');
assert.strictEqual(NP.detectConflicts(noDeadline).length, 0, 'no conflict without deadlines');

// Regression: a fee written as Tk is extracted verbatim.
const TK = 'Registration fee: Tk 1,500 per candidate.\nLate fee: Tk. 250 after the deadline.';
const tk = ExamNotice.extract(TK);
assertSpans(TK, tk, 'Tk fee');
assert.deepStrictEqual(tk.filter(i => i.type === 'fee').map(i => i.value), ['Tk 1,500', 'Tk. 250'], 'Tk fees extracted');

// Regression: CRLF input keeps spans valid against the raw notice.
const CRLF = 'Registration fee: BDT 800\r\nRegistration deadline: 30 November 2026\r\nContact: exams@example.org';
const crlf = ExamNotice.extract(CRLF);
assertSpans(CRLF, crlf, 'CRLF notice');
assert.strictEqual(crlf.length, 3, 'CRLF notice items');

// Regression: an ISO date on a contact line is not a phone number.
const HELPLINE = 'Helpline available until 2026-12-15: +880-1800-111111\nHelpline closes 2026-12-20.';
const helpline = ExamNotice.extract(HELPLINE);
assertSpans(HELPLINE, helpline, 'helpline dates');
assert.deepStrictEqual(helpline.filter(i => i.label === 'phone').map(i => i.value), ['+880-1800-111111'], 'dates not taken as phones');

console.log('all checks passed');
