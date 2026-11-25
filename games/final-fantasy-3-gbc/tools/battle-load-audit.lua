-- Test-only request injection at an exact consumed original music tick.
-- No audio state, time, source data, palette or display memory is altered.
local m=emu.memType.gameboyDebug
local fired,finished=false,false
local palettes,badPalettes,transfers,badTransfers,maxLy=0,0,0,0,0
emu.addMemoryCallback(function(_,v)
 if not fired and v==loadPhase and emu.read(loadAddresses.consumed+1,m)==0 and emu.read(loadAddresses.consumed+2,m)==0 and emu.read(loadAddresses.consumed+3,m)==0 then
  fired=true;emu.write(loadAddresses.profile,loadProfile,m);emu.write(loadAddresses.request,1,m)
  emu.log('load-trigger:'..loadProfile..','..loadPhase)
 end
end,emu.callbackType.write,loadAddresses.consumed,loadAddresses.consumed,emu.cpuType.gameboy)
for _,reg in ipairs({0xff69,0xff6b}) do
 emu.addMemoryCallback(function()
  if not fired or finished then return end
  local ly=emu.read(0xff44,m);palettes=palettes+1;maxLy=math.max(maxLy,ly)
  if ly<144 or ly>150 or (emu.read(0xff41,m)&3)~=1 then badPalettes=badPalettes+1 end
 end,emu.callbackType.write,reg,reg,emu.cpuType.gameboy)
end
emu.addMemoryCallback(function(_,v)
 if not fired or finished then return end
 local ly=emu.read(0xff44,m);transfers=transfers+((v&127)+1)*16
 if ly<144 or ly>150 or (emu.read(0xff41,m)&3)~=1 or (v&128)~=0 then badTransfers=badTransfers+1 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 if fired and not finished and v==0 then
  finished=true;emu.log(string.format('load-audit:%d,%d,%d,%d,%d',palettes,badPalettes,transfers,badTransfers,maxLy))
 end
end,emu.callbackType.write,loadAddresses.request,loadAddresses.request,emu.cpuType.gameboy)
