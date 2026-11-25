import fs from 'node:fs/promises';import {check} from './source.mjs';
export async function preparationAudit(s,rom,expected){
 check(Number.isInteger(expected)&&expected>0,'Preparation request count');
 const addresses={busy:s.native_busy,request:s.party_request,step:s.party_step,profile:s.party_profile,frame:s.party_frame,bank:s._current_bank};
 for(const [k,v]of Object.entries(addresses))check(Number.isInteger(v)&&v>=0xc000&&v<=0xffff,'Preparation symbol '+k);
 const sites=[['ff3_text_copy',2],['ff3_party_palette',2],['ff3_stone_prepare',3]].map(([name,kind])=>{
  const n=s[name],bank=n>>>16,pc=n&65535,offset=bank?bank*16384+(pc&16383):pc;
  check(Number.isInteger(n)&&pc<0x8000&&rom[offset]!==255&&rom[offset]!==undefined,'Preparation code '+name);return {name,bank,pc,kind};
 });
 return 'local preparationExpected='+expected+'\nlocal preparationAddresses={'+Object.entries(addresses).map(([k,v])=>k+'='+v).join(',')+'}\nlocal preparationSites={'+sites.map(s=>'{pc='+s.pc+',bank='+s.bank+',kind='+s.kind+'}').join(',')+'}\n'+await fs.readFile(new URL('./battle-preparation-audit.lua',import.meta.url),'utf8');
}
export function preparationCosts(log){
 const rows=[...new Set([...log.matchAll(/preparation:([\d,]+)/g)].map(m=>m[1]))].map(s=>s.split(',').map(Number));
 return rows.map(([profile,request,frame,total,rate,other,audio,transfer,stone])=>{
  check(profile<4&&[1,2].includes(request)&&rate===8388608&&total===other+audio+transfer+stone,'Exclusive preparation ledger');
  return {profile,request,frame,totalMs:total*1000/rate,otherMs:other*1000/rate,audioMs:audio*1000/rate,transferMs:transfer*1000/rate,stoneMs:stone*1000/rate};
 });
}
