import fs from 'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';import{ROOT,input,hash,check}from'./source.mjs';
const{local}=await input(),report=JSON.parse(await fs.readFile(ROOT+'/build/audio/report.json')),noi=await fs.readFile(ROOT+'/build/audio/ff3-audio.noi','utf8'),run=promisify(execFile);
const symbol=n=>{const m=noi.match(new RegExp('DEF _'+(n==='packet'?'audio_packet':n)+' (0x[0-9a-f]+)','i'));check(m,'Missing symbol '+n);return Number(m[1]);};
await fs.mkdir(ROOT+'/.local',{recursive:true});await fs.mkdir(ROOT+'/evidence/audio',{recursive:true});
const dll=local.mesenCore,dotnet=local.dotnet||'dotnet',capture=ROOT+'/tools/Capture/bin/Release/net8.0/Capture.dll';
const selected=process.argv.indexOf('--clip'),clips=report.clips.filter(c=>selected<0||c.key===process.argv[selected+1]);
const results=[];
check(clips.length>0,'Unknown clip');
for(const clip of clips){
 const settled=await Promise.allSettled(['nes','gbc'].map(async system=>{
  const wav=ROOT+'/evidence/audio/'+clip.key+'-'+system+'.wav',config={dll,rom:ROOT+'/build/audio/'+(system==='nes'?clip.key+'.nes':'ff3-audio.gbc'),home:ROOT+'/.local/mesen-'+system,wav,cpu:system==='nes'?8:7,ready:system==='nes'?0x6000:symbol('audio_ready'),request:system==='nes'?0x6001:symbol('audio_request'),counter:system==='nes'?0x6002:symbol('audio_tick'),packet:system==='nes'?0:symbol('packet'),selection:system==='nes'?1:report.clips.findIndex(c=>c.key===clip.key)+1,frames:clip.frames,busy:system==='nes'?0x6007:symbol('audio_busy')};
  const file=ROOT+'/.local/capture-'+system+'.json';await fs.writeFile(file,JSON.stringify(config));try{const r=await run(dotnet,[capture,file],{cwd:ROOT,timeout:240000,maxBuffer:8e6});await fs.writeFile(wav+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(wav+'.log',(e.stdout||'')+(e.stderr||'')+'\n'+e.message);throw e;}
  const actual=JSON.parse(await fs.readFile(wav+'.json')),expected=await fs.readFile(ROOT+'/build/audio/'+clip.key+(system==='nes'?'-states.bin':'-packets.bin'));let compared=0;
  for(const s of actual.frames){if(!s.tick)continue;const b=Buffer.from(s.hex,'hex'),size=system==='nes'?192:12,n=system==='nes'?192:11,e=expected.subarray((s.tick-1)*size,(s.tick-1)*size+n);check(b.subarray(0,n).equals(e),`${clip.key}/${system} tick ${s.tick} runtime differs from generated data`);compared++;}
  check(actual.sourceTicks===clip.frames,'Truncated playback');return {system,key:clip.key,observations:compared,sourceTicks:actual.sourceTicks,emulatedFrames:actual.endFrame-actual.firstFrame,wavSha256:hash(await fs.readFile(wav)),bytes:(await fs.stat(wav)).size};
 }));for(const r of settled)if(r.status==='rejected')throw r.reason;const pair=settled.map(r=>r.value);results.push(...pair);console.log(JSON.stringify(pair));
}
await fs.writeFile(ROOT+'/evidence/audio/capture-'+(selected<0?'all':process.argv[selected+1])+'.json',JSON.stringify({sourceSha256:report.sourceSha256,romSha256:report.romSha256,mesenCoreSha256:hash(await fs.readFile(dll)),results},null,2));
