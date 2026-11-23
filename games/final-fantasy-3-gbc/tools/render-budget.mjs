import fs from 'node:fs/promises';
import {ROOT,input,check,hash} from './source.mjs';
import {makeMapAssets} from './map-assets.mjs';
import {makeObjectAssets,sourceObjects} from './object-assets.mjs';
import {battleInventory,denseCases,npcQuads,tallCandidate,spriteBudget,scaledColorInventory} from './render-budget-source.mjs';
const {data,profile}=await input(),out=ROOT+'/evidence/render-budget';await fs.mkdir(out,{recursive:true});
const assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),dense=denseCases(data,assets),battle=battleInventory(data);
const rows=dense.map(({state,groups,...r})=>r),scaledColors=scaledColorInventory(data,battle);
const survey={profiles:768,camerasPerProfile:45*47,flagMode:'all visible, static loaded poses; not normal story reachability',before:{totalOverflow:0,lineOverflow:0,maxEntries:0,maxLine:0},tall:{totalOverflow:0,lineOverflow:0,maxEntries:0,maxLine:0},failures:[]};
for(let world=0;world<3;world++)for(let map=0;map<256;map++){
 const s=sourceObjects(data,assets,world,map,Buffer.alloc(64,255)),g=npcQuads(assets,s,world),before=g.flat(),tall=tallCandidate(g).rects;
 for(let y=0;y<47;y++)for(let x=0;x<45;x++){
  const a=spriteBudget(before,x*8,y*8),b=spriteBudget(tall,x*8,y*8);
  for(const [key,v]of [['before',a],['tall',b]]){const t=survey[key];t.totalOverflow+=+v.totalOverflow;t.lineOverflow+=+v.lineOverflow;t.maxEntries=Math.max(t.maxEntries,v.entries);t.maxLine=Math.max(t.maxLine,v.peak);}
  if(a.totalOverflow||a.lineOverflow||b.totalOverflow||b.lineOverflow)survey.failures.push({world,map,x,y,before:a,tall:b});
 }
 if(map===255)console.log('NPC survey world '+world+' complete');
}
check(survey.before.totalOverflow===592&&survey.before.lineOverflow===45&&survey.before.maxEntries===48&&survey.before.maxLine===12,'PR7 static inventory reproduction');
const graphics=battle.graphics.map(({tiles,attrs,...g})=>g),maxCount=Math.max(...battle.formations.map(f=>f.maxCount));
const known=battle.graphics.filter(g=>!g.unresolved),maxRawTiles=Math.max(...known.map(g=>g.w*g.h));
const report={sourceSha256:profile.sha256,sourceSemantics:'Original consumer comparisons are build-time; counts are table slots, not completed gameplay',originalComparisons:battle.originalComparisons,
 npc:{survey,dense:rows,partyReservation:{mode8:{entries:8,extraSameLine:4},mode16:{entries:4,extraSameLine:4},scope:'Player plus one guest, 16x16 each; conservative overlap allowance, not follower implementation'}},
 battle:{formations:battle.formations,graphics,misc:battle.misc,weapons:battle.weapons,magic:battle.magic,magicFrames:battle.magicFrames,magicScripts:battle.magicScripts,scaledColors,summary:{formationSlots:512,referencedGraphicIds:graphics.length,decodedGraphicIds:known.length,unresolved:graphics.filter(g=>g.unresolved),maxCount,maxRawTiles,layouts:battle.layouts,magicFrameSlots:128,magicScriptSlots:91,maxMagicFrameObjects:Math.max(...battle.magicFrames.map(f=>f.nonzeroTiles)),fullMagicFrameIds:battle.magicFrames.filter(f=>f.nonzeroTiles===36).map(f=>f.id),fullMagicScriptIds:battle.magicScripts.filter(s=>s.maxNonzeroFrameTiles===36).map(s=>s.id),scaledColors:scaledColors.summary},
 reservations:{party:{jobs:22,tilesPerJob:42,allFourJobsTiles:168,standingTiles:24,standingObj8:24,standingObj16:16,standingPeak8:2,standingPeak16:4,explanation:'Four 16x24 figures at y=10,34,58,82; 8x16 requires transparent padding to 32px, selection overlaps adjacent rows'},
 oam:{sourceParty:24,sourceAnimation:40,totalSourceSlots:64,gbcSlots:40,gbcPerLine:10,warning:'Animation, damage, status and cursors share source slots; do not add their independent maxima'},
 vramProposal:{bgMode:'signed',bgTilesBothBanks:512,objExclusiveTilesBothBanks:256,sharedTilesBothBanks:256,textWindowReservation:116,terrainReservation:40,enemyCellReservation:224,remainingBgTiles:132,explanation:'Conservative planning envelope only: 16x14 enemy-side tile cells include boundary padding; 116 retains the existing full dialogue window allowance. Not a completed battle atlas. Shared blocks cannot also be counted as free OBJ storage; palette and placement still need proof'},
 transfer:{currentSafeBytesPerVBlank:128,fullEnemyCellBytes:3584,fullEnemyUploadVBlanksAtCurrentBudget:28,explanation:'Arithmetic lower bound at existing text transfer allocation; no claim of measured battle throughput'}},
 unresolvedConsumers:['monster 206 external boss tile 0x2A','normal formation GBC placement preserving targets/order','scaled mixed-palette tile assignment without recoloring','magic/summon frame OAM and dynamic palette coexistence','battle mode WRAM ownership and worst-case streaming with audio']},
 scope:'R2 static source/feasibility audit; production renderers unchanged; R2 remains open'};
await fs.writeFile(out+'/inventory.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({sourceSha256:profile.sha256,originalComparisons:report.originalComparisons,npc:{before:survey.before,tall:survey.tall,failingCameras:survey.failures.length},battle:report.battle.summary,sha256:hash(await fs.readFile(out+'/inventory.json'))},null,2));
