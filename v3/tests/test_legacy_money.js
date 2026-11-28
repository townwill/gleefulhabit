// The 2.0 spending money is retired: its history stays, nothing new is earned from 30 Nov.
const ok = (name, cond) => console.log(name + ':', !!cond);
const fresh = (now) => { localStorage.clear(); _setFakeNow(new Date(now).getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; TAB = 'today'; };
const seedAll = dk => { S.days[dk] = { workout: { kind: 'workout', what: 'Bike', len: '20–40', hard: 'Solid', at: 1 }, windDown: { what: ['Reading'], len: '20m', lights: '10:00' }, foods: [{ id: 'f' + dk, label: 'x', protein: 160, sugar: 2, src: 'manual' }] }; };

fresh('2026-11-20T12:00:00');
for (let d = 1; d <= 19; d++) seedAll('2026-11-' + String(d).padStart(2, '0'));
const early = moneyFor('2026-11');
ok('November still has its money before the cut-off', early.dripC > 0 || early.cents > 0 || JSON.stringify(early).length > 20);

// the same November, looked at from December
const novBefore = dripFor('2026-11');
_setFakeNow(new Date('2026-12-05T12:00:00').getTime());
ok('legacyNow never goes past 29 Nov', legacyNow() === '2026-11-29');
ok('November money after the cut-off does not grow just because time passed', Math.abs(dripFor('2026-11') - novBefore) < 1e-9);
ok('December pays no days at all', payableDays('2026-12') === 0 && payableDays('2027-01') === 0);
seedAll('2026-12-02'); seedAll('2026-12-03');
ok('perfect December days earn no drip', dripFor('2026-12') === 0);
ok('...and no bonuses', bonusEvents().every(e => e.dk <= LEGACY_END));
const dec = moneyFor('2026-12');
ok('moneyFor December is zero', dripFor('2026-12') === 0 && payableDays('2026-12') === 0);
ok('nothing about earnings is shown on Today', earnedTxt() === '' && !/\$\d/.test(todayHTML()));

// closing months
S.months = {};
closeMonths();
ok('only months up to November are ever closed', Object.keys(S.months).every(ym => ym <= '2026-11'));
ok('December is never frozen', !S.months['2026-12']);
ok('the app records the retired data in History without the spend tools', (() => { histYm = '2026-11'; const h = historyHTML(); return /retired/i.test(h) && !/Add spend|addSpend/.test(h); })());
ok('the spend functions are gone', typeof addSpend === 'undefined' && typeof deleteSpend === 'undefined' && typeof winPays === 'undefined' && typeof welcomeOfferC === 'undefined');

// habit state for old days still uses the 4 old habits (Less sugar)
fresh('2026-12-05T12:00:00');
S.days['2026-11-10'] = { workout: null, windDown: null, foods: [{ id: 'a', label: 'x', protein: 10, sugar: 3, src: 'manual' }] };
ok('an old day\'s level is judged by the old four habits', typeof dayLevel === 'function' && dayLevel('2026-11-10') !== undefined);
ok('Less sugar still reads for old days (History) but is not a habit now', habitState('sugar', '2026-11-10') && HABITS.indexOf('sugar') < 0);
