// Meal Check: "Another idea" + shopping list. fetch is faked; nothing touches the network.
const ok = (name, cond) => console.log(name + ':', !!cond);
const sheet = () => document.getElementById('sheetRoot').innerHTML;
const tick = () => new Promise(r => setTimeout(r, 20));
function world() { localStorage.clear(); _setFakeNow(new Date('2026-10-26T13:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; localStorage.setItem('gh_ai_key', 'sk-test'); navigator.onLine = true; }
const setText = t => { document.getElementById('mcText').value = t; if (MC) MC.text = t; };

const BREAKFAST = { is_food: true, meal_name: 'Scrambled eggs with cottage cheese', items: [{ name: 'whole eggs', amount: '2 large' }], protein_g: 29, added_sugar_g: 0, fiber_g: 0, sat_fat_g: 3.5, calories: 260, confidence: 'medium', assumptions: 'Standard large eggs', swap: 'Add ¼ cup rinsed black beans and salsa for 4 g fiber', swap_items: ['black beans', 'salsa'] };
const ALT1 = { swap: 'Stir in 2 tbsp chia seeds and top with berries', swap_items: ['chia seeds', 'frozen berries'] };
const ALT2 = { swap: 'Serve on a slice of sprouted whole-grain toast', swap_items: ['sprouted grain bread'] };

let calls = [], queue = [];
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); const r = queue.length > 1 ? queue.shift() : queue[0]; return typeof r === 'function' ? r() : resp(r); };
async function openResult(meal) {                    // run a fresh Type-it check and land on the result card
  closeSheet(); calls = []; queue = [meal || BREAKFAST]; onCheckMeal(); mcTypeIt(); setText('2 eggs and cottage cheese'); mcCheckText(); await tick();
}
const swapOnCard = () => { const m = sheet().match(/class="mc-swap"[^>]*>([^<]*)</); return m ? m[1] : null; };

(async () => {
  // ================= State + migration =================
  world();
  ok('a fresh state has an empty shopping list', Array.isArray(blankState().shoppingList) && blankState().shoppingList.length === 0);
  let m = migrateState({ schema: 2 });
  ok('OLD SAVE loads with an empty shopping list', Array.isArray(m.shoppingList) && m.shoppingList.length === 0);
  m = migrateState({ schema: 2, shoppingList: [null, 5, { id: 'a' }, { id: 'b', text: '   ' }, { id: 'c', text: 'Oats', meal: 'Bowl', added: 5, done: 1 }, { text: 'no id' }] });
  ok('garbage list entries are dropped and the rest normalised', m.shoppingList.length === 1 && m.shoppingList[0].text === 'Oats' && m.shoppingList[0].done === true && m.shoppingList[0].meal === 'Bowl');
  m = migrateState({ schema: 2, shoppingList: Array.from({ length: 150 }, (_, i) => ({ id: 'i' + i, text: 'Item ' + i })) });
  ok('a runaway list is capped at 100 (newest kept)', m.shoppingList.length === 100 && m.shoppingList[99].text === 'Item 149');
  ok('an imported backup from before the list existed also gets []', (applyBackup({ schema: 2 }), Array.isArray(S.shoppingList) && S.shoppingList.length === 0));

  // ================= List engine =================
  world();
  let r = addToShoppingList(['black beans', '  salsa ', '', null, 'frozen   berries'], 'Scrambled eggs');
  ok('items are trimmed, capitalised, blanks skipped, and tagged with the meal', r.added === 3 && S.shoppingList.map(i => i.text).join('|') === 'Black beans|Salsa|Frozen berries' && S.shoppingList.every(i => i.meal === 'Scrambled eggs' && i.done === false));
  r = addToShoppingList(['BLACK BEANS', 'Salsa', 'olive oil'], 'Other');
  ok('an unchecked duplicate is not added twice (case-insensitive); new ones are', r.added === 1 && r.already === 2 && S.shoppingList.length === 4);
  toggleShopItem(S.shoppingList[0].id);
  r = addToShoppingList(['black beans'], 'Again');
  ok('a checked-off item can be added again', r.added === 1 && S.shoppingList.filter(i => i.text === 'Black beans').length === 2);
  ok('only unchecked items count and are shared as text', shopOpenCount() === 4 && shoppingText() === 'Shopping list\n• Salsa\n• Frozen berries\n• Olive oil\n• Black beans');
  ok('deleting works', deleteShopItem(S.shoppingList[1].id) && shopOpenCount() === 3 && deleteShopItem('nope') === false);
  ok('Clear checked removes only the checked ones', clearCheckedShop() === 1 && S.shoppingList.every(i => !i.done) && clearCheckedShop() === 0);
  ok('an empty list shares as nothing', (S.shoppingList = [], shoppingText() === ''));
  for (let i = 0; i < 120; i++) addToShoppingList(['thing ' + i], 'x');
  ok('the list never exceeds 100 items', S.shoppingList.length === 100 && S.shoppingList[99].text === 'Thing 119');
  ok('swapShopItems prefers the groceries, falls back to the sentence, then nothing', swapShopItems(BREAKFAST).join() === 'black beans,salsa' && swapShopItems({ swap: 'Add oats', swap_items: [] }).join() === 'Add oats' && swapShopItems({ swap: 'Add oats' }).join() === 'Add oats' && swapShopItems({}).length === 0 && swapShopItems(null).length === 0);

  // ================= Parsers =================
  ok('swap JSON: plain, fenced and prose-wrapped all parse', parseSwapJSON(JSON.stringify(ALT1)).swap === ALT1.swap && parseSwapJSON('```json\n' + JSON.stringify(ALT1) + '\n```').items.length === 2 && parseSwapJSON('Sure: ' + JSON.stringify(ALT2) + ' ok').swap === ALT2.swap);
  ok('swap JSON: malformed / empty swap / wrong shape -> null, never throws', parseSwapJSON('{"swap":') === null && parseSwapJSON('{"swap":"  "}') === null && parseSwapJSON('{}') === null && parseSwapJSON('[1]') === null && parseSwapJSON('hello') === null && parseSwapJSON(null) === null);
  const p = parseSwapJSON(JSON.stringify({ swap: 'x'.repeat(300), swap_items: ['a', ' b ', '', 'c', 'd', 'e'.repeat(90)] }));
  ok('swap text is capped at 120 and at most 3 short items are kept', p.swap.length === 120 && p.items.join() === 'a,b,c');
  ok('non-array items become []', parseSwapJSON('{"swap":"Add oats","swap_items":"oats"}').items.length === 0);
  ok('the main meal parser now carries swap_items too', parseMealJSON(JSON.stringify(BREAKFAST)).swap_items.join() === 'black beans,salsa' && parseMealJSON('{"is_food":true,"protein_g":5}').swap_items.length === 0);
  ok('the main prompt asks for swap_items', /swap_items/.test(MEAL_SYSTEM));

  // ================= Result card: the two new buttons =================
  world();
  await openResult();
  ok('the result card now has "Add to shopping list" and "Another idea" next to the swap', sheet().includes('>Add to shopping list<') && sheet().includes('>Another idea<') && swapOnCard() === BREAKFAST.swap);
  ok('the card still has Log it / Save meal / Done', sheet().includes('>Log it<') && sheet().includes('>Save meal<') && sheet().includes('>Done<'));
  const money0 = JSON.stringify(moneyNow());

  // ---- add to list ----
  mcAddList();
  ok('ADD TO SHOPPING LIST puts the swap\'s groceries on the list, tagged with the meal', S.shoppingList.map(i => i.text).join('|') === 'Black beans|Salsa' && S.shoppingList[0].meal === BREAKFAST.meal_name);
  ok('the button turns into "View list (2)"', sheet().includes('>View list (2)<') && !sheet().includes('>Add to shopping list<'));
  ok('...which opens the list, and Back returns to the result card', (mcShow('list'), sheet().includes('Black beans') && sheet().includes('for ' + BREAKFAST.meal_name)) && (mcShow('result'), MC.view === 'result' && swapOnCard() === BREAKFAST.swap));
  ok('the list is saved to state', JSON.parse(localStorage.getItem('gh2')).shoppingList.length === 2);

  // ---- another idea ----
  queue = [ALT1]; calls = [];
  const pending = mcAlt();
  ok('(while waiting) the swap line shows "Thinking…" and Another idea is disabled', MC.altBusy === true && sheet().includes('Thinking of another idea') && /<button class="btn quiet" disabled onclick="mcAlt\(\)">Thinking…<\/button>/.test(sheet()));
  await pending;
  ok('ANOTHER IDEA asks the model for a different swap: right prompt, 150 tokens, avoiding the first one', calls.length === 1 && /ONE alternative swap/.test(calls[0].body.system) && calls[0].body.max_tokens === 150 && calls[0].body.model === 'claude-haiku-4-5-20251001' && calls[0].body.messages[0].content[0].text.includes(BREAKFAST.swap) && calls[0].body.messages[0].content[0].text.includes(BREAKFAST.meal_name) && /do not repeat/.test(calls[0].body.messages[0].content[0].text));
  ok('...the card now shows the new idea and the old one is gone', swapOnCard() === ALT1.swap && !sheet().includes('black beans and salsa'));
  ok('...only the swap changed: same verdict, same numbers, no new check recorded, no money', mealVerdict(MC.result).verdict === 'yellow' && MC.result.protein_g === 29 && S.mealChecks.length === 1 && JSON.stringify(moneyNow()) === money0);
  ok('...and the list button is fresh again for the new idea (the old items stay on the list)', sheet().includes('>Add to shopping list<') && S.shoppingList.length === 2);
  mcAddList();
  ok('adding the new idea puts its groceries on the list too', S.shoppingList.map(i => i.text).join('|') === 'Black beans|Salsa|Chia seeds|Frozen berries');
  queue = [ALT2]; calls = []; await mcAlt();
  ok('a second "Another idea" avoids BOTH earlier suggestions', swapOnCard() === ALT2.swap && calls[0].body.messages[0].content[0].text.includes(BREAKFAST.swap) && calls[0].body.messages[0].content[0].text.includes(ALT1.swap));
  // repeats
  queue = [ALT2]; calls = []; await mcAlt();
  ok('if the model repeats an idea you already saw, it says so and keeps the current one', swapOnCard() === ALT2.swap && sheet().includes('Same idea again'));
  // fenced reply works
  queue = ['```json\n' + JSON.stringify({ swap: 'Top with ground flax and walnuts', swap_items: ['ground flax', 'walnuts'] }) + '\n```']; await mcAlt();
  ok('a fenced reply is parsed', swapOnCard() === 'Top with ground flax and walnuts' && sheet().includes('>Add to shopping list<') && MC.altNote === '');

  // ---- failures keep the current idea ----
  const keep = MC.result.swap;
  const failure = async (q, expect, label) => { queue = [q]; await mcAlt(); ok(label, swapOnCard() === keep && sheet().includes(expect) && MC.altBusy === false); };
  await failure('{"swap":', 'get another idea', 'malformed JSON: friendly message, current idea kept');
  await failure('no idea sorry', 'get another idea', 'plain prose: same');
  await failure(() => { throw new Error('x'); }, 'get another idea', 'network failure: same');
  await failure(() => ({ ok: false, status: 500, json: async () => ({}) }), 'get another idea', '500: same');
  await failure(() => ({ ok: false, status: 401, json: async () => ({}) }), 'API key rejected', '401: tells you the key was rejected');
  calls = []; navigator.onLine = false; await mcAlt();
  ok('OFFLINE: "Needs a connection." and no call', sheet().includes('Needs a connection.') && calls.length === 0 && swapOnCard() === keep);
  navigator.onLine = true; localStorage.removeItem('gh_ai_key'); calls = []; await mcAlt();
  ok('NO KEY: asks you to add it, no call', sheet().includes('Add your API key') && calls.length === 0);
  localStorage.setItem('gh_ai_key', 'sk-test');
  ok('the list works offline too (nothing to fetch)', (navigator.onLine = false, mcAddList(), navigator.onLine = true, S.shoppingList.some(i => i.text === 'Ground flax')));

  // ---- double tap + closing mid-flight ----
  calls = []; queue = [{ swap: 'Add a side of lentil soup', swap_items: ['lentil soup'] }]; mcAlt(); mcAlt(); mcAlt(); await tick();
  ok('DOUBLE TAPS while it is thinking make exactly one request', calls.length === 1 && swapOnCard() === 'Add a side of lentil soup');
  let slow; queue = [() => new Promise(res => { slow = res; })]; const n = S.mealChecks.length; mcAlt(); closeSheet(); slow(resp({ swap: 'Late answer', swap_items: [] })); await tick();
  ok('closing the sheet while it thinks: no crash, the late answer is dropped', MC === null && sheet() === '' && S.mealChecks.length === n);

  // ---- alternate swap persists on saved meals ----
  await openResult(); mcSaveMeal(); queue = [ALT1]; await mcAlt();
  const saved = S.savedMeals.find(s => s.name === BREAKFAST.meal_name);
  ok('after Save meal, picking another idea updates the saved meal\'s swap', saved && saved.result.swap === ALT1.swap);
  closeSheet(); calls = []; onCheckMeal(); mcShow('saved'); mcSavedTap(saved.id);
  ok('re-checking that saved meal shows the idea you chose, with zero calls', calls.length === 0 && swapOnCard() === ALT1.swap && sheet().includes('>Add to shopping list<'));
  queue = [ALT2]; await mcAlt();
  ok('Another idea also works on a re-shown saved meal', swapOnCard() === ALT2.swap && saved.result.swap === ALT2.swap);
  // the seeded breakfast
  world(); calls = []; queue = [BREAKFAST]; onCheckMeal(); mcShow('saved'); mcSavedTap('seed-breakfast'); await tick(); queue = [ALT1]; await mcAlt();
  ok('the seeded Usual breakfast can take a new idea too, and keeps it', swapOnCard() === ALT1.swap && S.savedMeals[0].result.swap === ALT1.swap);

  // ---- old cached results with no swap_items ----
  world(); S.savedMeals.push({ id: 'old', name: 'Old oats', result: { is_food: true, meal_name: 'Old oats', items: [], protein_g: 20, added_sugar_g: 2, fiber_g: 6, sat_fat_g: 1, calories: 300, confidence: 'high', assumptions: '', swap: 'Add walnuts and ground flax' }, uses: 0, lastUsed: null });
  onCheckMeal(); mcShow('saved'); mcSavedTap('old'); mcAddList();
  ok('a meal cached before this feature adds its swap sentence to the list', S.shoppingList.map(i => i.text).join() === 'Add walnuts and ground flax');
  world(); S.savedMeals.push({ id: 'noswap', name: 'No swap', result: { is_food: true, meal_name: 'No swap', items: [], protein_g: 40, added_sugar_g: 0, fiber_g: 10, sat_fat_g: 1, calories: 300, confidence: 'high', assumptions: '', swap: '' }, uses: 0, lastUsed: null });
  onCheckMeal(); mcShow('saved'); mcSavedTap('noswap');
  ok('a meal with no swap shows no swap buttons at all', !sheet().includes('mc-acts') && !sheet().includes('Another idea'));

  // ================= The list view =================
  world(); onCheckMeal();
  ok('the first screen has a Shopping list entry (no count when empty)', sheet().includes('>Shopping list<') && !sheet().includes('Shopping list ·'));
  mcShow('list');
  ok('empty list: friendly hint, no Share/Clear buttons', sheet().includes('Nothing here yet') && !sheet().includes('Share list') && !sheet().includes('Clear checked'));
  addToShoppingList(['oats', 'chia seeds', 'frozen berries'], 'Oats bowl'); mcShow('choose');
  ok('...with items, the count shows on the first screen', sheet().includes('Shopping list · 3'));
  mcShow('list');
  ok('the list shows every item with the meal it is for', ['Oats', 'Chia seeds', 'Frozen berries'].every(x => sheet().includes('<b>' + x + '</b>')) && sheet().includes('for Oats bowl') && sheet().includes('Share list'));
  const id1 = S.shoppingList[0].id;
  mcShopToggle(id1);
  ok('tapping an item checks it off (struck through), and Clear checked appears', S.shoppingList[0].done === true && sheet().includes('class="mc-shop-t done"') && sheet().includes('Clear checked'));
  mcShopToggle(id1);
  ok('tapping again un-checks it', S.shoppingList[0].done === false && !sheet().includes('Clear checked'));
  mcShopToggle(id1); mcShopClear();
  ok('Clear checked removes it', S.shoppingList.length === 2 && !sheet().includes('<b>Oats</b>'));
  mcShopDel(S.shoppingList[0].id);
  ok('✕ removes one item', S.shoppingList.length === 1 && S.shoppingList[0].text === 'Frozen berries');
  ok('every remove button has an accessible label', /aria-label="Remove Frozen berries"/.test(sheet()));
  ok('Back from the list with no meal on screen goes to the first screen', (mcShow('list'), true) && sheet().includes('onclick="mcShow(\'choose\')"'));
  // share / copy
  addToShoppingList(['oats'], 'x'); let shared = null, copied = null;
  navigator.share = async d => { shared = d; };
  await mcShareList();
  ok('SHARE LIST hands the open items to the phone\'s share sheet', shared && shared.text === 'Shopping list\n• Frozen berries\n• Oats');
  shared = null; navigator.share = async () => { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; };
  await mcShareList();
  ok('cancelling the share sheet is silent (no copy, no error toast)', shared === null);
  navigator.share = undefined; navigator.clipboard = { writeText: async t => { copied = t; } };
  await mcShareList();
  ok('with no share sheet it copies the list instead', copied === 'Shopping list\n• Frozen berries\n• Oats' && document.getElementById('toast').textContent === 'List copied');
  navigator.clipboard = { writeText: async () => { throw new Error('denied'); } };
  await mcShareList();
  ok('if copying is blocked it says so, no crash', document.getElementById('toast').textContent === "Couldn't copy the list");
  navigator.share = async () => {}; navigator.clipboard = undefined;
  S.shoppingList.forEach(i => { i.done = true; });
  ok('with everything checked off there is nothing to share', shoppingText() === '' && (mcShow('list'), !sheet().includes('Share list')));

  // ================= Backup + safety =================
  world(); localStorage.setItem('gh_ai_key', 'sk-SECRET-9'); addToShoppingList(['oats', 'salsa'], 'Bowl');
  const exp = JSON.stringify(exportObject());
  ok('the list is in the backup; the API key is not', exp.includes('"shoppingList"') && exp.includes('Salsa') && !exp.includes('SECRET'));
  const back = JSON.parse(exp); S = blankState(); applyBackup(back);
  ok('...and it round-trips through import', S.shoppingList.length === 2 && S.shoppingList[1].text === 'Salsa');
  world();
  ok('Meal Check extras add no habit row and nothing on Today', todayModel().habits.length === 4 && !/shopping|Another idea/i.test(todayHTML()));
  ok('the Protein page itself has no shopping-list control (it lives inside Meal Check)', (OV = 'protein', protDay = todayKey(), !/Shopping list|Another idea/.test(proteinOverHTML())));
  const threw = (() => { try { onCheckMeal(); for (const v of ['choose', 'list', 'saved', 'error']) { MC.view = v; renderMealSheet(false); } MC.result = parseMealJSON(JSON.stringify(BREAKFAST)); mcSetResult(MC, MC.result); MC.view = 'result'; renderMealSheet(false); MC.listed = true; renderMealSheet(false); MC.altBusy = true; renderMealSheet(false); return null; } catch (e) { return e; } })();
  ok('every view and button state renders without throwing', !threw);
})().catch(e => { console.log('UNCAUGHT', e && e.stack); });
