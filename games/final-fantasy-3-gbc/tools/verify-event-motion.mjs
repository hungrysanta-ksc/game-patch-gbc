import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';import {eventFixtures,eventOriginal} from './event-motion-source.mjs';
import {npcOriginal as pixelsOriginal} from './npc-motion-source.mjs';import {npcRecord} from './dialogue-source.mjs';
import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';import {addTextAssets} from './korean-text.mjs';import {prepareDialogue} from './dialogue-build.mjs';
import {nativeReference} from './native-reference.mjs';import {fieldPixels} from './exploration-pixels.mjs';import {screenshotRgb} from './map-pixels.mjs';import {textPage,windowRgb} from './text-reference.mjs';import {expandDialogue} from './dialogue-reference.mjs';
const {data,local}=await input(),units=process.argv.includes('--units'),dir=ROOT+'/build/'+(units?'exploration':'exploration-event'),rom=dir+'/ff3-exploration.gbc',report=JSON.parse(await fs.readFile(dir+'/report.json'));
const romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));check(romSha256===report.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned artifacts');
const symbols={};for(const m of(await fs.readFile(dir+'/ff3-exploration.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const out=ROOT+'/evidence/event-motion';await fs.mkdir(out,{recursive:true});const output=out+(units?'/units.json':'/play.json'),configPath=output+'.config.json';let home;
if(process.argv.includes('--reuse')){const config=JSON.parse(await fs.readFile(configPath));check(config.romSha256===romSha256,'Stale artifact');home=config.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-event-');const auditPath=ROOT+'/tools/text-audio-audit.lua';
 let audit=((await fs.readFile(auditPath,'utf8'))+await memoryAudit())+'\n'+await fs.readFile(ROOT+'/tools/exploration-audit.lua','utf8')+'\n'+await fs.readFile(ROOT+'/tools/event-motion-audit.lua','utf8');
 const names={IRQ_BUSY:symbols.native_irq_busy,NATIVE_CLOCK:symbols.native_clock,NATIVE_REQUEST:symbols.native_request,FIELD_RENDER_BUSY:symbols.field+64,NATIVE_BUSY:symbols.native_busy,NATIVE_TICKS:symbols.native_ticks,FIELD:symbols.field,PART1:symbols.object_part1,PART2:symbols.object_part2,EXECUTION:symbols.npc_execution,PC:symbols.npc_pc,ACTIVE:symbols.npc_active,TEXT_ID:symbols.npc_text_id,VISIBLE:symbols.text_visible,EVENT_BUSY:symbols.field+75};
 for(const[k,v]of Object.entries(names))audit=audit.replaceAll('__'+k+'__',String(v));check(!/__[A-Z_]+__/.test(audit),'Audit symbols');
 await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,fixtures:units?eventFixtures(data):undefined,eventRoute:!units,auditPath,audit,output}));
 try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyExploration/bin/Release/net8.0/VerifyExploration.dll',configPath],{cwd:ROOT,timeout:1200000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}
}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.romSha256===romSha256&&actual.coreSha256===coreSha256,'Run completion/identity');
const result={romSha256,coreSha256,units:actual.units,frames:actual.frames.length,home};
if(units)check(actual.units===eventFixtures(data).length,'Event fixture coverage');
else{
 const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.event,{verify:false});await prepareDialogue(data,assets,local.event);
 const p=assets.groups.properties[10],layout=assets.groups.layout[assets.groups.selection[10][0]],terrain=assets.groups.collision[p[0]>>5],dialogue=npcRecord(data,0,30).dialogue;
 let count=0,commands=0,pixels=0,retries=0,waits=0,ends=0,anchor,previousFrame,logical=0,maxDrift=0,maxCommand=0;const log=await fs.readFile(output+'.event.log','utf8');
 for(const line of log.trim().split(/\r?\n/)){
  const [tag,id,kind,...parts]=line.split(':');check(tag==='event-step'&&Number(id)===++count&&parts.length===19,'Complete ordered event trace');
  const [start,finish,rate]=parts.slice(16).map(Number),[f,a,b,e,pc,active,tid,visible,g,x,y,h,pc2,active2,tid2,visible2]=parts.slice(0,16).map(v=>Buffer.from(v,'hex'));
  if(kind==='1'){
   const expected=eventOriginal(data,11,f,a,b,e,pc.readUInt16LE(),active[0],layout,terrain,p[3],dialogue);
   check(expected.execution.equals(h)&&expected.pc===pc2.readUInt16LE()&&expected.active===active2[0]&&expected.part1.equals(x)&&expected.part2.equals(y)&&expected.tile===g[69],'Original event transition '+id);
   check(!!expected.pending===!!visible2[0],'Original pending text '+id);if(expected.pending)check(expected.textId===tid2.readUInt16LE(),'Original selected text '+id);
   if(anchor!==undefined){const delta=(f[73]-previousFrame)&255;check(delta===1,'One original frame per event command');logical+=delta;maxDrift=Math.max(maxDrift,Math.abs(logical/60.0988-(start-anchor)/rate));}else{anchor=start;logical=0;}
   previousFrame=f[73];if(expected.pending||!expected.active)anchor=undefined;else maxCommand=Math.max(maxCommand,(finish-start)/rate);
   commands++;if(h[0]&&h[1]<192)retries++;if(h[1]===252)waits++;if(!active2[0])ends++;
  }else{check(kind==='2','Trace kind');const expected=pixelsOriginal(data,7,f,a,b,layout,terrain,p[3]);check(expected.part1.equals(x)&&expected.part2.equals(y),'Original event pixels '+id);pixels++;}
 }
 check(commands>300&&pixels>300&&retries>50&&waits>300&&ends===2,'Two complete original event routes');
 check(maxDrift<=.055&&maxCommand<=.055,'Event logic/command time budget');
 const reference=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:report.audio.plan,ticks:report.audio.ticks});let end;
 for(const f of actual.frames){const b=Buffer.from(f.consumed,'hex');if(b.readUInt32LE(4)){end=reference.advanceToEvent(b.readUInt32LE(4));check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Event audio source sequence');}check(!f.late&&!f.underruns,'Event audio timing');}
 check(end?.done&&end.ticks===7200,'Full event audio schedule');const bus=await fs.readFile(output+'.lua.log','utf8'),last=pattern=>[...bus.matchAll(pattern)].at(-1)?.slice(1).map(Number);
 const a=last(/audit:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/g),v=last(/field-audit:(\d+),(\d+),(\d+),(\d+),(\d+)/g);check(a&&v,'Event bus audit');let apuHash=end.gbHash;for(const reg of [2,7,12,17])apuHash=(((apuHash<<1)|(apuHash>>>15))^(reg<<8))&65535;
 check(a[1]===0&&a[2]===0&&a[3]===apuHash&&a[4]===end.gbWrites+4&&a[7]===0&&v[1]===0&&v[3]===0&&v[4]<=10,'Event video/audio bus');
 const clockFrames=actual.frames.filter(f=>Buffer.from(f.consumed,'hex').readUInt32LE(0)>=8),first=clockFrames[0];let ticks=0,prev=first.timer,min=0,max=0;
 for(const f of clockFrames.slice(1)){ticks+=(f.timer-prev)&65535;prev=f.timer;const drift=ticks/4096-(f.clock-first.clock)/f.rate;min=Math.min(min,drift);max=Math.max(max,drift);}check(Math.max(Math.abs(min),Math.abs(max))<.0005&&max-min<.0005,'Event timer master-clock drift');
 const screens=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort();check(screens.length===7&&actual.shots.length===7,'Event checkpoints');
 for(const[i,s]of actual.shots.entries()){
  let rgb=fieldPixels(data,assets,report,s);if(s.visible){const page=textPage(expandDialogue(assets,s.textId,{names:assets.dialogue.diagnostic.names,shown:0,gil:0,variable:0,item:166}),0),cells=Buffer.from(s.cells,'hex');page.cells.forEach((v,j)=>check(cells.readUInt16LE(j*2)===v,'Event Korean cells'));rgb=windowRgb(rgb,page,assets.text.glyphs);}
  check(rgb.equals(screenshotRgb(await fs.readFile(home+'/Screenshots/'+screens[i]))),'Event original pixels '+s.label);
 }
 Object.assign(result,{commands,pixelSteps:pixels,retries,waits,ends,maxLogicDriftSeconds:maxDrift,maxCommandSeconds:maxCommand,sourceTicks:end.ticks,sourceEvents:end.events,actualApuWrites:a[4],apuHash:a[3],peakSpritesPerLine:v[4],screens:7,pixels:7*160*144,audioClock:{min,max}});
}
if(!units){result.memory={...actual.memory,...checkMemoryAudit(await fs.readFile(output+'.lua.log','utf8'))};check(!result.memory.fault&&result.memory.untouchedBytes>=128,'Stack headroom');}
await fs.writeFile(output.replace('.json','-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
