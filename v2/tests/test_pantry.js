// My pantry + itemized estimates. fetch is faked; nothing touches the network.
const ok = (name, cond) => console.log(name + ':', !!cond);
const tick = () => new Promise(r => setTimeout(r, 20));
const sheet = () => document.getElementById('sheetRoot').innerHTML;
const el = id => document.getElementById(id);
function world() { localStorage.clear(); _setFakeNow(new Date('2026-10-26T13:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; MC = null; PN = null; localStorage.setItem('gh_ai_key', 'sk-test'); navigator.onLine = true; }
let calls = [], queue = [];
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); const r = queue.length > 1 ? queue.shift() : queue[0]; return typeof r === 'function' ? r() : resp(r); };
fileToJpeg = async () => ({ b64: 'AAAA', url: 'blob:x', type: 'image/jpeg' });

// The DOM stub keeps whatever was last typed; a real page re-reads each field from the HTML on every render. Mimic that.
const _unesc = x => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const _openSheet = openSheet;
openSheet = (h, inPlace) => {
  _openSheet(h, inPlace);
  for (const m of h.matchAll(/<input[^>]*?\bid="([^"]+)"[^>]*>/g)) { const v = m[0].match(/\bvalue="([^"]*)"/); el(m[1]).value = v ? _unesc(v[1]) : ''; }
  const sel = h.match(/<select[^>]*id="rPan"[^>]*>([\s\S]*?)<\/select>/);
  if (sel) { const o = sel[1].match(/<option value="([^"]*)" selected/); el('rPan').value = o ? _unesc(o[1]) : ''; }
};

// What the model might send back (its own arithmetic is deliberately wrong: the app recomputes pantry rows)
const TUNA3 = { is_food: true, meal_name: 'Tuna salad', items: [
  { name: 'Wild Planet Skipjack Tuna', amount: '1 can', pantryId: 'p-tuna', source: 'pantry', assumed: false, protein: 27, addedSugar: 0, fiber: 0, satFat: 1.5 },
  { name: 'Kirkland Greek yogurt', amount: '1/4 cup', pantryId: 'p-gyogurt', source: 'pantry', assumed: false, protein: 12, addedSugar: 0, fiber: 0, satFat: 0 },
  { name: '365 light mayo', amount: '1 tbsp', pantryId: 'p-mayo', source: 'pantry', assumed: false, protein: 0, addedSugar: 0, fiber: 0, satFat: 0 }],
  totals: { protein: 39, addedSugar: 0, fiber: 0, satFat: 1.5 }, calories: 260, confidence: 'high', assumptions: 'Pantry numbers.', swap: 'Add celery and diced pickles', swap_items: ['celery', 'pickles'] };
const TUNA_ALONE = { is_food: true, meal_name: 'Tuna salad', items: [
  { name: 'Skipjack tuna', amount: '', pantryId: 'p-tuna', source: 'pantry', protein: 0, addedSugar: 0, fiber: 0, satFat: 0 },
  { name: 'Greek yogurt', amount: '', pantryId: 'p-gyogurt', source: 'pantry', protein: 0 },
  { name: 'Light mayo', amount: '', pantryId: 'p-mayo', source: 'pantry', protein: 0 },
  { name: 'Celery', amount: '1 stalk', pantryId: null, source: 'estimate', assumed: true, protein: 0.3, addedSugar: 0, fiber: 0.6, satFat: 0 }],
  calories: 300, confidence: 'medium', assumptions: 'Typical tuna salad.', swap: 'Add beans', swap_items: ['beans'] };
const chk = () => S.mealChecks.find(c => c.id === MC.checkId);
const rowsIn = () => (sheet().match(/class="it-row"/g) || []).length;
const openResult = async (reply) => { closeSheet(); calls = []; queue = [reply]; onCheckMeal(); mcTypeIt(); el('mcText') && (el('mcText').value = 'tuna salad'); MC.text = 'tuna salad'; mcCheckText(); await tick(); };

(async () => {
  // ================= Seed + migration =================
  world();
  const seed = blankState().pantry;
  ok('a fresh state seeds the 13 pantry items in the order given', seed.length === 13 && seed.map(p => p.name).join('|') === ['Wild Planet Skipjack Tuna, no salt added', 'Kirkland Nonfat Greek Yogurt', '365 Organic Light Mayo', 'Jones Golden Brown Turkey Sausage', 'Liquid egg whites', 'Whole egg', 'Low-fat cottage cheese', 'Blackberries', "Annie's Low-Sodium Chili", 'Icelandic Provisions Vanilla Skyr', 'NuttZo Mixed Nut & Seed Butter', 'The Only Bean Roasted Edamame', 'Fairlife 2% Ultra-Filtered Milk'].join('|'));
  const want = { 'p-tuna': ['1 can (5 oz)', 32, 0, 0, 0.5], 'p-gyogurt': ['2/3 cup', 18, 0, 0, 0], 'p-mayo': ['1 tbsp', 0, 0, 0, 0], 'p-sausage': ['4 links', 10, 0, 0, 1.5], 'p-eggwhites': ['1 cup', 26, 0, 0, 0], 'p-egg': ['1 large', 6, 0, 0, 1.5], 'p-cottage': ['1/4 cup', 7, 0, 0, 0.5], 'p-blackberries': ['1 cup', 2, 0, 8, 0], 'p-chili': ['1 can', 29, 0, 14, 2], 'p-skyr': ['1 cup', 15, 6, 0, 1], 'p-nuttzo': ['2 tbsp', 6, 0, 3, 2], 'p-edamame': ['1 pack', 12, 0, 5, 1], 'p-fairlife': ['1 cup', 13, 0, 0, 3] };
  ok('every seeded serving and its protein / added sugar / fiber / sat fat match the list exactly', Object.keys(want).every(id => { const p = seed.find(x => x.id === id); return p && p.servingLabel === want[id][0] && p.protein === want[id][1] && p.addedSugar === want[id][2] && p.fiber === want[id][3] && p.satFat === want[id][4] && Array.isArray(p.aliases) && 'servingGrams' in p && 'brand' in p; }));
  ok('OLD SAVE (no pantry) loads with the seed', migrateState({ schema: 2 }).pantry.length === 13);
  ok('a deliberately emptied pantry stays empty', migrateState({ schema: 2, pantry: [] }).pantry.length === 0);
  let m = migrateState({ schema: 2, pantry: [null, 5, { id: 'a' }, { id: 'b', name: '  ' }, { id: 'c', name: 'Oats', brand: 7, servingLabel: '', servingGrams: -3, protein: '5', addedSugar: 'x', fiber: -1, satFat: null, aliases: [' Oatmeal ', '', null, 'rolled OATS'] }, { id: 'c', name: 'dup' }] });
  ok('garbage entries dropped; fields normalised (serving default, bad numbers 0, aliases lowercased, no duplicate ids)', m.pantry.length === 1 && m.pantry[0].servingLabel === '1 serving' && m.pantry[0].servingGrams === null && m.pantry[0].protein === 5 && m.pantry[0].addedSugar === 0 && m.pantry[0].fiber === 0 && m.pantry[0].brand === '' && m.pantry[0].aliases.join() === 'oatmeal,rolled oats');
  ok('an imported backup from before the pantry also gets the seed', (applyBackup({ schema: 2 }), S.pantry.length === 13));
  world(); S.pantry.push({ id: 'mine', name: 'My thing', brand: '', servingLabel: '1 bar', servingGrams: null, protein: 20, addedSugar: 3, fiber: 5, satFat: 2, aliases: ['bar'] });
  localStorage.setItem('gh_ai_key', 'sk-SECRET');
  const exp = JSON.stringify(exportObject()); S = blankState(); applyBackup(JSON.parse(exp));
  ok('the pantry round-trips through backup; the API key is not in it', S.pantry.length === 14 && S.pantry.some(p => p.id === 'mine') && !exp.includes('SECRET'));
  world();

  // ================= Amounts =================
  const near = (a, b) => Math.abs(a - b) < 0.001;
  ok('parseAmount: fractions, mixed numbers, unicode, words, units', parseAmount('1/4 cup').qty === 0.25 && near(parseAmount('2/3 cup').qty, 2 / 3) && parseAmount('1 1/2 cups').qty === 1.5 && parseAmount('1 1/2 cups').unit === 'cup' && parseAmount('½ cup').qty === 0.5 && parseAmount('1½ cups').qty === 1.5 && parseAmount('a can').unit === 'can' && parseAmount('2 Tbsp').unit === 'tbsp' && parseAmount('4 links').unit === 'link' && parseAmount('2').unit === '' && parseAmount('pinch').unit === 'pinch' && parseAmount('') === null && parseAmount(null) === null && parseAmount('about 3 oz').qty === 3);
  const P = id => pantryById(id);
  ok('scaleFactor: same unit (1/4 cup of a 2/3 cup serving = 0.375)', near(scaleFactor('1/4 cup', P('p-gyogurt')), 0.375) && scaleFactor('2 tbsp', P('p-nuttzo')) === 1 && scaleFactor('1 can', P('p-tuna')) === 1 && scaleFactor('6 links', P('p-sausage')) === 1.5);
  ok('...across units (tbsp <-> cup, oz inside "1 can (5 oz)", tsp <-> tbsp)', scaleFactor('1 cup', P('p-mayo')) === 16 && scaleFactor('2 oz', P('p-tuna')) === 0.4 && near(scaleFactor('2 tsp', P('p-mayo')), 2 / 3) && scaleFactor('1/2 cup', P('p-eggwhites')) === 0.5);
  ok('...counts (3 eggs of "1 large", a bare 2 = 2 servings, "2 servings")', scaleFactor('3 eggs', P('p-egg')) === 3 && scaleFactor('2', P('p-egg')) === 2 && scaleFactor('2 servings', P('p-skyr')) === 2);
  ok('...an amount it cannot work out gives null (numbers stay as they are)', scaleFactor('a handful', P('p-egg')) === null && scaleFactor('3 scoops', P('p-egg')) === null && near(scaleFactor('100 g', P('p-tuna')), 100 / 141.7475));
  S.pantry.push({ id: 'g1', name: 'Rice', brand: '', servingLabel: '1 cup cooked', servingGrams: 160, protein: 4, addedSugar: 0, fiber: 1, satFat: 0, aliases: [] });
  ok('with servingGrams known, grams and oz convert (80 g = half a serving)', scaleFactor('80 g', pantryById('g1')) === 0.5 && near(scaleFactor('2 oz', pantryById('g1')), 56.699 / 160));
  S.pantry = S.pantry.filter(p => p.id !== 'g1');

  // ================= Itemized parse: the acceptance cases =================
  let t = parseMealJSON(JSON.stringify(TUNA3));
  ok('"tuna salad: 1 can skipjack, 1/4 cup greek yogurt, 1 tbsp light mayo" -> ~39 g protein, 0.5 g sat fat', t.protein_g === 38.8 && t.sat_fat_g === 0.5 && t.added_sugar_g === 0 && t.fiber_g === 0);
  ok('...all three rows are tagged pantry and the amounts are not assumed', t.lines.length === 3 && t.lines.every(l => l.source === 'pantry' && l.assumed === false) && t.itemized === true);
  ok('...the model\'s own wrong pantry arithmetic (27 g tuna, 1.5 g sat fat) is replaced by the pantry numbers', t.lines[0].protein === 32 && t.lines[0].satFat === 0.5 && t.lines[1].protein === 6.8);
  t = parseMealJSON(JSON.stringify(TUNA_ALONE));
  ok('"tuna salad" alone -> 1 can skipjack + 1 serving yogurt + 1 tbsp mayo, the amounts marked ASSUMED', t.lines.slice(0, 3).map(l => l.amount + '|' + l.assumed).join() === '1 can (5 oz)|true,2/3 cup|true,1 tbsp|true' && t.lines.slice(0, 3).every(l => l.source === 'pantry'));
  ok('...an extra estimated item keeps its own numbers and is tagged est.; totals are the sum of the rows', t.lines[3].source === 'estimate' && t.lines[3].pantryId === null && t.protein_g === 50.3 && t.fiber_g === 0.6 && t.sat_fat_g === 0.5);
  t = parseMealJSON(JSON.stringify(Object.assign({}, TUNA3, { totals: { protein: 5, addedSugar: 9, fiber: 9, satFat: 9 } })));
  ok('totals that do not match the items are recomputed from the items in JS', t.protein_g === 38.8 && t.added_sugar_g === 0 && t.fiber_g === 0 && t.sat_fat_g === 0.5);
  t = parseMealJSON(JSON.stringify({ is_food: true, meal_name: 'Soup', totals: { protein: 20, addedSugar: 1, fiber: 4, satFat: 2 }, items: [] }));
  ok('items missing but totals present: the totals are kept (one number set, no rows)', t.protein_g === 20 && t.sat_fat_g === 2 && t.lines.length === 0 && !t.itemized);
  t = parseMealJSON(JSON.stringify({ is_food: true, meal_name: 'X', items: [{ name: 'Mystery', amount: '1', pantryId: 'nope', source: 'pantry', protein: 10 }, { name: 'skipjack tuna', amount: '1 can', source: 'pantry' }, null, 'junk'] }));
  ok('an unknown pantryId is not trusted: matched by name when possible, otherwise it is an estimate', t.lines[0].source === 'estimate' && t.lines[0].pantryId === null && t.lines[1].source === 'pantry' && t.lines[1].pantryId === 'p-tuna' && t.lines.length === 2);
  t = parseMealJSON(JSON.stringify({ is_food: true, meal_name: 'X', items: [{ name: 'Odd', amount: 'a handful', pantryId: 'p-egg', source: 'pantry', protein: 9, satFat: 4 }] }));
  ok('a pantry row whose amount cannot be scaled keeps the model numbers (still tagged pantry)', t.lines[0].protein === 9 && t.lines[0].source === 'pantry');
  t = parseMealJSON(JSON.stringify({ is_food: true, meal_name: 'Old', items: [{ name: 'egg', amount: '2' }], protein_g: 12, added_sugar_g: 0, fiber_g: 0, sat_fat_g: 3, swap: 's' }));
  ok('the OLD flat shape still parses (no rows, numbers kept)', t.protein_g === 12 && t.lines.length === 0 && !t.itemized && t.items[0].name === 'egg');
  ok('fenced, prose-wrapped, malformed, not-food', parseMealJSON('```json\n' + JSON.stringify(TUNA3) + '\n```').protein_g === 38.8 && parseMealJSON('Sure! ' + JSON.stringify(TUNA3)).lines.length === 3 && parseMealJSON('{"items":[') === null && parseMealJSON('{"is_food":false}').is_food === false && parseMealJSON('[]') === null);
  t = parseMealJSON(JSON.stringify({ is_food: true, meal_name: 'N', items: [{ name: 'a', amount: '1', protein: -5, addedSugar: 'x', fiber: null, satFat: 1e9 }] }));
  ok('negative / junk / absurd numbers are clamped', t.lines[0].protein === 0 && t.lines[0].addedSugar === 0 && t.lines[0].fiber === 0 && t.lines[0].satFat === 5000);

  // ================= Prompt =================
  world(); await openResult(TUNA3);
  const sys = calls[0].body.system;
  ok('EVERY estimate prompt carries the pantry as compact JSON with the spec\'s rules', calls.length === 1 && /PANTRY \(per serving shown\): \[/.test(sys) && sys.includes('"id":"p-tuna"') && sys.includes('"serving":"1 can (5 oz)"') && sys.includes('"protein":32') && sys.includes('"aliases":["tuna"') && /If an ingredient matches a pantry item by name, brand or alias, use the pantry numbers scaled to the amount/.test(sys) && /Only estimate items not in the pantry/.test(sys) && /Don't round protein down to be safe/.test(sys));
  ok('...and the assume-one-serving rule, the dish rule and the itemized schema', /assume 1 pantry serving/.test(sys) && /tuna salad/.test(sys) && /"pantryId":null,"source":"pantry\|estimate","assumed":false/.test(sys) && /"totals":\{"protein"/.test(sys) && calls[0].body.max_tokens === 900);
  ok('the pantry in the prompt follows edits (an added item shows up)', (S.pantry.push({ id: 'new1', name: 'Zesty bar', brand: '', servingLabel: '1 bar', servingGrams: null, protein: 20, addedSugar: 3, fiber: 5, satFat: 2, aliases: [] }), estimateSystem().includes('Zesty bar')) && (S.pantry = [], estimateSystem().includes('PANTRY (per serving shown): empty')));
  world();

  // ================= The result card =================
  await openResult(TUNA3);
  ok('the result card shows one row per item with a "pantry" tag and its numbers', MC.view === 'result' && rowsIn() === 3 && (sheet().match(/it-tag p">pantry</g) || []).length === 3 && sheet().includes('Wild Planet Skipjack Tuna') && sheet().includes('<b>32 g</b>') && sheet().includes('<b>6.8 g</b>'));
  ok('...the four goal numbers are the totals (38.8 protein, 0.5 sat fat)', MC.result.protein_g === 38.8 && sheet().includes('38.8') && S.mealChecks[0].protein_g === 38.8 && S.mealChecks[0].sat_fat_g === 0.5);
  ok('...no row is underlined (nothing assumed)', !sheet().includes('class="it-as"'));
  await openResult(TUNA_ALONE);
  ok('"est." tag on the estimated row and ASSUMED amounts underlined', (sheet().match(/it-tag e">est\.</g) || []).length === 1 && (sheet().match(/class="it-as"/g) || []).length === 4);
  ok('the card still has Log it / Save meal / Done and the swap line', sheet().includes('>Log it<') && sheet().includes('>Save meal<') && sheet().includes('>Done<') && sheet().includes('Add beans'));

  // ================= Editing a row =================
  await openResult(TUNA3); calls = [];
  mcRowOpen(1);
  ok('tapping a row opens its editor with the amount, pantry item and numbers', MC.view === 'rowedit' && el('rAmt') === undefined ? false : sheet().includes('id="rAmt"') && sheet().includes('value="1/4 cup"') && sheet().includes('selected') && sheet().includes('Kirkland Nonfat Greek Yogurt'));
  el('rName').value = 'Kirkland Greek yogurt'; el('rAmt').value = '1/2 cup'; el('rPan').value = 'p-gyogurt'; el('rProt').value = '6.8'; el('rSug').value = '0'; el('rFib').value = '0'; el('rSat').value = '0';
  mcRowSave();
  ok('EDITING THE AMOUNT (1/4 -> 1/2 cup) rescales from the pantry and updates the totals with NO new AI call', calls.length === 0 && MC.result.lines[1].amount === '1/2 cup' && MC.result.lines[1].protein === 13.5 && MC.result.protein_g === 45.5 && MC.view === 'result' && sheet().includes('45.5'));
  ok('...the recorded check follows (same id, new numbers) and nothing was logged', chk().protein_g === 45.5 && chk().logged === false && chk().id === MC.checkId);
  mcRowOpen(1); el('rAmt').value = '1 cup'; el('rProt').value = '13.5'; mcRowSave();
  ok('editing again rescales from the pantry, not from the last edit (1 cup = 27 g, no drift)', MC.result.lines[1].protein === 27 && MC.result.lines[1].source === 'pantry');
  mcRowOpen(2); el('rAmt').value = 'a splash'; mcRowSave();
  ok('an amount it cannot read: serving used, marked assumed, and it says so', MC.result.lines[2].amount === '1 tbsp' && MC.result.lines[2].assumed === true && document.getElementById('toast').textContent.includes("Couldn't read that amount"));
  mcRowOpen(0); el('rProt').value = '30'; el('rSat').value = '0.8'; mcRowSave();
  ok('typing your own NUMBERS makes the row an estimate (est.), no longer linked to the pantry', MC.result.lines[0].source === 'estimate' && MC.result.lines[0].pantryId === null && MC.result.lines[0].protein === 30 && MC.result.lines[0].satFat === 0.8);
  mcRowOpen(0);
  ok('an est. row offers "Save to pantry"; a pantry row does not', sheet().includes('>Save to pantry<') && (mcRowOpen === mcRowOpen) && (mcShow('result'), mcRowOpen(1), !sheet().includes('>Save to pantry<')));
  mcShow('result'); mcRowOpen(0); el('rName').value = 'My tuna'; el('rAmt').value = '1 can'; mcRowToPantry();
  ok('SAVE TO PANTRY creates the item (serving = the amount) and links the row to it as a pantry row', S.pantry.length === 14 && S.pantry[13].name === 'My tuna' && S.pantry[13].servingLabel === '1 can' && S.pantry[13].protein === 30 && MC.result.lines[0].pantryId === S.pantry[13].id && MC.result.lines[0].source === 'pantry');
  mcRowOpen(0); el('rPan').value = 'p-tuna'; el('rAmt').value = '1 can'; mcRowSave();
  ok('SWAPPING a row to a different pantry item re-reads the numbers from that item', MC.result.lines[0].pantryId === 'p-tuna' && MC.result.lines[0].protein === 32 && MC.result.lines[0].satFat === 0.5);
  mcRowOpen(-1); el('rName').value = 'Celery'; el('rAmt').value = '2 stalks'; el('rProt').value = '0.6'; el('rFib').value = '1.2'; mcRowSave();
  ok('+ Add item adds an estimate row', MC.result.lines.length === 4 && MC.result.lines[3].name === 'Celery' && MC.result.lines[3].source === 'estimate' && MC.result.fiber_g === 1.2);
  mcRowOpen(3); mcRowRemove();
  ok('Remove asks twice (first tap only asks)', MC.view === 'rowedit' && MC.result.lines.length === 4 && sheet().includes('Tap again to remove'));
  mcRowRemove();
  ok('...second tap removes it and the totals follow', MC.result.lines.length === 3 && MC.result.fiber_g === 0 && MC.view === 'result');
  mcRowOpen(-1); el('rName').value = ''; mcRowSave();
  ok('a new item needs a name', MC.view === 'rowedit' && MC.result.lines.length === 3 && document.getElementById('toast').textContent === 'Give it a name');
  mcShow('result');
  ok('all of that made ZERO AI calls', calls.length === 0);

  // ---- verdict follows the edit ----
  await openResult(TUNA3); 
  mcRowOpen(0); el('rAmt').value = '4 cans'; mcRowSave();
  ok('the verdict is re-judged from the new totals (4 cans of tuna: protein way up)', MC.result.protein_g > 100 && chk().verdict === mealVerdict(MC.result).verdict && chk().protein_g === MC.result.protein_g);

  // ---- log it / save meal ----
  await openResult(TUNA3);
  mcRowOpen(1); el('rAmt').value = '1/3 cup'; mcRowSave();
  mcLogIt();
  const f = foodsOn(todayKey())[0];
  ok('LOG IT logs the totals (protein, sugar, fiber, sat fat) as before, under the meal name', foodsOn(todayKey()).length === 1 && f.label === 'Tuna salad' && f.protein === MC.result.protein_g && f.satFat === 0.5 && f.sugar === 0 && f.fiber === 0 && f.src === 'check');
  mcRowOpen(0);
  ok('after logging the rows are locked (no editor) and the card says why', MC.view === 'result' && /disabled/.test(sheet().match(/class="it-row"[^>]*>/)[0]) && sheet().includes('Logged — delete the food entry'));
  await openResult(TUNA3); mcSaveMeal();
  const sv = S.savedMeals.find(x => x.name === 'Tuna salad');
  ok('SAVE MEAL keeps the itemized version (rows, tags, totals)', sv && sv.result.itemized && sv.result.lines.length === 3 && sv.result.lines[0].pantryId === 'p-tuna');
  mcRowOpen(2); el('rAmt').value = '2 tbsp'; mcRowSave();
  ok('...editing after saving updates the saved meal too', sv.result.lines[2].amount === '2 tbsp');
  const keep = JSON.parse(localStorage.getItem('gh2')).savedMeals.find(x => x.name === 'Tuna salad');
  ok('...and it is in the stored state with its rows', keep.result.lines.length === 3 && keep.result.itemized === true);
  closeSheet(); calls = []; onCheckMeal(); mcShow('saved'); mcSavedTap(sv.id);
  ok('re-checking the saved meal shows the rows again with ZERO calls', calls.length === 0 && MC.view === 'result' && rowsIn() === 3 && sheet().includes('(2 tbsp)') === false);
  mcRowOpen(0); el('rAmt').value = '1/2 can'; mcRowSave();
  ok('...and they are still editable', MC.result.lines[0].protein === 16);
  closeSheet();

  // ================= Say it / Snap meal use the pantry too =================
  world(); OV = 'protein'; protDay = todayKey(); queue = [TUNA3]; calls = []; el('aiText') && 0;
  document.getElementById('aiText').value = 'tuna salad: 1 can skipjack, 1/4 cup greek yogurt, 1 tbsp light mayo'; document.getElementById('aiStatus'); await analyzeMeal();
  ok('Say it: the prompt has the pantry and the form is filled with the itemized TOTALS (never auto-added)', /PANTRY \(per serving shown\): \[/.test(calls[0].body.system) && el('fProt').value === 38.8 && el('fSat').value === 0.5 && el('fSugar').value === 0 && el('fFiber').value === 0 && el('fLabel').value === 'Tuna salad' && foodsOn(todayKey()).length === 0);
  ok('...and the status line says how much came from the pantry', /3 of 3 from your pantry/.test(el('aiStatus').textContent));
  queue = [{ is_food: false }]; await analyzeMeal();
  ok('Say it: not food is handled', /doesn't look like food/.test(el('aiStatus').textContent));

  // ================= The pantry screen =================
  world();
  ok('the second page has a "My pantry · 13" card', weightHTML().includes('id="pantryCard"') && weightHTML().includes('My pantry · 13') && weightHTML().includes('openPantry()'));
  openPantry();
  ok('the pantry sheet lists all 13 items, with serving and protein, sorted by name', PN.view === 'list' && (sheet().match(/class="pn-row"/g) || []).length === 13 && sheet().indexOf('365 Organic Light Mayo') < sheet().indexOf('Wild Planet') && sheet().includes('1 can (5 oz)') && sheet().includes('id="pnQ"'));
  pnFilter('tuna');
  ok('SEARCH by name', (el('pnList').innerHTML.match(/class="pn-row"/g) || []).length === 1 && el('pnList').innerHTML.includes('Wild Planet'));
  pnFilter('annie');
  ok('...by brand', el('pnList').innerHTML.includes("Annie") && (el('pnList').innerHTML.match(/class="pn-row"/g) || []).length === 1);
  pnFilter('greek');
  ok('...by alias', el('pnList').innerHTML.includes('Kirkland Nonfat Greek Yogurt'));
  pnFilter('zzzz'); ok('...and says so when nothing matches', el('pnList').innerHTML.includes('Nothing matches'));
  pnFilter('');
  // add
  pnAdd();
  ok('ADD opens an empty form with every field', PN.view === 'form' && ['pnName', 'pnBrand', 'pnServ', 'pnGrams', 'pnProt', 'pnSug', 'pnFib', 'pnSat', 'pnAlias'].every(id => sheet().includes('id="' + id + '"')) && sheet().includes('>Snap label<'));
  pnSave();
  ok('saving an empty form asks for a name', PN.view === 'form' && sheet().includes('Give it a name') && S.pantry.length === 13);
  el('pnName').value = 'Chobani Zero Sugar'; pnSave();
  ok('...then a serving', sheet().includes('What is one serving'));
  el('pnName').value = 'Chobani Zero Sugar'; el('pnServ').value = '1 cup'; el('pnProt').value = '12'; pnSave();
  ok('...then all four numbers (blank is not zero)', sheet().includes('Fill in all four numbers') && S.pantry.length === 13);
  el('pnName').value = 'Chobani Zero Sugar'; el('pnBrand').value = 'Chobani'; el('pnServ').value = '1 cup'; el('pnGrams').value = '150'; el('pnProt').value = '12'; el('pnSug').value = '0'; el('pnFib').value = '0'; el('pnSat').value = '0'; el('pnAlias').value = ' Chobani , zero sugar yogurt ,'; pnSave();
  const nu = S.pantry.find(p => p.name === 'Chobani Zero Sugar');
  ok('SAVE adds it: numbers, grams, aliases split and lowercased, back to the list', nu && S.pantry.length === 14 && nu.protein === 12 && nu.servingGrams === 150 && nu.brand === 'Chobani' && nu.aliases.join() === 'chobani,zero sugar yogurt' && PN.view === 'list' && sheet().includes('Chobani Zero Sugar'));
  ok('...it is saved to state and persists', JSON.parse(localStorage.getItem('gh2')).pantry.length === 14);
  // edit
  pnEdit(nu.id);
  ok('EDIT opens the form filled in', PN.view === 'form' && el('pnName').value === 'Chobani Zero Sugar' && el('pnProt').value == 12 && el('pnAlias').value === 'chobani, zero sugar yogurt');
  el('pnProt').value = '13'; el('pnServ').value = '3/4 cup'; pnSave();
  ok('...saving updates it in place (same id, no duplicate)', S.pantry.length === 14 && pantryById(nu.id).protein === 13 && pantryById(nu.id).servingLabel === '3/4 cup');
  // delete
  pnEdit(nu.id); pnDelete();
  ok('DELETE asks twice', S.pantry.length === 14 && sheet().includes('Tap again to delete'));
  pnDelete();
  ok('...the second tap removes it', S.pantry.length === 13 && !pantryById(nu.id) && PN.view === 'list');
  pnEdit('p-tuna'); pnBack();
  ok('Cancel goes back without changing anything', PN.view === 'list' && S.pantry.length === 13);
  closeSheet();
  ok('closing redraws the Weight page card with the new count', (S.pantry.pop(), _groceryDirty = true, closeSheet(), document.getElementById('app').innerHTML.includes('My pantry · 12')));
  world();

  // ---- the estimate uses an edited pantry item ----
  S.pantry.find(p => p.id === 'p-tuna').protein = 40;
  ok('an edited pantry item changes what an estimate uses (40 g per can)', parseMealJSON(JSON.stringify({ is_food: true, meal_name: 'T', items: [{ name: 'tuna', amount: '1 can', pantryId: 'p-tuna', source: 'pantry' }] })).protein_g === 40);
  world();

  // ================= Snap label =================
  const LABEL = { name: 'Siggi\'s Vanilla Skyr', brand: "Siggi's", serving_label: '3/4 cup (170g)', serving_grams: 170, protein_g: 15, added_sugar_g: 7, fiber_g: 0, sat_fat_g: 0 };
  openPantry(); pnAdd(); calls = []; queue = [LABEL];
  await pnLabelPicked({ target: { files: [{ name: 'label.jpg' }] } });
  ok('SNAP LABEL sends the photo to the AI call with the label prompt', calls.length === 1 && calls[0].body.messages[0].content[0].type === 'image' && /Nutrition Facts/.test(calls[0].body.system) && calls[0].body.max_tokens >= 300);
  ok('...and pre-fills the form (serving, protein, added sugar, fiber, sat fat) WITHOUT saving', PN.view === 'form' && el('pnName').value === "Siggi's Vanilla Skyr" && el('pnServ').value === '3/4 cup (170g)' && el('pnGrams').value == 170 && el('pnProt').value == 15 && el('pnSug').value == 7 && el('pnFib').value == 0 && el('pnSat').value == 0 && S.pantry.length === 13 && sheet().includes('Check these against the label'));
  pnSave();
  const lp = S.pantry.find(p => p.name === "Siggi's Vanilla Skyr");
  ok('after I confirm (Save) the pantry item is correct', lp && lp.protein === 15 && lp.addedSugar === 7 && lp.fiber === 0 && lp.satFat === 0 && lp.servingLabel === '3/4 cup (170g)' && lp.servingGrams === 170 && lp.brand === "Siggi's");
  ok('...the photo is never stored', !JSON.stringify(S).includes('AAAA') && !JSON.stringify(S).includes('blob:'));
  pnAdd(); queue = ['```json\n' + JSON.stringify({ name: null, brand: null, serving_label: '1 bar (40g)', protein_g: 20, added_sugar_g: null, fiber_g: 5, sat_fat_g: 2 }) + '\n```']; await pnLabelPicked({ target: { files: [{}] } });
  ok('what the label did not show (added sugar: null) stays BLANK, not 0, so I must fill it in', el('pnSug').value === '' && el('pnProt').value == 20 && el('pnName').value === '');
  el('pnName').value = 'Protein bar'; pnSave();
  ok('...saving is refused until every number is filled', sheet().includes('Fill in all four numbers') && !S.pantry.some(p => p.name === 'Protein bar'));
  pnAdd(); el('pnName').value = 'Typed first'; el('pnProt').value = '9'; queue = [{ serving_label: '1 cup', protein_g: 15, fiber_g: 0 }]; await pnLabelPicked({ target: { files: [{}] } });
  ok('what I typed before snapping is kept unless the label read it', el('pnName').value === 'Typed first' && el('pnProt').value == 15 && el('pnServ').value === '1 cup');
  const badLabel = async (q, expect, label) => { pnAdd(); queue = [q]; calls = []; await pnLabelPicked({ target: { files: [{}] } }); ok(label, calls.length === 1 && PN.view === 'form' && sheet().includes(expect) && el('pnProt').value === ''); };
  await badLabel('{"serving_label":', 'read that label', 'an unreadable label: friendly message, form stays empty');
  await badLabel({ name: null, brand: null, serving_label: null, protein_g: null }, 'read that label', 'a label with nothing readable: same');
  await badLabel(() => ({ ok: false, status: 401, json: async () => ({}) }), 'API key rejected', '401: tells you the key was rejected');
  await badLabel(() => { throw new Error('x'); }, 'Network problem', 'network failure: friendly message');
  pnAdd(); navigator.onLine = false; calls = []; await pnLabelPicked({ target: { files: [{}] } });
  ok('offline: says so, no call', calls.length === 0 && sheet().includes('Needs a connection'));
  navigator.onLine = true;
  let slow; pnAdd(); queue = [() => new Promise(res => { slow = res; })]; const pend = pnLabelPicked({ target: { files: [{}] } }); await tick(); closeSheet(); slow(resp(LABEL)); await pend; await tick();
  ok('closing the sheet while it reads the label: no crash, nothing saved', PN === null);
  // no key
  world(); localStorage.removeItem('gh_ai_key'); openPantry(); pnAdd();
  ok('NO API KEY: the form still works, Snap label just asks for a key', !sheet().includes('type="file"') && sheet().includes('>Snap label<'));
  el('pnName').value = 'Plain oats'; el('pnServ').value = '1/2 cup'; el('pnProt').value = '5'; el('pnSug').value = '0'; el('pnFib').value = '4'; el('pnSat').value = '0.5'; pnSave();
  ok('...and manual entry saves fine', S.pantry.some(p => p.name === 'Plain oats'));
  ok('...as do search and delete (no key needed)', (pnFilter('oats'), el('pnList').innerHTML.includes('Plain oats')) && (pnEdit(S.pantry.find(p => p.name === 'Plain oats').id), pnDelete(), pnDelete(), !S.pantry.some(p => p.name === 'Plain oats')));
  closeSheet();

  // ================= Placement and safety =================
  world();
  ok('MAIN PAGE still has exactly 4 habits and no pantry text', todayModel().habits.length === 4 && !/pantry/i.test(todayHTML()));
  const threw = (() => { try { openPantry(); for (const v of ['list', 'form']) { PN.view = v; renderPantrySheet(false); } PN.id = 'p-tuna'; PN.f = null; PN.view = 'form'; PN.del = true; PN.busy = true; PN.note = 'x'; renderPantrySheet(false); closeSheet(); return false; } catch (e) { console.log('THREW', e.stack); return true; } })();
  ok('every pantry view and state renders without throwing', !threw);
  const threw2 = (() => { try { onCheckMeal(); MC.result = parseMealJSON(JSON.stringify(TUNA_ALONE)); mcSetResult(MC, MC.result); MC.checkId = recordMealCheck(MC.result).id; for (const v of ['result', 'rowedit']) { MC.view = v; MC.re = { i: 0, orig: Object.assign({}, MC.result.lines[0]), confirm: false }; renderMealSheet(false); } MC.re.i = -1; MC.re.orig = blankLine(); renderMealSheet(false); render(); return false; } catch (e) { console.log('THREW', e.stack); return true; } })();
  ok('every itemized card and editor state renders without throwing', !threw2);
})().catch(e => console.log('UNCAUGHT', e && e.stack));
