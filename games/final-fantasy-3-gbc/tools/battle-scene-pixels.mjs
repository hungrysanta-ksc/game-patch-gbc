// Candidate coordinate adapter for source presentation state, not a NES PPU.
// Source NMI call boundaries are observations, not cycle-accurate frames.
import {check,hash} from './source.mjs';
import {initializedBattle,itemEffectRoutes} from './battle-transition-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {compilePixelComposition,pixelCompositionPalettes,compositionWords} from './npc-composition.mjs';
import {originalFormation} from './battle-placement-source.mjs';
import {formationPixels} from './battle-placement-budget.mjs';
import {rearX} from './battle-layout.mjs';
const W=168,H=152,sourceY=[44,72,100,128],targetY=[10,34,58,82];
const select=(c,p)=>{c.banks=[p*2,p*2+1,0x3e,0x3f];c.m[0x7cf6]=p;};
function bgPixel(b,x,y,table=0){
 x=(x+512)%512;y=(y+240)%240;table^=x>>8;x&=255;
 const base=0x2000+(table&1)*1024,tx=x>>3,ty=y>>3,tile=b[base+ty*32+tx],a=b[base+960+(ty>>2)*8+(tx>>2)],p=(a>>(((ty&2)<<1)+(tx&2)))&3,bit=7-(x&7),at=tile*16+(y&7),v=(b[at]>>bit&1)|((b[at+8]>>bit&1)<<1);
 return {index:v?p*4+v:0,opaque:v!==0};
}
export function scenePixels(c,ppu,{back=false,target=2,layout={shift:0}}={}){
 const b=ppu.bytes,colors=cgbPalette(b.subarray(0x3f00,0x3f20)),pixels=new Uint16Array(W*H).fill(colors.readUInt16LE(0)),used=new Uint8Array(W*H),enemy=new Uint8Array(W*H),party=new Uint8Array(W*H);
 const put=(x,y,index)=>{if(x>=0&&x<160&&y>=0&&y<144)pixels[y*W+x]=colors.readUInt16LE(index*2);};
 // Keep the previous field/party anchors. The terrain is a cropped strip,
 // not a scale operation on party art. This remains a presentation candidate.
 for(let y=0;y<16;y++)for(let x=0;x<160;x++)put(x,y,bgPixel(b,Math.floor(x*256/160),y+8).index);
 for(let y=0;y<84;y++)for(let x=0;x<126;x++){
  // 2F/AE5E..AEA3 uses $07 for the enemy scroll page. $06 is not this
  // raster region's page: it wraps incoming back-attack enemies into party.
  const sx=16+Math.floor((x+.5)*8/7),sy=48+Math.floor((y+.5)*8/7),q=bgPixel(b,(back?255-sx:sx)+c.m[15],sy,c.m[7]&1);
  const dx=rearX(back?159-x:x,layout,back);put(dx,16+y,q.index);if(dx>=0&&dx<160&&q.opaque)enemy[(16+y)*W+dx]=1;
 }
 // Stone party lives in the BG, so it must participate in the same layer
 // composition as terrain/enemies and survive until the source clears it.
 for(let slot=0;slot<4;slot++)for(let sy=[40,72,96,128][slot];sy<[72,96,128,152][slot];sy++)for(let sx=160;sx<256;sx++){
  const q=bgPixel(b,back?255-sx:sx,sy);if(q.opaque){const x=back?159-(sx-80):sx-80,y=sy-sourceY[slot]+targetY[slot];put(x,y,q.index);if(x>=0&&x<160&&y>=0&&y<144)party[y*W+x]=1;}
 }
 for(let i=0;i<64;i++){
  const at=0x200+i*4,sy=c.m[at]+1,sx=c.m[at+3],tile=c.m[at+1],attr=c.m[at+2];if(sy>239)continue;
  check(!(attr&32),'Unsupported behind-BG source OBJ in scene adapter');
  const slot=i>=40?Math.floor((i-40)/6):target;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const px=attr&64?7-x:x,py=attr&128?7-y:y,k=0x1000+tile*16+py,bit=7-px,v=(b[k]>>bit&1)|((b[k+8]>>bit&1)<<1);if(!v)continue;
   const canonical=back?255-(sx+x):sx+x,dx=back?159-(canonical-80):canonical-80,dy=sy+y-sourceY[slot]+targetY[slot];
   if(dx<0||dx>=160||dy<0||dy>=144)continue;const p=dy*W+dx;if(i>=40)party[p]=1;if(used[p])continue;used[p]=1;put(dx,dy,16+(attr&3)*4+v);
  }
 }
 return {pixels,objPalette:colors.subarray(32),sourcePalettes:colors,sourcePaletteSha256:hash(b.subarray(0x3f00,0x3f20)),partyEnemyOverlapPixels:party.reduce((n,v,i)=>n+(v&&enemy[i]?1:0),0)};
}
export function originalSceneSequence(rom,{back=false,retreat=8}={}){
 const layout=formationPixels(rom,originalFormation(rom,3),{retreat}).layout;
 const observations=[];let phase='entry',last;
 const capture=(boundary,c,ppu)=>{
  const picture=scenePixels(c,ppu,{back,layout}),key=hash(Buffer.concat([Buffer.from(picture.pixels.buffer),picture.objPalette]));
  if(last?.key===key&&last.phase===phase){last.boundaries++;last.partyEnemyOverlapPixels=Math.max(last.partyEnemyOverlapPixels,picture.partyEnemyOverlapPixels);return;}
  last={phase,key,boundaries:1,boundary:boundary.boundary,enemyScroll:boundary.enemyScroll,enemyPage:c.m[7]&1,...picture,sourceOamSha256:boundary.oamSha256,sourceChrSha256:boundary.chrSha256};observations.push(last);
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
 return {observations,source:{formation:3,back,layout,jobs:[0,1,2,3],item:0xa6,actor:0,target:2,scope:'Same original VRAM/OAM from entry through forced status updates and item visual body. No command selection, HP calculation, battle message payloads, digits or normal-play claim. Uniform rear retreat requested by user; terrain crop/7:8 enemies remain presentation candidates.'}};
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
  try{const objPalette=Buffer.concat([0,1,5,7].map(p=>f.sourcePalettes.subarray(p*8,p*8+8))),palettes=groups.get(hash(objPalette)).palettes,c=compilePixelComposition(f.pixels,objPalette,{width:W,height:H,palettes});
   check(compositionWords(c).every((v,i)=>v===f.pixels[i]),'Whole scene RGB555 roundtrip');frames.push({...f,index:i,composition:c});
  }catch(e){if(!/^Composition (OAM|scanline|BG tile) capacity$|^No lossless global palette cover$/.test(e.message))throw e;failures.push({index:i,phase:f.phase,reason:e.message});}
 }
 return {source:source.source,frames,failures,summary:{observations:source.observations.length,composed:frames.length,failed:failures.length,maxBgTiles:Math.max(...frames.map(f=>f.composition.stats.bgTiles)),maxObjects:Math.max(...frames.map(f=>f.composition.stats.objects)),maxLine:Math.max(...frames.map(f=>f.composition.stats.peak))}};
}
