-- Read-only elapsed-cycle ledger. IRQ time belongs to the interrupted
-- category. No source/game memory writes and no ROM instrumentation.
local mem=emu.memType.gameboyDebug
local active,clock,start,rate,profile,request=false,0,0,0,0,0
local busy=false
local stack,returns,costs,lines={}, {}, {}, {}
local completed=0
local function byte(k) return emu.read(preparationAddresses[k],mem) end
local function charge()
 local t=emu.getState()
 if active then
  local kind=busy and 1 or (#stack>0 and stack[#stack].kind or 0)
  costs[kind]=(costs[kind] or 0)+t.masterClock-clock
 end
 clock=t.masterClock;rate=t.clockRate
 return t
end
local function finish()
 local t=charge()
 if #stack~=0 then error('Preparation escaped call boundary') end
 local frame=byte('frame')
 if preparationFrameBytes==2 then frame=frame+256*emu.read(preparationAddresses.frame+1,mem) end
 lines[#lines+1]=string.format('preparation:%d,%d,%d,%d,%d,%d,%d,%d,%d',profile,request,frame,t.masterClock-start,rate,costs[0] or 0,costs[1] or 0,costs[2] or 0,costs[3] or 0)
 completed=completed+1
 -- Mesen retains only 500 log entries. Batch complete records, without
 -- dropping the earliest profiles or changing emulated execution.
 if #lines==32 or completed==preparationExpected then emu.log(table.concat(lines,'\n'));lines={} end
 active=false
end
emu.addMemoryCallback(function(_,v)
 charge();busy=v~=0
end,emu.callbackType.write,preparationAddresses.busy,preparationAddresses.busy,emu.cpuType.gameboy)
for _,key in ipairs({'request','step'}) do
 -- Debugger injection can occur after the main-loop work flag was written.
 -- Begin at the CPU's first observation of a pending request, not at a
 -- later audio call/work flag which might miss the entire operation.
 emu.addMemoryCallback(function()
  if not active and (byte('request')~=0 or byte('step')~=0) then
   charge();active=true;start=clock;profile=byte('profile');request=byte('request')~=0 and 1 or 2;costs={};stack={};busy=byte('busy')~=0
  end
 end,emu.callbackType.read,preparationAddresses[key],preparationAddresses[key],emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v) if active and v==0 then finish() end end,emu.callbackType.write,preparationAddresses[key],preparationAddresses[key],emu.cpuType.gameboy)
end
for _,site in ipairs(preparationSites) do
 emu.addMemoryCallback(function()
  if not active or (site.bank~=0 and byte('bank')~=site.bank) then return end
  local t=charge();local sp=t['cpu.sp'];local ret=emu.read(sp,mem)+256*emu.read(sp+1,mem)
  stack[#stack+1]={kind=site.kind,sp=sp,ret=ret}
  if not returns[ret] then
   returns[ret]=true
   emu.addMemoryCallback(function()
    local top=stack[#stack];if not active or not top or top.ret~=ret then return end
    local s=emu.getState();local delta=(s['cpu.sp']-top.sp)&65535
    -- SDCC callees also discard their stack arguments before returning.
    if delta<2 or delta>16 then return end
    charge();stack[#stack]=nil
   end,emu.callbackType.exec,ret,ret,emu.cpuType.gameboy)
  end
 end,emu.callbackType.exec,site.pc,site.pc,emu.cpuType.gameboy)
end
