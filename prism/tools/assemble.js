// Collects generated levels into one pack file.
// Usage: node assemble.js <firstSpecIndex> <out.json> [count=20]
const fs=require('fs');const first=+process.argv[2],outF=process.argv[3],count=+process.argv[4]||20;
if(!outF||isNaN(first)){console.error('usage: node assemble.js <firstSpecIndex> <out.json> [count]');process.exit(1);}
const got=[];
fs.readdirSync(__dirname).filter(f=>/^gen_scratch_\d+\.json$/.test(f)).forEach(f=>{JSON.parse(fs.readFileSync(__dirname+'/'+f,'utf8')).forEach((l,i)=>{if(l&&i>=first&&i<first+count)got[i-first]=l;});});
const missing=[];for(let i=0;i<count;i++)if(!got[i])missing.push(first+i);
if(missing.length){console.error('missing spec indexes (rerun gen2.js for these):',missing.join(', '));process.exit(1);}
fs.writeFileSync(__dirname+'/'+outF,JSON.stringify(got));console.log('wrote',outF,'with',count,'levels');
