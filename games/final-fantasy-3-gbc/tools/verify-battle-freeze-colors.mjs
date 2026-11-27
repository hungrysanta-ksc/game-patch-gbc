import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {screen} from './battle-screen.mjs';
// A separate, deliberately unrepresentable source cell. Do not count this
// intervention or its partial audio schedule as normal-play coverage.
const {local}=await input(),arg=process.argv.indexOf('--config');
const base=JSON.parse(await fs.readFile(arg<0?ROOT+'/evidence/battle-magic/load-repeat-config.json':process.argv[arg+1]));
check(hash(await fs.readFile(base.rom))===base.romSha256&&base.cases.length===2&&base.cases[0].profile===0,'Current paired fixture');
const dir=await fs.mkdtemp(ROOT+'/evidence/battle-magic/color-limit-'),s=base.symbols;
const cfg={...base,home:await fs.mkdtemp(ROOT+'/.local/color-limit-'),output:dir+'/actual.json',actionOnly:true};
cfg.audit=`do
 local mem=emu.memType.gameboyDebug;local count,armed,fault=0,0,0
 emu.addMemoryCallback(function(_,v)
  if v~=1 then return end;count=count+1;if count~=2 then return end
  local p=${s.animation_base}+32;local at=((emu.read(p+3,mem)>>3)&1)*8192+emu.read(p+2,mem)*16
  emu.write(at,emu.read(at,43)~128,43);armed=1
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)if armed==1 then fault=v end end,emu.callbackType.write,${s.effect_freeze_error},${s.effect_freeze_error},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log(string.format('freeze-color-limit:%d,%d',armed,fault))end,emu.eventType.codeBreak)
end\n`+base.audit;
await fs.writeFile(dir+'/config.json',JSON.stringify(cfg));let rejected=false;
try{const r=await promisify(execFile)(local.dotnet,[ROOT+'/tools/VerifyStrike/bin/Release/net8.0/VerifyStrike.dll',dir+'/config.json'],{cwd:ROOT,env:{...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet'},timeout:1200000,maxBuffer:8e6});await fs.writeFile(dir+'/run.log',r.stdout+r.stderr);}
catch(e){rejected=true;await fs.writeFile(dir+'/run.log',(e.stdout??'')+(e.stderr??''));}
check(rejected,'More than four colors must not be approximated');
const a=JSON.parse(await fs.readFile(cfg.output+'.failure.json')),log=await fs.readFile(cfg.output+'.failure.audit.log','utf8');
const limit=[...log.matchAll(/freeze-color-limit:(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);
check(limit&&limit[0]===1&&limit[1]===4&&a.runs.length===1&&a.runs[0].frames===35,'Explicit native color-capacity rejection');
// Independently render the same glyph change in the original, unfrozen final
// display. Count actual RGB values at intersecting BG cells, not the runtime
// converter's compact indices or its chosen palette.
const f={...a.runs[0].final},o=Buffer.from(f.oam,'hex'),v=Buffer.from(f.vram,'hex'),p=32;
v[((o[p+3]>>3)&1)*8192+o[p+2]*16]^=128;f.vram=v.toString('hex');const rgb=screen(f);
const x=o[p+1]-8,y=o[p]-16;let maximum=0;
for(let yy=y>>3;yy<=(y+7)>>3;yy++)for(let xx=x>>3;xx<=(x+7)>>3;xx++){
 const colors=new Set();for(let dy=0;dy<8;dy++)for(let dx=0;dx<8;dx++){const at=((yy*8+dy)*160+xx*8+dx)*3;colors.add(rgb.subarray(at,at+3).toString('hex'));}maximum=Math.max(maximum,colors.size);
}
check(maximum>4,'Independent displayed cell exceeds the four-color budget');
for(const f of a.audio)check(!f.late&&!f.underruns&&!f.memoryFault&&!f.transferFault&&f.guard==='a7'.repeat(16),'Rejection retains audio/bus guards');
const result={romSha256:base.romSha256,maximumCellColors:maximum,error:4,rejected:true,directory:dir,scope:'Injected invalid cell, independent RGB count, partial audio; no color approximation.'};
await fs.writeFile(dir+'/summary.json',JSON.stringify(result,null,2));
await fs.writeFile(ROOT+'/evidence/battle-magic/color-limit'+(arg<0?'':'-baseline')+'-summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
