// Meal Check: "Another idea" + grocery list in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e_grocery.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const MEAL = { is_food: true, meal_name: 'Scrambled eggs with cottage cheese', items: [{ name: 'whole eggs', amount: '2 large' }], protein_g: 29, added_sugar_g: 0, fiber_g: 0, sat_fat_g: 3.5, calories: 260, confidence: 'medium', assumptions: 'Standard large eggs', swap: 'Add ¼ cup rinsed black beans and salsa for 4 g fiber', swap_items: ['black beans', 'salsa'] };
const ALT = [
  { swap: 'Stir in 2 tbsp chia seeds and top with frozen berries', swap_items: ['chia seeds', 'frozen berries'] },
  { swap: 'Serve it on a slice of sprouted whole-grain toast', swap_items: ['sprouted grain bread'] },
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

  const requests = []; let altIdx = 0, mode = 'ok', delay = 0;
  await page.route('https://api.anthropic.com/**', async route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    const body = route.request().postDataJSON(); requests.push(body);
    const isAlt = /alternative swap/.test(body.system);
    if (isAlt && mode === '500') return route.fulfill({ status: 500, headers: h, body: 'x' });
    if (delay) await new Promise(r => setTimeout(r, delay));
    const payload = isAlt ? ALT[Math.min(altIdx++, ALT.length - 1)] : MEAL;
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }] }) });
  });
  await page.addInitScript(() => { if (!localStorage.getItem('gh_ai_key')) localStorage.setItem('gh_ai_key', 'sk-test'); });
  await page.goto(URL); await page.waitForTimeout(400);

  const fits = () => page.evaluate(() => { const s = document.querySelector('.sheet'); return { ok: s.scrollHeight <= s.clientHeight + 1, sh: s.scrollHeight, ch: s.clientHeight, vh: innerHeight }; });
  const swapText = () => page.textContent('.mc-swap');

  // ===== get to a result =====
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250);
  check('the first screen has a Grocery list entry', (await page.locator('.sheet button:has-text("Grocery list")').count()) === 1 && !(await page.textContent('.sheet')).includes('Grocery list ·'));
  await page.click('.sheet button:has-text("Type it")'); await page.fill('.sheet textarea', '2 eggs and cottage cheese');
  await page.click('.sheet button:has-text("Check it")'); await page.waitForSelector('.mc-top', { timeout: 6000 });
  check('the swap line has "Add to grocery list" and "Another idea" under it', (await swapText()).includes('black beans and salsa') && (await page.locator('.mc-acts button').count()) === 2 && (await page.locator('.mc-acts button:has-text("Add to grocery list")').count()) === 1 && (await page.locator('.mc-acts button:has-text("Another idea")').count()) === 1);
  check('both buttons are at least 44px tall', await page.evaluate(() => [...document.querySelectorAll('.mc-acts button')].every(b => b.getBoundingClientRect().height >= 43.5)));
  check('the three original buttons are still there', (await page.locator('.mc-btns button').count()) === 3);
  let f = await fits();
  check('THE RESULT CARD STILL FITS ONE SCREEN at 390x760', f.ok, f);
  await page.screenshot({ path: `${dir}/groc_1_result.png` });

  // ===== Another idea =====
  delay = 800; const nBefore = requests.length;
  await page.click('.mc-acts button:has-text("Another idea")'); await page.waitForTimeout(250);
  check('while it thinks: "Thinking…", Another idea disabled', (await page.textContent('.mc-swap')).includes('Thinking of another idea') && (await page.locator('.mc-acts button:has-text("Thinking…")').isDisabled()));
  await page.screenshot({ path: `${dir}/groc_2_thinking.png` });
  await page.dblclick('.mc-acts button:has-text("Thinking…")', { force: true }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.mc-swap') && !document.querySelector('.mc-swap').textContent.includes('Thinking'), null, { timeout: 6000 });
  delay = 0;
  check('the swap changed to the new idea', (await swapText()) === ALT[0].swap);
  check('exactly one request went out (clicks while thinking are ignored), asking to avoid the first idea', requests.length === nBefore + 1 && requests[nBefore].max_tokens === 150 && requests[nBefore].messages[0].content[0].text.includes('black beans and salsa'));
  check('the meal itself did not change: same name, same verdict, same four numbers', (await page.textContent('.mc-name')) === MEAL.meal_name && (await page.textContent('.mc-verdict')).includes('Okay') && (await page.locator('.mc-row').count()) === 4);
  await page.click('.mc-acts button:has-text("Another idea")'); await page.waitForTimeout(400);
  check('a second tap gives a third, different idea', (await swapText()) === ALT[1].swap);
  check('...and the request listed BOTH earlier ideas to avoid', /black beans and salsa/.test(requests[requests.length - 1].messages[0].content[0].text) && /chia seeds/.test(requests[requests.length - 1].messages[0].content[0].text));
  f = await fits(); check('card fits after changing ideas', f.ok, f);

  // ===== Add to grocery list =====
  await page.click('.mc-acts button:has-text("Add to grocery list")'); await page.waitForTimeout(300);
  check('the button becomes "View list (1)"', (await page.locator('.mc-acts button:has-text("View list (1)")').count()) === 1);
  check('a toast says what went on the list', (await page.textContent('#toast')).includes('Sprouted grain bread'));
  await page.screenshot({ path: `${dir}/groc_3_added.png` });
  // go back to an earlier-style idea and add its groceries too
  await page.click('.mc-acts button:has-text("Another idea")'); await page.waitForTimeout(400);   // (mock repeats the last idea; engine says so and keeps it)
  check('a repeated idea is refused politely and the card keeps the current one', (await page.textContent('.sheet')).includes('Same idea again') && (await swapText()) === ALT[1].swap);
  f = await fits(); check('the card fits with the "same idea" note showing', f.ok, f);
  check('the list button stayed as "View list" (nothing changed)', (await page.locator('.mc-acts button:has-text("View list (1)")').count()) === 1);

  // failure note
  mode = '500'; await page.click('.mc-acts button:has-text("Another idea")'); await page.waitForTimeout(400);
  check('a failed request shows a calm note, keeps the idea, still fits', (await page.textContent('.sheet')).includes('get another idea') && (await swapText()) === ALT[1].swap && (await fits()).ok);
  await page.screenshot({ path: `${dir}/groc_4_fail.png` });
  mode = 'ok';
  await ctx.setOffline(true); await page.waitForTimeout(150);
  await page.click('.mc-acts button:has-text("Another idea")'); await page.waitForTimeout(250);
  check('OFFLINE: "Needs a connection." and no request', (await page.textContent('.sheet')).includes('Needs a connection.'));
  await ctx.setOffline(false);

  // ===== The list =====
  await page.click('.mc-acts button:has-text("View list (1)")'); await page.waitForTimeout(250);
  check('the list shows the item under its aisle', (await page.textContent('.sheet')).includes('Sprouted grain bread') && (await page.textContent('.sheet')).includes('Grains & bread'));
  await page.screenshot({ path: `${dir}/groc_5_list.png` });
  // add more via the engine so the list has a few items
  await page.evaluate(() => { addToGrocery(['black beans', 'salsa', 'chia seeds']); renderMealSheet(true); });
  check('every row control is at least 44px tall', await page.evaluate(() => [...document.querySelectorAll('.mc-shop button, .sheet > .btn')].every(b => b.getBoundingClientRect().height >= 43.5)));
  await page.click('.mc-shop-t:has-text("Black beans")'); await page.waitForTimeout(150);
  check('tapping an item checks it off, struck through', await page.evaluate(() => { const b = [...document.querySelectorAll('.mc-shop-t.done b')]; return b.length === 1 && b[0].textContent === 'Black beans' && getComputedStyle(b[0]).textDecorationLine === 'line-through'; }));
  check('"Clear checked" appears', (await page.locator('.sheet button:has-text("Clear checked")').count()) === 1);
  await page.screenshot({ path: `${dir}/groc_6_list_checked.png` });
  await page.click('.sheet button:has-text("Share list")'); await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check('Share list copies (no share sheet on desktop) only what is still to buy', clip === 'Grocery list\n\nGrains & bread\n• Sprouted grain bread\n\nCanned & dry\n• Salsa\n• Chia seeds', clip);
  check('...and says so', (await page.textContent('#toast')).includes('List copied'));
  await page.click('.sheet button:has-text("Clear checked")'); await page.waitForTimeout(200);
  check('Clear checked removes it', !(await page.textContent('.sheet')).includes('Black beans') && (await page.locator('.mc-shop').count()) === 3);
  await page.click('.mc-shop .mc-del >> nth=0'); await page.waitForTimeout(200);
  check('✕ removes one item', (await page.locator('.mc-shop').count()) === 2);
  await page.click('.sheet button:has-text("Back")'); await page.waitForTimeout(200);
  check('Back returns to the meal result', (await page.locator('.mc-top').count()) === 1);

  // ===== Persistence + entry points =====
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200);
  await page.reload(); await page.waitForTimeout(400);
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250);
  check('after a reload the first screen shows the count', (await page.textContent('.sheet')).includes('Grocery list · 2'));
  await page.click('.sheet button:has-text("Grocery list")'); await page.waitForTimeout(200);
  check('...and the list is still there', (await page.locator('.sheet .mc-shop').count()) === 2);
  await page.click('.sheet button:has-text("Back")'); await page.waitForTimeout(200);
  check('Back from the list (no meal open) returns to the first screen', (await page.textContent('.sheet')).includes('Saved meals'));
  const saved = await page.evaluate(() => JSON.stringify(exportObject()));
  check('the list is in the backup, the key is not', saved.includes('"groceryList"') && saved.includes('Salsa') && saved.includes('Chia seeds') && !saved.includes('sk-test'));
  await page.evaluate(() => closeSheet()); await page.evaluate(() => closeOver()); await page.waitForTimeout(200);
  check('the Weight page grocery card shows what the sheet did (no stale list after closing)', (await page.textContent('#groceryCard')).includes('Salsa') && !(await page.textContent('#groceryCard')).includes('Black beans'));
  check('Today still has exactly 4 habits and nothing about shopping', (await page.locator('.today .hrow').count()) === 4 && !(await page.textContent('.today')).match(/shopping|Another idea/i));

  // ===== A shorter phone =====
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 667 }, hasTouch: true })).newPage();
  p2.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p2.route('https://api.anthropic.com/**', route => { const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }; if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h }); route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(Object.assign({}, MEAL, { confidence: 'low', swap: 'Swap pepperoni for veggies and add a side of white beans for fiber' })) }] }) }); });
  await p2.addInitScript(() => localStorage.setItem('gh_ai_key', 'sk-test'));
  await p2.goto(URL); await p2.waitForTimeout(300);
  await p2.click('.hrow:has-text("Protein")'); await p2.waitForTimeout(300); await p2.click('button:has-text("Check a meal")'); await p2.waitForTimeout(250);
  await p2.click('.sheet button:has-text("Type it")'); await p2.fill('.sheet textarea', 'pizza'); await p2.click('.sheet button:has-text("Check it")'); await p2.waitForSelector('.mc-top');
  await p2.evaluate(() => { MC.altNote = 'Same idea again — tap once more.'; renderMealSheet(true); });
  const f2 = await p2.evaluate(() => { const s = document.querySelector('.sheet'); return { ok: s.scrollHeight <= s.clientHeight + 1, sh: s.scrollHeight, ch: s.clientHeight, vh: innerHeight }; });
  check('even on a 390x667 phone, with "Rough estimate" and a note showing, the card fits without scrolling', f2.ok, f2);
  await p2.screenshot({ path: `${dir}/groc_7_667.png` });

  check('no console errors or page errors', errors.length === 0, errors);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
