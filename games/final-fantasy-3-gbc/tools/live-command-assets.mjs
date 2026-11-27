import fs from 'node:fs/promises';
import {check,hash} from './source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {sourceInitialState} from './state-source.mjs';
// A400's enemy records are immutable initial properties (no chosen actions,
// RNG outcomes or presentation frames). The native battle owns every later
// HP/status/action write. Canonical party data is never taken from this probe.
export async function liveCommandAssets(rom,gen,profiles){
 const state=sourceInitialState(rom),groups=new Map(),descriptors=[],proof=[];
 for(const p of profiles){const [formation,...rest]=p.key,counts=rest.slice(0,4),back=!!rest[4];
  const {m}=initializedBattle(rom,{formation,counts,back,rows:[0,0,0,0],terrain:0,partyState:state}),c=m.c;
  const records=Buffer.concat([Buffer.from(c.m.subarray(0x7675,0x7875)),Buffer.from(c.m.subarray(0x7ec4,0x7ecc))]),flags=(c.m[0x7d68]>>7)|((c.m[0x7d68]&64)<<1);
  // Source indices must match the spatial catalog; do not attach a record to
  // a different image simply because its monster ID occurs elsewhere.
  check(Buffer.from(c.m.subarray(0x7da7,0x7daf)).equals(Buffer.from(p.types)),'Enemy property/spatial slot identity');
  for(let i=0;i<8;i++)if(p.types[i]!==255)check((records[i*64+44]&135)===(128|i),'Enemy property slot flags');
  const bank=121+Math.floor((p.profile-4)/24),name='live_enemy_records'+p.profile;
  if(!groups.has(bank))groups.set(bank,[]);groups.get(bank).push({name,records});descriptors.push({name,bank,flags});proof.push({profile:p.profile,bank,source:'31/A400,A4F6..A65D',sha256:hash(records)});
 }
 const files=[];for(const [bank,rows]of groups){const file=gen+'/live-command'+bank+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\n'+rows.map(({name,records})=>'const uint8_t '+name+'[]={'+[...records]+'};').join('\n'));files.push(file);}
 await fs.writeFile(gen+'/live-command-assets.h','#include <stdint.h>\ntypedef struct {const uint8_t *records;uint8_t bank,flags;} LiveCommandAsset;\n#define LIVE_COMMAND_PROFILES '+profiles.length+'\n'+descriptors.map(d=>'extern const uint8_t '+d.name+'[];').join('\n')+'\nstatic const LiveCommandAsset live_command_assets[]={'+descriptors.map(d=>'{'+[d.name,d.bank,d.flags]+'}').join(',')+'};\n');
 await fs.writeFile(gen+'/../live-command-resources.json',JSON.stringify({scope:'Original initial enemy properties; live party and all action results are runtime state',profiles:proof},null,2));return files;
}
