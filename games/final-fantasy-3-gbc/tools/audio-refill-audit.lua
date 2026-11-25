-- Read-only service burst observations. Duration includes IRQ time. Rows
-- partition calls by entry phase and whether a transfer was pending.
do
 local mem=emu.memType.gameboyDebug
 local active,rows,run=nil,{},0
 local function byte(k) return emu.read(refillAddresses[k],mem) end
 local function word(k) local a=refillAddresses[k];return emu.read(a,mem)+256*emu.read(a+1,mem) end
 local function lead()
  local tail=byte('tail');if tail==byte('head') then return -32768 end
  local a=refillAddresses.queue+((tail-1)&15)*64
  local n=(emu.read(a,mem)+256*emu.read(a+1,mem)-word('clock'))&65535
  return n>=32768 and n-65536 or n
 end
 emu.addMemoryCallback(function(a,v)
  if v==1 and byte('request')~=0 then
   local t=emu.getState();active={clock=t.masterClock,key=byte('phase')+(byte('transfer')~=0 and 16 or 0),lead=lead(),profile=byte('profile'),step=byte('step')}
  elseif v==0 and active then
   local t=emu.getState();local elapsed=t.masterClock-active.clock
   local r=rows[active.key] or {count=0,total=0,max=-1}
   r.count=r.count+1;r.total=r.total+elapsed
   if elapsed>r.max then r.max=elapsed;r.before=active.lead;r.after=lead();r.profile=active.profile;r.step=active.step end
   rows[active.key]=r;active=nil
  end
 end,emu.callbackType.write,refillAddresses.busy,refillAddresses.busy,emu.cpuType.gameboy)
 emu.addMemoryCallback(function(a,v)
  if v==0 and next(rows) then
   if active then error('Refill request ended inside producer') end
   run=run+1
   for key,r in pairs(rows) do emu.log(string.format('refill-cost:%d,%d,%d,%d,%d,%d,%d,%d,%d',run,key,r.count,r.total,r.max,r.before,r.after,r.profile,r.step)) end
   rows={}
  end
 end,emu.callbackType.write,refillAddresses.request,refillAddresses.request,emu.cpuType.gameboy)
end
