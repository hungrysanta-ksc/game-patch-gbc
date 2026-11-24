import {check,hash} from './source.mjs';
import {sceneComposition} from './battle-scene-pixels.mjs';
import {compositionRgb} from './npc-composition.mjs';
// Finite source-state fixture through the shared transfer consumer. The two
// VRAM BG banks hold active/next patterns; total animation union is irrelevant.
export function battleSceneAssets(rom){
 const profiles=[false,true].map(back=>sceneComposition(rom,{back}));
 const source={source:{profiles:profiles.map(p=>p.source),scope:profiles[0].source.scope},frames:profiles.flatMap(p=>p.frames.map(f=>({...f,back:p.source.back}))),summary:{observations:profiles.reduce((n,p)=>n+p.summary.observations,0),failed:profiles.reduce((n,p)=>n+p.summary.failed,0),maxBgTiles:Math.max(...profiles.map(p=>p.summary.maxBgTiles)),maxObjects:Math.max(...profiles.map(p=>p.summary.maxObjects)),maxLine:Math.max(...profiles.map(p=>p.summary.maxLine))}},frames=[],visuals=new Map();check(!source.summary.failed,'Whole scene composition failures');
 for(const f of source.frames){const c=f.composition,raw=compositionRgb(c),rgb=Buffer.alloc(160*144*3),ids=Array.from(c.map),maps=[Buffer.alloc(608),Buffer.alloc(608),Buffer.alloc(608)];
  for(let y=0;y<144;y++)raw.copy(rgb,y*480,y*504,y*504+480);
  for(let i=0;i<399;i++){const at=(i/21|0)*32+i%21;maps[0][at]=(c.map[i]+128)&255;maps[1][at]=c.attributes[i];maps[2][at]=c.attributes[i]|8;}
  const palette=Buffer.concat([c.bgPalette,c.objPalette]),key=hash(Buffer.concat([c.background,...maps,c.objGraphics,c.oam,palette]));if(!visuals.has(key))visuals.set(key,visuals.size);
  frames.push({label:f.phase,back:f.back,trace:f.index,scroll:[0,0],ids,attributes:c.attributes,palette,rgb,stats:c.stats,partyEnemyOverlapPixels:f.partyEnemyOverlapPixels,sourceFrame:null,sourceByteIndex:null,sourceOamSha256:f.sourceOamSha256,sourceDurationFrames:null,sourceBoundaryCalls:f.boundaries,atlas:{blocks:Buffer.alloc(76),maps:Buffer.concat(maps),background:c.background,objects:c.objGraphics,oam:c.oam,visual:visuals.get(key)}});
 }
 // Aligned changed spans are relative to the previous occupant of the
 // *same inactive page*. Include a missing-page entry after text borrowed it.
 for(const f of frames){const spans=Buffer.alloc((visuals.size+1)*12);for(let v=0;v<=visuals.size;v++){
  const old=frames.find(p=>p.atlas.visual===v);
  for(let part=0;part<3;part++){
   const a=part<2?f.atlas.maps.subarray(part*608,(part+1)*608):f.atlas.background;
   const b=old?(part<2?old.atlas.maps.subarray(part*608,(part+1)*608):old.atlas.background):Buffer.alloc(0);
   let first=a.length,last=-16;for(let i=0;i<a.length;i+=16)if(!a.subarray(i,i+16).equals(b.subarray(i,i+16))){first=Math.min(first,i);last=i;}
   spans.writeUInt16LE(last<0?0:first,v*12+part*4);spans.writeUInt16LE(last<0?0:last-first+16,v*12+part*4+2);
  }
 }f.atlas.spans=spans;}
 const blank=Buffer.alloc(80);
 return {jobs:[{bytes:blank,expected:blank,static:true}],frames,blocks:Buffer.alloc(16),bgTiles:Buffer.alloc(16),palettes:7,battle:{source:source.source,summary:source.summary,hostComposed:true,streamed:true,uniqueVisuals:visuals.size,scope:'Sequential original source-state fixtures, dynamic per-frame palette/pattern supply; no game rules, battle messages or source-frame timing claim'}};
}
