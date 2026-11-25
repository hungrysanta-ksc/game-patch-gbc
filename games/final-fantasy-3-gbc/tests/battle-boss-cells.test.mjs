import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {bossCells,bossLogicalFrame,bossTile} from '../tools/battle-boss-cells.mjs';
import {bossFormations,tailReference} from '../tools/battle-entry-tail-source.mjs';
import {partyEntryOracle} from '../tools/battle-party-oam-source.mjs';
import {normalizeBoss} from '../tools/boss-pattern-map.mjs';
test('live boss audit rejects damaged pixels, menu tile ownership and aliased cells',()=>{
 const map=Buffer.alloc(704),actual=Buffer.alloc(704),logical=Buffer.alloc(48),patterns=Buffer.alloc(4096);map.fill(8,352);actual.fill(8,352);
 map[0]=1;map[1]=2;actual[0]=21;actual[1]=22;logical[16]=logical[32]=128;patterns[21*16]=patterns[22*16]=128;
 const e={map:map.toString('hex'),patterns:logical.toString('hex')},capture=()=>({bossMap:actual.toString('hex'),bossPatterns:patterns.toString('hex'),oam:'00000000'});
 assert.equal(normalizeBoss(capture(),e,'00000000').map,e.map);
 patterns[21*16]^=1;assert.throws(()=>normalizeBoss(capture(),e,'00000000'),/pattern/);patterns[21*16]^=1;
 actual[0]=20;patterns[20*16]=128;assert.throws(()=>normalizeBoss(capture(),e,'00000000'),/pattern/);
 actual[0]=22;assert.throws(()=>normalizeBoss(capture(),e,'00000000'),/alias/);
 actual[0]=21;actual[352]=11;assert.throws(()=>normalizeBoss(capture(),e,'00000000'),/palette/);
});
test('all registered bosses retain every shifted NES pixel with bounded resident cells',async()=>{
 const {data}=await input();let profiles=0,steps=0,maxCells=0,maxResiduals=0,maxChanged=0;
 for(const r of bossFormations(data))for(const back of [false,true]){
  const options={formation:r.formation,back},p=partyEntryOracle(data,options),tail=tailReference(data,options);p.tailSeed=tail.seed;
  const a=bossCells(data,p),state=new Map();let shift=7;
  assert.equal(a.graphic,r.graphic);assert.equal(a.raw.length,a.chunks*64);
  assert.ok(a.cells.length+a.residuals+Math.max(...a.deps.map(ids=>ids.reduce((n,id)=>n+1+(a.cells[id].extra!==255),0)))<=235);
  for(const f of tail.frames){if(f.work?.[0]!==1)continue;
   const chunk=f.work.readUInt16LE(2)>>6,pic=bossLogicalFrame(a,state,chunk,shift),ppu=f.published.ppu;
   // Independent oracle reads actual 6502-produced CHR/nametable bytes.
   // It never uses the compiler bindings or the shifted source formula.
   for(const c of a.cells)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const dx=c.x*8+x,dy=(c.y-2)*8+y;let expected=0;
    if(dy<84&&(back?dx>=42:dx<118)){
     const sx=back?239-Math.floor((167-dx+.5)*8/7):16+Math.floor((dx+8+.5)*8/7),sy=48+Math.floor((dy+.5)*8/7),tx=sx>>3,ty=sy>>3,t=ppu[0x2000+ty*32+tx],attr=ppu[0x23c0+(ty>>2)*8+(tx>>2)],pal=attr>>(((ty&2)<<1)+(tx&2))&3,at=t*16+(sy&7),v=(ppu[at]>>(7-(sx&7))&1)|((ppu[at+8]>>(7-(sx&7))&1)<<1);
     expected=p.bgPalette.readUInt16LE((pal*4+v)*2);
    }
    const color=(id,pal)=>{const at=id*16+y*2,v=(pic.patterns[at]>>(7-x)&1)|((pic.patterns[at+1]>>(7-x)&1)<<1);return {v,color:pic.palette.readUInt16LE((pal*4+v)*2)};};
    let actual=color(c.id+1,c.palette).color;if(c.extra!==255){const v=color(1+a.cells.length+c.extra,c.residual);if(v.v)actual=v.color;}
    assert.equal(actual,expected,`boss ${r.graphic} back ${back} block ${chunk} shift ${shift} ${dx}/${dy}`);
   }
   shift=(shift+7)&7;steps++;
  }
  assert.equal(shift,7);assert.throws(()=>bossTile(a,0,a.chunks,0),/bounds/);
  maxCells=Math.max(maxCells,a.cells.length);maxResiduals=Math.max(maxResiduals,a.residuals);maxChanged=Math.max(maxChanged,...a.deps.map(x=>x.length));profiles++;
 }
 assert.deepEqual({profiles,steps,maxCells,maxResiduals,maxChanged},{profiles:40,steps:4720,maxCells:128,maxResiduals:8,maxChanged:14});
});
