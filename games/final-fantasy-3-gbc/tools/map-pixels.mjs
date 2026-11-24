import {inflateSync} from 'node:zlib';
import {check} from './source.mjs';
import {mapSelection} from './map-assets.mjs';
// Only the pinned Mesen screenshot format: RGB8, non-interlaced PNG.
export function screenshotRgb(png,dimensions={width:160,height:144}){
 check(png.subarray(0,8).toString('hex')==='89504e470d0a1a0a','PNG signature');let width,height,parts=[];
 for(let at=8;at<png.length;){const n=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8),b=png.subarray(at+8,at+8+n);check(at+12+n<=png.length,'PNG chunk boundary');if(type==='IHDR'){width=b.readUInt32BE(0);height=b.readUInt32BE(4);check(b[8]===8&&b[9]===2&&b[10]===0&&b[11]===0&&b[12]===0,'Screenshot PNG format');}if(type==='IDAT')parts.push(b);at+=n+12;}
 check(width===dimensions.width&&height===dimensions.height,'Screenshot dimensions');const raw=inflateSync(Buffer.concat(parts)),stride=width*3,out=Buffer.alloc(stride*height);check(raw.length===(stride+1)*height,'PNG scanline size');
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];check(filter<=4,'PNG filter');for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=3?out[at-3]:0,b=y?out[at-stride]:0,c=y&&x>=3?out[at-stride-3]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?(a+b)>>1:pa<=pb&&pa<=pc?a:pb<=pc?b:c;out[at]=(raw[y*(stride+1)+x+1]+predictor)&255;}}
 return out;
}
export function mapRgb(assets,r){
 // Pinned Mesen default CGB color correction (GbDefaultVideoFilter), not an
 // assertion about analog NES colors or the physical GBC LCD's response.
 const g=assets.groups,s=mapSelection(r.world,r.id),p=g.properties[s.property],[layout,graphics]=g.selection[s.selection],set=p[0]>>5,tiles=Buffer.concat([g.graphics[graphics],g.font[0]]),out=Buffer.alloc(160*144*3);
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){const wx=r.x+(x>>3),wy=r.y+(y>>3),m=g.layout[layout][(wy>>1)*32+(wx>>1)],t=g.metas[set][m*4+(wy&1)*2+(wx&1)],offset=t*16+(y&7)*2,bit=7-(x&7),color=((tiles[offset]>>bit)&1)|(((tiles[offset+1]>>bit)&1)<<1),value=g.palette[s.property].readUInt16LE((g.attributes[set][m]*4+color)*2);const red=value&31,green=(value>>5)&31,blue=(value>>10)&31;const colors=[Math.min(240,(red*26+green*4+blue*2)>>2),Math.min(240,(green*24+blue*8)>>2),Math.min(240,(red*6+green*4+blue*22)>>2)];for(let channel=0;channel<3;channel++)out[(y*160+x)*3+channel]=colors[channel];}
 return out;
}
