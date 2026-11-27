import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {sourceInitialState} from '../tools/state-source.mjs';
import {encounterEntryOriginal} from '../tools/encounter-entry-source.mjs';
import {partyEntryOracle} from '../tools/battle-party-oam-source.mjs';
import {originalFormation} from '../tools/battle-placement-source.mjs';
import {residentEnemy} from '../tools/battle-resident-bg.mjs';import {hitFlashAssets} from '../tools/battle-hit-assets.mjs';

test('source RNG reaches every count combination in the current complete encounter group',async()=>{
 const {data}=await input(),state=sourceInitialState(data),counts=[new Set(),new Set()],types=new Set();
 for(let id=0;id<2;id++)for(let seed=0;seed<256;seed++){const e=encounterEntryOriginal(data,id,seed,state);counts[id].add(e.counts.join());types.add(e.type);assert.equal(e.rng[0],(seed&2)>>1);assert.equal(e.rng[3],seed);assert.equal(e.types.filter(n=>n!==255).length,e.counts.reduce((a,b)=>a+b));}
 assert.deepEqual(counts.map(c=>c.size),[3,4]);assert.ok(types.has(0)&&types.has(128));
});
test('every registered count/direction retains all source pixels within the joint OBJ budget',async()=>{
 const {data}=await input();
 const entries=[];for(let formation=0;formation<4;formation++){const ranges=originalFormation(data,formation).ranges;const visit=counts=>{if(counts.length===4){entries.push({formation,counts});return;}const r=ranges[counts.length];for(let n=r.min;n<=r.max;n++)visit([...counts,n]);};visit([]);}
 assert.ok(entries.length>7);
 for(const {formation,counts}of entries)for(const back of [false,true]){
  const p=partyEntryOracle(data,{formation,counts,back}),before=residentEnemy(p),offsets=formation===0?[-4,-6]:[0,0];
  p.enemyYOffsets=offsets;const bg=residentEnemy(p),hit=hitFlashAssets(data,p,bg);
  assert.ok(bg.objects.length<=8);assert.ok(bg.stats.tiles+20<=256);assert.equal(hit.maps.length,8*704);
  assert.equal(bg.words.filter(Boolean).length,before.words.filter(Boolean).length);
  for(let y=0;y<84;y++)for(let x=0;x<448;x++)if(before.words[y*448+x])assert.equal(bg.words[(y+offsets[y<42?0:1])*448+x],before.words[y*448+x]);
  // Independent native BG/OBJ decode; verify the actual encoded tiles and
  // both palette planes, not a checksum of the compiler's input bitmap.
  for(let y=0;y<88;y++)for(let x=0;x<448;x++){
   const cell=(y>>3)*56+(x>>3),tile=bg.maps[cell]*16+(y&7)*2,bit=7-(x&7),v=(bg.patterns[tile]>>bit&1)|((bg.patterns[tile+1]>>bit&1)<<1);let color=bg.palette.readUInt16LE(((bg.maps[616+cell]&3)*4+v)*2);
   for(const o of bg.objects)if(x>=o.x&&x<o.x+8&&y+16>=o.y&&y+16<o.y+8){const t=o.tile*16+(y+16-o.y)*2,b=7-(x-o.x),z=(bg.patterns[t]>>b&1)|((bg.patterns[t+1]>>b&1)<<1);if(z){color=bg.palette.readUInt16LE(((o.attr&3)*4+z)*2);break;}}
   assert.equal(color,bg.words[y*448+x]);
  }
 }
});
test('row placement rejects clipped opaque pixels instead of dropping them',async()=>{
 const {data}=await input(),p=partyEntryOracle(data,{formation:1,counts:[1,1,0,0]});assert.throws(()=>residentEnemy({...p,enemyYOffsets:[-4,-6]}),/Whole enemy dots/);
});
