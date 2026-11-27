import {check} from './source.mjs';
import fs from 'node:fs/promises';
// Read-only observation on the pinned MesenCore. MemoryType 43 is GbVideoRam,
// the same physical 16KiB view used by VerifyStrike's independent screenshots.
export async function freezeAudit(s,dir){for(const k of ['effect_freeze_stage','effect_signed','effect_map_saved','effect_map_written','action_enabled','party_profile'])check(Number.isInteger(s[k]),'Freeze audit symbol '+k);
 const prefixes=[];for(let i=0;s['resident_patterns'+i]!==undefined;i++){const b=await fs.readFile(dir+'/resident-patterns'+i+'.bin');check(b.length>=2048,'Complete resident prefix');prefixes.push(b.subarray(0,2048).toString('hex'));}check(prefixes.length>0,'Resident prefix profiles');
 return `\ndo
 local mem=emu.memType.gameboyDebug
 local before=nil
 local starts,ends,bad,saved,written,different=0,0,0,0,0,0
 local sourceBad,mirrorBad,profile=0,0,0
 local prefixes={${prefixes.map(h=>"'"+h+"'").join(',')}}
 local function prefix(at)
  local n=0;local h=prefixes[profile+1];if not h then error('Resident profile') end
  for i=0,2047 do if emu.read(at+i,43)~=tonumber(h:sub(i*2+1,i*2+2),16) then n=n+1 end end;return n
 end
 local function word(a)return emu.read(a,mem)+emu.read(a+1,mem)*256 end
 local function maps()
  local t={};for bank=0,1 do for i=0,2047 do t[#t+1]=emu.read(bank*8192+6144+i,43) end end;return t
 end
 emu.addMemoryCallback(function(_,v)
  if v==8 then mirrorBad=mirrorBad+prefix(12288);return end
  if v~=1 then return end
  if before then error('Unreleased freeze map') end
  before=maps();starts=starts+1
  profile=emu.read(${s.party_profile},mem);sourceBad=sourceBad+prefix(8192)
  for bank=0,1 do for i=1,576 do if before[bank*2048+i]~=before[bank*2048+1024+i] then different=different+1 end end end
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 emu.addEventCallback(function()
  -- The original action caller returns only after the final release. Inspect
  -- both pages, both banks, all hidden columns and unused rows as well.
  if before and emu.read(${s.action_enabled},mem)==0 then
   local after=maps();for i=1,#before do if before[i]~=after[i] then bad=bad+1 end end
   sourceBad=sourceBad+prefix(8192)
   if emu.read(${s.effect_signed},mem)~=0 then error('Freeze still owns display') end
   local n=word(${s.effect_map_saved});local w=word(${s.effect_map_written});if w~=n*2 or n>1152 or n%16~=0 then error('Unbalanced map borrowing') end
   saved=saved+n;written=written+w;before=nil;ends=ends+1
  end
  emu.log(string.format('freeze-maps:%d,%d,%d,%d,%d,%d,%d,%d',starts,ends,bad,saved,written,different,sourceBad,mirrorBad))
 end,emu.eventType.codeBreak)
end\n`;
}
export function freezeResult(log,expected){const a=[...log.matchAll(/freeze-maps:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(a&&a[0]===expected&&a[1]===expected&&a[2]===0&&a[4]===a[3]*2&&!a[6]&&!a[7],'Exact maps and canonical pattern ownership');return {freezes:a[0],restored:a[1],mismatchedBytes:a[2],savedBytes:a[3],writtenBytes:a[4],initialPageDifferences:a[5],canonicalMismatches:a[6],mirrorMismatches:a[7]};}
