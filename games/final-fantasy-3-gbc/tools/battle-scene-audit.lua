-- Streaming mode: each map page selects its matching BG pattern bank.
-- The Korean window may borrow bank 1 only after normalization to page 0.
local mem=emu.memType.gameboyDebug
local writes,bad,palettes,badpalette=0,0,0,0
local publications,badpublication=0,0
local criticalStart,criticalRate,criticalMax,criticalCount=nil,0,0,0
local numberFrames,numberStorageWrites=0,0
emu.addMemoryCallback(function()if emu.read(__SCENE_PHASE__,mem)==8 then numberStorageWrites=numberStorageWrites+1 end end,emu.callbackType.write,0x8000,0x9fff,emu.cpuType.gameboy)
for _,a in ipairs({0xff40,0xff69,0xff6b}) do
 emu.addMemoryCallback(function()if emu.read(__SCENE_PHASE__,mem)==8 then numberStorageWrites=numberStorageWrites+1 end end,emu.callbackType.write,a,a,emu.cpuType.gameboy)
end
emu.addMemoryCallback(function()if emu.read(__SCENE_PHASE__,mem)==8 then numberFrames=numberFrames+1 end end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('number-storage:%d,%d',numberFrames,numberStorageWrites))end,emu.eventType.codeBreak)
emu.addMemoryCallback(function()local t=emu.getState();criticalStart=t.masterClock;criticalRate=t.clockRate end,emu.callbackType.exec,__SCENE_DMA_BEGIN__,__SCENE_DMA_BEGIN__,emu.cpuType.gameboy)
emu.addMemoryCallback(function()
 local t=emu.getState();if not criticalStart then error('Missing DMA critical start') end
 criticalMax=math.max(criticalMax,t.masterClock-criticalStart);criticalCount=criticalCount+1
end,emu.callbackType.exec,__SCENE_DMA_END__,__SCENE_DMA_END__,emu.cpuType.gameboy)
emu.addMemoryCallback(function(address,value)
 local t=emu.getState()
 emu.log(string.format('scene-stage:%d,%d,%d',value,t.masterClock,t.clockRate))
end,emu.callbackType.write,__SCENE_PHASE__,__SCENE_PHASE__,emu.cpuType.gameboy)
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
-- Check the actual OAM bytes at the map switch, not only the stable screenshot.
emu.addMemoryCallback(function(address,value)
 local phase=emu.read(__SCENE_PHASE__,mem)
 if phase==4 or phase==5 then
  publications=publications+1
  local page=(value>>3)&1
  local base=page==1 and 0xdd00 or 0xdc00
  if emu.read(__OAM_BASE__,mem)~=base>>8 or (emu.read(0xff41,mem)&3)~=1 then badpublication=badpublication+1 end
  for i=0,159 do if emu.read(0xfe00+i,mem)~=emu.read(base+i,mem) then badpublication=badpublication+1 end end
 end
end,emu.callbackType.write,0xff40,0xff40,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('scene-residency:%d,%d,%d,%d',writes,bad,palettes,badpalette))end,emu.eventType.codeBreak)
emu.addEventCallback(function()emu.log(string.format('scene-publication:%d,%d',publications,badpublication))end,emu.eventType.codeBreak)
emu.addEventCallback(function()emu.log(string.format('scene-critical:%d,%d,%d',criticalCount,criticalMax,criticalRate))end,emu.eventType.codeBreak)
