import test from 'node:test';
import assert from 'node:assert/strict';
import {input,hash} from '../tools/source.mjs';
import {offset,monsterGraphic} from '../tools/render-budget-source.mjs';
import {battleDisplayAudit,resolveBoss206,oamBudget,pairObjects} from '../tools/battle-display-source.mjs';

test('GBC OAM selection counts hidden-X objects and global tall padding',()=>{
 const hidden=Array.from({length:11},(_,i)=>({x:i?200:10,y:20,h:16}));
 assert.deepEqual(oamBudget(hidden),{entries:11,peak:11,totalOverflow:false,lineOverflow:true});
 assert.equal(oamBudget(hidden.map(r=>({...r,y:144}))).peak,0);
 assert.throws(()=>oamBudget([{x:0,y:0,h:8},{x:8,y:0,h:16}]),/Mixed OBJ heights/);
 const a={x:0,y:0,h:8,palette:1,owner:'magic',pixels:new Uint8Array(64).fill(1)},b={...a,y:8,pixels:new Uint8Array(64).fill(2)};
 const merged=pairObjects([a,b]);assert.equal(merged.length,1);assert.deepEqual([...merged[0].pixels],Array(64).fill(1).concat(Array(64).fill(2)));
 assert.equal(pairObjects([a,{...b,palette:2}]).length,2);
 assert.equal(pairObjects([a,{...b,owner:'party'}]).length,2);
});

test('boss 206 uses a proven cleared CHR tile, never an unconditional blank fallback',async()=>{
 const {data}=await input(),r=resolveBoss206(data);
 assert.deepEqual(r.evidence.positions,[[6,10]]);assert.equal(r.evidence.lastWriter,'2E/9FA0');
 assert.equal(r.evidence.tileSha256,'374708fff7719dd5979ec875d56cd2286f6d3cf7ec317a3b25632aab28ec37bb');
 assert.equal(r.graphic.unresolved,undefined);assert.ok(r.graphic.tiles[10*18+6].every(v=>v===0));
 assert.deepEqual(monsterGraphic(data,206).unresolved,{kind:'boss-external-tile',tiles:[42]});
 const changed=Buffer.from(data);changed[offset(0x2e,0x9f99)]=1;
 assert.throws(()=>resolveBoss206(changed),/Original clear/);
 const other=Buffer.from(data),map=0x54010+(data[0x5cb10+206]&31)*216;other[map+10*18+6]=0x2b;
 assert.deepEqual(resolveBoss206(other).graphic.unresolved,{kind:'boss-external-tile',tiles:[43]});
});

test('source hit frames preserve offsets flips priority and pixels; color overlay still fails coexistence',async()=>{
 const {data}=await input(),r=battleDisplayAudit(data);
 assert.equal(r.magic.summary.comparisons,1740);assert.equal(r.magic.summary.pixelComparisons,1740);
 assert.deepEqual(r.magic.summary.mode8,{maxEntries:60,maxLine:8,totalOverflowCases:468,lineOverflowCases:0});
 assert.deepEqual(r.magic.summary.mode16,{maxEntries:34,maxLine:10,totalOverflowCases:0,lineOverflowCases:0});
 const full=r.magic.rows.find(x=>x.frame===11&&x.enemy&&!x.back);
 assert.deepEqual(full.sourceSlots,Array.from({length:12},(_,i)=>24+i).concat(Array.from({length:24},(_,i)=>40+i)));
 assert.deepEqual(r.colors.summary,{pairs:251,pairsOverFour:161,overFourTiles:452,maxResidual8:11,maxResidual16:10,envelopeOver40:17,envelopeOver10:168});
 assert.equal(r.colors.rows.filter(x=>x.monster===206).length,1);
 assert.equal(hash(Buffer.from(JSON.stringify(r.magic.rows))),'b3def16ab4aff5bfe7d68cf86e37dcab2ef66ac84c514d84d1f6831ddecc7aac');
 const changed=Buffer.from(data);changed[offset(0x33,0xb724)]=0x11;
 assert.throws(()=>battleDisplayAudit(changed),/Original magic placement/);
});
