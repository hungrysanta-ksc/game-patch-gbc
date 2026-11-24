import {check} from './source.mjs';import {battleCpu} from './battle-placement-source.mjs';import {segment} from './state-source.mjs';
export const partySize=55;
function machine(rom,state){check(state.length===partySize&&state[0]<=4,'Party ABI');const c=battleCpu(rom,0x1a);c.m[0x52]=state[0];c.m[0x5b]=0x75;c.m[0x5c]=0x75;c.m[0x5f]=(state[0]*64)&255;c.m.set(state.subarray(2,6),0x78cf);c.m.set(state.subarray(6,10),0x7ac3);c.m.set(state.subarray(22,26),0x7e0f);c.m[0x7be1]=state[54];
 for(let i=0;i<4;i++){const a=0x7575+i*64;c.m.set(state.subarray(10+i*3,13+i*3),a+46);for(const [off,field]of [[1,26],[2,30],[35,38],[44,46],[63,50]])c.m[a+off]=state[field+i];c.m[0x78bb+i*2]=state[34+i];c.m[0x7ce4+i]=state[42+i];}return c;
}
function output(c,state,phase=state[1]){const b=Buffer.from(state);b[0]=c.m[0x52];b[1]=phase;b.set(c.m.subarray(0x78cf,0x78d3),2);b.set(c.m.subarray(0x7ac3,0x7ac7),6);b.set(c.m.subarray(0x7e0f,0x7e13),22);b[54]=c.m[0x7be1];for(let i=0;i<4;i++){const a=0x7575+i*64;b.set(c.m.subarray(a+46,a+49),10+i*3);for(const [off,field]of [[1,26],[2,30],[35,38],[44,46],[63,50]])b[field+i]=c.m[a+off];b[34+i]=c.m[0x78bb+i*2];b[42+i]=c.m[0x7ce4+i];}return b;}
export function sourceParty(rom,state,op,args=Buffer.alloc(4)){const c=machine(rom,state);
 if(op===1){c.pc=0x986f;for(let n=0;n<20000;n++){
   if(c.pc===0xa44a)return output(c,state,1);
   if(c.pc===0xa66c)return output(c,state,2);
   if(c.pc===0x9ae7)return output(c,state,3);
   if(c.pc===0x990a)return output(c,state,0);
   // Skip only the two PPU consumers. Their pixels are separately checked.
   if(c.pc===0x989e){c.pc=0x98a1;continue;}if(c.pc===0x98e3){c.pc=0x98e6;continue;}c.step();
  }throw Error('Original collector budget');
 }
 if(op===2){if(state[0]>0&&state[0]<4){c.a=state[0];c.call(0x9a42);}return output(c,state);}
 if(op===3){check(state[0]<4&&args[0]<6,'Pick domain');c.m[0x23]=args[0];c.m[0x7400+args[0]]=args[1];segment(c,0x99d0,0x99e1);return output(c,state);}
 if(op===4){check(state[0]<4&&[4,5,6].includes(args[0]),'Accept domain');if(args[0]===4){c.m[0xb4]=args[1];c.m[0xb5]=args[2];c.m[0x54]=4;segment(c,0xa853,0xa86c);}else segment(c,args[0]===5?0xa877:0xa8ab,0xaa58);return output(c,state);}
 throw Error('Unknown party operation');
}
export function emptyParty(){const s=Buffer.alloc(partySize);s.fill(255,2,6);return s;}
export function partyFixtures(rom){const records=[],counts={enter:0,previous:0,pick:0,accept:0};let seed=0x31415926;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};const add=(op,s,args=Buffer.alloc(4))=>{records.push(Buffer.from([op]),s,args,sourceParty(rom,s,op,args));counts[['','enter','previous','pick','accept'][op]]++;};
 for(let k=0;k<2048;k++){const s=Buffer.from(Array.from({length:partySize},next));s[0]=k%5;s[1]=0;add(1,s);if(s[0]<4)add(2,s);}
 for(let actor=0;actor<4;actor++)for(let slot=0;slot<6;slot++)for(const command of [2,3,4,5,6,20]){const s=emptyParty();s[0]=actor;add(3,s,Buffer.from([slot,command,0,0]));}
 for(let actor=0;actor<4;actor++)for(let mask=0;mask<256;mask++)for(const flags of [0,64,128,192]){const s=emptyParty();s[0]=actor;s.fill(0x5a,10,22);add(4,s,Buffer.from([4,mask,flags,0]));}
 for(let actor=0;actor<4;actor++)for(const command of [5,6]){const s=emptyParty();s[0]=actor;s.fill(0x5a,10,22);add(4,s,Buffer.from([command,0,0,0]));}
 return {bytes:Buffer.concat(records),counts,cases:Object.values(counts).reduce((a,b)=>a+b,0),recordBytes:115};
}
