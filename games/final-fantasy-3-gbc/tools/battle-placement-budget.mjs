// Finite host audit of asset residency/change supply. Not a runtime renderer.
import {check,hash} from './source.mjs';
import {originalFormation,battleCpu,effectConditionAudit} from './battle-placement-source.mjs';
import {monsterGraphic,tilePixels} from './render-budget-source.mjs';
import {recordTransfers,resolveBoss206} from './battle-display-source.mjs';
import {originalBattleFrames} from './battle-composition-assets.mjs';
import {segment} from './state-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {pixelCompositionPalettes,compilePixelComposition,compositionWords} from './npc-composition.mjs';
const W=168,H=152;
const pal=(rom,id)=>cgbPalette([15,...rom.subarray(0x5cc10+id*3,0x5cc13+id*3)]);
export const budgetFormationIds=[3,13,47,44,234,301,79,83];
// Candidate only: preserve source relative slots; do not recenter on alpha bounds.
// Normal region x16..160/y48..144 -> x0..126/y16..100; boss -> 96x64.
export function adaptPoint(f,x,y){const n=f.layout===9?2:7,d=f.layout===9?3:8;return [Math.floor((x-16)*n/d),16+Math.floor((y-48)*n/d)];}
function paint(pixels,quads,palettes){const used=new Uint8Array(W*H);for(const q of quads)for(let y=0;y<8;y++)for(let x=0;x<8;x++){const xx=q.x+x,yy=q.y+y,v=q.pixels[y*8+x];if(!v||xx<0||xx>=W||yy<0||yy>=H)continue;const at=yy*W+xx;if(used[at])continue;used[at]=1;pixels[at]=palettes[q.palette].readUInt16LE(v*2);}}
function changedCells(a,b){let count=0;for(let cy=0;cy<H/8;cy++)for(let cx=0;cx<W/8;cx++){let different=false;for(let y=0;y<8;y++)for(let x=0;x<8;x++)different||=a[(cy*8+y)*W+cx*8+x]!==b[(cy*8+y)*W+cx*8+x];count+=+different;}return count;}
export function formationPixels(rom,f){
 check(!f.unresolved,'Unresolved formation is not a render fixture');const pixels=new Uint16Array(W*H),colors=f.palettes.map(id=>pal(rom,id)),images=[];
 for(const s of f.slots.filter(s=>s.monster!==null)){
  const g=s.monster===206?resolveBoss206(rom).graphic:monsterGraphic(rom,s.monster);check(!g.unresolved,'Unresolved formation graphics');
  const sw=g.w*8,sh=g.h*8,[sx,sy,rw,rh]=s.rect;check(sw===rw&&sh<=rh,'Graphic does not fit original slot');
  check(sh===rh||(g.type===0&&rh-sh===16),'Unknown original graphics padding');
  const origin=[sx,sy+(rh-sh)],[x,y]=adaptPoint(f,...origin),[right,bottom]=adaptPoint(f,origin[0]+sw,origin[1]+sh),w=right-x,h=bottom-y;
  check(x>=0&&y>=0&&x+w<=128&&y+h<=104,'Candidate enemy field bounds');
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const ox=Math.floor((xx+.5)*sw/w),oy=Math.floor((yy+.5)*sh/h),t=(oy>>3)*g.w+(ox>>3),v=g.tiles[t][(oy&7)*8+(ox&7)];pixels[(y+yy)*W+x+xx]=v?colors[g.attrs[t]].readUInt16LE(v*2):0;}
  images.push({slot:s.slot,monster:s.monster,sourceRect:[...origin,sw,sh],candidateRect:[x,y,w,h],sourceAnchor:s.center,candidateAnchor:adaptPoint(f,s.center[0],s.center[1]+1)});
 }
 return {pixels,images};
}
function hitFrames(rom,f,target,base,party){
 const c=battleCpu(rom,0x19),trace=recordTransfers(c);c.m[0x7e88]=29;c.call(0xaf6f);c.call(0xb589);c.a=c.m[0x7e8d];c.call(0xab08);const magicPalette=cgbPalette([15,...c.m.subarray(0x7d14,0x7d17)]),tiles=tilePixels(trace.bytes.subarray(0x1000,0x2000));
 segment(c,0xb696,0xb6ca);c.m[0x7e9a]=64;c.m[0x90]=target.slot;for(const s of f.slots)c.m.set(s.center,0x7dd7+s.slot*2);
 const [anchorX,anchorY]=adaptPoint(f,target.center[0],target.center[1]+1),frames=[];
 for(let index=1;index<=c.m[0x7300];index++){
  c.m[0x7e9c]=index;segment(c,0xb711,0xb799);check(c.m[0x8c]===((target.center[0]-24)&255)&&c.m[0x8d]===((target.center[1]-16)&255),'Magic follows selected original center');
  const quads=Array.from({length:36},(_,i)=>{const at=0x200+i*4,tile=c.m[at+1],attr=c.m[at+2];return {x:anchorX+c.m[at+3]-target.center[0],y:anchorY+c.m[at]-target.center[1],palette:0,tile,pixels:Uint8Array.from({length:64},(_,p)=>tiles[tile][(attr&128?7-(p>>3):p>>3)*8+(attr&64?7-(p&7):p&7)])};});
  // B7B5 places pieces 24..35 before 0..23 for an enemy target.
  const ordered=quads.slice(24).concat(quads.slice(0,24)).filter(q=>q.tile);const pixels=base.slice();paint(pixels,ordered,[magicPalette]);paint(pixels,party,[252,253,254].map(id=>pal(rom,id)));
  let outsideViewport=0,menuPixels=0;for(const q of ordered)for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(q.pixels[y*8+x]){const xx=q.x+x,yy=q.y+y;outsideViewport+=+(xx<0||xx>=160||yy<0||yy>=144);menuPixels+=+(xx>=0&&xx<160&&yy>=104&&yy<144);}
  frames.push({target:target.slot,entry:index,pixels,outsideViewport,menuPixels});
 }
 return {frames,magicPalette};
}
export function placementBudgetAudit(rom){
 const formations=[];for(let id=0;id<512;id++)for(const endpoint of ['min','max'])formations.push({...originalFormation(rom,id,{endpoint}),endpoint});
 const effectConditions=effectConditionAudit(rom),standing=originalBattleFrames(rom).party,rows=[];
 for(const id of budgetFormationIds){
  const f=formations.find(f=>f.id===id&&f.endpoint==='max');check(!f.unresolved,'Representative formation unresolved');const {pixels:base,images}=formationPixels(rom,f),idle=base.slice();paint(idle,standing,[252,253,254].map(id=>pal(rom,id)));
  const frames=[{target:null,entry:0,pixels:idle,outsideViewport:0,menuPixels:0}];let magicPalette;
  for(const target of f.slots.filter(s=>s.monster!==null)){const hit=hitFrames(rom,f,target,base,standing);magicPalette=hit.magicPalette;frames.push(...hit.frames,{target:target.slot,entry:0,pixels:idle,outsideViewport:0,menuPixels:0});}
  const objPalette=Buffer.concat([...f.palettes.map(id=>pal(rom,id)),magicPalette,pal(rom,253)]),palettes=pixelCompositionPalettes(frames.map(f=>f.pixels),objPalette,{width:W,height:H,maxPalettes:7}),allTiles=new Set(),allObjects=new Set(),states=[],transitions=[];
  for(const frame of frames){
   try{const c=compilePixelComposition(frame.pixels,objPalette,{width:W,height:H,palettes});check(compositionWords(c).every((v,i)=>v===frame.pixels[i]),'Formation RGB555 round trip');
    const tiles=[];for(let i=0;i<c.background.length;i+=16){const key=c.background.subarray(i,i+16).toString('hex');tiles.push(key);allTiles.add(key);}for(let i=0;i<c.objGraphics.length;i+=16)allObjects.add(c.objGraphics.subarray(i,i+16).toString('hex'));
    states.push({target:frame.target,entry:frame.entry,...c.stats,pixelsSha256:hash(Buffer.from(frame.pixels.buffer)),tiles,objBytes:c.objGraphics.length,outsideViewport:frame.outsideViewport,menuPixels:frame.menuPixels});
   }catch(e){if(!/^Composition (OAM|scanline|BG tile) capacity$/.test(e.message))throw e;states.push({target:frame.target,entry:frame.entry,failure:e.message,outsideViewport:frame.outsideViewport,menuPixels:frame.menuPixels});}
  }
  for(let i=1;i<frames.length;i++){
   const a=states[i-1],b=states[i],cells=changedCells(frames[i-1].pixels,frames[i].pixels),newTiles=a.tiles&&b.tiles?b.tiles.filter(t=>!a.tiles.includes(t)).length:undefined;
   transitions.push({from:i-1,to:i,changedCells:cells,...(newTiles===undefined?{unresolved:'adjacent composition failed'}:{newPatternBytes:newTiles*16,activeNextUnion:new Set([...a.tiles,...b.tiles]).size}),scope:'Pattern-set difference only; stable allocation, map spans, OAM and palette transfers still required'});
  }
  const valid=states.filter(s=>!s.failure),max=k=>Math.max(0,...valid.map(s=>s[k])),peak=k=>{const values=transitions.map(t=>t[k]).filter(v=>v!==undefined);return values.length?Math.max(...values):null;};
  rows.push({formation:id,layout:f.layout,palettes:f.palettes,images,states:states.map(({tiles,...s})=>s),transitions,summary:{states:states.length,failedStates:states.length-valid.length,complete:states.length===valid.length,unresolvedTransitions:transitions.filter(t=>t.unresolved).length,bgPalettes:palettes.length,maxBgTiles:max('bgTiles'),maxObjects:max('objects'),maxLine:max('peak'),residentPatternUnion:allTiles.size,residentObjectUnion:allObjects.size,maxActiveNextUnion:peak('activeNextUnion'),maxChangedCells:peak('changedCells'),maxNewPatternBytes:peak('newPatternBytes'),maxMenuPixels:Math.max(...states.map(s=>s.menuPixels)),maxOutsideViewport:Math.max(...states.map(s=>s.outsideViewport))}});
 }
 const unresolved=formations.filter(f=>f.unresolved),kinds=[...new Set(unresolved.map(f=>f.unresolved.kind))];
 return {formations,effectConditions,rows,summary:{formationProbes:formations.length,placed:formations.length-unresolved.length,unresolved:unresolved.length,unresolvedKinds:Object.fromEntries(kinds.map(k=>[k,unresolved.filter(f=>f.unresolved.kind===k).length])),representatives:rows.length,states:rows.reduce((n,r)=>n+r.summary.states,0),failedStates:rows.reduce((n,r)=>n+r.summary.failedStates,0)},scope:'Host palette/pixel/supply feasibility only. Script 29 crossed with each occupied target is a diagnostic, not proven legal casts. Standing original-size party, no terrain/UI pixels. Candidate enemy scaling/anchors require art approval. No new GBC/audio timing observation.'};
}
