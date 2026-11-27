// Party side of 34/9CE3. Enemy initialization / encounter RNG are separate owners.
import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {segment} from './state-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {offset} from './render-budget-source.mjs';
import {equipmentProperties} from './battle-equipment-source.mjs';
export function livePartyOriginal(rom,state){
 check(state.length===1024,'Canonical state size');const c=battleCpu(rom,0x18);
 c.m.set(state,0x6000);c.m.set([0,0x61,0,0x62,0x75,0x75,0x75,0x76],0x57);
 segment(c,0xa400,0xa43f); // Stop before the distinct monster consumer.
 c.banks=[0x34,0x35,0x3e,0x3f];c.m[0x7cf6]=0x1a;c.call(0x9474);c.call(0x9d06);
 const normalized=Buffer.from(c.m.subarray(0x78bb,0x78c3)),icons=Buffer.from(c.m.subarray(0x78c4,0x78c8));
 c.banks=[0x30,0x31,0x3e,0x3f];c.m[0x7cf6]=0x18;
 for(let i=0;i<4;i++){c.m[0x52]=i;c.call(0xaa16);}
 return {state:Buffer.from(c.m.subarray(0x6000,0x6400)),records:Buffer.from(c.m.subarray(0x7575,0x7675)),normalized,icons};
}
export function livePartyAssets(rom){
 const {m}=initializedBattle(rom,{formation:3,back:false,rows:[0,0,0,0],terrain:0}),patterns=[];
 // Execute the original loader, including its 14-tile small-form reads and
 // six-tile dead-pose overwrite. These are reusable resources, not frames.
 for(let variant=0;variant<46;variant++){
  const job=variant<44?variant%22:0,status=variant<22?0:variant<44?128:variant===44?4:1;
  m.c.m[0x7d8b]=job;m.c.m[0x7d9b]=status;m.c.m[0x7da3]=0;m.c.x=0;m.call(0xaa00);
  check(m.c.m[0x7da3]===(variant<22?0:variant<44?1:variant===44?2:3),'Original initial graphics cache');
  patterns.push(nativePartyTiles(m.ppu.bytes.subarray(0x1010,0x10f0)));
 }
 const bytes=(bank,addr,n)=>Buffer.from(rom.subarray(offset(bank,addr),offset(bank,addr)+n));
 return {live_party_patterns:Buffer.concat(patterns),live_party_icons:nativePartyTiles(bytes(0x0d,0xb240,512)),live_party_palettes:bytes(0x2e,0x9e4a,26),live_party_modifiers:bytes(0x39,0xbb1a,110),equipment_properties:equipmentProperties(rom).bytes};
}
