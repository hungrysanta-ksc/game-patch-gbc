import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {makeMapAssets} from '../tools/map-assets.mjs';import {makeObjectAssets} from '../tools/object-assets.mjs';
import {windowAssets,worldScene} from '../tools/composition-window-assets.mjs';import {sourceInputTrace} from '../tools/composition-inputs.mjs';import {composePixels} from '../tools/npc-composition.mjs';
test('original four-palette world supply preserves fine scroll and reserves the Korean window palette',async()=>{
 const {data}=await input(),a=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),r=windowAssets(data,a);
 assert.equal(r.frames.length,12);assert.equal(r.palettes,7);assert.ok(r.frames.some(f=>f.scroll.some(Boolean)));
 assert.ok(r.jobs.some(j=>j.expected.subarray(48).some(Boolean)),'Original palettes 2/3 must survive composition');
 assert.ok(r.jobs.every(j=>j.expected.length===80&&j.bytes.length<=256));
 assert.ok(r.frames.every(f=>f.attributes.every(v=>v<7)&&f.stats.objects<=40&&f.stats.peak<=10));
 const scene=worldScene(sourceInputTrace(data,a)[0]),expected=composePixels(scene),wrong={...scene,original:scene.original.map(o=>({...o,palette:o.palette&1}))};
 assert.ok(composePixels(wrong).some((v,i)=>v!==expected[i]),'Two-palette masking must change original pixels');
});
