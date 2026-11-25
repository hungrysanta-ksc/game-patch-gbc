import {check,hash} from './source.mjs';
import {fullOpeningReference} from './battle-opening-source.mjs';
import {scenePixels} from './battle-scene-pixels.mjs';
import {originalFormation} from './battle-placement-source.mjs';
import {formationPixels} from './battle-placement-budget.mjs';
import {actionComposition,actionUi} from './battle-action-assets.mjs';
import {originalActionFlow} from './battle-action-source.mjs';
import {originalActionUi,packActionUi} from './battle-action-ui.mjs';
import {literal} from './battle-select-view-assets.mjs';
import {packBattleFrames} from './battle-scene-assets.mjs';
import {nativeTiming} from './native-plan.mjs';
// Source graphics execute only in this build-time oracle. The GBC caller is
// C; these bounded presentation fixtures do not replace a general renderer.
export function openingPresentation(rom,{back=false,hp=500}={}){
 const formation=originalFormation(rom,3),layout=formationPixels(rom,formation,{retreat:8}).layout;
 const requests=[];let music,machine,current,owners=[],number=-1,numberPending=false,live=0;
 const picture=(c,ppu)=>{
  let effectOrigin;
  if(current?.kind===1&&current.value===36){const points=[];for(let i=0;i<40;i++){const a=0x200+i*4;if(c.m[a]<152)points.push([back?248-c.m[a+3]:c.m[a+3],c.m[a]+1]);}
   if(points.length){const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1])),w=Math.max(...points.map(p=>p[0]))+8-x,h=Math.max(...points.map(p=>p[1]))+8-y;
    // Translate whole source metasprite, never scale its constituent dots.
    effectOrigin={x:Math.floor(x*(120-w)/(256-w))-x,y:Math.floor(y*(102-h)/(152-h))-y};}
  }
  return scenePixels(c,ppu,{back,layout,formation,numberOwners:owners,statusOwners:c.m[0xac]!==0,partyY:[10,34,58,82],terrainHeight:11,enemyY:18,numberEnemyOffset:-2,effectOrigin});
 };
 function capture(b,c,p){if(!current||b.reason!=='before-NMI-wait')return;let f;try{f=picture(c,p);}catch(e){throw Error(back+"/"+hp+" graphics "+current.value+" frame "+current.frames.length+" "+e.message);}current.frames.push({...f,back,phase:'opening-'+current.kind+'-'+current.value,live,numberFrame:numberPending?number:null,sourceBoundary:b.boundary});numberPending=false;}
 const health=[[0,9999],[1234,5678],[56,128],[999,4321]];
 const result=fullOpeningReference(rom,{back,hp,health,speed:4,capture,onSetup:m=>{music=m.songs.at(-1);check(Number.isInteger(music),"Original battle music request");machine=m;const c=m.c,step=c.step.bind(c),write=c.write.bind(c);c.write=(a,v)=>{if(a===0x7f49&&current)current.sounds.push({at:current.frames.length,op:v===255?8:7,arg:v&127});write(a,v);};c.step=function(){
   if(this.pc===0xfae9&&current)current.sounds.push({at:current.frames.length,op:2,arg:this.a});
   if(this.banks[1]===0x33&&this.pc===0xad43){owners=[];number=-1;}
   if(this.banks[1]===0x33&&this.pc===0xacaa){const g={target:this.m[0x7e72]&7,enemy:!!this.m[0x7e6f]};for(let i=0;i<4;i++)owners[(this.m[0xc8]>>2)+i]=g;}
   if(this.banks[1]===0x33&&this.pc===0xad91){number++;numberPending=true;}
   step();};},onRequest:e=>{if(current&&!current.frames.length)current.frames.push({...picture(machine.c,machine.ppu),back,phase:'opening-'+current.kind+'-'+current.value,live,numberFrame:null});
   if(e.kind===3)live|=16;if(e.kind===4)live&=~16;
   if(e.kind===1&&[36,37,14,2,10,11].includes(e.value))owners=[];
   current={...e,frames:[],sounds:[]};requests.push(current);
 }});
 if(!current.frames.length)current.frames.push({...picture(machine.c,machine.ppu),back,phase:'opening-terminal',live,numberFrame:null});
 return {...result,requests,music,health};
}
export function battleOpeningAssets(rom,text){
 const raw=[],keys=new Map(),profiles=[],runs=[],opening=[];
 for(const back of [false,true])for(const hp of [500,1]){
  const flow=openingPresentation(rom,{back,hp}),base=originalActionFlow(rom,{back,health:flow.health}),ui=actionUi(text,base);ui.windows=Array.from({length:5},()=>[]);ui.windows[4]=literal(text,0x65d);
  const uiRaster=originalActionUi(ui,base,text,{smallHp:true}),entries=[],requests=[];
  for(const [request,r]of flow.requests.entries()){
   const first=entries.length;let body=[];
   for(const [at,f]of r.frames.entries()){
    const key=hash(Buffer.concat([Buffer.from(f.pixels.buffer),f.sourcePalettes,Buffer.from(f.basePixels.buffer),Buffer.from(JSON.stringify(f.numberObjects))]));let frame=keys.get(key);
    if(frame===undefined){frame=raw.length;keys.set(key,frame);let c;try{try{c=actionComposition({...f,fixedSourcePalettes:true,residualPalettes:[4,5,6,7]});}catch{}if(!c)for(const residualPalettes of [[0,1,4,7],[1,2,4,7],[0,2,4,7],[2,4,5,7],[2,5,6,7],[1,5,6,7]]){try{c=actionComposition({...f,weightedPalettes:true,residualPalettes});break;}catch(x){if(residualPalettes[0]===1&&residualPalettes[1]===5)throw x;}}}catch(e){throw Error(back+'/'+hp+' request '+request+' frame '+at+' '+e.message);} check(c.background.length/16<=176,'Opening UI glyph reservation');raw.push({...f,index:frame,scroll:[0,6],composition:c});}
    const sounds=r.sounds.filter(s=>s.at===at);check(sounds.length<=1,'One source sound request per boundary');
    const e={frame,live:f.live,hold:1,run:255,phase:f.phase,command:255,sourceStart:at,sourceGate:1,request,soundOp:sounds[0]?.op??0,soundArg:sounds[0]?.arg??0};
    if(f.numberFrame!==null){body.push({frame,sourceStart:f.numberFrame});if(f.numberFrame===31){check(body.length===32,'Opening original numeral body');e.run=runs.length;e.frame=body[0].frame;e.hold=32;runs.push({back,label:'opening-numbers',first:e.frame,last:frame,clear:frame,entries:body.map(x=>({...x,timerOffset:Math.floor(x.sourceStart*nativeTiming.timerHz*nativeTiming.sourceRateDenominator/nativeTiming.sourceRateNumerator)}))});entries.push(e);body=[];}continue;}
    const prev=entries.at(-1);if(prev&&prev.request===request&&prev.frame===frame&&prev.live===e.live&&prev.run===255&&!e.soundOp&&prev.hold<255)prev.hold++;else entries.push(e);
   }
   check(!body.length,'Incomplete opening numeral sequence');requests.push({kind:r.kind,value:r.value,first,count:entries.length-first,state:r.state.toString('hex')});
  }
  check(entries.length<256,'Opening stage ABI');profiles.push({back,hp,uiRaster,entries});opening.push({state:flow.state.toString('hex'),requests,sounds:flow.requests.flatMap(r=>r.sounds),terminal:flow.trace.at(-1).kind,music:flow.music});
 }
 check(raw.length<256,'Opening frame ABI');const {frames,visuals}=packBattleFrames({frames:raw,summary:{failed:0}});
 for(const r of runs){const f=frames[r.first];r.objects=f.stats.objects;r.numberObjects=f.stats.numberObjects;r.oam=Buffer.concat(r.entries.map(e=>{const n=frames[e.frame];for(const k of ['background','maps','objects'])check(n.atlas[k].equals(f.atlas[k]),'Opening pinned numeral '+k);check(n.palette.equals(f.palette),'Opening numeral palette');return n.atlas.oam;}));}
 const packed=packActionUi(profiles),blank=Buffer.alloc(80);return {jobs:[{bytes:blank,expected:blank,static:true}],frames,blocks:Buffer.alloc(16),bgTiles:Buffer.alloc(16),palettes:7,raw,battle:{opening,action:{profiles,...packed,rows:[13,14,15,16,17,18],scope:'Original opening caller with bounded source presentation fixtures; V6 graphics/audio integration, not full game'},numberTimeline:{timing:nativeTiming,runs},uniqueVisuals:visuals.size,summary:{observations:raw.length},scope:'Original entry/cannon/number/death/selection presentation fixtures driven by the GBC opening caller'}};
}
