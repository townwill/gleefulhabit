const fs=require('fs');eval(fs.readFileSync(__dirname+'/logic.js','utf8')+';globalThis.parseLevel=parseLevel;globalThis.trace=trace;globalThis.DIRS=DIRS;globalThis.CDIR=CDIR;');
function eachState(L,f){const n=L.mirrors.length,st=L.mirrors.map(()=>0);for(;;){f(st);let i=0;while(i<n){st[i]++;if(st[i]<L.radix[i])break;st[i]=0;i++;}if(i===n)break;}}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function fullSolve(def,limit){
  const L=parseLevel(def),n=L.mirrors.length,E=[];
  const key=o=>o.t==='prism'?'P':o.half?'S':'/',pieces=L.tray.slice().sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
  for(let z=0;z<L.H;z++)for(let x=0;x<L.W;x++)if(!L.cells[z][x])E.push([x,z]);
  let par=99,placements=0,sols=0;const st=new Array(n),solList=[];
  function evalStates(){let any=false;eachState(L,st=>{if(trace(L,st).solved){any=true;sols++;if(solList.length<400)solList.push(st.slice());let d=L.tray.length;for(let j=0;j<n;j++)if(st[j]!==L.init[j])d++;if(d<par)par=d;}});if(any)placements++;}
  const put=(o,c)=>{o.x=c[0];o.z=c[1];L.cells[c[1]][c[0]]=o;},take=o=>{L.cells[o.z][o.x]=null;o.x=o.z=-1;};
  function rec(i,start){if(i===pieces.length){evalStates();return;}const same=i>0&&key(pieces[i])===key(pieces[i-1]);
    for(let e=same?start:0;e<E.length;e++){const c=E[e];if(L.cells[c[1]][c[0]])continue;put(pieces[i],c);rec(i+1,e+1);take(pieces[i]);if(placements>(limit||1e9))return;}}
  rec(0,0);return {par,placements,sols,solList};

}
function clean(L,tr){
  if(tr.loop)return false;const used={};let white=0;
  for(const s of tr.segs){if(s.c===7)white++;const dx=Math.sign(s.bx-s.ax),dz=Math.sign(s.bz-s.az),ax=dz===0?'h':dx===0?'v':dx===dz?'d':'a';let x=s.ax,z=s.az;
    for(let i=0;i<20;i++){x+=dx;z+=dz;if((dx&&(x-s.bx)*dx>=0)||(dz&&(z-s.bz)*dz>=0))break;const k=x+','+z+ax;if(used[k])return false;used[k]=1;}}
  if(white>2)return false;
  for(const h of tr.hits){if(h.c===7&&Number.isInteger(h.x)&&Number.isInteger(h.z)){const o=L.cells[h.z][h.x];if(o&&o.t==='mirror'&&o.half)return false;}}
  return true;}
const NAME={1:'r',2:'g',4:'b',3:'y',5:'m',6:'c',7:'w'},STRONG={1:'R',2:'G',4:'U'};
function gen(p,R){
  const dw=p.W,W=p.two?2*p.W+1:p.W,H=p.H,g=[];for(let z=0;z<H;z++){g.push(Array(W).fill('.'));if(p.two)g[z][dw]='X';}
  const ri=n=>Math.floor(R()*n),side=ri(4);let ex,ez,ch;
  if(side===0||(p.two&&side===1)){ex=0;ez=1+ri(H-2);ch='>';}else if(side===1){ex=W-1;ez=1+ri(H-2);ch='<';}else if(side===2){ez=0;ex=1+ri(dw-2);ch='v';}else{ez=H-1;ex=1+ri(dw-2);ch='^';}
  g[ez][ex]=ch;
  const put=c=>{for(let i=0;i<50;i++){const x=ri(W),z=ri(H);if(g[z][x]==='.'){g[z][x]=c;return true;}}return false;};
  {const d=DIRS[ch],len=(d[0]?dw:H)-1,k=1+ri(len-1);if(p.two||R()<0.6)g[ez+d[1]*k][ex+d[0]*k]='P';else put('P');}
  const dk={},dstr=()=>{let s='';for(let z=0;z<H;z++)for(let x=0;x<W;x++)if(g[z][x]==='D')s+=dk[x+','+z];return s;};
  const mk=()=>parseLevel({rows:g.map(r=>r.join('')),d:dstr(),decks:p.two?2:1});
  const walk=(tr,f)=>tr.segs.forEach(s=>{const dx=Math.sign(s.bx-s.ax),dz=Math.sign(s.bz-s.az);let x=s.ax,z=s.az;
    for(let i=0;i<20;i++){x+=dx;z+=dz;if((dx&&(x-s.bx)*dx>=0)||(dz&&(z-s.bz)*dz>=0))break;if(x<0||z<0||x>=W||z>=H)break;if(g[z][x]==='.')f(x,z,s);}});
  const onPath=chars=>{const L=mk(),tr=trace(L,L.init),cs=[];walk(tr,(x,z,s)=>cs.push([x,z,s.c]));
    if(!cs.length)return put(chars[ri(chars.length)]);const c=cs[ri(cs.length)];let c2=chars[ri(chars.length)];
    if(chars[0]==='1'){const b=[1,2,4].filter(v=>c[2]&v);c2=String(b[ri(b.length)]);if(c[2]!==7&&b.length<2)return put(chars[ri(3)]);}
    if(c2==='L'){const px=c[0]<dw?c[0]+dw+1:c[0]-dw-1;if(g[c[1]][px]!=='.')return false;g[c[1]][px]='L';}
    g[c[1]][c[0]]=c2;if(c2==='D')dk[c[0]+','+c[1]]=ri(8);return true;};
  for(let i=0;i<(p.fixed||0);i++)put(R()<.5?'F':'B');
  for(let i=0;i<(p.walls||0);i++)put('#');
  const jobs=[];for(let i=0;i<p.m;i++)jobs.push(['/','N']);for(let i=0;i<(p.dials||0);i++)jobs.push(['D']);for(let i=0;i<(p.half||0);i++)jobs.push(['S','Z']);for(let i=0;i<(p.filters||0);i++)jobs.push(['1','2','4']);
  jobs.sort(()=>R()-.5);for(let i=0;i<(p.lifts||0);i++)jobs.splice(Math.min(jobs.length,1+i*2),0,['L']);jobs.forEach(j=>onPath(j));
  if(p.comb){const L0=mk(),t0=trace(L0,L0.init),ps={};walk(t0,(x,z,s)=>{const k=x+','+z;ps[k]=ps[k]||{m:0,n:0,x,z};ps[k].m|=s.c;ps[k].n++;});
    const cc=Object.values(ps).filter(c=>c.n>=2&&[3,5,6].includes(c.m));if(!cc.length)return null;const c=cc[ri(cc.length)];
    const outs=Object.keys(CDIR).filter(k=>{const d=CDIR[k],x=c.x+d[0],z=c.z+d[1];return x>=0&&z>=0&&x<W&&z<H&&g[z][x]==='.';});if(!outs.length)return null;
    g[c.z][c.x]=outs[ri(outs.length)];for(let i=0;i<(p.m2||0);i++)onPath(['/','N']);}
  let needMix=p.mix||0,needStrong=p.strong||0;
  for(let t=0;t<p.T;t++){
    const L=mk(),tr=trace(L,L.init),pass={};
    walk(tr,(x,z,s)=>{const k=x+','+z;pass[k]=pass[k]||{m:0,d:0,n:0,x,z};pass[k].m|=s.c;pass[k].n++;pass[k].d=Math.max(pass[k].d,s.n);});
    let cand=Object.values(pass).filter(c=>c.m!==7),pick=null,chr=null;
    const prim=c=>[1,2,4].includes(c.m);
    if(needStrong){cand=cand.filter(c=>prim(c)&&c.n>=2);if(!cand.length)return null;pick=cand[ri(cand.length)];chr=STRONG[pick.m];needStrong--;}
    else if(needMix){cand=cand.filter(c=>!prim(c)&&(!p.comb||c.n===1));if(!cand.length)return null;pick=cand[ri(cand.length)];chr=NAME[pick.m];needMix--;}
    else{cand=cand.filter(c=>prim(c)&&c.n===1&&c.d>=1);if(!cand.length)return null;let tot=0;cand.forEach(c=>tot+=1+c.d*2);let r=R()*tot;pick=cand[0];for(const c of cand){r-=1+c.d*2;if(r<=0){pick=c;break;}}chr=NAME[pick.m];}
    g[pick.z][pick.x]=chr;
  }
  const L=mk(),tr=trace(L,L.init);if(!tr.solved||!clean(L,tr))return null;
  if(p.comb&&![3,5,6,7].includes(tr.cacc[0]))return null;
  let bits=0;L.targets.forEach(t=>bits|=t.need);if(bits!==7)return null;
  if(p.two){const up=L.targets.filter(t=>t.x>dw).length;if(!up||up===L.targets.length)return null;if(L.others.filter(o=>o.t==='lift').length!==2*(p.lifts||0))return null;}
  for(const o of L.others)if(o.t!=='wall'&&!o.fixed&&!tr.touched[o.x+','+o.z])return null;
  let touched=0;L.mirrors.forEach(m=>{if(tr.touched[m.x+','+m.z])touched++;});
  if(touched<L.mirrors.length-(p.slack||0))return null;
  for(const m of L.mirrors)if(m.half&&!tr.touched[m.x+','+m.z])return null;
  const n=L.mirrors.length,sols=[];let near=0,bad=false;
  eachState(L,st=>{if(bad)return;const q=trace(L,st);if(q.loop&&!p.loopsOk){bad=true;return;}if(q.solved){sols.push(st.slice());if(sols.length>(p.maxSols||1))bad=true;}else if(q.lit.filter(v=>v).length===L.targets.length-1)near++;});
  if(bad||!sols.length)return null;
  const solRows=g.map(r=>r.join('')),sol=L.init.slice(),touchedM=L.mirrors.filter(m=>!m.half&&!m.dial&&tr.touched[m.x+','+m.z]).map(m=>[m.x,m.z]);
  const prism=L.others.find(o=>o.t==='prism'),halfM=L.mirrors.find(m=>m.half&&tr.touched[m.x+','+m.z]);
  const idx=[...Array(n).keys()].sort(()=>R()-.5).slice(0,Math.min(n,p.par));
  idx.forEach(i=>{const m=L.mirrors[i];if(m.dial){dk[m.x+','+m.z]=(dk[m.x+','+m.z]+1+ri(7))%8;}else g[m.z][m.x]={'/':'N','N':'/','S':'Z','Z':'S'}[g[m.z][m.x]];});
  const Li=mk(),init=Li.init;let par=99;sols.forEach(sl=>{let d=0;sl.forEach((v,i)=>{if(v!==init[i])d++;});par=Math.min(par,d);});
  if(par<p.par-1)return null;
  const L2=mk();if(!clean(L2,trace(L2,L2.init)))return null;
  return {rows:g.map(r=>r.join('')),d:dstr(),par,score:tr.hits.length*2+near+touched*2,touchedM,prism:[prism.x,prism.z],half:halfM?[halfM.x,halfM.z]:null};
}
function trayify(base,p,R){
  const rows=base.rows.map(r=>r.split('')),pool=base.touchedM.slice().sort(()=>R()-.5);
  if(pool.length<p.tray)return null;let tray='';
  pool.slice(0,p.tray).forEach(c=>{rows[c[1]][c[0]]='.';tray+='/';});
  if(p.trayPrism){rows[base.prism[1]][base.prism[0]]='.';tray+='P';}
  if(p.trayHalf){if(!base.half)return null;rows[base.half[1]][base.half[0]]='.';tray+='S';}
  const def={rows:rows.map(r=>r.join('')),tray,d:base.d,decks:p.two?2:1};
  const L=parseLevel(def);if(trace(L,L.init).solved)return null;
  const r=fullSolve(def,p.maxPlace||2);if(r.placements<1||r.placements>(p.maxPlace||2))return null;
  return {rows:def.rows,d:base.d,tray:tray+(p.spare?'/':''),spare:p.spare?1:0,par:r.par,score:base.score,placements:r.placements};
}
const B=(W,m,o)=>Object.assign({W,H:W,m,T:3,par:Math.min(m,3)},o);
module.exports={fullSolve,gen,trayify,mulberry,B};
if(require.main!==module)return;
const specs=[
 // World 1 (levels 4-20)
 B(5,3,{}),B(5,4,{fixed:1}),B(6,4,{fixed:1,walls:1}),B(6,5,{fixed:1,walls:2}),
 B(6,5,{filters:1,par:3}),B(6,5,{filters:1,walls:1,fixed:1,par:4}),B(6,6,{filters:1,walls:2,par:4,slack:1,maxSols:2}),
 B(6,4,{half:1,T:4,par:3}),B(6,5,{half:1,fixed:1,walls:1,T:4,par:4}),B(6,6,{half:1,walls:2,T:4,par:4,slack:1,maxSols:2}),
 B(6,5,{half:1,mix:1,walls:1,par:4,slack:1,maxSols:2}),B(6,6,{half:1,mix:1,filters:1,walls:2,fixed:1,par:5,slack:1,maxSols:2}),
 B(7,6,{half:1,fixed:2,walls:2,T:4,par:5,slack:1,maxSols:2}),B(7,7,{half:1,mix:1,walls:2,par:5,slack:1,maxSols:2}),
 B(7,8,{half:1,fixed:2,walls:3,T:4,par:6,slack:1,maxSols:2}),B(7,7,{half:1,filters:1,mix:1,fixed:2,walls:2,par:6,slack:1,maxSols:2}),
 B(7,8,{half:1,fixed:2,walls:3,T:4,par:7,slack:1,maxSols:2}),
 // World 2 (levels 21-40)
 B(6,3,{half:1,strong:1,par:2,slack:1,maxSols:2}),B(6,4,{half:1,strong:1,walls:1,par:3,slack:1,maxSols:2}),B(6,5,{half:1,strong:1,fixed:1,walls:1,par:4,slack:1,maxSols:2}),
 B(6,5,{half:1,strong:1,filters:1,walls:1,par:4,slack:1,maxSols:2}),B(7,6,{half:1,strong:1,fixed:1,walls:2,par:5,slack:1,maxSols:2}),
 B(5,3,{tray:1,par:1}),B(6,4,{tray:1,fixed:1,walls:1,par:2}),B(6,4,{tray:2,walls:1,par:2}),
 B(6,4,{tray:0,trayPrism:1,walls:1,par:2}),B(6,4,{tray:1,trayPrism:1,walls:1,par:2}),
 B(6,5,{tray:2,fixed:1,walls:2,par:3}),B(6,5,{tray:2,half:1,T:4,walls:1,par:3,slack:1,maxSols:2}),B(6,5,{tray:2,filters:1,walls:1,par:3}),
 B(6,5,{tray:2,half:1,strong:1,walls:1,par:3,slack:1,maxSols:2}),B(6,5,{tray:1,trayPrism:1,half:1,strong:1,par:3,slack:1,maxSols:2}),
 B(7,5,{tray:3,walls:2,fixed:1,par:3}),B(7,6,{tray:3,walls:2,fixed:2,par:3,slack:1,maxSols:2}),B(7,6,{tray:2,trayPrism:1,walls:2,par:3,slack:1,maxSols:2}),
 B(7,6,{tray:3,half:1,strong:1,walls:2,par:3,slack:1,maxSols:2}),B(7,6,{tray:2,trayPrism:1,half:1,strong:1,walls:2,fixed:1,par:4,slack:1,maxSols:2}),

 // World 3 (levels 41-60)
 B(6,3,{tray:3,fixed:1,walls:1,par:0}),B(6,3,{tray:2,trayPrism:1,walls:1,par:0}),B(6,3,{tray:3,trayPrism:1,fixed:1,par:0}),
 B(6,3,{tray:2,trayHalf:1,half:1,strong:1,par:0,slack:1,maxSols:2}),B(7,3,{tray:3,fixed:2,walls:2,par:0}),B(7,4,{tray:3,walls:2,par:1}),
 B(7,3,{tray:2,trayHalf:1,half:1,strong:1,walls:2,par:1,slack:1,maxSols:2}),B(7,3,{tray:2,trayPrism:1,trayHalf:1,half:1,strong:1,par:1,slack:1,maxSols:2}),
 B(7,4,{tray:4,fixed:2,walls:2,T:3,par:0}),B(7,4,{tray:3,trayPrism:1,walls:2,par:1}),
 B(6,3,{tray:3,spare:1,walls:1,par:0}),B(7,3,{tray:3,trayPrism:1,spare:1,walls:2,par:0}),B(7,4,{tray:3,half:1,mix:1,walls:2,par:1,slack:1,maxSols:2}),
 B(7,3,{tray:3,trayHalf:1,half:1,strong:1,fixed:1,walls:2,par:0,slack:1,maxSols:2}),B(7,4,{tray:4,filters:1,walls:2,fixed:1,par:0}),
 B(8,4,{tray:3,fixed:2,walls:3,par:1}),B(8,4,{tray:4,fixed:2,walls:3,par:0}),B(8,3,{tray:3,trayPrism:1,spare:1,fixed:2,walls:3,par:0}),
 B(8,3,{tray:3,trayHalf:1,half:1,strong:1,fixed:2,walls:3,par:0,slack:1,maxSols:2}),B(8,4,{tray:4,half:1,mix:1,fixed:2,walls:3,spare:1,par:0,slack:1,maxSols:2}),

 // World 4 (levels 61-80)
 B(6,2,{dials:1,par:2}),B(6,3,{dials:1,fixed:1,par:3}),B(6,2,{dials:2,walls:1,par:3}),B(7,3,{dials:2,walls:1,par:4,slack:1,maxSols:2}),
 B(7,3,{dials:1,tray:2,walls:1,par:2,slack:1,maxSols:2}),
 B(6,3,{comb:1,half:1,mix:1,m2:1,par:3,slack:2,maxSols:3}),B(6,3,{comb:1,half:1,mix:1,m2:1,walls:1,par:4,slack:2,maxSols:3}),
 B(7,3,{comb:1,half:1,mix:1,m2:1,dials:1,par:4,slack:2,maxSols:3}),B(7,3,{comb:1,half:1,mix:1,m2:1,tray:2,par:1,slack:2,maxSols:3,maxPlace:3}),
 B(7,3,{dials:1,tray:2,walls:2,par:2,slack:1,maxSols:2}),B(7,3,{dials:2,tray:2,fixed:1,par:2,slack:1,maxSols:2}),
 B(7,3,{comb:1,half:1,mix:1,m2:1,dials:1,tray:2,par:2,slack:2,maxSols:3,maxPlace:3}),B(7,3,{dials:2,half:1,strong:1,par:4,slack:2,maxSols:3}),
 B(7,4,{dials:1,tray:3,walls:2,par:2,slack:1,maxSols:2}),B(7,3,{comb:1,half:1,mix:1,m2:1,dials:2,par:5,slack:2,maxSols:3}),
 B(8,3,{dials:2,tray:2,fixed:2,walls:3,par:2,slack:1,maxSols:2}),B(8,3,{comb:1,half:1,mix:1,m2:1,dials:1,tray:2,walls:2,par:2,slack:2,maxSols:3,maxPlace:3}),
 B(8,3,{dials:3,walls:3,fixed:2,par:5,slack:1,maxSols:2}),B(8,4,{dials:2,tray:3,walls:3,par:2,slack:1,maxSols:2}),
 B(8,3,{comb:1,half:1,mix:1,m2:1,dials:2,tray:2,walls:3,fixed:1,par:3,slack:2,maxSols:3,maxPlace:3}),

 // World 5 (levels 81-100): two decks of W x W joined by lifts
 B(5,3,{two:1,lifts:1,par:2}),B(5,3,{two:1,lifts:1,fixed:1,par:3}),B(5,3,{two:1,lifts:1,walls:2,par:3}),B(5,4,{two:1,lifts:2,par:3,slack:1,maxSols:2}),
 B(5,3,{two:1,lifts:1,tray:2,par:1}),B(5,4,{two:1,lifts:1,half:1,par:4,slack:1,maxSols:2}),B(5,3,{two:1,lifts:2,tray:2,par:1,slack:1,maxSols:2}),
 B(6,4,{two:1,lifts:1,dials:1,par:3,slack:1,maxSols:2}),B(6,3,{two:1,lifts:1,tray:2,walls:2,par:1}),B(6,4,{two:1,lifts:2,fixed:2,walls:2,par:4,slack:1,maxSols:2}),
 B(6,4,{two:1,lifts:1,half:1,strong:1,par:3,slack:2,maxSols:4}),B(6,3,{two:1,lifts:2,tray:2,dials:1,par:2,slack:1,maxSols:2}),
 B(6,3,{two:1,lifts:1,comb:1,half:1,mix:1,m2:1,par:4,slack:2,maxSols:3}),B(6,4,{two:1,lifts:2,tray:3,par:1,slack:1,maxSols:2}),
 B(6,3,{two:1,lifts:1,dials:2,walls:2,par:4,slack:1,maxSols:2}),B(6,4,{two:1,lifts:1,tray:2,half:1,strong:1,par:2,slack:2,maxSols:4,maxPlace:3}),
 B(6,3,{two:1,lifts:1,comb:1,half:1,mix:1,m2:1,tray:2,par:2,slack:2,maxSols:3,maxPlace:3}),B(6,4,{two:1,lifts:2,dials:1,tray:2,walls:3,par:2,slack:1,maxSols:2}),
 B(6,3,{two:1,lifts:2,tray:3,fixed:2,walls:3,par:1,slack:1,maxSols:2}),B(6,3,{two:1,lifts:2,comb:1,half:1,mix:1,m2:1,dials:1,tray:2,walls:2,par:3,slack:2,maxSols:3,maxPlace:3}),
];
const from=+process.env.FROM||0,to=+process.env.TO||specs.length,outF=__dirname+'/gen_scratch_'+from+'.json';
const out=fs.existsSync(outF)?JSON.parse(fs.readFileSync(outF,'utf8')):[];
for(let i=from;i<to;i++){const p=specs[i],R=mulberry(5000+i*131),t0=Date.now(),isTray=p.tray!==undefined;let best=null,found=0,tries=0;
  const cap=isTray?(+process.env.CAP||70000):14000;
  while(Date.now()-t0<cap&&found<(isTray?1:20)){const r=gen(p,R);if(!r)continue;tries++;
    if(isTray){const t=trayify(r,p,R);if(t){best=t;found++;}}else{found++;if(!best||r.score>best.score)best=r;}}
  console.log('L'+(i+4),best?(best.rows.join('|')+' tray='+(best.tray||'')+' d='+(best.d||'')+' spare='+(best.spare||0)+' par='+best.par+(best.placements?' pl='+best.placements:'')):'FAIL',tries,((Date.now()-t0)/1000).toFixed(0)+'s');
  out[i]=best?{rows:best.rows,tray:best.tray||'',d:best.d||'',spare:best.spare||0,decks:p.two?2:1,par:best.par}:null;fs.writeFileSync(outF,JSON.stringify(out));}
