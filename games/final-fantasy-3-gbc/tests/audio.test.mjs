import test from 'node:test';
import assert from 'node:assert/strict';
import {Driver6502} from '../tools/driver6502.mjs';
import {packFrames,convertAudio} from '../tools/gb-audio.mjs';
import {input,hash} from '../tools/source.mjs';
import {audioCatalog,renderDriver} from '../tools/extract-audio.mjs';
import {nesHarness} from '../tools/nes-harness.mjs';

test('6502 carry, signed overflow and SBC borrow',()=>{
 const c=new Driver6502(Buffer.alloc(524304));
 c.a=127;c.p=0;c.adc(1);assert.equal(c.a,128);assert.equal(c.p&65,64);
 c.a=255;c.p=1;c.adc(0);assert.equal(c.a,0);assert.equal(c.p&3,3);
 c.a=0;c.p=1;c.m.set([0xe9,1],0x200);c.pc=0x200;c.step();assert.equal(c.a,255);assert.equal(c.p&1,0);
});
test('6502 indirect JMP retains original page-wrap behavior; unsupported instructions fail',()=>{
 const c=new Driver6502(Buffer.alloc(524304));c.m.set([0x6c,0xff,3],0x200);c.m[0x3ff]=0x34;c.m[0x300]=0x12;c.m[0x400]=0x56;c.pc=0x200;c.step();assert.equal(c.pc,0x1234);
 c.pc=0x200;c.m[0x200]=2;assert.throws(()=>c.step(),/Unsupported opcode/);
});
test('RLE preserves trigger edges and crosses 255-frame runs and 16 KiB boundaries',()=>{
 const frames=Array.from({length:3000},(_,i)=>{const p=new Uint8Array(12);if(i>600){p[0]=i&255;p[11]=i%11===0?1:0;}return p;});
 const packed=packFrames(frames),decoded=[];assert.ok(packed.length>16384);
 for(let i=0;i<packed.length;i+=13){assert.ok(packed[i]>0);if(packed[i+12])assert.equal(packed[i],1);for(let j=0;j<packed[i];j++)decoded.push(packed.subarray(i+1,i+13));}
 assert.deepEqual(Buffer.concat(decoded),Buffer.concat(frames));
});
test('all 65 song slots and 97 effect slots execute original driver for 300 ticks',async()=>{
 const{data,profile}=await input(),before=hash(data),catalog=audioCatalog(data);
 assert.equal(catalog.songs.length,65);assert.equal(catalog.effects.length,97);
 for(const s of catalog.songs){const r=renderDriver(data,{song:s.id,frames:300});assert.equal(convertAudio(r).packets.length,300);}
 for(const e of catalog.effects){const r=renderDriver(data,{frames:300,effects:[{frame:0,id:e.id}]});assert.equal(r.states.length,300);}
 assert.equal(hash(data),before);assert.equal(before,profile.sha256);
});
test('NES reference harness modifies only the reserved fixed bank, preserves all audio banks',async()=>{
 const{data}=await input(),out=nesHarness(data,{song:32,frames:1440,effects:[{frame:180,id:5}]});
 assert.equal(out.length,data.length);assert.ok(out.subarray(0,16+63*8192).equals(data.subarray(0,16+63*8192)));
 assert.notEqual(hash(out),hash(data));assert.equal(out.readUInt16LE(out.length-4),0xe000);
});
