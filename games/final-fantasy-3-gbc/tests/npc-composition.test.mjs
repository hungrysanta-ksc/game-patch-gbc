import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {makeMapAssets} from '../tools/map-assets.mjs';import {makeObjectAssets} from '../tools/object-assets.mjs';
import {compositionCases} from '../tools/npc-composition-source.mjs';import {compileComposition,compositionWords,composePixels,encodeTile} from '../tools/npc-composition.mjs';
function synthetic(){const bgPalette=Buffer.alloc(32),objPalette=Buffer.alloc(16);for(let p=0;p<4;p++)for(let i=0;i<4;i++)bgPalette.writeUInt16LE(i,(p*4+i)*2);for(let p=0;p<2;p++)for(let i=1;i<4;i++)objPalette.writeUInt16LE(i+3,(p*4+i)*2);return {background:encodeTile(Array.from({length:64},(_,i)=>i&3)),map:Buffer.alloc(360,128),attributes:Buffer.alloc(360),bgPalette,objPalette,original:[]};}
function sprite(x,y){return {x,y,h:8,palette:0,behind:false,pixels:Uint8Array.from({length:64},(_,i)=>i<8?1+i%3:0)};}
test('priority winner is resolved before BG occlusion; hidden first sprite does not expose a later sprite',()=>{
 const s=synthetic(),a=sprite(0,0),b=sprite(0,0);a.behind=true;a.pixels.fill(1);b.pixels.fill(2);s.original=[a,b];
 const words=composePixels(s);assert.equal(words[0],4);assert.equal(words[1],1);assert.notEqual(words[1],5);
 const c=compileComposition(s);assert.deepEqual(compositionWords(c),words);
});
test('seven colors retain exact RGB555 and capacity failures never silently drop residual objects',()=>{
 const s=synthetic();s.original=[sprite(0,0)];const c=compileComposition(s);assert.equal(c.stats.objects,1);assert.deepEqual(compositionWords(c),composePixels(s));
 s.original=Array.from({length:11},(_,i)=>sprite(i*8,0));assert.throws(()=>compileComposition(s),/scanline capacity/);
 s.original=Array.from({length:60},(_,i)=>sprite((i%20)*8,Math.floor(i/20)*8));assert.throws(()=>compileComposition(s),/OAM capacity/);
});
test('original map conditions, visibility changes and subpixel motion survive composition and reload',async()=>{
 const {data}=await input(),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),r=compositionCases(data,assets);assert.equal(r.cases.length,22);
 const trigger=r.contexts.find(c=>c.world===2&&c.map===87).rows;assert.equal(trigger.length,1);assert.deepEqual(trigger[0].checks.map(c=>c.event),[81,0]);
 const frames=new Map();for(const f of r.cases){const c=compileComposition(f.scene);assert.deepEqual(compositionWords(c),composePixels(f.scene),f.label);frames.set(f.label,c);}
 assert.deepEqual(frames.get('initial-2-87').background,frames.get('reload-2-87').background);
 assert.deepEqual(frames.get('initial-0-139').pixels,frames.get('reload-0-139').pixels);
 assert.notDeepEqual(frames.get('initial-2-87').pixels,frames.get('event81-hide-11').pixels);
 assert.notDeepEqual(frames.get('event98-move-1').pixels,frames.get('event98-move-16').pixels);
 assert.deepEqual(frames.get('initial-1-87').stats,{bgTiles:74,bgPalettes:7,objects:29,peak:6});
});
