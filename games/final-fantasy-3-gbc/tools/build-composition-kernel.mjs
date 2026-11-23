import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {compositionCases} from './npc-composition-source.mjs';import {compileComposition} from './npc-composition.mjs';import {cellJob,kernelBoundaryJobs} from './composition-kernel.mjs';import {textAudioAssets} from './text-audio-assets.mjs';import {stateAssets} from './state-source.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/composition-kernel',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});
const {cases}=compositionCases(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false})),unique=new Map(),jobs=[],frames=[];
for(const r of cases){const c=compileComposition(r.scene),ids=[];
 for(let cell=0;cell<360;cell++){
  const j=cellJob(r.scene,c,cell,c.pixels),key=j.bytes.toString('hex');
  check(j.expected.subarray(0,16).equals(c.background.subarray(c.map[cell]*16,c.map[cell]*16+16)),'Compiled BG tile contract');
  for(let p=0;p<2;p++){const sprite=c.sprites.find(s=>s.x===(cell%20)*8&&s.y===Math.floor(cell/20)*8&&s.palette===p);check(j.expected.subarray((p+1)*16,(p+2)*16).equals(sprite?c.objGraphics.subarray(sprite.tile*16,sprite.tile*16+16):Buffer.alloc(16)),'Compiled residual OBJ contract');}
  let id=unique.get(key);if(id===undefined){id=jobs.length;unique.set(key,id);jobs.push(j);}else check(jobs[id].expected.equals(j.expected),'Ambiguous cell input');ids.push(id);
 }
 frames.push({label:r.label,world:r.world,map:r.map,camera:r.camera,evidence:r.evidence,jobs:ids});
}
const sourceJobs=jobs.length;jobs.push(...kernelBoundaryJobs());check(jobs.length*5<16384,'Metadata ROM bank capacity');
const sources=[],rows=[],declarations=[];let bank=16,used=0,code='';
async function flush(){if(!code)return;const file=gen+'/cells'+bank+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\n'+code);sources.push(file);code='';used=0;}
for(const [i,j] of jobs.entries()){if(used+j.bytes.length>16384){await flush();bank++;}const name='cell'+i;declarations.push('extern const uint8_t '+name+'[];');code+='const uint8_t '+name+'[]={'+[...j.bytes]+'};\n';rows.push('{'+name+','+j.bytes.length+','+bank+'}');used+=j.bytes.length;}
await flush();const banks=2**Math.ceil(Math.log2(bank+1));check(banks<=256,'Probe cartridge capacity');
await fs.writeFile(gen+'/kernel-assets.h','#include <stdint.h>\n#define JOB_COUNT '+jobs.length+'u\ntypedef struct{const uint8_t *data;uint16_t size;uint8_t bank;}Job;\nextern const Job jobs[JOB_COUNT];\n');
await fs.writeFile(gen+'/kernel-assets.c','#pragma bank 7\n#include "kernel-assets.h"\n'+declarations.join('\n')+'\nconst Job jobs[JOB_COUNT]={'+rows.join(',')+'};\n');
await fs.writeFile(gen+'/state-assets.h',stateAssets(data).header);const audio=await textAudioAssets(data,gen,out,0);
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');const rom=out+'/ff3-composition-kernel.gbc';
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo'+banks,'-Wl-m','-Wl-j','-I'+gen,'-o',rom,...['platform','platform-probe','game-state','game-save','memory','audio-control','audio-channel','audio-music','audio-engine','audio-output','audio-native','text-vblank','composition-kernel','composition-kernel-probe'].map(n=>ROOT+'/src/'+n+'.c'),gen+'/kernel-assets.c',...audio.sources,...sources],{cwd:out,maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link overlap');const bytes=await fs.readFile(rom);checkGbc(bytes,banks,0x1b,3);
const symbols={};for(const m of (await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
check(symbols.s__HEAP<0xd000&&symbols._kernel_input===0xd800&&symbols._text_staging===0xd950&&symbols.b_ff3_compose_cell===12,'Kernel memory placement');
const fixedRomEnd=Math.max(...['CODE','CODE_0','HOME','INITIALIZER','GSINIT','GSFINAL'].map(n=>(symbols['s__'+n]??0)+(symbols['l__'+n]??0)));check(fixedRomEnd<0x4000,'Fixed ROM capacity');
for(const b of audio.banks.filter(b=>b.n!==8))check(bytes.subarray(b.n*16384,b.n*16384+b.bytes.length).equals(b.bytes),'Linked original audio bank');
const replica=symbols._ff3_audio_bank36;check((replica>>>16)===8&&bytes.subarray(8*16384+(replica&16383),8*16384+(replica&16383)+8192).equals(audio.banks[0].bytes),'Linked local audio replica');
for(const [i,j]of jobs.entries()){const a=symbols['_cell'+i],offset=(a>>>16)*16384+(a&16383);check((a>>>16)>=16&&(a&65535)+j.bytes.length<=0x8000&&bytes.subarray(offset,offset+j.bytes.length).equals(j.bytes),'Linked source cell '+i);}
const report={sourceSha256:profile.sha256,romSha256:hash(bytes),audio:audio.report,frames,sourceJobs,jobs:jobs.map(j=>({label:j.label,inputSha256:hash(j.bytes),expected:j.expected?.toString('hex'),expectedError:j.expectedError??0,layers:j.layers,bytes:j.bytes.length})),memory:{fixedRomEnd,staticWramEnd:symbols.s__HEAP,inputAddress:0xd800,inputCapacity:333,outputAddress:0xd950,outputBytes:48,kernelRomBytes:symbols.l__CODE_12},scope:'Actual SM83 cell composition and isolated VBlank upload under native audio; host-selected per-frame palette policies, no product residency/camera integration'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({romSha256:report.romSha256,frames:frames.length,jobs:jobs.length,maxLayers:Math.max(...jobs.map(j=>j.layers)),maxInput:Math.max(...jobs.map(j=>j.bytes.length)),banks,memory:report.memory}));
