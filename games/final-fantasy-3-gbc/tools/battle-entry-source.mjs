// Development-only original consumer and resource-lifetime oracle. Never
// link frame traces into the product. Only source tables supply the C port.
import {check,hash} from './source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {segment} from './state-source.mjs';
import {offset} from './render-budget-source.mjs';
export const entryTables=[
 ['rows',0x2f,0xb516,4,'2F/B4E5;B493','ff3j.asm:6550'],
 ['initial',0x2f,0xb51a,16,'2F/B4BF','ff3j.asm:6553'],
 ['toad_y',0x33,0xbde9,8,'33/BD79','ff3j.asm:20872'],
 ['toad_pose',0x33,0xbdf1,8,'33/BD81','ff3j.asm:20875'],
 ['masks',0x2f,0xaea7,56,'2F/AD9A;ADAE;ADF8','ff3j.asm:5701']
];
export function entryAssets(rom){const tables=entryTables.map(([name,bank,cpu,size,consumer,asmRef])=>{
 const begin=offset(bank,cpu),bytes=rom.subarray(begin,begin+size);check(bytes.length===size,'Entry table bounds');
 return {name,bank,cpu,begin,size,consumer,asmRef,sha256:hash(bytes),bytes};
});return {tables,header:'#include <stdint.h>\n'+tables.map(t=>'static const uint8_t ff3_entry_'+t.name+'[]={'+[...t.bytes]+'};').join('\n')+'\n'};}
export function entryState(c){return Buffer.from([
 c.m[0x78c3],...Array.from({length:4},(_,i)=>c.m[0x7d8f+i]),...Array.from({length:4},(_,i)=>c.m[0x7d9b+i*2]),...c.m.subarray(0x7dc1,0x7dc5),
 ...c.m.subarray(0xc0,0xc8),...c.m.subarray(0x7d7f,0x7d83),...c.m.subarray(0x7d83,0x7d87),
 c.m[15],c.m[16],c.m[4],c.m[7],c.m[8],c.m[0x7cf4]
]);}
export function entryReference(rom,options={}){
 const frames=[];let seed,previousWritten,previousOam;
 const capture=(boundary,c,ppu)=>{
  if(!seed||boundary.reason!=='before-NMI-wait')return;
  const returnAddress=(c.m[0x100+((c.s+1)&255)]|(c.m[0x100+((c.s+2)&255)]<<8))+1;
  const ranges=[];let run;
  for(let a=0;a<0x4000;a++){
   const writes=ppu.written[a]-previousWritten[a];if(!writes){run=null;continue;}
   const writer=ppu.lastPc[a];
   if(run&&run.end===a&&run.writer===writer){run.end++;run.writes+=writes;}
   else {run={begin:a,end:a+1,writer,writes};ranges.push(run);}
  }
  const oam=Buffer.from(c.m.subarray(0x200,0x300)),changedOamBytes=oam.reduce((n,v,i)=>n+(v!==previousOam[i]),0);
  previousWritten=ppu.written.slice();previousOam=oam;
  const terrain=returnAddress===0xadde;
  const phase=frames.length===0?1:terrain?2:3;
  check(returnAddress===(phase===1?0xf8b3:phase===2?0xadde:0xf8c8),'Original entry wait owner');
  const mask=terrain?Array.from({length:7},(_,i)=>i).find(i=>rom.subarray(offset(0x2f,0xaea7+i*8),offset(0x2f,0xaea7+i*8)+8).equals(Buffer.from(c.m.subarray(0x7a00,0x7a08)))):frames.length===0?0:7,row=terrain?(c.m[0x7dbb]>>6):0;
  check(mask!==undefined,'Original terrain mask identity');
  frames.push({state:Buffer.concat([entryState(c),Buffer.from([phase,mask,row,frames.length])]),returnAddress,ranges,changedOamBytes,oamSha256:hash(oam),ppuTerrain:Buffer.from(ppu.bytes.subarray(0x600,0x700))});
 };
 const {m,f}=initializedBattle(rom,{formation:3,back:false,rows:[0,1,0,1],terrain:0,...options,capture}),c=m.c;
 if(options.normalized){check(options.normalized.length===4,'Entry status probe');for(let i=0;i<4;i++)c.m[0x7d9b+i*2]=options.normalized[i];}
 if(options.confusedPosition)c.m.set(options.confusedPosition,0x7dc1);
 seed=Buffer.concat([entryState(c),Buffer.alloc(4)]);previousWritten=m.ppu.written.slice();previousOam=Buffer.from(c.m.subarray(0x200,0x300));
 m.begin();segment(c,0xb469,0xb479);
 const tail=Buffer.concat([entryState(c),Buffer.from([4,7,0,frames.length])]);
 const terrain=Buffer.from(c.m.subarray(0x7900,0x7a00));
 check(frames.length>=30&&frames.length<=33&&frames.filter(f=>f.state[35]===2).length===28,'Entry source wait contract');
 // Each masked row is checked against actual PPU bytes at the NEXT boundary.
 for(let i=0;i<frames.length;i++){const f=frames[i];if(f.state[35]!==2)continue;const at=(f.state[37])*64;
  const next=frames[i+1];check(next,'Terrain publication boundary');
  f.upload=Buffer.from(next.ppuTerrain.subarray(at,at+64));
 }
 return {seed,frames,tail,terrain,layout:f.layout,scope:'Original B469 prefix through B479; post-initialization seeded states, no boss/status tail or raster/audio execution'};
}
export function entryCases(){const cases=[];
 for(const back of [false,true])for(let status=0;status<256;status++)cases.push({back,rows:[0,1,2,3].map(i=>(status>>i)&1),normalized:[status,(status+37)&255,(status+101)&255,(status+193)&255],confusedPosition:[0,1,status&1,0]});
 return cases;
}
export function entryFixtures(rom){const chunks=[],summaries=[];let negativeOffset,events=0;
 for(const options of entryCases()){
  const r=entryReference(rom,options),n=r.frames.length+1;
  if(negativeOffset===undefined)negativeOffset=39+256+1;
  const chunksHere=[r.seed,r.terrain,Buffer.from([n])];
  for(const f of [...r.frames,{state:r.tail}]){chunksHere.push(f.state);if(f.upload)chunksHere.push(f.upload);}
  const block=Buffer.concat(chunksHere);chunks.push(block);events+=n;
  summaries.push({back:options.back,status:options.normalized,waits:n-1,terrainBytes:28*64});
 }
 return {bytes:Buffer.concat(chunks),cases:summaries.length,events,negativeOffset,summaries};
}
