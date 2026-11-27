-- Read-only bus observer. Symbols are supplied by the exact linked ROM.
local mem=emu.memType.gameboyDebug
local writes,bad,dma,badDma,off,badOff,apu,apuHash,foreignApu=0,0,0,0,0,0,0,0,0
local started=auditStartHash~=nil
apuHash=auditStartHash or 0
local function read(a)return emu.read(a,mem)end
local seedCaptures={}
-- Capture the two immutable main-thread owners after the fold, before the
-- ready publication. No state changes, no extra SRAM/WRAM reservation.
if sym.scene_rng_ready then
 emu.addMemoryCallback(function(_,v)
  if v==1 and read(sym.scene_phase)==1 then
   local f,s={},{}
   for i=0,78 do f[#f+1]=string.format('%02x',read(sym.field+i)) end
   for i=0,191 do s[#s+1]=string.format('%02x',read(sym.ff3_state+i)) end
   seedCaptures[#seedCaptures+1]='encounter-entropy:'..read(sym.scene_rng_seed)..':'..table.concat(f)..':'..table.concat(s)
  end
 end,emu.callbackType.write,sym.scene_rng_ready,sym.scene_rng_ready,emu.cpuType.gameboy)
end
-- Mesen's script log is a bounded ring. Preserve early observations in Lua,
-- then re-emit the complete bounded set at the final audio boundary.
emu.addEventCallback(function()
 if read(sym.native_done)~=0 or (dungeonAudit and read(sym.scene_cycles)>=3) then
  for _,capture in ipairs(seedCaptures) do emu.log(capture) end
  emu.log('encounter-entropy-count:'..#seedCaptures)
 end
end,emu.eventType.codeBreak)
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
