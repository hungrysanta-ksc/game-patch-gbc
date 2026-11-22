// NES register timeline -> CGB register-independent frame packets.
// Deliberate approximations are counted and emitted in the build report.
const periods=[4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068];
const divs=[8,16,32,48,64,80,96,112];
function gbPitch(t){return Math.max(0,Math.min(2047,2048-Math.round(2097152*(t+1)/1789773)));}
export function convertAudio(result){
 const regs=new Uint8Array(24),timers=[0,0],divider=[0,0],reload=[false,false];const packets=[];let pops=0,noiseCollisions=0,sweepFrames=0,pitchClamps=0;
 for(let f=0;f<result.output.length;f++){
  let trigger=0,pop=false;
  for(const[a,v]of result.allWrites[f]){const i=a-0x4000;regs[i]=v;
   if(i===2||i===3)timers[0]=regs[2]|((regs[3]&7)<<8);if(i===6||i===7)timers[1]=regs[6]|((regs[7]&7)<<8);
   if(i===1)reload[0]=true;if(i===5)reload[1]=true;if(i===3)trigger|=1;if(i===7)trigger|=2;if(i===11)trigger|=4;if(i===15)trigger|=8;if(i===17&&v)pop=true;
  }
  const p=[];
  for(let ch=0;ch<2;ch++){
   const r=ch*4,s=regs[r+1];if(s&128)sweepFrames++;
   // Software approximation of the NES 120 Hz sweep divider, two ticks/frame.
   for(let tick=0;tick<2;tick++){let shift=s&7,target=timers[ch]+((s&8)?-(timers[ch]>>shift)-(ch===0?1:0):(timers[ch]>>shift));if(divider[ch]===0&&(s&128)&&shift&&timers[ch]>=8&&target<=2047)timers[ch]=Math.max(0,target);if(!divider[ch]||reload[ch]){divider[ch]=(s>>4)&7;reload[ch]=false;}else divider[ch]--;}
   const target=timers[ch]+((s&8)?-(timers[ch]>>(s&7))-(ch===0?1:0):(timers[ch]>>(s&7)));let volume=regs[r]&15;
   if(timers[ch]<8||target>2047)volume=0;const freq=gbPitch(timers[ch]);if(freq===0&&volume)pitchClamps++;
   p.push(freq&255,freq>>8,(regs[r]&192)|volume);
  }
  const tri=regs[10]|((regs[11]&7)<<8),tf=gbPitch(tri);p.push(tf&255,tf>>8,(regs[8]&127)?0x20:0);
  const goal=1789773/periods[regs[14]&15];let nr=0,error=Infinity;
  for(let shift=0;shift<14;shift++)for(let ratio=0;ratio<8;ratio++){const hz=4194304/(divs[ratio]*2**shift),e=Math.abs(Math.log(hz/goal));if(e<error){error=e;nr=(shift<<4)|ratio;}}
  nr|=(regs[14]&128)?8:0;p.push(nr,regs[12]&15);
  if(pop){pops++;if(p[10])noiseCollisions++;trigger|=16;}p.push(trigger);packets.push(Uint8Array.from(p));
 }
 return {packets,metrics:{frames:packets.length,dmcPopEvents:pops,dmcNoiseCollisions:noiseCollisions,sweepFrames,pitchClamps,approximations:['Noise LFSR clock/sequence differs','Software sweep sampled at source-frame boundaries','CGB volume changes may retrigger pulse phase','DMC pop is an optional 0.49 ms CH4 burst, temporarily borrowing noise; comparison candidate, not adopted final fidelity']}};
}
export function packFrames(packets){const chunks=[];for(let i=0;i<packets.length;){let n=1;while(n<255&&i+n<packets.length&&!packets[i][11]&&Buffer.from(packets[i+n]).equals(Buffer.from(packets[i])))n++;chunks.push(n,...packets[i]);i+=n;}return Buffer.from(chunks);}
