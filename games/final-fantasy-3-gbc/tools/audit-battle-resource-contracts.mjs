import fs from 'node:fs/promises';
import {ROOT,input} from './source.mjs';
import {formationRecords,monsterRecords,eventBattleRecords,specialFormationRules,jumpContracts,bossAiContracts,uiResourceContract} from './battle-resource-contracts.mjs';
const {data,profile}=await input();
const formations=formationRecords(data),monsters=monsterRecords(data),events=eventBattleRecords(data),rules=specialFormationRules(data),jump=jumpContracts(data);
const ui=uiResourceContract(data);
const ai=bossAiContracts(data);
const report={sourceSha256:profile.sha256,formations,monsters,events,rules,jump,ai,ui,
 focus:[0xd5,0xd7,0xd8].map(id=>({monster:id,formations:formations.filter(f=>f.monsters.includes(id)).map(f=>f.id),calls:events.calls.filter(c=>c.candidates.some(f=>formations[f].monsters.includes(id)))})),
 unresolved:['Event-switch/world/flags reachability for every F7 call; candidates are not a playthrough','Non-F7 entrances: random encounters, trapped chests and direct callers','Boss script target selection, spell effects and jump avoidance in a complete turn','All job/result/status window combinations in resident GBC renderer','Boss changed-cell allocation coexisting with Korean glyphs, stone, numbers and effects','GBC timing/audio: no runtime change or new performance claim']};
const dir=ROOT+'/evidence/battle-resource-contracts';await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({formations:formations.length,monsters:monsters.length,events:events.events.length,battleCalls:events.calls.length,uniqueCalls:new Set(events.calls.map(c=>c.offset)).size,specialRules:rules.filter(r=>r.restoreHpHigh||r.skipVictory||r.clearDefeat),jump,windows:ui.windows.length,bossProfiles:ui.bossEntry.length,bossSteps:ui.bossEntry.reduce((n,b)=>n+b.steps,0),actionFlows:ui.actionFlows.map(f=>({back:f.back,enemy:f.enemy,screens:f.screens,events:f.events.length})),focus:report.focus.map(f=>({monster:f.monster,formations:f.formations,events:f.calls.map(c=>c.event)})),unresolved:report.unresolved},null,2));
