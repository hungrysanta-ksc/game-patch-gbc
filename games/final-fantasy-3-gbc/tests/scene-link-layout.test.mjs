import test from 'node:test';import assert from 'node:assert/strict';
import {relocateField,checkSceneLayout,overlayBase,commonModules,fieldModules,battleModules} from '../tools/scene-link-layout.mjs';
function banks(){const d=Buffer.alloc(16384),a=Buffer.alloc(16384,0x55),b=Buffer.alloc(16384,0xa7);d[0]=16;d.writeUInt16LE(16368,1);d.writeUInt16LE(16,3);d[5]=17;d.writeUInt16LE(3,6);d.writeUInt16LE(123,8);return new Map([[12,d],[16,a],[17,b]]);}
test('relocation changes every generated descriptor bank and no payload/offset/length bytes',()=>{
 const source=banks(),before=Buffer.from(source.get(12)),r=relocateField(source,[1,1],[0,5]);assert.equal(r.entries,2);assert.equal(r.changedBytes,2);assert.deepEqual(source.get(12),before);
 assert.equal(r.banks.get(12)[0],80);assert.equal(r.banks.get(12)[5],81);r.banks.get(12)[0]=16;r.banks.get(12)[5]=17;assert.deepEqual(r.banks.get(12),before);
 assert.deepEqual(r.banks.get(80),source.get(16));assert.deepEqual(r.banks.get(81),source.get(17));
});
test('relocation refuses missing banks, bank overflow, malformed groups and extent overrun',()=>{
 for(const edit of [b=>b.delete(16),b=>b.get(12)[0]=255,b=>b.get(12).writeUInt16LE(17,3),b=>b.get(12).writeUInt16LE(0,3)]){const b=banks();edit(b);assert.throws(()=>relocateField(b,[1,1],[0,5]));}
 assert.throws(()=>relocateField(banks(),[1,1],[0,6]));
});
function layout(){return {s__HEAP:0xca71,s__FF3_FIELD:overlayBase,l__FF3_FIELD:978,s__FF3_BATTLE:overlayBase,l__FF3_BATTLE:1355,s__INITIALIZER:0x3f00,l__INITIALIZER:43,l__CODE_74:2000,_ff3_game_state:0xc100,_ff3_state:0xc500,_native_queue:0xc600,_native_consumed:0xc580,_memory_bridge:0xc590,_scene_arena_owner:0xc0b0,_scene_video_owner:0xc0b1};}
test('combined layout keeps common state disjoint and budgets both live and suspended data',()=>{
 const r=checkSceneLayout(layout());assert.equal(r.fixedFree,53);assert.equal(r.suspensionBytes,4050);
 assert.deepEqual(checkSceneLayout({...layout(),l__FF3_FIELD:1024}).suspensionBytes,4096);
});
test('combined layout rejects every RAM/ROM ownership boundary crossing',()=>{
 for(const edit of [{s__HEAP:overlayBase+1},{s__FF3_BATTLE:overlayBase+1},{l__FF3_FIELD:1025},{l__FF3_BATTLE:0x600},{l__CODE_74:16385},{s__INITIALIZER:0x4000},{_native_queue:overlayBase}])assert.throws(()=>checkSceneLayout({...layout(),...edit}));
 const bad=layout();delete bad.l__FF3_FIELD;assert.throws(()=>checkSceneLayout(bad));
 assert.throws(()=>checkSceneLayout({...layout(),_malloc:0x1234}));
});
test('each linked runtime module has one reviewed DATA lifetime',()=>{
 const all=[...commonModules,...fieldModules,...battleModules];assert.equal(new Set(all).size,all.length);
 for(const n of ['platform','audio-native','memory','text-vblank','scene-video','scene-memory'])assert.ok(commonModules.includes(n));
 for(const n of ['field-objects','npc-dialogue','text-window'])assert.ok(fieldModules.includes(n));
 for(const n of ['battle-party-video','battle-animation-video','battle-live-ui'])assert.ok(battleModules.includes(n));
});
