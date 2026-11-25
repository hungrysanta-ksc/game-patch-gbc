-- Test-only request injection at an exact consumed original music tick.
-- No audio state, time, source data, palette or display memory is altered.
local m=emu.memType.gameboyDebug
local fired,finished=false,false
local mapped,saved,entry,entrySp,mapWrites=false,0,0,0,0
local romDmas,pairs,bankFaults,irqFaults,sourceFaults,maxDmaBytes,maxMapped=0,0,0,0,0,0,0
local hardware=emu.read(loadAddresses.bank,m)
local sourceHi,sourceLo,destHi,destLo=0,0,0,0
local dmaEntry,dmaActive,dmaPairs,dmaFaults,maxDmaSeconds=0,false,0,0,0
if loadDmaBegin then
 emu.addMemoryCallback(function()
  if not fired or finished then return end
  local t=emu.getState();if dmaActive or t['cpu.ime'] then dmaFaults=dmaFaults+1 end
  dmaActive=true;dmaEntry=t.masterClock
 end,emu.callbackType.exec,loadDmaBegin,loadDmaBegin,emu.cpuType.gameboy)
 emu.addMemoryCallback(function()
  if not fired or finished then return end
  local t=emu.getState();local duration=(t.masterClock-dmaEntry+256)/t.clockRate
  -- Conservatively include surrounding ready()/critical prologue/epilogue.
  if not dmaActive or t['cpu.ime'] or t.clockRate~=8388608 or duration>=1/4096 or (emu.read(0xff41,m)&3)~=1 or emu.read(0xff44,m)>152 then dmaFaults=dmaFaults+1 end
  maxDmaSeconds=math.max(maxDmaSeconds,duration);dmaPairs=dmaPairs+1;dmaActive=false
 end,emu.callbackType.exec,loadDmaEnd,loadDmaEnd,emu.cpuType.gameboy)
end
emu.addMemoryCallback(function(_,v)
 hardware=v
 if mapped then
  mapWrites=mapWrites+1
  if mapWrites==2 then
   local t=emu.getState();local duration=(t.masterClock-entry+16)/t.clockRate
   if t['cpu.ime'] or t['cpu.sp']~=entrySp or v~=saved or emu.read(loadAddresses.bank,m)~=saved or duration>=1/4096 then bankFaults=bankFaults+1 end
   maxMapped=math.max(maxMapped,duration);pairs=pairs+1;mapped=false
  end
 end
end,emu.callbackType.write,0x2000,0x2000,emu.cpuType.gameboy)
for _,r in ipairs({0xff51,0xff52,0xff53,0xff54}) do
 emu.addMemoryCallback(function(a,v)
  if a==0xff51 then sourceHi=v elseif a==0xff52 then sourceLo=v&240 elseif a==0xff53 then destHi=v&31 else destLo=v&240 end
 end,emu.callbackType.write,r,r,emu.cpuType.gameboy)
end
if loadRomBegin then
 emu.addMemoryCallback(function()
  if not fired or finished then return end
  local t=emu.getState();if t['cpu.ime']==nil then error('Missing IME') end
  saved=emu.read(loadAddresses.bank,m)
  if mapped or t['cpu.ime'] or hardware~=saved then bankFaults=bankFaults+1 end
  mapped=true;mapWrites=0;entry=t.masterClock;entrySp=t['cpu.sp']
 end,emu.callbackType.exec,loadRomBegin,loadRomBegin,emu.cpuType.gameboy)

end
for _,vector in ipairs({0x40,0x48,0x50,0x58,0x60}) do
 emu.addMemoryCallback(function() if mapped then irqFaults=irqFaults+1 end end,emu.callbackType.exec,vector,vector,emu.cpuType.gameboy)
end
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
 local ly=emu.read(0xff44,m);local n=((v&127)+1)*16;transfers=transfers+n;maxDmaBytes=math.max(maxDmaBytes,n)
 local source=sourceHi*256+sourceLo;local dest=0x8000+destHi*256+destLo
 if source<0x8000 then
  romDmas=romDmas+1;local ok=false
  for _,r in ipairs(loadRomRanges) do
   if hardware==r.bank and source>=r.start and source+n<=r.start+r.count and dest==0x8000+source-r.start and (emu.read(0xff4f,m)&1)==r.vram then ok=true end
  end
  if not mapped or not ok then sourceFaults=sourceFaults+1 end
 end
 if ly<144 or ly>150 or (emu.read(0xff41,m)&3)~=1 or (v&128)~=0 then badTransfers=badTransfers+1 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 if fired and not finished and v==0 then
  if mapped then bankFaults=bankFaults+1 end
  if dmaActive then dmaFaults=dmaFaults+1 end
  emu.log(string.format('load-dma:%d,%d,%.9f',dmaPairs,dmaFaults,maxDmaSeconds))
  emu.log(string.format('load-rom:%d,%d,%d,%d,%d,%d,%.9f',romDmas,pairs,bankFaults,irqFaults,sourceFaults,maxDmaBytes,maxMapped))
  finished=true;emu.log(string.format('load-audit:%d,%d,%d,%d,%d',palettes,badPalettes,transfers,badTransfers,maxLy))
 end
end,emu.callbackType.write,loadAddresses.request,loadAddresses.request,emu.cpuType.gameboy)
