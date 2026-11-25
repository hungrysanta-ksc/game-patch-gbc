// Original action-script consumers, on one persistent battle RAM/PPU state.
// Explicit display-boundary inputs; this does not calculate battle damage.
import {check} from './source.mjs';
import {initializedBattle,itemEffectRoutes} from './battle-transition-source.mjs';
import {originalFormation} from './battle-placement-source.mjs';
import {formationPixels} from './battle-placement-budget.mjs';
import {scenePixels} from './battle-scene-pixels.mjs';
import {convertTiles} from './map-assets.mjs';
import {messageWindowDescriptors} from './battle-ui-observation.mjs';
// $7CF6 is the animation caller's bank ($17), not the active logic bank.
// FA0E switches $34/$35 to $2E/$2F without changing that saved bank.
const select=(c,p)=>{c.banks=[p*2,p*2+1,0x3e,0x3f];};
const ret=c=>{c.pc=((c.pop()|(c.pop()<<8))+1)&65535;};
export function originalActionFlow(rom,{back=false,enemy=false,health=[[9999,9999],[1234,5678],[56,128],[999,4321]]}={}){
 const formation=originalFormation(rom,3),layout=formationPixels(rom,formation,{retreat:8}).layout;
 const frames=[],events=[],hp=[],strings=[];let phase='setup',command=255,numberFrame=null,numberOwners=[],numberActive=false,numberPending=false,record=false,live=0,geometryMap;
 const capture=(boundary,c,ppu)=>{
  if(!record||boundary.reason!=='before-NMI-wait')return;
  // NES text occupies different rectangles. Route its window state to the
  // GBC UI; do not accidentally rescale Japanese menu tiles as enemy art.
  const bytes=Buffer.from(ppu.bytes);geometryMap.copy(bytes,0x2000);
  const picture=scenePixels(c,{bytes},{back,layout,formation,numberOwners,partyY:[10,34,58,82],enemyY:18,terrainHeight:11,numberEnemyOffset:-2,statusOwners:c.m[0xac]!==0});
  for(const kind of ['partyCoverage','statusCoverage'])check(picture[kind].sourcePixels===picture[kind].viewportPixels,'Action clips original '+kind);
  frames.push({sourceUi:Buffer.from(ppu.bytes.subarray(0x2260,0x23a0)),phase,command,numberFrame:numberPending?numberFrame:null,live,gate:c.m[0xac],counter:c.m[0xb7],...picture,oam:Buffer.from(c.m.subarray(0x200,0x300)),sourceOamSha256:boundary.oamSha256,sourceBoundary:boundary.boundary});numberPending=false;
 };
 const {m}=initializedBattle(rom,{formation:3,back,rows:[0,0,0,0],terrain:0,capture}),c=m.c;m.call(0xb469);geometryMap=Buffer.from(m.ppu.bytes.subarray(0x2000,0x2800));
 c.m[0x57]=0;c.m[0x58]=0x61;c.m[0x5b]=0;c.m[0x5c]=0x75;c.m[0x6e]=0;c.m[0x6f]=0x75;
 c.m[0x6010]=4;c.m[0x7cf3]=1;c.m[0x7ce8]=255;c.m[0x78d3]=0;
 for(let i=0;i<4;i++){c.m.set([0x80+i,255,255,255,255,255],0x6106+i*64);c.m[0x7500+i*64]=i;c.m[0x7501+i*64]=[0,3,4,17][i];c.m[0x7503+i*64]=health[i][0]&255;c.m[0x7504+i*64]=health[i][0]>>8;c.m[0x7505+i*64]=health[i][1]&255;c.m[0x7506+i*64]=health[i][1]>>8;}
 const step=c.step;
 c.step=function(){
  if(this.banks[0]===0x34){
   if(this.pc===0x9037){command=this.m[0x4b];events.push({kind:'command',op:command,index:this.m[0x64],at:frames.length,live});}
   if(this.pc===0x8d1b){live|=1<<this.a;events.push({kind:'open',window:this.a,at:frames.length,live,raw:Buffer.from(this.m.subarray(0x7ad7,0x7aeb)),strings:strings.slice()});strings.length=0;}
   if(this.pc===0x8e14){live&=~(1<<this.a);events.push({kind:'close',window:this.a,at:frames.length,live});}
   if(this.pc===0x9cbe)hp.push({slot:this.m[0x52],raw:Buffer.from(this.m.subarray(0x7ad7,0x7ae9))});
   if(this.pc===0x9056)events.push({kind:'cleanup',at:frames.length,live});
  }
  if(this.banks[1]===0x35&&this.pc===0xa609)strings.push({id:((this.m[0x18]|this.m[0x19]<<8)-0x8000)/2+this.a,destination:this.x});
  if(this.banks[1]===0x33&&this.pc===0xad2b&&this.m.subarray(0x7e4f,0x7e5f).some(v=>v!==255)){phase='number-setup';numberActive=true;numberFrame=-1;numberOwners=[];}
  if(numberActive&&this.banks[1]===0x33&&this.pc===0xacaa){const g={target:this.m[0x7e72]&(enemy?7:3),enemy};for(let i=0;i<4;i++)numberOwners[(this.m[0xc8]>>2)+i]=g;}
  if(numberActive&&this.banks[1]===0x33&&this.pc===0xad91){phase='numbers';numberFrame++;numberPending=true;}
  if(numberActive&&this.banks[1]===0x33&&this.pc===0xada5){numberActive=false;phase='after-numbers';}
  if(this.pc===0xfbaa){this.m[0x12]=0;ret(this);return;}
  step.call(this);
 };
 select(c,0x1a);c.call(0x9d06);c.call(0x9ba2);
 // The fixture begins with settled display status, as 9E64/9E80 does at
 // battle initialization. Slots 1 and 3 are already below one quarter HP.
 select(c,0x17);c.call(0x9e80);c.call(0xb5b8);c.call(0xb304);
 phase='selection';record=true;m.begin();for(let i=0;i<16;i++){c.call(0xaeec);c.call(0xf8c5);}m.finish();
 // The actual pre-action consumer hides status/target OAM and reloads digits.
 phase='action';m.begin();c.call(0xb2eb);m.finish();
 select(c,0x1a);c.m.fill(255,0x78d6,0x78ee);c.m.fill(0,0xe0,0x100);
 const route=itemEffectRoutes(rom).routes.find(r=>r.item===0xa6&&!r.miniForbidden);
 c.m[0x78d5]=enemy?5:1;c.m[0x78d6]=enemy?255:0;c.m[0x78d7]=enemy?255:route.item;c.m[0x78d8]=enemy?255:2;
 c.m[0x78d9]=255;c.m[0x78da]=enemy?0x41:255;c.m[0x72]=enemy?0:1;
 c.m[0x7ec2]=enemy?23:route.action;c.m[0x7ec3]=0;c.m[0x7e9a]=enemy?64:0;
 c.m[0x95]=0;c.m[0xcc]=enemy?0:1;c.m[0x7e98]=128;c.m[0x7e99]=c.m[0x7e9b]=32;
 c.m[0x7e88]=route.spell;c.m[0x7e9d]=route.animation;c.m[0xca]=route.sound;
 c.m[0x7ee1]=255;c.m.fill(255,0x7e4f,0x7e6f);const values=enemy?Array(8).fill(1234):[65535,65535,0x8038,65535];values.forEach((v,i)=>{c.m[0x7e4f+i*2]=v&255;c.m[0x7e50+i*2]=v>>8;});
 m.begin();m.call(0x8ff7);m.finish();
 phase='next-selection';numberOwners=[];numberFrame=null;select(c,0x1a);c.m[0x7ceb]=0;c.call(0x9ba2);
 select(c,0x17);m.begin();c.call(0xb304);for(let i=0;i<16;i++){c.call(0xaeec);c.call(0xf8c5);}m.finish();
 check(live===0,'Action restores every opened logical window');
 return {back,enemy,frames,events,hp,values,health,windowDescriptors:messageWindowDescriptors(rom),menuTiles:convertTiles(m.ppu.bytes.subarray(0x1000,0x2000)),menuPalette:frames[0].sourcePalettes.subarray(24,32),script:enemy?5:1,source:['34/8FF7..9058','34/905B..950A','34/9BA2..9CE0','32/9F11..A045','2F/B2EB','2F/B304'],scope:'Original display caller on explicit post-effect inputs; battle calculation and all action kinds remain separate'};
}
