import {check} from './source.mjs';
// Read-only wall-clock boundaries, including nested audio and VBlank waits.
// Keep the entire trace in one log entry so Mesen's log ring cannot evict it.
export function magicBoundaryAudit(s){
 for(const k of ['animation_video_frames','magic_prepare_ahead','magic_prepare_stage','action_enabled'])check(Number.isInteger(s[k]),'Magic boundary symbol '+k);
 return `
do
 local active=false;local marks={};local mem=emu.memType.gameboyDebug
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
 emu.addMemoryCallback(function(_,v)if active then mark('stage',v)end end,emu.callbackType.write,${s.magic_prepare_stage},${s.magic_prepare_stage},emu.cpuType.gameboy)
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
 return {synchronousPictures:pictures,tailAfterLastPublicationMs:(end.clock-lastPublication)*1000/end.rate,scope:'Inclusive emulated wall time; includes nested audio and waits, not exclusive CPU cost.'};
}
