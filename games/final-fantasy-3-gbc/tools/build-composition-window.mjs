import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import path from 'node:path';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';import {makeMapAssets,packMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {windowAssets} from './composition-window-assets.mjs';import {addTextAssets,textKinds} from './korean-text.mjs';import {textPage,windowRgb} from './text-reference.mjs';
import {battleSceneAssets} from './battle-scene-assets.mjs';
import {battleActionAssets,actionRgb} from './battle-action-assets.mjs';
import {nativeTiming} from './native-plan.mjs';
import {selectionTables} from './battle-select-source.mjs';
import {battleCompositionAssets} from './battle-composition-assets.mjs';
import {textAudioAssets} from './text-audio-assets.mjs';import {stateAssets} from './state-source.mjs';import {png} from './render-budget-pixels.mjs';import {checkTransferCode} from './memory-layout.mjs';
const openingMode=process.argv.includes('--opening-video');
const itemMode=process.argv.includes('--item-window'),partyMode=itemMode||process.argv.includes('--party-commands'),selectionMode=partyMode||process.argv.includes('--selection'),actionMode=openingMode||selectionMode||process.argv.includes('--action'),streamMode=actionMode||process.argv.includes('--scene');
const timelineMode=process.argv.includes('--timeline'),battleMode=streamMode||timelineMode||process.argv.includes('--battle'),atlasMode=battleMode&&!process.argv.includes('--legacy-cache'),name=openingMode?'battle-opening-video':itemMode?'battle-item-window':partyMode?'battle-party-commands':selectionMode?'battle-selection':actionMode?'battle-action':streamMode?'battle-scene':timelineMode?'battle-timeline':battleMode?(atlasMode?'battle-composition':'battle-composition-cache'):'composition-window';
check(!streamMode||(!timelineMode&&!process.argv.includes('--legacy-cache')),'Scene streaming cannot use resident timeline/cache mode');
const {data,profile,local}=await input(),out=ROOT+'/build/'+name,gen=out+'/generated';await fs.mkdir(gen,{recursive:true});
const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.text),scene=openingMode?(await import('./battle-opening-assets.mjs')).battleOpeningAssets(data,assets.text):actionMode?battleActionAssets(data,assets.text,{smallHp:true,selection:selectionMode,party:partyMode}):streamMode?battleSceneAssets(data):battleMode?battleCompositionAssets(data,{timeline:timelineMode}):windowAssets(data,assets),{jobs,frames,palettes}=scene;
if(actionMode){
 for(const f of frames)scene.battle.action.profiles[0].uiRaster.palette.copy(f.palette,56);
 for(const [p,profile]of scene.battle.action.profiles.entries())for(const [i,e]of profile.entries.entries()){
  const rgb=actionRgb(scene.raw[e.frame],profile.uiRaster,e.live);e.rgbSha256=hash(rgb);await fs.writeFile(out+'/action'+p+'-'+i+'.rgb',rgb);await fs.writeFile(out+'/action'+p+'-'+i+'.png',png(rgb));
  if(e.run!==255)for(const [n,t]of scene.battle.numberTimeline.runs[e.run].entries.entries()){const image=actionRgb(scene.raw[t.frame],profile.uiRaster,e.live);t.rgbSha256=hash(image);await fs.writeFile(out+'/number'+e.run+'-'+n+'.rgb',image);}
 }
}
let chosen;for(let i=0;i<assets.text.messages.length;i++){const pages=[];let p;do{p=textPage(assets.text.messages[i],p?.offset??0);if(p.error)break;pages.push(p);}while(p.more);if(!p.error&&pages.length>=2){chosen={source:assets.text.sourceIds[i],pages};break;}}
check(chosen,'Reviewed original Korean message with multiple pages required');
// Only text lookup/font/message consumers are linked here. Scene supply below
// carries the needed original tile inputs; unused map catalogs are not copied.
const textOnly={groups:Object.fromEntries(textKinds.map((k,i)=>[k,i<15||i===16?[]:assets.groups[k]]))};
const pack=packMapAssets(textOnly,textKinds,{firstBank:openingMode?17:16}),sources=[],decl=[],jobRows=[],frameRows=[],battleRows=[],linked=[];let blockBank=0;let bank=Math.max(...pack.banks.keys())+1,used=0,code='';
for(const [n,bytes]of pack.banks){const file=gen+'/text-bank'+n+'.c';await fs.writeFile(file,'#pragma bank '+n+'\n#include <stdint.h>\nconst uint8_t text_bank'+n+'[]={'+[...bytes]+'};\n');sources.push(file);}
await fs.writeFile(gen+'/asset-directory.h','#define ASSET_KINDS '+pack.groups.length+'u\n#define ASSET_BANKS '+pack.romBanks+'u\nstatic const uint16_t asset_counts[]={'+pack.groups.map(x=>x.count)+'};\nstatic const uint16_t asset_offsets[]={'+pack.groups.map(x=>x.offset)+'};\nstatic const uint8_t asset_present[]={'+Array.from({length:pack.romBanks},(_,i)=>+pack.banks.has(i))+'};\n');
async function flush(){if(!code)return;const file=gen+'/bank'+bank+'.c';await fs.writeFile(file,'#pragma bank '+bank+'\n#include <stdint.h>\n'+code);sources.push(file);code='';used=0;}
async function array(name,bytes,word=false){if(!bytes.length)bytes=Buffer.alloc(16);if(used+bytes.length>16384){await flush();bank++;}const type=word?'uint16_t':'uint8_t';decl.push('extern const '+type+' '+name+'[];');code+='const '+type+' '+name+'[]={'+(word?Array.from({length:bytes.length/2},(_,i)=>bytes.readUInt16LE(i*2)):[...bytes])+'};\n';used+=bytes.length;linked.push({name,bank,bytes});return bank;}
for(const [i,j]of jobs.entries()){const bytes=j.static?j.expected:j.bytes,b=await array('cell'+i,bytes);jobRows.push('{cell'+i+','+bytes.length+','+b+','+Number(j.static)+'}');}
await flush();bank++;
if(openingMode){
 const dict=new Map(),rows=[];for(const f of frames)for(let i=0;i<f.atlas.spans.length;i+=48){const r=f.atlas.spans.subarray(i,i+48),k=r.toString('hex');if(!dict.has(k)){dict.set(k,rows.length);rows.push(r);}}
 const refs=[];for(let i=0;i<rows.length;i+=340){const bytes=Buffer.concat(rows.slice(i,i+340)),b=await array('opening_spans'+i,bytes);for(let n=0;n<Math.min(340,rows.length-i);n++)refs.push([b,(0x4000+n*48)&255,(0x4000+n*48)>>8]);await flush();bank++;}
 for(const f of frames){const a=[];for(let i=0;i<f.atlas.spans.length;i+=48)a.push(...refs[dict.get(f.atlas.spans.subarray(i,i+48).toString('hex'))]);f.atlas.spans=Buffer.from(a);}
 scene.battle.spanDictionary={rows:rows.length,bytes:rows.length*48,indexBytes:frames.length*(scene.battle.uniqueVisuals+1)*3};
}
for(const [i,f]of frames.entries()){
 const ids=Buffer.alloc(798);f.ids.forEach((v,n)=>ids.writeUInt16LE(v,n*2));const frameBytes=streamMode?798+399+96+76+32+f.atlas.objects.length+160+f.atlas.maps.length+f.atlas.spans.length+16+f.atlas.background.length:atlasMode?3100:1293;check(frameBytes<=16384,'Single frame bank capacity');if(used+frameBytes>16384){await flush();bank++;}
 const b=await array('ids'+i,ids,true);await array('attrs'+i,f.attributes);await array('palette'+i,f.palette);frameRows.push('{ids'+i+',attrs'+i+',palette'+i+','+b+','+f.scroll+'}');
 if(atlasMode){check(f.stats.objects<=(streamMode?40:16),'Atlas staging OBJ capacity');await array('blocks'+i,f.atlas.blocks);if(used%16)await array('padding'+i,Buffer.alloc(16-used%16));await array('objects'+i,f.atlas.objects);await array('oam'+i,f.atlas.oam);await array('maps'+i,f.atlas.maps);await array('spans'+i,f.atlas.spans);if(streamMode){if(used%16)await array('bgpadding'+i,Buffer.alloc(16-used%16));await array('background'+i,f.atlas.background);}battleRows.push('{blocks'+i+',objects'+i+',oam'+i+',maps'+i+',spans'+i+','+b+','+f.stats.objects+','+f.atlas.visual+(streamMode?',background'+i:'')+'}');}
 await fs.writeFile(out+'/frame'+i+'.rgb',f.rgb);await fs.writeFile(out+'/frame'+i+'.png',png(f.rgb));
 for(const [p,page]of chosen.pages.entries()){const rgb=windowRgb(f.rgb,page,assets.text.glyphs);await fs.writeFile(out+'/frame'+i+'-text'+p+'.rgb',rgb);}
}
await flush();if(atlasMode){bank++;blockBank=await array('scene_map_blocks',scene.blocks);check(await array('scene_bg_tiles',scene.bgTiles)===blockBank,'BG atlas bank');await flush();}
const numberRows=[];
if(streamMode){bank++;for(const [i,r]of scene.battle.numberTimeline.runs.entries()){const b=await array('number_oam'+i,r.oam);numberRows.push('{number_oam'+i+','+b+','+r.first+','+r.clear+','+r.objects+'}');}await flush();
 await fs.writeFile(gen+'/battle-timeline-data.h','#define BATTLE_ENTRY_COUNT '+(actionMode?32:33)+'u\nstatic const uint16_t battle_offsets[]={'+scene.battle.numberTimeline.runs[0].entries.map(e=>e.timerOffset)+'};\n');}
let actionGlyphBank=0;
if(actionMode){bank++;actionGlyphBank=await array('action_glyphs',scene.battle.action.glyphs);await flush();}
let items,itemNames=[];if(itemMode){
 const {itemAssets}=await import('./battle-item-assets.mjs');items=await itemAssets(data,assets.text,scene.battle.action.selectionViews[0].source.menuTiles,local.text);
 bank++;for(let start=0;start<258;start+=64){const b=await array('item_name_block'+start,items.names.subarray(start*128,Math.min(258,start+64)*128));for(let i=start;i<Math.min(258,start+64);i++)itemNames.push('{item_name_block'+start+'+'+((i-start)*128)+','+b+'}');}await flush();bank++;
 const useBank=await array('item_properties',items.flags);check(await array('item_usable',items.usable)===useBank,'Item use bank');await flush();bank++;
 const baseBank=await array('item_base',items.base);check(await array('item_digits',items.digits)===baseBank,'Item glyph bank');await flush();
 await fs.writeFile(gen+'/battle-item-data.h','#include <stdint.h>\n#define ITEM_BASE_BANK '+baseBank+'u\n#define ITEM_USE_BANK '+useBank+'u\ntypedef struct{const uint8_t *data;uint8_t bank;}ItemName;\nextern const ItemName item_names[];\nextern const uint8_t item_base[],item_digits[],item_usable[],item_properties[],item_widths[];\n');
}
const banks=2**Math.ceil(Math.log2(bank+1));check(banks<=256&&jobs.length*6+frames.length*(atlasMode?22:9)<16384,'Metadata/cartridge capacity');
await fs.writeFile(gen+'/scene-assets.h','#include <stdint.h>\n#define SCENE_JOB_COUNT '+jobs.length+'u\n#define SCENE_FRAME_COUNT '+frames.length+'u\n#define SCENE_TEXT_SOURCE '+chosen.source+'u\ntypedef struct{const uint8_t *data;uint16_t size;uint8_t bank,is_static;}SceneJob;\ntypedef struct{const uint16_t *jobs;const uint8_t *attrs,*palette;uint8_t bank,x,y;}SceneFrame;\nextern const SceneJob scene_jobs[SCENE_JOB_COUNT];\nextern const SceneFrame scene_frames_data[SCENE_FRAME_COUNT];\n');
if(itemMode)await fs.appendFile(gen+'/scene-assets.h','#define FF3_ITEM_ASSETS 1\n');
if(atlasMode)await fs.appendFile(gen+'/scene-assets.h','#define SCENE_VISUAL_COUNT '+scene.battle.uniqueVisuals+'u\n#define SCENE_BLOCK_COUNT '+scene.blocks.length/16+'u\n#define SCENE_BLOCK_BANK '+blockBank+'u\ntypedef struct{const uint8_t *blocks,*graphics,*oam,*maps,*spans;uint8_t bank,objects,visual;'+(streamMode?'const uint8_t *background;':'')+'}SceneBattleFrame;\nextern const SceneBattleFrame scene_battle_frames[SCENE_FRAME_COUNT];\nextern const uint8_t scene_map_blocks[],scene_bg_tiles[];\n');
await fs.writeFile(gen+'/scene-assets.c','#pragma bank 7\n#include "scene-assets.h"\n'+decl.join('\n')+'\nconst SceneJob scene_jobs[]={'+jobRows+'};\nconst SceneFrame scene_frames_data[]={'+frameRows+'};\n');
if(itemMode)await fs.appendFile(gen+'/scene-assets.c','#include "battle-item-data.h"\nconst ItemName item_names[]={'+itemNames+'};\nconst uint8_t item_widths[]={'+[...items.widths]+'};\nconst uint8_t item_source_status[]={'+[...Buffer.concat(scene.battle.action.selectionViews.map(p=>p.source.monsterStatus))]+'};\n');
if(atlasMode)await fs.appendFile(gen+'/scene-assets.c','const SceneBattleFrame scene_battle_frames[]={'+battleRows+'};\n');
if(streamMode){await fs.appendFile(gen+'/scene-assets.h','#define SCENE_NUMBER_ENTRIES '+(actionMode?32:33)+'u\n#define SCENE_NUMBER_END '+Math.floor(32*nativeTiming.timerHz*nativeTiming.sourceRateDenominator/nativeTiming.sourceRateNumerator)+'u\n#define SCENE_NUMBER_RUNS '+numberRows.length+'u\ntypedef struct{const uint8_t *oam;uint8_t bank,first,clear,objects;}SceneNumberRun;\nextern const SceneNumberRun scene_number_runs[SCENE_NUMBER_RUNS];\n');await fs.appendFile(gen+'/scene-assets.c','const SceneNumberRun scene_number_runs[]={'+numberRows+'};\n');}
if(actionMode){
 const a=scene.battle.action;let first=0;const pr=a.profiles.map(p=>{const s='{'+first+','+p.entries.length+'}';first+=p.entries.length;return s;});
 await fs.writeFile(gen+'/battle-action-data.h','#include <stdint.h>\n#define ACTION_PROFILES '+a.profiles.length+'u\n#define ACTION_GLYPH_BANK '+actionGlyphBank+'u\n#define ACTION_GLYPH_BYTES '+a.glyphs.length+'u\n#define ACTION_FRAME_NUM '+(nativeTiming.timerHz*nativeTiming.sourceRateDenominator)+'UL\n#define ACTION_FRAME_DEN '+nativeTiming.sourceRateNumerator+'UL\ntypedef struct{uint8_t frame,live,hold,run,ui;'+(openingMode?'uint8_t request,soundOp,soundArg;':'')+'}ActionEntry;\ntypedef struct{uint16_t first;uint8_t count;}ActionProfile;\nextern const ActionEntry action_entries[];\nextern const ActionProfile action_profiles[];\nextern const uint8_t action_cells[],action_glyphs[];\n');
 await fs.appendFile(gen+'/scene-assets.c','#include "battle-action-data.h"\nconst ActionEntry action_entries[]={'+a.profiles.flatMap(p=>p.entries.map(e=>'{'+[e.frame,e.live,e.hold,e.run,e.ui,...(openingMode?[e.request,e.soundOp,e.soundArg]:[])]+'}'))+'};\nconst ActionProfile action_profiles[]={'+pr+'};\nconst uint8_t action_cells[]={'+[...Buffer.concat(a.cells)]+'};\n');
}
if(selectionMode){
 const p=scene.battle.action.selectionViews;check(p[0].cursorGlyphs.equals(p[1].cursorGlyphs),'Shared cursor graphics');
 await fs.writeFile(gen+'/battle-select-tables.h',selectionTables(data).header);
 await fs.writeFile(gen+'/battle-selection-data.h','extern const uint8_t selection_envs[],selection_cursors[],selection_glyphs[],selection_frames[],selection_uis[],selection_commands[];\n');
 for(const [name,bytes]of [['selection_envs',Buffer.concat(p.map(x=>x.env))],['selection_cursors',Buffer.concat(p.map(x=>x.cursorOam))],['selection_glyphs',p[0].cursorGlyphs],['selection_frames',Buffer.from(p.flatMap(x=>x.entries.map(e=>e.frame)))],['selection_uis',Buffer.from(p.map(x=>x.entries[0].ui))],['selection_commands',p[0].source.commands]])await fs.appendFile(gen+'/scene-assets.c','const uint8_t '+name+'[]={'+[...bytes]+'};\n');
}
if(partyMode){const {partyUiAssets}=await import('./battle-party-ui.mjs'),p=scene.battle.action.selectionViews,a=partyUiAssets(p[0],assets.text,{items:itemMode});check(a.base.equals(partyUiAssets(p[1],assets.text,{items:itemMode}).base),'Shared party HP frame');
 await fs.appendFile(gen+'/battle-selection-data.h','extern const uint8_t party_ui_base[],party_ui_masks[],selection_arrow[];\n');
 for(const [name,bytes]of [['party_ui_base',a.base],['party_ui_masks',a.masks],['selection_arrow',p[0].source.menuTiles.subarray(0x5d*16,0x5e*16)]])await fs.appendFile(gen+'/scene-assets.c','const uint8_t '+name+'[]={'+[...bytes]+'};\n');
}
if(timelineMode){check(atlasMode,'Timeline requires resident atlas');check(frames.every(f=>f.palette.equals(frames[0].palette)),'Timeline requires invariant palettes');check(scene.battle.timeline.entries.at(-1).timerOffset<32768,'Signed timer horizon');await fs.writeFile(gen+'/battle-timeline-data.h','#define BATTLE_ENTRY_COUNT '+frames.length+'u\nstatic const uint8_t battle_visuals[]={'+frames.map(f=>f.atlas.visual)+'};\nstatic const uint16_t battle_offsets[]={'+scene.battle.timeline.entries.map(e=>e.timerOffset)+'};\n');}
await fs.writeFile(gen+'/state-assets.h',stateAssets(data).header);const audio=await textAudioAssets(data,gen,out,assets.groups.properties[29][10],{cycles:openingMode?6:itemMode?6:2,...(openingMode?{requestPlan:[[0,2,scene.battle.opening[0].music]]}:{})}),compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');const rom=out+'/ff3-'+name+'.gbc';
const flags=['-msm83:gb',...(openingMode?['-DFF3_OPENING_VIDEO']:[]),...(itemMode?['-DFF3_ITEM_WINDOW']:[]),...(partyMode?['-DFF3_PARTY_COMMANDS']:[]),...(selectionMode?['-DFF3_SELECTION_FLOW']:[]),...(actionMode?['-DFF3_ACTION_FLOW']:[]),...(streamMode?['-DFF3_BATTLE_STREAM','-DFF3_NUMBER_TIMELINE']:[]),...(timelineMode?['-DFF3_BATTLE_TIMELINE']:[]),'-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO','-DFF3_COMPOSITION_CACHE','-DFF3_COMPOSITION_WINDOW','-Dcache_request=scene_request','-DFF3_COMPOSITION_PALETTES=4','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo'+banks,'-Wl-m','-Wl-j','-I'+gen];
const inputs=[...['platform','platform-probe','game-state','game-save','memory','assets','text-window','audio-control','audio-channel','audio-music','audio-engine','audio-output','audio-native','text-vblank','composition-kernel',atlasMode?'battle-atlas':'composition-window','composition-window-video','composition-window-probe',...((timelineMode||streamMode)?['battle-timeline']:[])].map(n=>ROOT+'/src/'+n+'.c'),gen+'/scene-assets.c',...audio.sources,...sources];
if(openingMode){
 const rows=scene.battle.opening;check(rows.every(r=>r.requests.length<=64),'Opening request slots');
 for(const [key,name]of [['kind','opening_kinds'],['value','opening_values']])await fs.appendFile(gen+'/scene-assets.c','const uint8_t '+name+'[]={'+rows.flatMap(r=>Array.from({length:64},(_,i)=>r.requests[i]?.[key]??255))+'};\n');
 await fs.writeFile(gen+'/opening-seeds.c','#pragma bank 16\n#include <stdint.h>\nconst uint8_t opening_seeds[]={'+[...Buffer.concat(rows.map(r=>Buffer.from(r.state,'hex')))]+'};\n');
 inputs.push(gen+'/opening-seeds.c',...['battle-party','battle-context','battle-opening'].map(n=>ROOT+'/src/'+n+'.c'));
}
if(selectionMode)inputs.push(ROOT+'/src/battle-select.c');if(partyMode)inputs.push(ROOT+'/src/battle-party.c',ROOT+'/src/inventory.c');
if(partyMode){const {rowPositions}=await import('./battle-row-source.mjs');await fs.writeFile(gen+'/row-properties.c','#pragma bank 15\n#include <stdint.h>\nconst uint8_t row_positions[]={'+[...rowPositions(data).bytes]+'};\n');inputs.push(gen+'/row-properties.c',ROOT+'/src/battle-row.c');}
if(itemMode){const {equipmentProperties}=await import('./battle-equipment-source.mjs'),p=equipmentProperties(data);await fs.writeFile(gen+'/equipment-properties.c','#pragma bank 15\n#include <stdint.h>\nconst uint8_t equipment_properties[]={'+[...p.bytes]+'};\n');inputs.push(gen+'/equipment-properties.c',...['battle-items','battle-item-render','battle-item-video','battle-equipment','battle-equipment-stats'].map(n=>ROOT+'/src/'+n+'.c'));}
const logs=[],invoke=async args=>{try{const r=await promisify(execFile)(compiler,args,{cwd:out,maxBuffer:8e6});return r.stdout+r.stderr;}catch(e){await fs.writeFile(out+'/compiler.log',logs.join('\n')+(e.stdout||'')+(e.stderr||''));throw e;}};
if(streamMode){
 // lcc gives every implicit temporary object an absolute path. At this many
 // banks its linker child exceeds Windows' command-line limit. Explicit
 // short object names preserve input order and keep the final link bounded.
 await fs.mkdir(out+'/obj',{recursive:true});const objects=inputs.map((_,i)=>'obj/'+i+'.o');
 for(let i=0;i<inputs.length;i+=4){const batch=await Promise.allSettled(inputs.slice(i,i+4).map((p,j)=>invoke([...flags,'-c','-o',objects[i+j],path.relative(out,p)])));for(const r of batch){if(r.status==='fulfilled')logs.push(r.value);}const failure=batch.find(r=>r.status==='rejected');if(failure){await fs.appendFile(out+'/compiler.log',logs.join('\n'));throw failure.reason;}}
 logs.push(await invoke([...flags,'-o',path.basename(rom),...objects]));
}else logs.push(await invoke([...flags,'-o',rom,...inputs]));
await fs.writeFile(out+'/compiler.log',logs.join('\n'));
check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link overlap');const bytes=await fs.readFile(rom);checkGbc(bytes,banks,0x1b,3);const symbols={};for(const m of(await fs.readFile(rom.replace('.gbc','.noi'),'utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
check(symbols.s__HEAP<0xd000&&symbols._scene_keys===0xd800&&symbols._scene_input===0xda60&&symbols._text_cells===0xd800&&symbols._text_lookup===0xda60&&symbols._text_staging===0xd950&&symbols._scene_oam0===0xdc00&&symbols._scene_oam1===0xdd00&&symbols.b_ff3_compose_cell===11,'Memory placement');
check(symbols.s__HEAP<=0xcf00&&symbols._ff3_scene_rom_copy<0x4000,'Fixed headroom/data-bank access');
if(itemMode)for(const [vector,name]of [[0x48,'ff3_item_lcd'],[0x50,'item_audio_irq_begin']])check(bytes[vector]===0xc3&&bytes.readUInt16LE(vector+1)===symbols['_'+name],'Exact raw interrupt vector '+name);
if(itemMode){const {equipmentProperties}=await import('./battle-equipment-source.mjs'),p=equipmentProperties(data),at=15*16384+(symbols._equipment_properties&16383);check(symbols.b_ff3_equipment_update===15&&symbols.b_ff3_equipment_swap===15&&symbols.l__CODE_15<=16384&&bytes.subarray(at,at+p.bytes.length).equals(p.bytes),'Equipment code/data bank and original properties');}
if(partyMode){const {rowPositions}=await import('./battle-row-source.mjs'),p=rowPositions(data).bytes,at=15*16384+(symbols._row_positions&16383);check(symbols.b_ff3_row_begin===15&&symbols.b_ff3_row_key===15&&symbols.l__CODE_15<=16384&&bytes.subarray(at,at+p.length).equals(p),'Linked original row table and kernel');}
const fixedRomEnd=Math.max(...['CODE','CODE_0','HOME','INITIALIZER','GSINIT','GSFINAL'].map(n=>(symbols['s__'+n]??0)+(symbols['l__'+n]??0)));check(fixedRomEnd<0x4000,'Fixed ROM capacity');
for(const [n,b]of pack.banks)check(bytes.subarray(n*16384,(n+1)*16384).equals(b),'Linked Korean asset bank');
for(const b of audio.banks){const at=b.n===8?(symbols._ff3_audio_bank36&16383):0;check(bytes.subarray(b.n*16384+at,b.n*16384+at+b.bytes.length).equals(b.bytes),'Linked audio');}
for(const b of linked){const a=symbols['_'+b.name],at=b.bank*16384+(a&16383);check((a>>>16)===b.bank&&(a&65535)+b.bytes.length<=0x8000&&bytes.subarray(at,at+b.bytes.length).equals(b.bytes),'Linked cell/frame '+b.name);}
if(openingMode)for(const b of linked.filter(b=>b.name.startsWith('opening_spans')))check((symbols['_'+b.name]&65535)===0x4000,'Opening span dictionary address');
const report={sourceSha256:profile.sha256,romSha256:hash(bytes),audio:audio.report,palettes,text:{source:chosen.source,pages:chosen.pages,fontSha256:assets.text.fontSha256,bindingsSha256:hash(await fs.readFile(local.text.bindings)),messageSha256:hash(assets.text.messages[assets.text.sourceIds.indexOf(chosen.source)])},jobs:jobs.map(j=>({inputSha256:hash(j.bytes),expected:j.expected.toString('hex'),static:j.static})),frames:frames.map(f=>({...f,attributes:[...f.attributes],palette:f.palette.toString('hex'),rgb:undefined,rgbSha256:hash(f.rgb)})),memory:{fixedRomEnd,staticWramEnd:symbols.s__HEAP,cacheSlots:128,cacheBanks:[3,4,5],cacheBytes:10240,metadataBank:6,metadataBytes:1856,stackFloor:0xde00,transfer:checkTransferCode(bytes,symbols)},scope:'Original world-aligned diagnostic inputs, four source OBJ palettes, GBC cache composition and Korean window ownership; no live field/guest/dirty-planner integration'};
for(const [i,f]of report.frames.entries())f.windowRgbSha256=chosen.pages.map(page=>hash(windowRgb(frames[i].rgb,page,assets.text.glyphs)));
if(atlasMode)for(const b of linked.filter(b=>/^(cell|objects|maps|background|scene_map_blocks|scene_bg_tiles)/.test(b.name)))check((symbols['_'+b.name]&15)===0,'ROM DMA alignment '+b.name);
if(battleMode){report.battle={...scene.battle,renderer:streamMode?'per-frame-bg-banks':atlasMode?'resident-atlas':'legacy-cache'};if(atlasMode)report.memory={...report.memory,cacheSlots:0,cacheBanks:[],cacheBytes:0,residentBgTiles:jobs.length,metadataBytes:256,metadataOffset:1600};report.scope='Precompiled original battle diagnostic atlas through GBC transfers and Korean window; unchanged original field-music/SFX stress plan; not live battle gameplay or original spell timing';}
if(timelineMode||streamMode){check(bytes.subarray(symbols._ff3_battle_oam_refresh,symbols._ff3_battle_oam_refresh+3).toString('hex')==='c380ff'&&symbols.__shadow_OAM_base===0xff92,'Pinned GBDK selectable HRAM OAM DMA');}
if(streamMode){check(symbols._scene_dma_begin>0&&symbols._scene_dma_begin<symbols._scene_dma_end&&symbols._scene_dma_end<0x4000,'Fixed DMA critical observation boundaries');report.memory={...report.memory,residentBgTiles:0,bgPageCapacity:256,bgPageBanks:[0,1],bgPageRange:[0x8800,0x9800],dmaBytesMax:256};report.scope=scene.battle.scope;}
if(timelineMode)report.scope='Autonomous original non-reflect hit-script entries and final clear; resident diagnostic atlas, Korean window and independent field-audio stress; not full battle gameplay';
if(itemMode)report.items=items.report;
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({romSha256:report.romSha256,jobs:jobs.length,frames:frames.length,palettes,textSource:chosen.source,pages:chosen.pages.length,memory:report.memory}));
