// Tests for demo mode (?demo=1). Same approach as money.test.mjs: load the real script
// (app.js) with a small stand-in for the browser. Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadApp(search) {
  let js = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  js = js.replace(/\nload\(\);\s*$/, '\n'); // don't boot the UI
  js += `\nglobalThis.app={DEMO,demoSeed,store,KEY,normalize,curIdx,ymKey,SECTKEYS,evalItem,cashOut,balanceFor,cardPaymentTotal,payoffPlan,runningBalance,
    use(d){S=normalize(JSON.parse(JSON.stringify(d)));selIdx=curIdx();return S;},get S(){return S}};`;
  // A localStorage that records every touch, holding "real" data the demo must never see.
  const ls = new Map([['cashflow:v3', '{"paycheck":1}']]);
  const touched = [];
  const localStorage = {
    getItem(k) { touched.push(['get', k]); return ls.has(k) ? ls.get(k) : null; },
    setItem(k, v) { touched.push(['set', k]); ls.set(k, String(v)); },
  };
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, style: {}, dataset: {}, value: '', firstChild: {}, addEventListener() {} });
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Date, Math, JSON, Number, String, Object, Array, Set, Map, URLSearchParams,
    navigator: {}, location: { protocol: 'file:', search, pathname: '/' }, localStorage,
    document: { getElementById: el, querySelectorAll: () => [], addEventListener() {}, createElement: el, activeElement: null, body: { appendChild() {} } },
  };
  ctx.window = { addEventListener() {}, innerWidth: 1200, localStorage };
  ctx.globalThis = ctx;
  vm.runInNewContext(js, ctx);
  return { app: ctx.app, ls, touched };
}

test('?demo=1 turns demo mode on; anything else leaves it off', () => {
  assert.equal(loadApp('?demo=1').app.DEMO, true);
  assert.equal(loadApp('').app.DEMO, false);
  assert.equal(loadApp('?demo=true').app.DEMO, false);
});

test('demo storage never reads or writes saved data', async () => {
  const { app, ls, touched } = loadApp('?demo=1');
  assert.equal(await app.store.get(app.KEY), null);           // real data is not visible
  await app.store.set(app.KEY, '{"demo":true}');
  assert.equal((await app.store.get(app.KEY)).value, '{"demo":true}');
  assert.equal(ls.get('cashflow:v3'), '{"paycheck":1}');      // real data untouched
  assert.deepEqual(touched.filter(([, k]) => k !== '__probe'), []);
});

test('normal mode still uses saved data', async () => {
  const { app, ls } = loadApp('');
  assert.equal((await app.store.get(app.KEY)).value, '{"paycheck":1}');
  await app.store.set(app.KEY, '{"paycheck":2}');
  assert.equal(ls.get('cashflow:v3'), '{"paycheck":2}');
});

test('demo household is complete and every number is finite', () => {
  const { app } = loadApp('?demo=1');
  const S = app.use(app.demoSeed());
  const cur = app.curIdx();
  for (const k of app.SECTKEYS) assert.ok(S[k].length > 0, `demo has ${k}`);
  assert.equal(S.chargeCardId, 'demoA');
  for (let vi = cur; vi < cur + 12; vi++) {
    for (const k of app.SECTKEYS) for (const it of S[k]) assert.ok(Number.isFinite(app.evalItem(it, k, vi).amt), `${k} ${it.name} ${vi}`);
    assert.ok(Number.isFinite(app.cashOut(vi)));
    assert.ok(Number.isFinite(app.cardPaymentTotal(vi)));
    for (const c of S.ccBalances) assert.ok(Number.isFinite(app.balanceFor(c, vi)));
  }
  // The cards pay off within the projection, so the payoff chart has something to show.
  for (const c of S.ccBalances) assert.equal(app.payoffPlan(c, cur, 0).state, 'ok', c.name);
});

test('demo dates follow today, so the demo never looks stale', () => {
  const { app } = loadApp('?demo=1');
  const S = app.use(app.demoSeed());
  const key = app.ymKey(app.curIdx());
  assert.ok(S.ccBalances.every(c => c.balanceMonths[key] > 0));
  assert.ok(S.checking.date.startsWith(key));
  assert.ok(new Date(S.payAnchor + 'T00:00:00Z').getUTCDay() === 5); // a Friday
});
