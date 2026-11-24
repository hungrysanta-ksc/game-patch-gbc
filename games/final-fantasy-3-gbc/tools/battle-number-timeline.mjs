import {check,hash} from './source.mjs';
import {nativeTiming} from './native-plan.mjs';
import {compositionRgb} from './npc-composition.mjs';
// The source loop calls F8C5 once for every one of its 32 iterations. Pixel
// deduplication must not collapse those waits. The caller's clear is separate.
export function numberTimeline(frames){
 const runs=[];
 for(const back of [false,true])for(const label of ['enemy-numbers','party-numbers']){
  const entries=[];
  for(const [frame,f]of frames.entries())if(f.back===back&&f.label===label)for(const sourceStart of f.numberFrames)entries.push({frame,sourceStart});
  check(entries.length===32&&entries.every((e,i)=>e.sourceStart===i),'Complete original numeral waits');
  const first=frames[entries[0].frame],clear=frames.findIndex(f=>f.back===back&&f.label===label+'-clear');check(clear>=0,'Numeral caller clear');
  const oams=entries.map(e=>{const f=frames[e.frame];
   for(const key of ['background','maps','objects'])check(f.atlas[key].equals(first.atlas[key]),'Invariant numeral '+key);
   check(f.palette.equals(first.palette)&&f.stats.objects===first.stats.objects,'Invariant numeral palette/slots');
   return f.atlas.oam;
  });
  const clearOam=Buffer.from(first.atlas.oam);clearOam.fill(0,0,first.stats.numberObjects*4);
  // Prove the OAM-only clear has exactly the caller's pixels despite keeping
  // the numeral palette/pattern storage resident until its next owner.
  const sprites=Array.from({length:first.stats.objects},(_,i)=>({x:clearOam[i*4+1]-8,y:clearOam[i*4]-16,tile:clearOam[i*4+2],palette:clearOam[i*4+3]&7}));
  const raw=compositionRgb({width:168,height:152,background:first.atlas.background,map:Buffer.from(first.ids),attributes:first.attributes,bgPalette:first.palette.subarray(0,64),objPalette:first.palette.subarray(64),objGraphics:first.atlas.objects,sprites});
  const rgb=Buffer.alloc(160*144*3);for(let y=0;y<144;y++)raw.copy(rgb,y*480,y*504,y*504+480);
  check(hash(rgb)===hash(frames[clear].rgb),'OAM-only caller clear pixels');
  entries.push({frame:clear,sourceStart:32});oams.push(clearOam);
  // Floor resolves sub-timer-tick phase uncertainty at the VBlank admission;
  // actual visible frames are independently checked against the PPU clock.
  runs.push({back,label,first:entries[0].frame,clear,objects:first.stats.objects,numberObjects:first.stats.numberObjects,entries:entries.map(e=>({...e,timerOffset:Math.floor(e.sourceStart*nativeTiming.timerHz*nativeTiming.sourceRateDenominator/nativeTiming.sourceRateNumerator)})),oam:Buffer.concat(oams)});
 }
 return {timing:nativeTiming,runs,source:'33/AD2B, AD59..ADA5: 32 F8C5 waits; immediate diagnostic caller B5B8/AEE8/32:90D8 clear at offset 32'};
}
