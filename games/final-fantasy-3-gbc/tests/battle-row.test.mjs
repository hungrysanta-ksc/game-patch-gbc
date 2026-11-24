import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {sourceRow,rowPositions} from '../tools/battle-row-source.mjs';
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
