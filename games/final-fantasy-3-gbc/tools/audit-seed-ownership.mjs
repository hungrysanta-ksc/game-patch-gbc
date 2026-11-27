import fs from 'node:fs/promises';import {ROOT,input,hash,check} from './source.mjs';
import {seedOwnership,sourceSeedWriters} from './seed-ownership.mjs';
const i=process.argv.indexOf('--disassembly');check(i>=0&&process.argv[i+1],'Pass --disassembly PATH to the private reference');
const {data,profile}=await input(),asm=await fs.readFile(process.argv[i+1],'utf8'),sites=sourceSeedWriters(data,asm),rows=seedOwnership().map(r=>({...r,candidates:sites.writers.filter(w=>w.address===r.address)}));
const counts={};for(const r of rows)counts[r.role]=(counts[r.role]??0)+1;
check(rows.length===256&&counts['battle-prefix']===27,'Complete source byte inventory');
const report={sourceSha256:profile.sha256,disassemblySha256:hash(asm),counts,rows,dynamicSites:sites.dynamic,decision:'Approved GBC semantic field/audio input; no shadow NES DP or guessed missing-byte values.',limits:'Direct writer candidates from banks 36..3F, not last-writer provenance. Indexed/indirect writes remain explicit. Other-source-state is unresolved semantic ownership, not unused or zero. Exact NES seed replay remains a separate reference consumer.'};
const out=ROOT+'/evidence/seed-ownership';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({counts,directSites:sites.writers.length,dynamicSites:sites.dynamic.length,report:out+'/report.json',limits:report.limits}));
