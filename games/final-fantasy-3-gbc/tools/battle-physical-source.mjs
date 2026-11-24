// Original ROM function boundaries, not a complete battle or PPU emulator.
import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';
const ret=c=>{c.pc=((c.pop()|(c.pop()<<8))+1)&65535;};
function intercept(c,hooks){const step=c.step.bind(c);c.step=function(){const hook=hooks.get(this.pc);if(hook){hook(this);ret(this);}else step();};}
export function physicalRng(rom){const c=battleCpu(rom,0x18);c.m[0]=2;c.call(0xfc27);return Buffer.from(c.m.subarray(0x7be3,0x7ce3));}
// op 1: BB28 hit rolls; op 2: BB44 damage arithmetic. All RNG and arithmetic
// callees execute unmodified. Inputs are post-stat/post-status, not equipment.
export function sourcePhysical(rom,op,p,table=physicalRng(rom)){
 check([1,2].includes(op)&&p.length===11,'Physical fixture ABI');check(op===1||p[7]!==0,'Damage division requires a target');
 const c=battleCpu(rom,0x18);c.m.set(table,0x7be3);c.m.set([17,p[10],239],0x15);
 c.m.set([0x75,0x75,0x75,0x76],0x6e);c.m[0x75a1]=p[8];c.m[0x76a1]=p[9];
 if(op===1){c.m[0x24]=p[0];c.m[0x25]=p[1];c.call(0xbb28);return Buffer.from([c.a,0,...c.m.subarray(0x15,0x18)]);}
 c.m.set([p[6],p[0],p[2],p[3],p[4],p[5],p[7],p[1]],0x24);c.m[0x7c]=p[6];c.call(0xbb44);
 return Buffer.from([c.m[0x1c],c.m[0x1d],...c.m.subarray(0x15,0x18)]);
}
export function physicalFixtures(rom){const chunks=[],table=physicalRng(rom),counts={hits:0,damage:0};
 const add=(op,p)=>{chunks.push(Buffer.from([op]),Buffer.from(p),sourcePhysical(rom,op,p,table));counts[op===1?'hits':'damage']++;};
 for(let n=0;n<256;n++)for(const chance of [0,1,49,99,100,255])add(1,[n,chance,0,0,0,0,0,1,0,128,n]);
 for(const attack of [0,1,2,127,128,254,255,256,511])for(const defense of [0,1,127,255])for(const multiplier of [1,2,4])for(const hits of [0,1,2,16,255])for(const flags of [[0,0],[0,128],[128,0],[128,128]])add(2,[attack&255,attack>>8,defense,multiplier,31,hits&1,hits,1,...flags,255]);
 let seed=0x46334633;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
 for(let i=0;i<1024;i++){const p=Array.from({length:11},next);p[1]&=1;p[7]=1+p[7]%12;add(2,p);}
 return {bytes:Buffer.concat(chunks),table,counts,cases:counts.hits+counts.damage,recordBytes:17,negativeOffset:12};
}
export function sourceWeaponSequence(rom,{right,left,hits=[0,0],confused=false,actor=0}){
 check(right>=0&&right<10&&left>=0&&left<10&&actor>=0&&actor<4,'Weapon sequence input');
 const c=battleCpu(rom,0x19),events=[],hooks=new Map();c.m.set([right,left],0x7e1f);c.m.set(hits,0xbb);c.m[0x95]=actor;c.m[0x7d9b+actor*2]=confused?8:0;
 for(let id=0;id<10;id++){const target=rom.readUInt16LE(offset(0x33,0xa080+id*2));hooks.set(target,x=>events.push({hand:x.m[0xcd],animation:x.m[0x7e],hits:x.m[0xbb+x.m[0xcd]],target}));}
 // A094 rewrites $7E to a pointer: observe the ID on entry, without skipping
 // its original counter clamp or dispatcher. Only animation bodies return.
 let animation;intercept(c,hooks);const step=c.step.bind(c);c.step=function(){if(this.pc===0xa094)animation=this.a;const n=events.length;step();if(events.length!==n)events.at(-1).animation=animation;};c.call(0xa0c0);
 return {events,hits:[...c.m.subarray(0xbb,0xbd)],scope:'33/A0C0 controller and A094 clamp; weapon animation bodies intercepted'};
}
export function sourceMonsterFlash(rom,id,mask){const c=battleCpu(rom),events=[];c.m[0x7e9d]=id;c.m[0x7e8f]=mask;
 intercept(c,new Map([[0xb04a,x=>events.push(['flash',x.m[0x7e8f]])],[0xb04d,x=>events.push(['restore',x.m[0x7e8f]])],[0xaf34,()=>events.push(['upload'])]]));c.call(0xb024);
 return {events,scope:'2F/B024 loop; palette construction and PPU upload intercepted, no pixel/timing claim'};
}
export function sourcePartyHurt(rom,{hits=[0,0],cover=0,target=0}){const c=battleCpu(rom),events=[],xy=[192,192,192,192,40,72,104,136];c.m.set(xy,0xc0);c.m.set(hits,0xbb);c.m[0x7edf]=cover;c.m[0x7ee0]=target;
 intercept(c,new Map([[0xa9b1,()=>events.push({kind:'load-hurt'})],[0xb5b8,x=>events.push({kind:'sprites',xy:[...x.m.subarray(0xc0,0xc8)]})],[0xaef4,x=>events.push({kind:'hurt',xy:[...x.m.subarray(0xc0,0xc8)]})]]));c.call(0xb201);
 return {events,xy:[...c.m.subarray(0xc0,0xc8)],scope:'2F/B201 cover movement and hit gate; graphics load, sprites and hit body intercepted'};
}
