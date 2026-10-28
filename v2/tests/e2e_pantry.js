// My pantry + itemized estimates in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e_pantry.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const TUNA3 = { is_food: true, meal_name: 'Tuna salad', items: [
  { name: 'Wild Planet Skipjack Tuna', amount: '1 can', pantryId: 'p-tuna', source: 'pantry', assumed: false, protein: 27, addedSugar: 0, fiber: 0, satFat: 1.5 },
  { name: 'Kirkland Greek yogurt', amount: '1/4 cup', pantryId: 'p-gyogurt', source: 'pantry', assumed: false, protein: 12, addedSugar: 0, fiber: 0, satFat: 0 },
  { name: '365 light mayo', amount: '1 tbsp', pantryId: 'p-mayo', source: 'pantry', assumed: false, protein: 0, addedSugar: 0, fiber: 0, satFat: 0 },
  { name: 'Celery', amount: '1 stalk', pantryId: null, source: 'estimate', assumed: true, protein: 0.3, addedSugar: 0, fiber: 0.6, satFat: 0 }],
  totals: { protein: 39, addedSugar: 0, fiber: 0.6, satFat: 1.5 }, calories: 280, confidence: 'high', assumptions: 'Pantry numbers.', swap: 'Add diced pickles', swap_items: ['pickles'] };
const LABEL = { name: "Siggi's Vanilla Skyr", brand: "Siggi's", serving_label: '3/4 cup (170g)', serving_grams: 170, protein_g: 15, added_sugar_g: 7, fiber_g: 0, sat_fat_g: 0 };

(async () => {
  const browser = await chromium.launch();
  const errors = [], requests = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('https://api.anthropic.com/**', async route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    const body = route.request().postDataJSON(); requests.push(body);
    const payload = /Nutrition Facts label/.test(body.system) ? LABEL : TUNA3;
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }] }) });
  });
  await page.addInitScript(() => { if (!localStorage.getItem('gh_ai_key')) localStorage.setItem('gh_ai_key', 'sk-test'); });
  await page.goto(URL); await page.waitForTimeout(500);

  check('Today still has exactly 4 habits and no pantry, and does not scroll', (await page.locator('.today .hrow').count()) === 4 && !/pantry/i.test(await page.textContent('.today')) && await page.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));

  // ===== the pantry screen =====
  await page.evaluate(() => { curPage = 0; render(); }); await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('pantryCard').scrollIntoView({ block: 'center' }));
  check('the second page has the "My pantry · 13" card', (await page.textContent('#pantryCard')).includes('My pantry · 13'));
  await page.screenshot({ path: `${dir}/pan_0_card.png` });
  await page.click('#pantryCard button:has-text("Open pantry")'); await page.waitForTimeout(350);
  check('the pantry lists all 13 items, each row 44px+ tall', (await page.locator('.sheet .pn-row').count()) === 13 && await page.evaluate(() => [...document.querySelectorAll('.sheet .pn-row')].every(r => r.getBoundingClientRect().height >= 43.5)));
  await page.screenshot({ path: `${dir}/pan_1_list.png` });
  await page.fill('#pnQ', 'tuna'); await page.waitForTimeout(150);
  check('search narrows it (and keeps typing focus)', (await page.locator('.sheet .pn-row').count()) === 1 && await page.evaluate(() => document.activeElement.id === 'pnQ'));
  await page.fill('#pnQ', ''); await page.waitForTimeout(100);

  // ===== add by label photo =====
  await page.click('.sheet button:has-text("Add item")'); await page.waitForTimeout(250);
  await page.setInputFiles('#pnFile', { name: 'label.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(900);
  check('Snap label pre-fills the form from the label (nothing saved yet)', (await page.inputValue('#pnName')) === "Siggi's Vanilla Skyr" && (await page.inputValue('#pnServ')) === '3/4 cup (170g)' && (await page.inputValue('#pnProt')) === '15' && (await page.inputValue('#pnSug')) === '7' && (await page.inputValue('#pnFib')) === '0' && (await page.inputValue('#pnSat')) === '0' && (await page.evaluate(() => S.pantry.length)) === 13);
  check('the label request carried the photo and no pantry', requests.length === 1 && requests[0].messages[0].content[0].type === 'image' && !/PANTRY/.test(requests[0].system));
  await page.screenshot({ path: `${dir}/pan_2_form.png` });
  check('form fields are 44px+ tall and nothing scrolls sideways', await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth + 1 && [...document.querySelectorAll('.sheet input:not([type=file]), .sheet button')].every(b => b.getBoundingClientRect().height >= 43.5); }));
  await page.fill('#pnAlias', 'skyr, siggis');
  await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(300);
  check('after I confirm (Save) it is in the pantry with the right numbers', await page.evaluate(() => { const p = S.pantry.find(x => x.name === "Siggi's Vanilla Skyr"); return !!p && p.protein === 15 && p.addedSugar === 7 && p.fiber === 0 && p.satFat === 0 && p.servingLabel === '3/4 cup (170g)' && p.servingGrams === 170 && p.aliases.join() === 'skyr,siggis'; }));
  check('...and the list shows it (14 items)', (await page.locator('.sheet .pn-row').count()) === 14);
  // edit + delete
  await page.click('.sheet .pn-row:has-text("Siggi")'); await page.waitForTimeout(250);
  await page.fill('#pnProt', '16'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(250);
  check('editing saves in place', await page.evaluate(() => S.pantry.filter(x => x.name.includes('Siggi')).length === 1 && S.pantry.find(x => x.name.includes('Siggi')).protein === 16));
  await page.click('.sheet .pn-row:has-text("Siggi")'); await page.waitForTimeout(250);
  await page.click('.sheet button:has-text("Delete")'); await page.waitForTimeout(150);
  check('delete asks twice', (await page.evaluate(() => S.pantry.length)) === 14 && (await page.locator('.sheet button:has-text("Tap again to delete")').count()) === 1);
  await page.click('.sheet button:has-text("Tap again to delete")'); await page.waitForTimeout(250);
  check('the second tap deletes it', (await page.evaluate(() => S.pantry.length)) === 13);
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(300);
  check('closing keeps the Weight card in step', (await page.textContent('#pantryCard')).includes('My pantry · 13'));

  // ===== itemized estimate =====
  await page.evaluate(() => { curPage = 1; render(); }); await page.waitForTimeout(300);
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(400);
  await page.click('.over button:has-text("Check a meal")'); await page.waitForTimeout(250);
  await page.click('.sheet button:has-text("Type it")'); await page.fill('.sheet textarea', 'tuna salad: 1 can skipjack, 1/4 cup greek yogurt, 1 tbsp light mayo');
  const n0 = requests.length;
  await page.click('.sheet button:has-text("Check it")'); await page.waitForSelector('.it-row', { timeout: 6000 });
  check('the estimate prompt carried the pantry and its rules', requests.length === n0 + 1 && /PANTRY \(per serving shown\): \[/.test(requests[n0].system) && requests[n0].system.includes('"p-tuna"') && /Don't round protein down/.test(requests[n0].system));
  check('four rows: three tagged "pantry", one "est.", celery\'s assumed amount underlined', (await page.locator('.sheet .it-row').count()) === 4 && (await page.locator('.sheet .it-tag.p').count()) === 3 && (await page.locator('.sheet .it-tag.e').count()) === 1 && (await page.locator('.sheet .it-as').count()) === 1 && await page.evaluate(() => getComputedStyle(document.querySelector('.it-as')).textDecorationLine === 'underline'));
  check('the totals are the pantry numbers (~39 g protein, 0.5 g sat fat) and show on the card', await page.evaluate(() => MC.result.protein_g === 39.1 && MC.result.sat_fat_g === 0.5) && (await page.textContent('.sheet')).includes('39.1'));
  check('rows are 44px+ tall and the card does not scroll sideways', await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth + 1 && [...document.querySelectorAll('.it-row')].every(r => r.getBoundingClientRect().height >= 43.5); }));
  await page.screenshot({ path: `${dir}/pan_3_result.png` });
  await page.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = 220; });
  await page.screenshot({ path: `${dir}/pan_4_rows.png` });
  // edit amount: no new request
  const n1 = requests.length;
  await page.click('.it-row:has-text("Kirkland")'); await page.waitForTimeout(250);
  check('tapping a row opens the editor with amount, pantry item and numbers', (await page.inputValue('#rAmt')) === '1/4 cup' && (await page.inputValue('#rPan')) === 'p-gyogurt' && (await page.inputValue('#rProt')) === '6.8');
  await page.screenshot({ path: `${dir}/pan_5_edit.png` });
  await page.fill('#rAmt', '2/3 cup'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(300);
  check('changing the amount to 2/3 cup rescales (18 g) and the totals follow, with NO new AI call', requests.length === n1 && await page.evaluate(() => MC.result.lines[1].protein === 18 && MC.result.protein_g === 50.3) && (await page.textContent('.sheet')).includes('50.3'));
  // swap to another pantry item
  await page.click('.it-row:has-text("Kirkland")'); await page.waitForTimeout(250);
  await page.selectOption('#rPan', 'p-skyr'); await page.fill('#rAmt', '1 cup'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(300);
  check('swapping the row to Icelandic Provisions Skyr uses its numbers (15 g protein, 6 g added sugar)', await page.evaluate(() => { const l = MC.result.lines[1]; return l.pantryId === 'p-skyr' && l.protein === 15 && l.addedSugar === 6; }) && requests.length === n1);
  // est row: save to pantry
  await page.click('.it-row:has-text("Celery")'); await page.waitForTimeout(250);
  check('an est. row offers Save to pantry', (await page.locator('.sheet button:has-text("Save to pantry")').count()) === 1);
  await page.fill('#rProt', '0.5'); await page.click('.sheet button:has-text("Save to pantry")'); await page.waitForTimeout(300);
  check('Save to pantry adds it to the pantry and the row becomes a pantry row', await page.evaluate(() => S.pantry.length === 14 && S.pantry[13].name === 'Celery' && MC.result.lines[3].source === 'pantry') && (await page.locator('.sheet .it-tag.p').count()) === 4);
  // log it
  await page.click('.sheet button:has-text("Log it")'); await page.waitForTimeout(400);
  check('Log it logs the totals as before', await page.evaluate(() => { const f = foodsOn(todayKey()).find(x => x.label === 'Tuna salad'); return !!f && f.protein === MC.result.protein_g && f.satFat === MC.result.sat_fat_g; }));
  check('after logging the rows are locked', (await page.locator('.sheet .it-row[disabled]').count()) === 4);
  await page.screenshot({ path: `${dir}/pan_6_logged.png` });
  await page.evaluate(() => closeSheet()); await page.waitForTimeout(200);

  // ===== Say it uses the pantry =====
  await page.click('.over button:has-text("Say it")'); await page.waitForTimeout(250);
  await page.fill('#aiText', 'tuna salad'); const n2 = requests.length; await page.click('#aiBtn'); await page.waitForTimeout(800);
  check('Say it sends the pantry and fills the form with the itemized totals', requests.length === n2 + 1 && /PANTRY/.test(requests[n2].system) && (await page.inputValue('#fLabel')) === 'Tuna salad' && parseFloat(await page.inputValue('#fProt')) > 38 && /from your pantry/.test(await page.textContent('#aiStatus')));

  // ===== no key =====
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true })).newPage();
  p2.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p2.goto(URL); await p2.waitForTimeout(400);
  await p2.evaluate(() => { localStorage.removeItem('gh_ai_key'); curPage = 0; render(); openPantry(); }); await p2.waitForTimeout(300);
  await p2.click('.sheet button:has-text("Add item")'); await p2.waitForTimeout(200);
  check('with NO API KEY the pantry still works: Snap label is not offered as a file picker', (await p2.locator('.sheet input[type=file]').count()) === 0);
  await p2.fill('#pnName', 'Plain oats'); await p2.fill('#pnServ', '1/2 cup'); await p2.fill('#pnProt', '5'); await p2.fill('#pnSug', '0'); await p2.fill('#pnFib', '4'); await p2.fill('#pnSat', '0.5');
  await p2.click('.sheet button:has-text("Save")'); await p2.waitForTimeout(300);
  check('...manual entry saves', await p2.evaluate(() => S.pantry.some(p => p.name === 'Plain oats')));

  // ===== an old save =====
  const p3 = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true })).newPage();
  p3.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p3.addInitScript(() => { if (!localStorage.getItem('gh2')) localStorage.setItem('gh2', JSON.stringify({ schema: 2, startDate: '2026-10-01', settings: { monthly: 200, drip: 100, pool: 50, proteinGoal: 150, sugarBudget: 25, workoutWeek: 3, freeDaysPerYear: 10 }, days: { '2026-10-20': { workout: null, windDown: null, foods: [{ id: 'a', label: 'Eggs', protein: 20, sugar: 0, src: 'manual' }] } }, pauses: [], freeDays: [], spends: [], wins: [], weight: { unit: 'lbs', goal: null, logs: {} }, months: {}, comeback: null, imported: null, ui: { lastVersion: null, v1Offer: 'none' } })); });
  await p3.goto(URL); await p3.waitForTimeout(500);
  check('an old save (no pantry field) loads and gets the 13 seeded items, with its food kept', await p3.evaluate(() => S.pantry.length === 13 && S.days['2026-10-20'].foods.length === 1));

  check('no console errors or page errors', errors.length === 0, errors);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
