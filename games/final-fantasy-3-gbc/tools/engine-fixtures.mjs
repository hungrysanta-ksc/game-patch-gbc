import {Driver6502} from './driver6502.mjs';
import {check} from './source.mjs';
export function sourceAction(c,op,arg){switch(op){case 1:c.m.fill(0);c.banks=[0x36,0x37,0x3e,0x3f];c.call(0x8000);break;case 2:case 3:c.m[0x7f43]=arg;c.m[0x7f42]=op===3?9:1;break;case 4:c.m[0x7f42]=2;break;case 5:c.m[0x7f42]=4;break;case 6:c.m[0x7f42]=12;break;case 7:c.m[0x7f49]=128|arg;break;case 8:c.m[0x7f49]=255;break;default:check(op>=9&&op<=14,'Unknown action');c.m[[0,0,0,0,0,0,0,0,0,0x7f45,0x7f46,0x7f47,0x7f42,0x7f44,0x7f48][op]]=arg;}}
export function engineScenarios(){const scenarios=[];const add=(label,ticks,events)=>scenarios.push({label,ticks,events});
 for(let id=0;id<65;id++)add('song-'+id,96,{0:[[1,0],[2,id]],32:[[2,id]],64:[[7,id%97]]});
 for(let id=0;id<97;id++)add('effect-'+id,32,{0:[[1,0],[2,0x20]],1:[[7,id]],12:[[7,id]],20:[[7,(id+1)%97]],28:[[8,0]]});
 add('fade-in-out',520,{0:[[1,0],[3,0x20]],250:[[6,0]]});
 add('interrupt-resume',360,{0:[[1,0],[2,0x20]],60:[[2,0x2b]],180:[[4,0]],250:[[5,0]],280:[[4,0]]});
 add('protected-song37',360,{0:[[1,0],[2,0x37]],30:[[2,0x20]],90:[[7,1]],120:[[6,0]],350:[[2,0x20]]});
 add('fade-effect-ownership',520,{0:[[1,0],[3,0x20]],1:[[7,0]],100:[[7,30]],200:[[6,0]],201:[[7,7]],400:[[4,0]]});
 // State interventions cover request priority, 8-bit wrap and tempo borrowing.
 for(const flags of [0,1,2,3,4,5,6,7,9,12,32,64,128,160,192,255])add('flags-'+flags,5,{0:[[1,0],[2,0x20]],2:[[12,flags]]});
 for(const tempo of [0,1,149,150,151,255])for(const counter of [0,149,150,255,256,511])add('tempo-'+tempo+'-'+counter,5,{0:[[1,0],[2,0x20]],2:[[9,tempo],[10,counter&255],[11,counter>>8]]});
 for(const flags of [160,192])for(const volume of [0,1,14,15,255])for(const counter of [0,1,15,255])add('fade-edge-'+flags+'-'+volume+'-'+counter,4,{0:[[1,0],[2,0x20]],2:[[12,flags],[13,volume],[14,counter]]});
 return scenarios;
}
export function makeEngineFixtures(data){const c=new Driver6502(data),parts=[],cases=[],scenarios=engineScenarios();let total=0,writes=0;const pcs=new Set();const step=c.step.bind(c);c.step=()=>{if(c.pc>=0x8925&&c.pc<0x8b9d)pcs.add(c.pc);step();};
 for(const scenario of scenarios)for(let tick=0;tick<scenario.ticks;tick++){
  const actions=scenario.events[tick]||[];c.writes=[];for(const [op,arg]of actions)sourceAction(c,op,arg);c.call(0x8003);check(c.writes.length<128,'Write log capacity');
  const bytes=Buffer.concat([Buffer.from([actions.length,...actions.flat()]),Buffer.from(c.m.subarray(0x7f40,0x8000)),Buffer.from(c.m.subarray(0x4000,0x4018)),Buffer.from([c.writes.length,...c.writes.flatMap(([a,v])=>[a-0x4000,v])])]);
  cases.push({scenario:scenario.label,tick,offset:total,bytes:bytes.length});total+=bytes.length;writes+=c.writes.length;parts.push(bytes);
 }
 return {data:Buffer.concat(parts),cases,scenarios,writes,pcs:[...pcs].sort((a,b)=>a-b)};
}
