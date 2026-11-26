import {offset} from './render-budget-source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {check,hash} from './source.mjs';
// Immutable 32/9357 and 32/991F inputs. No captured OAM or timed movie.
export function motionSpriteAssets(rom){
 const bytes=Buffer.from(rom.subarray(offset(0x32,0x943d),offset(0x32,0x97ac))),slice=Buffer.from(rom.subarray(offset(0x32,0x9968),offset(0x32,0x99f5)));
 for(let f=0;f<95;f++){const at=0x950e-0x943d+f*4;check(bytes[at+1]<11,'Source animation shape');check(0x968a-0x943d+bytes[at]*4+4<=bytes.length,'Source animation tiles');}
 return {bytes,slice,header:'#include <stdint.h>\nstatic const uint8_t motion_sprite_data[]={'+[...bytes]+'};\nstatic const uint8_t motion_slice_data[]={'+[...slice]+'};\n',source:{metasprites:'32/9357..943C',shapePointers:'32/943D (11)',shapeFlip:'32/9503 (11)',frames:'32/950E (95 x 4)',tiles:'32/968A',slice:'32/991F..99F4',sha256:hash(Buffer.concat([bytes,slice]))}};
}
export function motionSpriteReference(rom,{frame=0,x=0xd0,y=0x28,flip=0,back=0,palette=0,override=0,hand=0,slice=-1}={}){
 const c=battleCpu(rom,0x19);c.m.fill(240,0x200,0x2a0);c.m[0x95]=0;c.m[0x78c3]=back?0x88:0;c.m[0xc8]=0;
 if(slice<0){c.m.set([x,y,frame,flip],0x8c);c.m[0x7d93]=palette;c.m[0x7d97]=override;c.call(0x9357);}
 else {check(slice<4,'Source slice index');c.m[0xb8]=0;c.m[0xb9]=slice;c.m[0xcd]=hand;c.m.set([x,y],0x7dd7);c.call(0x991f);}
 return Buffer.from(c.m.subarray(0x200,0x200+c.m[0xc8]));
}
export function motionRngTable(rom,seed){
 const c=battleCpu(rom);c.m.fill(0,0,256);c.a=seed;c.p&=~1;c.call(0xfc27);
 return Buffer.from(c.m.subarray(0x7be3,0x7ce3));
}
export function motionImpactReference(rom,{frame=4,x=88,y=80,hand=0,back=0,index=0,table,point=[x+7,y+19]}){
 const c=battleCpu(rom,0x19);c.m.fill(240,0x200,0x2a0);c.m[0x95]=0;c.m[0x78c3]=back?0x88:0;c.m[0xc8]=0;
 c.m[0xb6]=frame;c.m[0xb8]=0;c.m[0xcd]=hand;c.m.set([x,y],0x7dd7);c.m.set(point.map(n=>n&255),0xbe);c.m.set(table,0x7be3);c.m.set([index,23,197],0x15);c.call(0x98e0);
 return {oam:Buffer.from(c.m.subarray(0x200,0x210)),point:Buffer.from(c.m.subarray(0xbe,0xc0)),counters:Buffer.from(c.m.subarray(0x15,0x18))};
}
