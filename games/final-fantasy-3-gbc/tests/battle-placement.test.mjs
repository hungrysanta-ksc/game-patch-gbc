import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {offset} from '../tools/render-budget-source.mjs';
import {originalFormation,effectConditionAudit} from '../tools/battle-placement-source.mjs';
import {placementBudgetAudit,formationPixels} from '../tools/battle-placement-budget.mjs';

test('original formation slots, padded graphics, centers and projectile angles remain distinct',async()=>{
 const {data}=await input(),f=originalFormation(data,3),boss=originalFormation(data,79);
 assert.equal(f.slots.length,8);assert.deepEqual(f.slots[7].center,[144,111]);assert.equal(f.angles.length,32);
 assert.equal(boss.layout,9);assert.deepEqual(boss.slots[0].center,[88,80]);
 const p=formationPixels(data,f);assert.ok(p.images.some(i=>i.sourceRect[1]===64)); // 4x4 art is bottom aligned in a 4x6 slot.
 const tall=formationPixels(data,originalFormation(data,83));assert.deepEqual(tall.images[0].sourceRect,[16,48,48,96]);assert.deepEqual(tall.images[0].candidateRect,[0,16,42,84]);
 assert.equal(originalFormation(data,71).unresolved.kind,'empty-monster-group');
 assert.equal(originalFormation(data,131).unresolved.kind,'positive-count-for-sentinel');
 assert.equal(originalFormation(data,138).unresolved.kind,'occupied-slot-outside-layout');
 assert.equal(originalFormation(data,149).unresolved.kind,'slot-assignment-overlap');
 assert.throws(()=>formationPixels(data,originalFormation(data,131)),/Unresolved formation/);
 assert.throws(()=>originalFormation(data,3,{counts:[0,0,0,0]}),/Count outside/);
 const changed=Buffer.from(data);changed[offset(0x2f,0xbe5b)]=0x59;assert.throws(()=>originalFormation(changed,79),/Original target center/);
});

test('original target masks, party physical dispatch and all 24 summon target branches',async()=>{
 const {data}=await input(),r=effectConditionAudit(data);
 assert.deepEqual(r.summary,{targetMasks:256,physicalDispatches:32,summonVariants:24,summonTargetModes:{'all-allies':4,'all-enemies':11,'random-enemy':9}});
 assert.deepEqual(r.masks[0].targets,[]);assert.deepEqual(r.masks[0x81].targets,[0,7]);assert.equal(r.masks[255].targets.length,8);
 assert.deepEqual(r.physical.at(-1),{graphics:0x12,actor:3,target:7});
 assert.ok(r.summons.filter(s=>s.targetMode==='random-enemy').every(s=>s.randomDraws.join()==='0,5'&&s.mask===4));
 const changed=Buffer.from(data);changed[offset(0x33,0xb6ef)]=7;assert.throws(()=>effectConditionAudit(changed),/Original target-mask/);
 const other=Buffer.from(data);other[offset(0x34,0x8650)]=0;assert.throws(()=>effectConditionAudit(other),/Original party-to-enemy/);
 const flags=Buffer.from(data);flags[offset(0x35,0xa09f)]=0x20;assert.throws(()=>effectConditionAudit(flags),/Original summon target/);
});

test('multi-enemy atlas failures and clipping stay visible; incomplete transitions have no invented costs',async()=>{
 const {data}=await input(),r=placementBudgetAudit(data);
 assert.deepEqual(r.summary,{formationProbes:1024,placed:710,unresolved:314,unresolvedKinds:{'empty-monster-group':20,'positive-count-for-sentinel':277,'occupied-slot-outside-layout':13,'slot-assignment-overlap':4},representatives:8,states:197,failedStates:60});
 const eight=r.rows.find(r=>r.formation===3),six=r.rows.find(r=>r.formation===47),boss=r.rows.find(r=>r.formation===79);
 assert.equal(eight.summary.residentPatternUnion,277);assert.equal(eight.summary.maxActiveNextUnion,177);assert.equal(eight.summary.maxChangedCells,42);assert.equal(eight.summary.maxNewPatternBytes,480);
 assert.equal(six.summary.failedStates,36);assert.equal(six.summary.maxOutsideViewport,46);assert.equal(six.summary.maxNewPatternBytes,null);assert.equal(six.summary.maxActiveNextUnion,null);
 assert.ok(six.transitions.every(t=>t.unresolved&&!('newPatternBytes' in t)));
 assert.equal(boss.summary.failedStates,0);assert.equal(boss.summary.maxObjects,10);assert.equal(boss.summary.residentPatternUnion,82);
 assert.ok(r.rows.flatMap(r=>r.states).filter(s=>s.failure).every(s=>s.failure==='Composition OAM capacity'));
});
