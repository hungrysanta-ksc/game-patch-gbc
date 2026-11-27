import {check} from './source.mjs';
const at=(b,c)=>16+b*8192+(c&8191);
// 3D/BDB9/BD4D and 3A/8533: maps reference groups, groups reference
// formations. Compile a formation once even when several groups select it.
export function encounterCatalog(rom,maps){
 check(maps.length&&new Set(maps).size===maps.length&&maps.every(m=>Number.isInteger(m)&&m>=0&&m<256),'Explicit normal-map catalog');
 const entries=maps.map(map=>({map,group:rom[at(0x2e,0x92f0)+map],background:rom[at(0x39,0xbc00)+map]}));
 check(entries.every(e=>e.background===entries[0].background),'One terrain owner per catalog');
 const groups=[...new Set(entries.map(e=>e.group))].map(id=>({id,slots:[...rom.subarray(at(0x2e,0x94f0)+id*8,at(0x2e,0x94f0)+id*8+8)]}));
 return {maps:entries,groups,formations:[...new Set(groups.flatMap(g=>g.slots))]};
}
