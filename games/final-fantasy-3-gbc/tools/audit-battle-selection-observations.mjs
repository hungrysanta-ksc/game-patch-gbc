// Local NES evidence: never publish raw RAM, PPU, CHR or screenshots.
import fs from 'node:fs/promises';
import {input,check,hash} from './source.mjs';
import {selectionTables,sourceTarget} from './battle-select-source.mjs';
import {unpackUiObservation,originalMenuPixel,observeBattleUi} from './battle-ui-observation.mjs';
import {screenshotRgb} from './map-pixels.mjs';
const at=process.argv.indexOf('--observations');check(at>=0,'Pass --observations PRIVATE_DIRECTORY');const dir=process.argv[at+1],{data,profile}=await input(),{tables}=selectionTables(data),reports=[],palette=new Map([[15,'000000'],[0,'666666'],[1,'002a88'],[48,'fffeff'],[16,'adadad']]);let previous;
for(const [name,key]of [['up',null],['right',128],['party-down',32],['cancel',2]]){
 const raw=await fs.readFile(dir+'/'+name+'.json'),png=await fs.readFile(dir+'/'+name+'.png'),s=unpackUiObservation(JSON.parse(raw)),r=s.sram,env=Buffer.from([...tables.ff3_target_layouts.subarray(r[0x1d7b]*8,r[0x1d7b]*8+8),...r.subarray(0x1da7,0x1daf),...r.subarray(0x1d8b,0x1d8f),...r.subarray(0x1e22,0x1e26),+(r[0x18c3]===0x88)]),target=Buffer.from([...s.ram.subarray(0xad,0xb6),r[0x1e0f],r[0x1f49]]),rgb=screenshotRgb(png,{width:256,height:240});let pixels=0,mismatches=0;
 if(previous){check(previous.env.equals(env),'Observed environment changed');const expected=sourceTarget(data,env,previous.target,key);check(expected.subarray(0,10).equals(target.subarray(0,10)),'Live NES selection state '+name);}
 for(let y=152;y<232;y++)for(let x=8;x<248;x++){const color=originalMenuPixel(s,x,y);check(palette.has(color),'Unknown observed UI palette');mismatches+=+(rgb.subarray((y*256+x)*3,(y*256+x)*3+3).toString('hex')!==palette.get(color));pixels++;}
 check(!mismatches,'Observed selection UI pixels '+name);reports.push({name,key,rawSha256:hash(raw),pngSha256:hash(png),target:target.subarray(0,10).toString('hex'),...observeBattleUi(s),pixels,mismatches});previous={env,target};
}
const result={sourceSha256:profile.sha256,reports,transitions:3,pixels:reports.reduce((n,r)=>n+r.pixels,0),mismatches:0,scope:'Actual NES first-battle input, frozen RAM/PPU/OAM and stable lower UI; SFX mailbox may be consumed before snapshot and is excluded from live state comparison'};await fs.writeFile(dir+'/verified.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
