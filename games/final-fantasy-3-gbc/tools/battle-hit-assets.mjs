import {initializedBattle} from './battle-transition-source.mjs';
import {residentEnemy} from './battle-resident-bg.mjs';
import {nativePartyTiles} from './battle-party-oam-source.mjs';
import {check} from './source.mjs';
// Resource variants, not timed frames: A738 changes one selected enemy's
// attribute cells. Preserve mixed boundary colors through the resident compiler.
export function hitFlashAssets(rom,p,bg){
 const patterns=Array.from({length:bg.patterns.length/16},(_,i)=>bg.patterns.subarray(i*16,i*16+16)),ids=new Map(patterns.map((b,i)=>[b.toString('hex'),i])),maps=[],objects=[],attributes=[];
 const {m}=initializedBattle(rom,{formation:p.formation,counts:p.counts,back:p.back,rows:[0,1,0,1],terrain:0,partyStatus:p.partyStatus});m.call(0xb469);m.call(0xb304);m.call(0xa6b1);m.call(0xaf34);const normal=Buffer.from(m.c.m.subarray(0x7d27,0x7d67));
 for(let enemy=0;enemy<8;enemy++){
  m.c.m[0x7e8f]=128>>enemy;m.c.m[0x7e90]=3;m.call(0xa738);m.call(0xaf34);
  attributes.push(Buffer.from(m.c.m.subarray(0x7d27,0x7d67)));
  const a=residentEnemy({...p,initialPpu:Buffer.from(m.ppu.bytes),frames:[]}),remap=[];
  for(let i=0;i<a.patterns.length;i+=16){const b=a.patterns.subarray(i,i+16),key=b.toString('hex');if(!ids.has(key)){check(patterns.length<256,'Flash resident tile capacity');ids.set(key,patterns.length);patterns.push(b);}remap.push(ids.get(key));}
  const map=Buffer.alloc(704);for(let y=0;y<11;y++)for(let x=0;x<32;x++){map[y*32+x]=remap[a.maps[y*56+x]];map[352+y*32+x]=a.maps[616+y*56+x];}maps.push(map);
  const oam=Buffer.alloc(64);let n=0;for(const o of a.objects){if(o.x>=160)continue;check(n<16,'Flash residual OAM capacity');oam.set([o.y+16,o.x+8,remap[o.tile],o.attr],n++*4);}objects.push(oam);
 }
 bg.patterns=Buffer.concat(patterns);bg.stats.tiles=patterns.length;bg.stats.assetBytes=bg.patterns.length+bg.maps.length+bg.residual.length+bg.palette.length;
 return {normal,maps:Buffer.concat(maps),objects:Buffer.concat(objects),attributes:Buffer.concat(attributes)};
}
export function hitJobAssets(rom){const {m}=initializedBattle(rom,{formation:3,rows:[0,1,0,1],terrain:0}),out=[];
 for(let job=0;job<22;job++){m.c.m[0x7d8b]=job;m.c.x=0;m.call(0xa9b1);out.push(nativePartyTiles(m.ppu.bytes.subarray(0x1390,0x13f0)));}return Buffer.concat(out);
}
