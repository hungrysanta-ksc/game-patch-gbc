import {check} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {sourceInitialState,segment} from './state-source.mjs';
import {mapSelection} from './map-assets.mjs';
import {conditional,decodeEvent,evaluateConditional} from './registry-core.mjs';
import {denseCases} from './render-budget-source.mjs';
import {tallScene} from './render-budget-pixels.mjs';
import {npcOriginal,npcSprites} from './npc-motion-source.mjs';
import {eventOriginal} from './event-motion-source.mjs';

export function denseTriggerContext(rom,assets,world,map){
 const s=mapSelection(world,map),p=assets.groups.properties[s.property],layout=assets.groups.selection[s.selection][0],c=new Driver6502(rom);
 c.banks=[58,59,62,63];c.m.set(sourceInitialState(rom),0x6000);c.m.set(p,0x780);c.m.set(assets.groups.layout[layout],0x7400);c.m[0x78]=world;c.call(0x918a);
 // Original tile initialization assigns trigger indexes; a raw $60 tile alone
 // cannot identify the corresponding script. Read the resulting $0500/$0720.
 const rows=[];for(let i=0;i<1024;i++){
  const tile=c.m[0x7400+i],property=c.m[0x500+tile];if((property&240)!==240)continue;
  const id=c.m[0x720+(property&15)],pointer=rom.readUInt16LE(0x58890+((id*2)&255));check(pointer!==0,'Used trigger has null script');const script=conditional(rom,pointer),checks=[];
  const bits=[...new Set(script.clauses.flatMap(r=>r.conditions.map(v=>v&127)))];check(bits.length<=10,'Trigger truth-table bound');
  for(let mask=0;mask<2**bits.length;mask++){
   const flags=Buffer.alloc(16);bits.forEach((b,j)=>{if(mask&(1<<j))flags[b>>3]|=1<<(b&7);});
   const q=new Driver6502(rom);q.a=id;segment(q,0xe6c6,0xe6d7);check((q.m[0x82]|q.m[0x83]<<8)===pointer,'Original trigger pointer');q.call(0xea1b);
   q.banks=[60,61,62,63];q.m.set(flags,0x6020);q.call(0x9319);check(q.m[0x6c]===evaluateConditional(script,flags),'Original trigger condition');checks.push({flags:flags.toString('hex'),event:q.m[0x6c]});
  }
  rows.push({x:i%32,y:i>>5,tile,id,pointer,clauses:script.clauses,checks});
 }
 return {world,map,triggerList:p[15],rows,scope:'Original map initialization and conditional consumer; no new-game route or victory simulation'};
}
function field(r){const f=Buffer.alloc(75);f[0]=(r.x/2-3)&63;f[1]=(r.y/2-3)&63;f[2]=8;f[4]=8;f[19]=1;f[23]=r.world;return f;}
function sourceScene(rom,assets,r,state,f,reverse=false){
 const groups=[];for(let n=0;n<12;n++){const slot=reverse?11-n:n,k=slot*16;if(!state.part1[k])continue;const id=state.part1[k+10],gfx=assets.groups.npcSelection[0][id+(r.world>=2?256:0)];
  const quads=npcSprites(rom,f,state.part1,state.part2,k).map(([x,y,tile,attr])=>({x:x+r.x*8,y:y+r.y*8,h:8,tile:(tile-k)&255,attr,gfx,slot,npc:id}));if(quads.length)groups.push(quads);
 }
 // Reuse source pixel decoding without imposing the rejected 8x16 candidate's
 // capacity on a new state. Only the original 8x8 quads are consumed below.
 const scenes=groups.map(g=>tallScene(assets,{...r,groups:[g]}));
 return {...tallScene(assets,{...r,groups:[]}),original:scenes.flatMap(s=>s.original)};
}
export function compositionCases(rom,assets){
 const dense=denseCases(rom,assets).filter(r=>r.flags===0),cases=[],contexts=dense.map(r=>denseTriggerContext(rom,assets,r.world,r.map));
 check(sourceInitialState(rom).subarray(0x80,0xc0).equals(rom.subarray(0x1610,0x1650)),'Original new-game NPC switch bytes');
 const add=(r,state,f,label,evidence,reverse=false)=>cases.push({label,world:r.world,map:r.map,camera:[r.x,r.y],evidence,scene:sourceScene(rom,assets,r,state,f,reverse)});
 for(const r of dense){add(r,r.state,field(r),'initial-'+r.world+'-'+r.map,{consumer:'3B/B2FD + B1EE',kind:'initial flags at diagnostic map entry'});}
 for(const r of [dense[1],dense[4]])add(r,r.state,field(r),'reverse-'+r.world+'-'+r.map,{consumer:'B1EE',kind:'alternate OBJ order stress input'},true);
 // Event $51 hides slots 4..11 after its battle. Execute each original ACD1
 // command against loaded source states, without pretending to simulate battle.
 const r=dense.find(r=>r.world===2&&r.map===87),f=field(r),s=mapSelection(r.world,r.map),p=assets.groups.properties[s.property],layout=assets.groups.layout[assets.groups.selection[s.selection][0]],terrain=assets.groups.collision[p[0]>>5];
 const event=decodeEvent(rom,rom.readUInt16LE(0x58610+81*2)),hide=event.commands.filter(c=>c.op<192&&(c.op&15)===9);check(hide.length===8,'Original event 81 hide sequence');let state=r.state;
 for(const cmd of hide){const before=Buffer.from(state.part1),e=eventOriginal(rom,10,f,state.part1,state.part2,Buffer.from([0,cmd.op,0,0,0]),cmd.offset-0x58010+1,1,layout,terrain,p[3]);state={part1:e.part1,part2:e.part2};check(before[cmd.op&240]!==0&&state.part1[cmd.op&240]===0,'Original hide state');add(r,state,f,'event81-hide-'+(cmd.op>>4),{event:81,offset:cmd.offset,opcode:cmd.op,consumer:'3B/ACD1',precondition:'Battle returned; player movement/battle are not simulated'});}
 add(r,r.state,f,'reload-2-87',{consumer:'3B/B2FD',kind:'original loader state restored, not story undo'});
 // Event $62 contains a slot-0 move right. Sample the actual original pixel
 // progression; these inputs test composition, not the full event playthrough.
 const m=dense.find(r=>r.world===0&&r.map===139),mf=field(m),ms=mapSelection(m.world,m.map),mp=assets.groups.properties[ms.property],ml=assets.groups.layout[assets.groups.selection[ms.selection][0]],mt=assets.groups.collision[mp[0]>>5];
 const move=decodeEvent(rom,rom.readUInt16LE(0x58610+98*2)).commands.find(c=>c.op===0);check(move,'Original event 98 slot-0 move');
 let moving=eventOriginal(rom,10,mf,m.state.part1,m.state.part2,Buffer.from([0,0,0,0,0]),move.offset-0x58010+1,1,ml,mt,mp[3]);
 check(moving.part1[12]!==0,'Source move started');let tick=0;
 while(moving.part1[12]){check(tick<64,'Source move completion');mf[32]=++tick;moving=npcOriginal(rom,7,mf,moving.part1,moving.part2,ml,mt,mp[3]);if([1,4,8,12,16].includes(tick)||!moving.part1[12])add(m,moving,mf,'event98-move-'+tick,{event:98,offset:move.offset,tick,consumer:'3B/ACD1 + B17C + B1EE',kind:'command-boundary input; earlier player movement not simulated'});}
 add(m,m.state,field(m),'reload-0-139',{consumer:'3B/B2FD',kind:'original loader state restored'});
 return {cases,contexts};
}
