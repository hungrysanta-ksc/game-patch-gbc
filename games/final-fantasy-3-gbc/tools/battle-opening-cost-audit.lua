-- Exclusive wall-clock attribution, not pure instruction profiling. Audio
-- service includes interrupts occurring inside it; transfer wait excludes
-- that service and includes DMA/IRQ overhead. No emulated bytes are changed.
do
 local mem=emu.memType.gameboyDebug
 local flags={busy=0,transfer=0,publish=0,phase=0,request=0}
 local totals,clock,rate,run={},nil,0,0
 local function charge()
  local t=emu.getState()
  -- Debugger requests bypass CPU write callbacks. Observe their first
  -- subsequent boundary; only CPU writes can finish a caller request.
  if flags.request==0 and emu.read(openingCostAddresses.request,mem)~=0 then
   run=run+1;totals={};flags.request=emu.read(openingCostAddresses.request,mem);clock=t.masterClock
  end
  if clock and flags.request~=0 then
   local kind=flags.busy~=0 and 1 or flags.transfer~=0 and 2 or flags.publish~=0 and 3 or
    (flags.phase==1 or flags.phase==2 or flags.phase==3 or flags.phase==9) and 4 or flags.phase==10 and 5 or flags.phase==8 and 6 or 7
   local key=flags.phase*10+kind
   totals[key]=(totals[key] or 0)+t.masterClock-clock
  end
  clock=t.masterClock;rate=t.clockRate
 end
 for name,address in pairs(openingCostAddresses) do
  flags[name]=emu.read(address,mem)
  emu.addMemoryCallback(function(a,v)
   charge()
   if name=='request' and v==0 and flags.request~=0 then
    for key,cycles in pairs(totals) do emu.log(string.format('opening-cost:%d,%d,%d,%d',run,key,cycles,rate)) end
   end
   flags[name]=v
  end,emu.callbackType.write,address,address,emu.cpuType.gameboy)
 end
end
