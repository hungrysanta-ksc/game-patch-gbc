// Source-ROM metadata and bounded decoders. No copyrighted payload is embedded.
import {check,hash} from './source.mjs';

export function validateCoverage(spec,size){
 const rows=[...spec.regions,...spec.unclassified].sort((a,b)=>a.begin-b.begin),ids=new Set();let at=16;
 for(const r of rows){check(!ids.has(r.id),'Duplicate region '+r.id);ids.add(r.id);
  check(Number.isInteger(r.begin)&&Number.isInteger(r.end)&&r.end>r.begin&&r.end<=size,'Invalid region '+r.id);
  check(r.begin===at,'Coverage gap or overlap at '+at.toString(16));at=r.end;
 }
 check(at===size,'Incomplete ROM coverage');return rows;
}
export function bankSpans(begin,end){const result=[];for(let at=begin;at<end;){const bank=(at-16)>>>13,next=Math.min(end,16+(bank+1)*8192);
 result.push({bank,offset:(at-16)&8191,bytes:next-at});at=next;}return result;}
export function decodeRle(rom,begin,end,size){
 check(begin>=16&&begin<end&&end<=rom.length,'RLE pointer outside region');
 const data=Buffer.alloc(size);let at=begin,n=0;
 while(n<size){check(at<end,'Truncated RLE literal');const b=rom[at++];let count=1;
  if(b&128){check(at<end,'Truncated RLE count');count=rom[at++]||256;}
  check(n+count<=size,'RLE exceeds output');data.fill(b&127,n,n+count);n+=count;
 }return {data,end:at};
}
export function decodeEvent(rom,pointer){
 // C000 is fixed PRG code, NOT the next physical bank in the event-data pair.
 check(pointer>=0x8000&&pointer<0xc000,'Event pointer outside event-data bank pair');
 const begin=0x58010+pointer-0x8000;let at=begin;const commands=[];
 for(let guard=0;guard<4096;guard++){
  check(at<0x5c010,'Event exceeds bank pair');const offset=at,op=rom[at++];
  const length=op===0xfe||(op>=0xe4&&op<=0xfc)?2:1;
  if(length===2){check(at<0x5c010,'Missing event operand');at++;}
  commands.push({offset,op,...(length===2?{operand:rom[at-1]}:{})});
  if(op===255)return {begin,end:at,commands};
 }throw Error('Event has no bounded terminator');
}
export function conditional(rom,pointer,skip=0){
 check(pointer>=0x8000&&pointer+64<=0xc000,'Conditional copy outside source bank pair');
 const begin=0x58010+pointer-0x8000;let at=begin+skip;const clauses=[];
 while(at<begin+64){const conditions=[];
  while(at<begin+64&&rom[at]!==255)conditions.push(rom[at++]);
  check(at+1<begin+64,'Conditional lacks bounded result');at++;
  clauses.push({conditions,result:rom[at++]});
  if(!conditions.length)return {begin,end:at,clauses};
 }throw Error('Conditional lacks fallback');
}
export function evaluateConditional(script,flags){
 for(const c of script.clauses)if(c.conditions.every(v=>!!(flags[(v&127)>>>3]&(1<<(v&7)))===!!(v&128)))return c.result;
 throw Error('No matching conditional');
}
export function record(rom,id,begin,end,extra={}){check(begin>=16&&end>begin&&end<=rom.length,'Record boundary '+id);return {id,begin,end,bytes:end-begin,sha256:hash(rom.subarray(begin,end)),...extra};}

// These denominators are table capacity, not a claim of gameplay reachability.
export const populations=[
 ['normalMapProperties',0x4010,512,16,'3E/CBA4'],['mapGraphicsSets',0xe10,48,16,'3E/CBA4'],
 ['mapTilesets',0x2390,7,512,'3E/CBA4'],['formations',0x5c010,512,2,'34/9CE3'],
 ['monsters',0x60010,256,16,'31/A482'],['monsterAi',0x61210,64,8,'31/A5BA'],
 ['weapons',0x61410,88,8,'31/AA16'],['armor',0x616d0,64,8,'31/AA16'],
 ['attacks',0x618d0,115,8,'31/AF77'],['jobs',0x72010,22,8,'3D/AB8F'],
 ['levelThresholds',0x720c0,98,3,'39/A0B0'],['jobGrowth',0x721e6,2156,2,'3D/ADF2'],
 ['bossTilemaps',0x54010,24,216,'2A/8000'],
 ['terrainPacked',0x225e,256,1,'35/AAC3'],
 ['battleAlgorithms',0x61e86,10,2,'30/9E58'],['attackEffects',0x63aac,57,2,'31/B15F'],
 ['windowX',0x7aB07,38,1,'3D/AAF7'],['windowY',0x7ab2d,38,1,'3D/AB1D'],
 ['windowWidth',0x7ab53,38,1,'3D/AB43'],['windowHeight',0x7ab79,38,1,'3D/AB69']
];
