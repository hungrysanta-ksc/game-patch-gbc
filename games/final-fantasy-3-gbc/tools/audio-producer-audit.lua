-- CALL/hash boundaries include nested IRQ time. The outer observer owns
-- the request clock; instruction hooks cannot open an earlier interval.
do
 if not openingCostAudioBoundary then error('Missing shared audio cost clock') end
 audioProducerEnabled=true
 local stack={}
 for _,site in ipairs(audioProducerSites) do
  emu.addMemoryCallback(function()
   openingCostAudioBoundary(site.kind,true);stack[#stack+1]=site
  end,emu.callbackType.exec,site.at,site.at,emu.cpuType.gameboy)
  emu.addMemoryCallback(function()
   if #stack==0 or stack[#stack].at~=site.at then error('Audio producer return pairing') end
   stack[#stack]=nil;openingCostAudioBoundary(#stack>0 and stack[#stack].kind or 4,false)
  end,emu.callbackType.exec,site.finish,site.finish,emu.cpuType.gameboy)
 end
 emu.addMemoryCallback(function(a,v)
  if v==0 and #stack~=0 then error('Audio producer escaped call boundary') end
 end,emu.callbackType.write,audioProducerBusy,audioProducerBusy,emu.cpuType.gameboy)
end
