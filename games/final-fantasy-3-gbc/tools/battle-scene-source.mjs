// Full display-family inventory and bounded original-consumer probes.
// Coverage is dispatch/table coverage, never a claim that all animations ran.
import {check,hash} from './source.mjs';
import {offset} from './render-budget-source.mjs';
import {battleCpu,originalFormation} from './battle-placement-source.mjs';
import {recordTransfers} from './battle-display-source.mjs';
import {segment} from './state-source.mjs';
const word=(c,a)=>c.m[a]|c.m[a+1]<<8;
export const sceneTables=[
 {id:'graphics',bank:0x2f,table:0xaf74,count:38,pair:0x17,start:0xaf4e,end:0xaf64,result:0x93},
 {id:'animation',bank:0x32,table:0x800f,count:26,pair:0x19,start:0x8000,end:0x800c,result:0x96},
 {id:'weapon',bank:0x33,table:0xa080,count:10,pair:0x19,start:0xa094,end:0xa0bd,result:0x7e},
 {id:'magic',bank:0x33,table:0xbc2b,count:19,pair:0x19,start:0xbafd,end:0xbb0c,result:0x7e,input:0x7e9d},
 {id:'summon',bank:0x32,table:0x80da,count:24,pair:0x19,start:0x8115,end:0x812d,result:0x7e},
 {id:'action-command',bank:0x34,table:0x954d,count:15,pair:0x1a,start:0x9037,end:0x904e,result:0x1a},
 {id:'action-script',bank:0x34,table:0x950d,count:6,pair:0x1a,start:0x8ff7,end:0x9016,result:0x62,input:0x78d5}
];
export function sceneDispatchAudit(rom){
 const tables=[];
 for(const spec of sceneTables){const entries=[];for(let id=0;id<spec.count;id++){
  const c=battleCpu(rom,spec.pair);c.a=id;if(spec.input)c.m[spec.input]=id;
  if(spec.id==='summon'){c.m[0x7e91]=Math.floor(id/3);c.m[0x7e92]=id%3;}
  if(spec.id==='action-script')c.m[0x7ec2]=1;
  const at=offset(spec.bank,spec.table+id*2),pointer=rom.readUInt16LE(at);check(pointer>=0x8000&&pointer<0xc000,'Dispatch pointer range');segment(c,spec.start,spec.end);check(word(c,spec.result)===pointer,'Original '+spec.id+' dispatch');
  entries.push({id,bank:spec.pair*2+(pointer>=0xa000?1:0),cpu:pointer,tableOffset:at});
 }tables.push({...spec,entries,scope:'selector executed; target body not executed'});}
 const actions=[],reached=new Set();for(let id=0;id<25;id++)for(const summon of [0,1]){
  const c=battleCpu(rom,0x1a);c.m[0x7ec2]=id;c.m[0x7ec3]=summon;c.m[0x7e9a]=0x40;segment(c,0x8411,0x843b);
  const base=rom[offset(0x34,0x83f8+id)],animation=base+(base===1?summon:0);check(animation<17,'Attack animation ID');const pointer=rom.readUInt16LE(offset(0x34,0x843e+animation*2));
  check(c.m[0x7e97]===animation&&word(c,0x18)===pointer&&c.m[0x7e6f]===1,'Original action-animation dispatch');reached.add(animation);actions.push({id,summon,animation,bank:0x34,cpu:pointer});
 }
 check(reached.size===17,'Attack animation table coverage');return {tables,actions,summary:{pointerSlots:tables.reduce((n,t)=>n+t.count,0)+17,actionSelectorCases:actions.length,attackAnimationSlots:reached.size}};
}
export const commandRoles=['close-attacker','close-action','close-target','close-status-or-repeat','close-result','attacker','action-or-hits','target','status','result-queue','message-wait','animation','damage','death','cannon'];
export function actionScriptAudit(rom,dispatch){
 const scripts=[];for(const s of dispatch.tables.find(t=>t.id==='action-script').entries){
  const commands=[];let p=s.cpu;while(p<0x954d){const op=rom[offset(0x34,p++)];if(op===255)break;check(op<15,'Unknown action script command');commands.push(op);}check(p<=0x954d&&rom[offset(0x34,p-1)]===255,'Action script terminator');
  // Execute the actual fetch/dispatch/advance loop. Only command bodies are
  // bypassed; separate probes below cover message repeat and wait semantics.
  const c=battleCpu(rom,0x1a),seen=[];c.m[0x7ec2]=1;c.m[0x78d5]=s.id;segment(c,0x8ff7,0x9016);segment(c,0x9016,0x9020);
  for(let n=0;n<commands.length;n++){segment(c,0x9020,0x9037);
   seen.push(c.m[0x4b]);segment(c,0x9037,0x904e);check(word(c,0x1a)===rom.readUInt16LE(offset(0x34,0x954d+c.m[0x4b]*2)),'Script command target');segment(c,0x9051,0x9020);
  }
  segment(c,0x9020,0x9056);check(c.m[0x4b]===255,'Original action script end');
  check(JSON.stringify(seen)===JSON.stringify(commands),'Original action script order');
  // May-live windows, not simultaneous reachable payloads. Optional messages
  // and branch conditions must be resolved by a future original battle trace.
  const live=new Set(),steps=[];for(const [index,op] of commands.entries()){
   if(op>=5&&op<=9)live.add(op-5);else if(op<=4)live.delete(op);
   steps.push({index,op,role:commandRoles[op],mayLiveWindows:[...live].sort(),...(op===3?{pendingMessageNext:index-(s.id===0?4:5)+1}:{} )});
  }
  scripts.push({id:s.id,cpu:s.cpu,commands,steps,maxMayLive:Math.max(...steps.map(s=>s.mayLiveWindows.length)),scope:'Linear script order + conservative may-live windows; pending message loop is recorded separately, body conditions unproven'});
 }
 const repeats=[];for(const id of [0,1])for(const pending of [false,true]){const c=battleCpu(rom,0x1a);c.m[0x78d5]=id;c.m[0x78da]=pending?1:255;c.m[0x78d9]=255;c.m[0x4b]=3;c.m[0x64]=10;segment(c,0x94e7,0x9051);const next=c.m[0x64]+1;check(next===(pending?(id===0?7:6):11),'Original queued-message repeat');repeats.push({id,pending,next});}
 const waits=[];for(let speed=0;speed<=8;speed++)for(const press of [false,true]){const c=battleCpu(rom,0x1a);c.m[0x6010]=speed;let frames=0;intercept(c,new Map([[0x8185,()=>frames++],[0xfbaa,x=>{x.m[0x12]=press?1:0;}]]));segment(c,0x9450,0x9051);check(frames===(press?Math.min(1,(8-speed)*8):(8-speed)*8),'Original message wait');waits.push({speed,press,frames});}
 return {scripts,repeats,waits};
}
function intercept(c,callbacks){const step=c.step.bind(c);c.step=function(){const cb=callbacks.get(this.pc);if(cb){cb(this);this.pc=((this.pop()|(this.pop()<<8))+1)&65535;}else step();};}
// Sequential PPU reads/writes for window save/restore; no PPU timing/raster.
function messagePpu(c){const bytes=Uint8Array.from({length:0x4000},(_,i)=>(i*37+(i>>5))&255),initial=bytes.slice(),read=c.read.bind(c),write=c.write.bind(c);let address=0,high=true,buffer=0,control=0,reads=0,writes=0;
 c.read=a=>{if(a===0x2002){high=true;return 0;}if(a===0x2007){check(address>=0x2000&&address<0x3000,'Window read range');const v=buffer;buffer=bytes[address];address=(address+((control&4)?32:1))&0x3fff;reads++;return v;}return read(a);};
 c.write=(a,v)=>{if(a===0x2000){control=v;return;}if(a===0x2001)return;if(a===0x2005){high=!high;return;}if(a===0x2006){address=high?(v&63)<<8:(address&0x3f00)|v;high=!high;return;}if(a===0x2007){check(address>=0x2000&&address<0x3000,'Window write range');bytes[address]=v;address=(address+((control&4)?32:1))&0x3fff;writes++;return;}write(a,v);};
 return {bytes,initial,counts:()=>({reads,writes})};
}
export function messageWindowAudit(rom,profile='fight'){
 check(['fight','magic'].includes(profile),'Window profile');
 const c=battleCpu(rom,0x1a),ppu=messagePpu(c);let waits=0;intercept(c,new Map([[0x8185,()=>waits++]]));c.m[0x7ac1]=0x72;c.m.set(Uint8Array.from({length:64},(_,i)=>i+1),0x7200);
 const windows=[],openOrder=profile==='fight'?[0,2,1,3,4]:[0,1,2,3,4];for(const id of openOrder){const at=offset(0x34,0x8e83+id*9),start=rom.readUInt16LE(at),width=rom[at+2],backup=rom.readUInt16LE(at+3),before=ppu.bytes.slice(),n=ppu.counts(),wait=waits;c.a=id;c.call(0x8d1b);
  const saved=Buffer.concat(Array.from({length:4},(_,row)=>Buffer.from(before.subarray(start+row*32,start+row*32+width+2))));check(Buffer.from(c.m.subarray(backup,backup+saved.length)).equals(saved),'Original window underlay save');
  check(waits-wait===8&&ppu.counts().writes-n.writes===(width+2)*4,'Original window open transfer');
  windows.push({id,ppu:start,sourceRect:[(start&31)*8,((start&1023)>>5)*8,(width+2)*8,32],interiorColumns:width,backup,backupBytes:saved.length,openWaits:waits-wait,openReads:ppu.counts().reads-n.reads,openWrites:ppu.counts().writes-n.writes,consumer:'34/8D1B',restore:'34/8E14'});
 }
 const closeOrder=profile==='fight'?[4,3,1,2,0]:[4,3,2,1,0],close=[];for(const id of closeOrder){const n=ppu.counts(),wait=waits;c.a=id;c.call(0x8e14);check(waits-wait===4,'Original window close waits');close.push({id,waits:waits-wait,writes:ppu.counts().writes-n.writes});}
 check(ppu.bytes.every((v,i)=>v===ppu.initial[i]),'Original overlapped window restore');
 return {profile,windows,close,totalBackupBytes:windows.reduce((n,w)=>n+w.backupBytes,0),totalWaits:waits,transfer:ppu.counts(),restored:true,scope:'Five forced windows, deterministic underlay/text canaries, original open/close order; not actual message reachability, Hangul rendering or real PPU timing'};
}
export function damageLifetimeAudit(rom){
 const f=originalFormation(rom,3),c=battleCpu(rom),ppu=recordTransfers(c);c.call(0x9f98);c.call(0x9f8d);c.m.set([0,1,2,3],0x7d8b);c.call(0xa9ed);c.call(0xb4ac);
 c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.m.set([192,192,192,192],0xc0);c.m.set([40,72,104,136],0xc4);c.call(0x90d8);const party=Buffer.from(c.m.subarray(0x2a0,0x300));
 for(const s of f.slots){c.m[0x7da7+s.slot]=s.type;c.m.set(s.center,0x7dd7+s.slot*2);c.m[0x7e07+s.slot]=s.frontTop[1]+s.rect[3];c.m[0x7e4f+s.slot*2]=0xd2;c.m[0x7e50+s.slot*2]=4;}
 c.m[0x7e6f]=1;c.m.set(rom.subarray(offset(0x2e,0x9f6c),offset(0x2e,0x9f6c)+18),0x7ee3);
 let paletteWaits=0;const frames=[];intercept(c,new Map([[0xf8b0,()=>paletteWaits++],[0xf8c5,x=>{check(Buffer.from(x.m.subarray(0x2a0,0x300)).equals(party),'Damage overwrote party');const oam=Buffer.from(x.m.subarray(0x200,0x300));frames.push({frame:frames.length,allocatedDigits:x.m[0xc8]/4,nonzeroVisibleSlots:Array.from({length:64},(_,i)=>i).filter(i=>oam[i*4]<240&&oam[i*4+1]!==0),oamSha256:hash(oam)});}]]));c.call(0xad2b);
 check(frames.length===32&&frames.every(f=>f.allocatedDigits===32),'Original all-target damage lifetime');
 return {frames,summary:{paletteWaits,sourceFrames:frames.length,maxDigitSlots:Math.max(...frames.map(f=>f.allocatedDigits)),partySlots:24,maxNonzeroVisible:Math.max(...frames.map(f=>f.nonzeroVisibleSlots.length))},scope:'Forced eight live targets with 1234 damage and standing party, original whole damage loop. Hardware waits intercepted; no damage calculation/reachability or GBC fit claim. Digits persist after AD2B until caller overwrites/clears them.'};
}
export function battleSceneAudit(rom){const dispatch=sceneDispatchAudit(rom);return {dispatch,actions:actionScriptAudit(rom,dispatch),windows:['fight','magic'].map(p=>messageWindowAudit(rom,p)),damage:damageLifetimeAudit(rom),scope:'Source dispatch and selected whole-consumer boundaries; whole battle rendering, real frame timing, all effects and GBC budgets remain open'};}
