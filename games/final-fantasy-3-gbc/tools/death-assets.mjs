import fs from 'node:fs/promises';
import {check} from './source.mjs';
import {deathOwnership,deathCells,deathBounds,deathStamps,deathCapacity} from './battle-death-resources.mjs';
import {sourceDeath} from './battle-command-source.mjs';
export async function deathAssets(rom,gen,profiles){
 const generated=[],rows=[],decl=[],proof=[],banks=[],traces=[false,true].map(back=>sourceDeath(rom,back).trace.filter((_,i)=>!(i&1)).slice(0,37));let common;
 for(const p of profiles){
  const [formation,...key]=p.key,back=!!key[4],a=deathOwnership(rom,{formation,counts:key.slice(0,4),back}),cells=deathCells(a);
  // Same source normal patterns as the combined loader (flash appends only).
  const source=await fs.readFile(gen+'/encounter'+p.profile+'.c','utf8'),pattern=Buffer.from(source.match(/encounter_patterns\d+\[\]=\{([0-9,]+)\}/)[1].split(',').map(Number));
  check(pattern.subarray(0,a.base.patterns.length).equals(a.base.patterns),'Death/entry pattern identity');
  const pool=pattern.length/16+20,half=Math.floor((256-pool)/2),capacity=deathCapacity(a,traces[+back]);
  check(Math.max(capacity.peak,capacity.flashBound)<=half,'Double-buffered death pool capacity '+p.profile);
  const bytes=Buffer.concat(cells.map(c=>{const b=Buffer.alloc(40);b.set([c.x,c.y,c.tile,c.attr,c.object?.tile??0,c.object?.attr??12]);c.parts.forEach((p,i)=>{b[6+i*17]=p.owner;b.set(p.sy,7+i*17);b.set(p.bits,15+i*17);});return b;}));
  const bounds=deathBounds(a);
  const name='death_cells'+p.profile,size=bytes.length+bounds.length;check(size<=16384,'Death ROM bank capacity');
  if(!banks.length||banks.at(-1).bytes+size>16384)banks.push({bank:172+banks.length,bytes:0,lines:[]});
  const packed=banks.at(-1),bank=packed.bank;check(bank<256,'Death bank range');packed.bytes+=size;
  packed.lines.push('const uint8_t '+name+'[]={'+[...bytes]+'};\nconst uint8_t death_bounds'+p.profile+'[]={'+[...bounds]+'};');
  decl.push('extern const uint8_t '+name+'[],death_bounds'+p.profile+'[];');rows.push('{'+[name,'death_bounds'+p.profile,bank,cells.length,pool,half,+back]+'}');
  const stamps=Buffer.concat([deathStamps(false,a.glyphs),deathStamps(true,a.glyphs)]);if(common)check(common.equals(stamps),'Shared source death mask glyphs');else common=stamps;
  proof.push({profile:p.profile,key:p.key,bank,bytes:size,pool,half,ownershipSha256:a.sha256,...capacity});
 }
 for(const b of banks){const path=gen+'/death-bank'+b.bank+'.c';await fs.writeFile(path,'#pragma bank '+b.bank+'\n#include <stdint.h>\n'+b.lines.join('\n')+'\n');generated.push(path);}
 const path=gen+'/death-stamps.c';await fs.writeFile(path,'#pragma bank 123\n#include <stdint.h>\nconst uint8_t death_stamps[]={'+[...common]+'};\n');generated.push(path);
 await fs.writeFile(gen+'/death-assets.h','#include <stdint.h>\n#define DEATH_PROFILES '+profiles.length+'\nextern const uint8_t death_stamps[];\n'+decl.join('\n')+'\ntypedef struct {const uint8_t*cells,*bounds;uint8_t bank,count,pool,half,back;} DeathAsset;\nstatic const DeathAsset death_assets[]={'+rows.join(',')+'};\n');
 await fs.writeFile(gen+'/../death-resources.json',JSON.stringify({source:'2F/B33E,BB0A..BDB9; 33/BF1E resource 13; no timed frame assets',profiles:proof},null,2));return generated;
}
