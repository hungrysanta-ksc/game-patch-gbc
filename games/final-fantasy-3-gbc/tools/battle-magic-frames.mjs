// Build-time original-code oracles. No pre-rendered frames enter runtime assets.
import {check,hash} from './source.mjs';
import {offset} from './render-budget-source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
const bytes=(name,b)=>'static const uint8_t '+name+'[]={'+[...b]+'};\n';
export function magicFrameAssets(rom){
 const frames=[],sequences=[],pointers=[],properties=rom.subarray(offset(0x2e,0x91d0),offset(0x2e,0x91d0)+264),locations=[];let size=0;
 for(let id=0;id<128;id++){
  const ptr=rom.readUInt16LE(offset(0,0x9708)+id*2);
  check(ptr>=0x8000&&ptr+36<=0xc000,'Magic frame pair-0 pointer');
  // F92F maps a 16 KiB pair; payloads above A000 belong to physical bank 01.
  const at=16+(ptr&0x3fff),b=Buffer.from(rom.subarray(at,at+36));let i=0,n=0;
  while(n<36){check(i<36,'Truncated magic RLE');const v=b[i++];let count=1;if(v&128){check(i<36,'Missing magic RLE count');count=b[i++];}check(count>0&&n+count<=36,'Magic RLE capacity');n+=count;}
  frames.push(b);locations.push({id,pointer:ptr,offset:at,compressedBytes:i});
 }
 for(let id=0;id<88;id++){
  const ptr=rom.readUInt16LE(offset(6,0x8c00)+id*2),at=16+3*16384+(ptr&0x3fff),len=rom[at];
  check(ptr>=0x8000&&ptr+len+1<=0xc000&&len>0&&len<=32,'Magic sequence bounds');
  const b=Buffer.from(rom.subarray(at,at+len+1));for(let i=1;i<=len;i++)if(b[i]===255)check(++i<=len,'Terminal magic flip marker');
  pointers.push(size);sequences.push(b);size+=b.length;
 }
 const compressed=Buffer.concat(frames),programs=Buffer.concat(sequences);
 const header='#include <stdint.h>\n'+bytes('magic_frames',compressed)+bytes('magic_programs',programs)+bytes('magic_properties',properties)+'static const uint16_t magic_offsets[]={'+pointers+'};\n';
 return {header,frames,sequences,properties,locations,source:{frames:'00/9708 pointers; pair 00 payloads; 33/B7CF..B90E',sequences:'06/8C00; 33/B68D..B710',properties:'2E/91D0, 88 records; 33/AF6F',sha256:hash(Buffer.concat([compressed,programs,properties])),frameCount:128,spellCount:88,compressedBytes:compressed.length,sequenceBytes:programs.length,scope:'88 supported caller IDs; physical pointer-table tail and special effect bodies are not inferred'}};
}
export function magicPartySeed(){return Buffer.from(Array.from({length:96},(_,i)=>(i*37+11)&255));}
function seed(c,p){
 c.m[0x7e9c]=1;c.m[0x7301]=p.vertical?255:p.code;if(p.vertical)c.m[0x7302]=p.code;
 c.m[0x7e9a]=p.enemy?64:0;c.m[0x78c3]=p.back?0x88:0;c.m[0x7e8b]=p.properties;c.m[0x7e9d]=p.magic;
 c.m[0x90]=0;c.m[0xc0]=p.x;c.m[0xc4]=p.y;c.m[0x7dd7]=p.x;c.m[0x7dd8]=p.y;c.m.set(magicPartySeed(),0x2a0);
}
export function magicFrameReference(rom,p){
 const c=battleCpu(rom,0x19);seed(c,p);const visible=[],step=c.step.bind(c);
 c.step=function(){if(this.pc===0xf8c5){visible.push(Buffer.from(this.m.subarray(0x200,0x300)));this.pc=((this.pop()|this.pop()<<8)+1)&65535;}else step();};
 c.call(0xb711);check(visible.length===4&&visible.every(b=>b.equals(visible[0])),'Original magic four-frame hold');
 return {visible:visible[0],restored:Buffer.from(c.m.subarray(0x200,0x300)),template:Buffer.from(c.m.subarray(0x7924,0x79b4))};
}
export function magicSequenceReference(rom,spell,trim=0){
 const a=magicFrameAssets(rom),program=a.sequences[spell];check(program&&[0,16].includes(trim)&&program[0]>trim,'Sequence input');
 const length=program[0]-trim;let k=1;while(k<=length){if(program[k++]===255)k++;}check(k===length+1,'Trim splits marker');
 const c=battleCpu(rom,0x19);seed(c,{code:0,vertical:0,enemy:1,back:0,x:88,y:80,properties:0,magic:0});c.m.set(program,0x7300);c.m[0x7300]=length;
 const events=[],step=c.step.bind(c);let waits=0,cleanup=0;
 c.step=function(){if(this.pc===0xb7e7)events.push({code:this.a,vertical:this.m[0x87]>>1,index:this.m[0x7e9c]+1});
  if(this.pc===0xf8c5||this.pc===0xf8b0){if(this.pc===0xf8c5)waits++;else cleanup++;this.pc=((this.pop()|this.pop()<<8)+1)&65535;}else step();};
 c.pc=0xb6f3;c.push(0x4f);c.push(0xff);let budget=2000000;while(c.pc!==0x5000){check(--budget>0,'Magic sequence instruction budget');c.step();}
 check(waits===events.length*4&&cleanup===1&&c.m[0x7e9c]===length+1,'Original magic sequence cadence');
 check(c.m.subarray(0x200,0x2a0).every(v=>v===240),'Original magic cleanup');
 return {events,length,waits,cleanup,soundPending:c.m[0xc9]};
}
export function magicBudgetAudit(rom){
 const a=magicFrameAssets(rom),frames=a.frames.map((_,id)=>{
  const r=magicFrameReference(rom,{code:id,vertical:0,enemy:1,back:0,x:88,y:80,properties:0,magic:0}),o=r.template,rows=Array(6).fill(0);let objects=0;
  for(let i=0;i<36;i++)if(o[i*4+1]){objects++;rows[Math.floor(i/6)]++;}
  return {id,objects,peakRow:Math.max(...rows)};
 });
 const table=(bank,addr,n)=>Array.from({length:n},(_,i)=>rom.readUInt16LE(offset(bank,addr)+i*2));
 return {frames,maxObjects:Math.max(...frames.map(f=>f.objects)),maxRow:Math.max(...frames.map(f=>f.peakRow)),overSixteen:frames.filter(f=>f.objects>16).length,partyReservation:24,gbcObjectLimit:40,magicDispatch:table(0x33,0xbc2b,19),summonDispatch:table(0x32,0x80da,24),scope:'Common frame nonzero tile slots; not pixel occupancy, simultaneous scanline proof, special-body execution, live GBC rendering or normal-play reachability'};
}
