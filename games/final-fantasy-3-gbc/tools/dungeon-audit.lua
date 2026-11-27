-- Observe the real field probability consumer; never write game state.
local rolls={}
emu.addMemoryCallback(function()
 if emu.read(sym._current_bank,emu.memType.gameboyDebug)==encounterBank and emu.read(sym.scene_phase,emu.memType.gameboyDebug)==1 then
  local f={}
  for i=0,78 do f[#f+1]=string.format('%02x',emu.read(sym.field+i,emu.memType.gameboyDebug)) end
  rolls[#rolls+1]='dungeon-roll:'..emu.read(sym.npc_active,emu.memType.gameboyDebug)..':'..table.concat(f)
 end
end,emu.callbackType.exec,encounterPc,encounterPc,emu.cpuType.gameboy)
emu.addEventCallback(function()
 if emu.read(sym.scene_cycles,emu.memType.gameboyDebug)>=3 then
  for _,r in ipairs(rolls) do emu.log(r) end
  emu.log('dungeon-roll-count:'..#rolls)
 end
end,emu.eventType.codeBreak)
