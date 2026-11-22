import {Driver6502} from './driver6502.mjs';
import {check} from './source.mjs';
const state=c=>Buffer.concat([Buffer.from(c.m.subarray(0x7f40,0x8000)),Buffer.from(c.m.subarray(0x4000,0x4018))]);
const u16=n=>Buffer.from([n&255,n>>8]);
function copy(c){const d=new Driver6502(c.rom);d.m.set(c.m);d.banks=[...c.banks];return d;}

export function makeChannelFixtures(data){
 const cases=[],commands=new Set(),pcs=new Set();let maxReads=0;
 function record(c,op,label,continuation=false){
  const before=state(c),reads=new Map(),read=c.read.bind(c),byte=c.byte.bind(c),step=c.step.bind(c);let fetching=false;
  c.read=a=>{const v=read(a);if(!fetching&&(a>=0x8000||(a>=0x6000&&a<0x7f40))){check(!reads.has(a)||reads.get(a)===v,'Mutable fixture lookup');reads.set(a,v);}return v;};
  c.byte=()=>{fetching=true;const v=byte();fetching=false;return v;};
  c.step=()=>{pcs.add(c.pc);if(c.pc===0x8217)commands.add(read((c.m[0xd3]|c.m[0xd4]<<8)+c.y));step();};
  c.writes=[];c.call(op?0x857d:0x81e6);
  c.read=read;c.byte=byte;c.step=step;
  const entries=[...reads].sort((a,b)=>a[0]-b[0]);maxReads=Math.max(maxReads,entries.length);
  check(entries.length<=512&&c.writes.length<128,'Fixture capacity');
  const prefix=Buffer.concat([Buffer.from([op|(continuation?128:0),c.m[0xd0],c.m[0xd1],c.m[0xd2]]),before,u16(entries.length),...entries.map(([a,v])=>Buffer.from([a&255,a>>8,v]))]);
  const bytes=Buffer.concat([prefix,state(c),Buffer.from([c.writes.length,...c.writes.flatMap(([a,v])=>[a-0x4000,v])])]);
  cases.push({label,op,continuation,reads:entries.length,expectedOffset:prefix.length,bytes});
 }
 // Capture real entry states; execute a separate clone so observation cannot
 // change the original playback trajectory, stack or mapper state.
 for(const [kind,total,ticks,samples] of [['song',65,1200,[0,1,127,511,1199]],['effect',97,512,[0,1,63,255,511]]]){
  for(let id=0;id<total;id++){
   const c=new Driver6502(data);c.call(0x8000);
   if(kind==='song'){c.m[0x7f43]=id;c.m[0x7f42]=1;}else c.m[0x7f49]=128|id;
   const step=c.step.bind(c);let tick=0;
   c.step=()=>{if(samples.includes(tick)&&(c.pc===0x81e6||c.pc===0x857d))record(copy(c),c.pc===0x857d?1:0,`${kind}-${id}-tick-${tick}-ch-${c.m[0xd0]}-${c.pc.toString(16)}`);step();};
   for(;tick<ticks;tick++){c.writes=[];c.call(0x8003);}
  }
 }
 function base(ch=0,format=4,effect=0){const c=new Driver6502(data);c.call(0x8000);c.m[0xd0]=ch;c.m[0xd1]=format;c.m[0xd2]=effect;c.m[0x7f4a+ch]=128;c.m[0x7f51+ch]=0;c.m[0x7f58+ch]=0x60;c.m[0x7fa5+ch]=255;c.m[0x7f44]=15;c.m[0x7f90+ch]=15;c.m[0x7feb+ch]=128;return c;}
 function script(bytes,label,{format=4,ch=0,effect=0,setup=()=>{},ticks=1}={}){const c=base(ch,format,effect);c.m.set(bytes,0x6000);setup(c);for(let t=0;t<ticks;t++)record(c,0,label+'-'+t,t>0);}
 for(let note=0;note<224;note++)for(let format=0;format<5;format++)script([note,0xd0,0xdf,0xff],`note-${note}-format-${format}`,{format});
 for(let op=0xe0;op<0xfb;op++){
  const args=op===0xe0||op===0xf8?[0x95]:op>=0xf5&&op<=0xf7?[1,128]:[];
  script([op,...args,0x0f,255],`command-${op}`);
 }
 for(const depth of [0,1])for(const count of [0,1,2,3,255])for(const op of [0xfc,0xfd])script([op,0x10,0x60,0x0f,255],`repeat-${op}-${depth}-${count}`,{setup:c=>{c.m[0x7fa5]=depth;c.m[depth?0x7fb3:0x7fac]=count;c.m.set([0x1f,255],0x6010);}});
 script([0xfb,0,0x0f,0xfc,2,0x60,255],'repeat-zero-256-iterations',{ticks:258});
 script([0xfb,3,0xfb,2,0x0f,0xfc,4,0x60,0xfc,2,0x60,255],'nested-repeat',{ticks:9});
 script([0xfe,0x10,0x60],'jump',{setup:c=>c.m.set([0x0f,255],0x6010)});
 script([0x00,...Array(20).fill(0xd0),255],'tie-decay-16bit');
 script([...Array(255).fill(0xee),0x0f],'index-wrap');
 for(const format of [0,1,2,3,4])for(const effect of [0,255])for(const owned of [0,128])script([255],`end-${format}-${effect}-${owned}`,{format,ch:effect?5:0,effect,setup:c=>{c.m[0x7f4f]=owned;c.m[0x7f50]=owned;c.m[0x7f4a+(effect?5:0)]=128;}});
 for(const vol of [4,5])script([0x0f,255],`dac-threshold-${vol}`,{format:0,setup:c=>c.m[0x7f44]=vol});
 // Private synthetic tables replace pointers only in an in-memory copy. The
 // source file is immutable; these cases make no gameplay reachability claim.
 function env(setup,label,ticks=1){const c=base();c.rom=Buffer.from(data);const put=(a,v)=>{c.rom[16+0x36*8192+(a&8191)]=v;};put(0x9a7c,0);put(0x9a7d,0x61);put(0x9eab,0);put(0x9eac,0x65);
  c.m.set([0,0x62,0,0x63,0,0x64],0x6100);c.m.set([3,9,15,255],0x6200);c.m.set([25,2,1,2,255,252],0x6300);c.m.set([50,1,254,0],0x6400);c.m.set([2,3,2,253,252],0x6500);
  c.m[0x7feb]=0;c.m[0x7f97]=8;setup(c);
  for(let t=0;t<ticks;t++)record(c,1,label+'-'+t,t>0);
 }
 env(()=>{},'attack-decay-modulation',64);
 env(c=>{c.m[0x7fba]=1;c.m[0x7fe4]=15;c.m[0x7f97]=0;},'release-to-silence',40);
 for(const phase of [0,1,2,3])for(const value of [0,1,15])for(const rate of [0,99,100,255])env(c=>{c.m[0x7fba]=phase;c.m[0x7fe4]=value;c.m[0x7fd6]=rate;c.m[0x7fdd]=99;c.m[0x7fc8]=1;},`envelope-${phase}-${value}-${rate}`);
 for(const delta of [0,1,15,127,128,240,255])for(const value of [0,1,15,254,255])env(c=>{c.m[0x7fba]=1;c.m[0x7fe4]=value;c.m[0x6300]=0;c.m[0x6302]=delta;c.m[0x7f6d]=value;c.m[0x7f74]=7;c.m[0x6501]=delta;},`clamps-${delta}-${value}`);
 for(const flags of [0,2,128,130])for(const effect of [0,255])for(const vol of [4,5])env(c=>{c.m[0x7f4a]=flags;c.m[0xd2]=effect;c.m[0x7f44]=vol;c.m[0x7fc1]=128;c.m[0x7feb]=128;},`flags-${flags}-${effect}-${vol}`);
 check(commands.size===256,'All note and command bytes must execute');
 return {cases,data:Buffer.concat(cases.map(c=>c.bytes)),coverage:{commands:[...commands].sort((a,b)=>a-b),pcs:[...pcs].sort((a,b)=>a-b),maxReads,realSongs:65,realEffects:97,songTicks:1200,effectTicks:512,continuousCases:cases.filter(c=>c.continuation).length}};
}
