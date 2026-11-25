local mem=emu.memType.gameboyDebug
local vram,dma,bad,maxLy=0,0,0,0
local patternBytes,mapBytes,badTransfers,scrollWrites=0,0,0,0
local enemyWrites,badRaster,terrainWrites=0,0,0
-- HDMA1..4 are write-only. Mirror writes instead of reading back FF.
local destinationHi,destinationLo=0,0
emu.addMemoryCallback(function(_,value) destinationHi=value&31 end,emu.callbackType.write,0xff53,0xff53,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,value) destinationLo=value&240 end,emu.callbackType.write,0xff54,0xff54,emu.cpuType.gameboy)
emu.addMemoryCallback(function()vram=vram+1 end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function()
 dma=dma+1
 local ly=emu.read(0xff44,mem)
 maxLy=math.max(maxLy,ly)
 if ly<144 or ly>150 or (emu.read(0xff41,mem)&3)~=1 then bad=bad+1 end
end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,value)
 local dest=0x8000+destinationHi*256+destinationLo
 local bytes=((value&127)+1)*16
 if dest<0x9800 then
  patternBytes=patternBytes+bytes
  if (emu.read(0xff4f,mem)&1)~=1 or dest<0x8820 or dest+bytes>0x8960 then enemyWrites=enemyWrites+bytes else terrainWrites=terrainWrites+bytes end
 else mapBytes=mapBytes+bytes end
 local ly=emu.read(0xff44,mem)
 if ly<144 or ly>150 or (emu.read(0xff41,mem)&3)~=1 or (value&128)~=0 then badTransfers=badTransfers+1 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addMemoryCallback(function()
 scrollWrites=scrollWrites+1
 local ly=emu.read(0xff44,mem)
 if ly<144 and (ly<11 or ly>=16) then badRaster=badRaster+1 end
end,emu.callbackType.write,0xff43,0xff43,emu.cpuType.gameboy)
emu.addEventCallback(function()
 emu.log(string.format('party-resident:%d,%d,%d,%d',vram,dma,bad,maxLy))
 emu.log(string.format('terrain:%d,%d,%d',enemyWrites,badRaster,terrainWrites))
 emu.log(string.format('resident-bg:%d,%d,%d,%d',patternBytes,mapBytes,badTransfers,scrollWrites))
end,emu.eventType.codeBreak)
