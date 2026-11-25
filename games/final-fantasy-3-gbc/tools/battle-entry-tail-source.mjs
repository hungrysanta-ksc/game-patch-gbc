import {check,hash} from './source.mjs';
import {entryState} from './battle-entry-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {battleCpu,originalFormation} from './battle-placement-source.mjs';
import {offset} from './render-budget-source.mjs';import {segment} from './state-source.mjs';
const word=(c,a)=>c.m[a]|c.m[a+1]<<8;
export function tailAssets(rom){
 const rows=[['rows',0x2f,0xb516,4,1],['chunks',0x2f,0xbe7f,24,1],['party_ppu',0x2f,0xaa68,8,2],['map_rows',0x2f,0xb7bb,4,1],['map_ppu',0x2f,0xb7bf,8,2],['map_x',0x2f,0xb7c7,6,1],['maps',0x2f,0xb7cd,104,1]];
 const consumers=['B493','BF6F','AB25','B773','B77C','B7A8','B72B/B6C8'],lines=[6550,7830,5113,6931,6934,6937,6941];
 const tables=rows.map(([name,bank,cpu,size,width],i)=>{const begin=offset(bank,cpu),bytes=rom.subarray(begin,begin+size);return {name,bank,cpu,size,begin,width,consumer:'2F/'+consumers[i],asmRef:'ff3j.asm:'+lines[i],sha256:hash(bytes),bytes};});
 const bosses=[];for(let id=0;id<24;id++){const c=battleCpu(rom);c.m[0x7d73]=id;c.x=0;c.call(0xa3b8);const bank=c.m[0x84],address=word(c,0x7e),begin=16+bank*16384+(address&16383),chunks=rom[offset(0x2f,0xbe7f+id)];check(chunks>0&&chunks<=36,'Boss block count');bosses.push({id,bank,address,begin,chunks,flags:rom[offset(0x2e,0x9069+id*2)]});}
 const header='#include <stdint.h>\n'+tables.map(t=>'static const uint'+(t.width*8)+'_t ff3_tail_'+t.name+'[]={'+(t.width===1?[...t.bytes]:Array.from({length:t.size/2},(_,i)=>t.bytes.readUInt16LE(i*2)))+'};').join('\n')+'\nstatic const uint8_t ff3_tail_boss_flags[]={'+bosses.map(b=>b.flags)+'};\n';
 return {tables,bosses,header};
}
export function tailReference(rom,options={}){
 const assets=tailAssets(rom),frames=[],sounds=[];let active=false,prefix=false,prefixWaits=0,actor=0,boss=false,loading=false,m;
 const battleType=options.back?0x88:0;
 const logical=(c,phase,ticket)=>{
  const e=entryState(c);e[0]=battleType; // A40B temporarily flips the physical loader's flag for summon graphics.
  return Buffer.concat([e,Buffer.from([4,7,0,prefixWaits]),Buffer.from(Array.from({length:4},(_,i)=>c.m[0x7d9c+i*2])),Buffer.from(c.m.subarray(0x7da3,0x7da7)),Buffer.from(c.m.subarray(0x7d8b,0x7d8f)),Buffer.from(c.m.subarray(0x7da7,0x7daf)),Buffer.from(c.m.subarray(0x7dce,0x7dd3)),Buffer.from([c.m[0x7d7b],c.m[0x7d68],c.m[0x7d73],phase,actor,ticket&255,ticket>>8])]);
 };
 const capture=(b,c,p)=>{
  if(b.reason!=='before-NMI-wait')return;if(prefix){prefixWaits++;return;}if(!active)return;
  const ret=(c.m[0x100+((c.s+1)&255)]|(c.m[0x100+((c.s+2)&255)]<<8))+1;
  let phase;if(ret===0xf987||ret===0xf9d3)phase=boss?1:4;else if(ret===0xf8bf)phase=2;else if(ret===0xf8c8)phase=loading?3:5;else if(ret===0xb5ac)phase=6;else if(ret===0xb5e6)phase=7;else throw Error('Unknown tail wait '+ret.toString(16));
  let work=null,source=null;
  if(phase===1){const a=assets.bosses[c.m[0x7d73]&31],off=c.m[0x90]*64;work=Buffer.from([1,a.id,off&255,off>>8,64,c.m[0x80],c.m[0x81],0]);source=rom.subarray(a.begin+off,a.begin+off+64);}
  if(phase===4){const g=c.m[0x7da3+actor],asset=g===2?24:g===3?25:c.m[0x7d8b+actor],base=asset===24?0xbf80:asset===25?0xbf00:0x8000+asset*0x2a0,off=word(c,0x7e)-base,n=ret===0xf9d3?c.m[0x82]:64;work=Buffer.from([2,asset,off&255,off>>8,n,c.m[0x80],c.m[0x81],0]);source=Buffer.from(Array.from({length:n},(_,i)=>c.read(word(c,0x7e)+i)));}
  if(phase===6||phase===7){const at=word(c,0x7dc7),asset=at>=0xb82d?3:Math.floor((at-0xb7cd)/32),off=at-(0xb7cd+asset*32);check(asset>=0&&asset<=3,'Stone table identity');work=Buffer.from([3,asset,off,0,c.m[0x7dc9]*2,c.m[0x7dc5],c.m[0x7dc6],0]);source=Buffer.alloc(work[4]);}
  frames.push({state:logical(c,phase,frames.length),ret,work,source,ppu:Buffer.from(p.bytes),oam:Buffer.from(c.m.subarray(0x200,0x300)),mirror:c.m[0x98],icons:Buffer.from([c.m[0xac],c.m[0xb7],...c.m.subarray(0x7db7,0x7dbb)]),ranges:b.ranges});
 };
 ({m}=initializedBattle(rom,{formation:3,rows:[0,1,0,1],terrain:0,...options,capture}));const c=m.c;
 if(options.normalized)for(let i=0;i<4;i++){c.m[0x7d9b+i*2]=options.normalized[i];c.m[0x7d9c+i*2]=options.second?.[i]??0;}
 if(options.cache)c.m.set(options.cache,0x7da3);
 const prefixSeed=Buffer.concat([entryState(c),Buffer.alloc(4)]);prefix=true;m.begin();segment(c,0xb469,0xb479);prefix=false;
 if(options.boss!==undefined){c.m[0x7d7b]=9;c.m[0x7d68]|=64;c.m[0x7d73]=options.boss;}
 if(options.expectedBoss!==undefined)check(c.m[0x7d7b]===9&&(c.m[0x7d68]&64)&&(c.m[0x7d73]&31)===options.expectedBoss,'Original formation selects boss entry resource');
 const initial=logical(c,0,0),seed=Buffer.concat([initial.subarray(0,69),Buffer.alloc(4),initial.subarray(69)]);
 const step=c.step.bind(c);c.step=function(){if(active&&this.pc===0xf8cb&&frames.length){frames.at(-1).published={ppu:Buffer.from(m.ppu.bytes),oam:Buffer.from(m.physicalOam)};}if(this.banks[1]===0x2f){if(this.pc===0xbe97)boss=true;if(this.pc===0xb489)boss=false;if(this.pc===0xb5c3)actor=this.x;if(this.pc===0xab0d)loading=true;if(this.pc===0xab3a)loading=false;}step();};
 const write=c.write.bind(c);c.write=(a,v)=>{if(active&&(a===0x7f49||a===0x7f42))sounds.push({at:frames.length,address:a,value:v});write(a,v);};
 // Back-attack F94F regenerates 256*8 bit-reversal steps for EACH block.
 // This larger source routine has its own bound; do not weaken the shared
 // transition oracle's 3M-instruction guard or skip original work.
 active=true;m.begin();c.pc=0xb479;c.push(0x4f);c.push(0xff);let instructions=0;
 while(c.pc!==0x5000){check(++instructions<=6000000&&frames.length<=600,'Tail source execution bound');c.step();}
 const refreshIndex=options.clearAfter?frames.length:null;
 if(options.clearAfter){if(options.clearAfter===2){for(let i=0;i<4;i++)c.m[0x7d9b+i*2]&=247;}else c.m.fill(0,0x7d9b,0x7da3);if(options.countSentinel)c.m.set([9,8,7,6,5],0x7dce);m.call(0xb5b8);}
 active=false;actor=4;const end=logical(c,8,frames.length);
 const terminal={state:end,ppu:Buffer.from(m.ppu.bytes),oam:Buffer.from(c.m.subarray(0x200,0x300)),mirror:c.m[0x98],icons:Buffer.from([c.m[0xac],c.m[0xb7],...c.m.subarray(0x7db7,0x7dbb)]),work:null};
 for(let i=0;i<frames.length;i++){const f=frames[i];if(!f.work)continue;const next=frames[i+1]??terminal,w=f.work,at=w.readUInt16LE(5);f.output=Buffer.from(Array.from({length:w[4]},(_,i)=>next.ppu[at+(w[0]===3?(i>>1)*32+(i&1):i)]));}
 check(seed.length===75&&end.length===71,'Tail ABI');return {prefixSeed,seed,frames,terminal,instructions,sounds,refreshIndex,scope:'Original B479..B909 including actual graphics loaders, motion and stone writes, NMI waits intercepted; no raster/audio timing'};
}
export function bossFormations(rom){const result=new Map();
 for(let formation=0;formation<512;formation++){const f=originalFormation(rom,formation);if(f.unresolved||f.layout!==9)continue;
  const c=battleCpu(rom);c.m[0x7ced]=formation&255;c.m[0x7cee]=formation>>8;segment(c,0xa02a,0xa0b7);if(!(c.m[0x7d68]&64))continue;
  const monster=f.slots[0].monster,graphic=rom[0x5cb10+monster]&31;check(graphic<24,'Boss entry graphic range');
  if(!result.has(graphic))result.set(graphic,{formation,monster,graphic,flags:c.m[0x7d68]});
 }return [...result.values()];
}
export function tailCases(rom){const registry=bossFormations(rom),out=[];for(const back of [false,true]){
 for(let i=0;i<64;i++)out.push({back,normalized:[0,1,2,3].map(j=>i*4+j),second:[0,1,2,3].map(j=>(i*37+j*19)&255),rows:[0,1,2,3].map(j=>(i>>j)&1),jobs:[0,1,2,3].map(j=>(i*4+j)%22),cache:[0,1,2,3].map(j=>(i+j)&3)});
 for(let boss=0;boss<24;boss++){const known=registry.find(r=>r.graphic===boss);out.push({back,...(known?{formation:known.formation}:{boss}),expectedBoss:boss,normalized:[0,1,64,128]});}
 }for(const back of [false,true])for(const partyStatus of [[64,96,72,64],[128,64,32,8]])out.push({back,partyStatus,clearAfter:true,countSentinel:true});for(const back of [false,true])for(const normalized of [[8,8,8,8],[9,12,8,0]])out.push({back,normalized,clearAfter:normalized[0]===9?2:1,countSentinel:true});return out;}
export function tailFixtures(rom){const chunks=[];let events=0,transferBytes=0,negativeOffset;
 for(const options of tailCases(rom)){const r=tailReference(rom,options),n=r.frames.length+1,header=Buffer.alloc(5);header[4]=Number(options.clearAfter)||0;header.writeUInt16LE(n);header.writeUInt16LE(r.refreshIndex??65535,2);const row=[r.prefixSeed,r.seed,header];negativeOffset??=39+75+5;
  for(const f of [...r.frames,r.terminal]){row.push(f.state,Buffer.from([f.work?1:0]));if(f.work){row.push(f.work,f.source,f.output);transferBytes+=f.work[4];}}
  chunks.push(Buffer.concat(row));events+=n;
 }return {bytes:Buffer.concat(chunks),cases:chunks.length,events,transferBytes,negativeOffset,bossFormations:bossFormations(rom)};
}
