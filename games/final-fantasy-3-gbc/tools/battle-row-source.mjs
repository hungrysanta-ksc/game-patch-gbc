import {check,hash} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';
export function rowPositions(rom){const at=offset(0x35,0xa823),bytes=Buffer.from(rom.subarray(at,at+32));return {bytes,provenance:{bank:0x35,cpu:0xa823,offset:at,bytes:32,sha256:hash(bytes)}};}
// Compact comparison ABI. All decisions execute the original ROM bytes.
// Stop before the outer command collector; only the target-window clear
// (91CE) is skipped for execution, since this kernel does not own the PPU.
export function sourceRow(rom,state,op,key=0){
 check(state.length===16&&[1,2,3].includes(op),'Row fixture ABI');
 const s=Buffer.from(state),c=battleCpu(rom,0x1a),actor=op===3?s[15]&7:s[0];
 check(actor<4&&[2,3].includes(op===3?s[6]:s[3]),'Original ally row caller');
 c.m[0x52]=s[0];c.m[0x5f]=actor*64;c.m[0x59]=0;c.m[0x5a]=0x62;c.m[0x5b]=0x75;c.m[0x5c]=0x75;
 const b=0x7575+actor*64,e=0x6200+actor*64;c.m[0x6e]=b&255;c.m[0x6f]=b>>8;
 c.m[e+15]=s[1];c.m[0x78ba]=s[2];c.m[0x18]=s[5];c.m[0x19]=s[3];c.m[b+46]=s[6];
 c.m.set(s.subarray(7,11),0x220);c.m[0xca]=s[11];c.m[b+51]=s[12];c.m[0x78d7]=s[13];c.m[0x78d5]=s[14];c.m[b+44]=s[15];c.m[0x12]=key;
 c.pc=op===1?(s[3]===2?0xa71c:0xa750):op===2?0xa7aa:(s[6]===2?0xa7df:0xa7ea);
 if(op===3){c.push(0x4f);c.push(0xff);}
 let done=false;
 for(let n=0;n<2000;n++){
  if(op!==3&&(c.pc===0xa7a4||c.pc===0x99fd)){
   s[4]=c.pc===0xa7a4?0:op===1?3:c.m[0x52]!==state[0]?2:1;done=true;break;
  }
  if(op===3&&c.pc===0x5000){done=true;break;}
  if(op===3&&c.pc===0x91ce){c.pc=((c.pop()|(c.pop()<<8))+1)&65535;continue;}
  c.step();
 }
 check(done,'Original row instruction budget');
 s[0]=c.m[0x52];s[1]=c.m[e+15];if(op!==3)s[5]=c.m[0x18];s[6]=c.m[b+46];s.set(c.m.subarray(0x220,0x224),7);
 s[11]=c.m[0xca];s[12]=c.m[b+51];s[13]=c.m[0x78d7];s[14]=c.m[0x78d5];return s;
}
export function rowFixtures(rom){const chunks=[],counts={begin:0,input:0,execute:0};
 const add=(op,s,key=0)=>{chunks.push(Buffer.from([op]),s,Buffer.from([key]),sourceRow(rom,s,op,key));counts[['begin','input','execute'][op-1]]++;};
 const seed=(actor,row,back,cmd)=>Buffer.from([actor,row,back,cmd,99,17,4,201,202,203,204,9,0xa6,0xff,0xfe,0x80|actor]);
 for(let actor=0;actor<4;actor++)for(let row=0;row<256;row++)for(const back of [0,8])for(const cmd of [2,3])add(1,seed(actor,row,back,cmd));
 for(let actor=0;actor<4;actor++)for(const back of [0,8])for(const cmd of [2,3]){
  const pending=sourceRow(rom,seed(actor,cmd===2?1:0,back,cmd),1);
  for(let key=0;key<256;key++)add(2,pending,key);
 }
 for(let actor=0;actor<4;actor++)for(let row=0;row<256;row++)for(const cmd of [2,3]){
  const s=seed(actor,row,0,cmd);s[6]=cmd;s[12]=(row*73+19)&255;add(3,s);
 }
 return {bytes:Buffer.concat(chunks),counts,cases:Object.values(counts).reduce((a,b)=>a+b,0),recordBytes:34,negativeOffset:18};
}
