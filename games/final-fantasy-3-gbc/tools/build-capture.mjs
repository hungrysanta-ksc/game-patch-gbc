import fs from 'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';import{ROOT}from'./source.mjs';
const local=JSON.parse(await fs.readFile(ROOT+'/local.json')),run=promisify(execFile);
for(const dir of ['config','dotnet'])await fs.mkdir(ROOT+'/.local/'+dir,{recursive:true});
const env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
try{const r=await run(local.dotnet||'dotnet',['build','tools/Capture/Capture.csproj','-c','Release','--nologo','--configfile','tools/Capture/NuGet.Config'],{cwd:ROOT,env,maxBuffer:8e6});await fs.writeFile(ROOT+'/.local/capture-build.log',r.stdout+r.stderr);console.log(r.stdout);}catch(e){await fs.writeFile(ROOT+'/.local/capture-build.log',(e.stdout||'')+(e.stderr||''));throw e;}
