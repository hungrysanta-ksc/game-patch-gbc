import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';
import {screen} from './battle-screen.mjs';
import {screenshotRgb} from './map-pixels.mjs';
import {freezeResult} from './battle-freeze-audit.mjs';
import {freezeReuseResult} from './battle-freeze-reuse-audit.mjs';
// Explicit RAM intervention tests, separate from normal pixel/audio evidence.
// Compare a cached attempt with a forced cold rebuild under identical changes.
const {local}=await input(),run=promisify(execFile),kind=process.argv[2];
check(['same','oam','palette','map','glyph','inactive','inactive-ui','active-ui'].includes(kind),'Probe kind');
const base=JSON.parse(await fs.readFile(ROOT+'/evidence/battle-magic/load-repeat-config.json'));
check(hash(await fs.readFile(base.rom))===base.romSha256,'Current repeated-cast fixture');
const earlyReady=process.argv.includes('--early-ready');
const s=base.symbols,dir=ROOT+'/evidence/battle-magic/reuse-'+kind+(earlyReady?'-boot':'');
await fs.mkdir(dir,{recursive:true});
const reuseRun=process.argv.includes('--reuse');
const cfg=reuseRun?JSON.parse(await fs.readFile(dir+'/config.json')):{...base,home:await fs.mkdtemp(ROOT+'/.local/reuse-probe-'),output:dir+'/actual.json',actionOnly:true,probeEarlyReady:earlyReady};
if(!reuseRun){
cfg.cases=[...base.cases.map(c=>({...c})),...base.cases.map(c=>({...c,tag:c.tag+'-cold'}))];
cfg.audit=`do
 local mem=emu.memType.gameboyDebug;local count=0
 local function flip(at,mask,kind)emu.write(at,emu.read(at,kind)~mask,kind)end
 emu.addMemoryCallback(function(_,v)
  if v~=1 then return end;count=count+1
  if count==4 then emu.write(${s.effect_freeze_cache_valid},0,mem)end
  if count~=2 and count~=4 then return end
  local p=${s.animation_base}+${kind==='glyph'?14:8}*4
  local x=emu.read(p+1,mem)-8;local y=emu.read(p,mem)-16
  local page=emu.read(${s.resident_page},mem);local cell=(y//8)*32+x//8
  ${kind==='oam'?`flip(p+3,32,mem)`:kind==='palette'?`flip(2,1,46)`:kind==='map'?`flip(8192+6144+page*1024+cell,32,43)`:kind==='glyph'?`local key=((emu.read(p+3,mem)>>3)&1)*8192+emu.read(p+2,mem)*16;flip(key,128,43)`:kind==='inactive'?`flip(6144+(page~1)*1024+1023,1,43)`:kind==='inactive-ui'?`flip(6144+(page~1)*1024+522,1,43)`:kind==='active-ui'?`flip(6144+page*1024+522,1,43)`:''}
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
end\n`+base.audit;
await fs.writeFile(dir+'/config.json',JSON.stringify(cfg));
const r=await run(local.dotnet,[ROOT+'/tools/VerifyStrike/bin/Release/net8.0/VerifyStrike.dll',dir+'/config.json'],{cwd:ROOT,env:{...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet'},maxBuffer:8e6,timeout:1200000});
await fs.writeFile(dir+'/run.log',r.stdout+r.stderr);
}
const actual=JSON.parse(await fs.readFile(cfg.output)),audit=await fs.readFile(cfg.output+'.audit.log','utf8');
if(earlyReady)check(actual.earlyReadyProbe&&actual.bootFrames>0,'Injected early marker must wait for initialized guard');
const reuse=freezeReuseResult(audit,4,['same','inactive','inactive-ui','active-ui'].includes(kind)?1:0),maps=freezeResult(audit,4);
const shots=(await fs.readdir(cfg.home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
check(shots.length===140&&actual.pictures.length===140&&actual.runs.length===4,'Complete paired casts');
for(let i=0;i<140;i++)check(screenshotRgb(await fs.readFile(cfg.home+'/Screenshots/'+shots[i])).equals(screen(actual.pictures[i])),'Actual hardware screenshot '+i);
for(let i=0;i<70;i++){
 const a=actual.pictures[i],b=actual.pictures[i+70];
 check(a.frame===b.frame&&a.source===b.source&&screen(a).equals(screen(b)),'Forced rebuild frame '+i);
}
for(let i=0;i<2;i++){const a=actual.runs[i].final,b=actual.runs[i+2].final;check(a.oam===b.oam&&a.bgPalette===b.bgPalette&&a.objPalette===b.objPalette&&screen(a).equals(screen(b)),'Paired final display '+i);}
// Entry can leave different inactive map bytes. freezeResult checks each full
// map against that cast's own entry snapshot, rather than another scene load.
const safety=[...audit.matchAll(/effects-safety:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);
check(safety&&safety.slice(0,3).every(v=>!v),'Bus safety');
for(const f of actual.audio)check(!f.error&&!f.videoError&&!f.memoryFault&&!f.platformError&&!f.transferFault&&!f.late&&!f.underruns&&f.guard==='a7'.repeat(16),'Runtime safety');
const result={romSha256:base.romSha256,kind,earlyReadyProbe:!!actual.earlyReadyProbe,bootFrames:actual.bootFrames,screens:140,comparedFrames:70,reuse,maps,safety,scope:'Injected state, paired with forced cold rebuild; partial audio schedule, not normal-play evidence.'};
await fs.writeFile(dir+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
