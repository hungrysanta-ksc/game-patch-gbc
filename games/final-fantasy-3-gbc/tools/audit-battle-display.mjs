import fs from 'node:fs/promises';
import {ROOT,input,hash} from './source.mjs';
import {battleDisplayAudit} from './battle-display-source.mjs';
const {data,profile}=await input(),out=ROOT+'/evidence/battle-display';await fs.mkdir(out,{recursive:true});
const report={sourceSha256:profile.sha256,...battleDisplayAudit(data)},bytes=JSON.stringify(report,null,2)+'\n';
await fs.writeFile(out+'/audit.json',bytes);console.log(JSON.stringify({boss:report.boss,magic:report.magic.summary,colors:report.colors.summary,sha256:hash(Buffer.from(bytes)),scope:report.scope},null,2));
