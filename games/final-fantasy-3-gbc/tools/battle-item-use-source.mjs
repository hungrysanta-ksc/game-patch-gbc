import {check,hash} from './source.mjs';import {battleCpu} from './battle-placement-source.mjs';import {offset} from './render-budget-source.mjs';
function machine(rom){const c=battleCpu(rom);c.call(0x9f5e);c.banks=[0x34,0x35,0x3e,0x3f];c.m[0x7cf6]=0x1a;c.m[0x57]=0;c.m[0x58]=0x61;c.m[0x5b]=0x75;c.m[0x5c]=0x75;return c;}
export function itemUseTables(rom){const regions=[['weapons',0x30,0x9400,0x62*8],['itemSpells',0x2e,0x91a0,48],['spells',0x30,0x98c0,256*8],['equipment',0,0x8900,256]],tables={},provenance=[];
 for(const [name,bank,cpu,bytes]of regions){const at=offset(bank,cpu),b=Buffer.from(rom.subarray(at,at+bytes));tables[name]=b;provenance.push({name,bank,cpu,offset:at,bytes,sha256:hash(b)});}return {tables,provenance};}
export function itemEligibility(rom,id,job){check(job<22,'Item job');if(id>=0xc8)return 0;if(id>=0x98)return 1;if(id>=0x62)return 0;const {tables:t}=itemUseTables(rom),type=t.weapons[id*8+7]&127,index=(type*3)&255,byte=t.equipment[(index+2-(job>>3))&255];return +(!!(byte&(1<<(job&7))));}
export function sourceItemEligibility(rom,id,job){if(id>=0xc8)return 0;if(id>=0x98)return 1;if(id>=0x62)return 0;const c=machine(rom);c.m[0x6100]=job;c.m[0x18]=id;c.m[0x20]=0;c.m[0x21]=0x94;c.call(0xb8fd);return c.m[0x1c];}
export function sourceItemUse(rom,id,job,{equipped=false}={}){const c=machine(rom);c.m[0x6100]=job;c.m[0x63]=equipped?0:1;c.m[0x62]=equipped?1:0;c.m[equipped?0x7af7:0x7afd]=id;c.m[equipped?0x7b3e:0x7b41]=equipped?1:sourceItemEligibility(rom,id,job);c.pc=0xb4f7;
 for(let n=0;n<50000;n++){if(c.pc===0xaeaa)return {valid:0,item:0,actionFlags:c.m[0x75a1],showHp:c.m[0x7ce8]===255?1:0,property:0};if(c.pc===0xb5ba)return {valid:1,item:c.m[0x75a3],actionFlags:c.m[0x75a1],showHp:c.m[0x7ce8]===255?1:0,property:c.m[0x747d]};c.step();}throw Error('Item use source budget');}
export function sourceItemAutoTargets(rom,status){check(status.length===8,'Eight enemy status records');const c=machine(rom);for(let i=0;i<8;i++)c.m[0x7676+i*64]=status[i];c.call(0xb9f0);return {mask:c.m[0x75a4],flags:c.m[0x75a5]};}
export function sourceItemQuantity(rom,quantity){const c=machine(rom);c.m[0x18]=quantity;c.m[0x19]=0;c.call(0x95e1);return [c.m[0x1d],c.m[0x1e]];}
export function compiledItemUseTables(rom){const {tables:t,provenance}=itemUseTables(rom),flags=Buffer.alloc(256),usable=Buffer.alloc(22*256);let checks=0;
 for(let id=0;id<256;id++){if(id&&id<0x57||id>=0x98&&id<0xc8){const spell=id<0x57?t.weapons[id*8+4]:t.itemSpells[id-0x98];flags[id]=spell===127?9:t.spells[spell*8+5];}
  for(let job=0;job<22;job++){const value=itemEligibility(rom,id,job);check(value===sourceItemEligibility(rom,id,job),'Original equipment mask '+id+'/'+job);usable[job*256+id]=value;const r=sourceItemUse(rom,id,job);check(r.valid===+(!!id&&(id<0x57||id>=0x98&&id<0xc8)&&!!value)&&(!r.valid||r.property===flags[id]),'Original item use '+id+'/'+job);checks++;}
 }
 return {flags,usable,provenance,checks};}
