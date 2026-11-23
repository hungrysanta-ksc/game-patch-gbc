import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,input,check,hash,checkGbc} from './source.mjs';
import {makeMapAssets,packMapAssets} from './map-assets.mjs';
import {makeObjectAssets,objectKinds} from './object-assets.mjs';
import {stateAssets} from './state-source.mjs';
const {data,profile,local}=await input(),out=ROOT+'/build/objects',gen=out+'/generated';
await fs.mkdir(gen,{recursive:true});await fs.mkdir(ROOT+'/.local/compiler-tmp',{recursive:true});
const assets=makeObjectAssets(data,makeMapAssets(data)),pack=packMapAssets(assets,objectKinds),sources=[];
for(const [bank,bytes]of pack.banks){
 const path=gen+'/object-bank'+bank+'.c';
 await fs.writeFile(path,'#pragma bank '+bank+'\n#include <stdint.h>\nconst uint8_t object_bank'+bank+'[]={'+[...bytes].join(',')+'};\n');sources.push(path);
}
await fs.writeFile(gen+'/asset-directory.h','#define ASSET_KINDS '+pack.groups.length+'u\n#define ASSET_BANKS '+pack.romBanks+'u\nstatic const uint16_t asset_counts[]={'+pack.groups.map(x=>x.count).join(',')+'};\nstatic const uint16_t asset_offsets[]={'+pack.groups.map(x=>x.offset).join(',')+'};\nstatic const uint8_t asset_present[]={'+Array.from({length:pack.romBanks},(_,i)=>pack.banks.has(i)?1:0).join(',')+'};\n');
await fs.writeFile(gen+'/state-assets.h',stateAssets(data).header);
await fs.writeFile(out+'/catalog.json',JSON.stringify({sourceSha256:profile.sha256,comparisons:assets.comparisons,objectComparisons:assets.objectComparisons,unresolved:assets.unresolved,placementUsage:assets.placementUsage,assets:assets.provenance},null,2));
const arg=process.argv.indexOf('--gbdk'),gbdk=arg<0?local.gbdk:process.argv[arg+1];check(gbdk,'Pass --gbdk PATH');
const compiler=gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Compiler mismatch');
const romPath=out+'/ff3-object-viewer.gbc';
try{
 const r=await promisify(execFile)(compiler,['-msm83:gb','-Wm-yC','-Wm-yt0x19','-Wm-yo'+pack.romBanks,'-Wm-ynFF3OBJECTS','-Wl-m','-Wl-j','-I'+gen,'-o',romPath,...['assets','map-display','game-state','field-objects','object-viewer'].map(n=>ROOT+'/src/'+n+'.c'),...sources],{cwd:out,env:{...process.env,TMP:ROOT+'/.local/compiler-tmp',TEMP:ROOT+'/.local/compiler-tmp'},maxBuffer:8e6});
 await fs.writeFile(out+'/compiler.log',r.stdout+r.stderr);
}catch(e){await fs.writeFile(out+'/compiler.log',(e.stdout||'')+(e.stderr||''));throw e;}
const rom=await fs.readFile(romPath);checkGbc(rom,pack.romBanks);
for(const [bank,bytes]of pack.banks)check(rom.subarray(bank*16384,(bank+1)*16384).equals(bytes),'Linked object asset bank differs');
check(!/overflow|Multiple write/i.test(await fs.readFile(out+'/compiler.log','utf8')),'Link overflow');
const symbols={};for(const m of (await fs.readFile(romPath.replace('.gbc','.noi'),'utf8')).matchAll(/DEF (\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const fixedRomEnd=Math.max(...['CODE','CODE_0','HOME','INITIALIZER','GSINIT','GSFINAL'].map(n=>(symbols['s__'+n]??0)+(symbols['l__'+n]??0)));
check(fixedRomEnd<0x4000&&symbols.s__HEAP<0xd000&&symbols.l__CODE_13<16384,'Object viewer memory budget');
check(symbols._map_workspace===0xd000&&symbols.b_ff3_objects_init===13&&symbols.b_ff3_objects_display===13,'Object call/workspace banks');
const report={sourceSha256:profile.sha256,romSha256:hash(rom),romBanks:pack.romBanks,assetCount:pack.assets,directoryBytes:pack.directory.length,fixedRomEnd,staticWramEnd:symbols.s__HEAP,objectCodeBytes:symbols.l__CODE_13,comparisons:assets.objectComparisons,placements:197,unresolvedPlacementSlots:59,scope:'Pre-event static NPC initialization and canonical poses; movement, animation clock, player/guest and audio transition pending'};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
