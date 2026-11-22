import fs from 'node:fs/promises';import path from 'node:path';
import{ROOT,check,hash}from'./source.mjs';import{parseVgm,vgmToFrames}from'./vgm.mjs';import{convertAudio,packFrames}from'./gb-audio.mjs';
const option=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];},dir=option('--dir');check(dir,'Pass --dir PATH containing locally unpacked .vgz files');
const out=ROOT+'/build/vgm-audit';await fs.mkdir(out,{recursive:true});const names=(await fs.readdir(dir)).filter(n=>/\.vg[zm]$/i.test(n)).sort(),tracks=[];check(names.length,'No VGM/VGZ inputs');
for(let i=0;i<names.length;i++){
 const file=names[i],raw=await fs.readFile(path.join(dir,file)),v=parseVgm(raw),frames=vgmToFrames(v),g=convertAudio(frames),packed=packFrames(g.packets),id=String(i+1).padStart(2,'0');
 await fs.writeFile(out+'/'+id+'-timeline.json',JSON.stringify({clock:v.clock,samples:v.samples,loopSample:v.loopSample,events:v.events}));
 await fs.writeFile(out+'/'+id+'-candidate.bin',packed);
 let onset=null;const pulseWidths=[];for(const e of v.events)if(e.register===0x4011){if(e.value)onset=e.sample;else if(onset!==null){pulseWidths.push(e.sample-onset);onset=null;}}
 const {events,...metadata}=v;tracks.push({file,inputSha256:hash(raw),inputBytes:raw.length,...metadata,writes:events.length,dacPulseWidthsSamples:pulseWidths,convertedBytes:packed.length,convertedSha256:hash(packed),quantization:frames.quantization,conversion:g.metrics});
}
const summary={tracks:tracks.length,looped:tracks.filter(t=>t.loopSample!==null).length,vgzBytes:tracks.reduce((a,t)=>a+t.inputBytes,0),vgmBytes:tracks.reduce((a,t)=>a+t.vgmBytes,0),convertedBytes:tracks.reduce((a,t)=>a+t.convertedBytes,0),seconds:tracks.reduce((a,t)=>a+t.seconds,0),clocks:[...new Set(tracks.map(t=>t.clock))],commands:[...new Set(tracks.flatMap(t=>Object.keys(t.commands)))].map(n=>'0x'+(+n).toString(16)),dataBlocks:tracks.reduce((a,t)=>a+t.blocks.length,0),dacPopTracks:tracks.filter(t=>t.conversion.dmcPopEvents>0).map(t=>t.file),newRecording:false};
await fs.writeFile(out+'/report.json',JSON.stringify({summary,tracks},null,2));console.log(JSON.stringify(summary,null,2));
