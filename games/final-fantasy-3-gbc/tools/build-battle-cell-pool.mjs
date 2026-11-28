import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check,checkGbc} from './source.mjs';
import {cellPoolExamples} from './battle-cell-pool-source.mjs';
import {stoneSurfaces,stonePaintExamples} from './battle-stone-surface.mjs';
const {data,local}=await input(),dir=ROOT+'/build/battle-cell-pool';await fs.mkdir(dir,{recursive:true});
const examples=cellPoolExamples(data),fixture=Buffer.concat(examples.flatMap(e=>[Buffer.from([e.glyphs.length,e.unique]),...e.glyphs.map((g,i)=>Buffer.concat([g,Buffer.from([160+e.ids[i]])]))]));
const paint=stonePaintExamples(stoneSurfaces(data)),paintFixture=Buffer.concat(paint.map(r=>Buffer.concat([r.base,r.source,r.mask,r.glyph,Buffer.from([r.result])])));
check(fixture.length+paintFixture.length<=16384,'Reference bank capacity');
await fs.writeFile(dir+'/cell-pool-reference.h','#define POOL_REFERENCE_CASES '+examples.length+'\n#define PAINT_REFERENCE_CASES '+paint.length+'\nextern const uint8_t pool_reference[],paint_reference[];\n');
await fs.writeFile(dir+'/cell-pool-reference.c','#pragma bank 17\n#include <stdint.h>\nconst uint8_t pool_reference[]={'+[...fixture]+'};\nconst uint8_t paint_reference[]={'+[...paintFixture]+'};\n');
const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Pinned compiler');
const hashes=[];for(const negative of [false,true]){const tag=negative?'-negative':'',rom=dir+'/ff3-battle-cell-pool'+tag+'.gbc';
 const args=['-msm83:gb','-Wm-yC','-Wm-yt0x1b','-Wm-ya4','-Wm-yo128','-Wm-ynFF3CELLPOOL','-Wl-m','-Wl-j','-I'+ROOT+'/src','-I'+dir,...(negative?['-DFF3_CELL_POOL_NEGATIVE']:[]),'-o',rom,...['memory','battle-cell-pool','battle-cell-pool-test'].map(n=>ROOT+'/src/'+n+'.c'),dir+'/cell-pool-reference.c'];
 try{const r=await promisify(execFile)(compiler,args,{cwd:dir,maxBuffer:8e6});await fs.writeFile(dir+'/compiler'+tag+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(dir+'/compiler'+tag+'.log',(e.stdout||'')+(e.stderr||''));throw e;}
 check(!/overflow|Multiple write|undefined global/i.test(await fs.readFile(dir+'/compiler'+tag+'.log','utf8')),'Clean cell pool link');const bytes=await fs.readFile(rom);checkGbc(bytes,128,0x1b,3);
 const symbols=await fs.readFile(rom.replace('.gbc','.noi'),'utf8'),address=Number(symbols.match(/DEF _pool_reference (0x[0-9A-Fa-f]+)/)?.[1]);check(Number.isInteger(address),'Linked reference symbol');
 const at=(address>>>16)*16384+(address&16383);check(bytes.subarray(at,at+fixture.length).equals(fixture),'Exact linked source reference bytes');
 const paintAddress=Number(symbols.match(/DEF _paint_reference (0x[0-9A-Fa-f]+)/)?.[1]);check(Number.isInteger(paintAddress),'Linked paint reference symbol');
 const paintAt=(paintAddress>>>16)*16384+(paintAddress&16383);check(bytes.subarray(paintAt,paintAt+paintFixture.length).equals(paintFixture),'Exact linked stone paint references');hashes.push(hash(bytes));
}
const report={sourceSha256:hash(data),source:'2F/BAA2,BB13,A247,BCB1; graphics 13 source wipe masks; B72B/B6C8 stone glyphs and explicit pixel ownership',fixtureSha256:hash(fixture),paintFixtureSha256:hash(paintFixture),paintCases:paint.length,paintTruthCases:2048,romSha256:hashes[0],negativeRomSha256:hashes[1],cases:11+examples.length,examples:examples.map(({back,frame,glyphs,unique,saved})=>({back,frame,inputs:glyphs.length,unique,saved})),scope:'Compiled SM83 mask/paint/intern pool with real banked WRAM copying and recorded transfers. No native stone display or video/audio claim.'};await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
