import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {ROOT,input,check,hash} from './source.mjs';
const {data,local}=await input(),base=ROOT+'/build/battle-opening-video',out=ROOT+'/build/audio-read-probe';await fs.mkdir(out,{recursive:true});
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');
const objects=[7,8,9,10].map(i=>base+'/obj/'+i+'.o'),sources=[1,2,3,4,5,8].map(i=>base+'/generated/audio-bank'+i+'.c'),rom=out+'/audio-read-probe.gbc';
// Preserve exact objects used in the full integration candidate. Probe code
// lives in bank 9, and the fixed wrapper maps bank 8 around its near call.
const identities=await Promise.all(objects.map(async p=>({path:p.split('/').pop(),sha256:hash(await fs.readFile(p))})));
try{const log=execFileSync(compiler,['-msm83:gb','-DFF3_BANKED_RUNTIME','-DFF3_SINGLE_ENGINE','-DFF3_OPENING_VIDEO','-I'+ROOT+'/src','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo16','-Wl-m','-Wl-j','-o',rom,ROOT+'/src/audio-read-probe.c',...objects,...sources],{cwd:out,encoding:'utf8',maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',log);}catch(e){await fs.writeFile(out+'/compiler.log',String(e.stdout)+String(e.stderr));throw e;}
const bytes=await fs.readFile(rom),symbols={};for(const m of(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
for(const [i,b]of [0x36,0x37,0x38,0x39,9].entries())check(bytes.subarray((i+1)*16384,(i+1)*16384+8192).equals(data.subarray(16+b*8192,16+(b+1)*8192)),'Independent source bank');
const replica=8*16384+(symbols.ff3_audio_bank36&16383);check(bytes.subarray(replica,replica+8192).equals(data.subarray(16+0x36*8192,16+0x37*8192)),'Optimized consumer source copy');
const config={dll:local.mesenCore,home:await fs.mkdtemp(ROOT+'/.local/mesen-audio-reads-'),rom,romSha256:hash(bytes),coreSha256:hash(await fs.readFile(local.mesenCore)),symbols,resume:false,commands:[],output:out+'/result.json'};check(config.coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned core');await fs.writeFile(out+'/config.json',JSON.stringify(config));
const dotnet=local.dotnet||'dotnet',env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
await fs.writeFile(out+'/verifier-build.log',execFileSync(dotnet,['build',ROOT+'/tools/VerifyState/VerifyState.csproj','-c','Release','--configfile',ROOT+'/tools/Capture/NuGet.Config'],{env,encoding:'utf8',maxBuffer:8e6}));
await fs.writeFile(out+'/runtime.log',execFileSync(dotnet,[ROOT+'/tools/VerifyState/bin/Release/net8.0/VerifyState.dll',out+'/config.json'],{env,encoding:'utf8',maxBuffer:8e6,timeout:600000}));
const r=JSON.parse(await fs.readFile(out+'/result.json'));check(r.status===1&&!r.failure&&r.testCase===5*65536,'Exhaustive word values/errors/preserved state');
await fs.writeFile(out+'/object-identities.json',JSON.stringify(identities,null,2));console.log(JSON.stringify({cases:r.testCase,probeRomSha256:r.romSha256,coreSha256:r.coreSha256,objects:identities}));
