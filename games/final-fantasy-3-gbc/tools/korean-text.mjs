import fs from 'node:fs/promises';
import {check,hash} from './source.mjs';
import {convertTiles} from './map-assets.mjs';
import {objectKinds} from './object-assets.mjs';
import {extractText} from './text-source.mjs';
export const textKinds=[...objectKinds,'sourceTextPointers','sourceTextBlocks','koreanText','textGlyphs','textBindings'];
export const fontSha256='04ba6bb04d33662dd0a1f324c31c31b4cc7824b593e6b80a5bdcdf1111bb43f6';
export function fontMap(font){
 check(font.length===18800&&hash(font)===fontSha256,'Expected approved 7x7_comp.fnt');const map=new Map(),decoder=new TextDecoder('euc-kr',{fatal:true});
 for(let i=0;i<2350;i++){const ch=decoder.decode(Uint8Array.from([0xb0+Math.floor(i/94),0xa1+i%94]));check(ch.length===1&&!map.has(ch),'Font Wansung mapping');check(font.subarray(i*8,i*8+8).some(v=>v),'Empty approved font glyph');map.set(ch,256+i);}
 return map;
}
// Existing NES punctuation shapes; no generated or substitute Hangul glyphs.
const punctuation=new Map(Object.entries({' ':255,'　':255,'.':0xc1,'。':0xc1,'…':0xc3,'!':0xc4,'?':0xc5,':':0xc8,'/':0xc7,'『':0xc9,'「':0xe6,'、':0xc0,',':0xc0,"'":0xc9,'ー':0xc2,'%':0xc6}));
export function glyphFor(ch,map){if(map.has(ch))return map.get(ch);if(punctuation.has(ch))return punctuation.get(ch);if(/^[0-9]$/.test(ch))return 0x80+Number(ch);throw Error('Missing approved glyph U+'+ch.codePointAt(0).toString(16));}
export function parseTsv(text){const result=new Map();for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){if(!line)continue;const at=line.indexOf('\t');check(at>0,'TSV key/value');const key=line.slice(0,at);check(!result.has(key),'Duplicate translation key');result.set(key,line.slice(at+1));}return result;}
export function compileBinding(binding,entry,ja,ko,map,categories={}){
 check(entry?.raw||entry?.tokens,'Unresolved source string is not translation eligible');
 check(binding.sourceSha256===entry.sha256,'Reviewed source binding changed');check(binding.reviewed===true,'Unreviewed translation binding');
 const words=[],semantic=[];
 for(const part of binding.parts){
  if(part.key!==undefined){const pair=part.category?categories[part.category]:{ja,ko};check(pair,'Unknown translation category');const {ja:pj,ko:pk}=pair;check(pj.has(part.key)&&pk.has(part.key),'Missing bilingual key');check(hash(Buffer.from(pj.get(part.key)))===part.jaSha256&&hash(Buffer.from(pk.get(part.key)))===part.koSha256,'Reviewed bilingual entry changed');
   if(part.prefix!==undefined)words.push(0x8000+glyphFor(part.prefix,map));
   const text=pk.get(part.key).replaceAll('\\n','\n');
   for(let at=0;at<text.length;){const token=Object.keys(part.markup||{}).sort((a,b)=>b.length-a.length).find(k=>text.startsWith(k,at));if(token){const replacement=part.markup[token];check(token.length>0&&Array.isArray(replacement),'Markup replacement');if(replacement[0]==='josa'){check(replacement.length===3,'Particle pair');words.push(64,glyphFor(replacement[1],map),glyphFor(replacement[2],map));}else if(replacement.length){const [op]=replacement;check(replacement.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&op<40&&op!==0&&op!==10&&replacement.length===(op>=16?2:1),'Markup control');words.push(...replacement);if(![1,9,20].includes(op))semantic.push(replacement);}at+=token.length;continue;}
    const ch=text[at++];check(!/[<>\\()]/.test(ch),'Unresolved translation markup');words.push(ch==='\n'?1:0x8000+glyphFor(ch,map));}
  }else if(part.control){const [op]=part.control;check(part.control.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&op<40&&op!==0&&op!==10&&part.control.length===(op>=16?2:1),'Invalid preserved control');words.push(...part.control);if(![1,9,20].includes(op))semantic.push(part.control);}
  else throw Error('Unknown binding part');
 }
 const expected=entry.tokens.filter(t=>t.kind==='control'&&t.policy==='preserve').map(t=>[...t.raw]);check(JSON.stringify(semantic)===JSON.stringify(expected),'Lost/reordered semantic source controls');
 words.push(entry.terminator);const out=Buffer.alloc(words.length*2);words.forEach((w,i)=>out.writeUInt16LE(w,i*2));return out;
}
export async function addTextAssets(rom,assets,config,{verify=true}={}){
 check(config?.font&&config?.bindings&&config?.translationDir,'Configure private text font/bindings/translationDir');
 const font=await fs.readFile(config.font),map=fontMap(font),bindings=JSON.parse(await fs.readFile(config.bindings)),analysis=extractText(rom,{verify});
 check(bindings.schema===1&&Array.isArray(bindings.entries)&&bindings.entries.length>0,'Private binding schema');
 const ja=parseTsv(await fs.readFile(config.translationDir+'/story_mes_ja.txt','utf8')),ko=parseTsv(await fs.readFile(config.translationDir+'/story_mes_ko.txt','utf8'));
 const categories={};for(const category of new Set(bindings.entries.flatMap(b=>b.parts.map(p=>p.category).filter(Boolean)))){check(['system','supplement'].includes(category),'Unsupported translation category');categories[category]={ja:parseTsv(await fs.readFile(config.translationDir+'/'+category+'_ja.txt','utf8')),ko:parseTsv(await fs.readFile(config.translationDir+'/'+category+'_ko.txt','utf8'))};}
 const messages=[],ids=new Set();for(const b of bindings.entries){check(Number.isInteger(b.id)&&b.id>=0&&b.id<1712&&!ids.has(b.id),'Binding ID');ids.add(b.id);messages.push(compileBinding(b,analysis.entries[b.id],ja,ko,map,categories));}
 // Glyph IDs 0..255 preserve NES tile numbers, but only 70..FF are present in
 // the field font. Low IDs fail lookup; they are not silently empty glyphs.
 const glyphs=Buffer.alloc(2606*16);convertTiles(rom.subarray(0x1b710,0x1c010)).copy(glyphs,0x70*16);
 for(let i=0;i<2350;i++)for(let y=0;y<8;y++){const v=font[i*8+y];glyphs[(256+i)*16+y*2]=v;glyphs[(256+i)*16+y*2+1]=v;}
 const glyphUsage=new Set();for(const m of messages)for(let i=0;i<m.length;i+=2){const w=m.readUInt16LE(i);if(w>=0x8000)glyphUsage.add(w-0x8000);}
 for(const id of glyphUsage)check(id===255||glyphs.subarray(id*16,id*16+16).some(v=>v),'Empty selected glyph '+id);
 const chunks=(b,n)=>Array.from({length:Math.ceil(b.length/n)},(_,i)=>Buffer.from(b.subarray(i*n,(i+1)*n)));
 const pairs=bindings.entries.map((b,i)=>[b.id,i]).sort((a,b)=>a[0]-b[0]),index=Buffer.alloc(pairs.length*4);pairs.forEach(([id,handle],i)=>{index.writeUInt16LE(id,i*4);index.writeUInt16LE(handle,i*4+2);});
 Object.assign(assets.groups,{sourceTextPointers:[Buffer.from(rom.subarray(0x30010,0x30d70))],sourceTextBlocks:chunks(rom.subarray(0x30010,0x3e010),16384),koreanText:messages,textGlyphs:chunks(glyphs,16384),textBindings:[index]});
 for(const kind of textKinds.slice(objectKinds.length))for(const [id,bytes]of assets.groups[kind].entries())assets.provenance.push({kind,id,bytes:bytes.length,sha256:hash(bytes),source:kind==='sourceTextPointers'?[{offset:0x30010,bytes:3424}]:kind==='sourceTextBlocks'?[{offset:0x30010+id*16384,bytes:bytes.length}]:kind==='textGlyphs'?[{offset:0x1b710,bytes:2304},{privateFontSha256:fontSha256,bytes:18800}]:[{privateBindingsSha256:hash(await fs.readFile(config.bindings)),...(kind==='koreanText'?{sourceId:bindings.entries[id].id,sourceSha256:analysis.entries[bindings.entries[id].id].sha256}:{} )}],consumer:'3F/EE9A..F387 source; src/text-window.c GBC adapter'});
 assets.text={analysis,bindings,sourceIds:bindings.entries.map(b=>b.id),fontSha256,fontGlyphs:2350,usedGlyphs:glyphUsage.size,glyphs,messages};return assets;
}
