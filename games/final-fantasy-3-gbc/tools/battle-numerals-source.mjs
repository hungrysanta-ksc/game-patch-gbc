import {battleCpu} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';import {check,hash} from './source.mjs';
export const numeralSize=96;
export function numeralAssets(rom){const read=(bank,at,n)=>Buffer.from(rom.subarray(offset(bank,at),offset(bank,at)+n)),tables={sine:read(0x10,0x9a80,128),stagger:read(0x33,0xac43,8)};
 return {tables,header:'#include <stdint.h>\n'+Object.entries(tables).map(([k,v])=>'static const uint8_t ff3_number_'+k+'[]={'+[...v]+'};').join('\n'),source:{body:'33/AD2B..ADA5',decimal:'33/ADF4..AEAD',placement:'33/AC4B..AD09',sine:'10/9A80 via RAM trampoline 2E/9F6C',stagger:'33/AC43 (8)',sha256:hash(Buffer.concat(Object.values(tables)))}};
}
export function numeralSeed({enemy=1,back=0,values=Array(8).fill(9999),types=Array(8).fill(0),center=[32,64,96,128,32,64,96,128],bottom=[80,80,80,80,120,120,120,120],x=[216,216,216,216],y=[44,72,100,128]}={}){const s=Buffer.alloc(numeralSize);values.forEach((v,i)=>s.writeUInt16LE(v,i*2));s.set(types,16);s.set(center,24);s.set(bottom,32);s.set(x,40);s.set(y,44);s[48]=enemy;s[49]=back;return s;}
export function numeralReference(rom,seed,oam=Buffer.alloc(160,0xa5)){
 const c=battleCpu(rom,0x19),trace=[],step=c.step.bind(c);c.m.set(seed.subarray(0,16),0x7e4f);c.m.set(seed.subarray(16,24),0x7da7);
 for(let i=0;i<8;i++)c.m[0x7dd7+i*2]=seed[24+i];c.m.set(seed.subarray(32,40),0x7e07);c.m.set(seed.subarray(40,44),0xc0);c.m.set(seed.subarray(44,48),0xc4);c.m[0x7e6f]=seed[48];c.m[0x78c3]=seed[49]?0x88:0;c.m.set(oam,0x200);
 c.m.set(rom.subarray(offset(0x2e,0x9f6c),offset(0x2e,0x9f6c)+18),0x7ee3);
 const snapshot=done=>{const s=Buffer.from(seed);if(trace.length||!done){s.set(c.m.subarray(0x7300,0x7320),50);s.set(c.m.subarray(0x7380,0x7388),82);s[90]=c.m[0xb6];s[91]=c.m[0xc8]/4;}s[92]=done;s.writeUInt16LE(done?trace.length:trace.length+1,94);trace.push({state:s,oam:Buffer.from(c.m.subarray(0x200,0x2a0))});};
 c.step=function(){if(this.banks[1]===0x33&&[0xa440,0xbf1e].includes(this.pc)){this.pc=((this.pop()|(this.pop()<<8))+1)&65535;return;}if(this.pc===0xf8c5){snapshot(0);this.pc=((this.pop()|(this.pop()<<8))+1)&65535;return;}step();};c.call(0xad2b);snapshot(1);check(trace.length===1||trace.length===33,'Source numeral waits');return trace;
}
export function numeralCases(){const rows=[],vectors=[[0,1,9,10,99,100,999,1000],[9999,10000,16382,16383,0x4000,0x4001,0x7fff,0xffff],[0x8000,0x8001,0x9999,0xa70f,0xbfff,0xc000,0xfffe,0xffff],Array(8).fill(0xffff)];
 for(const enemy of [0,1])for(const back of [0,1])for(const values of vectors)for(const types of [Array(8).fill(0),[255,1,255,2,255,3,255,0]])rows.push(numeralSeed({enemy,back,values,types}));
 for(const back of [0,1])for(const center of [[0,8,16,24,224,232,240,248],[32,64,96,128,32,64,96,128]])rows.push(numeralSeed({back,center,bottom:[0,8,16,24,224,232,240,248]}));return rows;
}
export function numeralFixtures(rom){const chunks=[],oam=Buffer.alloc(160,0xa5),rows=numeralCases();let events=0;for(const seed of rows){const trace=numeralReference(rom,seed,oam);chunks.push(seed,oam,Buffer.from([trace.length]),...trace.flatMap(r=>[r.state,r.oam]));events+=trace.length;}return {bytes:Buffer.concat(chunks),cases:rows.length,events,negativeOffset:257};}
