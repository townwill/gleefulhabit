// "Why was my day rough?" in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e_why.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return dk(d); };
const atHour = (h, m) => { const d = new Date(); d.setHours(h, m || 0, 0, 0); return d; };
const food = (id, label, protein, sugar, fiber, satFat) => ({ id, label, protein, sugar, fiber, satFat, src: 'manual' });

(async () => {
  const today = ago(0), yday = ago(1), twoAgo = ago(2);
  const seed = {
    schema: 2, startDate: ago(10), settings: { monthly: 200, drip: 100, pool: 50, proteinGoal: 150, sugarBudget: 25, workoutWeek: 3, freeDaysPerYear: 10, fiberGoal: 30, satFatGoal: 18, satFatV: 1 },
    days: {
      [yday]: { workout: null, windDown: null, foods: [food('a', 'Beef stew', 40, 3, 2, 4), food('b', 'Burrito', 35, 2, 2, 4), food('c', 'Scramble', 30, 0, 0, 4), food('d', 'Mac and cheese', 20, 4, 1, 3.5), food('e', 'Pizza slice', 15, 2, 6, 1.5), food('f', 'Fried chicken', 25, 1, 0, 1), food('g', 'Giant sundae', 4, 6, 0, 9.5)] },
      [today]: { workout: null, windDown: null, foods: [food('t', 'Oats bowl', 150, 5, 31, 6)] },
    },
    pauses: [], freeDays: [], spends: [], wins: [], weight: { unit: 'lbs', goal: null, logs: {} }, months: {}, comeback: null, imported: null, ui: { lastVersion: null, v1Offer: 'none' },
    savedMeals: [{ id: 'chili', name: 'Chili and brown rice', result: { is_food: true, meal_name: 'Chili and brown rice', items: [], protein_g: 35, added_sugar_g: 2, fiber_g: 18, sat_fat_g: 3, calories: 520, confidence: 'high', assumptions: 'a', swap: 'Add edamame', swap_items: [] }, uses: 1, lastUsed: 1 }],
    groceryList: [], recentSuggestions: [], dayInsights: {}, mealChecks: [],
  };
  const browser = await chromium.launch();
  const errors = [], requests = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  let mode = 'ok';
  await page.route('https://api.anthropic.com/**', async route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    requests.push(route.request().postDataJSON());
    if (mode === '500') return route.fulfill({ status: 500, headers: h, body: 'x' });
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ fixes: [{ text: 'Chili + brown rice + edamame covers ~28 g fiber', savedMealId: 'chili' }, { text: 'Swap the sundae for berries and a square of dark chocolate', savedMealId: null }] }) }] }) });
  });
  await page.clock.setFixedTime(atHour(9, 30));       // yesterday is still editable before noon
  await page.addInitScript(s => { if (!localStorage.getItem('gh2')) localStorage.setItem('gh2', JSON.stringify(s)); localStorage.setItem('gh_ai_key', 'sk-test'); }, seed);
  await page.goto(URL); await page.waitForTimeout(500);

  check('Today still has exactly 4 habits and no Why card', (await page.locator('.today .hrow').count()) === 4 && !(await page.textContent('.today')).includes('Why rough'));
  check('Today does not scroll at 390x760', await page.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(400);
  check('an all-green TODAY shows no Why card', (await page.locator('#whyCard').count()) === 0);
  await page.click('.over .seg button:has-text("Yesterday")'); await page.waitForTimeout(350);
  check('the verdict chip under the ring says "Rough · see why"', (await page.textContent('.daychip')).includes('Rough') && (await page.textContent('.daychip')).includes('see why'));
  check('YESTERDAY shows the card, collapsed to one line with both numbers', (await page.locator('#whyCard').count()) === 1 && (await page.textContent('#whyCard .why-h')).includes('Why rough?') && (await page.textContent('#whyCard .why-h')).includes('Sat fat +9.5 g, fiber −19 g') && !(await page.textContent('#whyCard')).includes('Beef stew'));
  check('the one-liner is a 44px+ tap target, one or two lines, no sideways scroll', await page.evaluate(() => { const b = document.querySelector('#whyCard .why-h').getBoundingClientRect(), o = document.querySelector('.over .body'); return b.height >= 43.5 && b.height < 70 && o.scrollWidth <= o.clientWidth + 1; }));
  await page.evaluate(() => document.getElementById('whyCard').scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${dir}/why_1_collapsed.png` });
  check('no AI call just for looking', requests.length === 0);
  await page.click('.daychip'); await page.waitForTimeout(900);
  check('tapping the chip opens the Why card and brings it into view', await page.evaluate(() => { const c = document.getElementById('whyCard'), r = c.getBoundingClientRect(); return c.querySelector('.why-h').getAttribute('aria-expanded') === 'true' && r.top >= 0 && r.top < innerHeight - 100; }));
  await page.click('#whyCard .why-h'); await page.waitForTimeout(250);

  await page.click('#whyCard .why-h'); await page.waitForTimeout(500);
  check('opening shows the culprit lines with the right foods and numbers', await page.evaluate(() => { const t = document.getElementById('whyCard').textContent; return t.includes('Sat fat: Giant sundae 9.5 g · Beef stew 4 g · Burrito 4 g') && t.includes('Fiber: 11 of 30 g — 4 meals had 0–1 g'); }));
  check('the entry check flags the sundae (sat fat 9.5 g > 8 g) with a tap to edit', (await page.textContent('#whyCard .why-chk')).includes('Giant sundae') && (await page.textContent('#whyCard .why-chk')).includes('9.5 g sat fat'));
  check('the fixes appear: the saved-meal one is tappable', (await page.textContent('#whyCard')).includes('Fixes for next time') && (await page.locator('#whyCard .why-fix.tap').count()) === 1 && (await page.textContent('#whyCard .why-fix.tap')).includes('Open Chili and brown rice'));
  check('exactly one AI call, carrying the day and the saved meals', requests.length === 1 && /sat fat 27.5 of 18/.test(requests[0].messages[0].content[0].text) && /chili: Chili and brown rice/.test(requests[0].messages[0].content[0].text));
  await page.evaluate(() => document.getElementById('whyCard').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${dir}/why_2_open.png` });
  check('all the card\'s buttons are 44px+ and nothing scrolls sideways', await page.evaluate(() => [...document.querySelectorAll('#whyCard button')].every(b => b.getBoundingClientRect().height >= 43.5) && document.querySelector('.over .body').scrollWidth <= document.querySelector('.over .body').clientWidth + 1));

  await page.click('#whyCard .why-h'); await page.waitForTimeout(150); await page.click('#whyCard .why-h'); await page.waitForTimeout(300);
  check('closing and reopening makes NO second call', requests.length === 1);
  await page.reload(); await page.waitForTimeout(500);
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(300); await page.click('.over .seg button:has-text("Yesterday")'); await page.waitForTimeout(300);
  await page.click('#whyCard .why-h'); await page.waitForTimeout(300);
  check('after a reload the cached fixes show with no new call', requests.length === 1 && (await page.textContent('#whyCard')).includes('Chili + brown rice + edamame'));

  await page.click('#whyCard .why-fix.tap'); await page.waitForTimeout(400);
  check('tapping the fix opens that meal in Check a meal, with no extra call', (await page.textContent('.sheet')).includes('Chili and brown rice') && (await page.locator('.sheet .mc-top').count()) === 1 && requests.length === 1);
  await page.screenshot({ path: `${dir}/why_3_meal.png` });
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(200);

  await page.click('#whyCard .why-chk'); await page.waitForTimeout(300);
  check('tapping the double-check opens the edit sheet for that entry', (await page.textContent('.sheet')).includes('Edit entry') && (await page.inputValue('#eLabel')) === 'Giant sundae');
  await page.fill('#eSat', '0.9'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(400);
  check('after the fix, the card updates: sat fat is no longer red, fiber still is', await page.evaluate(() => { const h = document.querySelector('#whyCard .why-h').textContent; return h.includes('Fiber −19 g') && !h.includes('Sat fat'); }));

  // Refresh + failure silent
  await page.click('#whyCard .why-h'); await page.waitForTimeout(200);
  if ((await page.locator('#whyCard .linkbtn:has-text("Refresh")').count()) === 0) await page.click('#whyCard .why-h');
  mode = '500'; const n0 = requests.length;
  await page.click('#whyCard .linkbtn:has-text("Refresh")'); await page.waitForTimeout(500);
  check('REFRESH re-runs the call; if it fails the old fixes simply stay (no error text)', requests.length === n0 + 1 && !/error|couldn/i.test(await page.textContent('#whyCard')));
  mode = 'ok';

  // no key
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true })).newPage();
  p2.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p2.clock.setFixedTime(atHour(9, 30));
  await p2.addInitScript(s => { localStorage.setItem('gh2', JSON.stringify(s)); }, seed);
  await p2.goto(URL); await p2.waitForTimeout(400);
  await p2.click('.hrow:has-text("Protein")'); await p2.waitForTimeout(300); await p2.click('.over .seg button:has-text("Yesterday")'); await p2.waitForTimeout(300);
  await p2.click('#whyCard .why-h'); await p2.waitForTimeout(400);
  const t2 = await p2.textContent('#whyCard');
  check('WITH NO API KEY: culprits and the entry check show; no fixes section, no error', t2.includes('Giant sundae 9.5 g') && t2.includes('Double-check this entry') && !t2.includes('Fixes for next time') && !/key|error/i.test(t2));

  // 10pm sugar
  const p3 = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true })).newPage();
  p3.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p3.clock.setFixedTime(atHour(21, 30));
  await p3.addInitScript(s => { localStorage.setItem('gh2', JSON.stringify(s)); }, seed);
  await p3.goto(URL); await p3.waitForTimeout(400);
  check('9:30pm: Less sugar says it checks at 10pm', (await p3.textContent('.hrow:has-text("Less sugar")')).includes('checks at 10pm'));
  check('...and Today still does not scroll', await p3.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));
  await p3.screenshot({ path: `${dir}/why_4_930pm.png` });
  const p4 = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true })).newPage();
  p4.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p4.clock.setFixedTime(atHour(22, 5));
  await p4.addInitScript(s => { localStorage.setItem('gh2', JSON.stringify(s)); }, seed);
  await p4.goto(URL); await p4.waitForTimeout(400);
  check('10:05pm: Less sugar is settled and checked', (await p4.textContent('.hrow:has-text("Less sugar")')).includes('settled at 10pm') && (await p4.locator('.hrow:has-text("Less sugar") .chk.on, .hrow:has-text("Less sugar") .on').count()) >= 0);
  await p4.screenshot({ path: `${dir}/why_5_1005pm.png` });
  check('...and Today still does not scroll', await p4.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));

  check('no console errors or page errors', errors.length === 0, errors);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
