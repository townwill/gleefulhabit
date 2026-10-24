const ok = (name, cond) => console.log(name + ':', !!cond);
const fresh = (now) => { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = '2026-10-01'; };

// ---------- Workout ----------
fresh('2026-10-21T10:00:00'); // Wed
ok('nothing logged -> none', habitState('workout', '2026-10-21').st === 'none');
ok('logging a workout is done and pays a full share', (logWorkout('2026-10-21', { kind: 'workout', what: 'Circuit', len: '20–40', hard: 'Solid' }), habitState('workout', '2026-10-21').st === 'done' && habitState('workout', '2026-10-21').share === 1));
ok('rest day logs but pays nothing', (logWorkout('2026-10-20', { kind: 'rest' }), habitState('workout', '2026-10-20').st === 'rest' && habitState('workout', '2026-10-20').share === 0 && habitState('workout', '2026-10-20').logged));
ok('"N of 3 this week" counts workouts only, not rest days', weekWorkouts('2026-10-21') === 1);
S.days['2026-10-19'] = { workout: { kind: 'workout', what: 'Bike', len: '40–60', hard: 'Hard' }, windDown: null, foods: [] };   // Monday is locked by now; seed it directly
ok('week count goes to 2 (Mon + Wed, Tue was rest)', weekWorkouts('2026-10-22') === 2 && weekWorkouts('2026-10-26') === 0);
clearWorkout('2026-10-21');
ok('removing a log clears it', habitState('workout', '2026-10-21').st === 'none');

// ---------- Logging window ----------
fresh('2026-10-21T09:00:00');
ok('yesterday is editable before noon', logWorkout('2026-10-20', { kind: 'rest' }) === true);
ok('two days ago is locked', logWorkout('2026-10-19', { kind: 'rest' }) === false && !S.days['2026-10-19']);
ok('future day is locked', logWorkout('2026-10-22', { kind: 'rest' }) === false);
_setFakeNow(new Date('2026-10-21T13:00:00').getTime());
ok('after noon yesterday locks for every write', logWorkout('2026-10-20', { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' }) === false && addFood('2026-10-20', { protein: 30 }) === false && logWind('2026-10-20', { what: ['LEGO'], len: '10m', lights: '9:30' }) === false);
ok('...and locked days cannot be cleared', (clearWorkout('2026-10-20'), S.days['2026-10-20'].workout.kind === 'rest'));

// ---------- Wind down ----------
fresh('2026-10-21T20:00:00');
ok('wind down not logged -> none', habitState('wind', '2026-10-21').st === 'none');
logWind('2026-10-21', { what: ['Reading', 'LEGO'], len: '20m', lights: '10:00' });
ok('any logged wind-down (min 10m) is done', habitState('wind', '2026-10-21').st === 'done' && S.days['2026-10-21'].windDown.what.length === 2);
const w = S.days['2026-10-21'].windDown;
ok('lights-out is stored (for the later history link)', w.lights === '10:00');

// ---------- Protein ----------
fresh('2026-10-21T12:00:00');
const d = '2026-10-21';
ok('no food -> none, not logged', habitState('protein', d).st === 'none' && !habitState('protein', d).logged);
addFood(d, { label: 'eggs', protein: 100, sugar: 0 });
ok('100 g is below small (113)', habitState('protein', d).st === 'none' && habitState('protein', d).logged && smallAt() === 113);
addFood(d, { label: 'shake', protein: 13, sugar: 4 });
ok('113 g is small and pays half', habitState('protein', d).st === 'small' && habitState('protein', d).share === .5);
addFood(d, { label: 'chicken', protein: 37, sugar: 0 });
ok('150 g is done and pays full', habitState('protein', d).st === 'done' && habitState('protein', d).share === 1 && proteinOn(d) === 150);
ok('rejects an entry with no protein', addFood(d, { protein: 0 }) === false && foodsOn(d).length === 3);
ok('negative sugar is clamped to 0', (addFood(d, { label: 'x', protein: 5, sugar: -9 }), foodsOn(d)[3].sugar === 0));
const id = foodsOn(d)[0].id;
updateFood(d, id, { protein: 90, label: 'egg whites' });
ok('editing an entry updates totals', proteinOn(d) === 145 && foodsOn(d)[0].label === 'egg whites');
deleteFood(d, id);
ok('deleting an entry updates totals', foodsOn(d).length === 3 && proteinOn(d) === 55);

// ---------- Less sugar ----------
fresh('2026-10-21T21:00:00');
ok('no foods logged -> none (an empty day never pays)', habitState('sugar', '2026-10-21').st === 'none' && !habitState('sugar', '2026-10-21').logged);
addFood('2026-10-21', { label: 'yogurt', protein: 20, sugar: 12 });
let sg = habitState('sugar', '2026-10-21');
ok('under budget today -> ok but pays nothing until the day closes', sg.st === 'ok' && sg.share === 0 && sg.val === 12);
addFood('2026-10-21', { label: 'cookie', protein: 3, sugar: 13 });
ok('exactly 25 g is within budget', habitState('sugar', '2026-10-21').st === 'ok');
addFood('2026-10-21', { label: 'soda', protein: 1, sugar: 0.1 });
ok('25.1 g is over budget, pays nothing', habitState('sugar', '2026-10-21').st === 'over' && habitState('sugar', '2026-10-21').share === 0);
// the day closing
S.days['2026-10-20'] = { workout: null, windDown: null, foods: [{ id: 'a', label: 'oats', protein: 10, sugar: 8, src: 'manual' }] };
ok('a closed day within budget is done and pays a full share', habitState('sugar', '2026-10-20').st === 'done' && habitState('sugar', '2026-10-20').share === 1);
S.days['2026-10-19'] = { workout: null, windDown: null, foods: [{ id: 'b', label: 'cake', protein: 4, sugar: 40, src: 'manual' }] };
ok('a closed day over budget is over, pays nothing', habitState('sugar', '2026-10-19').st === 'over');
S.freeDays = ['2026-10-18'];
ok('a free day: budget off, pays nothing, counts as logged', habitState('sugar', '2026-10-18').st === 'free' && habitState('sugar', '2026-10-18').share === 0 && habitState('sugar', '2026-10-18').logged);
S.days['2026-10-18'] = { workout: null, windDown: null, foods: [{ id: 'c', label: 'birthday cake', protein: 4, sugar: 90, src: 'manual' }] };
ok('a free day with 90 g sugar is still free (nothing breaks)', habitState('sugar', '2026-10-18').st === 'free');

// ---------- Pause semantics + auto-resume on log ----------
fresh('2026-10-21T10:00:00');
S.pauses.push({ id: 'p1', habit: 'workout', from: '2026-10-19', to: null, why: 'Travel' });
ok('an open pause covers today', habitState('workout', '2026-10-21').st === 'paused');
ok('a paused habit counts as logged but pays nothing', habitState('workout', '2026-10-21').logged && habitState('workout', '2026-10-21').share === 0);
ok('days before the pause are unaffected', habitState('workout', '2026-10-18').st === 'none');
logWorkout('2026-10-21', { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy' });
ok('logging resumes the pause: it now ends yesterday', S.pauses[0].to === '2026-10-20' && habitState('workout', '2026-10-21').st === 'done' && habitState('workout', '2026-10-20').st === 'paused');
fresh('2026-10-21T10:00:00');
S.pauses.push({ id: 'p2', habit: 'wind', from: '2026-10-21', to: null, why: 'Work stress' });
logWind('2026-10-21', { what: ['Reading'], len: '10m', lights: '9:30' });
ok('a pause that started today and is resumed today leaves no stub', S.pauses.length === 0);
fresh('2026-10-21T10:00:00');
S.pauses.push({ id: 'p3', habit: 'protein', from: '2026-10-20', to: null, sick: true, sickId: 's1', why: 'Sick or hurt' });
addFood('2026-10-21', { label: 'soup', protein: 10 });
ok('logging food resumes a sick-day Protein pause', S.pauses[0].to === '2026-10-20');

// ---------- Calendar levels ----------
fresh('2026-10-21T10:00:00');
S.startDate = '2026-10-10';
const day = '2026-10-15';
ok('days before any data are blank (not missed)', dayLevel('2026-10-05') === '');
ok('a past day with nothing logged is missed', dayLevel('2026-10-12') === 'miss');
ok('future days are empty', dayLevel('2026-10-30') === 'fut');
logWorkout(day, { kind: 'rest' }); // locked? use direct writes for past days
S.days[day] = { workout: { kind: 'workout' }, windDown: { what: ['LEGO'], len: '10m', lights: '9:30' }, foods: [{ id: 'z', label: 'f', protein: 150, sugar: 5, src: 'manual' }] };
ok('all four done -> full', dayLevel(day) === 'full');
S.days[day].windDown = null;
ok('three of four -> partial', dayLevel(day) === 'part');
S.days[day] = { workout: { kind: 'rest' }, windDown: { what: ['LEGO'], len: '10m', lights: '9:30' }, foods: [{ id: 'z', label: 'f', protein: 150, sugar: 5, src: 'manual' }] };
ok('a rest day does not stop a full day', dayLevel(day) === 'full');
S.days[day] = { workout: null, windDown: null, foods: [{ id: 'z', label: 'f', protein: 120, sugar: 5, src: 'manual' }] };
ok('small protein + sugar ok -> partial', dayLevel(day) === 'part');
S.pauses.push({ id: 'pp', habit: 'wind', from: '2026-10-15', to: '2026-10-15' }, { id: 'pq', habit: 'workout', from: '2026-10-15', to: '2026-10-15' });
S.days[day] = { workout: null, windDown: null, foods: [{ id: 'z', label: 'f', protein: 150, sugar: 5, src: 'manual' }] };
ok('paused habits are left out of the day: the other two done -> full', dayLevel(day) === 'full');
ok('imported history before startDate still colors (first data date)', (S.days['2026-09-01'] = { workout: { kind: 'workout', imp: true }, windDown: null, foods: [] }, dayLevel('2026-09-02') === 'miss' && dayLevel('2026-09-01') !== ''));

// ---------- Quick chips + tag ----------
fresh('2026-10-21T10:00:00');
S.days['2026-10-10'] = { workout: null, windDown: null, foods: [{ id: '1', label: 'Greek yogurt', protein: 20, sugar: 4 }, { id: '2', label: 'Chicken', protein: 40, sugar: 0 }, { id: '3', label: 'Manual entry', protein: 30 }] };
S.days['2026-10-11'] = { workout: null, windDown: null, foods: [{ id: '4', label: 'greek yogurt', protein: 22, sugar: 5 }, { id: '5', label: 'Shake', protein: 25, sugar: 9, imp: true }] };
const chips = quickChips(8);
ok('chips rank by most-logged, case-insensitive, latest grams win', chips[0].label.toLowerCase() === 'greek yogurt' && chips[0].n === 2 && chips[0].protein === 22);
ok('chips skip "Manual entry" and imported entries', !chips.some(c => /manual/i.test(c.label)) && !chips.some(c => c.label === 'Shake'));
ok('High protein, low sugar: >=20 g protein and <=5 g sugar', isHPLS({ protein: 20, sugar: 5 }) && !isHPLS({ protein: 19, sugar: 0 }) && !isHPLS({ protein: 40, sugar: 5.1 }));

// ---------- Comeback ----------
fresh('2026-10-21T10:00:00');
S.comeback = { from: '2026-10-03', gapDays: 17, firstLog: null };
logWorkout('2026-10-21', { kind: 'rest' });
ok('the first 2.0 log records the comeback', S.comeback.firstLog === '2026-10-21');
logWind('2026-10-21', { what: ['LEGO'], len: '10m', lights: '9:30' });
ok('later logs leave it alone', S.comeback.firstLog === '2026-10-21');

// ---------- Rendering never throws ----------
fresh('2026-10-21T10:00:00');
S.days['2026-10-21'] = { workout: { kind: 'workout', what: 'Circuit' }, windDown: { what: ['Reading'], len: '10m', lights: '9:30' }, foods: [{ id: 'q', label: 'Chicken <b>', protein: 40, sugar: 0 }] };
let threw = null;
try { render(); openProtein(); renderProteinOver(); openWorkoutSheet(); openWindSheet(); openFoodEdit('q'); closeSheet(); closeOver(); } catch (e) { threw = e; console.log(e); }
ok('render + every sheet/overlay builds without throwing', !threw);
ok('food names are HTML-escaped', !proteinOverHTML.toString().includes('x') || (OV = 'protein', protDay = '2026-10-21', proteinOverHTML().includes('Chicken &lt;b&gt;') && !proteinOverHTML().includes('Chicken <b>')));
const m = todayModel();
ok('today model has 4 habit rows + a calendar for the month', m.habits.length === 4 && m.cells.length === 31 && m.monthLabel === 'October' && m.monthStartDow === 3);
ok('only Workout/Wind/Sugar get a Pause control; Protein only when paused by sick', m.habits.map(h => h.pausable).join() === 'true,false,true,true');
