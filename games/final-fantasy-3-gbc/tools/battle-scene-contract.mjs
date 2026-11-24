// Planning coverage, not rendering evidence. Consumers are bank/CPU addresses.
// Each graphics dispatch belongs to one family; special entry points remain
// explicit because a dispatch-table census cannot establish whole-game closure.
export const sceneFamilies=[
 {id:'entry',graphics:[0],source:['2E/9D5F','2F/B469','2F/AD53','2F/AE5E','2F/BE97'],videoSeconds:[[9.5,11]],coexist:['terrain','party','enemies','party-hp'],handoff:'field cache -> battle CHR/maps/palettes; enemy/menu scroll and terrain mask, boss CHR movement; canonical party coordinates then back-attack flip'},
 {id:'selection',graphics:[1,2,3,4,5,6,7,8,9,14,15,16],source:['2F/B304','2F/B2FA','34/8ADF','34/8EB0','32/9F11'],videoSeconds:[[11,18],[55,61]],coexist:['terrain','party','enemies','party-hp','command-or-item-or-spell-list','cursor','target-markers','status'],handoff:'forward/back/row/confused poses; list replacement, cancellation and restoration'},
 {id:'enemy-change',graphics:[10,11,12,13],source:['2F/B33E','2F/B343','2F/B348','2F/B34D'],videoSeconds:[[24,26],[74,76]],coexist:['terrain','party','enemies','party-hp','action-windows','residual-digits'],handoff:'death, summon, split, flee update enemy map and target slots'},
 {id:'end',graphics:[17],source:['2F/B260','34/8074','35/BB49','34/8306'],videoSeconds:[[76,84]],coexist:['terrain','party','party-hp','result-or-level-windows'],handoff:'victory/defeat, reward/level text, state copy-back; outer field restoration unresolved'},
 {id:'physical',graphics:[18,32],source:['2F/B24F','2F/B005','33/A094'],videoSeconds:[[18,25],[61,69],[73,76]],coexist:['terrain','party','enemies','party-hp','action-windows','weapon-or-unarmed-hit'],handoff:'actor step/CHR, hand and hit sequence, return pose; then damage'},
 {id:'status-targets',graphics:[19],source:['34/8185','32/9F11','32/9F71'],videoSeconds:[[11,18]],coexist:['party','status','target-markers','cursor','party-hp'],handoff:'refresh can run during message waits; AC gate and actor cycling must be preserved'},
 {id:'reaction',graphics:[20,31],source:['2F/B201','2F/B024','33/A8B8'],videoSeconds:[[26,29],[32,35],[40,45]],coexist:['terrain','party','enemies','party-hp','action-windows','flash-or-flinch'],handoff:'enemy palette flash -> party hit -> digits/HP/status; not one permanent overlay'},
 {id:'defend',graphics:[21],source:['2F/B246','33/ABF7'],videoSeconds:[[49,51]],coexist:['party','party-hp','action-windows','guard-pose'],handoff:'guard pose and subsequent pose restoration'},
 {id:'job-actions',graphics:[22,23,24,25,26,27],source:['2F/B1D8','2F/B1E0','2F/B1CF','2F/B1C1','2F/B1B5','2F/B1AF'],videoSeconds:[],coexist:['party','enemies','party-hp','action-windows','job-effect'],handoff:'buildup/overload/jump/scare/cheer, offscreen actors and return'},
 {id:'digits',graphics:[28],source:['33/AD2B','33/AC4B','33/ACAA'],videoSeconds:[[19,25],[26,29],[70,72]],coexist:['party','enemies','terrain','party-hp','action-windows','damage-or-heal-or-miss'],handoff:'shared effect OAM is cleared on entry; digits remain after the 32-frame loop'},
 {id:'magic',graphics:[29],source:['2F/B15E','33/BAFD','33/B696','34/8411','31/A65E','35/A3BB'],videoSeconds:[],coexist:['party','enemies','terrain','party-hp','action-windows','cast-or-target-effect'],handoff:'eligibility -> target mask -> cast -> per-target or special body -> clear/reload digits; item CC flag changes cast/projectile path, preserves item message; reflection/Life still open'},
 {id:'summon',graphics:[30],source:['2F/B050','32/8115','32/8CEF','35/A09F'],videoSeconds:[],coexist:['summon-scene','action-windows','party-hp','conditional-hidden-party'],handoff:'logical all/random targets differ from visual full-screen range; CHR/map/scroll/palette/party restore required'},
 {id:'run',graphics:[33],source:['2F/AF24','33/BC89'],videoSeconds:[],coexist:['party','enemies','terrain','party-hp','action-windows'],handoff:'successful/failed escape have different restore and continuation paths'},
 {id:'transform',graphics:[34,35],source:['2F/AFFF','2F/AFE7','33/BE01','34/9D1D','2F/B5C3','2F/B6C8'],videoSeconds:[],coexist:['party','enemies','terrain','party-hp','action-windows','changed-form-or-palette','stone-party-bg'],handoff:'raw status -> pose/CHR cache -> confused movement or stone BG -> restored job/underlay; also persistent enemy tiles/palette'},
 {id:'cannon',graphics:[36],source:['2F/AF44','32/84C9','34/93C4'],videoSeconds:[],coexist:['terrain','party','enemies','party-hp','action-windows','cannon-scene'],handoff:'special action script and broad blast; not ordinary single-target magic'},
 {id:'cleanup',graphics:[37],source:['2F/AFD8'],videoSeconds:[],coexist:['party','enemies','terrain','party-hp'],handoff:'hide OAM $0200..$029F; preserve party $02A0..$02FF, commit clear before reuse'}
];
export const exceptionalConsumers=[
 {id:'final-boss',source:['2E/9F7E','10/8A00'],status:'body-and-callers-open',reason:'RAM trampoline enters a different bank; ordinary magic table coverage does not cover it'},
 {id:'field-return',source:['34/8306','34/8074'],status:'outer-caller-open',reason:'battle state copy-back located; field CHR/map/scroll/audio restoration caller not yet traced'},
 {id:'text-payloads',source:['34/905B','34/90A0','34/9177','34/91D4','34/91FE','34/956B'],status:'conditional-payloads-open',reason:'actor/action/target/status/result substitution and reachability must drive existing 7x7 Korean consumer'},
 {id:'audio-calls',source:['2F/AFC0','2F/B260','3F/FAE9'],status:'whole-transition-load-open',reason:'summon SFX table and end BGM found; all call sites and actual mixed display/audio deadlines not measured here'}
];
export const integrationScenarios=[
 {id:'entry-return',families:['entry','selection','end'],requires:['normal/back/surprise/boss ingress','battle initialization','field restoration and audio restart']},
 {id:'selection-worst',families:['selection','status-targets'],requires:['four original-size party poses','eight targets/status/cursor gates','item/spell page switch and cancel','live Korean names and HP']},
 {id:'weapon-results',families:['physical','digits','enemy-change','cleanup'],requires:['both hands and weapon families','all target anchors','hit/miss/status queue','shared effect allocation through explicit clear']},
 {id:'enemy-response',families:['reaction','digits','defend','job-actions','transform'],requires:['palette flash and party hit','critical/dead/confused/toad/mini/jump poses','stone party BG ownership and cure restoration','guard and row changes']},
 {id:'magic-results',families:['magic','digits','enemy-change','cleanup'],requires:['single/all/party targets','reflect/Life/invalid/cancel eligibility','item reservation/return/consume and special target eligibility','item CC cast/projectile path and item-name messages','cast-to-hit-to-digits load/restore','7x7 overlapping action windows']},
 {id:'summon-return',families:['summon','digits','cleanup'],requires:['24 variants and all/random target conditions','full-screen CHR/map/scroll/palette ownership','hidden party and damage-glyph restoration']},
 {id:'persistent-changes',families:['transform','enemy-change','selection'],requires:['enemy split/summon/flee/death','persistent palette/form changes','next selection references updated slots']},
 {id:'special-and-end',families:['cannon','run','end'],requires:['cannon and final-boss exception','victory/defeat/escape continuation','gil/CP/experience/level queues and state copy-back']}
];
export const integratedMetrics=[
 'complete-layer-and-lifetime-trace','logical-target-versus-visual-anchor',
 'obj-total-and-every-scanline','active-plus-next-bg-obj-patterns-and-palettes',
 'map-attributes-hangul-underlay-dirty-spans','wram-bank-owner-and-return',
 'prepare-deadline-and-first-eligible-vblank','original-order-duration-and-restored-pixels',
 'music-sfx-buffer-underrun-and-irq-lateness'
];
export function sceneCoverage(dispatch){
 const ids=sceneFamilies.flatMap(f=>f.graphics),entries=dispatch.tables.find(t=>t.id==='graphics').entries;
 if(ids.length!==entries.length||new Set(ids).size!==entries.length||entries.some(e=>!ids.includes(e.id)))throw Error('Graphics family coverage gap/duplicate');
 return {families:sceneFamilies.map(f=>({...f,consumers:f.graphics.map(id=>entries[id]),evidence:'source-mapped; integrated GBC scene not run'})),exceptions:exceptionalConsumers,scenarios:integrationScenarios.map(s=>({...s,status:'pending',missingMetrics:[...integratedMetrics]})),summary:{graphicsFamilies:sceneFamilies.length,graphicsSlots:ids.length,integratedScenarios:integrationScenarios.length,integratedPassed:0},budgetStatus:'OPEN: no whole-battle maximum or GBC fit established'};
}
