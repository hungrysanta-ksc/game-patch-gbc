import {check} from './source.mjs';
import {entryReference,entryAssets} from './battle-entry-source.mjs';
// Bind original terrain bytes to native bits. Deduplicate by source identity,
// not the current colors: later mask changes cannot invalidate shared tiles.
export function terrainAssets(p){
 const b=p.initialPpu,tiles=[],ids=new Map(),map=Buffer.alloc(40),attributes=Buffer.alloc(40);
 for(let t=0;t<40;t++){
  const pixels=[];let palette;
  for(let i=0;i<64;i++){
   const x=(t%20)*8+(i&7),y=(t/20|0)*8+(i>>3),sx=Math.floor(x*256/160),sy=y+8;
   if(y>=11){pixels.push(null);continue;}
   const tx=sx>>3,ty=sy>>3,tile=b[0x2000+ty*32+tx],attr=b[0x23c0+(ty>>2)*8+(tx>>2)],pl=(attr>>(((ty&2)<<1)+(tx&2)))&3,src=tile*16+(sy&7)-0x600;
   check(src>=0&&src+8<256,'Terrain pattern owner');palette??=pl;check(palette===pl,'Terrain cell palette crossing');pixels.push([src,7-(sx&7)]);
  }
  const key=JSON.stringify(pixels);if(!ids.has(key)){ids.set(key,tiles.length);tiles.push(pixels);}map[t]=ids.get(key);attributes[t]=8+palette;
 }
 check(tiles.length===10,'Bounded terrain tile ABI');
 const refs=new Map(),luts=[],lutIds=new Map();
 for(const [t,pixels]of tiles.entries())for(const [i,pixel]of pixels.entries()){if(!pixel)continue;for(let plane=0;plane<2;plane++){
  const src=pixel[0]+plane*8,dest=t*16+(i>>3)*2+plane,key=src+','+dest;
  if(!refs.has(key))refs.set(key,{src,dest,mask:0,pairs:[]});const r=refs.get(key);r.mask|=1<<(7-(i&7));r.pairs.push([pixel[1],7-(i&7)]);
 }}
 const rows=[[],[],[],[]];for(const r of refs.values()){
  const key=JSON.stringify(r.pairs);if(!lutIds.has(key)){lutIds.set(key,luts.length);luts.push(Buffer.from(Array.from({length:256},(_,v)=>r.pairs.reduce((n,[src,dst])=>n|((v>>src&1)<<dst),0))));}
  rows[r.src>>6].push(r.src&63,r.dest&255,r.dest>>8,r.mask,lutIds.get(key));
 }
 const offsets=[0];for(const r of rows)offsets.push(offsets.at(-1)+r.length);const spans=Buffer.alloc(10);offsets.forEach((n,i)=>spans.writeUInt16LE(n,i*2));
 return {map,attributes,bindings:Buffer.from(rows.flat()),luts:Buffer.concat(luts),spans,source:p.terrainSource,stats:{tiles:tiles.length,records:refs.size,luts:luts.length,chunkRecords:rows.map(r=>r.length/5)}};
}
export function terrainApply(a,canonical,row,source){check(row>=0&&row<4&&source.length===64,'Terrain binding input');
 for(let at=a.spans.readUInt16LE(row*2);at<a.spans.readUInt16LE(row*2+2);at+=5){const dest=a.bindings.readUInt16LE(at+1),mask=a.bindings[at+3],lut=a.bindings[at+4];canonical[dest]=(canonical[dest]&~mask)|a.luts[lut*256+source[a.bindings[at]]];}return canonical;
}
export function terrainFrames(rom,p,a){const r=entryReference(rom,{back:p.back,formation:p.formation,counts:p.counts,partyStatus:p.partyStatus,terrain:p.terrain??0}),masks=entryAssets(rom).tables.find(t=>t.name==='masks').bytes,canonical=Buffer.alloc(160),out=[];
 check(r.frames.length===p.frames.length&&r.terrain.equals(a.source),'Terrain source identity');
 for(let i=0;i<r.frames.length;i++){
  if(i&&r.frames[i-1].state[35]===2){const prev=r.frames[i-1],row=prev.state[37],mask=prev.state[36],bytes=Buffer.from(a.source.subarray(row*64,row*64+64).map((v,j)=>v&masks[mask*8+(j&7)]));check(bytes.equals(prev.upload),'Original 64-byte masked publication');terrainApply(a,canonical,row,bytes);}
  out.push(Buffer.from(canonical));
 }return out;
}
export function terrainColor(a,canonical,palette,x,y){if(y>=11)return 0;const at=(y>>3)*20+(x>>3),t=a.map[at]*16+(y&7)*2,bit=7-(x&7),v=(canonical[t]>>bit&1)|((canonical[t+1]>>bit&1)<<1);return palette.readUInt16LE(((a.attributes[at]&7)*4+v)*2);}
