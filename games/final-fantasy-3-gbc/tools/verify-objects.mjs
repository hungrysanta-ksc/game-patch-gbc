import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';
import {makeMapAssets,mapSelection} from './map-assets.mjs';
import {makeObjectAssets,sourceObjects} from './object-assets.mjs';
import {objectReference,objectRgb} from './object-reference.mjs';
import {sourceInitialState} from './state-source.mjs';
import {screenshotRgb} from './map-pixels.mjs';
const {data,local}=await input(),dir=ROOT+'/build/objects',rom=dir+'/ff3-object-viewer.gbc',report=JSON.parse(await fs.readFile(dir+'/report.json'));
const romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));
check(romSha256===report.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Object verification identity');
const assets=makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),requests=[],shots=new Set(),symbols={};
for(const m of (await fs.readFile(dir+'/ff3-object-viewer.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const add=r=>requests.push({world:0,map:0,x:0,y:0,phase:0,flags:0,bad_list:0,screenshot:false,...r});
for(const p of assets.profiles){
 const initial=sourceObjects(data,assets,p.world,p.id,data.subarray(0x1610,0x1650)),a=initial.part1;
 let first=0;for(let slot=0;slot<12;slot++)if(a[slot*16]){first=slot*16;break;}
 const x=Math.max(0,Math.min(44,a[first+4]*2-10)),y=Math.max(0,Math.min(46,a[first+5]*2-8));
 for(const flags of [0,1,2]){
  const r={world:p.world,map:p.id,x,y,phase:0,flags},e=objectReference(data,assets,r);
  const key=p.tileset;
  const screenshot=flags===0&&e.entries>0&&!e.error&&!shots.has(key);if(screenshot)shots.add(key);
  add({...r,screenshot});if(screenshot)add({...r,phase:1,screenshot:true});
 }
}
// Exhaustive camera density audit for all-visible diagnostic state. This is an
// upper bound, not a claim that all switches can coexist in normal play.
const density={cameras:0,oamOverflow:0,lineOverflow:0,maxEntries:0,maxLine:0,worstEntries:null,worstLine:null};
const rows=new Uint8Array(19),allFlags=Buffer.alloc(64,255);
for(const p of assets.profiles){
 const a=sourceObjects(data,assets,p.world,p.id,allFlags).part1;
 for(let x=0;x<=44;x++)for(let y=0;y<=46;y++){
  rows.fill(0);let entries=0,peak=0;
  for(let slot=0;slot<12;slot++){
   const at=slot*16;if(!a[at])continue;
   const col=a[at+4]*2-x,row=a[at+5]*2-y,n=+(col>=0&&col<20)+ +(col+1>=0&&col+1<20);
   for(let j=0;j<2;j++)if(row+j>=0&&row+j<19){rows[row+j]+=n;entries+=n;peak=Math.max(peak,rows[row+j]);}
  }
  density.cameras++;if(entries>40)density.oamOverflow++;if(peak>10)density.lineOverflow++;
  const r={world:p.world,map:p.id,x,y,flags:2};
  if(entries>density.maxEntries){density.maxEntries=entries;density.worstEntries=r;}
  if(peak>density.maxLine){density.maxLine=peak;density.worstLine=r;}
 }
}
for(const r of [density.worstEntries,density.worstLine])if(r)add({...r,screenshot:true});
// Real placement boundaries, both phases, hidden switches and invalid inputs.
const representative=requests.find(r=>r.screenshot);
for(const [x,y]of [[0,0],[44,46],[1,1],[43,45]])add({...representative,x,y,screenshot:true});
add({...representative,world:255,screenshot:false});
add({...representative,bad_list:1,screenshot:false});
add({...representative,phase:2,screenshot:false});
add({...representative,screenshot:true});
const out=ROOT+'/evidence/objects';await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/density.json',JSON.stringify(density,null,2));
const output=out+'/observations.json',configPath=output+'.config.json',reuse=process.argv.includes('--reuse');let home;
if(reuse){const c=JSON.parse(await fs.readFile(configPath));check(c.romSha256===romSha256&&c.coreSha256===coreSha256&&JSON.stringify(c.requests)===JSON.stringify(requests),'Reused object run differs');home=c.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-objects-');await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,requests,output}));}
if(!reuse)try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyObjects/bin/Release/net8.0/VerifyObjects.dll',configPath],{cwd:ROOT,timeout:900000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}
const actual=JSON.parse(await fs.readFile(output));check(actual.romSha256===romSha256&&actual.coreSha256===coreSha256&&actual.observations.length===requests.length,'Object observation identity');
let rejected=0,passed=0,loads=1;const initial=sourceInitialState(data);
// Boot's initial viewport is known and independently checked for load count.
if(objectReference(data,assets,{world:0,map:2,x:0,y:40,phase:0,flags:0}).error)loads=0;
for(const [i,v]of actual.observations.entries()){
 const r=requests[i],label=' request '+i;
 check(v.world===r.world&&v.mapId===r.map&&v.x===r.x&&v.y===r.y&&v.phase===r.phase&&v.flags===r.flags,'Object selected input'+label);
 check(v.bank===1&&(v.svbk&7)===1&&v.guard==='a7'.repeat(16),'Object bank/workspace guard'+label);
 const state=Buffer.from(initial);if(r.flags===1)state.fill(0,0x80,0xc0);if(r.flags===2)state.fill(255,0x80,0xc0);
 check(v.state===state.toString('hex'),'Object GameState initialization'+label);
 if(r.bad_list){check(v.error===1&&v.part1==='a5'.repeat(192)&&v.part2==='a5'.repeat(192),'Invalid placement accepted/modified state');rejected++;continue;}
 const e=objectReference(data,assets,{...r,phase:r.phase&1});
 check(v.part1===e.part1.toString('hex')&&v.part2===e.part2.toString('hex')&&v.count===e.count,'Original object initializer'+label);
 if(r.phase>1){check(v.error===4,'Invalid object phase accepted');rejected++;continue;}
 check(v.error===e.error&&v.assetError===e.error,'Object error contract'+label+' expected '+e.error+' actual '+v.error);
 if(e.error){rejected++;check(v.oam==='00'.repeat(160)&&v.lcdc===0x81,'Overflow published partial OAM'+label);continue;}
 passed++;loads++;check(Buffer.from(v.loads,'hex').readUInt16LE()===loads,'Object load counter'+label);
 check(v.entries===e.entries&&v.peak===e.peak&&v.oam===e.oam.toString('hex'),'Object OAM composition'+label);
 check(v.gfx===e.graphics.toString('hex')&&v.palettes.slice(64,96)===e.palette.toString('hex'),'Object uploaded patterns/palette'+label);
 check(v.lcdc===0x83&&(v.vbk&1)===0,'Object LCD registers'+label);
 const s=mapSelection(r.world,r.map),g=assets.groups,p=g.properties[s.property],[layout,graphic]=g.selection[s.selection],set=p[0]>>5,tiles=Buffer.concat([g.graphics[graphic],g.font[0]]);
 check(v.background===Buffer.concat([tiles.subarray(2048),tiles.subarray(0,2048)]).toString('hex')&&v.palettes.slice(0,64)===g.palette[s.property].toString('hex'),'Objects overwrote background assets'+label);
 const map=Buffer.alloc(1024),attrs=Buffer.alloc(1024);for(let y=0;y<18;y++)for(let x=0;x<20;x++){const wx=r.x+x,wy=r.y+y,m=g.layout[layout][(wy>>1)*32+(wx>>1)];map[y*32+x]=g.metas[set][m*4+(wy&1)*2+(wx&1)];attrs[y*32+x]=g.attributes[set][m];}
 check(v.map===map.toString('hex')&&v.attributes===attrs.toString('hex'),'Objects overwrote background tilemap'+label);
}
const screenshots=(await fs.readdir(home+'/Screenshots')).filter(x=>x.endsWith('.png')).sort().map(x=>home+'/Screenshots/'+x),shotRequests=requests.filter(r=>r.screenshot);
check(screenshots.length===shotRequests.length,'Missing object screenshots');
for(let i=0;i<screenshots.length;i++){const r=shotRequests[i],e=objectReference(data,assets,r);check(screenshotRgb(await fs.readFile(screenshots[i])).equals(objectRgb(assets,r,e)),'Object screenshot pixels '+i);}
const result={romSha256,coreSha256,requests:requests.length,passed,rejected,profiles:768,flagStates:3,sourceObjectComparisons:requests.length-1,density,screenshots,pixels:screenshots.length*160*144};
await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
