import {deathAssets} from './death-assets.mjs';
import {restartAssets} from './battle-restart-source.mjs';
import {encounterScreenAssets} from './encounter-screen-assets.mjs';
import {checkEncounterAssets} from './field-encounter-source.mjs';
import {livePartyAssets} from './live-party-source.mjs';
import {liveCommandAssets} from './live-command-assets.mjs';
import {liveUiAssets} from './battle-live-ui.mjs';
import {dungeonEntry} from './dungeon-source.mjs';
import {makeMapAssets} from './map-assets.mjs';
import {explorationAssets} from './exploration-assets.mjs';
import {makeObjectAssets} from './object-assets.mjs';
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check,checkGbc} from './source.mjs';
import {commonModules,fieldModules,battleModules,overlayBase,relocateField,parseSymbols,checkSceneLayout} from './scene-link-layout.mjs';
const dungeon=process.argv.includes('--dungeon');
const {data,local}=await input(),out=ROOT+'/build/'+(dungeon?'scene-dungeon':'scene-layout'),gen=out+'/generated',field=ROOT+'/build/exploration',battle=ROOT+'/build/battle-effects';await fs.mkdir(gen,{recursive:true});
const run=promisify(execFile),compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');
const evidence=[];for(const [dir,name,key]of [[field,'ff3-exploration','romSha256'],[battle,'ff3-battle-effects-video','videoRomSha256']]){const r=JSON.parse(await fs.readFile(dir+'/report.json')),rom=await fs.readFile(dir+'/'+name+'.gbc');check(hash(rom)===r[key],'Input diagnostic identity');evidence.push({name,sha256:r[key]});}
// Common generated headers must agree except the original audio diagnostic
// request schedule: use the battle schedule and keep FIELD_SONG separately.
for(const dir of [field,battle])for(const name of (await fs.readdir(dir+'/generated')).filter(n=>n.endsWith('.h'))){const bytes=await fs.readFile(dir+'/generated/'+name);try{const prior=await fs.readFile(gen+'/'+name);if(dir===battle&&await fs.stat(field+'/generated/'+name).catch(()=>null))check(name==='native-assets.h'||prior.equals(bytes),'Conflicting shared header '+name);}catch(e){if(e.code!=='ENOENT')throw e;}await fs.writeFile(gen+'/'+name,bytes);}
const directory=await fs.readFile(field+'/generated/asset-directory.h','utf8'),array=name=>directory.match(new RegExp(name+'\\[\\]=\\{([0-9,]+)\\}'))?.[1].split(',').map(Number);
let dungeonReport;
if(dungeon){
 const entry=dungeonEntry(data),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false});
 assets.dialogue={diagnostic:{world:entry.world,map:entry.map}};
 const scene=explorationAssets(data,assets,entry.song,{dungeon:true});dungeonReport={...scene.report,...entry};
 await fs.writeFile(gen+'/exploration-config.h',scene.config+'#define FIELD_NATIVE_ENCOUNTERS 1\n');await fs.writeFile(gen+'/exploration-art.h',scene.art);
 let header=await fs.readFile(gen+'/dialogue-config.h','utf8');for(const [name,value]of Object.entries({MAP:entry.map,X:entry.start[0],Y:entry.start[1]}))header=header.replace(new RegExp('(#define DIALOGUE_'+name+' )\\d+u'),'$1'+value+'u');await fs.writeFile(gen+'/dialogue-config.h',header);
 await fs.writeFile(out+'/field-entry.json',JSON.stringify(dungeonReport,null,2));
}
const counts=array('asset_counts'),offsets=array('asset_offsets'),present=array('asset_present');check(counts&&offsets&&present,'Field catalog syntax');
const original=await fs.readFile(field+'/ff3-exploration.gbc'),banks=new Map();present.forEach((v,i)=>{if(v)banks.set(i,original.subarray(i*16384,(i+1)*16384));});
const relocated=relocateField(banks,counts,offsets),generated=[];
generated.push(await restartAssets(data,local.text,gen));
for(const [bank,bytes]of relocated.banks){const file=gen+'/field-bank'+bank+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\nconst uint8_t field_bank'+bank+'[]={'+[...bytes]+'};\n');generated.push(file);}
const presentBits=Array.from({length:16},(_,i)=>Array.from({length:8},(_,b)=>+relocated.banks.has(i*8+b)<<b).reduce((a,b)=>a|b,0));
await fs.writeFile(gen+'/asset-directory.h',directory.replace(/#define ASSET_BANKS \d+u/,'#define ASSET_BANKS 128u').replace(/asset_present\[\]=\{[0-9,]+\}/,'asset_present_bits[]={'+presentBits+'}'));
const mr=JSON.parse(await fs.readFile(battle+'/magic-residency.json'));
const partyResources=livePartyAssets(data);
await fs.writeFile(gen+'/live-party-assets.h','#include <stdint.h>\n'+Object.keys(partyResources).map(n=>'extern const uint8_t '+n+'[];').join('\n')+'\n');
for(const bank of [15,78]){const file=gen+'/live-party'+bank+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\n'+Object.entries(partyResources).filter(([n])=>(n==='equipment_properties')===(bank===15)).map(([n,b])=>'const uint8_t '+n+'[]={'+[...b]+'};').join('\n'));generated.push(file);}
generated.push(...await encounterScreenAssets(data,gen,battle,{map:dungeon?181:29,maps:dungeon?[181,111,115,112,22,113]:[29]}));
generated.push(...await deathAssets(data,gen,JSON.parse(await fs.readFile(out+'/encounter-resources.json')).profiles));
generated.push(...await liveCommandAssets(data,gen,JSON.parse(await fs.readFile(out+'/encounter-resources.json')).profiles));
// Bind current reviewed strings, rather than inheriting the older standalone
// diagnostic's small message dictionary. Source IDs remain runtime inputs.
const ui=await liveUiAssets(data,local.text),uiArrays={boxes:ui.boxes,glyphs:ui.glyphs,hp_glyphs:ui.hpGlyphs,advances:ui.advances,seed:ui.seed,rect:ui.rect,palette:ui.palette,message_index:ui.message_index,message_words:ui.message_words,message_types:ui.message_types};
await fs.writeFile(gen+'/live-ui.c','#pragma bank 43\n#include <stdint.h>\n'+Object.entries(uiArrays).map(([k,b])=>'const uint8_t live_ui_'+k+'[]={'+[...b]+'};').join('\n'));generated.push(gen+'/live-ui.c');
await fs.writeFile(gen+'/live-ui-assets.h','#define LIVE_UI_GLYPHS '+ui.glyphCount+'\n#define LIVE_MESSAGE_DIGIT 1\n#define LIVE_MESSAGE_SLASH 11\n#define LIVE_MESSAGE_COUNT '+ui.messageCount+'\n'+Object.keys(uiArrays).map(k=>'extern const uint8_t live_ui_'+k+'[];').join('\n'));
for(const name of [...[1,2,3,4,5,6,8].map(i=>'audio-bank'+i),'strike53',...Array.from({length:4},(_,i)=>['party','resident','terrain','hit'].map(k=>k+i)).flat(),...mr.banks.map((_,i)=>'magic'+i)])generated.push(battle+'/generated/'+name+'.c');
const flags=['-msm83:gb','-DFF3_SCENE_LAYOUT','-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO','-DFF3_EXPLORATION','-DFF3_EFFECTS','-DFF3_AUDIO_FAST','-DFF3_LIVE_UI','-DFF3_STATUS_VIDEO','-DFF3_TERRAIN','-DFF3_RESIDENT_BG','-DFF3_COMPOSITION_CACHE','-Dcache_request=party_work','-I'+gen,'-I'+ROOT+'/src'];
async function compile(args,name){try{const r=await run(compiler,args,{cwd:out,maxBuffer:8e6,timeout:600000});await fs.writeFile(out+'/'+name+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/'+name+'.log',(e.stdout||'')+(e.stderr||''));throw e;}}
async function config(f,b){await fs.writeFile(gen+'/scene-layout-config.h','#define FF3_SCENE_ARENA '+overlayBase+'u\n#define FF3_FIELD_DATA_BYTES '+f+'u\n#define FF3_BATTLE_DATA_BYTES '+b+'u\n');}
await config(1,1);
const entries=[...commonModules.map(n=>[n,null]),...fieldModules.map(n=>[n,'FF3_FIELD']),...battleModules.map(n=>[n,'FF3_BATTLE']),['scene-layout-probe',null]],objects=[];
const inputPaths=[...entries.map(([name])=>'src/'+name+'.c'),...(await fs.readdir(ROOT+'/src')).filter(n=>/\.(h|inc)$/.test(n)).map(n=>'src/'+n),...(await fs.readdir(gen)).filter(n=>n.endsWith('.h')&&n!=='scene-layout-config.h').map(n=>gen.slice(ROOT.length+1)+'/'+n),...generated.map(p=>p.slice(ROOT.length+1))];
const inputs=[];for(const path of inputPaths)inputs.push({path,sha256:hash(await fs.readFile(ROOT+'/'+path))});
async function object([name,segment]){const obj=out+'/'+name+'.o',extra=segment?['-Wf--dataseg','-Wf'+segment]:[];
 if(name==='exploration-viewer')extra.push('-Dmain=field_legacy_main','-Wf-bo72');if(name==='battle-party-video')extra.push('-Dmain=battle_legacy_main','-Wf-bo73');
 await compile([...flags,...extra,'-c','-o',obj,ROOT+'/src/'+name+'.c'],name);return obj;
}
for(let i=0;i<entries.length;i+=4){const r=await Promise.allSettled(entries.slice(i,i+4).map(object));for(const v of r){if(v.status!=='fulfilled')throw v.reason;objects.push(v.value);}}
const rom=out+'/ff3-scene-layout.gbc';
async function link(){await compile([...flags,'-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo256','-Wl-m','-Wl-j','-Wl-b_FF3_FIELD='+overlayBase,'-Wl-b_FF3_BATTLE='+overlayBase,'-o',rom,...objects,...generated],'link');return parseSymbols(await fs.readFile(rom.replace('.gbc','.noi'),'utf8'));}
let s=await link();const layout=checkSceneLayout(s);await config(layout.fieldBytes,layout.battleBytes);
await object(['scene-memory',null]);await object(['scene-layout-probe',null]);s=await link();check(JSON.stringify(checkSceneLayout(s))===JSON.stringify(layout),'Stable final layout');
check(!/overflow|Multiple write|undefined global/i.test(await fs.readFile(out+'/link.log','utf8')),'Clean final linker output');const bytes=await fs.readFile(rom);checkGbc(bytes,256,0x1b,3);
for(const [bank,data]of relocated.banks)check(bytes.subarray(bank*16384,(bank+1)*16384).equals(data),'Linked relocated field bytes '+bank);
checkEncounterAssets(bytes,s,data);
// Direct cell calls are safe only while their display owner and kernels
// share the selected code bank. Never silently relocate just one side.
for(const name of ['ff3_enemy_build','ff3_cell_mask_local','ff3_cell_pool_tile_local'])check((s['_'+name]>>>16)===124,'Same-bank cell kernel '+name);
for(const [name,address]of Object.entries(s))if(/^_encounter_patterns\d+$/.test(name))check((address&15)===0,'DMA-aligned encounter patterns '+name);
// Every generated battle/audio array remains intact at its linked symbol.
let arrays=0;for(const file of generated.filter(p=>!p.startsWith(gen+'/field-'))){const source=await fs.readFile(file,'utf8');for(const m of source.matchAll(/const uint8_t (\w+)\[\]=\{([0-9,]*)\}/g)){const data=Buffer.from(m[2].split(',').filter(Boolean).map(Number)),at=s['_'+m[1]],offset=(at>>>16)*16384+(at&0x3fff);check(Number.isInteger(at)&&bytes.subarray(offset,offset+data.length).equals(data),'Linked original asset '+m[1]);arrays++;}}
for(const i of inputs)check(hash(await fs.readFile(ROOT+'/'+i.path))===i.sha256,'Source changed during build '+i.path);
const report={dungeonEntry:dungeonReport,scope:'Combined real field/effects modules with cold diagnostics and mode 4 controlled display / mode 5 canonical-party / mode 6 selected-encounter resource roundtrips. Mode 6 defaults to approved live field/audio seed; natural map/action/result bridge remains pending.',romSha256:hash(bytes),evidence,layout,relocation:{entries:relocated.entries,changedBytes:relocated.changedBytes,payloads:relocated.payloads},linkedBattleArrays:arrays,inputs,roundtripReady:false,controlledRoundtripMode:4,controlledLivePartyMode:5,controlledEncounterMode:6};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await fs.copyFile(battle+'/conversion.bin',out+'/conversion.bin');await fs.writeFile(out+'/audio.json',JSON.stringify(JSON.parse(await fs.readFile(battle+'/report.json')).audio));console.log(JSON.stringify({...report,inputs:inputs.length,relocation:{entries:relocated.entries,payloadBanks:relocated.payloads.length}},null,2));
