-- Read-only bus observer. Symbols are supplied by the exact linked ROM.
local mem=emu.memType.gameboyDebug
local writes,bad,dma,badDma,off,badOff,apu,apuHash,foreignApu=0,0,0,0,0,0,0,0,0
local started=false
local function read(a)return emu.read(a,mem)end
emu.addMemoryCallback(function(_,v)
 if not started and v==0 and read(sym.native_request)==255 and read(sym.native_irq_busy)==0 then started=true end
end,emu.callbackType.write,sym.native_clock,sym.native_clock,emu.cpuType.gameboy)
local function video(a,v)
 writes=writes+1
 if (read(0xff40)&128)~=0 and (read(0xff41)&3)~=1 then bad=bad+1 end
end
emu.addMemoryCallback(video,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(video,emu.callbackType.write,0xff69,0xff69,emu.cpuType.gameboy)
emu.addMemoryCallback(video,emu.callbackType.write,0xff6b,0xff6b,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 dma=dma+1;local ly=read(0xff44)
 if (read(0xff40)&128)~=0 and (ly<144 or ly>150 or (read(0xff41)&3)~=1) then badDma=badDma+1 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 if (v&128)==0 then off=off+1;local phase=read(sym.scene_phase);if phase~=2 and phase~=4 then badOff=badOff+1 end end
end,emu.callbackType.write,0xff40,0xff40,emu.cpuType.gameboy)
emu.addMemoryCallback(function(a,v)
 if started then
  if read(sym.native_irq_busy)~=0 then apu=apu+1;apuHash=(((apuHash<<1)|(apuHash>>15))~(((a-0xff10)<<8)|v))&65535
  elseif read(sym.native_request)~=255 then foreignApu=foreignApu+1 end
 end
end,emu.callbackType.write,0xff10,0xff23,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('roundtrip-bus:%d,%d,%d,%d,%d,%d,%d,%d,%d',writes,bad,dma,badDma,off,badOff,apu,apuHash,foreignApu))end,emu.eventType.codeBreak)
