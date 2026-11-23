import {check} from './source.mjs';
// Host layout oracle. Inputs are compiled words; glyph pixels are independently
// read from the approved private font and original ROM in the verifier.
export function textPage(bytes,offset=0){
 const cells=Array(160).fill(255);for(let x=0;x<20;x++){cells[x]=248;cells[140+x]=253;}for(let y=1;y<7;y++){cells[y*20]=250;cells[y*20+19]=251;}cells[0]=247;cells[19]=249;cells[140]=252;cells[159]=254;
 let x=0,y=1,more=false,error=0;
 const word=()=>{if(offset+2>bytes.length){error=21;return 0;}const w=bytes.readUInt16LE(offset);offset+=2;return w;};
 while(!error){const before=offset,w=word();if(w===0||w===10)break;
  if(w===1||w===9){x=0;y+=w===1?2:1;if(y>=7){more=true;break;}continue;}
  if(w===20){x=word();if(x>=18)error=24;continue;}
  if([6,11,14].includes(w))continue;if(w>=35&&w<=39){word();continue;}
  if(w<0x8000){error=22;break;}const glyph=w-0x8000;if(glyph<112||glyph>=2606){error=23;break;}
  if(x>=18){x=0;y+=2;}if(y>=7){offset=before;more=true;break;}cells[y*20+1+x++]=glyph;
 }
 if(more&&!error){const before=offset,w=word();if(w===0||w===10)more=false;else offset=before;}
 return {cells,offset,more,error,cache:[...new Set(cells)]};
}
export function windowRgb(background,page,glyphs){
 check(!page.error,'Cannot rasterize rejected text');const out=Buffer.from(background),palette=[0x2041,0x2041,0x5dec,0x7fff];
 for(let y=0;y<64;y++)for(let x=0;x<160;x++){
  const glyph=page.cells[(y>>3)*20+(x>>3)],at=glyph*16+(y&7)*2,bit=7-(x&7),color=((glyphs[at]>>bit)&1)|(((glyphs[at+1]>>bit)&1)<<1),v=palette[color],r=v&31,g=(v>>5)&31,b=v>>10,colors=[Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)];
  for(let c=0;c<3;c++)out[((y+80)*160+x)*3+c]=colors[c];
 }return out;
}
