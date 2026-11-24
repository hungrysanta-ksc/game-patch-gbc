import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {sourceRow,rowPositions} from '../tools/battle-row-source.mjs';
import {battleCpu} from '../tools/battle-placement-source.mjs';import {segment} from '../tools/state-source.mjs';
const seed=(actor,row,back,cmd)=>Buffer.from([actor,row,back,cmd,99,17,4,0,0,0,0,0,0xa6,255,255,0x80|actor]);
test('original row request rejects the existing row and reserves without moving',async()=>{
 const {data}=await input();
 for(let actor=0;actor<4;actor++)for(const back of [0,8])for(const cmd of [2,3]){
  const bad=seed(actor,cmd-2,back,cmd),rejected=sourceRow(data,bad,1);
  assert.equal(rejected[4],3);assert.equal(rejected[11],6);assert.equal(rejected[0],actor);assert.equal(rejected[6],4);
  const initial=seed(actor,cmd===2?0xa7:0xa6,back,cmd),pending=sourceRow(data,initial,1),yes=sourceRow(data,pending,2,1);
  assert.equal(pending[4],0);assert.equal(yes[4],2);assert.equal(yes[0],actor+1);assert.equal(yes[6],cmd);assert.equal(yes[11],5);
  for(const i of [1,12]){assert.equal(pending[i],initial[i]);assert.equal(yes[i],initial[i]);}
  const executed=sourceRow(data,yes,3);assert.equal(executed[0],actor);assert.equal(executed[1],initial[1]^1);assert.equal(executed[12],initial[12]^1);
 }
});
test('row arrow direction and opposite-direction cancellation reverse in back attacks',async()=>{
 const {data}=await input(),positions=rowPositions(data).bytes;
 for(let actor=0;actor<4;actor++)for(const cmd of [2,3]){
  const a=sourceRow(data,seed(actor,cmd===2?1:0,0,cmd),1),b=sourceRow(data,seed(actor,cmd===2?1:0,8,cmd),1),i=actor*4+(cmd-2)*2;
  assert.equal(a[7],positions[i]);assert.equal(a[10],positions[i+1]);assert.equal(b[10],positions[16+i+1]);assert.equal(a[9]^b[9],64);assert.equal(a[5]^b[5],192);
  for(const s of [a,b])for(let key=0;key<256;key++){
   const r=sourceRow(data,s,2,key),phase=key===1?2:key===2||key===s[5]?1:0;assert.equal(r[4],phase);
   if(phase!==2){assert.equal(r[0],actor);assert.equal(r[6],4);assert.equal(r[11],s[11]);}
   assert.equal(r[1],s[1]);assert.equal(r[12],s[12]);
  }
 }
});
test('original execution toggles independent row bits only at action time',async()=>{
 const {data}=await input();for(let actor=0;actor<4;actor++)for(let row=0;row<256;row++)for(const cmd of [2,3]){
  const s=seed(actor,row,0,cmd);s[6]=cmd;s[12]=(row*73+19)&255;const r=sourceRow(data,s,3);
  assert.equal(r[1],s[1]^1);assert.equal(r[12],s[12]^1);assert.equal(r[13],cmd===2?0x3b:0x3c);assert.equal(r[14],1);assert.equal(r[0],actor);
  for(const i of [2,3,4,5,6,7,8,9,10,11,15])assert.equal(r[i],s[i]);
 }
});
// Source-only acceptance anchors for the pending physical-action consumer.
// No RNG call is skipped and passed off as complete damage calculation: stop
// before hit rolls and resume separately after the evade roll's explicit result.
function physicalRow(rom,{hit=99,attacker=0,target=1,monster=false,right=0,left=0,types=0,twoHands=0,hand=0}={}){
 const c=battleCpu(rom,0x18);c.m.set([0x75,0x75,0x75,0x76],0x6e);c.m.set([0,0x62],0x59);
 c.m[0x75a8]=attacker;c.m[0x76a8]=target;c.m[0x75a1]=monster?128:0;c.m[0x75a6]=types;
 c.m[0x6203]=right;c.m[0x6205]=left;c.m[0x741e]=twoHands;c.m[0x741f]=hand;c.m[0x25]=hit;
 segment(c,0x9f7e,0x9fa6);return {hit:c.m[0x25],targetPenalty:c.m[0x7ce9]};
}
test('source physical row protection halves hit chance and removes an extra hit, not an armor-stat bonus',async()=>{
 const {data}=await input();for(let hit=0;hit<256;hit++)for(const attacker of [0,1])for(const target of [0,1])for(const monster of [false,true])assert.deepEqual(physicalRow(data,{hit,attacker,target,monster}),{hit:hit>>(attacker+target),targetPenalty:target});
 for(const hits of [0,1,2,16,255])for(const evade of [0,1,2,16,255])for(const penalty of [0,1]){
  const c=battleCpu(data,0x18);c.m[0x7c]=hits;c.m[0x30]=evade;c.m[0x7ce9]=penalty;segment(c,0x9fd2,0x9fe6);
  assert.equal(c.m[0x7c],Math.max(0,hits-((evade+penalty)&255)));assert.equal(c.m[0x24],c.m[0x7c]);
 }
});
test('source ranged exemptions respect monster branch, weapon flags and the current hand',async()=>{
 const {data}=await input();for(const attacker of [0,1]){
  assert.deepEqual(physicalRow(data,{attacker:attacker|4}),{hit:99,targetPenalty:0});
  assert.deepEqual(physicalRow(data,{attacker,types:8}),{hit:99,targetPenalty:0});
  for(const item of [0x3e,0x3f,0x40,0x41,0x42])for(const hand of [1,2]){
   const right=hand===2?item:0,left=hand===1?item:0,exempt=item>=0x3f&&item<0x42;
   assert.deepEqual(physicalRow(data,{attacker,right,left,twoHands:1,hand}),{hit:exempt?99:99>>(attacker+1),targetPenalty:exempt?0:1});
   assert.deepEqual(physicalRow(data,{attacker,right,left,twoHands:1,hand,monster:true}),{hit:99>>(attacker+1),targetPenalty:1});
  }
 }
});
