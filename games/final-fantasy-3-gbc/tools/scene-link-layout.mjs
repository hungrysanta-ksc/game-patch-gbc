import {check,hash} from './source.mjs';
// All ordinary DATA is assigned by lifetime, never by symbol size guesses.
// INITIALIZED bytes stay common. Absolute bank-1 workspace remains phase-owned.
export const commonModules=['scene-video','scene-memory','scene-loop','platform','platform-boot','platform-probe','game-state','game-save','memory','memory-probe','audio-control','audio-channel','audio-music','audio-engine','audio-output','audio-native','text-vblank'];
export const fieldModules=['field-restore','assets','map-display','field-objects','text-window','npc-dialogue','exploration','field-encounter','npc-motion','exploration-render','exploration-video','exploration-viewer'];
export const battleModules=['battle-physical','battle-fight','battle-result','battle-command','battle-live-command','battle-end','battle-defeat-video','battle-death','battle-death-video','battle-cell-pool','battle-live-stone','battle-dense-oam','battle-encounter','battle-context','battle-live-party','battle-equipment-stats','battle-entry','battle-party-oam','battle-party-video','battle-magic-frames','battle-magic-video','battle-hit-video','battle-animation','battle-numerals','battle-animation-video','battle-effect-freeze','battle-motion-sprites','battle-strike-video','battle-bow-video','battle-thrown-video','battle-action-oam','battle-live-ui','battle-message','battle-script','battle-script-video','battle-entry-tail','battle-status-oam','battle-status-video','battle-resident-bg','battle-terrain'];
export const overlayBase=0xca80,fieldBankDelta=64;
export function parseSymbols(text){return Object.fromEntries([...text.matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi)].map(m=>[m[1],Number(m[2])]));}
export function relocateField(banks,counts,offsets){
 check(banks.has(12)&&counts.length===offsets.length,'Field directory');
 const out=new Map(),directory=Buffer.from(banks.get(12)),before=Buffer.from(directory);let entries=0;
 for(let k=0;k<counts.length;k++){
  check(offsets[k]===entries*5,'Contiguous generated descriptor groups');
  for(let i=0;i<counts[k];i++,entries++){
   const at=entries*5,bank=directory[at],offset=directory.readUInt16LE(at+1),length=directory.readUInt16LE(at+3);
   check(bank>=16&&bank+fieldBankDelta<128&&banks.has(bank)&&length>0&&offset+length<=16384,'Generated descriptor bounds');
   directory[at]=bank+fieldBankDelta;
  }
 }
 check(entries*5<=16384,'Directory capacity');
 for(const [bank,bytes]of banks){check(bytes.length===16384,'Complete field bank');out.set(bank===12?12:bank+fieldBankDelta,bank===12?directory:Buffer.from(bytes));}
 const changes=[];for(let i=0;i<16384;i++)if(before[i]!==directory[i]){check(i<entries*5&&i%5===0,'Only routing bytes relocate');changes.push(i);}
 check(changes.length===entries,'Every descriptor relocated');
 return {banks:out,entries,changedBytes:changes.length,payloads:[...banks].filter(([b])=>b!==12).map(([b,bytes])=>({from:b,to:b+fieldBankDelta,bytes:bytes.length,sha256:hash(bytes)}))};
}
export function checkSceneLayout(s){
 check(!Object.keys(s).some(k=>/^_+(malloc|calloc|realloc|aligned_alloc)$/.test(k)),'Heap allocator would alias the scene arena');
 for(const k of ['s__HEAP','s__FF3_FIELD','l__FF3_FIELD','s__FF3_BATTLE','l__FF3_BATTLE','s__INITIALIZER','l__INITIALIZER'])check(Number.isInteger(s[k]),'Missing linker area '+k);
 const commonEnd=s.s__HEAP,fieldBytes=s.l__FF3_FIELD,battleBytes=s.l__FF3_BATTLE;
 check(commonEnd<=overlayBase,'Common state overlaps scene arena');
 check(s.s__FF3_FIELD===overlayBase&&s.s__FF3_BATTLE===overlayBase,'Explicit shared scene address');
 const end=overlayBase+Math.max(fieldBytes,battleBytes);check(end<=0xd000,'Scene arena overflows fixed RAM');
 check(fieldBytes+3072<=4096,'Field suspension overflows WRAM 7');
 const romEnd=s.s__INITIALIZER+s.l__INITIALIZER;check(romEnd<=0x4000,'Fixed ROM overflow');
 for(const [k,v]of Object.entries(s))if(/^l__CODE_\d+$/.test(k))check(v<=16384,'Bank capacity '+k);
 for(const k of ['_ff3_game_state','_ff3_state','_native_queue','_native_consumed','_memory_bridge','_scene_arena_owner','_scene_video_owner'])check(s[k]>=0xc000&&s[k]<overlayBase,'Persistent owner escaped common RAM '+k);
 return {commonEnd,overlayBase,fieldBytes,battleBytes,fixedEnd:end,fixedFree:0xd000-end,suspensionBytes:fieldBytes+3072,fixedRomEnd:romEnd,fixedRomFree:0x4000-romEnd};
}
