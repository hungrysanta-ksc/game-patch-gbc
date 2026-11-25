import fs from 'node:fs/promises';
import {ROOT,input,check,hash} from './source.mjs';
import {compilePixelComposition,compositionWords,pixelCompositionPalettes} from './npc-composition.mjs';
import {originalSceneSequence} from './battle-scene-pixels.mjs';
import {openingPresentation} from './battle-opening-assets.mjs';
const {data,profile}=await input(),rows=[],backgrounds=new Map(),samples=new Map();
function record(route,frames){for(const [frame,f]of frames.entries()){
 const objects=f.nativeObjects,byKind={};for(const o of objects)byKind[o.kind]=(byKind[o.kind]??0)+1;
 const peak=objects=>Math.max(0,...Array.from({length:144},(_,y)=>objects.filter(o=>y>=o.y&&y<o.y+8).length));
 const party=objects.filter(o=>o.kind==='party'||o.kind==='status'),remaining=objects.filter(o=>o.kind!=='party'&&o.kind!=='status');
 const key=hash(Buffer.concat([Buffer.from(f.backgroundPixels.buffer),f.sourcePalettes.subarray(0,32)]));let background=backgrounds.get(key);
 if(!background){
  const pixels=new Uint16Array(168*152).fill(f.sourcePalettes.readUInt16LE(0));pixels.set(f.backgroundPixels.subarray(0,168*146),168*6);
  samples.set(key,{pixels,palette:f.sourcePalettes.subarray(0,32)});
  try{const c=compilePixelComposition(pixels,f.sourcePalettes.subarray(0,32),{width:168,height:152,palettes:Array.from({length:4},(_,p)=>Array.from({length:4},(_,i)=>f.sourcePalettes.readUInt16LE(p*8+i*2)))});
   check(compositionWords(c).every((v,i)=>v===pixels[i]),'Background-only color preservation');background={tiles:c.stats.bgTiles,objects:c.sprites.map(o=>({x:o.x,y:o.y-6,kind:'background-color'})),peak:c.stats.peak};
  }catch(e){if(!/^Composition (OAM|scanline|BG tile) capacity$/.test(e.message))throw e;background={failure:e.message};}backgrounds.set(key,background);
 }
 const combined=background.objects?[...objects,...background.objects]:null;
 rows.push({route,frame,phase:f.phase,backgroundKey:key,objects:objects.length,peak:peak(objects),byKind,partyObjects:party.length,partyPeak:peak(party),otherObjects:remaining.length,fits:objects.length<=40&&peak(objects)<=10,background,combinedObjects:combined?.length,combinedPeak:combined?peak(combined):null,combinedFits:!!combined&&combined.length<=40&&peak(combined)<=10,placements:objects});
}}
for(const back of [false,true]){
 record('scene-'+back,originalSceneSequence(data,{back,numbers:true,enemyValues:Array(8).fill(9999)}).observations);
 for(const hp of [500,1])record('opening-'+back+'-'+hp,openingPresentation(data,{back,hp}).requests.flatMap(r=>r.frames));
}
const failures=rows.filter(r=>!r.fits),summary={observations:rows.length,failed:failures.length,maxObjects:Math.max(...rows.map(r=>r.objects)),maxLine:Math.max(...rows.map(r=>r.peak)),maxPartyObjects:Math.max(...rows.map(r=>r.partyObjects)),maxPartyLine:Math.max(...rows.map(r=>r.partyPeak)),failedPhases:[...new Set(failures.map(r=>r.phase))]};
check(summary.maxPartyObjects<=40&&summary.maxPartyLine<=10,'Party alone does not fit native OBJ');
summary.backgroundOnlyFailures=[...backgrounds.values()].filter(b=>b.failure).length;summary.maxBackgroundObjects=Math.max(...[...backgrounds.values()].map(b=>b.objects?.length??0));summary.combinedFailures=rows.filter(r=>!r.combinedFits).length;summary.maxCombinedObjects=Math.max(...rows.map(r=>r.combinedObjects??0));summary.maxCombinedLine=Math.max(...rows.map(r=>r.combinedPeak??0));
// Alternative: one shared seven-palette BG plan per unchanged source palette,
// preserving the eighth BG palette for UI; never change it per display frame.
const groups=new Map(),planned=new Map();for(const [key,s]of samples){const id=s.palette.toString('hex');if(!groups.has(id))groups.set(id,[]);groups.get(id).push({key,...s});}
for(const group of groups.values()){
 const palettes=pixelCompositionPalettes(group.map(s=>s.pixels),group[0].palette,{width:168,height:152,maxPalettes:7});
 for(const s of group){const c=compilePixelComposition(s.pixels,s.palette,{width:168,height:152,palettes});check(compositionWords(c).every((v,i)=>v===s.pixels[i]),'Shared BG palette pixels');planned.set(s.key,{palettes:palettes.length,tiles:c.stats.bgTiles,objects:c.sprites.map(o=>({x:o.x,y:o.y-6}))});}
}
for(const r of rows){r.plannedBackground=planned.get(r.backgroundKey);const all=[...r.placements,...r.plannedBackground.objects];r.plannedObjects=all.length;r.plannedPeak=Math.max(...Array.from({length:144},(_,y)=>all.filter(o=>y>=o.y&&y<o.y+8).length));r.plannedFits=all.length<=40&&r.plannedPeak<=10;}
summary.plannedFailures=rows.filter(r=>!r.plannedFits).length;summary.maxPlannedBackgroundObjects=Math.max(...[...planned.values()].map(p=>p.objects.length));summary.maxPlannedObjects=Math.max(...rows.map(r=>r.plannedObjects));summary.maxPlannedLine=Math.max(...rows.map(r=>r.plannedPeak));
const report={sourceSha256:profile.sha256,summary,rows,scope:'Original observed OAM with adopted V6 coordinates. Count only tiles containing visible dots (optimistic hardware lower bound); preserve each complete 8x8 object. Also measure background-only color residual OBJ using four original BG palettes, four original OBJ palettes and V6 SCY=6 grid. Heuristic, not optimal packing or pixel-priority proof. No GBC raster/time claim, no exhaustive spell/job/formation coverage.'};
await fs.mkdir(ROOT+'/evidence/battle-object-ownership',{recursive:true});await fs.writeFile(ROOT+'/evidence/battle-object-ownership/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(summary));
