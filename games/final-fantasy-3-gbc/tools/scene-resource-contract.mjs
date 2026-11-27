import fs from 'node:fs/promises';
import {ROOT,check,hash} from './source.mjs';

// Half-open offsets in physical WRAM banks. These are reviewed claims of
// EXISTING diagnostics, not a new allocator and not permission to use gaps.
const claim=(id,bank,begin,end,profiles,source)=>({id,bank,begin,end,bytes:end-begin,profiles,source});
export const storageClaims=[
 claim('field-suspension',7,0,4096,['scene-layout'],'src/scene-memory.c'),
 claim('audio-snapshots',2,0,464,['common'],'src/audio-native.c'),
 claim('effect-map-backup',3,0,1152,['effects','scene-layout'],'src/battle-effect-freeze.c'),
 claim('effect-oam-backup',3,1152,1312,['effects','scene-layout'],'src/battle-effect-freeze.c'),
 claim('effect-palette-backup',3,1312,1344,['effects','scene-layout'],'src/battle-effect-freeze.c'),
 claim('effect-frozen-patterns',3,2816,4096,['effects','scene-layout'],'src/battle-effect-freeze.c'),
 claim('effect-dependencies',4,0,608,['effects','scene-layout'],'src/battle-effect-freeze.c'),
 claim('magic-retained-patterns',4,1152,1408,['effects','scene-layout'],'src/battle-magic-video.c'),
 claim('effect-glyph-cache',4,1408,3280,['effects','scene-layout'],'src/battle-effect-freeze.c'),
 claim('item-equipment-state',5,1024,1280,['item-atlas'],'src/battle-item-flow.inc'),
 claim('atlas-saved-keys',6,1600,1856,['item-atlas'],'src/battle-atlas.c'),
 claim('window-cache-0',3,0,4080,['composition-window'],'src/composition-window.c'),
 claim('window-cache-1',4,0,4080,['composition-window'],'src/composition-window.c'),
 claim('window-cache-2',5,0,2080,['composition-window'],'src/composition-window.c'),
 claim('window-previous',6,0,798,['composition-window'],'src/composition-window.c'),
 claim('window-slots',6,800,1199,['composition-window'],'src/composition-window.c'),
 claim('window-attrs',6,1200,1599,['composition-window'],'src/composition-window.c'),
 claim('window-saved-keys',6,1600,1856,['composition-window'],'src/composition-window.c'),
 claim('legacy-cache-0',3,0,3072,['composition-cache'],'src/composition-cache.c'),
 claim('legacy-cache-1',4,0,3072,['composition-cache'],'src/composition-cache.c')
];
export const diagnosticProfiles=['exploration','effects','item-atlas','composition-window','composition-cache','scene-layout'];
export function conflicts(claims){
 const ids=new Set();for(const r of claims){check(!ids.has(r.id),'Duplicate resource '+r.id);ids.add(r.id);check(Number.isInteger(r.bank)&&r.bank>=2&&r.bank<=7&&Number.isInteger(r.begin)&&Number.isInteger(r.end)&&r.begin>=0&&r.begin<r.end&&r.end<=4096,'Invalid storage range '+r.id);}
 const found=[];for(let i=0;i<claims.length;i++)for(let j=i+1;j<claims.length;j++){
  const a=claims[i],b=claims[j];if(a.bank===b.bank&&a.begin<b.end&&b.begin<a.end)found.push({a:a.id,b:b.id,bank:a.bank,begin:Math.max(a.begin,b.begin),end:Math.min(a.end,b.end)});
 }return found;
}
export function claimsFor(profiles,claims=storageClaims){
 for(const p of profiles)check(diagnosticProfiles.includes(p),'Unknown diagnostic profile '+p);
 return claims.filter(r=>r.profiles.includes('common')||r.profiles.some(p=>profiles.includes(p)));
}
export function checkSuspension(profiles,reservations){return conflicts([...claimsFor(profiles),...reservations]);}
export function diagnosticStorage(){return Array.from({length:6},(_,i)=>({bank:i+2,
 claims:storageClaims.filter(r=>r.bank===i+2),
 availability:'Not an allocation grant. Diagnostic-specific claims; unclaimed gaps require the combined link and lifecycle review.'}));}

// Sources touching absolute placement, banked storage, or scene ownership are
// pinned for review. A new allocator or a changed indirect offset formula must
// not silently inherit this contract. This is deliberately not a C parser.
const ownerSources=['src/field-objects.c','src/platform.c','src/game-state.c','src/battle-live-ui.c','src/battle-workspace.h','src/scene-video.c'];
const placement=/__at\s*\(|ff3_wram_copy\s*\(|SVBK_REG|add_VBL\s*\(|remove_VBL\s*\(/;
export async function resourceSourceInventory(root=ROOT){
 const files=[],out=[];
 async function walk(dir){for(const e of await fs.readdir(root+'/'+dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())await walk(path);else if(e.isFile()&&/\.(c|h|inc)$/.test(e.name))files.push(path);}}
 await walk('src');
 for(const path of files.sort()){const bytes=await fs.readFile(root+'/'+path),text=bytes.toString('utf8');
  if(!placement.test(text)&&!ownerSources.includes(path))continue;
  const sites=text.split(/\r?\n/).flatMap((s,i)=>placement.test(s)?[{line:i+1,text:s.trim()}]:[]);
  out.push({path,sha256:hash(bytes),sites});
 }
 for(const path of ownerSources)check(out.some(s=>s.path===path),'Missing owner source '+path);
 return out;
}
export function checkResourceSources(actual,reviewed){
 check(actual.length===reviewed.length,'Resource source inventory changed; review new/removed owners');
 for(const a of actual){const b=reviewed.find(b=>b.path===a.path);check(b&&b.sha256===a.sha256,'Resource owner changed; review lifetime/claims: '+a.path);}
}

// Non-address ownership is just as important as free bytes. Each row states
// the required transition and its current limitation, not an implemented API.
export const lifecycleOwners=[
 {id:'game-state',lifetime:'boot/session',sources:['src/platform.c','src/game-state.c','src/inventory.c'],rule:'One canonical 1024-byte state. Commit battle changes; never restore the field entry snapshot over HP, inventory, equipment or event flags.',status:'Separate mains still initialize their own state.'},
 {id:'audio',lifetime:'boot/session',sources:['src/audio-native.c'],rule:'Initialize once; preserve timer/queue/producer across display changes. Use original song, fade and SFX requests.',status:'Each diagnostic currently calls native_begin; single-boot continuity pending.'},
 {id:'field-context',lifetime:'suspended across battle',sources:['src/exploration.c','src/field-objects.c','src/scene-memory.c'],rule:'Keep field position/facing, NPC and event continuation separate from mutable GameState. Rebuild display; do not call fresh field init on return.',status:'Combined DATA overlay at CA80; entire field DATA plus WRAM1 D000..DBFF preserved in bank 7. Controlled overwrite/restore tested; natural encounter context still pending.'},
 {id:'field-workspace',lifetime:'field display',sources:['src/map-display.h','src/exploration-video.c'],rule:'WRAM1 D000..DBFF is suspended separately from display ownership; DC00 OAM requires old DMA drained before reuse. Rebuild VRAM and OAM before resuming field publication.',status:'Combined storage assigned and memory roundtrip tested; same-boot display rebuild pending.'},
 {id:'battle-workspace',lifetime:'battle/display or bounded action',sources:['src/battle-workspace.h','src/battle-party-video.c','src/battle-animation-video.c','src/battle-stone.c'],rule:'D200..D4BF union reuse is phase-bound; D600 animation versus stone and DC00/DD00 OAM are not independent allocations.',status:'Effects/stone/boss remain incompatible diagnostic variants.'},
 {id:'fixed-ram-stack',lifetime:'whole executable',sources:['src/memory.c','src/platform.c'],rule:'Require one combined linker map plus measured minimum SP. Common state and initialized data cannot overlap the scene arena; no heap allocation in the shared address range.',status:'Combined effects/field link fits with explicit DATA lifetimes and cold code banks. Stack checked on each cold entry, not yet across an actual same-boot transition.'},
 {id:'vram',lifetime:'scene; some borrowed per action',sources:['src/battle-resident-bg.c','src/battle-effect-freeze.c','src/battle-magic-video.c'],rule:'Rebuild map/pattern/palette ownership at scene switch. Invalidate frozen dependencies and signed clone. Do not retain cache validity after VRAM replacement.',status:'Current reuse is inside one loaded battle only.'},
 {id:'publication',lifetime:'descriptor until consumption',sources:['src/text-vblank.c','src/scene-video.c','src/exploration-video.c','src/battle-party-video.c','src/battle-terrain.c'],rule:'Drain text pending/owner, field.pending/upload_pending, party_pending, and memory_busy before changing buffers or callback owner; keep audio service running.',status:'Shared attach/detach and drain API with fixed IRQ callbacks, automatic OAM stop and terrain LCD cleanup. Separate mains remain; scene/resource/gameplay roundtrip still pending.'},
 {id:'rom-assets',lifetime:'build/ROM',sources:['tools/build-text.mjs','tools/build-battle-party-oam.mjs','tools/build-scene-layout.mjs'],rule:'Reuse converted immutable assets in ROM. Field/battle bank assignments must be linked together, not concatenated.',status:'Combined ROM relocates 36 field payload banks to 80..115 and changes only descriptor bank bytes. Battle/audio arrays remain exact. Development builder currently consumes the two generated diagnostics.'},
 {id:'destructive-probe',lifetime:'isolated diagnostic only',sources:['src/memory-probe.c'],rule:'Writes banks 2..7 and snapshots field/GameState into 3/4. Must never run while battle caches or persistent suspension are live.',status:'Combined build explicitly rejects the destructive probe without storage writes; isolated diagnostic remains available.'}
];
export function resourceReport(sources){
 const profiles=diagnosticProfiles.map(profile=>({profile,claims:claimsFor([profile]),conflicts:conflicts(claimsFor([profile]))}));
 for(const p of profiles)check(p.conflicts.length===0,'Existing diagnostic storage overlap: '+p.profile);
 return {schema:1,scope:'Storage claims and source ownership audit; executable combined layout is checked separately by build/verify-scene-layout. Not an executed gameplay scene switch.',sources,profiles,storage:diagnosticStorage(),lifecycleOwners,
  rejectedOldFieldReservation:checkSuspension(['effects'],[{id:'obsolete-field-snapshot',bank:3,begin:0,end:4096}]),
  rejectedLegacyCompositionMix:conflicts(claimsFor(['effects','composition-window','item-atlas'])),
  roundtripReady:false,unresolved:['Natural original encounter/return trace including NPC and event context','Same-boot stack and VRAM rebuild/invalidation across the combined field/effects allocation; other battle variants still separate','Single boot/audio and resource handoff using the verified drained video boundary','Live party/formation/result bridge and same-boot second encounter']};
}
