const { run, check, done } = require('./harness');

const HABITS = `
  S.habits.push({id:'w',name:'Workout',type:'boolean',icon:'💪',color:'cyan',createdAt:'2026-09-01',restEligible:true});
  S.habits.push({id:'s',name:'Less Sugar',type:'boolean',icon:'🍬',color:'rose',createdAt:'2026-09-01'});
  S.habits.push({id:'p',name:'Protein',type:'numeric',target:150,unit:'g',icon:'🍗',color:'lime',createdAt:'2026-09-01'});
`;

console.log('labs: seed + migration');
{
  const sb = run({ now: '2026-10-09T12:00:00' }, `
    OUT.panels = JSON.stringify(S.labs.panels);
    OUT.re = S.labs.recheckDate; OUT.base = S.labs.baselineDate; OUT.start = S.labs.miniBossStart;
    OUT.targets = JSON.stringify(S.labs.targets);
    // old backup without labs gets the seed; export -> import round-trips
    const m = migrateState({habits:[],logs:{},user:{xp:5,badges:[]}});
    OUT.migPanels = m.labs.panels.length;
    // user deletes a seeded panel, then state is re-migrated: it must NOT come back
    const m2 = migrateState(JSON.parse(JSON.stringify(m)));
    m2.labs.panels.pop(); const m3 = migrateState(JSON.parse(JSON.stringify(m2)));
    OUT.noReseed = m3.labs.panels.length;
    // partial labs object gets its missing pieces filled, existing values kept
    const m4 = migrateState({habits:[],logs:{},user:{xp:1,badges:[]},labs:{panels:[],recheckDate:'2027-05-01',targets:{ldl:90}}});
    OUT.partial = JSON.stringify([m4.labs.recheckDate, m4.labs.targets.ldl, m4.labs.targets.hdl, typeof m4.labs.awarded, m4.labs.fastDismissed]);
    // December rolls the mini-boss start into January
    OUT.decStart = (() => { const f = seedLabs; return f().miniBossStart; })();
  `);
  const p = JSON.parse(sb.OUT.panels);
  check('two seeded panels with the exact values', p.length === 2
    && JSON.stringify(p[0]) === JSON.stringify({ date: '2024-12-12', total: 209, hdl: 45, tg: 160, ldl: 134, ratio: 4.6, nonHdl: 164 })
    && JSON.stringify(p[1]) === JSON.stringify({ date: '2026-09-29', total: 231, hdl: 45, tg: 217, ldl: 150, ratio: 5.1, nonHdl: 186 }), p);
  check('recheck date defaults to 2027-03-29, baseline is the 9/29/26 panel', sb.OUT.re === '2027-03-29' && sb.OUT.base === '2026-09-29');
  check('mini-bosses start the first FULL month after install (2026-11)', sb.OUT.start === '2026-11', sb.OUT.start);
  check('default ranges', sb.OUT.targets === '{"ldl":100,"tg":150,"total":200,"nonHdl":130,"ratio":5,"hdl":40}', sb.OUT.targets);
  check('old backup migrates to the seed', sb.OUT.migPanels === 2);
  check('a deleted seed panel is never re-seeded', sb.OUT.noReseed === 1, sb.OUT.noReseed);
  check('partial labs keeps user values, fills the rest', sb.OUT.partial === '["2027-05-01",90,40,"object",null]', sb.OUT.partial);
}
{
  const sb = run({ now: '2026-12-15T12:00:00' }, `OUT.s = seedLabs().miniBossStart;`);
  check('December install starts mini-bosses in January', sb.OUT.s === '2027-01', sb.OUT.s);
}

console.log('labs: seeded numbers are internally consistent');
{
  const sb = run({ now: '2026-10-09T12:00:00' }, `
    OUT.d = JSON.stringify([labDerived(209,45), labDerived(231,45)]);
  `);
  check('Non-HDL and ratio derive to your lab numbers', sb.OUT.d === '[{"nonHdl":164,"ratio":4.6},{"nonHdl":186,"ratio":5.1}]', sb.OUT.d);
}

console.log('labs: boss state at the starting baseline');
{
  const sb = run({ now: '2026-10-09T12:00:00' }, `
    const b = labBossState();
    OUT.m = JSON.stringify(b.markers.map(m => [m.id, m.status, Math.round(m.hp * 100), m.met]));
    OUT.down = b.downCount;
  `);
  check('5 lower-is-better bars at full HP, HDL holding', sb.OUT.m === '[["ldl","alive",100,false],["tg","alive",100,false],["total","alive",100,false],["nonHdl","alive",100,false],["ratio","alive",100,false],["hdl","held",0,true]]', sb.OUT.m);
  check('only HDL is "down" at the start', sb.OUT.down === 1, sb.OUT.down);
}

console.log('labs: entering panels (full ladder)');
{
  const sb = run({ now: '2027-01-25T12:00:00' }, `
    const xp0 = S.user.xp;
    // A: everything improves a little; ratio lands on exactly 5.0 which is NOT under 5; HDL holds
    const a = addLabPanel('2026-11-20',225,45,200,140);
    OUT.A = JSON.stringify({err:a.error, xp:a.report.xp, packs:a.report.packs, hanger:a.report.hanger, rewarded:a.report.rewarded, derived:[a.panel.nonHdl,a.panel.ratio], lines:a.report.lines.length});
    OUT.xpA = S.user.xp - xp0; OUT.packsA = S.user.wishlistPoints;
    // B: big drop: crits at the 2024 level + three defeats
    const b = addLabPanel('2026-12-20',195,50,145,130);
    OUT.B = JSON.stringify({xp:b.report.xp, packs:b.report.packs, hanger:b.report.hanger});
    OUT.packsB = S.user.wishlistPoints; OUT.hangersB = 0;
    OUT.flags = JSON.stringify(Object.keys(S.labs.awarded).sort());
    // C: everything in range -> two more defeats + the boss falls
    const c = addLabPanel('2027-01-20',170,50,120,95);
    OUT.C = JSON.stringify({xp:c.report.xp, packs:c.report.packs, hanger:c.report.hanger});
    OUT.packsC = S.user.wishlistPoints; OUT.hangersC = 0;
    OUT.history = S.user.packHistory.map(h => h.type + ':' + h.reason).join(' | ');
    const st = labBossState(); OUT.final = JSON.stringify(st.markers.map(m => m.status)); OUT.downFinal = st.downCount;
  `);
  check('A: no error, 6 improved markers x25 XP = 150, no packs', sb.OUT.A.includes('"xp":150') && sb.OUT.A.includes('"packs":0') && sb.OUT.A.includes('"rewarded":true') && !sb.OUT.A.includes('err":"'), sb.OUT.A);
  check('A: derived Non-HDL 180 and ratio 5.0 computed for you', sb.OUT.A.includes('"derived":[180,5]'), sb.OUT.A);
  check('A: XP actually landed on the user', sb.OUT.xpA === 150, sb.OUT.xpA);
  check('A: ratio exactly 5.0 is not "under 5", so no defeat/points', sb.OUT.packsA === 0, sb.OUT.packsA);
  check('B: 6x25 + 5 crits x50 + 3 defeats x100 = 700 XP, 3 x 40 = 120 pts', sb.OUT.B === '{"xp":700,"packs":120,"hanger":0}', sb.OUT.B);
  check('B: 120 wishlist points landed (no victory yet)', sb.OUT.packsB === 120, sb.OUT.packsB);
  check('B: one-time crit + defeat flags recorded', ['crit_ldl', 'crit_tg', 'crit_total', 'crit_nonHdl', 'crit_ratio', 'defeat_tg', 'defeat_total', 'defeat_ratio'].every(k => sb.OUT.flags.includes(k)), sb.OUT.flags);
  check('C: 2 new defeats (80) + boss victory (600) = 680 pts', JSON.parse(sb.OUT.C).packs === 680, sb.OUT.C);
  check('C: totals 800 pts (5 defeats x 40 + 600)', sb.OUT.packsC === 800, sb.OUT.packsC);
  check('history records victory + defeat entries', sb.OUT.history.includes('labs_victory:Cholesterol boss defeated') && sb.OUT.history.includes('labs_defeat:LDL defeated'), sb.OUT.history);
  check('final boss state: all six down, HDL held', sb.OUT.downFinal === 6 && JSON.parse(sb.OUT.final)[5] === 'held', sb.OUT.final);
}

console.log('labs: worse results + HDL rules');
{
  const sb = run({ now: '2026-12-15T12:00:00' }, `
    const xp0 = S.user.xp;
    const w = addLabPanel('2026-12-01',240,40,230,160);   // everything worse, HDL dropped
    OUT.xp = S.user.xp - xp0; OUT.lines = w.report.lines.join('|'); OUT.packs = S.user.wishlistPoints;
    const st = labBossState();
    OUT.worse = JSON.stringify(st.markers.map(m => m.worse));
    OUT.ldlHp = Math.round(st.markers[0].hp * 100);
    // HDL falling below the range, then recovering above it, pays one defeat pack and only once
    const h1 = addLabPanel('2026-12-05',200,38,200,150);  // hdl 38 (<40)
    const h2 = addLabPanel('2026-12-10',200,41,190,150);  // hdl 41 >= 40: defeat
    OUT.hdlDefeat = h2.report.lines.some(l => l.includes('HDL DEFEATED'));
    const packsAfter = S.user.wishlistPoints;
    const h3 = addLabPanel('2026-12-12',200,36,190,150);
    const h4 = addLabPanel('2026-12-14',200,43,180,150);  // recovers again: flag already set
    OUT.hdlOnce = S.user.wishlistPoints === packsAfter;
  `);
  check('worse panel earns nothing', sb.OUT.xp === 0 && sb.OUT.packs === 0, sb.OUT);
  check('worse markers are called out (boss heals)', sb.OUT.lines.includes('no damage') && JSON.parse(sb.OUT.worse).every(x => x === true), sb.OUT.worse);
  check('LDL bar is full while worse than baseline', sb.OUT.ldlHp === 100, sb.OUT.ldlHp);
  check('HDL dropping under 40 then recovering earns a defeat once', sb.OUT.hdlDefeat && sb.OUT.hdlOnce);
}

console.log('labs: anti-farming + validation');
{
  const sb = run({ now: '2026-12-15T12:00:00' }, `
    OUT.bad = [
      addLabPanel('nope',200,50,150,100).error,
      addLabPanel('2026-13-40',200,50,150,100).error,
      addLabPanel('2027-01-01',200,50,150,100).error,          // future
      addLabPanel('2026-11-01',-5,50,150,100).error,
      addLabPanel('2026-11-01',200,'abc',150,100).error,
      addLabPanel('2026-11-01',200,50,NaN,100).error,
      addLabPanel('2026-11-01',200,50,150,'').error,
      addLabPanel('2026-11-01',9999,50,150,100).error,
      addLabPanel('2026-09-29',200,50,150,100).error,          // duplicate of seeded date
    ].map(e => typeof e === 'string');
    OUT.panelsAfterBad = S.labs.panels.length;
    // back-dated panel (older than newest) is stored but pays nothing
    const xp0 = S.user.xp;
    const back = addLabPanel('2026-01-15',150,60,100,80);
    OUT.backRewarded = back.report.rewarded; OUT.backXp = S.user.xp - xp0; OUT.backLine = back.report.lines[0];
    // reward once per date: delete the paid panel and re-enter the same date
    const first = addLabPanel('2026-11-20',225,45,200,140);
    const xpAfterFirst = S.user.xp;
    deleteLabPanel('2026-11-20');
    const again = addLabPanel('2026-11-20',200,50,150,100);  // even better numbers
    OUT.again = JSON.stringify({rewarded:again.report.rewarded, xp:S.user.xp - xpAfterFirst, line:again.report.lines[0]});
    OUT.firstXp = first.report.xp;
  `);
  check('all 9 bad inputs rejected with a message', sb.OUT.bad.every(Boolean), sb.OUT.bad);
  check('no junk panels were stored', sb.OUT.panelsAfterBad === 2, sb.OUT.panelsAfterBad);
  check('back-dated panel is history only (no XP)', sb.OUT.backRewarded === false && sb.OUT.backXp === 0 && sb.OUT.backLine.includes('history only'), [sb.OUT.backRewarded, sb.OUT.backXp, sb.OUT.backLine]);
  check('delete + re-enter same date pays nothing twice', JSON.parse(sb.OUT.again).rewarded === false && JSON.parse(sb.OUT.again).xp === 0 && JSON.parse(sb.OUT.again).line.includes('already paid'), sb.OUT.again);
}

console.log('labs: mini-bosses');
{
  // Oct 2026 has 4 Sundays (4, 11, 18, 25). Judged on the first open after the month ends.
  const pass = run({ now: '2026-11-02T09:00:00' }, HABITS + `
    S.labs.miniBossStart = '2026-10';
    ['2026-09-29','2026-10-06','2026-10-13','2026-10-20'].forEach(d => S.cardioLogs[d] = [{min:90},{min:60}]);   // 4 weeks x 150
    for (let i = 1; i <= 22; i++) { const dk = '2026-10-' + String(i).padStart(2,'0'); S.logEntries[dk] = {p:[{amt:30,label:'x',fiber:35}]}; }
    for (let i = 1; i <= 31; i++) { const dk = '2026-10-' + String(i).padStart(2,'0'); if (i % 7 !== 0) { S.logs[dk] = S.logs[dk] || {}; S.logs[dk].s = true; } }  // 27/31 = 87%
    checkLabsMilestones();
    OUT.packs = S.user.wishlistPoints;
    OUT.flags = JSON.stringify(['cardio','fiber','sugar'].map(k => S.labs.awarded['mini_2026-10_' + k]));
    checkLabsMilestones(); checkLabsMilestones();     // idempotent
    OUT.packsAgain = S.user.wishlistPoints;
    OUT.history = S.user.packHistory.map(h => h.reason).join('|');
    OUT.r = JSON.stringify(['cardio','fiber','sugar'].map(k => { const r = labMiniResult(k,'2026-10'); return [r.ok, r.label]; }));
  `);
  check('all three mini-bosses pay 16 pts each', pass.OUT.packs === 48 && pass.OUT.flags === '[true,true,true]', pass.OUT);
  check('running the check again never double-pays', pass.OUT.packsAgain === 48, pass.OUT.packsAgain);
  check('history names them with the month', pass.OUT.history.includes('Cardio Crusher — Oct 2026') && pass.OUT.history.includes('Fiber Fiend — Oct 2026') && pass.OUT.history.includes('Sugar Slayer — Oct 2026'), pass.OUT.history);
  check('progress labels', pass.OUT.r.includes('4 / 4 weeks at 150+ min') && pass.OUT.r.includes('avg 35g / 30g') && pass.OUT.r.includes('87% of 31 days'), pass.OUT.r);

  const miss = run({ now: '2026-11-02T09:00:00' }, HABITS + `
    S.labs.miniBossStart = '2026-10';
    ['2026-09-29','2026-10-06','2026-10-13'].forEach(d => S.cardioLogs[d] = [{min:150}]);          // only 3 weeks
    S.cardioLogs['2026-10-20'] = [{min:149}];                                                        // one minute short
    for (let i = 1; i <= 19; i++) { const dk = '2026-10-' + String(i).padStart(2,'0'); S.logEntries[dk] = {p:[{amt:30,label:'x',fiber:60}]}; }  // 19 days only
    for (let i = 20; i <= 31; i++) { const dk = '2026-10-' + String(i).padStart(2,'0'); S.logEntries[dk] = {p:[{amt:30,label:'no fiber field'}]}; } // unknown days are skipped, not zero
    for (let i = 1; i <= 31; i++) { const dk = '2026-10-' + String(i).padStart(2,'0'); if (i <= 24) { S.logs[dk] = S.logs[dk] || {}; S.logs[dk].s = true; } }   // 24/31 = 77%
    checkLabsMilestones();
    OUT.packs = S.user.wishlistPoints;
    OUT.flags = JSON.stringify(['cardio','fiber','sugar'].map(k => S.labs.awarded['mini_2026-10_' + k]));
    // back-filling after the month was judged cannot pay out the old month
    for (let i = 20; i <= 31; i++) { const dk = '2026-10-' + String(i).padStart(2,'0'); S.logs[dk] = S.logs[dk] || {}; S.logs[dk].s = true; }
    S.cardioLogs['2026-10-20'] = [{min:200}];
    checkLabsMilestones();
    OUT.packsAfterBackfill = S.user.wishlistPoints;
  `);
  check('3 weeks / 149 min, 19 fiber days (unknown days skipped), 77%: all miss', miss.OUT.packs === 0 && miss.OUT.flags === '[false,false,false]', miss.OUT);
  check('a judged month is frozen: back-filling pays nothing', miss.OUT.packsAfterBackfill === 0, miss.OUT.packsAfterBackfill);

  const edge = run({ now: '2026-12-02T09:00:00' }, HABITS + `
    S.labs.miniBossStart = '2026-11';
    // Nov 2026 Sundays: 1, 8, 15, 22, 29 -> five weeks, one miss allowed
    ['2026-10-27','2026-11-03','2026-11-10','2026-11-17'].forEach(d => S.cardioLogs[d] = [{min:150}]);   // 4 of 5 weeks
    for (let i = 1; i <= 20; i++) { const dk = '2026-11-' + String(i).padStart(2,'0'); S.logEntries[dk] = {p:[{amt:30,label:'x',fiber:30}]}; }  // exactly 20 days, exactly 30g
    OUT.r = JSON.stringify(['cardio','fiber'].map(k => { const r = labMiniResult(k,'2026-11'); return [r.ok, r.label]; }));
    checkLabsMilestones(); OUT.packs = S.user.wishlistPoints;
  `);
  check('5-Sunday month allows one missed week; 20 days at exactly goal passes', edge.OUT.r.includes('[true,"4 / 4 weeks') && edge.OUT.r.includes('[true,"avg 30g / 30g"') && edge.OUT.packs === 32, edge.OUT);

  const before = run({ now: '2026-11-02T09:00:00' }, HABITS + `
    // default start is the first full month after install: October is never judged
    S.labs.miniBossStart = '2026-11';
    ['2026-09-29','2026-10-06','2026-10-13','2026-10-20'].forEach(d => S.cardioLogs[d] = [{min:200}]);
    checkLabsMilestones();
    OUT.packs = S.user.wishlistPoints; OUT.keys = Object.keys(S.labs.awarded).length;
  `);
  check('months before the start month are never judged', before.OUT.packs === 0 && before.OUT.keys === 0, before.OUT);

  const nohabit = run({ now: '2026-11-02T09:00:00' }, `
    S.labs.miniBossStart = '2026-10';
    S.habits.push({id:'w',name:'Workout',type:'boolean',icon:'💪',color:'cyan',createdAt:'2026-09-01'});
    checkLabsMilestones();
    OUT.flags = JSON.stringify(['cardio','fiber','sugar'].map(k => S.labs.awarded['mini_2026-10_' + k]));
  `);
  check('missing Protein / Less Sugar habit: those mini-bosses are skipped, not failed', nohabit.OUT.flags === '[false,null,null]', nohabit.OUT.flags);
}

console.log('labs: recheck countdown + fasting reminder');
{
  const mk = (now, extra) => run({ now }, `OUT.d = labDaysUntil(S.labs.recheckDate); OUT.vis = labsFastBannerVisible(); ${extra || ''}`);
  check('days until (across the March DST change)', mk('2027-03-10T12:00:00').OUT.d === 19, mk('2027-03-10T12:00:00').OUT.d);
  check('day before: banner visible', mk('2027-03-28T08:00:00').OUT.vis === true);
  check('two days before: hidden', mk('2027-03-27T08:00:00').OUT.vis === false);
  check('recheck day itself: hidden', mk('2027-03-29T08:00:00').OUT.vis === false);
  check('after the date: hidden', mk('2027-03-30T08:00:00').OUT.vis === false);
  const dis = run({ now: '2027-03-28T08:00:00' }, `
    renderLabsFastBanner(); OUT.shown = document.getElementById('labsFastBanner').style.display;
    dismissLabsFast(); OUT.afterDismiss = labsFastBannerVisible(); OUT.hidden = document.getElementById('labsFastBanner').style.display;
    // moving the recheck date re-arms the reminder for the new date
    document.getElementById('labRecheckInput').value = '2027-04-10'; saveRecheckDate();
    OUT.newDate = S.labs.recheckDate; OUT.rearmed = S.labs.fastDismissed;
    __setNow('2027-04-09T08:00:00'); OUT.visNew = labsFastBannerVisible();
    document.getElementById('labRecheckInput').value = 'garbage'; saveRecheckDate(); OUT.keeps = S.labs.recheckDate;
  `);
  check('banner shows, dismiss hides it', dis.OUT.shown === 'flex' && dis.OUT.afterDismiss === false && dis.OUT.hidden === 'none', dis.OUT);
  check('changing the date re-arms the reminder', dis.OUT.newDate === '2027-04-10' && dis.OUT.rearmed === null && dis.OUT.visNew === true, dis.OUT);
  check('garbage date is ignored', dis.OUT.keeps === '2027-04-10', dis.OUT.keeps);
}

console.log('labs: screen renders');
{
  const sb = run({ now: '2026-10-09T12:00:00' }, HABITS + `
    renderLabsTab(); OUT.html = document.getElementById('labsContent').innerHTML;
    addLabPanel('2026-10-05',225,45,200,140); renderLabsTab(); OUT.after = document.getElementById('labsContent').innerHTML;
  `);
  const h = sb.OUT.html;
  check('countdown, boss, form, mini-bosses, panels, ranges all present', ['Next blood test', 'Cholesterol Boss', 'Enter a new panel', 'Strike!', 'Cardio Crusher', 'Fiber Fiend', 'Sugar Slayer', '2024-12-12', '2026-09-29', 'Boss ranges'].every(x => h.includes(x)));
  check('days countdown shown (171 days from Oct 9)', h.includes('171 days'), h.match(/\d+ days/));
  check('6 boss bars (LDL, TG, Total, Non-HDL, Chol/HDL, HDL)', ['LDL', 'Triglycerides', 'Total', 'Non-HDL', 'Chol/HDL', 'HDL'].every(x => h.includes(x)));
  check('mini-bosses say they start in Nov 2026 before then', h.includes('Starts Nov 2026'));
  check('battle report appears after a panel', sb.OUT.after.includes('Battle report') && sb.OUT.after.includes('damage'));
}

console.log('labs: hostile / broken import data is cleaned');
{
  const sb = run({ now: '2026-10-09T12:00:00' }, `
    const evil = {habits:[],logs:{},user:{xp:1,badges:[]},labs:{
      panels:[
        {date:"2026-09-29');alert(1);//",total:1,hdl:1,tg:1,ldl:1,ratio:1,nonHdl:1},
        {date:'2026-10-01',total:'<img src=x onerror=alert(1)>',hdl:45,tg:100,ldl:90,ratio:4,nonHdl:150},
        {date:'2026-10-02',total:200,hdl:50,tg:100,ldl:90,ratio:4,nonHdl:150,extra:'<script>'},
        null, 5, 'x'
      ],
      recheckDate:'<b>soon</b>', baselineDate:'nope', miniBossStart:'whenever',
      lastReport:{date:'2026-10-02',lines:['<img src=x onerror=alert(1)>'],xp:'many',packs:0,hanger:0},
      fastDismissed:42, awarded:'yes', targets:'big'
    }};
    const m = migrateState(evil);
    OUT.n = m.labs.panels.length; OUT.keys = JSON.stringify(Object.keys(m.labs.panels[0] || {}));
    OUT.re = m.labs.recheckDate; OUT.base = m.labs.baselineDate; OUT.start = /^\\d{4}-\\d{2}$/.test(m.labs.miniBossStart);
    OUT.report = m.labs.lastReport; OUT.fd = m.labs.fastDismissed; OUT.aw = typeof m.labs.awarded; OUT.tg = m.labs.targets.ldl;
    S = m; renderLabsTab(); OUT.html = document.getElementById('labsContent').innerHTML;
    // a report whose text contains markup is escaped on screen
    S.labs.lastReport = {date:'2026-10-02',lines:['<img src=x onerror=alert(1)>'],xp:5,packs:0,hanger:0};
    renderLabsTab(); OUT.html2 = document.getElementById('labsContent').innerHTML;
  `);
  check('only the one well-formed panel survives, with only known fields', sb.OUT.n === 1 && sb.OUT.keys === '["date","total","hdl","tg","ldl","ratio","nonHdl"]', [sb.OUT.n, sb.OUT.keys]);
  check('bad dates / start month fall back to safe defaults', sb.OUT.re === '2027-03-29' && sb.OUT.base === '2026-10-02' && sb.OUT.start === true, sb.OUT);
  check('malformed report / flags / targets are reset', sb.OUT.report === null && sb.OUT.fd === null && sb.OUT.aw === 'object' && sb.OUT.tg === 100, sb.OUT);
  check('nothing hostile reaches the page', !sb.OUT.html.includes('<img') && !sb.OUT.html.includes('alert(1)') && !sb.OUT.html.includes('<script'), 'html contained hostile text');
  check('markup in a report line is escaped', !sb.OUT.html2.includes('<img src=x') && sb.OUT.html2.includes('&lt;img'), 'report line not escaped');
}

console.log('labs: existing systems untouched');
{
  const sb = run({ now: '2026-10-09T12:00:00' }, HABITS + `
    OUT.card = habitCardHTML(S.habits[0]);
    OUT.pausable = S.habits.map(h => isPausable(h)).join(',');
    toggleHabit('w'); checkWeeklyPacksAndMilestones(); __flushTimers();
    OUT.err = OUT.__timerError || '';
    OUT.packs = S.user.wishlistPoints; OUT.habits = S.habits.length;
    const back = JSON.parse(JSON.stringify(S));            // export -> import round trip keeps Labs
    const back2 = migrateState(back);
    OUT.rt = back2.labs.panels.length + ':' + back2.labs.recheckDate;
  `);
  check('no habit rows added: still exactly the 3 test habits', sb.OUT.habits === 3);
  check('habit card + pause rules unchanged', sb.OUT.card.includes('habit-card') && sb.OUT.pausable === 'true,true,false', sb.OUT.pausable);
  check('weekly pack check + timers run clean with Labs in place', sb.OUT.err === '', sb.OUT.err);
  check('backup round-trip preserves Labs', sb.OUT.rt === '2:2027-03-29', sb.OUT.rt);
}

done();
