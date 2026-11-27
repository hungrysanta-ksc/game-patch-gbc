import {check} from './source.mjs';
// Independent dependency observation. Physical memory types are pinned to the
// same MesenCore as the existing VRAM/screenshot verifier (39=GbWorkRam).
export function freezeReuseAudit(s){
 for(const k of ['effect_freeze_stage','effect_freeze_reused','animation_base','resident_page','effect_keys','effect_palettes'])check(Number.isInteger(s[k]),'Reuse audit symbol '+k);
 return `
do
 local mem=emu.memType.gameboyDebug;local current,last=nil,nil;local hits,misses,bad=0,0,0
 local times,parts,prior={},nil,nil
 local function bytes(at,n,kind)local t={};for i=0,n-1 do t[#t+1]=emu.read(at+i,kind) end;return t end
 local function equal(a,b)if #a~=#b then bad=bad+1;return end;for i=1,#a do if a[i]~=b[i] then bad=bad+1 end end end
 local function snapshot()
  local r={oam=bytes(${s.animation_base},160,mem),palette=bytes(0,32,45),vram=bytes(0,16384,43),keys={},glyphs={},page=emu.read(${s.resident_page},mem)}
  for _,v in ipairs(bytes(0,64,46))do r.palette[#r.palette+1]=v end
  local have={};local glyphs={}
  for i=8,31 do
   local p=i*4+1;local y=r.oam[p];local t=r.oam[p+2]
   if y>=16 and y<112 and t~=0 then
    local x=r.oam[p+1]-8;y=y-16
    glyphs[((r.oam[p+3]>>3)&1)*256+t]=true
    for yy=y//8,(y+7)//8 do for xx=x//8,(x+7)//8 do local key=yy*32+xx;if not have[key]then have[key]=true;r.keys[#r.keys+1]=key end end end
   end
  end
  for _,key in ipairs(r.keys)do local at=6144+r.page*1024+key;local t=r.vram[at+1];local a=r.vram[8192+at+1];glyphs[((a>>3)&1)*256+t]=true end
  for key in pairs(glyphs)do r.glyphs[#r.glyphs+1]=key end
  return r
 end
 emu.addMemoryCallback(function(_,v)
  local t=emu.getState()
  if v==1 then parts={};prior={stage=v,clock=t.masterClock}
  elseif prior then parts[#parts+1]=string.format('%d:%d:%d',prior.stage,t.masterClock-prior.clock,t.clockRate);prior={stage=v,clock=t.masterClock}end
  if v==8 then times[#times+1]=table.concat(parts,',');prior=nil end
  if v==1 then current=snapshot();return end
  if v~=5 then return end
  if not current then error('Missing reuse input snapshot')end
  local n=#current.keys
  current.output=bytes(3*4096+2816,n*16,39);current.outputKeys=bytes(${s.effect_keys},n*2,mem);current.outputPalette=bytes(${s.effect_palettes}+32,32,mem)
  if emu.read(${s.effect_freeze_reused},mem)~=0 then
   hits=hits+1;if not last then error('Reuse without a built entry')end
   equal(current.oam,last.oam);equal(current.palette,last.palette);equal(current.output,last.output);equal(current.outputKeys,last.outputKeys);equal(current.outputPalette,last.outputPalette)
   for _,key in ipairs(last.keys)do for bank=0,1 do local a=bank*8192+6144+key;if current.vram[a+current.page*1024+1]~=last.vram[a+last.page*1024+1]then bad=bad+1 end end end
   for _,key in ipairs(last.glyphs)do local at=(key>>8)*8192+(key&255)*16;for i=1,16 do if current.vram[at+i]~=last.vram[at+i]then bad=bad+1 end end end
  else misses=misses+1;last=current end
  current=nil
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log(string.format('freeze-reuse:%d,%d,%d',hits,misses,bad));emu.log('freeze-time:'..table.concat(times,';'))end,emu.eventType.codeBreak)
end
`;}
export function freezeReuseResult(log,expected,hits){
 const r=[...log.matchAll(/freeze-reuse:(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);
 check(r&&r[0]+r[1]===expected&&r[0]===hits&&!r[2],'Exact reusable composition dependencies and output');
 const raw=[...log.matchAll(/freeze-time:([^\r\n]*)/g)].at(-1)?.[1];
 const phases=raw?raw.split(';').map(s=>Object.fromEntries(s.split(',').map(p=>{const [stage,ticks,rate]=p.split(':').map(Number);return [stage,ticks*1000/rate];}))):[];
 return {hits:r[0],misses:r[1],mismatches:r[2],phases};
}
