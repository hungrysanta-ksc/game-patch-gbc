import {Driver6502} from './driver6502.mjs';
import {check,hash} from './source.mjs';

export function stateCpu(rom){const c=new Driver6502(rom);c.banks=[0x3c,0x3d,0x3e,0x3f];return c;}
export function sourceInitialState(rom,fill=0xa5){const c=stateCpu(rom);c.banks[0]=0x3a;c.m.fill(fill,0x6000,0x6400);c.call(0x8e76);return Buffer.from(c.m.subarray(0x6000,0x6400));}
export function sourceSeal(rom,state,position){const c=stateCpu(rom);c.m.set(state,0x6000);for(const [i,a]of [0x78,0x42,0x27,0x28].entries())c.m[a]=position[i];c.call(0xae5c);return Buffer.from(c.m.subarray(0x6000,0x6400));}
export function sourceValid(rom,state,slot=1){const c=stateCpu(rom);c.m.set(state,0x6000+slot*1024);c.a=slot;c.call(0xae97);return !(c.p&1);}
// Execute exact instruction boundaries, including any nested original calls.
// No ROM edits or success stubs. Stops before unrelated menu/PPU work.
export function segment(c,start,end){c.pc=start;for(let i=0;i<200000;i++){if(c.pc===end)return;c.step();}throw Error('State source segment budget');}
export const stateRegions=[
 ['ff3_initial_npcs',0,0x9600,64,'3A/8EB7 (bank 00 mapped at A000)'],
 ['ff3_initial_job',0x39,0xa000,8,'3A/8EC7'],
 ['ff3_initial_mp',0x39,0xbb88,8,'3A/8EDE'],
 ['ff3_initial_hp',0x39,0xbbd8,2,'3A/8EEE'],
 ['ff3_initial_stats',0x39,0xbbda,20,'3A/8F02'],
 ['ff3_initial_equipment',0x39,0xbbf0,16,'3A/8F0D'],
 ['ff3_field_rng_table',0x3f,0xfe00,256,'3E/C728']
];
export function stateAssets(rom){return {header:stateRegions.map(([name,bank,cpu,n])=>{const start=16+bank*8192+(cpu&8191);return 'static const uint8_t '+name+'[]={'+[...rom.subarray(start,start+n)].join(',')+'};\n';}).join(''),provenance:stateRegions.map(([name,bank,cpu,bytes,consumer])=>({name,bank,cpu,bytes,consumer,offset:16+bank*8192+(cpu&8191),sha256:hash(rom.subarray(16+bank*8192+(cpu&8191),16+bank*8192+(cpu&8191)+bytes))}))};}
export function stateFixtures(rom){
 const chunks=[],counts={},c=stateCpu(rom);let cases=0;
 const add=(op,...parts)=>{chunks.push(Buffer.from([op]),...parts.map(p=>Buffer.from(p)));counts[op]=(counts[op]??0)+1;cases++;};
 for(const fill of [0,255,165])add(1,[fill],sourceInitialState(rom,fill));
 for(let n=0;n<32;n++){
  const s=Buffer.from(Array.from({length:1024},(_,i)=>(i*(n*2+1)+(i>>8)+n*41)&255)),p=[n,n*7&255,n*13&255,255-n];
  const sealed=sourceSeal(rom,s,p);add(2,s,p,sealed);
  for(let slot=1;slot<=3;slot++){add(3,sealed,[+sourceValid(rom,sealed,slot)]);const bad=Buffer.from(sealed);bad[(n*31+slot)&1023]^=1;add(3,bad,[+sourceValid(rom,bad,slot)]);}
 }
 // Marker rejection independent of checksum; intentionally weak original checksum
 // also accepts compensating two-byte changes (do not replace it with a CRC).
 const sealed=sourceSeal(rom,sourceInitialState(rom),[0,0,41,47]);
 for(const marker of [0,0x59,0x5b,255]){const b=Buffer.from(sealed);b[0x1a]=(b[0x1a]+0x5a-marker)&255;b[0x19]=marker;add(3,b,[+sourceValid(rom,b)]);}
 const compensated=Buffer.from(sealed);compensated[0]++;compensated[1]--;add(3,compensated,[+sourceValid(rom,compensated)]);
 for(let d=0;d<256;d++)for(let index=0;index<256;index++){c.m[0xf5]=index;c.m[0xf6]=d;c.call(0xc711);add(4,[index,d],[c.a,c.m[0xf5],c.m[0xf6]]);}
 // All possible resulting seed bytes, both incoming carry values, varied ZP.
 for(let n=0;n<256;n++)for(let carry=0;carry<2;carry++){
  const zp=Buffer.alloc(256);zp[0]=n;const a=0;c.m.set(zp);c.a=a;c.p=0x24|carry;c.call(0xfc27);
  add(5,zp,[a,carry],c.m.subarray(0x7be3,0x7ce3),c.m.subarray(0x15,0x18));
 }
 for(let n=0;n<16;n++){
  const zp=Buffer.from(Array.from({length:256},(_,i)=>(i*37+n*19)&255)),a=n*17,carry=n&1;c.m.set(zp);c.a=a;c.p=0x24|carry;c.call(0xfc27);add(5,zp,[a,carry],c.m.subarray(0x7be3,0x7ce3),c.m.subarray(0x15,0x18));
 }
 // Every lower/upper pair, all selectors distributed across cases; wraps at FF.
 for(let lo=0;lo<256;lo++)for(let hi=0;hi<256;hi++){
  const selector=(lo+hi)%3,counters=[lo,hi,(lo+hi)&255];c.m.set(counters,0x15);c.m[0x21]=selector;c.x=lo;c.a=hi;c.call(0xfbef);
  add(6,[selector,lo,hi,...counters],[1,c.a,...c.m.subarray(0x15,0x18)]);
 }
 for(const selector of [3,255])add(6,[selector,1,254,0,127,255],[0,0xa5,0,127,255]);
 for(let n=0;n<256;n++){
  for(const magic of [[0x55,0xaa],[0,0],[0x55,0],[0,0xaa]]){
   const count=[...magic,n],p=[n,0,41,47],s=sourceInitialState(rom);c.m.set(s,0x6000);c.m.set(count,0x7f38);for(const [i,a]of [0x78,0x42,0x27,0x28].entries())c.m[a]=p[i];segment(c,0xa897,0xa8bd);
   add(7,s,count,p,c.m.subarray(0x6000,0x6400),c.m.subarray(0x7f38,0x7f3b));
  }
  c.m.set([0x55,0xaa,n],0x7f38);segment(c,0xa93d,0xa94c);add(8,[0x55,0xaa,n],c.m.subarray(0x7f38,0x7f3b));
 }
 const data=Buffer.concat([...chunks,Buffer.from([0])]);check(cases<0xffffffff,'State case count');return {data,cases,counts};
}
