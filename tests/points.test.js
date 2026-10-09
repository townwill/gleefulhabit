const { run, check, done } = require('./harness');

const SETUP = `
  S.habits.push({id:'w',name:'Workout',type:'boolean',icon:'💪',color:'cyan',createdAt:'2026-09-01'});
  S.habits.push({id:'s',name:'Spend Less',type:'boolean',icon:'💸',color:'lime',createdAt:'2026-09-01'});
  S.habits.push({id:'p',name:'Protein',type:'numeric',target:150,unit:'g',icon:'🍗',color:'lime',createdAt:'2026-09-01'});
`;

console.log('points: box price table');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, `
    OUT.t = ['pack','blaster','super','mega','hobby','mythic'].map(boxPoints).join(',');
    S.user.wishlistPointsPerDollar = 5;
    OUT.t5 = ['pack','mythic'].map(boxPoints).join(',');
    S.user.wishlistPointsPerDollar = 4;
    const p0 = S.user.wishlistPoints;
    awardBox('blaster','test');
    OUT.gain = S.user.wishlistPoints - p0;
    OUT.banks = [S.user.packsBank,S.user.blastersBank,S.user.hangersBank].join(',');
    OUT.hist = JSON.stringify(S.user.packHistory[0]);
    OUT.unknown = awardBox('nonsense','x');
  `);
  check('4 pts/$: 16,120,160,200,600,1000', sb.OUT.t === '16,120,160,200,600,1000', sb.OUT.t);
  check('price table follows the rate (5/$)', sb.OUT.t5 === '20,1250', sb.OUT.t5);
  check('awardBox pays points and touches no box bank', sb.OUT.gain === 120 && sb.OUT.banks === '0,0,0', sb.OUT);
  check('history entry marks it points-paid', sb.OUT.hist.includes('"points":120') && sb.OUT.hist.includes('"redeemed":true'), sb.OUT.hist);
  check('unknown box type pays nothing', sb.OUT.unknown === 0, sb.OUT.unknown);
}

console.log('points: milestones pay once');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    S.user.xp = 5000;                    // above level 10 and level 15 thresholds? measure by levelInfo
    OUT.lv = levelInfo(S.user.xp).lv;
    const p0 = S.user.wishlistPoints;
    checkHangerMilestones(); checkBlasterMilestones();
    OUT.first = S.user.wishlistPoints - p0;
    const p1 = S.user.wishlistPoints;
    checkHangerMilestones(); checkBlasterMilestones();
    OUT.again = S.user.wishlistPoints - p1;
    OUT.banks = [S.user.packsBank,S.user.blastersBank,S.user.superBank,S.user.megaBank].join(',');
  `);
  check('milestones paid something, in whole box prices', sb.OUT.first > 0 && sb.OUT.first % 8 === 0, sb.OUT);
  check('re-checking never pays twice', sb.OUT.again === 0, sb.OUT.again);
  check('no box banks touched', sb.OUT.banks === '0,0,0,0', sb.OUT.banks);

  const wt = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    S.weight.logs['2026-09-01'] = 200; S.weight.logs['2026-09-20'] = 189;   // 11 lbs lost
    S.weight.goal = 150;
    const p0 = S.user.wishlistPoints;
    checkWeightMilestones();
    OUT.first = S.user.wishlistPoints - p0;
    checkWeightMilestones();
    OUT.again = S.user.wishlistPoints - p0;
    S.weight.logs['2026-10-06'] = 150;  // goal weight -> everything on the ladder + mythic
    checkWeightMilestones();
    OUT.all = S.user.wishlistPoints - p0;
  `);
  check('11 lbs lost = 5lb pack + 10lb pack (32 pts)', wt.OUT.first === 32, wt.OUT.first);
  check('weight check is idempotent', wt.OUT.again === 32, wt.OUT.again);
  check('goal weight: +blaster+super+mega+mythic (16+16+120+160+200+1000)', wt.OUT.all === 1512, wt.OUT.all);
}

console.log('points: daily habit points');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    const p0 = () => S.user.wishlistPoints;
    OUT.start = p0();
    toggleHabit('w');
    OUT.afterOne = p0();
    toggleHabit('w'); toggleHabit('w');        // untick, retick: no double pay, no clawback
    OUT.afterFlip = p0();
    toggleHabit('s');
    OUT.afterTwo = p0();
    addNumCore('p', 150);                       // numeric target reached counts too
    checkWeeklyPacksAndMilestones();
    OUT.afterNum = p0();
    toggleHabit('w');                           // untick: points stay
    OUT.afterUntick = p0();
    OUT.since = S.user.habitPtsSince;
    OUT.paid = Object.keys(S.user.habitPtsPaid).sort().join(',');
  `);
  check('starts at 0', sb.OUT.start === 0, sb.OUT.start);
  check('one habit done = +2', sb.OUT.afterOne === 2, sb.OUT.afterOne);
  check('untick + retick does not double pay', sb.OUT.afterFlip === 2, sb.OUT.afterFlip);
  check('second habit +2', sb.OUT.afterTwo === 4, sb.OUT.afterTwo);
  check('numeric habit hitting target +2', sb.OUT.afterNum === 6, sb.OUT.afterNum);
  check('un-ticking leaves points alone', sb.OUT.afterUntick === 6, sb.OUT.afterUntick);
  check('paid map keyed by day+habit; since = first day', sb.OUT.paid === '2026-10-07_p,2026-10-07_s,2026-10-07_w' && sb.OUT.since === '2026-10-07', sb.OUT);

  // History before the feature first ran is never retro-paid.
  const old = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    S.logs['2026-10-05'] = {w:true,s:true};
    S.logs['2026-10-06'] = {w:true};
    awardHabitDayPoints();                      // first run: since = today
    OUT.pts = S.user.wishlistPoints;
    S.logs['2026-10-07'] = {w:true,s:true};
    awardHabitDayPoints();
    OUT.today = S.user.wishlistPoints;
  `);
  check('earlier days are not retro-paid', old.OUT.pts === 0, old.OUT.pts);
  check('today still pays', old.OUT.today === 4, old.OUT.today);

  // Backfilling a past day AFTER the since date does pay (that day is in range).
  const fill = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    S.user.habitPtsSince = '2026-10-01';
    toggleHabitOnDate('w','2026-10-05');
    OUT.pts = S.user.wishlistPoints;
    S.user.habitPtsSince = '2026-10-06';
    S.logs['2026-10-05'] = {w:true,s:true};
    delete S.user.habitPtsPaid['2026-10-05_s'];
    awardHabitDayPoints();
    OUT.beforeSince = S.user.wishlistPoints - OUT.pts;
  `);
  check('backfilled day inside the window pays +2', fill.OUT.pts === 2, fill.OUT.pts);
  check('days before the since date never pay', fill.OUT.beforeSince === 0, fill.OUT.beforeSince);

  // A habit created later does not pay for days before it existed.
  const created = run({ now: '2026-10-07T12:00:00' }, `
    S.user.habitPtsSince = '2026-10-01';
    S.habits.push({id:'n',name:'New',type:'boolean',icon:'x',color:'cyan',createdAt:'2026-10-07'});
    S.logs['2026-10-05'] = {n:true};
    awardHabitDayPoints();
    OUT.pts = S.user.wishlistPoints;
  `);
  check('no pay for days before the habit existed', created.OUT.pts === 0, created.OUT.pts);
}

console.log('points: perfect-week bonus replaces weekly packs');
{
  const sb = run({ now: '2026-10-10T12:00:00' }, SETUP + `
    // Week Mon 2026-10-05 .. Sat 2026-10-10: complete everything every day
    S.user.habitPtsSince = '2026-10-05';
    ['05','06','07','08','09','10'].forEach(d => { S.logs['2026-10-'+d] = {w:true,s:true,p:150}; });
    checkWeeklyPacksAndMilestones();
    const flags = S.user.weeklyPackFlags[isoWeek()] || {};
    OUT.flags = JSON.stringify([!!flags.halfA, !!flags.halfB, !!flags.bonus]);
    OUT.pts = S.user.wishlistPoints;
    OUT.banks = S.user.packsBank;
    OUT.hist = S.user.wishlistHistory.map(h => h.points + ':' + h.reason).join('|');
    const p1 = S.user.wishlistPoints;
    checkWeeklyPacksAndMilestones(); checkWeeklyPacksAndMilestones();
    OUT.again = S.user.wishlistPoints - p1;
  `);
  check('both halves flagged and bonus recorded', sb.OUT.flags === '[true,true,true]', sb.OUT.flags);
  check('6 days x 3 habits x 2 + 20 bonus = 56 pts', sb.OUT.pts === 56, [sb.OUT.pts, sb.OUT.hist]);
  check('no pack banked from weekly halves', sb.OUT.banks === 0, sb.OUT.banks);
  check('bonus and habit points never repeat', sb.OUT.again === 0, sb.OUT.again);

  const half = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    S.user.habitPtsSince = '2026-10-05';
    ['05','06','07'].forEach(d => { S.logs['2026-10-'+d] = {w:true,s:true,p:150}; });
    checkWeeklyPacksAndMilestones();
    const flags = S.user.weeklyPackFlags[isoWeek()] || {};
    OUT.flags = JSON.stringify([!!flags.halfA, !!flags.halfB, !!flags.bonus]);
    OUT.pts = S.user.wishlistPoints;
  `);
  check('one perfect half = no bonus, only habit points (18)', half.OUT.flags === '[true,false,false]' && half.OUT.pts === 18, half.OUT);
}

console.log('points: migration + shop');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, `
    const m = migrateState({habits:[],logs:{},user:{xp:5,badges:[]}});
    OUT.names = m.user.wishlistItems.map(i => i.name + ':' + i.priceUsd).join('|');
    OUT.since = m.user.habitPtsSince; OUT.paid = JSON.stringify(m.user.habitPtsPaid);
    const m2 = migrateState(JSON.parse(JSON.stringify(m)));
    OUT.count1 = m.user.wishlistItems.length; OUT.count2 = m2.user.wishlistItems.length;
    const hostile = migrateState({habits:[],logs:{},user:{xp:1,badges:[],habitPtsSince:"x'+alert(1)+'",habitPtsPaid:[1,2]}});
    OUT.hSince = hostile.user.habitPtsSince; OUT.hPaid = JSON.stringify(hostile.user.habitPtsPaid);
    const keep = migrateState({habits:[],logs:{},user:{xp:1,badges:[],habitPtsSince:'2026-10-01',habitPtsPaid:{'2026-10-01_w':true},wishlistItems:[{id:'a',name:'Pack',priceUsd:9,redeemedCount:0}]}});
    OUT.keepSince = keep.user.habitPtsSince; OUT.keepPaid = JSON.stringify(keep.user.habitPtsPaid);
    OUT.packItems = keep.user.wishlistItems.filter(i => i.name === 'Pack').length + ':' + keep.user.wishlistItems.find(i => i.name === 'Pack').priceUsd;
    OUT.shopIds = new Set(m.user.wishlistItems.map(i => i.id)).size === m.user.wishlistItems.length;
  `);
  check('shop items seeded with the box prices', ['Pack:4','Blaster Box:30','Super Box:40','Mega Box:50','Hobby Box:150','Mythic Box:250'].every(x => sb.OUT.names.includes(x)), sb.OUT.names);
  check('re-migrating does not duplicate shop items', sb.OUT.count1 === sb.OUT.count2, [sb.OUT.count1, sb.OUT.count2]);
  check('shop item ids are unique', sb.OUT.shopIds);
  check('old backup gets empty paid map and no since', sb.OUT.since === null && sb.OUT.paid === '{}', sb.OUT);
  check('hostile since/paid values are discarded', sb.OUT.hSince === null && sb.OUT.hPaid === '{}', sb.OUT);
  check('valid saved values survive', sb.OUT.keepSince === '2026-10-01' && sb.OUT.keepPaid === '{"2026-10-01_w":true}', sb.OUT);
  check('an existing "Pack" item is not overwritten', sb.OUT.packItems === '1:9', sb.OUT.packItems);
}

console.log('points: rewards screen');
{
  const sb = run({ now: '2026-10-07T12:00:00' }, SETUP + `
    renderRewards();
    OUT.empty = JSON.stringify(Object.values(__els).map(e => e._html).filter(h => h.includes('Wishlist Points')).length);
    OUT.html = Object.values(__els).map(e => e._html).filter(h => h.includes('Wishlist Points'))[0] || '';
    S.user.packsBank = 2;
    renderRewards();
    OUT.legacy = Object.values(__els).map(e => e._html).filter(h => h.includes('Wishlist Points'))[0] || '';
  `);
  check('vault hidden when nothing is banked', !sb.OUT.html.includes('Pack Vault'), sb.OUT.html.slice(0, 0));
  check('milestone sections show their points', sb.OUT.html.includes('16 pts each') && sb.OUT.html.includes('120 pts each') && sb.OUT.html.includes('1000 pts'));
  check('shop items render with point costs', sb.OUT.html.includes('Hobby Box') && sb.OUT.html.includes('(600 pts)'));
  check('legacy banked boxes still show the vault', sb.OUT.legacy.includes('Pack Vault'));
  check('weekly card no longer promises packs', !sb.OUT.html.includes('Pack — '));
}

done();
