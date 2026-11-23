import {check,hash} from './source.mjs';
import {stateCpu,segment} from './state-source.mjs';

// Field/menu consumer only. Battle/cutscene consumers are separate contracts.
export const textTable={offset:0x30010,count:1712,payload:0x30d70,end:0x3e010,bank:0x18,cpu:0x8000,consumer:'3F/EE9A..F387',reference:'ff3j.asm:53622-54280'};
const names=['end','newline','item-context','treasure-gil','variable-gil','party-gil','ignored-speed','guest-name','capacity','half-newline','return-half-line','ignored-0b','shown-name','save-count','ignored-0e','trash-icon','character-0','character-1','character-2','character-3','tab','choice-0','choice-1','choice-2','usable-item','shop-item','inventory-item','storage-item','inventory-count','storage-count','job','job-cost','sell-item','shop-price','item-without-icon','ignored-23','ignored-24','ignored-25','ignored-26','ignored-27'];
export const controls=names.map((name,code)=>({code,name,bytes:code>=16?2:1,policy:[1,9,20].includes(code)?'layout':code===0||code===10?'terminator':'preserve',consumer:code<16?'3F/EEFA..F029':'3F/F02A..F387'}));
export function tokenizeField(bytes,start=0,end=bytes.length){
 const tokens=[];let at=start;
 while(at<end){const offset=at,code=bytes[at++],control=code<40;
  if(control&&code>=16){check(at<end,'Truncated field control operand');at++;}
  tokens.push({offset,code,kind:control?'control':'glyph',raw:Buffer.from(bytes.subarray(offset,at)),...(control?{name:controls[code].name,policy:controls[code].policy}:{})});
  if(code===0||code===10)return {tokens,end:at,terminator:code};
 }
 throw Error('Unterminated field text');
}
export function extractText(rom,{verify=true}={}){
 const entries=[],unresolved=[],usage=Array(40).fill(0),byStart=new Map();let pointerComparisons=0,glyphComparisons=0,operandComparisons=0;
 const c=verify?stateCpu(rom):null;
 for(let id=0;id<textTable.count;id++){
  const pointer=rom.readUInt16LE(textTable.offset+id*2),start=textTable.offset+pointer;
  if(c){c.m[0x92]=id&255;c.m[0x94]=0;c.m[0x95]=0x80+(id>>8)*2;segment(c,0xee9a,0xeec0);const actual=16+c.m[0x93]*8192+((c.m[0x3e]|c.m[0x3f]<<8)&8191);check(actual===start,'Original text pointer '+id);pointerComparisons++;}
  if(start<textTable.payload||start>=textTable.end){const e={id,pointer,start,status:'unresolved-pointer-outside-payload'};entries.push(e);unresolved.push(e);continue;}
  const parsed=tokenizeField(rom,start,textTable.end),raw=Buffer.from(rom.subarray(start,parsed.end));
  check(Buffer.concat(parsed.tokens.map(t=>t.raw)).equals(raw),'Text roundtrip '+id);
  for(const t of parsed.tokens)if(t.kind==='control')usage[t.code]++;
  const entry={id,pointer,start,end:parsed.end,raw,sha256:hash(raw),tokens:parsed.tokens,terminator:parsed.terminator};entries.push(entry);
  if(!byStart.has(start))byStart.set(start,[]);byStart.get(start).push(id);
 }
 // Original decoder, every glyph in both contexts, unchanged ROM. Stop at the
 // next decoder iteration before unrelated PPU/NMI work. Dakuten stay separate.
 const glyphs=[];
 for(let menu=0;menu<2;menu++)for(let code=40;code<256;code++){
  const voiced=code<0x5c,kana=voiced?rom[0x7f4f1+code-40]:(!menu&&code<0x70?255:code),mark=voiced?rom[0x7f525+code-40]:255;
  if(c){c.m[0x5000]=code;c.m[0x3e]=0;c.m[0x3f]=0x50;c.m[0x90]=0;c.m[0x37]=menu;c.pc=0xeefa;c.step();segment(c,c.pc,0xeefa);check(c.m[0x7a0]===kana&&c.m[0x780]===mark&&c.m[0x90]===1&&c.m[0x3e]===1,'Original glyph decoder');glyphComparisons++;}
  glyphs.push({menu,code,kana,mark});
 }
 if(c)for(let op=16;op<40;op++)for(let arg=0;arg<256;arg++){
  c.a=op;c.y=0;c.m[0x3e]=255;c.m[0x3f]=0x50;c.m[0x50ff]=arg;c.m[0x67]=0xa5;
  segment(c,0xf02a,0xf03e);c.step();check(c.a===op&&c.m[0x3e]===0&&c.m[0x3f]===0x51&&c.m[0x84]===(op===29?0xa5:arg),'Original operand width / retained storage index');operandComparisons++;
 }
 const starts=[...byStart.keys()].sort((a,b)=>a-b),interior=entries.filter(e=>e.raw&&entries.some(p=>p.raw&&p.start<e.start&&e.start<p.end)).map(e=>e.id);
 return {table:textTable,entries,controls,usage,glyphs,summary:{entries:entries.length,unresolved,uniquePointers:starts.length,aliases:[...byStart.values()].filter(a=>a.length>1),interiorEntryIds:interior,pointerComparisons,glyphComparisons,operandComparisons,rawRoundtrips:entries.length-unresolved.length,terminators:Object.fromEntries([0,10].map(t=>[t,entries.filter(e=>e.terminator===t).length])),scope:'Main shared table under field/menu grammar. Does not establish battle semantics or event reachability.'}};
}
