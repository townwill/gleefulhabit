var DIRS={'>':[1,0],'<':[-1,0],'^':[0,-1],'v':[0,1]};
var TMASK={r:1,g:2,b:4,y:3,m:5,c:6,w:7};
var FMASK={'1':1,'2':2,'4':4};
var CDIR={'6':[1,0],'7':[0,1],'8':[-1,0],'9':[0,-1]};
var DJ=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
function dirIndex(dx,dz){for(var i=0;i<8;i++)if(DJ[i][0]===dx&&DJ[i][1]===dz)return i;return 0;}
function parseLevel(def){
  var rows=def.rows,H=rows.length,W=rows[0].length,two=def.decks===2,dw=two?(W-1)/2:W,cells=[],mirrors=[],targets=[],emitters=[],others=[],combs=[],nd=0;
  for(var z=0;z<H;z++){cells.push([]);for(var x=0;x<W;x++){
    var ch=rows[z].charAt(x),o=null;
    if(ch==='X'){o={t:'void'};}
    else if(ch==='L'){o={t:'lift',px:x<dw?x+dw+1:x-dw-1};others.push(o);}
    else if(DIRS[ch]){o={t:'emitter',d:DIRS[ch]};emitters.push(o);}
    else if(ch==='D'){o={t:'mirror',fixed:false,half:false,dial:true,k:+(def.d||'').charAt(nd++)||0,idx:mirrors.length};mirrors.push(o);}
    else if(ch==='/'||ch==='N'||ch==='F'||ch==='B'||ch==='S'||ch==='Z'){
      o={t:'mirror',fixed:ch==='F'||ch==='B',half:ch==='S'||ch==='Z',k:(ch==='/'||ch==='F'||ch==='S')?1:0};
      if(!o.fixed){o.idx=mirrors.length;mirrors.push(o);}else others.push(o);
    }
    else if(ch==='P'){o={t:'prism'};others.push(o);}
    else if(ch==='#'){o={t:'wall'};others.push(o);}
    else if(CDIR[ch]){o={t:'comb',d:CDIR[ch],ci:combs.length};combs.push(o);others.push(o);}
    else if(FMASK[ch]){o={t:'filter',mask:FMASK[ch]};others.push(o);}
    else if(ch==='R'||ch==='G'||ch==='U'){o={t:'target',need:ch==='R'?1:ch==='G'?2:4,n:2,idx:targets.length};targets.push(o);}
    else if(TMASK[ch]){o={t:'target',need:TMASK[ch],n:1,idx:targets.length};targets.push(o);}
    if(o){o.x=x;o.z=z;}
    cells[z].push(o);
  }}
  var tray=[];(def.tray||'').split('').forEach(function(ch){var o;if(ch==='P')o={t:'prism'};else{o={t:'mirror',fixed:false,half:ch==='S',k:1,idx:mirrors.length};mirrors.push(o);}o.tray=true;o.x=-1;o.z=-1;tray.push(o);});
  return {two:two,dw:dw,W:W,H:H,cells:cells,mirrors:mirrors,targets:targets,emitters:emitters,others:others,tray:tray,combs:combs,
    name:def.name,hint:def.hint,par:def.par,init:mirrors.map(function(m){return m.k;}),radix:mirrors.map(function(m){return m.dial?8:2;})};
}
function trace(L,st){
  var cin=L.combs.map(function(){return 0;}),res,pass=0;
  for(;;){
    res=traceOnce(L,st,cin);var same=true;
    for(var i=0;i<cin.length;i++)if(res.cacc[i]!==cin[i])same=false;
    if(same)break;if(++pass>6){res.loop=true;break;}cin=res.cacc;
  }
  return res;
}
function traceOnce(L,st,cin){
  var segs=[],hits=[],acc=L.targets.map(function(){return 0;}),cnt=L.targets.map(function(){return 0;}),cacc=L.combs.map(function(){return 0;}),touched={},seen={},loop=false,lifts=[];
  function seg(ax,az,bx,bz,c,n){segs.push({ax:ax,az:az,bx:bx,bz:bz,c:c,n:n});}
  function shoot(x,z,dx,dz,c,n){
    var sx=x,sz=z;
    for(var i=0;i<200;i++){
      var nx=x+dx,nz=z+dz;
      if(nx<0||nx>=L.W||nz<0||nz>=L.H){seg(sx,sz,x+dx*0.75,z+dz*0.75,c,n);return;}
      var o=L.cells[nz][nx];
      if(o&&o.t==='void'){seg(sx,sz,x+dx*0.75,z+dz*0.75,c,n);return;}
      if(!o){x=nx;z=nz;continue;}
      touched[nx+','+nz]=1;
      if(o.t==='wall'||o.t==='emitter'){seg(sx,sz,nx-dx*0.5,nz-dz*0.5,c,n);hits.push({x:nx-dx*0.5,z:nz-dz*0.5,c:c});return;}
      if(o.t==='mirror'){
        var kv=o.fixed?o.k:st[o.idx],kk=o.dial?kv:(kv%2===0?2:6),j=dirIndex(dx,dz),nj=((kk-j)%8+8)%8;
        if(nj===j){x=nx;z=nz;continue;}
        var key=nx+','+nz+','+dx+','+dz+','+c;if(seen[key]){loop=true;seg(sx,sz,nx,nz,c,n);return;}seen[key]=1;
        seg(sx,sz,nx,nz,c,n);hits.push({x:nx,z:nz,c:c});
        if(o.half)shoot(nx,nz,dx,dz,c,n);
        n++;dx=DJ[nj][0];dz=DJ[nj][1];x=sx=nx;z=sz=nz;continue;
      }
      if(o.t==='prism'){
        var pk=nx+','+nz+','+dx+','+dz+','+c;if(seen[pk]){loop=true;seg(sx,sz,nx,nz,c,n);return;}seen[pk]=1;
        seg(sx,sz,nx,nz,c,n);hits.push({x:nx,z:nz,c:c,big:1});
        if(c&1)shoot(nx,nz,dx,dz,1,n);
        if(c&2)shoot(nx,nz,dz,-dx,2,n);
        if(c&4)shoot(nx,nz,-dz,dx,4,n);
        return;
      }
      if(o.t==='filter'){
        seg(sx,sz,nx,nz,c,n);var nc=c&o.mask;
        if(!nc){hits.push({x:nx,z:nz,c:c});return;}
        c=nc;x=sx=nx;z=sz=nz;continue;
      }
      if(o.t==='lift'){
        var lk=nx+','+nz+','+dx+','+dz+','+c;if(seen[lk]){loop=true;seg(sx,sz,nx,nz,c,n);return;}seen[lk]=1;
        seg(sx,sz,nx,nz,c,n);lifts.push({x:nx,z:nz,c:c});touched[o.px+','+nz]=1;x=sx=o.px;z=sz=nz;continue;
      }
      if(o.t==='comb'){seg(sx,sz,nx,nz,c,n);cacc[o.ci]|=c;return;}
      if(o.t==='target'){seg(sx,sz,nx,nz,c,n);acc[o.idx]|=c;if(c===o.need)cnt[o.idx]++;return;}
    }
  }
  L.emitters.forEach(function(e){shoot(e.x,e.z,e.d[0],e.d[1],7,0);});
  L.combs.forEach(function(o,i){if(cin[i])shoot(o.x,o.z,o.d[0],o.d[1],cin[i],1);});
  var lit=L.targets.map(function(t,i){return acc[i]===t.need&&(t.n<2||cnt[i]>=t.n);});
  return {loop:loop,lifts:lifts,cnt:cnt,cacc:cacc,segs:segs,hits:hits,acc:acc,lit:lit,touched:touched,solved:lit.every(function(v){return v;})};
}
