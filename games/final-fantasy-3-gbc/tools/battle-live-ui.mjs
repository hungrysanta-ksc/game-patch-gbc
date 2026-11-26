import {check} from './source.mjs';
import {addTextAssets,fontMap,glyphFor} from './korean-text.mjs';
import {originalActionFlow} from './battle-action-source.mjs';
import {actionUi} from './battle-action-assets.mjs';
import {compactOriginalBox,originalActionUi,uiPixels,projectMessageWindows} from './battle-action-ui.mjs';
import fs from 'node:fs/promises';

// Source call boundaries are verification inputs, never a movie linked into
// the cartridge. Runtime owns five text records and four mutable HP rows.
export async function liveUiAssets(rom,config){
 const {text}=await addTextAssets(rom,{groups:{},provenance:[]},config,{verify:false});
 const font=fontMap(await fs.readFile(config.font));
 const names=['루네스','아르크','레피아','잉구스'].map(s=>Array.from(s,ch=>glyphFor(ch,font)));
 const flows=[false,true].map(enemy=>originalActionFlow(rom,{enemy}));
 const resolve=words=>words[0]>=128&&words[0]<132&&words.slice(1).every(v=>v===255)?names[words[0]-128]:words;
 const profiles=flows.map(flow=>{const ui=actionUi(text,flow);ui.hp.forEach((r,i)=>r.name=names[i]);ui.windows=ui.windows.map(resolve);return {flow,ui};});
 const rectangles=[{x:48,y:2,w:112,h:38},...projectMessageWindows(flows[0].windowDescriptors).map(r=>({...r,y:r.y-6}))];
 const boxes=Buffer.concat(rectangles.map(r=>{const pixels=compactOriginalBox(flows[0].menuTiles,r.w,r.h),packed=Buffer.alloc(r.w*r.h/4);for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const at=y*r.w/4+(x>>3)*2,v=pixels[y*r.w+x];if(v&1)packed[at]|=128>>(x&7);if(v&2)packed[at+1]|=128>>(x&7);}return packed;}));
 const ids=[255,...new Set(profiles.flatMap(p=>[...p.ui.hp.flatMap(r=>[...r.name,...r.value]),...p.ui.windows.flat()]))].filter((v,i,a)=>a.indexOf(v)===i);
 check(ids.length<256,'Live UI glyph dictionary');const index=id=>{const n=ids.indexOf(id);check(n>=0,'Missing live UI glyph');return n;};
 const glyphs=Buffer.concat(ids.map(id=>id>=256?text.glyphs.subarray(id*16,id*16+16):flows[0].menuTiles.subarray(id*16,id*16+16)));
 const advances=Buffer.from(ids.map(id=>id===255?3:8));
 const seed=Buffer.from(profiles[0].ui.hp.flatMap(r=>[...r.name,...Array(6-r.name.length).fill(255),...r.value].map(index)));
 check(seed.length===60,'HP record ABI');
 function expected(ui,live){const raster=originalActionUi(ui,flows[0],text,{smallHp:true}),pixels=uiPixels(raster,live);return Buffer.from(pixels.subarray(6*160,46*160));}
 const cases=[];
 for(const [profile,{flow,ui}]of profiles.entries()){
  const state={hp:ui.hp.map(r=>({...r})),windows:Array.from({length:5},()=>[])};let live=0;
  for(const e of flow.events.filter(e=>e.kind==='open'||e.kind==='close')){
   const words=e.kind==='open'?ui.windows[e.window]:[];state.windows[e.window]=words;live=e.live;
   cases.push({profile,sourceBoundary:e.at,kind:e.kind,window:e.window,request:[e.kind==='open'?1:2,e.window,words.length,...words.map(index)],pixels:expected(state,live).toString('hex'),live});
  }
  for(const h of flow.hp.slice(4)){const row=state.hp[h.slot];row.value=[...h.raw.subarray(8,17)];cases.push({profile,kind:'hp',window:h.slot,request:[3,h.slot,15,...[...row.name,...Array(6-row.name.length).fill(255),...row.value].map(index)],pixels:expected(state,live).toString('hex'),live});}
 }
 for(const c of cases){const top=c.kind==='hp'?5+c.window*8:rectangles[c.window+1].y,h=c.kind==='hp'?8:14;c.patternBytes=(Math.floor((top+h-1)/8)-Math.floor(top/8)+1)*320;}
 let offset=0;const rect=rectangles.map(r=>{const b=[r.x,r.y,r.w,r.h,offset&255,offset>>8];offset+=r.w*r.h/4;return b;});
 return {boxes,glyphs,advances,seed,rect:Buffer.from(rect.flat()),palette:flows[0].menuPalette,initial:expected(profiles[0].ui,0),cases,glyphCount:ids.length,source:flows[0].source,namesPolicy:'Explicit Korean party-name inputs for the diagnostic; not canonical names read from the Japanese ROM.'};
}

export function liveUiRgb(rgb,pixels,palette){const out=Buffer.from(rgb);for(let y=0;y<40;y++)for(let x=0;x<160;x++){if(y<2)continue;const v=palette.readUInt16LE(pixels[y*160+x]*2),at=((y+104)*160+x)*3,r=v&31,g=v>>5&31,b=v>>10;out.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],at);}return out;}
