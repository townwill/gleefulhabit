const ok = (name, cond) => console.log(name + ':', !!cond);

// ---------- blank state + migrateState ----------
const b = blankState();
ok('blank state is schema 2', b.schema === 2);
ok('defaults come from the spec ($200/$100/$50, 150g, 25g, 3/wk, 10 free days)',
  b.settings.monthly === 200 && b.settings.drip === 100 && b.settings.pool === 50 && b.settings.proteinGoal === 150 &&
  b.settings.sugarBudget === 25 && b.settings.workoutWeek === 3 && b.settings.freeDaysPerYear === 10);

let m = migrateState({});
ok('migrateState({}) fills every collection', Array.isArray(m.pauses) && Array.isArray(m.freeDays) && Array.isArray(m.spends) && Array.isArray(m.wins) && typeof m.days === 'object' && typeof m.months === 'object' && m.weight.unit === 'lbs');
m = migrateState(null);
ok('migrateState(null) returns a usable blank state', m.schema === 2 && m.settings.drip === 100);
m = migrateState({ settings: { drip: 90 }, days: { '2026-10-01': {} } });
ok('partial settings keep user values and fill the rest', m.settings.drip === 90 && m.settings.pool === 50);
ok('a day missing foods/workout/windDown gets defaults', Array.isArray(m.days['2026-10-01'].foods) && m.days['2026-10-01'].workout === null && m.days['2026-10-01'].windDown === null);
m = migrateState({ pauses: 'oops', weight: null });
ok('wrong-typed fields are repaired, not thrown', Array.isArray(m.pauses) && m.weight.logs && typeof m.weight.logs === 'object');

// ---------- date helpers ----------
ok('dim handles 31/30/28/29-day months', dim('2026-10') === 31 && dim('2026-11') === 30 && dim('2026-02') === 28 && dim('2028-02') === 29);
ok('addDays crosses month and year ends', addDays('2026-10-31', 1) === '2026-11-01' && addDays('2026-12-31', 1) === '2027-01-01' && addDays('2026-03-01', -1) === '2026-02-28');
ok('diffDays across a DST change is whole days', diffDays('2026-03-01', '2026-03-15') === 14 && diffDays('2026-11-01', '2026-11-08') === 7);
ok('weekStart is Monday (Sun maps back 6)', weekStart('2026-10-24') === '2026-10-19' && weekStart('2026-10-25') === '2026-10-19' && weekStart('2026-10-26') === '2026-10-26');
ok('weekDays returns Mon..Sun', weekDays('2026-10-21').join() === '2026-10-19,2026-10-20,2026-10-21,2026-10-22,2026-10-23,2026-10-24,2026-10-25');
ok('addMonths wraps years', addMonths('2026-12', 1) === '2027-01' && addMonths('2026-01', -1) === '2025-12');

// ---------- logging window: today any time, yesterday until noon ----------
_setFakeNow(new Date('2026-10-24T09:00:00').getTime());
ok('before noon: today and yesterday loggable', canLog('2026-10-24') && canLog('2026-10-23'));
ok('before noon: two days ago is locked', !canLog('2026-10-22'));
ok('future days are never loggable', !canLog('2026-10-25'));
_setFakeNow(new Date('2026-10-24T12:00:00').getTime());
ok('at noon sharp yesterday locks', !canLog('2026-10-23') && canLog('2026-10-24'));
_setFakeNow(new Date('2026-10-24T11:59:00').getTime());
ok('11:59 still open', canLog('2026-10-23'));

// ---------- first load: no v1, then with v1 present ----------
localStorage.clear();
_setFakeNow(new Date('2026-10-24T20:00:00').getTime());
let s = loadState();
ok('fresh install: startDate is today, no v1 offer', s.startDate === '2026-10-24' && s.ui.v1Offer === 'none');
localStorage.setItem('habitflow', JSON.stringify({ habits: [], user: {} }));
s = loadState();
ok('v1 data present on first run triggers the one-time offer', s.ui.v1Offer === 'pending');
S = s; save();
ok('second load reads gh2 (not rebuilt), keeping startDate', loadState().startDate === '2026-10-24');

// ---------- v1 import ----------
const v1 = {
  habits: [
    { id: 'hw', name: 'Workout', type: 'boolean' },
    { id: 'hp', name: 'Protein', type: 'numeric', target: 150 },
    { id: 'hs', name: 'Less Sugar', type: 'boolean' },
    { id: 'hx', name: 'Spend Less', type: 'boolean' },
  ],
  logs: {
    '2026-08-20': { hw: true, hp: 120 },
    '2026-08-21': { hp: 60 },
    '2026-08-22': { hx: true },
    '2026-10-03': { hw: true },
    '2026-10-24': { hw: true },            // same day as 2.0 start: must NOT come over
  },
  logEntries: { '2026-08-20': { hp: [40, { amt: 80, label: 'chicken rice', sugar: 3 }] } },
  restDayLogs: { '2026-08-22': { hw: true } },
  workoutExtras: { '2026-08-25': { cycle: true } },
  customWorkoutLogs: { '2026-08-26': { c1: { rounds: 4 } } },
  weight: { unit: 'lbs', goal: 180, logs: { '2026-08-01': 201.4, '2026-10-20': 199, '2026-10-24': 150 } },
  littleWins: [{ id: 'w', dateKey: '2026-08-30', tier: 'big', text: 'Finished the garage' }, { id: 'f', dateKey: '2026-10-25', text: 'future' }],
  habitPauseRanges: { hw: [{ from: '2026-10-02', to: '2026-10-04' }], hx: [{ from: '2026-09-01', to: '2026-09-02' }] },
  habitPauses: { hs: { since: '2026-10-10' } },
  sideQuests: [{ id: 'q' }], user: { xp: 9999, packsBank: 7, wishlistPoints: 120 },
};
let t = migrateState({}); t.startDate = '2026-10-24';
const counts = importV1(v1, t);
ok('workout day imported with kind=workout', t.days['2026-08-20'].workout && t.days['2026-08-20'].workout.kind === 'workout');
ok('rest-day exception imported as a rest day', t.days['2026-08-22'].workout && t.days['2026-08-22'].workout.kind === 'rest');
ok('cycle day becomes a Bike workout', t.days['2026-08-25'].workout.what === 'Bike');
ok('circuit day becomes a Circuit workout', t.days['2026-08-26'].workout.what === 'Circuit');
ok('protein entries become foods (plain number + labeled w/ sugar)', t.days['2026-08-20'].foods.length === 2 && t.days['2026-08-20'].foods[0].label === 'Manual entry' && t.days['2026-08-20'].foods[1].sugar === 3 && t.days['2026-08-20'].foods[1].protein === 80);
ok('a bare protein total becomes one Imported total', t.days['2026-08-21'].foods.length === 1 && t.days['2026-08-21'].foods[0].label === 'Imported total' && t.days['2026-08-21'].foods[0].protein === 60);
ok('"Spend Less" (not a 2.0 habit) is not imported anywhere', !t.days['2026-08-22'].foods.length);
ok('days on/after the 2.0 start date are skipped', !t.days['2026-10-24']);
ok('weights imported, same-day-or-later skipped', t.weight.logs['2026-08-01'] === 201.4 && t.weight.logs['2026-10-20'] === 199 && t.weight.logs['2026-10-24'] === undefined && counts.weights === 2);
ok('weight unit + goal carry over', t.weight.unit === 'lbs' && t.weight.goal === 180);
ok('little wins carry over as wins, future ones dropped', t.wins.length === 1 && t.wins[0].label === 'Finished the garage' && counts.wins === 1);
ok('v1 pause ranges for Workout carry over; Spend Less pause does not', t.pauses.some(p => p.habit === 'workout' && p.from === '2026-10-02' && p.to === '2026-10-04') && !t.pauses.some(p => p.from === '2026-09-01'));
ok('an open v1 pause on Less sugar is closed the day before 2.0 starts', t.pauses.some(p => p.habit === 'sugar' && p.from === '2026-10-10' && p.to === '2026-10-23'));
ok('XP/packs/wishlist/side quests are left behind (start fresh)', t.user === undefined && t.sideQuests === undefined && t.packsBank === undefined);
ok('comeback records the last v1 day and the gap', t.comeback && t.comeback.from === '2026-10-03' && t.comeback.gapDays === 20 && t.comeback.firstLog === null);
ok('import is stamped', t.imported && t.imported.from === 'v1' && t.imported.counts.workouts >= 3);
// v1's own storage is untouched
const before = JSON.stringify(v1);
importV1(v1, migrateState({}));
ok('importing never mutates the v1 object', JSON.stringify(v1) === before);

// robustness: garbage in
const g = migrateState({}); g.startDate = '2026-10-24';
let threw = false; try { importV1(null, g); importV1({}, g); importV1({ habits: [{ name: 'Protein', type: 'numeric', id: 'p' }], logs: { 'bad-key': { p: 1 }, '2026-01-01': null }, logEntries: { '2026-01-01': { p: [null, 'x', { amt: 'abc' }] } } }, g); } catch (e) { threw = true; console.log(e); }
ok('malformed v1 data never throws', !threw);

// doV1Import wiring through localStorage
localStorage.clear();
localStorage.setItem('habitflow', JSON.stringify(v1));
S = loadState();
ok('v1 offer is pending before import', S.ui.v1Offer === 'pending');
const c2 = doV1Import();
ok('doV1Import populates state and marks the offer done', S.ui.v1Offer === 'done' && c2.workouts >= 3 && Object.keys(S.weight.logs).length === 2);
ok('and persists it under gh2, leaving habitflow alone', JSON.parse(localStorage.getItem('gh2')).imported.from === 'v1' && JSON.parse(localStorage.getItem('habitflow')).user.packsBank === 7);
localStorage.clear();
S = loadState();
skipV1Import();
ok('skipping marks the offer done without importing', S.ui.v1Offer === 'done' && S.imported === null);
