import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';
import {dungeonEntry} from './dungeon-source.mjs';import {encounterEntryOriginal} from './encounter-entry-source.mjs';
import {sourceCommand} from './battle-command-source.mjs';import {sourceResult,R} from './battle-result-source.mjs';
import {nativeReference} from './native-reference.mjs';import {sourceAction} from './engine-fixtures.mjs';
import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';import {screenshotRgb} from './map-pixels.mjs';import {screen} from './battle-screen.mjs';
import {battleCpu} from './battle-placement-source.mjs';import {initializedBattle} from './battle-transition-source.mjs';
import {v6PartyOam,nativePartyTiles} from './battle-party-oam-source.mjs';
const mixed=process.argv.includes('--mixed');
const {data,local}=await input(),dir=ROOT+'/build/scene-dungeon',out=ROOT+'/evidence/'+(mixed?'party-defeat-mixed':'party-defeat'),rom=dir+'/ff3-scene-layout.gbc';await fs.mkdir(out,{recursive:true});
const built=JSON.parse(await fs.readFile(dir+'/report.json')),entry=JSON.parse(await fs.readFile(dir+'/field-entry.json')),bytes=await fs.readFile(rom),romSha256=hash(bytes),coreSha256=hash(await fs.readFile(local.mesenCore));
check(romSha256===built.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Exact dungeon/core artifacts');
for(const [k,v]of Object.entries(dungeonEntry(data)))check(JSON.stringify(entry[k])===JSON.stringify(v),'Source entry '+k);
const all=parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')),layout=checkSceneLayout(all),symbols=Object.fromEntries(Object.entries(all).filter(([k])=>k.startsWith('_')).map(([k,v])=>[k.slice(1),v]));
const config=out+'/config.json',output=out+'/result.json',run=promisify(execFile);let home;
if(process.argv.includes('--reuse')){const old=JSON.parse(await fs.readFile(config));check(old.romSha256===romSha256&&!!old.mixed===mixed,'Fresh mode-specific dungeon evidence');home=old.home;}
else{
 home=await fs.mkdtemp(ROOT+'/.local/mesen-dungeon-');const auditPath=ROOT+'/tools/scene-roundtrip-audit.lua';
 const audit='local sym={'+Object.entries(symbols).filter(([,v])=>v>=0xc000&&v<=0xffff).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(auditPath,'utf8')+'\nlocal encounterPc='+(symbols.ff3_field_encounter&65535)+'\nlocal encounterBank='+(symbols.ff3_field_encounter>>>16)+'\n'+await fs.readFile(ROOT+'/tools/dungeon-audit.lua','utf8')+'\nlocal memoryDmaBegin='+symbols.ff3_text_wram_dma_begin+'\nlocal memoryDmaEnd='+symbols.ff3_text_wram_dma_end+'\n'+await memoryAudit();
 await fs.writeFile(config,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,fieldBytes:layout.fieldBytes,auditPath,audit,output,mixed}));
 const env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
 for(const [args,file]of [[['build',ROOT+'/tools/VerifyDefeat/VerifyDefeat.csproj','-c','Release','--output',out+'/verifier','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log'],[[out+'/verifier/VerifyDefeat.dll',config],'run.log']]){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:1200000,maxBuffer:8e6});await fs.writeFile(out+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+file,(e.stdout||'')+(e.stderr||''));throw e;}}
}

const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.mixed===mixed&&actual.romSha256===romSha256&&actual.boots===1&&actual.entries.length===1,'One boot, matching mode, natural encounter, actual defeat');
const log=await fs.readFile(output+'.audit.log','utf8'),e=actual.entries[0];
function ownedPartyPatterns(expected,actual,state){
 if(!mixed){check(expected.equals(actual),'Source resident normal/dead job patterns');return;}
 // Initial AA00 only owns six dead or eight small-form tiles. The unused
 // tail of an initial slot has no source-defined value and no visible OBJ.
 // Slot 3 entered alive: continue checking its entire resident slot even
 // after death, including the eight tiles not overwritten by the loader.
 for(let i=0;i<4;i++){const s=state[i*64+1],count=i===3?14:s&40?8:s&128?6:14,at=i*224;
  check(expected.subarray(at,at+count*16).equals(actual.subarray(at,at+count*16)),'Source initial graphic owner '+i);
 }
}
if(mixed){const state=Buffer.from(e.party,'hex');check([192,224,200].every((s,i)=>state[258+i*64]===s),'Explicit initial combined status cases');
 const {m}=initializedBattle(data,{formation:e.formation,counts:[...Buffer.from(e.counts,'hex')],back:e.type===136,rows:[0,0,0,0],terrain:8,partyState:state});m.call(0xb469);
 const expected=v6PartyOam(Buffer.from(m.c.m.subarray(0x2a0,0x300)),e.type===136);check(expected.equals(Buffer.from(e.screen.oam,'hex').subarray(32,128)),'Original combined-status entry OAM');
 ownedPartyPatterns(nativePartyTiles(m.ppu.bytes.subarray(0x1010,0x1390)),Buffer.from(e.screen.vram,'hex').subarray(16,0x390),Buffer.from(m.c.m.subarray(0x7575,0x7675)));
}

for(const v of actual.commands){const s=Buffer.from(v.before,'hex'),f=Buffer.from(v.fightBefore,'hex'),cursor=Buffer.from(v.rngBefore,'hex');s[R.actor]=v.actor;f[135]=s[819];
 const original=encounterEntryOriginal(data,e.formation,e.seed,Buffer.from(e.before,'hex')),r=sourceCommand(data,{s,f,counters:[...cursor.subarray(1)]},original.table);check(r.ok,'Source lethal command');const committed=sourceResult(data,r.s,0,r.counters,original.table),after=sourceResult(data,committed.state,4,committed.counters,original.table);
 check(after.state.toString('hex')===v.after,'Original lethal command, status, defeat calculation');check(r.f.toString('hex')===v.fight&&r.call.toString('hex')===v.call,'Original damage/numbers/messages');
 check(Buffer.concat([cursor.subarray(0,1),r.counters]).toString('hex')===v.rngAfter,'Original shared RNG');
 const {m}=initializedBattle(data,{formation:e.formation,counts:[...Buffer.from(e.counts,'hex')],back:e.type===136,rows:[0,0,0,0],terrain:8,partyState:Buffer.from(v.canonical,'hex')}),c=m.c;m.call(0xb469);c.m.set(after.state.subarray(0,768),0x7575);c.banks=[0x34,0x35,0x3e,0x3f];c.m.set([0x75,0x75],0x5b);c.call(0x9d06);c.banks=[0x2e,0x2f,0x3e,0x3f];c.call(0x9e80);m.call(0xb5b8);
 const oam=v6PartyOam(Buffer.from(c.m.subarray(0x2a0,0x300)),e.type===136),native=Buffer.from(v.screen.oam,'hex');check(oam.equals(native.subarray(32,128)),'Source complete party death OAM');
 const chr=nativePartyTiles(m.ppu.bytes.subarray(0x1010,0x1390));ownedPartyPatterns(chr,Buffer.from(v.screen.vram,'hex').subarray(16,0x390),after.state);
}
for(const level of [1,2,3,4])check(actual.fadeFrames.some(f=>f.level===level),'Every original fade step '+level);
check(actual.commands.length>=(mixed?1:4)&&Buffer.from(actual.commands.at(-1).after,'hex')[R.result]===128,'Defeat after fourth incapacitated member');
const inv=battleCpu(data,0x18),bag=Buffer.from(actual.inventoryBefore,'hex');for(let i=0;i<32;i++){inv.m[0x60c0+i*2]=bag[i];inv.m[0x60c1+i*2]=bag[32+i];}inv.call(0xbebf);const inventory=Buffer.alloc(64);for(let i=0;i<32;i++){inventory[i]=inv.m[0x60c0+i*2];inventory[i+32]=inv.m[0x60c1+i*2];}check(inventory.toString('hex')===actual.inventoryAfter,'Original end inventory consolidation');
const last=Buffer.from(actual.audio.at(-1).consumed,'hex'),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{plan:[],ticks:last.readUInt32LE(0)+32,beforeTick(c,t){for(const r of actual.requests)if(r.tick===t)sourceAction(c,r.op,r.arg);}});let end,base;
const baseEvents=Buffer.from(actual.audioBase,'hex').readUInt32LE(4);
for(const a of actual.audio){const b=Buffer.from(a.consumed,'hex'),n=b.readUInt32LE(4);if(n){end=ref.advanceToEvent(n);if(n===baseEvents)base={...end};check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Original live audio stream');}}
const bus=[...log.matchAll(/roundtrip-bus:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(bus&&bus[0]>0&&bus[2]>0&&[1,3,5,8].every(i=>bus[i]===0),'Safe video/audio bus');check(base&&bus[6]===end.gbWrites-base.gbWrites&&bus[7]===end.gbHash,'Every actual APU write since observer attachment');const memory=checkMemoryAudit(log);
const timed=actual.audio.filter(a=>Buffer.from(a.consumed,'hex').readUInt32LE(4)>0);let elapsed=0,previousTimer=timed[0].timer,min=0,max=0;for(const a of timed){elapsed+=(a.timer-previousTimer)&65535;previousTimer=a.timer;const drift=elapsed/4096-(a.master-timed[0].master)/a.rate;min=Math.min(min,drift);max=Math.max(max,drift);}check(max-min<0.0005,'Continuous hardware audio timer');

const files=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),screens=[actual.entries[0],...actual.commands,...actual.shots.slice(1)];check(files.length===screens.length+1,'All defeat screenshots');
const expectedScreens=screens.map(s=>({pixels:screen(s.screen),label:s.label}));for(let i=1;i<files.length;i++){const shot=screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[i])),at=expectedScreens.findIndex(s=>s.pixels.equals(shot));check(at>=0,'Native full picture '+i);if(expectedScreens[at].label)await fs.copyFile(home+'/Screenshots/'+files[i],out+'/'+expectedScreens[at].label+'.png');expectedScreens.splice(at,1);}check(!expectedScreens.length,'Every complete native picture matched');
const restart=actual.shots.find(s=>s.label==='restart');check(restart,'Captured restart menu');
const assetSource=await fs.readFile(dir+'/generated/restart126.c','utf8'),assets=Object.fromEntries([...assetSource.matchAll(/const uint8_t (\w+)\[\]=\{([0-9,]*)\}/g)].map(m=>[m[1],Buffer.from(m[2].split(',').map(Number))]));
const menuVram=Buffer.from(restart.screen.vram,'hex');check(menuVram.subarray(0,assets.restart_tiles.length).equals(assets.restart_tiles),'Native original-frame/Korean restart tiles');
for(let row=0;row<18;row++){check(menuVram.subarray(0x1800+row*32,0x1800+row*32+20).equals(assets.restart_map.subarray(row*20,row*20+20)),'Published restart map row '+row);check(menuVram.subarray(0x3800+row*32,0x3800+row*32+20).every(x=>x===0),'Restart map uses palette zero');}
check(menuVram.subarray(0xdc0,0xdc0+assets.restart_cursor_tiles.length).equals(assets.restart_cursor_tiles),'Whole source restart hand dots');
check(Buffer.from(restart.screen.bgPalette,'hex').subarray(0,8).equals(assets.restart_palette),'Published original restart palette');
check(actual.requests.some(r=>r.op===2&&r.arg===19)&&actual.requests.at(-1).op===2&&actual.requests.at(-1).arg===1,'Requiem then prelude requests');
check(actual.stack.untouched>32&&actual.stack.guard==='a7'.repeat(16),'Stack and owner guard');
const report={romSha256,home,mixed,commands:actual.commands.length,sourceArithmetic:true,sourcePartyDots:true,fadeVblanks:actual.defeatFrames,fullPictures:screens.length,audio:{ticks:end.ticks,gbWrites:bus[6],timerDriftMs:(max-min)*1000,underruns:0},memory,stack:actual.stack,scope:'Natural encounter; explicit forced 1 HP/high attack diagnostic, actual command/death/defeat runtime; blank-save restart screen boundary. Not a complete turn scheduler/save selection.'};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
