// Private representative glyph inputs from actual death ownership and the
// source wipe cursor. Fixtures exercise the native allocator, never gameplay.
import {deathOwnership,deathCells,deathStamps} from './battle-death-resources.mjs';
import {sourceDeath} from './battle-command-source.mjs';
import {check} from './source.mjs';
export function cellPoolExamples(rom){const examples=[];
 for(const back of [false,true]){
  const a=deathOwnership(rom,{formation:3,back}),cells=deathCells(a),stamps=deathStamps(back,a.glyphs),frames=sourceDeath(rom,back).trace.filter((_,i)=>!(i&1)).slice(0,37);let best;
  for(const frame of frames){const glyphs=[];
   for(const cell of cells){const erase=Buffer.alloc(8);
    for(const p of cell.parts)for(let y=0;y<8;y++)if(p.bits[y])erase[y]|=p.bits[y]&~stamps[(frame[65+((p.sy[y]-48)>>3)]*8+(p.sy[y]&7))*20+cell.x];
    for(const id of [cell.tile,cell.object?.tile].filter(Boolean)){const old=a.base.patterns.subarray(id*16,id*16+16),g=Buffer.from(old);
     for(let y=0;y<8;y++){g[y*2]&=~erase[y];g[y*2+1]&=~erase[y];}if(!g.equals(old)&&g.some(Boolean))glyphs.push(g);
    }
   }
   const unique=[];const ids=glyphs.map(g=>{let i=unique.findIndex(u=>u.equals(g));if(i<0){i=unique.length;unique.push(g);}return i;});
   const saved=glyphs.length-unique.length;if(!best||saved>best.saved)best={back,frame:frame[79],glyphs,ids,unique:unique.length,saved};
  }
  check(best.saved>0&&best.glyphs.length<=54,'Original multi-owner sharing witness');examples.push(best);
 }return examples;
}
