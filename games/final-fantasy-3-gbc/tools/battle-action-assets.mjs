import {check,hash} from './source.mjs';
import {originalActionFlow} from './battle-action-source.mjs';
import {compilePixelComposition,compositionWords,pixelCompositionPalettes,compositionRgb,encodeTile} from './npc-composition.mjs';
import {composeBattleNumbers} from './battle-number-composition.mjs';
import {packBattleFrames} from './battle-scene-assets.mjs';
import {nativeTiming} from './native-plan.mjs';
import {originalActionUi,uiPixels,packActionUi,actionRows as rows} from './battle-action-ui.mjs';
import {selectionViewProfile} from './battle-select-view-assets.mjs';
const offset=n=>Math.floor(n*nativeTiming.timerHz*nativeTiming.sourceRateDenominator/nativeTiming.sourceRateNumerator);
// Shift the BG grid six pixels, then SCY=6 restores the approved screen
// positions. Action windows retain their y=106 edge. Selection windows start
// at y=103 inside tile row 13; that row keeps its artwork in OBJ so the new
// blue frame/padding cannot overwrite a foot. Numeral geometry is unchanged.
export function actionComposition(f){
 const shift=p=>{const q=new Uint16Array(168*152).fill(f.sourcePalettes.readUInt16LE(0));q.set(p.subarray(0,168*146),168*6);return q;};
 if(f.cursorLayout)check(f.sourcePalettes.readUInt16LE(0)===0,'Selection padding requires original black background');
 const shifted={...f,pixels:shift(f.pixels),basePixels:shift(f.basePixels),numberObjects:f.numberObjects.map(o=>({...o,y:o.y+6}))};
 const obj=Buffer.concat((f.residualPalettes??[0,1,4,7]).map(p=>f.sourcePalettes.subarray(p*8,p*8+8))),c=f.numberObjects.length?composeBattleNumbers(shifted,{objOnlyRow:f.cursorLayout?13:-1}):compilePixelComposition(shifted.pixels,obj,{width:168,height:152,objOnlyRow:f.cursorLayout?13:-1,palettes:f.fixedSourcePalettes?Array.from({length:7},(_,p)=>Array.from({length:4},(_,i)=>f.sourcePalettes.readUInt16LE(p*8+i*2))):pixelCompositionPalettes([shifted.pixels],obj,{width:168,height:152,maxPalettes:7,weighted:!!f.weightedPalettes})});
 check(compositionWords(c).every((v,i)=>v===shifted.pixels[i]),'Shifted V6 geometry lossless');return c;
}
function literal(text,id){const i=text.sourceIds.indexOf(id);check(i>=0,'Reviewed battle text binding required: '+id);const words=[];for(let p=0;p<text.messages[i].length;p+=2){const v=text.messages[i].readUInt16LE(p);if(v===0)break;check(v>=0x8000,'Unsupported battle text control '+id);words.push(v-0x8000);}return words;}
// Independent UI layer: glyph dictionary + live window mask. Geometry frames
// never include text, HP values, or combinations of open/closed windows.
export function actionUi(text,flow){
 const windows=Array.from({length:5},()=>[]);
 for(const e of flow.events.filter(e=>e.kind==='open')){
  const content=e.strings.length?literal(text,e.strings[0].id):[...e.raw.subarray(0,6)];
  check(e.strings.length<=1,'Unsupported variable battle message');
  check(content.length<=(e.window===4?14:8),'Battle message requires explicit reflow');windows[e.window]=content;
 }
 const hp=flow.hp.slice(0,4).map(e=>({name:[...e.raw.subarray(1,7)],value:[...e.raw.subarray(8,17)]}));
 check(hp.length===4&&flow.hp.length===8,'Original four HP rows before and after action');
 return {windows,hp};
}
export function actionRgb(frame,ui,live){
 const c=frame.composition,map=Buffer.from(c.map),attrs=Buffer.from(c.attributes),tiles=[c.background],pixels=uiPixels(ui,live);let n=c.background.length/16;const dictionary=new Map();
 for(let y=0;y<6;y++)for(let x=0;x<20;x++){
  const at=y*8*160+x*8;if(pixels[at]<0)continue;const values=[];for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)values.push(pixels[at+yy*160+xx]);
  const tile=encodeTile(values),key=tile.toString('hex');if(!dictionary.has(key)){dictionary.set(key,n++);tiles.push(tile);}const p=rows[y]*21+x;map[p]=dictionary.get(key);attrs[p]=7;
 }
 check(n<=256,'Oracle UI tile capacity');const bgPalette=Buffer.from(c.bgPalette);ui.palette.copy(bgPalette,56);
 const raw=compositionRgb({...c,map,attributes:attrs,background:Buffer.concat(tiles),bgPalette}),rgb=Buffer.alloc(160*144*3);for(let y=0;y<144;y++)raw.copy(rgb,y*480,(y+6)*504,(y+6)*504+480);return rgb;
}
export function battleActionAssets(rom,text,{smallHp=false,selection=false,party=false}={}){
 const raw=[],keys=new Map(),profiles=[],runs=[];
 for(const back of [false,true])for(const enemy of [false,true]){
  const flow=originalActionFlow(rom,{back,enemy}),ui=actionUi(text,flow),uiRaster=originalActionUi(ui,flow,text,{smallHp}),entries=[];let body=[];
  for(const [at,f]of flow.frames.entries()){
   const key=hash(Buffer.concat([Buffer.from(f.pixels.buffer),f.sourcePalettes,Buffer.from(f.basePixels.buffer),Buffer.from(JSON.stringify(f.numberObjects))]));
   let frame=keys.get(key);
   if(frame===undefined){frame=raw.length;keys.set(key,frame);
    const c=actionComposition(f);
    check(compositionWords(c).subarray(168*6,168*150).every((v,i)=>v===f.pixels[i]),'Action viewport lossless');
    check(c.background.length/16<=176,'Action glyph VRAM reservation');
    // UI must never hide a party/effect/residual pixel. Numbers remain OBJ
    // above the window, retaining source OBJ/BG priority and every digit.
    const pixels=uiPixels(uiRaster,f.live);
    for(let y=106;y<144;y++)for(let x=0;x<160;x++)check(f.basePixels[y*168+x]===f.sourcePalettes.readUInt16LE(0),'Original UI band hides battle art');
    for(const s of c.sprites.slice(c.stats.numberObjects||0))for(let y=0;y<8;y++)for(let x=0;x<8;x++){
     const dy=s.y+y-6,dx=s.x+x,uiY=dy+6-rows[0]*8;if(dy<106||uiY<0||uiY>=48||dx<0||dx>=160||pixels[uiY*160+dx]<0)continue;
     const a=s.tile*16+y*2,bit=7-x;check(!((c.objGraphics[a]|c.objGraphics[a+1])>>bit&1),'UI intersects residual artwork');
    }
    raw.push({...f,back,scroll:[0,6],index:frame,composition:c});
   }
   const e={frame,live:f.live,hold:1,run:255,phase:f.phase,command:f.command,sourceStart:at,sourceGate:f.gate};
   if(f.numberFrame!==null){body.push({frame,sourceStart:f.numberFrame});if(f.numberFrame===31){check(body.length===32&&body.every((e,i)=>e.sourceStart===i),'Original 32 numeral body');const run=runs.length;runs.push({back,label:enemy?'enemy-numbers':'party-numbers',first:body[0].frame,last:frame,clear:frame,entries:body.map(e=>({...e,timerOffset:offset(e.sourceStart)}))});entries.push({...e,frame:body[0].frame,hold:32,sourceStart:at-31,run});body=[];}continue;}
   const last=entries.at(-1);if(last&&last.run===255&&last.frame===frame&&last.live===e.live&&last.phase===e.phase&&last.command===e.command&&last.hold<255)last.hold++;else entries.push(e);
  }
  check(!body.length&&entries.at(-1).phase==='next-selection'&&entries.at(-1).live===0,'Action reaches next selection');
  check(entries.length<=255&&entries.every(e=>e.hold>0&&e.hold<=255),'Action stream ABI limits');
  profiles.push({back,enemy,ui,uiRaster,entries,events:flow.events,hp:flow.hp,health:flow.health,values:flow.values,script:flow.script,source:flow.source,sourceFrames:flow.frames.length});
 }
 let selectionViews;
 if(selection){selectionViews=[false,true].map(back=>{const views=Array.from({length:party?5:1},(_,actor)=>selectionViewProfile(rom,text,{back,actor,party})),p=views[0];p.entries=views.map(v=>{const f=v.source.frame,c=actionComposition(f),frame=raw.length;check(c.background.length/16<=176&&c.objGraphics.length<=60*16&&c.stats.objects<=36,'Selection hand reservation');raw.push({...f,back,scroll:[0,6],index:frame,composition:c});return {frame,live:3,hold:1,run:255,phase:'command-selection',command:255,sourceStart:0,sourceGate:1};});if(party){p.actorSources=views.map(v=>v.source);p.cursorOam=Buffer.concat(views.map(v=>v.cursorOam));}profiles.push(p);return p;});}
 check(raw.length<255,'Action geometry index capacity');
 const {frames,visuals}=packBattleFrames({frames:raw,summary:{failed:0}});
 for(const run of runs){const first=frames[run.first];run.objects=first.stats.objects;run.numberObjects=first.stats.numberObjects;run.oam=Buffer.concat(run.entries.map(e=>{const f=frames[e.frame];for(const k of ['background','maps','objects'])check(f.atlas[k].equals(first.atlas[k]),'Pinned action numeral '+k);check(f.palette.equals(first.palette),'Pinned action numeral palette');return f.atlas.oam;}));}
 const {glyphs,cells,tileCount,tileCounts}=packActionUi(profiles);if(party)check(tileCounts.slice(4).every(n=>n<=49),'Party suffix reservation: '+tileCounts.slice(4));
 const blank=Buffer.alloc(80),action={profiles,tileCount,glyphs,cells,rows,selectionViews,source:'34/8FF7..9058 action scripts; original message/HP/status consumers',scope:'Bounded original post-effect display flows (item and poison, normal/back). UI is a runtime independent map layer. Geometry remains diagnostic precompilation; no battle calculation, all actions, or full-speed whole-scene claim.'};
 return {jobs:[{bytes:blank,expected:blank,static:true}],frames,blocks:Buffer.alloc(16),bgTiles:Buffer.alloc(16),palettes:7,battle:{action,numberTimeline:{timing:nativeTiming,runs,source:'32 numeral waits; retain final OAM until actual script cleanup'},uniqueVisuals:visuals.size,summary:{observations:raw.length,maxObjects:Math.max(...frames.map(f=>f.stats.objects)),maxLine:Math.max(...frames.map(f=>f.stats.peak)),maxBgTiles:Math.max(...frames.map(f=>f.atlas.background.length/16))},scope:action.scope},raw};
}
