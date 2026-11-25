// Candidate coordinate adapter for source presentation state, not a NES PPU.
// Source NMI call boundaries are observations, not cycle-accurate frames.
import {check,hash} from './source.mjs';
import {initializedBattle,itemEffectRoutes} from './battle-transition-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {compilePixelComposition,pixelCompositionPalettes,compositionWords} from './npc-composition.mjs';
import {originalFormation} from './battle-placement-source.mjs';
import {formationPixels,adaptPoint} from './battle-placement-budget.mjs';
import {rearX} from './battle-layout.mjs';
import {originalNumberRun} from './battle-number-source.mjs';
import {composeBattleNumbers} from './battle-number-composition.mjs';
const W=168,H=152,sourceY=[44,72,100,128],targetY=[10,34,58,82];
const select=(c,p)=>{c.banks=[p*2,p*2+1,0x3e,0x3f];c.m[0x7cf6]=p;};
function bgPixel(b,x,y,table=0){
 x=(x+512)%512;y=(y+240)%240;table^=x>>8;x&=255;
 const base=0x2000+(table&1)*1024,tx=x>>3,ty=y>>3,tile=b[base+ty*32+tx],a=b[base+960+(ty>>2)*8+(tx>>2)],p=(a>>(((ty&2)<<1)+(tx&2)))&3,bit=7-(x&7),at=tile*16+(y&7),v=(b[at]>>bit&1)|((b[at+8]>>bit&1)<<1);
 return {index:v?p*4+v:0,opaque:v!==0};
}
export function scenePixels(c,ppu,{back=false,target=2,layout={shift:0},numberOwners=[],formation,partyShift=0,statusOwners=false,partyY=targetY,enemyY=16,terrainHeight=16,numberEnemyOffset=0,effectOrigin}={}){
 const b=ppu.bytes,colors=cgbPalette(b.subarray(0x3f00,0x3f20)),pixels=new Uint16Array(W*H).fill(colors.readUInt16LE(0)),used=new Uint8Array(W*H),enemy=new Uint8Array(W*H),party=new Uint8Array(W*H),numberCoverage={sourcePixels:0,viewportPixels:0},partyCoverage={sourcePixels:0,viewportPixels:0},statusCoverage={sourcePixels:0,viewportPixels:0};
 const put=(x,y,index)=>{if(x>=0&&x<160&&y>=0&&y<144)pixels[y*W+x]=colors.readUInt16LE(index*2);};
 // Keep the previous field/party anchors. The terrain is a cropped strip,
 // not a scale operation on party art. This remains a presentation candidate.
 for(let y=0;y<terrainHeight;y++)for(let x=0;x<160;x++)put(x,y,bgPixel(b,Math.floor(x*256/160),y+8).index);
 for(let y=0;y<84;y++)for(let x=0;x<126;x++){
  // 2F/AE5E..AEA3 uses $07 for the enemy scroll page. $06 is not this
  // raster region's page: it wraps incoming back-attack enemies into party.
  const sx=16+Math.floor((x+.5)*8/7),sy=48+Math.floor((y+.5)*8/7),q=bgPixel(b,(back?255-sx:sx)+c.m[15],sy,c.m[7]&1);
  const dx=rearX(back?159-x:x,layout,back);put(dx,enemyY+y,q.index);if(dx>=0&&dx<160&&q.opaque)enemy[(enemyY+y)*W+dx]=1;
 }
 // Stone party lives in the BG, so it must participate in the same layer
 // composition as terrain/enemies and survive until the source clears it.
 for(let slot=0;slot<4;slot++)for(let sy=[40,72,96,128][slot];sy<[72,96,128,152][slot];sy++)for(let sx=160;sx<256;sx++){
  const q=bgPixel(b,back?255-sx:sx,sy);if(q.opaque){const x=back?159-(sx-80):sx-80,y=sy-sourceY[slot]+partyY[slot]+partyShift;put(x,y,q.index);if(x>=0&&x<160&&y>=0&&y<144)party[y*W+x]=1;}
 }
 const basePixels=pixels.slice(),baseUsed=new Uint8Array(W*H),numberObjects=[];
 for(let i=0;i<64;i++){
  const at=0x200+i*4,sy=c.m[at]+1,sx=c.m[at+3],tile=c.m[at+1],attr=c.m[at+2];if(sy>239)continue;
  check(!(attr&32),'Unsupported behind-BG source OBJ in scene adapter');
  const slot=i>=40?Math.floor((i-40)/6):statusOwners&&i<8?Math.floor(i/2):target;
  const owner=i<40?numberOwners[i]:null,number=owner?{sourceSlot:i,target:owner.target,enemy:owner.enemy,palette:attr&3,pixels:new Uint8Array(64)}:null;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const px=attr&64?7-x:x,py=attr&128?7-y:y,k=0x1000+tile*16+py,bit=7-px,v=(b[k]>>bit&1)|((b[k+8]>>bit&1)<<1);if(!v)continue;
   const canonical=back?255-(sx+x):sx+x;let dx=back?159-(canonical-80):canonical-80,dy=sy+y-sourceY[slot]+partyY[slot]+partyShift;
   if(effectOrigin&&i<40&&!owner){dx=(back?159-(canonical+effectOrigin.x):canonical+effectOrigin.x);dy=sy+y+effectOrigin.y;}
   if(owner){
    numberCoverage.sourcePixels++;
    if(owner.enemy){check(formation,'Enemy numeral formation');const cx=c.m[0x7dd7+owner.target*2],bottom=c.m[0x7e07+owner.target]+1,[ax,ay]=adaptPoint(formation,cx,bottom),anchor=rearX(back?159-ax:ax,layout,back),sourceCenter=back?254-cx:cx;
     // Keep digit glyphs and sine motion unscaled; clamp the whole 32px
     // number strip at viewport edges instead of cutting significant digits.
     dx=Math.max(0,Math.min(128,anchor-16))+sx+x-(sourceCenter-16);dy=ay+sy+y-bottom+enemyY-16+numberEnemyOffset;
    }else{dx=(back?sx+x-16:sx+x-80);dy=sy+y-sourceY[owner.target]+partyY[owner.target]+partyShift;}
    // The cropped terrain leaves less room above party slot 0 than NES.
    // Contain the entire 8px glyph at the viewport edge, never its pixels.
    dy=Math.max(0,Math.min(136,dy-y))+y;
    number.x=dx-x;number.y=dy-y;number.pixels[y*8+x]=v;
   }
   if(i>=40)partyCoverage.sourcePixels++;if(statusOwners&&i<8)statusCoverage.sourcePixels++;
   if(dx<0||dx>=160||dy<0||dy>=144)continue;if(i>=40)partyCoverage.viewportPixels++;if(statusOwners&&i<8)statusCoverage.viewportPixels++;if(owner)numberCoverage.viewportPixels++;const p=dy*W+dx;if(!owner&&!baseUsed[p]){baseUsed[p]=1;basePixels[p]=colors.readUInt16LE((16+(attr&3)*4+v)*2);}if(i>=40)party[p]=1;if(used[p])continue;used[p]=1;put(dx,dy,16+(attr&3)*4+v);
  }
  if(number?.pixels.some(Boolean))numberObjects.push(number);
 }
 check(numberCoverage.sourcePixels===numberCoverage.viewportPixels,'Number glyph clipped by viewport');
 return {pixels,basePixels,numberObjects,numberCoverage,partyCoverage,statusCoverage,objPalette:colors.subarray(32),sourcePalettes:colors,sourcePaletteSha256:hash(b.subarray(0x3f00,0x3f20)),partyEnemyOverlapPixels:party.reduce((n,v,i)=>n+(v&&enemy[i]?1:0),0)};
}
export function originalSceneSequence(rom,{back=false,retreat=8,numbers=false,enemyValues=[65535,65535,65535,1234,65535,65535,65535,65535]}={}){
 const formation=originalFormation(rom,3),layout=formationPixels(rom,formation,{retreat}).layout;
 const observations=[],numberRuns=[];let phase='entry',last,numberOwners=[],numberFrame=null;
 const capture=(boundary,c,ppu)=>{
  const picture=scenePixels(c,ppu,{back,layout,numberOwners,formation}),key=hash(Buffer.concat([Buffer.from(picture.pixels.buffer),picture.objPalette]));
  const numberFrames=phase.endsWith('-numbers')&&numberFrame!==null&&boundary.reason==='before-NMI-wait'?[numberFrame]:[];
  if(last?.key===key&&last.phase===phase){last.boundaries++;last.numberFrames.push(...numberFrames);last.partyEnemyOverlapPixels=Math.max(last.partyEnemyOverlapPixels,picture.partyEnemyOverlapPixels);return;}
  last={phase,key,boundaries:1,boundary:boundary.boundary,numberFrame,numberFrames,enemyScroll:boundary.enemyScroll,enemyPage:c.m[7]&1,...picture,sourceOamSha256:boundary.oamSha256,sourceChrSha256:boundary.chrSha256};observations.push(last);
 };
 const {m}=initializedBattle(rom,{formation:3,back,rows:[0,0,0,0],terrain:0,capture}),c=m.c;
 m.begin();m.call(0xb469);m.finish();
 const initialMap=Buffer.from(m.ppu.bytes.subarray(0x2000,0x2800));
 for(const [name,raw1,raw2] of [['stone',64,0],['restored',0,0],['toad',32,0],['normal',0,0]]){
  phase=name;select(c,0x1a);c.m[0x5b]=0x75;c.m[0x5c]=0x75;c.m[0x5f]=0;c.m[0x52]=0;c.m[0x7576]=raw1;c.m[0x7577]=raw2;c.call(0x9d1d);
  select(c,0x17);c.call(0x9e80);m.begin();c.x=0;m.call(0xb5c3);m.finish();
 }
 check(m.ppu.bytes.subarray(0x2000,0x2800).equals(initialMap),'Sequence status background restore');
 const route=itemEffectRoutes(rom).routes.find(r=>r.item===0xa6&&!r.miniForbidden);
 phase='item';c.m[0x95]=0;c.x=0;c.m[0xcc]=1;c.m[0x7e98]=128;c.m[0x7e99]=c.m[0x7e9b]=32;c.m[0x7e88]=route.spell;c.m[0x7e9d]=route.animation;c.m[0xca]=route.sound;
 m.begin();m.call(0xb15e);m.finish();check(c.m[0xcc]===0&&c.m[0xc0]===208,'Sequence item return');
 phase='next-selection';m.begin();m.call(0xb5b8);m.finish();
 if(numbers)for(const enemy of [true,false]){
  phase=enemy?'enemy-numbers':'party-numbers';numberFrame=null;numberOwners=[];
  const run=originalNumberRun(rom,m,{enemy,values:enemy?enemyValues:[0,0x4000,0x8038,65535],onGroup:g=>{for(let i=0;i<4;i++)numberOwners[g.first+i]=g;},onFrame:f=>{numberFrame=f.frame;}});numberRuns.push(run);
  phase=enemy?'enemy-numbers-clear':'party-numbers-clear';select(c,0x17);m.begin();m.call(0xb5b8);m.finish();numberOwners=[];numberFrame=null;
 }
 return {observations,numberRuns,source:{formation:3,back,layout,jobs:[0,1,2,3],item:0xa6,actor:0,target:2,numbers,scope:'Same original VRAM/OAM from entry through forced status updates, item body and optional number consumers. No command selection, HP calculation, battle message payloads or normal-play claim. Uniform rear retreat requested by user; terrain crop/7:8 enemies remain presentation candidates.'}};
}
export function sceneComposition(rom,options={}){
 const source=originalSceneSequence(rom,options),frames=[],failures=[];
 // A palette set per unchanged source OBJ palette avoids reindexing every
 // tile when one actor changes pose. This is a finite fixture palette plan;
 // the live consumer must plan from its current assets, not future frames.
 const groups=new Map();for(const f of source.observations){const obj=Buffer.concat([0,1,5,7].map(p=>f.sourcePalettes.subarray(p*8,p*8+8))),key=hash(obj);if(!groups.has(key))groups.set(key,{obj,images:[]});groups.get(key).images.push(f.pixels);}
 for(const g of groups.values())g.palettes=pixelCompositionPalettes(g.images,g.obj,{width:W,height:H,maxPalettes:7});
 for(const [i,f] of source.observations.entries()){
  // Residual OBJ need enemy colors too: copying only NES OBJ palettes leaves
  // mixed enemy cells uncovered. This four-palette choice is a fixture policy,
  // not a universal solver. Failure is retained rather than dropping pixels.
  try{const objPalette=Buffer.concat([0,1,5,7].map(p=>f.sourcePalettes.subarray(p*8,p*8+8))),palettes=groups.get(hash(objPalette)).palettes,c=f.numberObjects.length&&options.layeredNumbers!==false?composeBattleNumbers(f,{width:W,height:H}):compilePixelComposition(f.pixels,objPalette,{width:W,height:H,palettes});
   check(compositionWords(c).every((v,i)=>v===f.pixels[i]),'Whole scene RGB555 roundtrip');frames.push({...f,index:i,composition:c});
  }catch(e){if(!/^Composition (OAM|scanline|BG tile) capacity$|^No lossless global palette cover$/.test(e.message))throw e;failures.push({index:i,phase:f.phase,numberFrame:f.numberFrame,reason:e.message});}
 }
 return {source:source.source,numberRuns:source.numberRuns,frames,failures,summary:{observations:source.observations.length,composed:frames.length,failed:failures.length,maxBgTiles:Math.max(...frames.map(f=>f.composition.stats.bgTiles)),maxObjects:Math.max(...frames.map(f=>f.composition.stats.objects)),maxLine:Math.max(...frames.map(f=>f.composition.stats.peak))}};
}
