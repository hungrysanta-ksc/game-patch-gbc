import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {physicalRng} from './battle-physical-source.mjs';
import {fightSeed,originalFightCases} from './battle-fight-source.mjs';
import {R,resultSeed} from './battle-result-source.mjs';
const sid=i=>i<4?i:128+i-4;
const commandBase=new WeakMap();
export function commandCase(f=fightSeed(),command=4){
 const s=resultSeed(),a=f[44]&128?4+(f[44]&7):f[44]&7,t=f[108]&128?4+(f[108]&7):f[108]&7;
 s.set(f.subarray(0,64),a*64);s.set(f.subarray(64,128),t*64);s[R.actor]=a;s[R.target]=t<4?0:128;s[a*64+46]=command;s[a*64+47]=128>>(sid(t)&7);s[a*64+48]=s[R.target];s[R.flags]=f[135];
 return {s,f:Buffer.from(f),counters:[17,0,239]};
}
export function validCommand(s,f){const a=s[R.actor],r=s.subarray(a*64,a*64+64),cmd=r[46],mask=r[47];
 if(a>=12||s[R.result]||(r[44]&135)!==sid(a)||(r[44]&24)||(r[2]&193)||(r[1]&192)||![4,5,6,7].includes(cmd)||(a>=4&&[5,7].includes(cmd)))return false;
 if(cmd===6&&a<4&&s.subarray(R.types,R.types+8).every(x=>x===255))return false;
 if(!mask||(mask&(mask-1))||(r[48]&127))return false;let slot=0;while(!(mask&(128>>slot)))slot++;if(!(r[48]&128)&&slot>=4)return false;
 const t=slot+(r[48]&128?4:0),p=s.subarray(t*64,t*64+64);
 return cmd!==4||!((p[44]&135)!==sid(t)||(p[1]&192)||(p[2]&1)||!p.readUInt16LE(3)||!r.readUInt16LE(3)||((p[44]&128)&&p[56]===79)||(a>=4&&t<4&&(s[R.near]&mask))||(a<4&&(((r[49]|r[50])&4)||f[128]===65||f[129]===65)));
}
// Execute 9DE4's actual dispatch, A104/A881/A8BF/A93B and every called
// physical arithmetic routine. No action/calculation instruction intercepted.
export function sourceCommand(rom,row,table=physicalRng(rom)){
 const s=Buffer.from(row.s),f=Buffer.from(row.f),call=Buffer.alloc(11);
 if(!validCommand(s,f))return {ok:0,s,f,call,counters:Buffer.from(row.counters)};
 if(!commandBase.has(rom))commandBase.set(rom,Buffer.from(initializedBattle(rom,{formation:3,back:false,rows:[0,0,0,0],terrain:0}).m.c.m));
 const c=battleCpu(rom,0x1a);c.m.set(commandBase.get(rom));const a=s[R.actor],cmd=s[a*64+46],mask=s[a*64+47];let ti=0;while(!(mask&(128>>ti)))ti++;const t=ti+(s[a*64+48]&128?4:0);
 c.banks=[0x34,0x35,0x3e,0x3f];c.m[0x7cf6]=0x1a;c.call(0x8213);
 c.m.set(s.subarray(0,768),0x7575);c.m.set([0,0x61,0,0x62,0x75,0x75,0x75,0x76],0x57);
 c.m.fill(255,0x78da,0x78ee);c.m.set(s.subarray(R.types,R.types+8),0x7da7);c.m.set(s.subarray(R.dead,R.dead+8),0x7ec4);
 c.m[0x78d3]=s[R.result];c.m[0x78ba]=s[R.first];c.m[0x7cec]=s[R.near];c.m[0x7ed8]=s[R.flags];c.m[0x7573]=f[160];c.m[0x74]=f[134];c.m.set(f.subarray(130,134),0x7ce4);
 c.m[0x6203+(sid(a)&7)*64]=f[128];c.m[0x6205+(sid(a)&7)*64]=f[129];
 c.m[0x7ac2]=0;c.m[0x7acb]=sid(a);c.m.set(table,0x7be3);c.m.set(row.counters,0x15);c.call(0x9de4);
 s.set(c.m.subarray(0x7575,0x7875));s.set(c.m.subarray(0xf0,0x100),R.actorStatus);s.set(c.m.subarray(0xe0,0xf0),R.targetStatus);s[R.result]=c.m[0x78d3];s[R.escape]=c.m[0x78d4];s[R.script]=c.m[0x78d5];s[R.target]=s[a*64+48];
 if(cmd>=6){s[R.name]=c.m[0x78d7];s[R.message]=c.m[0x78da];s[R.targetName]=c.m[0x78d8];}
 call.set([c.m[0x7ec2],c.m[0x78d6],c.m[0x78d8],c.m[0x7e9a],c.m[0x7e99],c.m[0x7e9b],c.m[0x78d7],c.m[0x78d9],c.m[0x7e1f],c.m[0x7e20],0]);
 f.set(c.m.subarray(0x78da,0x78ee),139);f[159]=c.m[0x78ee];f[136]=c.m[0xcb];f.set(c.m.subarray(0xbb,0xbd),167);f.set(c.m.subarray(0x7e4f+ti*2,0x7e51+ti*2),169);f.set(c.m.subarray(0x7e5f+(sid(a)&7)*2,0x7e61+(sid(a)&7)*2),171);f[173]=c.m[0x7ee1];f[174]=255;
 if(cmd===4){f.set(s.subarray(a*64,a*64+64));f.set(s.subarray(t*64,t*64+64),64);f[137]=c.m[0x7e9b];f[138]=ti;f[160]=c.m[0x7573];f.set(c.m.subarray(0xf0+(sid(a)&7)*2,0xf2+(sid(a)&7)*2),161);f.set(c.m.subarray(0xe0+ti*2,0xe2+ti*2),163);f.set(c.m.subarray(0x7c,0x7e),165);f[174]=c.m[0x78d9];}
 else{f.fill(0,165,169);f[173]=255;if(cmd===5)f.set(c.m.subarray(0x7ce4,0x7ce8),130);}
 return {ok:1,s,f,call,counters:Buffer.from(c.m.subarray(0x15,0x18))};
}
// 2F/B24F -> 33/A000 consumes the same RNG cursor AFTER arithmetic.
// Original fist/impact positions draw randomness even when the hit count is
// zero. Never compare the final renderer cursor to calculation alone.
export function sourceCommandStrike(rom,{formation,counts,back,actor,target,weapons,hits,table,counters}){
 const {m}=initializedBattle(rom,{formation,counts,back,rows:[0,1,0,1],terrain:8,partyStatus:[0,0,0,0]}),c=m.c;
 m.call(0xb469);m.call(0xb304);c.m[0x95]=actor;c.x=actor;c.m[0xb8]=target;c.m[0xcc]=1;c.m[0x7e6f]=1;c.m.set(weapons,0x7e1f);c.m.set(hits,0xbb);c.m.set(table,0x7be3);c.m.set(counters,0x15);m.call(0xb24f,6000000);
 return Buffer.from(c.m.subarray(0x15,0x18));
}
export function sourceEnd(rom,battle,result,first=0){
 const c=battleCpu(rom,0x1a),events=[];c.m[0x7ced]=battle&255;c.m[0x7cee]=battle>>8;c.m[0x78d3]=result;c.m[0x78ba]=first;
 const step=c.step.bind(c),ret=()=>c.pc=((c.pop()|(c.pop()<<8))+1)&65535;
 const add=request=>events.push({request,result:c.m[0x78d3],message:c.m[0x78da],song:255,waitA:0});
 c.m[0x78da]=255;
 c.step=function(){const r=new Map([[0x9ba2,1],[0x8ff7,2],[0xbb49,4],[0x8306,5],[0x88a4,6],[0x8032,7]]).get(this.pc);
  if(r){add(r);ret();return;}
  if(this.pc===0xfa0e){check(this.a===17,'End animation ID');add(3);ret();return;}
  step();
 };c.call(0x811c);add(8);
 // Execute the actual carry propagation and caller branch; fade loop itself
 // remains an external rendering barrier in this control-flow reference.
 const returned=c.m[0x78d3];c.pc=0xfa7c;c.step();c.step();check(c.pc===0xfa80,'End carry instruction boundary');
 c.pc=0xc058;c.step();check(c.pc===0xc05a||c.pc===0xc05d,'Actual defeat branch');const restart=c.pc===0xc05a;
 if(restart){c.step();check(c.pc===0xc000,'Defeat program-start route');}c.m[0x78d3]=returned;add(restart?10:9);
 let message=255,song=255,waitA=0;
 for(const e of events){if(e.request===1)message=255;else if(e.request===2)message=e.message;
  // HP's branch selects the message even for skipped 0173/0178 messages.
  if(e.request!==1&&!(result&2))message=result&128?28:29;
  if(e.request===3){const animation=sourceEndAnimation(rom,battle,result);song=animation.song;waitA=+!!animation.inputCalls;}
  Object.assign(e,{message,song,waitA});
 }
 return events;
}
export function sourceEndAnimation(rom,battle,result){
 const c=battleCpu(rom,0x17);c.m[0x7ced]=battle&255;c.m[0x7cee]=battle>>8;c.m[0x78d3]=result;let song=255,inputCalls=0,waits=0;
 const step=c.step.bind(c),ret=()=>c.pc=((c.pop()|(c.pop()<<8))+1)&65535;
 c.step=function(){
  if(this.pc===0xfae9){song=this.a;ret();return;}
  if(this.pc===0xf8c5){waits++;ret();return;}
  if(this.pc===0xfbaa){inputCalls++;this.m[0x12]=inputCalls===2?1:0;ret();return;}
  // Victory drawing is a separate owner, not exercised by this defeat test.
  if(!(result&128)&&this.pc===0xb289){ret();return;}step();
 };c.call(0xb260);return {song,inputCalls,waits};
}
export function sourceFieldDamage(rom,hp){const c=battleCpu(rom,0x1d);c.m[0x610c]=hp&255;c.m[0x610d]=hp>>8;c.x=0;c.call(0xa10d);return c.m[0x610c]|c.m[0x610d]<<8;}
export function sourceDeath(rom,back=false,mask=128,reward=1,types=[0,1,2,3,0,1,255,255],counts=[0,0,0,0]){
 const {m}=initializedBattle(rom,{formation:3,back,rows:[0,0,0,0],terrain:0}),c=m.c,trace=[];c.m.set(types,0x7da7);c.m.set(counts,0x7dd3);c.a=mask;
 const step=c.step.bind(c);let ticket=1;
 const snapshot=(frame,wait,done)=>{const b=Buffer.alloc(84);b.set(c.m.subarray(0x7300,0x7341));for(let i=0;i<13;i++)b[65+i]=c.m[0x7342+i*2]&31;b.set([+back,frame,wait,done],78);b.writeUInt16LE(ticket++,82);return b;};
 c.step=function(){if(this.pc===0xbc84||this.pc===0xbc87)trace.push(snapshot(37-this.m[0x90],this.pc===0xbc84?2:1,0));step();};
 m.call(reward?0xbb0a:0xbb5e);trace.push(snapshot(37,0,1));check(trace.length===75,'37 two-NMI death pictures');
 return {trace,types:Buffer.from(c.m.subarray(0x7da7,0x7daf)),counts:Buffer.from(c.m.subarray(0x7dd3,0x7dd7)),remaining:c.m[0x7dd2]};
}
export function commandCases(rom){const rows=[];
 for(const r of originalFightCases(rom)){const row=commandCase(r.state);row.counters=r.counters;rows.push({...row,tag:'original-commands'});}
 for(const command of [4,5,6,7])for(const actor of [0,3,128,135])for(const status of [0,4,8,32,64,128]){const f=fightSeed({actor});f[1]=status;const row=commandCase(f,command);row.s[R.first]=1;rows.push({...row,tag:'dispatch-status'});}
 for(const status of [0,8,16,24,32,64,128])for(const hp of [1,900]){const f=fightSeed();f[66]=status;f.writeUInt16LE(hp,67);f[24]=f[29]=100;f[33]=0;rows.push({...commandCase(f),tag:'post-hit-status'});}
 return rows;
}
