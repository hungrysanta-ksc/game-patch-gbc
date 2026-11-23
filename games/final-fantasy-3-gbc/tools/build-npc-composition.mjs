import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {compositionCases} from './npc-composition-source.mjs';import {compileComposition,compositionRgb} from './npc-composition.mjs';import {renderScene,png} from './render-budget-pixels.mjs';
const {data,profile,local}=await input(),assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),{cases,contexts}=compositionCases(data,assets);
const out=ROOT+'/build/npc-composition',gen=out+'/generated';await fs.mkdir(gen,{recursive:true});const files=[],scenes=[],declarations=[],rows=[];
const keys=['background','map','attributes','graphics','oam','bgPalette','objPalette'];
for(const [i,r]of cases.entries()){
 const c=compileComposition(r.scene),expected=renderScene(r.scene,{hardware:false,original:true});check(compositionRgb(c).equals(expected),'Source pixels '+r.label);
 const bank=i+2,payload={background:c.background,map:c.map,attributes:c.attributes,graphics:c.objGraphics,oam:c.oam,bgPalette:c.bgPalette,objPalette:c.objPalette};let code='#pragma bank '+bank+'\n#include "composition-assets.h"\n';
 let bytes=0;for(const k of keys){const b=payload[k],pal=k.endsWith('Palette'),type=pal?'uint16_t':'uint8_t',name='p'+i+'_'+k;bytes+=b.length;declarations.push('extern const '+type+' '+name+'[];');code+='const '+type+' '+name+'[]={'+(pal?Array.from({length:b.length/2},(_,j)=>b.readUInt16LE(j*2)):b.length?[...b]:[0]).join(',')+'};\n';}
 check(bytes<16384,'Frame ROM bank overflow');const file=gen+'/scene'+i+'.c';files.push(file);await fs.writeFile(file,code);
 rows.push('{'+keys.map(k=>'p'+i+'_'+k).join(',')+','+[bank,c.stats.bgTiles&255,c.objGraphics.length/16].join(',')+'}');
 await fs.writeFile(out+'/scene'+i+'-expected.rgb',expected);await fs.writeFile(out+'/scene'+i+'.png',png(expected));
 scenes.push({page:i,label:r.label,world:r.world,map:r.map,camera:r.camera,evidence:r.evidence,...c.stats,romBank:bank,romPayloadBytes:bytes,backgroundSha256:hash(c.background),objGraphicsSha256:hash(c.objGraphics),oamSha256:hash(c.oam),expectedSha256:hash(expected)});
}
await fs.writeFile(gen+'/composition-assets.h','#include <stdint.h>\n#define SCENE_COUNT '+cases.length+'\ntypedef struct {const uint8_t *background,*map,*attributes,*graphics,*oam;const uint16_t *bgPalette,*objPalette;uint8_t bank,bgTiles,objTiles;} Scene;\nextern const Scene scenes[SCENE_COUNT];\n');
await fs.writeFile(gen+'/composition-assets.c','#pragma bank 1\n#include "composition-assets.h"\n'+declarations.join('\n')+'\nconst Scene scenes[SCENE_COUNT]={'+rows.join(',')+'};\n');
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');const banks=2**Math.ceil(Math.log2(cases.length+2)),rom=out+'/ff3-npc-composition.gbc';
try{const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x19','-Wm-yo'+banks,'-Wl-m','-Wl-j','-I'+gen,'-o',rom,ROOT+'/src/npc-composition-probe.c',gen+'/composition-assets.c',...files],{cwd:out,maxBuffer:8e6});await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const bytes=await fs.readFile(rom);checkGbc(bytes,banks);const report={sourceSha256:profile.sha256,romSha256:hash(bytes),pages:[...scenes.map(s=>s.page),0],contexts,scenes,scope:'Lossless compiled frame feasibility; LCD-off frame loading, no runtime composition or audio throughput claim'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({romSha256:report.romSha256,frames:scenes.length,romBanks:banks,maxBgTiles:Math.max(...scenes.map(s=>s.bgTiles)),maxPalettes:Math.max(...scenes.map(s=>s.bgPalettes)),maxObjects:Math.max(...scenes.map(s=>s.objects)),maxLine:Math.max(...scenes.map(s=>s.peak))},null,2));
