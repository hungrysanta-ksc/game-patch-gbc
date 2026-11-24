import {check,hash} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {segment} from './state-source.mjs';
import {offset} from './render-budget-source.mjs';
export function selectionTables(rom){const regions=[['ff3_target_bits',0x32,0x9a61,8,16055],['ff3_party_bits',0x32,0x9dcc,4,16525],['ff3_target_layouts',0x32,0x9ead,80,16668],['ff3_job_commands',0x34,0x9b21,88,24812]];
 const tables={},provenance=[];for(const [name,bank,cpu,bytes,line]of regions){const at=offset(bank,cpu),data=rom.subarray(at,at+bytes);tables[name]=Buffer.from(data);provenance.push({name,bank,cpu,offset:at,bytes,disassembly:'ff3j.asm',line,sha256:hash(data)});}
 return {tables,provenance,header:Object.entries(tables).map(([k,v])=>'static const uint8_t '+k+'[]={'+[...v]+'};').join('\n')+'\n'};
}
export function targetEnvironment(rom,layout,mask=255,back=false,partyMask=15){const {tables}=selectionTables(rom);const grid=tables.ff3_target_layouts.subarray(layout*8,layout*8+8),monsters=Array.from({length:8},(_,i)=>(mask&(128>>i))&&grid.includes(i)?i%3:255);check(monsters.some(v=>v!==255),'No targetable monster');return Buffer.from([...grid,...monsters,0,1,2,3,...Array.from({length:4},(_,i)=>+( !(partyMask&(8>>i)) )),+back]);}
export function sourceTarget(rom,environment,before,button,{begin=false}={}){check(environment.length===25&&before.length===11,'Target reference ABI');const c=battleCpu(rom,0x19),e=environment;
 // Select the original table by matching its exact 8-byte layout, not a
 // patched instruction or generated substitute for the navigation routine.
 const {tables}=selectionTables(rom);let layout=-1;for(let i=0;i<10;i++)if(tables.ff3_target_layouts.subarray(i*8,i*8+8).equals(e.subarray(0,8))){layout=i;break;}check(layout>=0,'Unknown original target layout');
 c.m[0x7d7b]=layout;c.m.set(e.subarray(8,16),0x7da7);c.m.set(e.subarray(16,20),0x7d8b);c.m.set(e.subarray(20,24),0x7e22);c.m[0x78c3]=e[24]?0x88:0;
 c.m.set(before.subarray(0,9),0xad);c.m[0x7e0f]=before[9];c.m[0x7f49]=before[10];c.m[0xa5]=0;c.m[0x12]=button;
 if(begin){c.m[0xb3]=button;segment(c,0x9a26,0x9a4e);}else c.call(0x9b8c);
 return Buffer.from([...c.m.subarray(0xad,0xb6),c.m[0x7e0f],c.m[0x7f49]]);
}
export function sourceCommandCursor(rom,row,missing,buttons){if(!buttons)return row;const c=battleCpu(rom,0x1a),key=31-Math.clz32(buttons&-buttons);c.m[0x23]=row;c.m[0x38]=missing;c.m[0x46]=3;c.m[0x55]=(0x8b00+row*2)&255;c.m[0x56]=0x8b;c.call(rom.readUInt16LE(offset(0x34,0x8acf+key*2)));return c.m[0x23];}
export function sourceRepeat(rom,previous,held,counter){const c=battleCpu(rom);c.m[0x12]=previous;c.m[0x13]=held;c.m[0x14]=counter;c.call(0xfbc6);return Buffer.from([c.m[0x12],c.m[0x14]]);}
export function sourceCommandDispatch(rom,commands,slot){check(commands.length===6&&slot<6,'Command dispatch boundary');const c=battleCpu(rom,0x1a);c.m.set(commands,0x7400);c.m[0x23]=slot;c.m[0x52]=0;segment(c,0x99c6,0x99fa);return {command:c.m[0x78cf],sound:c.m[0xc9]?(c.m[0xca]|128):0,request:c.m[0xca],pending:c.m[0xc9],entry:c.m[0x18]|c.m[0x19]<<8};}
export function selectionFixtures(rom){const chunks=[],counts={targetBegin:0,targetInput:0,command:0,repeat:0},routes=[];
 const addTarget=(op,e,s,key,out)=>{chunks.push(Buffer.from([op]),e,s,Buffer.from([key]),out);counts[op===1?'targetBegin':'targetInput']++;};
 const keys=[64,64,16,32,128,128,32,32,16,128,64,16,32,128,128,128,128,32,16,64,64,64,64,1,2,3,48,192,4,8,0];
 for(let layout=0;layout<10;layout++)for(const mask of [128,64,192,85,170,127,254,255])for(const back of [false,true])for(const partyMask of [15,5])for(let flags=0;flags<4;flags++){
  let e;try{e=targetEnvironment(rom,layout,mask,back,partyMask);}catch(x){if(x.message==='No targetable monster')continue;throw x;}
  let state=Buffer.alloc(11),out=sourceTarget(rom,e,state,flags,{begin:true});addTarget(1,e,state,flags,out);state=out;
  for(const key of keys){if(!state[0]&&!state[1]){out=sourceTarget(rom,e,state,flags,{begin:true});addTarget(1,e,state,flags,out);state=out;}out=sourceTarget(rom,e,state,key);addTarget(2,e,state,key,out);state=out;}
  routes.push({layout,mask,back,partyMask,flags});
 }
 for(let row=0;row<4;row++)for(const missing of [0,1])for(let key=0;key<256;key++){chunks.push(Buffer.from([3,row,missing,key,sourceCommandCursor(rom,row,missing,key)]));counts.command++;}
 for(const previous of [0,1,2,16,32,64,128,255])for(let held=0;held<256;held++)for(const counter of [1,4,8,16]){chunks.push(Buffer.from([4,previous,held,counter]),sourceRepeat(rom,previous,held,counter));counts.repeat++;}
 return {bytes:Buffer.concat(chunks),counts,cases:Object.values(counts).reduce((a,b)=>a+b,0),routes:routes.length};
}
