import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {offset} from '../tools/render-budget-source.mjs';
import {magicAssets,magicResidentAssets} from '../tools/battle-magic-assets.mjs';import {magicSource,magicSourcePixels} from '../tools/battle-magic-source.mjs';
import {magicFrameReference} from '../tools/battle-magic-frames.mjs';
test('live fixture spells select ordinary animation in the original attack-property consumer',async()=>{
 const {data}=await input();for(const id of [0,1,29,36,50])assert.equal(data[offset(0x30,0x98c0+id*8+6)],0);
 const a=magicAssets(data);assert.equal(a.records.length,88);assert.ok(a.records.every(r=>r.length===523));
});
test('resident pair dictionaries preserve every reachable source cell under four whole-pair flips',async()=>{
 const {data}=await input(),raw=magicAssets(data),r=magicResidentAssets(data,raw);let maximum=0,cases=0;
 for(const a of r.records){maximum=Math.max(maximum,a.bytes/32);const b=r.banks[a.bank-66];assert.equal(a.patterns&15,0);
  for(let f=0;f<a.frames;f++){const table=b.subarray(a.offset+10+f*19,a.offset+10+(f+1)*19);
   for(const horizontal of [0,1])for(const vertical of [0,1]){
    // FF without a preceding vertical marker is a prefix, not a frame code.
    if(table[0]===127&&horizontal&&!vertical)continue;
    const source=magicFrameReference(data,{code:table[0]|horizontal*128,vertical,enemy:0,back:0,x:80,y:80,properties:raw.records[a.spell][520],magic:0}).visible,expected=Buffer.alloc(48*48),actual=Buffer.alloc(48*48),oy=68-(raw.records[a.spell][520]&32?12:0);
    for(let i=0;i<36;i++){const at=i*4,t=source[at+1],attr=source[at+2];if(!t)continue;const tile=raw.records[a.spell].subarray((t-73)*16,(t-72)*16);
     for(let y=0;y<8;y++)for(let x=0;x<8;x++){const sy=attr&128?7-y:y,bit=attr&64?x:7-x;expected[(source[at]-oy+y)*48+source[at+3]-64+x]=((tile[sy*2]>>bit)&1)|(((tile[sy*2+1]>>bit)&1)<<1);}
    }
    for(let i=0;i<18;i++){const id=table[i+1];if(id===255)continue;assert.ok(id*32<a.bytes);const tile=b.subarray(a.patterns+id*32,a.patterns+id*32+32),ox=horizontal?i%6*8:40-i%6*8,y0=vertical?32-Math.floor(i/6)*16:Math.floor(i/6)*16;
     for(let y=0;y<16;y++)for(let x=0;x<8;x++){const sy=vertical?15-y:y,bit=horizontal?x:7-x;actual[(y0+y)*48+ox+x]=((tile[sy*2]>>bit)&1)|(((tile[sy*2+1]>>bit)&1)<<1);}
    }
    assert.deepEqual(actual,expected,'spell/frame/flip '+[a.spell,table[0],horizontal,vertical]);cases++;
   }
  }
 }
 assert.equal(maximum,30);assert.equal(cases,824);assert.equal(r.records.length,88);
});
test('complete enemy ordinary owner preserves target iteration, sound requests and explicit waits',async()=>{
 const {data}=await input();
 for(const profile of [0,2])for(const [spell,mask,count]of [[29,128,27],[36,16,27],[0,240,134],[1,0,2],[50,64,19]]){
  const r=magicSource(data,{profile,spell,mask});assert.equal(r.frames.length,count);
  const targets=[...new Set(r.frames.filter(f=>f.pc===0xb7ad).map(f=>f.target))];assert.deepEqual(targets,[0,1,2,3].filter(i=>mask&(128>>i)));
  assert.equal(r.sounds.length,1+targets.length);assert.equal(r.sounds[0],255);
  // B70B/B70E and BB0F/BB12 must remain two waits even when their OAM is equal.
  assert.deepEqual(r.frames.at(-1).raw,r.frames.at(-2).raw,'Final clear is already resident');
  for(const f of r.frames)assert.equal(magicSourcePixels(f,Buffer.alloc(160*144*3),profile>=2).length,160*144*3);
 }
});
test('original B765 grid repeats the same six X coordinates for every row',async()=>{
 const {data}=await input();let cases=0;
 for(let code=0;code<256;code++)for(const back of [0,1])for(const vertical of [0,1]){
  if(code===255&&!vertical)continue;
  const r=magicFrameReference(data,{code,back,vertical,enemy:0,x:back?8:240,y:80,properties:32,magic:0}).visible;
  for(let i=6;i<36;i++)assert.equal(r[i*4+3],r[(i%6)*4+3],'Original grid '+[code,back,vertical,i]);
  cases++;
 }
 assert.equal(cases,1022);
});
