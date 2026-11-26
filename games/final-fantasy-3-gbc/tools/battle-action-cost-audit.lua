-- Exclusive emulated wall time; read-only hooks, no changed ROM bytes.
do
 local mem=emu.memType.gameboyDebug
 local flags,active,clock,totals,counts={},false,0,{},{}
 local stack,refs={},{}
 local previous={}
 local display={}
 local oamOwner=nil
 local audioNames={'audio_packet','audio_vm','audio_output','audio_metadata','audio_control','audio_snapshot'}
 local function kind()
  if (flags.irq or 0)~=0 then return 'irq' end
  if (flags.audio or 0)~=0 then
   if actionAudioSites then return audioNames[(#stack>0 and stack[#stack].kind or 4)+1] end
   return 'audio'
  end
  if (flags.transfer or 0)~=0 then return 'transfer' end
  if (flags.publish or 0)~=0 then return 'publish' end
  if oamOwner then return oamOwner end
  return 'prepare'
 end
 local function charge(t)
  if active then local k=kind();totals[k]=(totals[k] or 0)+t.masterClock-clock end
  clock=t.masterClock
 end
 -- Optional interval attribution for automatic actions, not runtime probes.
 if actionOamSites then
  for _,site in ipairs(actionOamSites) do
   emu.addMemoryCallback(function()
    if not active or emu.read(actionOamBank,mem)~=site.bank then return end
    charge(emu.getState());if oamOwner then error('Nested OAM owner') end
    oamOwner=site.name;counts[oamOwner]=(counts[oamOwner] or 0)+1
   end,emu.callbackType.exec,site.at,site.at,emu.cpuType.gameboy)
   emu.addMemoryCallback(function()
    if not active or emu.read(actionOamBank,mem)~=site.bank then return end
    charge(emu.getState());if oamOwner~=site.name then error('Unpaired OAM owner') end;oamOwner=nil
   end,emu.callbackType.exec,site.finish,site.finish,emu.cpuType.gameboy)
  end
 end
 if actionCostFrames then
  if actionPublicationSite then
   emu.addMemoryCallback(function()
    if active and (flags.publish or 0)~=0 then
     display.attempts=display.attempts or {};display.attempts[#display.attempts+1]=emu.read(0xff44,mem)
    end
   end,emu.callbackType.exec,actionPublicationSite,actionPublicationSite,emu.cpuType.gameboy)
  end
  emu.addMemoryCallback(function(_,v)
   if active and (flags.publish or 0)~=0 then
    if display.dma then error('Repeated DMA before publication acknowledgement') end
    display.dma=emu.getState().masterClock;display.page=v;display.dmaLy=emu.read(0xff44,mem)
   end
  end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
  emu.addMemoryCallback(function(_,v)
   if not active then return end
   local t=emu.getState();charge(t)
   local fields={}
   for k,n in pairs(totals) do
    fields[#fields+1]=string.format('%s=%d',k,n-(previous[k] or 0))
    previous[k]=n
   end
   if not display.ready or not display.dma or not display.ack then error('Missing publication boundary') end
   emu.log(string.format('action-frame-cost:%d,%d,%s|display:%d,%d,%d,%d,%d|attempts:%s|lines:%d,%d',v,t.clockRate,table.concat(fields,','),display.ready,display.dma,display.ack,t.masterClock,display.page,table.concat(display.attempts or {},','),display.dmaLy,display.ackLy))
   display={}
  end,emu.callbackType.write,actionCostFrames,actionCostFrames,emu.cpuType.gameboy)
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
    if v~=0 and not active then active=true;totals={};counts={};previous={};display={};clock=t.masterClock;installAudio()
    elseif v==0 and active then
     if #stack~=0 then error('Action ended inside audio call') end
     if oamOwner then error('Action ended inside OAM preparation') end
     for k,n in pairs(totals) do emu.log(string.format('action-cost:%s,%d,%d,%d',k,n,t.clockRate,counts[k] or 0)) end
     active=false
     for _,r in ipairs(refs) do emu.removeMemoryCallback(r[1],emu.callbackType.exec,r[2],r[2],emu.cpuType.gameboy) end
     refs={}
    end
   elseif active and v~=0 and flags[name]==0 then counts[name]=(counts[name] or 0)+1 end
   if active and name=='publish' then
    if v~=0 then display={ready=t.masterClock}
    elseif (flags.publish or 0)~=0 then
     display.ack=t.masterClock;display.ackLy=emu.read(0xff44,mem)
     if display.dma and (emu.read(0xff44,mem)<144 or (emu.read(0xff41,mem)&3)~=1) then error('Publication completed outside VBlank') end
    end
   end
   flags[name]=v
  end,emu.callbackType.write,address,address,emu.cpuType.gameboy)
 end

end
