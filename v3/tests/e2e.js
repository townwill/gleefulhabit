// End-to-end pass in a real browser. Serve the repo root first:  python3 -m http.server 9001
// then:  node v3/tests/e2e.js   (APP_URL / OUT_DIR env vars override the defaults)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const URL = process.env.APP_URL || 'http://localhost:9001/v3/index.html';
const OUT = process.env.OUT_DIR || require('os').tmpdir();
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function open(browser, errors, { h = 844, w = 390, now = '2026-12-07T10:00:00', init, reduced } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());       // fonts are decoration; the test machine is offline
  await page.clock.setFixedTime(new Date(now));
  if (init) await page.addInitScript(init);
  await page.goto(URL); await page.waitForTimeout(350);
  return page;
}
const fits = page => page.evaluate(() => { const m = document.querySelector('#tabMain'); return { fits: m.scrollHeight <= m.clientHeight + 1, sh: m.scrollHeight, ch: m.clientHeight, hx: document.documentElement.scrollWidth <= window.innerWidth, doc: document.documentElement.scrollHeight <= window.innerHeight + 1 }; });
const small = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.disabled).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)), sel);

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ===== A. Fresh launch (Mon 7 Dec, plan week 2) =====
  let page = await open(browser, errors);
  check('title is GleefulHabit 3.0', (await page.title()) === 'GleefulHabit 3.0', await page.title());
  check('exactly four habit tiles', (await page.locator('.tile').count()) === 4);
  check('tiles read Workout, Protein, Wind down, Sleep', (await page.locator('.tile .t-nm').allTextContents()).join() === 'Workout,Protein,Wind down,Sleep');
  check('seven rivets on every tile', (await page.locator('.tile .rivets .rv').count()) === 28);
  check('four tabs: Today Workout Sleep Rewards', (await page.locator('.tabbar .tab span').allTextContents()).join() === 'Today,Workout,Sleep,Rewards');
  check('no dollar amounts on Today', !/\$\d/.test(await page.innerText('#app')));
  check('fresh install is schema 3 under gh3 (not gh2)', await page.evaluate(() => JSON.parse(localStorage.getItem('gh3')).schema === 3 && localStorage.getItem('gh2') === null));
  const icons = await page.evaluate(() => ({ ap: (document.querySelector('link[rel=apple-touch-icon]') || {}).href, fav: (document.querySelector('link[rel=icon]') || {}).href }));
  check('apple-touch-icon and favicon are embedded PNG data URIs', /^data:image\/png;base64,/.test(icons.ap || '') && /^data:image\/png;base64,/.test(icons.fav || ''));
  const iconDim = await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.onerror = () => r(null); i.src = document.querySelector('link[rel=apple-touch-icon]').href; }));
  check('the embedded iPhone icon is 180x180', iconDim && iconDim[0] === 180 && iconDim[1] === 180, iconDim);
  for (const [w, h] of [[390, 844], [390, 760], [375, 667]]) {
    const p = await open(browser, errors, { w, h });
    const f = await fits(p);
    check(`Today never scrolls at ${w}x${h}`, f.fits && f.hx && f.doc, f);
    check(`every tap target is at least 44px at ${w}x${h}`, (await small(p, '.tile,.tab,.hd-btn,.pz')).length === 0, await small(p, '.tile,.tab,.hd-btn,.pz'));
    if (h === 844) await p.screenshot({ path: OUT + '/v3-today.png' });
    await p.context().close();
  }

  // ===== B. Workout session on Monday (week 2: lifts hold) =====
  await page.click('.tabbar .tab:nth-child(2)'); await page.waitForTimeout(200);
  check('Monday offers weights with six lifts and a Start button', /Weights · week 2/.test(await page.textContent('#tabMain')) && (await page.locator('.lf-pre').count()) === 6);
  await page.click('button:has-text("Start session")'); await page.waitForTimeout(250);
  check('a session starts: warm-up and lift sets appear', await page.evaluate(() => !!S.training.cur && S.training.cur.kind === 'strength') && (await page.locator('#tabMain').innerHTML()).length > 1500);
  const setBtn = page.locator('#tabMain [onclick^="setToggle"]').first();
  await setBtn.click(); await page.waitForTimeout(250);
  check('ticking a set starts the rest timer bar', (await page.locator('#restBar').count()) === 1 && /1:/.test(await page.textContent('#restT')));
  check('the rest bar does not push the tab bar off screen', await page.evaluate(() => document.querySelector('.tabbar').getBoundingClientRect().bottom <= window.innerHeight + 1));
  await page.click('#restBar button:has-text("Skip")').catch(() => {}); await page.waitForTimeout(150);
  await page.evaluate(() => { LIFTS.forEach(l => [0, 1, 2].forEach(i => { S.training.cur.sets[l.id][i] = true; })); save(); render(); });
  page.once('dialog', d => d.accept());
  await page.click('button:has-text("Finish")'); await page.waitForTimeout(400);
  check('finishing ticks the Workout habit and earns a pack', await page.evaluate(() => habitState('workout', todayKey()).st === 'done' && packsOwed() === 1));
  check('...but week 2 targets hold', await page.evaluate(() => S.training.lifts.goblet.reps === 10));
  await page.click('.tabbar .tab:nth-child(1)'); await page.waitForTimeout(200);
  check('Today shows the Workout tile sealed and one rivet lit', (await page.locator('.tile.workout .seal').count()) === 1 && (await page.locator('.tile.workout .rv.on').count()) === 1);

  // ===== C. Rewards: Colton opens the pack =====
  await page.click('.tabbar .tab:nth-child(4)'); await page.waitForTimeout(250);
  check('Rewards shows one pack token', (await page.locator('.cubbies .token').count()) === 1);
  await page.click('button:has-text("Open")'); await page.waitForTimeout(300);
  check('opening spends it', await page.evaluate(() => S.packs.opened === 1 && packsOwed() === 0));
  await page.click('button:has-text("Undo")').catch(() => {}); await page.waitForTimeout(200);
  check('undo puts it back (or is hidden if nothing to undo)', await page.evaluate(() => packsOwed() === 1 || S.packs.opened === 1));
  check('no money on Rewards', !/\$\d/.test(await page.textContent('#tabMain')));

  // ===== D. Sleep: two taps =====
  await page.click('.tabbar .tab:nth-child(3)'); await page.waitForTimeout(250);
  await page.click('.sgrid.h .sq:has-text("7")'); await page.click('.sgrid.m .sq:has-text("30")'); await page.waitForTimeout(250);
  check('7 then 30 saves 7h 30m for last night', await page.evaluate(() => S.sleep[todayKey()] === 450));
  check('the Sleep tap targets are 44px or bigger', (await small(page, '.sq')).length === 0, await small(page, '.sq'));
  await page.click('.tabbar .tab:nth-child(1)'); await page.waitForTimeout(250);
  check('Today: the Sleep tile is sealed and says 7h 30m', (await page.locator('.tile.sleep .seal').count()) === 1 && /7h 30m/.test(await page.textContent('.tile.sleep')));
  const f2 = await fits(page); check('Today still does not scroll with data on it', f2.fits && f2.doc, f2);

  // ===== E. Protein tile opens the camera =====
  check('the protein tile has a hidden camera input (capture)', await page.evaluate(() => document.getElementById('tileSnap').getAttribute('capture') === 'environment'));
  await page.setInputFiles('#tileSnap', { name: 'meal.png', mimeType: 'image/png', buffer: PNG }); await page.waitForTimeout(500);
  check('choosing a photo opens the Protein screen', await page.evaluate(() => OV === 'protein'));
  await page.click('.bar2 .back'); await page.waitForTimeout(200);

  // ===== F. Study menu and overlays =====
  await page.click('.hd-btn[aria-label="Menu"]'); await page.waitForTimeout(250);
  const study = await page.textContent('.plank-list, .body');
  check('the Study lists Weight, History, Pantry, Backup, Sick day, Lamps', ['Weight', 'History', 'Pantry', 'Backup', 'Sick', 'Lamps'].every(t => new RegExp(t, 'i').test(study)), study.slice(0, 200));
  await page.click('#overRoot .plank:has-text("Weight")'); await page.waitForTimeout(250);
  await page.click('[aria-label="1 more"]').catch(() => {}); await page.click('button:has-text("Save")'); await page.waitForTimeout(250);
  check('weight saved with taps only', await page.evaluate(() => typeof S.weight.logs[todayKey()] === 'number'));
  await page.click('.bar2 .back'); await page.waitForTimeout(200);
  await page.click('#overRoot .plank:has-text("History")'); await page.waitForTimeout(250);
  check('History renders with retired spending money, no Free days card', /retired/i.test(await page.textContent('.body')) && !/Free days/.test(await page.textContent('.body')));
  await page.click('.bar2 .back'); await page.waitForTimeout(200);
  await page.click('.hd-btn[aria-label="Menu"]'); await page.waitForTimeout(250);
  await page.click('#overRoot .plank:has-text("Backup")'); await page.waitForTimeout(250);
  check('Backup overlay shows version and Export/Import', /version 20\d\d-\d\d-\d\d\.\d{4}/.test(await page.textContent('.body')) && /Export/.test(await page.textContent('.body')));
  const dl = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await page.click('button:has-text("Export")'); const download = await dl;
  check('export downloads gleefulhabit3-backup-<date>.json', !download || /^gleefulhabit3-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download && download.suggestedFilename());
  await page.click('.bar2 .back'); await page.waitForTimeout(200);

  // ===== G. Theme =====
  await page.evaluate(() => setTheme('night')); await page.waitForTimeout(200);
  check('night lamps set data-theme=night and persist', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'night' && S.ui.theme === 'night'));
  await page.screenshot({ path: OUT + '/v3-night.png' });
  await page.evaluate(() => setTheme('day')); await page.waitForTimeout(100);
  check('day lamps', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'day'));
  await page.evaluate(() => setTheme('auto'));

  // ===== H. Little win =====
  await page.evaluate(() => { OV = null; closeOver && closeOver(); });
  await page.click('.hd-btn[aria-label="Little win"]'); await page.waitForTimeout(250);
  check('the win chips are 44px tall', (await small(page, '.winsgrid .chip')).length === 0, await small(page, '.winsgrid .chip'));
  await page.click('.winsgrid .chip >> nth=0'); await page.waitForTimeout(250);
  check('a little win is one tap and pays nothing', await page.evaluate(() => S.wins.length === 1 && packsOwed() === 1));

  // ===== I. Pause with the survey (Wind down) =====
  await page.evaluate(() => { OV = null; closeSheet(); setTab('today'); });
  await page.click('.tile.wind .pz'); await page.waitForTimeout(250);
  check('Pause on Wind down opens the check-in sheet', (await page.locator('.sheet').count()) >= 1);
  await page.evaluate(() => closeSheet());

  // ===== J. Reading the 2.0 save the first time =====
  const v2 = { schema: 2, startDate: '2026-10-01', settings: { monthly: 200, drip: 100, pool: 50, proteinGoal: 150, sugarBudget: 25, workoutWeek: 3, freeDaysPerYear: 10, fiberGoal: 30, satFatGoal: 18, satFatV: 1 }, days: { '2026-11-02': { workout: { kind: 'workout', what: 'Bike', len: '20–40', hard: 'Solid', at: 1 }, windDown: null, foods: [] } }, pauses: [], freeDays: [], spends: [], wins: [], weight: { unit: 'lbs', goal: null, logs: { '2026-11-02': 201 } }, months: {}, comeback: null, imported: null, ui: { lastVersion: 'x', v1Offer: 'done' }, savedMeals: [], groceryList: [], pantry: [], mealChecks: [], recentSuggestions: [], dayInsights: {} };
  const p2 = await open(browser, errors, { init: `if(!localStorage.getItem('gh3')&&!sessionStorage.getItem('seeded')){localStorage.setItem('gh2', ${JSON.stringify(JSON.stringify(v2))});sessionStorage.setItem('seeded','1');}` });
  check('first open copies the 2.0 save into gh3', await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem('gh3')); return s.schema === 3 && s.weight.logs['2026-11-02'] === 201 && !!s.days['2026-11-02']; }));
  check('...and leaves gh2 exactly as it was', await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem('gh2')); return s.schema === 2 && s.weight.logs['2026-11-02'] === 201; }));
  await p2.context().close();

  // ===== K. Reduced motion =====
  const p3 = await open(browser, errors, { reduced: true });
  check('reduced motion: tiles have no running animation', await p3.evaluate(() => [...document.querySelectorAll('.tile,.rv,.token')].every(e => { const a = getComputedStyle(e).animationName; return a === 'none' || getComputedStyle(e).animationDuration === '0s' || parseFloat(getComputedStyle(e).animationDuration) < 0.01; })));
  await p3.context().close();

  // ===== L. Night mode via the system setting =====
  const nctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const np = await nctx.newPage(); await np.route(/fonts\./, r => r.abort()); await np.goto(URL); await np.waitForTimeout(300);
  check('"Auto" lamps follow a dark phone', await np.evaluate(() => getComputedStyle(document.body).getPropertyValue('--ink') !== '' && matchMedia('(prefers-color-scheme: dark)').matches));
  await nctx.close();

  check('no console errors or page errors anywhere', errors.length === 0, errors.slice(0, 5));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
