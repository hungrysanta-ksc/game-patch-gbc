// Diagnostic cell inputs retain source BG/OBJ indices, position and order.
// Only the target palette policy is selected on the host. No final pixel masks
// or composed tiles are supplied to the SM83 kernel.
import {check} from './source.mjs';
import {encodeTile,composePixels} from './npc-composition.mjs';
export function cellJob(scene,compiled,cell,pixels=composePixels(scene)){
 const x=(cell%20)*8,y=Math.floor(cell/20)*8,palette=compiled.attributes[cell],target=Array.from({length:4},(_,i)=>compiled.bgPalette.readUInt16LE((palette*4+i)*2));
 const obj=Array.from({length:2},(_,p)=>Array.from({length:4},(_,i)=>scene.objPalette.readUInt16LE((p*4+i)*2)));
 const source=[...Array.from({length:4},(_,i)=>scene.bgPalette.readUInt16LE((scene.attributes[cell]*4+i)*2)),...obj.flat()];
 // Keep the feasibility compiler's selected residual layers. A shared color
 // must not introduce an extra OBJ palette/layer just because it occurs first.
 const layers=compiled.sprites.filter(s=>s.x===x&&s.y===y).map(s=>s.palette);
 const mapping=source.map(v=>{const bg=target.indexOf(v);if(bg>=0)return bg;for(const p of layers){const n=obj[p].indexOf(v,1);if(n>=0)return (p+1)*4+n;}return 255;});
 const quads=scene.original.filter(o=>o.x<x+8&&o.x+8>x&&o.y<y+8&&o.y+o.h>y);
 check(quads.length<=16&&quads.every(o=>o.h===8&&o.palette<2),'Cell layer capacity/format');
 const base=scene.background.subarray((scene.map[cell]-128)*16,(scene.map[cell]-128+1)*16);
 const bytes=Buffer.concat([Buffer.from([quads.length,...mapping]),base,...quads.map(o=>Buffer.concat([Buffer.from([o.x-x,o.y-y,(o.behind?128:0)|o.palette]),encodeTile(o.pixels)]))]);
 const planes=[Array(64).fill(0),Array(64).fill(0),Array(64).fill(0)];
 for(let i=0;i<64;i++){const v=pixels[(y+(i>>3))*160+x+(i&7)],n=target.indexOf(v);if(n>=0)planes[0][i]=n;else{const p=layers.find(p=>obj[p].indexOf(v,1)>=0);check(p!==undefined,'Unrepresentable final pixel');planes[p+1][i]=obj[p].indexOf(v,1);}}
 return {bytes,expected:Buffer.concat(planes.map(encodeTile)),layers:quads.length};
}

// Authored boundary tests, separately labelled from original-game coverage.
export function kernelBoundaryJobs(){
 const tile=n=>encodeTile(Array(64).fill(n)),zero=tile(0),map=Array.from({length:12},(_,i)=>i);
 const obj=(n,flags=0,x=0,y=0)=>Buffer.concat([Buffer.from([x,y,flags]),tile(n)]);
 const job=(label,bg,layers,expected)=>({label,bytes:Buffer.concat([Buffer.from([layers.length,...map]),tile(bg),...layers]),expected:Buffer.concat(expected),layers:layers.length});
 const clip=Array(64).fill(0);clip[0]=1;
 const jobs=[
  job('behind winner blocks later OBJ',1,[obj(1,128),obj(2)],[tile(1),zero,zero]),
  job('transparent first OBJ permits palette 1',0,[obj(0),obj(2,1)],[zero,zero,tile(2)]),
  job('negative XY clips to one pixel',0,[obj(1,0,-7,-7)],[zero,encodeTile(clip),zero]),
  job('sixteen ordered layers',0,[...Array.from({length:15},()=>obj(0)),obj(3)],[zero,tile(3),zero]),
 ];
 jobs.push({label:'reject short input',bytes:Buffer.from([0]),expectedError:1,layers:0});
 jobs.push({label:'reject layer overflow',bytes:Buffer.concat([Buffer.from([17,...map]),zero]),expectedError:1,layers:17});
 jobs.push({label:'reject unmapped visible color',bytes:Buffer.concat([Buffer.from([0,255,...map.slice(1)]),zero]),expectedError:2,layers:0});
 return jobs;
}
