-- Observe normal logical-frame inputs/outputs. No position, RNG, NPC, input or
-- ROM writes. At most 1024 transitions keep the raw evidence bounded.
local nf,na,nb=__FIELD__,__PART1__,__PART2__
local samples=0
local before=nil
local npcStart,npcMax,npcSum,npcCount=nil,0,0,0
local function bytes(address,n)
 local out={}
 for i=0,n-1 do out[#out+1]=string.format('%02x',emu.read(address+i,emu.memType.gameboyDebug)) end
 return table.concat(out)
end
emu.addMemoryCallback(function(address,value)
 local timing=emu.getState()
 if value==1 then npcStart=timing.masterClock
 elseif npcStart~=nil then local us=math.floor(((timing.masterClock-npcStart)&0xffffffff)*1000000/timing.clockRate+0.5);npcMax=math.max(npcMax,us);npcSum=npcSum+us;npcCount=npcCount+1;npcStart=nil end
 if samples>=1024 then return end
 if value==1 then before=bytes(nf,75)..':'..bytes(na,192)..':'..bytes(nb,192)
 elseif before~=nil then
  samples=samples+1
  emu.log('npc-step:'..samples..':'..before..':'..bytes(nf,75)..':'..bytes(na,192)..':'..bytes(nb,192))
  before=nil
 end
end,emu.callbackType.write,__NPC_BUSY__,__NPC_BUSY__,emu.cpuType.gameboy)
emu.addEventCallback(function()emu.log(string.format('npc-time:%d,%d,%d',npcCount,npcMax,npcSum))end,emu.eventType.codeBreak)
