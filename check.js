// Self-check: run with `node check.js`. Exits non-zero on failure.
const assert = require('assert');
const NP = require('./pipeline.js');
const SAMPLE = require('./sample.js');

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

console.log('all checks passed');
