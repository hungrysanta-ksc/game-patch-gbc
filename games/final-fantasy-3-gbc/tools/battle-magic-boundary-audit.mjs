import {check} from './source.mjs';
// Read-only wall-clock boundaries, including nested audio and VBlank waits.
// Keep the entire trace in one log entry so Mesen's log ring cannot evict it.
export function magicBoundaryAudit(s){
 for(const k of ['animation_video_frames','magic_prepare_ahead','magic_prepare_stage','action_enabled','native_busy','native_irq_busy'])check(Number.isInteger(s[k]),'Magic boundary symbol '+k);
 return `
do
 local active=false;local marks={};local mem=emu.memType.gameboyDebug
 local scan=nil;local audio=emu.read(${s.native_busy},mem);local irq=emu.read(${s.native_irq_busy},mem)
 local function charge()
  if not scan then return end
  local t=emu.getState();local kind=irq~=0 and 'irq' or audio~=0 and 'audio' or 'cpu'
  scan[kind]=scan[kind]+t.masterClock-scan.clock;scan.clock=t.masterClock
 end
 emu.addMemoryCallback(function(_,v)charge();audio=v;if scan and v~=0 then scan.calls=scan.calls+1 end end,emu.callbackType.write,${s.native_busy},${s.native_busy},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)charge();irq=v end,emu.callbackType.write,${s.native_irq_busy},${s.native_irq_busy},emu.cpuType.gameboy)
 local function mark(name,v)
  local t=emu.getState()
  marks[#marks+1]=string.format('magic-boundary:%s,%d,%d,%d,%d,%d',name,v,t.masterClock,t.clockRate,emu.read(${s.animation_video_frames},mem),emu.read(${s.magic_prepare_ahead},mem))
 end
 emu.addMemoryCallback(function(_,v)
  if v==0 and not active then return end
  if v~=0 then active=true end
  mark('active',v)
  if v==0 then active=false;emu.log(table.concat(marks,'\\n'));marks={} end
 end,emu.callbackType.write,${s.action_enabled},${s.action_enabled},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)
  if not active then return end
  if v==3 then
   if scan then error('Nested scanline measurement') end
   local t=emu.getState();scan={clock=t.masterClock,start=t.masterClock,rate=t.clockRate,cpu=0,audio=0,irq=0,calls=0,frame=emu.read(${s.animation_video_frames},mem),ahead=emu.read(${s.magic_prepare_ahead},mem)}
  elseif v==4 then
   if not scan then error('Missing scanline start') end;charge()
   marks[#marks+1]=string.format('magic-capacity:%d,%d,%d,%d,%d,%d,%d,%d',scan.frame,scan.ahead,scan.clock-scan.start,scan.cpu,scan.audio,scan.irq,scan.calls,scan.rate);scan=nil
  end
  mark('stage',v)
 end,emu.callbackType.write,${s.magic_prepare_stage},${s.magic_prepare_stage},emu.cpuType.gameboy)
end
`;}
export function magicBoundaryResult(audit,lastPublication){
 const rows=[...audit.matchAll(/magic-boundary:(active|stage),(\d+),(\d+),(\d+),(\d+),(\d+)/g)].map(m=>({kind:m[1],value:+m[2],clock:+m[3],rate:+m[4],frame:+m[5],ahead:+m[6]}));
 const end=rows.findLast(r=>r.kind==='active'&&r.value===0),pictures=[];
 check(end&&end.clock>=lastPublication,'Magic restoration boundary');
 for(let i=0;i<rows.length;i++){
  const r=rows[i];if(r.kind!=='stage'||r.value!==1||r.ahead)continue;
  const stages=rows.slice(i,i+6);check(stages.length===6&&stages.every((x,j)=>x.kind==='stage'&&x.value===[1,2,3,4,5,0][j]&&x.rate===r.rate&&(j===0||x.clock>=stages[j-1].clock)),'Synchronous picture boundaries');
  const ms=(a,b)=>(stages[b].clock-stages[a].clock)*1000/r.rate;
  pictures.push({afterFrame:r.frame,sourceMs:ms(0,1),projectionMs:ms(1,2),capacityMs:ms(2,3),commitAndWaitMs:ms(4,5),totalMs:ms(0,5)});
 }
 const capacity=[...audit.matchAll(/magic-capacity:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/g)].map(m=>{
  const [frame,ahead,wall,cpu,audio,irq,calls,rate]=m.slice(1).map(Number);check(wall===cpu+audio+irq&&rate>0,'Exclusive scanline costs');
  return {afterFrame:frame,ahead,wallMs:wall*1000/rate,cpuMs:cpu*1000/rate,audioMs:audio*1000/rate,irqMs:irq*1000/rate,audioCalls:calls};
 });
 check(capacity.length===rows.filter(r=>r.kind==='stage'&&r.value===4).length,'Every scanline cost');
 return {synchronousPictures:pictures,capacity,tailAfterLastPublicationMs:(end.clock-lastPublication)*1000/end.rate,scope:'Picture stages include nested audio/waits. Capacity partitions wall time into foreground CPU, audio service excluding IRQ, and IRQ.'};
}
