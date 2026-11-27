import {freezeReuseAudit,freezeReuseResult} from './battle-freeze-reuse-audit.mjs';
import {magicGridAudit,magicGridResult} from './battle-magic-grid-audit.mjs';
import {freezeAudit,freezeResult} from './battle-freeze-audit.mjs';
import {magicAheadAudit,magicAheadResult} from './battle-magic-ahead-audit.mjs';
import {magicBoundaryAudit,magicBoundaryResult} from './battle-magic-boundary-audit.mjs';
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {animationSeed} from './battle-animation-source.mjs';import {scriptSeed} from './battle-script-source.mjs';
import {motionRngTable} from './battle-motion-sprites.mjs';import {magicSource,magicSourcePixels} from './battle-magic-source.mjs';import {screen} from './battle-screen.mjs';
import {nativeReference} from './native-reference.mjs';import {sourceAction} from './engine-fixtures.mjs';import {screenshotRgb} from './map-pixels.mjs';
import {publicationAudit} from './battle-publication-profile.mjs';
const {data,local}=await input(),dir=ROOT+'/build/battle-effects',out=ROOT+'/evidence/battle-magic';await fs.mkdir(out,{recursive:true});
const report=JSON.parse(await fs.readFile(dir+'/report.json')),rom=dir+'/ff3-battle-effects-video.gbc',romSha256=hash(await fs.readFile(rom));check(romSha256===report.videoRomSha256,'Current ROM');
const symbols={};for(const m of(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const back=process.argv.includes('--back'),status=process.argv.includes('--status'),smoke=process.argv.includes('--smoke'),reuse=process.argv.includes('--reuse'),automatic=process.argv.includes('--auto'),flips=process.argv.includes('--flips'),cases=[];
for(const [spell,mask]of flips?[[50,64]]:smoke?[[29,128]]:[[29,128],[36,16],[0,240],[1,0]]){const profile=(back?2:0)+(status?1:0);cases.push({profile,spell,mask,tag:'magic-'+profile+'-'+spell+'-'+mask,weapons:'0000',rngVariant:0,rng:Buffer.concat([motionRngTable(data,0),Buffer.from([13,23,197])]).toString('hex'),animation:animationSeed(19,{flags:128,spell,magic:0,attacker:128,targets:mask,hit:mask,types:Array(8).fill(0)}).toString('hex'),script:scriptSeed(0,{speed:8,effect:19,result:2,messages:[]}).toString('hex')});}
const repeat=process.argv.includes('--repeat');
const caseIndex=process.argv.includes('--case')?Number(process.argv[process.argv.indexOf('--case')+1]):null;check(caseIndex===null||(automatic&&!smoke&&!flips&&Number.isInteger(caseIndex)&&caseIndex>=0&&caseIndex<cases.length),'Case selection requires automatic full fixture family');
if(automatic||repeat)cases.splice(0,cases.length,cases[caseIndex??0]);
if(repeat){check(cases[0].mask,'Repeat requires a real effect');cases.push({...cases[0],tag:cases[0].tag+'-repeat',reuseScene:true});}
const output=out+'/'+(flips?'flips':smoke?'smoke':status?'status':'load')+(back?'-back':'')+(automatic?'-auto':'')+(caseIndex===null?'':'-'+caseIndex)+(repeat?'-repeat':'')+'.json',home=reuse?JSON.parse(await fs.readFile(output)).home:await fs.mkdtemp(ROOT+'/.local/mesen-magic-'),env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'},run=promisify(execFile);
if(!reuse){const config=output.replace('.json','-config.json');
 const timing=automatic?await publicationAudit(dir,symbols,await fs.readFile(rom),local)+'actionCostBuffered=true\nactionCostFrames='+symbols.animation_video_frames+'\nactionCostAddresses={active='+symbols.action_enabled+',audio='+symbols.native_busy+',irq='+symbols.native_irq_busy+',transfer='+symbols.text_transfer_busy+',publish='+symbols.party_pending+'}\n'+await fs.readFile(ROOT+'/tools/battle-action-cost-audit.lua','utf8')+'\n'+magicBoundaryAudit(symbols):'';
 const residency=`\nlocal poolWrites,poolChecks,poolBad=0,0,0
emu.addMemoryCallback(function()if (emu.read(0xff4f,emu.memType.gameboyDebug)&1)~=0 then poolWrites=poolWrites+1 end end,emu.callbackType.write,0x8000,0x83ff,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 if v>9 and emu.read(${symbols.animation_video_owner},emu.memType.gameboyDebug)==29 then poolChecks=poolChecks+1;if poolWrites~=0 then poolBad=poolBad+1 end end;poolWrites=0
end,emu.callbackType.write,${symbols.animation_video_frames},${symbols.animation_video_frames},emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('magic-residency:%d,%d',poolChecks,poolBad))end,emu.eventType.codeBreak)
`;
 await fs.writeFile(config,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,output,symbols,cases,automatic,actionOnly:false,longAction:false,auditPath:ROOT+'/tools/battle-effects-audit.lua',audit:timing+'effectsPendingAddress='+symbols.party_pending+'\neffectsFrameAddress='+symbols.animation_video_frames+'\n'+await fs.readFile(ROOT+'/tools/battle-effects-audit.lua','utf8')+residency+await freezeAudit(symbols,dir)+magicAheadAudit(symbols)+magicGridAudit(symbols)+freezeReuseAudit(symbols)}));
 if(!process.argv.includes('--skip-build')){const b=await run(local.dotnet,['build',ROOT+'/tools/VerifyStrike/VerifyStrike.csproj','-c','Release','--nologo','--configfile',ROOT+'/tools/Capture/NuGet.Config'],{cwd:ROOT,env,maxBuffer:4e6});await fs.writeFile(output+'-compiler.log',b.stdout+b.stderr);}
 try{const r=await run(local.dotnet,[ROOT+'/tools/VerifyStrike/bin/Release/net8.0/VerifyStrike.dll',config],{cwd:ROOT,env,maxBuffer:8e6,timeout:1200000});await fs.writeFile(output+'-run.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'-run.log',(e.stdout||'')+(e.stderr||''));throw e;}}
const actual=JSON.parse(await fs.readFile(output));check(actual.romSha256===romSha256,'Captured artifact');
const shots=automatic?[]:(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));check(shots.length===actual.pictures.length,'All captured screens');
let shot=0,frames=0,peak=0,maxObjects=0,expectedAhead=0;const sounds=[];
for(const test of cases){const original=magicSource(data,test),base=await fs.readFile(dir+'/effect-base'+test.profile+'.rgb'),pics=actual.pictures.filter(p=>p.tag===test.tag),body=pics.filter(p=>p.owner===29);if(!automatic)check(body.length===original.frames.length,'All original ordinary-magic waits '+test.tag);sounds.push(...original.sounds);expectedAhead+=original.frames.filter(f=>f.pc===0xb7ad).length/4;let index=0;
 for(const p of pics){const observed=screen(p),screenshot=screenshotRgb(await fs.readFile(home+'/Screenshots/'+shots[shot++]));check(screenshot.equals(observed),'Captured hardware pixels '+test.tag+'/'+p.frame);
  if(p.owner===29){const expected=original.frames[index++];check(Buffer.from(p.source,'hex').equals(expected.raw),'Original frame OAM '+test.tag+'/'+p.frame);check(observed.equals(magicSourcePixels(expected,base,back)),'Original dots and complete background/UI '+test.tag+'/'+p.frame);frames++;}
  else check(p.owner===31,'Only original preflash/magic owners');
  const o=Buffer.from(p.oam,'hex'),height=p.lcdc&4?16:8;maxObjects=Math.max(maxObjects,Array.from({length:40},(_,i)=>o[i*4]).filter(y=>y>0&&y<160).length);
  for(let y=0;y<144;y++){const n=Array.from({length:40},(_,i)=>o[i*4]).filter(v=>y>=v-16&&y<v-16+height).length;peak=Math.max(peak,n);check(n<=10,'Real 8x16 scanline capacity');}
 }
 const result=actual.runs.find(r=>r.tag===test.tag);check(result&&result.frames===original.frames.length+8,'Whole owner plus source preflash');check(!(result.final.lcdc&4)&&(result.final.lcdc&16),'Restored 8x8 and unsigned BG');check(screen(result.final).equals(base),'Full final screen restore');
 if(!automatic){const before=Buffer.from(pics[0].vram,'hex'),after=Buffer.from(result.final.vram,'hex');for(const [at,n]of [[8192,1152],[0x4a0,256]])check(before.subarray(at,at+n).equals(after.subarray(at,at+n)),'Borrowed resource restored');}
 check(Buffer.from(result.common,'hex')[103]===1&&Buffer.from(result.script,'hex')[25]===1,'Original callers finished');
}
check(Buffer.from(actual.requests.map(r=>r.op===8?255:r.arg|128)).equals(Buffer.from(sounds)),'Every original sound request');
const ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{ticks:report.audio.ticks,plan:report.audio.plan,beforeTick(c,t){for(const r of actual.requests)if(r.tick===t)sourceAction(c,r.op,r.arg);}});let end;
for(const f of actual.audio){check(!f.error&&!f.videoError&&!f.memoryFault&&!f.platformError&&!f.transferFault&&!f.late&&!f.underruns&&f.guard==='a7'.repeat(16),'Runtime/audio safety');const b=Buffer.from(f.consumed,'hex'),events=b.readUInt32LE(4);if(events){end=ref.advanceToEvent(events);check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Original dynamic audio');}}
check(end?.ticks===report.audio.ticks,'Complete audio schedule');const audit=await fs.readFile(output+'.audit.log','utf8'),safety=[...audit.matchAll(/effects-safety:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(safety&&safety.slice(0,3).every(v=>!v),'VRAM/OAM bus safety');
const residency=[...audit.matchAll(/magic-residency:(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(residency&&residency[1]===0&&residency[0]===cases.reduce((n,c)=>n+magicSource(data,c).frames.length-1,0),'Resident pool has no per-frame or per-target writes');
const mapPreservation=freezeResult(audit,cases.filter(c=>c.mask).length);
const ahead=magicAheadResult(audit,expectedAhead);
const grid=magicGridResult(audit,expectedAhead+cases.reduce((n,c)=>n+(c.mask?1+[0,1,2,3].filter(i=>c.mask&(128>>i)).length:0),0));
const compositionReuse=freezeReuseResult(audit,cases.filter(c=>c.mask).length,repeat?1:0);
let cadence;
if(automatic){
 const timingAudit=(actual.actionLogs??[audit]).map((l,i)=>{const start=[...l.matchAll(/action-frame-cost:1,/g)].at(-1)?.index;check(start!==undefined,'Saved automatic action audit');return l.slice(start);}).join('\n');
 const rows=[...timingAudit.matchAll(/action-frame-cost:(\d+),(\d+),([^|]+)\|display:(\d+),(\d+),(\d+),(\d+),(\d+)\|attempts:([^|]*)\|lines:(\d+),(\d+)/g)].map(m=>({frame:+m[1],rate:+m[2],ready:+m[4],dma:+m[5],ack:+m[6],done:+m[7],page:+m[8],dmaLy:+m[10],ackLy:+m[11]}));
 const groups=[];for(const r of rows){if(r.frame===1)groups.push([]);check(groups.length>0,'Publication start');groups.at(-1).push(r);}
 check(groups.length===actual.runs.length&&groups.every((g,i)=>g.length===actual.runs[i].frames&&g.every((r,j)=>r.frame===j+1))&&rows.every((r,i)=>r.frame>=1&&r.ready<=r.dma&&r.dma<r.ack&&r.ack<=r.done&&r.dmaLy>=144&&r.dmaLy<=150&&r.ackLy>=r.dmaLy&&r.ackLy<=153),'Every automatic publication');
 const costs={};for(const m of timingAudit.matchAll(/action-cost:(\w+),(\d+),(\d+),(\d+)/g)){const c=costs[m[1]]??={ms:0,calls:0};c.ms+=+m[2]*1000/+m[3];c.calls+=+m[4];}
 const elapsed=actual.runs.reduce((n,r)=>n+r.elapsedMs,0),total=[...timingAudit.matchAll(/action-cost:(\w+),(\d+),(\d+),(\d+)/g)].reduce((n,m)=>n+(+m[2])*1000/(+m[3]),0);check(total>elapsed*.98&&total<=elapsed+1,'Complete exclusive action costs');
 const actions=groups.map((g,i)=>({frames:g.length,elapsedMs:actual.runs[i].elapsedMs,maxIntervalMs:Math.max(...g.slice(1).map((r,j)=>(r.dma-g[j].dma)*1000/r.rate))}));
 const boundaryLog=actual.actionLogs?.at(-1)??audit,boundaryStart=[...boundaryLog.matchAll(/magic-boundary:active,1,/g)].at(-1)?.index;check(boundaryStart!==undefined,'Final action boundary log');
 cadence={boundariesAction:actual.runs.at(-1).tag,actions,frames:rows.length,elapsedMs:elapsed,firstToLastMs:groups.reduce((n,g)=>n+(g.at(-1).dma-g[0].dma)*1000/g[0].rate,0),maxIntervalMs:Math.max(...actions.map(a=>a.maxIntervalMs)),maxReadyToDmaMs:Math.max(...rows.map(r=>(r.dma-r.ready)*1000/r.rate)),costs,boundaries:magicBoundaryResult(boundaryLog.slice(boundaryStart),rows.at(-1).done)};
}
const summary={romSha256,cases:cases.length,frames,allScreens:actual.pictures.length,maxObjects,peak,audioTicks:end.ticks,soundRequests:sounds.length,safety,residency,mapPreservation,ahead,grid,compositionReuse,cadence,scope:'Enemy ordinary magic against party, no reflection. Party precast/projectiles, enemy target projection, special bodies and summons remain separate.'};await fs.writeFile(output.replace('.json','-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
