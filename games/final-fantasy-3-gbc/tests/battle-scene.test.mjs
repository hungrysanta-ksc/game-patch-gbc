import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {Driver6502} from '../tools/driver6502.mjs';
import {offset} from '../tools/render-budget-source.mjs';
import {sceneDispatchAudit,actionScriptAudit,messageWindowAudit,damageLifetimeAudit} from '../tools/battle-scene-source.mjs';
import {sceneCoverage} from '../tools/battle-scene-contract.mjs';

test('absolute STA does not perform a synthetic destination read before a PPU write',()=>{
 const c=new Driver6502(Buffer.alloc(0));c.m.set([0xa9,0x42,0x8d,7,0x20,0xad,7,0x20,0x60],0x600);
 let reads=0;const writes=[],read=c.read.bind(c),write=c.write.bind(c);
 c.read=a=>a===0x2007?(reads++,0x57):read(a);c.write=(a,v)=>a===0x2007?writes.push(v):write(a,v);
 c.call(0x600);assert.equal(reads,1);assert.deepEqual(writes,[0x42]);assert.equal(c.a,0x57);
});
test('original dispatch and action order keep animation, digits, death and message repeat distinct',async()=>{
 const {data}=await input(),d=sceneDispatchAudit(data),a=actionScriptAudit(data,d);
 assert.deepEqual(d.summary,{pointerSlots:155,actionSelectorCases:50,attackAnimationSlots:17});
 assert.equal(a.scripts.length,6);assert.deepEqual(a.scripts[0].commands,[5,7,11,6,12,8,13,9,10,4,3,1,2,0]);
 assert.deepEqual(a.scripts[1].commands,[5,6,7,11,12,8,9,13,10,4,3,2,1,0]);
 assert.deepEqual(a.repeats.map(r=>r.next),[11,7,11,6]);assert.equal(a.waits.length,18);
 assert.equal(a.waits[0].frames,64);assert.equal(a.waits[1].frames,1);assert.equal(a.waits.at(-1).frames,0);
 assert.deepEqual(a.scripts.slice(0,2).map(s=>s.maxMayLive),[5,5]);
 const changed=Buffer.from(data);changed[offset(0x34,0x9039)]=0xea;assert.throws(()=>sceneDispatchAudit(changed));
});
test('five overlapping original message windows restore their exact underlay in both action orders',async()=>{
 const {data}=await input();for(const profile of ['fight','magic']){const w=messageWindowAudit(data,profile);
  assert.equal(w.totalBackupBytes,236);assert.equal(w.totalWaits,60);assert.equal(w.restored,true);
  assert.deepEqual(w.transfer,{reads:256,writes:472});assert.equal(w.windows.length,5);
 }
 const changed=Buffer.from(data);changed[offset(0x34,0x8e83+7)]++;assert.throws(()=>messageWindowAudit(changed),/Original overlapped window restore/);
 assert.throws(()=>messageWindowAudit(data,'invented'),/Window profile/);
});
test('whole original eight-target damage loop coexists with original party through 32 display waits',async()=>{
 const {data}=await input(),r=damageLifetimeAudit(data);
 assert.deepEqual(r.summary,{paletteWaits:1,sourceFrames:32,maxDigitSlots:32,partySlots:24,maxNonzeroVisible:56});
 assert.ok(r.frames.every(f=>f.nonzeroVisibleSlots.length===56));assert.ok(new Set(r.frames.map(f=>f.oamSha256)).size>8);
 const changed=Buffer.from(data);changed[offset(0x33,0xada2)]=0x10;assert.throws(()=>damageLifetimeAudit(changed),/Original all-target damage lifetime/);
});
test('dispatch coverage cannot silently drop an unobserved family or become whole-scene proof',async()=>{
 const {data}=await input(),d=sceneDispatchAudit(data),r=sceneCoverage(d);
 assert.equal(r.summary.graphicsSlots,38);assert.equal(r.summary.integratedPassed,0);
 assert.ok(r.families.find(f=>f.id==='summon').videoSeconds.length===0);
 assert.ok(r.scenarios.every(s=>s.status==='pending'&&s.missingMetrics.includes('music-sfx-buffer-underrun-and-irq-lateness')));
 const missing=structuredClone(d);missing.tables[0].entries.pop();assert.throws(()=>sceneCoverage(missing),/coverage/);
});
