// 3.0 state: first-open copy of the 2.0 save, new fields, sanitising, backups.
const ok = (name, cond) => console.log(name + ':', !!cond);
function world(now) { localStorage.clear(); _setFakeNow(new Date(now || '2026-12-01T10:00:00').getTime()); S = blankState(); closeSheet(); OV = null; TAB = 'today'; }

world();
const b = blankState();
ok('a blank state is schema 3 with an empty sleep log, a fresh training plan and no packs opened', b.schema === 3 && JSON.stringify(b.sleep) === '{}' && b.packs.opened === 0 && b.packs.log.length === 0 && b.training.cur === null && b.training.restSec === 90 && b.ui.theme === 'auto');
ok('the four habits on the main page are Workout, Protein, Wind down, Sleep (Less sugar is off)', HABITS.join() === 'workout,protein,wind,sleep' && !HABITS.includes('sugar') && LEGACY_HABITS.includes('sugar'));
ok('the starting lift targets match the plan', JSON.stringify(b.training.lifts) === JSON.stringify({ goblet: { reps: 10, lb: 26 }, deadlift: { reps: 10, lb: 26 }, bench: { reps: 8, lb: 20 }, row: { reps: 10, lb: 20 }, hang: { secs: 15 }, carry: { secs: 30, lb: 26 } }));
ok('the plan and the packs start Monday 30 Nov 2026; the old money stops the day before', LAUNCH === '2026-11-30' && parseDk(LAUNCH).getDay() === 1 && LEGACY_END === '2026-11-29' && b.training.planStart === LAUNCH);

// ---- first open: copy the 2.0 save once ----
world();
const v2 = { schema: 2, startDate: '2026-10-01', settings: { monthly: 200, drip: 100, pool: 50, proteinGoal: 150, sugarBudget: 25, workoutWeek: 3, freeDaysPerYear: 10, fiberGoal: 30, satFatGoal: 18, satFatV: 1 },
  days: { '2026-11-02': { workout: { kind: 'workout', what: 'Bike', len: '20–40', hard: 'Solid', at: 1 }, windDown: null, foods: [{ id: 'a', label: 'Eggs', protein: 30, sugar: 0, src: 'manual' }] } },
  pauses: [], freeDays: [], spends: [{ id: 's', dk: '2026-10-20', cents: 500, cat: 'Cards' }], wins: [{ id: 'w', dk: '2026-11-02', label: 'Stayed calm', other: false, at: 1 }], weight: { unit: 'lbs', goal: null, logs: { '2026-11-02': 200 } },
  months: {}, comeback: null, imported: null, ui: { lastVersion: 'x', v1Offer: 'done' }, savedMeals: [], groceryList: [{ id: 'g', item: 'Salsa', amount: '', aisle: 'Canned & dry', count: 2, checked: false, addedTs: 1 }], pantry: [{ id: 'p1', name: 'My bar', brand: '', servingLabel: '1 bar', servingGrams: null, protein: 20, addedSugar: 3, fiber: 5, satFat: 2, aliases: [] }], mealChecks: [], recentSuggestions: [], dayInsights: {} };
localStorage.setItem('gh2', JSON.stringify(v2));
const before2 = localStorage.getItem('gh2');
let s3 = loadState();
ok('FIRST OPEN with no 3.0 save copies the 2.0 save: days, spends, wins, weight, pantry, grocery, saved meals all come over', s3.schema === 3 && s3.days['2026-11-02'].foods[0].label === 'Eggs' && s3.spends.length === 1 && s3.wins.length === 1 && s3.weight.logs['2026-11-02'] === 200 && s3.pantry.length === 1 && s3.groceryList[0].count === 2 && s3.savedMeals.length === 0 && s3.startDate === '2026-10-01');
ok('...with the 3.0 parts defaulted, and a note that it came from 2.0', JSON.stringify(s3.sleep) === '{}' && s3.training.planStart === LAUNCH && s3.packs.opened === 0 && s3.ui.from2 && s3.ui.from2.days === 1);
ok('...and 2.0\'s own save is left exactly as it was (the copy never writes gh2)', localStorage.getItem('gh2') === before2);
S = s3; save();
ok('...the copy is saved under gh3 and is used from then on', !!localStorage.getItem('gh3') && JSON.parse(localStorage.getItem('gh3')).schema === 3);
localStorage.setItem('gh2', JSON.stringify(Object.assign({}, v2, { days: {} })));
ok('once gh3 exists, a later change to gh2 is ignored (no second copy)', loadState().days['2026-11-02'].foods.length === 1);
localStorage.removeItem('gh3'); localStorage.setItem('gh2', '{not json');
ok('a broken 2.0 save is ignored: a fresh 3.0 state, not a crash', loadState().schema === 3 && loadState().ui.from2 === null);
localStorage.setItem('gh2', JSON.stringify({ schema: 1, junk: true }));
ok('a 2.0 save of the wrong schema is ignored too', loadState().ui.from2 === null && Object.keys(loadState().days).length === 0);

// ---- sanitising ----
world();
ok('cleanSleep keeps real nights, drops junk dates and impossible minutes', JSON.stringify(cleanSleep({ '2026-12-01': 400, '2026-12-02': '380', 'bad': 5, '2026-12-03': -5, '2026-12-04': 5000, '2026-12-05': 'x' })) === JSON.stringify({ '2026-12-01': 400, '2026-12-02': 380 }) && JSON.stringify(cleanSleep(null)) === '{}' && JSON.stringify(cleanSleep([1])) === '{}');
let t = cleanTraining({ planStart: 'nope', restSec: 5, lifts: { goblet: { reps: 99999, lb: -3 }, hang: { secs: 20 }, bogus: { reps: 1 } }, cur: { dk: 'x' }, log: [null, { dk: 'bad' }, { dk: '2026-12-01', kind: 'weird', week: 'x', mins: 'y', sets: 99, hit: ['goblet', 'nope'] }] });
ok('cleanTraining: bad start date, rest time and lifts fall back to defaults; unknown lifts and bad sessions dropped', t.planStart === LAUNCH && t.restSec === 90 && t.lifts.goblet.reps === 10 && t.lifts.goblet.lb === 26 && t.lifts.hang.secs === 20 && !('bogus' in t.lifts) && t.cur === null && t.log.length === 1 && t.log[0].kind === 'strength' && t.log[0].hit.join() === 'goblet' && t.log[0].week === 1);
t = cleanTraining({ cur: { dk: '2026-12-01', kind: 'strength', at: 5, warm: [true, 1, 0], mins: 12, sets: { goblet: [true, true], hang: [true, false, true, true] } } });
ok('a session in progress survives, with sets padded / trimmed to three and every lift present', t.cur && t.cur.dk === '2026-12-01' && t.cur.warm.length === 3 && t.cur.warm[1] === true && t.cur.sets.goblet.join() === 'true,true,false' && t.cur.sets.hang.length === 3 && Object.keys(t.cur.sets).length === 6);
t = cleanTraining({ cur: { dk: '2026-12-01', kind: 'yoga' } });
ok('...a session of an unknown kind is dropped', t.cur === null);
ok('cleanPacks: negatives and junk -> 0, log entries must be real timestamps', JSON.stringify(cleanPacks({ opened: -4, log: [5, 'x', 0] })) === JSON.stringify({ opened: 0, log: [5] }) && cleanPacks(null).opened === 0);
let m = migrateState({ schema: 3, ui: { theme: 'neon' } });
ok('an unknown theme falls back to auto', m.ui.theme === 'auto');
m = migrateState({ schema: 2 });
ok('migrating any old save gives all the new fields', m.sleep && m.training && m.packs && m.ui.theme === 'auto' && m.schema === 3);

// ---- backups ----
world(); S.sleep['2026-12-01'] = 400; S.packs.opened = 3; S.training.lifts.goblet.reps = 12; localStorage.setItem('gh_ai_key', 'sk-SECRET');
const exp = JSON.stringify(exportObject());
ok('the backup carries sleep, training and packs but never the API key', exp.includes('"sleep"') && exp.includes('"training"') && exp.includes('"packs"') && !exp.includes('SECRET'));
S = blankState(); applyBackup(JSON.parse(exp));
ok('...and restoring it brings them back', S.sleep['2026-12-01'] === 400 && S.packs.opened === 3 && S.training.lifts.goblet.reps === 12);
let r = applyBackup(Object.assign({}, v2));
ok('a 2.0 BACKUP FILE imports too (schema 2), with the new parts defaulted', r.ok && /2\.0 backup restored/.test(r.msg) && S.schema === 3 && S.days['2026-11-02'] && S.packs.opened === 0 && S.ui.from2 && Array.isArray(S.groceryList));
ok('a 3.0 backup says plain "Backup restored"', (S = blankState(), applyBackup(JSON.parse(exp)).msg === 'Backup restored'));
ok('a schema nobody knows is refused', applyBackup({ schema: 9 }).ok === false);
