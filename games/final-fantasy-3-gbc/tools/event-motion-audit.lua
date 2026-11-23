-- Read-only command/pixel boundaries, including the command hidden by a window.
local function hex(a,n)
 local t={} for i=0,n-1 do t[#t+1]=string.format('%02x',emu.read(a+i,emu.memType.gameboyDebug)) end return table.concat(t)
end
local function snapshot()
 return hex(__FIELD__,76)..':'..hex(__PART1__,192)..':'..hex(__PART2__,192)..':'..hex(__EXECUTION__,5)..':'..hex(__PC__,2)..':'..hex(__ACTIVE__,1)..':'..hex(__TEXT_ID__,2)..':'..hex(__VISIBLE__,1)
end
local before,kind,count,clock=nil,0,0,0
emu.addMemoryCallback(function(a,v)
 if v~=0 then before=snapshot();kind=v;clock=emu.getState().masterClock
 elseif before~=nil then local t=emu.getState();count=count+1;emu.log('event-step:'..count..':'..kind..':'..before..':'..snapshot()..':'..clock..':'..t.masterClock..':'..t.clockRate);before=nil end
end,emu.callbackType.write,__EVENT_BUSY__,__EVENT_BUSY__,emu.cpuType.gameboy)
