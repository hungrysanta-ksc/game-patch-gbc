-- Appended to text-audio-audit.lua; independent of the runtime's counters.
local fieldmem=emu.memType.gameboyDebug
local oamdmas,badoam,scrollwrites,badscroll,peak=0,0,0,0,0
emu.addMemoryCallback(function(address,value)
 oamdmas=oamdmas+1
 local ly=emu.read(0xff44,fieldmem)
 if ly<144 or ly>150 or (emu.read(0xff41,fieldmem)&3)~=1 or (value~=0xc0 and value~=0xdc) then badoam=badoam+1 end
 local lines={}
 for i=0,39 do
  local y=emu.read(value*256+i*4,fieldmem)-16
  for row=y,y+7 do if row>=0 and row<144 then lines[row]=(lines[row] or 0)+1 end end
 end
 for _,count in pairs(lines) do if count>peak then peak=count end end
end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 scrollwrites=scrollwrites+1
 if (emu.read(0xff41,fieldmem)&3)~=1 then badscroll=badscroll+1 end
end,emu.callbackType.write,0xff42,0xff43,emu.cpuType.gameboy)
emu.addEventCallback(function() emu.log(string.format("field-audit:%d,%d,%d,%d,%d",oamdmas,badoam,scrollwrites,badscroll,peak)) end,emu.eventType.codeBreak)

-- Wall-clock guest cycles from preparation entry to the actual SCX commit,
-- including the asynchronous VBlank wait. Do not count only CPU preparation.
local startClock=nil
local latencyCount,latencyMax,latencySum,latencyBad=0,0,0,0
local latencyBins={}
emu.addMemoryCallback(function(address,value)
 if value==1 then
  if startClock~=nil then latencyBad=latencyBad+1 end
  startClock=emu.getState().masterClock
 end
end,emu.callbackType.write,__FIELD_RENDER_BUSY__,__FIELD_RENDER_BUSY__,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if startClock==nil then latencyBad=latencyBad+1;return end
 local delta=(state.masterClock-startClock)&0xffffffff
 local us=math.floor(delta*1000000/state.clockRate+0.5)
 local bin=math.ceil(us/1000)
 latencyBins[bin]=(latencyBins[bin] or 0)+1
 latencyCount=latencyCount+1;latencySum=latencySum+us
 if us>latencyMax then latencyMax=us end
 startClock=nil
end,emu.callbackType.write,0xff43,0xff43,emu.cpuType.gameboy)
emu.addEventCallback(function()
 local bins={};for i=1,1000 do if latencyBins[i] then table.insert(bins,i.."="..latencyBins[i]) end end
 emu.log(string.format("movement-latency:%d,%d,%d,%d;%s",latencyCount,latencyMax,latencySum,latencyBad,table.concat(bins,",")))
end,emu.eventType.codeBreak)

-- Observe the producer separately from display preparation. This includes
-- filling the existing lookahead, without altering the queue or guest clock.
local producerStart=nil
local producerCount,producerMax,producerSum,producerBad=0,0,0,0
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if value==1 then
  if producerStart~=nil then producerBad=producerBad+1 end
  producerStart=state.masterClock
 elseif producerStart~=nil then
  local us=math.floor(((state.masterClock-producerStart)&0xffffffff)*1000000/state.clockRate+0.5)
  producerStart=nil;producerCount=producerCount+1;producerSum=producerSum+us
  if us>producerMax then producerMax=us end
 end
end,emu.callbackType.write,__NATIVE_BUSY__,__NATIVE_BUSY__,emu.cpuType.gameboy)
emu.addEventCallback(function()
 emu.log(string.format("producer-time:%d,%d,%d,%d",producerCount,producerMax,producerSum,producerBad))
end,emu.eventType.codeBreak)
