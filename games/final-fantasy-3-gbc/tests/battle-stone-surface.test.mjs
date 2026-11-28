import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {liveUiAssets} from '../tools/battle-live-ui.mjs';
import {paintCell,stoneSurfaces,stoneSurfaceContract,stonePaintExamples} from '../tools/battle-stone-surface.mjs';
let fixture;async function assets(){if(!fixture)fixture=(async()=>{const {data,local}=await input();return {s:stoneSurfaces(data),ui:await liveUiAssets(data,local.text)};})();return fixture;}
test('source stone shares the actual UI palette and keeps all feet above every live window',async()=>{
 const {s,ui}=await assets(),r=stoneSurfaceContract(s,ui);assert.equal(r.additionalPalettes,0);assert.equal(r.sourceInkCells,368);assert.equal(r.boundaries.length,24);
 assert.deepEqual(r.boundaries.filter(x=>x.foot).map(x=>x.foot),[25,9,10,25,9,10]);assert.equal(r.footerCases,18*r.views);
 assert.deepEqual(r.patterns.map(x=>x.unique),[40,40]);assert.equal(r.bank0.fitsImmutableStone,false);
});
test('palette changes, a shifted frame and content in either padding row fail before linking',async()=>{
 const {s,ui}=await assets(),palette=Buffer.from(ui.palette);palette[2]^=1;assert.throws(()=>stoneSurfaceContract(s,{...ui,palette}),/palette bytes/);
 const rect=Buffer.from(ui.rect);rect[1]=1;assert.throws(()=>stoneSurfaceContract(s,{...ui,rect}),/frame must/);
 for(const row of [0,1]){const initial=Buffer.from(ui.initial);initial[row*160+159]=1;assert.throws(()=>stoneSurfaceContract(s,{...ui,initial}),/first two rows/);}
});
test('same-palette source-owned black clears dots while unowned pixels survive',()=>{
 const old=Buffer.alloc(16,255),source=Buffer.alloc(16),mask=Buffer.alloc(8,0xf0),r=paintCell(old,source,mask);
 assert.equal(r.result,2);assert.ok(r.glyph.every(v=>v===15));assert.equal(paintCell(old,source,Buffer.alloc(8)).result,0);
 assert.equal(paintCell(old,source,Buffer.alloc(8,255)).result,1);assert.throws(()=>paintCell(old,source,mask.subarray(1)),/ABI/);
});
test('native fixtures contain every distinct original stone glyph with overlay and replacement ownership',async()=>{
 const {s}=await assets(),rows=stonePaintExamples(s);assert.equal(rows.length,160);assert.ok(rows.every(r=>r.result===0||r.result===2));assert.ok(rows.some(r=>r.result===0));
 for(let i=0;i<rows.length;i+=2){assert.deepEqual(rows[i+1].glyph,rows[i].source);assert.notDeepEqual(rows[i].glyph,rows[i+1].glyph);}
});
