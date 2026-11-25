import fs from 'node:fs/promises';
import {ROOT,input,hash,check} from './source.mjs';
import {entryAssets,entryReference} from './battle-entry-source.mjs';
import {entryTransition} from './battle-transition-source.mjs';
const {data,profile}=await input();
const profiles=[];
for(const back of [false,true])for(const [name,normalized] of [['normal',[0,0,0,0]],['mixed',[1,4,64,128]],['confused',[8,9,12,0]]]){
 const r=entryReference(data,{back,normalized}),totals={chr:0,map:0,palette:0};
 const boundaries=r.frames.map(f=>{
  for(const range of f.ranges){
   const kind=range.begin<0x2000?'chr':range.begin<0x3f00?'map':'palette';totals[kind]+=range.writes;
   check(kind==='chr'?range.writer===0xadfb&&range.begin>=0x600&&range.end<=0x700:kind==='palette'&&range.writer===0xf8a1,'Unregistered entry resource writer');
  }
  return {ticket:f.state[38],waitReturn:f.returnAddress,phase:f.state[35],mask:f.state[36],row:f.state[37],partyX:[...f.state.subarray(13,17)],partyY:[...f.state.subarray(17,21)],pose:[...f.state.subarray(25,29)],nextEnemyScroll:f.state[29],nextMenuScroll:f.state[30],enemyTable:f.state[32],menuTable:f.state[33],ranges:f.ranges,changedOamBytes:f.changedOamBytes,oamSha256:f.oamSha256,terrainUploadSha256:f.upload?hash(f.upload):null};
 });
 check(totals.chr===1792&&totals.map===0&&totals.palette===32,'Original entry prefix transfer contract');
 profiles.push({name,back,normalized,waits:r.frames.length,totals,boundaries,tail:[...r.tail],scope:r.scope});
}
const fullEntry=[false,true].map(back=>{const r=entryTransition(data,{back});return {back,summary:r.summary,tailDifference:'Full B469 includes B479 boss branch and B489..B909 status/canonical-row/count work; not implemented by the prefix consumer'};});
const report={sourceSha256:profile.sha256,tables:entryAssets(data).tables.map(({bytes,...t})=>t),profiles,fullEntry,resources:[
 {owner:'terrain-fade',source:'2F/AD53,AD9A,ADC0',storage:'0C/8000 + terrain*256',residency:'$7900..79FF source; PPU $0600..06FF output',writes:'7 masks * 4 waits * 64 bytes; only one row per wait',release:'source scratch may be reused after AD99; PPU pattern remains until next owner'},
 {owner:'enemy-background',source:'2E/A31F;2F/AE4F,AE5E',residency:'initialized CHR and nametables',writes:'no CHR or map writes during B469..B479 prefix; change split scroll/table',release:'death/summon/mini/toad and other original graphics consumers, not every frame'},
 {owner:'party',source:'2F/B4AC;33/BD45,BE89;32/90D8',residency:'loaded job graphics; OAM $02A0..02FF',writes:'coordinates and poses; toad Y/mini speed; dead/stone do not walk',release:'status tail B5C3 and later job/status/animation consumers'},
 {owner:'menu-scroll',source:'2F/AE39',residency:'already initialized menu nametable',writes:'16 steps of +16 and table bit clear; independently scheduled from enemy scroll',release:'window consumer'},
 {owner:'palette',source:'3F/F8B0,F88C',residency:'existing palette buffer',writes:'32 bytes after initial wait; no reconstructed per-frame palette upload in prefix',release:'fade/status/effect consumers'},
 {owner:'tail',source:'2F/B479..B4A9;B5C3;BE97',residency:'boss graphics, canonical rows, status/stone BG and enemy counts',writes:'explicit next owner; cannot acknowledge as a completed entry',release:'full original B469 return'}
],scope:'Non-raster original consumer writes and logical state. No GBC SCX timing, OAM fit, real encounter, audio continuity or whole-game completion claim'};
await fs.mkdir(ROOT+'/evidence/battle-entry',{recursive:true});await fs.writeFile(ROOT+'/evidence/battle-entry/resources.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({profiles:profiles.map(({name,back,waits,totals})=>({name,back,waits,totals})),fullEntry,sourceSha256:profile.sha256}));
