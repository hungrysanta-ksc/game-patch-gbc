// Reference execution and immutable command-entry resources. Observed frames
// stay outside the ROM; the native consumer advances its own tail/OAM state.
import {check} from './source.mjs';
import {initializedBattle} from './battle-transition-source.mjs';
import {tailReference} from './battle-entry-tail-source.mjs';
import {partyEntryOracle,partyOamInput,nativePartyTiles} from './battle-party-oam-source.mjs';
import {statusOamReference} from './battle-status-oam-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {scenePixels} from './battle-scene-pixels.mjs';
import {offset} from './render-budget-source.mjs';
export function statusVideoOracle(rom,options){
 const p=partyEntryOracle(rom,options),tail=tailReference(rom,options);
 check(tail.frames.every(f=>(options.confusion?[2,3,4,5,6,7]:options.stone?[2,3,4,7]:[2,7]).includes(f.state[67])&&(options.stone||!f.work||f.work[1]===3)),'Native status probe requires cache-hit non-stone tail');
 const {m}=initializedBattle(rom,{formation:3,rows:[0,1,0,1],terrain:0,...options});if(options.normalized)for(let i=0;i<4;i++){m.c.m[0x7d9b+i*2]=options.normalized[i];m.c.m[0x7d9c+i*2]=options.second?.[i]??0;}if(options.cache)m.c.m.set(options.cache,0x7da3);m.call(0xb469);const c=m.c;if(options.clearAfter){if(options.clearAfter===2){for(let i=0;i<4;i++)c.m[0x7d9b+i*2]&=247;}else c.m.fill(0,0x7d9b,0x7da3);m.call(0xb5b8);}
 const before=Buffer.from(m.ppu.bytes);m.begin();m.call(0xb304);m.finish();
 const commandPpu=Buffer.from(m.ppu.bytes),commandPalette=cgbPalette(commandPpu.subarray(0x3f10,0x3f20));
 const ranges=m.waits.flatMap(w=>w.ranges).filter(r=>r.kind==='chr');
 const tiles=nativePartyTiles(commandPpu.subarray(0x1000,0x2000)),blocks=[];
 // Preserve the source loader's write ranges (including identical bytes).
 for(const r of ranges){check(r.begin>=0x1000&&r.end<=0x2000&&r.begin%16===0&&r.end%16===0,'Command CHR tile boundary');
  for(let at=r.begin;at<r.end;at+=64){const n=Math.min(64,r.end-at);blocks.push(Buffer.concat([Buffer.from([(at-0x1000)&255,(at-0x1000)>>8,n]),tiles.subarray(at-0x1000,at-0x1000+n)]));}
 }
 // Command graphics must not replace any party-owned pattern.
 for(let at=0x1010;at<0x1390;at++)check(before[at]===commandPpu[at],'Command/party CHR ownership');
 const input=Buffer.from([...c.m.subarray(0xc0,0xc8),...c.m.subarray(0x7db7,0x7dbb),...c.m.subarray(0x7e0f,0x7e13),...c.m.subarray(0x7df7,0x7e07),c.m[0x78c3],c.m[0xac],c.m[0xb7]]);
 check(input[33]===1&&input.subarray(12,16).every(v=>!v),'Original command enable/target clear');
 check(commandPalette.subarray(0,24).equals(p.pal.subarray(0,24)),'Only cursor palette changes at B331');
 for(let slot=0;slot<4;slot++){const id=input[8+slot];if(id===255)continue;
  const begin=offset(0x0d,0xb240+id*64);check(commandPpu.subarray(0x1490+slot*64,0x14d0+slot*64).equals(rom.subarray(begin,begin+64)),'Original status CHR source and destination');
 }
 const extra=tail.frames.map(f=>{check(f.published,'Completed source wait required');return {state:f.state.subarray(0,35),original:f.published.oam.subarray(160),ppu:f.published.ppu,rawPalette:f.published.ppu.subarray(0x3f10,0x3f20),palette:cgbPalette(f.published.ppu.subarray(0x3f10,0x3f20)),icons:Buffer.alloc(32,240),tail:f.state,work:f.work,source:f.source,stage:1};});
 let previous=Buffer.alloc(64,240);const commandParty=partyOamInput(c);
 for(let i=0;i<32;i++){input[34]=(c.m[0xb7]+i)&255;const r=statusOamReference(rom,input,previous);previous=r.oam;
  extra.push({state:tail.terminal.state.subarray(0,35),original:Buffer.from(m.physicalOam.subarray(160)),ppu:commandPpu,rawPalette:commandPpu.subarray(0x3f10,0x3f20),palette:commandPalette,icons:r.oam.subarray(0,32),status:Buffer.concat([input.subarray(0,34),Buffer.from([r.counter])]),stage:2});
 }
 input[34]=c.m[0xb7];
 return {...p,extra,clearAfter:Number(options.clearAfter)||0,refreshIndex:tail.refreshIndex,tailSeed:tail.seed,statusSeed:input,commandParty,commandPalette,commandTiles:tiles,commandBlocks:Buffer.concat(blocks),commandRanges:ranges};
}
export function statusNativeOam(source,back){const out=Buffer.alloc(32);
 for(let i=0;i<8;i++){const [sy,t,a,sx]=source.subarray(i*4,i*4+4),slot=i>>1,x=sx-(back?16:80),y=sy+1-[44,72,100,128][slot]+[10,34,58,82][slot];
  check(sy>=239||!(a&0x3c),'Status native attributes');out.set([sy>=239||x<=-8||x>=160||y<=-8||y>=144?0:y+16,(x+8)&255,t,(a&3)|((a&64)>>1)|((a&128)>>1)],i*4);
 }return out;
}
export function statusSceneRgb(p,f,audit){const c={m:new Uint8Array(65536)};c.m.fill(240,0x200,0x300);c.m.set(f.original,0x2a0);c.m.set(f.icons,0x200);c.m[15]=f.state[29];c.m[7]=f.state[32];
 const scene=scenePixels(c,{bytes:f.ppu},{back:p.back,statusOwners:true,layout:{shift:8},terrainHeight:11}),out=Buffer.alloc(160*144*3);
 for(let y=0;y<144;y++)for(let x=0;x<160;x++){const v=scene.pixels[y*168+x],r=v&31,g=v>>5&31,b=v>>10;out.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],(y*160+x)*3);}
 check(scene.statusCoverage.sourcePixels===scene.statusCoverage.viewportPixels,'Whole status dots');
 if(audit)Object.assign(audit,{party:scene.partyCoverage,overlap:scene.partyEnemyOverlapPixels});return out;
}
