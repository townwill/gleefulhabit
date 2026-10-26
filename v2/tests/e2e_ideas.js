// Meal ideas + the Weight-page grocery list in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e_ideas.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const opt = (name, extra) => Object.assign({ meal_name: name, ingredients: [{ item: 'black beans', amount: '1 can', aisle: 'Canned & dry' }, { item: 'spinach', amount: '2 cups', aisle: 'Produce' }, { item: 'eggs', amount: '3', aisle: 'Dairy' }, { item: 'whole wheat tortillas', amount: '2', aisle: 'Grains & bread' }], steps: ['Warm the beans in a small pan', 'Wilt the spinach with a splash of water', 'Scramble the eggs until just set', 'Fill the tortillas and serve'], protein_g: 38, added_sugar_g: 2, fiber_g: 12, sat_fat_g: 3, calories: 430 }, extra || {});
const SETS = [
  { options: [opt('Bean and egg breakfast burrito'), opt('Turkey chili with beans', { protein_g: 42, sat_fat_g: 4, fiber_g: 11 }), opt('Cheesy lentil bake', { protein_g: 24, fiber_g: 15, sat_fat_g: 12 })] },
  { options: [opt('Chicken burrito bowl'), opt('Salmon and quinoa'), opt('Tofu stir fry')] },
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const requests = []; let n = 0, delay = 0;
  await page.route('https://api.anthropic.com/**', async route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    requests.push(route.request().postDataJSON());
    if (delay) await new Promise(r => setTimeout(r, delay));
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(SETS[Math.min(n++, SETS.length - 1)]) }] }) });
  });
  await page.addInitScript(() => { if (!localStorage.getItem('gh_ai_key')) localStorage.setItem('gh_ai_key', 'sk-test'); });
  await page.goto(URL); await page.waitForTimeout(500);

  check('Today still has exactly 4 habits, no Meal ideas / grocery, and does not scroll', (await page.locator('.today .hrow').count()) === 4 && !/Meal ideas|Grocery/i.test(await page.textContent('.today')) && await page.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(400);
  check('Check a meal and Meal ideas sit side by side, both 44px+ tall', await page.evaluate(() => { const a = [...document.querySelectorAll('.over button')].filter(b => /^(Check a meal|Meal ideas)$/.test(b.textContent.trim())); return a.length === 2 && a.every(b => b.getBoundingClientRect().height >= 43.5) && Math.abs(a[0].getBoundingClientRect().top - a[1].getBoundingClientRect().top) < 2; }));
  await page.screenshot({ path: `${dir}/idea_0_protein.png` });

  // ===== pick a meal type =====
  await page.click('.over button:has-text("Meal ideas")'); await page.waitForTimeout(300);
  check('the sheet offers Breakfast, Lunch, Dinner, Snack as big buttons', await page.evaluate(() => ['Breakfast', 'Lunch', 'Dinner', 'Snack'].every(t => [...document.querySelectorAll('.sheet button')].some(b => b.textContent.trim() === t && b.getBoundingClientRect().height >= 43.5))));
  await page.screenshot({ path: `${dir}/idea_1_pick.png` });
  delay = 600;
  await page.click('.sheet button:has-text("Dinner")'); await page.waitForTimeout(250);
  check('a loading state shows while it works', (await page.textContent('.sheet')).includes('Finding dinner ideas'));
  await page.screenshot({ path: `${dir}/idea_2_loading.png` });
  await page.waitForSelector('.idea', { timeout: 6000 }); delay = 0;
  check('the request carries the meal type and the remaining budget', requests.length === 1 && /Meal type: Dinner/.test(requests[0].messages[0].content[0].text) && /protein still needed: 150 g/.test(requests[0].messages[0].content[0].text));
  check('three option cards, each with name, verdict, four numbers, ingredients, steps and three buttons', (await page.locator('.idea').count()) === 3 && (await page.locator('.idea .idea-n > div').count()) === 12 && (await page.locator('.idea ul li').count()) === 12 && (await page.locator('.idea ol li').count()) === 12 && (await page.locator('.idea .mc-btns button').count()) === 9);
  check('the verdicts follow the rules (green, green, red)', (await page.locator('.idea .mc-verdict').allTextContents()).map(t => t.trim()).join() === 'Great fit,Great fit,Rethink');
  check('no sideways scroll; every button is 44px+ tall', await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth + 1 && [...document.querySelectorAll('.sheet button')].every(b => b.getBoundingClientRect().height >= 43.5); }));
  check('the sheet scrolls inside itself (it is taller than the screen) and stays within the viewport', await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.getBoundingClientRect().bottom <= innerHeight + 1 && s.getBoundingClientRect().top >= 0; }));
  await page.screenshot({ path: `${dir}/idea_3_options.png` });
  await page.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = s.scrollHeight; });
  await page.screenshot({ path: `${dir}/idea_4_options_bottom.png` });

  // ===== card buttons =====
  await page.click('.idea >> nth=0 >> button:has-text("Add to list")'); await page.waitForTimeout(250);
  check('Add to list: the button confirms and a toast says how many items', (await page.locator('.idea >> nth=0 >> button:has-text("On list ✓")').count()) === 1 && (await page.textContent('#toast')).includes('4 items'));
  await page.click('.idea >> nth=1 >> button:has-text("Add to list")'); await page.waitForTimeout(250);
  check('the grocery count shows on the sheet', (await page.textContent('.sheet')).includes('Grocery list · 4'));
  await page.click('.idea >> nth=0 >> button:has-text("Log it")'); await page.waitForTimeout(300);
  check('Log it: the meal is on today\'s food list with fiber and sat fat', await page.evaluate(() => { const f = foodsOn(todayKey()).find(x => x.label === 'Bean and egg breakfast burrito'); return !!f && f.protein === 38 && f.fiber === 12 && f.satFat === 3; }));
  await page.click('.idea >> nth=2 >> button:has-text("Save meal")'); await page.waitForTimeout(250);
  check('Save meal: it appears among saved meals', await page.evaluate(() => S.savedMeals.some(s => s.name === 'Cheesy lentil bake')));

  // ===== shuffle =====
  await page.evaluate(() => { document.querySelector('.sheet').scrollTop = 99999; });
  await page.click('.sheet button:has-text("Shuffle")'); await page.waitForSelector('.idea:has-text("Chicken burrito bowl")', { timeout: 6000 });
  check('Shuffle brings 3 new options and tells the model what to avoid', (await page.locator('.idea').count()) === 3 && requests.length === 2 && /Turkey chili with beans/.test(requests[1].messages[0].content[0].text) && /Bean and egg breakfast burrito/.test(requests[1].messages[0].content[0].text));

  // ===== the grocery list from the sheet =====
  await page.click('.sheet button:has-text("Grocery list")'); await page.waitForTimeout(250);
  check('the list groups by aisle in store order with x2 for repeats', await page.evaluate(() => { const a = [...document.querySelectorAll('.sheet .g-aisle')].map(e => e.textContent); return a.join('|') === 'Produce|Dairy|Grains & bread|Canned & dry' && document.querySelector('.sheet').textContent.includes('×2'); }));
  await page.screenshot({ path: `${dir}/idea_5_list.png` });
  await page.fill('#gManS', 'paper towels'); await page.click('.sheet .g-add button'); await page.waitForTimeout(250);
  check('the manual add box adds an item under Other', (await page.textContent('.sheet')).includes('Paper towels') && (await page.locator('.sheet .g-aisle:has-text("Other")').count()) === 1);
  await page.click('.sheet .mc-shop-t:has-text("Spinach")'); await page.waitForTimeout(200);
  await page.click('.sheet button:has-text("Clear checked")'); await page.waitForTimeout(200);
  check('Clear checked removes only the checked item', !(await page.textContent('.sheet')).includes('Spinach') && (await page.textContent('.sheet')).includes('Eggs') && (await page.textContent('.sheet')).includes('Paper towels'));
  await page.evaluate(() => closeSheet()); await page.evaluate(() => closeOver()); await page.waitForTimeout(250);

  // ===== the Weight page =====
  await page.evaluate(() => { curPage = 0; render(); }); await page.waitForTimeout(300);
  check('the second page has the Grocery list card with the same items', (await page.textContent('#groceryCard')).includes('Eggs') && (await page.textContent('#groceryCard')).includes('Paper towels') && !(await page.textContent('#groceryCard')).includes('Spinach'));
  await page.evaluate(() => document.getElementById('groceryCard').scrollIntoView());
  await page.screenshot({ path: `${dir}/idea_6_weight.png` });
  check('on that page: Share, manual add and checkboxes are 44px+ and nothing scrolls sideways', await page.evaluate(() => { const c = document.getElementById('groceryCard'); const w = document.querySelector('.page.weight'); return [...c.querySelectorAll('button, input')].every(b => b.getBoundingClientRect().height >= 43.5) && w.scrollWidth <= w.clientWidth + 1; }));
  const top0 = await page.evaluate(() => document.querySelector('.page.weight').scrollTop);
  await page.click('#groceryCard .mc-shop-t:has-text("Eggs")'); await page.waitForTimeout(200);
  check('ticking an item keeps your place on the page and checks it', await page.evaluate(() => S.groceryList.find(i => i.item === 'Eggs').checked === true) && Math.abs((await page.evaluate(() => document.querySelector('.page.weight').scrollTop)) - top0) < 2);
  await page.fill('#gManP', 'bananas'); await page.press('#gManP', 'Enter'); await page.waitForTimeout(250);
  check('Enter in the manual box adds the item (Produce)', await page.evaluate(() => { const b = S.groceryList.find(i => i.item === 'Bananas'); return !!b && b.aisle === 'Produce'; }));
  let clip = '';
  await page.evaluate(() => { navigator.share = undefined; });
  await page.click('#groceryCard button:has-text("Share list")'); await page.waitForTimeout(250);
  clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check('Share list copies only what is left to buy, by aisle', clip.startsWith('Grocery list\n\nProduce\n• Bananas') && !clip.includes('Eggs') && clip.includes('Paper towels'), clip);

  // ===== reload =====
  await page.reload(); await page.waitForTimeout(500);
  check('the list and the 7-day memory survive a reload', await page.evaluate(() => S.groceryList.length >= 3 && S.recentSuggestions.length === 6));

  check('no console errors or page errors', errors.length === 0, errors);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
