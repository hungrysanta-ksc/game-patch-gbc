// Development-only state intervention, never a product-build dependency.
import fs from 'node:fs/promises';
import path from 'node:path';
import {input,ROOT,hash,check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {sourceEquipmentStats} from './battle-equipment-source.mjs';
const arg=k=>{const i=process.argv.indexOf(k);check(i>=0&&process.argv[i+1],`Required ${k}`);return path.resolve(process.argv[i+1]);};
const base=arg('--dump'),state=arg('--state'),out=arg('--out');
const {data,local,rom}=await input();
const required=[['state',state,'55faa0141c1ad2218c458e957bae27c514d94feaffde86003a2fde7fad0a61c9'],['iram',base+'/iram.bin','028ae484f5b9d4f71ea06ea54724b6be4793ccd030dfeb39af207d1e31eb8c86'],['sram',base+'/prgram.bin','0192c3e4d5a2ec32498fe976eef1e02684859f35b2e01744fbc7dd93bdfd06ac']];
const buffers={};for(const [name,file,digest] of required){buffers[name]=await fs.readFile(file);check(hash(buffers[name])===digest,`Unsupported diagnostic ${name}; see docs/battle-weapon-duration.md`);}
check(local.mesenCore&&hash(await fs.readFile(local.mesenCore))==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned MesenCore required');
function prepared(characterLevel,jobLevel,counter){
 const c=battleCpu(data,0x18);c.m.set(buffers.iram);c.m.set(buffers.sram,0x6000);
 // Actor 3, normal original physical caller, 31/A2BA before hit calculation.
 const ca=0x61c0,ea=0x62c0,ba=0x7635,s=Buffer.concat([c.m.subarray(ca,ca+64),c.m.subarray(ea,ea+64),c.m.subarray(ba,ba+64)]);
 s[1]=characterLevel-1;s[16]=jobLevel-1;s[128]=characterLevel-1;s[143]=jobLevel-1;
 const derived=sourceEquipmentStats(data,s);c.m.set(derived.subarray(0,64),ca);c.m.set(derived.subarray(64,128),ea);c.m.set(derived.subarray(128),ba);c.m[0x16]=counter;return c;
}
const cases=[];
for(const characterLevel of [1,33,99]){
 let selected;let changed=0;
 for(let counter=0;counter<256;counter++){
  const rows=[1,99].map(jobLevel=>{const c=prepared(characterLevel,jobLevel,counter);c.call(0x9e8a);return{jobLevel,hits:[c.m[0xbb],c.m[0xbc]],rng:c.m[0x16]};});
  // Only right sword has a visual cycle; empty offhand returns immediately.
  const repeats=x=>Math.max(1,Math.min(x.hits[0],4)),difference=repeats(rows[1])-repeats(rows[0]);
  if(difference)changed++;if(!selected||difference>selected.difference)selected={counter,rows,difference};
 }
 cases.push({characterLevel,...selected,changedCounterPositions:changed});
}
await fs.mkdir(out,{recursive:true});
for(const {characterLevel,counter,rows} of cases)for(const {jobLevel} of rows){
 const c=prepared(characterLevel,jobLevel,counter),patches=[];
 for(const [start,b] of [[0,buffers.iram],[0x6000,buffers.sram]])for(let i=0;i<b.length;i++)if(c.m[start+i]!==b[i])patches.push({address:start+i,value:c.m[start+i]});
 const home=out+`/L${characterLevel}-J${jobLevel}`;await fs.mkdir(home,{recursive:true});
 await fs.writeFile(home+'/config.json',JSON.stringify({dll:local.mesenCore,rom:path.resolve(rom),home,state,audit:ROOT+'/tools/battle-weapon-audit.lua',patches,characterLevel,jobLevel,counter,baseStateSha256:hash(buffers.state)},null,2));
}
await fs.writeFile(out+'/conditions.json',JSON.stringify({romSha256:hash(data),cases},null,2));console.log(JSON.stringify(cases));
