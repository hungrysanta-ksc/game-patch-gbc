import {battleCpu} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';
import {check,hash} from './source.mjs';
export function scriptAssets(rom){const chunks=[],offsets=[],lengths=[];let n=0;
 for(let i=0;i<6;i++){const cpu=rom.readUInt16LE(offset(0x34,0x950d+i*2)),at=offset(0x34,cpu);let end=at;while(rom[end]!==255&&end-at<32)end++;check(end-at<32,'Script terminator');const b=Buffer.from(rom.subarray(at,end+1));check(b.subarray(0,-1).every(v=>v<15),'Script opcode');offsets.push(n);lengths.push(b.length);chunks.push(b);n+=b.length;}
 const tables={data:Buffer.concat(chunks),offsets:Buffer.from(offsets),lengths:Buffer.from(lengths),types:Buffer.from(rom.subarray(offset(0x34,0x9575),offset(0x34,0x9575)+72))};
 return {tables,header:'#include <stdint.h>\n'+Object.entries(tables).map(([k,b])=>'static const uint8_t ff3_script_'+k+'[]={'+[...b]+'};').join('\n'),source:{bank:0x34,pointers:0x950d,dispatch:0x8ff7,types:0x9575,sha256:hash(Buffer.concat(Object.values(tables)))}};
}
export function scriptSeed(script=2,{speed=4,effect=1,result=0,item=0,names=[255,255,255,255],messages=[65]}={}){check(messages.length<10,'Bounded terminated queue');const s=Buffer.alloc(29);s.set([script,effect,speed,result,item,...names,...messages,...Array(10-messages.length).fill(255)]);return s;}
// Reference owns the actual dispatcher and message/queue/wait branches.
// Graphics op bodies are explicit external-owner barriers, not rendered here.
export function scriptReference(rom,seed,{early=false}={}){
 const c=battleCpu(rom,0x1a);c.m.set(seed.subarray(5,19),0x78d6);c.m[0x78d5]=seed[0];c.m[0x7ec2]=seed[1];c.m[0x6010]=seed[2];c.m[0x78d3]=seed[3];c.m[0x72]=seed[4];c.m[0x57]=0;c.m[0x58]=0x61;c.m.fill(255,0x6106,0x6200);
 const events=[];let terminal=false,wait=0,ticket=0;const ret=()=>c.pc=((c.pop()|(c.pop()<<8))+1)&65535;
 const snapshot=(kind,op)=>{const b=Buffer.from(seed);b[1]=c.m[0x7ec2];b.set([c.m[0x64],c.m[0x78ee],c.m[0x78ef],wait,kind,op,0,0,++ticket&255,ticket>>8],19);events.push({state:b,buttons:kind===3||kind===2&&early?1:0});};
 const step=c.step.bind(c);c.step=function(){
  if(this.pc===0x9056){snapshot(5,255);terminal=true;return;}
  if(this.pc===0x9037){const op=this.m[0x4b];if(op<10){wait=0;snapshot(1,op);} }
  if(this.pc===0x934e||this.pc===0x9354||this.pc===0x935f||this.pc===0x93c4){const op=this.m[0x4b];if(op!==13||!(this.m[0x78d3]&2)){if(op==12)this.m[0x7ec2]=23;wait=0;snapshot(4,op);if(op===13||op===14)this.m[0x7ec2]=22;}this.pc=0x9051;return;}
  if(this.pc===0x8185){wait=this.m[0x24];snapshot(2,10);this.m[0x12]=early?1:0;ret();return;}
  if(this.pc===0x926b){wait=0;snapshot(3,9);this.m[0x12]=1;}
  if(this.pc===0xfbaa){ret();return;}
  if([0x9754,0x966a,0x8d1b,0x8e14,0xa609].includes(this.pc)){ret();return;}
  step();
 };
 c.pc=0x8ff7;for(let n=0;!terminal;n++){check(n<100000,'Script budget '+seed[0]+' '+c.pc.toString(16));c.step();}
 return events;
}
export function scriptCases(rom){const {tables}=scriptAssets(rom),one=Array.from({length:144},(_,i)=>i).find(i=>((i&1)?tables.types[i>>1]&15:tables.types[i>>1]>>4)===1);check(one!==undefined,'A-wait message');const cases=[];
 for(let script=0;script<6;script++)for(const speed of [0,4,8])for(const early of [false,true])for(const messages of [[],[65],[65,one,65]])for(const result of [0,2]){const seed=scriptSeed(script,{speed,messages,result,names:[0,255,1,255]});cases.push({seed,early});}
 cases.push({seed:scriptSeed(255,{effect:0}),early:false});return cases;
}
export function scriptFixtures(rom){const chunks=[];let events=0;const cases=scriptCases(rom);for(const row of cases){const trace=scriptReference(rom,row.seed,row),n=Buffer.alloc(2);n.writeUInt16LE(trace.length);chunks.push(row.seed,n);for(const e of trace)chunks.push(e.state,Buffer.from([e.buttons]));events+=trace.length;}return {bytes:Buffer.concat(chunks),cases:cases.length,events,negativeOffset:31};}
