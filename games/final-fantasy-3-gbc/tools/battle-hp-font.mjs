import {check} from './source.mjs';
// Existing FF3 V6 project-authored ASCII font (tools/font.mjs), 5x7 ink.
// Preserve every source pixel; remove only its empty left bearing. The
// approved 7x7_comp.fnt contains Hangul only, not ASCII numerals.
const rows=[
 ['00000','00000','00000','00000','00000','00000','00000'],
 ['01110','10001','10011','10101','11001','10001','01110'],
 ['00100','01100','00100','00100','00100','00100','01110'],
 ['01110','10001','00001','00010','00100','01000','11111'],
 ['11110','00001','00001','01110','00001','00001','11110'],
 ['00010','00110','01010','10010','11111','00010','00010'],
 ['11111','10000','10000','11110','00001','00001','11110'],
 ['01110','10000','10000','11110','10001','10001','01110'],
 ['11111','00001','00010','00100','01000','01000','01000'],
 ['01110','10001','10001','01110','10001','10001','01110'],
 ['01110','10001','10001','01111','00001','00001','01110'],
 ['00001','00001','00010','00100','01000','10000','10000']
];
export const hpAdvance=6,hpTextX=55;
export const hpGlyphs=Buffer.concat(rows.map(r=>{const b=Buffer.alloc(16);r.forEach((v,y)=>b[y*2]=b[y*2+1]=parseInt(v,2)<<3);return b;}));
export function hpGlyphIndex(id){check(id===255||id===199||(id>=128&&id<=137),'Unsupported HP numeral');return id===255?0:id===199?11:id-127;}
