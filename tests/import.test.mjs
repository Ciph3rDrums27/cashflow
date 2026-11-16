// Tests for the bank statement import. Same approach as money.test.mjs: load the real script
// (app.js) with a small stand-in for the browser. All names and amounts are made up.
// Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadApp() {
  let js = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  js = js.replace(/\nload\(\);\s*$/, '\n'); // don't boot the UI
  js += `\nglobalThis.app={parseChaseCSV,logPurchase,discChange,discEarlier,discRows,runningBalance,upcomingBills,calItems,curIdx,ymKey,todayNum,todayISO,
    use(d){S=normalize(JSON.parse(JSON.stringify(d)));selIdx=curIdx();return S;},get S(){return S}};`;
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, style: {}, dataset: {}, value: '', firstChild: {}, addEventListener() {} });
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Date, Math, JSON, Number, String, Object, Array, Set, Map, URLSearchParams, RegExp,
    window: { addEventListener() {}, innerWidth: 1200 }, navigator: {}, location: { protocol: 'file:', search: '', pathname: '/' },
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: el, querySelectorAll: () => [], addEventListener() {}, createElement: el, activeElement: null, body: { appendChild() {} } },
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(js, ctx);
  return ctx.app;
}

const budgets = () => ({
  paycheck: 2000, payAnchor: '2026-09-04', payEvery: 14, affirm: [], payin4: [], ccplans: [], oneoff: [], card: [], ccBalances: [],
  recurring: [
    { id: 'g', name: 'Groceries', amount: 400, day: null, variable: true },
    { id: 'f', name: 'Gas', amount: 100, day: null, variable: true },
    { id: 'd', name: 'Discretionary (dining, fun)', amount: 300, day: null, variable: true },
  ],
});
const HEAD = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #';

test('a Category column decides which budget a purchase goes to', () => {
  const a = loadApp(); a.use(budgets());
  const r = a.parseChaseCSV(`${HEAD},Category
DEBIT,11/03/2026,Corner Shop,-10.00,DEBIT_CARD,,,Groceries
DEBIT,11/03/2026,Big Box Gas,-20.00,DEBIT_CARD,,,Gas
DEBIT,11/03/2026,Movie Night,-30.00,DEBIT_CARD,,,Entertainment
DEBIT,11/03/2026,Wing Place,-40.00,DEBIT_CARD,,,Dining & drinks
DEBIT,11/03/2026,Bottle Shop,-5.00,DEBIT_CARD,,,Alcohol
DEBIT,11/03/2026,Payment App - Trip,-50.00,ACH_DEBIT,,,Travel
DEBIT,11/03/2026,Lender Payment,-60.00,MISC_DEBIT,,,Debt payment
CREDIT,11/03/2026,Payroll,900.00,ACH_CREDIT,,,Income`);
  const by = Object.fromEntries(r.txns.map(t => [t.name, t]));
  assert.equal(by['Corner Shop'].dest, 'g');
  assert.equal(by['Big Box Gas'].dest, 'f');
  for (const n of ['Movie Night', 'Wing Place', 'Bottle Shop']) assert.equal(by[n].dest, 'd', n);
  assert.equal(by['Payment App - Trip'].group, 'buy');     // the category says it's a purchase
  assert.equal(by['Payment App - Trip'].dest, 'oneoff');
  assert.equal(by['Lender Payment'].group, 'skip');          // debt payments are listed, not ticked
  assert.equal(by['Lender Payment'].sel, false);
  assert.equal(r.credits, 1);                                // money in is ignored
});

test('without a Category column, "Costco Gas" counts as gas, not groceries', () => {
  const a = loadApp(); a.use(budgets());
  const r = a.parseChaseCSV(`${HEAD}
DEBIT,11/03/2026,Costco Gas,-20.00,DEBIT_CARD,,,
DEBIT,11/03/2026,Costco Wholesale,-80.00,DEBIT_CARD,,,`);
  const by = Object.fromEntries(r.txns.map(t => [t.name, t.dest]));
  assert.equal(by['Costco Gas'], 'f');
  assert.equal(by['Costco Wholesale'], 'g');
});

test('each purchase logged to a budget is kept for the breakdown, and adds to the total', () => {
  const a = loadApp(); const S = a.use(budgets());
  const d = S.recurring.find(x => x.id === 'd');
  a.logPurchase(d, '2026-11-03', 'Wing Place', 40, 'Dining & drinks');
  a.logPurchase(d, '2026-11-04', 'Movie Night', 30.5);
  assert.equal(d.spent['2026-11'], 70.5);
  assert.ok(d.logged['2026-11'].every(r => /^[A-Za-z0-9_-]+$/.test(r.id)), 'each purchase has an id');
  assert.deepEqual(JSON.parse(JSON.stringify(d.logged['2026-11'].map(({ id, ...r }) => r))), [
    { date: '2026-11-03', name: 'Wing Place', amount: 40, cat: 'Dining & drinks' },
    { date: '2026-11-04', name: 'Movie Night', amount: 30.5 },
  ]);
});

test('purchases imported from the bank do not count again as bills due before payday', () => {
  const a = loadApp();
  const n = a.todayNum(), tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  a.use({ ...budgets(), paycheck: 0, checking: { amount: 1000, date: a.todayISO() },
    oneoff: [{ id: 'o1', name: 'Imported purchase', amount: 50, date: tomorrow, src: 'chase' },
             { id: 'o2', name: 'Typed one-time bill', amount: 70, date: tomorrow }] });
  const due = a.upcomingBills(n + 1, n + 3).map(i => i.name);
  assert.ok(!due.includes('Imported purchase'), 'imported purchase listed as due');
  assert.ok(due.includes('Typed one-time bill'));
  assert.equal(a.runningBalance(n + 3).at(n + 3), 930); // 1000 minus the typed bill only
});

test('editing the Discretionary list keeps the month total in step, including spending logged earlier', () => {
  const a = loadApp();
  const S = a.use({ ...budgets(), recurring: [{ id: 'd', name: 'Discretionary', amount: 300, day: null, variable: true, spent: { '2026-11': 100 } }] });
  const d = S.recurring[0];
  assert.equal(a.discEarlier(d, '2026-11'), 100);          // a total from before, no detail
  a.logPurchase(d, '2026-11-03', 'Wing Place', 40);
  assert.equal(d.spent['2026-11'], 140);
  const id = a.discRows(d, '2026-11')[0].id;
  a.discChange(d, '2026-11', rows => { rows[0].amount = 25; });  // edit
  assert.equal(d.spent['2026-11'], 125);
  a.discChange(d, '2026-11', rows => rows.splice(0, 1));         // delete
  assert.equal(d.spent['2026-11'], 100);
  assert.equal(a.discRows(d, '2026-11').length, 0);
  assert.ok(id);
});
