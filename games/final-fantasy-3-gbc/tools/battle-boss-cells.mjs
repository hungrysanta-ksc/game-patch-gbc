// Spatial dependencies and palette routing, never a frame-indexed movie.
import {check,hash} from './source.mjs';
import {tailAssets} from './battle-entry-tail-source.mjs';
export function bossCells(rom,p){
 check(p.tailSeed?.length===75&&p.tailSeed[64]===9&&(p.tailSeed[65]&64)&&(p.tailSeed[66]&31)<24,'Registered boss entry profile');
 const graphic=p.tailSeed[66]&31,a=tailAssets(rom).bosses[graphic],raw=Buffer.from(rom.subarray(a.begin,a.begin+a.chunks*64)),b=p.initialPpu;
 check(b.subarray(0x700,0x1000).every(v=>!v),'Boss must begin with cleared CHR');
 const palettes=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>p.bgPalette.readUInt16LE((i*4+j)*2))),cells=[],bindings=[],routes=[],deps=Array.from({length:a.chunks},()=>[]);let residuals=0;
 const flip=p.back^!!(a.flags&16),black=palettes[0][0];check(black===0,'Boss blank is shared black');
 for(let y=0;y<11;y++)for(let x=0;x<20;x++){
  const pixels=[],blocks=new Set(),colors=new Set([black]);
  for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){
   const dx=x*8+xx,dy=y*8+yy;let d=0x0fff;
   if(dy<84&&(p.back?dx>=42:dx<118)){
    const sx=p.back?239-Math.floor((167-dx+.5)*8/7):16+Math.floor((dx+8+.5)*8/7),sy=48+Math.floor((dy+.5)*8/7),tx=sx>>3,ty=sy>>3,t=b[0x2000+ty*32+tx],attr=b[0x23c0+(ty>>2)*8+(tx>>2)],pl=(attr>>(((ty&2)<<1)+(tx&2)))&3,off=t*16+(sy&7)-0x700;
    if(off>=0&&off+8<raw.length){check(pl<2,'Boss pixel palette owner');d=off|((flip?sx&7:7-(sx&7))<<12)|(pl<<15);blocks.add(off>>6);
     for(let s=0;s<8;s++){const pos=((d>>12)&7)+((off&1)?-s:s),v=pos<0||pos>7?0:(raw[off]>>pos&1)|((raw[off+8]>>pos&1)<<1);colors.add(palettes[pl][v]);}
    }else check(!b[t*16+(sy&7)]&&!b[t*16+(sy&7)+8],'Unregistered boss external CHR');
   }pixels.push(d);
  }
  if(!blocks.size)continue;
  let palette=palettes.findIndex((p,i)=>i!==2&&i!==3&&[...colors].every(c=>p.includes(c))),residual=255;
  if(palette<0&&colors.size<=4){check(palettes.length<8,'Boss/UI palette reservation');palette=palettes.length;const cs=[black,...[...colors].filter(c=>c!==black).sort((a,b)=>a-b)];while(cs.length<4)cs.push(black);palettes.push(cs);}
  if(palette<0){palette=[0,1].sort((a,b)=>[...colors].filter(c=>palettes[b].includes(c)).length-[...colors].filter(c=>palettes[a].includes(c)).length)[0];residual=1-palette;}
  const route=Array.from({length:8},(_,i)=>{const color=palettes[i>>2][i&3],n=palettes[palette].indexOf(color);if(n>=0)return n;if(residual<2){const k=palettes[residual].indexOf(color);if(k>0)return 128|k;}return 255;});
  // A route may omit an impossible color, but every possible shifted pixel
  // must have an exact route. Runtime rejects an unexpected color.
  for(const color of colors)check(palettes[palette].includes(color)||(residual<2&&palettes[residual].includes(color)),'Boss color coverage');
  const id=cells.length;cells.push({id,x,y:y+2,palette,residual,extra:residual===255?255:residuals++});bindings.push(...pixels);routes.push(...route);for(const k of blocks)deps[k].push(id);
 }
 check(cells.length>0&&cells.length<=128&&residuals<=8,'Boss cells / reserved party and status OAM');
 const bindingBytes=Buffer.alloc(bindings.length*2);bindings.forEach((v,i)=>bindingBytes.writeUInt16LE(v,i*2));
 const descriptors=Buffer.concat(cells.map(c=>Buffer.from([c.x,c.y,c.palette,c.residual,c.extra]))),index=Buffer.alloc((a.chunks+1)*2),list=[];
 deps.forEach((ids,i)=>{index.writeUInt16LE(list.length,i*2);list.push(...ids);});index.writeUInt16LE(list.length,a.chunks*2);
 const paletteBytes=Buffer.alloc(64);palettes.forEach((p,i)=>p.forEach((c,j)=>paletteBytes.writeUInt16LE(c,(i*4+j)*2)));
 const rows=Buffer.from(Array.from({length:12},(_,row)=>cells.filter(c=>c.y<row+2).length)),objects=Buffer.concat(cells.filter(c=>c.extra!==255).map(c=>Buffer.from([c.y*8+16,c.x*8+8,c.extra,12+c.residual])));
 const {program,luts}=bossRowProgram(bindingBytes);
 return {graphic,chunks:a.chunks,raw,bindings:bindingBytes,program,luts,routes:Buffer.from(routes),descriptors,index,list:Buffer.from(list),rows,objects,palette:paletteBytes,cells,deps,residuals,stats:{cells:cells.length,residuals,maxChanged:Math.max(...deps.map(d=>d.length)),palettes:palettes.length,sourceBegin:a.begin,sourceBytes:raw.length,sourceSha256:hash(raw),bindingBytes:bindingBytes.length,programBytes:program.length,lutBytes:luts.length}};
}
// Spatial bit selectors, independent of animation state. Each row intersects
// at most two source bytes. The original block shift still runs at runtime.
export function bossRowProgram(bindings){
 const program=Buffer.alloc(bindings.length/128*72),tables=[],dictionary=new Map();
 for(let row=0;row<bindings.length/16;row++){
  const groups=new Map();for(let x=0;x<8;x++){const d=bindings.readUInt16LE(row*16+x*2),off=d&4095;if(off===4095)continue;const key=off+':'+(d>>15);if(!groups.has(key))groups.set(key,{off,pal:d>>15,bits:[]});groups.get(key).bits.push([d>>12&7,7-x]);}
  check(groups.size<=2,'Boss row intersects more than two source bytes');program[row*9]=groups.size;let n=0;
  for(const g of groups.values()){const lut=Buffer.from(Array.from({length:256},(_,v)=>g.bits.reduce((r,[src,dst])=>r|((v>>src&1)<<dst),0))),key=lut.toString('hex');if(!dictionary.has(key)){dictionary.set(key,tables.length);tables.push(lut);}const at=row*9+1+n++*4;program.writeUInt16LE(g.off,at);program[at+2]=dictionary.get(key);program[at+3]=g.pal;}
 }
 check(tables.length<=64,'Boss selectors exceed one ROM bank');return {program,luts:Buffer.concat(tables)};
}
export function bossTileRows(a,cell,chunk,shift){
 const out=Buffer.alloc(32);for(let y=0;y<8;y++){const at=cell*72+y*9;for(let n=0;n<a.program[at];n++){const p=at+1+n*4,off=a.program.readUInt16LE(p);if((off>>6)>chunk)continue;const s=(off>>6)===chunk?shift:0,lut=a.program[p+2]*256,pal=a.program[p+3]*4,convert=v=>a.luts[lut+((off&1)?v<<s&255:v>>s)],lo=convert(a.raw[off]),hi=convert(a.raw[off+8]);for(let color=1;color<4;color++){const mask=color===1?lo&~hi:color===2?hi&~lo:lo&hi;if(!mask)continue;const r=a.routes[cell*8+pal+color];check(r!==255,'Unexpected boss row color');const dst=y*2+(r&128?16:0);if(r&1)out[dst]|=mask;if(r&2)out[dst+1]|=mask;}}}return out;
}
export function bossTile(a,cell,chunk,shift){
 check(cell>=0&&cell<a.cells.length&&chunk>=0&&chunk<a.chunks&&shift>=0&&shift<8,'Boss cell work bounds');const out=Buffer.alloc(32);
 for(let i=0;i<64;i++){const d=a.bindings.readUInt16LE(cell*128+i*2),off=d&4095;let v=0;
  if(off!==4095&&(off>>6)<=chunk){const s=(off>>6)===chunk?shift:0,pos=((d>>12)&7)+((off&1)?-s:s);if(pos>=0&&pos<8)v=(a.raw[off]>>pos&1)|((a.raw[off+8]>>pos&1)<<1);v=a.routes[cell*8+(d>>15)*4+v];check(v!==255,'Unexpected boss color');}
  const row=(i>>3)*2+(v&128?16:0),mask=128>>(i&7);if(v&1)out[row]|=mask;if(v&2)out[row+1]|=mask;
 }return out;
}
export function bossLogicalFrame(a,state,chunk,shift){
 for(const id of a.deps[chunk])state.set(id,bossTile(a,id,chunk,shift));
 const patterns=Buffer.alloc((a.cells.length+a.residuals+1)*16),map=Buffer.alloc(704),objects=[];
 map.fill(8,352);for(const c of a.cells){const t=state.get(c.id)??Buffer.alloc(32),at=(c.y-2)*32+c.x;patterns.set(t.subarray(0,16),(c.id+1)*16);map[at]=c.id+1;map[352+at]=8+c.palette;
  if(c.extra!==255){const tile=1+a.cells.length+c.extra;patterns.set(t.subarray(16),tile*16);objects.push({x:c.x*8,y:c.y*8,tile,attr:12+c.residual});}
 }return {patterns,map,objects,palette:a.palette};
}
