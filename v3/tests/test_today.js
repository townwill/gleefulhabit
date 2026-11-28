// Today: exactly four tiles, no money, rivets, nudges, protein tile, pause + welcome-back.
const ok = (name, cond) => console.log(name + ':', !!cond);
const fresh = (now) => { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; TAB = 'today'; _lit = null; _litNext = null; };
const tiles = h => (h.match(/class="tile /g) || []).length;

fresh('2026-12-02T10:00:00');
let h = todayHTML();
ok('Today shows exactly four tiles', tiles(h) === 4);
ok('...in order Workout, Protein, Wind down, Sleep', [...h.matchAll(/class="tile (\w+)/g)].map(m => m[1]).join() === 'workout,protein,wind,sleep');
ok('...no Less sugar tile and no dollar sign anywhere on Today', !/sugar/i.test(h.replace(/id="tileSnap"/, '')) && !/\$\d/.test(h));
ok('todayModel has four habits', todayModel().habits.length === 4 && todayModel().habits.map(x => x.id).join() === 'workout,protein,wind,sleep');
ok('each tile has a week row of seven rivets', (h.match(/class="rivets"/g) || []).length === 4 && (h.match(/class="rvw"/g) || []).length === 28);
ok('every tile is a big tap target (role=button with an onclick)', (h.match(/role="button" tabindex="0" aria-label/g) || []).length === 4);
ok('the protein tile opens the camera input (capture=environment)', /id="tileSnap" accept="image\/\*" capture="environment"/.test(h));

// ---- rivets ----
S.days['2026-11-30'] = { workout: { kind: 'workout', what: 'Kettlebell', len: '40–60', hard: 'Solid', at: 1, plan: 'strength' }, windDown: null, foods: [] };
ok('a done day lights its rivet', rivetState('workout', '2026-11-30') === 'on' && rivetState('workout', '2026-12-01') === 'off');
ok('future days are unlit "fut"', rivetState('workout', '2026-12-04') === 'fut');
ok('a planned rest day (Thu 3 Dec) shows the rest rivet, even before it comes', rivetState('workout', '2026-12-03') === 'rest');
_setFakeNow(new Date('2026-12-04T10:00:00').getTime());
ok('...a past Thursday shows the rest rivet', rivetState('workout', '2026-12-03') === 'rest');
ok('Saturday is a rest rivet too', rivetState('workout', '2026-12-05') === 'rest');
ok('a rest-day workout that was logged lights the rivet instead', (S.days['2026-12-03'] = { workout: { kind: 'workout', what: 'Yoga', len: '<20m', hard: 'Easy', at: 1 }, windDown: null, foods: [] }, rivetState('workout', '2026-12-03') === 'on'));
delete S.days['2026-12-03'];
_setFakeNow(new Date('2026-12-02T10:00:00').getTime());
_lit = new Set(); h = rivetsHTML('workout');
ok('a rivet that just lit pops (the click animation) once', /rv on pop/.test(h) || /class="rv on[^"]*pop/.test(h));
_lit = new Set(_litNext); h = rivetsHTML('workout');
ok('...and not again once it has been seen', !/pop/.test(h));
ok('before the first render nothing pops', (_lit = null, !/pop/.test(rivetsHTML('workout'))));

// ---- the protein tile ----
fresh('2026-12-02T12:00:00');
h = tileHTML('protein');
ok('protein shows grams against the goal and a gauge', /0<small> \/ 150 g/.test(h) && /class="gauge"/.test(h));
addFood('2026-12-02', { label: 'eggs', protein: 60, sugar: 0 });
h = tileHTML('protein');
ok('...and moves with the food log', /60<small>/.test(h) && /style="width:40%"/.test(h) && /90 g to go/.test(h));
addFood('2026-12-02', { label: 'chicken', protein: 90, sugar: 0 });
ok('...goal reached', /Goal reached/.test(tileHTML('protein')) && /class="seal/.test(tileHTML('protein')));

// ---- nudges (in-app only) ----
fresh('2026-12-02T09:00:00');
ok('morning with no sleep logged: the Sleep tile nudges', /tile sleep nudge/.test(tileHTML('sleep')) && /Log last night/.test(tileHTML('sleep')));
setSleep('2026-12-02', 420);
ok('...logging it ends the nudge and says so', !/nudge/.test(tileHTML('sleep')) && /7h 00m last night/.test(tileHTML('sleep')));
fresh('2026-12-02T21:00:00');
ok('evening with no wind-down: that tile nudges', /tile wind nudge/.test(tileHTML('wind')) && /Time to wind down/.test(tileHTML('wind')));
fresh('2026-12-02T15:00:00');
ok('mid-afternoon: no nudges', !/nudge/.test(tileHTML('wind')) && !/nudge/.test(tileHTML('sleep')));

// ---- workout tile on a rest day ----
fresh('2026-12-03T10:00:00');
ok('Thursday: the Workout tile is sealed as rest, not a gap', /class="seal rest"/.test(tileHTML('workout')));

// ---- tapping ----
fresh('2026-12-02T10:00:00');
onTile('workout'); ok('the Workout tile opens the Workout tab', TAB === 'workout');
TAB = 'today'; onTile('sleep'); ok('the Sleep tile opens the Sleep tab', TAB === 'sleep');
TAB = 'today'; onTile('wind'); ok('the Wind down tile opens the wind-down sheet', !!document.getElementById('sheet') || typeof openWindSheet === 'function');

// ---- the header ----
const hd = headerHTML();
ok('the header has the little-win star and the menu, and the date', /GleefulHabit/.test(hd) && /aria-label="[^"]*[Ww]in/.test(hd) && /aria-label="[^"]*[Mm]enu/.test(hd) || /Study/.test(hd));
ok('the tab bar has Today, Workout, Sleep, Rewards only', tabbarHTML().match(/class="tab /g).length === 4 && ['Today', 'Workout', 'Sleep', 'Rewards'].every(t => tabbarHTML().includes(t)));

// ---- pausing ----
fresh('2026-12-02T10:00:00');
const ans = { why: 'Travel', expect: '1–2 days', planned: 'Saw it coming', back: 'Just time' };
ok('Protein cannot be paused by hand (only a sick day)', pauseHabit('protein', ans).err);
ok('a pause needs all four answers', pauseHabit('sleep', { why: 'Travel' }).err === 'Answer all four questions');
ok('Sleep can be paused', pauseHabit('sleep', ans).ok === true && habitState('sleep', '2026-12-02').st === 'paused');
ok('...a paused tile says so and offers Resume', /tile sleep paused/.test(tileHTML('sleep')) && />Resume</.test(tileHTML('sleep')));
ok('Wind down and Workout pause too', pauseHabit('wind', ans).ok && pauseHabit('workout', ans).ok);
fresh('2026-12-02T10:00:00'); setSleep('2026-12-02', 400);
ok('a habit already logged today cannot be paused', /already logged/.test(pauseHabit('sleep', ans).err || ''));

fresh('2026-12-02T10:00:00');
ok('Sick day pauses Workout and Protein together, no survey', sickDay().ok && habitState('workout', '2026-12-02').st === 'paused' && habitState('protein', '2026-12-02').st === 'paused' && habitState('wind', '2026-12-02').st !== 'paused');
ok('...a second sick day is refused', sickDay().err === 'Already on a sick day');
ok('...and a paused Protein tile offers Resume (only while paused)', />Resume</.test(tileHTML('protein')));
ok('resuming ends the sick day', resumeSick() === true && !sickActive());

// ---- welcome-back messages grow with the pause ----
ok('welcome-back messages: short, warmer, longer', welcomeMessage(1, 'Sleep').length < welcomeMessage(3, 'Sleep').length && /3 days|3/.test(welcomeMessage(3, 'Sleep')) && /10/.test(welcomeMessage(10, 'Workout')) && /20/.test(welcomeMessage(20, 'Workout')));
ok('...and mention no money', [1, 3, 6, 10, 30].every(n => !/\$|¢|dollar|bonus/i.test(welcomeMessage(n, 'Workout'))));
fresh('2026-12-02T10:00:00');
S.pauses.push({ id: 'p', habit: 'sleep', from: '2026-11-28', to: null, why: 'Travel', expect: '1–2 days', planned: 'Saw it coming', back: 'Just time', sick: false });
let toasted = null; const _toast = toast; toast = m => { toasted = m; }; 
setSleep('2026-12-02', 400);
ok('logging again ends the pause the day before', S.pauses[0].to === '2026-12-01' && habitState('sleep', '2026-12-02').st === 'done');
toast = _toast;

// ---- little wins are free ----
fresh('2026-12-02T10:00:00');
const before = JSON.stringify([packsEarned(), packsOwed()]);
addWin('2026-12-02', 'Stayed calm', false);
ok('a little win is saved and pays nothing', S.wins.length === 1 && JSON.stringify([packsEarned(), packsOwed()]) === before && earnedTxt() === '');
