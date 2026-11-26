import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check,checkGbc} from './source.mjs';
import {magicFrameAssets,magicFrameReference,magicSequenceReference,magicBudgetAudit} from './battle-magic-frames.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/battle-magic-frames',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});
const assets=magicFrameAssets(data),rows=[];let drawCases=0,sequenceCases=0;
for(let id=0;id<128;id++)for(const horizontal of [0,1])for(const vertical of [0,1])for(const enemy of [0,1])for(const back of [0,1])for(const [x,y,properties,magic]of [[88,80,0,0],[0,0,32,5],[255,255,32,0]]){
 const code=id|horizontal<<7;
 // FF is a marker in the stream, so code FF is reachable only after a marker.
 if(code===255&&!vertical)continue;
 const p={code,vertical,enemy,back,x,y,properties,magic},r=magicFrameReference(data,p);
 rows.push(Buffer.concat([Buffer.from([0,code,vertical,enemy,back,x,y,properties,magic]),r.visible]));drawCases++;
}
const sequenceAudit=[];
for(let spell=0;spell<88;spell++)for(const trim of [0,16]){
 const p=assets.sequences[spell],length=p[0]-trim;if(length<=0)continue;
 let k=1;while(k<=length){if(p[k++]===255)k++;}if(k!==length+1)continue;
 const r=magicSequenceReference(data,spell,trim);sequenceAudit.push({spell,trim,...r});
 for(let i=0;i<=r.events.length;i++){
  const e=r.events[Math.min(i,r.events.length-1)];
  rows.push(Buffer.from([1,spell,trim,i,0,0,0,0,0,i<r.events.length?1:0,e.code,e.vertical,e.index,r.length,Number(e.index===r.length+1)]));sequenceCases++;
 }
}
const fixture=Buffer.concat(rows);check(fixture.length<=111*16384,'Fixture bank capacity');
await fs.writeFile(gen+'/battle-select-fixture.h','#define SELECT_CASES '+rows.length+'UL\n');await fs.writeFile(gen+'/battle-magic-frames-assets.h',assets.header);await fs.writeFile(out+'/fixtures.bin',fixture);
const sources=[];for(let i=0;i<Math.ceil(fixture.length/16384);i++){const p=gen+'/fixture'+i+'.c';await fs.writeFile(p,'#pragma bank '+(17+i)+'\n#include <stdint.h>\nconst uint8_t fixture'+i+'[]={'+[...fixture.subarray(i*16384,(i+1)*16384)]+'};\n');sources.push(p);}
const banks=128,rom=out+'/ff3-battle-magic-frames.gbc',compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Compiler identity');
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo'+banks,'-Wm-ynFF3MAGIC','-Wl-m','-Wl-j','-I'+gen,'-o',rom,...['battle-magic-frames','battle-magic-frames-test'].map(n=>ROOT+'/src/'+n+'.c'),...sources],{cwd:out,maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const bytes=await fs.readFile(rom);checkGbc(bytes,banks,0x1b,3);check(bytes.subarray(17*16384,17*16384+fixture.length).equals(fixture),'Linked fixture');check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link capacity');
const negative=Buffer.from(bytes);negative[17*16384+9]^=1;let sum=0;for(let i=0;i<negative.length;i++)if(i!==334&&i!==335)sum=(sum+negative[i])&65535;negative.writeUInt16BE(sum,334);await fs.writeFile(out+'/ff3-battle-magic-frames-negative.gbc',negative);
await fs.writeFile(out+'/source-audit.json',JSON.stringify({budget:magicBudgetAudit(data),locations:assets.locations,sequences:sequenceAudit},null,2));
const report={sourceSha256:profile.sha256,romSha256:hash(bytes),negativeRomSha256:hash(negative),cases:rows.length,drawCases,sequenceCases,fixtureSha256:hash(fixture),source:assets.source,scope:'Common frame expansion/placement/priority and sequence cursor only. Original wait boundaries observed; no live GBC screen, audio, precast, reflection or special/summon bodies.'};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
