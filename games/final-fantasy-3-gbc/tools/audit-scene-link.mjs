// Deliberately link the two EXISTING diagnostic module sets together to expose
// integration blockers. Renamed legacy mains and an inert entry are NEVER run.
// This is not the game build; neither the partial ROM nor generated assets ship.
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';
const {local}=await input(),field=ROOT+'/build/exploration',battle=ROOT+'/build/battle-effects',out=ROOT+'/build/scene-link-audit';await fs.mkdir(out,{recursive:true});
const run=promisify(execFile),compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');
const names=['scene-video','platform','platform-probe','game-state','game-save','memory','memory-probe','audio-control','audio-channel','audio-music','audio-engine','audio-output','audio-native','text-vblank',
 'assets','map-display','field-objects','text-window','npc-dialogue','exploration','npc-motion','exploration-render','exploration-video',
 'battle-entry','battle-party-oam','battle-magic-frames','battle-magic-video','battle-hit-video','battle-animation','battle-numerals','battle-animation-video','battle-effect-freeze','battle-motion-sprites','battle-strike-video','battle-bow-video','battle-thrown-video','battle-action-oam','battle-live-ui','battle-message','battle-script','battle-script-video','battle-entry-tail','battle-status-oam','battle-status-video','battle-resident-bg','battle-terrain'];
const flags=['-msm83:gb','-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO','-DFF3_EXPLORATION','-DFF3_EFFECTS','-DFF3_AUDIO_FAST','-DFF3_LIVE_UI','-DFF3_STATUS_VIDEO','-DFF3_TERRAIN','-DFF3_RESIDENT_BG','-DFF3_COMPOSITION_CACHE','-Dcache_request=party_work','-I'+field+'/generated','-I'+battle+'/generated'];
async function compile(args,log,allowFailure=false){try{const r=await run(compiler,args,{cwd:out,maxBuffer:8e6,timeout:600000});await fs.writeFile(out+'/'+log,r.stdout+r.stderr);return 0;}catch(e){await fs.writeFile(out+'/'+log,(e.stdout||'')+(e.stderr||''));if(!allowFailure)throw e;return e.code;}}
const evidence=[];for(const [dir,file,key]of [[field,'ff3-exploration.gbc','romSha256'],[battle,'ff3-battle-effects-video.gbc','videoRomSha256']]){
 const r=JSON.parse(await fs.readFile(dir+'/report.json')),sha256=hash(await fs.readFile(dir+'/'+file));check(r[key]===sha256,'Prerequisite artifact identity '+file);evidence.push({file,sha256});
}
const objects=[];for(const [file,symbol]of [['exploration-viewer','field_legacy_main'],['battle-party-video','battle_legacy_main']]){
 const obj=out+'/'+file+'.o';await compile([...flags,'-Dmain='+symbol,'-c','-o',obj,ROOT+'/src/'+file+'.c'],file+'.log');objects.push(obj);
}
// Compile the fast output separately, as the actual battle builder does.
const fast=out+'/audio-output.o';await compile([...flags,'-c','-o',fast,ROOT+'/src/audio-output.c'],'audio-output.log');
const generated=[],directory=await fs.readFile(field+'/generated/asset-directory.h','utf8');
const present=directory.match(/asset_present\[\]=\{([0-9,]+)\}/)?.[1].split(',').map(Number);check(present,'Current field bank directory');
present.forEach((v,i)=>{if(v)generated.push(field+'/generated/text-bank'+i+'.c');});
const mr=JSON.parse(await fs.readFile(battle+'/magic-residency.json'));
for(const file of [...[1,2,3,4,5,6,8].map(i=>'audio-bank'+i),'live-ui','effects','strike53','strike54',...Array.from({length:4},(_,i)=>['party','resident','terrain','hit'].map(k=>k+i)).flat(),...mr.banks.map((_,i)=>'magic'+i)])generated.push(battle+'/generated/'+file+'.c');
await fs.writeFile(out+'/link-entry.c','/* Link audit only: never execute this artifact. */\nvoid main(void){while(1){}}\n');
const sources=names.map(n=>n==='audio-output'?fast:ROOT+'/src/'+n+'.c');
// Do not let a failed link inherit a previous symbol map or rejected ROM.
for(const ext of ['gbc','noi','map'])await fs.rm(out+'/rejected-link.'+ext,{force:true});
const exitCode=await compile([...flags,'-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo128','-Wl-m','-Wl-j','-o',out+'/rejected-link.gbc',out+'/link-entry.c',...objects,...sources,...generated],'link.log',true);
const log=await fs.readFile(out+'/link.log','utf8');let symbols={};try{for(const m of(await fs.readFile(out+'/rejected-link.noi','utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);}catch(e){if(e.code!=='ENOENT')throw e;}
const overflow=/overflow|Multiple write|overlap|exceed/i.test(log),fixedEnd=symbols.s__HEAP??null;
const fixedRomEnd=symbols.s__INITIALIZER!==undefined?symbols.s__INITIALIZER+symbols.l__INITIALIZER:null;
const overlapWarnings=log.split(/\r?\n/).filter(s=>/Multiple write|overlap|overflow/i.test(s));
const inputs=[];for(const file of [...names.map(n=>ROOT+'/src/'+n+'.c'),ROOT+'/src/exploration-viewer.c',ROOT+'/src/battle-party-video.c',...generated])inputs.push({path:file.slice(ROOT.length+1),sha256:hash(await fs.readFile(file))});
const report={scope:'Actual combined link experiment; inert entry and unchanged diagnostic bank assignments. Not executable integration evidence.',evidence,inputs,exitCode,linkOverflow:overflow,fixedWramEnd:fixedEnd,fixedWramOverflow:fixedEnd!==null&&fixedEnd>0xd000,fixedRomEnd,fixedRomOverflow:fixedRomEnd!==null&&fixedRomEnd>0x4000,overlapWarnings,roundtripReady:false,log:out+'/link.log'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,inputs:inputs.length},null,2));
check(exitCode===0||overflow,'Link failed for a reason other than a reviewed capacity conflict; inspect raw log');
