import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {fieldFixtures} from './exploration-source.mjs';import {nativeReference} from './native-reference.mjs';
import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';import {addTextAssets} from './korean-text.mjs';import {prepareDialogue} from './dialogue-build.mjs';
import {fieldPixels} from './exploration-pixels.mjs';import {screenshotRgb} from './map-pixels.mjs';import {windowRgb,textPage} from './text-reference.mjs';import {expandDialogue} from './dialogue-reference.mjs';import {npcOriginal} from './dialogue-source.mjs';import {sourceInitialState} from './state-source.mjs';
const {data,local}=await input(),units=process.argv.includes('--units'),dir=ROOT+'/build/exploration',rom=dir+'/ff3-exploration.gbc',report=JSON.parse(await fs.readFile(dir+'/report.json')),romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));
check(romSha256===report.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Artifact identity');
const symbols={};for(const m of(await fs.readFile(dir+'/ff3-exploration.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const out=ROOT+'/evidence/exploration';await fs.mkdir(out,{recursive:true});const tag=units?'units':'play',output=out+'/'+tag+'.json',configPath=output+'.config.json';let home;
if(process.argv.includes('--reuse')){const c=JSON.parse(await fs.readFile(configPath));check(c.romSha256===romSha256,'Stale artifact');home=c.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-exploration-'+tag+'-');const auditPath=ROOT+'/tools/text-audio-audit.lua',audit=(await fs.readFile(auditPath,'utf8')).replace('__IRQ_BUSY__',String(symbols.native_irq_busy))+'\n'+(await fs.readFile(ROOT+'/tools/exploration-audit.lua','utf8')).replaceAll('__FIELD_RENDER_BUSY__',String(symbols.field+64));
 await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,fixtures:units?fieldFixtures(data):undefined,auditPath,audit,output}));
 try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyExploration/bin/Release/net8.0/VerifyExploration.dll',configPath],{cwd:ROOT,timeout:1200000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.romSha256===romSha256&&actual.coreSha256===coreSha256,'Run identity/completion');
let result={romSha256,coreSha256,units:actual.units,frames:actual.frames.length};
if(units)check(actual.units===fieldFixtures(data).length,'Complete original/animation fixture coverage');
if(!units){
 const table=await fs.readFile(dir+'/conversion.bin');check(hash(table)===report.audio.conversionSha256,'Conversion identity');const reference=nativeReference(data,table,{plan:report.audio.plan,ticks:report.audio.ticks});let end;
 for(const s of actual.frames){const b=Buffer.from(s.consumed,'hex'),e=b.readUInt32LE(4)?reference.advanceToEvent(b.readUInt32LE(4)):undefined;if(e){check(e.ticks===b.readUInt32LE(0)&&e.sourceHash===b.readUInt16LE(8)&&e.gbHash===b.readUInt16LE(10)&&+e.done===s.done,'Consumed original audio '+s.frame);end=e;}check(!s.late&&!s.underruns,'Audio timing');}
 check(end?.done&&end.ticks===report.audio.ticks,'Complete audio schedule');const log=await fs.readFile(output+'.lua.log','utf8'),audit=[...log.matchAll(/audit:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1);check(audit,'Independent bus audit');
 const [writes,bad,off,apuHash,apuWrites,maxLy,dmaStarts,badDma]=audit.slice(1).map(Number);let expectedHash=end.gbHash;for(const reg of [2,7,12,17])expectedHash=(((expectedHash<<1)|(expectedHash>>>15))^(reg<<8))&65535;
 check(!bad&&!off&&!badDma&&writes>1000&&apuHash===expectedHash,'Video/APU bus audit '+JSON.stringify({writes,bad,off,apuHash,expectedHash,badDma}));
 const fieldAudit=[...log.matchAll(/field-audit:(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1);check(fieldAudit,'Field bus audit');const [oamDmas,badOam,scrollWrites,badScroll,peak]=fieldAudit.slice(1).map(Number);check(oamDmas>7000&&!badOam&&scrollWrites>100&&!badScroll&&peak<=10,'OAM/scroll bus budget');
 const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.dialogue,{verify:false});await prepareDialogue(data,assets,local.dialogue);
 const d=assets.dialogue.diagnostic,state=sourceInitialState(data),selection=npcOriginal(data,d.world,d.npc,[...state.subarray(0x20,0x30)]),event=assets.dialogue.events[selection.event],id=512+selection.dialogue[event.commands[0].operand];
 const page=textPage(expandDialogue(assets,id,{names:d.names,shown:0,gil:0,variable:0,item:166}),0),screens=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort();check(screens.length===actual.shots.length,'Screenshot count');
 for(const [i,s]of actual.shots.entries()){let pixels=fieldPixels(data,assets,report,s);if(s.visible){check(s.textId===id,'Original selected NPC text');const cells=Buffer.from(s.cells,'hex');page.cells.forEach((v,i)=>check(cells.readUInt16LE(i*2)===v,'Original translated window cells'));pixels=windowRgb(pixels,page,assets.text.glyphs);}const image=screenshotRgb(await fs.readFile(home+'/Screenshots/'+screens[i]));check(image.equals(pixels),'Source-derived screen pixels '+s.label);}
 check(actual.shots.length===12,'Three complete input dialogue cycles');
 const tail=actual.frames.filter(s=>s.frame>=actual.shots.find(s=>s.label==='walked-back-2').frame+5),first=tail[0],last=tail.at(-1),fb=Buffer.from(first.field,'hex'),lb=Buffer.from(last.field,'hex');
 const logicSeconds=((lb.readUInt16LE(32)-fb.readUInt16LE(32))&65535)/60.0988,elapsedSeconds=(last.clock-first.clock)/last.rate,logicDriftSeconds=logicSeconds-elapsedSeconds;
 check(Math.abs(logicDriftSeconds)<0.2,'Logical movement clock drift '+logicDriftSeconds);
 const performance={maxBackgroundSeconds:lb.readUInt16LE(56)/4096,maxObjectsSeconds:lb.readUInt16LE(58)/4096,maxPublishSeconds:lb.readUInt16LE(60)/4096,maxRenderSeconds:lb.readUInt16LE(62)/4096,logicDriftSeconds,logicObservationSeconds:elapsedSeconds};
 // The CPU counter ends at enqueue. Independently measure through the actual
 // VBlank SCX write, and also catch stalls before preparation starts.
 const latency=[...log.matchAll(/movement-latency:(\d+),(\d+),(\d+),(\d+);([\d=,]+)/g)].at(-1);check(latency,'Actual scroll commit latency audit');
 const [count,maxUs,sumUs,invalid]=latency.slice(1,5).map(Number),bins=latency[5].split(',').map(s=>s.split('=').map(Number)).sort((a,b)=>a[0]-b[0]);
 check(!invalid&&count===scrollWrites/2&&bins.reduce((s,b)=>s+b[1],0)===count,'Complete latency pairing/histogram');
 const percentile=p=>{let n=0;for(const [ms,hits]of bins)if((n+=hits)>=Math.ceil(count*p))return ms/1000;throw Error('Latency percentile');};
 const gaps=[];let lastChange,unchanged=0,maxUnchanged=0,movingFrames=0,changedFrames=0;
 for(let i=1;i<actual.frames.length;i++){const a=actual.frames[i-1],b=actual.frames[i],af=Buffer.from(a.field,'hex'),bf=Buffer.from(b.field,'hex');
  if(af[5]&&bf[5]&&!af[19]&&!bf[19]){movingFrames++;if(a.scroll===b.scroll){unchanged++;maxUnchanged=Math.max(maxUnchanged,unchanged);}else{changedFrames++;unchanged=0;if(lastChange)gaps.push((b.clock-lastChange.clock)/b.rate);lastChange=b;}}
  else{unchanged=0;lastChange=undefined;}
 }
 gaps.sort((a,b)=>a-b);check(gaps.length>1000,'Sustained movement samples');
 performance.actualCommit={count,maxSeconds:maxUs/1e6,meanSeconds:sumUs/count/1e6,p95UpperSeconds:percentile(.95),histogramMilliseconds:bins};
 performance.movingScroll={movingFrames,changedFrames,maxUnchangedFrames:maxUnchanged,intervals:gaps.length,p95SampledGapSeconds:gaps[Math.ceil(gaps.length*.95)-1],maxSampledGapSeconds:gaps.at(-1)};
 check(maxUs<=35000&&performance.maxRenderSeconds<=.020,'Movement preparation/commit regression');
 check(maxUnchanged<=4&&gaps.at(-1)<=.085,'Moving scroll starvation regression');
 result={...result,sourceTicks:end.ticks,sourceEvents:end.events,videoWrites:writes,invalidVideoWrites:bad,lcdOff:off,actualApuHash:apuHash,actualApuWrites:apuWrites,maxWriteLine:maxLy,dmaStarts,badDma,oamDmas,badOam,scrollWrites,badScroll,peakSpritesPerLine:peak,shots:actual.shots.length,pixels:actual.shots.length*160*144,performance,home};
}
await fs.writeFile(out+'/'+tag+'-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
