import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';
import {makeControlFixtures,routines} from './control-fixtures.mjs';

const {data,profile,local}=await input();
const out=ROOT+'/build/control',gen=out+'/generated';
await fs.mkdir(gen,{recursive:true});await fs.mkdir(ROOT+'/.local/compiler-tmp',{recursive:true});
const fixtures=makeControlFixtures(data),banksNeeded=Math.ceil(fixtures.data.length/16384);
check(banksNeeded<=254,'Fixture reader bank capacity exceeded');
const sources=[];
async function bank(number,bytes){const file=gen+'/control-bank'+number+'.c';await fs.writeFile(file,'#pragma bank '+number+'\n#include <stdint.h>\nconst uint8_t control_bank'+number+'[]={'+[...bytes].join(',')+'};\n');sources.push(file);}
const sourceBank=data.subarray(16+0x36*8192,16+0x37*8192);
await bank(1,sourceBank);
for(let i=0;i<banksNeeded;i++)await bank(i+2,fixtures.data.subarray(i*16384,(i+1)*16384));
await fs.writeFile(gen+'/control-assets.h','#define CONTROL_CASES '+fixtures.cases.length+'u\n');
await fs.writeFile(out+'/fixtures.bin',fixtures.data);
await fs.writeFile(out+'/cases.json',JSON.stringify(fixtures.cases.map(({bytes,...rest})=>rest),null,2));
const n=process.argv.indexOf('--gbdk'),gbdk=n<0?local.gbdk:process.argv[n+1];check(gbdk,'Pass --gbdk PATH');
const compiler=gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));
check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Compiler mismatch');
const banks=2**Math.ceil(Math.log2(banksNeeded+2)),romPath=out+'/ff3-control-test.gbc';
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x19','-Wm-yo'+banks,'-Wm-ynFF3CONTROL','-Wl-m','-Wl-j','-I'+gen,'-o',romPath,ROOT+'/src/audio-control.c',ROOT+'/src/audio-control-test.c',...sources],{cwd:out,env:{...process.env,TMP:ROOT+'/.local/compiler-tmp',TEMP:ROOT+'/.local/compiler-tmp'},maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const rom=await fs.readFile(romPath);
check(rom.length===banks*16384&&rom[0x143]===0xc0&&rom[0x147]===0x19,'CGB/MBC5 header mismatch');
check(rom.subarray(16384,16384+8192).equals(sourceBank),'Source lookup bank differs');
check(rom.subarray(32768,32768+fixtures.data.length).equals(fixtures.data),'Linked fixtures differ');
let header=0,sum=0;for(let i=0x134;i<=0x14c;i++)header=(header-rom[i]-1)&255;
for(let i=0;i<rom.length;i++)if(i!==0x14e&&i!==0x14f)sum=(sum+rom[i])&65535;
check(header===rom[0x14d]&&sum===rom.readUInt16BE(0x14e),'ROM checksums');
const negative=Buffer.from(rom),first=fixtures.cases[0];
const negativeOffset=32768+first.bytes.length-(216+1+first.writes*2);
negative[negativeOffset]^=1;sum=0;for(let i=0;i<negative.length;i++)if(i!==0x14e&&i!==0x14f)sum=(sum+negative[i])&65535;
negative.writeUInt16BE(sum,0x14e);await fs.writeFile(out+'/ff3-control-negative.gbc',negative);
const report={schema:1,sourceSha256:profile.sha256,romSha256:hash(rom),romBytes:rom.length,fixtureBytes:fixtures.data.length,fixtureSha256:hash(fixtures.data),cases:fixtures.cases.length,perOperation:fixtures.counts,routines:routines.map(a=>'36/'+a.toString(16)),callbackBoundaries:fixtures.cases.reduce((s,c)=>s+c.callbacks,0),expectedWrites:fixtures.cases.reduce((s,c)=>s+c.writes,0),negative:{romSha256:hash(negative),changedExpectedByte:negativeOffset,expectedCase:0,expectedFailure:4,expectedIndex:0},scope:'C control/output port; unported VM callees are checked boundary replays, not native VM execution',recording:false};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
