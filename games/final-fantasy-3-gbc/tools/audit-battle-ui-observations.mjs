// Local evidence only: the package does not contain screenshots or RAM dumps.
import fs from 'node:fs/promises';
import {input,check,hash} from './source.mjs';
import {screenshotRgb} from './map-pixels.mjs';
import {unpackUiObservation,originalMenuPixel,observeBattleUi,messageWindowDescriptors} from './battle-ui-observation.mjs';
const arg=process.argv.indexOf('--observations');check(arg>=0,'Pass --observations PRIVATE_DIRECTORY');const dir=process.argv[arg+1],{data,profile}=await input();
// Observed Mesen NES palette, pinned to this capture profile. This is not the
// GBC LCD conversion and is never used to replace palette indices in the port.
const palette=new Map([[15,'000000'],[0,'666666'],[1,'002a88'],[48,'fffeff'],[16,'adadad']]);
const names=['idle','target','queued-command','items-settled','action','victory'],reports=[];
for(const name of names){const raw=await fs.readFile(dir+'/'+name+'.json'),png=await fs.readFile(dir+'/'+name+'.png'),s=unpackUiObservation(JSON.parse(raw)),rgb=screenshotRgb(png,{width:256,height:240});let compared=0,mismatches=0;
 for(let y=152;y<232;y++)for(let x=8;x<248;x++){
  const color=originalMenuPixel(s,x,y);check(palette.has(color),'Unverified NES capture palette '+color);
  mismatches+=+(rgb.subarray((y*256+x)*3,(y*256+x)*3+3).toString('hex')!==palette.get(color));compared++;
 }
 reports.push({name,rawSha256:hash(raw),pngSha256:hash(png),...observeBattleUi(s),compared,mismatches});
}
const result={sourceSha256:profile.sha256,windows:messageWindowDescriptors(data),reports,compared:reports.reduce((n,r)=>n+r.compared,0),mismatches:reports.reduce((n,r)=>n+r.mismatches,0),excluded:[{name:'items',reason:'During row transfer: end-state PPU and last completed screenshot are not paired; 830 differing pixels retained in initial check.log. Requires scanline-paired transition capture, not a relaxed pixel tolerance.'}],scope:'Six stable original NES menu frames with actual PPU/CHR/palette/OAM. No full transition cadence or GBC gameplay claim.'};
await fs.writeFile(dir+'/verified.json',JSON.stringify(result,null,2));check(!result.mismatches,'Actual original NES UI pixels mismatch');console.log(JSON.stringify({sourceSha256:result.sourceSha256,states:reports.length,pixels:result.compared,mismatches:result.mismatches,excluded:result.excluded}));
