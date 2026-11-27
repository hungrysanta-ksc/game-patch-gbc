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
check(['same','oam','palette','map','glyph','glyph-fourth','glyph-fifth','glyph-tail','inactive','inactive-ui','active-ui','map-span','offset-left','offset-right','overlap','directory-tail'].includes(kind),'Probe kind');
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
 local mem=emu.memType.gameboyDebug;local count=0;local glyphProbes={}
 local function flip(at,mask,kind)emu.write(at,emu.read(at,kind)~mask,kind)end
 emu.addMemoryCallback(function(_,v)
  if v~=1 then return end;count=count+1
  if count==4 then emu.write(${s.effect_freeze_cache_valid},0,mem)end
  if count~=2 and count~=4 then return end
  local p=${s.animation_base}+${kind==='glyph'?14:8}*4
  local x=emu.read(p+1,mem)-8;local y=emu.read(p,mem)-16
  local page=emu.read(${s.resident_page},mem);local cell=(y//8)*32+x//8
  ${kind.startsWith('glyph-')?`local have={};local cells={};local n=0
  for i=8,31 do local q=${s.animation_base}+i*4;local oy=emu.read(q,mem);local tile=emu.read(q+2,mem)
   if oy>=16 and oy<112 and tile~=0 then local ox=emu.read(q+1,mem)-8;oy=oy-16;have[((emu.read(q+3,mem)>>3)&1)*256+tile]=true
    for yy=oy//8,(oy+7)//8 do for xx=ox//8,(ox+7)//8 do cells[yy*32+xx]=true end end
   end
  end
  for k in pairs(cells)do local at=6144+page*1024+k;have[((emu.read(8192+at,43)>>3)&1)*256+emu.read(at,43)]=true end
  for _ in pairs(have)do n=n+1 end
  if n<5 or n%4==0 then error('Missing partial glyph group')end
  local index=${kind==='glyph-fourth'?'3':kind==='glyph-fifth'?'4':'n-1'};local at=4*4096+1408+index*18;local key=emu.read(at,39)+emu.read(at+1,39)*256
  if not have[key]then error('Injected glyph is not a live dependency')end
  flip((key>>8)*8192+(key&255)*16+15,128,43);glyphProbes[#glyphProbes+1]='glyph-batch-probe:'..n..','..index` : ''}
  ${kind==='oam'?`flip(p+3,32,mem)`:kind==='palette'?`flip(2,1,46)`:kind==='map'?`flip(8192+6144+page*1024+cell,32,43)`:kind==='glyph'?`local key=((emu.read(p+3,mem)>>3)&1)*8192+emu.read(p+2,mem)*16;flip(key,128,43)`:kind==='inactive'?`flip(6144+(page~1)*1024+1023,1,43)`:kind==='inactive-ui'?`flip(6144+(page~1)*1024+522,1,43)`:kind==='active-ui'?`flip(6144+page*1024+522,1,43)`:kind==='map-span'?`for i=0,575 do emu.write(6144+(page~1)*1024+i,emu.read(6144+page*1024+i,43)~128,43)end`:kind==='directory-tail'?`for i=28,29 do emu.write(${s.animation_base}+i*4,105,mem)end;for i=30,31 do emu.write(${s.animation_base}+i*4,0,mem)end`:kind==='overlap'?`for i=8,13 do local q=${s.animation_base}+i*4;emu.write(q,y+32,mem);emu.write(q+1,x+8,mem)end`:kind.startsWith('offset-')?`for i=${kind==='offset-left'?'20,25':'26,28,2'} do local p=${s.animation_base}+i*4+1;emu.write(p,emu.read(p,mem)+${kind==='offset-left'?-1:1},mem);${kind==='offset-right'?'flip(p+2,96,mem)':''}end`:''}
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 -- Retain the boundary records across the emulator's bounded log window.
 emu.addEventCallback(function()if #glyphProbes>0 then emu.log(table.concat(glyphProbes,'|'))end end,emu.eventType.codeBreak)
end\n`+base.audit;
if(kind.startsWith('offset-')||kind==='overlap'||kind==='directory-tail')cfg.audit+=`\ndo
 local mem=emu.memType.gameboyDebug;local records={};local printed=false
 local function hex(at,n,kind)local t={};for i=0,n-1 do t[#t+1]=string.format('%02x',emu.read(at+i,kind))end;return table.concat(t)end
 emu.addMemoryCallback(function(_,v)
  if v~=1 and v~=8 then return end
  local lcdc=(emu.read(0xff40,mem)&~28)|(emu.read(${s.resident_page},mem)*8)|(v==1 and 16 or 0)
  records[#records+1]=string.format('%d;%d;%s;%s;%s;%s',v,lcdc,hex(${s.animation_base},160,mem),hex(0,16384,43),hex(0,64,45),hex(0,64,46))
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 emu.addEventCallback(function()if #records==8 and not printed and emu.read(${s.action_enabled},mem)==0 then emu.log('freeze-offset-pixels:'..table.concat(records,'|'));printed=true end end,emu.eventType.codeBreak)
end\n`;
await fs.writeFile(dir+'/config.json',JSON.stringify(cfg));
const r=await run(local.dotnet,[ROOT+'/tools/VerifyStrike/bin/Release/net8.0/VerifyStrike.dll',dir+'/config.json'],{cwd:ROOT,env:{...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet'},maxBuffer:8e6,timeout:1200000});
await fs.writeFile(dir+'/run.log',r.stdout+r.stderr);
}
const actual=JSON.parse(await fs.readFile(cfg.output)),audit=await fs.readFile(cfg.output+'.audit.log','utf8');
if(earlyReady)check(actual.earlyReadyProbe&&actual.bootFrames>0,'Injected early marker must wait for initialized guard');
const reuse=freezeReuseResult(audit,4,['same','inactive','inactive-ui','active-ui','map-span'].includes(kind)?1:0),maps=freezeResult(audit,4);
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
let frozenScreens=0;if(kind.startsWith('offset-')||kind==='overlap'||kind==='directory-tail'){
 const raw=[...audit.matchAll(/freeze-offset-pixels:([^\r\n]*)/g)].at(-1)?.[1];check(raw,'Independent frozen pixel snapshots');
 const pairs=raw.split('|').map(r=>{const [stage,lcdc,oam,vram,bgPalette,objPalette]=r.split(';');return {stage:+stage,lcdc:+lcdc,oam,vram,bgPalette,objPalette}});
 check(pairs.length===8,'All four input/output snapshots');
 for(let i=0;i<8;i+=2){check(pairs[i].stage===1&&pairs[i+1].stage===8,'Whole freeze pixel pair');check(screen(pairs[i]).equals(screen(pairs[i+1])),'Independent original OBJ versus frozen BG pixels');frozenScreens++;}
 check(frozenScreens===4,'Every offset freeze checked');
}
if(kind==='overlap')check(maps.membership.fallbackCells>0,'Full overlapping OAM fallback exercised');
if(kind==='directory-tail')check(maps.membership.directoryTailCells>0,'Directory tail exercised');
let glyphBoundary=null;if(kind.startsWith('glyph-')){
 const line=audit.trim().split(/\r?\n/).filter(l=>l.includes('glyph-batch-probe:')).at(-1),records=[...(line??'').matchAll(/glyph-batch-probe:(\d+),(\d+)/g)].map(m=>m.slice(1).map(Number));
 check(records.length===2&&records.every(([n,i])=>n>4&&n%4!==0&&i===(kind==='glyph-fourth'?3:kind==='glyph-fifth'?4:n-1)),'Both partial-group dependency interventions');glyphBoundary={dependencies:records[0][0],index:records[0][1],interventions:2};
}
const result={glyphBoundary,frozenScreens,romSha256:base.romSha256,kind,earlyReadyProbe:!!actual.earlyReadyProbe,bootFrames:actual.bootFrames,screens:140,comparedFrames:70,reuse,maps,safety,scope:'Injected state, paired with forced cold rebuild; partial audio schedule, not normal-play evidence.'};
await fs.writeFile(dir+'/summary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
