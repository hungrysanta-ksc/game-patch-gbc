import {check} from './source.mjs';
// Observe the current source OAM and active shadow throughout future work.
// No RAM intervention, frame release, timing tolerance or fixture substitution.
export function magicAheadAudit(s){for(const k of ['magic_prepare_stage','magic_prepare_ahead','animation_video_frames','animation_source','party_page','party_oam0','party_oam1','native_request'])check(Number.isInteger(s[k]),'Magic ahead symbol '+k);
 return `\ndo
 local mem=emu.memType.gameboyDebug
 local current=nil;local page,serial,prior=0,0,0
 local starts,commits,bad,stages,sounds=0,0,0,0,0
 local function word(a)return emu.read(a,mem)+emu.read(a+1,mem)*256 end
 local function bytes(a)local t={};for i=0,159 do t[i+1]=emu.read(a+i,mem) end;return t end
 local function compare(a,b)for i=1,160 do if a[i]~=b[i] then bad=bad+1 end end end
 local shadow=nil
 emu.addMemoryCallback(function(_,v)
  if current and (v==7 or v==8) then sounds=sounds+1 end
 end,emu.callbackType.write,${s.native_request},${s.native_request},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)
  if emu.read(${s.magic_prepare_ahead},mem)==0 then return end
  if v==1 then
   if current then error('Overlapping future picture') end
   current=bytes(${s.animation_source});page=emu.read(${s.party_page},mem)
   shadow=bytes(page==0 and ${s.party_oam0} or ${s.party_oam1})
   serial=word(${s.animation_video_frames});starts=starts+1;prior=1;return
  end
  if not current or v~=prior+1 then error('Future preparation order') end
  compare(current,bytes(${s.animation_source}))
  if page~=emu.read(${s.party_page},mem) then error('Future page displayed early') end
  compare(shadow,bytes(page==0 and ${s.party_oam0} or ${s.party_oam1}))
  local waits=v-2;if word(${s.animation_video_frames})-serial~=waits then error('Original four-wait boundary') end
  prior=v;stages=stages+1
  if v==5 then commits=commits+1;current=nil;shadow=nil end
 end,emu.callbackType.write,${s.magic_prepare_stage},${s.magic_prepare_stage},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log(string.format('magic-ahead:%d,%d,%d,%d,%d',starts,commits,bad,stages,sounds))end,emu.eventType.codeBreak)
end\n`;
}
export function magicAheadResult(log,expected){const a=[...log.matchAll(/magic-ahead:(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(a&&a[0]===expected&&a[1]===expected&&!a[2]&&a[3]===expected*4&&!a[4],'Future work preserves current picture, four waits and sound boundary');return {prepared:a[0],committed:a[1],currentMismatches:a[2],stageChecks:a[3],earlySounds:a[4]};}
