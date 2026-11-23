import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';
import {stateAssets,stateFixtures,sourceInitialState} from './state-source.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/state',gen=out+'/generated';
await fs.mkdir(gen,{recursive:true});await fs.mkdir(ROOT+'/.local/compiler-tmp',{recursive:true});
const assets=stateAssets(data),generatorSha256=hash(Buffer.concat(await Promise.all(['state-source.mjs','driver6502.mjs'].map(n=>fs.readFile(ROOT+'/tools/'+n)))));
let f;
if(process.argv.includes('--reuse-fixtures')){const cache=JSON.parse(await fs.readFile(out+'/fixtures.json')),bytes=await fs.readFile(out+'/fixtures.bin');check(cache.sourceSha256===profile.sha256&&cache.generatorSha256===generatorSha256&&cache.sha256===hash(bytes),'Stale state fixture cache');f={data:bytes,cases:cache.cases,counts:cache.counts};}
else f=stateFixtures(data);
await fs.writeFile(gen+'/state-assets.h',assets.header);await fs.writeFile(out+'/fixtures.bin',f.data);
await fs.writeFile(out+'/fixtures.json',JSON.stringify({sourceSha256:profile.sha256,generatorSha256,sha256:hash(f.data),cases:f.cases,counts:f.counts},null,2));
const sources=[],count=Math.ceil(f.data.length/16384);check(count+11<=256,'State fixtures exceed low MBC5 banks');
for(let i=0;i<count;i++){const p=gen+'/fixture-'+(i+11)+'.c';await fs.writeFile(p,'#pragma bank '+(i+11)+'\n#include <stdint.h>\nconst uint8_t fixture_'+(i+11)+'[]={'+[...f.data.subarray(i*16384,(i+1)*16384)].join(',')+'};\n');sources.push(p);}
const arg=process.argv.indexOf('--gbdk'),gbdk=arg<0?local.gbdk:process.argv[arg+1];check(gbdk,'Pass --gbdk PATH');
const compiler=gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Compiler mismatch');
const banks=2**Math.ceil(Math.log2(count+11)),romPath=out+'/ff3-state-test.gbc';
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo'+banks,'-Wm-ynFF3STATE','-Wl-m','-Wl-j','-I'+gen,'-o',romPath,...['game-state','game-save','game-state-test'].map(n=>ROOT+'/src/'+n+'.c'),...sources],{cwd:out,env:{...process.env,TMP:ROOT+'/.local/compiler-tmp',TEMP:ROOT+'/.local/compiler-tmp'},maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const rom=await fs.readFile(romPath);checkGbc(rom,banks,0x1b,3);check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link overflow');check(rom.subarray(11*16384,11*16384+f.data.length).equals(f.data),'Fixture bytes changed during link');
const symbols={};for(const m of (await fs.readFile(romPath.replace('.gbc','.noi'),'utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
check(symbols.s__HEAP<0xd000,'State test WRAM exceeded');check(symbols.l__CODE_10<16384,'State bank overflow');
for(const name of ['ff3_state_init','ff3_state_seal','ff3_state_valid','ff3_save_menu_prepare','ff3_save_count_commit','ff3_field_random','ff3_battle_seed','ff3_battle_random','ff3_save_write','ff3_save_read'])check(symbols['b_'+name]===10,'State ABI bank: '+name);
// Corrupt the first expected initial-state byte, not input or executable code.
const negative=Buffer.from(rom);negative[11*16384+2]^=1;let sum=0;for(let i=0;i<negative.length;i++)if(i!==0x14e&&i!==0x14f)sum=(sum+negative[i])&65535;negative.writeUInt16BE(sum,0x14e);await fs.writeFile(out+'/ff3-state-negative.gbc',negative);
const report={schema:1,sourceSha256:profile.sha256,romSha256:hash(rom),negativeRomSha256:hash(negative),romBanks:banks,bank10Bytes:symbols.l__CODE_10,staticWramEnd:symbols.s__HEAP,cases:f.cases,counts:f.counts,fixtureBytes:f.data.length,fixtureSha256:hash(f.data),initialStateSha256:hash(sourceInitialState(data)),assets:assets.provenance,scope:'Original function boundaries; not name entry, save menu UI or normal-play RNG seed provenance'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
