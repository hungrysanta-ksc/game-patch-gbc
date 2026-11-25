import {check,hash} from './source.mjs';import {offset} from './render-budget-source.mjs';import {battleCpu} from './battle-placement-source.mjs';
export function statusOamAssets(rom){
 const tables=[['shapes',0x32,0x9efd,16,16682],['tiles',0x32,0x9f0d,4,16688],['y',0x33,0xa049,8,16862],['palette',0x33,0xa051,8,16865]].map(([name,bank,cpu,size,line])=>{
  const begin=offset(bank,cpu),bytes=rom.subarray(begin,begin+size);return {name,bank,cpu,size,begin,consumer:'32/9F11..33/A048',asmRef:'ff3j.asm:'+line,bytes,sha256:hash(bytes)};
 });check(rom[offset(0x32,0x9fcf)]===0x69,'Target numeral consumer');const digit=rom[offset(0x32,0x9fd0)];
 return {tables,header:'#include <stdint.h>\n#define FF3_STATUS_DIGIT '+digit+'\n'+tables.map(t=>'static const uint8_t ff3_so_'+t.name+'[]={'+[...t.bytes]+'};').join('\n')+'\n'};
}
export function statusOamReference(rom,input,previous=Buffer.alloc(64,0xa5)){
 check(input.length===35&&previous.length===64,'Status OAM ABI');const c=battleCpu(rom,0x19);
 c.m.set(input.subarray(0,8),0xc0);c.m.set(input.subarray(8,12),0x7db7);c.m.set(input.subarray(12,16),0x7e0f);c.m.set(input.subarray(16,32),0x7df7);c.m[0x78c3]=input[32];c.m[0xac]=input[33];c.m[0xb7]=input[34];
 c.m.set(previous.subarray(0,32),0x200);c.m.set(previous.subarray(32),0x260);c.call(0x9f11);
 return {counter:c.m[0xb7],oam:Buffer.concat([Buffer.from(c.m.subarray(0x200,0x220)),Buffer.from(c.m.subarray(0x260,0x280))])};
}
export function statusOamCases(rom){const rows=[];
 for(const back of [false,true])for(let counter=0;counter<256;counter++)for(const enabled of [0,1]){
  const input=Buffer.from([...Array.from({length:4},(_,i)=>(counter*3+i*37)&255),44,72,100,128,...Array.from({length:4},(_,i)=>((counter+i)%9===8?255:(counter+i)%9)),...Array.from({length:4},(_,i)=>(counter*13+i*67)&255),...Array.from({length:16},(_,i)=>(counter+i*19)&255),back?136:0,enabled,counter]);
  rows.push({input,...statusOamReference(rom,input)});
 }return rows;
}
