import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';import {parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';import {nativeReference} from './native-reference.mjs';
const {data,local}=await input(),dir=ROOT+'/build/scene-layout',out=ROOT+'/evidence/scene-layout';await fs.mkdir(out,{recursive:true});
const report=JSON.parse(await fs.readFile(dir+'/report.json')),rom=dir+'/ff3-scene-layout.gbc',romSha256=hash(await fs.readFile(rom));check(report.romSha256===romSha256,'Combined artifact identity');
const all=parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')),symbols=Object.fromEntries(Object.entries(all).filter(([n])=>n.startsWith('_')).map(([n,v])=>[n.slice(1),v]));checkSceneLayout(all);
const coreSha256=hash(await fs.readFile(local.mesenCore));check(coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned core');
const run=promisify(execFile),env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
async function logged(args,file){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:600000,maxBuffer:8e6});await fs.writeFile(out+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+file,(e.stdout||'')+(e.stderr||''));throw e;}}
await fs.writeFile(out+'/config.json',JSON.stringify({dll:local.mesenCore,home:await fs.mkdtemp(ROOT+'/.local/mesen-layout-'),rom,romSha256,coreSha256,symbols,resume:false,commands:[],output:out+'/result.json',readouts:[['native_consumed',12],['native_underruns',2],['native_max_late',2],['scene_arena_owner',1],['scene_arena_fault',1],['memory_fault',1],['ff3_error',1]].map(([name,bytes])=>({name,bytes}))}));
await logged(['build',ROOT+'/tools/VerifyState/VerifyState.csproj','-c','Release','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log');
await logged([ROOT+'/tools/VerifyState/bin/Release/net8.0/VerifyState.dll',out+'/config.json'],'run.log');
const r=JSON.parse(await fs.readFile(out+'/result.json'));check(r.status===1&&!r.failure&&r.testCase===650,'Combined memory boundary '+JSON.stringify(r));
for(const n of ['native_underruns','native_max_late','scene_arena_fault','memory_fault','ff3_error'])check(/^0+$/.test(r.readouts[n]),'Combined runtime fault '+n);
check(r.readouts.scene_arena_owner==='01','Final field arena owner');
const audio=JSON.parse(await fs.readFile(dir+'/audio.json')),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:audio.plan,ticks:audio.ticks}),b=Buffer.from(r.readouts.native_consumed,'hex'),end=ref.advanceToEvent(b.readUInt32LE(4));
check(end.done&&end.ticks===7200&&end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Continuous original audio');
const result={romSha256,checks:r.testCase,cycles:64,sourceTicks:end.ticks,layout:report.layout,scope:'Same-ROM overlay save/overwrite/restore and continuous original audio. Actual field/battle cold-entry regressions are separate from gameplay roundtrip.'};await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
