import {check} from './source.mjs';
// Compare the resident census and three-row summary to every real native OBJ.
// The reference scans 40 objects per line and does not use the runtime shortcut.
export function magicGridAudit(s){
 for(const k of ['battle_workspace','magic_prepare_stage','party_page','party_oam0','party_oam1'])check(Number.isInteger(s[k]),'Magic grid symbol '+k);
 return `
do
 local mem=emu.memType.gameboyDebug;local checks,bad,invalid,peak=0,0,0,0
 local function read(a)return emu.read(a,mem)end
 emu.addMemoryCallback(function(_,v)
  if v~=3 then return end
  local empty=true;for i=0,159 do if read(${s.battle_workspace}+144+i)~=240 then empty=false;break end end
  local page=read(${s.party_page})==0 and ${s.party_oam1} or ${s.party_oam0}
  local grouped={};for y=0,143 do grouped[y]=read(${s.battle_workspace}+y) end
  if not empty then
   local ys={}
   for i=0,2 do
    local y=read(${s.battle_workspace}+304+i*2);local n=read(${s.battle_workspace}+305+i*2)
    if y>128 or n>6 then invalid=invalid+1 else for k=y,y+15 do grouped[k]=grouped[k]+n end end
    ys[#ys+1]=y
   end
   table.sort(ys);if ys[2]-ys[1]~=16 or ys[3]-ys[2]~=16 then invalid=invalid+1 end
  end
  for y=0,143 do
   local actual=0;for i=0,39 do local sy=read(page+i*4)-16;if y>=sy and y<sy+16 then actual=actual+1 end end
   if grouped[y]~=actual then bad=bad+1 end;if actual>peak then peak=actual end
  end
  checks=checks+1
 end,emu.callbackType.write,${s.magic_prepare_stage},${s.magic_prepare_stage},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log(string.format('magic-grid:%d,%d,%d,%d',checks,bad,invalid,peak))end,emu.eventType.codeBreak)
end
`;}
export function magicGridResult(log,expected){
 const r=[...log.matchAll(/magic-grid:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);
 check(r&&r[0]===expected&&!r[1]&&!r[2]&&r[3]<=10,'Every grouped scanline equals actual OAM');
 return {pictures:r[0],scanlines:r[0]*144,mismatches:r[1],invalidRows:r[2],peak:r[3]};
}
