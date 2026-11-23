import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';
import {makeMapAssets,packMapAssets} from './map-assets.mjs';
import {makeObjectAssets} from './object-assets.mjs';
import {addTextAssets,textKinds} from './korean-text.mjs';
import {prepareDialogue,dialogueKinds} from './dialogue-build.mjs';
import {stateAssets} from './state-source.mjs';
import {textAudioAssets} from './text-audio-assets.mjs';
import {explorationAssets} from './exploration-assets.mjs';
const explore=process.argv.includes('--explore'),audio=explore||process.argv.includes('--audio'),mode=audio||process.argv.includes('--dialogue');
const {data,profile,local}=await input(),out=ROOT+'/build/'+(explore?'exploration':audio?'dialogue-audio':mode?'dialogue':'text'),gen=out+'/generated';
await fs.mkdir(gen,{recursive:true});await fs.mkdir(ROOT+'/.local/compiler-tmp',{recursive:true});
const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data)),mode?local.dialogue:local.text),sources=[];
if(mode)await fs.writeFile(gen+'/dialogue-config.h',await prepareDialogue(data,assets,local.dialogue));
const sound=audio?await textAudioAssets(data,gen,out,assets.groups.properties[assets.dialogue.diagnostic.map+(assets.dialogue.diagnostic.world?256:0)][10]):undefined;
if(sound)sources.push(...sound.sources);
const field=explore?explorationAssets(data,assets,sound.report.mapSong):undefined;
if(field){await fs.writeFile(gen+'/exploration-config.h',field.config);await fs.writeFile(gen+'/exploration-art.h',field.art);}
const fixtureWords=[[1,9,20,17,0x8080,0],[2,0],[20,18,0],[0x8fff,0],[0x8080],[6,11,14,35,123,0x8081,0],[0x8001,0]];
fixtureWords.push([0x8082,10], [...Array.from({length:2350},(_,i)=>0x8100+i),0]);
if(audio)fixtureWords.push([...Array.from({length:6},(_,y)=>[...Array.from({length:18},(_,x)=>0x8100+y*18+x),...(y<5?[9]:[])]).flat(),0]);
assets.text.fixtureStart=assets.groups.koreanText.length;
for(const words of fixtureWords){const b=Buffer.alloc(words.length*2);words.forEach((w,i)=>b.writeUInt16LE(w,i*2));const id=assets.groups.koreanText.length;assets.groups.koreanText.push(b);assets.provenance.push({kind:'koreanText',id,bytes:b.length,sha256:hash(b),source:'Project-authored diagnostic control/font fixtures; not original game messages',consumer:'tools/verify-text.mjs'});}
const pack=packMapAssets(assets,mode?dialogueKinds:textKinds);
await fs.writeFile(gen+'/text-config.h','#define TEXT_SAMPLES '+assets.text.sourceIds.length+'u\nstatic const uint16_t text_source_ids[]={'+assets.text.sourceIds.join(',')+'};\n');
await fs.writeFile(out+'/text-analysis.json',JSON.stringify(assets.text,(k,v)=>k==='glyphs'?undefined:v,2));
for(const [bank,bytes]of pack.banks){
 const path=gen+'/text-bank'+bank+'.c';
 await fs.writeFile(path,'#pragma bank '+bank+'\n#include <stdint.h>\nconst uint8_t text_bank'+bank+'[]={'+[...bytes].join(',')+'};\n');sources.push(path);
}
await fs.writeFile(gen+'/asset-directory.h','#define ASSET_KINDS '+pack.groups.length+'u\n#define ASSET_BANKS '+pack.romBanks+'u\nstatic const uint16_t asset_counts[]={'+pack.groups.map(x=>x.count).join(',')+'};\nstatic const uint16_t asset_offsets[]={'+pack.groups.map(x=>x.offset).join(',')+'};\nstatic const uint8_t asset_present[]={'+Array.from({length:pack.romBanks},(_,i)=>pack.banks.has(i)?1:0).join(',')+'};\n');
await fs.writeFile(gen+'/state-assets.h',stateAssets(data).header);
await fs.writeFile(out+'/catalog.json',JSON.stringify({sourceSha256:profile.sha256,comparisons:assets.comparisons,objectComparisons:assets.objectComparisons,unresolved:assets.unresolved,placementUsage:assets.placementUsage,assets:assets.provenance},null,2));
const arg=process.argv.indexOf('--gbdk'),gbdk=arg<0?local.gbdk:process.argv[arg+1];check(gbdk,'Pass --gbdk PATH');
const compiler=gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Compiler mismatch');
const romPath=out+(explore?'/ff3-exploration.gbc':audio?'/ff3-dialogue-audio.gbc':mode?'/ff3-dialogue-viewer.gbc':'/ff3-text-viewer.gbc');
try{
 const r=await promisify(execFile)(compiler,['-msm83:gb',...(explore?['-DFF3_EXPLORATION']:[]),...(audio?['-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO']:[]),'-Wm-yC','-Wm-yt0x19','-Wm-yo'+pack.romBanks,'-Wm-ynFF3TEXT','-Wl-m','-Wl-j','-I'+gen,'-o',romPath,...['assets','map-display','game-state','field-objects','text-vblank','text-window',...(explore?['npc-dialogue','exploration','exploration-render','exploration-video','exploration-viewer']:mode?['npc-dialogue','dialogue-viewer']:['text-viewer']),...(audio?['platform','platform-probe','audio-control','audio-channel','audio-music','audio-engine','audio-output','audio-native']:[])].map(n=>ROOT+'/src/'+n+'.c'),...sources],{cwd:out,env:{...process.env,TMP:ROOT+'/.local/compiler-tmp',TEMP:ROOT+'/.local/compiler-tmp'},maxBuffer:8e6});
 await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);
}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const rom=await fs.readFile(romPath);checkGbc(rom,pack.romBanks);
for(const [bank,bytes]of pack.banks)check(rom.subarray(bank*16384,(bank+1)*16384).equals(bytes),'Linked text asset bank differs');
check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link overflow');
const symbols={};for(const m of (await fs.readFile(romPath.replace('.gbc','.noi'),'utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const fixedRomEnd=Math.max(...['CODE','CODE_0','HOME','INITIALIZER','GSINIT','GSFINAL'].map(n=>(symbols['s__'+n]??0)+(symbols['l__'+n]??0)));
check(fixedRomEnd<0x4000&&symbols.s__HEAP<0xd000&&symbols.l__CODE_13<16384,'Text viewer memory budget');
check(symbols.l__CODE_14<16384&&symbols.b_ff3_text_open===14,'Text bank budget');
check(symbols._text_staging===0xd950&&symbols._text_lookup===0xda60,'Text staging/hash reservation');
check(symbols._map_workspace===0xd000&&symbols.b_ff3_objects_init===13&&symbols.b_ff3_objects_display===13,'Object call/workspace banks');
if(mode){check(symbols.l__CODE_15<16384&&symbols.b_ff3_npc_start===15,'NPC bank budget');await fs.writeFile(out+'/dialogue-analysis.json',JSON.stringify(assets.dialogue,null,2));}
if(sound){for(const b of sound.banks){const offset=b.n===8?(symbols._ff3_audio_bank36&0x3fff):0;check(rom.subarray(b.n*16384+offset,b.n*16384+offset+b.bytes.length).equals(b.bytes),'Linked audio bytes');}check(symbols._text_cells===0xd800&&symbols.l__CODE_8<16384,'Audio/text workspace');for(const n of ['ff3_native_service','ff3_text_copy','ff3_text_video'])check(symbols['_'+n]<0x4000,'Fixed-bank service '+n);}
const report={dialogue:mode?assets.dialogue.comparisons:undefined,sourceSha256:profile.sha256,romSha256:hash(rom),romBanks:pack.romBanks,assetCount:pack.assets,directoryBytes:pack.directory.length,fixedRomEnd,staticWramEnd:symbols.s__HEAP,objectCodeBytes:symbols.l__CODE_13,comparisons:assets.objectComparisons,placements:197,unresolvedPlacementSlots:59,textCodeBytes:symbols.l__CODE_14,text:assets.text.analysis.summary,samples:assets.text.sourceIds.length,fontGlyphs:2350,usedGlyphs:assets.text.usedGlyphs,fixtureStart:assets.text.fixtureStart,fixtureWords,scope:audio?'Original NPC dialogue and audio VBlank load diagnostic; normal exploration and naming/save pending':mode?'Original ordinary-NPC selector and bounded event/text substitution diagnostic; normal exploration and naming/save pending':'Reviewed local Korean text on map/NPC viewer; layout controls; semantic menu/battle handlers pending'};
report.audio=sound?.report;report.video={lcdOff:false,chunkBytes:128,stagingBytes:256,dma:true,vblankCallback:true,lastStartLine:150,windowHiddenDuringUpload:true,glyphLookupBytes:256,scriptReadAheadBytes:32,stackBytes:1168,opaqueGlyphsAtBuild:true};
if(field){report.exploration=field.report;report.video.stackBytes=848;report.scope='Original normal-map player movement, front-NPC Korean dialogue and return; reviewed map 29 entry, static NPC AI, other consumers fail explicitly';check(symbols._field===0xdb70&&symbols._field_oam===0xdc00&&symbols.l__CODE_9<16384&&symbols.l__CODE_10<16384,'Exploration memory/bank budget');}
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,text:undefined,fixtureWords:undefined},null,2));
