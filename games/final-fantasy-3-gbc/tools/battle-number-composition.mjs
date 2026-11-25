// Preserve source numeral OBJ geometry independently of the 8x8 BG grid.
// Planning consumes only the current background/party and resident palettes.
import {check} from './source.mjs';
import {compilePixelComposition,pixelCompositionPalettes,encodeTile,compositionWords} from './npc-composition.mjs';
export function composeBattleNumbers(frame,{width=168,height=152,objOnlyRow=-1}={}){
 const {basePixels,numberObjects,sourcePalettes}=frame;
 check(numberObjects.length>0&&numberObjects.every(o=>o.palette===3),'Original numeral palette ownership');
 // Palette 7 is the original numeral palette; GBC OBJ palette 3 owns it.
 // A different residual set lets the party live mostly in BG while the
 // moving numerals retain their original 8x8 boundaries and OAM priority.
 const objPalette=Buffer.concat((frame.residualPalettes??[0,1,4,7]).map(p=>sourcePalettes.subarray(p*8,p*8+8)));
 const palettes=frame.fixedSourcePalettes?Array.from({length:7},(_,p)=>Array.from({length:4},(_,i)=>sourcePalettes.readUInt16LE(p*8+i*2))):pixelCompositionPalettes([basePixels],objPalette,{width,height,maxPalettes:7,weighted:!!frame.weightedPalettes});
 const base=compilePixelComposition(basePixels,objPalette,{width,height,palettes,objOnlyRow}),count=numberObjects.length;
 const sprites=[...numberObjects.map((o,tile)=>({x:o.x,y:o.y,h:8,palette:3,tile})),...base.sprites.map(s=>({...s,tile:s.tile+count}))];
 check(sprites.length<=40,'Composition OAM capacity');const lines=new Uint8Array(height);
 for(const s of sprites)for(let y=Math.max(0,s.y);y<Math.min(height,s.y+8);y++)lines[y]++;
 check(Math.max(...lines)<=10,'Composition scanline capacity');
 const oam=Buffer.alloc(160);sprites.forEach((s,i)=>oam.set([s.y+16,s.x+8,s.tile,8+s.palette],i*4));
 const result={...base,pixels:frame.pixels,sprites,oam,objGraphics:Buffer.concat([...numberObjects.map(o=>encodeTile(o.pixels)),base.objGraphics]),stats:{...base.stats,objects:sprites.length,peak:Math.max(...lines),numberObjects:count,baseObjects:base.sprites.length}};
 check(compositionWords(result).every((v,i)=>v===frame.pixels[i]),'Layered numeral RGB555 roundtrip');
 return result;
}
