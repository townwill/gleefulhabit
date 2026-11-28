// Fiber + sat fat on every entry (Snap meal, Say it, chips, manual, Check a meal). Blank = unknown, never 0. fetch is faked.
const ok = (name, cond) => console.log(name + ':', !!cond);
const T = () => todayKey();
const el = id => document.getElementById(id);
function world(now) { localStorage.clear(); _setFakeNow(new Date(now || '2026-10-26T13:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; protDay = T(); localStorage.setItem('gh_ai_key', 'sk-test'); navigator.onLine = true; }
let calls = [], reply = null;
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return typeof reply === 'function' ? reply() : resp(reply); };
const set = (l, p, s, f, sf) => { el('fLabel').value = l; el('fProt').value = p; el('fSugar').value = s; el('fFiber').value = f; el('fSat').value = sf; };

(async () => {
  // ---- optNum: unknown is not zero ----
  world();
  ok('optNum: real numbers kept (0 is real)', optNum(0) === 0 && optNum('0') === 0 && optNum('4.26') === 4.3 && optNum(7) === 7);
  ok('optNum: blank / null / junk / negative / boolean are unknown', [optNum(''), optNum(null), optNum(undefined), optNum('abc'), optNum(-1), optNum(true), optNum(NaN)].every(x => x === undefined));

  // ---- addFood / updateFood ----
  addFood(T(), { label: 'oats', protein: 10, sugar: 1, fiber: 8, satFat: 1.5, src: 'manual' });
  addFood(T(), { label: 'steak', protein: 40, sugar: 0, fiber: '', satFat: 6, src: 'manual' });
  addFood(T(), { label: 'water-ish', protein: 5, sugar: 0, fiber: 0, satFat: 0, src: 'manual' });
  const fs = foodsOn(T());
  ok('entries store only the numbers that were given', fs[0].fiber === 8 && fs[0].satFat === 1.5 && !('fiber' in fs[1]) && fs[1].satFat === 6 && fs[2].fiber === 0 && fs[2].satFat === 0);
  let t = macroTotal(T(), foodFiber);
  ok('fiber total: sums known entries, counts known of total (a real 0 is known)', t.sum === 8 && t.known === 2 && t.total === 3);
  t = macroTotal(T(), foodSatFat);
  ok('sat fat total across all three', t.sum === 7.5 && t.known === 3 && t.total === 3);
  ok('mealFiberOn / mealSatFatOn read the food list', mealFiberOn(T()) === 8 && mealSatFatOn(T()) === 7.5);
  updateFood(T(), fs[1].id, { fiber: '3' });
  ok('editing in a number makes it known and updates the total', foodFiber(fs[1]) === 3 && mealFiberOn(T()) === 11);
  updateFood(T(), fs[1].id, { fiber: '' });
  ok('blanking it goes back to unknown, not 0', !('fiber' in fs[1]) && mealFiberOn(T()) === 8);
  updateFood(T(), fs[1].id, { protein: 41 });
  ok('editing other fields leaves fiber / sat fat alone', fs[1].satFat === 6);

  // ---- day check reads them ----
  let c = dayCheck(T());
  ok('day check: tracked, partial coverage reported', c.tracked === true && c.fiberKnown === 2 && c.satKnown === 3 && c.foods === 3);
  S.days[T()].foods = [{ id: 'a', label: 'x', protein: 20, sugar: 1, src: 'manual' }];
  c = dayCheck(T());
  ok('with none recorded both are unknown and the day is capped', c.tracked === false && c.levels.fiber === null && c.levels.satFat === null);
  ok('the day card says Snap meal / Say it read them', /Snap meal, Say it and Check a meal read them/.test((renderProteinOver(), dayCardInner())));

  // ---- chips remember fiber / sat fat ----
  world();
  addFood(T(), { label: 'Protein oats', protein: 25, sugar: 2, fiber: 9, satFat: 1, src: 'manual' });
  addFood(T(), { label: 'Jerky', protein: 15, sugar: 3, src: 'manual' });
  const ch = quickChips(8), oats = ch.findIndex(x => x.label === 'Protein oats'), jerky = ch.findIndex(x => x.label === 'Jerky');
  ok('chips carry fiber / sat fat when known, undefined when not', ch[oats].fiber === 9 && ch[oats].satFat === 1 && ch[jerky].fiber === undefined);
  S.days[addDays(T(), -1)] = S.days[T()]; S.days[T()] = { workout: null, windDown: null, foods: [] };
  quickAdd(quickChips(8).findIndex(x => x.label === 'Protein oats'));
  quickAdd(quickChips(8).findIndex(x => x.label === 'Jerky'));
  const added = foodsOn(T());
  ok('one-tap re-add keeps the numbers; unknown stays unknown', added[0].fiber === 9 && added[0].satFat === 1 && !('fiber' in added[1]) && !('satFat' in added[1]));

  // ---- manualAdd: blank = unknown ----
  world();
  set('Toast', '6', '1', '', ''); manualAdd();
  set('Beans', '12', '0', '14', '0.5'); manualAdd();
  const m = foodsOn(T());
  ok('manual add: blank fields stay unknown; filled ones store', m.length === 2 && !('fiber' in m[0]) && !('satFat' in m[0]) && m[1].fiber === 14 && m[1].satFat === 0.5);

  // ---- Say it / Snap meal prompt + fill ----
  world();
  el('aiText').value = 'a bowl of lentil soup';
  reply = { food: 'Lentil soup', grams_protein: 18, added_sugar_g: 1, fiber_g: 15.4, sat_fat_g: 0.8, confidence: 'medium' };
  calls = []; await analyzeMeal();
  ok('the prompt asks for itemized fiber and satFat per item and totals, and carries the pantry', /"fiber"/.test(calls[0].body.system) && /"satFat"/.test(calls[0].body.system) && /"totals"/.test(calls[0].body.system) && /PANTRY \(per serving shown\)/.test(calls[0].body.system));
  ok('estimate fills the fiber and sat fat boxes (and still only fills; nothing added)', el('fFiber').value === 15.4 && el('fSat').value === 0.8 && el('fProt').value === 18 && foodsOn(T()).length === 0);
  manualAdd();
  ok('...Add stores them', foodsOn(T()).length === 1 && foodsOn(T())[0].fiber === 15.4 && foodsOn(T())[0].satFat === 0.8);
  reply = { food: 'Mystery stew', grams_protein: 20, added_sugar_g: 0, fiber_g: null, confidence: 'low' };
  await analyzeMeal();
  ok('null / missing from the model leaves the boxes blank = unknown', el('fFiber').value === '' && el('fSat').value === '');
  reply = { food: 'Plain chicken', grams_protein: 30, added_sugar_g: 0, fiber_g: 0, sat_fat_g: 1, confidence: 'high' };
  await analyzeMeal();
  ok('a real 0 from the model is kept as 0', el('fFiber').value === 0 && el('fSat').value === 1);
  reply = { food: 'Odd', grams_protein: 20, fiber_g: -5, sat_fat_g: 'lots', confidence: 'low' };
  await analyzeMeal();
  ok('negative / junk estimates are treated as unknown', el('fFiber').value === '' && el('fSat').value === '');

  // ---- Check a meal: Log it puts the numbers on the entry ----
  world();
  S.mealChecks.push({ id: 'k1', date: T(), ts: 1, mealName: 'Oats', verdict: 'green', protein_g: 30, added_sugar_g: 2, fiber_g: 11, sat_fat_g: 2, logged: false });
  ok('a check that is not logged does not count', mealFiberOn(T()) === 0 && dayCheck(T()).tracked === false);
  logMealCheck('k1');
  const lf = foodsOn(T())[0];
  ok('Log it stores fiber / sat fat on the entry itself', lf.fiber === 11 && lf.satFat === 2 && lf.mc === 'k1' && mealFiberOn(T()) === 11 && mealSatFatOn(T()) === 2);
  addFood(T(), { label: 'Snack', protein: 5, fiber: 4, src: 'manual' });
  ok('and it adds to Snap/Say-it/manual numbers without double counting', mealFiberOn(T()) === 15 && mealSatFatOn(T()) === 2);
  deleteFood(T(), lf.id);
  ok('deleting the entry un-logs the check and removes its numbers', S.mealChecks[0].logged === false && mealFiberOn(T()) === 4);

  // ---- migration + backup ----
  const mg = migrateState({ schema: 2, days: { '2026-10-20': { foods: [{ id: 'z', label: 'a', protein: 5, sugar: 0, src: 'manual', fiber: -2, satFat: 'x' }, { id: 'y', label: 'b', protein: 5, sugar: 0, src: 'manual', fiber: 3, satFat: 0 }] } } });
  const mf = mg.days['2026-10-20'].foods;
  ok('migration drops bad fiber / sat fat but keeps real ones (including 0)', !('fiber' in mf[0]) && !('satFat' in mf[0]) && mf[1].fiber === 3 && mf[1].satFat === 0);
  world(); addFood(T(), { label: 'Beans', protein: 12, fiber: 14, satFat: 0.5, src: 'manual' });
  const dump = JSON.parse(JSON.stringify(S)); S = blankState(); applyBackup(dump);
  ok('backup round-trip keeps fiber / sat fat', foodsOn(T())[0].fiber === 14 && foodsOn(T())[0].satFat === 0.5);

  // ---- UI ----
  world(); addFood(T(), { label: 'Beans', protein: 12, fiber: 14, satFat: 0.5, src: 'manual' }); addFood(T(), { label: 'Jerky', protein: 15, src: 'manual' });
  const html = proteinOverHTML();
  ok('add form has the optional fiber / sat fat boxes', html.includes('id="fFiber"') && html.includes('id="fSat"') && /Blank means unknown/.test(html));
  ok('food rows show fiber / sat fat only when known', /14 g fiber/.test(html) && /0\.5 g sat fat/.test(html) && (html.match(/g fiber/g) || []).length === 1);
  openFoodEdit(foodsOn(T())[0].id);
  ok('edit sheet shows the current numbers', el('eFiber') !== undefined && document.getElementById('sheetRoot').innerHTML.includes('id="eFiber"') && document.getElementById('sheetRoot').innerHTML.includes('value="14"'));
  closeSheet();
})();
