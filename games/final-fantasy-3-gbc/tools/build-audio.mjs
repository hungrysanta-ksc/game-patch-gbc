import fs from 'node:fs/promises';import {execFile}from'node:child_process';import{promisify}from'node:util';
import{ROOT,input,hash,check}from'./source.mjs';import{audioCatalog,renderDriver}from'./extract-audio.mjs';import{convertAudio,packFrames}from'./gb-audio.mjs';import{nesHarness}from'./nes-harness.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/audio',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});await fs.mkdir(ROOT+'/.local/compiler-tmp',{recursive:true});
const catalog=audioCatalog(data);await fs.writeFile(out+'/catalog.json',JSON.stringify(catalog,null,2));
const clips=[
 {key:'cave',name:'ALTAR CAVE',song:data[0x4010+22*16+10],frames:1440,effects:[],basis:'Map 0x16 property byte 10'},
 {key:'battle',name:'BATTLE 1',song:0x20,frames:1440,effects:[],basis:'2E/9D71'},
 {key:'fanfare',name:'FANFARE',song:7,frames:960,effects:[],basis:'2F/B284'},
 {key:'effects',name:'CURSOR EFFECTS',song:null,frames:720,effects:[{frame:30,id:0x18},{frame:150,id:5},{frame:270,id:6},{frame:390,id:0x0e}],basis:'34/9B79..9B83; additional raw effect ID 0E'},
 {key:'mixed',name:'BATTLE AND SFX',song:0x20,frames:1440,effects:[{frame:180,id:0x18},{frame:360,id:5},{frame:540,id:6},{frame:720,id:0x0e}],basis:'Same original music and SFX routines, scheduled comparison'},
 {key:'boss',name:'BATTLE 2',song:0x2a,frames:1440,effects:[],basis:'2E/9D82'},
 {key:'final',name:'FINAL BATTLE',song:0x28,frames:1440,effects:[],basis:'2E/9D7E'}
];
const packed=[],meta=[];let total=0;
for(const clip of clips){const r=renderDriver(data,clip),g=convertAudio(r),p=packFrames(g.packets);await fs.writeFile(out+'/'+clip.key+'.nes',nesHarness(data,clip));await fs.writeFile(out+'/'+clip.key+'-states.bin',Buffer.concat(r.states.map(Buffer.from)));await fs.writeFile(out+'/'+clip.key+'-apu.json',JSON.stringify(r.allWrites));await fs.writeFile(out+'/'+clip.key+'-packets.bin',Buffer.concat(g.packets.map(Buffer.from)));await fs.writeFile(out+'/'+clip.key+'-stream.bin',p);
 meta.push({...clip,bank:1+Math.floor(total/16384),offset:total%16384,streamBytes:p.length,streamSha256:hash(p),maxSourceInstructions:r.maxInstructions,...g.metrics});packed.push(p);total+=p.length;
}
const stream=Buffer.concat(packed),sources=[];
for(let i=0;i<Math.ceil(stream.length/16384);i++){const filename=gen+'/audio-bank'+(i+1)+'.c',block=stream.subarray(i*16384,(i+1)*16384);await fs.writeFile(filename,'#pragma bank '+(i+1)+'\n#include <stdint.h>\nconst uint8_t audio_bank'+(i+1)+'[]={'+[...block].join(',')+'};\n');sources.push(filename);}
const wave=[];for(let i=0;i<16;i++){const n=j=>j<16?15-j:j-16;wave.push(n(i*2)*16+n(i*2+1));}
const arr=(name,type,v)=>'const '+type+' '+name+'[]={'+v.join(',')+'};\n';
await fs.writeFile(gen+'/audio-assets.h','#include <stdint.h>\n#define CLIP_COUNT '+clips.length+'\nextern const uint8_t clip_banks[],triangle_wave[];\nextern const uint16_t clip_offsets[],clip_frames[];\nextern const char * const clip_names[];\n');
await fs.writeFile(gen+'/audio-meta.c','#include <stdint.h>\n'+arr('clip_banks','uint8_t',meta.map(x=>x.bank))+arr('clip_offsets','uint16_t',meta.map(x=>x.offset))+arr('clip_frames','uint16_t',meta.map(x=>x.frames))+arr('triangle_wave','uint8_t',wave)+'const char * const clip_names[]={'+meta.map(x=>JSON.stringify(x.name)).join(',')+'};\n');
const arg=process.argv.indexOf('--gbdk'),gbdk=arg>=0?process.argv[arg+1]:local.gbdk;check(gbdk,'Pass --gbdk PATH or local.json');const exe=gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(exe))===lock.gbdk.lccSha256,'Compiler identity mismatch');
const banks=2**Math.ceil(Math.log2(1+Math.ceil(stream.length/16384))),romPath=out+'/ff3-audio.gbc';
const args=['-msm83:gb','-Wm-yC','-Wm-yt0x19','-Wm-yo'+banks,'-Wm-ynFF3AUDIO','-Wl-m','-Wl-j','-I'+gen,'-o',romPath,ROOT+'/src/audio-player.c',gen+'/audio-meta.c',...sources];
try{const r=await promisify(execFile)(exe,args,{cwd:out,env:{...process.env,TMP:ROOT+'/.local/compiler-tmp',TEMP:ROOT+'/.local/compiler-tmp'},maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const rom=await fs.readFile(romPath);check(rom.length===banks*16384&&rom[0x143]===0xc0,'CGB header/bank size');check(rom.subarray(16384,16384+stream.length).equals(stream),'Compiled bank data differs from source conversion');
let header=0;for(let i=0x134;i<=0x14c;i++)header=(header-rom[i]-1)&255;check(header===rom[0x14d],'Header checksum mismatch');
let checksum=0;for(let i=0;i<rom.length;i++)if(i!==0x14e&&i!==0x14f)checksum=(checksum+rom[i])&65535;check(checksum===rom.readUInt16BE(0x14e),'ROM checksum mismatch');
const report={schema:1,sourceSha256:profile.sha256,romSha256:hash(rom),romBytes:rom.length,sourceRate:1789773/(341*262/3),cgbRate:4194304/70224,rateConversion:10062/10000,catalog:{songs:65,effects:97},clips:meta,scope:'Finite source-driver audio comparisons, not full-game audio completion'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({romSha256:report.romSha256,romBytes:rom.length,streamBytes:stream.length,clips:meta.map(x=>({key:x.key,song:x.song,frames:x.frames,dmcPops:x.dmcPopEvents,sweep:x.sweepFrames,bytes:x.streamBytes}))},null,2));
