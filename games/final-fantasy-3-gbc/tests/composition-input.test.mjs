import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {makeMapAssets} from '../tools/map-assets.mjs';import {makeObjectAssets} from '../tools/object-assets.mjs';
import {sourceInputTrace,packInput,dirtyOracle,verifyDirtyPixels} from '../tools/composition-inputs.mjs';
test('world-aligned changes cover original walking, guest follow, animation, order and hide pixels',async()=>{
 const {data}=await input(),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),frames=sourceInputTrace(data,assets);let previous,changes=0,max=0,reduced=0;
 for(const f of frames){assert.equal(packInput(f).length,260);const d=dirtyOracle(previous,f);changes+=verifyDirtyPixels(previous,f,d);max=Math.max(max,d.readUInt16LE(128));if(!d[132]&&d.readUInt16LE(128)<360)reduced++;previous=f;}
 assert.equal(frames.length,300);assert.equal(max,399);assert.ok(reduced>250);assert.ok(changes>1000);
 assert.ok(frames.some(f=>f.source.guestState[8]));assert.ok(frames.some(f=>f.actors[1].visible&&!f.actors[1].shape.equals(frames[0].actors[1].shape)));
 const changed=frames.findIndex((f,i)=>i>0&&f.epoch===frames[i-1].epoch&&verifyDirtyPixels(frames[i-1],f,dirtyOracle(frames[i-1],f))>0);
 assert.throws(()=>verifyDirtyPixels(frames[changed-1],frames[changed],Buffer.alloc(133)),/Missed source pixels/);
 for(const f of frames){const d=dirtyOracle(f,f);assert.equal(d.readUInt16LE(128),0);assert.equal(d[130],0);assert.equal(d[131],0);}
 // Full epoch invalidation and an arbitrary camera jump are different causes,
 // both must include every newly exposed world tile (including ring wrap).
 const f=frames[0],epoch={...f,epoch:f.epoch+1},jump={...f,camera:[1000,1000]};
 assert.equal(dirtyOracle(f,epoch).readUInt16LE(128),399);
 // 1000 wraps across zero; 7 columns by 4 rows remain resident.
 assert.equal(dirtyOracle(f,jump).readUInt16LE(128),399-7*4);
 assert.equal(dirtyOracle(f,{...f,camera:[400,400]}).readUInt16LE(128),399);
 verifyDirtyPixels(f,jump,dirtyOracle(f,jump));
});
