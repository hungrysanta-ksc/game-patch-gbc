local mem=emu.memType.gameboyDebug
local vram,dma,bad,maxLy=0,0,0,0
emu.addMemoryCallback(function()vram=vram+1 end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function()
 dma=dma+1
 local ly=emu.read(0xff44,mem)
 maxLy=math.max(maxLy,ly)
 -- The foreground gate is checked earlier than the actual DMA write.
 -- Require the measured transfer to start with several VBlank lines left.
 if ly<144 or ly>150 or (emu.read(0xff41,mem)&3)~=1 then bad=bad+1 end
end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('party-resident:%d,%d,%d,%d',vram,dma,bad,maxLy))end,emu.eventType.codeBreak)
