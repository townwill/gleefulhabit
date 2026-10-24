const ok = (name, cond) => console.log(name + ':', !!cond);
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1 : e);
// Reset to a clean world with a fixed "now". startDate defaults to the very start so tests control it.
function world(now, start) { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = start || '2026-01-01'; }
// Write a day straight into state (bypasses the logging window; tests drive history).
const FOOD = (p, s) => [{ id: 'f' + p + s, label: 'food', protein: p, sugar: s, src: 'manual' }];
function setDay(dk, o) {
  S.days[dk] = {
    workout: o.w === 'workout' ? { kind: 'workout', what: 'Circuit', len: '20–40', hard: 'Solid' } : o.w === 'rest' ? { kind: 'rest' } : null,
    windDown: o.wind ? { what: ['Reading'], len: '10m', lights: '10:00' } : null,
    foods: o.p != null ? FOOD(o.p, o.s || 0) : [],
  };
}
const perfect = dk => setDay(dk, { w: 'workout', wind: true, p: 150, s: 5 });
function fillMonth(ym, fn) { for (let d = 1; d <= dim(ym); d++) fn(`${ym}-${pad(d)}`, d); }

// ================= Daily drip =================
world('2026-11-20T13:00:00');
fillMonth('2026-10', perfect);
let m = moneyFor('2026-10');
ok('perfect 31-day October drips exactly $100.00', m.dripC === 10000 && m.dripPotC === 10000);
ok('October share per day is $3.23, per habit $0.81', near(100 / 31 * 100, 323, 0.5) && near(100 / 31 / 4 * 100, 80.645, .01));
world('2026-12-20T13:00:00'); fillMonth('2026-11', perfect);
ok('perfect 30-day November drips exactly $100.00', moneyFor('2026-11').dripC === 10000);
world('2027-03-20T13:00:00'); fillMonth('2027-02', perfect);
ok('perfect 28-day February drips exactly $100.00', moneyFor('2027-02').dripC === 10000);
world('2028-03-20T13:00:00'); fillMonth('2028-02', perfect);
ok('perfect 29-day leap February drips exactly $100.00', moneyFor('2028-02').dripC === 10000);
world('2026-11-20T13:00:00');
setDay('2026-10-05', { w: 'workout' });
ok('one workout day pays one habit share (81¢ in October)', moneyFor('2026-10').dripC === 81);
setDay('2026-10-05', { w: 'rest' });
ok('a rest day pays $0 even though it is logged', moneyFor('2026-10').dripC === 0);
setDay('2026-10-05', { wind: true });
ok('wind-down pays a share', moneyFor('2026-10').dripC === 81);
setDay('2026-10-05', { p: 113, s: 30 });
ok('small protein (113 g) pays HALF a share (40¢; sugar over budget pays 0)', moneyFor('2026-10').dripC === 40);
setDay('2026-10-05', { p: 150, s: 30 });
ok('full protein pays a full share', moneyFor('2026-10').dripC === 81);
setDay('2026-10-05', { p: 20, s: 3 });
ok('logging any food within the sugar budget also earns the Less sugar share', moneyFor('2026-10').dripC === 81);
setDay('2026-10-05', { p: 112, s: 30 });
ok('112 g is below small and pays nothing', moneyFor('2026-10').dripC === 0);
setDay('2026-10-05', { p: 20, s: 25 });
ok('sugar at exactly 25 g pays once the day has closed (protein too low to pay)', moneyFor('2026-10').dripC === 81);
setDay('2026-10-05', { p: 20, s: 25.1 });
ok('sugar at 25.1 g pays nothing', moneyFor('2026-10').dripC === 0);
S.freeDays = ['2026-10-05'];
ok('a free day pays $0 for sugar even with 0 g', (setDay('2026-10-05', { p: 20, s: 0 }), moneyFor('2026-10').dripC === 0));
S.freeDays = [];
S.pauses.push({ id: 'p', habit: 'wind', from: '2026-10-05', to: '2026-10-05' });
ok('a paused habit pays $0 that day', (setDay('2026-10-05', { wind: true }), moneyFor('2026-10').dripC === 0));
S.pauses = [];
// sugar only pays when the day has closed
world('2026-10-21T21:00:00');
setDay('2026-10-21', { p: 20, s: 3 }); setDay('2026-10-20', { p: 20, s: 3 });
ok('today: sugar within budget has not paid yet; yesterday has (81¢)', moneyFor('2026-10').dripC === 81);
// days before the launch date never pay
world('2026-10-21T21:00:00', '2026-10-20');
setDay('2026-10-19', { w: 'workout' }); setDay('2026-10-20', { w: 'workout' });
ok('days before startDate pay nothing', moneyFor('2026-10').dripC === 81);
ok('partial first month is prorated: Oct 20-31 is 12 of 31 days of the pot', moneyFor('2026-10').dripPotC === Math.round(10000 * 12 / 31) && moneyFor('2026-10').poolPotC === Math.round(5000 * 12 / 31));

// ================= Fully logged week (+$2) =================
world('2026-11-20T13:00:00');
const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']; // Mon..Sun
WEEK.forEach(dk => setDay(dk, { w: 'rest', wind: true, p: 10, s: 0 }));
let ev = moneyFor('2026-10').events.filter(e => e.kind === 'week');
ok('every habit logged all 7 days (rest day counts as logged) pays $2 on the Sunday', ev.length === 1 && ev[0].dk === '2026-10-11' && ev[0].paidC === 200);
setDay('2026-10-08', { w: 'rest', wind: false, p: 10 });
ok('one missed log in the week -> no $2', moneyFor('2026-10').events.filter(e => e.kind === 'week').length === 0);
setDay('2026-10-08', { w: 'rest', wind: true, p: 10 });
S.pauses.push({ id: 'pw', habit: 'wind', from: '2026-10-08', to: '2026-10-08' });
setDay('2026-10-08', { w: 'rest', wind: false, p: 10 });
ok('a paused habit counts as logged for the week', moneyFor('2026-10').events.filter(e => e.kind === 'week').length === 1);
S.pauses = []; S.freeDays = ['2026-10-08']; setDay('2026-10-08', { w: 'rest', wind: true, p: 10 });
ok('a free day counts as logged for the week', moneyFor('2026-10').events.filter(e => e.kind === 'week').length === 1);
S.freeDays = [];
for (const h of ['workout', 'protein', 'wind', 'sugar']) WEEK.forEach(dk => { S.pauses.push({ id: 'x' + h + dk, habit: h, from: dk, to: dk, sick: h === 'protein' }); });
ok('a week with EVERYTHING paused pays nothing', moneyFor('2026-10').events.filter(e => e.kind === 'week').length === 0);
S.pauses = [];
world('2026-11-20T13:00:00', '2026-10-07'); WEEK.forEach(dk => setDay(dk, { w: 'rest', wind: true, p: 10, s: 0 }));
ok('the launch week (started mid-week) is not eligible', moneyFor('2026-10').events.filter(e => e.kind === 'week').length === 0);
// week spanning a month end is paid on its Sunday, in the Sunday's month
world('2026-12-20T13:00:00');
['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].forEach(dk => setDay(dk, { w: 'rest', wind: true, p: 10, s: 0 }));
ok('Oct 26-Nov 1 week pays in November (Sunday Nov 1), not October', moneyFor('2026-10').events.filter(e => e.kind === 'week').length === 0 && moneyFor('2026-11').events.filter(e => e.kind === 'week').length === 1);
world('2026-10-21T10:00:00');   // Wed: the current week is not over
['2026-10-19', '2026-10-20', '2026-10-21'].forEach(dk => setDay(dk, { w: 'rest', wind: true, p: 10, s: 0 }));
ok('an unfinished week pays nothing yet', moneyFor('2026-10').events.length === 0);

// ================= Extra workouts (+$3 past 3 a week) =================
world('2026-11-20T13:00:00');
['2026-10-05', '2026-10-06', '2026-10-07'].forEach(dk => setDay(dk, { w: 'workout' }));
ok('exactly 3 workouts: no bonus', moneyFor('2026-10').events.filter(e => e.kind === 'extra').length === 0);
setDay('2026-10-08', { w: 'workout' });
ev = moneyFor('2026-10').events.filter(e => e.kind === 'extra');
ok('4th workout earns $3 on its own day', ev.length === 1 && ev[0].dk === '2026-10-08' && ev[0].paidC === 300);
setDay('2026-10-09', { w: 'workout' }); setDay('2026-10-10', { w: 'rest' });
ev = moneyFor('2026-10').events.filter(e => e.kind === 'extra');
ok('5th workout earns another $3; the rest day does not count', ev.length === 2 && ev[1].dk === '2026-10-09');
// a week that spans the month end: 3 in Oct, 4th on Nov 1 pays in November
world('2026-12-20T13:00:00');
['2026-10-26', '2026-10-27', '2026-10-28', '2026-11-01'].forEach(dk => setDay(dk, { w: 'workout' }));
ok('the 4th workout of the week (Nov 1) pays in November', moneyFor('2026-10').events.filter(e => e.kind === 'extra').length === 0 && moneyFor('2026-11').events.filter(e => e.kind === 'extra').length === 1);

// ================= Welcome-back =================
const wbWorld = () => { world('2026-11-20T13:00:00'); };
const pauseWb = (from, to, extra) => S.pauses.push(Object.assign({ id: 'wb' + from, habit: 'wind', from, to, why: 'Travel' }, extra || {}));
wbWorld(); pauseWb('2026-10-05', '2026-10-05'); setDay('2026-10-06', { wind: true });
ok('back on day 2 (a 1-day pause): nothing', moneyFor('2026-10').events.filter(e => e.kind === 'back').length === 0);
wbWorld(); pauseWb('2026-10-05', '2026-10-05'); setDay('2026-10-06', { wind: true });
ok('back on day 2 of a pause: nothing', moneyFor('2026-10').events.filter(e => e.kind === 'back').length === 0);
wbWorld(); pauseWb('2026-10-05', '2026-10-07'); setDay('2026-10-08', { wind: true });
ev = moneyFor('2026-10').events.filter(e => e.kind === 'back');
ok('back on day 4 after a 3-day pause (day 3 offer grew to...) pays $4', ev.length === 1 && ev[0].paidC === 400 && ev[0].dk === '2026-10-08');
wbWorld(); pauseWb('2026-10-05', '2026-10-06'); setDay('2026-10-07', { wind: true });
ok('(day-3 boundary) pause Oct5-6, back Oct 7 = day 3 -> $3', (() => { const e = moneyFor('2026-10').events.filter(x => x.kind === 'back'); return e.length === 1 && e[0].paidC === 300; })());
ok('N=3 pays $3, N=4 pays $4, N=5 pays $5, N=9 stays capped at $5', welcomeBackC(2) === 0 && welcomeBackC(3) === 300 && welcomeBackC(4) === 400 && welcomeBackC(5) === 500 && welcomeBackC(9) === 500);
wbWorld(); pauseWb('2026-10-05', '2026-10-14'); setDay('2026-10-15', { wind: true });
ok('a 10-day pause caps at $5', moneyFor('2026-10').events.filter(e => e.kind === 'back')[0].paidC === 500);
wbWorld(); pauseWb('2026-10-05', '2026-10-09', { habit: 'workout' }); setDay('2026-10-10', { w: 'rest' }); setDay('2026-10-11', { w: 'workout' });
ev = moneyFor('2026-10').events.filter(e => e.kind === 'back');
ok('paid when the habit is actually logged: a rest day does not count as resuming, the next workout does', ev.length === 1 && ev[0].dk === '2026-10-11');
wbWorld(); pauseWb('2026-10-05', '2026-10-09');
ok('resumed but never logged again: nothing is paid', moneyFor('2026-10').events.filter(e => e.kind === 'back').length === 0);
wbWorld(); S.pauses.push({ id: 'o', habit: 'wind', from: '2026-10-05', to: null }); setDay('2026-10-20', { wind: true });
ok('an open pause pays nothing yet', moneyFor('2026-10').events.filter(e => e.kind === 'back').length === 0);
wbWorld(); pauseWb('2026-10-05', '2026-10-10', { imp: true }); setDay('2026-10-11', { wind: true });
ok('imported v1 pauses never pay', moneyFor('2026-10').events.filter(e => e.kind === 'back').length === 0);
// sick day: one bonus per sick day, not per habit
wbWorld();
S.pauses.push({ id: 's1', habit: 'workout', from: '2026-10-05', to: '2026-10-08', sick: true, sickId: 'sd', why: 'Sick or hurt' });
S.pauses.push({ id: 's2', habit: 'protein', from: '2026-10-05', to: '2026-10-07', sick: true, sickId: 'sd', why: 'Sick or hurt' });
setDay('2026-10-08', { p: 100 }); setDay('2026-10-09', { w: 'workout', p: 100 });
ev = moneyFor('2026-10').events.filter(e => e.kind === 'back');
ok('sick day: ONE welcome-back for the Workout+Protein pair, paid at the earliest resume', ev.length === 1 && ev[0].dk === '2026-10-08');
// pause spanning month end
wbWorld();
pauseWb('2026-10-29', '2026-11-03'); setDay('2026-11-04', { wind: true });
ev = moneyFor('2026-11').events.filter(e => e.kind === 'back');
ok('pause across the month end: N=7 -> $5 paid in November, nothing in October', ev.length === 1 && ev[0].paidC === 500 && ev[0].dk === '2026-11-04' && moneyFor('2026-10').events.length === 0);
setDay('2026-10-30', { wind: true });   // data sitting on a paused day must not pay
ok('...paused days pay no drip even if data exists on them; the return day pays 100/30/4 = 83c in November', moneyFor('2026-10').dripC === 0 && moneyFor('2026-11').dripC === 83);

// ================= Bonus pool cap =================
world('2026-12-20T13:00:00');
// 4 weeks of 7 workouts + wind etc: each week 4 extras (12.00) + full week (2.00) = 14 -> 4 weeks = 56 > 50
const octWeeks = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
fillMonth('2026-10', dk => setDay(dk, { w: 'workout', wind: true, p: 150, s: 0 }));
m = moneyFor('2026-10');
const poolRaw = bonusEvents().filter(e => ymOf(e.dk) === '2026-10').reduce((a, e) => a + e.cents, 0);
ok('uncapped bonuses exceed $50 in this month', poolRaw > 5000);
ok('the pool can never pay more than $50 a month', m.poolC === 5000 && m.poolC <= m.poolPotC);
ok('the paid events add up to exactly the capped $50', m.events.reduce((a, e) => a + e.paidC, 0) === 5000);
const cut = m.events.findIndex(e => e.paidC < e.cents);
ok('exactly where the cap bites, one event is trimmed and every later event pays $0', cut >= 0 && m.events.slice(cut + 1).every(e => e.paidC === 0) && m.events.slice(0, cut).every(e => e.paidC === e.cents));
ok('raw bonuses were $54 (16 extras x $3 + 3 full weeks x $2), so $4 was lost to the cap', poolRaw === 5400);
ok('total unlocked never exceeds $150', m.unlockedC <= 15000 && m.unlockedC === m.dripC + m.poolC);
ok('a fully perfect month (all workouts, all weeks) unlocks exactly $150', m.unlockedC === 15000);

// ================= Spend + balance + rollover =================
world('2026-10-21T21:00:00', '2026-10-01');
fillMonth('2026-10', (dk, d) => { if (d <= 20) setDay(dk, { w: 'workout', wind: true, p: 150, s: 0 }); });
m = moneyNow();
const expect = Math.round(100 / 31 * 20 * 100);
ok('20 perfect days of October = 20/31 of the drip', near(m.dripC, expect, 1));
ok('balance = unlocked - spent', m.balanceC === m.unlockedC - m.spentC && m.spentC === 0);
ok('spending requires a category and a positive amount', addSpend(0, 'LEGO') === false && addSpend(500, 'Nope') === false);
const before = balanceC();
ok('spending $10 on LEGO works', addSpend(1000, 'LEGO') === true && balanceC() === before - 1000 && S.spends.length === 1);
ok('cannot spend more than the unlocked balance', addSpend(balanceC() + 1, 'Cards') === false && S.spends.length === 1);
ok('the subline numbers: unlocked and spent', moneyNow().spentC === 1000 && moneyNow().unlockedC === m.unlockedC);
ok('today\'s spend is dated today', S.spends[0].dk === '2026-10-21');
// month rollover
world('2026-11-01T09:00:00', '2026-10-01');
fillMonth('2026-10', (dk, d) => { if (d <= 20) setDay(dk, { w: 'workout', wind: true, p: 150, s: 0 }); });
S.spends.push({ id: 's', dk: '2026-10-15', cents: 2000, cat: 'LEGO' });
closeMonths();
ok('before noon on the 1st the last day is still editable: October stays open', !(S.months['2026-10'] && S.months['2026-10'].closed));
_setFakeNow(new Date('2026-11-01T12:00:00').getTime());
closeMonths();
const oct = S.months['2026-10'];
ok('after noon on the 1st October closes', oct && oct.closed === true);
ok('closed snapshot records unlocked, spent and savings', oct.unlockedC > 0 && oct.spentC === 2000 && oct.savingsC === oct.potC - oct.unlockedC && oct.potC === 15000);
ok('unearned money rolls to savings (record only)', savingsTotalC() === oct.savingsC && oct.savingsC === 15000 - oct.unlockedC && oct.savingsC > 4000);
const frozen = oct.dripC;
S.settings.drip = 50; S.days['2026-10-02'] = { workout: null, windDown: null, foods: [] };
ok('a closed month is frozen: later settings/data changes do not rewrite it', moneyFor('2026-10').dripC === frozen);
const net = oct.unlockedC - oct.spentC;
ok('unspent earnings carry into November: balance = October net + November unlocked - spent', moneyNow().carryC === net && moneyNow().balanceC === net + moneyNow().unlockedC - moneyNow().spentC);
S.settings.drip = 100;
ok('closing twice is idempotent', (closeMonths(), Object.keys(S.months).length === 1));
ok('cannot delete a spend from a closed month', deleteSpend('s') === false && S.spends.length === 1);
S.spends.push({ id: 's2', dk: '2026-11-01', cents: 100, cat: 'Other' });
ok('can delete this month\'s spend', deleteSpend('s2') === true && S.spends.length === 1);
// multi-month gap (app unopened for months) closes each month in order
world('2027-02-10T10:00:00', '2026-10-01');
fillMonth('2026-10', (dk) => setDay(dk, { w: 'workout', wind: true, p: 150, s: 0 }));
closeMonths();
ok('opening after a long gap closes every finished month in order', ['2026-10', '2026-11', '2026-12', '2027-01'].every(k => S.months[k] && S.months[k].closed) && !S.months['2027-02']);
ok('empty months close with $0 earned and the full pot as savings', S.months['2026-11'].unlockedC === 0 && S.months['2026-11'].savingsC === 15000);
ok('balance after the gap = only what October earned', moneyNow().balanceC === S.months['2026-10'].unlockedC);

// ================= Today model + rendering =================
world('2026-10-21T21:00:00', '2026-10-01');
setDay('2026-10-21', { w: 'workout', wind: true, p: 150, s: 4 }); setDay('2026-10-20', { w: 'workout', wind: true, p: 150, s: 4 });
let threw = null; try { render(); openSpend(); spPick(2); closeSheet(); } catch (e) { threw = e; console.log(e); }
ok('Today renders with the real money model', !threw && todayHTML().includes('to spend') && todayHTML().includes('of $150 unlocked'));
const logged = logWorkout('2026-10-21', { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' });
ok('logging reports what it just earned', logged && lastEarnedC === 0 /* already a workout day: no change */);
S.days['2026-10-21'].workout = null;
logWorkout('2026-10-21', { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' });
ok('...and a fresh workout earns the 81¢ share', lastEarnedC === 81 && earnedTxt() === ' · +$0.81');
