-- Observe active VRAM residency, independently of renderer counters.
local mem=emu.memType.gameboyDebug
local writes,bad,palettes,badpalette=0,0,0,0
emu.addMemoryCallback(function(address,value)
 writes=writes+1
 local bank=emu.read(0xff4f,mem)&1
 local active=(emu.read(0xff40,mem)>>3)&1
 if address<0x8800 then
  if bank==0 then
   local slot=(address-0x8000)//16
   if (emu.read(__CACHE_PINS__+slot,mem)&1)~=0 then bad=bad+1 end
  elseif ((address-0x8000)//1024)==active then bad=bad+1 end
 elseif address>=0x9800 then
  local page=(address-0x9800)//1024
  if page==active then bad=bad+1 end
 end
end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 palettes=palettes+1
 if (emu.read(0xff41,mem)&3)~=1 then badpalette=badpalette+1 end
end,emu.callbackType.write,0xff6b,0xff6b,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('cache-residency:%d,%d,%d,%d',writes,bad,palettes,badpalette))end,emu.eventType.codeBreak)
local phase,last,start=0,0,0
local times={0,0,0,0}
local summaries={}
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if phase>0 then times[phase]=times[phase]+math.floor((state.masterClock-start)*1000000/state.clockRate+0.5) end
 if value==1 then times={0,0,0,0};last=emu.read(__CACHE_PAGE__,mem) end
 phase=value;start=state.masterClock
 if value==0 then
  local s=summaries[last] or {0,0,0,0,0,0,0,0,0};s[1]=s[1]+1
  for i=1,4 do s[i+1]=s[i+1]+times[i];s[i+5]=math.max(s[i+5],times[i]) end
  summaries[last]=s
 end
end,emu.callbackType.write,__CACHE_PHASE__,__CACHE_PHASE__,emu.cpuType.gameboy)
emu.addEventCallback(function()
 for page=0,255 do local s=summaries[page];if s then emu.log('cache-stage-summary:'..page..','..table.concat(s,',')) end end
end,emu.eventType.codeBreak)
