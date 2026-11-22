// Planning inventory, not a product extractor or a full-game fidelity claim.
// Reference files and per-entry reports remain private; only this tool is published.
import fs from 'node:fs/promises';
import {ROOT,input,check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
const {data:rom,profile}=await input();
const arg=process.argv.indexOf('--references');
check(arg>=0&&process.argv[arg+1],'Pass --references PATH to the locally held analysis files');
const dir=process.argv[arg+1],sources={},text={};
for(const name of ['rom-map.txt','field-ram.txt','battle-ram.txt','ff3j.asm','ff3j-event.txt','ff3j-text.txt','ff3j-nes.json']){
  const b=await fs.readFile(dir+'/'+name);sources[name]={bytes:b.length,sha256:hash(b)};text[name]=b.toString('utf8');
}
const number=s=>parseInt(s,16),offset=n=>16+(n>>>16)*8192+(n&8191);
const regions=[];
for(const line of text['rom-map.txt'].split(/\r?\n/)){
  const m=line.match(/^\|\s*([\dA-F]{6})-([\dA-F]{6})\s*\|\s*([\dA-F]{6})-([\dA-F]{6})\s*\|\s*(.*?)\s*\|/);
  if(!m)continue;
  const [cpuBegin,cpuEnd,begin,end]=m.slice(1,5).map(number);
  regions.push({name:m[5],begin,end,bytes:end-begin+1,cpuBegin,cpuEnd,
    addressAgreement:offset(cpuBegin)===begin&&offset(cpuEnd)===end,
    inRom:begin>=16&&end>=begin&&end<rom.length});
}
check(regions.length>100,'ROM map format not recognized');
const headings=[],lines=text['ff3j.asm'].split(/\r?\n/);
for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^; \[ (.*?) \]/);if(!m)continue;
  let j=i+1;while(j<lines.length&&!/^[\dA-F]{2}\/[\dA-F]{4}:/.test(lines[j]))j++;
  if(j<lines.length)headings.push({name:m[1],line:i+1,address:lines[j].slice(0,7)});
}
const schema=JSON.parse(text['ff3j-nes.json']);
const definitions=Object.entries(schema.assembly).map(([id,v])=>({id,type:v.type,range:v.range,
  declaredSlots:v.array?.length??v.arrayLength,pointers:v.pointerTable?.range}));
const layouts=[];
for(let id=0;id<256;id++){
  const begin=0x22010+rom.readUInt16LE(0x22010+id*2);let at=begin,n=0;
  const map=Buffer.alloc(1024);let error;
  try{
    check(begin>=0x22210&&begin<0x30010,'Layout pointer outside region');
    while(n<1024){check(at<0x30010,'Layout exceeds region');const b=rom[at++];let count=1;
      if(b&128){check(at<0x30010,'Missing RLE count');count=rom[at++]||256;}
      check(n+count<=1024,'RLE exceeds 32x32 map');map.fill(b&127,n,n+count);n+=count;
    }
    const c=new Driver6502(rom);c.m.set(rom.subarray(begin,at),0x5000);c.m[0x81]=0x50;c.m[0x83]=0x74;c.call(0xcbfa);
    check(map.equals(Buffer.from(c.m.subarray(0x7400,0x7800))),'Original CBFA decoder mismatch');
  }catch(e){error=e.message;}
  layouts.push({id,begin,compressedBytes:at-begin,decodedBytes:n,sha256:error?undefined:hash(map),error});
}
const maps=Array.from({length:512},(_,id)=>({id,layout:rom[0xa10+id],graphicsSet:rom[0xc10+id],
  tileset:rom[0x4010+id*16]>>>5,song:rom[0x4010+id*16+10]}));
const histogram=values=>{const h={};for(const v of values)h[v]=(h[v]??0)+1;return h;};
const events=[],opcodes={},opcodeScripts={};
for(let id=0;id<256;id++){
  const pointer=rom.readUInt16LE(0x58610+id*2),begin=0x58010+pointer-0x8000;
  let at=begin,ended=false,error;const commands=[];
  try{
    check(pointer>=0x8000&&pointer<0xc000,'Event pointer outside bank pair');
    for(let guard=0;guard<4096;guard++){
      check(at<0x5c010,'Event exceeds bank pair');const op=rom[at++];
      // 3E/D219 special-cases FE, D257..D25F consume an operand for E4..FC.
      const length=op===0xfe||(op>=0xe4&&op<=0xfc)?2:1;
      if(length===2){check(at<0x5c010,'Missing event operand');at++;}
      commands.push(op);if(op===255){ended=true;break;}
    }
    check(ended,'No syntactic event terminator');
  }catch(e){error=e.message;}
  if(!error){for(const op of commands)opcodes[op]=(opcodes[op]??0)+1;
    for(const op of new Set(commands))opcodeScripts[op]=(opcodeScripts[op]??0)+1;}
  events.push({id,begin,bytes:at-begin,commands:commands.length,opcodes:[...new Set(commands)].sort((a,b)=>a-b),error});
}
function pointers(begin,count){const v=Array.from({length:count},(_,i)=>rom.readUInt16LE(begin+i*2));return{begin,slots:count,unique:new Set(v).size,min:Math.min(...v),max:Math.max(...v)};}
const population={
  normalMapProperties:{begin:0x4010,slots:512,recordBytes:16},
  mapLayouts:pointers(0x22010,256),mapGraphicsSets:{begin:0xe10,slots:48,recordBytes:16},
  mapTilesets:{begin:0x2390,slots:7,recordBytes:512},worldRows:pointers(0xd010,1024),
  npcPlacementLists:pointers(0x58010,256),npcScripts:pointers(0x58210,512),
  eventScripts:pointers(0x58610,256),itemSelectScripts:pointers(0x58810,48),
  guestScripts:pointers(0x58870,8),conditionalMusic:pointers(0x58880,8),triggerScripts:pointers(0x58890,256),
  mainText:pointers(0x30010,1712),cutsceneText:pointers(0x3e5ef,17),credits:pointers(0x21650,31),
  formations:{begin:0x5c010,slots:512,recordBytes:2},monsters:{begin:0x60010,slots:256,recordBytes:16},
  monsterAi:{begin:0x61210,slots:49,recordBytes:8},weapons:{begin:0x61410,slots:88,recordBytes:8},
  armor:{begin:0x616d0,slots:64,recordBytes:8},attacks:{begin:0x618d0,slots:115,recordBytes:8},
  jobs:{begin:0x72010,slots:22,recordBytes:8},levelThresholds:{begin:0x720c0,slots:98,recordBytes:3},
  jobGrowth:{begin:0x721e6,slots:98*22,recordBytes:2},bossTilemaps:{begin:0x54010,slots:24,recordBytes:216},
  battleAlgorithms:pointers(0x61e86,10),attackEffects:pointers(0x63aac,57)
};
for(const p of Object.values(population))check(p.begin+(p.recordBytes??2)*p.slots<=rom.length,'Population exceeds ROM');
const summary={regions:regions.length,regionAddressDisagreements:regions.filter(x=>!x.addressAgreement||!x.inRom).length,
  annotatedRoutineHeadings:headings.length,editorDefinitions:definitions.length,
  mapSlots:maps.length,referencedLayoutIds:new Set(maps.map(x=>x.layout)).size,
  decodedLayoutSlots:layouts.filter(x=>!x.error).length,layoutErrors:layouts.filter(x=>x.error).length,
  uniqueDecodedLayouts:new Set(layouts.filter(x=>!x.error).map(x=>x.sha256)).size,
  tilesetUsage:histogram(maps.map(x=>x.tileset)),graphicsSetUsage:histogram(maps.map(x=>x.graphicsSet)),
  eventSlots:events.length,syntacticallyDecodedEvents:events.filter(x=>!x.error).length,
  distinctEventOpcodes:Object.keys(opcodes).length,eventErrors:events.filter(x=>x.error).length};
const report={schema:1,scope:'Static populations and bounded decodes; slot counts are not reachability or runtime completeness',
  sourceSha256:profile.sha256,sources,summary,population,regions,headings,definitions,maps,layouts,events,opcodes,opcodeScripts};
await fs.mkdir(ROOT+'/build/analysis',{recursive:true});await fs.writeFile(ROOT+'/build/analysis/source-survey.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
check(summary.layoutErrors===0&&summary.eventErrors===0,'Bounded decode failed; inspect the private report, do not silently discard entries');
