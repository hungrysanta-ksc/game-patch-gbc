-- Observe completed publication and actual OAM DMA, never drive the animation.
local bm=emu.memType.gameboyDebug
local function word(a)return emu.read(a,bm)+256*emu.read(a+1,bm)end
local oams,badoam=0,0
emu.addMemoryCallback(function(a,v)
 oams=oams+1
 local t=emu.getState()
 if t['cpu.ime']==nil then error('Missing pinned IME') end
 if (emu.read(0xff41,bm)&3)~=1 or emu.read(0xff44,bm)>151 or (t['cpu.ime']~=false and t['cpu.ime']~=0) or v~=emu.read(__OAM_BASE__,bm) or (v~=0xdc and v~=0xdd) then badoam=badoam+1 end
end,emu.callbackType.write,0xff46,0xff46,emu.cpuType.gameboy)
emu.addMemoryCallback(function(a,v)
 local t=emu.getState()
 emu.log(string.format('battle-present:%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d',word(__BATTLE_RUN__),emu.read(__BATTLE_ENTRY__,bm),word(__BATTLE_ORIGIN__),word(__BATTLE_DUE__),word(__BATTLE_COMMITTED__),word(__BATTLE_PREPARED__),word(__BATTLE_MISSES__),t.masterClock,t.clockRate,emu.read(0xff40,bm),emu.read(0xff44,bm)))
 emu.log(string.format('battle-visible:%d,%d,%d',word(__BATTLE_RUN__),emu.read(__BATTLE_ENTRY__,bm),t.frameCount))
end,emu.callbackType.write,__BATTLE_SERIAL__,__BATTLE_SERIAL__,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('battle-oam:%d,%d',oams,badoam))end,emu.eventType.codeBreak)

emu.addMemoryCallback(function(a,v)local t=emu.getState();emu.log(string.format('battle-stage:%d,%d,%d,%d,%d',word(__BATTLE_RUN__),v,word(__BATTLE_DUE__),t.masterClock,t.clockRate))end,emu.callbackType.write,__SCENE_PHASE__,__SCENE_PHASE__,emu.cpuType.gameboy)

emu.addMemoryCallback(function()
 local t=emu.getState()
 local e=emu.read(__BATTLE_ENTRY__,bm);if e==255 then e=-1 end
 emu.log(string.format('battle-check:%d,%d,%d,%d,%d,%d,%d',word(__BATTLE_RUN__),e+1,word(__BATTLE_DUE__),word(__NATIVE_CLOCK__),emu.read(__BATTLE_READY__,bm),t.masterClock,t.clockRate))
end,emu.callbackType.exec,__BATTLE_VBLANK__,__BATTLE_VBLANK__,emu.cpuType.gameboy)
