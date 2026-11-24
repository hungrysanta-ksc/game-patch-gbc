// Original AD2B/AC4B/ADF4 consumers on the caller's existing VRAM/OAM.
// Values are explicit display-boundary probes, not computed battle damage.
import {check,hash} from './source.mjs';
import {offset} from './render-budget-source.mjs';
export function originalNumberRun(rom,m,{enemy,values,onGroup=()=>{},onFrame=()=>{}}){
 const c=m.c;check(values.length===(enemy?8:4)&&values.every(v=>Number.isInteger(v)&&v>=0&&v<=65535),'Number display values');
 c.banks=[0x32,0x33,0x3e,0x3f];c.m[0x7cf6]=0x19;c.m[0x7e6f]=+enemy;c.m.fill(255,0x7e4f,0x7e5f);
 values.forEach((v,i)=>{c.m[0x7e4f+i*2]=v&255;c.m[0x7e50+i*2]=v>>8;});
 // Original reset's RAM math trampoline (2E/9F6C), required by AD6F.
 const trampoline=rom.subarray(offset(0x2e,0x9f6c),offset(0x2e,0x9f6c)+18);
 check(Buffer.from(c.m.subarray(0x7ee3,0x7ef5)).equals(trampoline),'Original math trampoline residency');
 const before=Buffer.from(c.m.subarray(0x2a0,0x300)),step=c.step,frames=[];let groups=[];
 c.step=function(){
  if(this.banks[1]===0x33&&this.pc===0xacaa){const g={first:this.m[0xc8]>>2,target:this.m[0x7e72]&(enemy?7:3),enemy,sourceBase:[this.m[0x8c],this.m[0x8e]+1],tiles:[...this.m.subarray(0x7e,0x82)],palette:this.m[0x82]};groups.push(g);onGroup(g);}
  if(this.pc===0xf8c5){check(Buffer.from(this.m.subarray(0x2a0,0x300)).equals(before),'Numbers overwrite party OAM');const row={frame:frames.length,groups,allocated:this.m[0xc8]>>2,oamSha256:hash(Buffer.from(this.m.subarray(0x200,0x300)))};frames.push(row);groups=[];onFrame(row);}
  step.call(this);
 };
 try{m.begin();m.call(0xad2b);m.finish();}finally{c.step=step;}
 const any=values.some(v=>v!==65535);check(frames.length===(any?32:0),'Original number display lifetime');
 return {enemy,values,frames,source:['33/AD2B','33/AC4B','33/ADF4'],scope:'Original numeral conversion/placement/32-frame sine body on the same battle state; forced display inputs, no HP calculation. OAM persists until the original caller clears it.'};
}
