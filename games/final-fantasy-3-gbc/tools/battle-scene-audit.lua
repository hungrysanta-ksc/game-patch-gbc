-- Streaming mode: each map page selects its matching BG pattern bank.
-- The Korean window may borrow bank 1 only after normalization to page 0.
local mem=emu.memType.gameboyDebug
local writes,bad,palettes,badpalette=0,0,0,0
emu.addMemoryCallback(function(address,value)
 writes=writes+1
 local bank=emu.read(0xff4f,mem)&1
 local lcdc=emu.read(0xff40,mem)
 local active=(lcdc>>3)&1
 if address<0x8800 then
  if bank~=1 or ((address-0x8000)//1024)==active then bad=bad+1 end
 elseif address<0x9800 then
  if bank==active then bad=bad+1 end
 elseif address>=0x9800 then
  local page=(address-0x9800)//1024
  local phase=emu.read(__SCENE_PHASE__,mem)
  if page==active or (page==1 and (lcdc&32)~=0 and phase~=5 and phase~=6 and phase~=7) then bad=bad+1 end
 end
end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 palettes=palettes+1
 if (emu.read(0xff41,mem)&3)~=1 then badpalette=badpalette+1 end
end,emu.callbackType.write,0xff6b,0xff6b,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('scene-residency:%d,%d,%d,%d',writes,bad,palettes,badpalette))end,emu.eventType.codeBreak)
