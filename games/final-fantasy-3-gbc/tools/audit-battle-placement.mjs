import fs from 'node:fs/promises';
import {ROOT,input,hash} from './source.mjs';
import {placementBudgetAudit} from './battle-placement-budget.mjs';
const {data,profile}=await input(),report={sourceSha256:profile.sha256,...placementBudgetAudit(data)},out=ROOT+'/evidence/battle-placement';
await fs.mkdir(out,{recursive:true});const bytes=JSON.stringify(report,null,2)+'\n';await fs.writeFile(out+'/audit.json',bytes);
console.log(JSON.stringify({summary:report.summary,effects:report.effectConditions.summary,rows:report.rows.map(r=>({formation:r.formation,...r.summary})),sha256:hash(Buffer.from(bytes)),scope:report.scope},null,2));
