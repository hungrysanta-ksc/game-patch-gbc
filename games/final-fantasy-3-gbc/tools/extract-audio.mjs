import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Driver6502} from './driver6502.mjs';
import {ROOT,input,check,hash} from './source.mjs';
export function renderDriver(data,{song=null,frames=1800,effects=[]}){
 check(song===null||(Number.isInteger(song)&&song>=0&&song<=64),'Unknown music slot');check(Number.isInteger(frames)&&frames>0&&frames<=65535,'Invalid bounded duration');
 for(const e of effects)check(Number.isInteger(e.id)&&e.id>=0&&e.id<=96&&Number.isInteger(e.frame)&&e.frame>=0&&e.frame<frames,'Invalid effect request');
 const cpu=new Driver6502(data);cpu.call(0x8000);if(song!==null){cpu.m[0x7f43]=song;cpu.m[0x7f42]=1;}
 const output=[],states=[],allWrites=[];let maxInstructions=0;
 for(let frame=0;frame<frames;frame++){
  for(const fx of effects)if(fx.frame===frame)cpu.m[0x7f49]=0x80|fx.id;
  cpu.writes=[];maxInstructions=Math.max(maxInstructions,cpu.call(0x8003));
  output.push(cpu.m.slice(0x4000,0x4018));allWrites.push(cpu.writes);states.push(cpu.m.slice(0x7f40,0x8000));
 }
 return {output,allWrites,states,maxInstructions,opcodes:[...cpu.opcodes].sort((a,b)=>a-b)};
}
export function audioCatalog(data){
 const groups=[[0,0x18,0x37,0x6e010],[0x19,0x2a,0x38,0x70010],[0x2b,0x36,0x36,0x6cc87],[0x37,0x3a,0x39,0x733be],[0x3b,0x40,9,0x13410]];
 const songs=groups.flatMap(([first,last,bank,table])=>Array.from({length:last-first+1},(_,i)=>{const p=data.readUInt16LE(table+i*2),offset=16+bank*8192+(p&8191);return{id:first+i,tableOffset:table+i*2,bank,pointer:p,offset,channels:Array.from({length:5},(_,n)=>data.readUInt16LE(offset+n*2))};}));
 const effects=Array.from({length:97},(_,id)=>{const tableOffset=0x6d2d5+id*2,p=data.readUInt16LE(tableOffset),offset=0x6c010+(p&8191);return{id,tableOffset,pointer:p,offset,channels:[data.readUInt16LE(offset),data.readUInt16LE(offset+2)]};});
 check(songs.length===65&&effects.at(-1).tableOffset+2===0x6d397,'Audio table sizes');
 return {songs,effects,driver:{offset:0x6c010,bytes:0xc77,sha256:hash(data.subarray(0x6c010,0x6cc87))},scope:'Source headers and original driver execution, not manually transcribed notes'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const{data}=await input();const c=audioCatalog(data);await fs.mkdir(ROOT+'/build/audio',{recursive:true});await fs.writeFile(ROOT+'/build/audio/catalog.json',JSON.stringify(c,null,2));const r=renderDriver(data,{song:0x20,frames:1800});console.log(JSON.stringify({songs:c.songs.length,effects:c.effects.length,frames:r.output.length,maxInstructions:r.maxInstructions,opcodes:r.opcodes,nonzero:r.output.filter(f=>f[0]&15).length}));}
