// Read-only reconstruction for captured CGB state; no asset transformation.
export function screen(p){const v=Buffer.from(p.vram,'hex'),o=Buffer.from(p.oam,'hex'),bp=Buffer.from(p.bgPalette,'hex'),op=Buffer.from(p.objPalette,'hex'),rgb=Buffer.alloc(160*144*3),indices=new Uint8Array(160*144),priority=new Uint8Array(160*144);
 const color=(at,pal,index)=>{const c=pal.readUInt16LE(index*2),r=c&31,g=c>>5&31,b=c>>10;rgb.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],at*3);};
 const pixel=(address,x,y)=>((v[address+y*2]>>(7-x))&1)|(((v[address+y*2+1]>>(7-x))&1)<<1);
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){const at=y*160+x,map=(p.lcdc&8?0x1c00:0x1800)+(y>>3)*32+(x>>3),t=v[map],a=v[8192+map],base=(p.lcdc&16)?t*16:4096+(t<128?t:t-256)*16,n=pixel(base+((a&8)?8192:0),(a&32)?7-(x&7):x&7,(a&64)?7-(y&7):y&7);indices[at]=n;priority[at]=a&128;color(at,bp,(a&7)*4+n);}
 for(let y=0;y<144;y++){const height=p.lcdc&4?16:8,line=[];for(let i=0;i<40&&line.length<10;i++)if(y>=o[i*4]-16&&y<o[i*4]-16+height)line.push(i);
  for(const i of line.reverse()){const sy=o[i*4]-16,sx=o[i*4+1]-8,t=p.lcdc&4?o[i*4+2]&254:o[i*4+2],a=o[i*4+3];for(let dx=0;dx<8;dx++){const x=sx+dx;if(x<0||x>=160)continue;const at=y*160+x,n=pixel(t*16+((a&8)?8192:0),(a&32)?7-dx:dx,(a&64)?height-1-(y-sy):y-sy);if(n&&!(indices[at]&&((a&128)||priority[at])))color(at,op,(a&7)*4+n);}}
 }return rgb;
}