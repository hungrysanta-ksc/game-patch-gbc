import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
// Adopted NES composite preview palette, quantized to CGB RGB555. Pixel indexes
// and both bitplanes are preserved; this is not an analog NES color claim.
const rgb=('666666 002A88 1412A7 3B00A4 5C007E 6E0040 6C0600 561D00 333500 0B4800 005200 004F08 00404D 000000 000000 000000 '+
'ADADAD 155FD9 4240FF 7527FE A01ACC B71E7B B53120 994E00 6B6D00 388700 0C9300 008F32 007C8D 000000 000000 000000 '+
'FFFEFF 64B0FF 9290FF C676FF F36AFF FE6ECC FE8170 EA9E22 BCBE00 88D800 5CE430 45E082 48CDDE 4F4F4F 000000 000000 '+
'FFFEFF C0DFFF D3D2FF E8C8FF FBC2FF FEC4EA FECCC5 F7D8A5 E4E594 CFEF96 BDF4AB B3F3CC B5EBF2 B8B8B8 000000 000000').split(' ').map(s=>[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)>>3)).map(([r,g,b])=>r|(g<<5)|(b<<10));
export function cgbPalette(indices){const out=Buffer.alloc(indices.length*2);for(const [i,v]of indices.entries()){check(v<64,'Invalid NES color');out.writeUInt16LE(rgb[v],i*2);}return out;}
export function fieldSource(rom){
 const id=0x16,props=rom.subarray(0x4010+id*16,0x4020+id*16),layout=rom[0xa10+id],set=rom[0xc10+id],tileset=props[0]>>5;
 const compressedOffset=0x22010+rom.readUInt16LE(0x22010+layout*2),map=Buffer.alloc(1024);let pos=compressedOffset,n=0;
 while(n<1024){check(pos<rom.length,'Truncated map');const b=rom[pos++];let count=1;if(b&128){check(pos<rom.length,'Truncated run');count=rom[pos++]||256;}check(n+count<=1024,'Map run overflow');map.fill(b&127,n,n+count);n+=count;}
 const decoder=new Driver6502(rom);decoder.m.set(rom.subarray(compressedOffset,pos),0x5000);decoder.m[0x81]=0x50;decoder.m[0x83]=0x74;decoder.call(0xcbfa);check(map.equals(Buffer.from(decoder.m.subarray(0x7400,0x7800))),'Source RLE differs');
 const gfx=Buffer.alloc(112*16),sources=[];let at=0;
 for(const [block,count]of [26,8,8,14,8,16,16,16].entries()){const offset=0x6010+rom.readUInt16LE(0xe10+set*16+block*2);sources.push({offset,bytes:count*16});for(let t=0;t<count;t++)for(let y=0;y<8;y++){gfx[at+t*16+y*2]=rom[offset+t*16+y];gfx[at+t*16+y*2+1]=rom[offset+t*16+y+8];}at+=count*16;}
 const metas=Buffer.alloc(512),attrs=Buffer.alloc(128),palettes=Buffer.alloc(32);
 for(let m=0;m<128;m++){for(let q=0;q<4;q++)metas[m*4+q]=rom[0x2390+tileset*512+q*128+m];const a=rom[0x3190+tileset*128+m];check([0,85,170,255].includes(a),'Nonuniform metatile attribute');attrs[m]=a&3;}
 for(const m of map)for(let q=0;q<4;q++)check(metas[m*4+q]<112,'Animated/menu tile needs another consumer');
 const paletteCpu=new Driver6502(rom);paletteCpu.banks[0]=0x3a;paletteCpu.m[0x2d]=1;paletteCpu.m.set(props,0x780);paletteCpu.call(0x9091);
 for(let p=0;p<4;p++)for(let c=0;c<4;c++){const index=paletteCpu.m[c===0?0x3c0:0x3c0+p*4+c];check(index<64,'Invalid color');palettes.writeUInt16LE(rgb[index],(p*4+c)*2);}
 // NPC script 02 selects event 71. Event pointer is decoded from its original
 // table, then checked against the audited revision before admitting the scope.
 check(rom.subarray(0x59957,0x59959).toString('hex')==='ff71','NPC event reference mismatch');
 const pointer=rom.readUInt16LE(0x58610+0x71*2),scriptOffset=0x58010+(pointer-0x8000),script=rom.subarray(scriptOffset,scriptOffset+9);check(script.toString('hex')==='d0d0f883d6d7d6d7ff','Unsupported event 71');check(props[10]<0x41,'Conditional/unknown map song');
 const origin=map.indexOf(0x5b);check(origin>=0,'Passage missing');const cameraX=Math.max(0,Math.min(44,(origin%32)*2-8)),cameraY=Math.max(0,Math.min(48,(origin>>5)*2-6));
 const variants=[Buffer.from(map)],changes=[];for(const tile of [0x5b,0x5c,0x5b,0x5c]){const a=Buffer.from(variants.at(-1)),index=a.indexOf(tile);if(index>=0){a[index]+=2;changes.push({index,from:tile,to:tile+2});variants.push(a);}}
 check(changes.length===3,'Passage mutation count');
 const blob=Buffer.concat([map,gfx,metas,attrs,palettes,script]);
 return {id,props:[...props],song:props[10],map,gfx,metas,attrs,palettes,script,scriptOffset,cameraX,cameraY,variants,changes,blob,provenance:{id,layout,set,tileset,compressedOffset,compressedBytes:pos-compressedOffset,mapSha256:hash(map),graphics:sources,scriptOffset,scriptBytes:script.length}};
}
// Original game call execution. FF00 is explicitly a VBlank/yield boundary;
// C009 is a separately verified audio-update boundary, skipped here to collect
// game requests only. native-reference runs the audio engine once per tick.
// this verifies the event consumer, not boot/NPC-condition reachability.
export function eventReference(rom,field){
 const c=new Driver6502(rom),requests=[];c.m.set(field.map,0x7400);c.m[0x6c]=0x71;c.m[0x72]=(field.scriptOffset-0x58010)&255;c.m[0x73]=((field.scriptOffset-0x58010+0x8000)>>8);c.m[0x2d]=1;
 let waiting=false,running=false,shake=0,revision=0,frame=0,steps=0;const write=c.write.bind(c);
 // B952 writes X scroll then Y scroll; retain the first write of each pair.
 let scrollWrite=0;c.write=(a,v)=>{if([0x7f42,0x7f43,0x7f49].includes(a))requests.push([a,v]);if(a>=0x7400&&a<0x7800&&c.m[a]!==v)revision++;if(a===0x2005&&!(scrollWrite++&1))shake=v;write(a,v);};
 return {tick(){requests.length=0;if(!c.m[0x6c])return {frame:frame++,requests:[],shake,revision,done:true,map:Buffer.from(c.m.subarray(0x7400,0x7800))};if(!running){c.pc=0xd219;c.push(0x4f);c.push(0xff);running=true;}if(waiting){c.pc=((c.pop()|(c.pop()<<8))+1)&65535;waiting=false;}for(let guard=0;guard<100000;guard++){if(c.pc===0x5000){running=false;break;}if(c.pc===0xff00){waiting=true;break;}if(c.pc===0xc009){c.pc=((c.pop()|(c.pop()<<8))+1)&65535;continue;}c.step();steps++;if(guard===99999)throw Error('Event execution exceeded budget');}return {frame:frame++,requests:requests.map(x=>[...x]),shake,revision,done:!c.m[0x6c],map:Buffer.from(c.m.subarray(0x7400,0x7800)),steps};}};
}
