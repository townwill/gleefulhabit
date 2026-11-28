// Workout plan, session flow, lift progression, rest timer.
const ok = (name, cond) => console.log(name + ':', !!cond);
const fresh = (now) => { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); closeSheet(); OV = null; TAB = 'workout'; REST = null; };

// ---- the weekly plan ----
fresh('2026-12-01T10:00:00');
const kinds = ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'].map(d => planFor(d).kind).join();
ok('Mon strength, Tue bike, Wed strength, Thu rest, Fri bike, Sat rest, Sun bike', kinds === 'strength,bike,strength,rest,bike,rest,bike');
ok('only Sunday is the wild card', planFor('2026-12-06').wild === true && !planFor('2026-12-01').wild);
ok('plan week 1 is the week of 30 Nov; week 2 starts 7 Dec', planFor('2026-11-30').week === 1 && planFor('2026-12-06').week === 1 && planFor('2026-12-07').week === 2 && planFor('2026-12-28').week === 5);
ok('the bike target starts at 25 min, +5 a week, stops at 50', [1, 2, 3, 4, 5, 6, 7, 20].map(bikeTarget).join() === '25,30,35,40,45,50,50,50');
ok('lift targets read plainly', liftTarget('goblet') === '10 reps · 26 lb kettlebell' && liftTarget('bench') === '8 reps · 20 lb each hand' && liftTarget('hang') === '15 sec' && liftTarget('carry') === '30 sec · 26 lb each hand' && liftTarget('row') === '10 reps per side · 20 lb');
ok('progression: +1 rep; at 12 reps +5 lb and back to 8; hang/carry +5 sec', progressLift('goblet', { reps: 10, lb: 26 }).reps === 11 && JSON.stringify(progressLift('goblet', { reps: 12, lb: 26 })) === JSON.stringify({ reps: 8, lb: 31 }) && progressLift('hang', { secs: 15 }).secs === 20 && progressLift('carry', { secs: 30, lb: 26 }).secs === 35 && progressLift('carry', { secs: 30, lb: 26 }).lb === 26);
ok('progressLift never changes the original', (() => { const l = { reps: 10, lb: 26 }; progressLift('goblet', l); return l.reps === 10; })());

// ---- a bike session ----
fresh('2026-12-01T18:00:00'); // Tue, plan week 1
ok('Tue starts a bike session with the week-1 target', startSession('2026-12-01') === true && S.training.cur.kind === 'bike' && S.training.cur.mins === 25);
ok('a second start is refused while one is in progress', startSession('2026-12-01') === false);
bikeAdj(5); bikeAdj(-100);
ok('bike minutes adjust in steps and never go below 5', S.training.cur.mins === 5);
bikeAdj(30);
let r = finishSession();
ok('finishing a bike session ticks the Workout habit, with the minutes', r.ok && habitState('workout', '2026-12-01').st === 'done' && S.days['2026-12-01'].workout.plan === 'bike' && S.days['2026-12-01'].workout.mins === 35 && S.days['2026-12-01'].workout.len === '20–40');
ok('...clears the session, logs it, and a bike day never touches the lifts', S.training.cur === null && S.training.log.length === 1 && S.training.log[0].mins === 35 && S.training.lifts.goblet.reps === 10);
ok('finishing with nothing in progress is a no-op', finishSession().ok === false);

// ---- Sunday wild card defaults to 30 ----
fresh('2026-12-06T10:00:00');
startSession('2026-12-06');
ok('Sunday is a bike day with a 30-minute default (wild card)', S.training.cur.kind === 'bike' && S.training.cur.mins === 30);

// ---- rest days ----
fresh('2026-12-03T10:00:00'); // Thu
ok('a planned rest day (Thu) shows Workout as rest, not missed', habitState('workout', '2026-12-03').st === 'rest' && habitState('workout', '2026-12-03').share === 0);
ok('...and cannot start a session', startSession('2026-12-03') === false && S.training.cur === null);
fresh('2026-11-26T10:00:00'); // Thursday before launch
ok('before launch a Thursday is just an ordinary day', habitState('workout', '2026-11-26').st !== 'rest');

// ---- strength session: weeks 1-2 hold ----
fresh('2026-11-30T09:00:00'); // Mon, week 1
startSession('2026-11-30');
ok('a strength session starts with six warm-ups ticks and 3 sets of every lift', S.training.cur.kind === 'strength' && S.training.cur.warm.length === 6 && LIFTS.every(l => S.training.cur.sets[l.id].length === 3) && S.training.cur.mins === 0);
warmToggle(0); ok('a warm-up ticks on', S.training.cur.warm[0] === true); warmToggle(0); ok('...and off again', S.training.cur.warm[0] === false);
setToggle('goblet', 0);
ok('ticking a set starts the rest timer at the saved rest length', REST && REST.total === 90 && REST.done === false && S.training.cur.sets.goblet[0] === true);
setToggle('goblet', 0);
ok('unticking a set does not start a timer', S.training.cur.sets.goblet[0] === false);
LIFTS.forEach(l => [0, 1, 2].forEach(i => { S.training.cur.sets[l.id][i] = true; }));
_setFakeNow(new Date('2026-11-30T09:50:00').getTime());
r = finishSession();
ok('week 1: everything done, the Workout habit ticks, but the targets hold', r.ok && r.hit.length === 6 && r.progressed.length === 0 && S.training.lifts.goblet.reps === 10 && habitState('workout', '2026-11-30').st === 'done');
ok('...with 18 sets and the elapsed minutes recorded', S.days['2026-11-30'].workout.sets === 18 && S.days['2026-11-30'].workout.mins === 50 && S.days['2026-11-30'].workout.plan === 'strength');

// ---- week 3: progression only for lifts whose three sets were all ticked ----
fresh('2026-12-14T09:00:00'); // Mon of plan week 3
ok('2026-12-14 is plan week 3', planFor('2026-12-14').week === 3);
startSession('2026-12-14');
[0, 1, 2].forEach(i => { S.training.cur.sets.goblet[i] = true; S.training.cur.sets.hang[i] = true; });
S.training.cur.sets.bench[0] = true; S.training.cur.sets.bench[1] = true;      // bench: only two sets
r = finishSession();
ok('week 3: only lifts with all three sets go up', r.progressed.sort().join() === 'goblet,hang' && S.training.lifts.goblet.reps === 11 && S.training.lifts.hang.secs === 20 && S.training.lifts.bench.reps === 8 && S.training.lifts.row.reps === 10);
ok('a partly done session still counts as a workout', habitState('workout', '2026-12-14').st === 'done' && S.days['2026-12-14'].workout.sets === 8);
fresh('2026-12-14T09:00:00'); S.training.lifts.goblet = { reps: 12, lb: 26 }; startSession('2026-12-14'); S.training.cur.sets.goblet = [true, true, true]; finishSession();
ok('at 12 reps the kettlebell goes up 5 lb and reps drop back to 8', S.training.lifts.goblet.reps === 8 && S.training.lifts.goblet.lb === 31);

// ---- cancel, stale and locked ----
fresh('2026-12-01T10:00:00'); startSession('2026-12-01'); cancelSession();
ok('cancelling throws the session away without logging', S.training.cur === null && !S.days['2026-12-01']);
fresh('2026-12-01T10:00:00'); S.training.cur = { dk: '2026-11-30', kind: 'strength', at: 1, warm: [], mins: 0, sets: {} };
ok('a session left over from another day is dropped when a new one starts', startSession('2026-12-01') === true && S.training.cur.dk === '2026-12-01');
fresh('2026-12-05T10:00:00');
ok('a day that is locked (3 days ago) cannot start a session', startSession('2026-12-02') === false);

// ---- rest timer ----
fresh('2026-12-01T10:00:00');
startRest();
ok('startRest uses the saved rest time', REST.total === 90 && restLeft() === 90);
_setFakeNow(new Date('2026-12-01T10:00:30').getTime()); restTick();
ok('it counts down', restLeft() === 60 && REST.done === false);
restAdjust(15);
ok('+15 s lengthens the running timer and is remembered', restLeft() === 75 && S.training.restSec === 105);
for (let i = 0; i < 40; i++) restAdjust(-15);
ok('the saved rest length stays between 30 s and 5 min', S.training.restSec === 30);
for (let i = 0; i < 40; i++) restAdjust(15);
ok('...upper limit 300 s', S.training.restSec === 300);
_setFakeNow(new Date('2026-12-01T10:05:00').getTime()); restTick();
ok('at zero it flips to done once (chime + "Go")', REST.done === true);
restSkip();
ok('skip clears it', REST === null);
