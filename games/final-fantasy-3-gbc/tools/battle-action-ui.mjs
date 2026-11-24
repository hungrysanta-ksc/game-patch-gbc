import {check} from './source.mjs';
import {encodeTile} from './npc-composition.mjs';
export const actionRows=[13,14,15,16,17,18];
export const v6Ui={top:106,height:38,hpLeft:48,rowPitch:8};
// User-approved Korean word spacing: nearest pixel to one third of 8px.
// Compact HP digits keep their separate, fixed numeric alignment.
export const battleTextAdvance=(id,compact=false)=>compact?5:id===255?3:8;
function pixel(tiles,id,x,y){const a=id*16+y*2,b=7-x;return (tiles[a]>>b&1)|((tiles[a+1]>>b&1)<<1);}
// Source grey/white bevel and round corners; omit repeated frame padding.
export function compactOriginalBox(tiles,w,h){const out=new Uint8Array(w*h),lo=[0,1,2,5],hi=[2,5,6,7],bottom=[2,4,5,7];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=y<4,b=y>=h-4,l=x<4,r=x>=w-4,id=t?(l?247:r?249:248):b?(l?252:r?254:253):l?250:r?251:255;
  out[y*w+x]=pixel(tiles,id,l?lo[x]:r?hi[x-w+4]:5,t?lo[y]:b?bottom[y-h+4]:6);
 }return out;
}
export function drawOriginalUiText(target,w,tiles,words,x,y,{compact=false,hangul}={}){
 while(words.at(-1)===255)words=words.slice(0,-1);
 for(const id of words){const advance=battleTextAdvance(id,compact);
  check(x+advance<=w-3&&y>=0&&y+8<=target.length/w,'Battle UI text overflow; explicit layout required');
  for(let yy=0;yy<(compact?7:8);yy++)for(let xx=0;xx<advance;xx++){
   const sx=compact?Math.round(xx*6/4)+1:xx,sy=compact?yy+1:yy;
   if(pixel(id>=256?hangul:tiles,id,sx,sy)===3)target[(y+yy)*w+x+xx]=3;
  }x+=advance;
 }
}
export function projectMessageWindows(descriptors){
 check(descriptors.length===5,'Original message window population');
 // ROM coordinates/widths, explicitly adapted for V6 after live PPU checks.
 return descriptors.map(d=>({x:Math.round((d.x-8)*2/3/8)*8,y:8+Math.round((d.y-152)/2),w:Math.ceil(d.width*2/3/8)*8,h:14,source:d}));
}
export function originalActionUi(ui,flow,text,{smallHp=false}={}){
 const tiles=flow.menuTiles,palette=flow.menuPalette;
 check(flow.frames[0].sourceUi[11]===247&&flow.frames[0].sourceUi[30]===249,'Observed original HP frame endpoints');
 check(smallHp,'V6 four-row layout requires the approved compact HP digits');
 check(palette.length===8&&tiles.length===4096,'Original menu palette/font residency');
 const hp=compactOriginalBox(tiles,112,38);
 for(let i=0;i<4;i++){
  drawOriginalUiText(hp,112,tiles,ui.hp[i].name,5,3+i*8,{hangul:text.glyphs});
  drawOriginalUiText(hp,112,tiles,ui.hp[i].value,63,3+i*8,{compact:true,hangul:text.glyphs});
 }
 const layers=[{x:48,y:8,w:112,h:38,pixels:hp},...projectMessageWindows(flow.windowDescriptors).map((r,i)=>{
  const pixels=compactOriginalBox(tiles,r.w,r.h);drawOriginalUiText(pixels,r.w,tiles,ui.windows[i],4,3,{hangul:text.glyphs});return {...r,pixels};
 })];
 return {palette,layers,smallHp,frameSource:'Observed NES PPU + ROM 34/8E83 rectangles; graphics 01 F7..FF; palette 3',layout:v6Ui};
}
export function uiPixels(ui,live){const out=new Int16Array(160*48).fill(-1);
 // SCY=6: BG row 14 is screen y=106. Row 13 preserves original party feet.
 out.fill(0,8*160);
 for(const [i,l]of ui.layers.entries())if(i===0||(live&(1<<(i-1))))for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){
  check(l.x+x<160&&l.y+y<48,'V6 UI bounds');out[(l.y+y)*160+l.x+x]=l.pixels[y*l.w+x];
 }return out;
}
export function packActionUi(profiles){const glyphChunks=[],tileCounts=[],mapIds=new Map(),cells=[];
 // Small UI maps only, never combinations with battle artwork. This bounded
 // compiler is not the future arbitrary-text live producer.
 for(const p of profiles){const dict=new Map(),tiles=[];for(const e of p.entries){const pixels=uiPixels(p.uiRaster,e.live),result=Buffer.alloc(120,255);
  for(let y=1;y<6;y++)for(let x=0;x<20;x++){
   const values=[];for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)values.push(pixels[(y*8+yy)*160+x*8+xx]);
   const tile=encodeTile(values),key=tile.toString('hex');if(!dict.has(key)){dict.set(key,tiles.length);tiles.push(tile);}result[y*20+x]=48+dict.get(key);
  }
  const key=result.toString('hex');if(!mapIds.has(key)){mapIds.set(key,cells.length);cells.push(result);}e.ui=mapIds.get(key);
 }
 check(tiles.length<=80,'V6 profile UI reservation: '+tiles.length);const chunk=Buffer.alloc(1280);Buffer.concat(tiles).copy(chunk);glyphChunks.push(chunk);tileCounts.push(tiles.length);
 }check(cells.length<256,'V6 UI map index');return {cells,glyphs:Buffer.concat(glyphChunks),tileCount:Math.max(...tileCounts),tileCounts};
}
