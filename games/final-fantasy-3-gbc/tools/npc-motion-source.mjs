import {stateCpu,segment} from './state-source.mjs';
// Adapters only: expected NPC decisions execute the user's untouched ROM.
export function npcCpu(rom,f,a,b,layout,terrain,fill=0){
 const c=stateCpu(rom);c.banks=[0x3a,0x3b,0x3e,0x3f];c.m.set(a,0x7000);c.m.set(b,0x7100);
 for(const [i,address]of [[0,0x29],[1,0x2a],[2,0x35],[3,0x36],[4,0x33],[6,0xa5],[32,0xf0],[67,0x4a],[68,0xf4],[69,0x67],[70,0x68],[71,0x69]])c.m[address]=f[i]||0;
 c.m[0xf0]=f[73]??f[32]??0;
 if(layout)c.m.set(layout,0x7400);if(terrain)for(let i=0;i<128;i++)c.m[0x400+i]=terrain[i*2];c.m[0x4c]=fill;return c;
}
export function npcOriginal(rom,op,f,a,b,layout,terrain,fill){
 const c=npcCpu(rom,f,a,b,layout,terrain,fill);
 if(op===7||op===9)for(let i=0;i<192;i+=16)if(c.m[0x7000+i]){c.x=i;segment(c,0xb17c,0xb1ee);}
 if(op===8||op===9)c.call(0xaf97);
 const state=Buffer.from([f[32]||0,f[33]||0,c.m[0x4a],c.m[0xf4],c.m[0x67],c.m[0x68],c.m[0x69]]);
 return {motion:state,part1:Buffer.from(c.m.subarray(0x7000,0x70c0)),part2:Buffer.from(c.m.subarray(0x7100,0x71c0))};
}
export function npcSprites(rom,f,a,b,slot){
 const c=npcCpu(rom,f,a,b);c.x=slot;
 if(f[19])c.m[0xf0]=f[74]??f[32]??0;
 if(f[19]===2&&f[22]===slot&&!(a[slot+1]&0x30))c.m[0x700d+slot]|=128;
 c.call(0xb1ee);if(!c.m[0x26])return [];
 return Array.from({length:4},(_,q)=>{const i=0x200+q*4;return [c.m[i+3]-40,c.m[i]+1-48,(c.m[i+1]-32)&255,c.m[i+2]];});
}
export function npcFixtures(rom){
 const cases=[];
 function add(op,f,a,b,property=0,fill=1){
  f[26]=0xa5;f[27]=1;const layout=Buffer.alloc(1024,1),terrain=Buffer.alloc(256);terrain[0]=0x24;terrain[2]=property;
  const e=npcOriginal(rom,op,f,a,b,layout,terrain,fill);
  cases.push({op,field:f.subarray(0,28).toString('hex'),motion:Buffer.concat([f.subarray(32,34),f.subarray(67,72)]).toString('hex'),part1:a.toString('hex'),part2:b.toString('hex'),mapProperty:property,fill,expected:{field:f.subarray(0,28).toString('hex'),...Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v.toString('hex')]))}});
 }
 // Every speed mask, direction, subpixel phase, with and without contact;
 // visible objects share a frame but retain independent elevation/terrain.
 for(let mask=0;mask<16;mask++)for(let dir=0;dir<4;dir++)for(let sub=0;sub<16;sub++)for(const contact of [0,1]){
  const f=Buffer.alloc(72),a=Buffer.alloc(192),b=Buffer.alloc(192);f[32]=(mask*13+sub*7)&255;
  for(let i=0;i<192;i+=16){a[i]=(i===176&&sub&1)?0:i+1;a[i+2]=9;a[i+3]=10;a[i+4]=8;a[i+5]=9;a[i+6+(dir>>1)]=sub;a[i+8+(dir>>1)]=dir&1?255:1;a[i+12]=[1,2,8,4][dir];a[i+13]=contact?(i&32?128:1):0;b[i+2]=mask;b[i]=[0,0x14,0x24,0x34][(i>>4)&3];b[i+1]=0x55;b[i+6]=(i>>4)&3;}
  add(7,f,a,b);
 }
 // All property bytes, elevations and RNG indexes; blocked destinations consume
 // RNG but do not reset waits. Reservation checks use the destination z level.
 for(let p=0;p<256;p++)for(let z=0;z<4;z++){
  const f=Buffer.alloc(72),a=Buffer.alloc(192),b=Buffer.alloc(192);f[6]=(p>>2)&3;f[67]=176;f[68]=p;f[70]=10;f[71]=10;
  a[0]=1;a[2]=a[4]=10;a[3]=a[5]=10;a[14]=0x1a;a[15]=0xb4;b[6]=z;b[3]=p>>4;
  add(8,f,a,b,p);
 }
 // Stationary/hidden/countdown/already-moving returns, all cursor slots and
 // wrapping destinations, other-NPC/player reservations and palette retention.
 for(let n=0;n<512;n++){
  const f=Buffer.alloc(72),a=Buffer.alloc(192),b=Buffer.alloc(192),i=(n%12)*16;f[67]=(i+176)%192;f[68]=n&255;f[69]=n&1;f[70]=n&2?0:10;f[71]=n&2?0:10;f[6]=(n>>4)&3;
  a[i]=n%11?7:0;a[i+1]=((n>>3)&15)<<4;a[i+2]=a[i+4]=[0,10,31,63][n&3];a[i+3]=a[i+5]=[0,10,31,63][n>>2&3];a[i+11]=n%13===0?3:0;a[i+12]=n%17===0?1:0;a[i+14]=0x3a;a[i+15]=0xb4;b[i+6]=(n>>6)&3;b[i+3]=n&15;
  const other=(i+16)%192;a[other]=1;a[other+2]=f[70];a[other+3]=f[71];b[other+6]=(n>>8)&3;
  add(8,f,a,b,[0,1,2,4,0x14,0x24,0x34,128][n&7]);
 }
 // Deliberately reserve the chosen destination: test the player's pre-terrain
 // elevation check and another NPC's post-terrain check separately.
 const random=rom.subarray(16+63*8192+0x1e00,16+63*8192+0x1f00);
 for(let d=0;d<4;d++)for(let z=0;z<4;z++)for(let otherZ=0;otherZ<4;otherZ++)for(const player of [false,true]){
  const f=Buffer.alloc(72),a=Buffer.alloc(192),b=Buffer.alloc(192),x=10+(d===0?1:d===1?-1:0),y=10+(d===2?1:d===3?-1:0);
  f[67]=176;f[68]=(random.findIndex(v=>(v&3)===d)-1)&255;f[6]=otherZ;f[70]=player?x:20;f[71]=player?y:20;
  a[0]=1;a[2]=a[4]=10;a[3]=a[5]=10;a[14]=0x3a;a[15]=0xb4;b[6]=z;b[3]=7;
  if(!player){a[16]=2;a[18]=x;a[19]=y;b[22]=otherZ;}
  add(8,f,a,b,[0,1,2,4][d]);
 }
 return cases;
}
export function npcAnimationFixtures(rom){
 const cases=[];
 for(let type=0;type<16;type++)for(let frame=0;frame<32;frame++){
  const f=Buffer.alloc(72),a=Buffer.alloc(192),b=Buffer.alloc(192);f[0]=f[1]=3;f[4]=8;f[26]=0xa5;f[27]=1;f[32]=frame;
  for(const i of [0,16]){a[i]=1;a[i+1]=type*16;a[i+4]=9+i/8;a[i+5]=7;a[i+6]=frame&15;a[i+7]=frame&16?5:0;a[i+14]=0x1a+(frame&3)*16;a[i+15]=0xb4;b[i+5]=(type&3)*64;b[i+1]=(type>>2)*16;}
  const c=stateCpu(rom);c.m[0x29]=c.m[0x2a]=3;c.m[0x33]=8;c.y=0;c.call(0xd8d3);const records=[];
  const add=(x,y,t,z,p)=>{if(x<=-8||x>=160||y<=-8||y>=144)return;records.push(y+16,x+8,t,8+p+(z&1)+((z&64)?32:0)+((z&128)?64:0)+((z&32)?128:0));};
  for(let q=0;q<4;q++){const j=0x200+q*4;add(c.m[j+3]-40,c.m[j]+1-48,192+c.m[j+1],c.m[j+2],2);}
  for(const i of frame&1?[16,0]:[0,16])for(const sprite of npcSprites(rom,f,a,b,i))add(...sprite,0);
  const oam=Buffer.alloc(160);Buffer.from(records).copy(oam);const fields=f.subarray(0,28).toString('hex'),motion=Buffer.concat([f.subarray(32,34),f.subarray(67,72)]).toString('hex');
  cases.push({op:6,field:fields,motion,part1:a.toString('hex'),part2:b.toString('hex'),expected:{field:fields,motion,part1:a.toString('hex'),part2:b.toString('hex'),oam:oam.toString('hex')}});
 }
 return cases;
}
export function npcDeferredFixtures(rom){
 const cases=[],random=rom.subarray(16+63*8192+0x1e00,16+63*8192+0x1f00);
 for(let d=0;d<4;d++)for(let pose=0;pose<4;pose++)for(let palette=0;palette<4;palette++)for(const frame of [0,1]){
  const f=Buffer.alloc(72),a=Buffer.alloc(192),b=Buffer.alloc(192),layout=Buffer.alloc(1024,1),terrain=Buffer.alloc(256);terrain[0]=0x24;terrain[2]=4;
  f[0]=f[1]=3;f[4]=8;f[26]=0xa5;f[27]=1;f[32]=frame;f[67]=176;f[68]=(random.findIndex(v=>(v&3)===d)-1)&255;f[70]=f[71]=20;
  a[0]=1;a[2]=a[4]=10;a[3]=a[5]=8;a[14]=0x1a+pose*16;a[15]=0xb4;b[5]=palette*64;b[3]=6;
  const e=npcOriginal(rom,9,f,a,b,layout,terrain,1),c=stateCpu(rom);c.m[0x29]=c.m[0x2a]=3;c.m[0x33]=8;c.y=0;c.call(0xd8d3);const records=[];
  const add=(x,y,t,z,p)=>records.push(y+16,x+8,t,8+p+(z&1)+((z&64)?32:0)+((z&128)?64:0)+((z&32)?128:0));
  for(let q=0;q<4;q++){const j=0x200+q*4;add(c.m[j+3]-40,c.m[j]+1-48,192+c.m[j+1],c.m[j+2],2);}
  // B17C is stationary here. Command 6 draws this old pose before AF97.
  for(const sprite of npcSprites(rom,f,a,b,0))add(...sprite,0);const oam=Buffer.alloc(160);Buffer.from(records).copy(oam);
  const fields=f.subarray(0,28).toString('hex'),motion=Buffer.concat([f.subarray(32,34),f.subarray(67,72)]).toString('hex');
  cases.push({op:9,field:fields,motion,part1:a.toString('hex'),part2:b.toString('hex'),mapProperty:4,fill:1,expected:{field:fields,...Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v.toString('hex')])),oam:oam.toString('hex')}});
 }
 return cases;
}
