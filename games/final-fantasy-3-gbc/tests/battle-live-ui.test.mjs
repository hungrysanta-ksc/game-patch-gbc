import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {liveUiAssets} from '../tools/battle-live-ui.mjs';
test('original window calls restore Korean HP and retain all four digit positions',async()=>{
 const {data,local}=await input(),a=await liveUiAssets(data,local.text);
 assert.equal(a.seed.length,60);assert.equal(a.rect.length,36);
 assert.ok(a.cases.some(c=>c.kind==='open')&&a.cases.some(c=>c.kind==='close')&&a.cases.some(c=>c.kind==='hp'));
 for(const profile of [0,1]){const calls=a.cases.filter(c=>c.profile===profile);const lastClose=calls.filter(c=>c.kind==='close').at(-1);assert.equal(lastClose.live,0);assert.equal(lastClose.pixels,a.initial.toString('hex'));}
 for(const c of a.cases){assert.ok(c.request.slice(3).every(id=>id<a.glyphCount));assert.equal(Buffer.from(c.pixels,'hex').length,6400);assert.ok(c.patternBytes>=320&&c.patternBytes<=960);}
 // Dictionary carries only glyphs; immutable boxes have no embedded text.
 assert.equal(a.glyphs.length,a.glyphCount*16);assert.equal(a.boxes.length,2212);
 assert.equal(a.advances[0],3);assert.ok(a.seed.slice(6,15).every(id=>id!==0),'9999/9999 must keep all nine positions');
});
