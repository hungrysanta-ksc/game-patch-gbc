import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';
import {memoryLayout,checkTransferCode} from './memory-layout.mjs';
const {local}=await input(),dir=ROOT+'/build/exploration',rom=dir+'/ff3-exploration.gbc',report=JSON.parse(await fs.readFile(dir+'/report.json'));
const romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));
check(report.romSha256===romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned artifacts');
const symbols={},allSymbols={};for(const m of(await fs.readFile(dir+'/ff3-exploration.noi','utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi)){allSymbols[m[1]]=Number(m[2]);if(m[1].startsWith('_'))symbols[m[1].slice(1)]=Number(m[2]);}
const out=ROOT+'/evidence/memory';await fs.mkdir(out,{recursive:true});const output=out+'/probe.json',configPath=output+'.config.json';
if(process.argv.includes('--negative-build')){
 const bytes=await fs.readFile(rom),leaf=checkTransferCode(bytes,allSymbols);memoryLayout(allSymbols,{explore:true});let cases=0;
 function rejects(f){let rejected=false;try{f();}catch{rejected=true;}check(rejected,'Invalid memory contract accepted at case '+cases);cases++;}
 const operands=[17,21,27,31,35,39,45,58],addresses=new Set(operands.flatMap(n=>[n,n+1]));
 for(let i=0;i<leaf.bytes;i++)if(!addresses.has(i)){const b=Buffer.from(bytes);b[leaf.address+i]^=1;rejects(()=>checkTransferCode(b,allSymbols));}
 for(const i of operands){const b=Buffer.from(bytes);b[leaf.address+i+1]=0xdf;rejects(()=>checkTransferCode(b,allSymbols));}
 for(const [key,value]of [['s__HEAP',0xcf01],['_text_cells',0xd810],['_field_oam',0xd800],['_ff3_game_state',0xd000],['_native_queue',0xcf00],['_ff3_wram_transfer',0x4000],['_native_snapshot',0xc500]])rejects(()=>memoryLayout({...allSymbols,[key]:value},{explore:true}));
 const result={romSha256,negativeBuildCases:cases,scope:'In-memory mutations of instructions, fixed operands and linker reservations; original ROM unchanged'};await fs.writeFile(out+'/negative-build.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exit(0);
}
const home=await fs.mkdtemp(ROOT+'/.local/mesen-memory-');
await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,memoryProbe:true,auditPath:ROOT+'/tools/memory-audit.lua',audit:await memoryAudit(),output}));
try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyExploration/bin/Release/net8.0/VerifyExploration.dll',configPath],{cwd:ROOT,timeout:300000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.romSha256===romSha256&&actual.memory.probeDone===165&&!actual.memory.probeFailures&&!actual.memory.fault&&actual.memory.probeCases===2167&&actual.memory.untouchedBytes>=128,'Memory probe completion');
const result={romSha256,coreSha256,...actual.memory,...checkMemoryAudit(await fs.readFile(output+'.lua.log','utf8'))};await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
