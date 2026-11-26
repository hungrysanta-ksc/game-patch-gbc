-- Exclusive emulated wall time; read-only hooks, no changed ROM bytes.
do
 local mem=emu.memType.gameboyDebug
 local flags,active,clock,totals,counts={},false,0,{},{}
 local function kind()
  if (flags.irq or 0)~=0 then return 'irq' end
  if (flags.audio or 0)~=0 then return 'audio' end
  if (flags.transfer or 0)~=0 then return 'transfer' end
  if (flags.publish or 0)~=0 then return 'publish' end
  return 'prepare'
 end
 local function charge(t)
  if active then local k=kind();totals[k]=(totals[k] or 0)+t.masterClock-clock end
  clock=t.masterClock
 end
 for name,address in pairs(actionCostAddresses) do
  flags[name]=emu.read(address,mem)
  emu.addMemoryCallback(function(_,v)
   local t=emu.getState();charge(t)
   if name=='active' then
    if v~=0 and not active then active=true;totals={};counts={};clock=t.masterClock
    elseif v==0 and active then
     for k,n in pairs(totals) do emu.log(string.format('action-cost:%s,%d,%d,%d',k,n,t.clockRate,counts[k] or 0)) end
     active=false
    end
   elseif active and v~=0 and flags[name]==0 then counts[name]=(counts[name] or 0)+1 end
   flags[name]=v
  end,emu.callbackType.write,address,address,emu.cpuType.gameboy)
 end
end
