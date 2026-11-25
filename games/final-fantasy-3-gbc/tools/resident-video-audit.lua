local mem=emu.memType.gameboyDebug
local vram,dma,bad,maxLy=0,0,0,0
local patternBytes,mapBytes,badTransfers,scrollWrites=0,0,0,0
emu.addMemoryCallback(function()vram=vram+1 end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function()
 dma=dma+1
 local ly=emu.read(0xff44,mem)
 maxLy=math.max(maxLy,ly)
 if ly<144 or ly>150 or (emu.read(0xff41,mem)&3)~=1 then bad=bad+1 end
end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,value)
 local dest=0x8000+((emu.read(0xff53,mem)&31)*256)+(emu.read(0xff54,mem)&240)
 local bytes=((value&127)+1)*16
 if dest<0x9800 then patternBytes=patternBytes+bytes else mapBytes=mapBytes+bytes end
 local ly=emu.read(0xff44,mem)
 if ly<144 or ly>150 or (emu.read(0xff41,mem)&3)~=1 or (value&128)~=0 then badTransfers=badTransfers+1 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addMemoryCallback(function()scrollWrites=scrollWrites+1 end,emu.callbackType.write,0xff43,0xff43,emu.cpuType.gameboy)
emu.addEventCallback(function()
 emu.log(string.format('party-resident:%d,%d,%d,%d',vram,dma,bad,maxLy))
 emu.log(string.format('resident-bg:%d,%d,%d,%d',patternBytes,mapBytes,badTransfers,scrollWrites))
end,emu.eventType.codeBreak)
