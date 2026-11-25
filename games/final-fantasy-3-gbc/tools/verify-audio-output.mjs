import {writeFileSync} from "node:fs";import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {ROOT,input,check,hash} from './source.mjs';
const {local}=await input(),base=ROOT+'/build/battle-opening-video',out=ROOT+'/build/audio-output-probe';await fs.mkdir(out,{recursive:true});
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');
const object=base+'/obj/11.o',identity=hash(await fs.readFile(object)),rom=out+'/audio-output-probe.gbc',logs=[];
function compile(args){try{logs.push(execFileSync(compiler,args,{cwd:out,encoding:'utf8',maxBuffer:8e6}));}catch(e){logs.push(String(e.stdout)+String(e.stderr));throw e;}finally{writeFileSync(out+'/compiler.log',logs.join('\n'));}}
const names=['reset','write','sweep','flush','restore'].map(n=>'-Dff3_backend_'+n+'=reference_'+n);
compile(['-msm83:gb','-DFF3_SINGLE_ENGINE',...names,'-Dff3_pop_seen=reference_pop_seen','-I'+ROOT+'/src','-c','-o',out+'/reference.o',ROOT+'/src/audio-output.c']);
compile(['-msm83:gb','-DFF3_SINGLE_ENGINE','-I'+ROOT+'/src','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo16','-Wl-m','-Wl-j','-o',rom,ROOT+'/src/audio-output-probe.c',object,out+'/reference.o',base+'/generated/audio-bank6.c']);
const bytes=await fs.readFile(rom),table=await fs.readFile(base+'/conversion.bin');check(bytes.subarray(6*16384,6*16384+table.length).equals(table),'Actual conversion table');
const symbols={};for(const m of(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const config={dll:local.mesenCore,home:await fs.mkdtemp(ROOT+'/.local/mesen-output-probe-'),rom,romSha256:hash(bytes),coreSha256:hash(await fs.readFile(local.mesenCore)),symbols,resume:false,commands:[],output:out+'/result.json'};check(config.coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned core');await fs.writeFile(out+'/config.json',JSON.stringify(config));
const dotnet=local.dotnet||'dotnet',env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
await fs.writeFile(out+'/verifier-build.log',execFileSync(dotnet,['build',ROOT+'/tools/VerifyState/VerifyState.csproj','-c','Release','--configfile',ROOT+'/tools/Capture/NuGet.Config'],{env,encoding:'utf8',maxBuffer:8e6}));
await fs.writeFile(out+'/runtime.log',execFileSync(dotnet,[ROOT+'/tools/VerifyState/bin/Release/net8.0/VerifyState.dll',out+'/config.json'],{env,encoding:'utf8',maxBuffer:8e6,timeout:600000}));
const r=JSON.parse(await fs.readFile(out+'/result.json'));check(r.status===1&&!r.failure&&r.testCase===8192,'Ordered output equivalence');await fs.writeFile(out+'/object-identity.json',JSON.stringify({path:'11.o',sha256:identity}));console.log(JSON.stringify({cases:r.testCase,romSha256:r.romSha256,objectSha256:identity}));
