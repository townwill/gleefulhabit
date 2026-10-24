const ok = (name, cond) => console.log(name + ':', !!cond);
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((a, k2) => (a[k2] = x[k2], a), {}) : x);
function world(now, start) { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = start || '2026-10-01'; closeSheet(); OV = null; }

// ---- a rich state touching every collection ----
world('2026-11-20T13:00:00');
S.days['2026-10-10'] = { workout: { kind: 'workout', what: 'Kettlebell', len: '20–40', hard: 'Hard' }, windDown: { what: ['Reading', 'LEGO'], len: '30m', lights: '10:00' }, foods: [{ id: 'a', label: 'Chicken', protein: 150, sugar: 4, src: 'ai' }] };
S.pauses = [{ id: 'p1', habit: 'wind', from: '2026-10-12', to: '2026-10-15', why: 'Travel', expect: 'About a week', planned: 'Saw it coming', back: 'The bonus', sick: false }, { id: 'p2', habit: 'protein', from: '2026-10-20', to: null, why: 'Sick or hurt', sick: true, sickId: 'z' }];
S.freeDays = ['2026-12-25', '2026-11-26']; S.spends = [{ id: 's', dk: '2026-10-15', cents: 1250, cat: 'LEGO' }]; S.wins = [{ id: 'w', dk: '2026-10-10', label: 'Cooked dinner', other: false }];
S.weight.logs = { '2026-10-01': 201.5, '2026-10-08': 200.2 }; S.weight.goal = 185;
S.comeback = { from: '2026-09-01', gapDays: 30, firstLog: '2026-10-10' }; S.imported = { at: '2026-10-01', from: 'v1', counts: { workouts: 3 } };
closeMonths();
ok('(setup) October closed into a month snapshot', S.months['2026-10'] && S.months['2026-10'].closed);
localStorage.setItem('gh_ai_key', 'sk-ant-SECRET-KEY');
localStorage.setItem('gh_food_history', '[1,2]');

// ---- export ----
const exp = exportObject();
const text = JSON.stringify(exp);
ok('export carries the schema, every collection and a timestamp + version', exp.schema === 2 && ['days', 'pauses', 'freeDays', 'spends', 'wins', 'weight', 'months', 'comeback', 'imported', 'settings'].every(k => k in exp) && exp.appVersion === APP_VERSION && exp.exportedAt);
ok('the AI key never leaves in a backup', !text.includes('SECRET') && !text.includes('sk-ant'));
ok('exporting does not mutate live state', !('exportedAt' in S) && !('appVersion' in S));

// ---- round trip ----
const original = canon(S);
S = blankState();
const res = applyBackup(JSON.parse(text));
ok('a 2.0 backup restores', res.ok && res.msg === 'Backup restored');
ok('...every field identical after the round trip (days, pauses, free days, spends, wins, weight, months, comeback, import stamp)', canon(S) === original);
ok('...and money is the same', moneyFor('2026-10').closed === true && S.months['2026-10'].dripC === JSON.parse(text).months['2026-10'].dripC);
ok('the restored state was saved under gh2', canon(JSON.parse(localStorage.getItem('gh2'))) === original);
ok('the key is still on the device after a restore', localStorage.getItem('gh_ai_key') === 'sk-ant-SECRET-KEY');
ok('export fields are stripped, not kept in state', !('exportedAt' in S) && !('appVersion' in S));

// ---- older / sparse 2.0 backups get defaults, never crash ----
let r = applyBackup({ schema: 2 });
ok('a bare {schema:2} backup restores to a usable state', r.ok && Array.isArray(S.pauses) && S.settings.drip === 100 && !!S.startDate);
r = applyBackup({ schema: 2, days: { '2026-10-01': {} }, startDate: '2026-10-01', weight: { logs: { '2026-10-01': 200 } } });
ok('missing sub-fields are filled (a day with no foods array)', r.ok && Array.isArray(S.days['2026-10-01'].foods) && S.weight.unit === 'lbs');

// ---- rejects junk ----
const keep = canon(S);
for (const junk of [null, 5, 'x', [], {}, { schema: 3 }, { habits: 'no' }]) { const x = applyBackup(junk); if (x.ok) console.log('accepted junk', junk); }
ok('junk files are rejected with a friendly message and change nothing', applyBackup({}).ok === false && /isn.t a GleefulHabit backup/.test(applyBackup(null).msg) && canon(S) === keep);

// ---- v1 backup -> adds history, never money ----
world('2026-10-24T13:00:00', '2026-10-24');
S.days['2026-10-24'] = { workout: { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' }, windDown: null, foods: [] };
const v1 = { habits: [{ id: 'hw', name: 'Workout', type: 'boolean' }, { id: 'hp', name: 'Protein', type: 'numeric' }], user: { xp: 5000 },
  logs: { '2026-09-10': { hw: true, hp: 140 }, '2026-10-24': { hw: true } }, logEntries: { '2026-09-10': { hp: [{ amt: 140, label: 'steak', sugar: 1 }] } },
  weight: { unit: 'lbs', logs: { '2026-09-10': 205 } }, littleWins: [{ id: 'x', dateKey: '2026-09-11', text: 'Nice' }] };
ok('v1 backups are recognised, 2.0 ones are not', isV1Backup(v1) && !isV1Backup({ schema: 2, habits: [], user: {} }) && !isV1Backup({}));
const beforeMoney = canon(moneyNow());
r = applyBackup(v1);
ok('a v1 backup adds history without replacing what is here', r.ok && /1 workouts/.test(r.msg) && S.days['2026-09-10'].workout.kind === 'workout' && S.days['2026-10-24'].workout.what === 'Yoga');
ok('...today and later are skipped, weight and wins come over', !S.days['2026-10-24'].foods.length && S.weight.logs['2026-09-10'] === 205 && S.wins.some(w => w.label === 'Nice'));
ok('...money is not affected by imported history', canon(moneyNow()) === beforeMoney);
ok('...XP and other v1 reward data are not carried', !('user' in S) && !('xp' in S));

// ---- first-launch offer ----
world('2026-10-24T13:00:00', '2026-10-24');
localStorage.setItem('habitflow', JSON.stringify(v1));
S = loadState();
ok('first launch with v1 data on the phone queues the offer', S.ui.v1Offer === 'pending');
maybeOfferV1();
ok('the offer sheet opens with the real counts', SH && SH.kind === 'v1' && document.getElementById('sheetRoot').innerHTML.includes('Welcome to 2.0') && document.getElementById('sheetRoot').innerHTML.includes('2 logged days'));
v1Yes();
ok('"Bring my history" imports and settles the offer', S.ui.v1Offer === 'done' && S.imported && S.days['2026-09-10'] && SH === null);
ok('v1 stays exactly as it was', JSON.parse(localStorage.getItem('habitflow')).user.xp === 5000);
ok('the offer is not repeated on the next launch', (S = loadState(), maybeOfferV1(), SH === null));
world('2026-10-24T13:00:00', '2026-10-24');
localStorage.setItem('habitflow', JSON.stringify(v1)); S = loadState(); maybeOfferV1(); v1No();
ok('"Start fresh" settles the offer without importing', S.ui.v1Offer === 'done' && S.imported === null && !S.days['2026-09-10']);
ok('...and the backup page can still bring v1 over later', backupHTML().includes('Bring over my v1 history'));
world('2026-10-24T13:00:00', '2026-10-24');
localStorage.setItem('habitflow', JSON.stringify({ habits: [], user: {} })); S = loadState(); maybeOfferV1();
ok('an empty v1 save never nags: the offer is settled silently', S.ui.v1Offer === 'done' && SH === null);

// ---- rendering ----
world('2026-10-24T13:00:00');
let threw = null; try { openHistory(); renderHistoryOver(); closeOver(); } catch (e) { threw = e; console.log(e); }
ok('History with the backup card renders', !threw && backupHTML().includes('Export') && backupHTML().includes('Import') && backupHTML().includes(APP_VERSION));
