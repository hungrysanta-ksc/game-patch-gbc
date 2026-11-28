import {freezeMembershipAudit,freezeMembershipResult,restoreDmaAudit,restoreDmaResult} from './battle-freeze-membership-audit.mjs';
import {cellCallAudit} from './battle-cell-call-profile.mjs';
import {magicSource,magicSourcePixels} from './battle-magic-source.mjs';
import {animationSeed} from './battle-animation-source.mjs';
import {scriptSeed} from './battle-script-source.mjs';
import {deathOwnership,deathPictures,deathMachine,sourceCoordinate,deathSourceVisible} from './battle-death-resources.mjs';
import {sourceCommand,sourceCommandStrike,sourceDeath} from './battle-command-source.mjs';
import {contextReference} from './battle-context-source.mjs';
import {livePartyAssets} from './live-party-source.mjs';
import {sourceResult,R} from './battle-result-source.mjs';
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';
import {dungeonEntry} from './dungeon-source.mjs';import {encounterOriginal} from './field-encounter-source.mjs';
import {encounterEntryOriginal} from './encounter-entry-source.mjs';import {livePartyOriginal} from './live-party-source.mjs';
import {playSeedOriginal} from './play-seed-source.mjs';import {nativeReference} from './native-reference.mjs';import {sourceAction} from './engine-fixtures.mjs';
import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {fieldPixels} from './exploration-pixels.mjs';import {screenshotRgb} from './map-pixels.mjs';import {screen} from './battle-screen.mjs';
import {partyEntryOracle} from './battle-party-oam-source.mjs';import {residentEnemy} from './battle-resident-bg.mjs';import {terrainAssets,terrainApply,terrainColor} from './battle-terrain.mjs';
import {stoneSurfaces} from './battle-stone-surface.mjs';import {stoneTop} from './battle-stone.mjs';
const ailments=process.argv.includes('--ailments');
const stone=process.argv.includes('--stone'),deathAutomatic=process.argv.includes('--death-auto'),death=stone||deathAutomatic||process.argv.includes('--death'),commands=ailments||death||process.argv.includes('--commands');
const {data,local}=await input(),dir=ROOT+'/build/scene-dungeon',out=ROOT+'/evidence/'+(ailments?'dungeon-ailments':stone?'dungeon-stone':death?(deathAutomatic?'dungeon-death-auto':'dungeon-death'):commands?'dungeon-commands':'dungeon-roundtrip'),rom=dir+'/ff3-scene-layout.gbc';await fs.mkdir(out,{recursive:true});
const built=JSON.parse(await fs.readFile(dir+'/report.json')),entry=JSON.parse(await fs.readFile(dir+'/field-entry.json')),bytes=await fs.readFile(rom),romSha256=hash(bytes),coreSha256=hash(await fs.readFile(local.mesenCore));
check(romSha256===built.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Exact dungeon/core artifacts');
for(const [k,v]of Object.entries(dungeonEntry(data)))check(JSON.stringify(entry[k])===JSON.stringify(v),'Source entry '+k);
const all=parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')),layout=checkSceneLayout(all),symbols=Object.fromEntries(Object.entries(all).filter(([k])=>k.startsWith('_')).map(([k,v])=>[k.slice(1),v]));
const config=out+'/config.json',output=out+'/result.json',run=promisify(execFile);let home;
if(process.argv.includes('--reuse')){const old=JSON.parse(await fs.readFile(config));check(old.romSha256===romSha256,'Fresh dungeon evidence');home=old.home;}
else{
 home=await fs.mkdtemp(ROOT+'/.local/mesen-dungeon-');const auditPath=ROOT+'/tools/scene-roundtrip-audit.lua';
 const audit='local sym={'+Object.entries(symbols).filter(([,v])=>v>=0xc000&&v<=0xffff).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(auditPath,'utf8')+'\nlocal encounterPc='+(symbols.ff3_field_encounter&65535)+'\nlocal encounterBank='+(symbols.ff3_field_encounter>>>16)+'\n'+await fs.readFile(ROOT+'/tools/dungeon-audit.lua','utf8')+'\nlocal memoryDmaBegin='+symbols.ff3_text_wram_dma_begin+'\nlocal memoryDmaEnd='+symbols.ff3_text_wram_dma_end+'\n'+await memoryAudit()+(death?freezeMembershipAudit(symbols,stone?stoneSurfaces(data).map(s=>s.occupied):undefined)+restoreDmaAudit(symbols,stone?stoneSurfaces(data).map(s=>s.occupied):undefined):'');
 const costs=deathAutomatic?await cellCallAudit(dir+'/battle-death-video.lst',symbols,bytes):'';
 await fs.writeFile(config,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,fieldBytes:layout.fieldBytes,auditPath,audit:audit+'\n'+costs,output,commands,ailments,death,stone,deathAutomatic,stoneRefresh:[Array(8).fill(0),[64,0,64,0,68,0,65,0],[192,0,64,0,68,0,65,0]].map(status=>({status:Buffer.from(status).toString("hex"),animation:animationSeed(22,{flags:128,previous:Array(8).fill(255),status}).toString("hex"),script:scriptSeed(0,{speed:8,effect:22,result:2,messages:[]}).toString("hex")})),postDeathMagic:{animation:animationSeed(19,{flags:128,spell:29,magic:0,attacker:128,targets:128,hit:128,types:Array(8).fill(0)}).toString('hex'),script:scriptSeed(0,{speed:8,effect:19,result:2,messages:[]}).toString('hex')}}));
 const env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
 for(const [args,file]of [[['build',ROOT+'/tools/VerifyDungeon/VerifyDungeon.csproj','-c','Release','--output',out+'/verifier','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log'],[[out+'/verifier/VerifyDungeon.dll',config],'run.log']]){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:1200000,maxBuffer:8e6});await fs.writeFile(out+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+file,(e.stdout||'')+(e.stderr||''));throw e;}}
}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.romSha256===romSha256&&actual.boots===1&&actual.entries.length===3,'Three natural encounters in one boot');
const log=await fs.readFile(output+'.audit.log','utf8'),captureCount=Number([...log.matchAll(/encounter-entropy-count:(\d+)/g)].at(-1)?.[1]),captures=[...log.matchAll(/encounter-entropy:(\d+):([a-f0-9]+):([a-f0-9]+)/g)].slice(-3);
check(captureCount===3&&captures.length===3,'Exactly one seed per natural encounter');
const rollsCount=Number([...log.matchAll(/dungeon-roll-count:(\d+)/g)].at(-1)?.[1]),rolls=[...log.matchAll(/dungeon-roll:(\d+):([a-f0-9]+)/g)].slice(-rollsCount);check(rollsCount>3&&rolls.length===rollsCount,'Read-only source probability observations');
let successes=0,previous;
for(const m of rolls){const f=Buffer.from(m[2],'hex');check(f[24]===181&&f[25]===6,'Unmodified source map/rate');if(previous)for(const i of [14,15,76])check(f[i]===previous[i],'Continuous field RNG '+i);f[17]=Number(m[1]);const next=encounterOriginal(data,14,f);previous=next;if(next[10]&32){const chosen=actual.entries[successes++];check(chosen&&chosen.formation===next[77],'Original probability and formation choice');}}
check(successes===3,'No missing natural encounters');
const catalog=JSON.parse(await fs.readFile(dir+'/encounter-resources.json'));
for(const [i,e]of actual.entries.entries()){
 const c=captures[i],f=Buffer.from(c[2],'hex');check(Number(c[1])===e.seed&&playSeedOriginal(data,f,Buffer.from(c[3],'hex'))===e.seed,'Original ADC over live GBC owners '+i);
 const expected=encounterEntryOriginal(data,e.formation,e.seed,Buffer.from(e.before,'hex')),derived=livePartyOriginal(data,Buffer.from(e.before,'hex'));
 check(e.counts===Buffer.from(expected.counts).toString('hex')&&e.type===expected.type&&e.first===expected.first&&e.rng===expected.rng.toString('hex'),'Original counts/entry/RNG '+i);
 check(Buffer.from(e.party,'hex').subarray(256,768).equals(derived.state.subarray(256,768)),'Current canonical party '+i);
 const profile=catalog.profiles.find(p=>p.key.join()===[e.formation,...expected.counts,+(e.type===136)].join());check(profile?.profile===e.profile&&e.background===8,'Selected original resources '+i);
}
if(commands){
 check(actual.commands.length===(death||ailments?2:1),'Actual resolved commands');
 for(const v of actual.commands){const s=Buffer.from(v.before,'hex'),f=Buffer.from(v.fightBefore,'hex'),canonical=Buffer.from(v.canonical,'hex'),cursor=Buffer.from(v.rngBefore,'hex'),e=actual.entries[0];
 if(v.actor<4){f[128]=canonical[515+v.actor*64];f[129]=canonical[517+v.actor*64];}f[135]=s[819];s[R.actor]=v.actor;
 const original=encounterEntryOriginal(data,e.formation,e.seed,Buffer.from(e.before,'hex'));
 const r=sourceCommand(data,{s,f,counters:[...cursor.subarray(1)]},original.table);check(r.ok,'Source live command accepted');
 const committed=sourceResult(data,r.s,0,r.counters,original.table);
 if(death&&v.actor<4){let mask=0;for(let i=0;i<8;i++)if(committed.state[R.dead+i]&128)mask|=128>>i;const removed=sourceDeath(data,e.type===136,mask,1,[...committed.state.subarray(R.types,R.types+8)]);committed.state.set(removed.types,R.types);committed.state[R.remaining]=removed.remaining;check(removed.counts.toString('hex')===v.credit,'Original death credit');}
 const after=sourceResult(data,committed.state,4,committed.counters,original.table);
 check(after.state.toString('hex')===v.after,'Original full command/status/outcome records');
 check(r.f.toString('hex')===v.fight&&r.call.toString('hex')===v.call,'Original arithmetic/numerals/messages/visual inputs');
 const rendered=v.actor<4?sourceCommandStrike(data,{formation:e.formation,counts:original.counts,back:e.type===136,actor:v.actor,target:r.call[2]&7,weapons:r.call.subarray(8,10),hits:r.f.subarray(167,169),table:original.table,counters:r.counters}):r.counters;
 check(Buffer.concat([cursor.subarray(0,1),rendered]).toString('hex')===v.rngAfter,'Shared calculation/animation RNG cursor');
 }}
if(ailments){const project=contextReference(data),assets=livePartyAssets(data);for(const [index,v]of actual.commands.entries()){const records=Buffer.from(v.after,'hex'),icons=Buffer.from(v.icons,'hex'),vram=Buffer.from(v.screen.vram,'hex');for(let i=0;i<4;i++){const status=project(2,Buffer.from([records[i*64+1],records[i*64+2],0,0,0,0,0,0])).state[4];check(icons[8+i]===status,'Current canonical icon after command '+index+'/'+i);if(status<8)check(vram.subarray(0x490+i*64,0x4d0+i*64).equals(assets.live_party_icons.subarray(status*64,status*64+64)),'Original icon patterns restored '+index+'/'+i);}check(icons[10]===(index===0?5:255),'Poison icon added then removed');}}
const last=Buffer.from(actual.audio.at(-1).consumed,'hex'),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:[],ticks:last.readUInt32LE(0)+32,beforeTick(c,t){for(const r of actual.requests)if(r.tick===t)sourceAction(c,r.op,r.arg);}});let end,base;
const baseEvents=Buffer.from(actual.audioBase,'hex').readUInt32LE(4);
for(const a of actual.audio){const b=Buffer.from(a.consumed,'hex'),n=b.readUInt32LE(4);if(n){end=ref.advanceToEvent(n);if(n===baseEvents)base={...end};check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Original live audio stream');}}
const bus=[...log.matchAll(/roundtrip-bus:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(bus&&bus[0]>0&&bus[2]>0&&[1,3,5,8].every(i=>bus[i]===0),'Safe video/audio bus');check(base&&bus[6]===end.gbWrites-base.gbWrites&&bus[7]===end.gbHash,'Every actual APU write since observer attachment');const memory=checkMemoryAudit(log);
const timed=actual.audio.filter(a=>Buffer.from(a.consumed,'hex').readUInt32LE(4)>0);let elapsed=0,previousTimer=timed[0].timer,min=0,max=0;for(const a of timed){elapsed+=(a.timer-previousTimer)&65535;previousTimer=a.timer;const drift=elapsed/4096-(a.master-timed[0].master)/a.rate;min=Math.min(min,drift);max=Math.max(max,drift);}check(max-min<0.0005,'Continuous hardware audio timer');
const files=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),ordered=[actual.shots[0]];
for(let i=0;i<3;i++){ordered.push(actual.entries[i]);if(commands&&i===0){if(death)ordered.push(...actual.deathFrames.filter(f=>f.shot).map(f=>({...f,command:true})));ordered.push({...actual.commands[0],command:true});if(ailments)ordered.push({...actual.commands[1],command:true});if(death){ordered.push(...actual.postDeathFrames.filter(f=>f.shot).map(f=>({...f,command:true})));ordered.push({...actual.commands[1],command:true});ordered.push({...actual.magicAfter,command:true});if(stone)ordered.push(...actual.stoneUpdates.flatMap((p,i)=>i===1?[{...p,command:true},{...actual.stoneMagicAfter,command:true}]:[{...p,command:true}]));}}ordered.push(actual.shots[i+1]);}ordered.push(actual.shots[4]);check(ordered.length===files.length,'Every screenshot');
const rgb=v=>{const r=v&31,g=v>>5&31,b=v>>10;return Buffer.from([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)]);};
const stoneAssets=stone?stoneSurfaces(data):null;
function stonePixels(e){const pixels=new Map();if(!stone)return pixels;const state=Buffer.from(e.party,'hex'),back=e.type===136,a=stoneAssets[+back];
 for(let actor=0;actor<4;actor++){const status=state[258+actor*64];if((status&192)!==64)continue;const kind=status&32?1:status&8?2:0,row=(state[527+actor*64]&1)^+back,col=(back?0:16)+row*2;
  for(let cell=0;cell<10;cell++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){const at=(actor*3+kind)*160+cell*16+y*2,v=(a.glyphs[at]>>(7-x)&1)|((a.glyphs[at+1]>>(7-x)&1)<<1);if(v)pixels.set((stoneTop[actor]*8+(cell>>1)*8+y)*160+col*8+(cell&1)*8+x,rgb(a.palette.readUInt16LE(v*2)));}
 }return pixels;
}
if(stone){let checked=0;for(const e of actual.entries){const visible=screen(e.screen);for(const [at,color]of stonePixels(e)){check(visible.subarray(at*3,at*3+3).equals(color),'Live original stone pixel '+e.cycle+'/'+at);checked++;}}
 for(const p of [...actual.deathFrames,...actual.postDeathFrames,...actual.commands,actual.magicAfter]){const visible=screen(p.screen);for(const[at,color]of stonePixels(actual.entries[0])){check(visible.subarray(at*3,at*3+3).equals(color),'Stone retained through action '+at);checked++;}}
 check(checked>1000,'Observed stone coexistence');
 check(actual.stoneUpdates.length===3,'Clear, stone again, death overriding stone');
 check(actual.stoneMagicFrames.length===27,'All magic pictures with joined stone cells');
 const stoneMagic=magicSource(data,{profile:actual.entries[0].type===136?2:0,spell:29,mask:128}),stoneBase=screen(actual.stoneUpdates[1].screen);
 for(const[i,p]of actual.stoneMagicFrames.entries()){check(p.source===stoneMagic.frames[i].raw.toString('hex'),'Source magic after re-stone '+i);check(screen(p.screen).equals(magicSourcePixels(stoneMagic.frames[i],stoneBase,actual.entries[0].type===136)),'Exact joined stone/magic pixels '+i);}
 check(screen(actual.stoneMagicAfter.screen).equals(stoneBase),'Exact joined stone map restoration');
 for(const u of actual.stoneUpdates){const status=Buffer.from(u.status,'hex'),tail=Buffer.from(u.tail,'hex'),state=Buffer.from(actual.entries[0].party,'hex');
  for(let i=0;i<4;i++){check(tail[5+i]===status[i*2],'Source normalized status after B5B8');state[258+i*64]=(status[i*2]&192)|((status[i*2]&7)<<3);const kind=(status[i*2]&192)===64?(status[i*2]&4?1:status[i*2]&1?2:0):3;check((Buffer.from(u.stoneState,'hex')[i]&3)===kind,'Death/stone/map-kind priority');}
  const visible=screen(u.screen);for(const[at,color]of stonePixels({...actual.entries[0],party:state.toString('hex')}))check(visible.subarray(at*3,at*3+3).equals(color),'Refreshed original stone pixels '+at);
  // With no stone, every non-UI background byte must select bank 1 again.
  if(status.every(v=>!v)){const v=Buffer.from(u.screen.vram,'hex'),base=(u.screen.lcdc&8?0x1c00:0x1800)+8192;for(let y=2;y<13;y++)for(let x=0;x<20;x++)check(v[base+y*32+x]&8,'Cure restores current enemy map');}
 }
}
for(const [i,p]of ordered.entries()){
 let expected;if(p.label)expected=fieldPixels(data,assets,{exploration:entry},p);
 else if(p.command)expected=screen(p.screen);
 else{
  expected=screen(p.screen);const original=partyEntryOracle(data,{formation:p.formation,counts:[...Buffer.from(p.counts,'hex')],back:p.type===136,terrain:8}),ground=terrainAssets(original),tiles=Buffer.alloc(160);for(let row=0;row<4;row++)terrainApply(ground,tiles,row,ground.source.subarray(row*64,row*64+64));
  const bgOnly=screen({...p.screen,oam:'00'.repeat(160)});for(let y=0;y<11;y++)for(let x=0;x<160;x++)check(bgOnly.subarray((y*160+x)*3,(y*160+x+1)*3).equals(rgb(terrainColor(ground,tiles,original.bgPalette,x,y))),'Original cave terrain '+i+'/'+x+','+y);
  const enemy=residentEnemy({...original,enemyYOffsets:p.formation===0?[-4,-6]:undefined}),stoneInk=stonePixels(p);for(let y=16;y<104;y++)for(let x=0;x<112;x++)if(!stoneInk.has(y*160+x))check(expected.subarray((y*160+x)*3,(y*160+x+1)*3).equals(rgb(enemy.words[(y-16)*448+x])),'Selected original enemy dots '+i+'/'+x+','+y);
 }
 check(screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[i])).equals(expected),'Actual hardware screenshot '+i);
}
if(death){
 for(const v of actual.commands)check(v.cellPool&&v.cellPool.error===0&&v.cellPool.peak<=54,'Shared current-cell pool owner');
 const e=actual.entries[0],v=actual.commands[0],s=Buffer.from(v.before,'hex'),slot=Array.from({length:8},(_,i)=>i).find(i=>s[R.types+i]!==255),mask=128>>slot,options={formation:e.formation,counts:[...Buffer.from(e.counts,'hex')],back:e.type===136},a=deathOwnership(data,options),source=deathPictures(data,options,mask);
 if(!deathAutomatic)check(actual.deathFrames.length>=37&&new Set(actual.deathFrames.filter(f=>f.picture<37).map(f=>f.picture)).size===37,'All 37 source death pictures');
 for(const f of [...actual.deathFrames,{picture:37,screen:v.screen}]){const visible=screen(f.screen);for(let y=0;y<88;y++)for(let x=0;x<160;x++){const at=y*160+x;if(!a.owner[at])continue;const [sx]=sourceCoordinate(a.p,x,0),sy=a.sourceY[at],keep=f.picture<37?deathSourceVisible(source.frames[f.picture],sx,sy):!(a.owner[at]&mask),color=keep?a.base.words[y*448+x]:0;check(visible.subarray(((y+16)*160+x)*3,((y+16)*160+x+1)*3).equals(rgb(color)),'Original death pixels '+f.picture+'/'+x+','+y);}}
 check(actual.requests.some(r=>r.op===7&&r.arg===49),'Original death SFX request');
 if(!deathAutomatic){check(actual.postDeathFrames.length===8,'Eight original post-death flash waits');check(actual.magicFrames.length===27,'All post-death magic pictures');const ms=magicSource(data,{profile:e.type===136?2:0,spell:29,mask:128}),base=screen(actual.commands[1].screen);for(const [i,f]of actual.magicFrames.entries()){check(f.source===ms.frames[i].raw.toString('hex'),'Original post-death magic frame '+i);check(screen(f.screen).equals(magicSourcePixels(ms.frames[i],base,e.type===136)),'All post-death magic/party/terrain/UI pixels '+i);}check(screen(actual.magicAfter.screen).equals(base),'Exact post-death magic restore');}
 const {m}=deathMachine(data,options);m.c.a=mask;m.call(0xbb0a);const survivor=actual.commands[1].actor-4;m.c.m[0x7e8f]=128>>survivor;m.c.m[0x7e90]=3;m.call(0xa738);m.call(0xaf34);const flashed=residentEnemy({...a.p,initialPpu:Buffer.from(m.ppu.bytes),frames:[]});
 for(const [i,f]of [...actual.postDeathFrames,{screen:actual.commands[1].screen},{screen:actual.magicAfter.screen}].entries()){const visible=screen(f.screen),words=i<actual.postDeathFrames.length&&!(i&1)?flashed.words:a.base.words;for(let y=0;y<88;y++)for(let x=0;x<160;x++){const at=y*160+x;if(!a.owner[at])continue;const color=a.owner[at]&mask?0:words[y*448+x];check(visible.subarray(((y+16)*160+x)*3,((y+16)*160+x+1)*3).equals(rgb(color)),'Survivor flash retains removed slot '+i+'/'+x+','+y);}}

}
check(actual.stack.guard==='a7'.repeat(16)&&actual.stack.untouched>32,'Stack bound');
const effectAudit=death?{membership:freezeMembershipResult(log),dma:restoreDmaResult(log)}:null;
const costLog=[...log.matchAll(/action-cost-retained:([^\r\n]+)/g)].at(-1)?.[1]??'';
const cellCosts=deathAutomatic?[...costLog.matchAll(/action-cost:(\w+),(\d+),(\d+),(\d+)/g)].map(m=>({kind:m[1],ticks:Number(m[2]),rate:Number(m[3]),calls:Number(m[4]),milliseconds:1000*Number(m[2])/Number(m[3])})):[];
if(deathAutomatic)check(cellCosts.some(c=>c.kind==='cell_mask'&&c.calls>0)&&cellCosts.some(c=>c.kind==='cell_tile'&&c.calls>0),'Observed actual cell call intervals');
const clockMatch=[...log.matchAll(/action-clock:(\d+),(\d+),(\d+)/g)].at(-1),clock=clockMatch?{maxCycles:Number(clockMatch[1]),returnMaxCycles:Number(clockMatch[2]),rate:Number(clockMatch[3])}:null;
if(deathAutomatic)check(clock&&clock.returnMaxCycles>0&&clock.returnMaxCycles<clock.rate/2048,'Return timer gap below two periods');
await fs.writeFile(out+'/cell-costs.json',JSON.stringify({romSha256,clock,scope:'Exclusive action intervals; IRQ/audio/transfer/publication take precedence over cell CALL intervals. Repeated kinds are separate actions, in completion order.',costs:cellCosts},null,2));
const report={ailments,stone,stoneUpdates:actual.stoneUpdates?.length??0,stoneMagicPictures:actual.stoneMagicFrames?.length??0,effectAudit,deathAutomatic,magicPictures:actual.magicFrames?.length??0,deathPictures:actual.deathFrames?.length??0,commands:actual.commands.map(({actor,frames,milliseconds,preparations,prepareTicks,maxPrepareTicks,cellPool})=>({actor,frames,milliseconds,preparations,prepareTicks,maxPrepareTicks,cellPool})),stack:actual.stack,romSha256,coreSha256,entry,cycles:actual.entries.map(({before,party,field,screen,...e})=>e),probabilityCalls:rollsCount,screens:files.length,audioTicks:end.ticks,bus,memory,timerDriftRangeUs:(max-min)*1e6,scope:ailments?'Three same-boot encounters with two resolved physical commands and diagnostic canonical poison add/remove on another actor. Source icon IDs/patterns refreshed from current records, continuous audio and diagnostic field returns; not a poison spell or turn-end integration.':stone?'Three natural encounters in one boot with explicit canonical stone states; two original resolved commands, 37 enemy death pictures, survivor flash, two 27-picture magic sequences, diagnostic original effect-22 cure/re-stone/death-priority refresh and field returns. Not a cure/stone spell calculation, normal turn scheduler, confused stone or dense eight-target numeral claim.':death?'Natural dungeon encounters, two explicitly submitted resolved commands with lethal/nonlethal HP and critical interventions; all 37 death pictures, survivor flash/hit, source result records, continuous audio and diagnostic field returns. Gate-held display captures are not automatic action timing. Normal turn collection, rewards, party death/gameover/title and victory return remain separate.':commands?'Natural dungeon encounter plus one explicitly submitted resolved attack: original command/result records, displayed attack/numerals, status commit and audio; diagnostic HP/critical intervention. Same-boot diagnostic returns, not normal turn collection, death/rewards/gameover or victory/escape return.':'Observed reachable post-opening dungeon anchor; unmodified map properties, original rate/RNG/formation/count/entry, live party, cave terrain, same-boot diagnostic return and movement. No title/opening event, combat decisions/results/rewards, or other encounter groups.'};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
