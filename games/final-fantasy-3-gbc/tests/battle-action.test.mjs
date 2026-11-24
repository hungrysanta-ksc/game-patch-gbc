import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {originalActionFlow} from '../tools/battle-action-source.mjs';
import {battleActionAssets} from '../tools/battle-action-assets.mjs';
import {addTextAssets} from '../tools/korean-text.mjs';
import {offset} from '../tools/render-budget-source.mjs';
import {cgbPalette} from '../tools/field-source.mjs';
import {convertTiles} from '../tools/map-assets.mjs';
import {uiPixels,packActionUi} from '../tools/battle-action-ui.mjs';
import {messageWindowDescriptors,observeBattleUi} from '../tools/battle-ui-observation.mjs';

test('original caller preserves scripts, four HP rows, status gates and final numeral lifetime',async()=>{
 const {data}=await input();
 for(const back of [false,true])for(const enemy of [false,true]){
  const r=originalActionFlow(data,{back,enemy}),ptr=data.readUInt16LE(offset(0x34,0x950d+r.script*2)),script=[];
  for(let i=offset(0x34,ptr);data[i]!==255;i++)script.push(data[i]);
  assert.deepEqual(r.events.filter(e=>e.kind==='command').map(e=>e.op),script);
  assert.deepEqual(r.frames.filter(f=>f.numberFrame!==null).map(f=>f.numberFrame),Array.from({length:32},(_,i)=>i));
  assert.equal(r.hp.length,8);
  for(let i=0;i<4;i++){
   const hp=r.hp[i].raw,decode=b=>Number([...b].map(v=>v===255?' ':String(v-128)).join('').trim());
   assert.equal(decode(hp.subarray(8,12)),r.health[i][0]);assert.equal(decode(hp.subarray(13,17)),r.health[i][1]);assert.equal(hp[12],199);
   assert.deepEqual(r.hp[i+4].raw,hp);
  }
  const wait=r.events.find(e=>e.kind==='command'&&e.op===10),after=r.events[r.events.indexOf(wait)+1];
  assert.equal(after.at-wait.at,32);
  assert.ok(r.frames.slice(wait.at,after.at).every(f=>f.numberObjects.length===(enemy?32:2)&&f.gate===0));
  const cleanup=r.events.find(e=>e.kind==='cleanup');assert.ok(cleanup);
  assert.ok(r.frames.slice(cleanup.at+1).every(f=>f.numberObjects.length===0));
  assert.equal(r.frames.at(-1).gate,1);assert.equal(r.frames.at(-1).live,0);
  assert.equal(r.frames[0].sourceUi[11],247);assert.equal(r.frames[0].sourceUi[30],249);
  assert.deepEqual(r.menuTiles.subarray(0x700),convertTiles(data.subarray(0x1b710,0x1c010)));
  const pal=offset(0x2e,0x8c00)+0xfb*3;assert.deepEqual(r.menuPalette,cgbPalette([15,...data.subarray(pal,pal+3)]));
 }
});

test('ROM rectangles retain actual NES overlap and the V6 viewport preserves every geometry pixel',async()=>{
 const {data}=await input(),windows=messageWindowDescriptors(data);
 assert.deepEqual(windows.map(w=>[w.x,w.y,w.width,w.height]),[[8,152,80,32],[80,152,80,32],[8,176,80,32],[80,176,80,32],[8,200,152,32]]);
 const flow=originalActionFlow(data),ppu=Buffer.alloc(16384);flow.frames[0].sourceUi.copy(ppu,0x2260);
 const observed=observeBattleUi({ppu,ram:Buffer.alloc(2048)});
 assert.ok(observed.panels.some(p=>p.x===88&&p.y===152&&p.right===248&&p.bottom===232&&p.rightComplete&&p.bottomComplete));
 for(const f of flow.frames){assert.equal(f.partyCoverage.sourcePixels,f.partyCoverage.viewportPixels);assert.equal(f.numberCoverage.sourcePixels,f.numberCoverage.viewportPixels);}
});

test('independent original windows restore their underlay and keep all numerals within hardware capacity',async()=>{
 const {data,local}=await input(),text=(await addTextAssets(data,{groups:{},provenance:[]},local.text,{verify:false})).text;
 const a=battleActionAssets(data,text,{smallHp:true});assert.equal(a.battle.action.profiles.length,4);assert.ok(a.battle.action.tileCount<=80);
 for(const p of a.battle.action.profiles){
  assert.equal(p.uiRaster.smallHp,true);assert.equal(p.uiRaster.layout.top,106);assert.equal(p.uiRaster.layout.height,38);assert.equal(p.uiRaster.layers[0].x,48);assert.deepEqual(p.uiRaster.layers.slice(1).map(l=>[l.x,l.y,l.w,l.h]),[[0,8,56,14],[48,8,56,14],[0,20,56,14],[48,20,56,14],[0,32,104,14]]);
  const base=uiPixels(p.uiRaster,0),all=uiPixels(p.uiRaster,31);assert.notDeepEqual(all,base);assert.deepEqual(uiPixels(p.uiRaster,0),base);
  // Top-right action overlaps the HP/name region, but never the compact HP.
  for(let y=11;y<42;y++)for(let x=111;x<156;x++)assert.equal(all[y*160+x],base[y*160+x]);
  assert.equal(p.entries.filter(e=>e.run!==255).length,1);assert.equal(p.entries.at(-1).sourceGate,1);
 }
 for(const r of a.battle.numberTimeline.runs){assert.equal(r.entries.length,32);assert.equal(r.oam.length,5120);assert.equal(r.clear,r.last);assert.ok(r.numberObjects===(r.label==='enemy-numbers'?32:2));}
 assert.ok(a.frames.every(f=>f.scroll[1]===6&&f.stats.objects<=40&&f.stats.peak<=10&&f.atlas.background.length<=176*16));
 const repack=packActionUi(a.battle.action.profiles);assert.deepEqual(repack.glyphs,a.battle.action.glyphs);
 const missing={...text,sourceIds:[]};assert.throws(()=>battleActionAssets(data,missing,{smallHp:true}),/Reviewed battle text binding/);
});
