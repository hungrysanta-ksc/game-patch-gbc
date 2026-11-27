import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {commandCase,sourceCommand,sourceEnd,sourceDeath,sourceEndAnimation,sourceFieldDamage} from '../tools/battle-command-source.mjs';
import {fightSeed} from '../tools/battle-fight-source.mjs';
import {R,sourceResult,resultSeed} from '../tools/battle-result-source.mjs';
test('actual 9DE4 fight dispatcher produces hit count, lethal message, and staged death before graphics removal',async()=>{
 const {data}=await input(),f=fightSeed();f.writeUInt16LE(1,67);f[24]=f[29]=100;const r=sourceCommand(data,commandCase(f));
 assert.equal(r.ok,1);assert.equal(r.call[0],4);assert.equal(r.s[R.script],0);assert.ok(r.call[6]);assert.equal(r.s.readUInt16LE(259),0);assert.equal(r.s[257]&128,0);assert.ok(r.s[R.targetStatus]&128);assert.ok(r.f.subarray(139,149).includes(27));
 const commit=sourceResult(data,r.s,0,r.counters).state;assert.ok(commit[257]&128);assert.equal(sourceResult(data,commit,4).state[R.result],0);
 const removal=sourceDeath(data,false,128,1,[0,255,255,255,255,255,255,255]);commit.set(removal.types,R.types);commit[R.remaining]=removal.remaining;
 assert.equal(sourceResult(data,commit,4).state[R.result],64);assert.deepEqual([...removal.counts],[1,0,0,0]);
});
test('defeat waits for A and skips rewards/party export/row undo; it never requests field restore',async()=>{
 const {data}=await input(),e=sourceEnd(data,3,128,8);
 assert.deepEqual(e.map(x=>x.request),[1,2,3,7,8,10]);assert.equal(e[1].message,28);assert.equal(e[2].song,19);assert.equal(e[2].waitA,1);
});
test('0179 loss is an event continuation, while low-byte-only 0079 still restarts',async()=>{
 const {data}=await input();for(const id of [0x79,0x179]){const e=sourceEnd(data,id,128,8);assert.equal(e[2].waitA,+(id===0x79));assert.equal(e.at(-1).request,id===0x179?9:10);assert.equal(e.at(-1).result,id===0x179?0:128);}
});
test('escape bypasses end message/rewards; 0173 and 0178 victory also bypass them but their ordinary IDs do not',async()=>{
 const {data}=await input();assert.deepEqual(sourceEnd(data,3,2,8).map(x=>x.request),[1,5,6,7,8,9]);
 for(const id of [0x73,0x78,0x173,0x178])assert.equal(sourceEnd(data,id,64).some(x=>x.request===4),id<256);
});
test('death sweep executes 37 original pictures with two waits, opposite directions and no credit for escape',async()=>{
 const {data}=await input();for(const back of [false,true]){
  const r=sourceDeath(data,back,255,1),run=sourceDeath(data,back,255,0);assert.equal(r.trace.length,75);assert.equal(r.trace[0][65],back?6:25);assert.equal(r.trace.at(-1)[65],back?31:0);assert.equal(r.remaining,0);assert.deepEqual([...r.counts],[2,2,1,1]);assert.deepEqual([...run.counts],[0,0,0,0]);
 }
});
test('unresolved target and ammunition consumers fail before original arithmetic/RNG',async()=>{
 const {data}=await input();for(const change of [r=>r.s[47]=255,r=>r.s[257]=128,r=>r.f[128]=65,r=>r.s[49]=4,r=>r.s[46]=20]){
  const row=commandCase();change(row);const r=sourceCommand(data,row);assert.equal(r.ok,0);assert.deepEqual(r.s,row.s);assert.deepEqual(r.f,row.f);assert.deepEqual([...r.counters],row.counters);
 }
});
test('actual defeat graphics waits for fresh A except 0179; field HP decrements preserve a living member at 1 HP',async()=>{
 const {data}=await input();assert.deepEqual(sourceEndAnimation(data,3,128),{song:19,inputCalls:2,waits:2});assert.deepEqual(sourceEndAnimation(data,0x179,128),{song:19,inputCalls:0,waits:1});
 for(const hp of [0,1,2,255,256,65535])assert.equal(sourceFieldDamage(data,hp),hp<2?hp:hp-1);
});
test('all death/stone combinations lose, escape precedes defeat, and HP zero alone is not committed death',async()=>{
 const {data}=await input();for(let mask=0;mask<16;mask++){
  const s=resultSeed();for(let i=0;i<4;i++)s[i*64+1]=mask&(1<<i)?128:64;
  s[R.remaining]=0;assert.equal(sourceResult(data,s,4).state[R.result],128);
  s[R.result]=2;assert.equal(sourceResult(data,s,4).state[R.result],2);
  s[R.result]=0;s[R.remaining]=1;s[(mask%4)*64+1]=0;assert.equal(sourceResult(data,s,4).state[R.result],0);
 }
 const s=resultSeed();for(let i=0;i<4;i++){s[i*64+1]=0;s.writeUInt16LE(0,i*64+3);}assert.equal(sourceResult(data,s,4).state[R.result],0);
});
