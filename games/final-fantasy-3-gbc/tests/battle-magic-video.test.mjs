import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {offset} from '../tools/render-budget-source.mjs';
import {magicAssets} from '../tools/battle-magic-assets.mjs';import {magicSource,magicSourcePixels} from '../tools/battle-magic-source.mjs';
test('live fixture spells select ordinary animation in the original attack-property consumer',async()=>{
 const {data}=await input();for(const id of [0,1,29,36,50])assert.equal(data[offset(0x30,0x98c0+id*8+6)],0);
 const a=magicAssets(data);assert.equal(a.records.length,88);assert.ok(a.records.every(r=>r.length===523));
});
test('complete enemy ordinary owner preserves target iteration, sound requests and explicit waits',async()=>{
 const {data}=await input();
 for(const profile of [0,2])for(const [spell,mask,count]of [[29,128,27],[36,16,27],[0,240,134],[1,0,2],[50,64,19]]){
  const r=magicSource(data,{profile,spell,mask});assert.equal(r.frames.length,count);
  const targets=[...new Set(r.frames.filter(f=>f.pc===0xb7ad).map(f=>f.target))];assert.deepEqual(targets,[0,1,2,3].filter(i=>mask&(128>>i)));
  assert.equal(r.sounds.length,1+targets.length);assert.equal(r.sounds[0],255);
  for(const f of r.frames)assert.equal(magicSourcePixels(f,Buffer.alloc(160*144*3),profile>=2).length,160*144*3);
 }
});
