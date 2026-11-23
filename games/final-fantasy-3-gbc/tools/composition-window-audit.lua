-- Active display writes must remain protected during composition and text.
local mem=emu.memType.gameboyDebug
local writes,bad,palettes,badpalette=0,0,0,0
emu.addMemoryCallback(function(address,value)
 writes=writes+1
 local bank=emu.read(0xff4f,mem)&1
 local lcdc=emu.read(0xff40,mem)
 local active=(lcdc>>3)&1
 if address<0x8800 and bank==1 then
  if ((address-0x8000)//1024)==active then bad=bad+1 end
 elseif address>=0x9000 and address<0x9800 then
  if bank==0 then
   if (emu.read(__SCENE_PINS__+(address-0x9000)//16,mem)&1)~=0 then bad=bad+1 end
  elseif (lcdc&32)~=0 then bad=bad+1 end
 elseif address>=0x9800 then
  local page=(address-0x9800)//1024
  if page==active or (page==1 and (lcdc&32)~=0) then bad=bad+1 end
 else bad=bad+1 end
end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 palettes=palettes+1
 if (emu.read(0xff41,mem)&3)~=1 then badpalette=badpalette+1 end
end,emu.callbackType.write,0xff6b,0xff6b,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('scene-residency:%d,%d,%d,%d',writes,bad,palettes,badpalette))end,emu.eventType.codeBreak)
