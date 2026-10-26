// Meal ideas + the Weight-page grocery list. fetch is faked; nothing touches the network.
const ok = (name, cond) => console.log(name + ':', !!cond);
const sheet = () => document.getElementById('sheetRoot').innerHTML;
const tick = () => new Promise(r => setTimeout(r, 20));
const el = id => document.getElementById(id);
function world() { localStorage.clear(); _setFakeNow(new Date('2026-10-26T17:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; localStorage.setItem('gh_ai_key', 'sk-test'); navigator.onLine = true; }

const opt = (name, extra) => Object.assign({ meal_name: name, ingredients: [{ item: 'black beans', amount: '1 can', aisle: 'Canned & dry' }, { item: 'spinach', amount: '2 cups', aisle: 'Produce' }, { item: 'eggs', amount: '3', aisle: 'Dairy' }], steps: ['Warm the beans', 'Wilt the spinach', 'Scramble the eggs', 'Combine', 'Extra step five'], protein_g: 38, added_sugar_g: 2, fiber_g: 12, sat_fat_g: 3, calories: 430 }, extra || {});
const SET1 = { options: [opt('Bean and egg skillet'), opt('Turkey chili', { protein_g: 42, sat_fat_g: 4, fiber_g: 11 }), opt('Lentil soup with toast', { protein_g: 24, fiber_g: 15, sat_fat_g: 12 })] };
const SET2 = { options: [opt('Chicken burrito bowl'), opt('Salmon and quinoa'), opt('Tofu stir fry')] };

let calls = [], queue = [];
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); const r = queue.length > 1 ? queue.shift() : queue[0]; return typeof r === 'function' ? r() : resp(r); };
const userText = () => calls[calls.length - 1].body.messages[0].content[0].text;

(async () => {
  // ================= Parser =================
  world();
  const p = parseIdeasJSON(JSON.stringify(SET1));
  ok('parses 3 options with ingredients, aisles and at most 4 steps', p.length === 3 && p[0].ingredients.length === 3 && p[0].ingredients[0].aisle === 'Canned & dry' && p[0].steps.length === 4 && p[0].steps[3] === 'Combine');
  ok('fenced and prose-wrapped replies parse', parseIdeasJSON('```json\n' + JSON.stringify(SET2) + '\n```').length === 3 && parseIdeasJSON('Here you go: ' + JSON.stringify(SET2) + ' enjoy').length === 3);
  ok('malformed / wrong shape / empty -> null, never throws', parseIdeasJSON('{"options":') === null && parseIdeasJSON('{}') === null && parseIdeasJSON('{"options":[]}') === null && parseIdeasJSON('[1]') === null && parseIdeasJSON('nope') === null && parseIdeasJSON(null) === null && parseIdeasJSON('{"options":[{"meal_name":"x"}]}') === null);
  const dirty = parseIdeasJSON(JSON.stringify({ options: [null, 5, { meal_name: '  ' }, { meal_name: 'Okay', ingredients: [{ item: 'rice', aisle: 'Moon' }, { item: '' }, 'oats'], steps: ['a', '', 'b'], protein_g: -4, added_sugar_g: '3.26', fiber_g: 'x', sat_fat_g: null, calories: 1e9 }, opt('A'), opt('B'), opt('C')] }));
  ok('junk entries dropped, numbers clamped >= 0, unknown aisles guessed, capped at 3', dirty.length === 3 && dirty[0].meal_name === 'Okay' && dirty[0].protein_g === 0 && dirty[0].added_sugar_g === 3.3 && dirty[0].fiber_g === 0 && dirty[0].ingredients.map(i => i.item + ':' + i.aisle).join() === 'rice:Grains & bread,oats:Grains & bread' && dirty[0].steps.join() === 'a,b' && dirty[0].calories <= 5000);
  ok('the prompt asks for the right schema and the family / grocery-store rules', /"options"/.test(IDEAS_SYSTEM) && /grocery-store/.test(IDEAS_SYSTEM) && /family-friendly/i.test(IDEAS_SYSTEM) && /under 20 minutes/.test(IDEAS_SYSTEM) && /Frozen, Other/.test(IDEAS_SYSTEM));

  // ================= Placement =================
  world(); OV = 'protein'; protDay = todayKey();
  const ph = proteinOverHTML();
  ok('the Protein page has Check a meal and Meal ideas side by side', ph.includes('>Check a meal<') && ph.includes('>Meal ideas<') && ph.indexOf('onCheckMeal()') < ph.indexOf('onMealIdeas()'));
  localStorage.removeItem('gh_ai_key');
  ok('with no API key there is one button that asks for it (no Meal ideas)', proteinOverHTML().includes('Add your API key in settings') && !proteinOverHTML().includes('>Meal ideas<'));
  onMealIdeas(); ok('...and Meal ideas without a key never opens the sheet', MC === null);
  localStorage.setItem('gh_ai_key', 'sk-test');
  ok('MAIN PAGE still has exactly 4 habits and no Meal ideas / grocery text', todayModel().habits.length === 4 && (todayHTML().match(/class="hrow/g) || []).length === 4 && !/Meal ideas|Grocery/i.test(todayHTML()));

  // ================= The flow: pick Dinner =================
  world(); S.days[todayKey()] = { workout: null, windDown: null, foods: [{ id: 'a', label: 'Eggs', protein: 40, sugar: 6, fiber: 3, satFat: 5, src: 'ai' }] };
  onMealIdeas();
  ok('the first screen offers Breakfast / Lunch / Dinner / Snack and shows what is left', MC.view === 'ideaPick' && IDEA_TYPES.every(t => sheet().includes('>' + t + '<')) && sheet().includes('110 g protein to go') && sheet().includes('19 g sugar left'));
  queue = [SET1]; calls = [];
  const pending = mcIdeaPick(2);
  ok('(while waiting) a loading state shows', MC.busy === true && MC.view === 'ideaLoad' && sheet().includes('Finding dinner ideas'));
  await pending; await tick();
  ok('DINNER sends the meal type and today\'s remaining budget in one call', calls.length === 1 && /Meal type: Dinner/.test(userText()) && /protein still needed: 110 g/.test(userText()) && /added sugar remaining: 19 g/.test(userText()) && /fiber still needed: 27 g/.test(userText()) && /saturated fat remaining: 13 g/.test(userText()) && calls[0].body.max_tokens >= 1500 && calls[0].body.model === 'claude-haiku-4-5-20251001' && calls[0].body.system === IDEAS_SYSTEM);
  ok('it renders THREE option cards', MC.view === 'ideaOpts' && (sheet().match(/class="idea"/g) || []).length === 3 && sheet().includes('Dinner ideas'));
  ok('each card has the name, a verdict, four numbers with dots, ingredients, at most 4 steps and the three buttons', sheet().includes('Bean and egg skillet') && sheet().includes('Great fit') && (sheet().match(/class="idea-n"/g) || []).length === 3 && sheet().includes('1 can black beans') && !sheet().includes('Extra step five') && (sheet().match(/>Add to list</g) || []).length === 3 && (sheet().match(/>Log it</g) || []).length === 3 && (sheet().match(/>Save meal</g) || []).length === 3);
  ok('cards are scored by the same rules as Check a meal (12 g sat fat -> Rethink)', sheet().includes('Rethink') && mealVerdict(ideaAsMeal(MC.opts[2])).verdict === 'red' && mealVerdict(ideaAsMeal(MC.opts[0])).verdict === 'green');
  ok('the suggestions are remembered for 7 days', S.recentSuggestions.map(x => x.name).join('|') === 'Bean and egg skillet|Turkey chili|Lentil soup with toast');

  // ---- shuffle ----
  queue = [SET2]; calls = [];
  mcIdeaShuffle(); mcIdeaShuffle(); mcIdeaShuffle(); await tick();
  ok('SHUFFLE gives 3 new options with ONE request (double taps ignored)', calls.length === 1 && MC.opts.map(o => o.meal_name).join('|') === 'Chicken burrito bowl|Salmon and quinoa|Tofu stir fry');
  ok('...and tells the model not to repeat what was shown or suggested this week', /Turkey chili/.test(userText()) && /Bean and egg skillet/.test(userText()) && /Lentil soup with toast/.test(userText()));
  ok('...and remembers the new ones too (6 names in the last 7 days)', S.recentSuggestions.length === 6);
  S.recentSuggestions[0].ts = Date.now() - 8 * 864e5;
  ok('a suggestion older than 7 days is no longer avoided', !recentIdeaNames().includes('Bean and egg skillet') && recentIdeaNames().includes('Salmon and quinoa'));

  // ---- the card buttons ----
  mcIdeaList(0);
  ok('ADD TO LIST puts every ingredient on the grocery list in its aisle', S.groceryList.length === 3 && S.groceryList.find(i => i.item === 'Spinach').aisle === 'Produce' && S.groceryList.find(i => i.item === 'Black beans').amount === '1 can' && sheet().includes('On list ✓'));
  mcIdeaList(1);
  ok('adding another meal with the same items makes them x2 instead of repeating', S.groceryList.length === 3 && S.groceryList.every(i => i.count === 2));
  ok('the grocery count shows on the sheet', sheet().includes('Grocery list · 3'));
  mcIdeaLog(0);
  const f = foodsOn(todayKey()).find(x => x.label === 'Chicken burrito bowl');
  ok('LOG IT adds the meal to today: protein, sugar, fiber and sat fat on the entry', f && f.protein === 38 && f.sugar === 2 && f.fiber === 12 && f.satFat === 3 && f.src === 'check' && proteinOn(todayKey()) === 78 && mealFiberOn(todayKey()) === 15 && sheet().includes('Logged ✓'));
  mcIdeaLog(0);
  ok('logging twice does nothing more', foodsOn(todayKey()).filter(x => x.label === 'Chicken burrito bowl').length === 1 && S.mealChecks.length === 1);
  mcIdeaSave(1); mcIdeaSave(1);
  ok('SAVE MEAL saves it once as a saved meal (re-checkable with no call)', S.savedMeals.filter(s => s.name === 'Salmon and quinoa').length === 1 && S.savedMeals.find(s => s.name === 'Salmon and quinoa').result.protein_g === 38 && sheet().includes('Saved ✓'));
  closeSheet();
  ok('closing the sheet redraws the Weight page card with what was added', document.getElementById('app').innerHTML.includes('id="groceryCard"') && /Spinach[\s\S]*×2/.test(document.getElementById('app').innerHTML.split('id="groceryCard"')[1]));
  onMealIdeas(); MC.opts = parseIdeasJSON(JSON.stringify(SET2)); MC.ist = MC.opts.map(() => ({ listed: false, checkId: null, saved: false })); MC.itype = 'Dinner'; MC.view = 'ideaOpts'; renderMealSheet(false);
  ok('opening the grocery list from the sheet and coming back returns to the options', (mcOpenList('ideaOpts'), MC.view === 'list' && sheet().includes('class="g-aisle">Produce') && sheet().includes('×2')) && (mcShow('ideaOpts'), MC.view === 'ideaOpts' && MC.opts.length === 3));

  // ---- failures ----
  const fail = async (q, expect, label) => { world(); S.days[todayKey()] = undefined; delete S.days[todayKey()]; onMealIdeas(); queue = [q]; calls = []; await mcIdeaPick(0); await tick(); ok(label, MC.view === 'ideaErr' && sheet().includes(expect) && MC.busy === false && S.recentSuggestions.length === 0); };
  await fail('{"options":', "Couldn't read those ideas", 'malformed JSON: friendly message with a retry, nothing remembered');
  await fail('sorry, no ideas', "Couldn't read those ideas", 'plain prose: same');
  await fail(() => { throw new Error('x'); }, "Couldn't read those ideas", 'network failure: same');
  await fail(() => ({ ok: false, status: 500, json: async () => ({}) }), "Couldn't read those ideas", '500: same');
  await fail(() => ({ ok: false, status: 401, json: async () => ({}) }), 'API key rejected', '401: says the key was rejected');
  queue = [SET1]; await mcIdeaRun(); await tick();
  ok('Try again from the error screen works', MC.view === 'ideaOpts' && MC.opts.length === 3);
  world(); onMealIdeas(); navigator.onLine = false; calls = []; await mcIdeaPick(1);
  ok('OFFLINE: "Needs a connection." and no call', MC.view === 'ideaPick' && sheet().includes('Needs a connection.') && calls.length === 0);
  navigator.onLine = true;
  let slow; queue = [() => new Promise(res => { slow = res; })]; mcIdeaPick(3); closeSheet(); slow(resp(SET1)); await tick();
  ok('closing the sheet while it thinks: no crash, the late answer is dropped and not remembered', MC === null && sheet() === '' && S.recentSuggestions.length === 0);

  // ================= Weight page grocery list =================
  world();
  ok('the second page has a Grocery list card, empty at first', weightHTML().includes('id="groceryCard"') && weightHTML().includes('Nothing here yet') && !weightHTML().includes('Share list'));
  addToGrocery(['spinach', 'spinach', { item: 'Salsa', amount: '1 jar' }, 'oats']);
  const w = weightHTML();
  ok('ADDING THE SAME ITEM TWICE shows one row with x2', (w.match(/<b>Spinach/g) || []).length === 1 && w.includes('<span class="g-x">×2</span>'));
  ok('items are grouped by aisle in store order with amounts and a count in the heading', w.indexOf('>Produce<') < w.indexOf('>Grains &amp; bread<') && w.indexOf('>Grains &amp; bread<') < w.indexOf('>Canned &amp; dry<') && w.includes('1 jar') && w.includes('Grocery list · 3'));
  ok('the card has Share, a manual add box and no Clear until something is checked', w.includes('Share list') && w.includes('id="gManP"') && !w.includes('Clear checked'));
  gToggle(S.groceryList[0].id);
  ok('tapping checks an item off and Clear checked appears', S.groceryList[0].checked === true && weightHTML().includes('Clear checked') && weightHTML().includes('Grocery list · 2'));
  gClear();
  ok('CLEAR CHECKED removes only the checked items', S.groceryList.map(i => i.item).join() === 'Salsa,Oats');
  el('gManP').value = '  paper towels '; gManual('P');
  ok('MANUAL ADD adds one more (aisle guessed), and an empty box adds nothing', S.groceryList.length === 3 && S.groceryList[2].item === 'Paper towels' && S.groceryList[2].aisle === 'Other' && (el('gManP').value = '   ', gManual('P'), S.groceryList.length === 3));
  const exp = JSON.stringify(exportObject()); const back = JSON.parse(exp); S = blankState(); applyBackup(back);
  ok('the list SURVIVES backup / import with counts, checks and aisles', S.groceryList.map(i => i.item + ':' + i.aisle + ':' + i.count).join() === 'Salsa:Canned & dry:1,Oats:Grains & bread:1,Paper towels:Other:1');
  const saved = JSON.parse(localStorage.getItem('gh2'));
  S = migrateState(saved);
  ok('...and a reload', S.groceryList.length === 3 && S.recentSuggestions.length === 0);
  world(); localStorage.setItem('gh_ai_key', 'sk-SECRET-9'); S.recentSuggestions.push({ name: 'x', ts: Date.now() });
  const exp2 = JSON.stringify(exportObject());
  ok('the backup holds the list and recent ideas but no API key and no photo data', exp2.includes('"groceryList"') && exp2.includes('"recentSuggestions"') && !exp2.includes('SECRET') && !/base64/.test(exp2));
  const threw = (() => { try { onMealIdeas(); for (const v of ['ideaPick', 'ideaLoad', 'ideaErr', 'list']) { MC.view = v; renderMealSheet(false); } MC.opts = parseIdeasJSON(JSON.stringify(SET1)); MC.ist = MC.opts.map(() => ({ listed: false, checkId: null, saved: false })); MC.itype = 'Lunch'; MC.view = 'ideaOpts'; renderMealSheet(false); MC.ist.forEach(s => { s.listed = true; s.saved = true; }); renderMealSheet(false); render(); return false; } catch (e) { console.log('THREW', e.stack); return true; } })();
  ok('every view and button state renders without throwing', !threw);
})().catch(e => { console.log('UNCAUGHT', e && e.stack); });
