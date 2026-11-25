import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {formationRecords,monsterRecords,eventBattleRecords,specialFormationRules,jumpContracts,bossAiContracts,uiResourceContract} from '../tools/battle-resource-contracts.mjs';
test('all formations and monster properties retain original IDs; Doga and Unei resume the same event',async()=>{
 const {data}=await input(),f=formationRecords(data),m=monsterRecords(data),e=eventBattleRecords(data);
 assert.equal(f.length,512);assert.equal(m.length,256);assert.equal(e.events.length,254);assert.equal(e.calls.length,40);
 assert.equal(f[0x169].monsters[0],0xd5);assert.equal(f[0x16b].monsters[0],0xd7);assert.equal(f[0x180].monsters[0],0xd8);
 assert.deepEqual(e.calls.filter(c=>c.event===0x6a).map(c=>c.operand),[0x6b,0x80]);
 assert.ok(e.calls.every(c=>c.candidates[1]-c.candidates[0]===256&&c.resumeOffset>c.offset));
 assert.equal(m[0xd5].weakness,0x20);assert.equal(m[0xd7].resistance,0xfe);assert.equal(m[0xd8].resistance,0xfe);
 assert.notEqual(m[0xd7].scriptBegin,m[0xd8].scriptBegin);
});
test('special HP restoration, reward suppression and defeat override check both formation bytes',async()=>{
 const {data}=await input(),r=specialFormationRules(data);
 assert.deepEqual(r.filter(x=>x.restoreHpHigh).map(x=>x.formation),[0x55,0x179,0x190]);
 assert.deepEqual(r.filter(x=>x.skipVictory).map(x=>x.formation),[0x173,0x178]);
 assert.deepEqual(r.filter(x=>x.clearDefeat).map(x=>x.formation),[0x179]);
 for(const id of [0x169,0x16b,0x180])assert.deepEqual(r[id],{formation:id,restoreHpHigh:false,skipVictory:false,clearDefeat:false});
});
test('jump uses common start/landing and weakness rules, including toad and mini rejection',async()=>{
 const {data}=await input(),r=jumpContracts(data);assert.equal(r.startCases,1024);assert.equal(r.landingCases,256);assert.equal(r.rejected,768);assert.deepEqual(r.elements.map(e=>e.multiplier),[2,2,2,4]);
});
test('boss entry retains resident font and frame; original action windows close before selection',async()=>{
 const {data}=await input(),r=uiResourceContract(data);assert.equal(r.resources[0].bytes,2304);assert.equal(r.windows.length,5);assert.equal(r.bossEntry.length,40);
 assert.ok(r.bossEntry.every(b=>b.menuPreserved&&b.steps>0&&b.bytes===b.steps*64));
 for(const f of r.actionFlows){assert.ok(f.events.some(e=>e.kind==='open'));assert.equal(f.events.at(-1).live,0);assert.ok(f.hpRows>=4);}
});
test('Hein/Amon barrier turn and sequential boss script wrap retain source conditions',async()=>{
 const {data}=await input(),r=bossAiContracts(data);assert.equal(r.barrierCases,1024);assert.deepEqual(r.barriers.map(b=>b.id),[0xb4,0xd2]);assert.equal(r.sequential.length,8);assert.equal(r.sequential.at(-1).next,1);
});
