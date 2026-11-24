import {check} from './source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
// Full original weapon/graphics bodies run. Hardware waits are counted rather
// than timed; audio requests are observed, not synthesized by this reference.
export function weaponDuration(rom,{right=0x1e,left=0,hits=[1,0],critical=0,confused=false}={}){
 const {m}=initializedBattle(rom,{formation:3,back:false,rows:[0,0,0,0],terrain:0,jobs:[0,0,0,0]}),c=m.c;
 m.call(0xb469);c.m[0x95]=3;c.m[0xb8]=0x80;c.m[0xcc]=1;c.m[0xcb]=critical;c.m[0x7e98]=16;c.m[0x7e99]=128;c.m[0x7e9b]=128;c.m[0x7e6f]=1;
 c.m.set([right,left],0x7e1f);c.m.set(hits,0xbb);c.m[0x7da1]=confused?8:0;
 const events=[],write=c.write.bind(c),step=c.step.bind(c);let weaponStart,weaponEnd;
 const event=(kind,value)=>events.push({kind,value,wait:m.waits.length,hand:c.m[0xcd],hits:[c.m[0xbb],c.m[0xbc]],remaining:c.m[0xbd],frame:c.m[0xb6]});
 c.write=(a,v)=>{if(a===0x7f49)event('sound-request',v);write(a,v);};
 c.step=function(){if(this.banks[0]===0x2e&&this.pc===0xb25b){weaponEnd=m.waits.length;event('end',0);}if(this.banks[0]===0x32){if(this.pc===0xa0c0){weaponStart=m.waits.length;event('start',0);}if(this.pc===0xa094)event('hand',this.a);if(this.pc===0xa384)event('swing',0);if(this.pc===0x991f)event('slice',0);}step();};
 m.begin();m.call(0xb24f);const total=m.waits.length;m.finish();check(weaponStart!==undefined&&weaponEnd!==undefined,'Missing original weapon boundaries');
 return {events,waits:total,weaponStart,weaponWaits:weaponEnd-weaponStart,scope:'Original 2F/B24F step/weapon/return and full animation bodies; NMI/raster waits intercepted, not real frame timing or audio playback'};
}
