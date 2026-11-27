import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';
import {playSeedInput,playSeedOriginal,playSeedFields} from '../tools/play-seed-source.mjs';
import {seedOwnership,sourceSeedWriters} from '../tools/seed-ownership.mjs';

test('approved seed stream contains only the 31 field values and 192 live audio bytes',()=>{
 const f=Buffer.from(Array.from({length:79},(_,i)=>i)),a=Buffer.from(Array.from({length:192},(_,i)=>255-i)),b=playSeedInput(f,a);
 assert.equal(b.length,223);assert.equal(new Set(playSeedFields.map(([,i])=>i)).size,31);assert.deepEqual(b.subarray(31),a);
 const excluded=Buffer.from(f);for(let i=0;i<79;i++)if(!playSeedFields.some(([,n])=>n===i))excluded[i]^=255;
 assert.deepEqual(playSeedInput(excluded,a),b);assert.throws(()=>playSeedInput(f.subarray(1),a),/Complete logical/);
});
test('original ADC keeps intermediate carry and discards the last carry for the new extent',async()=>{
 const {data}=await input();assert.equal(playSeedOriginal(data,Buffer.alloc(79),Buffer.alloc(192)),0);
 assert.equal(playSeedOriginal(data,Buffer.alloc(79,255),Buffer.alloc(192,255)),254);
 const a=Buffer.alloc(192);a[191]=255;assert.equal(playSeedOriginal(data,Buffer.alloc(79),a),255);
});
test('current field and music both contribute without consuming any gameplay RNG',async()=>{
 const {data}=await input(),f=Buffer.alloc(79),a=Buffer.alloc(192),before=Buffer.from(f);
 for(const [,i]of playSeedFields){f[i]=1;assert.equal(playSeedOriginal(data,f,a),1);assert.equal(f[i],1);f[i]=0;}
 for(let i=0;i<a.length;i++){a[i]=1;assert.equal(playSeedOriginal(data,f,a),1);assert.equal(a[i],1);a[i]=0;}
 assert.deepEqual(f,before);
});
test('source inventory preserves unresolved bytes and verifies writer bytes against the ROM',async()=>{
 const {data}=await input(),rows=seedOwnership();assert.equal(rows.length,256);assert.equal(rows.filter(r=>r.role==='battle-prefix').length,27);assert.equal(rows.filter(r=>r.role==='other-source-state').length,191);
 const text='3F/FC2E: 85 15     STA $15';assert.equal(sourceSeedWriters(data,text).writers[0].address,0x15);
 const bad=Buffer.from(data);bad[16+0x3f*8192+(0xfc2e&8191)]^=1;assert.throws(()=>sourceSeedWriters(bad,text),/differs from ROM/);
});
