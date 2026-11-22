import test from 'node:test';import assert from 'node:assert/strict';
import{encodeTimed,makeReference,toTick,TICK_HZ}from'../tools/timed-stream.mjs';
function vgm(events,{samples=20000,loopSample=null,loopOffset=null}={}){return{clock:1789772,blocks:[],events,totalSamples:samples,samples,loopSample,loopOffset,loopSamples:loopSample===null?0:samples-loopSample};}
const e=(sample,r,value,offset)=>({sample,register:0x4000+r,value,offset});
test('timed stream preserves writes and loop boundary even at the same sample',()=>{
 const v=vgm([e(0,0,48,100),e(1000,2,17,110),e(1000,3,1,120),e(2000,17,127,130),e(2026,17,0,140)],{samples:3000,loopSample:1000,loopOffset:120}),s=encodeTimed(v),r=makeReference(s.data,s);
 assert.equal(s.sourceWrites,5);assert.equal(r.advanceToRecord(2).writes,2);assert.equal(r.advanceToRecord(3).writes,2);assert.equal(r.advanceToRecord(4).writes,3);
 const firstEnd=r.advanceToRecord(s.records.length);assert.equal(firstEnd.loops,1);assert.equal(firstEnd.writes,5);assert.equal(firstEnd.due,toTick(3000));
});
test('fractional loop carry prevents long-term drift; 16-bit runtime deadlines may wrap',()=>{
 const samples=12347,start=113,v=vgm([e(0,0,48,100),e(start,2,1,200)],{samples,loopSample:start,loopOffset:200}),s=encodeTimed(v),r=makeReference(s.data,s),introRecords=s.records.findIndex(x=>x.count===254)+1,loopRecords=s.records.length-introRecords;
 for(let loop=1;loop<=1000;loop++){const state=r.advanceToRecord(introRecords+loop*loopRecords);assert.equal(state.loops,loop);assert.equal(state.due,toTick(start+(samples-start)*loop));}
 assert.ok(r.due>65535);
});
test('long waits split below signed-wrap limit and one-shots stop',()=>{
 const v=vgm([e(0,0,48,100)],{samples:44100*90}),s=encodeTimed(v);assert.ok(s.records.length>10);assert.ok(s.records.every(r=>r.delay<=30000));const ref=makeReference(s.data,s);assert.equal(ref.advanceToRecord(s.records.length).done,true);assert.equal(ref.due,90*TICK_HZ);
});
test('DAC pulse edges stay separated at 4096 Hz',()=>{
 const v=vgm([e(1000,17,127,100),e(1026,17,0,110)]),s=encodeTimed(v),active=s.records.filter(r=>r.count>0&&r.count<254);assert.equal(active.length,2);assert.ok(active[1].time-active[0].time>=2);
});
test('reject a DAC pulse too short for the output clock',()=>{
 assert.throws(()=>encodeTimed(vgm([e(0,17,127,100),e(1,17,0,110)])),/DAC edges collapse/);
});
