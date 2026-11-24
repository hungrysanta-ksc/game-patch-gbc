import {check,hash} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';
import {sourceItemEligibility} from './battle-item-use-source.mjs';
import {sourceInitialState} from './state-source.mjs';
const ret=c=>{c.pc=((c.pop()|(c.pop()<<8))+1)&65535;};
export function equipmentProperties(rom){const at=offset(0x30,0x9400),bytes=Buffer.from(rom.subarray(at,at+0x98*8));return {bytes,provenance:{bank:0x30,cpu:0x9400,offset:at,bytes:bytes.length,sha256:hash(bytes),consumer:'31/AA16..AF76'}};}
export function sourceEquipmentSwap(rom,state,eligible){
 check(state.length===78,'Equipment fixture ABI');const c=battleCpu(rom,0x1a),s=Buffer.from(state);
 for(let i=0;i<32;i++){c.m[0x7afd+i*2]=s[i];c.m[0x7afe+i*2]=s[32+i];}
 for(let i=0;i<4;i++){c.m[0x7af5+i]=s[64+3+(i&1)];c.m[0x7af9+i]=s[64+5+(i&1)];}
 c.m.fill(1,0x7b3d,0x7b61);const cursor=[0x62,0x63,0x66,0x67,0x68,0x69];cursor.forEach((a,i)=>c.m[a]=s[72+i]);
 const col=s[73]||s[77],row=s[73]?s[72]:s[76];c.m[0x7b3d+col*4+row]=eligible;
 c.m[0x59]=0;c.m[0x5a]=0x62;c.m.set(s.subarray(64,72),0x6200);c.pc=0xaf9c;
 for(let n=0;n<20000;n++){
  if(c.pc===0xaeaa||c.pc===0xb193){const success=c.pc===0xb193;if(success){for(let i=0;i<32;i++){s[i]=c.m[0x60c0+i*2];s[32+i]=c.m[0x60c1+i*2];}s.set(c.m.subarray(0x6200,0x6208),64);}cursor.forEach((a,i)=>s[72+i]=c.m[a]);return {state:s,result:+success};}
  if([0x9b7d,0x9b81,0xb5f9,0xb601].includes(c.pc)){ret(c);continue;}c.step();
 }throw Error('Equipment swap instruction budget');
}
export function sourceEquipmentStats(rom,state){
 check(state.length===192,'Stats fixture ABI');const c=battleCpu(rom,0x18);c.m.set(state.subarray(0,64),0x6100);c.m.set(state.subarray(64,128),0x6200);c.m.set(state.subarray(128),0x7575);
 c.m[0x57]=0;c.m[0x58]=0x61;c.m[0x59]=0;c.m[0x5a]=0x62;c.m[0x5b]=0x75;c.m[0x5c]=0x75;c.m[0x52]=0;c.call(0xaa16);
 return Buffer.concat([Buffer.from(c.m.subarray(0x6100,0x6140)),Buffer.from(c.m.subarray(0x6200,0x6240)),Buffer.from(c.m.subarray(0x7575,0x75b5))]);
}
export function equipmentFixtures(rom){const chunks=[],counts={swap:0,stats:0},initial=sourceInitialState(rom);let seed=0x46334633;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
 const swap=(right,left,id,qty=1,{slot=0,reverse=false,eligible=1,oldQty=1,full=false}={})=>{const s=Buffer.alloc(78);if(full){s.fill(0x1e,0,32);s.fill(1,32,64);}s[slot]=id;s[32+slot]=qty;s.set([right,oldQty,left,oldQty],67);const row=(slot&1)?3:1,col=1+(slot>>2),br=slot&3;s.set(reverse?[br,col,Math.min(col,7),1,row,0]:[row,0,0,1,br,col],72);const r=sourceEquipmentSwap(rom,s,eligible);chunks.push(Buffer.from([1]),s,Buffer.from([eligible]),r.state,Buffer.from([r.result]));counts.swap++;};
 // All original hand-pair IDs, including no item; independent job gate below.
 for(let other=0;other<0x62;other++)for(let id=0;id<0x62;id++)swap(other,other,id,1,{slot:id%32,reverse:!!(other&1)});
 for(let job=0;job<22;job++)for(let id=0;id<0x62;id++)for(const reverse of [false,true])swap(0x1e,0,id,3,{reverse,slot:(job+id)%32,eligible:sourceItemEligibility(rom,id,job)});
 for(const id of [0,0x1e,0x46,0x4a,0x4f,0x56,0x58,0x61,0x62,0xa6])for(const qty of [0,1,2,19,20,21,98,99,255])for(const full of [false,true])for(const same of [false,true])swap(same?id:0x1e,0,id,qty,{full,oldQty:qty,reverse:true});
 const stats=s=>{chunks.push(Buffer.from([2]),s,Buffer.from([0]),sourceEquipmentStats(rom,s),Buffer.from([1]));counts.stats++;};
 for(let job=0;job<22;job++)for(const pair of [[0,0],[0x1e,0],[0,0x1e],[0x1e,0x1f],[0x1e,0x58],[0x58,0x1e],[0x58,0x58],[0x46,0],[0,0x46],[0x4a,0x4f],[0x4f,0x4a],[0x4a,0],[0,0x4a],[0x4f,0],[0,0x4f]]){const s=Buffer.concat([initial.subarray(0x100,0x140),initial.subarray(0x200,0x240),Buffer.alloc(64)]);s[0]=job;s[67]=pair[0];s[69]=pair[1];stats(s);}
 for(let k=0;k<1024;k++){const s=Buffer.from(Array.from({length:192},next));s[0]=k%22;for(let i=0;i<3;i++)s[64+i]=0x57+next()%0x41;s[67]=next()%0x62;s[69]=next()%0x62;stats(s);}
 return {bytes:Buffer.concat(chunks),counts,cases:counts.swap+counts.stats,negativeOffset:80};
}
