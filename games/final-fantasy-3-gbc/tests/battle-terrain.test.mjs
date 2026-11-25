import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {partyEntryOracle} from '../tools/battle-party-oam-source.mjs';
import {residentEnemy,residentRgb,originalResidentRgb} from '../tools/battle-resident-bg.mjs';
import {terrainAssets,terrainApply,terrainFrames,terrainColor} from '../tools/battle-terrain.mjs';
test('live terrain masks retain original 64-byte publications and all entry pixels',async()=>{
 const {data}=await input();let count=0;
 for(const back of [false,true])for(const partyStatus of [[0,0,0,0],[128,64,32,8]]){
  const p=partyEntryOracle(data,{back,partyStatus}),a=terrainAssets(p),frames=terrainFrames(data,p,a),enemy=residentEnemy(p);
  assert.ok(a.source.equals(data.subarray(0x18010,0x18110)));
  assert.deepEqual(a.stats,{tiles:10,records:264,luts:12,chunkRecords:[192,72,0,0]});
  assert.deepEqual(terrainAssets({...p,frames:[]}),a);
  for(const [i,f]of p.frames.entries()){
   assert.ok(residentRgb(p,f,enemy,(x,y)=>terrainColor(a,frames[i],p.bgPalette,x,y)).equals(originalResidentRgb(p,f,11)));count++;
  }
 }assert.equal(count,123);
});
test('terrain bindings preserve every bit value, independent of source fade observations',async()=>{
 const {data}=await input(),p=partyEntryOracle(data),a=terrainAssets(p),canonical=Buffer.alloc(160);
 for(let value=0;value<256;value++){
  const source=Buffer.from(Array.from({length:256},(_,i)=>(value+i*37)&255));
  for(let row=0;row<4;row++)terrainApply(a,canonical,row,source.subarray(row*64,row*64+64));
  for(let y=0;y<16;y++)for(let x=0;x<160;x++){
   const index=a.map[(y>>3)*20+(x>>3)]*16+(y&7)*2,shift=7-(x&7),actual=(canonical[index]>>shift&1)|((canonical[index+1]>>shift&1)<<1);
   if(y>=11){assert.equal(actual,0);continue;}
   const sx=Math.floor(x*256/160),sy=y+8,tile=p.initialPpu[0x2000+(sy>>3)*32+(sx>>3)],offset=tile*16+(sy&7)-0x600,bit=7-(sx&7);
   assert.equal(actual,(source[offset]>>bit&1)|((source[offset+8]>>bit&1)<<1));
  }
  const before=Buffer.from(canonical);terrainApply(a,canonical,2,Buffer.alloc(64,255));terrainApply(a,canonical,3,Buffer.alloc(64,255));assert.ok(canonical.equals(before));
 }
 assert.throws(()=>terrainApply(a,canonical,4,Buffer.alloc(64)),/input/);
});
