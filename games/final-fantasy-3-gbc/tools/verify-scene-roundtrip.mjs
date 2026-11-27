import {encounterOriginal} from './field-encounter-source.mjs';
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';
import {animationSeed} from './battle-animation-source.mjs';import {scriptSeed} from './battle-script-source.mjs';
import {magicSource,magicSourcePixels} from './battle-magic-source.mjs';import {screen} from './battle-screen.mjs';
import {nativeReference} from './native-reference.mjs';import {sourceAction} from './engine-fixtures.mjs';
import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';import {addTextAssets} from './korean-text.mjs';import {prepareDialogue} from './dialogue-build.mjs';
import {fieldPixels} from './exploration-pixels.mjs';import {screenshotRgb} from './map-pixels.mjs';import {windowRgb,textPage} from './text-reference.mjs';import {expandDialogue} from './dialogue-reference.mjs';
import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';
import {npcOriginal} from './dialogue-source.mjs';import {sourceInitialState} from './state-source.mjs';
const {data,local}=await input(),dir=ROOT+'/build/scene-layout',out=ROOT+'/evidence/scene-roundtrip',rom=dir+'/ff3-scene-layout.gbc';await fs.mkdir(out,{recursive:true});
const report=JSON.parse(await fs.readFile(dir+'/report.json')),romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));check(romSha256===report.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned artifacts');
const all=parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')),symbols=Object.fromEntries(Object.entries(all).filter(([k])=>k.startsWith('_')).map(([k,v])=>[k.slice(1),v]));checkSceneLayout(all);
const leaf=(await fs.readFile(rom)).subarray(symbols.ff3_text_wram_dma_begin,symbols.ff3_text_wram_dma_end);
check(leaf.length===23&&leaf.subarray(0,6).equals(Buffer.from([0xf0,0xff,0xf5,0xaf,0xe0,0xff]))&&leaf[6]===0xfa&&leaf.subarray(9,12).equals(Buffer.from([0xe0,0x70,0xfa]))&&leaf.subarray(14).equals(Buffer.from([0xe0,0x55,0x3e,1,0xe0,0x70,0xf1,0xe0,0xff])),'Exact resident DMA leaf; no stack/calls while storage is mapped');
const cases=[0,2].map(profile=>({profile,spell:29,mask:128,rng:'000d17c5',animation:animationSeed(19,{flags:128,spell:29,magic:0,attacker:128,targets:128,hit:128,types:Array(8).fill(0)}).toString('hex'),script:scriptSeed(0,{speed:8,effect:19,result:2,messages:[]}).toString('hex')}));
const config=out+'/config.json',output=out+'/result.json',run=promisify(execFile),env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
async function logged(args,file){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:1200000,maxBuffer:8e6});await fs.writeFile(out+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+file,(e.stdout||'')+(e.stderr||''));throw e;}}
let home;
if(process.argv.includes('--reuse')){const old=JSON.parse(await fs.readFile(config));check(old.romSha256===romSha256,'Stale capture');home=old.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-roundtrip-');const auditPath=ROOT+'/tools/scene-roundtrip-audit.lua';await fs.writeFile(config,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,cases,output,auditPath,audit:'local sym={'+Object.entries(symbols).filter(([,v])=>v>=0xc000&&v<=0xffff).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(auditPath,'utf8')+'\nlocal memoryDmaBegin='+symbols.ff3_text_wram_dma_begin+'\nlocal memoryDmaEnd='+symbols.ff3_text_wram_dma_end+'\n'+await memoryAudit()}));
 await logged(['build',ROOT+'/tools/VerifySceneRoundtrip/VerifySceneRoundtrip.csproj','-c','Release','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log');
 await logged([ROOT+'/tools/VerifySceneRoundtrip/bin/Release/net8.0/VerifySceneRoundtrip.dll',config],'run.log');}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.romSha256===romSha256&&actual.boots===1&&actual.cycles.length===2,'Same boot two actual display roundtrips');
check(actual.encounter?.controlled&&actual.encounter.statePreserved&&actual.encounter.audioAdvanced>0,'Controlled runtime encounter boundary');
const encounterSeed=Buffer.from(actual.encounter.seed,'hex'),encounterActual=Buffer.from(actual.encounter.selected,'hex');
encounterSeed[17]=0;const encounterExpected=encounterOriginal(data,16,encounterOriginal(data,14,encounterSeed));
for(const i of [10,14,15,76,77,78])check(encounterActual[i]===encounterExpected[i],'Original runtime encounter field '+i);
check(encounterActual[16]===4&&encounterActual[5]===0&&encounterActual[2]===0&&encounterActual[3]===0,'Explicit unsupported formation boundary after full tile');
const audio=JSON.parse(await fs.readFile(dir+'/audio.json')),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{ticks:audio.ticks,plan:audio.plan,beforeTick(c,t){for(const r of actual.requests)if(r.tick===t)sourceAction(c,r.op,r.arg);}});let end;
for(const f of actual.audio){const b=Buffer.from(f.consumed,'hex'),events=b.readUInt32LE(4);if(events){end=ref.advanceToEvent(events);check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Original dynamic audio through scene exchange');}}
check(end?.ticks===7200,'Full original audio schedule');
const bus=[...String(await fs.readFile(output+'.audit.log')).matchAll(/roundtrip-bus:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(bus,'Bus observer');
let finalHash=end.gbHash;for(const r of [2,7,12,17])finalHash=(((finalHash<<1)|(finalHash>>>15))^(r<<8))&65535;
check(!bus[1]&&!bus[3]&&!bus[5]&&!bus[8]&&bus[6]===end.gbWrites+4&&bus[7]===finalHash,'Actual VRAM/APU writes '+JSON.stringify(bus));
const memory=checkMemoryAudit(await fs.readFile(output+'.audit.log','utf8'));check(actual.stack.untouched>0&&actual.stack.guard==='a7'.repeat(16),'Same-boot stack does not reach OAM/guard');
const mappedDma=[...String(await fs.readFile(output+'.audit.log')).matchAll(/memory-dma-audit:(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(mappedDma&&mappedDma[0]>0&&mappedDma[1]<2000&&mappedDma[2]===8388608,'Existing resident DMA budget, separate from CPU copies');memory.residentDma={chunks:mappedDma[0],maxMappedCycles:mappedDma[1],clockRate:mappedDma[2]};
const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.dialogue,{verify:false});await prepareDialogue(data,assets,local.dialogue);
const dialogue=assets.dialogue.diagnostic,initial=sourceInitialState(data),selection=npcOriginal(data,dialogue.world,dialogue.npc,[...initial.subarray(0x20,0x30)]),event=assets.dialogue.events[selection.event],dialogueId=512+selection.dialogue[event.commands[0].operand];
const fieldReport=JSON.parse(await fs.readFile(ROOT+'/build/exploration/report.json')),files=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));check(files.length===actual.shots.length+actual.pictures.length,'All screenshots');
// Screenshots were interleaved; the capture ordinal is the authoritative order.
const ordered=[actual.shots[0]];let si=1,pi=0;
for(let cycle=0;cycle<2;cycle++){ordered.push(actual.shots[si++]);while(pi<actual.pictures.length&&actual.pictures[pi].cycle===cycle)ordered.push(actual.pictures[pi++]);for(let i=0;i<3;i++)ordered.push(actual.shots[si++]);}
check(ordered.length===files.length&&si===actual.shots.length,'Capture sequence');let magicFrames=0;
const source=cases.map(c=>magicSource(data,c)),base=await Promise.all(cases.map(c=>fs.readFile(ROOT+'/build/battle-effects/effect-base'+c.profile+'.rgb'))),indices=[0,0];
for(let i=0;i<ordered.length;i++){const s=ordered[i],image=screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[i]));let expected;
 if(s.label){expected=fieldPixels(data,assets,fieldReport,s);if(s.visible){check(s.textId===dialogueId,'Source-selected NPC dialogue after return');const page=textPage(expandDialogue(assets,dialogueId,{names:dialogue.names,shown:0,gil:0,variable:0,item:166}),0);page.cells.forEach((v,i)=>check(Buffer.from(s.cells,'hex').readUInt16LE(i*2)===v,'Original dialogue cells'));expected=windowRgb(expected,page,assets.text.glyphs);}}
 else{expected=screen(s.screen);if(s.owner===29){const original=source[s.cycle].frames[indices[s.cycle]++];check(Buffer.from(s.source,'hex').equals(original.raw),'Every original magic frame');check(expected.equals(magicSourcePixels(original,base[s.cycle],s.cycle===1)),'All original magic/background/UI dots');magicFrames++;}else check(s.owner===31,'Original preflash owner');}
 check(image.equals(expected),'Actual source-derived screenshot '+(s.label??s.cycle+'/'+s.frame));
}
check(indices.every((n,i)=>n===source[i].frames.length)&&actual.cycles.every(c=>c.deferred&&c.frames===source[c.cycle].frames.length+8),'Whole animations before safe return');
check(Buffer.from(actual.requests.filter(r=>r.op!==2).map(r=>r.op===8?255:r.arg|128)).equals(Buffer.from(source.flatMap(s=>s.sounds))),'Every original magic sound request');
check(actual.requests.filter(r=>r.op===2&&r.arg===32).length===2&&actual.requests.filter(r=>r.op===2&&r.arg===12).length===2,'Source battle and map music calls');
const first=actual.audio[0];let accumulated=0,previous=first.timer,min=0,max=0;for(const a of actual.audio){accumulated+=(a.timer-previous)&65535;previous=a.timer;const drift=accumulated/4096-(a.master-first.master)/a.rate;min=Math.min(min,drift);max=Math.max(max,drift);}check(max-min<0.0005,'Continuous timer/master clock');
const result={romSha256,coreSha256,boots:actual.boots,encounter:actual.encounter,cycles:actual.cycles,fieldScreens:actual.shots.length,magicFrames,screens:files.length,sourceTicks:end.ticks,audioObservations:actual.audio.length,requests:actual.requests,bus,memory,stack:actual.stack,phases:actual.phases,timerDriftRangeUs:(max-min)*1e6,layout:report.layout,scope:'One boot, controlled display enter/return, real original field movement and NPC dialogue after both returns. Controlled eligible-tile encounter dispatch also verified after both returns; not natural map reachability, live party/formation import or victory/result processing.'};await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
