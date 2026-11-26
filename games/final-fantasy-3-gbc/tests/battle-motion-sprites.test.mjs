import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {motionSpriteAssets,motionSpriteReference} from '../tools/battle-motion-sprites.mjs';
import {strikeAnchor,strikeSliceAnchor} from '../tools/battle-strike-assets.mjs';
import {originalFormation} from '../tools/battle-placement-source.mjs';

test('motion assets are immutable source tables and retain masked slash records',async()=>{
 const {data}=await input(),a=motionSpriteAssets(data);
 assert.equal(a.source.sha256,'f1f59370b29aafb96ff73fa17bb1f0a113438d95f64d31a15d3f32e7dd6a8645');
 for(let slice=0;slice<4;slice++)for(const hand of [0,1])for(const back of [0,1]){
  const b=motionSpriteReference(data,{slice,hand,back,x:88,y:80});
  assert.equal(b.length,48);assert.ok(b.some((v,i)=>i%4===1&&v===0));
 }
});

test('the whole slash sweep fits once per target without resizing or frame-dependent movement',async()=>{
 const {data}=await input(),f=originalFormation(data,3);
 for(const back of [0,1])for(const slot of f.slots){const [sx,sy]=slot.center,[x,y]=strikeSliceAnchor(sx,sy,back),raw=strikeAnchor(sx,sy,back);
  assert.ok(Math.abs(x-raw[0])<=4);assert.equal(y,raw[1]);
  for(let slice=0;slice<4;slice++)for(const hand of [0,1]){const o=motionSpriteReference(data,{slice,hand,back,x:sx,y:sy});
   for(let i=0;i<48;i+=4)if(o[i+1]){const dx=x+o[i+3]-(back?255-sx:sx),dy=y+o[i]+1-sy;assert.ok(dx>=0&&dx+8<=160);assert.ok(dy>=0&&dy+8<=144);}
  }
 }
});

test('effect target centers follow the resident enemy sampling, retreat and back-attack mirror',async()=>{
 const {data}=await input(),f=originalFormation(data,3);
 assert.equal(f.slots.filter(s=>s.monster!==null).length,8);
 for(const slot of f.slots){const [sx,sy]=slot.center,[x,y]=strikeAnchor(sx,sy),[bx,by]=strikeAnchor(sx,sy,true);
  // Independent inverse check through the renderer's source sampling.
  assert.ok(Math.abs((16+Math.floor((x+8+.5)*8/7))-sx)<=1);
  assert.ok(Math.abs((48+Math.floor((y-16+.5)*8/7))-sy)<=1);
  assert.ok(Math.abs((239-Math.floor((167-bx+.5)*8/7))-(255-sx))<=1);
  assert.equal(x+bx,159);assert.equal(y,by);
 }
});
