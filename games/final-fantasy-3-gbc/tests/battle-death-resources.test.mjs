import test from 'node:test';
import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {deathOwnership,deathPictures,deathCells,deathBounds,deathMayChange,deathStamps,deathPixelVisible,deathSourceVisible,sourceCoordinate,deathCapacity} from '../tools/battle-death-resources.mjs';
import {sourceDeath} from '../tools/battle-command-source.mjs';

test('slot ownership survives deduplicated identical enemies and mixed 28px boundary cells',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const a=deathOwnership(data,{formation:0,counts:[4,0,0,0],back}),cells=deathCells(a);
  assert.ok(cells.some(c=>c.parts.length===2));assert.equal(new Set(a.owner.filter(Boolean)).size,4);
  assert.ok(a.base.patterns.length/16<cells.length,'Same tile is shared across distinct slot owners');
 }
});

test('absent slots in the original death mask are not physical cell owners',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const a=deathOwnership(data,{formation:0,counts:[3,0,0,0],back}),cells=deathCells(a);
  const present=cells.reduce((bits,c)=>c.parts.reduce((v,p)=>v|p.owner,bits),0);
  const absent=a.types.reduce((v,t,i)=>v|(t===255?128>>i:0),0),victim=128;
  assert.ok(absent&&((absent|victim)&((absent|victim)-1)));
  assert.equal((absent|victim)&present,victim);
  assert.equal(present,224);assert.equal((present&192)&((present&192)-1),128);
 }
});

test('all 37 native mask positions match actual original DMA/PPU publications in both directions',async()=>{
 const {data}=await input();for(const formation of [0,3])for(const back of [false,true]){
  const options={formation,back,...(formation===0?{counts:[4,0,0,0]}:{})},a=deathOwnership(data,options),stamps=deathStamps(back,a.glyphs),bounds=deathBounds(a);
  for(const mask of [128,64,170,255]){
   const r=deathPictures(data,options,mask);
   const reuse=r.frames.map((f,i)=>!deathMayChange(bounds,back,f.x,r.frames[i?i-1:0].x,mask,!i));
   for(const f of r.frames)for(let y=0;y<88;y++)for(let x=0;x<160;x++){
    const at=y*160+x;if(!a.owner[at])continue;const [sx]=sourceCoordinate(a.p,x,0),sy=a.sourceY[at],cursor=f.x[(sy-48)>>3];
    const model=!(a.owner[at]&mask)||deathPixelVisible(back,cursor,a.glyphs,sx,sy);
    assert.equal(model,deathSourceVisible(f,sx,sy),JSON.stringify({formation,back,mask,frame:f.frame,x,y}));
    const previous=r.frames[f.frame?f.frame-1:0];
    if(reuse[f.frame])assert.equal(model,f.frame?deathSourceVisible(previous,sx,sy):true,'Reuse only an identical visible picture');
    if(f.frame===36&&(a.owner[at]&mask))assert.equal(model,false,'Last source picture is the settled removed surface');
    if(a.owner[at]&mask)assert.equal(!!(stamps[(cursor*8+(sy&7))*20+(x>>3)]&(128>>(x&7))),model);
   }
  }
 }
});

test('eight-enemy COW capacity covers every alive/removed/wiping assignment with two independent pages',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const a=deathOwnership(data,{formation:3,back}),frames=sourceDeath(data,back).trace.filter((_,i)=>!(i&1)).slice(0,37),r=deathCapacity(a,frames);
  assert.equal(r.combinations,6561);assert.equal(r.pictures,37);assert.equal(r.peak,39);assert.ok(Math.max(r.peak,r.flashBound)*2<=85);
 }
});
