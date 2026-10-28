// Day check + Suggest. fetch is faked; nothing touches the network.
const ok = (name, cond) => console.log(name + ':', !!cond);
const tick = () => new Promise(r => setTimeout(r, 20));
const T = () => todayKey();
function world(now) { localStorage.clear(); _setFakeNow(new Date(now || '2026-10-26T22:00:00').getTime()); S = blankState(); S.startDate = '2026-10-01'; closeSheet(); OV = null; keyOpen = false; DC = dcFresh(); localStorage.setItem('gh_ai_key', 'sk-test'); navigator.onLine = true; }
/* put today's food on the board; optional fiber / sat fat sit on the first entry (blank = unknown) */
function day(dk, { p = 0, s = 0, fiber = null, sat = null, entries = 1 } = {}) {
  const foods = [];
  for (let i = 0; i < entries; i++) {
    const f = { id: 'f' + i, label: 'food ' + i, protein: i === 0 ? p : 0, sugar: i === 0 ? s : 0, src: 'manual' };
    if (i === 0 && fiber !== null) f.fiber = fiber;
    if (i === 0 && sat !== null) f.satFat = sat;
    foods.push(f);
  }
  S.days[dk] = { workout: null, windDown: null, foods };
  S.mealChecks = S.mealChecks.filter(c => c.date !== dk);
}
let calls = [], reply = null;
const resp = body => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }] }), text: async () => '' });
fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return typeof reply === 'function' ? reply() : resp(reply); };

(async () => {
  // ================= Readings and levels =================
  world();
  ok('goal readings: met = green, 75% = yellow, below = red (protein 150, fiber 30)', dayReadingLevel('protein', 150, 150) === 'g' && dayReadingLevel('protein', 113, 150) === 'y' && dayReadingLevel('protein', 112, 150) === 'r' && dayReadingLevel('fiber', 30, 30) === 'g' && dayReadingLevel('fiber', 23, 30) === 'y' && dayReadingLevel('fiber', 22, 30) === 'r');
  ok('limit readings: within = green, up to 25% over = yellow, beyond = red (sugar 25, sat fat 18)', dayReadingLevel('sugar', 25, 25) === 'g' && dayReadingLevel('sugar', 25.1, 25) === 'y' && dayReadingLevel('sugar', 31.25, 25) === 'y' && dayReadingLevel('sugar', 31.3, 25) === 'r' && dayReadingLevel('satFat', 18, 18) === 'g' && dayReadingLevel('satFat', 22.5, 18) === 'y' && dayReadingLevel('satFat', 22.6, 18) === 'r');
  day(T(), { p: 100, s: 12 });
  let c = dayCheck(T());
  ok('totals come from everything logged (protein, sugar)', c.vals.protein === 100 && c.vals.sugar === 12 && c.foods === 1);
  ok('with no Meal Check meal, fiber and sat fat are UNKNOWN (null), not 0', c.levels.fiber === null && c.levels.satFat === null && c.tracked === false);
  day(T(), { p: 100, s: 12, fiber: 18, sat: 5 });
  c = dayCheck(T());
  ok('with fiber and sat fat on an entry they become known', c.tracked === true && c.vals.fiber === 18 && c.vals.satFat === 5 && c.levels.fiber === 'r' && c.levels.satFat === 'g');
  S.mealChecks = [{ id: 'cx', date: T(), ts: 1, mealName: 'm', verdict: 'green', protein_g: 0, added_sugar_g: 0, fiber_g: 9, sat_fat_g: 9, logged: false }];
  ok('a meal that was checked but NOT logged does not count', dayCheck(T()).vals.fiber === 18 && dayCheck(T()).vals.satFat === 5);
  S.mealChecks = [];
  // legacy: an older Check-a-meal entry with no numbers of its own reads them from its linked check, exactly once
  S.days[T()] = { workout: null, windDown: null, foods: [{ id: 'g1', label: 'old', protein: 10, sugar: 1, src: 'check', mc: 'c9' }] };
  S.mealChecks = [{ id: 'c9', date: T(), ts: 1, mealName: 'm', verdict: 'green', protein_g: 10, added_sugar_g: 1, fiber_g: 7, sat_fat_g: 3, logged: true }];
  ok('legacy mc-linked entry still counts via its check, once', dayCheck(T()).vals.fiber === 7 && dayCheck(T()).vals.satFat === 3 && dayCheck(T()).tracked === true);
  S.days[T()].foods[0].fiber = 7; S.days[T()].foods[0].satFat = 3;
  ok('...and no double count once the entry carries its own numbers', dayCheck(T()).vals.fiber === 7 && dayCheck(T()).vals.satFat === 3);
  S.mealChecks = [];
  day(T(), { p: 100, s: 12, fiber: 0, sat: 0 });
  ok('a real 0 is KNOWN (not unknown)', dayCheck(T()).tracked === true && dayCheck(T()).levels.fiber === 'r' && dayCheck(T()).levels.satFat === 'g');

  // ================= Verdict =================
  const verdict = (o) => { day(T(), o); return dayCheck(T()); };
  ok('NOTHING LOGGED: no verdict, says so', (delete S.days[T()], dayCheck(T()).verdict === null && dayCheck(T()).label === 'Nothing logged yet'));
  ok('all four green -> GREEN "Good so far"', verdict({ p: 150, s: 10, fiber: 30, sat: 8 }).verdict === 'green' && dayCheck(T()).label === 'Good so far');
  ok('three green + one yellow (protein 120) -> GREEN', verdict({ p: 120, s: 10, fiber: 30, sat: 8 }).verdict === 'green');
  ok('three green + one RED protein/fiber -> YELLOW, not red and not green (it is early in the day, not a rule broken)', verdict({ p: 30, s: 10, fiber: 30, sat: 8 }).verdict === 'yellow' && verdict({ p: 150, s: 10, fiber: 5, sat: 8 }).verdict === 'yellow');
  ok('two yellow -> YELLOW "Okay so far"', verdict({ p: 120, s: 28, fiber: 30, sat: 8 }).verdict === 'yellow' && dayCheck(T()).label === 'Okay so far');
  ok('added sugar far over -> RED even with everything else green', verdict({ p: 150, s: 40, fiber: 30, sat: 8 }).verdict === 'red' && dayCheck(T()).label === 'Rough so far');
  ok('sat fat far over -> RED even with everything else green', verdict({ p: 150, s: 5, fiber: 30, sat: 25 }).verdict === 'red');
  ok('a limit a little over (sugar 27 g, or sat fat 18.8 of 18 g) with the other three green is still Good, like a meal', verdict({ p: 150, s: 27, fiber: 30, sat: 8 }).verdict === 'green' && verdict({ p: 150, s: 10, fiber: 30, sat: 20 }).verdict === 'green' && verdict({ p: 162.9, s: 16, fiber: 41.7, sat: 18.8 }).verdict === 'green');
  ok('...but two things off is Okay (sugar over AND sat fat over), and more than 25% over is Rough', verdict({ p: 150, s: 27, fiber: 30, sat: 20 }).verdict === 'yellow' && verdict({ p: 150, s: 32, fiber: 30, sat: 8 }).verdict === 'red');
  ok('protein + sugar both great but fiber / sat fat UNTRACKED -> capped at "Okay", flagged', (c = verdict({ p: 150, s: 5 }), c.verdict === 'yellow' && c.capped === true && c.tracked === false));
  ok('sugar red still shows RED even when fiber is untracked', verdict({ p: 150, s: 40 }).verdict === 'red');
  ok('protein only, nothing else known and sugar fine -> okay (never a free "Good")', verdict({ p: 20, s: 0 }).verdict === 'yellow');
  ok('a PAST day has no "so far" and reads as final', (day('2026-10-25', { p: 150, s: 10, fiber: 30, sat: 8 }), dayCheck('2026-10-25').label === 'Good'));
  S.settings.fiberGoal = 24; S.settings.satFatGoal = 10;
  ok('editing the fiber / sat-fat goals moves the day bands too', verdict({ p: 150, s: 10, fiber: 24, sat: 8 }).verdict === 'green' && (S.settings.satFatGoal = 7, dayCheck(T()).levels.satFat === 'y'));
  world();

  // ================= Pace: a day still in progress is judged against the time of day =================
  const at = (h, m) => { world('2026-10-26T' + String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0') + ':00'); };
  at(13, 40); ok('dayPace: 1:40pm is a little past half the day', dayPace(T()) > 0.5 && dayPace(T()) < 0.6);
  ok('dayPace: before 6am nothing is expected, from 9pm all of it, past days always 1', (at(5), dayPace(T()) === 0) && (at(21), dayPace(T()) === 1) && (at(23), dayPace(T()) === 1) && dayPace('2026-10-25') === 1);
  ok('dayReadingLevel with pace: on pace = green, behind = yellow, never red while the day is open', dayReadingLevel('protein', 100, 150, 0.5) === 'g' && dayReadingLevel('protein', 60, 150, 0.5) === 'y' && dayReadingLevel('fiber', 1, 30, 0.9) === 'y' && dayReadingLevel('protein', 60, 150, 1) === 'r');
  at(13, 40); day(T(), { p: 106, s: 1, fiber: 7, sat: 14.5 });
  c = dayCheck(T());
  ok("YOUR 1:40pm DAY (sat fat limit 18 g): protein green (106 g is ahead of pace), sugar green, fiber yellow, sat fat green -> GREEN 'Good so far'", c.levels.protein === 'g' && c.levels.sugar === 'g' && c.levels.fiber === 'y' && c.levels.satFat === 'g' && c.verdict === 'green' && c.label === 'Good so far');
  at(22); day(T(), { p: 106, s: 1, fiber: 7, sat: 14.5 });
  c = dayCheck(T());
  ok('the same numbers at 10pm are judged against the full goals: protein and fiber red', c.levels.protein === 'r' && c.levels.fiber === 'r');
  at(13, 40); day(T(), { p: 90, s: 5, fiber: 18, sat: 6 });
  ok('on pace for everything and limits fine -> GREEN "Good so far" at lunchtime', dayCheck(T()).verdict === 'green' && dayCheck(T()).label === 'Good so far');
  day(T(), { p: 106, s: 1, fiber: 7, sat: 5 });
  const sgp = daySuggestion(T());
  ok('suggestion calls on-pace protein "on pace", not "good" and not a gap', sgp.headline === 'Your protein is on pace, but you need more fiber.' && !sgp.lines.some(l => /^Protein/.test(l)));
  day(T(), { p: 106, s: 1 });
  ok('with fiber unknown, protein on pace reads "on pace"', daySuggestion(T()).headline === "You're on pace for protein.");
  ok('the card row says "On pace · 44 g to go"', (protDay = T(), /On pace · 44 g to go/.test(dayCardInner())));
  at(22); day(T(), { p: 106, s: 1 });
  ok('...and at night the same protein is just "44 g to go", a gap', !/On pace/.test(dayCardInner()) && daySuggestion(T()).headline === 'You still need more protein.');
  at(13, 40); day(T(), { p: 90, s: 5, fiber: 18, sat: 6 }); reply = { idea: 'x' }; calls = [];
  await requestDayIdea(T(), []);
  ok('the AI idea is told what time it is', /Today so far \(1:40 pm\)/.test(calls[0].body.messages[0].content[0].text));
  world();

  // ================= The Suggest text (your example, word for word) =================
  day(T(), { p: 150, s: 11, fiber: 12, sat: 5 });
  let sg = daySuggestion(T());
  ok('"your protein is good but you need more fiber" ...', sg.headline === 'Your protein is good, but you need more fiber.');
  ok('...with the gap and the sugar left, "treat yo self"', sg.lines.includes('Fiber: 18 g to go.') && sg.lines.includes('You have 14 g of added sugar left — treat yo self.') && sg.treat === true);
  day(T(), { p: 90, s: 8, fiber: 10, sat: 4 });
  sg = daySuggestion(T());
  ok('two gaps are listed together', sg.headline === 'You still need more protein and fiber.' && sg.lines.includes('Protein: 60 g to go.') && sg.lines.includes('Fiber: 20 g to go.'));
  day(T(), { p: 150, s: 5, fiber: 31, sat: 5 });
  sg = daySuggestion(T());
  ok('everything met -> "on target" for both', sg.headline === "You're on target for protein and fiber." && sg.lines.includes('You have 20 g of added sugar left — treat yo self.'));
  day(T(), { p: 150, s: 21, fiber: 31, sat: 5 });
  ok('under 5 g of sugar left: a gentler line, no "treat yo self"', daySuggestion(T()).lines.includes("Only 4 g of added sugar left — save it for something you'll love.") && daySuggestion(T()).treat === false);
  day(T(), { p: 150, s: 30, fiber: 31, sat: 5 });
  ok('over on sugar: honest, no treat', daySuggestion(T()).lines.includes("You're 5 g over on added sugar — keep it easy for the rest of the day.") && daySuggestion(T()).treat === false);
  day(T(), { p: 150, s: 5, fiber: 31, sat: 20 });
  ok('sat fat over: points to olive oil, nuts and beans', daySuggestion(T()).lines.some(l => /olive oil, nuts and beans/.test(l)));
  day(T(), { p: 150, s: 5, fiber: 31, sat: 16 });
  ok('sat fat nearly used up is flagged', daySuggestion(T()).lines.includes('Only 2 g of sat fat left.'));
  day(T(), { p: 100, s: 3 });
  sg = daySuggestion(T());
  ok('fiber untracked: it says so instead of guessing, and does not pretend fiber is the gap', /Snap meal, Say it or Check a meal/.test(sg.lines.join(' ')) && sg.headline === 'You still need more protein.');
  ok('...and protein good + fiber untracked reads sensibly', (day(T(), { p: 150, s: 3 }), daySuggestion(T()).headline === "You're on target for protein."));
  delete S.days[T()];
  ok('nothing logged: a friendly nudge', daySuggestion(T()).headline.startsWith('Nothing logged yet') && daySuggestion(T()).lines.length === 0);

  // ================= The AI idea =================
  world(); day(T(), { p: 150, s: 11, fiber: 12, sat: 5 });
  const IDEA1 = { idea: 'A cup of lentil soup with a slice of seeded toast for 15 g fiber' }, IDEA2 = { idea: 'Two squares of dark chocolate with almonds' };
  ok('parseIdeaJSON: plain / fenced / prose all work; junk -> null', parseIdeaJSON(JSON.stringify(IDEA1)) === IDEA1.idea && parseIdeaJSON('```json\n' + JSON.stringify(IDEA2) + '\n```') === IDEA2.idea && parseIdeaJSON('Here: {"idea":"oats"} done') === 'oats' && parseIdeaJSON('{"idea":') === null && parseIdeaJSON('{"idea":"  "}') === null && parseIdeaJSON('[]') === null && parseIdeaJSON('nope') === null && parseIdeaJSON(null) === null);
  ok('a long idea is capped at 140', parseIdeaJSON(JSON.stringify({ idea: 'x'.repeat(400) })).length === 140);

  OV = 'protein'; protDay = T();
  ok('the card shows four readings, the verdict, and a Suggest button on today', (() => { const h = dayCardInner(); return ['Protein', 'Added sugar', 'Fiber', 'Sat fat'].every(x => h.includes('<b>' + x + '</b>')) && h.includes('Okay so far') && h.includes('>Suggest something<'); })());
  ok('no suggestion panel until you tap', !dayCardInner().includes('dsug'));
  reply = IDEA1; calls = [];
  const p = onDaySuggest();
  ok('(instant) the local advice shows straight away, before any network answer', DC.open === true && DC.busy === true && dayCardInner().includes('Your protein is good, but you need more fiber.') && dayCardInner().includes('treat yo self') && dayCardInner().includes('Thinking of something to eat'));
  await p;
  ok('SUGGEST asks the model for ONE idea: right prompt, 120 tokens, today\'s numbers, what to avoid', calls.length === 1 && /ONE specific food/.test(calls[0].body.system) && calls[0].body.max_tokens === 120 && /protein 150 of 150 g/.test(calls[0].body.messages[0].content[0].text) && /fiber 12 of 30 g/.test(calls[0].body.messages[0].content[0].text) && /11 of 25 g \(14 g left\)/.test(calls[0].body.messages[0].content[0].text) && /do not repeat\): none/.test(calls[0].body.messages[0].content[0].text));
  ok('...and shows the idea under the advice with an Another idea button', DC.idea === IDEA1.idea && dayCardInner().includes('<b>Try:</b> ' + IDEA1.idea) && dayCardInner().includes('>Another idea<'));
  reply = IDEA2; calls = []; await (onDayAnother(), tick());
  ok('ANOTHER IDEA gives a different one and tells the model the first', DC.idea === IDEA2.idea && calls.length === 1 && calls[0].body.messages[0].content[0].text.includes(IDEA1.idea));
  reply = IDEA2; calls = []; onDayAnother(); await tick();
  ok('a repeat is refused politely and the current idea stays', DC.idea === IDEA2.idea && dayCardInner().includes('Same idea again'));
  onDayAnother(); onDayAnother(); onDayAnother(); await tick();
  ok('double taps while it thinks make one request', calls.length === 2);   // 1 (repeat above) + 1 (this burst)
  ok('Hide closes the panel', (onDaySuggest(), DC.open === false && !dayCardInner().includes('dsug')) );

  // staleness: logging something collapses an old suggestion
  reply = IDEA1; await onDaySuggest();
  ok('(setup) panel open with an idea', DC.open && DC.idea === IDEA1.idea);
  day(T(), { p: 150, s: 11, fiber: 30, sat: 5 });
  ok('after you log more, the old suggestion is dropped instead of going stale', dayCardInner().includes('>Suggest something<') && !dayCardInner().includes('dsug') && DC.open === false);
  // logged while thinking
  let slow; reply = () => new Promise(res => { slow = res; });
  const q = onDaySuggest(); day(T(), { p: 150, s: 11, fiber: 12, sat: 5 }); dayCardInner(); slow(resp(IDEA2)); await q;
  ok('logging while it is still thinking: the late answer is discarded, no crash', DC.idea === null && DC.open === false);

  // failures: local advice always stays
  const fails = async (r, text, label) => { world(); day(T(), { p: 150, s: 11, fiber: 12, sat: 5 }); OV = 'protein'; protDay = T(); reply = r; await onDaySuggest(); const h = dayCardInner(); ok(label, h.includes('treat yo self') && h.includes(text) && DC.busy === false && !h.includes('<b>Try:</b>')); };
  await fails('{"idea":', "Couldn&#39;t get a food idea", 'malformed JSON: advice stays, calm note, no crash');
  await fails(() => { throw new Error('x'); }, "Couldn&#39;t get a food idea", 'network failure: same');
  await fails(() => ({ ok: false, status: 500, json: async () => ({}) }), "Couldn&#39;t get a food idea", '500: same');
  await fails(() => ({ ok: false, status: 401, json: async () => ({}) }), 'API key rejected', '401: key rejected');
  world(); day(T(), { p: 150, s: 11, fiber: 12, sat: 5 }); OV = 'protein'; protDay = T(); navigator.onLine = false; calls = []; await onDaySuggest();
  ok('OFFLINE: the advice still shows, with a note, and no request', dayCardInner().includes('treat yo self') && dayCardInner().includes('Needs a connection') && calls.length === 0);
  navigator.onLine = true; world(); day(T(), { p: 150, s: 11, fiber: 12, sat: 5 }); OV = 'protein'; protDay = T(); localStorage.removeItem('gh_ai_key'); calls = []; await onDaySuggest();
  ok('NO KEY: the advice still shows, with a hint to add a key, and no request', dayCardInner().includes('treat yo self') && dayCardInner().includes('Add your API key') && calls.length === 0 && !dayCardInner().includes('>Another idea<'));

  // ================= Yesterday + page integration =================
  world(); day(addDays(T(), -1), { p: 140, s: 12, fiber: 20, sat: 6 }); OV = 'protein'; protDay = addDays(T(), -1);
  ok('YESTERDAY: the card shows the final verdict (no "so far") and no Suggest button', dayCardInner().includes('Okay') && !dayCardInner().includes('so far') && !dayCardInner().includes('Suggest something'));
  protDay = T(); day(T(), { p: 100, s: 3 });
  ok('the Snap / Say / Check buttons keep their place: the full card sits below the add area, just above the food list', (() => { const h = proteinOverHTML(); return h.indexOf('Snap meal') < h.indexOf('id="dayCard"') && h.indexOf('manualAdd()') < h.indexOf('id="dayCard"') && h.indexOf('id="dayCard"') < h.indexOf('>Food today<'); })());
  ok('a verdict chip under the ring shows the day at a glance and jumps to the card', (() => { const h = proteinOverHTML(); return h.indexOf('class="daychip"') > h.indexOf('Small at') && h.indexOf('class="daychip"') < h.indexOf('Snap meal') && h.includes('Okay so far') && /onclick="jump(Day|Why)\(\)"/.test(h); })());
  ok('nothing logged -> no chip (nothing to say yet)', (delete S.days[T()], !proteinOverHTML().includes('class="daychip"')));
  day(T(), { p: 100, s: 3 });
  ok('opening the Protein page starts with no suggestion open', (DC.open = true, openProtein(), DC.open === false));
  ok('the main page is untouched: still 4 habits, no day card, no Suggest', todayModel().habits.length === 4 && !todayHTML().includes('dayCard') && !todayHTML().includes('Suggest something') && !todayHTML().includes('daychip'));
  ok('"Check a meal", Snap meal, Say it are all still there', ['Snap meal', 'Say it', 'Check a meal'].every(x => proteinOverHTML().includes(x)));

  // ================= It stores nothing and pays nothing =================
  world(); day(T(), { p: 150, s: 11, fiber: 12, sat: 5 }); OV = 'protein'; protDay = T();
  const before = JSON.stringify(S), money0 = JSON.stringify(moneyNow());
  reply = IDEA1; await onDaySuggest(); onDayAnother(); await tick(); dayCheck(T()); daySuggestion(T());
  ok('running the day check, Suggest and Another idea changes NOTHING in saved state', JSON.stringify(S) === before);
  ok('...and pays nothing', JSON.stringify(moneyNow()) === money0);
  ok('no new top-level state fields (so nothing to migrate)', Object.keys(S).sort().join() === Object.keys(migrateState(JSON.parse(before))).sort().join());
  const threw = (() => { try { for (const d of [T(), addDays(T(), -1), '2020-01-01']) { protDay = d; dayCardInner(); } DC.open = true; DC.busy = true; protDay = T(); dayCardInner(); DC.note = '<b>x</b>'; ok('notes are HTML-escaped', !dayCardInner().includes('<b>x</b>')); return null; } catch (e) { return e; } })();
  ok('the card renders for today, yesterday and an empty old day without throwing', !threw);
})().catch(e => { console.log('UNCAUGHT', e && e.stack); });
