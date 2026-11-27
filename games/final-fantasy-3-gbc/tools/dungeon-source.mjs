import {check,hash} from './source.mjs';
// Controller-only original new-game observation at FA26 (PR111): map B5,
// camera 3C/0C, player at (camera+7)&63 = (3,19). A reachable development
// anchor, not a claim that the opening event or new-game route is ported.
export function dungeonEntry(rom){
 const at=(b,c)=>16+b*8192+(c&8191),world=0,map=181,start=[3,19];
 const properties=rom.subarray(0x4010+map*16,0x4020+map*16),group=rom[at(0x2e,0x92f0)+map],background=rom[at(0x39,0xbc00)+map],rate=rom[at(0x39,0xbe00)+map];
 check(group===0&&background===8&&rate===6,'Reviewed first-dungeon source contract');
 return {world,map,start,group,background,rate,song:properties[10],propertiesSha256:hash(properties),entry:'Observed reachable first-dungeon coordinate after opening; opening event is not implemented'};
}
