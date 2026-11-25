// Build-time observations of original consumers. No frame fixtures or ROM
// payloads from this audit are linked into the GBC runtime.
import {check,hash} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {segment} from './state-source.mjs';
import {decodeEvent} from './registry-core.mjs';
import {physicalRng} from './battle-physical-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {tailReference,bossFormations} from './battle-entry-tail-source.mjs';
import {originalActionFlow} from './battle-action-source.mjs';
import {messageWindowDescriptors} from './battle-ui-observation.mjs';
import {offset} from './render-budget-source.mjs';

function until(c,start,ends){c.pc=start;for(let n=0;n<20000;n++){if(ends.includes(c.pc))return c.pc;c.step();}throw Error('Contract boundary not reached');}
export function formationRecords(rom){
 return Array.from({length:512},(_,id)=>{
  const c=battleCpu(rom);c.m[0x7ced]=id&255;c.m[0x7cee]=id>>8;
  segment(c,0xa02a,0xa0b7);
  return {id,flags:c.m[0x7d68],monsters:[...c.m.subarray(0x7d6b,0x7d6f)],countRanges:[...c.m.subarray(0x7d6f,0x7d73)],source:'2F/A02A..A0B7',reachability:'table reference only'};
 });
}
export function monsterRecords(rom){
 const rng=physicalRng(rom);
 return Array.from({length:256},(_,id)=>{
  const c=battleCpu(rom,0x18);c.m[0x7d6b]=id;c.m.set(rng,0x7be3);c.m.set([17,0,239],0x15);c.a=0;c.y=0;c.call(0xa4f6);
  const begin=offset(0x30,0x8000+id*16),raw=rom.subarray(begin,begin+16),state=Buffer.from(c.m.subarray(0x7675,0x76b5)),scriptBegin=offset(0x30,0x9200+raw[14]*8);
  check(state.readUInt16LE(3)===raw.readUInt16LE(1)&&state.readUInt16LE(5)===raw.readUInt16LE(1),'Original monster HP loader');
  check(state[55]===raw[3]&&state.subarray(56,64).equals(rom.subarray(scriptBegin,scriptBegin+8)),'Original monster AI loader');
  return {id,begin,nameTextId:0x520+id,namePointer:0x30010+rom.readUInt16LE(0x30010+(0x520+id)*2),hp:state.readUInt16LE(3),weakness:state[18],resistance:state[32],specialRate:state[55],scriptBegin,script:[...state.subarray(56,64)],stateSha256:hash(state),source:'31/A4F6..A65D',dynamicWeakness:[0xb4,0xd2].includes(id)};
 });
}
export function eventBattleRecords(rom){
 const events=[],calls=[];
 for(let id=0;id<254;id++){
  const pointer=rom.readUInt16LE(0x58610+id*2),e=decodeEvent(rom,pointer),refs=[];
  for(const [index,cmd]of e.commands.entries())if(cmd.op===0xf7){
   // F7 writes a low byte and a pending flag, not a complete formation ID.
   const c=battleCpu(rom,0x1d);c.m[0x71]=cmd.operand;c.m[0x78]=0xa5;c.call(0xb70f);
   check(c.m[0x6a]===cmd.operand&&c.m[0xab]===0x20&&c.m[0x44]===0x40&&c.m[0x78]===0xa5,'Original F7 dispatch');
   const candidates=[];for(const flags of [0,1]){const b=battleCpu(rom);b.m[0x7ed8]=flags;segment(b,0x9e8e,0x9e98);candidates.push(cmd.operand+(b.m[0x7cee]<<8));}
   const r={event:id,index,offset:cmd.offset,operand:cmd.operand,candidates,resumeOffset:e.commands[index+1]?.offset??null,after:e.commands.slice(index+1,index+5),source:'3B/B70F;3E/C04F;3F/FA26;2E/9E8E',reachability:'caller world/flags and event-switch path not yet executed'};
   calls.push(r);refs.push(r.offset);
  }
  events.push({id,pointer,begin:e.begin,end:e.end,battleCalls:refs});
 }
 return {events,calls};
}
// These are exact branch boundaries, not a model of the entire battle loop.
export function specialFormationRules(rom){
 return Array.from({length:512},(_,formation)=>{
  const c=battleCpu(rom,0x1a);c.m[0x7ced]=formation&255;c.m[0x7cee]=formation>>8;c.m.set([0,0x75],0x6e);c.m[0x7503]=0x56;c.m[0x7504]=0x12;c.m[0x7506]=0x34;
  segment(c,0x9e3c,0x9e5f);
  const restoreHpHigh=c.m[0x7504]===0x34;
  check(c.m[0x7503]===0x56,'Special restore must preserve HP low byte');
  const end=until(c,0x8140,[0x8150,0x8163]);
  c.m[0x78d3]=0x80;segment(c,0x8173,0x8184);
  return {formation,restoreHpHigh,skipVictory:end===0x8163,clearDefeat:c.m[0x78d3]===0};
 });
}
export function jumpContracts(rom){
 const rows=[];
 for(let status=0;status<256;status++)for(let actor=0;actor<4;actor++){
  const c=battleCpu(rom,0x1a);c.m.set([0,0x75],0x6e);c.m[0x7501]=status;c.m[0x752c]=actor;c.call(0xa9d8);
  const rejected=!!(status&0x28);
  check(c.m[0x78d5]===1&&c.m[0x78d7]===0x41,'Jump action message');
  check(rejected?c.m[0x7ec2]===0x18&&c.m[0x78da]===0x3b:c.m[0x7527]===2&&c.m[0x752e]===9&&c.m[0xf1+actor*2]===1,'Jump start status/multiplier');
  rows.push({status,actor,rejected});
 }
 for(let status=0;status<256;status++){
  const c=battleCpu(rom,0x1a);c.m.set([0,0x75],0x6e);c.m[0x7502]=status;
  segment(c,0xaa11,0x801e);check(c.m[0x7502]===(status&254)&&c.m[0x7527]===2,'Jump landing delegates to fight');
 }
 // Verify the common element selector in the original arithmetic consumer.
 const elements=[];for(const weakness of [0,0x20])for(const attack of [0,0x20]){
  const c=battleCpu(rom,0x18);c.m.set([0,0x75],0x70);c.m[0x7512]=weakness;c.m[0x7440]=attack;
  segment(c,0x9ff1,0xa010);elements.push({weakness,attack,multiplier:c.a});
 }
 return {startCases:rows.length,landingCases:256,rejected:rows.filter(r=>r.rejected).length,elements,source:['35/A9D8..AA1F','30/9FF1..31/A010','31/A0A5..A0BD'],scope:'Exact start/landing/element branches; no claim of full jump animation, target immunity or complete battle damage'};
}
export function bossAiContracts(rom){
 const barriers=[];
 for(let id=0;id<256;id++)for(let turn=0;turn<4;turn++){
  const c=battleCpu(rom,0x18);c.m[0x7d6b]=id;c.m[0x7be2]=turn;c.m.set([0,0x75],0x24);
  const end=until(c,0xa7c5,[0xa7e9,0xa8b9]),barrier=end===0xa8b9;
  check(barrier===([0xb4,0xd2].includes(id)&&turn===2),'Original barrier exception');
  if(barrier){check(c.a===0x4d,'Barrier command');barriers.push({id,turn,command:c.a});}
 }
 const sequential=[];
 for(let pointer=1;pointer<=8;pointer++){
  const c=battleCpu(rom,0x18);c.m[0x7ed8]=128;c.m[0x78b7]=pointer;
  segment(c,0xa866,0xa875);const index=c.y-0x38;
  segment(c,0xa883,0xa892);const next=c.m[0x78b7];
  check(index===pointer-1&&next===(pointer===8?1:pointer+1),'Boss sequential script index');
  sequential.push({pointer,index,next});
 }
 return {barrierCases:1024,barriers,sequential,source:['31/A7C5..A7E9','31/A866..A892'],scope:'Branch and successful-action pointer progression; A91B target selection and failed-target retry not executed'};
}
export function uiResourceContract(rom){
 const callSites=[
  ...[0x909a,0x90ca,0x9171,0x91c8,0x91f8,0x925c,0x931c].map(cpu=>({bank:0x34,cpu,target:0x8d1b,kind:'action-message'})),
  ...[0x80cc,0x811c,0x989e].map(cpu=>({bank:0x34,cpu,target:0x9ba2,kind:'hp-status-action-row'})),
  {bank:0x35,cpu:0xb9c9,target:0x9ba2,kind:'hp-status-action-row'},
  ...[0xae53,0xae65,0xae77,0xb2e7,0xb3a0,0xb7a2,0xb824,0xb85d].map(cpu=>({bank:0x35,cpu,target:0x8b38,kind:'item-equipment-magic-menu'}))
 ];
 for(const s of callSites){const at=offset(s.bank,s.cpu);check([0x20,0x4c].includes(rom[at])&&rom.readUInt16LE(at+1)===s.target,'Window caller anchor changed');}
 const {m}=initializedBattle(rom,{formation:3,back:false,rows:[0,0,0,0],terrain:0}),menu=Buffer.from(m.ppu.bytes.subarray(0x1700,0x2000));
 check(menu.equals(rom.subarray(0x1b710,0x1c010)),'Initial font/frame upload must equal original menu resource');
 const menuPalette=[...m.c.m.subarray(0x7d03,0x7d07)];
 const resources=[{owner:'menu-font-and-frame',sourceBegin:0x1b710,sourceEnd:0x1c010,ppuBegin:0x1700,ppuEnd:0x2000,bytes:menu.length,sha256:hash(menu),load:'2E/9D65 -> 2F/A9ED -> A9AC -> A1B3',release:'battle exit; never boss scratch'}];
 const entry=[];for(const b of bossFormations(rom))for(const back of [false,true]){
  const r=tailReference(rom,{formation:b.formation,back}),work=r.frames.filter(f=>f.work?.[0]===1);
  check(r.frames.every(f=>f.ppu.subarray(0x1700,0x2000).equals(menu))&&r.terminal.ppu.subarray(0x1700,0x2000).equals(menu),'Boss entry must retain menu font/frame');
  check(work.every(f=>f.work.readUInt16LE(5)>=0x700&&f.work.readUInt16LE(5)+f.work[4]<=0x1000),'Boss entry CHR ownership');
  entry.push({...b,back,steps:work.length,bytes:work.reduce((n,f)=>n+f.work[4],0),menuPreserved:true});
 }
 const flows=[];for(const back of [false,true])for(const enemy of [false,true]){
  const r=originalActionFlow(rom,{back,enemy});
  flows.push({back,enemy,screens:r.frames.length,hpRows:r.hp.length,events:r.events.map(e=>({kind:e.kind,window:e.window,op:e.op,at:e.at,live:e.live})),source:r.source});
 }
 return {resources,menuPalette,callSites,windows:messageWindowDescriptors(rom),bossEntry:entry,actionFlows:flows,scope:'Original PPU writes and action window open/close traces, waits intercepted; call-site anchors are not execution coverage of all menus; no GBC timing/audio or new screenshot claim'};
}
