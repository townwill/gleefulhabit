// Test harness for GleefulHabit (single-file app). Not shipped to the browser.
//
// Runs the REAL <script> body from index.html (re-extracted on every call) inside a
// Node vm context with a fake DOM, a fake localStorage and a controllable clock.
// Test code is appended to the app source and run in the SAME script, because
// top-level let/const (S, etc.) are not visible from outside the script.
//
//   const {run, check, done} = require('./harness');
//   run({now:'2026-10-07T12:00:00'}, `OUT.cardio = cardioWeekMinutes('2026-10-07');`);
//
// `run` returns the OUT object the test code filled in, plus helpers.
process.env.TZ = 'America/Los_Angeles'; // deterministic week/day boundaries
const fs = require('fs'), path = require('path'), vm = require('vm');

const INDEX = path.join(__dirname, '..', 'index.html');

function appScript(htmlPath) {
  const html = fs.readFileSync(htmlPath || INDEX, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return scripts[scripts.length - 1]; // the big app script is the last inline one
}

function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; on ? set.add(c) : set.delete(c); return on; },
    contains: c => set.has(c),
  };
}
function makeEl(id) {
  const el = {
    id, tagName: 'DIV', _html: '', children: [], dataset: {}, attributes: {}, files: [],
    classList: makeClassList(), style: new Proxy({}, { get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } }),
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
    textContent: '', value: '', checked: false, disabled: false,
    appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setPointerCapture() {}, releasePointerCapture() {},
    click() {}, focus() {}, blur() {}, select() {}, scrollIntoView() {}, scrollTo() {},
    closest() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute() {}, removeAttribute() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
  };
  return el;
}

function run(opts, testCode) {
  opts = opts || {};
  const RealDate = Date;
  const clock = { now: opts.now ? new RealDate(opts.now).getTime() : RealDate.now() };
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); }
    static now() { return clock.now; }
  }
  const els = {};
  const timers = [];
  const store = Object.assign({}, opts.storage || {});
  const sandbox = {
    console, Math, JSON, Object, Array, String, Number, Boolean, Symbol, Map, Set, WeakMap, Promise, RegExp, Error, TypeError, parseFloat, parseInt, isFinite, isNaN,
    encodeURIComponent, decodeURIComponent, Intl,
    Date: FakeDate,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame: fn => { timers.push({ fn, ms: 0 }); return 0; }, cancelAnimationFrame() {},
    document: {
      getElementById: id => (els[id] || (els[id] = makeEl(id))), querySelector: () => makeEl(), querySelectorAll: () => [],
      createElement: t => { const e = makeEl(); e.tagName = String(t).toUpperCase(); return e; },
      addEventListener() {}, removeEventListener() {}, body: makeEl('body'), documentElement: makeEl('html'), visibilityState: 'visible',
    },
    localStorage: {
      getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
    },
    navigator: { canShare: () => false, share: async () => {}, userAgent: 'node-harness', vibrate() {} },
    location: { pathname: '/', href: '', search: '' },
    fetch: opts.fetch || (async () => ({ ok: false, status: 0, text: async () => '', json: async () => ({}) })),
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
    Blob: class {}, File: class {}, FileReader: class { readAsText() {} readAsDataURL() {} }, Image: class {},
    confirm: () => true, alert() {}, prompt: () => null,
    innerWidth: 390, innerHeight: 844,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.OUT = {};
  sandbox.__els = els; sandbox.__timers = timers; sandbox.__store = store;
  sandbox.__setNow = s => { clock.now = new RealDate(s).getTime(); };
  sandbox.__flushTimers = () => { const t = timers.splice(0); t.forEach(x => { try { x.fn(); } catch (e) { sandbox.OUT.__timerError = String(e && e.stack || e); } }); };
  const ctx = vm.createContext(sandbox);
  const code = appScript(opts.html) + '\n;\n' + (testCode || '');
  vm.runInContext(code, ctx, { filename: 'index.html<script>' });
  return sandbox;
}

let _pass = 0, _fail = 0;
function check(name, cond, detail) {
  if (cond) { _pass++; console.log('  PASS', name); }
  else { _fail++; console.log('  FAIL', name, detail !== undefined ? '-> ' + JSON.stringify(detail) : ''); }
}
function done() {
  console.log(`\n${_pass} passed, ${_fail} failed`);
  process.exit(_fail ? 1 : 0);
}

module.exports = { run, check, done, appScript };
