import {battleCpu} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';
import {check} from './source.mjs';
// Execute the actual message producer. Only graphics/input leaves are
// intercepted; string selection and decimal formatting remain original code.
export function sourceMessage(rom,input,monsters=Buffer.alloc(12)){
 const [op,value,item,next,script]=input,c=battleCpu(rom,0x1a);
 c.m.fill(255,0x7ad7,0x7aeb);c.m.fill(255,0x78d6,0x78ee);
 c.m[0x4b]=op;c.m[0x64]=20;c.m[0x72]=item;c.m[0x78d5]=script;
 c.m[0x57]=0;c.m[0x58]=0x61;
 for(let i=0;i<4;i++)c.m.set([128+i,255,255,255,255,255],0x6106+i*64);
 c.m.set(monsters.subarray(0,8),0x7ecd);c.m.set(monsters.subarray(8),0x7d6b);
 if(op<5){c.m[0x78d6+op]=value;c.m[0x78ee]=1;c.m[0x78db]=next;}
 else if(op<=9)c.m[0x78d6+op-5]=value;
 const result={kind:'skip',sourceId:65535,wait:0,rewind:0};
 if(op===15){c.m[0x18]=input[5];c.m[0x19]=input[6];c.call(0x95e1);const current=Buffer.from(c.m.subarray(0x1b,0x1f));c.m[0x18]=input[7];c.m[0x19]=input[8];c.call(0x95e1);return {...result,kind:'hp',window:value,raw:Buffer.from([...current,199,...c.m.subarray(0x1b,0x1f)])};}
 check(op<=9,'Message oracle opcode');
 const type=rom[offset(0x34,0x9575)+(value>>1)];
 if(op===9&&value!==255&&((value&1)?type&15:type>>4)>1)return {...result,kind:'unsupported'};
 const start=rom.readUInt16LE(offset(0x34,0x954d)+op*2);c.pc=start;
 const ret=()=>c.pc=((c.pop()|(c.pop()<<8))+1)&65535;
 for(let n=0;n<100000;n++){
  if(c.pc===0x9051){result.rewind=20-c.m[0x64];return {...result,raw:Buffer.from(c.m.subarray(0x7ad7,0x7aeb))};}
  if(c.pc===0xa609){result.sourceId=((c.m[0x18]|c.m[0x19]<<8)-0x8000)/2+c.a;}
  if(c.pc===0x966a){ret();continue;}
  if(c.pc===0x8d1b||c.pc===0x8e14){result.kind=c.pc===0x8d1b?'open':'close';result.window=c.a;ret();continue;}
  // Bottom type 1 waits on A at 934? via FBAA; actual input loop is retained.
  if(c.pc===0xfbaa){result.wait=1;c.m[0x12]=1;ret();continue;}
  if(c.pc===0x8185){ret();continue;}
  c.step();
 }throw Error('Original message instruction budget '+op+'/'+value+' pc='+c.pc.toString(16));
}
