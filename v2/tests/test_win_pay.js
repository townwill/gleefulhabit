// Little wins pay 50¢ each from the bonus pool, the first 3 a day.
const ok = (name, cond) => console.log(name + ':', !!cond);
function world(now) { localStorage.clear(); _setFakeNow(new Date(now || '2026-10-24T13:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; }
const wins = () => moneyFor('2026-10').events.filter(e => e.kind === 'win');
world();
ok('no wins, no win money', wins().length === 0 && moneyFor('2026-10').poolC === 0);
addWin('2026-10-24', 'Walked the dog', false);
ok('one win = 50¢ in the bonus pool, on that day', wins().length === 1 && wins()[0].cents === 50 && wins()[0].paidC === 50 && wins()[0].dk === '2026-10-24' && moneyFor('2026-10').poolC === 50);
ok('...and it shows in the balance', moneyNow().balanceC >= 50);
addWin('2026-10-24', 'Cooked dinner', false); addWin('2026-10-24', 'Stayed calm', false); addWin('2026-10-24', 'Tidied up', false); addWin('2026-10-24', 'Got outside', false);
ok('5 wins in one day: only the first 3 pay ($1.50)', wins().length === 3 && moneyFor('2026-10').poolC === 150);
_setFakeNow(new Date('2026-10-24T09:00:00').getTime());
addWin('2026-10-23', 'Called a friend', false);
ok('yesterday (before noon) counts on its own day, its own 3', wins().length === 4 && wins().filter(e => e.dk === '2026-10-23').length === 1 && moneyFor('2026-10').poolC === 200);
deleteWin(S.wins[0].id);
ok('deleting a win takes its 50¢ back (money is derived); a 4th win on that day starts paying', wins().filter(e => e.dk === '2026-10-24').length === 3 && moneyFor('2026-10').poolC === 200);
S.wins.push({ id: 'old', dk: '2026-09-20', label: 'before launch', other: false, at: 1 });
ok('a win from before your start date never pays', wins().every(e => e.dk >= '2026-10-01'));
S.wins.push({ id: 'fut', dk: '2026-10-30', label: 'future', other: false, at: 1 });
ok('a win dated in the future never pays', wins().every(e => e.dk <= '2026-10-24'));
// the $50 pool cap
world('2026-10-25T13:00:00');
for (let d = 1; d <= 25; d++) for (let i = 0; i < 3; i++) S.wins.push({ id: 'w' + d + i, dk: '2026-10-' + String(d).padStart(2, '0'), label: 'x', other: false, at: d * 10 + i });
const m = moneyFor('2026-10');
ok('75 wins = $37.50 but the pool is prorated; nothing ever pays past the pool', m.poolC <= m.poolPotC && m.poolC === Math.min(3750, m.poolPotC));
ok('wins pay only from the pool; the daily drip is untouched', m.dripC === moneyFor('2026-10').dripC && m.unlockedC === m.dripC + m.poolC);
// it sits alongside the other bonuses
world();
for (const dk of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) S.days[dk] = { workout: { kind: 'workout', what: ['Walk'], len: '30', hard: false, at: 1 }, windDown: null, foods: [] };
addWin('2026-10-24', 'Got outside', false);
const kinds = moneyFor('2026-10').events.map(e => e.kind).sort().join();
ok('wins sit alongside extra-workout bonuses (kinds: extra + win)', /extra/.test(kinds) && /win/.test(kinds));
// close the month: the win money is frozen in
world('2026-11-02T10:00:00'); S.startDate = '2026-10-01';
S.wins.push({ id: 'a', dk: '2026-10-05', label: 'x', other: false, at: 1 }, { id: 'b', dk: '2026-10-06', label: 'y', other: false, at: 2 });
closeMonths(); const frozen = S.months['2026-10'];
ok('when the month closes, win money is frozen with it', frozen && frozen.closed && frozen.poolC === 100 && frozen.events.filter(e => e.kind === 'win').length === 2);
S.wins.push({ id: 'c', dk: '2026-10-07', label: 'late', other: false, at: 3 });
ok('...and a later edit cannot change a closed month', moneyFor('2026-10').poolC === 100);
// UI
world(); openWin('2026-10-24');
ok('the Win sheet says what a win pays', document.getElementById('sheetRoot').innerHTML.includes('Each win adds $0.50') && document.getElementById('sheetRoot').innerHTML.includes('first 3 a day'));
winPick(0);
ok('tapping a win says "+$0.50"', document.getElementById('toast').textContent === 'Win logged · +$0.50');
openWin('2026-10-24'); winPick(1); openWin('2026-10-24'); winPick(2); openWin('2026-10-24'); winPick(3);
ok('the 4th win that day says only "Win logged" (it no longer pays)', document.getElementById('toast').textContent === 'Win logged' && S.wins.length === 4);
ok('Today still has exactly 4 habits', todayModel().habits.length === 4);
