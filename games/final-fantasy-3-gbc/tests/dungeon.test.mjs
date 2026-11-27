import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {dungeonEntry} from '../tools/dungeon-source.mjs';import {makeMapAssets} from '../tools/map-assets.mjs';
import {partyEntryOracle} from '../tools/battle-party-oam-source.mjs';import {terrainAssets,terrainFrames,terrainColor} from '../tools/battle-terrain.mjs';
import {residentEnemy,residentRgb,originalResidentRgb} from '../tools/battle-resident-bg.mjs';
test('observed dungeon corridor retains source collision, encounter tiles and rate',async()=>{
 const {data}=await input(),e=dungeonEntry(data),a=makeMapAssets(data,{verify:false}),g=a.groups,p=g.properties[e.map],map=g.layout[g.selection[e.map][0]],collision=g.collision[p[0]>>5];
 assert.deepEqual(e.start,[3,19]);assert.equal(e.song,p[10]);
 for(let y=19;y<=27;y++)assert.equal(collision[map[y*32+3]*2],0x41);
 const changed=Buffer.from(data);changed[16+0x39*8192+(0xbe00&8191)+e.map]=255;assert.throws(()=>dungeonEntry(changed),/source contract/);
});
test('cave entry masks preserve all original terrain and enemy pixels in both directions',async()=>{
 const {data}=await input();let frames=0;
 for(const back of [false,true]){
  const p=partyEntryOracle(data,{formation:0,counts:[4,0,0,0],terrain:8,back}),a=terrainAssets(p),f=terrainFrames(data,p,a),bg=residentEnemy(p);
  assert.equal(p.terrain,8);assert.ok(!a.source.equals(partyEntryOracle(data,{terrain:0}).terrainSource));
  for(let i=0;i<f.length;i++){assert.deepEqual(residentRgb(p,p.frames[i],bg,(x,y)=>terrainColor(a,f[i],p.bgPalette,x,y)),originalResidentRgb(p,p.frames[i],11));frames++;}
 }assert.ok(frames>50);
});
