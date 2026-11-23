import {check} from './source.mjs';
import {sourceInputTrace,worldTile} from './composition-inputs.mjs';
import {sharedCompositionPalettes,compileComposition,composePixels,compositionWords} from './npc-composition.mjs';
import {cellJob} from './composition-kernel.mjs';
// Expand the world-aligned source supply, including the fine-scroll margin.
// This is a build-time diagnostic trace, not the live GBC actor producer.
export function worldScene(f){
 const s=f.scene,ox=f.camera[0]>>3,oy=f.camera[1]>>3,attributes=Buffer.alloc(399),original=[];
 for(let y=0;y<19;y++)for(let x=0;x<21;x++){const wx=(ox+x)&127,wy=(oy+y)&127,m=((wx|wy)&64)?s.properties[3]:s.layout[(wy>>1)*32+(wx>>1)];attributes[y*21+x]=s.attrs[m]&3;}
 // Source graphics may use all 256 tile IDs: keep IDs as words with +128.
 const ids=Array.from({length:399},(_,at)=>{const wx=(ox+at%21)&127,wy=(oy+Math.floor(at/21))&127,m=((wx|wy)&64)?s.properties[3]:s.layout[(wy>>1)*32+(wx>>1)];return s.metas[m*4+(wy&1)*2+(wx&1)]+128;});
 for(const a of f.actors.filter(a=>a.visible).sort((a,b)=>a.order-b.order)){
  let x=(a.x-ox*8)&1023,y=(a.y-oy*8)&1023;if(x>=512)x-=1024;if(y>=512)y-=1024;
  a.quads.forEach((q,i)=>original.push({x:x+(i&1)*8,y:y+(i>>1)*8,h:8,palette:q.attr&3,behind:!!(q.attr&32),pixels:q.pixels}));
 }
 return {width:168,height:152,map:ids,attributes,background:s.graphics,bgPalette:s.bgPalette,objPalette:s.objPalette,original};
}
export function windowAssets(rom,assets){
 const all=sourceInputTrace(rom,assets),indices=[0,1,8,16,32,48,64,80,96,97,98,99],traces=indices.map(i=>all[i]),scenes=traces.map(worldScene),palettes=sharedCompositionPalettes(scenes,{maxPalettes:7}),jobs=[],keys=new Map(),frames=[];
 for(let index=0;index<scenes.length;index++){
  const scene=scenes[index],f=traces[index],c=compileComposition(scene,{palettes}),pixels=composePixels(scene),words=compositionWords(c),ids=[];
  check(words.every((v,i)=>v===pixels[i]),'Lossless four-palette partition');
  for(let cell=0;cell<399;cell++){
   const oracle=worldTile(f,((f.camera[0]>>3)+cell%21)&127,((f.camera[1]>>3)+Math.floor(cell/21))&127);
   for(let p=0;p<64;p++)check(pixels[(Math.floor(cell/21)*8+(p>>3))*168+(cell%21)*8+(p&7)]===oracle.readUInt16LE(p*2),'World supply pixel mismatch');
   const j=cellJob(scene,c,cell,pixels),key=j.bytes.toString('hex');let id=keys.get(key);
   check(j.bytes.length<=256,'Window-phase cell input exceeds borrowed 256-byte region');
   if(id===undefined){id=jobs.length;keys.set(key,id);jobs.push({...j,static:j.layers===0});}else check(jobs[id].expected.equals(j.expected),'Canonical key collision');ids.push(id);
  }
  const rgb=Buffer.alloc(160*144*3),sx=f.camera[0]&7,sy=f.camera[1]&7;
  for(let y=0;y<144;y++)for(let x=0;x<160;x++){const v=pixels[(y+sy)*168+x+sx],r=v&31,g=(v>>5)&31,b=v>>10;rgb.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],(y*160+x)*3);}
  check(new Set(ids).size<=128,'Resident capacity');
  frames.push({label:f.label,trace:indices[index],camera:f.camera,scroll:[sx,sy],ids,attributes:c.attributes,palette:Buffer.concat([c.bgPalette,c.objPalette]),rgb,stats:c.stats});
 }
 for(let i=0;i<frames.length;i++)check(new Set([...frames[i].ids,...frames[(i+1)%frames.length].ids]).size<=128,'Active/next union capacity');
 return {jobs,frames,palettes:palettes.length};
}
