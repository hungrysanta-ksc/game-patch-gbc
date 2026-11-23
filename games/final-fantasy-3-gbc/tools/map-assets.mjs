import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {decodeRle} from './registry-core.mjs';
import {cgbPalette} from './field-source.mjs';
import {segment} from './state-source.mjs';
export const kinds=['properties','layout','graphics','metas','attributes','palette','collision','font','selection'];
export function convertTiles(nes){check(nes.length%16===0,'Tile length');const gb=Buffer.alloc(nes.length);for(let t=0;t<nes.length;t+=16)for(let y=0;y<8;y++){gb[t+y*2]=nes[t+y];gb[t+y*2+1]=nes[t+y+8];}return gb;}
function cpu(rom){const c=new Driver6502(rom);c.banks=[0x3a,0x3b,0x3e,0x3f];return c;}
function ppuWriter(c){const bytes=Buffer.alloc(8192);let address=0,high=true;const write=c.write.bind(c),read=c.read.bind(c);c.read=a=>{if(a===0x2002){high=true;return 0;}return read(a);};c.write=(a,v)=>{if(a===0x2006){address=high?v<<8:(address&0xff00)|v;high=!high;}else if(a===0x2007){check(address<8192,'Graphics write outside CHR');bytes[address++]=v;}else write(a,v);};return bytes;}
export function mapSelection(world,id){check(Number.isInteger(world)&&world>=0&&world<256&&Number.isInteger(id)&&id>=0&&id<256,'Map selector range');return {property:id+(world?256:0),selection:id+(world>=2?256:0)};}
export function makeMapAssets(rom,{verify=true}={}){
 const groups=Object.fromEntries(kinds.map(k=>[k,[]])),provenance=[],comparisons={layouts:0,graphics:0,tilesets:0,palettes:0,selectors:0};
 const add=(kind,id,bytes,source,consumer)=>{check(groups[kind].length===id,'Asset sequence');groups[kind].push(Buffer.from(bytes));provenance.push({kind,id,bytes:bytes.length,sha256:hash(bytes),source,consumer});};
 for(let id=0;id<256;id++){const begin=0x22010+rom.readUInt16LE(0x22010+id*2),d=decodeRle(rom,begin,0x30010,1024);check(begin>=0x22210,'Layout inside pointer table');if(verify){const c=cpu(rom);c.m.set(rom.subarray(begin,d.end),0x5000);c.m[0x81]=0x50;c.m[0x83]=0x74;c.call(0xcbfa);check(d.data.equals(Buffer.from(c.m.subarray(0x7400,0x7800))),'Layout source mismatch '+id);comparisons.layouts++;}add('layout',id,d.data,[{offset:begin,bytes:d.end-begin}],'3E/CBA4..CC41');}
 const counts=[26,8,8,14,8,16,16,16];
 for(let id=0;id<48;id++){const parts=[],sources=[];for(let b=0;b<8;b++){const begin=0x6010+rom.readUInt16LE(0xe10+id*16+b*2),bytes=counts[b]*16;check((begin>=0x6010&&begin+bytes<=0xcc10)||(begin===0xcf10&&bytes===256),'Graphics pointer bounds');parts.push(rom.subarray(begin,begin+bytes));sources.push({offset:begin,bytes});}const nes=Buffer.concat(parts);if(verify){const c=cpu(rom),ppu=ppuWriter(c);c.m.set(rom.subarray(0xe10+id*16,0xe20+id*16),0x7f00);segment(c,0xde8c,0xdecd);check(nes.equals(ppu.subarray(0,1792)),'Graphics source mismatch '+id);comparisons.graphics++;}add('graphics',id,convertTiles(nes),sources,'3E/DE82..DECD (before water-animation buffer initialization)');}
 for(let id=0;id<7;id++){
  const metas=Buffer.alloc(512),attrs=rom.subarray(0x3190+id*128,0x3210+id*128),collision=rom.subarray(0x3510+id*256,0x3610+id*256);for(let m=0;m<128;m++)for(let q=0;q<4;q++)metas[m*4+q]=rom[0x2390+id*512+q*128+m];for(const a of attrs)check([0,85,170,255].includes(a),'Nonuniform metatile palette');
  if(verify){const c=cpu(rom);c.m[0x780]=id<<5;segment(c,0x9267,0x92d9);for(let m=0;m<128;m++){check(c.m[0x400+m]===collision[m*2]&&c.m[0x500+m]===collision[m*2+1]&&c.m[0x600+m]===attrs[m],'Tile metadata source');for(const [q,a]of [0x7c00,0x7d00,0x7e00,0x7200].entries())check(c.m[a+m]===metas[m*4+q],'Metatile source');}comparisons.tilesets++;}
  add('metas',id,metas,[{offset:0x2390+id*512,bytes:512}],'3A/9267..92D9');add('attributes',id,Buffer.from(attrs.map(v=>v&3)),[{offset:0x3190+id*128,bytes:128}],'3A/92AD');add('collision',id,collision,[{offset:0x3510+id*256,bytes:256}],'3A/929E');
 }
 for(let id=0;id<512;id++){
  const p=rom.subarray(0x4010+id*16,0x4020+id*16),layout=rom[0xa10+id],graphics=rom[0xc10+id];check((p[0]>>5)<7&&graphics<48,'Map asset index');add('properties',id,p,[{offset:0x4010+id*16,bytes:16}],'3A/915E..918A');add('selection',id,Buffer.from([layout,graphics]),[{offset:0xa10+id,bytes:1},{offset:0xc10+id,bytes:1}],'3E/CBA4..CBB7; 3E/DE5A..DE6D');
  const colors=[];for(let pal=0;pal<4;pal++){colors.push(15);if(pal<3)for(let color=0;color<3;color++)colors.push(rom[0x1110+color*256+p[5+pal]]);else colors.push(0,2,0x30);}
  if(verify){const c=cpu(rom);c.m.set(p,0x780);c.m[0x2d]=1;c.m[0x78]=id>=256?2:0;c.call(0x9091);for(let pal=0;pal<4;pal++)for(let color=0;color<4;color++)check(colors[pal*4+color]===c.m[color?0x3c0+pal*4+color:0x3c0],'Map palette source');comparisons.palettes++;}add('palette',id,cgbPalette(colors),[{offset:0x4015+id*16,bytes:3},{offset:0x1110,bytes:768}],'3A/9091..914A; NES composite preview RGB555 conversion');
 }
 const font=rom.subarray(0x1b710,0x1c010);if(verify){const c=cpu(rom),ppu=ppuWriter(c);c.call(0xded6);check(font.equals(ppu.subarray(0x700,0x1000)),'Shared background/font source');}add('font',0,convertTiles(font),[{offset:0x1b710,bytes:2304}],'3E/DED6..DEE7 (original Japanese/window patterns, not Korean UI)');
 if(verify){const c=cpu(rom);for(let world=0;world<256;world++)for(let id=0;id<256;id++){c.m[0x78]=world;c.m[0x48]=id;const s=mapSelection(world,id);segment(c,0xcba4,0xcbb7);check(c.a===rom[0xa10+s.selection],'Layout selector source');segment(c,0xde5a,0xde6d);check(c.a===rom[0xc10+s.selection],'Graphics selector source');c.banks[0]=0x3a;segment(c,0x915e,0x918a);check(Buffer.from(c.m.subarray(0x780,0x790)).equals(groups.properties[s.property]),'Properties selector source');comparisons.selectors++;}}
 const profiles=[];for(let world=0;world<3;world++)for(let id=0;id<256;id++){const s=mapSelection(world,id),p=groups.properties[s.property],[layout,graphics]=groups.selection[s.selection],tileset=p[0]>>5;profiles.push({world,id,...s,layout,graphics,tileset,highPatternTiles:[...new Set([...groups.layout[layout]].flatMap(m=>[...groups.metas[tileset].subarray(m*4,m*4+4)]).filter(x=>x>=112))].sort((a,b)=>a-b)});}
 return {groups,provenance,comparisons,profiles};
}
export function packMapAssets(assets,order=kinds){
 const banks=new Map(),descriptors=[],groups=[];let bank=16,offset=0,index=0;
 const put=(n,at,bytes)=>{if(!banks.has(n))banks.set(n,Buffer.alloc(16384));bytes.copy(banks.get(n),at);};
 for(const kind of order){groups.push({kind,offset:index*5,count:assets.groups[kind].length});for(const bytes of assets.groups[kind]){check(bytes.length>0&&bytes.length<=16384,'Asset empty or exceeds bank');if(offset+bytes.length>16384){bank++;offset=0;}const d=Buffer.alloc(5);d[0]=bank;d.writeUInt16LE(offset,1);d.writeUInt16LE(bytes.length,3);descriptors.push(d);put(bank,offset,bytes);offset+=bytes.length;index++;}}
 const directory=Buffer.concat(descriptors);check(directory.length<=16384&&bank<256,'Asset catalog capacity');put(12,0,directory);
 return {banks,groups,directory,romBanks:2**Math.ceil(Math.log2(bank+1)),assets:index};
}
