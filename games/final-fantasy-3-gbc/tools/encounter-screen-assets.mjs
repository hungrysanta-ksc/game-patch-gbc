// 3D/BD4D chooses a formation; 2F/A02A,A0C8,9FAA then derive the
// counts/layout. Compile spatial resources for every count in the current
// field's complete group, never an entry/action movie or a fallback picture.
import fs from 'node:fs/promises';
import {check,hash} from './source.mjs';
import {battleCpu,originalFormation} from './battle-placement-source.mjs';
import {segment} from './state-source.mjs';
import {statusVideoOracle} from './battle-status-video.mjs';
import {residentEnemy} from './battle-resident-bg.mjs';
import {hitFlashAssets} from './battle-hit-assets.mjs';
import {terrainAssets} from './battle-terrain.mjs';
import {strikeAssets} from './battle-strike-assets.mjs';
import {effectsAssets} from './battle-effects-assets.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
const at=(b,c)=>16+b*8192+(c&8191);
export async function encounterScreenAssets(rom,gen,battle,{map=29}={}){
 const world=0,group=rom[at(0x2e,0x92f0)+map],background=rom[at(0x39,0xbc00)+map];
 check([0,8].includes(background),'Registered terrain consumer');
 const formations=[...new Set(rom.subarray(at(0x2e,0x94f0)+group*8,at(0x2e,0x94f0)+group*8+8))],profiles=[],keys=[],bounds=[];
 for(const formation of formations){const c=battleCpu(rom);c.m[0x7ced]=formation;segment(c,0xa02a,0xa0b7);const ranges=[...c.m.subarray(0x7d6f,0x7d73)],ids=[...c.m.subarray(0x7d6b,0x7d6f)];bounds.push([formation,...ranges,c.m[0x7d68]>>6,...ids,...ids.map(id=>id===255?0:rom[at(0x30,0x8000)+id*16])]);
  const visit=counts=>{if(counts.length<4){const r=ranges[counts.length];for(let n=r>>4;n<=(r&15);n++)visit([...counts,n]);return;}
   const f=originalFormation(rom,formation,{counts});check(!f.unresolved&&f.layout!==9,'Registered source placement');
   for(const back of [false,true]){keys.push([formation,...counts,+back]);profiles.push(statusVideoOracle(rom,{formation,counts,back,terrain:background,partyStatus:[0,0,0,0]}));}
  };visit([]);
 }
 const generated=[],descriptors=new Map(),decl=[],proof=[];
 const add=(file,type,row)=>{if(!descriptors.has(file))descriptors.set(file,{type,rows:[]});descriptors.get(file).rows.push(row);};
 for(const [j,p]of profiles.entries()){
  const bank=128+j,i=4+j,base=p.back?2:0,ground=terrainAssets(p);
  const shared=await fs.readFile(battle+'/generated/party'+base+'.c','utf8');
  for(const [name,bytes]of [['tiles',nativePartyTiles(p.chr)],['palette',p.pal],['blocks',p.commandBlocks],['command_palette',p.commandPalette]]){
   const match=shared.match(new RegExp('const uint8_t party_'+name+base+'\\[\\]=\\{([0-9,]*)\\}'));
   check(match&&Buffer.from(match[1].split(',').map(Number)).equals(bytes),'Exact shared party resource '+i+'/'+name);
  }
  if(p.formation===0)p.enemyYOffsets=[-4,-6];
  const bg=residentEnemy(p),hit=hitFlashAssets(rom,p,bg);
  check(bg.patterns.length<=3776&&bg.objects.length<=8,'Joint enemy/party/status capacity '+i+' '+JSON.stringify(bg.stats));
  bg.patterns=Buffer.concat([bg.patterns,Buffer.alloc(Math.max(0,2048-bg.patterns.length))]);bg.stats.tiles=bg.patterns.length/16;
  // ROM DMA requires a 16-byte source boundary. Patterns lead their bank;
  // variable-length seeds and byte-copy resources follow, never precede them.
  const values={patterns:bg.patterns,seed:p.seed,input:p.initial,tail:p.tailSeed,status:p.statusSeed,maps:bg.maps,objects:bg.residual,palette:bg.palette,...Object.fromEntries(Object.entries(ground).filter(([k])=>['map','attributes','bindings','luts','spans','source'].includes(k)).map(([k,v])=>['terrain_'+k,v])),...Object.fromEntries(Object.entries(hit).map(([k,v])=>['hit_'+k,v]))};
  const size=Object.values(values).reduce((n,b)=>n+Math.max(1,b.length),0);check(size<=16384&&bank<256,'Encounter ROM bank capacity');
  const name=k=>'encounter_'+k+i;for(const k of Object.keys(values))decl.push('extern const uint8_t '+name(k)+'[];');
  const file=gen+'/encounter'+i+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\n'+Object.entries(values).map(([k,b])=>'const uint8_t '+name(k)+'[]={'+[...(b.length?b:Buffer.from([0]))]+'};').join('\n'));generated.push(file);
  add('party-video-assets.h','PartyVideoAsset','{'+[name('seed'),name('input'),'party_tiles'+base,'party_palette'+base,bank]+'}');
  // Tiles and palettes retain their own shared bank (17/19), handled by the
  // live loader. These descriptor pointers are never read using the seed bank.
  add('status-video-assets.h','StatusVideoAsset','{'+[name('tail'),name('status'),'party_blocks'+base,'party_command_palette'+base,p.commandBlocks.length,bank,0]+'}');
  add('resident-bg-assets.h','ResidentBgAsset','{'+['patterns','maps','objects','palette'].map(name)+','+[bg.patterns.length,bg.objects.length,bank]+'}');
  add('terrain-assets.h','TerrainAsset','{'+['map','attributes','bindings','luts','spans','source'].map(k=>name('terrain_'+k))+','+[bg.stats.tiles,bank]+'}');
  add('hit-assets.h','HitFlashAsset','{'+['maps','objects','attributes','normal'].map(k=>name('hit_'+k))+','+bank+'}');
  proof.push({profile:i,key:keys[j],bank,bytes:size,types:[...p.tailSeed.subarray(51,59)],layout:p.tailSeed[64],enemyYOffsets:p.enemyYOffsets??[0,0],residualObjects:bg.objects.length,seed:p.seed.toString('hex'),input:p.initial.toString('hex'),tail:p.tailSeed.toString('hex'),status:p.statusSeed.toString('hex'),patternsSha256:hash(bg.patterns),mapsSha256:hash(bg.maps)});
 }
 for(const [file,{type,rows}]of descriptors){let s=await fs.readFile(gen+'/'+file,'utf8');s=s.replace(/(#define \w+_PROFILES )4\b/,'$1'+(4+profiles.length));s=s.replace('static const '+type,decl.join('\n')+'\nstatic const '+type);s=s.replace(/(static const [^=]+\[\]=\{)(.*)(\};)/,(_,a,b,c)=>a+b+','+rows.join(',')+c);await fs.writeFile(gen+'/'+file,s);}
 const strikes=strikeAssets(rom,profiles),effects=effectsAssets(rom,profiles);
 for(const [j,p]of profiles.entries())if(p.enemyYOffsets)for(let slot=0;slot<8;slot++){
  const dy=p.enemyYOffsets[slot&1];
  for(const [name,min,max]of [['centers',15,111],['impact_centers',15,116],['arrow_centers',14,117]]){const at=j*32+slot*4+3;strikes[name][at]=Math.max(min,Math.min(max,strikes[name][at]+dy));}
  effects.values.anchors[j*16+slot*2+1]+=dy;
 }
 for(const [file,prefix,values,names]of [['strike54','strike',strikes,['centers','impact_centers','arrow_centers','angles']],['effects','effect',effects.values,['seeds','anchors']]]){
  let s=await fs.readFile(battle+'/generated/'+file+'.c','utf8');for(const n of names)s=s.replace(new RegExp('(const uint8_t '+prefix+'_'+n+'\\[\\]=\\{)([0-9,]*)(\\};)'),(_,a,b,c)=>a+b+','+[...values[n]]+c);const path=gen+'/'+file+'.c';await fs.writeFile(path,s);generated.push(path);
 }
 const keyRows=keys.map((k,j)=>'{'+[...k,4+j]+'}').join(',');
 await fs.writeFile(gen+'/encounter-screen-assets.h','#include <stdint.h>\n#define ENCOUNTER_BACKGROUND '+background+'\n#define ENCOUNTER_KEYS '+keys.length+'\n#define ENCOUNTER_GROUP '+group+'\nstatic const uint8_t encounter_keys[][7]={'+keyRows+'};\nstatic const uint8_t encounter_bounds[][14]={'+bounds.map(b=>'{'+b+'}').join(',')+'};\n#define ENCOUNTER_FORMATIONS '+bounds.length+'\n');
 await fs.writeFile(gen+'/../encounter-resources.json',JSON.stringify({world,map,group,background,formations,bounds,profiles:proof,scope:'Complete current field encounter group, spatial resources only; source count/entry decision and actions execute at runtime.'},null,2));
 return generated;
}
