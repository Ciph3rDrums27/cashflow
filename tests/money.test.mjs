// Tests for the app's money math. They load the real <script> from index.html (no copy
// of the logic), with a tiny stand-in for the browser. Run: node --test tests/money.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadApp() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  let js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  js = js.replace(/\nload\(\);\s*$/, '\n'); // don't boot the UI
  js += `\nglobalThis.app={use(d){S=normalize(JSON.parse(JSON.stringify(d)));selIdx=curIdx();return S;},get S(){return S},
    curIdx,mi,ymKey,normalize,incomeFor,paycheckFor,paydaysIn,cardCashPay,cardPaymentTotal,balanceFor,payoffPlan,
    calItems,paycheckPeriods,evalItem,amountAt,cashOut,runningBalance,dayNum,todayNum,isoDayNum,todayISO};`;
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, style: {}, dataset: {}, value: '', firstChild: {}, addEventListener() {} });
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Date, Math, JSON, Number, String, Object, Array, Set,
    window: { addEventListener() {}, innerWidth: 1200 }, navigator: {}, location: { protocol: 'file:' },
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: el, querySelectorAll: () => [], addEventListener() {}, createElement: el, activeElement: null, body: { appendChild() {} } },
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(js, ctx);
  return ctx.app;
}

const base = (extra = {}) => ({
  paycheck: 2000, payAnchor: '2026-09-04', payEvery: 14,
  affirm: [], payin4: [], ccplans: [], oneoff: [], card: [], recurring: [], ccBalances: [], chargeCardId: '',
  ...extra,
});

test('a paid-off card stops taking cash', () => {
  const a = loadApp(); const cur = a.curIdx();
  a.use(base({ ccBalances: [{ id: 'c', name: 'C', apr: 20, payment: 300, balanceMonths: { [a.ymKey(cur)]: 500 } }] }));
  const c = a.S.ccBalances[0];
  assert.equal(a.cardCashPay(c, cur), 300);
  assert.ok(a.cardCashPay(c, cur + 1) > 200 && a.cardCashPay(c, cur + 1) < 300); // only what's left
  assert.equal(a.cardCashPay(c, cur + 3), 0);
  assert.equal(a.cardPaymentTotal(cur + 6), 0);
});

test('a payment typed for a specific month is taken as given', () => {
  const a = loadApp(); const cur = a.curIdx();
  a.use(base({ ccBalances: [{ id: 'c', name: 'C', apr: 0, payment: 0, payMonths: { [a.ymKey(cur + 1)]: 999 }, balanceMonths: { [a.ymKey(cur)]: 500 } }] }));
  assert.equal(a.cardCashPay(a.S.ccBalances[0], cur + 1), 999);
});

test('0% APR payoff gives a real month, not NaN', () => {
  const a = loadApp(); const cur = a.curIdx();
  a.use(base({ ccBalances: [{ id: 'z', name: 'Z', apr: 0, payment: 100, balanceMonths: { [a.ymKey(cur)]: 1000 } }] }));
  const po = a.payoffPlan(a.S.ccBalances[0], cur, 0);
  assert.equal(po.state, 'ok');
  assert.equal(po.n, 10);
  assert.equal(po.paid, 0);
});

test('payoff plan follows month-by-month payments', () => {
  const a = loadApp(); const cur = a.curIdx();
  a.use(base({ ccBalances: [{ id: 'c', name: 'C', apr: 24, payment: 0, payMonths: { [a.ymKey(cur)]: 600, [a.ymKey(cur + 1)]: 600 }, balanceMonths: { [a.ymKey(cur)]: 1000 } }] }));
  const po = a.payoffPlan(a.S.ccBalances[0], cur, 0);
  assert.equal(po.state, 'ok');
  assert.equal(po.v, cur + 1);
});

test('a due day past the end of a short month lands on its last day', () => {
  const a = loadApp(); const feb = a.mi(2027, 1);
  a.use(base({ recurring: [{ id: 'r', name: 'R', amount: 100, day: 31 }] }));
  assert.equal(JSON.stringify(a.calItems(feb).map(i => i.day)), '[28]');
});

test('rent paid ahead lands on the last payday of the month before', () => {
  const a = loadApp();
  a.use(base({ recurring: [{ id: 'rent', name: 'Rent', amount: 3000, day: 1 }] }));
  assert.equal(a.S.recurring[0].paidEarly, true); // "Rent" defaults to paid ahead
  const nov = a.calItems(a.mi(2026, 10)).find(i => i.id === 'rent');
  assert.equal(nov.day, 27); assert.match(nov.name, /Dec 1/);
  // Oct 1 2027 is itself a payday; Oct rent still comes from Sep 17
  const sep = a.calItems(a.mi(2027, 8)).find(i => i.id === 'rent');
  assert.equal(sep.day, 17); assert.match(sep.name, /Oct 1/);
});

test('entered take-home carries forward per paycheck', () => {
  const a = loadApp();
  a.use(base({ paycheck: 3000, incomeMonths: { '2027-04': 12000 } }));
  assert.equal(a.paydaysIn(a.mi(2027, 4)).length, 2);
  assert.equal(a.incomeFor(a.mi(2027, 4)), 8000); // May: 2 paydays x (12000 / 3 in April)
  assert.equal(a.paycheckFor(a.mi(2027, 3)), 4000);
});

test('paycheck coverage uses entered take-home', () => {
  const a = loadApp();
  a.use(base({ paycheck: 3000, incomeMonths: { '2026-11': 9000 } }));
  const p = a.paycheckPeriods(a.mi(2026, 10));
  assert.equal(p.length, 2);
  assert.equal(p[0].left, 4500); // 9000 entered for 2 paydays, not the 3000 paycheck
});

test('skipping a month removes only that month', () => {
  const a = loadApp();
  a.use(base({ recurring: [{ id: 'l', name: 'Loan', amount: 200, day: 5, monthAdj: { '2026-11': { skip: true } } }] }));
  const it = a.S.recurring[0];
  assert.equal(a.evalItem(it, 'recurring', a.mi(2026, 10)).amt, 0);
  assert.equal(a.evalItem(it, 'recurring', a.mi(2026, 11)).amt, 200);
});

test('turning an installment or card charge off for one month leaves other months alone', () => {
  const a = loadApp();
  const adj = { monthAdj: { '2026-12': { skip: true } } };
  a.use(base({
    affirm: [{ id: 'i', name: 'Loan', amount: 50, date: '2026-10-05', left: 6, ...adj }],
    card: [{ id: 'c', name: 'Sub', amount: 10, date: '2026-10-05', left: '', kind: 'recur', ...adj, end: '2027-02' }],
  }));
  for (const [sect, amt] of [['affirm', 50], ['card', 10]]) {
    const it = a.S[sect][0];
    assert.equal(a.evalItem(it, sect, a.mi(2026, 10)).amt, amt);
    assert.equal(a.evalItem(it, sect, a.mi(2026, 11)).amt, 0);
    assert.equal(a.evalItem(it, sect, a.mi(2027, 0)).amt, amt);
  }
  assert.equal(a.evalItem(a.S.card[0], 'card', a.mi(2027, 2)).amt, 0); // removed from March on
});

test('an amount change from a month on leaves earlier months alone, and an end month stops it', () => {
  const a = loadApp();
  a.use(base({ recurring: [{ id: 'x', name: 'Lease', amount: 700, day: 22, amountFrom: { '2027-01': 750 }, end: '2027-06' }] }));
  const it = a.S.recurring[0];
  assert.equal(a.evalItem(it, 'recurring', a.mi(2026, 11)).amt, 700);
  assert.equal(a.evalItem(it, 'recurring', a.mi(2027, 0)).amt, 750);
  assert.equal(a.evalItem(it, 'recurring', a.mi(2027, 6)).amt, 0);
});

test('logged everyday spending: estimate is the floor this month, actual once it is over', () => {
  const a = loadApp(); const cur = a.curIdx();
  a.use(base({ recurring: [{ id: 'g', name: 'Groceries', amount: 400, day: null, variable: true, spent: { [a.ymKey(cur)]: 85, [a.ymKey(cur - 1)]: 310 } }] }));
  const it = a.S.recurring[0];
  assert.equal(a.evalItem(it, 'recurring', cur).amt, 400);
  assert.equal(a.evalItem(it, 'recurring', cur - 1).amt, 310);
});

test('calendar shows card payments, not card charges', () => {
  const a = loadApp(); const cur = a.curIdx();
  a.use(base({
    card: [{ id: 'k', name: 'Streaming', amount: 16, date: '2026-01-08', left: '', kind: 'recur' }],
    ccBalances: [{ id: 'c', name: 'Visa', apr: 20, payment: 100, dueDay: 12, balanceMonths: { [a.ymKey(cur)]: 1000 } }],
  }));
  const names = a.calItems(cur).map(i => i.name);
  assert.equal(JSON.stringify(names), '["Visa payment"]');
});

test('running balance: paychecks in, bills out', () => {
  const a = loadApp(); const t = a.todayNum();
  a.use(base({ recurring: [] , checking: { amount: 1000, date: a.todayISO() } }));
  const d = new Date((t + 3) * 86400000);
  a.S.oneoff.push({ id: 'o', name: 'Thing', amount: 250, date: d.toISOString().slice(0, 10), on: true });
  const rb = a.runningBalance(t + 3);
  const paydays = [1, 2, 3].filter(k => { const x = new Date((t + k) * 86400000); return (((Math.round(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) / 86400000) - Math.round(Date.UTC(2026, 8, 4) / 86400000)) % 14) + 14) % 14 === 0; }).length;
  assert.equal(rb.at(t + 3), 1000 - 250 + paydays * a.paycheckFor(a.curIdx()));
});

test('imported data with unsafe ids or odd values is cleaned up', () => {
  const a = loadApp();
  const s = a.use(base({ recurring: [{ id: "x');alert(1);('", name: 5, amount: 1, day: 1 }], card: [{ id: 'k', name: 'K', amount: 1, date: 20260101 }] }));
  assert.match(s.recurring[0].id, /^[A-Za-z0-9_-]+$/);
  assert.equal(s.recurring[0].name, '5');
  assert.equal(typeof s.card[0].date, 'string');
  assert.equal(a.normalize([1, 2]).recurring.length, 0);
});
