-- Read-only audit during the manual original-frame replay. Memory type 43
-- is GbVideoRam in the pinned Mesen Core ABI (also used by VerifyPartyVideo).
local mem=emu.memType.gameboyDebug
local hi,lo=0,0
local patterns,maps,bad,live,terrain=0,0,0,0,0
local function byte(a) return emu.read(a,mem) end
emu.addMemoryCallback(function(_,v) hi=v&31 end,emu.callbackType.write,0xff53,0xff53,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v) lo=v&240 end,emu.callbackType.write,0xff54,0xff54,emu.cpuType.gameboy)
emu.addMemoryCallback(function(_,v)
 if byte(bossAuditRequest)~=0 or byte(bossAuditStarted)==0 then return end
 local dest=hi*256+lo
 local n=((v&127)+1)*16
 local bank=byte(0xff4f)&1
 local ly=byte(0xff44)
 if ly<144 or ly>150 or (byte(0xff41)&3)~=1 or (v&128)~=0 then bad=bad+1 end
 local map=(byte(0xff40)&8)~=0 and 7168 or 6144
 if dest<4096 and bank==1 then
  -- Terrain prepares its second resident page at the boss boundary too.
  -- Keep its 1..20 tile ownership separate from boss tiles 21..255.
  if dest>=16 and dest+n<=336 then terrain=terrain+n
  else patterns=patterns+n;if dest<336 or dest+n>4096 then bad=bad+1 end end
  local first,last=dest//16,(dest+n)//16-1
  local owned={}
  for y=0,12 do for x=0,19 do
   local a=map+y*32+x
   if (emu.read(a+8192,43)&8)~=0 then owned[emu.read(a,43)]=true end
  end end
  for i=0,39 do
   if byte(0xfe00+i*4)~=0 and (byte(0xfe03+i*4)&8)~=0 then owned[byte(0xfe02+i*4)]=true end
  end
  for t=first,last do if owned[t] then live=live+1 end end
 elseif dest>=6144 then
  maps=maps+n
  if dest<map+1024 and dest+n>map then live=live+1 end
 end
end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
emu.addEventCallback(function()
 emu.log(string.format('boss-live:%d,%d,%d,%d,%d',patterns,maps,bad,live,terrain))
end,emu.eventType.codeBreak)
