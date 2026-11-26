-- Read-only PPU access and completed-publication timing observations.
local m=emu.memType.gameboyDebug
local badRead,badWrite,badDma,dma=0,0,0,0
local function closed()return (emu.read(0xff40,m)&128)~=0 and (emu.read(0xff41,m)&3)==3 end
emu.addMemoryCallback(function()if closed() then badRead=badRead+1 end end,emu.callbackType.read,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function()if closed() then badWrite=badWrite+1 end end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function()
 dma=dma+1;local ly=emu.read(0xff44,m)
 if ly<144 or ly>150 or (emu.read(0xff41,m)&3)~=1 then badDma=badDma+1 end
end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
local records={}
emu.addMemoryCallback(function(_,v)
 if v==1 then local t=emu.getState();records[#records+1]=string.format('effect-ready:%d,%d,%d',emu.read(effectsFrameAddress,m)+1,t.masterClock,t.clockRate) end
end,emu.callbackType.write,effectsPendingAddress,effectsPendingAddress,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 if v==0 then records={} else
  local t=emu.getState();records[#records+1]=string.format('effect-frame:%d,%d,%d',v,t.masterClock,t.clockRate)
  if v==32 then emu.log(table.concat(records,'\n')) end
 end
end,emu.callbackType.write,effectsFrameAddress,effectsFrameAddress,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('effects-safety:%d,%d,%d,%d',badRead,badWrite,badDma,dma))end,emu.eventType.codeBreak)
