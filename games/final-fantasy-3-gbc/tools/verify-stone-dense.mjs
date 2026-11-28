import {makeMapAssets} from './map-assets.mjs';
import {makeObjectAssets} from './object-assets.mjs';
import {fieldPixels} from './exploration-pixels.mjs';
import {denseSchedule} from './battle-dense-oam-audit.mjs';
// Explicit worst-case display intervention in the SAME field/battle ROM.
// The encounter seed, back flag and normalized status are diagnostic inputs;
// the source count, B5B8 refresh and AD2B numeral consumers still execute.
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';
import {animationSeed} from './battle-animation-source.mjs';import {scriptSeed} from './battle-script-source.mjs';
import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';import {nativeReference} from './native-reference.mjs';import {sourceAction} from './engine-fixtures.mjs';
import {partyEntryOracle} from './battle-party-oam-source.mjs';import {residentEnemy} from './battle-resident-bg.mjs';import {stoneAssets,stoneTop} from './battle-stone.mjs';
import {effectsAssets} from './battle-effects-assets.mjs';import {numeralReference} from './battle-numerals-source.mjs';
import {screen} from './battle-screen.mjs';import {screenshotRgb} from './map-pixels.mjs';
const {data,local}=await input(),dir=ROOT+'/build/scene-dungeon',out=ROOT+'/evidence/stone-dense';await fs.mkdir(out,{recursive:true});
const rom=dir+'/ff3-scene-layout.gbc',built=JSON.parse(await fs.readFile(dir+'/report.json')),romSha256=hash(await fs.readFile(rom));check(romSha256===built.romSha256,'Exact linked ROM');
const coreSha256=hash(await fs.readFile(local.mesenCore));check(coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Pinned native core');
const symbols=Object.fromEntries(Object.entries(parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8'))).filter(([k])=>k.startsWith('_')).map(([k,v])=>[k.slice(1),v]));
const layout=checkSceneLayout(parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8'))),config=out+'/config.json',output=out+'/result.json';let home;
if(process.argv.includes('--reuse')){const old=JSON.parse(await fs.readFile(config));check(old.romSha256===romSha256,'Fresh dense evidence');home=old.home;}
else {
 home=await fs.mkdtemp(ROOT+'/.local/mesen-stone-dense-');
 const animation=animationSeed(23,{flags:64});for(let i=0;i<8;i++)animation.writeUInt16LE(9999,48+i*2);
 const auditPath=ROOT+'/tools/scene-roundtrip-audit.lua';
 const audit='local sym={'+Object.entries(symbols).filter(([,v])=>v>=0xc000&&v<=65535).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(auditPath,'utf8')+'\nlocal memoryDmaBegin='+symbols.ff3_text_wram_dma_begin+'\nlocal memoryDmaEnd='+symbols.ff3_text_wram_dma_end+'\n'+await memoryAudit()+`
 -- Diagnostic intervention only, before original count/selection consumers.
 local mem=emu.memType.gameboyDebug
 emu.addMemoryCallback(function()
  if emu.read(sym._current_bank,mem)==${symbols.ff3_encounter_prepare>>>16} and emu.read(sym.scene_cycles,mem)<2 then
   emu.write(sym.scene_formation,3,mem);emu.write(sym.scene_rng_seed,22,mem)
  end
 end,emu.callbackType.exec,${symbols.ff3_encounter_prepare&65535},${symbols.ff3_encounter_prepare&65535},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)
  if v==0 and emu.read(sym.scene_cycles,mem)==1 and emu.read(sym._current_bank,mem)==${symbols.ff3_encounter_prepare>>>16} then
   emu.write(sym.scene_profile,47,mem);emu.write(sym.encounter_type,136,mem)
  end
 end,emu.callbackType.write,sym.scene_rng_ready,sym.scene_rng_ready,emu.cpuType.gameboy)
 local writes,bad,visible=0,0,0;local automatic={};local badSamples={}
 emu.addMemoryCallback(function()
  if emu.read(sym.dense_state,mem)>=2 and emu.read(sym.animation_video_probe,mem)==0 then automatic[#automatic+1]=emu.getState().masterClock end
 end,emu.callbackType.write,sym.animation_video_frames,sym.animation_video_frames,emu.cpuType.gameboy)
 emu.addMemoryCallback(function(a,v)
  local ly=emu.read(0xff44,mem);local mode=emu.read(0xff41,mem)&3
  if emu.read(sym.scene_phase,mem)==3 and (emu.read(0xff40,mem)&128)~=0 then writes=writes+1;if mode>=2 then bad=bad+1;if #badSamples<8 then badSamples[#badSamples+1]=a..":"..ly..":"..mode..":"..emu.read(sym.dense_state,mem)end end
   if ly<144 then visible=visible+1;if a<0xfe80 or emu.read(sym.dense_state,mem)<2 then bad=bad+1;if #badSamples<8 then badSamples[#badSamples+1]=a..":"..ly..":"..mode..":"..emu.read(sym.dense_state,mem)end end end
  end
 end,emu.callbackType.write,0xfe00,0xfe9f,emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log('dense-oam:'..writes..','..bad..','..visible);if #badSamples>0 then emu.log('dense-bad:'..table.concat(badSamples,','))end;emu.log('dense-automatic:'..table.concat(automatic,','))end,emu.eventType.codeBreak)
 `;
 await fs.writeFile(config,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,fieldBytes:layout.fieldBytes,auditPath,audit,output,commands:false,death:false,stone:true,denseStone:true,stoneRefresh:[],denseRefresh:{animation:animationSeed(22,{flags:128,previous:Array(8).fill(255),status:[72,0,72,0,72,0,72,0]}).toString('hex'),script:scriptSeed(0,{speed:8,effect:22,result:2,messages:[]}).toString('hex')},denseNumbers:{animation:animation.toString('hex'),script:scriptSeed(5,{speed:8,messages:[]}).toString('hex')}}));
 const run=promisify(execFile),env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
 for(const [args,file]of [[['build',ROOT+'/tools/VerifyDungeon/VerifyDungeon.csproj','-c','Release','--output',out+'/verifier','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log'],[[out+'/verifier/VerifyDungeon.dll',config],'run.log']]){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:1200000,maxBuffer:8e6});await fs.writeFile(out+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+file,(e.stdout||'')+(e.stderr||''));throw e;}}
}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.boots===1&&actual.entries.length===3&&actual.denseRuns.length===2,'Same-boot route and two dense displays');
const log=await fs.readFile(output+'.audit.log','utf8'),memory=checkMemoryAudit(log),oam=[...log.matchAll(/dense-oam:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(oam&&oam[0]>0&&oam[1]===0&&oam[2]>0,'Actual safe HBlank OAM writes');
const files=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),ordered=[actual.shots[0]];
for(let i=0;i<3;i++){ordered.push(actual.entries[i]);if(i<2){const r=actual.denseRuns[i];ordered.push(r.denseBase,...r.pics,r.restored);}ordered.push(actual.shots[i+1]);}ordered.push(actual.shots[4]);check(files.length===ordered.length,'Every native screenshot');
const mapAssets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),fieldEntry=JSON.parse(await fs.readFile(dir+'/field-entry.json'));
for(const shot of actual.shots){const expected=fieldPixels(data,mapAssets,{exploration:fieldEntry},shot),file=files[ordered.indexOf(shot)];check(screenshotRgb(await fs.readFile(home+'/Screenshots/'+file)).equals(expected),'Original field pixels after dense release '+shot.label);}
const rgb=c=>Buffer.from([Math.min(240,((c&31)*26+(c>>5&31)*4+(c>>10)*2)>>2),Math.min(240,((c>>5&31)*24+(c>>10)*8)>>2),Math.min(240,((c&31)*6+(c>>5&31)*4+(c>>10)*22)>>2)]);
let checked=0;const runs=[];
for(let r=0;r<2;r++){
 const e=actual.entries[r],v=actual.denseRuns[r],back=!!r;check(e.formation===3&&e.seed===22&&e.profile===46+r&&e.counts==='02030300'&&e.type===(back?136:0),'Explicit catalog intervention');check(v.pics.length===32&&v.automaticPictures===32&&!v.error&&!v.state,'32 original waits and ownership release');
 const opts={formation:3,counts:[2,3,3,0],back,terrain:8},p=partyEntryOracle(data,opts),enemy=residentEnemy(p),stone=stoneAssets(data,p),base=screen(v.denseBase.screen),wanted=Buffer.from(base),col=back?6:12;
 for(let y=16;y<104;y++)for(let x=0;x<160;x++)wanted.set(rgb(enemy.words[(y-16)*448+x]),(y*160+x)*3);
 check(v.denseBase.stoneState==='08080808','Source confused column and normal stone kind');
 for(let actor=0;actor<4;actor++)for(let c=0;c<10;c++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){const at=actor*480+c*16+y*2,bit=7-x,n=(stone.glyphs[at]>>bit&1)|((stone.glyphs[at+1]>>bit&1)<<1);if(n){wanted.set(rgb(p.bgPalette.readUInt16LE(24+n*2)),((stoneTop[actor]*8+(c>>1)*8+y)*160+col*8+(c&1)*8+x)*3);checked++;}}
 check(base.equals(wanted),'Exact underlying enemies and original confused-stone ink');
 const a=effectsAssets(data,[opts]).values,seed=Buffer.from(a.seeds);for(let i=0;i<8;i++)seed.writeUInt16LE(9999,i*2);const source=numeralReference(data,seed),schedule=denseSchedule(Buffer.from(v.pics[0].initial,'hex'),Buffer.from(v.pics[0].records,'hex'),v.pics[0].count);
 let peak=0;const b=ordered.indexOf(v.denseBase);check(screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[b])).equals(base),'Native confused stone base');
 for(let frame=0;frame<32;frame++){const lineCounts=[...schedule.lines];const f=v.pics[frame],raw=source[frame].oam,target=Buffer.from(base);check(f.source===raw.toString('hex')&&f.state===2&&f.count>0,'Source numeric frame and active reuse '+frame);
  for(let slot=7;slot>=0;slot--){const q=raw.subarray(slot*16,slot*16+16),y=Math.max(0,Math.min(136,a.anchors[slot*2+1]+q[0]-seed[32+slot])),x=a.anchors[slot*2];
   for(let yy=0;yy<8;yy++)lineCounts[y+yy]+=4;
   for(let d=3;d>=0;d--)for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const t=q[d*4+1]-0x56,at=t*16+yy*2,bit=7-xx,n=(a.tiles[at]>>bit&1)|((a.tiles[at+1]>>bit&1)<<1);if(n)target.set(rgb(a.palette.readUInt16LE(n*2)),((y+yy)*160+x+d*8+xx)*3);}
  }
  peak=Math.max(peak,...lineCounts);check(peak<=10,'Whole-frame scanline capacity '+r+'/'+frame);
  const got=screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[b+1+frame]));check(got.equals(target),'All 32 numerals and retained pixels '+r+'/'+frame);
 }
 check(screen(v.restored.screen).equals(base)&&screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[b+33])).equals(base),'Exact restoration after dense owner');runs.push({back,pictures:v.pics.length,updates:v.pics[0].count,retained:schedule.logical,retainedPeak:schedule.peak,wholeFramePeak:peak,cellPoolPeak:v.denseBase.poolPeak});
}
const last=Buffer.from(actual.audio.at(-1).consumed,'hex'),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:[],ticks:last.readUInt32LE(0)+32,beforeTick(c,t){for(const r of actual.requests)if(r.tick===t)sourceAction(c,r.op,r.arg);}});let end,base;
const baseEvents=Buffer.from(actual.audioBase,'hex').readUInt32LE(4);for(const a of actual.audio){const b=Buffer.from(a.consumed,'hex'),n=b.readUInt32LE(4);if(n){end=ref.advanceToEvent(n);if(n===baseEvents)base={...end};check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Original source and converted audio stream');}}
const bus=[...log.matchAll(/roundtrip-bus:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(bus&&[1,3,5,8].every(i=>bus[i]===0)&&base&&bus[6]===end.gbWrites-base.gbWrites&&bus[7]===end.gbHash,'Every native video/APU write');
// As in verify-dungeon, begin after the first consumed packet. Boot's queue
// prefill deliberately precedes TAC start and is not elapsed audio time.
const timed=actual.audio.filter(a=>Buffer.from(a.consumed,'hex').readUInt32LE(4)>0);check(timed.length>0,'Active audio observations');
let ticks=0,prior=timed[0].timer,min=0,max=0;for(const a of timed){ticks+=(a.timer-prior)&65535;prior=a.timer;const d=ticks/4096-(a.master-timed[0].master)/a.rate;min=Math.min(min,d);max=Math.max(max,d);}check(max-min<0.0005,'Continuous timer during multiplexed OAM');check(actual.stack.guard==='a7'.repeat(16)&&actual.stack.untouched>32,'Guarded stack');
const automatic=[...log.matchAll(/dense-automatic:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(automatic?.length===64,'Both ungated original 32-picture runs');
const automaticGapsMs=[0,1].map(r=>automatic.slice(r*32+1,r*32+32).map((t,i)=>(t-automatic[r*32+i])*1000/8388608));
check(actual.requests.filter(r=>r.op===7&&r.arg===49).length===6,'Six simultaneous SFX requests consumed');
const report={romSha256,coreSha256,runs,automaticGapsMs,sourceStonePixels:checked,oam,bus,memory,stack:actual.stack,audioTicks:end.ticks,timerDriftRangeUs:(max-min)*1e6,screens:files.length,scope:'Same-boot field/battle/return with explicit formation 3, seed 22, forced back orientation in the second entry, and normalized confused stone from original effect 22. Original 32 numeral waits and every RGB pixel checked; not normal all-target gameplay calculation. Automatic replay cadence is measured separately.'};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
