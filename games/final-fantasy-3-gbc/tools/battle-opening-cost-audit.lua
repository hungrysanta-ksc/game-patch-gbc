-- Exclusive wall-clock attribution, not pure instruction profiling. Audio
-- service includes interrupts occurring inside it; transfer wait excludes
-- that service and includes DMA/IRQ overhead. No emulated bytes are changed.
do
 local mem=emu.memType.gameboyDebug
 local flags={busy=0,transfer=0,publish=0,phase=0,request=0}
 local totals,clock,rate,run={},nil,0,0
 local audioTotals,audioCounts,audioKind={}, {},4
 local function charge(allowStart)
  local t=emu.getState()
  -- Debugger requests bypass CPU write callbacks. Observe their first
  -- subsequent boundary; only CPU writes can finish a caller request.
  if allowStart~=false and flags.request==0 and emu.read(openingCostAddresses.request,mem)~=0 then
   run=run+1;totals={};audioTotals={};audioCounts={};flags.request=emu.read(openingCostAddresses.request,mem);clock=t.masterClock
  end
  if clock and flags.request~=0 then
   local kind=flags.busy~=0 and 1 or flags.transfer~=0 and 2 or flags.publish~=0 and 3 or
    (flags.phase==1 or flags.phase==2 or flags.phase==3 or flags.phase==9) and 4 or flags.phase==10 and 5 or flags.phase==8 and 6 or 7
   local key=flags.phase*10+kind
   totals[key]=(totals[key] or 0)+t.masterClock-clock
   if flags.busy~=0 then audioTotals[audioKind]=(audioTotals[audioKind] or 0)+t.masterClock-clock end
  end
  clock=t.masterClock;rate=t.clockRate
 end
 -- Both ledgers share the same request boundaries. Extra instruction hooks
 -- may split an interval but cannot start it before the existing observer.
 openingCostAudioBoundary=function(kind,count)
  charge(false);audioKind=kind
  if count and flags.request~=0 then audioCounts[kind]=(audioCounts[kind] or 0)+1 end
 end
 for name,address in pairs(openingCostAddresses) do
  flags[name]=emu.read(address,mem)
  emu.addMemoryCallback(function(a,v)
   charge()
   if name=='request' and v==0 and flags.request~=0 then
    for key,cycles in pairs(totals) do emu.log(string.format('opening-cost:%d,%d,%d,%d',run,key,cycles,rate)) end
    if audioProducerEnabled then for kind,cycles in pairs(audioTotals) do emu.log(string.format('audio-cost:%d,%d,%d,%d,%d',run,kind,cycles,rate,audioCounts[kind] or 0)) end end
   end
   flags[name]=v
  end,emu.callbackType.write,address,address,emu.cpuType.gameboy)
 end
end
