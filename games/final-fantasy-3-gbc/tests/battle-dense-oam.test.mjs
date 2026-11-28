import test from 'node:test';import assert from 'node:assert/strict';import {denseSchedule} from '../tools/battle-dense-oam-audit.mjs';
function fixture(){const initial=Buffer.alloc(32);for(let i=0;i<8;i++)initial.set([24+(i>>1)*16,8+(i&1)*8,1+i,15],i*4);return {initial,records:Buffer.from([72,128,96,8,10,15,76,132,96,16,11,15,88,136,112,8,12,15,92,140,112,16,13,15])};}
test('eight physical retained slots cover twelve complete glyphs without alternating frames',()=>{const f=fixture(),r=denseSchedule(f.initial,f.records,4);assert.equal(r.logical,12);assert.equal(r.peak,2);assert.equal(r.lines.filter(n=>n===2).length,48);});
test('reject replacing a still visible glyph, late writes, numeral slots and incomplete glyphs',()=>{
 for(const change of [r=>r[0]=12,r=>r[0]=80,r=>r[1]=124,r=>r[2]=15,r=>r[4]=0,r=>r[6]=73]){const f=fixture();change(f.records);assert.throws(()=>denseSchedule(f.initial,f.records,4));}
});
