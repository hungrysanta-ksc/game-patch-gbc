import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {liveUiAssets} from '../tools/battle-live-ui.mjs';
test('original window calls restore Korean HP and retain all four digit positions',async()=>{
 const {data,local}=await input(),a=await liveUiAssets(data,local.text);
 assert.equal(a.seed.length,60);assert.equal(a.rect.length,36);
 assert.ok(a.cases.some(c=>c.kind==='open')&&a.cases.some(c=>c.kind==='close')&&a.cases.some(c=>c.kind==='hp'));
 for(const profile of [0,1]){const calls=a.cases.filter(c=>c.profile===profile);const lastClose=calls.filter(c=>c.kind==='close').at(-1);assert.equal(lastClose.live,0);assert.equal(lastClose.pixels,a.initial.toString('hex'));}
 for(const c of a.cases){assert.ok(c.request.slice(3).every(id=>id<a.glyphCount));if(c.draw){assert.equal(Buffer.from(c.pixels,'hex').length,6400);assert.ok(c.patternBytes>=320&&c.patternBytes<=960);}else assert.equal(c.patternBytes,0);}
 // Dictionary carries only glyphs; immutable boxes have no embedded text.
 assert.equal(a.glyphs.length,a.glyphCount*16);assert.equal(a.boxes.length,2212);
 assert.equal(a.advances[0],3);assert.ok(a.seed.slice(6,15).every(id=>id!==0),'9999/9999 must keep all nine positions');
});
test('unformatted message probes retain original routing, unsupported branches and decimal edges',async()=>{
 const {data,local}=await input(),a=await liveUiAssets(data,local.text),c=a.cases.filter(c=>c.profile===2);
 for(const op of [6,8])assert.equal(c.filter(c=>c.semantic[0]===op).length,256);
 assert.equal(c.filter(c=>c.semantic[0]===9).length,144);
 assert.deepEqual(c.filter(c=>c.rewind).map(c=>c.rewind),[4,5,5]);
 assert.ok(c.some(c=>c.semantic[0]===6&&c.semantic[1]===32&&c.sourceId===0x633));
 assert.ok(c.some(c=>c.semantic[0]===8&&c.semantic[1]===0&&c.sourceId===0x10c&&c.error===3));
 assert.ok(c.some(c=>c.semantic[0]===7&&c.semantic[1]===136&&c.sourceId===0x636));
 assert.ok(c.some(c=>c.error===2));assert.ok(c.filter(c=>c.error).every(c=>!c.draw));
 assert.equal(a.message_types.length,72);assert.equal(a.message_index.length,a.messageCount*5);
 for(const row of c.filter(c=>c.kind==='hp'))assert.equal(row.request.length,18);
});
