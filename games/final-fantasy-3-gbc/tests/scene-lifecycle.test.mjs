import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ROOT,input} from '../tools/source.mjs';
import {fieldBattleBoundaryAudit} from '../tools/field-battle-boundary.mjs';
import {storageClaims,diagnosticProfiles,claimsFor,conflicts,checkSuspension,resourceSourceInventory,checkResourceSources,resourceReport} from '../tools/scene-resource-contract.mjs';
import {memoryLayout} from '../tools/memory-layout.mjs';

test('original context/IRQ/inventory consumers keep live audio and results through two boundary cycles for every byte seed',async()=>{
 const {data}=await input(),r=fieldBattleBoundaryAudit(data);
 assert.equal(r.seeds,256);assert.equal(r.boundaryCycles,512);assert.equal(r.calls,3072);
 assert.equal(r.dpBytes,240);assert.equal(r.soundBytesExcluded,16);assert.ok(r.instructions>500000);
});
test('original mutation that restores sound DP or drops an inventory slot is rejected',async()=>{
 const {data}=await input();
 for(const [bank,address,value]of [[0x3f,0xf845,0xe0],[0x3d,0xbc44,0x1f]]){
  const bad=Buffer.from(data);bad[16+bank*8192+(address&8191)]=value;
  assert.throws(()=>fieldBattleBoundaryAudit(bad,1),/Unexpected boundary write|restored|Return keeps|Sound DP|No sound/);
 }
});
test('each diagnostic has disjoint storage but obsolete field bank 3 reservation is rejected',()=>{
 for(const profile of diagnosticProfiles)assert.deepEqual(conflicts(claimsFor([profile])),[]);
 const overlaps=checkSuspension(['effects'],[{id:'suspended-field',bank:3,begin:0,end:4096}]);
 assert.equal(overlaps.length,4);assert.deepEqual(overlaps.map(x=>x.a),['effect-map-backup','effect-oam-backup','effect-palette-backup','effect-frozen-patterns']);
 assert.ok(conflicts(claimsFor(['effects','composition-window','item-atlas'])).some(c=>c.bank===5&&c.begin===1024&&c.end===1280));
});
test('half-open ranges allow adjacency and reject malformed or ambiguous claims',()=>{
 assert.deepEqual(conflicts([{id:'a',bank:7,begin:0,end:16},{id:'b',bank:7,begin:16,end:32}]),[]);
 for(const r of [{bank:1,begin:0,end:8},{bank:8,begin:0,end:8},{bank:3,begin:-1,end:8},{bank:3,begin:8,end:8},{bank:3,begin:0,end:4097}])assert.throws(()=>conflicts([{id:'bad',...r}]),/Invalid storage/);
 assert.throws(()=>conflicts([storageClaims[0],storageClaims[0]]),/Duplicate/);
 assert.throws(()=>claimsFor(['typo']),/Unknown diagnostic/);
});
test('reviewed runtime source inventory rejects changed offsets and new allocator sources',async()=>{
 const actual=await resourceSourceInventory(),reviewed=JSON.parse(await fs.readFile(ROOT+'/spec/scene-resource-sources.json','utf8'));
 checkResourceSources(actual,reviewed.sources);
 assert.throws(()=>checkResourceSources([...actual,{path:'src/new-cache.c',sha256:'new'}],reviewed.sources),/inventory changed/);
 const changed=actual.map(r=>r.path==='src/battle-effect-freeze.c'?{...r,sha256:'changed-storage-formula'}:r);
 assert.throws(()=>checkResourceSources(changed,reviewed.sources),/owner changed/);
 const report=resourceReport(actual);assert.equal(report.roundtripReady,false);assert.equal(report.unresolved.length,4);
});
test('existing field memory report shares claims without weakening its fixed-RAM or placement checks',()=>{
 const symbols={s__HEAP:0xce00,_map_workspace:0xd000,_text_cells:0xd800,_text_staging:0xd950,_text_lookup:0xda60,_field:0xdb70,_field_staging:0xdbc0,_field_oam:0xdc00,
  _ff3_game_state:0xc000,_native_queue:0xc400,_native_consumed:0xc800,_memory_bridge:0xc810,_ff3_state:0xc820,_ff3_wram_copy:0x100,_ff3_wram_transfer:0x200,_ff3_memory_init:0x300,_native_snapshot_bank:0x400};
 const r=memoryLayout(symbols,{explore:true});
 assert.equal(r.minFixedFreeBytes,256);assert.equal(r.stackFloor,0xdcb0);
 assert.ok(r.storage.find(b=>b.bank===3).claims.some(c=>c.id==='effect-map-backup'));
 assert.equal(r.storage.find(b=>b.bank===7).claims.length,0);
 assert.match(r.storage.find(b=>b.bank===7).availability,/Not an allocation grant/);
 assert.throws(()=>memoryLayout({...symbols,s__HEAP:0xcfa0},{explore:true}),/256 bytes/);
 assert.throws(()=>memoryLayout({...symbols,_field_oam:0xdd00},{explore:true}),/placement/);
});
