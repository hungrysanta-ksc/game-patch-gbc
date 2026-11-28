import fs from 'node:fs/promises';
import {ROOT,check} from './source.mjs';
// Observe complete CALL/return intervals, including the old bank trampoline.
// Linked bytes, not source-line timing guesses, determine the hook sites.
export async function cellCallAudit(listingPath,symbols,rom){
 // The public text_transfer_busy flag belongs to dialogue/atlas callers;
 // battle ff3_text_copy uses the private pending descriptor. Anchor its
 // address to the linked idle accessor rather than guessing a DATA offset.
 const idle=symbols.ff3_text_transfer_idle;
 check(idle<0x4000&&rom[idle]===0xfa&&rom[idle+3]===0xb7&&rom[idle+4]===0x20,'Linked transfer idle accessor');
 const pending=rom.readUInt16LE(idle+1);check(pending>=0xc000&&pending<0xd000,'Fixed pending descriptor');
 const listing=await fs.readFile(listingPath,'utf8');
 const anchor=listing.match(/^\s+([0-9A-F]{8})\s+\d+ _ff3_enemy_build::/m);
 check(anchor&&(symbols.ff3_enemy_build>>>16)===124,'Cell display listing anchor');
 const base=(symbols.ff3_enemy_build&65535)-parseInt(anchor[1],16),sites=[];
 for(const name of ['ff3_cell_mask','ff3_cell_pool_tile']){
  const local=symbols[name+'_local']!==undefined,target=name+(local?'_local':''),address=symbols[target];
  check((address>>>16)===124,'Cell callee bank');
  const re=local?new RegExp('^\\s+([0-9A-F]{8}) .*\\bcall\\s+_'+target+'$','m'):new RegExp('^\\s+([0-9A-F]{8}) .*\\bld\\s+hl, #_'+target+'\\r?\\n\\s+([0-9A-F]{8}) .*\\bcall\\s+___sdcc_bcall_ehl$','m');
  const m=listing.match(re);check(m,'Cell call listing '+target);
  const at=base+parseInt(m[local?1:2],16),offset=124*16384+(at&16383);
  const callee=local?address&65535:symbols.__sdcc_bcall_ehl;
  check(rom[offset]===0xcd&&rom.readUInt16LE(offset+1)===callee,'Exact linked cell CALL '+target);
  if(!local){const ld=124*16384+((base+parseInt(m[1],16))&16383);check(rom[ld]===0x21&&rom.readUInt16LE(ld+1)===(address&65535),'Exact banked target');}
  sites.push({name:name==='ff3_cell_mask'?'cell_mask':'cell_tile',at,finish:at+3,bank:124});
 }
 return 'actionClockAddress='+symbols.native_clock+'\nactionClockPhase='+symbols.scene_phase+'\nactionCostRetain='+symbols.scene_cycles+'\nactionOamBank='+symbols._current_bank+'\nactionOamSites={'+sites.map(s=>'{name="'+s.name+'",at='+s.at+',finish='+s.finish+',bank=124}').join(',')+'}\n'+
  'actionCostAddresses={active='+symbols.action_enabled+',audio='+symbols.native_busy+',irq='+symbols.native_irq_busy+',transfer='+pending+',publish='+symbols.party_pending+'}\n'+await fs.readFile(ROOT+'/tools/battle-action-cost-audit.lua','utf8');
}
