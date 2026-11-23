import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';
import {makeMapAssets,mapSelection} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';
import {addTextAssets} from './korean-text.mjs';import {textPage,windowRgb} from './text-reference.mjs';
import {objectReference,objectRgb} from './object-reference.mjs';import {screenshotRgb} from './map-pixels.mjs';import {sourceInitialState} from './state-source.mjs';
const {data,local}=await input(),dir=ROOT+'/build/text',rom=dir+'/ff3-text-viewer.gbc',report=JSON.parse(await fs.readFile(dir+'/report.json'));
const romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));check(romSha256===report.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Text verification identity');
const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.text,{verify:false});
const messages=[...assets.text.messages,...report.fixtureWords.map(words=>{const b=Buffer.alloc(words.length*2);words.forEach((w,i)=>b.writeUInt16LE(w,i*2));return b;})],requests=[],expected=[],symbols={};
let selected=0,offset=0,pageNumber=0,visible=true,more=false,current;
function add(request){let error=0;
 if(request.key){if(request.key==='Right'){selected=(selected+1)%report.samples;request.action=1;}else if(request.key==='Left'){selected=selected?selected-1:report.samples-1;request.action=1;}else if(request.key==='B')request.action=3;else request.action=visible?2:1;}
 else {selected=request.id;request.action=request.command;}
 const action=request.action;delete request.action;
 if(action===3){visible=false;more=false;}
 else if(action===2&&!visible){error=21;}
 else if(action===2&&!more){visible=false;more=false;}
 else{
  if(action===1||action===4){offset=0;pageNumber=0;}
  let handle=selected;
  if(action===4){handle=assets.text.sourceIds.indexOf(selected);if(selected>=1712||!assets.text.analysis.entries[selected].raw)error=26;else if(handle<0)error=25;more=false;}
  if(error||!messages[handle]){error=error||20;visible=false;}
  else{current=textPage(messages[handle],offset);error=current.error;offset=current.offset;more=current.more;visible=!error;if(!error)pageNumber++;}
 }
 requests.push({...request,screenshot:!error});expected.push({error,selected,offset,pageNumber,visible,more,current});
}
for(let id=0;id<report.samples;id++){
 add({id,command:1});while(more)add({key:'A'});add({key:'A'});add({key:'A'});add({key:'B'});
}
add({key:'Right'});add({key:'Left'});
for(let id=report.fixtureStart;id<messages.length;id++){add({id,command:1});while(visible&&more)add({key:'A'});}
add({id:65535,command:1});add({id:0,command:1});add({key:'B'});
for(const id of [assets.text.sourceIds[0],0,255,1005,1711,1712,65535])add({id,command:4});
add({id:0,command:1});add({key:'B'});
for(const m of (await fs.readFile(dir+'/ff3-text-viewer.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const out=ROOT+'/evidence/text';await fs.mkdir(out,{recursive:true});const output=out+'/observations.json',configPath=output+'.config.json',reuse=process.argv.includes('--reuse');let home;
if(reuse){const c=JSON.parse(await fs.readFile(configPath));check(c.romSha256===romSha256&&c.coreSha256===coreSha256&&JSON.stringify(c.requests)===JSON.stringify(requests),'Reused text run differs');home=c.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-text-');await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,requests,output}));try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyText/bin/Release/net8.0/VerifyText.dll',configPath],{cwd:ROOT,timeout:300000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}}
const actual=JSON.parse(await fs.readFile(output));check(actual.romSha256===romSha256&&actual.coreSha256===coreSha256&&actual.observations.length===requests.length,'Text observations');
const scene={world:0,map:2,x:0,y:40,phase:0,flags:0},obj=objectReference(data,assets,scene),background=objectRgb(assets,scene,obj),g=assets.groups,s=mapSelection(0,2),p=g.properties[s.property],[layout,graphic]=g.selection[s.selection],tiles=Buffer.concat([g.graphics[graphic],g.font[0]]),bgMap=Buffer.alloc(1024),bgAttr=Buffer.alloc(1024),initial=sourceInitialState(data);
for(let y=0;y<18;y++)for(let x=0;x<20;x++){const wy=40+y,m=g.layout[layout][(wy>>1)*32+(x>>1)];bgMap[y*32+x]=g.metas[p[0]>>5][m*4+(wy&1)*2+(x&1)];bgAttr[y*32+x]=g.attributes[p[0]>>5][m];}
const screenshots=(await fs.readdir(home+'/Screenshots')).filter(x=>x.endsWith('.png')).sort().map(x=>home+'/Screenshots/'+x);check(screenshots.length===requests.filter(r=>r.screenshot).length,'Text screenshot count');
let shot=0,peakCache=0,inputChecks=0,rejected=0;const fontCoverage=new Set();
for(const [i,v]of actual.observations.entries()){
 const e=expected[i],r=requests[i],label=' request '+i,b=Buffer.from(v.vram,'hex'),u16=x=>Buffer.from(x,'hex').readUInt16LE();
 check(v.error===e.error,'Text error'+label+' expected '+e.error+' actual '+v.error);check(v.visible===+e.visible,'Text visibility'+label);check(u16(v.selection)===e.selected,'Text selected'+label);check(u16(v.loads)===i+2,'Text command/joypad edge count'+label);if(r.key)inputChecks++;
 check(!v.transferFault&&(v.lcdc&128)&&!v.viewError&&v.bank===1&&(v.vbk&1)===0&&(v.svbk&7)===1&&v.guard==='a7'.repeat(16),'Text bank/WRAM guard'+label);
 check(v.state===initial.toString('hex')&&v.oam===obj.oam.toString('hex'),'Text changed GameState/OAM'+label);
 check(b.subarray(0x2000,0x2c00).equals(obj.graphics)&&b.subarray(0x800,0x1800).equals(Buffer.concat([tiles.subarray(2048),tiles.subarray(0,2048)])),'Text changed map/NPC patterns'+label);
 check(b.subarray(0x1800,0x1c00).equals(bgMap)&&b.subarray(0x3800,0x3c00).equals(bgAttr),'Text changed map tilemap'+label);
 check(v.palettes.slice(0,64)===g.palette[s.property].toString('hex'),'Text changed map palettes'+label);
 if(e.error){rejected++;check(!(v.lcdc&32),'Rejected window visible'+label);continue;}
 check(v.page===e.pageNumber&&v.more===+e.more&&u16(v.offset)===e.offset,'Text page transition'+label);
 if(e.visible){
  const page=e.current,cell=Buffer.from(v.cells,'hex'),cache=Buffer.from(v.cache,'hex');peakCache=Math.max(peakCache,v.cacheCount);check(v.cacheCount===page.cache.length,'Text cache size'+label);
  check(v.wx===7&&v.wy===80&&(v.lcdc&0x60)===0x60,'Window position/map'+label);
  for(let n=0;n<160;n++){const id=page.cells[n],slot=page.cache.indexOf(id),at=Math.floor(n/20)*32+n%20;check(cell.readUInt16LE(n*2)===id&&b[0x1c00+at]===slot&&b[0x3c00+at]===0x8f,'Window cell'+label);}
  for(const [slot,id]of page.cache.entries()){check(cache.readUInt16LE(slot*2)===id,'Window cache index'+label);const glyph=Buffer.from(assets.text.glyphs.subarray(id*16,id*16+16));for(let n=0;n<16;n+=2)glyph[n]|=~glyph[n+1]&255;check(b.subarray(0x3000+slot*16,0x3010+slot*16).equals(glyph),'Uploaded glyph'+label+' glyph '+id);if(id>=256)fontCoverage.add(id);}
 }
 if(r.screenshot){const pixels=screenshotRgb(await fs.readFile(screenshots[shot++])),wanted=e.visible?windowRgb(background,e.current,assets.text.glyphs):background;check(pixels.equals(wanted),'Text screenshot pixels'+label);}
}
check(fontCoverage.size===2350,'Full approved Hangul repertoire not exercised');
const result={romSha256,coreSha256,requests:requests.length,rejected,inputChecks,sourceComparisons:report.text,samples:report.samples,fontGlyphsVerified:fontCoverage.size,peakCache,cacheCapacity:128,screenshots,pixels:screenshots.length*160*144};await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,sourceComparisons:undefined,screenshots:screenshots.length},null,2));
