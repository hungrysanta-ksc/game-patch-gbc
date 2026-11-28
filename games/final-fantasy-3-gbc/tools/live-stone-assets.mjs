import fs from 'node:fs/promises';
import {check} from './source.mjs';
import {stoneSurfaces} from './battle-stone-surface.mjs';
export async function liveStoneAssets(rom,gen){
 const surfaces=stoneSurfaces(rom),ids=[],patterns=[];
 for(const s of surfaces){check(s.unique.length===40,'Stone signed reservation');patterns.push(Buffer.concat(s.unique));
  for(let i=0;i<120;i++){const g=s.glyphs.subarray(i*16,i*16+16);ids.push(g.some(Boolean)?s.unique.findIndex(t=>t.equals(g)):255);}
 }
 const values={patterns:Buffer.concat(patterns),ids:Buffer.from(ids),glyphs:Buffer.concat(surfaces.map(s=>s.glyphs))};
 await fs.writeFile(gen+'/live-stone-assets.h','#include <stdint.h>\n'+Object.keys(values).map(k=>'extern const uint8_t live_stone_'+k+'[];').join('\n')+'\n');
 const file=gen+'/live-stone127.c';await fs.writeFile(file,'#pragma bank 127\n#include <stdint.h>\n'+Object.entries(values).map(([k,b])=>'const uint8_t live_stone_'+k+'[]={'+[...b]+'};').join('\n')+'\n');return file;
}
