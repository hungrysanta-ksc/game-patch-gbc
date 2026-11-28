// Full current encounter catalog, not a success inferred from one screenshot.
import fs from 'node:fs/promises';
import {ROOT,input,check,hash} from './source.mjs';
import {partyEntryOracle} from './battle-party-oam-source.mjs';
import {residentEnemy} from './battle-resident-bg.mjs';
import {stoneSurfaces,paintCell} from './battle-stone-surface.mjs';
import {stoneTop} from './battle-stone.mjs';
const {data}=await input(),catalog=JSON.parse(await fs.readFile(ROOT+'/build/scene-dungeon/encounter-resources.json')),surfaces=stoneSurfaces(data);
let placements=0,bodyCells=0,maxJoinedCells=0,combinations=0;
for(const p of catalog.profiles){const [formation,...k]=p.key,back=!!k[4],a=surfaces[+back],source=partyEntryOracle(data,{formation,counts:k.slice(0,4),back,terrain:8}),enemy=residentEnemy({...source,enemyYOffsets:formation===0?[-4,-6]:undefined});
 for(let actor=0;actor<4;actor++)for(let kind=0;kind<3;kind++)for(let row=0;row<2;row++){
  placements++;const col=(back?0:16)+row*2;
  for(let cell=0;cell<10;cell++){const y=stoneTop[actor]+(cell>>1),glyph=a.glyphs.subarray((actor*3+kind)*160+cell*16,(actor*3+kind)*160+cell*16+16);if(y<2||y>=13||!glyph.some(Boolean))continue;
   check(enemy.maps[(y-2)*56+col+(cell&1)]===0,'Current normal-row stone/enemy map collision '+p.profile);bodyCells++;
  }
 }
}
// Every normal/rear/clear/kind combination, in each facing. A shared cell
// may contain two actors only; this is the native immutable-ID join ABI.
for(const a of surfaces)for(let variant=0;variant<4096;variant++){
 const cells=new Map();let joined=0;
 for(let actor=0;actor<4;actor++){const choice=variant>>(actor*3)&7,kind=choice&3,col=(a.back?0:16)+(choice>>2)*2;if(kind===3)continue;
  for(let cell=0;cell<10;cell++){const y=stoneTop[actor]+(cell>>1),g=a.glyphs.subarray((actor*3+kind)*160+cell*16,(actor*3+kind)*160+cell*16+16);if(y<2||y>=13||!g.some(Boolean))continue;
   const key=y*32+col+(cell&1),old=cells.get(key);if(old){check(old.owners===1,'Third stone cell owner');const mask=Buffer.from(Array.from({length:8},(_,i)=>g[i*2]|g[i*2+1])),paint=paintCell(old.glyph,g,mask);cells.set(key,{owners:2,glyph:paint.glyph});joined++;}else cells.set(key,{owners:1,glyph:g});
  }
 }maxJoinedCells=Math.max(maxJoinedCells,joined);combinations++;
}
const report={sourceSha256:hash(data),profiles:catalog.profiles.length,placements,bodyCells,combinations,maxJoinedCells,scope:'Source/catalog normal and rear row placement and adjacent-stone join bound. No confused enemy-cell blend, no worst-case numeral OAM or native back-attack claim.'};
await fs.mkdir(ROOT+'/evidence/live-stone',{recursive:true});await fs.writeFile(ROOT+'/evidence/live-stone/catalog.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
