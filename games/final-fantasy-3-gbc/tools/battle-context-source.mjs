import {check} from './source.mjs';
import {encounterSeedOriginal,encounterSeedCases} from './encounter-seed-source.mjs';
import {playSeedOriginal,playSeedCases} from './play-seed-source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {physicalRng} from './battle-physical-source.mjs';
import {initializedBattle,displayStatus} from './battle-transition-source.mjs';
export const contextSizes=[0,26,8,578,30,634,258,272];
const select=(c,p)=>{c.banks=[p*2,p*2+1,62,63];c.m[0x7cf6]=p;};
export function contextReference(rom){
 const table=physicalRng(rom),c=battleCpu(rom);
 return(op,input,counters=[17,0,239])=>{
  check(input.length===contextSizes[op],'Context ABI');const s=Buffer.from(input);c.m.fill(0);c.s=255;c.p=0x24;c.a=c.x=c.y=0;c.m.set(table,0x7be3);c.m.set(counters,0x15);let ok=1;
  if(op===1){select(c,0x1a);c.m.set([0,0x62,0x75,0x75],0x59);c.m[0x7ed8]=s[0];c.m[0x7cee]=s[1];c.m[0x74c6]=s[2];c.m[0x78b7]=s[3];for(let i=0;i<12;i++)c.m[0x7575+i*64]=s[4+i];for(let i=0;i<4;i++){c.m[0x620f+i*64]=s[16+i];c.m[0x75a8+i*64]=s[20+i];}c.call(0x87be);s[0]=c.m[0x7ed8];s[3]=c.m[0x78b7];for(let i=0;i<4;i++){s[16+i]=c.m[0x620f+i*64];s[20+i]=c.m[0x75a8+i*64];}s[24]=c.m[0x78c3];s[25]=c.m[0x78ba];}
  if(op===2){select(c,0x1a);c.m.set([0x75,0x75],0x5b);c.m.set(s.subarray(0,2),0x7576);c.call(0x9d1d);s.set(c.m.subarray(0x78bb,0x78bd),2);s[4]=c.m[0x78c4];select(c,0x17);c.m.set(s.subarray(2,4),0x99);c.x=0;c.call(0xb607);c.call(0xb5f2);s[5]=c.m[0x7d83];c.m[0x7da3]=255;
   const step=c.step.bind(c),loads=new Map([[0xaaab,2],[0xaa95,3],[0xaad6,1],[0xaac1,0]]);c.step=function(){if(loads.has(this.pc)){this.m[0x7da3]=loads.get(this.pc);this.pc=((this.pop()|(this.pop()<<8))+1)&65535;}else step();};c.call(0xb651);c.step=step;s[6]=c.m[0x7da3];s[7]=+(!!(s[2]&64)&&!(s[2]&128));}
  if(op===3){select(c,0x1a);c.m.set(s.subarray(0,512),0x7675);c.call(0xa487);s.set(c.m.subarray(0x7675,0x7875));s.set(c.m.subarray(0x7e4f,0x7e6f),512);s.set(c.m.subarray(0xe0,0x100),544);s[576]=c.m[0x7ec2];s[577]=c.m[0x7e9a];}
  if(op===4){if(![3,7].includes(s[24]))ok=0;else{select(c,0x18);c.m.set([0x75,0x75],0x6e);c.m.set([0x75,0x76],0x22);for(let i=0;i<8;i++){c.m.set(s.subarray(i*2,i*2+2),0x7676+i*64);c.m[0x76a1+i*64]=s[16+i];}c.m[0x75a4]=s[25];c.m[0x78d8]=s[28];c.m[0x7e99]=s[29];c.a=s[24];c.call(0xa300);s[25]=c.m[0x75a4];s[26]=c.m[0x30];s[27]=c.m[0x69];s[28]=c.m[0x78d8];s[29]=c.m[0x7e99];}}
  if(op===5){if(s[609]>7||s[613]>=20||(s[609]*64+44<512&&(s[s[609]*64+44]&7)!==s[609]))ok=0;else{select(c,0x18);const at=0x7675+s[609]*64;c.m.set(s.subarray(0,512),0x7675);c.m.set(s.subarray(512,576),0x7575);c.m.set([0x75,0x75,at&255,at>>8],0x6e);c.m[0x64]=s[609]*2;c.m[0x68]=s[609];c.m.set(s.subarray(576,592),0xe0);c.m.set(s.subarray(592,600),0x7da7);c.m.set(s.subarray(600,608),0x7ec4);c.m[0x7be1]=s[608];c.m.set(s.subarray(610,612),0xbb);c.m[0x7ee1]=s[612];c.m[0x78ee]=s[613];c.m.set(s.subarray(614),0x78da);c.call(0xbf53);s.set(c.m.subarray(0x7675,0x7875));s.set(c.m.subarray(0xe0,0xf0),576);s.set(c.m.subarray(0x7da7,0x7daf),592);s.set(c.m.subarray(0x7ec4,0x7ecc),600);s[608]=c.m[0x7be1];s[612]=c.m[0x7ee1];s.set(c.m.subarray(0x78da,0x78ee),614);}}
  if(op===6)s[257]=encounterSeedOriginal(rom,s.subarray(0,256),s[256]).seed;
  if(op===7)s[271]=playSeedOriginal(rom,s.subarray(0,79),s.subarray(79,271));
  return{ok,state:s,counters:Buffer.from(c.m.subarray(0x15,0x18))};
 };
}
export function contextCases(){const rows=[],add=(op,s,n=0)=>rows.push({op,state:s,counters:[17,n,239]});
 for(let flags=0;flags<256;flags++)for(const vehicle of [0,6,7])for(const world of [0,1]){const s=Buffer.alloc(26,77);s.set([flags,world,vehicle,255]);s.set([0,1,33,98,1,1,0,0,99,0,0,0],4);add(1,s,flags);}
 for(const levels of [[0,0],[0,1],[1,0],[1,99],[99,1],[255,255]])for(let n=0;n<256;n+=7){const s=Buffer.alloc(26);s.fill(levels[0],4,8);s.fill(levels[1],8,16);add(1,s,n);}
 for(let a=0;a<256;a++)for(let b=0;b<256;b+=32)for(const partial of [0,2,4,6]){const s=Buffer.alloc(8,0xaa);s[0]=a;s[1]=b|partial;add(2,s);}
 for(let mask=0;mask<256;mask++){const s=Buffer.alloc(578,0xaa);for(let i=0;i<8;i++){s[i*64+1]=(mask&(1<<i))?128:[0,64,32,8][i&3];s.writeUInt16LE([0,1,249,250,251,312,313,65535][i],i*64+3);}add(3,s,mask);}
 for(const limit of [3,7])for(let mask=0;mask<256;mask++){const s=Buffer.alloc(30);for(let i=0;i<8;i++){s[i*2]=(mask&(1<<i))?[128,64,0][i%3]:0;s[i*2+1]=(mask&(1<<i))&&i%3===2?1:0;s[16+i]=128|i;}s.set([limit,17,99,99,55,66],24);add(4,s,mask);}
 for(const target of [0,7])for(const blocked of [0,1,2,3,4,5,6,7,8,9,10])for(const vacant of [0,3,5,6,7,8]){const s=Buffer.alloc(634);for(let i=0;i<8;i++){s.fill(i+11,i*64,(i+1)*64);s[i*64+44]=128|i;s[i*64+56]=79;s[592+i]=i<6?i%4:255;s[600+i]=255;}if(vacant<8)s[592+vacant]=255;s[608]=255;s[609]=target;s[610]=2;s[612]=255;s[512+49]=1;s[512+50]=1;s.fill(255,614);s[576+target*2]=blocked===1?128:blocked===2?64:blocked===3?32:blocked===4?8:0;s[577+target*2]=blocked===5?128:blocked===6?32:0;if(blocked===7)s[610]=0;if(blocked===8)s[target*64+56]=0;if(blocked===9)s[512+22]=s[512+27]=2;if(blocked===10){s[512+49]=0;s[512+27]=2;}add(5,s);}
 for(const {dp,flags}of encounterSeedCases()){const s=Buffer.concat([dp,Buffer.from([flags,0xa5])]);add(6,s);}
 for(const s of playSeedCases())add(7,s);
 return rows;
}
export function contextFixtures(rom,extra=[]){const run=contextReference(rom),chunks=[],rows=[...contextCases(),...extra],counts={};
 // Choose exact HP boundaries from the source RNG result, not a guessed roll.
 const base=Buffer.alloc(578);for(let i=0;i<8;i++)base[i*64+1]=128;base[1]=0;base.writeUInt16LE(500,3);
 const damage=run(3,base).state.readUInt16LE(512);
 for(const delta of [-1,0,1]){const state=Buffer.from(base);state.writeUInt16LE(damage+delta,3);rows.push({op:3,state,counters:[17,0,239]});}
 for(const limit of [0,4,255]){const state=Buffer.alloc(30,13);state[24]=limit;rows.push({op:4,state,counters:[17,9,239]});}
 for(const [at,value] of [[609,8],[613,20],[44,7]]){const state=Buffer.alloc(634);state[at]=value;rows.push({op:5,state,counters:[17,9,239]});}
 for(const c of rows){const r=run(c.op,c.state,c.counters),size=Buffer.alloc(2);size.writeUInt16LE(c.state.length);chunks.push(Buffer.from([c.op]),size,c.state,Buffer.from(c.counters),Buffer.from([r.ok]),r.state,r.counters);counts[c.op]=(counts[c.op]||0)+1;}return{bytes:Buffer.concat(chunks),table:physicalRng(rom),cases:rows.length,counts,negativeOffset:3+26+4};}

// Execute actual graphics loads and entry movement with persistent party
// status already present. This models transfers/OAM, not PPU pixels or audio.
export function initialPartyPresentation(rom,{partyStatus,back=false,jobs=[0,1,2,3],rows=[0,1,0,1]}){
 const {m}=initializedBattle(rom,{formation:3,back,rows,terrain:0,jobs,partyStatus}),c=m.c;
 m.begin();m.call(0xb469);m.finish();
 const members=partyStatus.map((raw,i)=>{const expected=displayStatus(raw,0),oam=c.m.subarray(0x2a0+i*24,0x2b8+i*24);const live=Array.from({length:6},(_,n)=>n).filter(n=>oam[n*4]<240&&oam[n*4+1]!==0).length;
  check(c.m[0x7576+i*64]===raw&&c.m[0x7577+i*64]===0,'Initial persistent/transient status');
  check(c.m[0x7d83+i]===expected.pose&&c.m[0x7da3+i]===expected.graphics,'Initial pose/graphics');
  check(expected.stone?live===0:live>0,'Initial stone BG / OBJ');
  return {raw,...expected,liveObj8:live};});
 return {members,boundaries:m.waits,scope:'Original A400,9D06,9D5F,B469 with supplied persistent statuses; NMI/raster/audio intercepted'};
}

// Original A50B controls these calls. Intercept consumers to isolate ordering;
// this is deliberately not proof that their animation/audio is implemented.
export function cannonDispatchReference(rom,{victory=false}={}){
 const c=battleCpu(rom);select(c,0x1a);c.m[0x7ed8]=0xa8;const calls=[],step=c.step.bind(c);
 c.step=function(){const pc=this.pc;if([0xfa0e,0x8f0b,0x8ff7,0xa458,0x811c].includes(pc)){
  calls.push({pc,a:this.a,flags:this.m[0x7ed8],message:this.m[0x78da],script:this.m[0x78d5]});
  if(pc===0xa458)this.m[0x78d3]=victory?0x40:0;
  if(pc===0x811c){this.pc=0x5000;return;}
  this.pc=((this.pop()|(this.pop()<<8))+1)&65535;return;
 }step();};c.pc=0xa50b;c.push(0x4f);c.push(0xff);let count=0;while(c.pc!==0x5000){check(++count<1000,'Cannon dispatch budget');c.step();}return calls;
}
