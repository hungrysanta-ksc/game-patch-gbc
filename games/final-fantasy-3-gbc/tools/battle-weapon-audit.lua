local mem=emu.memType.nesMemory
local done=false
local function log(kind,value)
 if done then return end
 local s=emu.getState()
 emu.log(string.format('duration:%s,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d',kind,s.frameCount,s.masterClock,value or 0,emu.read(0xcd,mem),emu.read(0xb6,mem),emu.read(0xbb,mem),emu.read(0xbc,mem),emu.read(0xbd,mem),emu.read(0x95,mem),emu.read(0x16,mem)))
end
local function at(addr,bank,kind)
 emu.addMemoryCallback(function()local s=emu.getState();if s['mapper.registers6']==bank then log(kind,s['cpu.a']);if kind=='end' then done=true end end end,emu.callbackType.exec,addr,addr,emu.cpuType.nes)
end
at(0x9e8a,0x30,'effect')
at(0xa0c0,0x32,'start')
at(0xa094,0x32,'hand')
at(0xa384,0x32,'swing')
at(0x991f,0x32,'slice')
at(0xa2fb,0x32,'unarmed')
at(0xb25b,0x2e,'end')
emu.addMemoryCallback(function(a,v)log('sound',v)end,emu.callbackType.write,0x7f49,0x7f49,emu.cpuType.nes)
