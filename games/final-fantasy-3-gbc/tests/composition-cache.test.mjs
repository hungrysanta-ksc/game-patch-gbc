import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {makeMapAssets} from '../tools/map-assets.mjs';import {makeObjectAssets} from '../tools/object-assets.mjs';import {compositionCases} from '../tools/npc-composition-source.mjs';import {cacheAssets} from '../tools/composition-cache-assets.mjs';import {renderScene} from '../tools/render-budget-pixels.mjs';
test('shared map palettes retain original pixels and active/staging sets fit without overwriting visible cache entries',async()=>{
 const {data}=await input(),cases=compositionCases(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false})).cases,{frames,jobs}=cacheAssets(cases);
 assert.equal(frames.length,22);for(let i=0;i<frames.length;i++)assert.deepEqual(frames[i].rgb,renderScene(cases[i].scene,{hardware:false,original:true}),frames[i].label);
 const keys=Array(128).fill(-1),pins=Array(128).fill(0);let hand=0,evictions=0;
 for(const f of [...frames,...frames]){for(let i=0;i<128;i++)pins[i]&=1;for(const id of f.ids){let slot=keys.indexOf(id);if(slot<0){let tries=0;while(pins[hand]&&tries++<128)hand=(hand+1)&127;assert.ok(tries<128,'Pinned capacity');slot=hand;hand=(hand+1)&127;if(keys[slot]>=0)evictions++;keys[slot]=id;}pins[slot]|=2;}for(let i=0;i<128;i++)pins[i]>>=1;for(const id of f.ids)assert.ok(keys.includes(id));}
 assert.ok(evictions>0);assert.ok(jobs.some(j=>j.static)&&jobs.some(j=>!j.static));
 for(const f of frames){const first=frames.find(g=>g.group===f.group);assert.deepEqual(f.palette,first.palette);}
});
