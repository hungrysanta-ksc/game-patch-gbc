// Strict NES-only VGM reader. Preserve sample times before any GBC quantization.
// Format: https://github.com/vgmrips/vgmplay-legacy/blob/master/VGMPlay/vgmspec171.txt
import {gunzipSync} from 'node:zlib';
import {check,hash} from './source.mjs';

export function parseVgm(input){
 const b=input[0]===0x1f&&input[1]===0x8b?gunzipSync(input,{maxOutputLength:64*1024*1024}):input;
 check(b.length>=0x40&&b.toString('ascii',0,4)==='Vgm ','Invalid VGM signature');
 const version=b.readUInt32LE(8);check(version>=0x161&&version<=0x171,'Unsupported VGM version');
 check(b.readUInt32LE(4)+4===b.length,'VGM EOF size mismatch');
 const start=b.readUInt32LE(0x34)?0x34+b.readUInt32LE(0x34):0x40;
 check(start>=0x88&&start<b.length,'NES clock header missing');
 const clock=b.readUInt32LE(0x84);check(clock>0&&clock<0x40000000,'Requires a single NES APU without FDS');
 const clockOffsets=[0x0c,0x10,0x2c,0x30,0x38,0x40,0x44,0x48,0x4c,0x50,0x54,0x58,0x5c,0x60,0x64,0x68,0x6c,0x70,0x74,0x80,0x88,0x8c,0x90,0x98,0x9c,0xa0,0xa4,0xa8,0xac,0xb0,0xb4,0xb8,0xc0,0xc4,0xc8,0xcc,0xd0,0xd8,0xdc,0xe0];
 for(const at of clockOffsets)if(at+4<=start)check(b.readUInt32LE(at)===0,'Additional sound chip at '+at.toString(16));
 const gd=b.readUInt32LE(0x14)?0x14+b.readUInt32LE(0x14):0,limit=gd||b.length;
 const loopOffset=b.readUInt32LE(0x1c)?0x1c+b.readUInt32LE(0x1c):null;
 let at=start,sample=0,loopSample=null,ended=false;const events=[],blocks=[],commands={},registers={};
 const need=n=>check(at+n<=limit,'Truncated VGM command');
 while(at<limit){const offset=at;if(offset===loopOffset)loopSample=sample;const op=b[at++];commands[op]=(commands[op]||0)+1;
  if(op===0xb4){need(2);const r=b[at++],value=b[at++];check(r<=0x17,'Unsupported NES extension/register '+r.toString(16));events.push({sample,register:0x4000+r,value,offset});registers[r]=(registers[r]||0)+1;}
  else if(op===0x61){need(2);sample+=b.readUInt16LE(at);at+=2;}
  else if(op===0x62)sample+=735;
  else if(op===0x63)sample+=882;
  else if(op>=0x70&&op<=0x7f)sample+=(op&15)+1;
  else if(op===0x67){need(6);check(b[at++]===0x66,'Invalid data block marker');const type=b[at++],size=b.readUInt32LE(at);at+=4;need(size);blocks.push({sample,type,size,offset});at+=size;}
  else if(op===0x66){ended=true;break;}
  else throw Error('Unsupported VGM command 0x'+op.toString(16)+' at 0x'+offset.toString(16));
 }
 check(ended,'Missing VGM end command');check(sample===b.readUInt32LE(0x18),'Total sample count differs');
 check(loopOffset===null||loopSample!==null,'Loop offset is not a command boundary');
 check((loopSample===null?0:sample-loopSample)===b.readUInt32LE(0x20),'Loop sample count differs');
 let tags=[];if(gd){check(gd>=at&&gd+12<=b.length&&b.toString('ascii',gd,gd+4)==='Gd3 ','Invalid GD3');const n=b.readUInt32LE(gd+8);check(!(n&1)&&gd+12+n<=b.length,'Invalid GD3 size');tags=b.toString('utf16le',gd+12,gd+12+n).split('\0');}
 return{version,clock,samples:sample,seconds:sample/44100,loopOffset,loopSample,loopSamples:b.readUInt32LE(0x20),loopSeconds:b.readUInt32LE(0x20)/44100,vgmBytes:b.length,vgmSha256:hash(b),commands,registers,blocks,tags,events};
}

// Feasibility bridge only: the existing player consumes ~60.098 Hz frames.
// Exact sample times remain in parseVgm().events; loops are NOT implemented here.
export function vgmToFrames(vgm,rate=1789773/(341*262/3)){
 check(Number.isFinite(rate)&&rate>0,'Invalid target tick rate');
 check(Math.abs(vgm.clock-1789773)<=1,'Existing converter requires NTSC NES clock');
 check(vgm.blocks.length===0,'Data blocks need an explicit DPCM conversion path');
 check(!vgm.events.some(e=>(e.register===0x4015&&(e.value&16))||(e.register===0x4010&&e.value)),'DPCM playback unsupported');
 for(const e of vgm.events){
  if([0x4000,0x4004,0x400c].includes(e.register))check((e.value&0x30)===0x30,'Hardware envelope/length counter needs a new conversion path');
  if(e.register===0x4015)check(e.value===15,'Channel enable changes need a new conversion path');
  if(e.register===0x4017)check(e.value===64,'Frame sequencer change needs a new conversion path');
  if(e.register===0x4008)check(e.value===128||e.value===255,'Triangle linear counter needs a new conversion path');
 }
 const count=Math.ceil(vgm.samples*rate/44100),allWrites=Array.from({length:count},()=>[]),output=Array.from({length:count},()=>new Uint8Array(24));
 let maxEarlySamples=0,terminalWrites=0;
 for(const e of vgm.events){const f=Math.floor(e.sample*rate/44100);if(f>=count){terminalWrites++;continue;}allWrites[f].push([e.register,e.value]);maxEarlySamples=Math.max(maxEarlySamples,e.sample-f*44100/rate);}
 check(terminalWrites===0,'Writes at the end require an explicit terminal event path');
 return {output,allWrites,quantization:{rate,maxEarlyMilliseconds:maxEarlySamples/44.1,terminalWrites,scope:'Finite conversion feasibility; exact loop and subframe playback not implemented'}};
}
