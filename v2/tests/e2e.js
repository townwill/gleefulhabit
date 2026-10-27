// End-to-end pass in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v2/tests/e2e.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const fs = require('fs');
const dir = process.env.OUT_DIR || require('os').tmpdir();
const URL = process.env.APP_URL || 'http://localhost:9001/v2/index.html';
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return dk(d); };

async function swipe(page, x1, y, x2) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y }] });
  for (let i = 1; i <= 6; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 6, y }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}
async function newPage(browser, h, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: h || 844 }, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });   // browser logs the AI-call failures this script forces on purpose
  return page;
}
const noScroll = async page => page.evaluate(() => { const p = document.querySelector('.page.today'); return { fits: p.scrollHeight <= p.clientHeight + 1, sh: p.scrollHeight, ch: p.clientHeight, hx: document.documentElement.scrollWidth <= innerWidth, docScroll: document.documentElement.scrollHeight <= innerHeight + 1 }; });

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ===== A. Fresh launch =====
  let page = await newPage(browser, 844, errors);
  await page.goto(URL); await page.waitForTimeout(400);
  check('title is GleefulHabit 2.0', (await page.title()) === 'GleefulHabit 2.0');
  check('header reads "GleefulHabit 2.0"', (await page.textContent('.today .top h1')).replace(/\s+/g, ' ').trim() === 'GleefulHabit 2.0');
  const icons = await page.evaluate(() => ({ ap: document.querySelector('link[rel=apple-touch-icon]').href.slice(0, 22), fav: document.querySelector('link[rel=icon]').href.slice(0, 22), apLen: document.querySelector('link[rel=apple-touch-icon]').href.length }));
  check('apple-touch-icon and favicon are embedded PNG data URIs', icons.ap === 'data:image/png;base64,' && icons.fav === 'data:image/png;base64,' && icons.apLen > 2000, icons);
  const iconOk = await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.onerror = () => r(null); i.src = document.querySelector('link[rel=apple-touch-icon]').href; }));
  check('the embedded iPhone icon decodes as a 180x180 image', iconOk && iconOk[0] === 180 && iconOk[1] === 180, iconOk);
  let ns = await noScroll(page);
  check('Today never scrolls at 390x844 (empty state)', ns.fits && ns.hx && ns.docScroll, ns);
  check('four habit rows present', (await page.locator('.hrow').count()) === 4);
  check('every tap target is at least 44px tall', await page.evaluate(() => [...document.querySelectorAll('.btn,.hrow,.pz,.icon-btn,.dots button,.seg button,.chip')].every(e => e.getBoundingClientRect().height >= 43.5 || e.getBoundingClientRect().height === 0)));
  check('balance starts at $0.00', (await page.textContent('.today .balance .big')) === '$0.00');
  check('page dots exist and Today is active', (await page.locator('.dots button').count()) === 2 && (await page.locator('.dots button.on').count()) === 1);

  // ===== B. Swipe + dots between Weight and Today =====
  await swipe(page, 80, 300, 320); await page.waitForTimeout(450);
  check('swipe right on Today reveals Weight', (await page.evaluate(() => document.getElementById('pager').style.transform)) === 'translateX(0%)');
  await swipe(page, 320, 300, 80); await page.waitForTimeout(450);
  check('swipe left returns to Today', (await page.evaluate(() => document.getElementById('pager').style.transform)) === 'translateX(-50%)');
  await page.click('.dots button:first-child'); await page.waitForTimeout(400);
  check('tapping the first dot goes to Weight', (await page.evaluate(() => document.getElementById('pager').style.transform)) === 'translateX(0%)');
  // weight logging through the UI
  await page.fill('#wIn', '201.4'); await page.click('button:has-text("Save")'); await page.waitForTimeout(250);
  check('weight saved via the page', (await page.evaluate(() => S.weight.logs[todayKey()])) === 201.4 && (await page.textContent('.weight .big')).includes('201.4'));
  await page.click('.dots button:last-child'); await page.waitForTimeout(400);
  check('...and money is still $0.00', (await page.textContent('.today .balance .big')) === '$0.00');

  // ===== C. Log by tapping =====
  const dimNow = await page.evaluate(() => dim(ymOf(todayKey())));
  const share = Math.round(10000 / dimNow / 4);
  await page.click('.hrow:has-text("Workout")'); await page.waitForTimeout(250);
  check('Log workout is disabled until all three questions are answered', await page.locator('.sheet .btn.primary').isDisabled());
  await page.click('.sheet .chip:has-text("Kettlebell")'); await page.click('.sheet .chip:has-text("20–40")');
  check('...still disabled with two of three', await page.locator('.sheet .btn.primary').isDisabled());
  await page.click('.sheet .chip:has-text("Hard")');
  await page.click('.sheet .btn.primary:has-text("Log workout")'); await page.waitForTimeout(350);
  check('workout logged: row shows 1 of 3 and a check', (await page.textContent('.hrow:has-text("Workout") .sb')).includes('1 of 3 this week') && (await page.locator('.hrow:has-text("Workout") .chk').count()) === 1);
  check(`balance rose by one habit share (${share}¢)`, (await page.evaluate(() => moneyNow().balanceC)) === share, await page.evaluate(() => moneyNow().balanceC));
  await page.click('.hrow:has-text("Wind down")'); await page.waitForTimeout(250);
  await page.click('.sheet .chip:has-text("Reading")'); await page.click('.sheet .chip:has-text("LEGO")'); await page.click('.sheet .chip:has-text("20m")'); await page.click('.sheet .chip:has-text("10:00")');
  await page.click('.sheet .btn.primary:has-text("Log wind-down")'); await page.waitForTimeout(350);
  check('wind-down logged (two items) and paid', (await page.textContent('.hrow:has-text("Wind down") .sb')).includes('Reading, LEGO') && Math.abs((await page.evaluate(() => moneyNow().balanceC)) - share * 2) <= 1);
  ns = await noScroll(page);
  check('Today still never scrolls with habits done', ns.fits && ns.hx, ns);
  const wdOnly = await page.evaluate(() => window.__x = 1);
  // pausing something already logged is refused
  await page.click('.hrow:has-text("Wind down") .pz').catch(() => {}); // no Pause button on a done row? (it exists) -> refused
  await page.waitForTimeout(200);
  check('cannot pause a habit already logged today (toast, no sheet)', (await page.locator('.sheet').count()) === 0 && (await page.textContent('#toast')).includes('already logged'));

  // ===== D. Protein page + AI (network mocked) =====
  await page.click('.hrow:has-text("Protein")'); await page.waitForTimeout(350);
  check('Protein page opens with the ring at 0', (await page.textContent('.over .num')).trim() === '0');
  await page.click('button:has-text("Say it")'); await page.waitForTimeout(200);
  await page.fill('#aiText', 'greek yogurt bowl with honey');
  await page.click('#aiBtn'); await page.waitForTimeout(250);
  check('no key: a clear inline message, nothing thrown', (await page.textContent('#aiStatus')).includes('API key'));
  await page.click('.keyhead'); await page.fill('#keyInput', 'sk-test'); await page.click('button:has-text("Save key")'); await page.waitForTimeout(200);
  check('key saved outside the 2.0 state', (await page.evaluate(() => localStorage.getItem('gh_ai_key'))) === 'sk-test' && !(await page.evaluate(() => localStorage.getItem('gh2'))).includes('sk-test'));
  let mode = 'ok';
  await page.route('https://api.anthropic.com/**', route => {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    if (mode === '401') return route.fulfill({ status: 401, headers: h, body: 'no' });
    if (mode === 'junk') return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'sorry, cannot help' }] }) });
    if (mode === 'zero') return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '{"food":"water","grams_protein":0,"added_sugar_g":0,"confidence":"high"}' }] }) });
    if (mode === 'down') return route.abort();
    return route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '```json\n{"food":"Greek yogurt bowl","grams_protein":28.4,"added_sugar_g":12,"confidence":"medium"}\n```' }] }) });
  });
  await page.click('button:has-text("Say it")'); await page.waitForTimeout(150);
  await page.fill('#aiText', 'greek yogurt bowl with honey');
  mode = '401'; await page.click('#aiBtn'); await page.waitForTimeout(500);
  check('401: key-rejected message', (await page.textContent('#aiStatus')).includes('rejected'));
  mode = 'junk'; await page.click('#aiBtn'); await page.waitForTimeout(500);
  check('unparseable reply: friendly message, nothing added', (await page.textContent('#aiStatus')).includes('read that estimate') && (await page.evaluate(() => foodsOn(todayKey()).length)) === 0);
  mode = 'zero'; await page.click('#aiBtn'); await page.waitForTimeout(500);
  check('zero-protein estimate: asks for more detail', (await page.textContent('#aiStatus')).includes('add more detail'));
  mode = 'down'; await page.click('#aiBtn'); await page.waitForTimeout(500);
  check('network failure: friendly message, button usable again', (await page.textContent('#aiStatus')).includes('Network problem') && !(await page.locator('#aiBtn').isDisabled()));
  mode = 'ok'; await page.click('#aiBtn'); await page.waitForTimeout(600);
  check('estimate fills name, protein and sugar for review', (await page.inputValue('#fLabel')) === 'Greek yogurt bowl' && (await page.inputValue('#fProt')) === '28.4' && (await page.inputValue('#fSugar')) === '12');
  check('...and NEVER adds anything on its own', (await page.evaluate(() => foodsOn(todayKey()).length)) === 0);
  await page.click('.over .body > .btn.primary:has-text("Add")'); await page.waitForTimeout(300);
  check('tapping Add logs it with protein and added sugar', (await page.evaluate(() => foodsOn(todayKey()).map(f => [f.label, f.protein, f.sugar]))).join('|') === 'Greek yogurt bowl,28.4,12');
  check('the food list shows protein and sugar per entry', (await page.textContent('.frow')).includes('28.4 g protein') && (await page.textContent('.frow')).includes('12 g added sugar'));
  check('"High protein, low sugar" tag is NOT shown (12 g sugar)', (await page.locator('.tagp').count()) === 0);
  await page.fill('#fLabel', 'Chicken'); await page.fill('#fProt', '45'); await page.fill('#fSugar', '0'); await page.click('.over .body > .btn.primary:has-text("Add")'); await page.waitForTimeout(300);
  check('a 45 g / 0 g sugar entry gets the tag', (await page.locator('.tagp').count()) === 1);
  check('quick-add chips now appear from logged foods', (await page.locator('.chip.sm').count()) >= 1);
  const grams0 = await page.evaluate(() => proteinOn(todayKey()));
  await page.click('.chip.sm:has-text("Chicken")'); await page.waitForTimeout(300);
  check('one tap on a chip logs it again (+45 g)', (await page.evaluate(() => proteinOn(todayKey()))) === grams0 + 45);
  // scroll position survives an add (no jump to the top / no re-animation)
  await page.evaluate(() => document.querySelector('.over .body').scrollTo(0, 400));
  await page.click('.chip.sm:has-text("Chicken")'); await page.waitForTimeout(300);
  check('the page keeps its scroll position after an add', (await page.evaluate(() => document.querySelector('.over .body').scrollTop)) > 100);
  // swipe a row to reveal Delete
  const row = page.locator('.frow .fc').first();
  const bb = await row.boundingBox();
  await page.locator('.frow .fc').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
  const bb2 = await page.locator('.frow .fc').first().boundingBox();
  await swipe(page, bb2.x + bb2.width - 30, bb2.y + 20, bb2.x + 40); await page.waitForTimeout(350);
  check('swiping a food row left reveals Edit and Delete', (await page.locator('.frow.open').count()) === 1);
  const nBefore = await page.evaluate(() => foodsOn(todayKey()).length);
  await page.click('.frow.open .fab.d'); await page.waitForTimeout(300);
  check('Delete removes the entry', (await page.evaluate(() => foodsOn(todayKey()).length)) === nBefore - 1);
  await page.waitForTimeout(400);
  await page.click('.frow .fc >> nth=0'); await page.waitForTimeout(300);
  check('tapping a row opens the edit sheet', (await page.locator('.sheet #eProt').count()) === 1);
  await page.fill('#eProt', '99'); await page.click('.sheet .btn.primary:has-text("Save")'); await page.waitForTimeout(250);
  check('editing saves the new grams', (await page.evaluate(() => foodsOn(todayKey()).some(f => f.protein === 99))));
  await page.screenshot({ path: `${dir}/e2e_protein.png` });
  await page.click('.back'); await page.waitForTimeout(350);
  check('back returns to Today, rows reflect protein', (await page.textContent('.hrow:has-text("Protein") .sb')).includes('/ 150 g'));
  const sugarSub = await page.textContent('.hrow:has-text("Less sugar") .sb');
  check('Less sugar row shows what is left (or settled after 10pm) from the food log', /\d+(\.\d)? g left · checks at 10pm|\d+(\.\d)? g under · settled at 10pm/.test(sugarSub), sugarSub);

  // ===== E. Spend =====
  const bal = await page.evaluate(() => moneyNow().balanceC);
  await page.click('button:has-text("Spend")'); await page.waitForTimeout(250);
  await page.fill('#spAmt', '0.50'); await page.click('.sheet .chip:has-text("LEGO")'); 
  check('the amount survives picking a category', (await page.inputValue('#spAmt')) === '0.50');
  await page.click('.sheet .btn.primary:has-text("Spend it")'); await page.waitForTimeout(300);
  check('spending $0.50 lowers the balance by 50¢', (await page.evaluate(() => moneyNow().balanceC)) === bal - 50 && (await page.evaluate(() => moneyNow().spentC)) === 50);
  await page.click('button:has-text("Spend")'); await page.waitForTimeout(250);
  await page.fill('#spAmt', '9999'); await page.click('.sheet .chip:has-text("Cards")'); await page.click('.sheet .btn.primary:has-text("Spend it")'); await page.waitForTimeout(250);
  check('overspending is refused with the real balance in the message', (await page.textContent('#toast')).startsWith('Only $') && (await page.evaluate(() => S.spends.length)) === 1);
  await page.click('.scrim'); await page.waitForTimeout(250);
  check('tapping outside a sheet closes it', (await page.locator('.sheet').count()) === 0);
  await page.screenshot({ path: `${dir}/e2e_today_logged.png` });

  // ===== F. History, free days, export, import =====
  await page.click('.icon-btn[aria-label="History"]'); await page.waitForTimeout(400);
  check('History opens on the current month', (await page.textContent('.over h3')).includes(await page.evaluate(() => monthName(ymOf(todayKey())))));
  await page.fill('#freeIn', await page.evaluate(() => todayKey())); await page.click('button[onclick="histAddFree()"]'); await page.waitForTimeout(250);
  check('a free day for today is refused in the UI', (await page.textContent('.over')).includes('in advance'));
  const tomorrow = await page.evaluate(() => addDays(todayKey(), 1));
  await page.fill('#freeIn', tomorrow); await page.click('button[onclick="histAddFree()"]'); await page.waitForTimeout(250);
  check('tomorrow is accepted and listed', (await page.evaluate(t => S.freeDays.includes(t), tomorrow)) && (await page.textContent('.over')).includes('Remove'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('button:has-text("Export")')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('export downloads a gleefulhabit2 JSON with everything and no key', /^gleefulhabit2-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()) && exported.schema === 2 && exported.spends.length === 1 && exported.freeDays.length === 1 && !JSON.stringify(exported).includes('sk-test'));
  // wipe + import
  await page.evaluate(() => { localStorage.removeItem('gh2'); });
  await page.reload(); await page.waitForTimeout(400);
  check('(after wiping) the app starts empty', (await page.textContent('.today .balance .big')) === '$0.00');
  page.on('dialog', d => d.accept());
  await page.click('.icon-btn[aria-label="History"]'); await page.waitForTimeout(350);
  fs.writeFileSync(`${dir}/e2e_backup.json`, JSON.stringify(exported));
  await page.setInputFiles('#impFile', `${dir}/e2e_backup.json`); await page.waitForTimeout(500);
  check('importing the backup restores spends, free days, foods and workouts', await page.evaluate(() => S.spends.length === 1 && S.freeDays.length === 1 && foodsOn(todayKey()).length > 0 && S.days[todayKey()].workout.what === 'Kettlebell'));
  await page.click('.back'); await page.waitForTimeout(300);
  check('...and Today shows the restored balance', (await page.evaluate(() => moneyNow().balanceC)) === bal - 50);
  await page.setInputFiles('#impFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('not json') }).catch(() => {});

  // ===== G. v1 offer, in a fresh context =====
  const p2 = await newPage(browser, 844, errors);
  const v1 = { habits: [{ id: 'hw', name: 'Workout', type: 'boolean' }, { id: 'hp', name: 'Protein', type: 'numeric', target: 150 }, { id: 'hs', name: 'Less Sugar', type: 'boolean' }], user: { xp: 4200, packsBank: 3, wishlistPoints: 80 },
    logs: { [ago(40)]: { hw: true, hp: 150 }, [ago(39)]: { hp: 90 }, [ago(38)]: { hw: true } }, logEntries: { [ago(40)]: { hp: [{ amt: 100, label: 'steak', sugar: 0 }, 50] } },
    weight: { unit: 'lbs', goal: 185, logs: { [ago(40)]: 207.2, [ago(33)]: 205.9 } }, littleWins: [{ id: 'l', dateKey: ago(39), text: 'Finished garage' }], restDayLogs: {}, habitPauses: {}, habitPauseRanges: {} };
  await p2.addInitScript(v => { if (!localStorage.getItem('habitflow')) localStorage.setItem('habitflow', JSON.stringify(v)); }, v1);
  await p2.goto(URL); await p2.waitForTimeout(600);
  const sheetTxt = await p2.textContent('.sheet');
  check('first launch with v1 data shows the offer with real counts', sheetTxt.includes('Welcome to 2.0') && sheetTxt.includes('3 logged days') && sheetTxt.includes('2 weigh-ins'));
  await p2.screenshot({ path: `${dir}/e2e_v1_offer.png` });
  await p2.click('button:has-text("Bring my history")'); await p2.waitForTimeout(500);
  const st = await p2.evaluate(() => ({ imp: S.imported, wk: Object.keys(S.weight.logs).length, wins: S.wins.length, gap: S.comeback, bal: moneyNow().balanceC, v1xp: JSON.parse(localStorage.getItem('habitflow')).user.xp, offer: S.ui.v1Offer }));
  check('history imported, money still $0, v1 untouched, offer settled', st.imp && st.wk === 2 && st.wins === 1 && st.bal === 0 && st.v1xp === 4200 && st.offer === 'done', st);
  check('the gap is recorded for the comeback', st.gap && st.gap.gapDays > 30, st.gap);
  ns = await noScroll(p2);
  check('Today does not scroll with imported history either', ns.fits, ns);
  await p2.screenshot({ path: `${dir}/e2e_after_import.png` });
  await p2.click('.hrow:has-text("Workout")'); await p2.waitForTimeout(200);
  await p2.click('.sheet .chip:has-text("Yoga")'); await p2.click('.sheet .chip:has-text("<20m")'); await p2.click('.sheet .chip:has-text("Easy")'); await p2.click('.sheet .btn.primary:has-text("Log workout")'); await p2.waitForTimeout(900);
  check('the first 2.0 log shows the comeback toast and records it', (await p2.evaluate(() => S.comeback.firstLog === todayKey())));
  // reload: offer does not return
  await p2.reload(); await p2.waitForTimeout(400);
  check('the offer does not come back after a reload', (await p2.locator('.sheet').count()) === 0);

  // ===== H. Pause / sick day in a fresh context =====
  const p3 = await newPage(browser, 844, errors);
  await p3.goto(URL); await p3.waitForTimeout(300);
  await p3.click('.hrow:has-text("Wind down") .pz'); await p3.waitForTimeout(250);
  check('Pause opens the 4-question check-in', (await p3.locator('.sheet .q').count()) === 4);
  check('Pause is disabled until all four are answered', await p3.locator('.sheet .btn.primary').isDisabled());
  await p3.click('.sheet .chip:has-text("Travel")'); await p3.click('.sheet .chip:has-text("About a week")'); await p3.click('.sheet .chip:has-text("Saw it coming")');
  check('...still disabled after three', await p3.locator('.sheet .btn.primary').isDisabled());
  await p3.click('.sheet .chip:has-text("A daily nudge")'); await p3.click('.sheet .btn.primary'); await p3.waitForTimeout(300);
  check('Wind down greys out as "Paused · day 1" with Resume', (await p3.textContent('.hrow.paused .sb')).includes('Paused · day 1') && (await p3.textContent('.hrow.paused .pz')) === 'Resume');
  check('Protein row has no Pause button', (await p3.locator('.hrow:has-text("Protein") .pz').count()) === 0);
  await p3.click('button:has-text("Sick day")'); await p3.waitForTimeout(300);
  check('Sick day pauses Workout and Protein in one tap, button becomes "Feeling better"', (await p3.locator('.hrow.paused').count()) === 3 && (await p3.locator('button:has-text("Feeling better")').count()) === 1);
  check('a sick-paused Protein row can be resumed', (await p3.textContent('.hrow:has-text("Protein") .pz')) === 'Resume');
  await p3.screenshot({ path: `${dir}/e2e_sick.png` });
  ns = await noScroll(p3);
  check('Today does not scroll with three paused rows + welcome text', ns.fits, ns);
  await p3.click('button:has-text("Feeling better")'); await p3.waitForTimeout(300);
  check('Feeling better resumes both; Wind down stays paused', (await p3.locator('.hrow.paused').count()) === 1);

  // ===== I. 390x760 (the real PWA height) =====
  const p4 = await newPage(browser, 760, errors);
  await p4.goto(URL); await p4.waitForTimeout(300);
  await p4.evaluate(() => { const t = todayKey(); S.days[t] = { workout: { kind: 'workout', what: 'Bike', len: '20–40', hard: 'Solid' }, windDown: { what: ['Reading'], len: '20m', lights: '10:00' }, foods: [{ id: 'z', label: 'Chicken', protein: 120, sugar: 2, src: 'ai' }] }; S.wins = [{ id: '1', dk: t, label: 'Walked the dog' }, { id: '2', dk: t, label: 'Hard conversation handled' }, { id: '3', dk: t, label: 'Cooked dinner' }]; refresh(); });
  ns = await noScroll(p4);
  check('Today does not scroll at 390x760 with three wins', ns.fits && ns.hx, ns);
  await p4.screenshot({ path: `${dir}/e2e_760.png` });

  check('no console errors or page errors anywhere', errors.length === 0, errors);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
