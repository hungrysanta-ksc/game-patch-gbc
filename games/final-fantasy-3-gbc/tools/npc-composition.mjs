// Build-time feasibility compiler, not the product's per-frame renderer.
// Resolve original OBJ order before BG priority, then partition exact RGB555
// pixels into BG tiles and residual OBJ tiles. No color substitution or dropping.
import {check} from './source.mjs';
export function composePixels(scene){
 const width=scene.width??160,height=scene.height??144,cols=width/8;const colors=new Uint16Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y>>3)*cols+(x>>3),j=(scene.map[at]-128)*16+(y&7)*2,bit=7-(x&7),n=((scene.background[j]>>bit)&1)|(((scene.background[j+1]>>bit)&1)<<1);
  let color=scene.bgPalette.readUInt16LE((scene.attributes[at]*4+n)*2);
  for(const o of scene.original){if(x<o.x||x>=o.x+8||y<o.y||y>=o.y+o.h)continue;const v=o.pixels[(y-o.y)*8+x-o.x];if(!v)continue;if(!o.behind||!n)color=scene.objPalette.readUInt16LE((o.palette*4+v)*2);break;}
  colors[y*width+x]=color;
 }return colors;
}
export function encodeTile(indices){const b=Buffer.alloc(16);for(let p=0;p<64;p++){b[(p>>3)*2]|=(indices[p]&1)<<(7-(p&7));b[(p>>3)*2+1]|=(indices[p]>>1)<<(7-(p&7));}return b;}
const layerOrders=Object.fromEntries([2,4].map(n=>[n,Array.from({length:1<<n},(_,mask)=>Array.from({length:n},(_,i)=>i).filter(i=>mask&(1<<i))).sort((a,b)=>a.length-b.length)]));
function partition(colors,palette,objPalettes){const residual=colors.filter(c=>!palette.includes(c));for(const layers of layerOrders[objPalettes.length])if(residual.every(c=>layers.some(k=>objPalettes[k].slice(1).includes(c))))return layers;return null;}
// Deterministic greedy palette-set search. This changes color indices, never RGB.
// Failure is explicit; the heuristic is not a proof that no hardware fit exists.
function choosePalettes(cells,objPalettes,maxPalettes=8){
 const candidates=new Map();for(const values of cells){const colors=[...new Set(values)].sort((a,b)=>a-b);function select(start,p){if(p.length===Math.min(4,colors.length)){candidates.set(p.join(),p);return;}for(let i=start;i<colors.length;i++)select(i+1,[...p,colors[i]]);}select(0,[]);}
 const choices=[...candidates.values()].map(p=>({p,cost:cells.map(values=>partition([...new Set(values)],p,objPalettes)?.length??1000)})),cost=Array(cells.length).fill(1000),selected=[];
 while(selected.length<maxPalettes){let best,gain=0;for(const c of choices){if(selected.includes(c))continue;const g=c.cost.reduce((sum,v,i)=>sum+Math.max(0,cost[i]-v),0);if(g>gain){gain=g;best=c;}}if(!best)break;selected.push(best);for(let i=0;i<cells.length;i++)cost[i]=Math.min(cost[i],best.cost[i]);}
 check(cost.every(c=>c<1000),'No lossless global palette cover');return selected.map(c=>[...c.p,...Array(4-c.p.length).fill(c.p[0])]);
}
export function sharedCompositionPalettes(scenes,{maxPalettes=8}={}){
 check(scenes.length&&scenes.every(s=>s.objPalette.equals(scenes[0].objPalette)),'Shared OBJ palette contract');const cells=[];
 for(const scene of scenes){const pixels=composePixels(scene);for(let ty=0;ty<(scene.height??144)/8;ty++)for(let tx=0;tx<(scene.width??160)/8;tx++)cells.push(Array.from({length:64},(_,i)=>pixels[(ty*8+(i>>3))*(scene.width??160)+tx*8+(i&7)]));}
 return choosePalettes(cells,Array.from({length:scenes[0].objPalette.length/8},(_,p)=>Array.from({length:4},(_,i)=>scenes[0].objPalette.readUInt16LE((p*4+i)*2))),maxPalettes);
}
export function compileComposition(scene,{palettes}={}){
 return compilePixelComposition(composePixels(scene),scene.objPalette,{width:scene.width??160,height:scene.height??144,palettes});
}
export function pixelCompositionPalettes(images,objPalette,{width=160,height=144,maxPalettes=8}={}){
 check(images.length>0&&width>0&&height>0&&width%8===0&&height%8===0,'Pixel palette dimensions');check([16,32].includes(objPalette.length)&&maxPalettes>=1&&maxPalettes<=8,'Pixel palette budget');
 const cells=new Map();for(const pixels of images){check(pixels.length===width*height,'Pixel dimensions');for(let ty=0;ty<height/8;ty++)for(let tx=0;tx<width/8;tx++){
  const values=[...new Set(Array.from({length:64},(_,i)=>pixels[(ty*8+(i>>3))*width+tx*8+(i&7)]))].sort((a,b)=>a-b);cells.set(values.join(),values);
 }}return choosePalettes([...cells.values()],Array.from({length:objPalette.length/8},(_,p)=>Array.from({length:4},(_,i)=>objPalette.readUInt16LE((p*4+i)*2))),maxPalettes);
}
// objOnlyRow reserves one black BG tile row for a UI overlay. Its original
// opaque artwork must fit losslessly in existing OBJ palettes and budgets.
export function compilePixelComposition(pixels,objPalette,{width=160,height=144,palettes,objOnlyRow=-1}={}){
 check(width>0&&height>0&&width%8===0&&height%8===0&&pixels.length===width*height,'Pixel composition dimensions');check(pixels.every(v=>Number.isInteger(v)&&v>=0&&v<=32767),'RGB555 pixel range');
 check([16,32].includes(objPalette.length),'Residual palette format');
 const cols=width/8,rows=height/8,objPalettes=[],cells=[];
 for(let i=0;i<objPalette.length/8;i++)objPalettes.push(Array.from({length:4},(_,j)=>objPalette.readUInt16LE((i*4+j)*2)));
 for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++)cells.push(Array.from({length:64},(_,i)=>pixels[(ty*8+(i>>3))*width+tx*8+(i&7)]));
 const bgPalettes=palettes??choosePalettes(cells,objPalettes),patterns=[],patternIds=new Map(),map=Buffer.alloc(cols*rows),attributes=Buffer.alloc(cols*rows),sprites=[],objTiles=[],lines=new Uint8Array(height);
 check(bgPalettes.length>0&&bgPalettes.length<=8&&bgPalettes.every(p=>p.length===4&&p.every(v=>Number.isInteger(v)&&v>=0&&v<=32767)),'Composition palette format');
 for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++){
  const values=cells[ty*cols+tx],colors=[...new Set(values)];let best;
  for(let p=0;p<bgPalettes.length;p++){
   if(ty===objOnlyRow&&bgPalettes[p][0]!==0)continue;
   const layers=partition(colors,ty===objOnlyRow?[0]:bgPalettes[p],objPalettes);if(layers&&(!best||layers.length<best.layers.length))best={palette:p,layers};
  }
  check(best,'No lossless tile palette partition at '+tx+','+ty);
  const background=values.map(v=>ty===objOnlyRow?0:Math.max(0,bgPalettes[best.palette].indexOf(v))),tile=encodeTile(background),key=tile.toString('hex');let id=patternIds.get(key);
  if(id===undefined){id=patterns.length;check(id<256,'Composition BG tile capacity');patternIds.set(key,id);patterns.push(tile);}
  map[ty*cols+tx]=id;attributes[ty*cols+tx]=best.palette;
  const uncovered=values.map(v=>ty===objOnlyRow?v!==0:!bgPalettes[best.palette].includes(v));
  for(const p of best.layers){const indices=values.map((v,i)=>{const n=objPalettes[p].indexOf(v,1);if(!uncovered[i]||n<0)return 0;uncovered[i]=false;return n;});
   if(!indices.some(Boolean))continue;check(sprites.length<40,'Composition OAM capacity');const i=sprites.length;sprites.push({x:tx*8,y:ty*8,h:8,palette:p,tile:i});objTiles.push(encodeTile(indices));for(let y=ty*8;y<ty*8+8;y++)lines[y]++;
  }
  check(!uncovered.some(Boolean),'Uncovered composition pixels');
 }
 check(Math.max(...lines)<=10,'Composition scanline capacity '+Math.max(...lines)+' at '+[...lines].findIndex(n=>n>10));
 const oam=Buffer.alloc(160);sprites.forEach((s,i)=>oam.set([s.y+16,s.x+8,s.tile,8+s.palette],i*4));
 const palette=Buffer.alloc(64);bgPalettes.forEach((p,i)=>p.forEach((v,j)=>palette.writeUInt16LE(v,(i*4+j)*2)));
 return {width,height,pixels,background:Buffer.concat(patterns),map,attributes,bgPalette:palette,objPalette,objGraphics:Buffer.concat(objTiles),oam,sprites,stats:{bgTiles:patterns.length,bgPalettes:bgPalettes.length,objects:sprites.length,peak:Math.max(...lines)}};
}
export function compositionWords(c){
 const width=c.width??160,height=c.height??144,cols=width/8;const words=new Uint16Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y>>3)*cols+(x>>3),i=c.map[at]*16+(y&7)*2,b=7-(x&7),n=((c.background[i]>>b)&1)|(((c.background[i+1]>>b)&1)<<1);let v=c.bgPalette.readUInt16LE((c.attributes[at]*4+n)*2);
  for(const s of c.sprites){if(x<s.x||x>=s.x+8||y<s.y||y>=s.y+8)continue;const k=s.tile*16+(y-s.y)*2,bit=7-(x-s.x),z=((c.objGraphics[k]>>bit)&1)|(((c.objGraphics[k+1]>>bit)&1)<<1);if(z){v=c.objPalette.readUInt16LE((s.palette*4+z)*2);break;}}
  words[y*width+x]=v;
 }return words;
}
export function compositionRgb(c){const words=compositionWords(c),bytes=Buffer.alloc(words.length*3);
 words.forEach((v,i)=>{const r=v&31,g=(v>>5)&31,b=v>>10;bytes.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],i*3);});return bytes;
}
