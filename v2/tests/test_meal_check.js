// Meal Check: acceptance tests from the spec + edge cases. fetch is faked; nothing touches the network.
const ok = (name, cond) => console.log(name + ':', !!cond);
const sheet = () => document.getElementById('sheetRoot').innerHTML;
function world(now) { localStorage.clear(); _setFakeNow(new Date(now || '2026-10-26T13:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; }

const BREAKFAST = { is_food: true, meal_name: 'Scrambled eggs with cottage cheese', items: [{ name: 'whole eggs', amount: '2 large' }], protein_g: 29, added_sugar_g: 0, fiber_g: 0, sat_fat_g: 3.5, calories: 260, confidence: 'medium', assumptions: 'Standard large eggs; low-fat cottage cheese', swap: 'Add ¼ cup rinsed black beans and salsa for 4 g fiber' };
const GREAT = { is_food: true, meal_name: 'Overnight oats with chia', items: [], protein_g: 38, added_sugar_g: 5, fiber_g: 12, sat_fat_g: 2, calories: 420, confidence: 'high', assumptions: 'a', swap: 'Add walnuts for healthy fat' };

let calls = [], reply = null;
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) }); return typeof reply === 'function' ? reply() : resp(reply); };
const setText = t => { document.getElementById('mcText').value = t; if (MC) MC.text = t; };   // what typing into the textarea does
const lastBody = () => calls[calls.length - 1].body;

(async () => {
  // ================= State + migration =================
  world();
  const b = blankState();
  ok('new fields exist on a fresh state: goals, seeded saved meal, empty history', b.settings.fiberGoal === 30 && b.settings.satFatGoal === 18 && b.savedMeals.length === 1 && b.savedMeals[0].name === 'Usual breakfast' && b.savedMeals[0].result === null && Array.isArray(b.mealChecks) && b.mealChecks.length === 0);
  ok('the seeded breakfast is the usual one', /2 eggs.*½ cup egg whites.*2 tbsp cottage cheese.*olive oil spray/.test(b.savedMeals[0].desc));
  let m = migrateState({ schema: 2, days: {} });
  ok('OLD SAVE (no Meal Check fields) loads with everything defaulted + the seed', m.settings.fiberGoal === 30 && m.settings.satFatGoal === 18 && m.savedMeals.length === 1 && m.savedMeals[0].id === 'seed-breakfast' && m.mealChecks.length === 0);
  m = migrateState({ schema: 2, settings: { drip: 100, proteinGoal: 150, sugarBudget: 25 } });
  ok('...existing protein and sugar goals are reused untouched', m.settings.proteinGoal === 150 && m.settings.sugarBudget === 25 && nutritionGoals.call(null) !== undefined);
  m = migrateState({ schema: 2, savedMeals: [] });
  ok('a deliberately emptied saved-meals list stays empty (the seed does not come back)', m.savedMeals.length === 0);
  m = migrateState({ schema: 2, savedMeals: [null, 5, { id: 'x' }, { id: 'ok', name: 'Keep me', uses: '3' }] });
  ok('garbage saved-meal entries are dropped; the rest are normalised', m.savedMeals.length === 1 && m.savedMeals[0].uses === 3 && m.savedMeals[0].result === null);
  m = migrateState({ schema: 2, settings: { fiberGoal: 0, satFatGoal: 'x' } });
  ok('nonsense goals fall back to defaults', m.settings.fiberGoal === 30 && m.settings.satFatGoal === 18);
  const old = addDays(todayKey(), -400), recent = addDays(todayKey(), -10);
  m = migrateState({ schema: 2, mealChecks: [{ id: 'a', date: old }, { id: 'b', date: recent }, null] });
  ok('mealChecks older than 365 days are pruned on load', m.mealChecks.length === 1 && m.mealChecks[0].id === 'b');
  const r = applyBackup({ schema: 2 });
  ok('IMPORTED BACKUP from before Meal Check also loads with the new fields defaulted', r.ok && S.savedMeals.length === 1 && S.settings.fiberGoal === 30 && Array.isArray(S.mealChecks));

  // sat fat default moved 13 -> 18 g: an untouched old default is upgraded once; a limit you set yourself is kept
  m = migrateState({ schema: 2, settings: { satFatGoal: 13 } });
  ok('an old save still on the old 13 g default moves to 18 g (once)', m.settings.satFatGoal === 18 && m.settings.satFatV === 1);
  m = migrateState({ schema: 2, settings: { satFatGoal: 13, satFatV: 1 } });
  ok('...but a 13 g you chose after that is kept', m.settings.satFatGoal === 13);
  m = migrateState({ schema: 2, settings: { satFatGoal: 10 } });
  ok('a custom limit (10 g) is never touched', m.settings.satFatGoal === 10 && m.settings.satFatV === 1);
  m = migrateState(JSON.parse(JSON.stringify(migrateState({ schema: 2, settings: { satFatGoal: 13 } }))));
  ok('migrating twice changes nothing', m.settings.satFatGoal === 18);

  // ================= Placement: no new habit, nothing on Today =================
  world();
  localStorage.setItem('gh_ai_key', 'sk-test');
  ok('MAIN PAGE still has exactly 4 habits', todayModel().habits.length === 4 && (todayHTML().match(/class="hrow/g) || []).length === 4);
  ok('...and Meal Check does not appear on the main page at all', !/Check a meal|mc-|Meal Check/.test(todayHTML()));
  OV = 'protein'; protDay = todayKey();
  ok('the button lives on the Protein page', proteinOverHTML().includes('onCheckMeal()') && proteinOverHTML().includes('>Check a meal<'));
  localStorage.removeItem('gh_ai_key');
  ok('NO KEY: the button says "Add your API key in settings"', proteinOverHTML().includes('Add your API key in settings'));
  onCheckMeal();
  ok('...and tapping it opens the key card instead of the sheet', keyOpen === true && MC === null && sheet() === '');
  localStorage.setItem('gh_ai_key', 'sk-test'); keyOpen = false;

  // ================= Thresholds + verdict =================
  const t = mealThresholds(nutritionGoals());
  ok('per-meal bands at the default goals are exactly the spec table', JSON.stringify(t) === JSON.stringify({ protein: { g: 35, y: 20 }, sugar: { g: 8, y: 15 }, fiber: { g: 8, y: 4 }, satFat: { g: 5, y: 9 } }));
  const lv = (k, v) => readingLevel(k, v, t);
  ok('protein: >=35 green, 20-34 yellow, <20 red', lv('protein', 35) === 'g' && lv('protein', 34.9) === 'y' && lv('protein', 20) === 'y' && lv('protein', 19.9) === 'r');
  ok('added sugar: <=8 green, 9-15 yellow, >15 red', lv('sugar', 8) === 'g' && lv('sugar', 8.5) === 'y' && lv('sugar', 15) === 'y' && lv('sugar', 15.1) === 'r');
  ok('fiber: >=8 green, 4-7 yellow, <4 red', lv('fiber', 8) === 'g' && lv('fiber', 7.9) === 'y' && lv('fiber', 4) === 'y' && lv('fiber', 3.9) === 'r');
  ok('sat fat: <=5 green, 6-9 yellow, >9 red', lv('satFat', 5) === 'g' && lv('satFat', 5.5) === 'y' && lv('satFat', 9) === 'y' && lv('satFat', 9.1) === 'r');
  const mk = (p, s, f, sf) => ({ protein_g: p, added_sugar_g: s, fiber_g: f, sat_fat_g: sf });
  ok('all four green -> GREEN, "Great fit"', mealVerdict(mk(40, 2, 10, 2)).verdict === 'green' && mealVerdict(mk(40, 2, 10, 2)).label === 'Great fit');
  ok('three green + one yellow -> GREEN', mealVerdict(mk(30, 2, 10, 2)).verdict === 'green' && mealVerdict(mk(40, 2, 5, 2)).verdict === 'green');
  ok('three green + one RED protein/fiber (not sugar/sat fat) -> YELLOW', mealVerdict(mk(10, 2, 10, 2)).verdict === 'yellow' && mealVerdict(mk(40, 2, 1, 2)).verdict === 'yellow');
  ok('two yellow, two green -> YELLOW, "Okay"', mealVerdict(mk(30, 12, 10, 2)).verdict === 'yellow' && mealVerdict(mk(30, 12, 10, 2)).label === 'Okay');
  ok('sat fat red -> RED even if everything else is green ("Rethink")', mealVerdict(mk(60, 0, 20, 11)).verdict === 'red' && mealVerdict(mk(60, 0, 20, 11)).label === 'Rethink');
  ok('added sugar red -> RED even if everything else is green', mealVerdict(mk(60, 20, 20, 0)).verdict === 'red');
  const bv = mealVerdict(BREAKFAST);
  ok('usual breakfast (29 g, 0 sugar, 0 fiber, 3.5 sat fat) -> YELLOW', bv.verdict === 'yellow' && bv.levels.protein === 'y' && bv.levels.sugar === 'g' && bv.levels.fiber === 'r' && bv.levels.satFat === 'g');
  S.settings.fiberGoal = 24;
  const t2 = mealThresholds(nutritionGoals());
  ok('editing the fiber goal re-computes the bands (24 g -> green at 6 g, yellow from 3 g)', t2.fiber.g === 6 && t2.fiber.y === 3 && t2.protein.g === 35);
  ok('...so the same meal (30 g protein, 6 g fiber) turns green at a 24 g goal and stays yellow at 30 g', mealVerdict(mk(30, 2, 6, 2), nutritionGoals()).verdict === 'green' && (S.settings.fiberGoal = 30, mealVerdict(mk(30, 2, 6, 2), nutritionGoals()).verdict === 'yellow'));
  ok('bands are never stored in state', !/threshold|"g":35/.test(JSON.stringify(S)));
  ok('goal edits are validated and never touch the money rules', setNutritionGoals(5, 18) !== null && setNutritionGoals(30, 100) !== null && S.settings.fiberGoal === 30 && setNutritionGoals(28, 12) === null && S.settings.fiberGoal === 28 && S.settings.satFatGoal === 12 && S.settings.proteinGoal === 150 && S.settings.sugarBudget === 25);
  setNutritionGoals(30, 18);

  // ================= Parser =================
  ok('fenced JSON parses', parseMealJSON('```json\n' + JSON.stringify(BREAKFAST) + '\n```').protein_g === 29);
  ok('plain ``` fences without a language parse', parseMealJSON('```\n' + JSON.stringify(GREAT) + '\n```').meal_name === 'Overnight oats with chia');
  ok('JSON with prose around it still parses', parseMealJSON('Sure! Here you go: ' + JSON.stringify(GREAT) + ' Hope that helps.').fiber_g === 12);
  ok('MALFORMED JSON returns null, never throws', parseMealJSON('{"protein_g": 20,') === null && parseMealJSON('not json at all') === null && parseMealJSON('') === null && parseMealJSON(null) === null && parseMealJSON(undefined) === null);
  ok('valid JSON that is not a meal answer is rejected ({} / array / number)', parseMealJSON('{}') === null && parseMealJSON('[1,2]') === null && parseMealJSON('42') === null);
  ok('is_food:false is recognised', parseMealJSON('{"is_food":false}').is_food === false);
  const dirty = parseMealJSON(JSON.stringify({ is_food: true, meal_name: '  ', protein_g: -5, added_sugar_g: '12.46', fiber_g: 'abc', sat_fat_g: null, calories: 1e9, confidence: 'wild', swap: 'x'.repeat(500), items: 'no' }));
  ok('numbers are clamped to >= 0, numeric strings parsed, junk -> 0', dirty.protein_g === 0 && dirty.added_sugar_g === 12.5 && dirty.fiber_g === 0 && dirty.sat_fat_g === 0);
  ok('missing/odd fields get safe defaults and long text is capped', dirty.meal_name === 'Meal' && dirty.confidence === 'medium' && dirty.swap.length === 120 && Array.isArray(dirty.items) && dirty.calories <= 5000);

  // ================= Opening the sheet =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); calls = [];
  onCheckMeal();
  ok('with a key the sheet opens with exactly the three choices', MC && MC.view === 'choose' && sheet().includes('>Photo<') && sheet().includes('>Saved meals<') && sheet().includes('>Type it<'));
  ok('Photo uses the camera input (accept image/*, capture environment)', /accept="image\/\*" capture="environment"/.test(sheet()));
  ok('opening it makes no API call', calls.length === 0);

  // ================= Type it -> result (acceptance: usual breakfast = yellow + swap) =================
  reply = BREAKFAST; mcTypeIt(); setText('2 eggs and cottage cheese'); const before = canonMoney();
  function canonMoney() { return JSON.stringify(moneyNow()); }
  const p = mcCheckText();
  ok('(while waiting) the loading view shows', MC.view === 'loading' && sheet().includes('Checking your meal'));
  await new Promise(r => setTimeout(r, 20));
  ok('exactly one request was made, to the Messages API with the stored key and the browser-access header', calls.length === 1 && calls[0].url === 'https://api.anthropic.com/v1/messages' && calls[0].headers['x-api-key'] === 'sk-test' && calls[0].headers['anthropic-dangerous-direct-browser-access'] === 'true' && calls[0].headers['anthropic-version'] === '2023-06-01');
  ok('same Haiku model, max_tokens 600, the spec system prompt', calls[0].body.model === 'claude-haiku-4-5-20251001' && calls[0].body.max_tokens === 600 && /estimate nutrition for one meal/.test(calls[0].body.system) && /ONE practical swap/.test(calls[0].body.system) && /Max 15 words/.test(calls[0].body.system));
  ok('the typed description is what gets sent', calls[0].body.messages[0].content[0].text.includes('2 eggs and cottage cheese'));
  ok('RESULT: verdict "Okay" (yellow), the four readings, and the swap line are shown', MC.view === 'result' && sheet().includes('Okay') && sheet().includes('vy') && ['Protein', 'Added sugar', 'Fiber', 'Sat fat'].every(x => sheet().includes('>' + x + '<')) && sheet().includes('Add ¼ cup rinsed black beans and salsa for 4 g fiber'));
  ok('the card has Log it, Save meal, Done and a collapsed Details', sheet().includes('>Log it<') && sheet().includes('>Save meal<') && sheet().includes('>Done<') && sheet().includes('>Details<') && !sheet().includes('Standard large eggs'));
  mcDetails();
  ok('Details opens the assumptions, items, confidence and calories', sheet().includes('Standard large eggs') && sheet().includes('Confidence: medium') && sheet().includes('260 calories') && sheet().includes('2 large whole eggs'));
  ok('the card shows today\'s running totals for all four goals', /today 0 of 150 g/.test(sheet()) && /today 0 of 25 g/.test(sheet()) && /today 0 of 30 g/.test(sheet()) && /today 0 of 18 g/.test(sheet()));
  ok('the check is recorded, not yet logged', S.mealChecks.length === 1 && S.mealChecks[0].verdict === 'yellow' && S.mealChecks[0].logged === false && S.mealChecks[0].mealName === BREAKFAST.meal_name && S.mealChecks[0].fiber_g === 0 && S.mealChecks[0].sat_fat_g === 3.5);
  ok('checking a meal pays NOTHING by itself (money unchanged)', canonMoney() === before);
  ok('no photo/base64 anywhere in state after a text check', !/base64|"data":/.test(JSON.stringify(S)));
  ok('medium confidence shows no "Rough estimate"', !sheet().includes('Rough estimate'));

  // ================= Log it =================
  const foodsBefore = foodsOn(todayKey()).length;
  mcLogIt();
  const f = foodsOn(todayKey())[foodsOn(todayKey()).length - 1];
  ok('LOG IT adds one entry to today\'s food list: meal name as label, protein and added sugar (the 2.0 shape of addNumCore\'s {amt,label})', foodsOn(todayKey()).length === foodsBefore + 1 && f.label === BREAKFAST.meal_name && f.protein === 29 && f.sugar === 0 && f.src === 'check');
  ok('...so it counts toward Protein and Less sugar like any other entry', proteinOn(todayKey()) === 29 && habitState('sugar', todayKey()).logged);
  ok('...and fiber / sat fat go to the daily totals computed from logged checks', S.mealChecks[0].logged === true && mealFiberOn(todayKey()) === 0 && mealSatFatOn(todayKey()) === 3.5);
  ok('the button becomes "Logged ✓" and a second tap does nothing', sheet().includes('Logged ✓') && (mcLogIt(), foodsOn(todayKey()).length === foodsBefore + 1));
  ok('the card now shows the new running totals', /today 29 of 150 g/.test(sheet()) && /today 3.5 of 18 g/.test(sheet()));
  closeSheet();
  ok('Done closes the sheet and drops the Meal Check session', sheet() === '' && MC === null);
  deleteFood(todayKey(), f.id);
  ok('deleting the logged food entry also un-logs its fiber / sat fat', S.mealChecks[0].logged === false && mealSatFatOn(todayKey()) === 0);

  // ================= Log it for a meal with 0 g protein; sick-day state never blocks =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); onCheckMeal(); reply = { is_food: true, meal_name: 'Apple with almonds', protein_g: 0, added_sugar_g: 0, fiber_g: 6, sat_fat_g: 0.5, calories: 180, confidence: 'high', swap: 'Add chia seeds' };
  mcTypeIt(); setText('apple'); mcCheckText(); await new Promise(r => setTimeout(r, 20));
  ok('a 0 g protein meal (fruit) can still be logged from Meal Check', (mcLogIt(), foodsOn(todayKey()).length === 1 && foodsOn(todayKey())[0].protein === 0 && mealFiberOn(todayKey()) === 6));
  ok('...while the manual Add still rejects 0 g protein', addFood(todayKey(), { label: 'x', protein: 0 }) === false);
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); sickDay();
  ok('(setup) Protein is paused by a sick day', habitState('protein', todayKey()).st === 'paused');
  onCheckMeal(); reply = GREAT; mcTypeIt(); setText('oats'); mcCheckText(); await new Promise(r => setTimeout(r, 20)); mcLogIt();
  ok('a sick-day pause never blocks logging food: it logs and Protein resumes', foodsOn(todayKey()).length === 1 && habitState('protein', todayKey()).st !== 'paused');

  // ================= Verdict colours through the UI =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); onCheckMeal();
  reply = Object.assign({}, GREAT, { sat_fat_g: 11 }); mcTypeIt(); setText('cheese pizza'); mcCheckText(); await new Promise(r => setTimeout(r, 20));
  ok('11 g sat fat -> RED "Rethink" regardless of the other readings', sheet().includes('Rethink') && S.mealChecks[0].verdict === 'red');
  closeSheet(); onCheckMeal(); reply = GREAT; mcTypeIt(); setText('oats'); mcCheckText(); await new Promise(r => setTimeout(r, 20));
  ok('a great meal -> GREEN "Great fit"', sheet().includes('Great fit') && S.mealChecks[1].verdict === 'green');
  closeSheet(); onCheckMeal(); reply = Object.assign({}, BREAKFAST, { confidence: 'low' }); mcTypeIt(); setText('something'); mcCheckText(); await new Promise(r => setTimeout(r, 20));
  ok('low confidence still shows the result, with "Rough estimate" under the verdict', MC.view === 'result' && sheet().includes('Rough estimate'));

  // ================= Photo path (image is resized in the browser; here we hand it in) =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); onCheckMeal(); calls = [];
  MC.photo = { b64: 'AAAA-FAKE-JPEG-BYTES', type: 'image/jpeg', url: 'data:image/jpeg;base64,AAAA' }; MC.source = 'photo'; MC.view = 'photo'; renderMealSheet(true);
  ok('photo step shows the preview and Small / Normal / Large chips', sheet().includes('<img') && ['Small', 'Normal', 'Large'].every(x => sheet().includes('>' + x + '<')) && MC.portion === 'Normal');
  mcPortion(2); reply = GREAT; mcRun(); await new Promise(r => setTimeout(r, 20));
  const content = calls[0].body.messages[0].content;
  ok('the photo goes out as a base64 image block with the chosen portion', content[0].type === 'image' && content[0].source.type === 'base64' && content[0].source.media_type === 'image/jpeg' && content[0].source.data === 'AAAA-FAKE-JPEG-BYTES' && /Large/.test(content[1].text));
  ok('the photo is discarded as soon as the call succeeds', MC.photo === null && MC.view === 'result');
  ok('photo bytes never reach saved state, localStorage or a backup', !JSON.stringify(S).includes('AAAA') && !(localStorage.getItem('gh2') || '').includes('AAAA') && !JSON.stringify(exportObject()).includes('AAAA'));

  // ================= Saved meals =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); onCheckMeal(); reply = GREAT; mcTypeIt(); setText('oats'); mcCheckText(); await new Promise(r => setTimeout(r, 20));
  mcSaveMeal();
  ok('Save meal stores the meal with its result', S.savedMeals.some(s => s.name === 'Overnight oats with chia' && s.result && s.result.fiber_g === 12) && sheet().includes('Saved ✓'));
  mcSaveMeal(); saveMealResult(GREAT);
  ok('saving the same meal again does not duplicate it', S.savedMeals.filter(s => s.name === 'Overnight oats with chia').length === 1);
  closeSheet(); calls = []; onCheckMeal(); mcShow('saved');
  ok('the Saved list shows the seeded breakfast (unscored) and the new meal', sheet().includes('Usual breakfast') && sheet().includes('Not scored yet') && sheet().includes('Overnight oats with chia'));
  const oats = S.savedMeals.find(s => s.name === 'Overnight oats with chia');
  mcSavedTap(oats.id);
  ok('SAVED MEAL RE-CHECK makes ZERO fetch calls and re-shows the stored result', calls.length === 0 && MC.view === 'result' && sheet().includes('Great fit') && sheet().includes('Overnight oats with chia'));
  ok('...it counts as a use and records a fresh check you can log', oats.uses === 1 && S.mealChecks.length === 2);
  mcLogIt();
  ok('...and a saved meal can be logged', foodsOn(todayKey()).length === 1 && foodsOn(todayKey())[0].label === 'Overnight oats with chia');
  ok('re-showing a saved meal works offline', (navigator.onLine = false, closeSheet(), onCheckMeal(), mcShow('saved'), mcSavedTap(oats.id), calls.length === 0 && MC.view === 'result'));
  navigator.onLine = true;

  // seeded breakfast: scored once, then cached
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); calls = []; reply = BREAKFAST;
  onCheckMeal(); mcShow('saved'); mcSavedTap('seed-breakfast'); await new Promise(r => setTimeout(r, 20));
  ok('FIRST RUN of "Usual breakfast" scores it with ONE call using its description', calls.length === 1 && /2 eggs.*egg whites.*cottage cheese.*olive oil spray/.test(calls[0].body.messages[0].content[0].text));
  ok('...showing verdict Okay (yellow) and the swap', MC.view === 'result' && sheet().includes('Okay') && sheet().includes('black beans and salsa'));
  ok('...and the result is cached on the saved meal', S.savedMeals[0].result && S.savedMeals[0].result.protein_g === 29 && S.savedMeals[0].uses === 1);
  closeSheet(); onCheckMeal(); mcShow('saved'); mcSavedTap('seed-breakfast');
  ok('second time: zero extra calls', calls.length === 1 && MC.view === 'result');
  // order, rename, delete
  S.savedMeals.push({ id: 'b', name: 'Lentil soup', result: GREAT, uses: 5, lastUsed: 1 }, { id: 'c', name: 'Tuna wrap', result: GREAT, uses: 2, lastUsed: 9 });
  ok('most-used first', savedMealsSorted().map(s => s.name).join('|') === 'Lentil soup|Tuna wrap|Usual breakfast' || savedMealsSorted()[0].name === 'Lentil soup');
  ok('rename works and rejects blanks', renameSavedMeal('b', '  Big lentil soup ') && S.savedMeals.find(s => s.id === 'b').name === 'Big lentil soup' && renameSavedMeal('b', '   ') === false);
  ok('delete works', deleteSavedMeal('c') && !S.savedMeals.some(s => s.id === 'c') && deleteSavedMeal('nope') === false);
  closeSheet(); onCheckMeal(); mcShow('saved'); MC.manageId = 'b'; mcShow('manage');
  ok('the long-press manage view offers Rename / Delete / Cancel', sheet().includes('>Rename<') && sheet().includes('>Delete meal<') && sheet().includes('>Cancel<'));
  ok('a long press (550 ms) opens that view', (closeSheet(), onCheckMeal(), mcShow('saved'), mcPressStart('b'), true) && (await new Promise(r => setTimeout(r, 620)), MC.view === 'manage' && MC.manageId === 'b' && _mcLong === true));
  mcPressEnd();

  // ================= Failures =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); calls = [];
  const typeCheck = async () => { closeSheet(); onCheckMeal(); mcTypeIt(); setText('a meal'); mcCheckText(); await new Promise(r => setTimeout(r, 20)); };
  reply = '{"protein_g": 20,'; await typeCheck();
  ok('MALFORMED JSON: no crash, friendly message with a retry button, nothing recorded', MC.view === 'error' && sheet().includes("Couldn't read that meal — try again or type it") && sheet().includes('>Try again<') && S.mealChecks.length === 0);
  reply = '```json\n' + JSON.stringify(GREAT) + '\n```'; mcRetry(); await new Promise(r => setTimeout(r, 20));
  ok('...Try again re-runs the same input, and FENCED JSON then works', MC.view === 'result' && sheet().includes('Great fit'));
  reply = 'I cannot help with that'; await typeCheck();
  ok('plain prose reply is handled the same way', MC.view === 'error');
  const nChecks = S.mealChecks.length;
  reply = { is_food: false }; await typeCheck();
  ok('is_food:false -> "That doesn\'t look like food" with retry, and nothing is recorded', MC.view === 'notfood' && sheet().includes("That doesn't look like food") && sheet().includes('>Try again<') && S.mealChecks.length === nChecks);
  reply = () => ({ ok: false, status: 401, json: async () => ({}) }); await typeCheck();
  ok('401: tells you the key was rejected', MC.view === 'error' && sheet().includes('API key rejected'));
  reply = () => ({ ok: false, status: 500, json: async () => ({}) }); await typeCheck();
  ok('500: the same friendly retry message', MC.view === 'error' && sheet().includes("Couldn't read that meal"));
  reply = () => { throw new Error('offline'); }; await typeCheck();
  ok('network failure (fetch throws): friendly retry message, no crash', MC.view === 'error' && sheet().includes("Couldn't read that meal"));
  reply = () => ({ ok: true, status: 200, json: async () => { throw new Error('bad body'); } }); await typeCheck();
  ok('an unreadable response body is handled', MC.view === 'error');
  reply = () => ({ ok: true, status: 200, json: async () => ({ content: [] }) }); await typeCheck();
  ok('an empty response is handled', MC.view === 'error');
  // offline
  calls = []; navigator.onLine = false; closeSheet(); onCheckMeal(); mcPickPhoto();
  ok('OFFLINE: Photo says "Needs a connection." and makes no call', MC.view === 'choose' && sheet().includes('Needs a connection.') && calls.length === 0);
  mcTypeIt();
  ok('OFFLINE: Type it says the same', sheet().includes('Needs a connection.') && MC.view === 'choose');
  closeSheet(); onCheckMeal(); mcShow('text'); setText('x'); reply = GREAT; mcCheckText(); await new Promise(r => setTimeout(r, 20));
  ok('...and even if forced, an offline request shows "Needs a connection." and never calls fetch', calls.length === 0 && MC.view === 'error' && sheet().includes('Needs a connection.'));
  navigator.onLine = true;
  // empty text, double taps, close mid-flight, key removed
  closeSheet(); onCheckMeal(); mcShow('text'); $('mcText'); setText('   '); mcCheckText();
  ok('an empty Type it asks for text and does not call the API', MC.note === 'Type what you ate first.' && calls.length === 0);
  calls = []; reply = GREAT; setText('oats'); mcCheckText(); mcCheckText(); mcRetry(); await new Promise(r => setTimeout(r, 20));
  ok('DOUBLE TAPS while a request is in flight make exactly one call', calls.length === 1);
  closeSheet(); onCheckMeal(); mcShow('text'); setText('oats'); let slow; reply = () => new Promise(res => { slow = res; });
  mcCheckText(); const n = S.mealChecks.length; closeSheet(); slow(resp(GREAT)); await new Promise(r => setTimeout(r, 20));
  ok('closing the sheet mid-flight: no crash, the late answer is ignored and nothing is recorded', MC === null && S.mealChecks.length === n);
  reply = GREAT; localStorage.removeItem('gh_ai_key'); closeSheet(); MC = { view: 'text', source: 'text', text: 'oats', busy: false, portion: 'Normal', note: '' }; mcRun(); await new Promise(r => setTimeout(r, 20));
  ok('key removed after opening the sheet: a clear message, no crash', MC.view === 'error' && sheet().includes('Add your API key'));
  localStorage.setItem('gh_ai_key', 'sk-test');

  // ================= History cap =================
  world(); S.mealChecks = [{ id: 'old', date: addDays(todayKey(), -366), logged: true }, { id: 'edge', date: addDays(todayKey(), -365), logged: true }];
  recordMealCheck(GREAT);
  ok('recording a check prunes anything older than 365 days', !S.mealChecks.some(c => c.id === 'old') && S.mealChecks.some(c => c.id === 'edge') && S.mealChecks.length === 2);

  // ================= Backup =================
  world(); localStorage.setItem('gh_ai_key', 'sk-SECRET-123'); S.savedMeals.push({ id: 'z', name: 'Soup', result: GREAT, uses: 1, lastUsed: 5 }); recordMealCheck(GREAT);
  const exp = JSON.stringify(exportObject());
  ok('BACKUP EXPORT has no API key and no photo data', !exp.includes('SECRET') && !exp.includes('sk-') && !/base64|AAAA/.test(exp));
  ok('...but it does carry saved meals, checks and goals', exp.includes('"savedMeals"') && exp.includes('"mealChecks"') && exp.includes('fiberGoal') && exp.includes('Soup'));
  const snap = JSON.stringify(S); S = blankState(); applyBackup(JSON.parse(exp));
  ok('...and they round-trip through import', S.savedMeals.some(s => s.name === 'Soup') && S.mealChecks.length === 1 && S.settings.satFatGoal === 18);

  // ================= The Protein page estimate still works on the shared helper =================
  world(); localStorage.setItem('gh_ai_key', 'sk-test'); calls = [];
  document.getElementById('aiText').value = 'greek yogurt bowl'; aiPhoto = null;
  reply = { food: 'Greek yogurt bowl', grams_protein: 28.4, added_sugar_g: 12, confidence: 'medium' }; await analyzeMeal();
  ok('Protein "Say it" estimate goes through the same helper (max_tokens 300) and only fills fields', calls.length === 1 && calls[0].body.max_tokens === 300 && document.getElementById('fProt').value === 28.4 && document.getElementById('fSugar').value === 12 && foodsOn(todayKey()).length === 0);
  reply = '{"food":"water","grams_protein":0}'; await analyzeMeal();
  ok('...and keeps its own messages', document.getElementById('aiStatus').textContent.includes('add more detail'));
  reply = () => ({ ok: false, status: 401, json: async () => ({}) }); await analyzeMeal();
  ok('...401 still says rejected', document.getElementById('aiStatus').textContent.includes('rejected'));

  // ================= Goals card on the second page =================
  world();
  ok('the Weight page (second page) has the Meal Check goals card with the current values', weightHTML().includes('Meal Check goals') && weightHTML().includes('id="gFiber"') && weightHTML().includes('value="30"') && weightHTML().includes('value="18"'));
  document.getElementById('gFiber').value = '32'; document.getElementById('gSat').value = '12'; saveGoals();
  ok('saving the goals updates settings', S.settings.fiberGoal === 32 && S.settings.satFatGoal === 12);
  ok('the card explains protein and sugar are fixed money rules', weightHTML().includes('money rules'));
  ok('the main page still has exactly 4 habits after all of this', todayModel().habits.length === 4);
  localStorage.setItem('gh_ai_key', 'sk-test');
  const threw = (() => { try { render(); OV = 'protein'; protDay = todayKey(); renderProteinOver(); onCheckMeal(); for (const v of ['choose', 'photo', 'text', 'saved', 'manage', 'loading', 'error', 'notfood']) { MC.view = v; renderMealSheet(false); } return null; } catch (e) { return e; } })();
  ok('every sheet view renders without throwing', !threw);
})().catch(e => { console.log('UNCAUGHT', e && e.stack); });
