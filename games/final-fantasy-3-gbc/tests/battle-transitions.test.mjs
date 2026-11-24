import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {offset} from '../tools/render-budget-source.mjs';
import {entryTransition,statusPriorityAudit,statusTransition,itemEffectRoutes,itemPresentation} from '../tools/battle-transition-source.mjs';

test('entry executes enemy/menu scrolling in both directions and the boss CHR movement',async()=>{
 const {data}=await input(),a=entryTransition(data),b=entryTransition(data,{back:true}),boss=entryTransition(data,{formation:79});
 assert.deepEqual([a.summary.nmiWaits,b.summary.nmiWaits,boss.summary.nmiWaits],[35,35,83]);
 assert.equal(a.scroll[0].enemy,240);assert.equal(b.scroll[0].enemy,16);
 assert.deepEqual([a.summary.chr,b.summary.chr,boss.summary.chr],[1792,1792,4864]);
 assert.deepEqual(a.boundaries.at(-1).partyX,[208,224,208,224]);
 const changed=Buffer.from(data);changed[offset(0x2f,0xae98)]^=1;assert.throws(()=>entryTransition(changed));
});
test('all raw status pairs match original normalization and death/stone/small/flip priority',async()=>{
 const {data}=await input(),r=statusPriorityAudit(data);assert.equal(r.pairs,65536);
 assert.equal(Object.values(r.poses).reduce((a,b)=>a+b,0),65536);assert.equal(Object.keys(r.poses).length,14);
 const changed=Buffer.from(data);changed[offset(0x2f,0xb632)]^=1;assert.throws(()=>statusPriorityAudit(changed));
});
test('status lifetimes restore each job and all party slot/row/back layouts including stone BG',async()=>{
 const {data}=await input(),profiles=Array.from({length:22},(_,job)=>({job}));
 for(let slot=0;slot<4;slot++)for(const back of [false,true])for(const row of [0,1])if(slot||back||row)profiles.push({slot,back,row});
 assert.equal(profiles.length,37);
 for(const p of profiles){const r=statusTransition(data,p);assert.equal(r.restored,true);assert.equal(r.states.length,18);
  for(const s of r.states.filter(s=>s.stone))assert.equal(s.liveObj8,0);
  assert.equal(r.states[0].chrSha256,r.states.at(-1).chrSha256);assert.equal(r.states[0].mapSha256,r.states.at(-1).mapSha256);
  assert.equal(r.states[0].x,r.states.find(s=>s.name==='normal-after-confusion').x);
 }
 assert.throws(()=>statusTransition(data,{slot:4}),/bounds/);
});
test('item message, consumption, ineffective and mini-prohibited branches use original item data',async()=>{
 const {data}=await input(),r=itemEffectRoutes(data),get=(i,b=false)=>r.routes.find(r=>r.item===i&&r.miniForbidden===b);
 assert.deepEqual(r.summary,{inputs:512,effectRoutes:227,ineffective:285});
 assert.deepEqual([get(0xa6).spell,get(0xa6).animation,get(0xa6).messageItem,get(0xa6).remaining],[63,0,166,1]);
 assert.equal(get(0xad).valid,true);assert.equal(get(0xad,true).valid,false);assert.equal(get(0xad,true).remaining,2);
 assert.equal(get(0xc8).valid,false);
 const changed=Buffer.from(data);changed[offset(0x31,0xa65e)]=0x60;assert.throws(()=>itemEffectRoutes(changed));
});
test('item visual body uses selected target, returns every actor and restores shared damage glyphs',async()=>{
 const {data}=await input(),r=itemEffectRoutes(data),potion=r.routes.find(r=>r.item===0xa6&&!r.miniForbidden);
 for(let item=0xa6;item<=0xaf;item++){const p=itemPresentation(data,r.routes.find(r=>r.item===item&&!r.miniForbidden));assert.equal(p.summary.damageGlyphsRestored,true);}
 for(let actor=0;actor<4;actor++)for(let target=0;target<4;target++)for(const back of [false,true]){
  const p=itemPresentation(data,potion,{actor,target,back});assert.equal(p.hits.length,1);assert.equal(p.hits[0].target,target);
 }
 assert.throws(()=>itemPresentation(data,potion,{target:4}),/bounds/);
});
