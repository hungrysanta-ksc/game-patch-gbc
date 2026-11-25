import {Driver6502} from './driver6502.mjs';import {check} from './source.mjs';
// Execute the original SFX request/VM/output paths separately from BGM.
// This observes channel ownership, not acoustic quality or every effect loop.
export function battleSoundChannels(rom){
 const effects=[];
 for(let id=0;id<97;id++){
  const c=new Driver6502(rom);c.call(0x8000);c.m[0x7f49]=128|id;c.call(0x8b9d);
  const pulse=!!(c.m[0x7f4f]&128),noise=!!(c.m[0x7f50]&128),ports=new Set();
  for(let tick=0;tick<128;tick++){c.writes=[];c.call(0x8030);for(const [a]of c.writes)ports.add(a);c.call(0x8b9d);}
  check([...ports].every(a=>(a>=0x4004&&a<=0x4007)||(a>=0x400c&&a<=0x400f)),'Original SFX output channel');
  effects.push({id,pulse,noise,ports:[...ports].sort((a,b)=>a-b)});
 }
 const c=new Driver6502(rom);c.call(0x8000);c.m[0x7f43]=0x20;c.m[0x7f42]=1;let dac=0;
 for(let tick=0;tick<1200;tick++){c.writes=[];c.call(0x8003);dac+=c.writes.filter(([a,v])=>a===0x4011&&(v&127)).length;}
 check(dac>0,'Battle BGM uses direct DAC without an SFX request');
 return {effects,battleMusicDirectDacWrites:dac,source:'36/8B9D,8BB8,8030,8310; music 20 with no SFX request',scope:'97 SFX slots × 128 updates and 1200 battle BGM ticks; not all loop durations or timbre equivalence'};
}
