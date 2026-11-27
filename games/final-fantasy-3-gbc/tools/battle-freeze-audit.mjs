import {freezeMembershipAudit,freezeMembershipResult,restoreDmaAudit,restoreDmaResult} from './battle-freeze-membership-audit.mjs';
import {check} from './source.mjs';
import {freezeRowAudit,freezeRowResult} from './battle-freeze-row-audit.mjs';
import fs from 'node:fs/promises';
// Read-only observation on the pinned MesenCore. MemoryType 43 is GbVideoRam,
// the same physical 16KiB view used by VerifyStrike's independent screenshots.
export async function freezeAudit(s,dir){for(const k of ['effect_freeze_stage','effect_signed','effect_map_saved','effect_map_written','action_enabled','party_profile','effect_glyph_hits','effect_glyph_reads','text_staging','effect_freeze_reused'])check(Number.isInteger(s[k]),'Freeze audit symbol '+k);
 const rom=await fs.readFile(dir+'/ff3-battle-effects-video.gbc'),burst=Buffer.from(Array(16).fill([0x2a,0x12,0x13]).flat()),bank=rom.subarray(51*16384,52*16384),offset=bank.indexOf(burst);
 check(offset>=0&&bank.indexOf(burst,offset+1)<0&&bank.subarray(offset-3,offset).equals(Buffer.from([0x79,0xe0,0x4f]))&&bank.subarray(offset+48,offset+51).equals(Buffer.from([0xaf,0xe0,0x4f]))&&Number.isInteger(s._current_bank),'Linked 16-byte VRAM read kernel');
 const leaf=rom.subarray(s.ff3_text_wram_dma_begin,s.ff3_text_wram_dma_end);
 check(leaf.length===23&&leaf.subarray(0,6).equals(Buffer.from([0xf0,0xff,0xf5,0xaf,0xe0,0xff]))&&leaf[6]===0xfa&&leaf.subarray(9,12).equals(Buffer.from([0xe0,0x70,0xfa]))&&leaf.subarray(14).equals(Buffer.from([0xe0,0x55,0x3e,1,0xe0,0x70,0xf1,0xe0,0xff])), 'Resident DMA leaf: no call or stack access while banked');
 const site=0x4000+offset;
 const prefixes=[];for(let i=0;s['resident_patterns'+i]!==undefined;i++){const b=await fs.readFile(dir+'/resident-patterns'+i+'.bin');check(b.length>=2048,'Complete resident prefix');prefixes.push(b.subarray(0,2048).toString('hex'));}check(prefixes.length>0,'Resident prefix profiles');
 return `\ndo
 local mem=emu.memType.gameboyDebug
 local burstStart=nil;local burstCount,burstBad,burstMax,burstRate=0,0,0,0
 local function burstCheck()if emu.read(0xffff,mem)~=0 or (emu.read(0xff41,mem)&3)~=1 then burstBad=burstBad+1 end end
 emu.addMemoryCallback(function()
  if emu.read(${s._current_bank},mem)~=51 then return end
  burstCheck();local t=emu.getState();burstStart=t.masterClock;burstRate=t.clockRate
  local ly=emu.read(0xff44,mem);if ly<144 or ly>151 then burstBad=burstBad+1 end
 end,emu.callbackType.exec,${site},${site},emu.cpuType.gameboy)
 emu.addMemoryCallback(function()
  if emu.read(${s._current_bank},mem)~=51 then return end
  burstCheck();if not burstStart then error('Missing VRAM burst start')end
  local delta=emu.getState().masterClock-burstStart;burstMax=math.max(burstMax,delta);burstCount=burstCount+1;burstStart=nil
 end,emu.callbackType.exec,${site+48},${site+48},emu.cpuType.gameboy)
 local before=nil
 local starts,ends,bad,saved,written,different=0,0,0,0,0,0
 local sourceBad,mirrorBad,profile=0,0,0
 local cacheChecks,cacheBad,hits,reads,reuses=0,0,0,0,0
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
  if v==5 then
   if emu.read(${s.effect_freeze_reused},mem)~=0 then reuses=reuses+1;return end
   hits=hits+word(${s.effect_glyph_hits});reads=reads+word(${s.effect_glyph_reads});cacheChecks=cacheChecks+1
   for slot=0,7 do
    local key=word(${s.text_staging}+128+slot*2)
    if key~=65535 then
     if key>511 then error('Invalid cached tile') end
     for i=0,15 do if emu.read(${s.text_staging}+slot*16+i,mem)~=emu.read((key>>8)*8192+(key&255)*16+i,43) then cacheBad=cacheBad+1 end end
    end
   end
   return
  end
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
  emu.log(string.format('freeze-vblank-read:%d,%d,%d,%d',burstCount,burstBad,burstMax,burstRate))
  emu.log(string.format('freeze-maps:%d,%d,%d,%d,%d,%d,%d,%d',starts,ends,bad,saved,written,different,sourceBad,mirrorBad))
  emu.log(string.format('freeze-cache:%d,%d,%d,%d,%d',cacheChecks,cacheBad,hits,reads,reuses))
 end,emu.eventType.codeBreak)
end\n`+freezeMembershipAudit(s)+restoreDmaAudit(s)+freezeRowAudit(s,rom);
}
export function freezeResult(log,expected){const a=[...log.matchAll(/freeze-maps:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number),c=[...log.matchAll(/freeze-cache:(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(a&&a[0]===expected&&a[1]===expected&&a[2]===0&&a[4]===a[3]*2&&!a[6]&&!a[7],'Exact maps and canonical pattern ownership');check(c&&c[0]+c[4]===expected&&!c[1]&&(!c[0]||(c[2]>0&&c[3]>0)),'Live cache bytes and bounded lifetime');const fast=[...log.matchAll(/freeze-vblank-read:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(fast&&!fast[1]&&(fast[0]>0?(fast[2]===384&&fast[3]===8388608):(fast[2]===0&&fast[3]===0)),'Conditional early-VBlank reads: exact timing when taken, zero trace otherwise');return {rowKernel:freezeRowResult(log),membership:freezeMembershipResult(log),restoreDma:restoreDmaResult(log),vblankReads:fast[0],vblankReadCycles:fast[2],freezes:a[0],restored:a[1],mismatchedBytes:a[2],savedBytes:a[3],writtenBytes:a[4],initialPageDifferences:a[5],canonicalMismatches:a[6],mirrorMismatches:a[7],reuseChecks:c[4],cacheChecks:c[0],cacheMismatches:c[1],glyphHits:c[2],glyphReads:c[3]};}
