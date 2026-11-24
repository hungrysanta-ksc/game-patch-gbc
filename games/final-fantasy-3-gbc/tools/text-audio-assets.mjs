import fs from 'node:fs/promises';import {hash,check} from './source.mjs';import {livePlan,liveTicks,nativeTiming} from './native-plan.mjs';
import {stateCpu,sourceInitialState} from './state-source.mjs';
// Same adopted output tables as build-native.mjs; verified byte-for-byte by the
// integration verifier. These are conversion rules, never extracted payloads.
export async function textAudioAssets(rom,gen,out,selector,{cycles=2}={}){
 const cpu=stateCpu(rom);cpu.m.set(sourceInitialState(rom),0x6000);cpu.m[0x4d]=selector;cpu.call(0xe8ce);const song=cpu.m[0x7f43];
 check(cpu.m[0x7f42]===1&&song<65,'Unsupported diagnostic map music request');const banks=[],sources=[],sourceBanks=[0x36,0x37,0x38,0x39,9];
 async function bank(n,bytes,name='text_audio_bank'+n){const p=gen+'/audio-bank'+n+'.c';await fs.writeFile(p,'#pragma bank '+n+'\n#include <stdint.h>\nconst uint8_t '+name+'[]={'+[...bytes].join(',')+'};\n');sources.push(p);banks.push({n,bytes});}
 for(let i=0;i<5;i++)await bank(i+1,rom.subarray(16+sourceBanks[i]*8192,16+(sourceBanks[i]+1)*8192));
 await bank(8,banks[0].bytes,'ff3_audio_bank36');
 const table=Buffer.alloc(4128);for(let t=0;t<2048;t++)table.writeUInt16LE(Math.max(0,Math.min(2047,2048-Math.round(2097152*(t+1)/1789772))),t*2);
 const periods=[4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068],divs=[8,16,32,48,64,80,96,112];
 for(let p=0;p<16;p++){let best=0,error=Infinity;for(let s=0;s<14;s++)for(let r=0;r<8;r++){const e=Math.abs(Math.log((4194304/(divs[r]*2**s))/(1789772/periods[p])));if(e<error){error=e;best=s*16+r;}}table[4096+p]=best;const n=j=>j<16?15-j:j-16;table[4112+p]=n(p*2)*16+n(p*2+1);}
 check(hash(table)==='4fe09777e2b2d7a51782b944a03b050484e00fc183c0c5eb3d422a7f8f90489c','Adopted native audio conversion changed');
 await bank(6,table);await fs.writeFile(out+'/conversion.bin',table);
 check(banks.slice(0,5).every((b,i)=>b.n===i+1&&b.bytes.length===8192)&&banks.find(b=>b.n===6)?.bytes.length===4128,'Bounded audio lookup bank contract');
 check(Number.isInteger(cycles)&&cycles>=2&&cycles<=6,'Bounded audio stress repetitions');
 const ticks=liveTicks*cycles,plan=Array.from({length:cycles},(_,i)=>i*liveTicks).flatMap(base=>livePlan.map(([t,op,arg])=>[base+t,op,(op===2||op===3)&&arg===32?song:arg]));
 await fs.writeFile(gen+'/native-assets.h','#define NATIVE_PLAN_COUNT '+plan.length+'u\n#define NATIVE_TEST_TICKS '+ticks+'ul\nstatic const uint16_t native_plan_ticks[]={'+plan.map(e=>e[0])+'};\nstatic const uint8_t native_plan_ops[]={'+plan.map(e=>e[1])+'};\nstatic const uint8_t native_plan_args[]={'+plan.map(e=>e[2])+'};\n');
 const fold=b=>{let h=0;for(const v of b)h=((h<<1)^v)&65535;return h;};
 await fs.writeFile(gen+'/resource-assets.h','#define RESOURCE_BANKS 16u\n#define RESOURCE_LAST 6u\nstatic const uint16_t resource_lengths[]={'+Array.from({length:16},(_,i)=>i===8?0:banks.find(b=>b.n===i)?.bytes.length??0)+'};\nstatic const uint16_t resource_probe_hashes[]={'+Array.from({length:16},(_,i)=>{const b=banks.find(b=>b.n===(i>>>1))?.bytes;return b?fold(i&1?b.subarray(-16):b.subarray(0,16)):0;})+'};\n');
 return {sources,banks,report:{sourceBanks,conversionSha256:hash(table),plan,ticks,timing:nativeTiming,mapSelector:selector,mapSong:song,selectionConsumer:'3F/E8CE..E8FD executed with original initial state',recording:false}};
}
