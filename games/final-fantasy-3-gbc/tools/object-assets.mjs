import {check,hash} from './source.mjs';
import {Driver6502} from './driver6502.mjs';
import {convertTiles,kinds,mapSelection} from './map-assets.mjs';
import {cgbPalette} from './field-source.mjs';
import {segment} from './state-source.mjs';

export const objectKinds=[...kinds,'placements','npcGraphics','npcSelection','npcSpeed','npcPoses','npcPalette'];
const offset=(bank,cpu)=>16+bank*8192+(cpu&8191);
function cpu(rom){const c=new Driver6502(rom);c.banks=[0x3a,0x3b,0x3e,0x3f];return c;}
function ppuWriter(c){
 const bytes=Buffer.alloc(8192);let address=0,high=true;
 const read=c.read.bind(c),write=c.write.bind(c);
 c.read=a=>{if(a===0x2002){high=true;return 0;}return read(a);};
 c.write=(a,v)=>{if(a===0x2006){address=high?v<<8:(address&0xff00)|v;high=!high;}else if(a===0x2007){check(address<8192,'NPC PPU bounds');bytes[address++]=v;}else write(a,v);};
 return bytes;
}
export function placement(rom,id){
 check(Number.isInteger(id)&&id>=0&&id<256,'NPC placement ID');
 const pointer=rom.readUInt16LE(0x58010+id*2)|0x8000,begin=0x58010+pointer-0x8000;
 check(begin>=0x58a90&&begin<0x59953,'NPC placement pointer outside region');
 let end=begin;
 for(let n=0;n<=12;n++,end+=4){
  check(end<0x59953,'NPC placement terminator boundary');
  if(rom[end]===0)return {begin,end:end+1,data:Buffer.from(rom.subarray(begin,end+1))};
  check(n<12&&end+4<=0x59953,'NPC placement exceeds 12 slots');
  check(rom[end+1]<32&&rom[end+2]<32,'NPC placement coordinate');
 }
 throw Error('NPC placement terminator');
}
export function makeObjectAssets(rom,maps,{verify=true}={}){
 const groups={...maps.groups},provenance=[...maps.provenance],unresolved=[],comparisons={graphics:0,palettes:0,selectors:0,poses:0};
 for(const k of objectKinds.slice(kinds.length))groups[k]=[];
 const add=(kind,id,bytes,bank,cpuAddress,source,consumer,line)=>{
  check(groups[kind].length===id,'NPC asset sequence');groups[kind].push(Buffer.from(bytes));
  provenance.push({kind,id,bytes:bytes.length,sha256:hash(bytes),bank,cpu:cpuAddress,source,consumer,asmRef:'ff3j.asm:'+line});
 };
 for(let id=0;id<256;id++){
  const pointer=rom.readUInt16LE(0x58010+id*2)|0x8000;
  if(id>=197){check(pointer===0x9943,'Unresolved NPC pointer changed');unresolved.push({id,pointer,reason:'Points to NPC script data, not a terminated placement list',mapReferences:[]});continue;}
  const p=placement(rom,id);add('placements',id,p.data,0x2c,pointer,[{offset:p.begin,bytes:p.data.length}],'3B/B2FD..B3F7',37160);
 }
 for(let id=0;id<512;id++)check(groups.properties[id][4]<197,'Map references unresolved NPC placement '+id);
 for(let id=0;id<=116;id++){
  const bank=id<64?0x0e:id<88?0x0a:0x0d;
  const at=id<64?0x1c010+id*256:id<88?0x14010+(id-64)*128:0x1a810+(id-88)*64;
  const size=id<64?256:id<88?128:64,chunk=rom.subarray(at,at+size),nes=Buffer.concat(Array.from({length:256/size},()=>chunk));
  if(verify){const c=cpu(rom),ppu=ppuWriter(c);c.a=id;c.call(0xdf50);check(nes.equals(ppu.subarray(0x1200,0x1300)),'NPC source graphics '+id);comparisons.graphics++;}
  add('npcGraphics',id,convertTiles(nes),bank,0x8000+at-offset(bank,0x8000),[{offset:at,bytes:size}],'3E/DF50..DFD3',51506);
 }
 add('npcSelection',0,rom.subarray(0x1410,0x1610),0,0x9400,[{offset:0x1410,bytes:512}],'3E/DF08..DF10, DF4E',51466);
 add('npcSpeed',0,rom.subarray(0x3e10,0x4010),1,0xbe00,[{offset:0x3e10,bytes:512}],'3B/B3C5..B3E6',37278);
 const poseAt=offset(0x3b,0xb41a),poses=rom.subarray(poseAt,poseAt+256);
 add('npcPoses',0,poses,0x3b,0xb41a,[{offset:poseAt,bytes:256}],'3B/B3F8; 3E/DA3A; 3B/AEAD',37340);
 for(let id=0;id<512;id++){
  const p=groups.properties[id],colors=[];
  for(let pal=0;pal<2;pal++){colors.push(15);for(let color=0;color<3;color++)colors.push(rom[0x1110+color*256+p[8+pal]]);}
  if(verify){const c=cpu(rom);c.m.set(p,0x780);c.m[0x2d]=1;c.m[0x78]=id>=256?2:0;c.call(0x9091);for(let pal=0;pal<2;pal++)for(let color=1;color<4;color++)check(colors[pal*4+color]===c.m[0x3d8+pal*4+color],'NPC source palette');comparisons.palettes++;}
  add('npcPalette',id,cgbPalette(colors),0,0x9100,[{offset:0x4018+id*16,bytes:2},{offset:0x1110,bytes:768}],'3A/9123..9130',33227);
 }
 if(verify){
  const c=cpu(rom);
  for(let world=0;world<256;world++)for(let id=0;id<256;id++){
   c.m[0x78]=world;segment(c,0xdf08,0xdf12);
   check(c.m[0x8d]===0x94+(world>=2?1:0),'NPC graphics world selector');
   c.banks[0]=1;c.m[0x8e]=0;c.m[0x8f]=0x70;c.m[0x700a]=id;segment(c,0xb3ca,0xb3e9);
   const speed=rom[0x3e10+id+(world?256:0)];check(c.m[0x7102]===(speed&15)&&c.m[0x7103]===(speed>>4),'NPC speed selector '+JSON.stringify({world,id,speed,actual:[c.m[0x7102],c.m[0x7103]]}));
   comparisons.selectors++;
  }
  // Pose/quadrant/flip/priority composition at an onscreen anchor, no movement.
  for(let direction=0;direction<4;direction++)for(let pal=0;pal<4;pal++)for(let frame=0;frame<2;frame++)for(let terrain=0;terrain<64;terrain++){
   const c=cpu(rom),base=[0x3a,0x4a,0x2a,0x1a][direction];
   c.m[0x40]=80;c.m[0x41]=76;c.m[0x80]=base+frame*8;c.m[0x81]=0xb4;c.m[0x82]=0x20;c.m[0x7105]=pal*64;c.m[0x7101]=terrain;c.call(0xaead);
   const pos=(base-0x1a)+pal*64+frame*8;
   for(let q=0;q<4;q++){const sourceQ=[0,2,1,3][q],a=q*4,attr=poses[pos+sourceQ*2+1]^((terrain&(q<2?0x14:0x24))?0x20:0);
    check(c.m[0x200+a]===76+(q>=2?8:0)&&c.m[0x201+a]===0x20+poses[pos+sourceQ*2]&&c.m[0x202+a]===attr&&c.m[0x203+a]===80+(q&1)*8,'NPC pose source');}
   comparisons.poses++;
  }
 }
 const placementUsage=groups.placements.map((bytes,id)=>({id,objects:(bytes.length-1)/4,mapPropertyIds:groups.properties.flatMap((p,map)=>p[4]===id?[map]:[])}));
 return {...maps,groups,provenance,objectComparisons:comparisons,unresolved,placementUsage};
}
// Original loader runs with raw pre-event map assets and caller-supplied switches.
// It clears part 1, preserves unspecified part-2 bytes, and loads hidden slots too.
export function sourceObjects(rom,assets,world,id,flags,fill=0xa5){
 const c=cpu(rom),s=mapSelection(world,id),p=assets.groups.properties[s.property],layout=assets.groups.selection[s.selection][0],terrain=assets.groups.collision[p[0]>>5];
 c.m[0x78]=world;c.m[0x4c]=p[3];c.m.set(p,0x780);c.m.set(flags,0x6080);c.m.set(assets.groups.layout[layout],0x7400);
 for(let i=0;i<128;i++)c.m[0x400+i]=terrain[i*2];
 c.m.fill(fill,0x7000,0x7200);c.call(0xb2fd);
 return {part1:Buffer.from(c.m.subarray(0x7000,0x70c0)),part2:Buffer.from(c.m.subarray(0x7100,0x71c0))};
}
