const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2]||__dirname+'/out/index.html','utf8');
const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];const code=blocks[blocks.length-1][1];
const P=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>1:k==='then'?undefined:P,apply:()=>P,construct:()=>P,set:()=>true});
class Obj{constructor(){this.children=[];this.userData={};
  return new Proxy(this,{get:(t,k)=>k in t?t[k]:P,set:(t,k,v)=>{t[k]=v;return true;}});}
  add(o){this.children.push(o);}remove(o){const i=this.children.indexOf(o);if(i>=0)this.children.splice(i,1);}
  traverse(f){f(this);this.children.forEach(c=>c&&c.traverse&&c.traverse!==P&&c.traverse(f));}}
const objs=new Set(['Group','Mesh','Sprite','Points','LineSegments','Scene','PerspectiveCamera','PointLight','DirectionalLight','HemisphereLight']);
const THREE=new Proxy({},{get:(t,k)=>objs.has(k)?Obj:P});
const handlers={};
function el(id){const e={id,style:{},children:[],_h:{},setAttribute(){},addEventListener(n,f){this._h[n]=f;},appendChild(c){this.children.push(c);},getBoundingClientRect(){return{left:0,top:0,width:390,height:844};},
  getContext(){return new Proxy({},{get:(t,k)=>k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):P,set:()=>true});}};return e;}
const els={};const qs=el('q');const document={querySelector:()=>qs,getElementById:id=>els[id]||(els[id]=el(id)),createElement:()=>el('x'),addEventListener(){},hidden:false};
let raf=null,api=null;
let clock=1,tickFn=null;const AC=function(){return new Proxy({},{get:(t,k)=>k==='currentTime'?clock:k==='state'?'running':k==='sampleRate'?64:P});};
const window={AudioContext:AC,THREE,devicePixelRatio:2,innerWidth:390,innerHeight:844,addEventListener(){},__prismTest:a=>api=a};
const ctx={clearTimeout,window,document,THREE,performance:{now:()=>Date.now()},requestAnimationFrame:f=>{raf=f;},setTimeout,setInterval:(f)=>{tickFn=f;},console,Math,localStorage:undefined,Float32Array,Uint8Array,Uint8ClampedArray};
vm.createContext(ctx);vm.runInContext(code,ctx);
const frame=()=>{const f=raf;raf=null;f(Date.now()+16);};
for(let i=0;i<3;i++)frame();
els['b-start']._h.click();if(!tickFn)throw new Error('no sequencer');for(let i=0;i<3000;i++){clock+=0.1;tickFn();}console.log('music ran',Math.round(clock),'s');
for(let k=0;k<3;k++){els['b-track']._h.click();for(let i=0;i<2600;i++){clock+=0.1;tickFn();}console.log(els['b-track'].textContent);}
(async()=>{
 for(let i=0;i<100;i++){
  api.build(i);frame();const L=api.level(),n=L.mirrors.length;let sol=null;
  if(L.two){els['b-deck']._h.click();for(let k=0;k<5;k++)frame();els['b-deck']._h.click();frame();}
  if(L.mirrors.some(m=>m.dial)){api.set(L.init.map((v,j)=>L.radix[j]===8?(v+3)%8:v));api.retrace(false);frame();api.retrace('preview');frame();}
  if(L.two&&!L.tray.length&&!L.mirrors.some(m=>m.dial)){
    let sol2=null;const st2=L.mirrors.map(()=>0);for(;;){api.set(st2.slice());if(api.retrace(true).solved){sol2=st2.slice();break;}let q=0;while(q<n){st2[q]++;if(st2[q]<2)break;st2[q]=0;q++;}if(q===n)break;}
    api.set(L.init.slice());api.retrace(true);api.set(sol2);api.retrace(false);for(let k=0;k<5;k++)frame();await new Promise(r=>setTimeout(r,i===80?3300:60));for(let k=0;k<30;k++)frame();console.log('level',i+1,'two-deck solved',!!sol2,els.win.style.display);els['b-again']._h.click();continue;}
  if(L.tray.length||L.mirrors.some(m=>m.dial)){if(!L.tray.length){console.log('level',i+1,'dial ok');continue;}const tb=els.tray.children;tb[tb.length-1]._h.click();frame();tb[tb.length-1]._h.click();frame();console.log('level',i+1,'tray ok',els.lvname.textContent);continue;}
  for(let s=0;s<(1<<n)&&!sol;s++){const st=[];for(let j=0;j<n;j++)st.push((s>>j)&1);
    api.set(st);const tr=api.retrace(true);if(tr.solved)sol=st;}
  api.set(L.init.slice());api.retrace(true);const cur=L.init.slice();for(let j=0;j<n-1;j++){if(cur[j]!==sol[j]){cur[j]=sol[j];api.set(cur.slice());api.retrace(false);frame();}}await new Promise(r=>setTimeout(r,400));frame();
  api.set(sol);const tr=api.retrace(false);
  for(let k=0;k<5;k++)frame();
  await new Promise(r=>setTimeout(r,i<3||i===20?3300:60));for(let k=0;k<40;k++)frame();
  console.log('level',i+1,'solved',tr.solved,'win shown',els.win.style.display,els.winline.textContent,'|',els.status.innerHTML.replace(/<[^>]+>/g,''));
  els['b-again']._h.click();
 }
 els['b-start']._h.click();els['b-music']._h.click();els['b-next']._h.click();frame();els.lvname._h.click();els['w-tabs'].children[1]._h.click();els['b-menu']._h.click();els['m-stats']._h.click();console.log('stats:',els.stats.innerHTML.replace(/<[^>]+>/g,' ').slice(0,90));els['s-close']._h.click();els['b-view2']._h.click();els['b-menu']._h.click();els['m-levels']._h.click();for(let k=0;k<5;k++)qs._h.click();console.log(els['w-title'].textContent,'|',els['w-stars'].textContent);els['b-daily']._h.click();for(let k=0;k<5;k++)frame();console.log('daily:',els.lvname.textContent,'|',els['b-track'].textContent);
 els['b-endless']._h.click();frame();{const L=api.level(),n=L.mirrors.length,st2=L.mirrors.map(()=>0);let sol=null;for(;;){api.set(st2.slice());if(api.retrace(true).solved){sol=st2.slice();break;}let q=0;while(q<n){st2[q]++;if(st2[q]<2)break;st2[q]=0;q++;}if(q===n)break;}
  api.set(L.init.slice());api.retrace(true);api.set(sol);api.retrace(false);await new Promise(r=>setTimeout(r,3300));for(let k=0;k<30;k++)frame();console.log('endless:',els.winline.textContent,'| next =',els['b-next'].textContent);els['b-next']._h.click();frame();console.log(els.lvname.textContent);els['b-reset']._h.click();frame();}
 els.lvname._h.click();console.log(els['b-daily'].innerHTML,'|',els['b-endless'].innerHTML);
 els['b-erase']._h.click();els['b-erase']._h.click();for(let k=0;k<400;k++)frame();
 console.log('smoke ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
