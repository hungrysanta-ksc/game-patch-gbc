-- Independent guest-clock measurement including timer IRQ time in the kernel.
local start=nil
local count,total,maximum,bad=0,0,0,0
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if value==1 then
  if start~=nil then bad=bad+1 end
  start=state.masterClock
 elseif start~=nil then
  local us=math.floor((state.masterClock-start)*1000000/state.clockRate+0.5)
  count=count+1;total=total+us;maximum=math.max(maximum,us);start=nil
 else bad=bad+1 end
end,emu.callbackType.write,__KERNEL_BUSY__,__KERNEL_BUSY__,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('kernel-time:%d,%d,%d,%d',count,total,maximum,bad))end,emu.eventType.codeBreak)
