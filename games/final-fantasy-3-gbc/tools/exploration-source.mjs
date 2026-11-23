import {stateCpu} from './state-source.mjs';
import {npcSprites,npcFixtures,npcAnimationFixtures,npcDeferredFixtures} from './npc-motion-source.mjs';
// Only input/output adaptation. All expected decisions execute untouched ROM.
export const fieldAddresses=[0x29,0x2a,0x35,0x36,0x33,0x34,0xa5,0x43,0x44,0x45,0xab,0x84,0x85];
export function fieldOriginal(rom,op,input,part1=Buffer.alloc(192),part2=Buffer.alloc(192)){
 const c=stateCpu(rom);fieldAddresses.forEach((a,i)=>c.m[a]=input[i]);c.m.set(part1,0x7000);c.m.set(part2,0x7100);
 if(op===1){c.a=input[4];c.call(0xe4e9);}else if(op===2)c.call(0xe3f1);else if(op===3)c.call(0xe494);
 else if(op===4){c.a=input[8];c.call(0xe3b4);}else if(op===5&&input[5]){c.call(0xe5eb);if((c.m[0x35]|c.m[0x36])===8)c.call(0xe900);}
 const output=Buffer.from(input);fieldAddresses.forEach((a,i)=>output[i]=c.m[a]);
 if(op===2||op===3)output[13]=c.x>=192?255:c.x;
 if(op>=2&&op<=4)output[21]=op===4?1-(c.p&1):c.p&1;
 return {field:output,part1:Buffer.from(c.m.subarray(0x7000,0x70c0)),part2:Buffer.from(c.m.subarray(0x7100,0x71c0))};
}
export function fieldFixtures(rom){
 const cases=[];let seed=0x5a921;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
 function add(op,s,a=Buffer.alloc(192),b=Buffer.alloc(192)){s[27]=1;s[26]=0xa5;const e=fieldOriginal(rom,op,s,a,b);cases.push({op,field:s.toString('hex'),part1:a.toString('hex'),part2:b.toString('hex'),expected:Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v.toString('hex')]))});}
 for(let d=0;d<16;d++)for(const x of [0,1,25,31,32,56,62,63])for(const y of [0,1,25,31,32,56,62,63]){const s=Buffer.alloc(28);s[0]=x;s[1]=y;s[4]=d;add(1,s);}
 for(let p=0;p<256;p++)for(let z=0;z<4;z++){const s=Buffer.alloc(28);s[6]=z;s[7]=rand();s[8]=p;s[9]=rand();s[10]=rand();add(4,s);}
 for(const d of [1,2,4,8,3,12])for(const coord of [0,63])for(let sub=0;sub<16;sub++)for(const speed of [1,2]){const s=Buffer.alloc(28);s[0]=s[1]=coord;s[d&3?2:3]=sub;s[4]=d;s[5]=speed;s[6]=sub&3;s[7]=rand()&0x34;s[8]=rand()&0x7f;add(5,s);}
 for(const op of [2,3])for(let n=0;n<768;n++){
  const s=Buffer.alloc(28),a=Buffer.alloc(192),b=Buffer.alloc(192);s[6]=n&3;s[11]=(n>>4)&63;s[12]=(n>>3)&63;
  for(let slot=0;slot<12;slot++){const t=slot*16;a[t]=(slot===n%12||rand()<80)?slot+1:0;a[t+1]=(n>>2&3)<<4;b[t+6]=(n>>4)&3;
   a[t+2]=a[t+4]=s[11];a[t+3]=a[t+5]=s[12];a[t+6]=[0,7,8,15][n>>6&3];a[t+7]=[0,7,8,15][n>>8&3];
   if(n&16)a[t+2]=(a[t+2]+1)&63;if(n&32)a[t+3]=(a[t+3]+1)&63;
   a[t+8]=n&64?255:0;a[t+9]=n&128?255:0;a[t+11]=rand();a[t+13]=rand();}
  add(op,s,a,b);
 }
 for(let d=0;d<16;d++)for(const phase of [0,8])for(const axis of [2,3])for(const terrain of [0,0x14,0x24,0x34]){
  const s=Buffer.alloc(28);s[0]=s[1]=3;s[4]=d;s[axis]=phase;s[7]=terrain;add(6,s);
  const c=stateCpu(rom);fieldAddresses.forEach((a,i)=>c.m[a]=s[i]);c.y=0;c.call(0xd8d3);const oam=Buffer.alloc(160);
  for(let q=0;q<4;q++){const at=0x200+q*4,a=c.m[at+2];oam[q*4]=c.m[at]+1-48+16;oam[q*4+1]=c.m[at+3]-40+8;oam[q*4+2]=192+c.m[at+1];oam[q*4+3]=10+(a&1)+((a&64)?32:0)+((a&128)?64:0)+((a&32)?128:0);}
  cases.at(-1).expected.oam=oam.toString('hex');
 }
 // Newly optimized full-quad and clipped paths: every screen-edge boundary,
 // all four original directions/palette selectors, and both priority halves.
 let edge=0;for(const x of [-16,-8,-7,0,151,152,159,160])for(const y of [-16,-8,-7,0,135,136,143,144]){
  const s=Buffer.alloc(28),a=Buffer.alloc(192),b=Buffer.alloc(192);s[0]=s[1]=3;s[4]=8;
  a[0]=1;a[4]=(88+x)>>4;a[6]=(88+x)&15;a[5]=(99+y)>>4;a[7]=(99+y)&15;a.writeUInt16LE(0xb41a+(edge%4)*16,14);b[5]=((edge>>2)&3)*64;b[1]=[0,0x14,0x24,0x34][edge>>4];add(6,s,a,b);
  const c=stateCpu(rom);fieldAddresses.forEach((address,i)=>c.m[address]=s[i]);c.y=0;c.call(0xd8d3);const records=[];
  const push=(x,y,t,f,p)=>{if(x<=-8||x>=160||y<=-8||y>=144)return;records.push(y+16,x+8,t,8+p+(f&1)+((f&64)?32:0)+((f&128)?64:0)+((f&32)?128:0));};
  for(let q=0;q<4;q++){const i=0x200+q*4;push(c.m[i+3]-40,c.m[i]+1-48,192+c.m[i+1],c.m[i+2],2);}
  for(const sprite of npcSprites(rom,s,a,b,0))push(...sprite,0);
  const oam=Buffer.alloc(160);Buffer.from(records).copy(oam);cases.at(-1).expected.oam=oam.toString('hex');edge++;
 }
 return [...cases,...npcAnimationFixtures(rom),...npcFixtures(rom),...npcDeferredFixtures(rom)];
}
