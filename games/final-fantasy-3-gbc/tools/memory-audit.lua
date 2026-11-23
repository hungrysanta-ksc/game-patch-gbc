-- Read-only bank/interrupt observer. Entry/exit are real CPU SVBK writes.
local memoryType=emu.memType.gameboyDebug
local mapped,entryClock,entrySp,entryIme=false,0,0,false
local copies,bad,maxSeconds,irq=0,0,0,0
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if (value&7)~=1 then
  if mapped or value<2 or value>7 or emu.read(0xffff,memoryType)~=0 then bad=bad+1 end
  mapped=true;entryClock=state.masterClock;entrySp=state['cpu.sp'];entryIme=state['cpu.ime']
  if entrySp==nil or entryIme==nil then error('Missing pinned CPU state fields') end
 else
  if not mapped then bad=bad+1;return end
  local seconds=(state.masterClock-entryClock)/state.clockRate
  if state['cpu.sp']~=entrySp or state['cpu.ime']~=entryIme or emu.read(0xffff,memoryType)~=0 then bad=bad+1 end
  if seconds>maxSeconds then maxSeconds=seconds end
  copies=copies+1;mapped=false
 end
end,emu.callbackType.write,0xff70,0xff70,emu.cpuType.gameboy)
for _,vector in ipairs({0x40,0x48,0x50,0x58,0x60}) do
 emu.addMemoryCallback(function()
  irq=irq+1;if mapped or (emu.read(0xff70,memoryType)&7)~=1 then bad=bad+1 end
 end,emu.callbackType.exec,vector,vector,emu.cpuType.gameboy)
end
emu.addEventCallback(function()
 emu.log(string.format('memory-audit:%d,%d,%.9f,%d',copies,bad,maxSeconds,irq))
end,emu.eventType.codeBreak)
