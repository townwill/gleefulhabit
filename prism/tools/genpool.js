// Builds the Daily and Endless level pools. Usage: PART=k PARTS=n node genpool.js  -> pool_k.json
const fs=require('fs');const {gen,trayify,mulberry,B}=require('./gen2.js');
const DAILY=[ // one recipe per weekday, Monday first; 13 of each
 B(6,4,{fixed:1,walls:1}),B(6,5,{filters:1,walls:1,par:4}),B(6,4,{half:1,strong:1,par:3,slack:1,maxSols:2}),
 B(6,4,{tray:2,walls:1,par:1}),B(7,3,{dials:1,walls:1,par:3}),B(7,4,{tray:3,fixed:1,walls:2,par:1,slack:1,maxSols:2}),
 B(5,3,{two:1,lifts:1,tray:2,par:1})];
const ENDLESS=[ // twelve tiers, easiest first; 10 of each
 B(5,3,{}),B(5,4,{fixed:1}),B(6,4,{fixed:1,walls:1}),B(6,5,{filters:1,walls:1,par:4}),B(6,4,{half:1,T:4,par:3}),
 B(6,5,{half:1,mix:1,walls:1,par:4,slack:1,maxSols:2}),B(6,4,{half:1,strong:1,par:3,slack:1,maxSols:2}),B(6,4,{tray:2,walls:1,par:1}),
 B(7,4,{tray:3,walls:2,par:1,slack:1,maxSols:2}),B(7,3,{dials:1,tray:2,walls:1,par:2,slack:1,maxSols:2}),
 B(7,3,{comb:1,half:1,mix:1,m2:1,dials:1,par:4,slack:2,maxSols:3}),B(6,3,{two:1,lifts:1,tray:2,walls:2,par:1})];
const jobs=[];
for(let w=0;w<13;w++)DAILY.forEach((p,d)=>jobs.push({set:'daily',idx:w*7+d,p,seed:90000+w*977+d*131}));
ENDLESS.forEach((p,t)=>{for(let j=0;j<10;j++)jobs.push({set:'endless',idx:t*10+j,p,seed:70000+t*811+j*173});});
const part=+process.env.PART||0,parts=+process.env.PARTS||1,out=[];
jobs.forEach((job,n)=>{if(n%parts!==part)return;const p=job.p,R=mulberry(job.seed),t0=Date.now(),isTray=p.tray!==undefined;let best=null,found=0;
  while(Date.now()-t0<60000&&found<(isTray?1:4)){const r=gen(p,R);if(!r)continue;if(isTray){const t=trayify(r,p,R);if(t){best=t;found++;}}else{found++;if(!best||r.score>best.score)best=r;}}
  out.push({set:job.set,idx:job.idx,level:best?{rows:best.rows,tray:best.tray||'',d:best.d||'',spare:best.spare||0,decks:p.two?2:1,par:best.par}:null});
  fs.writeFileSync(__dirname+'/pool_'+part+'.json',JSON.stringify(out));});
console.log('part',part,'done',out.length,'failed',out.filter(o=>!o.level).length);
