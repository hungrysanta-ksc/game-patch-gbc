import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {ROOT,input,hash,check} from './source.mjs';
// Deliberate invalid map attributes at each bounded-slice edge. These runs
// establish explicit rejection, not normal play or a complete audio schedule.
const {local}=await input(),base=JSON.parse(await fs.readFile(ROOT+'/evidence/battle-magic/load-repeat-config.json')),s=base.symbols;
check(hash(await fs.readFile(base.rom))===base.romSha256,'Current map fixture');
const dir=await fs.mkdtemp(ROOT+'/evidence/battle-magic/map-limit-'),results=[];
for(const [palette,cell]of [[4,0],[5,255],[6,256],[7,575]]){
 const cfg={...base,cases:base.cases.slice(0,1),actionOnly:true,home:await fs.mkdtemp(ROOT+'/.local/map-limit-'),output:dir+'/case-'+palette+'.json'};
 cfg.audit=`do
 local mem=emu.memType.gameboyDebug;local armed,fault=0,0
 emu.addMemoryCallback(function(_,v)if v~=3 or armed~=0 then return end;local at=8192+6144+emu.read(${s.resident_page},mem)*1024+${cell};emu.write(at,(emu.read(at,43)&248)|${palette},43);armed=1 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)if armed~=0 then fault=v end end,emu.callbackType.write,${s.effect_freeze_error},${s.effect_freeze_error},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log('freeze-map-limit:'..armed..','..fault)end,emu.eventType.codeBreak)
end\n`+base.audit;
 await fs.writeFile(dir+'/case-'+palette+'-config.json',JSON.stringify(cfg));let rejected=false;
 try{const r=await promisify(execFile)(local.dotnet,[ROOT+'/tools/VerifyStrike/bin/Release/net8.0/VerifyStrike.dll',dir+'/case-'+palette+'-config.json'],{cwd:ROOT,env:{...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet'},timeout:1200000,maxBuffer:8e6});await fs.writeFile(dir+'/case-'+palette+'.log',r.stdout+r.stderr);}catch(e){rejected=true;await fs.writeFile(dir+'/case-'+palette+'.log',(e.stdout??'')+(e.stderr??''));}
 check(rejected,'Invalid map must fail');const a=JSON.parse(await fs.readFile(cfg.output+'.failure.json')),log=await fs.readFile(cfg.output+'.failure.audit.log','utf8'),m=[...log.matchAll(/freeze-map-limit:(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);
 check(m&&m[0]===1&&m[1]===8&&a.runs.length===0,'Native map palette rejection');
 for(const f of a.audio)check(!f.late&&!f.underruns&&!f.memoryFault&&!f.transferFault&&f.guard==='a7'.repeat(16),'Rejection retains guards');results.push({palette,cell,error:8});
}
const result={romSha256:base.romSha256,results,scope:'Four injected invalid attributes; partial audio only.'};await fs.writeFile(ROOT+'/evidence/battle-magic/map-limit-summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
