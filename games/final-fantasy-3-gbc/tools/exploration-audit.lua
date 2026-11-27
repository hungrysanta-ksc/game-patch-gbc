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
-- Frame polling can observe a changed SCX up to one frame after the bus
-- write (and debugger IRQ-yield steps can cross a frame). Measure display
-- starvation at the actual SCY write that completes the scroll pair.
local gapLast,gapX,gapY=nil,nil,nil
local gapCount,gapMax=0,0
local gapBins={}
local function moving()
 return emu.read(__FIELD_RENDER_BUSY__-59,fieldmem)~=0 and emu.read(__FIELD_RENDER_BUSY__-45,fieldmem)==0 and emu.read(__FIELD_RENDER_BUSY__-37,fieldmem)==0
end
emu.addMemoryCallback(function(address,value)
 local x=emu.read(0xff43,fieldmem)
 if not moving() then gapLast=nil;gapX=x;gapY=value;return end
 if x~=gapX or value~=gapY then
  local s=emu.getState()
  if gapLast then
   local us=math.floor(((s.masterClock-gapLast)&0xffffffff)*1000000/s.clockRate+0.5)
   local bin=math.ceil(us/1000);gapBins[bin]=(gapBins[bin] or 0)+1;gapCount=gapCount+1;gapMax=math.max(gapMax,us)
  end
  gapLast=s.masterClock;gapX=x;gapY=value
 end
end,emu.callbackType.write,0xff42,0xff42,emu.cpuType.gameboy)
emu.addEventCallback(function()
 if not moving() then gapLast=nil end
 local bins={};for i=1,1000 do if gapBins[i] then bins[#bins+1]=i..'='..gapBins[i] end end
 emu.log(string.format('scroll-gap:%d,%d;%s',gapCount,gapMax,table.concat(bins,',')))
end,emu.eventType.codeBreak)
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
local producerEntry,producerEntryField,producerEntrySpeed,producerEntryMode
local producerSlow={}
local function counter(address,n)
 local value=0;for i=0,n-1 do value=value|(emu.read(address+i,fieldmem)<<(i*8)) end;return value
end
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if value==1 then
  if producerStart~=nil then producerBad=producerBad+1 end
  producerStart=state.masterClock
  producerEntry=counter(__NATIVE_TICKS__,4);producerEntryField=counter(__FIELD_RENDER_BUSY__-32,2)
  producerEntrySpeed=counter(__FIELD_RENDER_BUSY__-59,1);producerEntryMode=counter(__FIELD_RENDER_BUSY__-45,1)
 elseif producerStart~=nil then
  local us=math.floor(((state.masterClock-producerStart)&0xffffffff)*1000000/state.clockRate+0.5)
  producerStart=nil;producerCount=producerCount+1;producerSum=producerSum+us
  if us>producerMax then producerMax=us end
  if us>20000 then
   producerSlow[#producerSlow+1]={us=us,entry=producerEntry,finish=counter(__NATIVE_TICKS__,4),field=producerEntryField,speed=producerEntrySpeed,mode=producerEntryMode}
   table.sort(producerSlow,function(a,b)return a.us>b.us end);if #producerSlow>12 then table.remove(producerSlow) end
  end
 end
end,emu.callbackType.write,__NATIVE_BUSY__,__NATIVE_BUSY__,emu.cpuType.gameboy)
emu.addEventCallback(function()
 emu.log(string.format("producer-time:%d,%d,%d,%d",producerCount,producerMax,producerSum,producerBad))
 local rows={};for _,v in ipairs(producerSlow)do rows[#rows+1]=string.format('%d/%d/%d/%d/%d/%d',v.us,v.entry,v.finish,v.field,v.speed,v.mode) end
 emu.log('producer-profile:'..table.concat(rows,','))
end,emu.eventType.codeBreak)

-- Observe request-to-completion of background strips, including deferred VBlanks.
local stripStart,stripDirection=nil,0
local stripSlow={}
local stripCount,stripMax,stripSum,stripBad=0,0,0,0
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if value==1 then
  if stripStart~=nil then stripBad=stripBad+1 end
  stripStart=state.masterClock;stripDirection=emu.read(__FIELD_RENDER_BUSY__-60,fieldmem)
 elseif stripStart~=nil then
  local us=math.floor(((state.masterClock-stripStart)&0xffffffff)*1000000/state.clockRate+0.5)
  stripStart=nil;stripCount=stripCount+1;stripSum=stripSum+us;stripMax=math.max(stripMax,us)
  if us>20000 then stripSlow[#stripSlow+1]={us=us,direction=stripDirection};table.sort(stripSlow,function(a,b)return a.us>b.us end);if #stripSlow>8 then table.remove(stripSlow) end end
 end
end,emu.callbackType.write,__FIELD_RENDER_BUSY__+1,__FIELD_RENDER_BUSY__+1,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('strip-time:%d,%d,%d,%d',stripCount,stripMax,stripSum,stripBad));local rows={};for _,v in ipairs(stripSlow)do rows[#rows+1]=v.us..'/'..v.direction end;emu.log('strip-profile:'..table.concat(rows,','))end,emu.eventType.codeBreak)
