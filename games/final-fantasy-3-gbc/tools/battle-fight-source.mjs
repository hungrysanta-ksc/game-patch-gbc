import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {physicalRng} from './battle-physical-source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {sourceInitialState} from './state-source.mjs';
export const FIGHT_BYTES=175;
export const fightOffsets={equipment:128,defending:130,running:134,boss:135,critical:136,targetMask:137,targetSlot:138,messages:139,count:159,deaths:160,actorStatus:161,targetStatus:163,actual:165,animation:167,targetNumber:169,actorNumber:171,split:173,statusMessage:174};
const base=flags=>(flags&128?0x7675:0x7575)+(flags&7)*64;
export function validFight(s){
 if(s.length!==FIGHT_BYTES)return false;const a=s.subarray(0,64),t=(a[44]&135)===(s[108]&135)?a:s.subarray(64,128);
 return (a[44]&7)<(a[44]&128?8:4)&&(t[44]&7)<(t[44]&128?8:4)&&s[138]<8&&!(a[1]&192)&&!(a[2]&1)&&!(t[1]&192)&&!(t[2]&1)&&a.readUInt16LE(3)>0&&t.readUInt16LE(3)>0&&!s[134]&&!((t[44]&128)&&t[56]===79)&&s[159]<=15;
}
// No calculation/HP/status/split callees are skipped. Unsupported caller
// contexts fail before execution instead of intercepting a missing branch.
export function sourceFight(rom,state,counters=[17,0,239],table=physicalRng(rom)){
 check(state.length===FIGHT_BYTES,'Fight ABI');if(!validFight(state))return{ok:0,state:Buffer.from(state),counters:Buffer.from(counters)};
 const c=battleCpu(rom,0x18),s=Buffer.from(state),a=base(s[44]),t=base(s[108]),ai=(s[44]&7)*2,ti=(s[108]&7)*2;
 c.m.set(s.subarray(0,64),a);if(a!==t)c.m.set(s.subarray(64,128),t);
 c.m.set([a&255,a>>8,t&255,t>>8],0x6e);c.m.set(table,0x7be3);c.m.set(counters,0x15);
 c.m.set([0,0x62],0x59);c.m[0x6203+(s[44]&7)*64]=s[128];c.m[0x6205+(s[44]&7)*64]=s[129];c.m.set(s.subarray(130,134),0x7ce4);
 c.m[0x74]=s[134];c.m[0x7ed8]=s[135];c.m[0xcb]=s[136];c.m[0x7e9b]=s[137];c.m[0x7ec1]=s[138];c.m.set(s.subarray(139,159),0x78da);c.m[0x78ee]=s[159];c.m[0x7573]=s[160];
 c.m.set(s.subarray(169,171),0x7e4f+ti);c.m.set(s.subarray(171,173),0x7e5f+ai);c.m[0x7ee1]=s[173];c.m[0x78d9]=s[174];
 c.call(0x9e8a);s.set(c.m.subarray(a,a+64));s.set(c.m.subarray(t,t+64),64);
 s[136]=c.m[0xcb];s[137]=c.m[0x7e9b];s.set(c.m.subarray(0x78da,0x78ee),139);s[159]=c.m[0x78ee];s[160]=c.m[0x7573];
 s.set(c.m.subarray(0xf0+ai,0xf2+ai),161);s.set(c.m.subarray(0xe0+ti,0xe2+ti),163);s.set(c.m.subarray(0x7c,0x7e),165);s.set(c.m.subarray(0xbb,0xbd),167);
 s.set(c.m.subarray(0x7e4f+ti,0x7e51+ti),169);s.set(c.m.subarray(0x7e5f+ai,0x7e61+ai),171);s[173]=c.m[0x7ee1];s[174]=c.m[0x78d9];
 return{ok:1,state:s,counters:Buffer.from(c.m.subarray(0x15,0x18))};
}
export function fightSeed({actor=0,target=128}={}){
 const s=Buffer.alloc(FIGHT_BYTES);for(const at of [0,64]){s.writeUInt16LE(900,at+3);s.writeUInt16LE(1000,at+5);s.set([0,3,80,32,0,0,2,65,25,0,0,1,30,12,0],at+22);s[at+40]=20;s[at+41]=11;s[at+46]=4;s[at+49]=s[at+50]=1;}
 s[44]=actor;s[108]=target;s[128]=30;s[129]=31;s[137]=255;s[138]=target&7;s.fill(255,139,159);s.fill(255,169,175);return s;
}
export function fightCases(){
 const cases=[],add=(tag,s,counter=0)=>cases.push({tag,state:s,counters:[17,counter,239]});
 for(const actor of [0,3,128,135])for(const target of [0,2,128,135])for(const rows of [0,1,2,3])for(const weapons of [[30,31,1,1],[30,0,1,0],[0,30,0,1],[0,0,0,0],[63,30,1,1],[30,63,1,1],[74,79,4,8]]){
  const s=fightSeed({actor,target});s[51]=rows&1;s[115]=(rows>>1)&1;s.set(weapons.slice(0,2),128);s[49]=weapons[2];s[50]=weapons[3];if(weapons[2]===4)s[51]|=4;add('rows-hands',s,179);
 }
 for(const status of [0,4,8,32,36,40])for(const targetStatus of [0,4,8,32,36,40])for(const elements of [[0,0,0],[4,4,0],[4,0,4],[1,0,0],[1,128,0],[0,0,2]])for(const hp of [1,32,900]){
  const s=fightSeed();s[1]=status;s[65]=targetStatus;s[22]=s[27]=elements[0];s[82]=elements[1];s[96]=elements[2];s.writeUInt16LE(hp,3);s.writeUInt16LE(hp,67);add('status-elements-hp',s,73);
 }
 for(const effect of [2,4,8,16,32,64,128,0x21,0x41,0x81,3,5,7])for(const existing of [0,2,4,6,32,64,128])for(const boss of [0,128])for(const immunity of [0,effect]){
  const s=fightSeed();s[26]=s[31]=effect;s[66]=existing;s[100]=immunity;s[135]=boss;s[24]=s[29]=100;s[98]=0;add('inflict-priority',s,0);
 }
 for(const count of [0,1,8,15])for(const bonus of [0,1,127,255])for(const buildup of [0,1,2,255])for(const defense of [0,127,128,255]){
  const s=fightSeed({actor:3,target:1});s[159]=count;s.fill(0x34,139,139+count);s[56]=s[57]=bonus;s[39]=buildup;s[103]=buildup;s[99]=defense;s[131]=1;s[40]=255;s[23]=s[28]=8;add('bonus-critical-buildup',s,255);
 }
 let seed=0x46334633;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
 for(let k=0;k<512;k++){const s=fightSeed({actor:k%4,target:128+k%8});for(const at of [0,64]){s[at+1]=next()&0x3c;s[at+2]=next()&0xfe;for(let n=22;n<=41;n++)s[at+n]=next();s[at+23]&=15;s[at+28]&=15;s[at+33]&=7;s[at+56]=next();s[at+57]=next();s.writeUInt16LE(1+(next()<<4),at+3);}if(s[120]===79)s[120]=0;add('mixed-width',s,next());}
 for(const edit of [s=>s[65]=128,s=>s[65]=64,s=>s[66]=1,s=>s[134]=1,s=>s[120]=79,s=>s[159]=16,s=>s[44]=7,s=>s[138]=8,s=>s.writeUInt16LE(0,67),s=>s[1]=128,s=>s[2]=1,s=>s.writeUInt16LE(0,3),s=>s[108]=7]){const s=fightSeed();edit(s);add('rejected',s);}
 return cases;
}
// Original initial state, formation 3, A400 property loader and AA16 equipment
// calculator. Job/level interventions are diagnostics, not naturally grown saves.
export function originalFightCases(rom){
 const {m}=initializedBattle(rom,{formation:3,back:false,rows:[0,0,0,0],terrain:0,jobs:[0,0,0,0]}),c=m.c,initial=sourceInitialState(rom),cases=[];
 for(let job=0;job<22;job++)for(const level of [0,32,98])for(const skill of [0,98]){
  c.m.set(initial,0x6000);c.m[0x6100]=job;c.m[0x6101]=level;c.m[0x6110]=skill;c.m.fill(0,0x6200,0x6208);c.m[0x6203]=job===0?0x1e:0;c.m[0x6204]=job===0?1:0;
  c.banks=[0x30,0x31,0x3e,0x3f];c.m[0x7cf6]=0x18;c.m.set([0,0x61,0,0x62,0x75,0x75,0x75,0x76],0x57);c.call(0xa400);c.m[0x52]=0;c.call(0xaa16);
  const actor=Buffer.from(c.m.subarray(0x7575,0x75b5)),enemy=Buffer.from(c.m.subarray(0x7675,0x76b5));actor[46]=4;enemy[46]=4;
  for(const reverse of [false,true]){const s=fightSeed();s.set(reverse?enemy:actor);s.set(reverse?actor:enemy,64);s[128]=job===0?0x1e:0;s[129]=0;s[138]=s[108]&7;cases.push({tag:'original-properties',state:s,counters:[17,level===32?174:level===98?73:0,239],job,characterLevel:level+1,jobLevel:skill+1,reverse});}
 }
 return cases;
}
export function fightFixtures(rom){const table=physicalRng(rom),cases=[...fightCases(),...originalFightCases(rom)],chunks=[],counts={};
 for(const c of cases){const r=sourceFight(rom,c.state,c.counters,table);chunks.push(c.state,Buffer.from(c.counters),Buffer.from([r.ok]),r.state,r.counters);counts[c.tag]=(counts[c.tag]||0)+1;}
 return{table,bytes:Buffer.concat(chunks),cases:cases.length,counts,recordBytes:FIGHT_BYTES*2+7,negativeOffset:FIGHT_BYTES+4};
}
