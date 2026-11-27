import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {nativeReference} from './native-reference.mjs';
const {data,local}=await input(),out=ROOT+'/evidence/scene-endpoints';await fs.mkdir(out,{recursive:true});
const run=promisify(execFile),env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
async function logged(args,log){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:600000,maxBuffer:8e6});await fs.writeFile(out+'/'+log,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+log,(e.stdout||'')+(e.stderr||''));throw e;}}
check(hash(await fs.readFile(local.mesenCore))==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned core');
await logged(['build',ROOT+'/tools/VerifySceneVideo/VerifySceneVideo.csproj','-c','Release','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log');
const results=[];
for(const [mode,folder,name,key] of [['field','exploration','ff3-exploration','romSha256'],['battle','battle-effects','ff3-battle-effects-video','videoRomSha256']]){
 const dir=ROOT+'/build/'+folder,report=JSON.parse(await fs.readFile(dir+'/report.json')),rom=dir+'/'+name+'.gbc',romSha256=hash(await fs.readFile(rom));check(romSha256===report[key],'Endpoint artifact identity');
 const symbols={};for(const m of(await fs.readFile(dir+'/'+name+'.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
 const config=out+'/'+mode+'.config.json',output=out+'/'+mode+'.json';
 await fs.writeFile(config,JSON.stringify({mode,dll:local.mesenCore,home:await fs.mkdtemp(ROOT+'/.local/mesen-endpoint-'),rom,romSha256,symbols,output}));
 await logged([ROOT+'/tools/VerifySceneVideo/bin/Release/net8.0/VerifySceneVideo.dll',config],mode+'.log');
 const actual=JSON.parse(await fs.readFile(output)),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:report.audio.plan,ticks:report.audio.ticks});let end;
 check(actual.romSha256===romSha256&&actual.cycles.length===(mode==='field'?2:4)&&actual.tailCases===(mode==='field'?64:0),'Endpoint coverage');
 for(const a of actual.audio){check(!a.faults,'Endpoint runtime fault');const b=Buffer.from(a.consumed,'hex');if(!b.readUInt32LE(4))continue;end=ref.advanceToEvent(b.readUInt32LE(4));check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Endpoint original audio sequence');}
 results.push({mode,romSha256,cycles:actual.cycles.length,tailCases:actual.tailCases,observations:actual.audio.length,sourceTicks:end?.ticks});
}
const result={results,scope:'Real field and battle endpoint detach/reattach in separate ROMs. Shared boundary tested; combined gameplay roundtrip remains open.'};await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
