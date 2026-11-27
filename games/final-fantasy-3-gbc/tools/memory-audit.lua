-- Read-only bank/interrupt observer. Entry/exit are real CPU SVBK writes.
local memoryType=emu.memType.gameboyDebug
local mapped,entryClock,entrySp,entryIme=false,0,0,false
local copies,bad,maxSeconds,irq=0,0,0,0
-- Combined field/effects runs can supply a byte-validated fixed-ROM DMA leaf.
-- Its established DMA budget is separate from the 16-byte CPU copy budget.
-- With no anchors, existing field diagnostics retain the exact old contract.
local entryDma=false
local dmaCopies,dmaMaxCycles,dmaRate=0,0,0
emu.addMemoryCallback(function(address,value)
 local state=emu.getState()
 if (value&7)~=1 then
  if mapped or value<2 or value>7 or emu.read(0xffff,memoryType)~=0 then bad=bad+1 end
  mapped=true;entryClock=state.masterClock;entrySp=state['cpu.sp'];entryIme=state['cpu.ime']
  entryDma=memoryDmaBegin~=nil and state['cpu.pc']>=memoryDmaBegin and state['cpu.pc']<memoryDmaEnd
  if entrySp==nil or entryIme==nil then error('Missing pinned CPU state fields') end
 else
  if not mapped then bad=bad+1;return end
  local seconds=(state.masterClock-entryClock)/state.clockRate
  if state['cpu.sp']~=entrySp or state['cpu.ime']~=entryIme or emu.read(0xffff,memoryType)~=0 then bad=bad+1 end
  if entryDma then
   dmaCopies=dmaCopies+1;dmaMaxCycles=math.max(dmaMaxCycles,state.masterClock-entryClock);dmaRate=state.clockRate
  else
   if seconds>maxSeconds then maxSeconds=seconds end
   copies=copies+1
  end
  mapped=false
 end
end,emu.callbackType.write,0xff70,0xff70,emu.cpuType.gameboy)
for _,vector in ipairs({0x40,0x48,0x50,0x58,0x60}) do
 emu.addMemoryCallback(function()
  irq=irq+1;if mapped or (emu.read(0xff70,memoryType)&7)~=1 then bad=bad+1 end
 end,emu.callbackType.exec,vector,vector,emu.cpuType.gameboy)
end
emu.addEventCallback(function()
 emu.log(string.format('memory-audit:%d,%d,%.9f,%d',copies,bad,maxSeconds,irq))
 if memoryDmaBegin then emu.log(string.format('memory-dma-audit:%d,%d,%d',dmaCopies,dmaMaxCycles,dmaRate)) end
end,emu.eventType.codeBreak)
