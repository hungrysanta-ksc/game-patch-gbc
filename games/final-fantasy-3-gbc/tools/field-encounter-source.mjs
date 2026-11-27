import {stateCpu} from './state-source.mjs';
import {fieldAddresses} from './exploration-source.mjs';
import {check,hash} from './source.mjs';
export const encounterRegions=[
 ['encounter_map_groups',0x2e,0x92f0,512,'3D/BDCF,BDDA'],
 ['encounter_groups',0x2e,0x94f0,2048,'3D/BD4D..BD76'],
 ['encounter_slots',0x3d,0xbd78,64,'3D/BD6C..BD6F'],
 ['encounter_random',0x3f,0xfe00,256,'3D/BD65..BD69'],
 ['encounter_backgrounds',0x39,0xbc00,512,'3A/8533..854D']
];
export function encounterAssets(rom){
 const regions=encounterRegions.map(([name,bank,cpu,bytes,consumer])=>{const offset=16+bank*8192+(cpu&8191),data=rom.subarray(offset,offset+bytes);check(data.length===bytes,'Encounter source extent');return {name,bank,cpu,bytes,consumer,offset,sha256:hash(data),data};});
 check(regions[2].data.every(n=>n<8),'Encounter group slot bounds');
 return {header:regions.map(r=>'/* '+r.consumer+' */\nconst uint8_t '+r.name+'[]={'+[...r.data]+'};\n').join(''),provenance:regions.map(({data,...r})=>r)};
}
export function checkEncounterAssets(bytes,symbols,rom){
 const r=encounterAssets(rom);for(const p of r.provenance){const a=symbols['_'+p.name];check(Number.isInteger(a),'Linked encounter symbol '+p.name);const offset=(a>>>16)*16384+(a&16383);check(hash(bytes.subarray(offset,offset+p.bytes))===p.sha256,'Linked encounter data '+p.name);}return r.provenance;
}
const statePairs=[[14,0xf5],[15,0xf6],[23,0x78],[24,0x48],[25,0xf8],[70,0x68],[71,0x69],[76,0xf7],[77,0x6a],[78,0x6b]];
// Expected decisions execute the original instructions, never a JS port.
// op 15 covers directional movement with healthy party and no active dialogue;
// graphics/guest/poison consumers are deliberately outside this unit boundary.
export function encounterOriginal(rom,op,input,property=0x44){
 const c=stateCpu(rom),f=Buffer.from(input);fieldAddresses.forEach((a,i)=>c.m[a]=f[i]);statePairs.forEach(([i,a])=>c.m[a]=f[i]);
 if(op===14){c.m[0x6c]=f[17];c.call(0xbdb9);}
 else if(op===16)c.call(0xe283);
 else if(op===15){
  f.writeUInt16LE((f.readUInt16LE(32)+1)&65535,32);
  if(c.m[0x34]){c.call(0xe5eb);if((c.m[0x35]|c.m[0x36])===8)c.call(0xe900);if(!c.m[0x34])f.writeUInt16LE((f.readUInt16LE(28)+1)&65535,28);}
  c.pc=0xe20f;for(let i=0;![0xe229,0xe226,0xe26a].includes(c.pc);i++){check(i<30,'Original trigger dispatch');c.step();}
  if(c.pc===0xe26a){c.step();c.step();if(c.pc===0xe26e){c.call(0xe283);f[16]=4;}else f[16]=2;}
  else if(c.pc===0xe226){
   check(!f[37]&&!(f[17]&0xf0),'Directional fixture only');f[37]=f[17]&~f[18];f[18]=f[17];
   if(f[17]&15){c.a=f[17]&15;c.m[0x33]=c.a;c.m.fill(1,0x7400,0x7800);c.m[0x401]=property;c.m[0x501]=0;c.m[0x4c]=1;
    c.call(0xe396);f[13]=255;
    if(c.p&1)f[38]++;else{c.m[0x2d]=1;c.call(0xcda3);}
   }
  }
 }else throw Error('Unknown encounter fixture');
 fieldAddresses.forEach((a,i)=>f[i]=c.m[a]);statePairs.forEach(([i,a])=>f[i]=c.m[a]);
 return f;
}
export function encounterFixtures(rom){
 const out=[];
 function add(op,f,property){f[26]=0xa5;f[27]=1;const e=encounterOriginal(rom,op,f,property),empty=Buffer.alloc(192).toString('hex');
  out.push({op,field:f.toString('hex'),part1:empty,part2:empty,...(property===undefined?{}:{mapProperty:property,fill:1}),expected:{field:e.subarray(0,28).toString('hex'),part1:empty,part2:empty,encounter:e.subarray(76,79).toString('hex'),...(op===15?{step:e.subarray(28,30).toString('hex'),tick:e.subarray(32,34).toString('hex'),reserved:e.subarray(70,72).toString('hex'),pressed:e[37],blocked:e[38]}:{})}});return e;
 }
 const base=()=>{const s=Buffer.alloc(79);s[0]=s[1]=3;s[70]=s[71]=10;s[4]=1;s[14]=5;s[25]=255;s[76]=255;s[77]=0xa7;s[78]=0x5b;return s;};
 // Every map in both source groups/background tables; nonzero worlds use the
 // same branch, including high flag bits. All 256 formation RNG cursors wrap.
 for(const w of [0,1,2,0x80])for(let map=0;map<256;map++){const s=base();s[23]=w;s[24]=map;s[76]=map;add(14,s);add(16,s);}
 // All event values gate without consuming either RNG. Rate boundaries and
 // the $F5 wrap/$F6 direction branch are checked against actual C711.
 for(let event=1;event<256;event++){const s=base();s[17]=event;add(14,s);}
 for(const index of [0,1,254,255])for(const direction of [0,1,127,128,255])for(let rate=0;rate<256;rate++){
  const s=base();s[14]=index;s[15]=direction;s[25]=rate;s[24]=rate;add(14,s);
 }
 // Complete one-tile walk: success is latched before the first pixel but the
 // dispatch is after pixel 16; blocked terrain consumes the RNG then clears AB.
 for(const d of [1,2,4,8])for(const prop of [0x44,0x43,0x42]){
  let s=base();s[4]=s[17]=s[18]=d;s[6]=prop===0x42?1:0;
  s=add(15,s,prop);if(s[5])for(let n=0;n<16;n++)s=add(15,s,prop);
 }
 for(const trigger of [0x20,0x21,0x40,0x60,0x80,0xe0]){const s=base();s[10]=trigger;s[17]=1;add(15,s,0x44);}
 return out;
}
