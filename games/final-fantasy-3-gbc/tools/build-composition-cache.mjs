import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {compositionCases} from './npc-composition-source.mjs';import {cacheAssets} from './composition-cache-assets.mjs';import {textAudioAssets} from './text-audio-assets.mjs';import {stateAssets} from './state-source.mjs';import {png} from './render-budget-pixels.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/composition-cache',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});
const {jobs,frames,groups}=cacheAssets(compositionCases(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false})).cases);
const sources=[],decl=[],jobRows=[],frameRows=[];let bank=16,used=0,code='';
async function flush(){if(!code)return;const file=gen+'/bank'+bank+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\n'+code);sources.push(file);code='';used=0;}
const linked=[];
async function array(name,bytes,word=false){if(used+bytes.length>16384){await flush();bank++;}const type=word?'uint16_t':'uint8_t';decl.push('extern const '+type+' '+name+'[];');code+='const '+type+' '+name+'[]={'+(word?Array.from({length:bytes.length/2},(_,i)=>bytes.readUInt16LE(i*2)):[...bytes])+'};\n';used+=bytes.length;linked.push({name,bank,bytes});return bank;}
for(const [i,j] of jobs.entries()){const bytes=j.static?j.expected:j.bytes,b=await array('cell'+i,bytes);jobRows.push('{cell'+i+','+bytes.length+','+b+','+Number(j.static)+'}');}
await flush();bank++;
for(const [i,f] of frames.entries()){
 const ids=Buffer.alloc(720);f.ids.forEach((v,n)=>ids.writeUInt16LE(v,n*2));
 if(used+1160>16384){await flush();bank++;}
 const b=await array('ids'+i,ids,true);await array('attrs'+i,f.attributes);await array('palette'+i,f.palette);frameRows.push('{ids'+i+',attrs'+i+',palette'+i+','+b+','+f.group+'}');
 await fs.writeFile(out+'/frame'+i+'.rgb',f.rgb);await fs.writeFile(out+'/frame'+i+'.png',png(f.rgb));
}
await flush();const banks=2**Math.ceil(Math.log2(bank+1));check(banks<=256&&jobs.length*6+frames.length*8<16384,'Metadata/cartridge capacity');
await fs.writeFile(gen+'/cache-assets.h','#include <stdint.h>\n#define CACHE_JOB_COUNT '+jobs.length+'u\n#define CACHE_FRAME_COUNT '+frames.length+'u\ntypedef struct{const uint8_t *data;uint16_t size;uint8_t bank,is_static;}CacheJob;\ntypedef struct{const uint16_t *jobs;const uint8_t *attrs,*palette;uint8_t bank,group;}CacheFrame;\nextern const CacheJob cache_jobs[CACHE_JOB_COUNT];\nextern const CacheFrame cache_frames_data[CACHE_FRAME_COUNT];\n');
await fs.writeFile(gen+'/cache-assets.c','#pragma bank 7\n#include "cache-assets.h"\n'+decl.join('\n')+'\nconst CacheJob cache_jobs[CACHE_JOB_COUNT]={'+jobRows.join(',')+'};\nconst CacheFrame cache_frames_data[CACHE_FRAME_COUNT]={'+frameRows.join(',')+'};\n');
await fs.writeFile(gen+'/state-assets.h',stateAssets(data).header);const audio=await textAudioAssets(data,gen,out,0);
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');const rom=out+'/ff3-composition-cache.gbc';
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO','-DFF3_COMPOSITION_CACHE','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo'+banks,'-Wl-m','-Wl-j','-I'+gen,'-o',rom,...['platform','platform-probe','game-state','game-save','memory','audio-control','audio-channel','audio-music','audio-engine','audio-output','audio-native','text-vblank','composition-kernel','composition-cache','composition-cache-video'].map(n=>ROOT+'/src/'+n+'.c'),gen+'/cache-assets.c',...audio.sources,...sources],{cwd:out,maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link overlap');const bytes=await fs.readFile(rom);checkGbc(bytes,banks,0x1b,3);
const symbols={};for(const m of (await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
check(symbols.s__HEAP<0xd000&&symbols._cache_keys===0xd000&&symbols._cache_masks===0xd720&&symbols._cache_input===0xd800&&symbols._text_staging===0xd950&&symbols._cache_oam0===0xdb00&&symbols._cache_oam1===0xdc00&&symbols._cache_objkeys0===0xdba0&&symbols._cache_objkeys1===0xdca0&&symbols.b_ff3_compose_cell===12,'Memory placement');
const fixedRomEnd=Math.max(...['CODE','CODE_0','HOME','INITIALIZER','GSINIT','GSFINAL'].map(n=>(symbols['s__'+n]??0)+(symbols['l__'+n]??0)));check(fixedRomEnd<0x4000,'Fixed ROM capacity');
for(const b of audio.banks.filter(b=>b.n!==8))check(bytes.subarray(b.n*16384,b.n*16384+b.bytes.length).equals(b.bytes),'Linked audio bank');
const replica=symbols._ff3_audio_bank36;check((replica>>>16)===8&&bytes.subarray(8*16384+(replica&16383),8*16384+(replica&16383)+8192).equals(audio.banks[0].bytes),'Linked local audio replica');
for(const b of linked){const a=symbols['_'+b.name],at=b.bank*16384+(a&16383);check((a>>>16)===b.bank&&(a&65535)+b.bytes.length<=0x8000&&bytes.subarray(at,at+b.bytes.length).equals(b.bytes),'Linked source '+b.name);}
const report={sourceSha256:profile.sha256,romSha256:hash(bytes),audio:audio.report,groups,jobs:jobs.map(j=>({inputSha256:hash(j.bytes),expected:j.expected.toString('hex'),static:j.static})),frames:frames.map(f=>({...f,attributes:[...f.attributes],palette:f.palette.toString('hex'),rgb:undefined,rgbSha256:hash(f.rgb)})),memory:{fixedRomEnd,staticWramEnd:symbols.s__HEAP,cacheSlots:128,cacheDataBanks:[3,4],cacheDataBytes:6144,mapDirtyMaskBytes:4,objectPageKeyBytes:160,stackFloor:0xdd00},scope:'Original diagnostic state frames with runtime tile cache and LCD-on atomic publication; source-driven player/guest/camera integration remains open'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({romSha256:report.romSha256,frames:frames.length,jobs:jobs.length,staticJobs:jobs.filter(j=>j.static).length,memory:report.memory}));
