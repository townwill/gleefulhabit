// Meal Check in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e_meal.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const fs = require('fs');
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const BREAKFAST = { is_food: true, meal_name: 'Scrambled eggs with cottage cheese', items: [{ name: 'whole eggs', amount: '2 large' }], protein_g: 29, added_sugar_g: 0, fiber_g: 0, sat_fat_g: 3.5, calories: 260, confidence: 'medium', assumptions: 'Standard large eggs; low-fat cottage cheese', swap: 'Add ¼ cup rinsed black beans and salsa for 4 g fiber' };
const OATS = { is_food: true, meal_name: 'Overnight oats with chia and walnuts', items: [], protein_g: 38, added_sugar_g: 5, fiber_g: 12, sat_fat_g: 2, calories: 420, confidence: 'high', assumptions: 'One cup oats', swap: 'Add a spoon of ground flax for more soluble fiber' };
const PIZZA = { is_food: true, meal_name: 'Pepperoni pizza, three slices', items: [], protein_g: 36, added_sugar_g: 9, fiber_g: 5, sat_fat_g: 16, calories: 900, confidence: 'low', assumptions: 'Restaurant slices', swap: 'Swap pepperoni for veggies and add a side of white beans' };

function jpegSize(buf) {                       // read width/height from a JPEG's SOF marker
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

  // a big photo, made in the browser, so we can prove it is shrunk before it is sent
  const gen = await ctx.newPage();
  await gen.setContent('<canvas id=c width=3000 height=2000></canvas>');
  const dataUrl = await gen.evaluate(() => { const c = document.getElementById('c'), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 3000, 2000); g.addColorStop(0, '#f6d365'); g.addColorStop(1, '#fda085'); x.fillStyle = g; x.fillRect(0, 0, 3000, 2000); x.fillStyle = '#fff'; x.beginPath(); x.arc(1500, 1000, 700, 0, 7); x.fill(); return c.toDataURL('image/jpeg', .9); });
  await gen.close();
  const photoPath = `${dir}/e2e_meal_photo.jpg`;
  fs.writeFileSync(photoPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const ps = jpegSize(fs.readFileSync(photoPath));
  check('(setup) the test photo is 3000x2000', ps && ps.w === 3000 && ps.h === 2000, ps);

  let reply = BREAKFAST, mode = 'ok';
  const requests = [];
  await page.route('https://api.anthropic.com/**', route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    requests.push(route.request().postDataJSON());
    if (mode === 'junk') return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '{"protein_g": 12,' }] }) });
    if (mode === 'slow') return setTimeout(() => route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) }), 900);
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }) });
  });

  await page.addInitScript(() => { if (!localStorage.getItem('gh_ai_key')) localStorage.setItem('gh_ai_key', 'sk-test'); });
  await page.goto(URL); await page.waitForTimeout(400);

  // ===== Placement =====
  check('Today has exactly 4 habit rows and no Meal Check anywhere', (await page.locator('.today .hrow').count()) === 4 && !(await page.textContent('.today')).includes('Check a meal'));
  const ns = await page.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; });
  check('Today does not scroll at 390x760', ns);
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(350);
  check('"Check a meal" is on the Protein page, next to Snap meal / Say it', (await page.locator('.over button:has-text("Check a meal")').count()) === 1 && (await page.locator('.over button:has-text("Say it")').count()) === 1);
  check('the button is a full 44px tap target', (await page.locator('.over button:has-text("Check a meal")').boundingBox()).height >= 44);

  // ===== Sheet: three choices =====
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(300);
  check('the sheet opens with Photo, Saved meals and Type it', (await page.locator('.sheet button:has-text("Photo")').count()) === 1 && (await page.locator('.sheet button:has-text("Saved meals")').count()) === 1 && (await page.locator('.sheet button:has-text("Type it")').count()) === 1);
  check('Type it is visually secondary (quiet button); Photo is primary', (await page.locator('.sheet button.primary:has-text("Photo")').count()) === 1 && (await page.locator('.sheet button.quiet:has-text("Type it")').count()) === 1);
  check('the file input asks for the rear camera', (await page.getAttribute('#mcFile', 'capture')) === 'environment' && (await page.getAttribute('#mcFile', 'accept')) === 'image/*');
  await page.screenshot({ path: `${dir}/meal_1_choose.png` });

  // ===== Photo =====
  await page.setInputFiles('#mcFile', photoPath); await page.waitForTimeout(700);
  check('picking a photo shows a preview and the Small / Normal / Large chips', (await page.locator('.sheet img').count()) === 1 && (await page.locator('.sheet .chip').count()) === 3);
  check('Normal is preselected', (await page.locator('.sheet .chip.on').textContent()) === 'Normal');
  await page.click('.sheet .chip:has-text("Large")');
  await page.screenshot({ path: `${dir}/meal_2_photo.png` });
  mode = 'slow'; reply = BREAKFAST;
  await page.click('.sheet button:has-text("Check this meal")'); await page.waitForTimeout(250);
  check('a loading state shows while the call runs', (await page.locator('.sheet .spin').count()) === 1 && (await page.textContent('.sheet')).includes('Checking your meal'));
  await page.screenshot({ path: `${dir}/meal_3_loading.png` });
  await page.waitForSelector('.mc-top', { timeout: 6000 });
  const t0 = requests[requests.length - 1];
  const img = t0.messages[0].content[0];
  const sz = jpegSize(Buffer.from(img.source.data, 'base64'));
  check('the photo was shrunk to at most 1024 px on the long edge before sending (3000x2000 -> 1024x683)', img.type === 'image' && img.source.media_type === 'image/jpeg' && sz && Math.max(sz.w, sz.h) === 1024 && sz.w === 1024, sz);
  check('the request carries the chosen portion, max_tokens 900 and the Haiku model', /Large/.test(t0.messages[0].content[1].text) && t0.max_tokens === 900 && t0.model === 'claude-haiku-4-5-20251001');
  mode = 'ok';

  // ===== Result card =====
  check('result: meal name, "Okay" verdict, and all four readings are visible', (await page.textContent('.mc-name')) === BREAKFAST.meal_name && (await page.textContent('.mc-verdict')).includes('Okay') && (await page.locator('.mc-row').count()) === 4);
  check('the swap suggestion is shown', (await page.textContent('.mc-swap')).includes('black beans and salsa'));
  check('verdict dot is yellow, the fiber row is red, the sugar row is green', await page.evaluate(() => { const c = e => getComputedStyle(e).backgroundColor; const dots = [...document.querySelectorAll('.mc-row .vdot')].map(c); return c(document.querySelector('.mc-verdict .vdot')) === 'rgb(227, 160, 8)' && dots[2] === 'rgb(179, 64, 47)' && dots[1] === 'rgb(31, 95, 58)'; }));
  const fit = await page.evaluate(() => { const s = document.querySelector('.sheet'); return { fits: s.scrollHeight <= s.clientHeight + 1, sh: s.scrollHeight, ch: s.clientHeight, vh: innerHeight }; });
  check('THE RESULT CARD FITS ONE SCREEN, no scroll at 390x760', fit.fits && fit.sh < fit.vh, fit);
  check('every button on the card is at least 44px tall', await page.evaluate(() => [...document.querySelectorAll('.sheet button')].every(b => b.getBoundingClientRect().height >= 43.5)));
  await page.screenshot({ path: `${dir}/meal_4_result_yellow.png` });
  await page.click('.sheet button:has-text("Details")'); await page.waitForTimeout(150);
  check('Details expands in place', (await page.textContent('.sheet')).includes('Standard large eggs'));
  const fit2 = await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollHeight <= s.clientHeight + 1; });
  check('...and the card still fits with Details open', fit2);
  await page.screenshot({ path: `${dir}/meal_5_details.png` });

  // ===== Log it =====
  await page.click('.sheet button:has-text("Log it")'); await page.waitForTimeout(400);
  check('Log it adds the meal to today\'s protein', (await page.evaluate(() => proteinOn(todayKey()))) === 29 && (await page.evaluate(() => foodsOn(todayKey()).map(f => f.label + '|' + f.protein + '|' + f.sugar + '|' + f.src).join())) === `${BREAKFAST.meal_name}|29|0|check`);
  check('the button flips to "Logged ✓" and is disabled (double tap safe)', (await page.locator('.sheet button:has-text("Logged ✓")').isDisabled()));
  check('the card\'s running totals update (protein 29 of 150; sat fat 3.5 of 18)', (await page.textContent('.sheet')).includes('today 29 of 150 g') && (await page.textContent('.sheet')).includes('today 3.5 of 18 g'));
  await page.click('.sheet button:has-text("Save meal")'); await page.waitForTimeout(250);
  check('Save meal saves it', (await page.locator('.sheet button:has-text("Saved ✓")').count()) === 1 && (await page.evaluate(() => S.savedMeals.some(s => s.name === 'Scrambled eggs with cottage cheese'))));
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(300);
  check('Done closes the sheet', (await page.locator('.sheet').count()) === 0);
  check('the Protein page behind it shows the logged meal and 29 g', (await page.textContent('.over')).includes('Scrambled eggs with cottage cheese') && (await page.textContent('.over .num')).trim() === '29');

  // ===== Saved meals: zero calls =====
  const nReq = requests.length;
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250);
  await page.click('.sheet button:has-text("Saved meals")'); await page.waitForTimeout(200);
  check('the Saved list shows the seeded Usual breakfast (not scored) and the saved meal', (await page.textContent('.sheet')).includes('Usual breakfast') && (await page.textContent('.sheet')).includes('Not scored yet') && (await page.textContent('.sheet')).includes('Scrambled eggs with cottage cheese'));
  await page.screenshot({ path: `${dir}/meal_6_saved.png` });
  await page.click('.mc-saved:has-text("Scrambled eggs")'); await page.waitForTimeout(250);
  check('tapping a saved meal re-shows the result with NO network request', requests.length === nReq && (await page.locator('.mc-top').count()) === 1 && (await page.textContent('.mc-verdict')).includes('Okay'));
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200);

  // ===== Seeded breakfast: one scoring call, then cached =====
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250); await page.click('.sheet button:has-text("Saved meals")'); await page.waitForTimeout(150);
  await page.click('.mc-saved:has-text("Usual breakfast")'); await page.waitForSelector('.mc-top', { timeout: 6000 });
  check('first tap on Usual breakfast makes exactly one call with its description', requests.length === nReq + 1 && /2 eggs.*egg whites.*cottage cheese.*olive oil spray/.test(requests[requests.length - 1].messages[0].content[0].text));
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200);
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250); await page.click('.sheet button:has-text("Saved meals")'); await page.waitForTimeout(150);
  await page.click('.mc-saved:has-text("Usual breakfast")'); await page.waitForTimeout(250);
  check('second tap is free (cached)', requests.length === nReq + 1);
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200);

  // ===== Long press: rename / delete =====
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250); await page.click('.sheet button:has-text("Saved meals")'); await page.waitForTimeout(150);
  const row = page.locator('.mc-saved:has-text("Scrambled eggs")'); const bb = await row.boundingBox();
  await page.mouse.move(bb.x + 60, bb.y + 20); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up(); await page.waitForTimeout(250);
  check('press-and-hold opens Rename / Delete (and does not open the result)', (await page.locator('.sheet button:has-text("Delete meal")').count()) === 1 && (await page.locator('.mc-top').count()) === 0);
  await page.fill('#mcName', 'Egg scramble'); await page.click('.sheet button:has-text("Rename")'); await page.waitForTimeout(250);
  check('rename works and the list refreshes', (await page.textContent('.sheet')).includes('Egg scramble') && !(await page.textContent('.sheet')).includes('Scrambled eggs with cottage cheese'));
  const bb2 = await page.locator('.mc-saved:has-text("Egg scramble")').boundingBox();
  await page.mouse.move(bb2.x + 60, bb2.y + 20); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up(); await page.waitForTimeout(250);
  await page.click('.sheet button:has-text("Delete meal")'); await page.waitForTimeout(250);
  check('delete works', !(await page.textContent('.sheet')).includes('Egg scramble'));
  await page.evaluate(() => closeSheet());

  // ===== Type it =====
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250);
  await page.click('.sheet button:has-text("Type it")'); await page.waitForTimeout(250);
  check('Type it is one text field with a mic hint', (await page.locator('.sheet textarea').count()) === 1 && (await page.textContent('.sheet')).includes('mic on your keyboard'));
  await page.click('.sheet button:has-text("Check it")'); await page.waitForTimeout(150);
  check('empty text asks for text (no call)', (await page.textContent('.sheet')).includes('Type what you ate first.'));
  reply = PIZZA; const n2 = requests.length;
  await page.fill('.sheet textarea', 'three slices of pepperoni pizza');
  await page.click('.sheet button:has-text("Check it")'); await page.waitForSelector('.mc-top', { timeout: 6000 });
  check('typed text is sent as the meal', requests.length === n2 + 1 && requests[n2].messages[0].content[0].text.includes('three slices of pepperoni pizza'));
  check('16 g sat fat -> RED "Rethink", with "Rough estimate" for low confidence', (await page.textContent('.mc-verdict')).includes('Rethink') && (await page.textContent('.sheet')).includes('Rough estimate'));
  check('red verdict dot is the red', await page.evaluate(() => getComputedStyle(document.querySelector('.mc-verdict .vdot')).backgroundColor === 'rgb(179, 64, 47)'));
  const fit3 = await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollHeight <= s.clientHeight + 1; });
  check('the red card (longer swap, "Rough estimate") also fits one screen', fit3);
  await page.screenshot({ path: `${dir}/meal_7_result_red.png` });
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200);

  // ===== Failures =====
  mode = 'junk'; await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250); await page.click('.sheet button:has-text("Type it")'); await page.waitForTimeout(150);
  await page.fill('.sheet textarea', 'something'); await page.click('.sheet button:has-text("Check it")'); await page.waitForTimeout(500);
  check('malformed reply: friendly message with Try again, no crash', (await page.textContent('.sheet')).includes("Couldn't read that meal — try again or type it") && (await page.locator('.sheet button:has-text("Try again")').count()) === 1);
  await page.screenshot({ path: `${dir}/meal_8_error.png` });
  mode = 'ok'; reply = OATS; await page.click('.sheet button:has-text("Try again")'); await page.waitForSelector('.mc-top', { timeout: 6000 });
  check('Try again succeeds and the oats come out GREEN "Great fit"', (await page.textContent('.mc-verdict')).includes('Great fit'));
  await page.screenshot({ path: `${dir}/meal_9_result_green.png` });
  // double tap: two quick clicks, one request
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200);
  mode = 'slow'; const n3 = requests.length;
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250); await page.click('.sheet button:has-text("Type it")'); await page.waitForTimeout(150);
  await page.fill('.sheet textarea', 'oats'); await page.dblclick('.sheet button:has-text("Check it")'); await page.waitForSelector('.mc-top', { timeout: 6000 });
  check('a double tap makes exactly one request', requests.length === n3 + 1);
  await page.click('.sheet button:has-text("Done")'); await page.waitForTimeout(200); mode = 'ok';
  // offline
  await ctx.setOffline(true); await page.waitForTimeout(200);
  await page.click('button:has-text("Check a meal")'); await page.waitForTimeout(250);
  const nOff = requests.length;
  await page.click('.sheet button:has-text("Photo")'); await page.waitForTimeout(200);
  check('OFFLINE: Photo says "Needs a connection." and sends nothing', (await page.textContent('.sheet')).includes('Needs a connection.') && requests.length === nOff);
  await page.click('.sheet button:has-text("Type it")'); await page.waitForTimeout(200);
  check('OFFLINE: Type it says the same', (await page.textContent('.sheet')).includes('Needs a connection.'));
  await page.click('.sheet button:has-text("Saved meals")'); await page.waitForTimeout(200);
  await page.click('.mc-saved:has-text("Usual breakfast")'); await page.waitForTimeout(250);
  check('OFFLINE: a scored saved meal still works', (await page.locator('.mc-top').count()) === 1 && requests.length === nOff);
  await ctx.setOffline(false); await page.evaluate(() => closeSheet());

  // ===== Goals on the second page =====
  await page.evaluate(() => closeOver()); await page.waitForTimeout(200);
  await page.click('.dots button:first-child'); await page.waitForTimeout(450);
  check('the second page has the Meal Check goals card', (await page.textContent('.weight')).includes('Meal Check goals') && (await page.inputValue('#gFiber')) === '30' && (await page.inputValue('#gSat')) === '18');
  await page.fill('#gFiber', '24'); await page.fill('#gSat', '11'); await page.click('.weight button:has-text("Save goals")'); await page.waitForTimeout(300);
  check('saving updates the goals and the per-meal bands (fiber green at 6 g)', (await page.evaluate(() => S.settings.fiberGoal === 24 && S.settings.satFatGoal === 11)) && (await page.textContent('.weight')).includes('fiber 6+ g'));
  await page.fill('#gFiber', '5'); await page.click('.weight button:has-text("Save goals")'); await page.waitForTimeout(200);
  check('an out-of-range goal is refused with a message', (await page.textContent('#goalMsg')).includes('between 10 and 80'));
  await page.screenshot({ path: `${dir}/meal_10_goals.png` });
  await page.click('.dots button:last-child'); await page.waitForTimeout(400);

  // ===== Backup + no photo / key stored =====
  const dump = await page.evaluate(() => JSON.stringify(exportObject()));
  check('the backup holds no API key and no image data', !dump.includes('sk-test') && !/base64|\/9j\//.test(dump));
  const store = await page.evaluate(() => localStorage.getItem('gh2'));
  check('localStorage gh2 holds no photo data either', !/base64|\/9j\//.test(store) && !store.includes('sk-test'));
  check('Today still has exactly 4 habit rows and does not scroll', (await page.locator('.today .hrow').count()) === 4 && await page.evaluate(() => { const p = document.querySelector('.page.today'); return p.scrollHeight <= p.clientHeight + 1; }));
  check('no console errors or page errors', errors.length === 0, errors);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
