import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';
import {sourceInitialState} from './state-source.mjs';import {livePartyOriginal} from './live-party-source.mjs';
import {encounterEntryOriginal,encounterWeaponOriginal} from './encounter-entry-source.mjs';import {encounterOriginal} from './field-encounter-source.mjs';
import {animationSeed} from './battle-animation-source.mjs';import {scriptSeed} from './battle-script-source.mjs';
import {itemEligibility} from './battle-item-use-source.mjs';import {partyEntryOracle} from './battle-party-oam-source.mjs';
import {residentEnemy} from './battle-resident-bg.mjs';import {screen} from './battle-screen.mjs';import {screenshotRgb} from './map-pixels.mjs';
import {nativeReference} from './native-reference.mjs';import {sourceAction} from './engine-fixtures.mjs';
import {memoryAudit,checkMemoryAudit} from './memory-audit.mjs';
import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';import {addTextAssets} from './korean-text.mjs';import {prepareDialogue} from './dialogue-build.mjs';
import {fieldPixels} from './exploration-pixels.mjs';import {windowRgb,textPage} from './text-reference.mjs';import {expandDialogue} from './dialogue-reference.mjs';
import {numeralReference} from './battle-numerals-source.mjs';
import {strikeSliceAnchor,strikeImpactAnchor} from './battle-strike-assets.mjs';
const {data,local}=await input(),dir=ROOT+'/build/scene-layout',out=ROOT+'/evidence/encounter-roundtrip',rom=dir+'/ff3-scene-layout.gbc';await fs.mkdir(out,{recursive:true});
const built=JSON.parse(await fs.readFile(dir+'/report.json')),catalog=JSON.parse(await fs.readFile(dir+'/encounter-resources.json')),bytes=await fs.readFile(rom),romSha256=hash(bytes),coreSha256=hash(await fs.readFile(local.mesenCore));check(romSha256===built.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Exact artifacts');
const all=parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8'));checkSceneLayout(all);const symbols=Object.fromEntries(Object.entries(all).filter(([k])=>k.startsWith('_')).map(([k,v])=>[k.slice(1),v]));
const cases=[],entries=[],states=[],original=[];const at=(b,c)=>16+b*8192+(c&8191);
for(const [formation,seed]of [[0,255],[0,254],[0,253],[1,255],[1,248],[1,251],[1,253]]){
 const k=cases.length,state=sourceInitialState(data),job=k,actor=0;
 for(let i=0;i<4;i++){state[256+i*64]=(job+i)%22;state[257+i*64]=k?1+k*3+i:0;state.fill(0,512+i*64,515+i*64);state[527+i*64]=i&1;state.writeUInt16LE(1234+i*37,268+i*64);state.writeUInt16LE(5678+i,270+i*64);}
 const allowed=Array.from({length:88},(_,id)=>id).filter(id=>[1,2].includes(data[at(0x2e,0x9098)+id*3])&&itemEligibility(data,id,job));
 if(job===6&&!allowed.length)allowed.push(0);check(allowed.length,'Source-compatible weapon for current job '+job);const right=allowed[k%allowed.length],left=k&1?allowed[(k+1)%allowed.length]:0;state[515]=right;state[517]=left;
 const entry=encounterEntryOriginal(data,formation,seed,state),profile=catalog.profiles.find(p=>p.key[0]===formation&&p.key[5]===+(entry.type===136)&&p.key.slice(1,5).join()===entry.counts.join());check(profile,'Exact runtime key');
 const target=entry.types.findLastIndex(t=>t!==255),hits=[2,left?3:0],animation=animationSeed(4,{flags:64,attacker:128>>actor,targets:128>>target,hits,types:entry.types});animation.writeUInt16LE(9999,48+target*2);
 if(k===6)for(let i=0;i<8;i++)if(entry.types[i]!==255)animation.writeUInt16LE(9999,48+i*2);
 const derived=livePartyOriginal(data,state);let formationCursor;
 for(let c=0;c<256;c++){const slot=data[at(0x3d,0xbd78)+(data[at(0x3f,0xfe00)+((c+1)&255)]&63)];if(data[at(0x2e,0x94f0)+catalog.group*8+slot]===formation){formationCursor=c;break;}}check(formationCursor!==undefined,'Reachable source group slot');
 const test={formation,seed,formationCursor,profile:profile.profile,counts:Buffer.from(entry.counts).toString('hex'),type:entry.type,first:entry.first,rng:entry.rng.toString('hex'),monsters:Buffer.from([...entry.types,...entry.ids]).toString('hex'),actor,target,hits,weapons:Buffer.from([right,left]).toString('hex'),party:state.subarray(256,768).toString('hex'),derived:derived.state.subarray(256,768).toString('hex'),records:derived.records.toString('hex'),animation:animation.toString('hex'),script:scriptSeed(0,{speed:8,effect:4,result:2,messages:[]}).toString('hex')};
 cases.push(test);entries.push(entry);states.push(state);original.push(encounterWeaponOriginal(data,test,state,entry));
}
check(new Set(cases.map(c=>c.formation+':'+c.counts)).size===7,'All current-group count combinations');
const config=out+'/config.json',output=out+'/result.json',run=promisify(execFile);let home;
if(process.argv.includes('--reuse')){const old=JSON.parse(await fs.readFile(config));check(old.romSha256===romSha256&&JSON.stringify(old.cases)===JSON.stringify(cases),'Fresh encounter evidence');home=old.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-encounter-');const auditPath=ROOT+'/tools/scene-roundtrip-audit.lua';await fs.writeFile(config,JSON.stringify({encounterMode:true,liveParty:true,dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,cases,output,auditPath,audit:'local sym={'+Object.entries(symbols).filter(([,v])=>v>=0xc000&&v<=0xffff).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(auditPath,'utf8')+'\nlocal memoryDmaBegin='+symbols.ff3_text_wram_dma_begin+'\nlocal memoryDmaEnd='+symbols.ff3_text_wram_dma_end+'\n'+await memoryAudit()}));
 const env={...process.env,APPDATA:ROOT+'/.local/config',DOTNET_CLI_HOME:ROOT+'/.local/dotnet',DOTNET_CLI_TELEMETRY_OPTOUT:'1'};
 for(const [args,file]of [[['build',ROOT+'/tools/VerifySceneRoundtrip/VerifySceneRoundtrip.csproj','-c','Release','--output',out+'/verifier','--configfile',ROOT+'/tools/Capture/NuGet.Config'],'build.log'],[[out+'/verifier/VerifySceneRoundtrip.dll',config],'run.log']]){try{const r=await run(local.dotnet,args,{cwd:ROOT,env,timeout:1200000,maxBuffer:8e6});await fs.writeFile(out+'/'+file,r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+file,(e.stdout||'')+(e.stderr||''));throw e;}}
}
const actual=JSON.parse(await fs.readFile(output));check(actual.done&&actual.romSha256===romSha256&&actual.boots===1&&actual.cycles.length===7,'Single-boot encounter roundtrips');
for(const e of actual.encounters){const seed=Buffer.from(e.seed,'hex'),selected=Buffer.from(e.selected,'hex');seed[17]=0;const expected=encounterOriginal(data,16,encounterOriginal(data,14,seed));for(const i of [10,14,15,76,77,78])check(selected[i]===expected[i],'Original field encounter '+e.cycle+'/'+i);check(selected[16]===4&&selected[2]===0&&selected[3]===0&&selected[5]===0,'Complete tile before battle');}
const audio=JSON.parse(await fs.readFile(dir+'/audio.json')),ref=nativeReference(data,await fs.readFile(dir+'/conversion.bin'),{ticks:audio.ticks,plan:audio.plan,beforeTick(c,t){for(const r of actual.requests)if(r.tick===t)sourceAction(c,r.op,r.arg);}});let end;
for(const f of actual.audio){const b=Buffer.from(f.consumed,'hex'),n=b.readUInt32LE(4);if(n){end=ref.advanceToEvent(n);check(end.ticks===b.readUInt32LE(0)&&end.sourceHash===b.readUInt16LE(8)&&end.gbHash===b.readUInt16LE(10),'Original dynamic audio stream');}}
check(end?.ticks===7200,'Full audio schedule');const log=await fs.readFile(output+'.audit.log','utf8'),bus=[...log.matchAll(/roundtrip-bus:([\d,]+)/g)].at(-1)?.[1].split(',').map(Number);check(bus&&bus[0]>0&&bus[2]>0&&[1,3,5,8].every(i=>bus[i]===0),'Video/audio bus safety');
let finalHash=end.gbHash;for(const r of [2,7,12,17])finalHash=(((finalHash<<1)|(finalHash>>15))^((r<<8)|0))&65535;check(bus[6]===end.gbWrites+4&&bus[7]===finalHash,'Every actual APU write');
const memory=checkMemoryAudit(log),body=Array(7).fill(0),numbers=Array(7).fill(0),files=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.dialogue,{verify:false});await prepareDialogue(data,assets,local.dialogue);const fieldReport=JSON.parse(await fs.readFile(ROOT+'/build/exploration/report.json'));
const get=(name,start,length)=>{const a=symbols[name],offset=(a>>>16)*16384+(a&16383);return bytes.subarray(offset+start,offset+start+length);};
const numeralFrames=cases.map(c=>{const seed=Buffer.from(get('effect_seeds',c.profile*96,96));Buffer.from(c.animation,'hex').copy(seed,0,48,64);return numeralReference(data,seed);});
const ordered=[actual.shots[0]];let si=1,pi=0;for(let k=0;k<7;k++){ordered.push(actual.shots[si++]);while(pi<actual.pictures.length&&actual.pictures[pi].cycle===k)ordered.push(actual.pictures[pi++]);for(let i=0;i<3;i++)ordered.push(actual.shots[si++]);}check(ordered.length===files.length,'Every screenshot');
for(const [i,p]of ordered.entries()){
 let expected;if(p.label){expected=fieldPixels(data,assets,fieldReport,p);if(p.visible){const d=assets.dialogue.diagnostic,page=textPage(expandDialogue(assets,p.textId,{names:d.names,shown:0,gil:0,variable:0,item:166}),0);expected=windowRgb(expected,page,assets.text.glyphs);}}
 else{expected=screen(p.screen);const k=p.cycle,c=cases[k];
  if(p.owner===0){const source=partyEntryOracle(data,{formation:c.formation,counts:entries[k].counts,back:entries[k].type===136}),bg=residentEnemy({...source,enemyYOffsets:c.formation===0?[-4,-6]:undefined});for(let y=16;y<104;y++)for(let x=0;x<112;x++){const v=bg.words[(y-16)*448+x],r=v&31,g=v>>5&31,b=v>>10,rgb=[Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)];check(expected.subarray((y*160+x)*3,(y*160+x+1)*3).equals(Buffer.from(rgb)),'Selected enemy pixels '+k+'/'+x+','+y);}}
  else if(p.owner===28){const frame=numeralFrames[k][numbers[k]++];check(frame&&frame.oam.equals(Buffer.from(p.source,'hex')),'All source damage number dots');
   const seed=get('effect_seeds',c.profile*96,96),anchors=get('effect_anchors',c.profile*16,16),glyphs=get('effect_tiles',0,528),prefix=[];let group=0;
   for(let slot=0;slot<8;slot++){if(seed[16+slot]===255)continue;const q=frame.oam.subarray(group++*16,group*16),y=Math.max(0,Math.min(136,anchors[slot*2+1]+q[0]-seed[32+slot]));
    for(let d=0;d<4;d++){const t=q[d*4+1];if(!t||q[d*4]>=239)continue;prefix.push(y+16,anchors[slot*2]+d*8+8,223+t-0x56,3);}
   }
   check(Buffer.from(p.screen.oam,'hex').subarray(0,prefix.length).equals(Buffer.from(prefix)),'All native damage glyphs and selected-enemy positions');
   check(Buffer.from(p.screen.vram,'hex').subarray(223*16,256*16).equals(glyphs)&&Buffer.from(p.screen.objPalette,'hex').subarray(24,32).equals(get('effect_palette',0,8)),'Unchanged numeral tiles and palette');
  }
  else if(p.weaponPicture){const f=original[k].frames[body[k]++];check(f&&f.oam.equals(Buffer.from(p.source,'hex')),'Source weapon motion '+k+'/'+body[k]);check(Buffer.from(p.screen.vram,'hex').subarray(0x390,0x590).equals(f.tiles),'Current job and equipped weapon graphics');check(Buffer.from(p.screen.objPalette,'hex').subarray(24,32).equals(f.palette),'Current weapon palette');check(p.weapons===c.weapons,'Live canonical equipment IDs');
   const back=entries[k].type===136,kind=data[at(0x2e,0x9098)+Buffer.from(c.weapons,'hex')[f.hand]*3],prefix=[],add=(q,dx,dy)=>{if(!q[1]||q[0]>=239)return;const x=q[3]+dx,y=q[0]+dy;check(x>=0&&x<=152&&y>=0&&y<=136,'Whole effect glyph');prefix.push(y+16,x+8,q[1],(q[2]&3)|((q[2]&64)>>1)|((q[2]&128)>>1));};
   for(let n=0;n<10;n++)add(f.oam.subarray(n*4,n*4+4),back?-16:-80,-33-c.actor*4);
   const [sx,sy]=entries[k].placement.slots[c.target].center,[gx,oldY]=(kind===1?strikeSliceAnchor:strikeImpactAnchor)(sx,sy,back),gy=Math.max(15,Math.min(kind===1?111:116,oldY+(c.formation===0?[-4,-6][c.target&1]:0)));
   let dx=gx-(back?255-sx:sx),dy=gy-sy+1;if(kind!==1){const [hx,hy]=f.point,rx=Math.floor(((hx-sx)&255)*7/8),ry=Math.floor(((hy-sy)&255)*7/8);dx=gx+(back?-rx:rx)-(back?255-hx:hx);dy=gy+ry-hy+1;}
   for(let n=10;n<(kind===1?22:14);n++)add(f.oam.subarray(n*4,n*4+4),dx,dy);
   check(Buffer.from(p.screen.oam,'hex').subarray(0,prefix.length).equals(Buffer.from(prefix)),'Source effects follow the selected scaled enemy');
  }
 }
 check(screenshotRgb(await fs.readFile(home+'/Screenshots/'+files[i])).equals(expected),'Actual hardware screenshot '+i);
}
check(body.every((n,i)=>n===original[i].frames.length)&&numbers.every(n=>n===32),'Complete weapon and number playback');for(const a of actual.actions)check(a.weapons===cases[a.cycle].weapons&&a.rng===original[a.cycle].rng.toString('hex'),'Post-action shared RNG and weapons');
check(Buffer.from(actual.requests.filter(r=>r.op!==2).map(r=>r.op===8?255:r.arg|128)).equals(Buffer.from(original.flatMap(r=>r.sounds))),'Every source weapon effect request');
let accumulated=0,previous=actual.audio[0].timer,min=0,max=0;const first=actual.audio[0];for(const a of actual.audio){accumulated+=(a.timer-previous)&65535;previous=a.timer;const drift=accumulated/4096-(a.master-first.master)/a.rate;min=Math.min(min,drift);max=Math.max(max,drift);}check(max-min<0.0005,'Timer continuity');check(actual.stack.guard==='a7'.repeat(16)&&actual.stack.untouched>32,'Stack bound');
const report={romSha256,coreSha256,cycles:actual.cycles,formations:catalog.formations,countCombinations:7,sourceBodyFrames:body,numberFrames:numbers,screens:files.length,audioTicks:end.ticks,audioObservations:actual.audio.length,bus,memory,stack:actual.stack,timerDriftRangeUs:(max-min)*1e6,scope:'Controlled eligible tile/rate and explicit FC27 seed; real field formation selection, original count/entry rules, current party equipment/job resources, source weapon and number sequence, same-boot field return/movement/dialogue. Not natural map reachability, complete NES ZP seeding, action selection/damage/results, or all encounter groups.'};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
