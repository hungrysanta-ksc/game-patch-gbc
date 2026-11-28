import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {segment} from './state-source.mjs';
import {fightSeed,FIGHT_BYTES} from './battle-fight-source.mjs';
import {physicalRng} from './battle-physical-source.mjs';
import {itemUseTables} from './battle-item-use-source.mjs';
import {equipmentProperties} from './battle-equipment-source.mjs';
export const AILMENT_BYTES=239;
export function ailmentSeed(a=0,b=0,self=false){const s=Buffer.concat([fightSeed({actor:0,target:self?0:1}),Buffer.alloc(64,0xa5)]);s[65]=a;s[66]=b;s[163]=a;s[164]=b;s[1]=self?a:0;s[2]=self?b:0;s[161]=s[1];s[162]=s[2];s[138]=self?0:1;s[137]=128>>s[138];return s;}
// Actual ROM leaves with caller inputs explicitly fixed. No implementation
// result is used as an oracle. The apply leaf alone is NOT spell eligibility.
export function sourceAilment(rom,state,op,param,counters=[17,0,239],table=physicalRng(rom)){
 check(state.length===AILMENT_BYTES&&op>=1&&op<=9,'Ailment ABI');const s=Buffer.from(state),c=battleCpu(rom,op===6||op===7||op===9?0x1a:0x18),self=s[44]===s[108],a=0x7575,t=self?a:0x75b5,ti=self?0:2;
 c.m.set(s.subarray(0,64),a);if(!self)c.m.set(s.subarray(64,128),t);c.m.set([a&255,a>>8,t&255,t>>8],0x6e);
 c.m.set(s.subarray(175),0x6100);c.m.set(table,0x7be3);c.m.set(counters,0x15);c.m.set(s.subarray(161,163),0xf0);c.m.set(s.subarray(163,165),0xe0+ti);c.m[0x64]=ti;
 c.m[0x24]=param;c.m[0x7403]=param;c.m[0x7402]=param;c.m[0x7c]=1;c.m[0x7ed8]=s[135];c.m[0x7ec1]=s[138];c.m[0x7e9b]=s[137];c.m.set(s.subarray(139,159),0x78da);c.m[0x78ee]=s[159];c.m[0x78d9]=s[174];c.m.set(s.subarray(169,171),0x78);
 if(op===9){c.call(0xa68a);s.set(c.m.subarray(a,a+64));if(self)s.set(c.m.subarray(a,a+64),64);s.set(c.m.subarray(0xf0,0xf2),161);s[174]=c.m[0x78d7];return{state:s,counters:Buffer.from(c.m.subarray(0x15,0x18))};}
 if(op<=5){if(op===5)c.m[0x7403]=128;c.call([0,0xbbf3,0xb7f1,0xb3cf,0xb40f,0xb38e][op]);}
 if(op===6){c.m.set([t&255,t>>8],0x28);c.m[0x24]=0;c.m[0x64]=0;c.m.set(s.subarray(169,171),0x7400);c.call(0xbadc);s.set(c.m.subarray(0x7400,0x7402),169);}
 if(op===7){c.m.set(s.subarray(64,128),0x7575);c.m.set([0,0x61],0x57);c.m.set([0x75,0x75],0x5b);c.call(0x8315);s.set(c.m.subarray(0x6100,0x6140),175);return{state:s,counters:Buffer.from(counters)};}
 if(op===8){c.m.set([0,0x61],0x57);c.m[0x52]=0;c.m.fill(0,0x18,0x58);c.m.set([0,0x61],0x57);segment(c,0xa482,0xa4b7);s.fill(0,64,128);s.set(c.m.subarray(0x18,0x28),64);return{state:s,counters:Buffer.from(counters)};}
 s.set(c.m.subarray(a,a+64));s.set(c.m.subarray(t,t+64),64);
 if(op<=5){s.set(c.m.subarray(0xf0,0xf2),161);s.set(c.m.subarray(0xe0+ti,0xe2+ti),163);s[137]=c.m[0x7e9b];s.set(c.m.subarray(0x78da,0x78ee),139);s[159]=c.m[0x78ee];s[174]=c.m[0x78d9];if(op===5)s.set(c.m.subarray(0x78,0x7a),169);}
 return{state:s,counters:Buffer.from(c.m.subarray(0x15,0x18))};
}
export function ailmentCases(){const rows=[],add=(tag,s,op,param,counter=0)=>rows.push({tag,state:s,op,param,counters:[17,counter,239]});
 for(let a=0;a<256;a++)for(const b of [0,6,32,64,128,231])for(const effect of [2,4,8,16,32,64,128,3,5,7,33,65,129]){const s=ailmentSeed(a,b);s[135]=a&1?128:0;add('apply-priority',s,1,effect);}
 for(let a=0;a<256;a++)for(const b of [0,6,32,64,128,231])for(const mask of [2,4,8,16,32,64,128,1,255])for(const self of [false,true]){add('remove-mask',ailmentSeed(a,b,self),2,mask);}
 for(let a=0;a<256;a++)for(const b of [0,32,38])for(const mask of [64,1,255])add('cure-caller',ailmentSeed(a,b),3,mask);
 for(let a=0;a<256;a++)for(const mask of [8,32])add('toggle-small',ailmentSeed(a,0xa6),4,mask);
 for(let a=0;a<256;a++)for(const self of [false,true])for(const strength of [1,255]){const s=ailmentSeed(a,0xa6,self);s.writeUInt16LE(0,67);if(self)s.writeUInt16LE(0,3);add('revive-preservation',s,5,strength,a);}
 for(let a=0;a<256;a++)for(const hp of [0,1,61,62,63,900]){const s=ailmentSeed(a,0xa6);s.writeUInt16LE(hp,67);add('poison-gate',s,6,0);}
 for(const max of [0,1,15,16,65535])for(const hp of [0,1,4094,4095,4096,65535]){const s=ailmentSeed(3,0xa6);s.writeUInt16LE(hp,67);s.writeUInt16LE(max,69);add('poison-width',s,6,0);}
 for(let a=0;a<256;a++){const s=ailmentSeed(a,a^165);for(let i=0;i<64;i++)s[175+i]=(a+i*7)&255;add('leave-persistent',s,7,0);s[177]=a;add('enter-persistent',Buffer.from(s),8,0);}
 for(const status of [0x80,0x88,0x90,0x98,0x40,0x48,0x50,0x58])for(const chance of [0,50,205,206,255])for(const counter of [0,17,73,174,255]){const s=ailmentSeed(0,0);s[2]=status;s[43]=chance;add('turn-recovery',s,9,0,counter);}
 return rows;
}
export function ailmentInventory(rom){const {tables,provenance}=itemUseTables(rom),equipment=equipmentProperties(rom),spells=[];for(let id=0;id<115;id++){const p=tables.spells.subarray(id*8,id*8+8);if([4,5,6,7].includes(p[4])||(p[4]===0&&p[3]))spells.push({id,effect:p[4],mask:p[3],strength:p[2],targetFlags:p[5],animation:p[6]});}const ids=new Set(spells.map(s=>s.id));return{attackRecords:115,attackRegion:'30/98C0..9C57; next region is monster gil',provenance,spells,items:[...tables.itemSpells].flatMap((spell,i)=>ids.has(spell)?[{item:152+i,spell}]:[]),weapons:Array.from({length:87},(_,id)=>({id,mask:tables.weapons[id*8+3],spell:tables.weapons[id*8+4]})).filter(w=>w.mask||ids.has(w.spell)),armorResistance:Array.from({length:65},(_,i)=>({id:87+i,mask:equipment.bytes[(87+i)*8+3]})).filter(a=>a.mask)};}
export function ailmentFixtures(rom){const table=physicalRng(rom),counts={},chunks=[],rows=ailmentCases();let previous=Buffer.alloc(AILMENT_BYTES),negativeOffset;
 const delta=(a,b,first=false)=>{const d=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i]||(first&&i===0))d.push(i,b[i]);return Buffer.from([d.length/2,...d]);};
 for(const row of rows){const r=sourceAilment(rom,row.state,row.op,row.param,row.counters,table),head=Buffer.from([row.op,row.param]),initial=delta(previous,row.state),expected=delta(row.state,r.state,chunks.length===0);if(!chunks.length)negativeOffset=2+initial.length+3+2;chunks.push(head,initial,Buffer.from(row.counters),expected,r.counters);previous=r.state;counts[row.tag]=(counts[row.tag]||0)+1;}
 return{table,bytes:Buffer.concat(chunks),cases:rows.length,counts,negativeOffset};}

// Validate the upstream item-target exceptions, not merely the effect leaf.
export function sourceAilmentTargets(rom,a,b,item=0x98,magic=false){const c=battleCpu(rom,0x1a);c.m.set([0x75,0x75],0x6e);c.m.set([0xb5,0x75],0x70);c.m[0x75b6]=a;c.m[0x75b7]=b;c.m[0x7e99]=c.m[0x7e9b]=0x40;c.m[0x1a]=item;if(magic){c.a=item;c.sp=0xfe;c.m[0x1ff]=item;c.m[0x78d9]=255;segment(c,0xa388,0x8012);}else segment(c,0xa3bb,0x8022);return c.m[0x7e99];}
export function sourceStatusRecovery(rom,status,{enemy=false,chance=0,counter=0}={}){const c=battleCpu(rom,0x1a);c.m.set([0x75,0x75],0x6e);c.m[0x7575]=chance;c.m[0x7577]=status;c.m[0x75a0]=chance;c.m[0x75a1]=enemy?128:0;c.m.set(physicalRng(rom),0x7be3);c.m.set([17,counter,239],0x15);c.call(0xa68a);return{status:c.m[0x7577],staged:c.m[0xf1],message:c.m[0x78d7],counters:[...c.m.subarray(0x15,0x18)]};}
