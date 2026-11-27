import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';
// Deliberate diagnostic RAM intervention, not evidence of normal gameplay.
// The complete screen/audio suites run separately with unmodified state.
const {local}=await input(),base=JSON.parse(await fs.readFile(ROOT+'/evidence/battle-magic/load-auto-config.json'));
check(base.romSha256===hash(await fs.readFile(base.rom))&&base.automatic&&base.cases.length===1,'Run current automatic magic verification first');
const s=base.symbols,run=promisify(execFile),results=[],dir=await fs.mkdtemp(ROOT+'/evidence/battle-magic/grid-limit-');
for(const limit of [10,11]){
 const output=dir+'/limit-'+limit+'.json',cfg={...base,output,actionOnly:true,home:await fs.mkdtemp(ROOT+'/.local/mesen-grid-limit-')};
 cfg.audit=`
local mem=emu.memType.gameboyDebug;local armed,accepted,fault=0,0,0;local at,old=nil,nil
emu.addMemoryCallback(function(_,v)
 if v==3 and armed==0 then
  local empty=true;for i=0,159 do if emu.read(${s.battle_workspace}+144+i,mem)~=240 then empty=false;break end end
  if empty then return end
  local y=emu.read(${s.battle_workspace}+304,mem);local n=emu.read(${s.battle_workspace}+305,mem)
  if y>128 or n>6 then error('Invalid test row') end
  at=${s.battle_workspace}+y;old=emu.read(at,mem);emu.write(at,${limit}-n,mem);armed=1
 elseif v==4 and armed==1 and accepted==0 then
  accepted=1;emu.write(at,old,mem)
 end
end,emu.callbackType.write,${s.magic_prepare_stage},${s.magic_prepare_stage},emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)if armed==1 then fault=v end end,emu.callbackType.write,${s.magic_error},${s.magic_error},emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('magic-grid-limit:${limit},%d,%d,%d',armed,accepted,fault))end,emu.eventType.codeBreak)
`;
 const config=output.replace('.json','-config.json');await fs.writeFile(config,JSON.stringify(cfg));let failed=false;
 try{const r=await run(local.dotnet,[ROOT+'/tools/VerifyStrike/bin/Release/net8.0/VerifyStrike.dll',config],{cwd:ROOT,env:{...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet'},timeout:1200000,maxBuffer:8e6});await fs.writeFile(output+'-run.log',r.stdout+r.stderr);}
 catch(e){failed=true;await fs.writeFile(output+'-run.log',(e.stdout||'')+(e.stderr||''));}
 const audit=await fs.readFile(output+(failed?'.failure.audit.log':'.audit.log'),'utf8');
 const state=[...audit.matchAll(/magic-grid-limit:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);
 check(state&&state[0]===limit&&state[1]===1&&state[2]===(limit===10?1:0)&&state[3]===(limit===10?0:7)&&failed===(limit===11),'Native capacity threshold '+limit);
 if(!failed){const a=JSON.parse(await fs.readFile(output));check(a.romSha256===base.romSha256&&a.runs.length===1&&a.runs[0].frames===35,'Accepted boundary completes every original wait');}
 results.push({limit,armed:true,accepted:!failed,error:state[3]});
}
const result={romSha256:base.romSha256,results,scope:'Injected cached census at one first-picture line: native acceptance at 10 and rejection at 11. Not normal-play/audio-completion evidence.'};
await fs.writeFile(ROOT+'/evidence/battle-magic/grid-limit-summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
