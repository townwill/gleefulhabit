// Day check + Suggest in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e_day.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return dk(d); };

const IDEAS = ['A cup of lentil soup with seeded toast for about 15 g fiber', 'Chia pudding made with oats and frozen berries', 'Two squares of dark chocolate with a handful of almonds'];

(async () => {
  const today = ago(0), yday = ago(1);
  const seed = {
    schema: 2, startDate: ago(10), settings: { monthly: 200, drip: 100, pool: 50, proteinGoal: 150, sugarBudget: 25, workoutWeek: 3, freeDaysPerYear: 10, fiberGoal: 30, satFatGoal: 13 },
    days: {
      [today]: { workout: null, windDown: null, foods: [{ id: 'a', label: 'Grilled chicken', protein: 90, sugar: 2, src: 'ai' }, { id: 'b', label: 'Yogurt bowl', protein: 60, sugar: 9, src: 'check', mc: 'mc-today' }] },
      [yday]: { workout: null, windDown: null, foods: [{ id: 'c', label: 'Big day', protein: 152, sugar: 10, src: 'check', mc: 'mc-yday' }] },
    },
    pauses: [], freeDays: [], spends: [], wins: [], weight: { unit: 'lbs', goal: null, logs: {} }, months: {}, comeback: null, imported: null, ui: { lastVersion: null, v1Offer: 'none' },
    savedMeals: [], shoppingList: [],
    mealChecks: [
      { id: 'mc-today', date: today, ts: 1, mealName: 'Yogurt bowl', verdict: 'yellow', protein_g: 60, added_sugar_g: 9, fiber_g: 12, sat_fat_g: 5, logged: true },
      { id: 'mc-yday', date: yday, ts: 1, mealName: 'Big day', verdict: 'green', protein_g: 152, added_sugar_g: 10, fiber_g: 31, sat_fat_g: 8, logged: true },
    ],
  };

  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const requests = []; let mode = 'ok', delay = 0, n = 0;
  await page.route('https://api.anthropic.com/**', async route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    requests.push(route.request().postDataJSON());
    if (mode === '500') return route.fulfill({ status: 500, headers: h, body: 'x' });
    if (delay) await new Promise(r => setTimeout(r, delay));
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ idea: IDEAS[Math.min(n++, IDEAS.length - 1)] }) }] }) });
  });
  await page.addInitScript(s => { if (!localStorage.getItem('gh2')) localStorage.setItem('gh2', JSON.stringify(s)); localStorage.setItem('gh_ai_key', 'sk-test'); }, seed);
  await page.goto(URL); await page.waitForTimeout(500);

  // ===== the main page is untouched =====
  check('Today still has exactly 4 habits and nothing about the day check', (await page.locator('.today .hrow').count()) === 4 && !(await page.textContent('.today')).match(/Suggest|Your day|so far/i));
  check('Today does not scroll at 390x760', await page.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));

  // ===== Protein page =====
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(400);
  check('a verdict chip sits under the ring: "Okay so far · see your day"', (await page.textContent('.daychip')).includes('Okay so far') && (await page.textContent('.daychip')).includes('see your day'));
  check('the chip is a 44px tap target and is visible without scrolling', await page.evaluate(() => { const r = document.querySelector('.daychip').getBoundingClientRect(); return r.height >= 43.5 && r.bottom < innerHeight; }));
  const snapTop = (await page.locator('label:has-text("Snap meal")').boundingBox()).y, chipBottom = (await page.locator('.daychip').boundingBox()).y + 44;
  check('Snap meal / Say it / Check a meal keep their place: right below the chip, not pushed down by the card', snapTop >= chipBottom - 4 && snapTop < 560, { snapTop, chipBottom });
  await page.screenshot({ path: `${dir}/day_1_top.png` });
  await page.click('.daychip'); await page.waitForTimeout(700);
  check('tapping the chip jumps to the day card', await page.evaluate(() => { const r = document.getElementById('dayCard').getBoundingClientRect(); return r.top < 300 && r.top > -50; }));

  // ===== the card =====
  check('the day card has the four readings with their values and goals', await page.evaluate(() => { const t = document.getElementById('dayCard').textContent; return ['Protein', 'Added sugar', 'Fiber', 'Sat fat'].every(x => t.includes(x)) && t.includes('150 / 150 g') && t.includes('11 / 25 g') && t.includes('12 / 30 g') && t.includes('5 / 13 g'); }));
  check('dots: protein green, sugar green, fiber RED, sat fat green', await page.evaluate(() => { const c = [...document.querySelectorAll('#dayCard .drow .vdot')].map(e => getComputedStyle(e).backgroundColor); return c[0] === 'rgb(31, 95, 58)' && c[1] === 'rgb(31, 95, 58)' && c[2] === 'rgb(179, 64, 47)' && c[3] === 'rgb(31, 95, 58)'; }));
  check('each reading says what is left: "Goal met", "14 g left", "18 g to go"', await page.evaluate(() => { const t = document.getElementById('dayCard').textContent; return t.includes('Goal met') && t.includes('14 g left') && t.includes('18 g to go') && t.includes('8 g left'); }));
  check('it is honest that fiber and sat fat only count Meal Check meals (1 of 2 entries)', (await page.textContent('#dayCard')).includes('count 1 of 2 entries'));
  check('the Suggest button is a 44px tap target', (await page.locator('#dayCard button:has-text("Suggest something")').boundingBox()).height >= 44);
  await page.screenshot({ path: `${dir}/day_2_card.png` });

  // ===== Suggest =====
  delay = 900;
  await page.click('#dayCard button:has-text("Suggest something")'); await page.waitForTimeout(250);
  const instant = await page.textContent('#dayCard');
  check('INSTANT, before the network answers: your example, word for word', instant.includes('Your protein is good, but you need more fiber.') && instant.includes('Fiber: 18 g to go.') && instant.includes('You have 14 g of added sugar left — treat yo self.'));
  check('...while a food idea is still on its way', instant.includes('Thinking of something to eat'));
  await page.screenshot({ path: `${dir}/day_3_thinking.png` });
  await page.waitForFunction(() => document.getElementById('dayCard').textContent.includes('Try:'), null, { timeout: 6000 });
  delay = 0;
  check('then one concrete idea appears', (await page.textContent('#dayCard')).includes(IDEAS[0]));
  const r0 = requests[requests.length - 1];
  check('the request carries today\'s real numbers and the 120-token limit', r0.max_tokens === 120 && /protein 150 of 150 g/.test(r0.messages[0].content[0].text) && /fiber 12 of 30 g/.test(r0.messages[0].content[0].text) && /14 g left/.test(r0.messages[0].content[0].text));
  await page.screenshot({ path: `${dir}/day_4_idea.png` });
  await page.click('#dayCard button:has-text("Another idea")'); await page.waitForTimeout(500);
  check('Another idea gives a different one and sends the first to avoid', (await page.textContent('#dayCard')).includes(IDEAS[1]) && !(await page.textContent('#dayCard')).includes(IDEAS[0]) && requests[requests.length - 1].messages[0].content[0].text.includes(IDEAS[0]));
  check('scrolling position is kept while the card updates (the page did not jump to the top)', (await page.evaluate(() => document.querySelector('.over .body').scrollTop)) > 100);
  const nReq = requests.length;
  await page.dblclick('#dayCard button:has-text("Another idea")'); await page.waitForTimeout(500);
  check('a double tap makes one request', requests.length === nReq + 1);
  mode = '500'; await page.click('#dayCard button:has-text("Another idea")'); await page.waitForTimeout(500);
  check('a failed request keeps the advice and the last idea, with a calm note', (await page.textContent('#dayCard')).includes('treat yo self') && (await page.textContent('#dayCard')).includes('get a food idea'));
  mode = 'ok';
  await ctx.setOffline(true); await page.waitForTimeout(150);
  await page.click('#dayCard button:has-text("Another idea")'); await page.waitForTimeout(250);
  check('OFFLINE: the advice stays, with "Needs a connection"', (await page.textContent('#dayCard')).includes('treat yo self') && (await page.textContent('#dayCard')).includes('Needs a connection'));
  await ctx.setOffline(false);
  await page.click('#dayCard button:has-text("Hide suggestion")'); await page.waitForTimeout(150);
  check('Hide closes the panel', !(await page.textContent('#dayCard')).includes('treat yo self'));

  // ===== logging more changes the card =====
  await page.click('#dayCard button:has-text("Suggest something")'); await page.waitForTimeout(500);
  check('(setup) the panel is open again', (await page.textContent('#dayCard')).includes('treat yo self'));
  await page.evaluate(() => document.querySelector('.over .body').scrollTo(0, 0)); await page.waitForTimeout(150);
  await page.fill('#fProt', '10'); await page.fill('#fSugar', '15'); await page.click('.over .body > .btn.primary:has-text("Add")'); await page.waitForTimeout(400);
  const t2 = await page.textContent('#dayCard');
  check('after logging 15 g more sugar the stale suggestion is dropped and the numbers update (26 / 25 g)', !t2.includes('treat yo self') && t2.includes('26 / 25 g') && t2.includes('1 g over') && (await page.locator('#dayCard button:has-text("Suggest something")').count()) === 1, t2.slice(0, 200));
  check('the chip now says Okay (sugar slightly over can never be Good)', (await page.textContent('.daychip')).includes('Okay so far'));
  await page.click('#dayCard button:has-text("Suggest something")'); await page.waitForTimeout(500);
  check('and a fresh suggestion is honest about the sugar', (await page.textContent('#dayCard')).includes('over on added sugar') && !(await page.textContent('#dayCard')).includes('treat yo self'));

  // ===== yesterday =====
  await page.evaluate(() => document.querySelector('.over .body').scrollTo(0, 0)); await page.waitForTimeout(150);
  const seg = page.locator('.over .seg button:has-text("Yesterday")');
  const lockedNow = await seg.isDisabled();
  if (lockedNow) {
    await page.evaluate(() => { protDaySet(addDays(todayKey(), -1)); });
  } else await seg.click();
  await page.waitForTimeout(300);
  check('YESTERDAY: the verdict is final ("Good", no "so far") and there is no Suggest button', (await page.textContent('.daychip')).startsWith('Good') && !(await page.textContent('.daychip')).includes('so far') && (await page.locator('#dayCard button:has-text("Suggest")').count()) === 0);
  check('...with all four readings green', await page.evaluate(() => [...document.querySelectorAll('#dayCard .drow .vdot')].every(e => getComputedStyle(e).backgroundColor === 'rgb(31, 95, 58)')));
  await page.screenshot({ path: `${dir}/day_5_yesterday.png` });

  // ===== nothing logged / untracked fiber =====
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true })).newPage();
  p2.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p2.addInitScript(() => { localStorage.setItem('gh_ai_key', 'sk-test'); });
  await p2.goto(URL); await p2.waitForTimeout(400);
  await p2.click('.hrow:has-text("Protein")'); await p2.waitForTimeout(350);
  check('an empty day: no chip, and the card says "Nothing logged yet"', (await p2.locator('.daychip').count()) === 0 && (await p2.textContent('#dayCard')).includes('Nothing logged yet'));
  await p2.click('#dayCard button:has-text("Suggest something")'); await p2.waitForTimeout(300);
  check('an empty day still gives a friendly nudge', (await p2.textContent('#dayCard')).includes('start with protein and a high-fiber food'));
  await p2.fill('#fProt', '150'); await p2.fill('#fSugar', '3'); await p2.click('.over .body > .btn.primary:has-text("Add")'); await p2.waitForTimeout(400);
  check('with only protein+sugar logged (fiber untracked) a perfect-looking day is held at "Okay", with the reason shown', (await p2.textContent('.daychip')).includes('Okay so far') && (await p2.textContent('#dayCard')).includes('only count meals logged with Check a meal') && (await p2.textContent('#dayCard')).includes('—'));

  // ===== everything else on the page still works =====
  await page.evaluate(() => { protDaySet(todayKey()); }); await page.waitForTimeout(300);
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(300);
  check('Check a meal still opens its sheet', (await page.locator('.sheet button:has-text("Photo")').count()) === 1);
  await page.evaluate(() => closeSheet());
  check('the Protein page does not scroll sideways', await page.evaluate(() => { const b = document.querySelector('.over .body'); return b.scrollWidth <= b.clientWidth + 1; }));
  const exp = await page.evaluate(() => JSON.stringify(exportObject()));
  check('the backup holds no day-check data (it is all derived) and no key', !/dayCheck|dayCard|"DC"/.test(exp) && !exp.includes('sk-test'));

  check('no console errors or page errors', errors.length === 0, errors);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
