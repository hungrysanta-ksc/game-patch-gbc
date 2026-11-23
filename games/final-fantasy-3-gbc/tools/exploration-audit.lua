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
