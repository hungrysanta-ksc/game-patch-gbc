import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {stateCpu,segment} from './state-source.mjs';
export const itemStateSize=72,itemRecordBytes=148;
const pack=b=>Buffer.from(Array.from({length:64},(_,i)=>b[(i>>1)+(i%2)*32]));
const unpack=b=>Buffer.from(Array.from({length:64},(_,i)=>b[(i%32)*2+(i>>5)]));
function ret(c){c.pc=((c.pop()|(c.pop()<<8))+1)&65535;}
/* Run original navigation branches. Only drawing/audio/wait consumers are
 * bypassed. Horizontal endpoint arithmetic runs from B2EA/B3A3, including
 * the original six 20px increments; no GBC renderer timing is inferred. */
export function sourceItemCursor(rom,state,key){
 const c=battleCpu(rom,0x1a),addresses=[0x62,0x63,0x66,0x67,0x68,0x69];
 addresses.forEach((a,i)=>c.m[a]=state[i]);c.m[0x10]=(state[2]*120)&255;
 c.pc=0xaeb8;c.push(key);let event=0,done=false;
 for(let n=0;n<10000;n++){
  if(c.pc===0xaeaa){done=true;break;}
  const boundary={0xb4f7:1,0xaf9c:2,0xb1ae:3,0xaf96:4}[c.pc];
  if(boundary){event=boundary;done=true;break;}
  if(c.pc===0xb2a7){c.pc=0xb2ea;continue;}if(c.pc===0xb362){c.pc=0xb3a3;continue;}
  if([0xb4d4,0x892e,0x9b7d,0x8185,0xf8c5,0xb31b,0xb3d2].includes(c.pc)){ret(c);continue;}
  c.step();
 }
 check(done,'Item cursor original instruction budget');return {state:Buffer.from(addresses.map(a=>c.m[a])),event};
}
export function sourceInventory(rom,state,op,args=Buffer.alloc(2)){
 check(state.length===72,'Item fixture ABI');const out=Buffer.from(state);let result=1;
 if(op===1||op===2){const c=stateCpu(rom);c.m.set(state.subarray(0,64),0x60c0);c.call(op===1?0xbc12:0xbc2d);out.set(c.m.subarray(0x60c0,0x6100));}
 else if(op===3||op===4){const c=battleCpu(rom,0x1a),actor=args[1];check(actor<4,'Item actor');c.m[0x52]=actor;c.m[0x5f]=actor*64;c.m[0x5b]=0x75;c.m[0x5c]=0x75;c.m.set(pack(state),0x60c0);const record=0x7575+actor*64;c.m[record+63]=state[64];c.m[record+62]=state[65];
  if(op===3){check(args[0]<32&&state[args[0]]&&!state[64],'Accepted inventory reservation domain');c.m.set(pack(state),0x7afd);c.m[0x27]=state[args[0]];c.m[0x26]=(args[0]+4)*2;c.m[0x63]=1;segment(c,0xb5c6,0xb5f6);}
  else{check(state[64]&&(state[65]||state.subarray(0,32).includes(state[64])||state.subarray(0,32).includes(0)),'Original return must fit inventory');c.a=state[64];c.y=actor*64+63;c.call(0x9ae7);}
  out.set(unpack(c.m.subarray(0x60c0,0x6100)));out[64]=c.m[record+63];out[65]=c.m[record+62];
 }else if(op===5){const r=sourceItemCursor(rom,state.subarray(66),args[0]);out.set(r.state,66);result=r.event;}
 else throw Error('Unknown item operation');return {state:out,result};
}
export function itemFixtures(rom){const chunks=[],counts={pack:0,unpack:0,reserve:0,return:0,cursor:0};let seed=0x31415926;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
 const add=(op,s,args=Buffer.alloc(2))=>{const r=sourceInventory(rom,s,op,args);chunks.push(Buffer.from([op]),s,args,r.state,Buffer.from([r.result]));counts[['','pack','unpack','reserve','return','cursor'][op]]++;};
 for(let k=0;k<128;k++){const s=Buffer.from(Array.from({length:72},next));add(1,s);add(2,s);}
 for(let actor=0;actor<4;actor++)for(let slot=0;slot<32;slot++)for(const quantity of [0,1,2,99,255]){const s=Buffer.alloc(72);for(let i=0;i<32;i++){s[i]=1+((i*7+slot)%254);s[i+32]=i;}s[slot+32]=quantity;add(3,s,Buffer.from([slot,actor]));const r=sourceInventory(rom,s,3,Buffer.from([slot,actor]));add(4,r.state,Buffer.from([0,actor]));}
 for(let k=0;k<512;k++){const s=Buffer.from(Array.from({length:72},next));s[64]=1+k%255;s[65]=k&1?next()||1:0;if(!(k&1)){s[0]=0;if(k&2)s[31]=s[64];}add(4,s,Buffer.from([0,k%4]));}
 // All reachable column/scroll endpoints, all 256 button bytes, both A stages.
 for(let scroll=0;scroll<8;scroll++)for(const column of [scroll,scroll+1])for(let row=0;row<4;row++){
  if(column===0&&!(row&1))continue;
  for(const selected of [0,1])for(const key of selected?[1,2,16,32,64,128,3,255]:Array.from({length:256},(_,i)=>i)){const s=Buffer.alloc(72);s.set([row,column,scroll,selected,row,column],66);add(5,s,Buffer.from([key,0]));}
 }
 // Second A on another cell: invalid inventory/inventory vs equip caller.
 for(let col=0;col<=8;col++)for(let saved=0;saved<=8;saved++){const s=Buffer.alloc(72);s.set([col?0:1,col,Math.min(col,7),1,saved?2:3,saved],66);add(5,s,Buffer.from([1,0]));}
 return {bytes:Buffer.concat(chunks),counts,cases:Object.values(counts).reduce((a,b)=>a+b,0),recordBytes:itemRecordBytes};
}
