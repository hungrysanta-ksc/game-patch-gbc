import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {battleSoundChannels} from '../tools/battle-sound-channels.mjs';import {preparationCosts} from '../tools/battle-preparation-costs.mjs';
test('exclusive preparation costs reject missing cycles and preserve cold-load versus step identity',()=>{
 const text='preparation:0,1,0,8388608,8388608,0,4194304,2097152,2097152';
 const rows=preparationCosts(text+'\n'+text);assert.equal(rows.length,1);assert.equal(rows[0].totalMs,1000);assert.equal(rows[0].audioMs,500);assert.equal(rows[0].request,1);
 assert.throws(()=>preparationCosts(text.replace(',0,4194304',',1,4194304')),/ledger/);
});
test('original SFX shares pulse 2 and noise while battle BGM also uses the fifth DAC path',async()=>{
 const {data}=await input(),r=battleSoundChannels(data);assert.equal(r.effects.length,97);assert.ok(r.effects.some(e=>e.pulse&&e.noise));assert.ok(r.effects.some(e=>e.noise&&!e.pulse));assert.ok(r.battleMusicDirectDacWrites>0);
});
