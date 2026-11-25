import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {segment} from './state-source.mjs';
import {contextReference} from './battle-context-source.mjs';
import {offset} from './render-budget-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
export const openingSize=712,openingCore=705;
export const openingEvent={graphics:1,clear:2,message:3,close:4,button:5,wait:6,select:7,caller:8,victory:9,auto:10,item:11};
const select=(c,p)=>{c.banks=[p*2,p*2+1,62,63];},ret=c=>{c.pc=((c.pop()|(c.pop()<<8))+1)&65535;};
export function openingScript(rom){const at=rom.readUInt16LE(offset(0x34,0x950d+3*2)),bytes=rom.subarray(offset(0x34,at),offset(0x34,at)+7);check(bytes.equals(Buffer.from([9,11,12,14,10,4,255])),'Supported original cannon action script');return {at,bytes};}
// Original collector -> A50B -> entire action script -> A458 -> collector.
// Text/PPU consumers are explicit yield boundaries. The graphics adapter runs
// original metadata routines; it does not claim to execute raster/OAM/audio.
export function openingReference(rom,input,{shortWait=false,graphicsMachine}={}){
 openingScript(rom);check(input.length===openingSize,'Opening ABI');const c=graphicsMachine?.c??battleCpu(rom,0x1a),initial=Buffer.from(input),view=contextReference(rom);select(c,0x1a);
 c.m.set([0,0x61,0,0x62,0x75,0x75],0x57);c.m[0x7cf6]=0x17;c.m[0x52]=0;
 const fields=[[1,26],[2,30],[35,38],[44,46],[63,50]];
 c.m.set(initial.subarray(2,6),0x78cf);c.m.set(initial.subarray(6,10),0x7ac3);c.m.set(initial.subarray(22,26),0x7e0f);c.m.set(initial.subarray(42,46),0x7ce4);c.m[0x7be1]=initial[54];
 for(let i=0;i<4;i++){const a=0x7575+i*64;c.m.set(initial.subarray(10+i*3,13+i*3),a+46);for(const[o,f]of fields)c.m[a+o]=initial[f+i];const s=Buffer.alloc(8);s[0]=initial[26+i];s[1]=initial[30+i];initial.set(view(2,s).state,633+i*8);}
 c.call(0x9d06);c.m.set(c.m.subarray(0x78bb,0x78c3),0x7d9b);
 c.m.set(initial.subarray(55,567),0x7675);c.m.set(initial.subarray(567,599),0x7e4f);c.m.set(initial.subarray(599,631),0xe0);c.m[0x7ec2]=initial[631];c.m[0x7e9a]=initial[632];
 for(const [at,n,len]of [[665,0x7da7,8],[673,0x7daf,8],[681,0x7ec4,8],[689,0x7dd3,4],[693,0x7dce,4]])c.m.set(initial.subarray(at,at+len),n);
 c.m[0x7dd2]=initial.subarray(693,697).reduce((a,b)=>a+b,0);c.m[0x7ed8]=initial[697];c.m[0x78ba]=initial[698];c.m[0x7cf3]=initial[699];c.m[0x78d3]=initial[700];c.m[0x6010]=initial[701];c.m[0x78da]=initial[702];c.m[0x78ee]=initial[703];c.m[0x7e6f]=initial[704];c.m[0x7ee1]=255;c.m.fill(255,0x78d6,0x78da);
 const rows=[];let terminal=false,steps=0;
 function snapshot(kind,value,phase=0){const s=Buffer.from(initial.subarray(0,openingCore));s[0]=c.m[0x52];s[1]=phase;s.set(c.m.subarray(0x78cf,0x78d3),2);s.set(c.m.subarray(0x7ac3,0x7ac7),6);s.set(c.m.subarray(0x7e0f,0x7e13),22);s.set(c.m.subarray(0x7ce4,0x7ce8),42);s[54]=c.m[0x7be1];
  for(let i=0;i<4;i++){const a=0x7575+i*64;s.set(c.m.subarray(a+46,a+49),10+i*3);for(const[o,f]of fields)s[f+i]=c.m[a+o];s[34+i]=c.m[0x78bb+i*2];}
  s.set(c.m.subarray(0x7675,0x7875),55);s.set(c.m.subarray(0x7e4f,0x7e6f),567);s.set(c.m.subarray(0xe0,0x100),599);s[631]=c.m[0x7ec2];s[632]=c.m[0x7e9a];
  for(const [at,n,len]of [[665,0x7da7,8],[673,0x7daf,8],[681,0x7ec4,8],[689,0x7dd3,4],[693,0x7dce,4]])s.set(c.m.subarray(n,n+len),at);
  s.set([c.m[0x7ed8],c.m[0x78ba],c.m[0x7cf3],c.m[0x78d3],c.m[0x6010],c.m[0x78da],c.m[0x78ee],c.m[0x7e6f]],697);
  const buttons=kind===5?1:kind===6&&shortWait?1:0;rows.push({kind,value,buttons,state:s});c.m[0x12]=buttons;
 }
 function graphicsMetadata(id){const banks=c.banks.slice();select(c,0x17);
  if(id===0){segment(c,0xad78,0xad7b);c.call(0xb909);}
  if(id===10){c.a=c.m[0x7e];c.call(0xbaee);segment(c,0xbaa2,0xbab7);c.call(0xb909);}
  if(id===11){c.a=c.m[0x7e];segment(c,0xb959,0xb96f);c.call(0xb909);}
  c.banks=banks;
 }
 let insideGraphics=false;const step=c.step.bind(c);c.step=function(){
  if(insideGraphics){step();return;}
  if(this.pc===0xfa0e){const id=this.a;if(id!==19){snapshot(1,id);if(graphicsMachine){insideGraphics=true;graphicsMachine.call(0xfa0e);insideGraphics=false;}else graphicsMetadata(id);}ret(this);return;}
  if(this.pc===0x8f0b){snapshot(2,0);ret(this);return;}
  if(this.pc===0x9253){snapshot(3,this.m[0x78da]);ret(this);return;}
  if(this.pc===0x8e14){snapshot(4,this.a);ret(this);return;}
  if(this.pc===0x8185){const addr=this.m[0x100+((this.s+1)&255)]|(this.m[0x100+((this.s+2)&255)]<<8);if(addr===0x9461)snapshot(6,1);ret(this);return;}
  if(this.pc===0xfbaa){const addr=this.m[0x100+((this.s+1)&255)]|(this.m[0x100+((this.s+2)&255)]<<8);if(addr===0x9925)snapshot(5,0);ret(this);return;}
  if([0x9d9e,0x9ba2,0x9a69,0xa609,0x966a].includes(this.pc)){ret(this);return;}
  if(this.pc===0xa44a){snapshot(8,0,1);terminal=true;return;}
  if(this.pc===0x993f){snapshot(8,0);terminal=true;return;}
  if(this.pc===0xa66c){snapshot(10,this.m[0x52],2);terminal=true;return;}
  if(this.pc===0x9ae7){snapshot(11,this.m[0x52],3);terminal=true;return;}
  if(this.pc===0x9945){snapshot(7,this.m[0x52]);terminal=true;return;}
  if(this.pc===0x811c){snapshot(9,64);terminal=true;return;}
  step();
 };
 c.pc=0x81a0;c.push(0x98);c.push(0x6b);while(!terminal){check(++steps<200000,'Opening instruction budget '+c.pc.toString(16));c.step();}return rows;
}
export function fullOpeningReference(rom,{hp=500,status=[128,64,32,0],back=false}={}){
 const {m}=initializedBattle(rom,{formation:3,back,rows:[0,1,0,1],terrain:0,partyStatus:status});
 const sounds=[],write=m.c.write.bind(m.c);m.c.write=(a,v)=>{if(a===0x7f49)sounds.push({request:v,boundary:m.waits.length});write(a,v);};
 const state=openingSeed(rom,{status,hp,speed:8,cannon:false}),types=Buffer.from(m.c.m.subarray(0x7da7,0x7daf));
 state.set(types,665);state.set(types,673);state.fill(0,693,697);for(let i=0;i<8;i++){state[56+i*64]=types[i]===255?128:0;state[681+i]=types[i]===255?128:0;if(types[i]<4)state[693+types[i]]++;}
 state[697]=32;state.set(contextReference(rom)(3,state.subarray(55,633)).state,55);
 m.begin();const trace=openingReference(rom,state,{graphicsMachine:m});m.finish();
 return {state,trace,boundaries:m.waits,sounds,scope:'Full original graphics consumers with virtual PPU transfers; text/input intercepted, no actual raster/audio'};
}
export function openingSeed(rom,{cannon=true,status=[0,0,0,0],hp=500,mask=255,speed=4,first=0,turn=0}={}){
 const s=Buffer.alloc(openingSize);s.fill(255,2,10);s.set(status,26);s[54]=255;s.fill(255,665,681);s.fill(128,681,689);
 for(let i=0;i<8;i++){const live=mask&(128>>i),at=55+i*64;s[at]=20;s[at+1]=live?0:128;s[at+44]=128|i;s.writeUInt16LE(hp,at+3);s.writeUInt16LE(hp,at+5);if(live){s[665+i]=s[673+i]=i%4;s[681+i]=0;s[693+i%4]++;}}
 if(cannon){const ref=contextReference(rom)(3,s.subarray(55,633));s.set(ref.state,55);}s[697]=cannon?32:0;s[698]=first;s[699]=turn;s[701]=speed;s[702]=255;return s;
}
export function openingCases(rom){const cases=[];const add=(name,options,edit,shortWait=false)=>{const state=openingSeed(rom,options);edit?.(state);cases.push({name,state,shortWait});};
 for(const cannon of [false,true])for(const status of [[0,0,0,0],[128,64,32,8],[128,128,128,128],[64,64,64,64]])for(const hp of [1,250,312,313,500])for(const speed of [0,4,8])add('entry-status-hp-speed',{cannon,status,hp,speed});
 for(let mask=0;mask<256;mask++)add('death-slots',{mask,hp:1,speed:8});
 for(const first of [0,1,128,136])for(const turn of [0,1])add('surprise-reentry',{cannon:false,first,turn});
 for(const status2 of [1,32,64,128])add('automatic-boundary',{},s=>{s[30]=status2;s[10+1]=128;});
 add('inventory-return',{},s=>s[50]=0xa6);add('short-message',{speed:0},null,true);
 for(const old of [0,254,255])add('reward-wrap',{hp:1,speed:8},s=>s.fill(old,689,693));
 for(const alive of [0,1,2,3])add('first-living',{status:[128,128,128,128],hp:500},s=>s[26+alive]=0);
 return cases;
}
export function openingFixtures(rom){const cases=openingCases(rom),chunks=[],counts={};let events=0;
 for(const row of cases){const trace=openingReference(rom,row.state,row),n=Buffer.alloc(2);n.writeUInt16LE(trace.length);chunks.push(row.state,n);for(const r of trace)chunks.push(Buffer.from([r.kind,r.value,r.buttons]),r.state);events+=trace.length;counts[row.name]=(counts[row.name]||0)+1;}
 return {bytes:Buffer.concat(chunks),cases:cases.length,events,counts,negativeOffset:openingSize+2+3,script:openingScript(rom)};
}
