const ok = (name, cond) => console.log(name + ':', !!cond);
function world(now, start) { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = start || '2026-10-01'; closeSheet(); }
const ANS = { why: 'Travel', expect: 'About a week', planned: 'Saw it coming', back: 'The bonus' };
const FOOD = (p, s) => [{ id: 'f' + p + s, label: 'food', protein: p, sugar: s, src: 'manual' }];
function setDay(dk, o) {
  S.days[dk] = { workout: o.w === 'workout' ? { kind: 'workout', what: 'Circuit', len: '20–40', hard: 'Solid' } : o.w === 'rest' ? { kind: 'rest' } : null,
    windDown: o.wind ? { what: ['Reading'], len: '10m', lights: '10:00' } : null, foods: o.p != null ? FOOD(o.p, o.s || 0) : [] };
}

// ================= Pause =================
world('2026-10-24T13:00:00');
ok('Protein can never be paused on its own', pauseHabit('protein', ANS).err && !S.pauses.length);
ok('the check-in needs all four answers', pauseHabit('wind', { why: 'Travel' }).err === 'Answer all four questions' && !S.pauses.length);
for (const k of ['why', 'expect', 'planned', 'back']) { const a = Object.assign({}, ANS); delete a[k]; if (!pauseHabit('wind', a).err) console.log('accepted without', k); }
ok('missing any single answer is rejected', !S.pauses.length);
let r = pauseHabit('wind', ANS);
ok('a complete check-in pauses the habit from today', r.ok && S.pauses.length === 1 && S.pauses[0].from === '2026-10-24' && S.pauses[0].to === null && S.pauses[0].why === 'Travel' && S.pauses[0].back === 'The bonus' && S.pauses[0].sick === false);
ok('it is greyed: state is paused, day 1', habitState('wind', '2026-10-24').st === 'paused');
ok('pausing again is rejected', pauseHabit('wind', ANS).err === 'Already paused');
ok('a paused habit keeps its history (past logs untouched)', (setDay('2026-10-20', { wind: true }), habitState('wind', '2026-10-20').st === 'done'));
world('2026-10-24T13:00:00'); logWind('2026-10-24', { what: ['LEGO'], len: '10m', lights: '9:30' });
ok('cannot pause a habit you already logged today', pauseHabit('wind', ANS).err === 'Wind down is already logged today');
world('2026-10-24T13:00:00'); S.freeDays = ['2026-10-24'];
ok('cannot pause Less sugar on a free day', pauseHabit('sugar', ANS).err === 'Today is a free day');
world('2026-10-24T13:00:00');
pauseHabit('workout', ANS); pauseHabit('sugar', ANS);
ok('Workout and Less sugar pause independently of Wind down', habitState('workout', '2026-10-24').st === 'paused' && habitState('sugar', '2026-10-24').st === 'paused' && habitState('wind', '2026-10-24').st === 'none');

// resume
ok('resuming a same-day pause leaves no record', (resumeHabit('workout'), !S.pauses.some(p => p.habit === 'workout')));
S.pauses.find(p => p.habit === 'sugar').from = '2026-10-20';
resumeHabit('sugar');
ok('resuming an older pause closes it yesterday and keeps the paused days', S.pauses[0].to === '2026-10-23' && habitState('sugar', '2026-10-22').st === 'paused' && habitState('sugar', '2026-10-24').st !== 'paused');

// ================= Welcome-back offer =================
world('2026-10-24T13:00:00');
const mk = (from) => { S.pauses = [{ id: 'w', habit: 'wind', from, to: null, why: 'Travel' }]; };
mk('2026-10-24'); ok('day 1: no offer', welcomeOfferC('wind') === 0);
mk('2026-10-23'); ok('day 2: no offer', welcomeOfferC('wind') === 0);
mk('2026-10-22'); ok('day 3: +$3', welcomeOfferC('wind') === 300);
mk('2026-10-21'); ok('day 4: +$4', welcomeOfferC('wind') === 400);
mk('2026-10-20'); ok('day 5: +$5', welcomeOfferC('wind') === 500);
mk('2026-10-01'); ok('day 24: still capped at $5', welcomeOfferC('wind') === 500);
mk('2026-10-22'); S.pauses[0].imp = true; ok('imported pauses never offer', welcomeOfferC('wind') === 0);
// the offer is trimmed by whatever is left in the month's pool
world('2026-10-24T13:00:00', '2026-10-01');
for (let d = 1; d <= 23; d++) setDay(`2026-10-${pad(d)}`, { w: 'workout', wind: true, p: 150, s: 0 });
const poolNow = moneyNow().bonusC;
ok('(setup) a strong month already banked $37 of the pool', poolNow === 3700);
S.settings.pool = 39;   // leave only $2 of pool so the welcome-back offer has to be trimmed
S.pauses = [{ id: 'w', habit: 'wind', from: '2026-10-20', to: null, why: 'Travel' }];
S.days['2026-10-20'].windDown = null; S.days['2026-10-21'].windDown = null; S.days['2026-10-22'].windDown = null; S.days['2026-10-23'].windDown = null;
const left = poolLeftC();
ok('the offer never exceeds what the pool has left ($2.00 of a $5 offer)', left === 200 && welcomeOfferC('wind') === 200);
// rendering the hint on a paused row
world('2026-10-24T13:00:00');
S.pauses = [{ id: 'w', habit: 'workout', from: '2026-10-21', to: null, why: 'Travel' }];
let html = habitRowHTML(todayModel().habits[0]);
ok('paused row shows "Paused · day 4" and the live offer', html.includes('Paused · day 4') && html.includes('+$4 today'));
ok('paused row offers Resume, not Pause', html.includes('>Resume<') && !html.includes('>Pause<'));
ok('tapping a paused row opens the paused sheet (no throw)', (() => { try { openPausedSheet('workout'); closeSheet(); return true; } catch (e) { console.log(e); return false; } })());

// ================= Sick day =================
world('2026-10-24T13:00:00');
r = sickDay();
ok('Sick day pauses Workout and Protein together in one tap', r.ok && S.pauses.length === 2 && S.pauses.map(p => p.habit).sort().join() === 'protein,workout');
ok('...recorded as Sick, no survey answers, linked by sickId', S.pauses.every(p => p.sick && p.why === 'Sick or hurt' && p.expect === null && p.back === null) && S.pauses[0].sickId === S.pauses[1].sickId);
ok('Wind down and Less sugar keep running', habitState('wind', '2026-10-24').st === 'none' && habitState('sugar', '2026-10-24').st === 'none');
ok('Protein shows as paused on a sick day and exposes Resume', habitState('protein', '2026-10-24').st === 'paused' && todayModel().habits[1].pausable === true);
ok('Sick day button flips to "Feeling better"', todayHTML().includes('Feeling better') && !todayHTML().includes('>Sick day<'));
ok('a second tap while sick is rejected by the engine', sickDay().err === 'Already on a sick day');
logWind('2026-10-24', { what: ['Reading'], len: '10m', lights: '10:00' });
ok('logging Wind down while sick still works and pays', habitState('wind', '2026-10-24').st === 'done');
resumeSick();
ok('Feeling better ends both pauses (same-day -> no records)', S.pauses.length === 0 && !sickActive());
// logged habit starts its pause tomorrow
world('2026-10-24T13:00:00');
logWorkout('2026-10-24', { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' });
sickDay();
const wp = S.pauses.find(p => p.habit === 'workout'), pp = S.pauses.find(p => p.habit === 'protein');
ok('a habit already logged today keeps today and pauses from tomorrow', wp.from === '2026-10-25' && pp.from === '2026-10-24' && habitState('workout', '2026-10-24').st === 'done');
// nothing left to pause
world('2026-10-24T13:00:00');
logWorkout('2026-10-24', { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' }); addFood('2026-10-24', { label: 'x', protein: 10 });
ok('sick day with both already logged still schedules tomorrow (never silently ignored)', sickDay().ok === true && S.pauses.every(p => p.from === '2026-10-25'));
// a multi-day sick spell, back at day 4, pays one bonus
world('2026-10-24T13:00:00');
S.pauses.push({ id: 'a', habit: 'workout', from: '2026-10-20', to: '2026-10-22', sick: true, sickId: 'z', why: 'Sick or hurt' }, { id: 'b', habit: 'protein', from: '2026-10-20', to: '2026-10-22', sick: true, sickId: 'z', why: 'Sick or hurt' });
setDay('2026-10-23', { p: 100, w: 'workout' });
const evs = moneyFor('2026-10').events.filter(e => e.kind === 'back');
ok('welcome-back after a 3-day sick spell: ONE bonus, $4 (back on day 4)', evs.length === 1 && evs[0].paidC === 400);

// ================= Free days =================
world('2026-10-24T13:00:00');
ok('a free day cannot be added for today', addFreeDay('2026-10-24') === 'Free days must be set in advance — tomorrow or later');
ok('...or for the past', addFreeDay('2026-10-20') === 'Free days must be set in advance — tomorrow or later');
ok('tomorrow works', addFreeDay('2026-10-25') === null && S.freeDays.join() === '2026-10-25');
ok('no duplicates', addFreeDay('2026-10-25') === 'That day is already free');
ok('garbage dates are rejected', addFreeDay('nope') === 'Pick a date' && addFreeDay('2026-02-31') === 'Pick a date' && addFreeDay('') === 'Pick a date');
for (let i = 0; i < 9; i++) addFreeDay(`2026-12-${pad(10 + i)}`);
ok('10 free days used in 2026', freeDaysUsed(2026) === 10 && freeDaysLeft(2026) === 0);
ok('an 11th in the same year is refused', addFreeDay('2026-12-30') === 'No free days left for 2026' && S.freeDays.length === 10);
ok('the allowance is per calendar year: 2027 is fresh', addFreeDay('2027-01-01') === null && freeDaysLeft(2027) === 9);
ok('a future free day can be removed (and the slot returns)', removeFreeDay('2026-12-10') === true && freeDaysLeft(2026) === 1);
ok('a past or today free day can never be removed', (S.freeDays.push('2026-10-24'), removeFreeDay('2026-10-24') === false));
S.freeDays = ['2026-10-25'];
ok('the calendar marks future free days', calendarCells('2026-10').find(c => c.n === 25).cls.includes('fr'));
ok('a free day pays nothing and breaks nothing: sugar st=free, day still counts as logged', (_setFakeNow(new Date('2026-10-26T10:00:00').getTime()), habitState('sugar', '2026-10-25').st === 'free' && habitState('sugar', '2026-10-25').share === 0));

// ================= Pause trends =================
world('2026-10-24T13:00:00');
S.pauses = [
  { id: '1', habit: 'wind', from: '2026-10-01', to: '2026-10-04', why: 'Work stress', back: 'A daily nudge', expect: 'About a week', planned: 'Caught me off guard' },
  { id: '2', habit: 'wind', from: '2026-10-08', to: '2026-10-09', why: 'Work stress', back: 'A daily nudge', expect: '1–2 days', planned: 'Saw it coming' },
  { id: '3', habit: 'workout', from: '2026-10-12', to: '2026-10-14', why: 'Travel', back: 'The bonus', expect: 'Not sure', planned: 'Saw it coming' },
  { id: '4', habit: 'workout', from: '2026-10-16', to: '2026-10-17', why: 'Sick or hurt', sick: true, sickId: 'k', back: null },
  { id: '5', habit: 'protein', from: '2026-10-16', to: '2026-10-18', why: 'Sick or hurt', sick: true, sickId: 'k', back: null },
  { id: '6', habit: 'sugar', from: '2026-10-22', to: null, why: 'Just worn out', back: 'Just time' },
  { id: 'imp', habit: 'wind', from: '2026-08-01', to: '2026-08-05', why: 'Imported', imp: true },
];
setDay('2026-10-05', { wind: true });                         // came back after #1
setDay('2026-10-10', { wind: true });                         // came back after #2
setDay('2026-10-15', { w: 'workout' });                       // came back after #3
// the sick spell (#4/#5) never came back
let st = pauseStats();
ok('a sick pair counts as ONE pause; imported pauses are excluded', st.count === 5);
ok('average length counts open pauses up to today (4,2,3,3,3 days)', st.avgLen === Math.round((4 + 2 + 3 + 3 + 3) / 5 * 10) / 10 || st.avgLen === 3.1);
ok('return rate = came back / ended: 3 of 4 ended pauses', st.ended === 4 && st.returned === 3 && Math.abs(st.returnRate - 0.75) < 1e-9);
ok('reasons ranked by count', st.reasons[0].why === 'Work stress' && st.reasons[0].n === 2);
ok('days-to-come-back by reason: Work stress came back on day 5 and day 3 -> avg 4', st.reasons[0].avgBack === 4);
ok('which habits pause most: wind 2, workout 2 (incl. sick), protein 1...', st.habits.find(h => h.h === 'wind').n === 2 && st.habits.find(h => h.h === 'workout').n === 2);
ok('plain-language note names the top reason, habit, length and return rate', /work stress/.test(st.note) && /3 of 4/.test(st.note) && /daily nudge/.test(st.note));
world('2026-10-24T13:00:00');
ok('no pauses: a calm, honest note', pauseStats().count === 0 && pauseStats().returnRate === null && /No pauses yet/.test(pauseStats().note));

// ================= rendering =================
world('2026-10-24T13:00:00');
let threw = null; try { onPauseTap('workout'); pzPick_why(1); pzPick_expect(0); pzPick_planned(1); pzPick_back(2); pzSave(); render(); onSickDay(); render(); onSickDay(); render(); } catch (e) { threw = e; console.log(e); }
ok('pause sheet flow + sick day toggle render without throwing', !threw);
ok('...and the pause actually landed', S.pauses.some(p => p.habit === 'workout' && p.why === 'Work stress' && p.back === 'The bonus'));
