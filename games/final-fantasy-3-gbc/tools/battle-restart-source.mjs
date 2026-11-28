import fs from 'node:fs/promises';
import {check,hash} from './source.mjs';
import {presentationMachine} from './battle-transition-source.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {compactOriginalBox} from './battle-action-ui.mjs';
import {fontMap,glyphFor,parseTsv} from './korean-text.mjs';
import {encodeTile} from './npc-composition.mjs';

// Actual B9F6 first loop, with blank SRAM. Only VBlank/sound leaves are
// intercepted; graphics, windows, font loads and cursor execute ROM code.
export function restartSource(rom){
 const m=presentationMachine(rom),c=m.c,windows=[],strings=[];c.banks=[60,61,62,63];c.m[0xfa]=0x77;
 const step=c.step.bind(c),ret=()=>c.pc=((c.pop()|(c.pop()<<8))+1)&65535;
 c.step=function(){if(this.pc===0xff00){ret();return;}if(this.pc===0xaaf1)windows.push(this.x);if(this.pc===0xa678)strings.push(this.a);step();};
 c.pc=0xb9f6;let instructions=0;while(c.pc!==0xba54){check(++instructions<300000,'Restart source bound');c.step();}
 check(c.m[0x78f0]===12&&c.m[0x7f43]===1,'Source new-game cursor and prelude');
 c.call(0x9119);
 for(const y of [1,5,13,21])check(m.ppu.bytes[0x2000+y*32+1]===247,'Observed source window corner');
 check(strings.includes(0x22)&&strings.includes(0x23),'Source new-game/message-speed strings');
 return {ppu:Buffer.from(m.ppu.bytes),oam:Buffer.from(c.m.subarray(0x200,0x300)),windows,strings,instructions,source:['3E/C058..C0C6','3D/B9F6..BA54','3D/BBEF..BC00'],scope:'Blank SRAM menu; valid-save-slot portraits/data and selection consumers remain separate.'};
}
export async function restartAssets(rom,config,gen){
 const s=restartSource(rom),font=await fs.readFile(config.font),fm=fontMap(font),ko=parseTsv(await fs.readFile(config.translationDir+'/system_ko.txt','utf8')),ja=parseTsv(await fs.readFile(config.translationDir+'/system_ja.txt','utf8'));
 check(ja.get('MSG_SYSTEM_373')!==undefined&&hash(Buffer.from(ja.get('MSG_SYSTEM_373')))==='860943305f232108ee05673587f339b4b5899bc987b0f68404a1cc1f014971ec'&&ko.get('MSG_SYSTEM_373')!==undefined&&hash(Buffer.from(ko.get('MSG_SYSTEM_373')))==='430694bfb843e76a2eb6a9b6ed2e6f35e5635f79a8d56f82b3728ba989ca2e7a','Reviewed new-game translation');
 check(ko.get('MSG_CFG_INF_04')!==undefined&&hash(Buffer.from(ko.get('MSG_CFG_INF_04')))==='296657d54d6458a5ff408a0fe7e5caa1ce89ffb19b73eef01cdca7abb8aff9e6','Reviewed speed label');
 const raw=nativePartyTiles(s.ppu.subarray(0,4096)),pixels=new Uint8Array(160*144),rects=[[0,0,72,24],[72,0,88,24],[0,24,160,40],[0,64,160,40],[0,104,160,40]];
 for(const [x,y,w,h]of rects){const box=compactOriginalBox(raw,w,h);for(let yy=0;yy<h;yy++)pixels.set(box.subarray(yy*w,(yy+1)*w),(y+yy)*160+x);}
 const write=(str,x,y)=>{for(const ch of str){const id=glyphFor(ch,fm);for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const bit=128>>xx,ink=id>=256?font[(id-256)*8+yy]&bit:raw[id*16+yy*2]&raw[id*16+yy*2+1]&bit;if(ink)pixels[(y+yy)*160+x+xx]=3;}x+=ch===' '?3:8;}};
 write(ko.get('MSG_SYSTEM_373'),24,9);write(ko.get('MSG_CFG_INF_04'),77,9);write('5',145,9);
 const tiles=[],map=[],ids=new Map();for(let y=0;y<18;y++)for(let x=0;x<20;x++){const p=Uint8Array.from({length:64},(_,i)=>pixels[(y*8+(i>>3))*160+x*8+(i&7)]),b=encodeTile(p),key=b.toString('hex');if(!ids.has(key)){ids.set(key,tiles.length);tiles.push(b);}map.push(ids.get(key));}
 check(tiles.length<220,'Restart UI tile budget');
 const cursor=[],cursorTiles=[];for(let i=0;i<64;i++){const o=s.oam.subarray(i*4,i*4+4);if(o[0]>=240)continue;cursor.push(...o);cursorTiles.push(nativePartyTiles(s.ppu.subarray(0x1000+o[1]*16,0x1010+o[1]*16)));}
 check(cursor.length>0&&cursor.length<=24,'Source hand cursor');
 const arrays={restart_tiles:Buffer.concat(tiles),restart_map:Buffer.from(map),restart_palette:cgbPalette(s.ppu.subarray(0x3f0c,0x3f10)),restart_cursor:Buffer.from(cursor),restart_cursor_tiles:Buffer.concat(cursorTiles),restart_cursor_palette:cgbPalette(s.ppu.subarray(0x3f1c,0x3f20))};
 await fs.writeFile(gen+'/restart-assets.h','#include <stdint.h>\n#define RESTART_TILE_BYTES '+arrays.restart_tiles.length+'\n#define RESTART_CURSOR_BYTES '+cursor.length+'\n'+Object.keys(arrays).map(n=>'extern const uint8_t '+n+'[];').join('\n'));
 const file=gen+'/restart126.c';await fs.writeFile(file,'#pragma bank 126\n#include <stdint.h>\n'+Object.entries(arrays).map(([n,b])=>'const uint8_t '+n+'[]={'+[...b]+'};').join('\n'));
 await fs.writeFile(gen+'/../restart-source.json',JSON.stringify({source:s.source,scope:s.scope,windows:s.windows,strings:s.strings,instructions:s.instructions,ppuSha256:hash(s.ppu),rects,tiles:tiles.length,cursor:[...s.oam.subarray(0,cursor.length)]},null,2));return file;
}
