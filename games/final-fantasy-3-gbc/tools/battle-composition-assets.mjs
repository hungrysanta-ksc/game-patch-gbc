// Original consumers plus explicitly labelled presentation/diagnostic adapters.
import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {segment} from './state-source.mjs';
import {recordTransfers} from './battle-display-source.mjs';
import {battleInventory,monsterGraphic,tilePixels} from './render-budget-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {pixelCompositionPalettes,compilePixelComposition,compositionWords} from './npc-composition.mjs';
const width=168,height=152;
function cpu(rom,pair){const c=new Driver6502(rom);c.banks=[pair*2,pair*2+1,0x3e,0x3f];c.m[0x7cf6]=pair;return c;}
const palette=(rom,id)=>cgbPalette([15,...rom.subarray(0x5cc10+id*3,0x5cc13+id*3)]);
function draw(pixels,quads,palettes){
 const occupied=new Uint8Array(width*height);for(const q of quads)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const px=q.x+x,py=q.y+y;if(px<0||py<0||px>=width||py>=height)continue;const v=q.pixels[y*8+x],at=py*width+px;if(!v||occupied[at])continue;occupied[at]=1;pixels[at]=palettes[q.palette].readUInt16LE(v*2);
 }
}
function quads(c,start,count,chr){return Array.from({length:count},(_,i)=>{const at=start+i*4,attr=c.m[at+2],tile=c.m[at+1];return {x:c.m[at+3],y:c.m[at]+1,tile,palette:attr&3,slot:(at-0x200)/4,pixels:Uint8Array.from({length:64},(_,p)=>chr[tile][(attr&128?7-(p>>3):p>>3)*8+(attr&64?7-(p&7):p&7)])};});}
export function originalBattleFrames(rom,{monster=6,paletteIds=[143,152],scriptId=29}={}){
 const b=battleInventory(rom),formation=b.formations.find(f=>f.palettes.join()===paletteIds.join()&&f.slots.some(s=>s.id===monster&&s.max));check(formation,'Original enemy/palette reference');
 const g=monsterGraphic(rom,monster);check(!g.unresolved,'Enemy graphics');const colors=paletteIds.map(id=>palette(rom,id)),base=new Uint16Array(width*height),sw=g.w*8,sh=g.h*8,w=g.type>=6?96:sw*7/8,h=g.type>=6?64:sh*7/8;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.floor((x+.5)*sw/w),sy=Math.floor((y+.5)*sh/h),t=(sy>>3)*g.w+(sx>>3),v=g.tiles[t][(sy&7)*8+(sx&7)];base[(y+24)*width+x]=v?colors[g.attrs[t]].readUInt16LE(v*2):0;}
 const p=cpu(rom,0x17),trace=recordTransfers(p);p.call(0x9f98);p.m.set([0,1,2,3],0x7d8b);p.call(0x9e01);p.call(0xa9ed);
 const partyPalettes=[252,253,254].map(id=>palette(rom,id)),partyIds=[...p.m.subarray(0x7d93,0x7d97)];p.call(0xb4ac);check(p.m.subarray(0x7d83,0x7d87).every(v=>v===2),'Original normal party pose');p.banks=[0x32,0x33,0x3e,0x3f];p.m[0x7cf6]=0x19;p.m.set([192,192,192,192],0xc0);p.m.set([40,72,104,136],0xc4);p.call(0x90d8);
 const partyRaw=Buffer.from(p.m.subarray(0x2a0,0x300)),party=quads(p,0x2a0,24,tilePixels(trace.bytes.subarray(0x1000,0x2000))).map((q,i)=>({...q,x:q.x-64,y:q.y-[40,72,104,136][i/6|0]+[10,34,58,82][i/6|0]}));
 check(party.every(q=>q.pixels.some(Boolean)),'Visible original party graphics');
 const c=cpu(rom,0x19),gfx=recordTransfers(c);c.m[0x7e88]=scriptId;c.call(0xaf6f);c.call(0xb589);c.a=c.m[0x7e8d];c.call(0xab08);
 const magicPalette=cgbPalette([15,...c.m.subarray(0x7d14,0x7d17)]),palettes=[...colors,magicPalette,partyPalettes[1]],objPalette=Buffer.concat(palettes),script=b.magicScripts[scriptId];check(script,'Original hit script');
 const frames=[];let at=1;while(at<=script.length){
  c.m.set(partyRaw,0x2a0);c.m[0x7e88]=scriptId;segment(c,0xb696,0xb6ca);c.m[0x7e9c]=at;c.m[0x7e9a]=64;c.m[0x90]=1;c.m[0x7dd9]=80;c.m[0x7dda]=80;segment(c,0xb711,0xb799);c.call(0xb7b5);
  const magic=quads(c,0x200,64,tilePixels(gfx.bytes.subarray(0x1000,0x2000))).filter(q=>q.tile>=0x49&&q.tile<=0x68&&q.y<=240).map(q=>({...q,x:q.x-24,y:q.y-25,palette:0}));
  const partial=base.slice();draw(partial,magic,[magicPalette]);const pixels=partial.slice();draw(pixels,party,partyPalettes);
  const frame=rom[script.begin+at]===255?rom[script.begin+at+1]&127:rom[script.begin+at]&127;
  frames.push({byteIndex:at,frame,sourceDurationFrames:4,sourceOamSha256:hash(Buffer.from(c.m.subarray(0x200,0x300))),pixels,partial,magicObjects:magic.length});at+=rom[script.begin+at]===255?2:1;
 }
 return {frames,objPalette,party,base,source:{monster,paletteIds,exampleFormation:formation.id,scriptId,jobs:[0,1,2,3],partyPaletteIds:partyIds,sourceSize:[sw,sh],candidateSize:[w,h],scope:'Original hit-script order and source pixel consumers; diagnostic enemy anchor (0,24), target center (56,56), standing party; no source reachability claim. General 7/8 and 96x64 art remain candidates.'}};
}
export function battleCompositionAssets(rom){
 const source=originalBattleFrames(rom),paletteOptions={width,height,maxPalettes:7},palettes=pixelCompositionPalettes(source.frames.map(f=>f.pixels),source.objPalette,paletteOptions),partialPalettes=pixelCompositionPalettes(source.frames.map(f=>f.partial),source.objPalette,paletteOptions),jobs=[],keys=new Map(),frames=[],comparison=[],blocks=[],blockKeys=new Map(),visuals=new Map();
 for(const [index,f]of source.frames.entries()){
  const c=compilePixelComposition(f.pixels,source.objPalette,{width,height,palettes}),partial=compilePixelComposition(f.partial,source.objPalette,{width,height,palettes:partialPalettes}),words=compositionWords(c),ids=[];
  check(words.every((v,i)=>v===f.pixels[i]),'Original battle pixels');
  for(let cell=0;cell<399;cell++){
   const bytes=Buffer.alloc(80);c.background.copy(bytes,0,c.map[cell]*16,c.map[cell]*16+16);
   for(const s of c.sprites.filter(s=>s.x===(cell%21)*8&&s.y===Math.floor(cell/21)*8))c.objGraphics.copy(bytes,16+s.palette*16,s.tile*16,s.tile*16+16);
   const key=bytes.toString('hex');let id=keys.get(key);if(id===undefined){id=jobs.length;keys.set(key,id);jobs.push({bytes,expected:bytes,static:true});}ids.push(id);
  }
  const rgb=Buffer.alloc(160*144*3);for(let y=0;y<144;y++)for(let x=0;x<160;x++){const v=words[y*width+x],r=v&31,g=(v>>5)&31,b=v>>10;rgb.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],(y*160+x)*3);}
  comparison.push({frame:f.frame,byteIndex:f.byteIndex,sourceDurationFrames:4,full:c.stats,partial:partial.stats,partialPlusPartyObjects:partial.stats.objects+24,partialPlusPartyPeak:Math.max(...Array.from({length:144},(_,y)=>partial.sprites.filter(q=>y>=q.y&&y<q.y+8).length+source.party.filter(q=>y>=q.y&&y<q.y+8).length))});
  const maps=[Buffer.alloc(608),Buffer.alloc(608)];for(let i=0;i<399;i++){maps[0][(i/21|0)*32+i%21]=ids[i];maps[1][(i/21|0)*32+i%21]=c.attributes[i];}
  const blockIds=[];for(const map of maps)for(let at=0;at<608;at+=16){const bytes=map.subarray(at,at+16),key=bytes.toString('hex');let id=blockKeys.get(key);if(id===undefined){id=blocks.length;blockKeys.set(key,id);blocks.push(bytes);}blockIds.push(id);}
  const visualKey=hash(Buffer.concat([...maps,c.objGraphics,c.oam]));if(!visuals.has(visualKey))visuals.set(visualKey,visuals.size);
  frames.push({label:'original hit '+f.frame,trace:index,scroll:[0,0],ids,attributes:c.attributes,palette:Buffer.concat([c.bgPalette,c.objPalette]),rgb,stats:c.stats,sourceFrame:f.frame,sourceByteIndex:f.byteIndex,sourceOamSha256:f.sourceOamSha256,sourceDurationFrames:4,atlas:{blocks:Buffer.from(blockIds),maps:Buffer.concat(maps),objects:c.objGraphics,oam:c.oam,visual:visuals.get(visualKey)}});
 }
 for(let i=0;i<frames.length;i++)check(new Set([...frames[i].ids,...frames[(i+1)%frames.length].ids]).size<=128,'Battle active/next cache union');
 for(const f of frames){const spans=Buffer.alloc((visuals.size+1)*8);for(let v=0;v<=visuals.size;v++){
  const previous=frames.find(p=>p.atlas.visual===v);for(let bank=0;bank<2;bank++){let first=38,last=-1;for(let k=0;k<38;k++)if(!previous||f.atlas.blocks[bank*38+k]!==previous.atlas.blocks[bank*38+k]){first=Math.min(first,k);last=k;}
   spans.writeUInt16LE(last<0?0:first*16,v*8+bank*4);spans.writeUInt16LE(last<0?0:(last-first+1)*16,v*8+bank*4+2);
  }}f.atlas.spans=spans;
 }
 check(jobs.length<=128&&blocks.length<=255,'Resident battle atlas limit');
 return {jobs,frames,blocks:Buffer.concat(blocks),bgTiles:Buffer.concat(jobs.map(j=>j.expected.subarray(0,16))),palettes:palettes.length,battle:{source:source.source,comparison,hostComposed:true,residentBgTiles:jobs.length,mapBlocks:blocks.length,uniqueVisuals:visuals.size,scope:'Precompiled diagnostic frame atlas; not live battle composition or a scalable all-formation atlas'}};
}
