import fs from 'node:fs/promises';
import {check,hash} from './source.mjs';
import {fontMap,glyphFor,parseTsv} from './korean-text.mjs';
import {compactOriginalBox,battleTextAdvance} from './battle-action-ui.mjs';
import {encodeTile} from './npc-composition.mjs';
import {compiledItemUseTables} from './battle-item-use-source.mjs';
export async function itemAssets(rom,text,tiles,config){
 check(config.itemNames,'Configure private text.itemNames (source-hashed Korean item bindings)');
 const bytes=await fs.readFile(config.itemNames),bindings=JSON.parse(bytes),map=fontMap(await fs.readFile(config.font)),system=parseTsv(await fs.readFile(config.translationDir+'/system_ko.txt','utf8')),names=[],widths=[],origins=[];
 const labels=['MSG_SYSTEM_288','MSG_SYSTEM_289'].map(key=>{check(system.has(key),'Missing equipment label '+key);return system.get(key);});
 check(bindings.schema===1&&bindings.entries.length===256,'Complete item name bindings');
 for(let id=0;id<258;id++){
  const e=bindings.entries[id],entry=text.analysis.entries[0x400+id];
  if(id<256)check(e.id===id&&e.reviewed&&e.sourceSha256===entry.sha256&&typeof e.ko==='string','Reviewed item binding '+id);
  const words=(id<256?[...(entry.raw[0]>=0x60&&entry.raw[0]<0x80?[entry.raw[0]]:[]),...[...e.ko].map(ch=>glyphFor(ch,map))]:[...labels[id-256]].map(ch=>glyphFor(ch,map))),b=Buffer.alloc(128);
  const width=words.reduce((n,g)=>n+battleTextAdvance(g),0);check(width<=128,'Full item name capacity '+id);
  let cursor=0;for(const g of words){const font=g>=256?text.glyphs:tiles;if(g!==255)for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((font[g*16+y*2]&font[g*16+y*2+1])&(128>>x))b[y*16+((cursor+x)>>3)]|=128>>((cursor+x)&7);cursor+=battleTextAdvance(g);}
  names.push(b);widths.push(width);origins.push(id<256?{id,sourceSha256:e.sourceSha256,origin:e.origin??'supplied translation binding',translationSha256:hash(Buffer.from(e.ko))}:{id,origin:'system right/left labels'});
 }
 const base=[];for(let kind=0;kind<4;kind++){
  const p=compactOriginalBox(tiles,80,38),middle=compactOriginalBox(tiles,240,38);
  for(let y=0;y<38;y++)for(let x=0;x<80;x++)if((x<4&&kind!==0&&kind!==1)||(x>=76&&kind!==0&&kind!==3))p[y*80+x]=middle[y*240+80+x];
  for(let y=0;y<40;y+=8)for(let x=0;x<80;x+=8){const a=[];for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)a.push(y+yy<38?p[(y+yy)*80+x+xx]:0);base.push(encodeTile(a));}
 }
 const use=compiledItemUseTables(rom);return {names:Buffer.concat(names),widths:Buffer.from(widths),base:Buffer.concat(base),digits:Buffer.concat([...Array.from({length:10},(_,i)=>0x80+i),0xc8,0x73].map(id=>tiles.subarray(id*16,id*16+16))),...use,report:{bindingsSha256:hash(bytes),names:origins,useChecks:use.checks,provenance:use.provenance,viewport:36,fullNameCapacity:128,columnWidth:80,rows:4,scrollFrames:6}};
}
