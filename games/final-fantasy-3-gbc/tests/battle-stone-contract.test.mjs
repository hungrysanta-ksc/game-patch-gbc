import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {offset} from '../tools/render-budget-source.mjs';
import {stoneDispatchAudit,stoneGeometryAudit} from '../tools/battle-stone-contract.mjs';
test('source death overrides stone across all normalized status, row, actor and direction combinations',async()=>{
 const {data}=await input(),r=stoneDispatchAudit(data);assert.equal(r.cases,4096);assert.equal(r.deadStoneClears,1024);assert.deepEqual(r.kinds,[256,512,256,3072]);assert.equal(r.writes,28672);
});
test('dispatcher audit detects the former bit-40-only priority error',async()=>{
 const {data}=await input(),bad=Buffer.from(data);bad[offset(0x2f,0xb730)]=64;assert.throws(()=>stoneDispatchAudit(bad),/stone\/death precedence c0/);
});
test('source stone footprint exposes the live footer ownership collision',async()=>{
 const {data}=await input(),r=stoneGeometryAudit(data);assert.equal(r.glyphs.length,24);assert.ok(r.glyphs.every(g=>g.ink>0&&g.cells<=10));assert.ok(r.glyphs.some(g=>g.actor===3&&g.footerInk>0));assert.ok(r.glyphs.filter(g=>g.actor<3).every(g=>!g.footerInk));
});
