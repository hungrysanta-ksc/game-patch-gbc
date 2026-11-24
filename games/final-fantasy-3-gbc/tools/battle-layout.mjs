import {check} from './source.mjs';
// One formation-wide translation. Preserve relative slots and art dimensions;
// Require the requested edge slack instead of cutting off a visible enemy.
// Do not turn 8px retreat into a 1px shift: changing the tile-grid phase made
// representative formation 47 fail more OBJ states (36 -> 43).
export function rearLayout(pixels,{width=168,height=152,requested=8}={}){
 check([0,8,16].includes(requested),'Rear placement request');
 let left=160,right=-1,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<160;x++)if(pixels[y*width+x]){left=Math.min(left,x);right=Math.max(right,x);count++;}
 return {requested,shift:count&&left>=requested?requested:0,left:count?left:null,right:count?right:null,visiblePixels:count};
}
export const rearX=(x,layout,back=false)=>x+(back?layout.shift:-layout.shift);
export const rearAnchor=([x,y],layout,back=false)=>[rearX(x,layout,back),y];
