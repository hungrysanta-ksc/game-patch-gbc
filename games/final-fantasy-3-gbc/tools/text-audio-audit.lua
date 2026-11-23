-- Read-only observer installed AFTER initial map/object loading, BEFORE restart.
-- Substitution only supplies the pinned ROM's symbol address, never outcomes.
local mem=emu.memType.gameboyDebug
local writes,bad,off,apuhash,apuwrites,maxly=0,0,0,0,0,0
local dma,baddma=0,0
local function video(address,value)
  writes=writes+1
  local ly=emu.read(0xff44,mem)
  if ly>maxly then maxly=ly end
  if (emu.read(0xff41,mem)&3)~=1 then bad=bad+1 end
end
emu.addMemoryCallback(video,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(video,emu.callbackType.write,0xff69,0xff69,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 local ly=emu.read(0xff44,mem)
 dma=dma+1
 if ly<144 or ly>150 or (emu.read(0xff41,mem)&3)~=1 or value>7 then baddma=baddma+1 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value) if (value&128)==0 then off=off+1 end end,emu.callbackType.write,0xff40,0xff40,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 if emu.read(__IRQ_BUSY__,mem)~=0 then
  apuhash=(((apuhash<<1)|(apuhash>>15))~(((address-0xff10)<<8)|value))&65535
  apuwrites=apuwrites+1
 end
end,emu.callbackType.write,0xff10,0xff23,emu.cpuType.gameboy)
emu.addEventCallback(function() emu.log(string.format("audit:%d,%d,%d,%d,%d,%d,%d,%d",writes,bad,off,apuhash,apuwrites,maxly,dma,baddma)) end,emu.eventType.codeBreak)
