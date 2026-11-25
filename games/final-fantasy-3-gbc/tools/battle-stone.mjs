// Immutable source glyphs, not composed battle frames. Partial cells are
// rebuilt from resident terrain/enemy resources when a map owner changes.
import {check} from './source.mjs';import {offset} from './render-budget-source.mjs';
import {tailAssets} from './battle-entry-tail-source.mjs';
export const stoneTop=[0,4,6,10],stoneRows=[5,4,5,4];
export function stoneAssets(rom,p){const maps=tailAssets(rom).tables.find(t=>t.name==='maps').bytes,glyphs=Buffer.alloc(1920),remap=Buffer.alloc(16,255);
 for(let slot=0;slot<4;slot++)for(let kind=0;kind<3;kind++)for(let sy=0;sy<[32,24,32,24][slot];sy++)for(let x=0;x<16;x++){
  const t=maps[kind*32+slot*8+(sy>>3)*2+((x>>3)^(p.back?1:0))],bit=7-(x&7),at=t*16+(sy&7),v=(p.initialPpu[at]>>bit&1)|((p.initialPpu[at+8]>>bit&1)<<1),y=sy+[6,2,6,2][slot],to=(slot*3+kind)*160+((y>>3)*2+(x>>3))*16+(y&7)*2;
  glyphs[to]|=(v&1)<<bit;glyphs[to+1]|=(v>>1)<<bit;
 }
 for(let pal=0;pal<4;pal++)for(let v=0;v<4;v++)for(let j=0;j<4;j++)if(p.bgPalette.readUInt16LE(24+v*2)===p.bgPalette.readUInt16LE(pal*8+j*2)){remap[pal*4+v]=j;break;}
 return {glyphs,remap};
}
export function jobAssets(rom){return Buffer.concat([rom.subarray(offset(0x28,0x8000),offset(0x28,0x8000)+22*672),rom.subarray(offset(0x29,0xbf80),offset(0x29,0xbf80)+128),rom.subarray(offset(0x29,0xbf00),offset(0x29,0xbf00)+128)]);}
export function stoneChange(state,actor,work,back){check(actor>=0&&actor<4&&work[0]===3&&work[1]<=3&&!work[3]&&!work[7]&&work[4]===(actor&1?6:8)&&work[2]===(work[1]===3?0:actor*8),'Stone map descriptor');
 const col=(work.readUInt16LE(5)&31)-(back?2:10);check((back?[0,2,6]:[16,18,12]).includes(col),'Stone canonical columns');check(!state[actor]||state[actor].kind===3||state[actor].x===col,'Stone relocation requires source clear');state[actor]={kind:work[1],x:col};return state;
}
export function stoneCompose(state,a,baseCell,page,oam=Buffer.alloc(160),enemyPatterns=Buffer.alloc(0)){const keys=[],base=(a.base??150)+page*(a.span??48);
 for(let slot=0;slot<4;slot++){const d=state[slot];if(!d||d.kind===3)continue;
  for(let y=0;y<stoneRows[slot];y++)for(let x=0;x<2;x++){const glyph=a.glyphs.subarray((slot*3+d.kind)*160+(y*2+x)*16,(slot*3+d.kind)*160+(y*2+x+1)*16);if(!glyph.some(Boolean))continue;const key=(stoneTop[slot]+y)*32+d.x+x;if(!keys.includes(key))keys.push(key);}
 }
 check(keys.length<=40,'Stone cell capacity');const cells=[],residual=[],patterns=[];
 for(const key of keys){const x=key&31,y=key>>5,b=baseCell(x,y),out=Buffer.from(b.tile),extra=Buffer.alloc(16);let pal=b.attr&3;if(!out.some(Boolean))pal=3;
  for(let slot=0;slot<4;slot++){const d=state[slot];if(!d||d.kind===3||x<d.x||x>=d.x+2||y<stoneTop[slot]||y>=stoneTop[slot]+stoneRows[slot])continue;
   const glyph=a.glyphs.subarray((slot*3+d.kind)*160+((y-stoneTop[slot])*2+x-d.x)*16);
   for(let row=0;row<8;row++)for(let bit=0;bit<8;bit++){const v=(glyph[row*2]>>bit&1)|((glyph[row*2+1]>>bit&1)<<1);if(!v)continue;const mapped=a.remap[pal*4+v],mask=~(1<<bit);extra[row*2]&=mask;extra[row*2+1]&=mask;
    if(mapped===255){extra[row*2]|=(v&1)<<bit;extra[row*2+1]|=(v>>1)<<bit;}else {out[row*2]=(out[row*2]&mask)|((mapped&1)<<bit);out[row*2+1]=(out[row*2+1]&mask)|((mapped>>1)<<bit);}
   }
  }
  cells.push({key,tile:base+patterns.length,attr:8+pal});patterns.push(out);if(extra.some(Boolean))residual.push({x:x*8,y:y*8,bits:extra});
 }
 for(const r of residual){r.tile=base+patterns.length;r.attr=15;patterns.push(r.bits);}
 const masked=[];
 // Enemy color-boundary OBJ must not cover the new BG owner, even when
 // the stone color can be represented directly by the enemy BG palette.
 for(let i=0;i<40;i++){const at=i*4,x=oam[at+1]-8,y=oam[at]-16,id=oam[at+2],attr=oam[at+3];if(!oam[at]||!(attr&8)||id>=(a.base??150))continue;
  check(!(attr&96)&&x%8===0&&y%8===0,'Stone enemy residual grid');const original=enemyPatterns.subarray(id*16,id*16+16),bits=Buffer.from(original);
  for(let slot=0;slot<4;slot++){const d=state[slot],tx=x/8,ty=y/8;if(!d||d.kind===3||tx<d.x||tx>=d.x+2||ty<stoneTop[slot]||ty>=stoneTop[slot]+stoneRows[slot])continue;
   const glyph=a.glyphs.subarray((slot*3+d.kind)*160+((ty-stoneTop[slot])*2+tx-d.x)*16);for(let row=0;row<16;row+=2){const mask=~(glyph[row]|glyph[row+1]);bits[row]&=mask;bits[row+1]&=mask;}
  }
  if(!bits.equals(original)){masked.push({x,y,tile:base+patterns.length});patterns.push(bits);}
 }
 check(patterns.length<=(a.span??48)&&residual.length<=24&&masked.length<=16,'Stone page/OBJ capacity');return {base,cells,residual,masked,patterns:Buffer.concat(patterns)};
}
export function stoneMap(bg,ground,c,page){const map=Buffer.alloc(896);
 for(let y=0;y<14;y++)for(let x=0;x<32;x++){
  const at=y*32+x;if(y<2){if(x<20){map[at]=ground.map[y*20+x]+bg.stats.tiles+page*10;map[448+at]=ground.attributes[y*20+x];}}
  else if(y<13){map[at]=bg.maps[(y-2)*56+x];map[448+at]=bg.maps[616+(y-2)*56+x];}
 }
 for(const cell of c.cells){map[cell.key]=cell.tile;map[448+cell.key]=cell.attr;}return map;
}

export function stoneOam(source,c){const o=Buffer.alloc(160);let count=0;
 for(let i=0;i<40;i++){const at=i*4;if(!source[at]||(!(source[at+3]&8)&&source[at+2]===0))continue;const item=Buffer.from(source.subarray(at,at+4)),mask=c.masked.find(m=>m.x+8===item[1]&&m.y+16===item[0]&&(item[3]&8));if(mask)item[2]=mask.tile;item.copy(o,count++*4);}
 check(count+c.residual.length<=40,'Stone combined OAM');for(const r of c.residual)o.set([r.y+16,r.x+8,r.tile,r.attr],count++*4);return o;
}
