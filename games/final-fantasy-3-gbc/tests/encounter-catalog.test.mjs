import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {encounterCatalog} from '../tools/encounter-catalog.mjs';
import {encounterEntryOriginal} from '../tools/encounter-entry-source.mjs';import {sourceInitialState} from '../tools/state-source.mjs';
test('six cave maps share four original groups and deduplicate all four formations',async()=>{
 const {data}=await input(),c=encounterCatalog(data,[181,111,115,112,22,113]);
 assert.deepEqual(c.maps.map(m=>m.group),[0,0,1,2,3,3]);assert.deepEqual(c.groups.map(g=>g.id),[0,1,2,3]);assert.deepEqual(c.formations,[0,1,2,3]);assert.ok(c.maps.every(m=>m.background===8));
 for(const g of c.groups)assert.equal(g.slots.length,8);
 const state=sourceInitialState(data);for(const id of c.formations)for(let seed=0;seed<256;seed++){const e=encounterEntryOriginal(data,id,seed,state);assert.ok(e.counts.reduce((a,b)=>a+b)>0);assert.equal(e.types.filter(v=>v!==255).length,e.counts.reduce((a,b)=>a+b));}
});
test('catalog rejects mixed terrain, duplicates and invalid map IDs',async()=>{
 const {data}=await input();for(const maps of [[],[181,181],[181,29],[-1],[256],[1.5]])assert.throws(()=>encounterCatalog(data,maps));
});
