// Original consumers are build-time references, never a GBC gameplay emulator.
import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {segment} from './state-source.mjs';
import {offset} from './render-budget-source.mjs';
const word=(c,a)=>c.m[a]|c.m[a+1]<<8;
export function battleCpu(rom,pair=0x17){const c=new Driver6502(rom);c.banks=[pair*2,pair*2+1,0x3e,0x3f];c.m[0x7cf6]=pair;return c;}
const readWord=(rom,bank,a)=>rom.readUInt16LE(offset(bank,a));
// Counts are explicit table-bound probes, NOT jointly reachable RNG sequences.
export function originalFormation(rom,id,{counts,endpoint='max'}={}){
 check(Number.isInteger(id)&&id>=0&&id<512,'Formation ID');
 const c=battleCpu(rom);c.m[0x7ced]=id&255;c.m[0x7cee]=id>>8;segment(c,0xa02a,0xa0b7);
 const ranges=[...c.m.subarray(0x7d6f,0x7d73)].map(v=>({min:v>>4,max:v&15}));
 check(['min','max'].includes(endpoint),'Count endpoint');counts??=ranges.map(r=>r[endpoint]);
 check(counts.length===4&&counts.every((v,i)=>Number.isInteger(v)&&v>=ranges[i].min&&v<=ranges[i].max),'Count outside original range');
 if(c.m.subarray(0x7d6b,0x7d6f).every(v=>v===255))return {id,counts,ranges,unresolved:{kind:'empty-monster-group',scope:'Sentinel IDs with count table references; normal encounter reachability unresolved'}};
 if(counts.some((n,i)=>n&&c.m[0x7d6b+i]===255))return {id,counts,ranges,unresolved:{kind:'positive-count-for-sentinel',scope:'Do not silently clear counts for absent IDs; caller/reachability unresolved'}};
 c.m.set(counts,0x7d6f);c.call(0x9faa);c.call(0xa31f);c.call(0xbdba);
 const layout=c.m[0x7d7b];check(layout<10,'Layout range');const ptr=readWord(rom,0x2f,0xa5e6+layout*2),slots=[];
 for(let i=0;i<8;i++){
  const at=offset(0x2f,ptr+i*3);if(rom[at]===255)break;
  const [tx,ty,size]=rom.subarray(at,at+3),w=rom[offset(0x2f,0xa4cc+size*2)]*8,h=rom[offset(0x2f,0xa4cd+size*2)]*8;
  check(w>0&&h>0,'Slot dimensions');const type=c.m[0x7da7+i],monster=type===255?null:c.m[0x7d6b+type];
  const center=layout===9?[88,80]:[tx*8+w/2,(ty-1)*8-1+h/2];
  check(c.m[0x7dd7+i*2]===center[0]&&c.m[0x7dd8+i*2]===center[1],'Original target center '+id+'/'+i);
  check(c.m[0x7df7+i*2]===(tx-1)*8&&c.m[0x7df8+i*2]===(ty-1)*8-1,'Original front/top anchor');
  slots.push({slot:i,type,monster,rect:[tx*8,ty*8,w,h],center,frontTop:[c.m[0x7df7+i*2],c.m[0x7df8+i*2]],positionOffset:at});
 }
 const active=[...c.m.subarray(0x7da7,0x7daf)];
 if(active.some((v,i)=>v!==255&&i>=slots.length))return {id,layout,counts,ranges,active,slots,unresolved:{kind:'occupied-slot-outside-layout',scope:'Original slot initializer exceeds position table for this count probe; caller/RNG reachability unresolved'}};
 if(counts.some((n,i)=>active.filter(v=>v===i).length!==n))return {id,layout,counts,ranges,active,slots,unresolved:{kind:'slot-assignment-overlap',scope:'Original type ranges overwrite one another for this count probe; caller/RNG reachability unresolved'}};
 c.call(0xa362);c.call(0xa247);const expected=Buffer.alloc(448);
 if(layout===9){if(slots[0].type!==255){const index=c.m[0x7d73]&31;for(let y=0;y<12;y++)rom.copy(expected,34+y*32,0x54010+index*216+y*18,0x54010+index*216+(y+1)*18);}}
 else for(const s of slots)if(s.monster!==null){let tile=rom[offset(0x2f,0xa2d0+s.type)];const [x,y,w,h]=s.rect;for(let yy=0;yy<h/8;yy++)for(let xx=0;xx<w/8;xx++)expected[(y/8-5+yy)*32+x/8+xx]=tile++;}
 check(Buffer.from(c.m.subarray(0x7900,0x7ac0)).equals(expected),'Original formation tilemap '+id);
 // Physical projectiles use layout/actor/target angle tables, not a generic aim.
 const angles=[];c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;
 for(let actor=0;actor<4;actor++)for(const s of slots){c.m[0x95]=actor;c.x=s.slot;c.y=0x55;c.call(0xa7a5);const n=rom[offset(0x33,0xa7d7+layout)],p=readWord(rom,0x33,0xa7e1+layout*2);check(n===slots.length&&c.a===rom[offset(0x33,p+actor*n+s.slot)]&&c.x===s.slot&&c.y===0x55,'Original projectile angle consumer');angles.push({actor,target:s.slot,angle:c.a});}
 return {id,layout,counts,ranges,palettes:[...c.m.subarray(0x7d69,0x7d6b)],slots,angles,tilemapSha256:hash(expected),scope:'Original table-bound count/placement/angle consumers; encounter and RNG reachability unproven'};
}
// Instrument the called renderer boundary, not its internal graphics/timing.
function observeCall(c,address,callback){const step=c.step.bind(c);c.step=function(){if(this.pc===address){callback(this);this.pc=((this.pop()|(this.pop()<<8))+1)&65535;}else step();};}
export function effectConditionAudit(rom){
 const masks=[];
 for(let mask=0;mask<256;mask++){
  const c=battleCpu(rom,0x19),targets=[];c.m[0x7300]=6;c.m[0x7e89]=mask;
  observeCall(c,0xb64f,x=>targets.push(x.m[0x90]));c.call(0xb6ca);
  check(JSON.stringify(targets)===JSON.stringify(Array.from({length:8},(_,i)=>i).filter(i=>mask&(128>>i))),'Original target-mask iteration');masks.push({mask,targets});
 }
 const physical=[];for(let actor=0;actor<4;actor++)for(let target=0;target<8;target++){
  const c=battleCpu(rom,0x1a),calls=[];c.m[0x7e98]=128>>actor;c.m[0x7e99]=128>>target;c.m[0x7e6f]=1;
  observeCall(c,0xfa0e,x=>calls.push({graphics:x.a,actor:x.m[0x52],target:x.m[0xb8]}));c.call(0x8613);
  check(calls.length===1&&calls[0].graphics===0x12&&calls[0].actor===actor&&calls[0].target===target,'Original party-to-enemy dispatch');physical.push(calls[0]);
 }
 const summons=[];for(let id=0;id<8;id++)for(let variant=0;variant<3;variant++){
  const c=battleCpu(rom,0x1a);c.m[0x52]=0;c.m[0x7ac7]=id;c.m[0x30]=variant;segment(c,0xa065,0xa08c);
  const attack=0x5b+id*3+variant,at=offset(0x30,0x98c0+attack*8),flags=rom[at+5];
  check(Buffer.from(c.m.subarray(0x7400,0x7408)).equals(rom.subarray(at,at+8)),'Original summon property load');
  // Deterministic RNG-result injection ONLY at the random-call boundary: a
  // dead candidate followed by a valid candidate proves the rejection loop.
  const draws=[];c.m[0x7676]=0x80;observeCall(c,0xa564,x=>{check(draws.length<2,'Unexpected summon random retry');x.a=x.nz(draws.length?5:0);draws.push(x.a);});segment(c,0xa08c,0xa0da);
  const mode=flags&128?'all-allies':flags&64?'all-enemies':'random-enemy',mask=flags&128?240:flags&64?255:4,targetFlags=flags&128?64:flags&64?192:128;
  check(c.m[0x27]===mask&&c.m[0x28]===targetFlags&&draws.length===(mode==='random-enemy'?2:0),'Original summon target condition');
  const a=battleCpu(rom,0x19);a.m[0x7e91]=id;a.m[0x7e92]=variant;segment(a,0x8115,0x812d);const entry=readWord(rom,0x32,0x80da+(id*3+variant)*2);check(word(a,0x7e)===entry,'Original summon animation selector');
  summons.push({id,variant,attack,propertyOffset:at,flags,targetMode:mode,mask,targetFlags,randomDraws:draws,animation:{bank:0x32,cpu:entry},visualScope:'not inferred from target mode; bespoke animation inspection required'});
 }
 return {masks,physical,summons,summary:{targetMasks:masks.length,physicalDispatches:physical.length,summonVariants:summons.length,summonTargetModes:Object.fromEntries(['all-allies','all-enemies','random-enemy'].map(k=>[k,summons.filter(s=>s.targetMode===k).length]))},scope:'Target iterator and dispatch/property boundaries only. Renderer calls intercepted; summon RNG results injected. No cast eligibility, full reflection, damage, timing or full-screen animation claim.'};
}
