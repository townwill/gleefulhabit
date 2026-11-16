const fs=require('fs'),vm=require('vm');
const logic=fs.readFileSync(__dirname+'/logic.js','utf8');
const {fullSolve}=require('./gen2.js');
eval(logic+';globalThis.parseLevel=parseLevel;globalThis.trace=trace;');
const gen=JSON.parse(fs.readFileSync(__dirname+'/gen40.json','utf8'));
const N=['First Light','Double Back','Spectrum','Three Ways','Locked In','Crossfire','Dead Ends','Stained Glass','Tinted','Narrow Band','Half Measures','Split Decision','Two Places','Mixed Signals','Magenta Shift','Long Way Round','Blend','Lattice','Interference','Full Spectrum',
 'Overcharge','Twice Over','Feedback','Twin Feed','Surge','Loose Mirror','Your Move','Two to Place','Loose Prism','Kit of Parts','Open Floor','Rewire','Bypass','Split and Join','Hot Seat','Three Piece','Blank Slate','Cold Start','Critical Mass','Overload',
 'Blank Board','Bring Your Own','Full Kit','Splitter','Open Ground','One Fixed Point','Feed Two','Parts Bin','Four Corners','Assembly','Spare Part','Leftovers','Blend Kit','Double Duty','Tinted Kit','Wide Open','Quartet','Odd One Out','Power Grid','Loadout',
 'Fine Tune','Off Axis','Two Dials','Slant','Dial and Drop','Combiner','Merge Lane','Blend and Bend','Kit and Lens','Oblique','Cross Hatch','Confluence','Twin Dials','Angle of Attack','Mixing Desk','Wide Angle','Long Lens','Three Dials','Vernier','Convergence',
 'High Rise','Going Up','Mezzanine','Two Lifts','Upstairs Kit','Split Level','Service Lift','Dial Tone','Top Floor','Stairwell','Penthouse Power','Elevator Pitch','Rooftop Mix','Three Flights','Skylight','Double Decker','Upper Blend','Crosswalk','Scaffold','Prism'];
const HINT={1:'Tap the mirror to turn it. Drag to spin the board, pinch to zoom.',2:'Two turns this time. Each tap flips a mirror between its two angles.',
 3:'The prism splits white light into red, green and blue. Each crystal wants its own color.',5:'Dark-framed mirrors are locked. Work around them.',
 6:'The striped blocks with a red light are walls. They stop a beam cold.',8:'A colored glass tube only lets its own color through.',
 11:'A pale half-mirror reflects the beam and lets it pass at the same time.',14:'A round crystal needs two colors at once. Its studs show which ones have arrived.',
 20:'The biggest board in this world.',21:'A twin crystal needs two beams of its color, one for each half. Split a beam with a half-mirror.',
 26:'You have a mirror in your tray. Drag it onto an empty tile. Drag it again to move it, or back down to the tray to remove it.',
 28:'Two mirrors to place. Where they go is up to you.',29:'This time the prism is yours to place.',36:'Three pieces, one way through.',40:'Place all three, then power the big crystal.',
 41:'The board is nearly bare. Every turn in the route is yours to place.',44:'A half-mirror piece. Place it where one beam needs to become two.',
 51:'You have one piece more than you need. Leave the spare in the tray.',60:'The whole kit, the biggest board.',
 61:'A dial mirror turns through eight angles. Drag around it to aim it, or tap to step it. Light can now travel diagonally.',65:'Dials stay where they are. Your tray pieces go wherever you like.',
 66:'The combiner lens swallows every beam that reaches it and fires one beam of the mixed color out of its nozzle.',80:'Dials, a combiner and a tray. The lot.',
 81:'Two decks, one above the other. A lift carries a beam to the same spot on the other deck, still heading the same way. The deck button switches decks.',
 85:'Tray pieces can go on either deck. Switch decks, then drag.',100:'The last board. Everything you have learned, on two decks.'};
const hand=[{rows:['...w.','.....','>..N.','.....','.....'],tray:''},{rows:['.....','.w./.','.....','>..N.','.....'],tray:''},{rows:['.g./.r.','.......','>..P.N.','......b','.../../'],tray:''}];
const gen3=JSON.parse(fs.readFileSync(__dirname+'/gen60.json','utf8'));
const gen4=JSON.parse(fs.readFileSync(__dirname+'/gen80.json','utf8'));
const gen5=JSON.parse(fs.readFileSync(__dirname+'/gen100.json','utf8'));
const WORLDS=[{name:'First Light',gate:0},{name:'Overcharge',gate:30},{name:'Loadout',gate:30},{name:'Fine Tune',gate:30},{name:'High Rise',gate:30}];
// packs.json (optional): [{name, gate, file, names:[20 names], hints:{"1":"..."}}]; each file is an array of 20 level objects
const packs=fs.existsSync(__dirname+'/packs.json')?JSON.parse(fs.readFileSync(__dirname+'/packs.json','utf8')):[];
let packLevels=[];
packs.forEach(p=>{const lv=JSON.parse(fs.readFileSync(__dirname+'/'+p.file,'utf8'));if(lv.length!==20||lv.some(x=>!x))throw new Error('pack '+p.name+' needs exactly 20 levels');
  if(!p.names||p.names.length!==20)throw new Error('pack '+p.name+' needs 20 names');
  lv.forEach((l,i)=>{N.push(p.names[i]);if(p.hints&&p.hints[i+1])HINT[100+packLevels.length+1]=p.hints[i+1];packLevels.push(l);});WORLDS.push({name:p.name,gate:p.gate||0,pack:true});});
const all=hand.concat(gen,gen3,gen4,gen5,packLevels);if(all.length!==100+packLevels.length||all.some(x=>!x))throw new Error('missing levels');
// Dial mirrors must never start already aimed: move any dial that begins on its solving angle, then recount par.
function overlapOrLoop(L,tr){if(tr.loop)return true;const used={};
  for(const s of tr.segs){const dx=Math.sign(s.bx-s.ax),dz=Math.sign(s.bz-s.az),ax=dz===0?'h':dx===0?'v':dx===dz?'d':'a';let x=s.ax,z=s.az;
    for(let i=0;i<20;i++){x+=dx;z+=dz;if((dx&&(x-s.bx)*dx>=0)||(dz&&(z-s.bz)*dz>=0))break;const k=x+','+z+ax;if(used[k])return true;used[k]=1;}}
  return false;}
function detune(l,r){
  const base=parseLevel(l),dials=base.mirrors.map((m,j)=>m.dial?j:-1).filter(j=>j>=0);if(!dials.length||!r.solList.length)return 0;
  const dist=(s,init)=>s.reduce((a,v,j)=>a+(v!==init[j]?1:0),0);
  let best=r.solList[0];r.solList.forEach(s=>{if(dist(s,base.init)<dist(best,base.init))best=s;});
  const d=l.d.split('');let changed=0;
  dials.forEach((j,q)=>{if(base.init[j]!==best[j])return;
    for(const o of [3,5,2,6,1,7,4]){const was=d[q];d[q]=String((best[j]+o)%8);const L=parseLevel(Object.assign({},l,{d:d.join('')})),tr=trace(L,L.init);
      if(!tr.solved&&!overlapOrLoop(L,tr)){changed++;return;}d[q]=was;}});
  if(changed){l.d=d.join('');const init=parseLevel(l).init;l.par=(l.tray||'').length-(l.spare?1:0)+Math.min.apply(null,r.solList.map(s=>dist(s,init)));}
  return changed;
}
const levels=all.map((l,i)=>({name:N[i],hint:HINT[i+1]||'',rows:l.rows,tray:l.tray||'',spare:l.spare||0,d:l.d||'',decks:l.decks||1}));
levels.forEach((l,i)=>{
  const L=parseLevel(l);if(trace(L,L.init).solved)throw new Error('level '+(i+1)+' starts solved');
  const r=fullSolve(l.spare?{rows:l.rows,d:l.d,decks:l.decks,tray:l.tray.slice(0,-1)}:l);if(!r.placements)throw new Error('level '+(i+1)+' unsolvable');
  l.par=r.par;const moved=detune(l,r);console.log(moved?'[dials moved '+moved+']':'',i+1,l.name,L.dw+'x'+L.H+(L.two?' x2':''),'mirrors',L.mirrors.length,'tray',l.tray||'-','targets',L.targets.length,'placements',r.placements,'par',r.par);
});
// Daily and Endless pools (from genpool.js)
const pool={daily:[],endless:[]};
fs.readdirSync(__dirname).filter(f=>/^pool_\d+\.json$/.test(f)).forEach(f=>JSON.parse(fs.readFileSync(__dirname+'/'+f,'utf8')).forEach(e=>{pool[e.set][e.idx]=e.level;}));
const fill=(arr,n,step)=>{for(let i=0;i<n;i++){if(!arr[i]){let j=i;for(let k=0;k<n&&!arr[j];k++)j=(j+step)%n;if(!arr[j])throw new Error('empty pool');arr[i]=arr[j];console.log('pool gap filled',i,'from',j);}
  const L=parseLevel(arr[i]);if(trace(L,L.init).solved)throw new Error('pool level starts solved '+i);}};
fill(pool.daily,91,7);fill(pool.endless,120,1);
let poolMoved=0;[pool.daily,pool.endless].forEach(arr=>arr.forEach(l=>{if(!l.rows.join('').includes('D')||l._dt)return;l._dt=1;const r=fullSolve(l.spare?{rows:l.rows,d:l.d,decks:l.decks,tray:l.tray.slice(0,-1)}:l);poolMoved+=detune(l,r);}));
[pool.daily,pool.endless].forEach(arr=>arr.forEach(l=>{delete l._dt;}));console.log('pool dials moved',poolMoved);
let html=fs.readFileSync(__dirname+'/index.src.html','utf8');
html=html.replace('/*__LOGIC__*/',()=>logic).replace('/*__LEVELS__*/',()=>JSON.stringify(levels)).replace('/*__WORLDS__*/',()=>JSON.stringify(WORLDS)).replace('/*__DAILY__*/',()=>JSON.stringify(pool.daily)).replace('/*__ENDLESS__*/',()=>JSON.stringify(pool.endless));
// version stamp, Pacific time, YYYY-MM-DD.HHMM
const pt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).reduce((o,p)=>(o[p.type]=p.value,o),{});
const version=process.env.VERSION||(pt.year+'-'+pt.month+'-'+pt.day+'.'+(pt.hour==='24'?'00':pt.hour)+pt.minute);
html=html.replace("'__VERSION__'",()=>"'"+version+"'");
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
fs.mkdirSync(__dirname+'/out',{recursive:true});fs.writeFileSync(__dirname+'/out/index.html',html);
// TARGET=pages also writes the GitHub Pages copy one folder up: single file, 3D library inlined, home-screen tags
if(process.env.TARGET==='pages'){
  const three=fs.readFileSync(__dirname+'/vendor/three.min.js','utf8');if(three.includes('</script'))throw new Error('library cannot be inlined');
  let p=html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',()=>'<script>'+three+'</script>');
  if(p===html)throw new Error('library tag not found');
  p=p.replace('<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">',()=>'<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Prism">\n<meta name="theme-color" content="#03040a">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">\n<link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">');
  if(!p.includes('apple-touch-icon'))throw new Error('viewport tag not found');
  fs.writeFileSync(__dirname+'/../index.html',p);console.log('wrote ../index.html for GitHub Pages',p.length);
}
console.log('built',html.length,'version',version);
