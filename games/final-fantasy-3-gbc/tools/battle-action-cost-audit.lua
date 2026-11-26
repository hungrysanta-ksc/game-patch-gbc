-- Exclusive emulated wall time; read-only hooks, no changed ROM bytes.
do
 local mem=emu.memType.gameboyDebug
 local flags,active,clock,totals,counts={},false,0,{},{}
 local stack,refs={},{}
 local audioNames={'audio_packet','audio_vm','audio_output','audio_metadata','audio_control','audio_snapshot'}
 local function kind()
  if (flags.irq or 0)~=0 then return 'irq' end
  if (flags.audio or 0)~=0 then
   if actionAudioSites then return audioNames[(#stack>0 and stack[#stack].kind or 4)+1] end
   return 'audio'
  end
  if (flags.transfer or 0)~=0 then return 'transfer' end
  if (flags.publish or 0)~=0 then return 'publish' end
  return 'prepare'
 end
 local function charge(t)
  if active then local k=kind();totals[k]=(totals[k] or 0)+t.masterClock-clock end
  clock=t.masterClock
 end
 local function installAudio()
 if actionAudioSites then
  for _,site in ipairs(actionAudioSites) do
   local enter=emu.addMemoryCallback(function()
    if not active then return end
    charge(emu.getState());stack[#stack+1]=site
    if active then local k=audioNames[site.kind+1];counts[k]=(counts[k] or 0)+1 end
   end,emu.callbackType.exec,site.at,site.at,emu.cpuType.gameboy)
   local leave=emu.addMemoryCallback(function()
    if not active then return end
    charge(emu.getState())
    if #stack==0 or stack[#stack].at~=site.at then error('Action audio boundary pairing') end
    stack[#stack]=nil
   end,emu.callbackType.exec,site.finish,site.finish,emu.cpuType.gameboy)
   refs[#refs+1]={enter,site.at};refs[#refs+1]={leave,site.finish}
  end
 end
 end
 for name,address in pairs(actionCostAddresses) do
  flags[name]=emu.read(address,mem)
  emu.addMemoryCallback(function(_,v)
   local t=emu.getState();charge(t)
   if name=='active' then
    if v~=0 and not active then active=true;totals={};counts={};clock=t.masterClock;installAudio()
    elseif v==0 and active then
     if #stack~=0 then error('Action ended inside audio call') end
     for k,n in pairs(totals) do emu.log(string.format('action-cost:%s,%d,%d,%d',k,n,t.clockRate,counts[k] or 0)) end
     active=false
     for _,r in ipairs(refs) do emu.removeMemoryCallback(r[1],emu.callbackType.exec,r[2],r[2],emu.cpuType.gameboy) end
     refs={}
    end
   elseif active and v~=0 and flags[name]==0 then counts[name]=(counts[name] or 0)+1 end
   flags[name]=v
  end,emu.callbackType.write,address,address,emu.cpuType.gameboy)
 end

end
