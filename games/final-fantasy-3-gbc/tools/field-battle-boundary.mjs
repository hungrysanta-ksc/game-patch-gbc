// Execute small, complete original consumers. No PPU/APU emulation, patched
// calls, synthesized battle result, or claim of a natural encounter here.
import {stateCpu} from './state-source.mjs';
import {check,hash} from './source.mjs';

const pattern=(n,seed)=>Buffer.from(Array.from({length:n},(_,i)=>(i*37+seed)&255));
const equal=(a,b,label)=>check(Buffer.from(a).equals(Buffer.from(b)),label);
function run(c,address,allowed){
 const write=c.write,writes=[];
 c.write=function(a,v){writes.push(a&65535);return write.call(this,a,v);};
 let steps;try{steps=c.call(address);}finally{c.write=write;}
 // call/RTS use the original stack; all other writes must fit the contract.
 for(const a of writes)check((a>=0x100&&a<0x200)||allowed(a),'Unexpected boundary write '+a.toString(16));
 return {steps,writes};
}
export function fieldBattleBoundaryAudit(rom,seeds=256){
 check(Number.isInteger(seeds)&&seeds>0&&seeds<=256,'Boundary seed count');
 const totals={seeds,boundaryCycles:0,calls:0,instructions:0,dpBytes:240,soundBytesExcluded:16,inventorySlots:32,irqBytes:6};
 const observed=[];
 for(let seed=0;seed<seeds;seed++){
  const c=stateCpu(rom);c.m.set(pattern(1024,seed),0x6000);
  // Two cycles on the same machine: the second must retain the first result.
  for(let cycle=0;cycle<2;cycle++){
   const dp=pattern(256,seed+cycle*91),irq=pattern(6,seed+cycle*17);
   c.m.set(dp);c.m.set(irq,0x100);c.m.fill(0xa5,0x7400,0x7570);
   const savedGame=Buffer.from(c.m.subarray(0x6000,0x6400));
   const invoke=(pc,allow)=>{const r=run(c,pc,allow);totals.calls++;totals.instructions+=r.steps;return r;};
   const push=invoke(0xfb17,a=>a>=0x7480&&a<0x7570);
   equal(c.m.subarray(0x7480,0x7550),dp.subarray(0,0xd0),'DP low save');
   equal(c.m.subarray(0x7550,0x7570),dp.subarray(0xe0),'DP high save');
   check(new Set(push.writes.filter(a=>a>=0x7480&&a<0x7570)).size===240,'DP saved extent');
   invoke(0xfab5,a=>a>=0x7ed9&&a<0x7edf);
   equal(c.m.subarray(0x7ed9,0x7edf),irq,'IRQ save');
   equal(c.m.subarray(0x100,0x106),[0x4c,0x57,0xfb,0x4c,0x30,0xfb],'Battle IRQ dispatch');
   invoke(0xbc12,a=>(a>=0x7400&&a<0x7440)||(a>=0x60c0&&a<0x6100));
   const expected=Buffer.from(savedGame);
   for(let i=0;i<32;i++){expected[0xc0+i*2]=savedGame[0xc0+i];expected[0xc1+i*2]=savedGame[0xe0+i];}
   equal(c.m.subarray(0x6000,0x6400),expected,'Entry only repacks inventory');
   // Inject boundary inputs, NOT gameplay: all persistent bytes change. A
   // whole-GameState restoration would wrongly discard these supplied bytes.
   for(let i=0;i<1024;i++)c.m[0x6000+i]^=(seed+i+cycle*3)|1;
   for(let i=0;i<256;i++)c.m[i]^=255;
   const liveSound=Buffer.from(c.m.subarray(0xd0,0xe0));
   const result=Buffer.from(c.m.subarray(0x6000,0x6400));
   invoke(0xfadd,a=>a>=0x100&&a<0x106);
   equal(c.m.subarray(0x100,0x106),irq,'Field IRQ restored');
   const pop=invoke(0xf83b,a=>a<0xd0||(a>=0xe0&&a<0x100));
   equal(c.m.subarray(0,0xd0),dp.subarray(0,0xd0),'Field DP low restored');
   equal(c.m.subarray(0xe0,0x100),dp.subarray(0xe0),'Field DP high restored');
   equal(c.m.subarray(0xd0,0xe0),liveSound,'Sound DP must stay live');
   check(!pop.writes.some(a=>a>=0xd0&&a<0xe0),'No sound DP rollback');
   equal(c.m.subarray(0x6000,0x6400),result,'Persistent result must survive context restore');
   invoke(0xbc2d,a=>a===0x2000||(a>=0x7400&&a<0x7440)||(a>=0x60c0&&a<0x6100));
   const unpacked=Buffer.from(result);
   for(let i=0;i<32;i++){unpacked[0xc0+i]=result[0xc0+i*2];unpacked[0xe0+i]=result[0xc1+i*2];}
   equal(c.m.subarray(0x6000,0x6400),unpacked,'Return keeps changed inventory and state');
   check(c.m[0x2000]===dp[255],'Original PPUCTRL restore');
   observed.push(Buffer.from(c.m.subarray(0x6000,0x6400)),liveSound);totals.boundaryCycles++;
  }
 }
 return {...totals,resultHash:hash(Buffer.concat(observed)),source:boundaryRanges.map(([bank,begin,end])=>({bank,begin,end,sha256:hash(rom.subarray(16+bank*8192+(begin&8191),16+bank*8192+(begin&8191)+end-begin))})),
  scope:'Original 6502 boundary execution with supplied RAM inputs; not NES timing/audio, natural battle, or GBC roundtrip evidence.'};
}
const boundaryRanges=[[0x3d,0xbc12,0xbc5b],[0x3f,0xfb17,0xfb30],[0x3f,0xf83b,0xf853],[0x3f,0xfab5,0xfae9]];
