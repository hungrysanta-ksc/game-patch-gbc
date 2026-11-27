import {battleCpu,originalFormation} from './battle-placement-source.mjs';
import {check} from './source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {partyOamInput,nativePartyTiles} from './battle-party-oam-source.mjs';
import {cgbPalette} from './field-source.mjs';
// Execute FC27, A02A (including four A0C8 calls), 9FAA/A31F/B909 and
// 34/87BE. The explicit seed boundary does not claim a complete field ZP.
export function encounterEntryOriginal(rom,formation,seed,state){
 const c=battleCpu(rom);c.m.fill(0,0,256);c.a=seed;c.p&=254;c.call(0xfc27);const table=Buffer.from(c.m.subarray(0x7be3,0x7ce3));
 check([...c.m.subarray(0x15,0x18)].every(n=>n===seed),'FC27 seed boundary');
 c.m[0x7ced]=formation;c.call(0xa02a);c.call(0x9faa);c.call(0xa31f);c.call(0xb909);
 const counts=[...c.m.subarray(0x7d6f,0x7d73)],types=Buffer.from(c.m.subarray(0x7da7,0x7daf)),ids=Buffer.from(c.m.subarray(0x7d6b,0x7d6f)),layout=c.m[0x7d7b];
 c.m.set([0,0x62,0x75,0x75],0x59);c.m[0x7ed8]=c.m[0x7d68]>>6;c.m[0x7cee]=c.m[0x74c6]=0;
 for(let i=0;i<4;i++){c.m[0x7575+i*64]=state[257+i*64];c.m[0x620f+i*64]=c.m[0x75a8+i*64]=state[527+i*64]&1;}
 for(let i=0;i<8;i++)c.m[0x7675+i*64]=types[i]===255?0:rom[16+0x30*8192+ids[types[i]]*16];
 c.banks=[0x34,0x35,0x3e,0x3f];c.m[0x7cf6]=0x1a;c.call(0x87be);
 const placement=originalFormation(rom,formation,{counts});check(!placement.unresolved&&placement.layout===layout,'Source runtime placement');
 return {formation,seed,counts,types:[...types],ids:[...ids],layout,type:c.m[0x78c3],first:c.m[0x78ba],rng:Buffer.from([(seed&2)>>1,...c.m.subarray(0x15,0x18)]),table,placement};
}
export function encounterWeaponOriginal(rom,test,state,entry){
 const actor=test.actor??0,back=entry.type===0x88,rows=Array.from({length:4},(_,i)=>(state[527+i*64]&1)^+back),jobs=Array.from({length:4},(_,i)=>state[256+i*64]);
 const {m}=initializedBattle(rom,{formation:entry.formation,counts:entry.counts,rows,jobs,back,terrain:0,partyState:state}),c=m.c;m.call(0xb469);m.call(0xb304);
 c.m[0x95]=actor;c.x=actor;c.m[0xb8]=test.target;c.m[0xcc]=1;c.m[0x7e6f]=1;c.m.set([state[515+actor*64],state[517+actor*64]],0x7e1f);c.m.set(test.hits,0xbb);c.m.set(entry.table,0x7be3);c.m.set(entry.rng.subarray(1),0x15);
 const frames=[],sounds=[],step=c.step.bind(c),write=c.write.bind(c);
 c.write=(a,v)=>{if(a===0x7f49)sounds.push(v);write(a,v);};
 c.step=function(){if(this.banks[1]===0x33&&[0xa3c8,0xa1da,0xa350].includes(this.pc))frames.push({hand:this.m[0xcd],point:[...this.m.subarray(0xbe,0xc0)],oam:Buffer.from(this.m.subarray(0x200,0x2a0)),party:partyOamInput(this),tiles:nativePartyTiles(m.ppu.bytes.subarray(0x1390,0x1590)),palette:cgbPalette(m.ppu.bytes.subarray(0x3f1c,0x3f20))});step();};
 m.call(0xb24f,6000000);return {frames,sounds,rng:Buffer.from([entry.rng[0],...c.m.subarray(0x15,0x18)])};
}
