import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';import {denseCases} from './render-budget-source.mjs';import {tallScene,renderScene,png} from './render-budget-pixels.mjs';
const {data,profile,local}=await input(),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),cases=denseCases(data,assets).filter(r=>r.flags===0&&((r.world===1&&r.map===87)||(r.world===0&&r.map===139)));
const out=ROOT+'/build/render-budget',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});let source='#pragma bank 1\n#include "render-probe-assets.h"\n',rows=[];const records=[];
for(const [i,r]of cases.entries()){
 const s=tallScene(assets,r),expected=renderScene(s),ideal=renderScene(s,{hardware:false}),original=renderScene(s,{hardware:false,original:true});check(ideal.equals(original),'Lossless 8x16 repacking '+i);
 let missingPixels=0;for(let p=0;p<160*144;p++)if(!expected.subarray(p*3,p*3+3).equals(ideal.subarray(p*3,p*3+3)))missingPixels++;check(missingPixels===[158,0][i],'Known visible-loss and occlusion controls');
 for(const [k,b]of Object.entries({background:s.background,map:s.map,attributes:s.attributes,graphics:s.objGraphics,oam:s.oam,bgPalette:s.bgPalette,objPalette:s.objPalette})){
  const pal=k.endsWith('Palette');source+='const '+(pal?'uint16_t':'uint8_t')+' p'+i+'_'+k+'[]={'+(pal?Array.from({length:b.length/2},(_,j)=>b.readUInt16LE(j*2)):[...b]).join(',')+'};\n';
 }
 rows.push('{'+['background','map','attributes','graphics','oam','bgPalette','objPalette'].map(k=>'p'+i+'_'+k).join(',')+','+s.objGraphics.length/16+'}');
 await fs.writeFile(out+'/scene'+i+'-expected.rgb',expected);await fs.writeFile(out+'/scene'+i+'-ideal.png',png(ideal));await fs.writeFile(out+'/scene'+i+'-hardware.png',png(expected));
 records.push({page:i,world:r.world,map:r.map,x:r.x,y:r.y,flags:r.flags,entries:s.sprites.length,peak:r.tall.peak,missingPixels,sourcePixelsPreservedBeforeOamSelection:true,objGraphicsSha256:hash(s.objGraphics),oamSha256:hash(s.oam),expectedSha256:hash(expected)});
}
await fs.writeFile(gen+'/render-probe-assets.h','#include <stdint.h>\ntypedef struct {const uint8_t *background,*map,*attributes,*graphics,*oam;const uint16_t *bgPalette,*objPalette;uint8_t objTiles;} Scene;\nextern const Scene scenes[2];\n');
await fs.writeFile(gen+'/render-probe-assets.c',source+'const Scene scenes[2]={'+rows.join(',')+'};\n');
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');const rom=out+'/ff3-render-budget.gbc';
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x19','-Wm-yo4','-Wl-m','-Wl-j','-I'+gen,'-o',rom,ROOT+'/src/render-budget-probe.c',gen+'/render-probe-assets.c'],{cwd:out,maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const bytes=await fs.readFile(rom);checkGbc(bytes,4);const report={sourceSha256:profile.sha256,romSha256:hash(bytes),scope:'Static negative feasibility probe, deliberately fails lossless display; product renderers unchanged',scenes:records};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
