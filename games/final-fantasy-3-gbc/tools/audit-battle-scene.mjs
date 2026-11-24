import fs from 'node:fs/promises';
import {ROOT,input,hash} from './source.mjs';
import {battleSceneAudit} from './battle-scene-source.mjs';
import {sceneCoverage} from './battle-scene-contract.mjs';
const {data,profile}=await input(),audit=battleSceneAudit(data),coverage=sceneCoverage(audit.dispatch);
const report={sourceSha256:profile.sha256,...audit,coverage},out=ROOT+'/evidence/battle-scene';
await fs.mkdir(out,{recursive:true});const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(out+'/audit.json',bytes);
console.log(JSON.stringify({dispatch:audit.dispatch.summary,actionScripts:audit.actions.scripts.length,windowProfiles:audit.windows.map(w=>({profile:w.profile,backupBytes:w.totalBackupBytes,waits:w.totalWaits,restored:w.restored})),damage:audit.damage.summary,coverage:coverage.summary,budgetStatus:coverage.budgetStatus,sha256:hash(Buffer.from(bytes)),scope:audit.scope},null,2));
