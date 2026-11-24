import fs from 'node:fs/promises';import {ROOT,input,check,hash} from './source.mjs';import {sourceItemCursor} from './battle-items-source.mjs';
const {data,profile}=await input(),open=JSON.parse(await fs.readFile(ROOT+'/.local/item-source-open.json')),nav=JSON.parse(await fs.readFile(ROOT+'/.local/item-source-navigation.json'));
check(open.interventions.length===0&&nav.interventions.length===0,'Unmodified original input observation');
const ram=Buffer.from(open.ram.hex,'hex'),sram=Buffer.from(open.sram.hex,'hex');check(sram.subarray(0xc0,0x100).equals(Buffer.alloc(64)),'Original first-battle empty bag');
let state=Buffer.from([0x62,0x63,0x66,0x67,0x68,0x69].map(a=>ram[a]));check(state.equals(Buffer.from([0,1,1,0,0,0])),'Original open cursor');
const keys={left:64,right:128,down:32,up:16,a:1,b:2};let hands=0;
for(const [i,r]of nav.records.entries()){
 state=sourceItemCursor(data,state,keys[i===0?'left':r.key]).state;const raw=Buffer.from(r.cursor,'hex'),observed=Buffer.from([0,1,4,5,6,7].map(i=>raw[i]));check(state.equals(observed),'Actual NES item cursor '+r.name);
 const oam=Buffer.from(r.oam,'hex'),x=state[1]===state[2]?8:128,y=168+state[0]*16;check(oam[32]===y&&oam[35]===x&&oam[36]===y&&oam[39]===x-8,'NES current hand '+r.name);hands++;
 if(state[3])check(oam[48]===y&&oam[51]===x+4,'NES selected hand '+r.name);else check(oam[48]===240,'NES hidden selected hand '+r.name);hands++;
}
const report={sourceSha256:profile.sha256,states:nav.records.length,hands,openSha256:hash(Buffer.from(JSON.stringify(open))),navigationSha256:hash(Buffer.from(JSON.stringify(nav))),scope:'Actual original empty-bag item opening, equipped column, movement, first A and B deselect; cursor and OAM. Not GBC item rendering or populated-list normal gameplay'};
await fs.mkdir(ROOT+'/evidence/battle-items',{recursive:true});await fs.writeFile(ROOT+'/evidence/battle-items/nes-observations.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
