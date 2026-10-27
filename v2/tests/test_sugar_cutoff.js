// Less sugar settles at 10pm (shows checked and pays) instead of waiting for midnight.
const ok = (name, cond) => console.log(name + ':', !!cond);
const at = (hm, extra) => { localStorage.clear(); _setFakeNow(new Date('2026-10-26T' + hm + ':00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; };
const put = (sugar, n) => { S.days[todayKey()] = { workout: null, windDown: null, foods: [{ id: 'a', label: 'x', protein: 20, sugar, src: 'manual' }].concat(n ? [{ id: 'b', label: 'y', protein: 1, sugar: n, src: 'manual' }] : []) }; };
const sg = () => habitState('sugar', todayKey());
const earned = () => dripFor('2026-10');

at('21:59'); put(5);
ok('9:59pm: under budget but still "ok" (not settled, pays nothing yet)', sg().st === 'ok' && sg().share === 0);
const before = earned();
at('22:00'); put(5);
ok('10:00pm: it settles — done, full share, you can see it checked', sg().st === 'done' && sg().share === 1);
ok('...and the day pays its Less sugar share now (not at midnight)', earned() > before + 0.5);
at('23:30'); put(5);
ok('11:30pm: still done', sg().st === 'done');
at('22:30'); put(20, 10);
ok('30 g logged after 10pm puts you over budget: it shows over, no free pass', sg().st === 'over' && sg().share === 0);
at('22:30'); S.days[todayKey()] = { workout: null, windDown: null, foods: [] };
ok('nothing logged: never settles into a check', sg().st === 'none' && sg().share === 0);
at('22:30'); put(5); S.freeDays = []; S.freeDays.push('2026-10-26');
ok('a free day is still a free day', sg().st === 'free');
at('12:00'); put(5);
ok('the Today card tells you it checks at 10pm', subFor('sugar', sg(), todayKey()).includes('checks at 10pm'));
at('22:10'); put(5);
ok('after 10pm the card says it settled', subFor('sugar', sg(), todayKey()).includes('settled at 10pm'));
at('13:00'); S.days['2026-10-25'] = { workout: null, windDown: null, foods: [{ id: 'z', label: 'p', protein: 30, sugar: 3, src: 'manual' }] };
ok('yesterday is unchanged: done', habitState('sugar', '2026-10-25').st === 'done');
ok('Today still renders at 10pm', (at('22:15'), put(5), todayHTML().length > 100));
