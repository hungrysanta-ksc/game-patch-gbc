// Deterministic local registry. Requires only the supported original ROM and
// project-authored metadata; development disassembly is not a build dependency.
import fs from 'node:fs/promises';
import {ROOT,input,check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {validateCoverage,bankSpans,decodeRle,decodeEvent,conditional,evaluateConditional,record,populations} from './registry-core.mjs';
const {data:rom,profile}=await input(),spec=JSON.parse(await fs.readFile(ROOT+'/spec/data-registry.json','utf8'));
const coverage=validateCoverage(spec,rom.length),u16=at=>rom.readUInt16LE(at),edges=[],failures=[],unresolved=[];
const regions=coverage.map(r=>({...r,...record(rom,r.id,r.begin,r.end),banks:bankSpans(r.begin,r.end)}));
// Include every pre-existing fixed population, keeping aliases by source offset.
const definitions=[...populations];
for(const [id,begin,count,stride] of profile.tables){const known=definitions.find(x=>x[1]===begin);
 if(known)check(known[2]===count&&known[3]===stride,'Conflicting fixed population '+id);
 else definitions.push([id,begin,count,stride,'spec/source.json; consumer pending']);
}
const tables=definitions.map(([id,begin,count,stride,anchor])=>{
 check(spec.regions.some(r=>begin>=r.begin&&begin+count*stride<=r.end),'Population outside registered region: '+id);
 return {id,begin,count,stride,anchor,status:'bounded-slots; semantics-require-consumer-validation',entries:Array.from({length:count},(_,i)=>record(rom,id+':'+i,begin+i*stride,begin+(i+1)*stride))};
});
// Register every physical pointer slot, even where the reference does not yet
// establish its address space/selector. Never interpret a raw word as an offset.
const pointerTables=[...spec.regions.filter(r=>r.kind==='pointer-table'),
 {id:'embedded-battle-algorithms',label:'battle algorithm dispatch',begin:0x61e86,end:0x61e9a},
 {id:'embedded-attack-effects',label:'attack effect dispatch',begin:0x63aac,end:0x63b1e}].map(r=>{
 check((r.end-r.begin)%2===0,'Odd pointer table '+r.id);
 const contracts={0x22010:'relative-to-22010; all layouts compared with original decoder',0xd010:'relative-to-D010; all world rows compared with original decoder',
  0x58610:'CPU 8000..BFFF in banks 2C/2D; FE/FF target fixed code and remain unsupported',
  0x58890:'8-bit doubled index selects 128 slots; 96 non-null; upper 128 physical slots not selected by E6C6',
  0x58210:'CPU banks 2C/2D; NPC 00..DF conditional; E0..E2 inn; E3..FF shop/fat-chocobo contract pending',
  0x58810:'CPU banks 2C/2D; 48 item conditionals skip first byte',0x58870:'CPU banks 2C/2D; 8 guest conditionals',
  0x58880:'CPU banks 2C/2D; 8 conditionals return song IDs, not event IDs'};
 return {region:r.id,label:r.label,begin:r.begin,end:r.end,status:contracts[r.begin]?'see-target-contract':'raw-u16-slots; target-contract-pending',targetContract:contracts[r.begin],slots:Array.from({length:(r.end-r.begin)/2},(_,id)=>({id,word:u16(r.begin+id*2)}))};
});
function attempt(id,fn){try{return fn();}catch(e){failures.push({id,error:e.message});return {id,error:e.message};}}
function until(c,start,stop){c.pc=start;for(let i=0;i<200000;i++){if(c.pc===stop)return;c.step();}throw Error('Original-code budget exceeded');}
const layouts=Array.from({length:256},(_,id)=>attempt('layout:'+id,()=>{
 const begin=0x22010+u16(0x22010+id*2);check(begin>=0x22210,'Layout targets pointer table');
 const d=decodeRle(rom,begin,0x30010,1024),c=new Driver6502(rom);
 c.m.set(rom.subarray(begin,d.end),0x5000);c.m[0x81]=0x50;c.m[0x83]=0x74;c.call(0xcbfa);
 check(d.data.equals(Buffer.from(c.m.subarray(0x7400,0x7800))),'Original CBFA mismatch');
 return record(rom,'layout:'+id,begin,d.end,{decodedSha256:hash(d.data),originalDecoder:'3E/CBFA',decodedBytes:1024});
}));
const worlds=Array.from({length:1024},(_,id)=>attempt('world-row:'+id,()=>{
 const begin=0xd010+u16(0xd010+id*2);check(begin>=0xd810,'World row targets pointer table');
 const d=decodeRle(rom,begin,0x13410,256),c=new Driver6502(rom);
 // World IDs 0 and 1 alias the first 256-row table (3E/CC42).
 c.m[0x78]=(id>>>8)+1;c.m[0x2c]=id&255;c.m[0x30]=4;c.call(0xcc47);
 check(d.data.equals(Buffer.from(c.m.subarray(0x7400,0x7500))),'Original CC47 mismatch');
 return record(rom,'world-row:'+id,begin,d.end,{decodedSha256:hash(d.data),originalDecoder:'3E/CC47',decodedBytes:256});
}));
const maps=Array.from({length:512},(_,id)=>{
 const layout=rom[0xa10+id],graphics=rom[0xc10+id],tileset=rom[0x4010+16*id]>>>5;
 check(graphics<48&&tileset<7,'Map reference out of range');
 for(const [type,to] of [['layout',layout],['mapGraphicsSets',graphics],['mapTilesets',tileset]])edges.push({from:'normalMapProperties:'+id,to:type+':'+to,basis:'source-record'});
 return {id,layout,graphics,tileset};
});
const ai=Array.from({length:256},(_,id)=>attempt('monster-ai:'+id,()=>{
 const index=rom[0x60010+id*16+14];check(index<64,'Monster AI outside 64-slot region');
 const c=new Driver6502(rom);c.banks=[0x30,0x31,0x3e,0x3f];c.m[0x24]=(id*16)&255;c.m[0x25]=0x80+(id>>>4);c.m[0x5d]=0;c.m[0x5e]=0x60;
 until(c,0xa5ba,0xa5ec);
 check(Buffer.from(c.m.subarray(0x6038,0x6040)).equals(rom.subarray(0x61210+index*8,0x61218+index*8)),'Original AI copy mismatch');
 edges.push({from:'monsters:'+id,to:'monsterAi:'+index,basis:'31/A5BA..A5EA original-code comparison'});return {id,index};
}));
const conditions=[];
for(const [family,begin,count,skip] of [['npc',0x58210,512,0],['trigger',0x58890,128,0],['guest',0x58870,8,0],['item',0x58810,48,1],['music',0x58880,8,0]]){
 for(let id=0;id<count;id++){
  if(family==='npc'&&(id&255)>=224)continue; // Inn/shop records are a different format.
  const pointer=u16(begin+id*2);
  if(family==='trigger'&&pointer===0){conditions.push({id,family,pointer,status:'null-slot; gameplay-reachability-pending'});continue;}
  conditions.push(attempt(family+':'+id,()=>{
   const s=conditional(rom,pointer,skip),variants=[new Uint8Array(16),new Uint8Array(16).fill(255)];
   for(const clause of s.clauses){const flags=new Uint8Array(16);for(const v of clause.conditions)if(v&128)flags[(v&127)>>>3]|=1<<(v&7);variants.push(flags);}
   for(const flags of variants){const c=new Driver6502(rom);c.banks=[0x3c,0x3d,0x3e,0x3f];c.m.set(rom.subarray(s.begin,s.begin+64),0x7b00);c.m.set(flags,0x6020);c.call(skip?0x92ee:0x9319);
    check(c.m[0x6c]===evaluateConditional(s,flags),'Original conditional mismatch');}
   for(const clause of s.clauses)edges.push({from:family+':'+id,to:(family==='music'?'song:':'event:')+clause.result,basis:'conditional-result; not gameplay reachability'});
   return {id,family,pointer,...s,comparisonCases:variants.length,status:'syntax-and-sampled-original-code-match'};
  }));
 }
}
const inns=[];for(const world of [0,1])for(let id=0xe0;id<=0xe2;id++){
 const pointer=u16(0x58210+(world*256+id)*2);check(pointer>=0x8000&&pointer+64<=0xc000,'Inn pointer out of range');
 const event=rom[0x58010+pointer-0x8000+1];inns.push({world,id,pointer,event});edges.push({from:'inn:'+world+':'+id,to:'event:'+event,basis:'3C/8ED0 reads copied record byte 1'});
}
// Exhaustively verify the selector's 8-bit wrap; the upper 128 physical words
// are not additional selectable trigger scripts.
const triggerSelectors=Array.from({length:256},(_,id)=>attempt('trigger-selector:'+id,()=>{
 const c=new Driver6502(rom);c.a=id;until(c,0xe6c6,0xe6d7);
 const selected=(id*2)&255,pointer=u16(0x58890+selected);
 check((c.m[0x82]|c.m[0x83]<<8)===pointer,'Original trigger selector mismatch');return {id,slot:selected>>>1,pointer};
}));
const events=Array.from({length:256},(_,id)=>attempt('event:'+id,()=>{
 const pointer=u16(0x58610+id*2),c=new Driver6502(rom);c.a=id;c.call(0xc72c);
 check((c.m[0x72]|c.m[0x73]<<8)===pointer,'Original event selector mismatch');
 const incoming=edges.filter(e=>e.to==='event:'+id).map(e=>e.from);
 if(id>=254){check(pointer===0xc000,'Changed exceptional event pointer');check(incoming.length===0,'Unsupported event now has a static incoming reference');
  unresolved.push({id:'event-'+id,kind:'unsupported-target',pointer,physicalTarget:0x7c010,incoming,
   conclusion:'Fixed-bank code target; no incoming edge in decoded conditionals/inns. Not proof of normal-play unreachability.',next:'Trace event selection and mutable RAM through normal gameplay; do not decode C000 as event data.'});
  return {id,pointer,status:'unsupported-fixed-code-target',incoming};
 }
 return {id,pointer,...decodeEvent(rom,pointer),incoming,status:'bounded-syntax; runtime-handler-coverage-pending'};
}));
unresolved.push(
 {id:'trigger-null-reachability',kind:'reachability',slots:conditions.filter(x=>x.family==='trigger'&&x.pointer===0).map(x=>x.id),next:'Reproduce tile initialization and map trigger count selection for all layouts, then world trigger paths. Never follow a null pointer.'},
 {id:'unclassified-terrain-tail',kind:'source-boundary',ranges:spec.unclassified,next:'Terrain consumer reads 256 packed bytes, leaving 16 bytes before item multipliers. Identify other consumers before reusing or discarding.'},
 {id:'remaining-consumer-contracts',kind:'semantic-coverage',next:'Resolve unvalidated pointer address spaces, shops, text/control codes, encounter and graphics loaders before converting their payloads.'},
 {id:'normal-play-reachability',kind:'runtime',next:'Static edges overapproximate conditions; verify progression/state/RNG/save with original execution traces.'}
);
const summary={registeredRegions:spec.regions.length,unclassifiedBytes:spec.unclassified.reduce((n,r)=>n+r.end-r.begin,0),coveredPrgBytes:coverage.reduce((n,r)=>n+r.end-r.begin,0),normalizedReferenceRows:spec.regions.filter(r=>r.correction).length,
 fixedPopulations:tables.length,fixedSlots:tables.reduce((n,t)=>n+t.count,0),pointerTables:pointerTables.length,physicalPointerSlots:pointerTables.reduce((n,t)=>n+t.slots.length,0),mapReferences:maps.length,
 layoutComparisons:layouts.filter(x=>!x.error).length,worldRowComparisons:worlds.filter(x=>!x.error).length,monsterAiComparisons:ai.filter(x=>!x.error).length,monsterAiDistinct:new Set(ai.map(x=>x.index)).size,monsterAiTailReferences:ai.filter(x=>x.index>=49),
 conditionalSlots:conditions.filter(x=>x.clauses).length,conditionalComparisonCases:conditions.reduce((n,x)=>n+(x.comparisonCases??0),0),triggerSelectorComparisons:triggerSelectors.filter(x=>!x.error).length,triggerNonNullSlots:conditions.filter(x=>x.family==='trigger'&&x.clauses).length,
 eventSyntaxSlots:events.filter(x=>x.commands).length,unsupportedEventSlots:events.filter(x=>x.status==='unsupported-fixed-code-target').length,referenceEdges:edges.length,validationFailures:failures.length,openIssues:unresolved.length};
const report={schema:1,scope:'Full PRG region registry; partial semantic/reference closure. Not a complete game extractor or gameplay proof.',sourceSha256:profile.sha256,specSha256:hash(await fs.readFile(ROOT+'/spec/data-registry.json')),summary,regions,tables,pointerTables,maps,layouts,worlds,ai,conditions,inns,triggerSelectors,events,edges,unresolved,failures};
await fs.mkdir(ROOT+'/build/analysis',{recursive:true});await fs.writeFile(ROOT+'/build/analysis/data-registry.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));check(!failures.length,'Registry validation failed; inspect build/analysis/data-registry.json');
if(process.argv.includes('--require-closed'))check(!unresolved.length,'Semantic/reachability closure is incomplete');
