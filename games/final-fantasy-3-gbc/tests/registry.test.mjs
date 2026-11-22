import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCoverage,decodeRle,decodeEvent,conditional,evaluateConditional,bankSpans} from '../tools/registry-core.mjs';

test('registry rejects gaps, overlaps, duplicate IDs and nonintegral boundaries',()=>{
 const spec={regions:[{id:'a',begin:16,end:32},{id:'b',begin:32,end:48}],unclassified:[]};
 assert.equal(validateCoverage(spec,48).length,2);
 for(const delta of [-1,1,.5]){const bad=structuredClone(spec);bad.regions[1].begin+=delta;assert.throws(()=>validateCoverage(bad,48));}
 const bad=structuredClone(spec);bad.regions[1].id='a';assert.throws(()=>validateCoverage(bad,48),/Duplicate/);
 assert.deepEqual(bankSpans(0x200f,0x2012),[{bank:0,offset:8191,bytes:1},{bank:1,offset:0,bytes:2}]);
});
test('bounded RLE preserves zero=256 and rejects overflow/truncation',()=>{
 const r=Buffer.alloc(32);r.set([0x85,0],16);
 assert.deepEqual(decodeRle(r,16,18,256).data,Buffer.alloc(256,5));
 assert.throws(()=>decodeRle(r,16,17,256),/count/);
 assert.throws(()=>decodeRle(r,16,18,255),/exceeds/);
});
test('event decoder refuses fixed-bank targets and consumes E4/FE operands',()=>{
 const r=Buffer.alloc(0x80010);r.set([0xe4,0xff,0xfe,2,0xfd,0xff],0x58010);
 const s=decodeEvent(r,0x8000);assert.deepEqual(s.commands.map(x=>x.op),[0xe4,0xfe,0xfd,0xff]);
 assert.throws(()=>decodeEvent(r,0xc000),/outside/);
 r[0x5c00f]=0xe4;assert.throws(()=>decodeEvent(r,0xbfff),/operand/);
});
test('conditional results are not parsed as flags; item prefix and false branch are preserved',()=>{
 const r=Buffer.alloc(0x80010);r.set([0xab,0x81,0x02,0xff,0xfe,0xff,7],0x58010);
 const s=conditional(r,0x8000,1),flags=new Uint8Array(16);
 assert.equal(evaluateConditional(s,flags),7);flags[0]=2;assert.equal(evaluateConditional(s,flags),0xfe);
 flags[0]|=4;assert.equal(evaluateConditional(s,flags),7);
 r.fill(1,0x58010,0x58050);assert.throws(()=>conditional(r,0x8000),/bounded/);
 assert.throws(()=>conditional(r,0),/outside/);
});
