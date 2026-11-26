import test from 'node:test';import assert from 'node:assert/strict';
import {input} from '../tools/source.mjs';import {partyEntryOracle,nativePartyTiles} from '../tools/battle-party-oam-source.mjs';
import {residentEnemy,residentRgb,originalResidentRgb} from '../tools/battle-resident-bg.mjs';import {hitFlashAssets,hitJobAssets} from '../tools/battle-hit-assets.mjs';
import {initializedBattle} from '../tools/battle-transition-source.mjs';import {entryState} from '../tools/battle-entry-source.mjs';
test('all eight selected enemy flashes retain original sampled pixels in both directions',async()=>{
 const {data}=await input();for(const back of [false,true]){const p=partyEntryOracle(data,{back}),bg=residentEnemy(p),assets=hitFlashAssets(data,p,bg);assert.ok(bg.patterns.length/16+20<=256);
 const {m}=initializedBattle(data,{formation:3,rows:[0,1,0,1],terrain:0,back});m.call(0xb469);m.call(0xb304);
 for(let enemy=0;enemy<8;enemy++){m.c.m[0x7e8f]=128>>enemy;m.c.m[0x7e90]=3;m.call(0xa738);m.call(0xaf34);
 const maps=Buffer.alloc(1232),o=assets.objects.subarray(enemy*64,enemy*64+64),objects=[];for(let y=0;y<11;y++)for(let x=0;x<32;x++){maps[y*56+x]=assets.maps[enemy*704+y*32+x];maps[616+y*56+x]=assets.maps[enemy*704+352+y*32+x];}
 for(let i=0;i<16;i++)if(o[i*4])objects.push({x:o[i*4+1]-8,y:o[i*4]-16,tile:o[i*4+2],attr:o[i*4+3]});
 const f={state:entryState(m.c),original:Buffer.from(m.c.m.subarray(0x2a0,0x300)),ppu:Buffer.from(m.ppu.bytes)},a={...bg,maps,objects};
 const got=residentRgb({...p,frames:[]},f,a,undefined,{tiles:nativePartyTiles(m.ppu.bytes.subarray(0x1000,0x2000))}),want=originalResidentRgb(p,f);assert.ok(got.subarray(16*480,104*480).equals(want.subarray(16*480,104*480)),`enemy ${enemy}, back ${back}`);
 }
 }
});
test('hit graphics retain all 22 original job resources at shared 1390..13ef',async()=>{const {data}=await input(),bytes=hitJobAssets(data),{m}=initializedBattle(data,{formation:3,rows:[0,1,0,1],terrain:0});assert.equal(bytes.length,22*96);for(let job=0;job<22;job++){m.c.m[0x7d8b]=job;m.c.x=0;m.call(0xa9b1);const raw=m.ppu.bytes.subarray(0x1390,0x13f0);for(let t=0;t<96;t+=16)for(let y=0;y<8;y++){assert.equal(bytes[job*96+t+y*2],raw[t+y]);assert.equal(bytes[job*96+t+y*2+1],raw[t+8+y]);}}});
