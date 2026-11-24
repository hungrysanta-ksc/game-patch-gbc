import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {sourceFight,fightSeed,fightCases,originalFightCases,FIGHT_BYTES} from '../tools/battle-fight-source.mjs';
test('resolved original fight exposes separate calculation hits, animation handoff, HP and staged statuses',async()=>{
 const {data}=await input(),s=fightSeed();s[23]=s[28]=8;s[24]=s[29]=100;s[97]=s[98]=0;s[40]=0;s.writeUInt16LE(100,67);
 const r=sourceFight(data,s);assert.equal(r.ok,1);assert.equal(r.state.length,FIGHT_BYTES);assert.deepEqual([...r.state.subarray(165,169)],[8,8,8,8]);assert.equal(r.state[65],0);assert.equal(r.state[163]&128,128);assert.equal(r.state.readUInt16LE(67),0);assert.ok(r.state.readUInt16LE(169)>100);
});
test('unsupported retarget/split/running contexts reject without state or RNG mutation',async()=>{
 const {data}=await input();for(const c of fightCases().filter(c=>c.tag==='rejected')){const r=sourceFight(data,c.state,c.counters);assert.equal(r.ok,0);assert.deepEqual(r.state,c.state);assert.deepEqual([...r.counters],c.counters);}
});
test('original ordinary versus undead drain retains distinct HP and numeral direction',async()=>{
 const {data}=await input();for(const undead of [false,true]){const s=fightSeed();s[22]=s[27]=1;s[82]=undead?128:0;s[40]=0;const r=sourceFight(data,s);assert.equal(r.ok,1);if(undead){assert.ok(r.state.readUInt16LE(3)<900);assert.equal(r.state.readUInt16LE(67),900);assert.equal(r.state.readUInt16LE(169),0x8000);}else{assert.ok(r.state.readUInt16LE(3)>900);assert.ok(r.state.readUInt16LE(67)<900);assert.ok(r.state[172]&128);}}
});
test('original property loaders feed both attack directions and job proficiency without animation clamping',async()=>{
 const {data}=await input(),cases=originalFightCases(data);assert.equal(cases.length,264);
 for(const row of cases){const r=sourceFight(data,row.state,row.counters);assert.equal(r.ok,1,JSON.stringify(row));}
 const pair=cases.filter(c=>c.job===0&&c.characterLevel===33&&!c.reverse).map(c=>sourceFight(data,c.state,c.counters));
 assert.deepEqual(pair.map(r=>r.state[165]),[2,3]);
 // This ROM-initialized RNG table is independent of PR44's private save state.
 const high=cases.find(c=>c.job===0&&c.characterLevel===99&&c.jobLevel===99&&!c.reverse),r=sourceFight(data,high.state,high.counters);assert.equal(r.state[165],7);assert.equal(r.state[167],7);
});
