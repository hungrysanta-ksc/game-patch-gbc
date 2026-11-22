import {check} from './source.mjs';
export const TICK_HZ=4096, SAMPLE_HZ=44100, MAX_WAIT=30000;
export const toTick=s=>Math.floor(s*TICK_HZ/SAMPLE_HZ);

// [delay:u16, count:u8, NES register/value pairs]. 254 marks the loop entry;
// 255 ends a segment. Long waits use count=0. Reject collapsed DAC edges.
export function encodeTimed(vgm){
 check(Math.abs(vgm.clock-1789773)<=1&&!vgm.blocks.length,'Unsupported VGM hardware profile');
 const valid=new Set([0,1,2,3,4,5,6,7,8,10,11,12,14,15,16,17,18,19,21,23]);
 for(const e of vgm.events){const r=e.register-0x4000;check(valid.has(r),'Unsupported APU register');
  if([0,4,12].includes(r))check((e.value&0x30)===0x30,'Hardware envelope/length counter unsupported');
  if(r===8)check(e.value===128||e.value===255,'Triangle linear counter unsupported');
  if(r===21)check(e.value===15,'Channel enable change unsupported');
  if(r===23)check(e.value===64,'Frame sequencer mode unsupported');
  if(r===16)check(e.value===0,'DPCM unsupported');
 }
 const chunks=[],records=[];let bytes=0,previousTick=0,loopOffset=null;
 function append(delay,count,writes=[],time=0){check(delay>=0&&delay<=MAX_WAIT,'Invalid delay');const b=Buffer.from([delay&255,delay>>8,count,...writes.flatMap(e=>[e.register-0x4000,e.value])]);records.push({offset:bytes,time,delay,count,writes:writes.map(e=>[e.register-0x4000,e.value])});chunks.push(b);bytes+=b.length;}
 function at(tick,count,writes=[]){let delta=tick-previousTick;check(delta>=0,'Time reversal');while(delta>MAX_WAIT){append(MAX_WAIT,0,[],previousTick+MAX_WAIT);previousTick+=MAX_WAIT;delta-=MAX_WAIT;}append(delta,count,writes,tick);previousTick=tick;}
 function segment(events,baseSample,duration,terminator){previousTick=0;const groups=new Map();for(const e of events){const t=toTick(e.sample-baseSample);check(t>=0&&t<=toTick(duration),'Event outside segment');if(!groups.has(t))groups.set(t,[]);groups.get(t).push(e);}
  for(const[t,w]of groups){check(w.length<254,'Too many writes in one timer quantum');const dac=w.filter(e=>e.register===0x4011);check(dac.every(e=>e.value===dac[0].value),'DAC edges collapse in one timer quantum');at(t,w.length,w);}at(toTick(duration),terminator);
 }
 if(vgm.loopSample!==null){
  check(vgm.loopSamples>0,'Empty loop');
  segment(vgm.events.filter(e=>e.offset<vgm.loopOffset),0,vgm.loopSample,254);
  loopOffset=bytes;
  segment(vgm.events.filter(e=>e.offset>=vgm.loopOffset),vgm.loopSample,vgm.loopSamples,255);
 }else segment(vgm.events,0,vgm.samples,255);
 return{data:Buffer.concat(chunks),records,loopOffset,loopFraction:vgm.loopSamples*TICK_HZ%SAMPLE_HZ,initialFraction:(vgm.loopSample||0)*TICK_HZ%SAMPLE_HZ,maxWritesPerTick:Math.max(...records.filter(r=>r.count<254).map(r=>r.count)),sourceWrites:vgm.events.length,totalSamples:vgm.samples,loopSamples:vgm.loopSamples};
}

// Independent decoder/reference cursor used by runtime verification.
export function makeReference(data,meta){
 let position=0,due=0,count=0,writes=0,records=0,loops=0,fraction=meta.initialFraction,hash=0,done=false;const regs=Buffer.alloc(24);
 function header(){check(position+3<=data.length,'Truncated timed header');due+=data.readUInt16LE(position);count=data[position+2];position+=3;}
 header();
 return{advanceToRecord(target){while(records<target&&!done){if(count===254){}else if(count===255){if(meta.loopOffset===null)done=true;else{loops++;fraction+=meta.loopFraction;if(fraction>=SAMPLE_HZ){fraction-=SAMPLE_HZ;due++;}position=meta.loopOffset;}}else{for(let i=0;i<count;i++){check(position+2<=data.length,'Truncated timed writes');const r=data[position++],v=data[position++];check(r<24,'Bad register');regs[r]=v;writes++;hash=(((hash<<1)|(hash>>>15))^(r<<8)^v)&65535;}}
   records++;if(!done)header();
  }check(records===target,'Target after end');return{records,writes,loops,hash,regs:Buffer.from(regs),due,done};},get due(){return due;}};
}
