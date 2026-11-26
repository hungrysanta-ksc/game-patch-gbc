import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check,checkGbc} from './source.mjs';import {motionSpriteAssets,motionSpriteReference,motionRngTable,motionImpactReference,motionFistReference} from './battle-motion-sprites.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/battle-motion-sprites',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});
const assets=motionSpriteAssets(data),rows=[];
for(let frame=0;frame<95;frame++)for(const flip of [0,1])for(const back of [0,1])for(const [x,y]of [[0,0],[208,44],[248,255],[88,80]]){
 const p={frame,x,y,flip,back,palette:frame%3,override:frame%4};rows.push(Buffer.concat([Buffer.from([0,frame,x,y,flip,back,p.palette,p.override]),motionSpriteReference(data,p)]));
}
for(let slice=0;slice<4;slice++)for(const hand of [0,1])for(const back of [0,1])for(const [x,y]of [[0,0],[88,80],[255,255]])rows.push(Buffer.concat([Buffer.from([1,slice,x,y,hand,back,0,0]),motionSpriteReference(data,{slice,x,y,hand,back})]));
const rngTables=[motionRngTable(data,0),motionRngTable(data,2)];
for(const claw of [false,true])for(const variant of [0,1])for(const frame of [4,5,6,7])for(const hand of [0,1])for(const back of [0,1])for(const index of [0,1,31,127,128,254,255])for(const [x,y]of [[88,80],[255,255]]){
 const r=motionImpactReference(data,{claw,frame,x,y,hand,back,index,table:rngTables[variant]});rows.push(Buffer.concat([Buffer.from([claw?4:2,frame,x,y,hand,back,index,variant]),r.oam,r.point,r.counters]));
}
for(const variant of [0,1])for(const hand of [0,1])for(const back of [0,1])for(const index of [0,1,31,127,254,255])for(const [x,y]of [[208,44],[255,255]]){const r=motionFistReference(data,{x,y,hand,back,index,table:rngTables[variant]});rows.push(Buffer.concat([Buffer.from([3,0,x,y,hand,back,index,variant]),r.oam,r.counters]));}
const fixture=Buffer.concat(rows);await fs.writeFile(gen+'/battle-select-fixture.h','#define SELECT_CASES '+rows.length+'UL\n');await fs.writeFile(gen+'/battle-motion-sprites-assets.h',assets.header);await fs.writeFile(out+'/fixtures.bin',fixture);
const sources=[];for(let i=0;i<Math.ceil(fixture.length/16384);i++){const p=gen+'/fixture'+i+'.c';await fs.writeFile(p,'#pragma bank '+(17+i)+'\n#include <stdint.h>\nconst uint8_t fixture'+i+'[]={'+[...fixture.subarray(i*16384,(i+1)*16384)]+'};\n');sources.push(p);}
const banks=64,rom=out+'/ff3-battle-motion-sprites.gbc',compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Compiler identity');
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo'+banks,'-Wm-ynFF3MOTION','-Wl-m','-Wl-j','-I'+gen,'-o',rom,...['battle-motion-sprites','battle-motion-sprites-test'].map(n=>ROOT+'/src/'+n+'.c'),...sources],{cwd:out,maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const bytes=await fs.readFile(rom);checkGbc(bytes,banks,0x1b,3);check(bytes.subarray(17*16384,17*16384+fixture.length).equals(fixture),'Linked fixture');check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link capacity');
const negative=Buffer.from(bytes);negative[17*16384+8]^=1;let sum=0;for(let i=0;i<negative.length;i++)if(i!==334&&i!==335)sum=(sum+negative[i])&65535;negative.writeUInt16BE(sum,334);await fs.writeFile(out+'/ff3-battle-motion-sprites-negative.gbc',negative);
const report={sourceSha256:profile.sha256,romSha256:hash(bytes),negativeRomSha256:hash(negative),cases:rows.length,fixtureSha256:hash(fixture),source:assets.source,scope:'Source metasprite and slice OAM consumers; live sequencing, resource loads and target-device rendering are separate.'};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
