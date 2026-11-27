import {check} from './source.mjs';
// Locate and verify the linked SM83 loop, then compare each actual call with
// an independent per-pixel transparent-OBJ overlay. No runtime intervention.
export function freezeRowAudit(s,rom){
 const bank=rom.subarray(51*16384,52*16384),loop=Buffer.from('2ab62f4f2b1aa1b61213231aa1b61213230520ecc1c9','hex'),at=bank.indexOf(loop),entry=at-18;
 check(at>=18&&bank.indexOf(loop,at+1)<0,'Unique linked native row loop');
 const source=bank.readUInt16LE(entry+3),target=bank.readUInt16LE(entry+11),prefix=Buffer.from([0xc5,0x47,0xfa,source&255,source>>8,0x6f,0xfa,(source+1)&255,(source+1)>>8,0x67,0xfa,target&255,target>>8,0x5f,0xfa,(target+1)&255,(target+1)>>8,0x57]);
 check(bank.subarray(entry,at).equals(prefix)&&[source,target].every(p=>p>=0xc000&&p+1<0xd000)&&Number.isInteger(s.effect_glyph)&&Number.isInteger(s.effect_encoded),'Row pointer setup and BC preservation');
 return `\ndo
 local mem=emu.memType.gameboyDebug;local active=nil;local calls,rows,lengths,colors=0,0,0,0
 local function word(p)return emu.read(p,mem)+256*emu.read(p+1,mem)end
 emu.addMemoryCallback(function()
  if emu.read(${s._current_bank},mem)~=51 then return end
  local t=emu.getState();local n=t['cpu.a'];local src=word(${source});local dst=word(${target});local lo=src-${s.effect_glyph};local off=dst-${s.effect_encoded}
  if active or n<1 or n>8 or lo<0 or off<0 or lo%2~=0 or off%2~=0 or lo+n*2>16 or off+n*2>16 then error('Native row bounds')end
  local expected={};local original={};for i=0,15 do expected[i]=emu.read(${s.effect_encoded}+i,mem);original[i]=emu.read(${s.effect_glyph}+i,mem)end
  for y=0,n-1 do for bit=0,7 do
   local a=original[lo+y*2];local b=original[lo+y*2+1];local color=((a>>bit)&1)+2*((b>>bit)&1);colors=colors|(1<<color)
   if color~=0 then local mask=255~(1<<bit);local p=off+y*2;expected[p]=(expected[p]&mask)|((color&1)<<bit);expected[p+1]=(expected[p+1]&mask)|((color>>1)<<bit)end
  end end
  active={expected=expected,original=original,sp=t['cpu.sp'],b=t['cpu.b'],c=t['cpu.c'],ime=t['cpu.ime'],ie=emu.read(0xffff,mem)};calls=calls+1;rows=rows+n;lengths=lengths|(1<<(n-1))
 end,emu.callbackType.exec,${0x4000+entry},${0x4000+entry},emu.cpuType.gameboy)
 emu.addMemoryCallback(function()
  if emu.read(${s._current_bank},mem)~=51 then return end
  local t=emu.getState();if not active or t['cpu.sp']~=active.sp or t['cpu.b']~=active.b or t['cpu.c']~=active.c or t['cpu.ime']~=active.ime or emu.read(0xffff,mem)~=active.ie or (emu.read(0xff70,mem)&7)~=1 then error('Native row register/IRQ preservation')end
  for i=0,15 do if emu.read(${s.effect_encoded}+i,mem)~=active.expected[i] or emu.read(${s.effect_glyph}+i,mem)~=active.original[i]then error('Native row pixel/source mismatch')end end;active=nil
 end,emu.callbackType.exec,${0x4000+at+loop.length-1},${0x4000+at+loop.length-1},emu.cpuType.gameboy)
 emu.addEventCallback(function()emu.log(string.format('freeze-rows:%d,%d,%d,%d',calls,rows,lengths,colors))end,emu.eventType.codeBreak)
end\n`;
}
export function freezeRowResult(log){const a=[...log.matchAll(/freeze-rows:(\d+),(\d+),(\d+),(\d+)/g)].at(-1)?.slice(1).map(Number);check(a,'Row audit coverage record');return {calls:a[0],rows:a[1],lengthMask:a[2],colorMask:a[3]};}
