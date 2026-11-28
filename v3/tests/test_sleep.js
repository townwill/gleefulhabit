// Sleep: manual entry, locked days, weekly average, the Sleep habit.
const ok = (name, cond) => console.log(name + ':', !!cond);
const fresh = (now) => { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; TAB = 'sleep'; };

fresh('2026-12-02T08:00:00'); // Wed morning
ok('no entry: the Sleep habit is not done', habitState('sleep', '2026-12-02').st === 'none');
ok('logging last night saves minutes by wake date', setSleep('2026-12-02', 415) === true && S.sleep['2026-12-02'] === 415);
ok('...and ticks the Sleep habit', habitState('sleep', '2026-12-02').st === 'done');
ok('a very short night is still logged (any logged night counts)', setSleep('2026-12-02', 120) === true && habitState('sleep', '2026-12-02').st === 'done');
ok('zero minutes is allowed (never slept)', setSleep('2026-12-02', 0) === true && S.sleep['2026-12-02'] === 0);
ok('impossible values are refused', setSleep('2026-12-02', -5) === false && setSleep('2026-12-02', 99999) === false && setSleep('2026-12-02', 'abc') === false && S.sleep['2026-12-02'] === 0);
ok('minutes are rounded to whole numbers', (setSleep('2026-12-02', 400.6), S.sleep['2026-12-02'] === 401));
ok('yesterday is still editable this morning', setSleep('2026-12-01', 380) === true);
ok('two days ago is locked', setSleep('2025-12-02', 380) === false && !('2025-12-02' in S.sleep));
ok('tomorrow is locked', setSleep('2026-12-03', 380) === false);
ok('a night can be cleared', clearSleep('2026-12-02') === true && !('2026-12-02' in S.sleep) && habitState('sleep', '2026-12-02').st === 'none');
ok('clearing a night that was never logged does nothing', clearSleep('2026-12-02') === false);
_setFakeNow(new Date('2026-12-02T13:00:00').getTime());
ok('after noon, yesterday locks', setSleep('2026-12-01', 300) === false && S.sleep['2026-12-01'] === 380 && clearSleep('2026-12-01') === false);

// ---- the weekly view ----
fresh('2026-12-06T09:00:00'); // Sunday
S.sleep = { '2026-11-30': 360, '2026-12-01': 420, '2026-12-03': 300, '2026-12-05': 480 };
const w = sleepWeek('2026-11-30');
ok('a week lists seven days, Mon to Sun', w.days.length === 7 && w.days[0].dk === '2026-11-30' && w.days[6].dk === '2026-12-06');
ok('the average is over the nights that were logged', w.n === 4 && w.avg === 390 && w.days[2].mins === null);
ok('an empty week has no average, not zero', sleepWeek('2026-12-07').avg === null && sleepWeek('2026-12-07').n === 0);
ok('goal is more than 6 hours: 360 min', SLEEP_GOAL_MIN === 360 && fmtHM(390) === '6h 30m' && fmtHM(65) === '1h 05m');

// ---- tab render ----
const html = sleepTabHTML();
ok('the Sleep tab renders, with the picker and the week', /sleep/i.test(html) && html.length > 500);
ok('...with no typing field (tap-only)', !/<input[^>]*type="(text|number)"/.test(html));

// ---- Sleep can pause; Protein cannot pause ----
fresh('2026-12-02T10:00:00');
ok('Sleep is pausable, Protein is not', PAUSABLE.includes('sleep') && !PAUSABLE.includes('protein'));
