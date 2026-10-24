const fs = require('fs'), path = require('path');
const { run, check, done } = require('./harness');

const SETUP = `
  S.habits.push({id:'w',name:'Workout',type:'boolean',icon:'💪',color:'cyan',createdAt:'2026-09-01',restEligible:true});
  S.habits.push({id:'s',name:'Less Sugar',type:'boolean',icon:'🍬',color:'rose',createdAt:'2026-09-01'});
  S.habits.push({id:'c',name:'Calories',type:'boolean',icon:'🔥',color:'orange',createdAt:'2026-09-01'});
  S.habits.push({id:'p',name:'Protein',type:'numeric',target:150,unit:'g',icon:'🍗',color:'lime',createdAt:'2026-09-01'});
`;
const NOW = '2026-10-07T12:00:00';

function aiReply(payload, captured) {
  return async (url, o) => {
    captured.push({ url, body: JSON.parse(o.body) });
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }), text: async () => '' };
  };
}

(async () => {
  console.log('fuel: defaults + migration');
  {
    const sb = run({ now: NOW }, `
      OUT.blank = JSON.stringify(S.user.fuelTargets);
      OUT.old = JSON.stringify(migrateState({habits:[],logs:{},user:{xp:5,badges:[]}}).user.fuelTargets);
      OUT.partial = JSON.stringify(migrateState({habits:[],logs:{},user:{xp:5,badges:[],fuelTargets:{fiber:35}}}).user.fuelTargets);
      OUT.fn = [fuelTarget('fiber'),fuelTarget('satFat'),fuelTarget('sugar')].join(',');
    `);
    check('blank state has default targets', sb.OUT.blank === '{"fiber":30,"satFat":13,"sugar":15}', sb.OUT.blank);
    check('old backup migrates to defaults', sb.OUT.old === '{"fiber":30,"satFat":13,"sugar":15}', sb.OUT.old);
    check('partial targets keep user value, fill the rest', sb.OUT.partial === '{"fiber":35,"satFat":13,"sugar":15}', sb.OUT.partial);
    check('fuelTarget() accessors', sb.OUT.fn === '30,13,15', sb.OUT.fn);
  }

  console.log('fuel: unknown is not zero');
  {
    const sb = run({ now: NOW }, SETUP + `
      const tk = todayKey();
      S.logEntries[tk] = {p:[
        {amt:30,label:'old entry, no fiber field'},     // unknown
        {amt:25,label:'real zero',fiber:0,satFat:0},     // known zero
        20,                                              // plain manual number: unknown
        {amt:40,label:'oatmeal',fiber:4.5,satFat:1.2},   // known
      ]};
      OUT.fiber = macroTotalOn('p',tk,'fiber');
      OUT.sat = macroTotalOn('p',tk,'satFat');
      OUT.sugarNone = macroTotalOn('p',tk,'sugar');
      OUT.emptyDay = macroTotalOn('p','2026-01-01','fiber');
      OUT.html = fuelBarsHTML(S.habits[3], colorOf('lime'));
      OUT.vals = [macroVal(0,1),macroVal(-1,1),macroVal(NaN,1),macroVal('3',1),macroVal(null,1),macroVal(undefined,1),macroVal(2.26,1),macroVal(99.6,0)];
    `);
    check('fiber: sum 4.5, 2 known, 2 unknown', sb.OUT.fiber.sum === 4.5 && sb.OUT.fiber.known === 2 && sb.OUT.fiber.unknown === 2, sb.OUT.fiber);
    check('sat fat: sum 1.2, 2 known of 4', sb.OUT.sat.sum === 1.2 && sb.OUT.sat.known === 2 && sb.OUT.sat.total === 4, sb.OUT.sat);
    check('sugar: nothing known, all 4 unknown (not 0g)', sb.OUT.sugarNone.known === 0 && sb.OUT.sugarNone.unknown === 4, sb.OUT.sugarNone);
    check('empty day has no unknowns', sb.OUT.emptyDay.total === 0 && sb.OUT.emptyDay.unknown === 0, sb.OUT.emptyDay);
    check('bars call out entries without data', sb.OUT.html.includes('+2 entries without fiber data') && sb.OUT.html.includes('+4 entries without added sugar data'));
    check('macroVal: 0 is real, junk is undefined', sb.OUT.vals[0] === 0 && sb.OUT.vals.slice(1, 6).every(v => v === undefined) && sb.OUT.vals[6] === 2.3 && sb.OUT.vals[7] === 100, sb.OUT.vals);
  }

  console.log('fuel: storing entries keeps real zeros');
  {
    const sb = run({ now: NOW }, SETUP + `
      addNumCore('p',30,'black coffee',{sugar:0,calories:0,carbs:0,fat:0,fiber:0,satFat:0});
      addNumCore('p',20,'mystery',{sugar:undefined,fiber:undefined,satFat:undefined,calories:300});
      addNumCore('p',10,'junk',{sugar:-3,fiber:NaN,satFat:'5',calories:Infinity});
      addNumCore('p',5,null);
      const e = S.logEntries[todayKey()].p;
      OUT.e0 = JSON.stringify(e[0]); OUT.e1 = JSON.stringify(e[1]); OUT.e2 = JSON.stringify(e[2]); OUT.e3 = JSON.stringify(e[3]);
      rememberFood('Black coffee',30,{sugar:0,fiber:0,satFat:0,calories:5});
      rememberFood('Mystery',20,{calories:300});
      const h = getFoodHistory();
      OUT.h0 = JSON.stringify(h.find(f=>f.name==='Mystery')); OUT.h1 = JSON.stringify(h.find(f=>f.name==='Black coffee'));
      // quick-add carries satFat through
      rememberFood('Salmon',35,{satFat:3.1,fiber:0});
      const idx = getFoodHistory().findIndex(f=>f.name==='Salmon');
      quickAddFoodAt('p',idx);
      OUT.salmon = JSON.stringify(S.logEntries[todayKey()].p.slice(-1)[0]);
    `);
    check('real zeros are stored (known zero)', sb.OUT.e0.includes('"fiber":0') && sb.OUT.e0.includes('"satFat":0') && sb.OUT.e0.includes('"sugar":0'), sb.OUT.e0);
    check('missing macros stay absent (unknown)', !sb.OUT.e1.includes('fiber') && !sb.OUT.e1.includes('satFat') && !sb.OUT.e1.includes('sugar') && sb.OUT.e1.includes('"calories":300'), sb.OUT.e1);
    check('negative / NaN / string / Infinity are rejected', !sb.OUT.e2.includes('sugar') && !sb.OUT.e2.includes('fiber') && !sb.OUT.e2.includes('satFat') && !sb.OUT.e2.includes('calories'), sb.OUT.e2);
    check('manual add is still a plain number', sb.OUT.e3 === '5', sb.OUT.e3);
    check('quick-add history keeps real zeros and omits unknowns', sb.OUT.h1.includes('"fiber":0') && !sb.OUT.h0.includes('fiber'), [sb.OUT.h0, sb.OUT.h1]);
    check('quick-add carries satFat', sb.OUT.salmon.includes('"satFat":3.1') && sb.OUT.salmon.includes('"fiber":0'), sb.OUT.salmon);
  }

  console.log('fuel: Haiku request + parsing');
  {
    const cap = [];
    const sb = run({ now: NOW, storage: { gh_ai_key: 'sk-test' }, fetch: aiReply({ food: 'salmon & rice', grams_protein: 38, added_sugar_g: 0, calories: 560, carbs_g: 52, fat_g: 22, sat_fat_g: 4.4, fiber_g: 3 }, cap) }, SETUP + `
      document.getElementById('ailog-text-p').value = 'salmon and rice';
      OUT.p = (async()=>{ await analyzeFood('p'); addProteinEntry('p'); return JSON.stringify(S.logEntries[todayKey()].p[0]); })();
    `);
    const entry = await sb.OUT.p;
    const body = cap[0] && cap[0].body;
    check('request asks for sat_fat_g in prompt + JSON shape', body && body.system.includes('"sat_fat_g":number') && /saturated fat/i.test(body.system), body && body.system.slice(0, 0));
    check('max_tokens raised to 400', body && body.max_tokens === 400, body && body.max_tokens);
    check('still asks for fiber + added sugar', body && body.system.includes('"fiber_g":number') && body.system.includes('"added_sugar_g":number'));
    check('entry stores all six macros incl. satFat', entry === '{"amt":38,"label":"salmon & rice","sugar":0,"calories":560,"carbs":52,"fat":22,"fiber":3,"satFat":4.4}', entry);
  }
  {
    const cap = [];
    const sb = run({ now: NOW, storage: { gh_ai_key: 'sk-test' }, fetch: aiReply({ food: 'protein bar', grams_protein: 20, calories: 210, sat_fat_g: null, fiber_g: 5 }, cap) }, SETUP + `
      document.getElementById('ailog-text-p').value = 'protein bar';
      OUT.p = (async()=>{ await analyzeFood('p'); addProteinEntry('p'); return JSON.stringify(S.logEntries[todayKey()].p[0]); })();
    `);
    const entry = await sb.OUT.p;
    check('null / omitted fields stay unknown (no fake zeros)', entry === '{"amt":20,"label":"protein bar","calories":210,"fiber":5}', entry);
  }

  console.log('fuel: bars + targets');
  {
    const sb = run({ now: NOW }, SETUP + `
      S.user.calorieGoal = 2000;
      addNumCore('p',60,'big breakfast',{calories:2300,fiber:35,satFat:15,sugar:4});
      OUT.html = fuelBarsHTML(S.habits[3], colorOf('lime'));
      OUT.tab = (renderProteinTab(), document.getElementById('proteinContent').innerHTML);
      // edit targets through the real save function
      document.getElementById('fuelFiberInput').value = '38';
      document.getElementById('fuelSatInput').value = '11.5';
      document.getElementById('fuelSugarInput').value = '10';
      document.getElementById('calGoalInput').value = '2100';
      saveFuelTargets();
      OUT.t = JSON.stringify(S.user.fuelTargets); OUT.cal = S.user.calorieGoal;
      // junk is ignored
      document.getElementById('fuelFiberInput').value = '-4';
      document.getElementById('fuelSatInput').value = 'abc';
      document.getElementById('fuelSugarInput').value = '';
      document.getElementById('calGoalInput').value = '0';
      saveFuelTargets();
      OUT.t2 = JSON.stringify(S.user.fuelTargets); OUT.cal2 = S.user.calorieGoal;
    `);
    const html = sb.OUT.html;
    check('five bars: protein, calories, fiber, sat fat, sugar', ['Protein', 'Calories', 'Fiber', 'Saturated fat', 'Added sugar'].every(l => html.includes(l)));
    check('defaults shown: fiber ≥30g, sat fat ≤13g, sugar ≤15g', html.includes('≥30g') && html.includes('≤13g') && html.includes('≤15g'));
    check('calories ≤2000 cal shown with goal set', html.includes('≤2000 cal'));
    check('over-limit rows turn rose (cal 2300>2000, sat 15>13)', (html.match(/var\(--rose\)/g) || []).length >= 4, (html.match(/var\(--rose\)/g) || []).length);
    check('goal met row turns lime (fiber 35≥30)', html.includes('color:var(--lime)'));
    check('Fuel tab renders bars + targets card', sb.OUT.tab.includes("Today's Fuel") && sb.OUT.tab.includes('Daily Targets') && sb.OUT.tab.includes('fuelFiberInput'));
    check('targets save', sb.OUT.t === '{"fiber":38,"satFat":11.5,"sugar":10}' && sb.OUT.cal === 2100, [sb.OUT.t, sb.OUT.cal]);
    check('junk target input leaves values unchanged', sb.OUT.t2 === sb.OUT.t && sb.OUT.cal2 === 2100, [sb.OUT.t2, sb.OUT.cal2]);
  }

  console.log('fuel: past Less Sugar days are never rewritten');
  {
    const sb = run({ now: NOW }, SETUP + `
      S.user.sugarAutoCalcSince = '2026-09-01';
      const dk = '2026-10-05';
      S.logEntries[dk] = {p:[{amt:30,label:'x',sugar:12}]};
      const sugarHabit = S.habits[1];
      OUT.before = habitDoneOn(sugarHabit, dk);
      S.user.fuelTargets.sugar = 5;           // tighten the Fuel bar goal
      OUT.after = habitDoneOn(sugarHabit, dk);
      OUT.stillFifteen = SUGAR_LIMIT_G;
    `);
    check('12g day stays "done" after tightening the Fuel goal to 5g', sb.OUT.before === true && sb.OUT.after === true && sb.OUT.stillFifteen === 15, sb.OUT);
  }

  console.log('fuel: tab + pause rules');
  {
    const sb = run({ now: NOW }, SETUP + `
      OUT.pausable = S.habits.map(h => h.name + ':' + isPausable(h)).join(',');
      OUT.todayCard = habitCardHTML(S.habits[3]);
    `);
    check('Protein + Calories stay non-pausable; Workout + Sugar pausable', sb.OUT.pausable === 'Workout:true,Less Sugar:true,Calories:false,Protein:false', sb.OUT.pausable);
    check('Protein Today card has no pause button', !sb.OUT.todayCard.includes('pause-mini'));
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    check('tab bar says Fuel, not Macros', html.includes('<span>Fuel</span>') && !html.includes('<span>Macros</span>'));
    check('no leftover "in the Macros tab" copy', !/Macros tab|in Macros|it in Macros/.test(html));
  }

  done();
})();
