// Minimal DOM-stub harness for GleefulHabit's index.html script.
// Usage: node v2/tests/harness.js v2/index.html v2/tests/test_money.js   (works for v1 index.html too)
const fs = require('fs');

const indexPath = process.argv[2];
const testFile = process.argv[3];
const src = fs.readFileSync(indexPath, 'utf8');

const scriptMatches = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
// The app logic is the larger of the two inline <script> blocks.
const appScript = scriptMatches.map(m => m[1]).sort((a, b) => b.length - a.length)[0];

function makeStubElement(id) {
  const el = {
    id,
    _html: '', _text: '', value: '', checked: false,
    dataset: {}, children: [],
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){},
    appendChild(child){ el.children.push(child); return child; },
    removeChild(){}, remove(){},
    setAttribute(){}, removeAttribute(){}, getAttribute(){ return null; },
    focus(){}, click(){}, blur(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; }, scrollIntoView(){},
  };
  Object.defineProperty(el, 'innerHTML', { get(){ return el._html; }, set(v){ el._html = v; } });
  Object.defineProperty(el, 'textContent', { get(){ return el._text; }, set(v){ el._text = v; } });
  return el;
}

const elementCache = new Map();
function getElementById(id) {
  if (!elementCache.has(id)) elementCache.set(id, makeStubElement(id));
  return elementCache.get(id);
}

let storageData = {};
const localStorage = {
  getItem: k => (k in storageData ? storageData[k] : null),
  setItem: (k, v) => { storageData[k] = String(v); },
  removeItem: k => { delete storageData[k]; },
  clear: () => { storageData = {}; },
};

const document = {
  getElementById,
  createElement: tag => makeStubElement(`created:${tag}`),
  addEventListener(){}, removeEventListener(){},
  querySelectorAll(){ return []; },
  querySelector(){ return null; },
  visibilityState: 'visible',
  body: makeStubElement('body'),
};

const navigator = { canShare: () => false, share: async () => {} };
function fetch(){ return Promise.reject(new Error('fetch disabled in harness')); }

// Fake clock: only intercepts zero-arg `new Date()`; explicit-arg forms pass through untouched.
let _fakeNow = null;
class FakeDate extends Date {
  constructor(...args) {
    if (args.length === 0 && _fakeNow !== null) super(_fakeNow);
    else super(...args);
  }
  static now() { return _fakeNow !== null ? _fakeNow : Date.now(); }
}

let confirm = () => true;
let prompt = () => null;
let location = { pathname: '/', href: '/' };
const harnessGlobals = {
  document, localStorage, navigator, fetch, Date: FakeDate, confirm, prompt, location,
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: cb => cb(),
  cancelAnimationFrame(){},
  _setFakeNow: ms => { _fakeNow = ms; },
  _getElementCache: () => elementCache,
  _storageData: () => storageData,
};

const testSrc = fs.readFileSync(testFile, 'utf8');

// let/const inside a direct eval() don't leak out — so the app script and the
// test code must run in the SAME eval() call.
const combined = `
(function(${Object.keys(harnessGlobals).join(',')}) {
${appScript}
;
${testSrc}
})
`;
const fn = eval(combined);
fn(...Object.values(harnessGlobals));
