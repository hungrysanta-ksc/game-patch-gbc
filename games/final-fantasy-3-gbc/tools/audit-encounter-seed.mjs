import fs from 'node:fs/promises';
import {ROOT,input,hash,check} from './source.mjs';
import {encounterSeedOriginal} from './encounter-seed-source.mjs';
import {motionRngVariants} from './battle-motion-sprites.mjs';

export async function checkSeedCapture(rom,dir){
 const files=['natural-entry.json','natural-fc27.json','natural-seeded.json','capture.json'],raw=await Promise.all(files.map(n=>fs.readFile(dir+'/'+n))),[entry,fc27,seeded,identity]=raw.map(b=>JSON.parse(b));
 check(identity.sourceSha256===hash(rom),'Capture source identity');
 const before=entry.cpu.state,at=fc27.cpu.state,after=seeded.cpu.state,dp=Buffer.from(entry.ram.hex,'hex').subarray(0,256);
 check(before['cpu.pc']===0xfa29&&at['cpu.pc']===0xfc27&&after['cpu.pc']===0xa02a,'Observed breakpoint boundaries');
 const original=encounterSeedOriginal(rom,dp,before['cpu.y'],{formation:before['cpu.a'],background:before['cpu.x'],carry:before['cpu.ps']&1});
 check(original.input.equals(Buffer.from(fc27.zp.hex,'hex'))&&original.a===at['cpu.a']&&original.carry===(at['cpu.ps']&1),'Entire observed source seed input');
 const end=Buffer.from(seeded.zp.hex,'hex');check([...end.subarray(0x15,0x18)].every(v=>v===original.seed),'Observed three RNG counters');
 const table=motionRngVariants(rom).tables.subarray(((original.seed&2)>>1)*256,(((original.seed&2)>>1)+1)*256);check(table.equals(Buffer.from(seeded.table.hex,'hex')),'Observed immutable RNG variant');
 return {dp,flags:before['cpu.y'],report:{sourceSha256:hash(rom),seed:original.seed,formation:before['cpu.a'],background:before['cpu.x'],map:dp[0x48],vehicle:dp[0x46],flags:before['cpu.y'],a:original.a,carry:original.carry,inherited:original.inherited,touched:original.touched,sourceInstructions:original.instructions,inputHash:original.inputHash,tableHash:hash(table),captureHashes:Object.fromEntries(files.map((n,i)=>[n,hash(raw[i])])),host:identity.host,scope:'Original controller-only new-game encounter observed on NES; source prefix replay and seed/table equality. Does not supply the missing live GBC field/sound DP owner.'}};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/audit-encounter-seed.mjs')){
 const {data}=await input(),i=process.argv.indexOf('--capture'),dir=i<0?ROOT+'/evidence/encounter-seed':process.argv[i+1],r=await checkSeedCapture(data,dir);
 await fs.writeFile(dir+'/report.json',JSON.stringify(r.report,null,2));console.log(JSON.stringify(r.report,null,2));
}
