import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';import {nativeReference} from './native-reference.mjs';import {screenshotRgb} from './map-pixels.mjs';import {preparationAudit,preparationCosts} from './battle-preparation-costs.mjs';
const {data,local}=await input(),arg=process.argv.indexOf('--artifact-root'),base=arg<0?ROOT:path.resolve(process.argv[arg+1]),dir=base+'/build/battle-stone-overlap',out=base+'/evidence/battle-load';await fs.mkdir(out,{recursive:true});
const report=JSON.parse(await fs.readFile(dir+'/report.json')),rom=dir+'/ff3-battle-stone-overlap-video.gbc',bytes=await fs.readFile(rom),romSha256=hash(bytes);check(romSha256===report.videoRomSha256&&hash(await fs.readFile(local.mesenCore))==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned load artifacts');
const symbols={};for(const m of(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const run=promisify(execFile),env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
async function logged(args,file){try{const r=await run(local.dotnet,args,{env,cwd:ROOT,timeout:900000,maxBuffer:8e6});await fs.writeFile(file,r.stdout+r.stderr);}catch(e){await fs.writeFile(file,(e.stdout||'')+(e.stderr||''));throw e;}}
if(!process.argv.includes('--reuse')&&!process.argv.includes('--no-build'))await logged(['build',ROOT+'/tools/VerifyBattleLoad/VerifyBattleLoad.csproj','-c','Release','--configfile',ROOT+'/tools/Capture/NuGet.Config'],out+'/build.log');
const results=[];
for(const phase of [96,224])for(let profile=0;profile<4;profile++){
 const folder=out+'/'+profile+'-'+phase;await fs.mkdir(folder,{recursive:true});const output=folder+'/load.json',config=folder+'/config.json';
 if(!process.argv.includes('--reuse')){
  const home=await fs.mkdtemp(ROOT+'/.local/mesen-load-'),addresses={consumed:symbols.native_consumed,profile:symbols.party_profile,request:symbols.party_request};for(const v of Object.values(addresses))check(Number.isInteger(v)&&v>=0xc000&&v<0xd000,'Load symbol');
  const script=await preparationAudit(symbols,bytes,1)+'\nlocal loadPhase='+phase+'\nlocal loadProfile='+profile+'\nlocal loadAddresses={'+Object.entries(addresses).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(ROOT+'/tools/battle-load-audit.lua','utf8');
  await fs.writeFile(config,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,output,symbols,phase,scriptPath:ROOT+'/tools/battle-load-audit.lua',script}));
  await logged([ROOT+'/tools/VerifyBattleLoad/bin/Release/net8.0/VerifyBattleLoad.dll',config],folder+'/runtime.log');
 }
 const r=JSON.parse(await fs.readFile(output)),log=await fs.readFile(output+'.lua.log','utf8'),p=r.picture,e=report.visuals[profile].frames[0];check(r.romSha256===romSha256&&r.phase===phase,'Load run identity');
 const triggers=[...new Set([...log.matchAll(/load-trigger:(\d+,\d+)/g)].map(x=>x[1]))];check(triggers.length===1&&triggers[0]===profile+','+phase,'Exact source-audio trigger');
 check(p.profile===profile&&!p.frame&&!p.visible&&p.source===e.original&&p.state===e.state&&(e.nativePages?e.nativePages.includes(p.oam):e.native===p.oam)&&p.guard==='a6'.repeat(16)&&p.terrainGuard==='a8'.repeat(16)&&p.stoneGuard==='a9'.repeat(16),'Loaded source state and guards');
 const asset=(name,n)=>{const a=symbols[name],offset=(a>>>16)*16384+(a&16383);check(Number.isInteger(a)&&offset+n<=bytes.length,'Palette asset symbol');return bytes.subarray(offset,offset+n);};
 check(p.bgPalette===asset('resident_palette'+profile,32).toString('hex')&&p.objPalette===Buffer.concat([asset('party_palette'+profile,32),asset('resident_palette'+profile,32)]).toString('hex'),'All loaded palette bytes, including transparent colors');
 const shots=(await fs.readdir(r.home+'/Screenshots')).filter(p=>p.endsWith('.png'));check(shots.length===1,'Load screenshot count');check(screenshotRgb(await fs.readFile(r.home+'/Screenshots/'+shots[0])).equals(await fs.readFile(dir+'/party'+profile+'-0.rgb')),'Loaded native pixels');
 const costs=preparationCosts(log);check(costs.length===1&&costs[0].profile===profile&&costs[0].request===1&&costs[0].frame===0,'Complete cold-load request');
 const audit=[...log.matchAll(/load-audit:(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1);check(audit,'Load write audit');const [paletteBytes,badPalettes,transferBytes,badTransfers,maxPaletteLy]=audit.slice(1).map(Number);check(paletteBytes===128&&!badPalettes&&!badTransfers&&transferBytes>8192,'Complete safe palette/map/pattern load');
 const ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:report.audio.plan,ticks:report.audio.ticks});let end,elapsed=0,previous,first,last;
 for(const f of r.audio){check(!f.fault,'Load runtime fault');const b=Buffer.from(f.consumed,'hex'),events=b.readUInt32LE(4);if(events){end=ref.advanceToEvent(events);check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Load original consumed audio');}if(previous!==undefined)elapsed+=(f.timer-previous+65536)&65535;previous=f.timer;first??={...f,elapsed};last={...f,elapsed};}
 check(end&&end.ticks>=phase+120,'Audio continuation');const drift=(last.elapsed-first.elapsed)/4096-(last.master-first.master)/last.rate;check(Math.abs(drift)<0.003,'Load audio timer drift');
 const row={phase,profile,...costs[0],paletteBytes,transferBytes,maxPaletteLy,audioTicks:end.ticks,timerDriftMs:drift*1000};results.push(row);console.log(JSON.stringify(row));
}
await fs.writeFile(out+'/summary.json',JSON.stringify({romSha256,rows:results,scope:'Eight fresh-boot controlled requests at original consumed ticks 96/224; first picture and 120 subsequent audio ticks. Full battle/audio completion is a separate gate.'},null,2));
