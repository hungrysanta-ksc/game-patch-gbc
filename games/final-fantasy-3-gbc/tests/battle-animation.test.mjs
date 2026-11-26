import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {animationAssets,animationSeed,animationReference,animationCases} from '../tools/battle-animation-source.mjs';
import {numeralAssets,numeralSeed,numeralReference} from '../tools/battle-numerals-source.mjs';
test('common source caller retains graphics barriers and both numeral buffers',async()=>{
 const {data}=await input(),a=animationAssets(data),cases=animationCases(data),branches=new Set();
 assert.equal(a.tables.actions.length,25);assert.equal(a.tables.sounds.length,88);assert.equal(a.ids[255],0);
 for(const s of cases){const trace=animationReference(data,s);branches.add(trace[0][88]);assert.equal(trace.at(-1)[103],1);assert.equal(trace.at(-1)[102],255);for(let i=0;i<trace.length-1;i++)assert.equal(trace[i].readUInt16LE(107),i+1);}
 assert.equal(branches.size,17);
 const values=Array.from({length:32},(_,i)=>i*7),trace=animationReference(data,animationSeed(23,{flags:64,numbers:values}));
 assert.deepEqual(trace.map(s=>s[102]),[28,28,255]);assert.equal(trace[0][89],1);assert.equal(trace[1][89],0);assert.deepEqual([...trace[1].subarray(48,64)],values.slice(16));
});
test('source summon rows, party-vs-party hits and death ordering remain distinct',async()=>{
 const {data}=await input();const fight=animationReference(data,animationSeed(4,{flags:0,hits:[2,3]}));
 assert.deepEqual(fight.map(s=>s[102]),[18,20,255]);assert.deepEqual([...fight[0].subarray(13,15)],[0,0]);assert.deepEqual([...fight[1].subarray(13,15)],[2,3]);
 for(const flags of [0,128]){const death=animationReference(data,animationSeed(22,{flags,status:[128,0,0,0,0,0,0,0],dead:[128,0,0,0,0,0,0,0],types:Array(8).fill(0)}));assert.deepEqual(death.map(s=>s[102]),flags?[7,10,255]:[10,7,255]);}
 const summon=animationReference(data,animationSeed(19,{summon:1,summonAttack:0x72,targets:255}));assert.equal(summon[0][102],30);assert.equal(summon[0][98],7);assert.equal(summon[0][99],2);
});
test('numeral source retains 32 waits, miss/recovery glyphs and caller-owned cleanup',async()=>{
 const {data}=await input(),assets=numeralAssets(data);assert.equal(assets.tables.sine.length,128);
 const trace=numeralReference(data,numeralSeed({values:[0,9999,0x4000,0x8038,0x3fff,0x7fff,0xbfff,0xffff]}));
 assert.equal(trace.length,33);assert.deepEqual([...trace[0].state.subarray(50,66)],[0,0,0,0x56,0x5f,0x5f,0x5f,0x5f,0,0x64,0x65,0,0,0,0x6b,0x6c]);
 assert.ok(trace[0].state.subarray(66,82).every(v=>v===0));assert.deepEqual(trace.at(-1).oam,trace.at(-2).oam);assert.equal(trace.at(-1).state[90],32);
 const original=Buffer.alloc(160,0xa5),empty=numeralReference(data,numeralSeed({values:Array(8).fill(65535)}),original);assert.equal(empty.length,1);assert.deepEqual(empty[0].oam,original);
});
