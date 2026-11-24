// Build-time source-consumer audit. No game loop, timing emulation or new art policy.
import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {segment} from './state-source.mjs';
import {battleInventory,monsterGraphic,tilePixels} from './render-budget-source.mjs';
import {cgbPalette} from './field-source.mjs';

function cpu(rom,pair=0x19){const c=new Driver6502(rom);c.banks=[pair*2,pair*2+1,0x3e,0x3f];c.m[0x7cf6]=pair;return c;}
// A register-write recorder for the sequential transfer functions only. It is
// deliberately not a PPU/CHR mapper emulator. Reject unexpected PPU accesses.
export function recordTransfers(c){
 const bytes=Buffer.alloc(0x4000,0xa5),written=new Uint32Array(0x4000),lastPc=new Uint16Array(0x4000);
 let address=0,high=true,control=0,buffer=0;const read=c.read.bind(c),write=c.write.bind(c);
 c.read=a=>{if(a===0x2002){high=true;return 0;}if(a===0x2007){check(address>=0x2000&&address<0x3000,'Sequential PPU underlay read');const v=buffer;buffer=bytes[address];address=(address+((control&4)?32:1))&0x3fff;return v;}return read(a);};
 c.write=(a,v)=>{if(a===0x2000){control=v;return;}if(a===0x2005){high=!high;return;}if(a===0x2006){address=high?((v&63)<<8):((address&0x3f00)|v);high=!high;return;}
  if(a===0x2007){bytes[address]=v;written[address]++;lastPc[address]=(c.pc-3)&65535;address=(address+((control&4)?32:1))&0x3fff;return;}
  check(!(a>=0x2000&&a<=0x2007),'Unexpected PPU write '+a.toString(16)+' at '+c.pc.toString(16));write(a,v);};
 return {bytes,written,lastPc};
}

export function resolveBoss206(rom){
 const c=cpu(rom,0x17),t=recordTransfers(c);c.call(0x9f98);
 check(t.written.every((n,i)=>i>=0x3000?n===0:n===1),'Original clear range');
 check(t.bytes.subarray(0,0x3000).every(v=>v===0),'Original clear value');
 // Character/menu initialization, then the boss CHR transfer. Job graphics
 // vary, but their destination ranges cannot overwrite $02A0..$02AF.
 let initializationWrites=0;const write=c.write.bind(c);c.write=(a,v)=>{if(a===0x2007)initializationWrites++;write(a,v);};
 c.m.set([0,1,2,3],0x7d8b);c.call(0xa9ed);c.m[0x7d73]=rom[0x5cb10+206];c.x=0;c.call(0xa3b8);c.call(0xa40b);
 const at=0x2a0;check(t.written.subarray(at,at+16).every(n=>n===1)&&t.lastPc.subarray(at,at+16).every(pc=>pc===0x9fa0),'Boss external tile last writer');
 c.m[0x7da7]=0;c.call(0xa362);c.call(0xa21e);
 const index=rom[0x5cb10+206]&31,map=rom.subarray(0x54010+index*216,0x54010+(index+1)*216),positions=[];
 for(let y=0;y<12;y++)for(let x=0;x<18;x++){const v=map[y*18+x];check(c.m[0x7922+y*32+x]===v,'Original boss map consumer');if(v===42)positions.push([x,y]);}
 const externalTiles=new Map([[42,tilePixels(t.bytes.subarray(at,at+16))[0]]]);
 return {graphic:monsterGraphic(rom,206,{externalTiles}),evidence:{id:206,tile:42,ppuRange:[at,at+16],positions,lastWriter:'2E/9FA0',clearRange:[0,0x3000],tileSha256:hash(t.bytes.subarray(at,at+16)),initializationWrites,scope:'9F98 clear + A9ED party/menu + A3B8/A40B boss transfer + A21E map; terrain writes $0600..$06FF; later special animations not covered'}};
}

// Hardware selection checks Y even when X is hidden. Callers may explicitly
// cull X before submitting OAM, but this calculator never assumes they did.
export function oamBudget(rects){check(new Set(rects.map(r=>r.h)).size<=1,'Mixed OBJ heights are not supported');const lines=new Uint16Array(144);for(const r of rects){check([8,16].includes(r.h),'Global OBJ height');for(let y=Math.max(0,r.y);y<Math.min(144,r.y+r.h);y++)lines[y]++;}return {entries:rects.length,peak:Math.max(...lines),totalOverflow:rects.length>40,lineOverflow:Math.max(...lines)>10};}

export function pairObjects(rects){
 const unused=new Set(rects.map((_,i)=>i)),out=[];
 for(const i of [...unused].sort((a,b)=>rects[a].y-rects[b].y||rects[a].x-rects[b].x)){
  if(!unused.delete(i))continue;const a=rects[i];check(a.h===8,'Pair input height');
  const j=[...unused].find(k=>{const b=rects[k];return b.x===a.x&&b.y===a.y+8&&b.palette===a.palette&&b.owner===a.owner;});
  const pixels=new Uint8Array(128);if(a.pixels)pixels.set(a.pixels);if(j!==undefined){unused.delete(j);if(rects[j].pixels)pixels.set(rects[j].pixels,64);}
  out.push({...a,h:16,pixels,parts:j===undefined?[i]:[i,j]});
 }return out;
}

function raster(rects){const out=new Map();for(const r of rects)for(let y=0;y<r.h;y++)for(let x=0;x<8;x++){const p=r.pixels?.[y*8+x]||0,k=(r.x+x)+','+(r.y+y);if(p&&!out.has(k))out.set(k,r.palette*4+p);}return [...out].sort(([a],[b])=>a.localeCompare(b));}
function equalPixels(a,b){check(JSON.stringify(raster(a))===JSON.stringify(raster(b)),'8x16 packing changed opaque pixels/order');}
function quads(c,start,count){return Array.from({length:count},(_,i)=>{const p=start+i*4;return {x:c.m[p+3],y:c.m[p]+1,tile:c.m[p+1],attr:c.m[p+2],slot:(p-0x200)/4,h:8};});}

export function magicDisplayAudit(rom,battle){
 const rows=[],partyCpu=cpu(rom,0x17);partyCpu.call(0xb4ac);check(partyCpu.m.subarray(0x7d83,0x7d87).every(v=>v===2),'Original normal party pose');partyCpu.banks=[0x32,0x33,0x3e,0x3f];partyCpu.m[0x7cf6]=0x19;partyCpu.m.set([192,192,192,192],0xc0);partyCpu.m.set([40,72,104,136],0xc4);partyCpu.call(0x90d8);
 const partyRaw=Buffer.from(partyCpu.m.subarray(0x2a0,0x300));
 const party=quads(partyCpu,0x2a0,24).map((q,i)=>({...q,x:q.x-192+128,y:q.y-[40,72,104,136][Math.floor(i/6)]+[10,34,58,82][Math.floor(i/6)],palette:0,owner:'party-'+Math.floor(i/6)}));
 const party16=pairObjects(party);let comparisons=0,pixelComparisons=0;
 for(const script of battle.magicScripts){
  const graphicsCpu=cpu(rom),trace=recordTransfers(graphicsCpu);graphicsCpu.m[0x7e88]=script.id;graphicsCpu.call(0xaf6f);graphicsCpu.call(0xb589);
  const gfx=tilePixels(trace.bytes.subarray(0x1490,0x1690));check(trace.written.subarray(0x1490,0x1690).every(n=>n===1),'Magic tile supply');
  let at=1;while(at<=script.length){const entry=rom[script.begin+at]===255?rom[script.begin+at+1]:rom[script.begin+at],frame=entry&127;
   for(const enemy of [false,true])for(const back of [false,true]){
    const c=cpu(rom);c.m.set(partyRaw,0x2a0);c.m.set([192,192,192,192],0xc0);c.m.set([40,72,104,136],0xc4);c.m[0x7e88]=script.id;c.call(0xaf6f);segment(c,0xb696,0xb6ca);
    c.m[0x7e9c]=at;c.m[0x7e9a]=enemy?64:0;c.m[0x78c3]=back?0x88:0;c.m[0x90]=1;c.m[0x7dd9]=80;c.m[0x7dda]=80;
    segment(c,0xb711,0xb799);const before=Buffer.from(c.m.subarray(0x200,0x300));
    const base=battle.magicFrames[frame].oam,flip=((entry>>7)^(enemy?0:1))|(rom[script.begin+at]===255?2:0);
    for(let i=0;i<36;i++){const p=i*4,tile=base[p+1],xx=(enemy?56:176)+((flip&1)?40-base[p+3]:base[p+3]),yy=(enemy?64:60-((c.m[0x7e8b]&32)?12:0))+((flip&2)?40-base[p]:base[p]);
     const expected=[tile?yy&255:240,tile,base[p+2]^((flip&1)?64:0)^((flip&2)?128:0)^(back?64:0),back?(247-xx)&255:xx&255];
     check(expected.every((v,k)=>before[p+k]===v),'Original magic placement/flip consumer');
    }
    if(enemy)c.call(0xb7b5);
    for(let s=0;s<64;s++){const from=enemy?(s<24?s+40:s>=40?s-40:s):s;check(Buffer.from(c.m.subarray(0x200+s*4,0x204+s*4)).equals(before.subarray(from*4,from*4+4)),'Original target-specific OAM order');}comparisons++;
    const original=quads(c,0x200,64),magic=original.filter(q=>q.tile>=0x49&&q.tile<=0x68&&q.y<=240).map(q=>{
     const x=back?247-q.x:q.x,baseX=enemy?56:176,baseY=enemy?64:60-((c.m[0x7e8b]&32)?12:0);
     const localX=x-baseX,localY=q.y-1-baseY,pixels=Uint8Array.from({length:64},(_,i)=>{const px=q.attr&64?7-(i&7):i&7,py=q.attr&128?7-(i>>3):i>>3;return gfx[q.tile-0x49][py*8+px];});
     // Position adaptation is a diagnostic: enemy center (56,56), party #1
     // at (128,34). Back attacks mirror the whole 160px viewport.
     const normalX=(enemy?32:112)+localX,y=(enemy?40:22-((c.m[0x7e8b]&32)?12:0))+localY;
     return {...q,x:back?152-normalX:normalX,y,palette:3,owner:'magic',pixels};
    });
    check(magic.length===battle.magicFrames[frame].nonzeroTiles,'Positioned magic tile count');
    const packed=pairObjects(magic);equalPixels(magic,packed);pixelComparisons++;
    const placedParty=party.map(q=>({...q,x:back?152-q.x:q.x})),placedParty16=pairObjects(placedParty);
    rows.push({script:script.id,byteIndex:at,frame,enemy,back,sourceOamSha256:hash(Buffer.from(c.m.subarray(0x200,0x300))),sourceSlots:original.filter(q=>q.y<=240&&q.tile>=0x49&&q.tile<=0x68).map(q=>q.slot),mode8:oamBudget([...placedParty,...magic]),mode16:oamBudget([...placedParty16,...packed]),magic8:magic.length,magic16:packed.length});
   }at+=rom[script.begin+at]===255?2:1;
  }
 }
 const max=key=>({maxEntries:Math.max(...rows.map(r=>r[key].entries)),maxLine:Math.max(...rows.map(r=>r[key].peak)),totalOverflowCases:rows.filter(r=>r[key].totalOverflow).length,lineOverflowCases:rows.filter(r=>r[key].lineOverflow).length});
 return {rows,summary:{scriptSlots:battle.magicScripts.length,comparisons,pixelComparisons,party8:oamBudget(party),party16:oamBudget(party16),mode8:max('mode8'),mode16:max('mode16')},scope:'All 91 hit-script slots, each entry, enemy/party target #1, front/back. Canonical source anchors, diagnostic GBC positions. No reachability, Life $7E9D=5 special case, reflection, projectile/summon/status or dynamic timing proof.'};
}

export function enemyColorAudit(rom,battle){
 const graphics=new Map(battle.graphics.map(g=>[g.id,g])),seen=new Set(),rows=[];
 for(const f of battle.formations)for(const slot of f.slots){const g=graphics.get(slot.id);if(!slot.max||!g||g.unresolved)continue;const key=g.id+':'+f.palettes.join(',');if(seen.has(key))continue;seen.add(key);
  const colors=f.palettes.map(id=>{const p=cgbPalette([15,...rom.subarray(0x5cc10+id*3,0x5cc13+id*3)]);return Array.from({length:4},(_,i)=>p.readUInt16LE(i*2));});
  const sw=g.w*8,sh=g.h*8,w=g.type>=6?96:sw*7/8,h=g.type>=6?64:sh*7/8,pw=Math.ceil(w/8)*8,ph=Math.ceil(h/8)*8,pixels=new Uint16Array(pw*ph);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.floor((x+.5)*sw/w),sy=Math.floor((y+.5)*sh/h),t=(sy>>3)*g.w+(sx>>3),v=g.tiles[t][(sy&7)*8+(sx&7)];pixels[y*pw+x]=v?colors[g.attrs[t]][v]:0;}
  const residual=[],rebuilt=new Uint16Array(pixels.length);let overFour=0;
  for(let y=0;y<ph;y+=8)for(let x=0;x<pw;x+=8){const values=Array.from({length:64},(_,i)=>pixels[(y+(i>>3))*pw+x+(i&7)]),sets=colors.map(c=>new Set(c)),miss=sets.map(s=>values.reduce((n,v)=>n+!s.has(v),0)),bg=miss[0]<=miss[1]?0:1,other=1-bg;
   overFour+=+(new Set(values).size>4);const mask=new Uint8Array(64);for(let i=0;i<64;i++){const v=values[i],bgIndex=colors[bg].indexOf(v);if(bgIndex<0){const index=colors[other].indexOf(v);check(index>0,'Residual nontransparent source color');mask[i]=index;}rebuilt[(y+(i>>3))*pw+x+(i&7)]=mask[i]?colors[other][mask[i]]:colors[bg][bgIndex];}
   if(mask.some(Boolean))residual.push({x,y,h:8,palette:other,owner:'enemy',pixels:mask});
  }
  check(pixels.every((v,i)=>rebuilt[i]===v),'Enemy color preservation');const tall=pairObjects(residual);equalPixels(residual,tall);
  // Conservative simultaneous reservation: max full magic grid plus padded
  // party. This is a budget rejection test, not a reachable formation claim.
  const party=[];for(const y of [10,34,58,82])for(const x of [128,136])for(const d of [0,16])party.push({x,y:y+d,h:16});
  const magic=[];for(let y=40;y<88;y+=16)for(let x=32;x<80;x+=8)magic.push({x,y,h:16});
  const shifted=tall.map(r=>({...r,y:r.y+24}));rows.push({monster:g.id,palettes:f.palettes,formation:f.id,size:[w,h],overFour,residual8:oamBudget(residual),residual16:oamBudget(tall),partyMagicEnvelope:oamBudget([...party,...magic,...shifted])});
 }
 return {rows,summary:{pairs:rows.length,pairsOverFour:rows.filter(r=>r.overFour).length,overFourTiles:rows.reduce((n,r)=>n+r.overFour,0),maxResidual8:Math.max(...rows.map(r=>r.residual8.entries)),maxResidual16:Math.max(...rows.map(r=>r.residual16.entries)),envelopeOver40:rows.filter(r=>r.partyMagicEnvelope.totalOverflow).length,envelopeOver10:rows.filter(r=>r.partyMagicEnvelope.lineOverflow).length},scope:'Exact nearest-center RGB555 at tile-aligned isolated enemy anchors; two original BG palettes and up to two residual OBJ palettes. 7/8 normal and 96x64 boss generalization remain unapproved art candidates. Worst reservation combines independent maxima; no normal-play reachability claim.'};
}

export function battleDisplayAudit(rom){const battle=battleInventory(rom),boss=resolveBoss206(rom);battle.graphics=battle.graphics.map(g=>g.id===206?boss.graphic:g);return {boss:boss.evidence,magic:magicDisplayAudit(rom,battle),colors:enemyColorAudit(rom,battle),scope:'R2 host audit only; runtime/audio untouched; R2 open'};}
