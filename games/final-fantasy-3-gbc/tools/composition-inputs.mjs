import {check} from './source.mjs';
import {stateCpu,sourceInitialState,segment} from './state-source.mjs';
import {fieldAddresses} from './exploration-source.mjs';
import {npcSprites} from './npc-motion-source.mjs';
import {sourceObjects} from './object-assets.mjs';
import {mapSelection} from './map-assets.mjs';
import {cgbPalette} from './field-source.mjs';
const wrap=n=>n&1023;
const empty=()=>({x:0,y:0,visible:0,order:0,shape:Buffer.alloc(12),quads:[]});
const offset=(bank,address)=>16+bank*8192+(address&8191);
function actor(camera,quads,identity,order){
 if(!quads.length)return {...empty(),order};
 const x=quads[0].x,y=quads[0].y;check(quads.length===4&&quads.every((q,i)=>q.x===x+(i&1)*8&&q.y===y+(i>>1)*8),'Source walking quad shape');
 const shape=Buffer.from([...identity,...quads.map(q=>q.tile),...quads.map(q=>q.attr)]);check(shape.length===12,'Actor identity');
 return {x:wrap(camera[0]+x),y:wrap(camera[1]+y),visible:1,order,shape,quads};
}
function tile(bytes,tile,attr,nes){
 check(tile>=0&&tile*16+16<=bytes.length,'Source graphic tile '+tile+'/'+bytes.length);
 return Uint8Array.from({length:64},(_,i)=>{const x=attr&64?7-(i&7):i&7,y=attr&128?7-(i>>3):i>>3,j=tile*16+(nes?y:y*2);return ((bytes[j]>>(7-x))&1)|(((bytes[j+(nes?8:1)]>>(7-x))&1)<<1);});
}
export function packInput(f){
 const out=Buffer.alloc(260);out.writeUInt16LE(f.camera[0],0);out.writeUInt16LE(f.camera[1],2);out.writeUInt16LE(f.epoch,4);out[6]=f.valid?1:0;
 f.actors.forEach((a,i)=>{const p=8+i*18;out.writeUInt16LE(a.x,p);out.writeUInt16LE(a.y,p+2);out[p+4]=a.visible;out[p+5]=a.order;a.shape.copy(out,p+6);});return out;
}
export function sourceInputTrace(rom,assets){
 const frames=[],routes=[{world:0,map:29,x:3,y:3,guest:1},{world:2,map:87,x:3,y:61,guest:1},{world:0,map:139,x:61,y:18,guest:1}];
 let epoch=0;
 for(const route of routes){
  const {world,map}=route,g=assets.groups,s=mapSelection(world,map),properties=g.properties[s.property],state=sourceInitialState(rom),objects=sourceObjects(rom,assets,world,map,state.subarray(128,192));
  const c=stateCpu(rom);c.m.set(state,0x6000);c.m[0x600b]=route.guest;c.m[0x2d]=1;c.m[0x78]=world;c.m[0x29]=route.x;c.m[0x2a]=route.y;c.m[0x33]=4;c.m.set(properties,0x780);
  c.banks=[0x3a,0x3b,0x3e,0x3f];c.call(0xba15);segment(c,0xba5d,0xbaf1);
  const playerBank=c.m[0x67],playerAddress=c.m[0x66]<<8,guestBank=c.m[0x65],guestAddress=c.m[0x64]<<8;
  const player=rom.subarray(offset(playerBank,playerAddress),offset(playerBank,playerAddress)+256),guest=rom.subarray(offset(guestBank,guestAddress),offset(guestBank,guestAddress)+256);
  c.banks=[0x3a,0x3b,0x3e,0x3f];c.call(0x9091);const palettes=cgbPalette([...c.m.subarray(0x3d0,0x3e0)]);
  const scene={world,map,properties,layout:g.layout[g.selection[s.selection][0]],metas:g.metas[properties[0]>>5],attrs:g.attributes[properties[0]>>5],graphics:Buffer.concat([g.graphics[g.selection[s.selection][1]],g.font[0]]),bgPalette:g.palette[s.property],objPalette:palettes};
  let tick=0;epoch++;
  function snap(label){
   const camera=[wrap(((c.m[0x29]+7)&63)*16+c.m[0x35]-72),wrap(((c.m[0x2a]+7)&63)*16+c.m[0x36]-64)],actors=[];
   const f=Buffer.alloc(75);fieldAddresses.forEach((address,i)=>f[i]=c.m[address]);f[32]=c.m[0xf0];f[23]=world;
   // Execute the original draw consumers; raw OAM keeps tile/flip/priority and
   // original palette bits. Player palettes 0/1, guest/NPC palettes 2/3.
   c.m[0x26]=0;c.m.fill(0xf0,0x200,0x300);c.y=0;c.call(0xd8d3);const end=c.m[0x26];c.call(0xdb58);
   for(const [start,stop,bytes,kind,bank,address]of [[0,end,player,0,playerBank,playerAddress],[end,c.m[0x26],guest,1,guestBank,guestAddress]]){
    const qs=[];for(let p=start;p<stop;p+=4){const t=c.m[0x201+p]-(kind?16:0),attr=c.m[0x202+p];qs.push({x:c.m[0x203+p]-40,y:c.m[0x200+p]+1-48,tile:t,attr,pixels:tile(bytes,t,attr,true)});}
    actors.push(actor(camera,qs,[kind,bank,address>>8,0],kind));
   }
   for(let slot=0;slot<12;slot++){
    const k=slot*16,order=2+((tick&1)?11-slot:slot),id=objects.part1[k+10],gfx=g.npcSelection[0][id+(world>=2?256:0)],bytes=g.npcGraphics[gfx];
    const qs=objects.part1[k]?npcSprites(rom,f,objects.part1,objects.part2,k).map(([x,y,t,attr])=>({x,y,tile:(t-k)&255,attr,pixels:tile(bytes,(t-k)&255,attr,false)})):[];
    actors.push(actor(camera,qs,[2,gfx&255,gfx>>8,0],order));
   }
   frames.push({label:world+':'+map+':'+label,camera,epoch,valid:true,actors,scene,tick,source:{consumer:'3F/E5EB,E900; 3D/B6DA,B78A; 3E/D8D3,DB58; 3B/B1EE',kind:'Original function-boundary trace, movement accepted at entry; no collision/story playthrough',playerGraphics:[playerBank,playerAddress],guestGraphics:[guestBank,guestAddress],guestState:[...c.m.subarray(0xe1,0xe5),c.m[0xac],c.m[0xad],c.m[0x13],c.m[0x14],c.m[0xae]]}});
  }
  snap('initial');
  // Deliberately selected accepted-step boundaries, then original pixel and
  // follow logic. Direction/speed are inputs, not invented traversal rules.
  for(const direction of [1,1,4,2,8,2]){
   c.m[0x33]=direction;c.m[0x34]=1;c.banks=[0x3c,0x3d,0x3e,0x3f];c.call(0xb6da);
   for(let step=0;step<16;step++){
    c.call(0xe5eb);if((c.m[0x35]|c.m[0x36])===8)c.call(0xe900);c.m[0xf0]=++tick&255;c.banks=[0x3c,0x3d,0x3e,0x3f];c.call(0xb78a);snap('step-'+tick);
   }
  }
  // Source hide flags are consumed by D8D3/DB58; no successful no-op.
  c.m[0x7e]=64;snap('hide-guest');c.m[0x7e]=128;snap('hide-both');c.m[0x7e]=0;snap('show-both');
 }
 return frames;
}
const inView=(f,x,y)=>((x-(f.camera[0]>>3))&127)<21&&((y-(f.camera[1]>>3))&127)<19;
const touches=(a,x,y)=>a.visible&&(((x*8-a.x)&1023)<16||((a.x-x*8)&1023)<8)&&(((y*8-a.y)&1023)<16||((a.y-y*8)&1023)<8);
export function dirtyOracle(before,after){
 const dirty=Buffer.alloc(133),changed=[];let count=0,order=false;
 const full=!before?.valid||before.epoch!==after.epoch,scroll=full||before.camera.some((v,i)=>v!==after.camera[i]);let objects=scroll;
 if(!full)for(let i=0;i<14;i++){const a=before.actors[i],b=after.actors[i];if(a.visible!==b.visible||((a.visible||b.visible)&&(a.x!==b.x||a.y!==b.y||!a.shape.equals(b.shape)))){changed.push(a,b);objects=true;}if((a.visible||b.visible)&&a.order!==b.order){objects=true;order=true;}}
 for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(inView(after,x,y)&&(full||!inView(before,x,y)||changed.some(a=>touches(a,x,y))||(order&&[before,after].some(f=>f.actors.filter(a=>touches(a,x,y)).length>1)))){dirty[(y&31)*4+((x&31)>>3)]|=1<<(x&7);count++;}
 dirty.writeUInt16LE(count,128);dirty[130]=+scroll;dirty[131]=+objects;dirty[132]=+full;return dirty;
}
export function worldTile(frame,x,y){
 const s=frame.scene,m=((x|y)&64)?s.properties[3]:s.layout[(y>>1)*32+(x>>1)],id=s.metas[m*4+(y&1)*2+(x&1)],palette=s.attrs[m]&3;
 const out=Buffer.alloc(128),actors=frame.actors.filter(a=>a.visible).sort((a,b)=>a.order-b.order);
 for(let p=0;p<64;p++){
  const px=p&7,py=p>>3,at=id*16+py*2,bit=7-px,index=((s.graphics[at]>>bit)&1)|(((s.graphics[at+1]>>bit)&1)<<1);let color=s.bgPalette.readUInt16LE((palette*4+index)*2);
  for(const a of actors){const ax=(x*8+px-a.x)&1023,ay=(y*8+py-a.y)&1023;if(ax>=16||ay>=16)continue;const q=a.quads[(ay>>3)*2+(ax>>3)],n=q.pixels[(ay&7)*8+(ax&7)];if(!n)continue;if(!(q.attr&32)||!index)color=s.objPalette.readUInt16LE(((q.attr&3)*4+n)*2);break;}
  out.writeUInt16LE(color,p*2);
 }return out;
}
export function verifyDirtyPixels(before,after,mask){
 let changes=0;for(let dy=0;dy<19;dy++)for(let dx=0;dx<21;dx++){const x=((after.camera[0]>>3)+dx)&127,y=((after.camera[1]>>3)+dy)&127;
  if(!before||before.epoch!==after.epoch||!inView(before,x,y)||!worldTile(before,x,y).equals(worldTile(after,x,y))){changes++;check(mask[(y&31)*4+((x&31)>>3)]&(1<<(x&7)),'Missed source pixels '+after.label+' tile '+x+','+y);}
 }return changes;
}
