import {check} from './source.mjs';import {encodeTile} from './npc-composition.mjs';import {literal} from './battle-select-view-assets.mjs';import {drawOriginalUiText,uiPixels} from './battle-action-ui.mjs';
// Five tile columns, five rows, at (120,106). Base frame is preserved;
// four independent two-tile-high labels share only transparent mask pixels.
function tiles(p,w,h){const out=[];for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const a=[];for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)a.push(p[(y+yy)*w+x+xx]);out.push(encodeTile(a));}return Buffer.concat(out);}
export function partyUiAssets(profile,text){const pixels=uiPixels(profile.uiRaster,3),base=new Uint8Array(40*40),t=profile.source.menuTiles;
 for(let y=0;y<40;y++)for(let x=0;x<40;x++)base[y*40+x]=pixels[(y+8)*160+120+x];
 const labels=[255,4,5,6].map(command=>{const p=new Uint8Array(40*16),words=command===255?profile.source.hp[0].value.slice(5):literal(text,0x620+command);drawOriginalUiText(p,40,t,words,3,3,{compact:command===255,hangul:text.glyphs});return tiles(p,40,16);});
 return {base:tiles(base,40,40),masks:Buffer.concat(labels),tileFirst:103,tileCount:25};
}
// Pixel reference deliberately redraws labels with the text renderer, not
// the native mask compositor or its generated masks.
export function partyUiRaster(profile,text,commands){const ui={...profile.uiRaster,layers:profile.uiRaster.layers.map(l=>({...l,pixels:Uint8Array.from(l.pixels)}))},hp=ui.layers[0].pixels,t=profile.source.menuTiles;
 for(let i=0;i<4;i++){const cmd=commands[i];check([255,4,5,6].includes(cmd),'Unimplemented party HP label');drawOriginalUiText(hp,112,t,cmd===255?profile.source.hp[i].value.slice(5):literal(text,0x620+cmd),75,3+i*8,{compact:cmd===255,hangul:text.glyphs});}return ui;
}
