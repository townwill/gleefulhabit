// "Why was my day rough?" card. fetch is faked; nothing touches the network.
const ok = (name, cond) => console.log(name + ':', !!cond);
const tick = () => new Promise(r => setTimeout(r, 20));
const T = () => todayKey(), Y = () => addDays(todayKey(), -1);
function world(now) { localStorage.clear(); _setFakeNow(new Date(now || '2026-10-26T13:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; MC = null; WH = { dk: null, open: false, busy: false, failed: false }; localStorage.setItem('gh_ai_key', 'sk-test'); navigator.onLine = true; protDay = T(); }
const food = (id, label, protein, sugar, fiber, satFat) => { const f = { id, label, protein, sugar, src: 'manual' }; if (fiber !== undefined) f.fiber = fiber; if (satFat !== undefined) f.satFat = satFat; return f; };
const setDay = (dk, foods) => { S.days[dk] = { workout: null, windDown: null, foods }; };
const wrap = () => document.getElementById('whyWrap') ? document.getElementById('whyWrap').innerHTML : '';

// the acceptance day: 27.5 g sat fat and 11 g fiber (yesterday, so the day is closed and fiber can be red)
const ROUGH = () => [food('a', 'Beef stew', 40, 3, 2, 6), food('b', 'Burrito', 35, 2, 2, 4), food('c', 'Scramble', 30, 0, 0, 4), food('d', 'Mac and cheese', 20, 4, 1, 3.5), food('e', 'Pizza slice', 15, 2, 6, 3.5), food('f', 'Fried chicken', 25, 1, 0, 3), food('g', 'Ice cream', 4, 6, 0, 3.5)];

let calls = [], queue = [];
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); const r = queue.length > 1 ? queue.shift() : queue[0]; return typeof r === 'function' ? r() : resp(r); };

(async () => {
  // ================= Culprits =================
  world(); setDay(Y(), ROUGH());
  const c = dayCheck(Y());
  ok('(setup) the day really is 27.5 g sat fat and 11 g fiber, both red', c.vals.satFat === 27.5 && c.vals.fiber === 11 && c.levels.satFat === 'r' && c.levels.fiber === 'r');
  const cu = dayCulprits(Y());
  ok('SAT FAT line: top 3 foods by sat fat with their grams', cu.lines.find(l => l.k === 'satFat').text === 'Sat fat: Beef stew 6 g · Burrito 4 g · Scramble 4 g');
  ok('FIBER line: how short it was and how many meals had 0–1 g', cu.lines.find(l => l.k === 'fiber').text === 'Fiber: 11 of 30 g — 4 meals had 0–1 g');
  ok('summary reads "Sat fat +9.5 g, fiber −19 g" when those are the only reds (protein 169 g is fine)', c.levels.protein === 'g' && cu.summary === 'Sat fat +9.5 g, fiber −19 g' && cu.reds.length === 2);
  ok('sugar red lists the top sugar foods and skips foods with none', (setDay(Y(), [food('a', 'Soda', 20, 40), food('b', 'Eggs', 30, 0), food('c', 'Cookie', 5, 15), food('d', 'Yogurt', 15, 8), food('e', 'Bar', 10, 3)]), dayCulprits(Y()).lines.find(l => l.k === 'sugar').text === 'Sugar: Soda 40 g · Cookie 15 g · Yogurt 8 g'));
  setDay(Y(), [food('a', 'Chicken', 50, 0, 2, 2), food('b', 'Toast', 3, 1, 1, 0.5), food('c', 'Coffee', 1, 0)]);
  const cp = dayCulprits(Y());
  ok('protein short: says how short and counts meals that were nearly 0 (<= 5 g)', cp.lines.find(l => l.k === 'protein').text === 'Protein: 54 of 150 g — 2 meals had 0–5 g' && /Protein −96 g/.test(cp.summary));
  ok('unknown is not zero: an entry with no fiber recorded is not counted as a 0 g meal', (setDay(Y(), [food('a', 'Salad', 60, 0, 12), food('b', 'Mystery', 60, 0), food('c', 'Toast', 60, 0, 1)]), dayCulprits(Y()).lines.find(l => l.k === 'fiber').text === 'Fiber: 13 of 30 g — 1 meal had 0–1 g'));
  ok('a very long food name is shortened', shortName('x'.repeat(40)).length === 24 && shortName('') === 'Entry');

  // ================= No card when nothing is red =================
  world(); setDay(Y(), [food('a', 'Oats bowl', 150, 5, 31, 6)]);
  ok('an ALL-GREEN day: no culprits and no card', dayCulprits(Y()).reds.length === 0 && (OV = 'protein', protDay = Y(), !proteinOverHTML().includes('id="whyCard"') && proteinOverHTML().includes('id="whyWrap"')));
  setDay(Y(), [food('a', 'Chicken', 130, 28, 25, 15)]);
  ok('only yellows (protein 130, sugar 28, fiber 25, sat fat 15): still no card', dayCheck(Y()).levels.protein === 'y' && dayCheck(Y()).levels.sugar === 'y' && dayCulprits(Y()).reds.length === 0 && whyCardHTML() === '');
  world(); setDay(T(), [food('a', 'Toast', 10, 1, 2, 1)]);
  ok('TODAY, mid-afternoon: protein and fiber are paced (never red), so no card yet', whyCardHTML() === '');
  setDay(T(), [food('a', 'Donut', 10, 40, 1, 2)]);
  ok('...but sugar already over on today DOES show the card', whyCardHTML().includes('id="whyCard"') && /Sugar \+15 g/.test(whyCardHTML()));
  setDay(T(), []); ok('nothing logged: no card', whyCardHTML() === '');

  // ================= Collapsed by default =================
  world(); setDay(Y(), ROUGH()); OV = 'protein'; protDay = Y();
  let h = whyCardHTML();
  ok('COLLAPSED: one line "Why rough? Sat fat +9.5 g, fiber −19 g ›", culprit lines not shown', h.includes('Why rough?') && h.includes('Sat fat +9.5 g, fiber −19 g') && h.includes('aria-expanded="false"') && !h.includes('Beef stew'));
  ok('it sits directly under Your day', (() => { const p = proteinOverHTML(); return p.indexOf('id="dayCard"') < p.indexOf('id="whyWrap"') && p.indexOf('id="whyWrap"') < p.indexOf('Food yesterday'); })());
  ok('(no API call just from looking at it)', calls.length === 0);

  // ================= Entry check =================
  setDay(Y(), [food('a', 'Mega burger', 70, 22, 3, 9), food('b', 'Salad', 20, 1, 5, 1), food('c', 'Fine', 60, 20, 2, 8)]);
  const sus = suspectEntries(Y());
  ok('DOUBLE-CHECK flags an entry with sat fat > 8 g, sugar > 20 g or protein > 60 g (strictly over)', sus.length === 1 && sus[0].id === 'a' && sus[0].why === '9 g sat fat, 22 g added sugar, 70 g protein' && suspectEntries(Y()).every(s => s.id !== 'c'));
  ok('an entry whose sat fat only comes from an old Check-a-meal link is checked too', (S.days[Y()].foods = [{ id: 'z', label: 'Old', protein: 20, sugar: 0, src: 'check', mc: 'k' }], S.mealChecks = [{ id: 'k', date: Y(), ts: 1, mealName: 'Old', verdict: 'red', protein_g: 20, added_sugar_g: 0, fiber_g: 1, sat_fat_g: 12, logged: true }], suspectEntries(Y()).length === 1));
  S.mealChecks = []; setDay(Y(), ROUGH().concat([food('x', 'Giant cheesecake', 20, 5, 1, 11)])); S.days[Y()].foods[0].satFat = 6;
  _setFakeNow(new Date('2026-10-26T09:00:00').getTime());   // yesterday is still editable before noon
  WH = { dk: Y(), open: true, busy: false, failed: false }; localStorage.removeItem('gh_ai_key');
  h = whyCardHTML();
  ok('expanded: both culprit lines and the flagged entry with a tap to edit', h.includes('Beef stew 6 g') && h.includes('Fiber: ') && h.includes('Double-check this entry') && h.includes("openFoodEdit('x')") && h.includes('Giant cheesecake'));
  // yesterday after noon is locked: flagged entry is shown but not editable
  world('2026-10-26T15:00:00'); setDay(Y(), [food('a', 'Mega burger', 70, 22, 3, 9)]); WH = { dk: Y(), open: true, busy: false, failed: false }; protDay = Y();
  ok('yesterday after noon is locked: the entry is listed but there is no edit tap', whyCardHTML().includes('Double-check:') && !whyCardHTML().includes('openFoodEdit'));

  // ================= AI fixes =================
  world(); setDay(Y(), ROUGH()); protDay = Y(); OV = 'protein';
  S.savedMeals.push({ id: 'chili', name: 'Chili and brown rice', result: { is_food: true, meal_name: 'Chili and brown rice', items: [], protein_g: 35, added_sugar_g: 2, fiber_g: 18, sat_fat_g: 3, calories: 520, confidence: 'high', assumptions: '', swap: '', swap_items: [] }, uses: 2, lastUsed: 1 });
  queue = [{ fixes: [{ text: 'Chili + brown rice + edamame covers ~28 g fiber', savedMealId: 'chili' }, { text: 'Swap the cheese for avocado on the burrito', savedMealId: null }] }]; calls = [];
  const p = whyToggle(); await tick();
  ok('OPENING the card makes ONE call with totals, goals, culprits and the saved meals', calls.length === 1 && /protein 169 of 150/.test(calls[0].body.messages[0].content[0].text) && /sat fat 27.5 of 18/.test(calls[0].body.messages[0].content[0].text) && /Beef stew 6 g/.test(calls[0].body.messages[0].content[0].text) && /chili: Chili and brown rice \(protein 35 g/.test(calls[0].body.messages[0].content[0].text) && /seed-breakfast: Usual breakfast/.test(calls[0].body.messages[0].content[0].text) && calls[0].body.max_tokens <= 400 && /exactly 2/.test(calls[0].body.system));
  ok('the fixes are cached by date with a timestamp', S.dayInsights[Y()] && S.dayInsights[Y()].fixes.length === 2 && S.dayInsights[Y()].fixes[0].savedMealId === 'chili' && S.dayInsights[Y()].generatedAt > 0 && JSON.parse(localStorage.getItem('gh2')).dayInsights[Y()].fixes.length === 2);
  h = whyCardHTML();
  ok('the card shows both fixes; the saved-meal one is tappable and says which meal', h.includes('Fixes for next time') && h.includes('Chili + brown rice + edamame') && h.includes("whyOpenMeal('chili')") && h.includes('Open Chili and brown rice') && h.includes('Swap the cheese for avocado') && h.includes('>Refresh<'));
  whyToggle(); whyToggle(); await tick();
  ok('REOPENING the same day makes NO second call', calls.length === 1);
  calls = []; queue = [{ fixes: [{ text: 'Add a cup of lentils at lunch', savedMealId: 'ghost' }] }]; whyRefresh(); await tick();
  ok('REFRESH re-runs it and replaces the cache; an unknown saved-meal id becomes null (never a dead link)', calls.length === 1 && S.dayInsights[Y()].fixes.length === 1 && S.dayInsights[Y()].fixes[0].savedMealId === null && !whyCardHTML().includes('whyOpenMeal'));
  whyRefresh(); whyRefresh(); await tick();
  ok('double taps on Refresh while it is thinking make one request', calls.length === 2);
  // tapping a fix opens that meal in Check a meal with no extra call
  calls = []; closeSheet(); whyOpenMeal('chili');
  ok('TAPPING a fix opens that saved meal in Check a meal (cached result, zero calls)', MC && MC.view === 'result' && MC.result.meal_name === 'Chili and brown rice' && calls.length === 0 && document.getElementById('sheetRoot').innerHTML.includes('Chili and brown rice'));
  closeSheet();

  // ---- no key / failures: the fixes section is silently absent ----
  world(); setDay(Y(), ROUGH()); protDay = Y(); localStorage.removeItem('gh_ai_key'); calls = [];
  whyToggle(); await tick();
  h = whyCardHTML();
  ok('NO API KEY: culprits and the entry check still show; no call; no fixes, no error text', calls.length === 0 && h.includes('Beef stew 6 g') && !h.includes('Fixes for next time') && !/key|error|couldn|failed/i.test(h.replace('Sat fat', '')));
  const failing = async (q, label) => { world(); setDay(Y(), ROUGH()); protDay = Y(); queue = [q]; calls = []; whyToggle(); await tick(); const hh = whyCardHTML(); ok(label, calls.length === 1 && hh.includes('Beef stew 6 g') && !hh.includes('Fixes for next time') && !hh.includes('Thinking') && !S.dayInsights[Y()]); };
  await failing('{"fixes":', 'malformed JSON: culprits stay, fixes hidden silently, nothing cached');
  await failing('no ideas, sorry', 'plain prose: same');
  await failing(() => { throw new Error('x'); }, 'network failure: same');
  await failing(() => ({ ok: false, status: 500, json: async () => ({}) }), '500: same');
  await failing(() => ({ ok: false, status: 401, json: async () => ({}) }), '401: same');
  await failing({ fixes: [] }, 'an empty fix list: same');
  world(); setDay(Y(), ROUGH()); protDay = Y(); navigator.onLine = false; calls = []; whyToggle(); await tick();
  ok('OFFLINE: no call, culprits stay', calls.length === 0 && whyCardHTML().includes('Beef stew 6 g') && !whyCardHTML().includes('Fixes for next time'));
  navigator.onLine = true;
  ok('after a failure, closing and opening again does not hammer the API (Refresh is the retry)', (queue = [{ fixes: [{ text: 'x', savedMealId: null }] }], calls = [], whyToggle(), whyToggle(), calls.length === 0));
  // fenced reply
  world(); setDay(Y(), ROUGH()); protDay = Y(); queue = ['```json\n' + JSON.stringify({ fixes: [{ text: 'Add beans to lunch', savedMealId: null }, { text: 'Use olive oil not butter', savedMealId: null }, { text: 'third is dropped', savedMealId: null }] }) + '\n```']; whyToggle(); await tick();
  ok('a fenced reply parses; at most 2 fixes are kept', S.dayInsights[Y()].fixes.length === 2);
  // switching day while thinking
  world(); setDay(Y(), ROUGH()); protDay = Y(); let slow; queue = [() => new Promise(res => { slow = res; })]; whyToggle(); protDay = T(); whyState(T()); slow(resp({ fixes: [{ text: 'Late', savedMealId: null }] })); await tick();
  ok('moving to another day while it thinks: the late answer is dropped, no crash', !S.dayInsights[Y()]);

  // ================= State, migration, backup =================
  world();
  ok('a fresh state has dayInsights = {}', JSON.stringify(blankState().dayInsights) === '{}');
  let m = migrateState({ schema: 2 });
  ok('OLD SAVE (no dayInsights) loads with {}', JSON.stringify(m.dayInsights) === '{}');
  const keep = addDays(todayKey(), -3), old = addDays(todayKey(), -15), edge = addDays(todayKey(), -14);
  m = migrateState({ schema: 2, dayInsights: { [keep]: { fixes: [{ text: ' ok ', savedMealId: 'x' }, { text: '', savedMealId: null }, null, { text: 'two', savedMealId: 5 }, { text: 'three' }], generatedAt: 5 }, [old]: { fixes: [{ text: 'old' }], generatedAt: 1 }, [edge]: { fixes: [{ text: 'edge' }] }, 'not-a-date': { fixes: [{ text: 'x' }] }, [addDays(todayKey(), -1)]: { fixes: 'nope' }, [addDays(todayKey(), -2)]: null } });
  ok('entries older than 14 days, bad dates, bad shapes and empty fixes are pruned; the rest cleaned (max 2 fixes)', Object.keys(m.dayInsights).sort().join() === [edge, keep].sort().join() && m.dayInsights[keep].fixes.length === 2 && m.dayInsights[keep].fixes[0].text === 'ok' && m.dayInsights[keep].fixes[0].savedMealId === 'x' && m.dayInsights[keep].fixes[1].savedMealId === null);
  m = migrateState({ schema: 2, dayInsights: 'garbage' }); ok('garbage dayInsights -> {}', JSON.stringify(m.dayInsights) === '{}');
  m = migrateState({ schema: 2, dayInsights: [1, 2] }); ok('an array -> {}', JSON.stringify(m.dayInsights) === '{}');
  ok('an imported backup from before this feature also gets {}', (applyBackup({ schema: 2 }), JSON.stringify(S.dayInsights) === '{}'));
  world(); S.dayInsights[Y()] = { fixes: [{ text: 'Eat beans', savedMealId: null }], generatedAt: 9 }; localStorage.setItem('gh_ai_key', 'sk-SECRET');
  const exp = JSON.stringify(exportObject()); S = blankState(); applyBackup(JSON.parse(exp));
  ok('the cache round-trips through backup / import; the API key is not in the backup', S.dayInsights[Y()] && S.dayInsights[Y()].fixes[0].text === 'Eat beans' && !exp.includes('SECRET'));
  world(); S.dayInsights[addDays(todayKey(), -20)] = { fixes: [{ text: 'stale', savedMealId: null }], generatedAt: 1 };
  setDay(Y(), ROUGH()); protDay = Y(); queue = [{ fixes: [{ text: 'fresh', savedMealId: null }] }]; whyToggle(); await tick();
  ok('writing a new cache entry also prunes the old ones', !S.dayInsights[addDays(todayKey(), -20)] && S.dayInsights[Y()].fixes[0].text === 'fresh');

  // ================= Placement =================
  world(); setDay(Y(), ROUGH());
  ok('Today still has exactly 4 habits and nothing about this card', todayModel().habits.length === 4 && !/Why rough|whyCard/.test(todayHTML()));
  const threw = (() => { try { OV = 'protein'; for (const dk of [T(), Y()]) { protDay = dk; WH = { dk, open: false, busy: false, failed: false }; proteinOverHTML(); WH.open = true; proteinOverHTML(); WH.busy = true; proteinOverHTML(); WH.busy = false; WH.failed = true; proteinOverHTML(); } return false; } catch (e) { console.log('THREW', e.stack); return true; } })();
  ok('every state of the card renders without throwing', !threw);
})().catch(e => console.log('UNCAUGHT', e && e.stack));
