import {check,hash} from './source.mjs';
import {sceneComposition} from './battle-scene-pixels.mjs';
import {compositionRgb} from './npc-composition.mjs';
import {numberTimeline} from './battle-number-timeline.mjs';
// Preserve still-needed tile IDs before filling released slots. This needs
// only the current frame and previous storage, never the animation union.
export function stableSceneTiles(compositions){
 let storage=[];
 return compositions.map(c=>{const keys=Array.from({length:c.background.length/16},(_,i)=>c.background.subarray(i*16,i*16+16).toString('hex')),used=new Set(),ids=[];
  for(const [i,key] of keys.entries()){const n=storage.indexOf(key);if(n>=0){ids[i]=n;used.add(n);}}
  for(const [i,key] of keys.entries())if(ids[i]===undefined){let n=0;while(used.has(n))n++;check(n<256,'Stable scene tile capacity');storage[n]=key;ids[i]=n;used.add(n);}
  return {...c,background:Buffer.concat(storage.map(k=>Buffer.from(k,'hex'))),map:Buffer.from(c.map.map(v=>ids[v]))};
 });
}
// Finite source-state fixture through the shared transfer consumer. The two
// VRAM BG banks hold active/next patterns; total animation union is irrelevant.
export function battleSceneAssets(rom,{numbers=true,enemyValues=Array(8).fill(1234)}={}){
 const profiles=[false,true].map(back=>sceneComposition(rom,{back,numbers,enemyValues}));
 const source={source:{profiles:profiles.map(p=>p.source),scope:profiles[0].source.scope},frames:profiles.flatMap(p=>p.frames.map(f=>({...f,back:p.source.back}))),summary:{observations:profiles.reduce((n,p)=>n+p.summary.observations,0),failed:profiles.reduce((n,p)=>n+p.summary.failed,0),maxBgTiles:Math.max(...profiles.map(p=>p.summary.maxBgTiles)),maxObjects:Math.max(...profiles.map(p=>p.summary.maxObjects)),maxLine:Math.max(...profiles.map(p=>p.summary.maxLine))}},frames=[],visuals=new Map();check(!source.summary.failed,'Whole scene composition failures');
 const stable=stableSceneTiles(source.frames.map(f=>f.composition));
 for(const [fi,f] of source.frames.entries()){const c=stable[fi],raw=compositionRgb(c),rgb=Buffer.alloc(160*144*3),ids=Array.from(c.map),maps=[Buffer.alloc(608),Buffer.alloc(608),Buffer.alloc(608)];
  for(let y=0;y<144;y++)raw.copy(rgb,y*480,y*504,y*504+480);
  for(let i=0;i<399;i++){const at=(i/21|0)*32+i%21;maps[0][at]=(c.map[i]+128)&255;maps[1][at]=c.attributes[i];maps[2][at]=c.attributes[i]|8;}
  const palette=Buffer.concat([c.bgPalette,c.objPalette]),key=hash(Buffer.concat([c.background,...maps,c.objGraphics,c.oam,palette]));if(!visuals.has(key))visuals.set(key,visuals.size);
  frames.push({label:f.phase,back:f.back,trace:f.index,numberFrame:f.numberFrame,numberFrames:f.numberFrames,scroll:[0,0],ids,attributes:c.attributes,palette,rgb,stats:c.stats,partyEnemyOverlapPixels:f.partyEnemyOverlapPixels,sourceFrame:null,sourceByteIndex:null,sourceOamSha256:f.sourceOamSha256,sourceDurationFrames:null,sourceBoundaryCalls:f.boundaries,atlas:{blocks:Buffer.alloc(76),maps:Buffer.concat(maps),background:c.background,objects:c.objGraphics,oam:c.oam,visual:visuals.get(key)}});
 }
 // One bit per changed 16-byte block, relative to the *same inactive page*.
 // IDs/attrs/BG/OBJ occupy 5/5/32/5 bytes in each 48-byte row. Include the
 // invalidated-page row after text borrowed bank 1. No unchanged gap DMA.
 for(const f of frames){const spans=Buffer.alloc((visuals.size+1)*48);for(let v=0;v<=visuals.size;v++){
  const old=frames.find(p=>p.atlas.visual===v);
  for(let part=0;part<4;part++){
   const a=part<2?f.atlas.maps.subarray(part*608,(part+1)*608):part===2?f.atlas.background:f.atlas.objects;
   const b=old?(part<2?old.atlas.maps.subarray(part*608,(part+1)*608):part===2?old.atlas.background:old.atlas.objects):Buffer.alloc(0);
   for(let i=0;i<a.length;i+=16)if(!a.subarray(i,i+16).equals(b.subarray(i,i+16)))spans[v*48+[0,5,10,42][part]+(i>>7)]|=1<<((i>>4)&7);
  }
 }f.atlas.spans=spans;}
 const blank=Buffer.alloc(80);
 return {jobs:[{bytes:blank,expected:blank,static:true}],frames,blocks:Buffer.alloc(16),bgTiles:Buffer.alloc(16),palettes:7,battle:{source:source.source,numberTimeline:numbers?numberTimeline(frames):null,numberRuns:profiles.map(p=>({back:p.source.back,runs:p.numberRuns})),summary:source.summary,hostComposed:true,streamed:true,uniqueVisuals:visuals.size,scope:'Sequential original source-state fixtures and autonomous 32-frame numeral bodies. Immediate caller clear is a diagnostic handoff; not whole battle timing, game rules, other effects or battle messages'}};
}
