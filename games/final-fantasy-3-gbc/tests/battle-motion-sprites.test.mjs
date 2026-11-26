import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {motionSpriteAssets,motionSpriteReference,motionRngTable,motionRngVariants,motionImpactReference} from '../tools/battle-motion-sprites.mjs';
import {strikeAnchor,strikeSliceAnchor,strikeImpactAnchor} from '../tools/battle-strike-assets.mjs';
import {originalFormation} from '../tools/battle-placement-source.mjs';
import {battleCpu} from '../tools/battle-placement-source.mjs';
import {offset} from '../tools/render-budget-source.mjs';

test('original hit dispatch preserves the claw table overread rather than imposing an unarmed cap',async()=>{
 const {data}=await input(),caps=data.subarray(offset(0x33,0xa077),offset(0x33,0xa081)),c=battleCpu(data,0x19),step=c.step.bind(c);
 assert.deepEqual([...caps],[7,5,5,7,5,7,7,7,7,242]);
 c.step=function(){if(this.pc===0xa0bd){this.pc=((this.pop()|(this.pop()<<8))+1)&65535;return;}step();};
 for(const kind of [0,1,2,4,9])for(let n=0;n<256;n++)for(const hand of [0,1]){c.m[0xcd]=hand;c.m[0xbb+hand]=n;c.a=kind;c.call(0xa094);assert.equal(c.m[0xbb+hand],Math.min(n,caps[kind]-1));}
});

test('all original RNG seeds select one of two immutable tables without changing counter wrap',async()=>{
 const {data}=await input(),r=motionRngVariants(data);
 assert.equal(r.source.sha256,'d1751ab6c928dcc5bf552a560440507f7ab279961a89de2bb81fe0d5de71707c');
 assert.equal(r.tables.length,512);
 for(let seed=0;seed<256;seed++)assert.deepEqual(motionRngTable(data,seed),r.tables.subarray((seed&2)*128,(seed&2)*128+256));
});

test('full-range original RNG returns every table byte, and impacts hold the point on odd frames',async()=>{
 const {data}=await input(),c=battleCpu(data,0x19);
 for(let v=0;v<256;v++){c.m[0x21]=0;c.m[0x15]=255;c.m[0x7be3+255]=v;c.x=0;c.a=255;c.call(0xfbef);assert.equal(c.a,v);assert.equal(c.m[0x15],0);}
 for(const seed of [0,2]){const table=motionRngTable(data,seed),a=motionImpactReference(data,{frame:4,table,index:255}),b=motionImpactReference(data,{frame:5,table,index:a.counters[0],point:[...a.point]});assert.deepEqual(a.oam,b.oam);assert.deepEqual(a.counters,b.counters);assert.deepEqual([...a.counters],[1,23,197]);}
});

test('staff and claw impacts fit the complete RNG domain at every resident target without clipping glyphs',async()=>{
 const {data}=await input(),f=originalFormation(data,3);
 for(const back of [0,1])for(const slot of f.slots){const [sx,sy]=slot.center,[gx,gy]=strikeImpactAnchor(sx,sy,back);
  for(const hand of [0,1,2,3]){const o=motionSpriteReference(data,{frame:16+hand,x:sx,y:sy,back});for(let rx=0;rx<32;rx++)for(let ry=0;ry<32;ry++){
   // Shape/offset bytes are obtained from the actual metasprite consumer;
   // translating its pivot is linear over this non-wrapping target domain.
   for(let i=0;i<16;i+=4)if(o[i+1]){const x=gx+(back?-1:1)*Math.floor(rx*7/8)+o[i+3]-(back?255-sx:sx),y=gy+Math.floor(ry*7/8)+o[i]-sy+1;assert.ok(x>=0&&x+8<=160);assert.ok(y>=0&&y+8<=144);}
  }}
 }
});

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
