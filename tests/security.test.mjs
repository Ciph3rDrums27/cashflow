// Security guardrail tests. Same approach as money.test.mjs: load the real script (app.js)
// with a small stand-in for the browser. Run: node --test tests/*.test.mjs
//
// What they protect: a backup file (or saved data) is untrusted input. Whatever it contains,
// nothing from it may reach the page as live HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function loadApp() {
  let js = appJs;
  js = js.replace(/\nload\(\);\s*$/, '\n'); // don't boot the UI
  js += `\nglobalThis.app={esc,normalize,curIdx,ymKey,SECTKEYS,sectionHTML,guessDest,runAction,ACTIONS,window,
    use(d){S=normalize(JSON.parse(JSON.stringify(d)));selIdx=curIdx();return S;},
    edit(sect,id){editing={sect,id};},showAll(){SECTKEYS.forEach(k=>{doneOpen[k]=true;addOpen[k]=true;});},get S(){return S}};`;
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

// Text that breaks out of an attribute or a tag if it is written to the page unescaped.
// The three probes below must never appear in output in their raw form.
const EVIL = `" data-probe="1"><xss-probe>' data-probe='1`;

test('esc neutralises every character that can break out of HTML or an attribute', () => {
  const a = loadApp();
  const out = a.esc(`<a href="x" onclick='y'>&`);
  for (const ch of ['<', '>', '"', "'"]) assert.ok(!out.includes(ch), `still contains ${ch}`);
  assert.equal(a.esc('Rent & Co'), 'Rent &amp; Co');
  assert.equal(a.esc(1250.5), '1250.5'); // numbers pass through unchanged
});

test('a hostile backup cannot inject HTML into any list, row or edit form', () => {
  const a = loadApp();
  const k = a.ymKey(a.curIdx());
  const S = a.use({
    affirm: [{ id: 'a1', name: EVIL, amount: EVIL, date: EVIL, left: EVIL }, { id: 'a2', name: 'x', amount: 5, date: k + '-05', left: EVIL }],
    ccplans: [{ id: 'p1', name: EVIL, amount: EVIL, date: k + '-05', left: 5 }],
    payin4: [{ id: 'f1', name: EVIL, amount: EVIL, date: EVIL, count: EVIL, every: EVIL }],
    recurring: [
      { id: 'r1', name: EVIL, amount: EVIL, day: EVIL, variable: true, months: { [k]: EVIL }, spent: { [k]: EVIL }, amountFrom: { [k]: EVIL }, monthAdj: { [k]: { day: EVIL } }, start: EVIL, end: EVIL },
      { id: 'r2', name: 'x', amount: 30, day: 5, variable: true, months: { [k]: EVIL }, monthAdj: { [k]: { day: EVIL } } },
    ],
    oneoff: [{ id: 'o1', name: EVIL, amount: EVIL, date: EVIL }, { id: 'o2', name: 'x', amount: EVIL, date: k + '-20' }],
    card: [{ id: 'k1', name: EVIL, amount: EVIL, date: EVIL, left: EVIL, kind: EVIL }, { id: 'k2', name: 'x', amount: EVIL, date: k + '-03', left: '', kind: 'recur' }],
    ccBalances: [],
  });
  a.showAll();
  const check = (label, out) => {
    assert.ok(!out.includes('<xss-probe'), `${label}: injected tag in output`);
    assert.ok(!out.includes('data-probe="'), `${label}: broke out of a double-quoted attribute`);
    assert.ok(!out.includes("data-probe='"), `${label}: broke out of a single-quoted attribute`);
  };
  for (const sect of a.SECTKEYS) {
    check(`${sect} list`, a.sectionHTML(sect));
    for (const it of S[sect]) { a.edit(sect, it.id); check(`${sect} edit form`, a.sectionHTML(sect)); }
  }
});

test('ids from a backup are replaced unless they are plain letters, digits, _ or -', () => {
  const a = loadApp();
  const S = a.use({ recurring: [{ id: `x');alert(1);('`, name: 'Bill', amount: 1 }], ccBalances: [{ id: `"><script>`, name: 'Card' }] });
  assert.match(S.recurring[0].id, /^[A-Za-z0-9_-]{1,40}$/);
  assert.match(S.ccBalances[0].id, /^[A-Za-z0-9_-]{1,40}$/);
});

test('merchant names that match built-in property names are not treated as remembered', () => {
  const a = loadApp();
  a.use({ recurring: [{ id: 'g', name: 'Groceries', amount: 100, day: null, variable: true }] });
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(typeof a.guessDest(name), 'string', name);
  }
});

test('the page ships nothing from another website and declares its fallback security policy', () => {
  const urls = ((html + appJs).match(/https?:\/\/[^\s"'<>)]+/g) || []).filter(u => !u.startsWith('http://www.w3.org/'));
  assert.deepEqual(urls, [], 'no external URLs in index.html or app.js');
  const scripts = html.match(/<script[^>]*>/gi) || [];
  assert.deepEqual(scripts, ['<script src="app.js">'], 'the only script is our own app.js');
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  for (const rule of ["connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(rule), rule);
  assert.ok(!/\beval\(|new Function\(|document\.write\(/.test(html + appJs), 'no eval / new Function / document.write');
});

// The site's policy is meant to forbid script written inside HTML. These keep the code ready
// for that: one inline handler anywhere would stop working (or force the policy open again).
test('no inline script or inline event handlers anywhere', () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'no inline <script> block in index.html');
  const inline = /\son[a-z]+\s*=\s*["'\\]/i;
  assert.ok(!inline.test(html), 'no on...= attribute in index.html');
  assert.ok(!inline.test(appJs), 'no on...= attribute in HTML built by app.js');
  assert.ok(!/javascript:/i.test(html + appJs), 'no javascript: links');
});

test('the action runner only calls listed functions with plain values', () => {
  const a = loadApp();
  const calls = [];
  for (const name of a.ACTIONS) a.window[name] = (...args) => calls.push([name, ...args]);
  a.window.secret = () => calls.push(['secret']);
  const el = { value: 'typed', checked: true }, ev = { type: 'click' };
  a.runAction(el, ev, "del('recurring','x1')");
  a.runAction(el, ev, "ccbInput('c1','apr',this.value)");
  a.runAction(el, ev, 'impToggle(3)');
  a.runAction(el, ev, "impSet('buy',true)");
  a.runAction(el, ev, 'closeModal()');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['del', 'recurring', 'x1'], ['ccbInput', 'c1', 'apr', 'typed'], ['impToggle', 3], ['impSet', 'buy', true], ['closeModal']]);
  calls.length = 0;
  for (const bad of ['secret()', 'alert(1)', 'del(document.cookie)', "del('a');secret()", 'del(secret())', "del('a',)", 'constructor()', '__proto__()', "del('a'", 'del']) a.runAction(el, ev, bad);
  assert.deepEqual(calls, [], 'nothing outside the list, and no expressions, may run');
});
