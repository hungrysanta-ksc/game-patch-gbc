import test from 'node:test';import assert from 'node:assert/strict';
import {cellJob} from '../tools/composition-kernel.mjs';import {encodeTile} from '../tools/npc-composition.mjs';
function scene(){const bgPalette=Buffer.alloc(32),objPalette=Buffer.alloc(16);for(let i=0;i<4;i++)bgPalette.writeUInt16LE(i,i*2);for(let i=0;i<8;i++)objPalette.writeUInt16LE(i+4,i*2);return {background:encodeTile(Array(64).fill(1)),map:Buffer.alloc(360,128),attributes:Buffer.alloc(360),bgPalette,objPalette,original:[]};}
test('cell inputs retain ordered raw source tiles and signed clipping, without final masks',()=>{
 const s=scene(),a={x:-7,y:0,h:8,palette:0,behind:true,pixels:Array(64).fill(1)},b={...a,behind:false,pixels:Array(64).fill(2)};s.original=[a,b];
 const j=cellJob(s,{attributes:Buffer.alloc(360),bgPalette:s.bgPalette,sprites:[]},0);
 assert.equal(j.bytes[0],2);assert.deepEqual([...j.bytes.subarray(29,32)],[249,0,128]);assert.deepEqual([...j.bytes.subarray(48,51)],[249,0,0]);
 assert.deepEqual(j.expected,Buffer.concat([encodeTile(Array(64).fill(1)),Buffer.alloc(32)]));
 s.original=Array(17).fill(a);assert.throws(()=>cellJob(s,{attributes:Buffer.alloc(360),bgPalette:s.bgPalette,sprites:[]},0),/capacity/);
});
test('an opaque OBJ color matching background zero is retained by palette remapping',()=>{
 const s=scene();s.objPalette.writeUInt16LE(0,2);s.original=[{x:0,y:0,h:8,palette:0,behind:false,pixels:Array(64).fill(1)}];
 const j=cellJob(s,{attributes:Buffer.alloc(360),bgPalette:s.bgPalette,sprites:[]},0);assert.equal(j.bytes[1+5],0);assert.deepEqual(j.expected,Buffer.alloc(48));
});
test('shared OBJ colors retain the selected single residual palette instead of adding another OAM layer',()=>{
 const s=scene();s.objPalette.writeUInt16LE(5,10);const pixels=Array.from({length:64},(_,i)=>1+(i&1));s.original=[{x:0,y:0,h:8,palette:1,behind:false,pixels}];
 const j=cellJob(s,{attributes:Buffer.alloc(360),bgPalette:s.bgPalette,sprites:[{x:0,y:0,palette:1}]},0);
 assert.equal(j.bytes[1+5],9);assert.deepEqual(j.expected.subarray(16,32),Buffer.alloc(16));assert.deepEqual(j.expected.subarray(32),encodeTile(pixels));
});
