// Packs: earned from workouts only, one a day, bonus for all five planned sessions.
const ok = (name, cond) => console.log(name + ':', !!cond);
const fresh = (now) => { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); closeSheet(); OV = null; TAB = 'rewards'; };
const seed = dk => { S.days[dk] = Object.assign(S.days[dk] || { workout: null, windDown: null, foods: [] }, { workout: { kind: 'workout', what: 'Bike', len: '20–40', hard: 'Solid', at: 1 } }); };

fresh('2026-12-06T20:00:00'); // Sunday end of plan week 1
ok('no workouts, no packs', packsEarned() === 0 && packsOwed() === 0 && openPack() === false);
seed('2026-11-30');
ok('one workout is one pack', packsEarned() === 1 && packsOwed() === 1);
seed('2026-11-30');
ok('the same day twice is still one pack', packsEarned() === 1);
S.days['2026-11-29'] = { workout: { kind: 'workout', what: 'Bike', len: '20–40', hard: 'Solid', at: 1 }, windDown: null, foods: [] };
ok('a workout before launch (30 Nov) earns nothing', packsEarned() === 1);
S.days['2026-12-03'] = { workout: { kind: 'rest' }, windDown: null, foods: [] };
ok('a logged rest day earns nothing', packsEarned() === 1);
seed('2026-12-03');
S.days['2026-12-03'].workout = { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy', at: 1 };
ok('a workout on a rest day (Thu) still earns a pack', packsEarned() === 2);
ok('...but does not count towards the five planned sessions', plannedDone(weekStart('2026-12-03')) === 1);
['2026-12-01', '2026-12-02', '2026-12-04'].forEach(seed);
ok('four planned + the Thursday extra: 5 workouts, still no bonus', packsEarned() === 5 && packsThisWeek().planned === 4 && packsThisWeek().bonus === false && bonusWeeks().length === 0);
seed('2026-12-06');
ok('all five planned (Mon Tue Wed Fri Sun) earn the bonus pack: 6 workouts + 1', packsThisWeek().planned === 5 && packsThisWeek().bonus === true && packsEarned() === 7);
ok('packsThisWeek counts every workout this week', packsThisWeek().workouts === 6);

// ---- opening ----
ok('opening spends one pack and logs the time', openPack() === true && S.packs.opened === 1 && S.packs.log.length === 1 && packsOwed() === 6);
for (let i = 0; i < 6; i++) openPack();
ok('you can open them all and no more', packsOwed() === 0 && S.packs.opened === 7 && openPack() === false && S.packs.opened === 7);
ok('undo puts one back', undoPack() === true && S.packs.opened === 6 && packsOwed() === 1 && S.packs.log.length === 6);
S.packs.opened = 0; S.packs.log = [];
ok('undo with nothing opened does nothing', undoPack() === false && S.packs.opened === 0);

// ---- removing a workout takes its pack away (derived, not stored) ----
S.packs.opened = 7; S.packs.log = [1, 2, 3, 4, 5, 6, 7];
delete S.days['2026-12-06'].workout;
ok('deleting a workout after opening: the owed count floors at 0, never negative', packsOwed() === 0 && packsEarned() === 5);

// ---- nothing else earns ----
fresh('2026-12-06T20:00:00');
S.days['2026-12-01'] = { workout: null, windDown: { what: ['Reading'], len: '20m', lights: '10:00' }, foods: [{ id: 'a', label: 'x', protein: 200, sugar: 0, src: 'manual' }] };
S.sleep['2026-12-01'] = 480; S.wins.push({ id: 'w', dk: '2026-12-01', label: 'Calm', other: false, at: 1 });
ok('protein, wind down, sleep and little wins never earn a pack', packsEarned() === 0);

// ---- a second week ----
fresh('2026-12-13T20:00:00');
['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-11', '2026-12-13'].forEach(seed);
ok('the bonus works in any plan week (week of 7 Dec): 5 + 1 bonus', bonusWeeks().join() === '2026-12-07' && packsEarned() === 6);
ok('a bonus for a future week is not counted early', (fresh('2026-12-09T12:00:00'), ['2026-12-07', '2026-12-08', '2026-12-09'].forEach(seed), bonusWeeks().length === 0 && packsEarned() === 3));

// ---- through the real finish path, then the rewards tab ----
fresh('2026-12-01T18:00:00'); startSession('2026-12-01'); finishSession();
ok('finishing a session earns a pack', packsOwed() === 1);
const html = rewardsTabHTML();
ok('the Rewards tab shows a pack to open', /Open/.test(html) && /class="[^"]*token/.test(html));
ok('...and no dollar amounts anywhere', !/\$\d/.test(html));
