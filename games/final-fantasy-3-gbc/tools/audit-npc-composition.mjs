import fs from 'node:fs/promises';import {ROOT,input,check,hash} from './source.mjs';
import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {denseCases,spriteBudget} from './render-budget-source.mjs';import {tallScene,renderScene} from './render-budget-pixels.mjs';
import {compileComposition,compositionRgb,compositionWords,composePixels} from './npc-composition.mjs';
const {data,profile}=await input(),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),rows=[],failures=[];
for(const r of denseCases(data,assets).filter(r=>r.flags===2)){
 for(let y=0;y<47;y++)for(let x=0;x<45;x++){
  const original=spriteBudget(r.groups.flat(),x*8,y*8);if(!original.totalOverflow&&!original.lineOverflow)continue;
  const scene=tallScene(assets,{...r,x,y});let c;
  try{c=compileComposition(scene);}catch(e){if(!/^Composition (BG tile|OAM|scanline) capacity$|^No lossless global palette cover$/.test(e.message))throw e;failures.push({world:r.world,map:r.map,x,y,error:e.message});continue;}
  check(Buffer.from(compositionWords(c).buffer).equals(Buffer.from(composePixels(scene).buffer)),'Exact RGB555 survey comparison');check(compositionRgb(c).equals(renderScene(scene,{original:true,hardware:false})),'Independent source pixel survey');
  rows.push({world:r.world,map:r.map,x,y,...c.stats});
 }
 console.log('Survey '+r.world+':'+r.map+' complete');
}
check(rows.length+failures.length===637,'PR7 original failing camera population');
const coordinates=[...rows,...failures].map(r=>[r.world,r.map,r.x,r.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3]||a[2]-b[2]);
check(hash(Buffer.from(JSON.stringify(coordinates)))==='1015b7a4b6610b32a3a0a2025708585e509bbc98cb6f8d75eeb0854420297e2c','Exact PR18 source census failure coordinates');
const maxima=Object.fromEntries(['bgTiles','bgPalettes','objects','peak'].map(k=>[k,Math.max(0,...rows.map(r=>r[k]))]));
const report={sourceSha256:profile.sha256,population:637,passed:rows.length,failed:failures.length,maxima,failures,rows,scope:'All PR7 failing static cameras with all visibility flags; excludes player/guest, live motion, windows, audio and runtime composition cost'};
const out=ROOT+'/evidence/npc-composition';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/survey.json',JSON.stringify(report,null,2));console.log(JSON.stringify({population:637,passed:rows.length,failed:failures.length,maxima,sha256:hash(await fs.readFile(out+'/survey.json'))},null,2));
