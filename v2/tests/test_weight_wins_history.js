const ok = (name, cond) => console.log(name + ':', !!cond);
function world(now, start) { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = start || '2026-10-01'; closeSheet(); OV = null; }
const FOOD = (p, s) => [{ id: 'f' + p + s, label: 'food', protein: p, sugar: s, src: 'manual' }];

// ================= Little wins =================
world('2026-10-24T13:00:00');
ok('presets include the spec examples', ['Walked the dog', 'Cooked dinner', 'Helped at school', 'Hard conversation handled', 'Stayed calm', 'Finished a project'].every(w => WIN_PRESETS.includes(w)));
const before = moneyNow();
ok('a one-tap win is recorded for today', addWin('2026-10-24', WIN_PRESETS[0], false) && S.wins.length === 1 && S.wins[0].dk === '2026-10-24' && S.wins[0].other === false);
ok('Other with text works and is flagged', addWin('2026-10-24', '  Fixed the fence  ', true) && S.wins[1].label === 'Fixed the fence' && S.wins[1].other === true);
ok('an empty Other is refused', addWin('2026-10-24', '   ', true) === false && S.wins.length === 2);
ok('wins pay NOTHING: balance, drip and bonus are untouched', JSON.stringify(moneyNow()) === JSON.stringify(before) && moneyNow().balanceC === 0);
ok('very long text is capped at 80 characters', (addWin('2026-10-24', 'x'.repeat(200), true), S.wins[2].label.length === 80));
_setFakeNow(new Date('2026-10-24T09:00:00').getTime());
ok('yesterday works before noon', addWin('2026-10-23', 'Stayed calm', false));
_setFakeNow(new Date('2026-10-24T14:00:00').getTime());
ok('...and locks after noon', addWin('2026-10-23', 'late', false) === false);
ok('the Today strip shows only this week\'s wins', weekWinLabels().includes('Walked the dog') && !weekWinLabels().includes('x'.repeat(80)) === false);
S.wins.push({ id: 'old', dk: '2026-09-01', label: 'last month win' });
ok('older wins stay in history but not on the weekly strip', !weekWinLabels().includes('last month win') && S.wins.some(w => w.label === 'last month win'));
deleteWin(S.wins[0].id);
ok('a win can be deleted', S.wins.length === 4 && !S.wins.some(w => w.label === 'Walked the dog'));

// ================= Weight =================
world('2026-10-24T13:00:00');
ok('log today', logWeight('2026-10-24', 199.46) && S.weight.logs['2026-10-24'] === 199.5);
ok('absurd values are refused', logWeight('2026-10-24', 5) === false && logWeight('2026-10-24', 'abc') === false && logWeight('2026-10-24', 5000) === false && S.weight.logs['2026-10-24'] === 199.5);
_setFakeNow(new Date('2026-10-24T09:00:00').getTime());
ok('yesterday loggable before noon, locked after', logWeight('2026-10-23', 200) && (_setFakeNow(new Date('2026-10-24T12:30:00').getTime()), logWeight('2026-10-23', 201) === false) && S.weight.logs['2026-10-23'] === 200);
ok('weight never touches money', moneyNow().balanceC === 0 && moneyNow().unlockedC === 0);
// 12-week averages with a gap
world('2026-10-24T13:00:00');
const put = (dk, v) => { S.weight.logs[dk] = v; };
put('2026-10-19', 200); put('2026-10-21', 202);       // this week (Mon 19): avg 201
put('2026-10-12', 204);                                // last week
put('2026-10-05', 206);                                // 2 weeks back
// 3 weeks back (Sep 28) empty -> gap
put('2026-09-23', 210);                                // 4 weeks back (Mon Sep 21)
const wk = weekAverages(12);
ok('12 weekly buckets, oldest first, last is this week', wk.length === 12 && wk[11].ws === '2026-10-19' && wk[0].ws === '2026-08-03');
ok('this week averages to 201.0', wk[11].avg === 201 && wk[11].n === 2);
ok('weeks with no weigh-in are null (shown dashed)', wk[8].avg === null && wk[7].avg === 210 && wk[9].avg === 206);
const chart = weightChartHTML();
ok('chart draws a dashed bridge across the empty week and solid lines elsewhere', chart.includes('stroke-dasharray') && (chart.match(/<line [^>]*stroke="#1F5F3A"/g) || []).length === 3 && (chart.match(/<circle/g) || []).length === 4);
world('2026-10-24T13:00:00'); put('2026-10-20', 200);
ok('under two weeks of data: a friendly empty state, no broken chart', weightChartHTML().includes('two or more different weeks'));
world('2026-10-24T13:00:00');
put('2026-10-01', 210); put('2026-10-15', 208); put('2026-09-10', 214); put('2026-09-20', 212); put('2026-08-05', 218);
const ma = monthAverages(6);
ok('monthly averages, newest first, with counts', ma.length === 3 && ma[0].ym === '2026-10' && ma[0].avg === 209 && ma[0].n === 2 && ma[1].avg === 213 && ma[2].ym === '2026-08');
ok('latest weight + first weight', latestWeight().val === 208 && latestWeight().first === 218);
let threw = null; try { render(); weightHTML(); } catch (e) { threw = e; console.log(e); }
ok('weight page renders', !threw && weightHTML().includes('Last 12 weeks') && weightHTML().includes('Monthly averages') && weightHTML().includes('never earns or costs anything'));
ok('weight page can scroll (only Today may not)', weightHTML().includes('scrolly') && !todayHTML().includes('scrolly'));

// ================= Wind-down vs lights-out =================
world('2026-10-24T13:00:00');
const wd = (dk, what, lights, len) => { S.days[dk] = { workout: null, foods: [], windDown: { what, len: len || '20m', lights } }; };
wd('2026-10-01', ['Reading'], '9:30'); wd('2026-10-02', ['Reading'], '10:00'); wd('2026-10-03', ['Reading', 'LEGO'], '10:00');
wd('2026-10-04', ['Phone puzzle'], 'Later'); wd('2026-10-05', ['Phone puzzle'], '10:30'); wd('2026-10-06', ['Phone puzzle'], 'Later');
wd('2026-10-07', ['LEGO'], '10:30');
let wi = windInsights();
ok('counts logs and early (<= 10:00) nights', wi.total === 7 && wi.earlyAll === 3);
const reading = wi.items.find(i => i.name === 'Reading'), phone = wi.items.find(i => i.name === 'Phone puzzle');
ok('Reading lines up with early lights-out (3 of 3); Phone puzzle with late (0 of 3)', reading.n === 3 && reading.early === 3 && phone.n === 3 && phone.early === 0);
ok('best pairing is listed first', wi.items[0].name === 'Reading');
ok('plain-language note names the best pairing', /reading/.test(wi.note) && /3 of 3/.test(wi.note) && /best pairing/.test(wi.note));
world('2026-10-24T13:00:00'); wd('2026-10-01', ['Reading'], '9:30');
ok('too little data: the note says so instead of guessing', /Log a few wind-downs/.test(windInsights().note));

// ================= History =================
world('2026-10-24T13:00:00', '2026-10-01');
S.days['2026-10-20'] = { workout: { kind: 'workout', what: 'Kettlebell', len: '20–40', hard: 'Hard' }, windDown: { what: ['Reading', 'LEGO'], len: '30m', lights: '10:00' }, foods: FOOD(150, 8) };
S.wins.push({ id: 'w', dk: '2026-10-20', label: 'Cooked dinner' });
S.pauses.push({ id: 'p', habit: 'wind', from: '2026-10-12', to: '2026-10-14', why: 'Travel', back: 'The bonus' });
S.freeDays = ['2026-12-25'];
S.comeback = { from: '2026-09-20', gapDays: 10, firstLog: '2026-10-20' }; S.imported = { from: 'v1' };
S.spends.push({ id: 's', dk: '2026-10-22', cents: 500, cat: 'LEGO' });
threw = null; try { openHistory(); histPick('2026-10-20'); histNav(-1); histNav(1); histPick('2026-10-20'); renderHistoryOver(); } catch (e) { threw = e; console.log(e); }
ok('History opens, navigates months, selects a day without throwing', !threw && OV === 'history');
const h = historyHTML();
ok('shows the day detail: workout what/len/hard, protein, wind-down with lights-out', h.includes('Kettlebell · 20–40 · Hard') && h.includes('150 g of 150') && h.includes('Reading, LEGO · 30m · lights out 10:00') && h.includes('8 g of 25'));
ok('shows that day\'s win and the comeback marker', h.includes('Cooked dinner') && h.includes('comeback day'));
ok('shows the gap note', h.includes('Gap from') && h.includes('10 days'));
ok('has money, spending, pause trends, wind-down, free-day sections', ['>Money<', '>Spending<', '>Pause trends<', 'Wind-down and lights-out', '>Free days<'].every(x => h.includes(x)));
ok('pause trends list the reason and habit', h.includes('Travel') && h.includes('Wind down'));
ok('spend history lists the spend with a delete only for this month', h.includes('LEGO') && h.includes('histDelSpend'));
ok('free days show the allowance', h.includes('9 of 10 left in 2026') || h.includes('10 of 10 left in 2026'));
histYm = '2026-10'; histSel = null;
ok('next-month arrow is disabled on the current month', historyHTML().includes('disabled style="opacity:.3"'));
// adding / removing free days through the UI handlers
document.getElementById('freeIn').value = '2026-10-24';
histAddFree();
ok('adding a free day for today shows the "in advance" error', freeErr.includes('in advance'));
document.getElementById('freeIn').value = '2026-11-26';
histAddFree();
ok('adding Thanksgiving works and clears the error', S.freeDays.includes('2026-11-26') && freeErr === '');
histRemoveFree('2026-11-26');
ok('...and it can be removed again', !S.freeDays.includes('2026-11-26'));
histDelSpend('s');
ok('this month\'s spend can be deleted from history', S.spends.length === 0);
// win sheet flow
openWin(); winOther(); document.getElementById('winText').value = 'Fixed the gate'; winSaveOther();
ok('Other flow through the sheet adds the win', S.wins.some(w => w.label === 'Fixed the gate'));
openWin(); winPick(0);
ok('preset flow through the sheet adds the win', S.wins.some(w => w.label === WIN_PRESETS[0]));
closeOver();
