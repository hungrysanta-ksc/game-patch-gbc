import {check} from './source.mjs';

// Compare logical oracle cells with live copy-on-write VRAM slots. Blank
// cells may use shared tile zero; nonblank cells must have unique owners.
export function normalizeBoss(p,e,targetOam,base=21){
 const actual=Buffer.from(p.bossMap,'hex'),expected=Buffer.from(e.map,'hex'),patterns=Buffer.from(p.bossPatterns,'hex'),logical=Buffer.from(e.patterns,'hex'),oam=Buffer.from(p.oam,'hex'),target=Buffer.from(targetOam,'hex'),owners=new Map();
 check(actual.length===704&&patterns.length===4096,'Boss capture size');
 function tile(id,slot){
  const bytes=logical.subarray(id*16,id*16+16),blank=bytes.every(v=>!v);
  check((slot>=base||slot===0&&blank)&&patterns.subarray(slot*16,slot*16+16).equals(bytes),'Boss live pattern '+id+'/'+slot);
  if(slot){check(!owners.has(slot)||owners.get(slot)===id,'Boss slot alias');owners.set(slot,id);}
 }
 for(let i=0;i<352;i++){
  check(actual[352+i]===expected[352+i],'Boss cell palette');
  if(expected[i])tile(expected[i],actual[i]);else check(actual[i]===0,'Boss outside cell ownership');
 }
 for(let i=0;i<oam.length;i+=4)if(target[i+3]&8){tile(target[i+2],oam[i+2]);oam[i+2]=target[i+2];}
 return {oam:oam.toString('hex'),map:expected.toString('hex')};
}
