import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';import {makeMapAssets,mapSelection} from './map-assets.mjs';
import {screenshotRgb,mapRgb} from './map-pixels.mjs';
const {data,local}=await input(),dir=ROOT+'/build/maps',negative=process.argv.includes('--negative'),report=JSON.parse(await fs.readFile(dir+'/report.json')),rom=dir+'/ff3-map-'+(negative?'negative':'viewer')+'.gbc';
const romSha256=hash(await fs.readFile(rom));check(romSha256===(negative?report.negativeRomSha256:report.romSha256),'Map ROM identity');const coreSha256=hash(await fs.readFile(local.mesenCore));check(coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Mesen ABI');
const assets=makeMapAssets(data,{verify:false}),symbols={};for(const m of (await fs.readFile(dir+'/ff3-map-viewer.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const requests=[],seen=new Set();
if(negative)requests.push({world:0,id:0x16,x:0,y:0,screenshot:false});else{
 for(const p of assets.profiles){const props=assets.groups.properties[p.property],x=Math.max(0,Math.min(44,(props[0]&31)*2-10)),y=Math.max(0,Math.min(46,(props[1]&31)*2-8));requests.push({world:p.world,id:p.id,x,y,screenshot:!seen.has(p.tileset)});seen.add(p.tileset);}
 // Corners/odd camera coordinates, high-ID patterns, world 255 selector, reload.
 for(const p of assets.profiles.filter((p,i,a)=>a.findIndex(q=>q.tileset===p.tileset)===i||p.highPatternTiles.length))for(const [x,y]of [[0,0],[44,46],[1,1],[43,45]])requests.push({world:p.world,id:p.id,x,y,screenshot:false});
 requests.push({world:255,id:255,x:44,y:46,screenshot:false},{world:0,id:0x16,x:22,y:20,screenshot:true},{world:0,id:0,x:45,y:0,screenshot:false},{world:0,id:0,x:0,y:47,screenshot:false},{world:0,id:0x16,x:22,y:20,screenshot:false});
}
const out=ROOT+'/evidence/maps';await fs.mkdir(out,{recursive:true});const output=out+'/'+(negative?'negative':'observations')+'.json',configPath=output+'.config.json',reuse=process.argv.includes('--reuse');let home;
if(reuse){const c=JSON.parse(await fs.readFile(configPath));check(c.romSha256===romSha256&&c.coreSha256===coreSha256&&JSON.stringify(c.requests)===JSON.stringify(requests),'Reused map run differs');home=c.home;}else{home=await fs.mkdtemp(ROOT+'/.local/mesen-maps-');await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,requests,output}));}
if(!reuse)try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyMaps/bin/Release/net8.0/VerifyMaps.dll',configPath],{cwd:ROOT,timeout:900000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}
const actual=JSON.parse(await fs.readFile(output));check(actual.romSha256===romSha256&&actual.coreSha256===coreSha256&&actual.observations.length===requests.length,'Map observation identity');
for(const [i,v]of actual.observations.entries()){
 const r=requests[i];check(v.world===r.world&&v.id===r.id&&v.x===r.x&&v.y===r.y,'Selected map differs');check(v.negative===5&&v.bank===1&&(v.svbk&7)===1&&v.guard==='a7'.repeat(16),'Asset bounds/bank/workspace restore');
 if(negative){check(v.error===2&&v.assetError===2&&v.loads==='0000','Corrupt asset descriptor not rejected');continue;}
 if(r.x>44||r.y>46){check(v.error===4,'Camera bounds accepted');const before=actual.observations[i-1];for(const key of ['tiles','properties','collision','gfx','map','attributes','palettes','loads'])check(v[key]===before[key],'Rejected camera changed '+key);continue;}
 check(!v.error&&!v.assetError,'Map load failed '+i);const s=mapSelection(r.world,r.id),g=assets.groups,p=g.properties[s.property],[layout,graphics]=g.selection[s.selection],set=p[0]>>5;
 check(v.tiles===g.layout[layout].toString('hex')&&v.properties===p.toString('hex')&&v.collision===g.collision[set].toString('hex'),'Resident map asset differs '+i);
 const tiles=Buffer.concat([g.graphics[graphics],g.font[0]]),vram=Buffer.concat([tiles.subarray(2048),tiles.subarray(0,2048)]);check(v.gfx===vram.toString('hex')&&v.palettes===g.palette[s.property].toString('hex'),'Uploaded graphics/palette differs '+i);
 const map=Buffer.alloc(1024),attrs=Buffer.alloc(1024);for(let y=0;y<18;y++)for(let x=0;x<20;x++){const wx=r.x+x,wy=r.y+y,m=g.layout[layout][(wy>>1)*32+(wx>>1)],q=(wy&1)*2+(wx&1);map[y*32+x]=g.metas[set][m*4+q];attrs[y*32+x]=g.attributes[set][m];}
 check(v.map===map.toString('hex')&&v.attributes===attrs.toString('hex'),'Visible metatile composition differs '+i);check(v.lcdc===0x81&&(v.vbk&1)===0&&!v.scx&&!v.scy,'Map LCD registers');
}
let screenshots=[];try{screenshots=(await fs.readdir(home+'/Screenshots')).filter(x=>x.endsWith('.png')).sort().map(x=>home+'/Screenshots/'+x);}catch(e){if(e.code!=='ENOENT')throw e;}
const shotRequests=requests.filter(r=>r.screenshot);check(screenshots.length===shotRequests.length,'Missing screenshots');for(let i=0;i<screenshots.length;i++)check(screenshotRgb(await fs.readFile(screenshots[i])).equals(mapRgb(assets,shotRequests[i])),'Screenshot pixels differ '+i);
const result={romSha256,coreSha256,requests:requests.length,profiles:negative?0:assets.profiles.length,tilesets:negative?0:seen.size,negativeDetected:negative,boundsCases:5,screenshotPixels:screenshots.length*160*144,recording:false,screenshots};await fs.writeFile(out+'/'+(negative?'negative-result':'result')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
