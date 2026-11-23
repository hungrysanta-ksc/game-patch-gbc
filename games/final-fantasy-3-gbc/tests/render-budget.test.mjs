import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {monsterGraphic,battleInventory,scaledColorInventory,tallCandidate,spriteBudget} from '../tools/render-budget-source.mjs';

test('transparent padding and split attributes still consume scanline slots',()=>{
 const group=x=>[0,1,2,3].map(i=>({x:x+(i&1)*8,y:20+(i>>1)*8,h:8,attr:i<2?0:1}));
 const groups=[group(0),group(16),group(32)],before=spriteBudget(groups.flat()),after=spriteBudget(tallCandidate(groups).rects);
 assert.equal(before.peak,6);assert.equal(after.entries,12);assert.equal(after.peak,12);assert.equal(after.lineOverflow,true);
 // Four unchanged 16x24 figures, padded to 32px for the global 8x16 mode.
 const party=[];for(const y of [10,34,58,82])for(const x of [128,136])for(const dy of [0,16])party.push({x,y:y+dy,h:16});
 assert.equal(spriteBudget(party).entries,16);assert.equal(spriteBudget(party).peak,4);
});

test('source graphics bank halves and unresolved external boss tiles are not silently replaced',async()=>{
 const {data}=await input(),g=monsterGraphic(data,5);
 assert.equal(g.source.begin,0x42c90);assert.equal(g.source.bytes,384);
 assert.equal(g.source.sha256,'a04d834464c8f9f3a311bdc3bac7012f4d85d71a915e9fc7e26ffe3c9c1e05aa');
 assert.deepEqual(monsterGraphic(data,206).unresolved,{kind:'boss-external-tile',tiles:[42]});
 assert.throws(()=>monsterGraphic(data,255),/Monster ID/);
 // The original selector does not store the putative inversion bit.
 const changed=Buffer.from(data);changed.fill(255,0x5cf10,0x5cf30);
 assert.deepEqual(monsterGraphic(changed,0).attrs,monsterGraphic(data,0).attrs);
});

test('battle consumers preserve original copy behavior and expose color and effect overflow',async()=>{
 const {data}=await input(),b=battleInventory(data),colors=scaledColorInventory(data,b);
 assert.equal(b.originalComparisons,1139);assert.equal(b.graphics.filter(g=>!g.unresolved).length,223);
 assert.deepEqual(b.magicFrames.filter(f=>f.nonzeroTiles===36).map(f=>f.id),[11,15]);
 assert.deepEqual(b.magicScripts.filter(s=>s.maxNonzeroFrameTiles===36).map(s=>s.id),[29,36]);
 assert.deepEqual(colors.summary,{imagePalettePairs:250,pairsOverFourColors:161,maxColors:7,overColorTiles:452});
 const damaged=Buffer.from(data);damaged.writeUInt16LE(0x8000,0x1718);
 assert.throws(()=>battleInventory(damaged),/Magic frame pointer/);
});
