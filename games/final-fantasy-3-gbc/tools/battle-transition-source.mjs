// Original battle presentation consumers. This host reference does not run
// the PPU/IRQ/APU, calculate legal encounters, or claim GBC timing/fit.
import {check,hash} from './source.mjs';
import {battleCpu,originalFormation} from './battle-placement-source.mjs';
import {recordTransfers} from './battle-display-source.mjs';
import {offset} from './render-budget-source.mjs';
import {segment} from './state-source.mjs';
const select=(c,pair)=>{c.banks=[pair*2,pair*2+1,0x3e,0x3f];c.m[0x7cf6]=pair;};
function ret(c){c.pc=((c.pop()|(c.pop()<<8))+1)&65535;}
function call(c,address){c.pc=address;c.push(0x4f);c.push(0xff);let n=0;while(c.pc!==0x5000){check(++n<=3000000,'Battle transition instruction budget at '+c.pc.toString(16));c.step();}return n;}

export function presentationMachine(rom){
 const c=battleCpu(rom),ppu=recordTransfers(c),write=c.write.bind(c),step=c.step.bind(c);
 const waits=[],scroll=[],songs=[];let tracing=false,last=ppu.written.slice();
 c.write=(a,v)=>{if(a!==0x2001)write(a,v);}; // PPUMASK side effects are outside this non-raster reference
 function checkpoint(reason){const ranges=[],totals={chr:0,map:0,palette:0};let run;
  for(let a=0;a<0x4000;a++){const n=ppu.written[a]-last[a];if(!n){run=null;continue;}
   const kind=a<0x2000?'chr':a<0x3f00?'map':'palette';totals[kind]+=n;
   if(run&&run.end===a&&run.kind===kind){run.end++;run.writes+=n;}else{run={begin:a,end:a+1,writes:n,kind};ranges.push(run);}
  }last=ppu.written.slice();
  const row={boundary:waits.length,reason,enemyScroll:c.m[15],menuScroll:c.m[16],menuRemaining:c.m[4],partyX:[...c.m.subarray(0xc0,0xc4)],poses:[...c.m.subarray(0x7d83,0x7d87)],ranges,transfers:totals,oamSha256:hash(Buffer.from(c.m.subarray(0x200,0x300))),chrSha256:hash(ppu.bytes.subarray(0,0x2000)),mapSha256:hash(ppu.bytes.subarray(0x2000,0x2800))};
  waits.push(row);return row;
 }
 c.step=function(){
  if(this.pc===0xfb80){if(tracing)checkpoint('before-NMI-wait');ret(this);return;}
  if(this.pc===0xf809){this.y=this.nz(0);ret(this);return;} // bounded raster delay, not a rendered frame
  if(this.pc===0xfae9){songs.push(this.a);ret(this);return;} // request only; audio is not executed here
  if(tracing&&this.banks[1]===0x2f&&this.pc===0xae5e)scroll.push({enemy:this.m[15],menu:this.m[16],remaining:this.m[4]});
  step();
 };
 return {c,ppu,waits,scroll,songs,call:a=>call(c,a),begin(){tracing=true;last=ppu.written.slice();waits.length=0;scroll.length=0;},finish(){checkpoint('return');tracing=false;}};
}
function initializedParty(rom,{jobs=[0,1,2,3],back=false,rows=[0,0,0,0]}={}){
 // Keep the same real enemy/terrain/palette state through status and item
 // consumers. Entry settles canonical coordinates; the renderer flips them.
 const {m}=initializedBattle(rom,{formation:3,back,rows,terrain:0,jobs});m.call(0xb469);return m;
}
function initializedBattle(rom,{formation,back,rows,terrain,jobs=[0,1,2,3]}){
 check(rows.length===4&&rows.every(r=>r===0||r===1),'Entry rows');
 const f=originalFormation(rom,formation);check(!f.unresolved,'Entry formation unresolved');
 const m=presentationMachine(rom),c=m.c;c.m[0x78c3]=back?0x88:0;c.m[0x7ced]=formation&255;c.m[0x7ed8]=formation>>8;c.m[0x7cef]=terrain;
 // Actual reset up to RNG initialization, then explicit table-bound counts.
 // Encounter selection/RNG is deliberately outside this diagnostic.
 segment(c,0x9e8e,0x9f28);segment(c,0xa02a,0xa0b7);c.m.set(f.counts,0x7d6f);c.call(0x9faa);c.call(0xa31f);c.call(0xb909);
 for(let i=0;i<4;i++){c.m[0x6100+i*64]=jobs[i];c.m[0x620f+i*64]=rows[i];}
 m.call(0x9d5f);return {m,f};
}
export function entryTransition(rom,{formation=3,back=false,rows=[0,1,0,1],terrain=0}={}){
 const {m,f}=initializedBattle(rom,{formation,back,rows,terrain}),c=m.c;
 m.begin();const instructions=m.call(0xb469);m.finish();
 check(m.scroll.length===29,'Original entry scroll update count');
 for(let i=0;i<29;i++){const r=m.scroll[i];check(r.enemy===(i<15?(back?(16+i*16)&255:240-i*16):0)&&r.menu===(Math.min(i,16)*16&255)&&r.remaining===Math.max(0,16-i),'Original enemy/menu entry scroll');}
 check(c.m[15]===0&&c.m[16]===0&&c.m[4]===0,'Entry scroll settled');
 check([...c.m.subarray(0xc0,0xc4)].every((v,i)=>v===0xd0+rows[i]*16),'Entry canonical row positions');
 check(c.banks[0]===0x2e&&c.m[0x7cf6]===0x17,'Entry restores bank');
 const totals=m.waits.reduce((t,w)=>{for(const k of Object.keys(t))t[k]+=w.transfers[k];return t;},{chr:0,map:0,palette:0});
 return {formation,back,rows,terrain,layout:f.layout,counts:f.counts,songs:m.songs,scroll:m.scroll,boundaries:m.waits,summary:{nmiWaits:m.waits.length-1,instructions,...totals},scope:'Original reset prefix, explicit formation counts, graphics initialization and entire B469 entry. NMI/raster waits and BGM request intercepted; no raster, legal encounter or GBC time proof'};
}
export function displayStatus(raw1,raw2){
 const first=(raw1&0xc0)|((raw2&0xe0)>>2)|((raw1&0x3f)>>3),second=(raw1&7)<<5,small=!!(first&5);
 let pose=first&128?(small?16:9):first&64?0:(first&0x32)||second?(small?12:3):small?11:2;
 if(first&8)pose|=128;
 return {first,second,pose,graphics:small?(first&4?2:3):first&128?1:0,stone:(first&0xc0)===0x40};
}
export function statusPriorityAudit(rom){
 const c=battleCpu(rom,0x1a);c.m[0x5b]=0x75;c.m[0x5c]=0x75;const poses={};
 // All raw status-byte pairs, including impossible combinations. No new
 // priority rule: compare the translation with the actual two consumers.
 for(let a=0;a<256;a++)for(let b=0;b<256;b++){
  select(c,0x1a);c.m[0x7576]=a;c.m[0x7577]=b;c.m[0x52]=0;c.m[0x5f]=0;c.call(0x9d1d);
  const expected=displayStatus(a,b);check(c.m[0x78bb]===expected.first&&c.m[0x78bc]===expected.second,'Original normalized status');
  select(c,0x17);c.m[0x99]=c.m[0x78bb];c.m[0x9a]=c.m[0x78bc];c.x=0;c.call(0xb607);c.call(0xb5f2);check(c.m[0x7d83]===expected.pose,'Original status pose priority');
  poses[expected.pose]=(poses[expected.pose]||0)+1;
 }
 return {pairs:65536,poses,source:['34/9D1D','2F/B607','2F/B5F2'],scope:'All two-byte inputs at pure status/pose consumers; not all legal combat states or all graphic loads'};
}
export const statusRoute=[
 ['normal',0,0],['poison',2,0],['blind',4,0],['silence',16,0],['sleep',0,64],['paralysis',0,128],['confusion',0,32],
 ['normal-after-confusion',0,0],['toad',32,0],['toad-stone',96,0],['toad-dead',160,0],['mini',8,0],['mini-stone',72,0],['mini-dead',136,0],
 ['stone',64,0],['dead',128,0],['near-fatal',1,0],['restored',0,0]
];
export function statusTransition(rom,{slot=0,job=0,back=false,row=0,capture}={}){
 check(Number.isInteger(slot)&&Number.isInteger(job)&&slot>=0&&slot<4&&job>=0&&job<22&&[0,1].includes(row),'Status fixture bounds');
 const jobs=[0,1,2,3],rows=[0,0,0,0];jobs[slot]=job;rows[slot]=row;const m=initializedParty(rom,{jobs,back,rows}),c=m.c,results=[];
 const chrStart=rom.readUInt16LE(offset(0x2f,0xaa68+slot*2)),initial=Buffer.from(m.ppu.bytes.subarray(chrStart,chrStart+224)),initialMap=Buffer.from(m.ppu.bytes.subarray(0x2000,0x2800));
 // Carry the same VRAM/OAM and graphics-kind cache through every transition.
 for(const [name,raw1,raw2] of statusRoute){select(c,0x1a);c.m[0x5b]=0x75;c.m[0x5c]=0x75;c.m[0x5f]=slot*64;c.m[0x52]=slot;c.m[0x7576+slot*64]=raw1;c.m[0x7577+slot*64]=raw2;c.call(0x9d1d);
  select(c,0x17);c.call(0x9e80);m.begin();c.x=slot;m.call(0xb5c3);m.finish();const expected=displayStatus(raw1,raw2);
  check(c.m[0x7d83+slot]===expected.pose&&c.m[0x7da3+slot]===expected.graphics,'Status pose/graphics lifetime');
  const at=0x2a0+slot*24,oam=Buffer.from(c.m.subarray(at,at+24)),live=Array.from({length:6},(_,i)=>i).filter(i=>oam[i*4]<240&&oam[i*4+1]!==0).length;
  check(expected.stone?live===0:live>0,'Stone BG versus party OBJ');
  results.push({name,raw1,raw2,...expected,statusIcon:c.m[0x78c4+slot],x:c.m[0xc0+slot],liveObj8:live,chrSha256:hash(m.ppu.bytes.subarray(chrStart,chrStart+224)),mapSha256:hash(m.ppu.bytes.subarray(0x2000,0x2400)),boundaries:structuredClone(m.waits)});
  capture?.(name,c,m.ppu);
 }
 check(m.ppu.bytes.subarray(chrStart,chrStart+224).equals(initial),'Normal job CHR restored after status route');
 check(m.ppu.bytes.subarray(0x2000,0x2800).equals(initialMap),'Party background restored after status route');
 return {slot,job,back,row,states:results,restored:true,scope:'Forced status updates through raw-status conversion and entire B5C3 load/move/pose/stone-BG/render path; status infliction/cure rules and live status-icon renderer not executed'};
}
export function itemPresentation(rom,route,{actor=0,target=2,back=false}={}){
 check(route.valid&&route.item>=0xa6&&route.item<=0xaf&&Number.isInteger(actor)&&Number.isInteger(target)&&actor>=0&&actor<4&&target>=0&&target<4,'Item presentation fixture bounds');
 const m=initializedParty(rom,{back}),c=m.c,positions=[...c.m.subarray(0xc0,0xc8)];
 c.m[0x95]=actor;c.x=actor;c.m[0xcc]=1;c.m[0x7e98]=128>>actor;c.m[0x7e99]=c.m[0x7e9b]=128>>target;
 c.m[0x7e88]=route.spell;c.m[0x7e9d]=route.animation;c.m[0xca]=route.sound;
 const hits=[],step=c.step.bind(c);c.step=function(){if(this.banks[1]===0x33&&this.pc===0xb6f3)hits.push({target:this.m[0x90],x:this.m[0xc0+this.m[0x90]],y:this.m[0xc4+this.m[0x90]]});step();};
 m.begin();const instructions=m.call(0xb15e);m.finish();
 check(c.m[0xcc]===0,'Item cast flag cleared');
 check([...c.m.subarray(0xc0,0xc8)].every((v,i)=>v===positions[i]),'Item actor returns to position');
 // B175 reloads graphics $06 before the damage consumer can own the range.
 const at=offset(0x0d,0xb490);check(m.ppu.bytes.subarray(0x1610,0x1700).equals(rom.subarray(at,at+240)),'Item restores damage glyphs');
 check(hits.length===1&&hits[0].target===target,'Item effect follows selected party target');
 return {item:route.item,spell:route.spell,animation:route.animation,actor,target,back,hits,boundaries:m.waits,summary:{nmiWaits:m.waits.length-1,instructions,damageGlyphsRestored:true},scope:'Entire B15E item-driven visual path with forced valid party target. No effect calculation/HP change, message windows, eligibility or real PPU/audio execution'};
}
export function itemEffectRoutes(rom){
 const routes=[];
 for(let item=0;item<256;item++)for(const miniForbidden of [false,true]){
  const c=battleCpu(rom,0x18);c.m[0x1a]=item;c.m.set([item,2],0x60c0);c.m[0x7ed8]=miniForbidden?16:0;
  let reached=false;const step=c.step.bind(c);c.step=function(){if(this.pc===0xaf77&&this.banks[1]===0x31){reached=true;ret(this);}else step();};c.call(0xa65e);
  const tableSpell=item<0x98?rom[offset(0x30,0x9404+item*8)]&127:item<0xc8?rom[offset(0x2e,0x91a0+item-0x98)]:127;
  const valid=tableSpell!==127&&!(item===0xad&&miniForbidden);check(reached===valid,'Original item effect routing');
  check(c.m[0x78d5]===1&&c.m[0x72]===1&&c.m[0x78d7]===item,'Original item message identity');
  check(c.m[0x60c1]===(valid&&item>=0x98?1:2),'Original item consumption boundary');
  const r={item,miniForbidden,valid,script:c.m[0x78d5],action:c.m[0x7ec2],messageItem:c.m[0x78d7],remaining:c.m[0x60c1]};
  if(valid){check(c.m[0x1a]===tableSpell,'Original item spell');r.spell=tableSpell;r.multiplier=c.m[0x30];
   // CC is set by 35/A3D2 for an item. Execute shared attack setup up to the
   // effect-calculation loop; never synthesize damage or a success message.
   c.step=step;c.m[0xcc]=1;c.m[0x6e]=0x75;c.m[0x6f]=0x75;c.m[0x75a1]=8;segment(c,0xaf77,0xb009);
   const at=offset(0x30,0x98c0+tableSpell*8);check(c.m[0x7e88]===tableSpell&&c.m[0x7e9d]===rom[at+6],'Item attack graphics setup');
   r.animation=c.m[0x7e9d];r.targetFlags=rom[at+5];r.sound=rom[offset(0x34,0x83a0+tableSpell)];r.consumer=rom.readUInt16LE(offset(0x33,0xbc2b+r.animation*2));
  }else check(c.m[0x7ec2]===24&&c.m[0x78da]===0x51,'Original ineffective item path');
  routes.push(r);
 }
 return {routes,summary:{inputs:routes.length,effectRoutes:routes.filter(r=>r.valid).length,ineffective:routes.filter(r=>!r.valid).length},scope:'All item-byte and mini-prohibition inputs at A65E, then original shared attack graphics setup. Includes menu-ineligible IDs; no legal usability, target validation, damage/cure, reservation return or playback proof'};
}
