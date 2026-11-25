import fs from 'node:fs/promises';import {ROOT,input,check,hash} from './source.mjs';import {openingPresentation} from './battle-opening-assets.mjs';
const {data}=await input(),reportPath=process.argv[2]||ROOT+'/build/battle-opening-video/report.json',reportBytes=await fs.readFile(reportPath),report=JSON.parse(reportBytes),out=[];
check(report.sourceSha256===hash(data)&&report.battle.opening.length===4,'Supported original opening report');
const buf=v=>Buffer.from(v.data);
for(const back of [false,true]){
 const original=openingPresentation(data,{back,hp:500}),req=original.requests.find(r=>r.kind===1&&r.value===0),frames=req.frames.map(f=>original.boundaries[f.sourceBoundary]);
 const noTransfer=frames.filter(f=>f.transfers.chr===0&&f.transfers.map===0&&f.transfers.palette===0),chr=frames.reduce((n,f)=>n+f.transfers.chr,0),map=frames.reduce((n,f)=>n+f.transfers.map,0);
 const p=back?2:0,first=report.battle.opening[p].requests.find(r=>r.kind===1&&r.value===0),entries=report.battle.action.profiles[p].entries.slice(first.first,first.first+first.count);
 let page=0,last=[null,null],activeVisual=-1,activeUi=-1,staged=0,totals={bg:0,map:0,attr:0,obj:0},changing=0,max=0,initial=0;
 for(const e of entries){
  const f=report.frames[e.frame];if(f.atlas.visual===activeVisual&&e.ui===activeUi)continue;const n=staged++,old=last[page],parts=[['bg',buf(f.atlas.background),old?buf(old.atlas.background):Buffer.alloc(0)],['map',buf(f.atlas.maps).subarray(0,608),old?buf(old.atlas.maps).subarray(0,608):Buffer.alloc(0)],['attr',buf(f.atlas.maps).subarray(608,1216),old?buf(old.atlas.maps).subarray(608,1216):Buffer.alloc(0)],['obj',buf(f.atlas.objects),old?buf(old.atlas.objects):Buffer.alloc(0)]];let bytes=0;
  for(const [k,a,b]of parts)for(let i=0;i<a.length;i+=16)if(!a.subarray(i,i+16).equals(b.subarray(i,i+16))){if(n>1)totals[k]+=Math.min(16,a.length-i);bytes+=Math.min(16,a.length-i);}
  if(n<=1)initial+=bytes;else{if(bytes)changing++;max=Math.max(max,bytes);}last[page]=f;page^=1;activeVisual=f.atlas.visual;activeUi=e.ui;
 }
 out.push({back,source:{boundaries:frames.length,noPatternMapPaletteWrites:noTransfer.length,chrBytes:chr,mapBytes:map,scrollValues:[...new Set(frames.map(f=>f.enemyScroll))]},gbcFixture:{entries:entries.length,staged,initialTwoPagesBytes:initial,laterDeltaBytes:totals,laterChanged:changing,maxLaterBytes:max},scope:'Source non-raster PPU-write oracle vs generated geometry byte deltas for alternating pages, excludes UI/OAM/palette traffic; not measured hardware timing'});
}
const result={sourceSha256:hash(data),reportRomSha256:report.romSha256,reportSha256:hash(reportBytes),rows:out,scope:'Architecture evidence only; neither hardware timing nor a live renderer implementation'};
await fs.mkdir(ROOT+'/evidence/battle-render-architecture',{recursive:true});await fs.writeFile(ROOT+'/evidence/battle-render-architecture/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
