const { run, check, done } = require('./harness');

const SETUP = `
  S.habits.push({id:'w',name:'Workout',type:'boolean',icon:'💪',color:'cyan',createdAt:'2026-09-01',restEligible:true});
  S.habits.push({id:'p',name:'Protein',type:'numeric',target:150,unit:'g',icon:'🍗',color:'lime',createdAt:'2026-09-01'});
`;

console.log('cardio: defaults + migration');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, `
    OUT.logs = JSON.stringify(S.cardioLogs); OUT.goal = S.user.cardioGoalMin;
    // an old backup with none of the new fields must migrate cleanly (same path importData uses)
    const old = {habits:[],logs:{},user:{xp:5,badges:[]}};
    const m = migrateState(old);
    OUT.migLogs = JSON.stringify(m.cardioLogs); OUT.migGoal = m.user.cardioGoalMin;
  `);
  check('blank state has cardioLogs + 150 goal', sb.OUT.logs === '{}' && sb.OUT.goal === 150, sb.OUT);
  check('old backup migrates to cardioLogs + goal', sb.OUT.migLogs === '{}' && sb.OUT.migGoal === 150, sb.OUT);
}

console.log('cardio: weekly minutes reset on Monday');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    // Week of Mon 2026-10-05 .. Sun 2026-10-11
    S.cardioLogs['2026-10-05'] = [{min:30}];          // Monday
    S.cardioLogs['2026-10-07'] = [{min:20},{min:15}]; // Wednesday, two entries
    S.cardioLogs['2026-10-11'] = [{min:40}];          // Sunday (same week)
    S.cardioLogs['2026-10-04'] = [{min:99}];          // previous Sunday (last week)
    S.cardioLogs['2026-10-12'] = [{min:60}];          // next Monday
    OUT.wed = cardioWeekMinutes('2026-10-07');
    OUT.sun = cardioWeekMinutes('2026-10-11');
    OUT.prevSun = cardioWeekMinutes('2026-10-04');
    OUT.nextMon = cardioWeekMinutes('2026-10-12');
    OUT.day = cardioMinutesOn('2026-10-07');
    OUT.empty = cardioMinutesOn('2026-10-06');
  `);
  check('Mon..Sun entries all land in one week (30+35+40=105)', sb.OUT.wed === 105 && sb.OUT.sun === 105, sb.OUT);
  check('previous Sunday belongs to the prior week', sb.OUT.prevSun === 99, sb.OUT);
  check('next Monday starts a fresh week', sb.OUT.nextMon === 60, sb.OUT);
  check('per-day sum + empty day', sb.OUT.day === 35 && sb.OUT.empty === 0, sb.OUT);
}

console.log('cardio: logging rules');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    const xp0 = S.user.xp, done0 = S.user.totalDone;
    OUT.bad = [0, -5, 301, NaN, 'abc', '', null, undefined].map(v => addCardio(v));
    OUT.afterBad = cardioMinutesOn(todayKey());
    OUT.ok1 = addCardio(20); OUT.ok2 = addCardio('30'); OUT.ok3 = addCardio(12.4);
    OUT.today = cardioMinutesOn(todayKey());
    OUT.doneToday = isDoneToday('w');
    OUT.xpSame = S.user.xp === xp0 && S.user.totalDone === done0;
    OUT.noXpFlag = Object.keys(S.xpAwarded).length;
    undoCardio();
    OUT.afterUndo = cardioMinutesOn(todayKey());
    undoCardio(); undoCardio(); undoCardio(); // extra undos on an empty day are harmless
    OUT.dayKeyGone = !(todayKey() in S.cardioLogs);
  `);
  check('invalid minutes are all rejected', sb.OUT.bad.every(r => r === false) && sb.OUT.afterBad === 0, sb.OUT);
  check('valid entries accepted and rounded (20+30+12)', sb.OUT.ok1 && sb.OUT.ok2 && sb.OUT.ok3 && sb.OUT.today === 62, sb.OUT);
  check('logging minutes does NOT complete the Workout day', sb.OUT.doneToday === false, sb.OUT);
  check('logging minutes awards no XP / completion', sb.OUT.xpSame && sb.OUT.noXpFlag === 0, sb.OUT);
  check('undo removes the last entry (20+30 left)', sb.OUT.afterUndo === 50, sb.OUT);
  check('empty day key is cleaned up', sb.OUT.dayKeyGone, sb.OUT);
}

console.log('cardio: existing workout behaviour untouched');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    addCardio(45);
    toggleHabit('w');                      // manual check-off still works exactly as before
    OUT.doneAfterTap = isDoneToday('w');
    OUT.xpAfterTap = S.user.xp;
    OUT.sessions = workoutWeekSessions(todayKey());
    toggleHabit('w');
    OUT.doneAfterUntap = isDoneToday('w');
    OUT.cardioKept = cardioMinutesOn(todayKey());
  `);
  check('manual check-off still completes the day (+10 XP)', sb.OUT.doneAfterTap === true && sb.OUT.xpAfterTap === 10, sb.OUT);
  check('weekly session count unaffected by minutes', sb.OUT.sessions === 1, sb.OUT);
  check('un-checking leaves cardio minutes alone', sb.OUT.doneAfterUntap === false && sb.OUT.cardioKept === 45, sb.OUT);
}

console.log('cardio: rendering');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    addCardio(85);
    OUT.card = habitCardHTML(S.habits[0]);
    OUT.circuits = cardioSectionHTML();
    OUT.proteinCard = habitCardHTML(S.habits[1]);
    // a paused Workout habit hides the cardio mini-bar (card is greyed out)
    OUT.pausable = isPausable(S.habits[0]);
    togglePauseHabit('w');
    OUT.pausedCard = habitCardHTML(S.habits[0]);
    togglePauseHabit('w');
    // goal reached turns the bar lime and shows the check
    addCardio(70);
    OUT.goalCircuits = cardioSectionHTML();
    OUT.goalCard = habitCardHTML(S.habits[0]);
  `);
  check('Workout card shows 85/150m mini-bar', sb.OUT.card.includes('85/150m'), sb.OUT.card.slice(0, 0));
  check('Circuits card shows weekly total + undo link', sb.OUT.circuits.includes('85 / 150 min this week') && sb.OUT.circuits.includes('undo last'));
  check('Protein card has no cardio bar', !sb.OUT.proteinCard.includes('/150m'));
  check('Workout is still pausable', sb.OUT.pausable === true);
  check('paused Workout card hides the cardio bar', !sb.OUT.pausedCard.includes('/150m'));
  check('155/150 shows goal-met state', sb.OUT.goalCircuits.includes('155 / 150 min this week') && sb.OUT.goalCircuits.includes('✅') && sb.OUT.goalCard.includes('155/150m'));
}

done();
