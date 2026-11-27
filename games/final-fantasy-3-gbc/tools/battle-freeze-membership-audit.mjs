import {check} from './source.mjs';
// Observe the actual gathered cell records before their composition lifetime.
// Independently scan every screen cell against the original settled OAM.
export function freezeMembershipAudit(s){for(const n of ['effect_freeze_stage','effect_keys','effect_members','animation_base'])check(Number.isInteger(s[n]),'Membership symbol '+n);
 return `\ndo
 local mem=emu.memType.gameboyDebug;local checks,cells,fallback,tail,bad=0,0,0,0,0
 local function word(p)return emu.read(p,mem)+emu.read(p+1,mem)*256 end
 emu.addMemoryCallback(function(_,v)
  if v~=4 then return end;local expected={};local n=0
  for y=0,12 do for x=0,19 do
   local members={};local pal=nil;local direct=true
   for i=8,31 do local p=${s.animation_base}+i*4;local oy=emu.read(p,mem);local tile=emu.read(p+2,mem)
    if oy>=16 and oy<112 and tile~=0 then local ox=emu.read(p+1,mem)-8;oy=oy-16
     if ox<x*8+8 and ox+8>x*8 and oy<y*8+8 and oy+8>y*8 then
      members[#members+1]=i;local color=emu.read(p+3,mem)&7
      if pal==nil then pal=color end;if color~=pal or color>2 or ox~=x*8 then direct=false end
     end
    end
   end
   if #members>0 then expected[y*32+x]={members=members,tag=y*32+x+pal*1024+(direct and 0 or 32768)};n=n+1 end
  end end
  for i=0,n-1 do local tag=word(${s.effect_keys}+i*2);local key=tag&1023;local e=expected[key]
   if not e or tag~=e.tag then bad=bad+1 else
    for j=0,3 do local want=(#e.members>4 and j==3)and 254 or(e.members[j+1] or 255);if emu.read(${s.effect_members}+i*4+j,mem)~=want then bad=bad+1 end end
    if #e.members>4 then fallback=fallback+1 end;if key//32==12 and key%32>=16 then tail=tail+1 end;expected[key]=nil
   end
  end
  for _ in pairs(expected)do bad=bad+1 end;checks=checks+1;cells=cells+n
 end,emu.callbackType.write,${s.effect_freeze_stage},${s.effect_freeze_stage},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log(string.format('freeze-members:%d,%d,%d,%d,%d',checks,cells,fallback,tail,bad))end,emu.eventType.codeBreak)
end\n`;
}
export function freezeMembershipResult(log){const a=[...log.matchAll(/freeze-members:(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(a&&a[0]>0&&a[1]>0&&!a[4],'Every gathered cell/member/palette predicate');return {checks:a[0],cells:a[1],fallbackCells:a[2],directoryTailCells:a[3]};}

export function restoreDmaAudit(s){for(const k of ['ff3_text_wram_dma_begin','ff3_text_wram_dma_end'])check(Number.isInteger(s[k]),'Resident DMA anchor '+k);
 return `\ndo
 local mem=emu.memType.gameboyDebug;local active=false;local count,bad,maxTicks,rate=0,0,0,0;local start=0;local sp=0;local regs={}
 emu.addMemoryCallback(function(p,v)regs[p]=v end,emu.callbackType.write,0xff51,0xff54,emu.cpuType.gameboy)
 emu.addMemoryCallback(function()if active or (emu.read(0xff70,mem)&7)~=1 then error('Resident DMA entry')end;active=true;local t=emu.getState();start=t.masterClock;rate=t.clockRate;sp=t['cpu.sp'];if t['cpu.ime'] then bad=bad+1 end end,emu.callbackType.exec,${s.ff3_text_wram_dma_begin},${s.ff3_text_wram_dma_begin},emu.cpuType.gameboy)
 emu.addMemoryCallback(function()if not active or (emu.read(0xff70,mem)&7)~=1 or emu.getState()['cpu.sp']~=sp or emu.getState()['cpu.ime'] then bad=bad+1 end;maxTicks=math.max(maxTicks,emu.getState().masterClock-start);active=false;count=count+1 end,emu.callbackType.exec,${s.ff3_text_wram_dma_end},${s.ff3_text_wram_dma_end},emu.cpuType.gameboy)
 emu.addMemoryCallback(function(_,v)if not active then return end;local bank=emu.read(0xff70,mem)&7;local src=regs[0xff51]*256+(regs[0xff52]&240);local dest=0x8000+(regs[0xff53]&31)*256+(regs[0xff54]&240);local n=(v+1)*16;local valid=(bank==3 and src>=0xd000 and src+n<=0xd480 and dest>=0x9800)or(bank==4 and src==0xd480 and n==256 and dest==0x84a0);if emu.read(0xffff,mem)~=0 or not valid or v>=16 or (emu.read(0xff41,mem)&3)~=1 then bad=bad+1 end end,emu.callbackType.write,0xff55,0xff55,emu.cpuType.gameboy)
 for _,v in ipairs({64,72,80,88,96})do emu.addMemoryCallback(function()if active then bad=bad+1 end end,emu.callbackType.exec,v,v,emu.cpuType.gameboy)end
 emu.addEventCallback(function()if active then bad=bad+1 end;emu.log(string.format('freeze-resident-dma:%d,%d,%d,%d',count,bad,maxTicks,rate))end,emu.eventType.codeBreak)
end\n`;
}
export function restoreDmaResult(log){const a=[...log.matchAll(/freeze-resident-dma:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(a&&a[0]>0&&!a[1]&&a[2]<2000&&a[3]===8388608,'Bounded resident DMA and bank restoration');return {chunks:a[0],maxCycles:a[2],clockRate:a[3]};}
