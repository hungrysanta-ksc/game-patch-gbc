import {npcCpu} from './npc-motion-source.mjs';
import {decodeEvent} from './registry-core.mjs';
export const eventSupported=op=>op<192?((op&15)<10||[12,13].includes(op&15)):[240,241,242,243,252,254,255].includes(op);
export const eventAddresses=[0x17,0x70,0x71,0x74,0x75];
// No rewritten expectation: execute the original ACD1 or complete D219 fetch.
export function eventOriginal(rom,op,f,a,b,execution,pc,active,layout,terrain,fill,dialogue=[]){
 const c=npcCpu(rom,f,a,b,layout,terrain,fill);eventAddresses.forEach((p,i)=>c.m[p]=execution[i]);c.m[0x72]=(pc+0x8000)&255;c.m[0x73]=(pc+0x8000)>>8;c.m[0x6c]=active;
 c.m.set(dialogue,0x740);c.m[0x78]=f[23];if(op===10)c.call(0xacd1);else c.call(0xd219);
 return {execution:Buffer.from(eventAddresses.map(p=>c.m[p])),pc:(c.m[0x72]|c.m[0x73]<<8)-0x8000,active:c.m[0x6c],pending:c.m[0x76],textId:(c.m[0x95]-0x80)*128+c.m[0x76],part1:Buffer.from(c.m.subarray(0x7000,0x70c0)),part2:Buffer.from(c.m.subarray(0x7100,0x71c0)),tile:c.m[0x67]};
}
export function eventFixtures(rom){
 const cases=[],events=Array.from({length:254},(_,id)=>decodeEvent(rom,rom.readUInt16LE(0x58610+id*2))),commands=events.flatMap(e=>e.commands);
 function add(op,f,a,b,e,pc,property=0,fill=1){
  f[26]=0xa5;f[27]=1;const layout=Buffer.alloc(1024,1),terrain=Buffer.alloc(256);terrain[0]=0x24;terrain[2]=property;
  const expected=eventOriginal(rom,op,f,a,b,e,pc,1,layout,terrain,fill),motion=Buffer.concat([f.subarray(32,34),f.subarray(67,72)]),em=Buffer.from(motion);em[4]=expected.tile;
  cases.push({op,field:f.subarray(0,28).toString('hex'),motion:motion.toString('hex'),part1:a.toString('hex'),part2:b.toString('hex'),mapProperty:property,fill,event:{execution:e.toString('hex'),pc,active:1},expected:{field:f.subarray(0,28).toString('hex'),motion:em.toString('hex'),part1:expected.part1.toString('hex'),part2:expected.part2.toString('hex'),event:{execution:expected.execution.toString('hex'),pc:expected.pc,active:expected.active}}});
 }
 // All twelve slots/implemented commands, visibility, in-flight retries,
 // animation preservation and byte-wrapping counters.
 for(let slot=0;slot<12;slot++)for(const cmd of [0,1,2,3,4,5,6,7,8,9,12,13])for(let n=0;n<4;n++){
  const f=Buffer.alloc(75),a=Buffer.alloc(192),b=Buffer.alloc(192),i=slot*16,e=Buffer.from([n===3?255:0,i+cmd,0,0,0]);
  f[6]=n;f[69]=1;f[70]=11;f[71]=10;a[i]=n&1?0:7;a[i+10]=7;a[i+1]=[0,0x50,0xc0,0xff][n];a[i+2]=a[i+4]=10;a[i+3]=a[i+5]=10;a[i+12]=n===2?1:0;a[i+14]=0x3a;a[i+15]=0xb4;b[i+6]=n;b[i+3]=7;
  add(10,f,a,b,e,0x2000,[0,3,128,1][n]);
 }
 // Event moves ignore collision carry/reservations, but preserve the original
 // passability routine's conditional elevation updates and stale fill tile.
 for(let p=0;p<256;p++)for(let z=0;z<4;z++){
  const f=Buffer.alloc(75),a=Buffer.alloc(192),b=Buffer.alloc(192);f[69]=0;f[70]=11;f[71]=10;f[6]=z;
  a[0]=a[16]=1;a[2]=a[4]=p&1?31:10;a[3]=a[5]=10;a[18]=(a[2]+1)&63;a[19]=10;b[6]=b[22]=z;b[3]=5;
  add(10,f,a,b,Buffer.from([0,0,0,0,0]),0x2000,p);
 }
 const wait=commands.find(c=>c.op===252).offset-0x58010;
 for(let arg=0;arg<256;arg++)for(const phase of [0,128]){
  const f=Buffer.alloc(75),a=Buffer.alloc(192),b=Buffer.alloc(192);
  add(11,f,a,b,Buffer.from([1,252,arg,(arg+17)&255,phase]),wait+2);
 }
 // Every distinct real FC/FE operand and both FF-entry paths; use original
 // script bytes rather than an invented sample stream.
 const unique=new Map();for(const c of commands.filter(c=>[252,254,255].includes(c.op)))unique.set(c.op+':'+c.operand,c);
 for(const c of unique.values())for(const repeat of [0,1]){
  const f=Buffer.alloc(75),a=Buffer.alloc(192),b=Buffer.alloc(192);add(11,f,a,b,Buffer.from([repeat,0x16,17,0,0]),c.offset-0x58010);
 }
 return cases;
}
