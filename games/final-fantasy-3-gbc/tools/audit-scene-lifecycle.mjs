import fs from 'node:fs/promises';
import {ROOT,input,check} from './source.mjs';
import {fieldBattleBoundaryAudit} from './field-battle-boundary.mjs';
import {resourceSourceInventory,checkResourceSources,resourceReport} from './scene-resource-contract.mjs';

const {data,profile}=await input(),sources=await resourceSourceInventory();
const reviewed=JSON.parse(await fs.readFile(ROOT+'/spec/scene-resource-sources.json','utf8'));
checkResourceSources(sources,reviewed.sources);
const resources=resourceReport(sources),boundary=fieldBattleBoundaryAudit(data);
const report={sourceSha256:profile.sha256,boundary,resources};
const dir=ROOT+'/evidence/scene-lifecycle';await fs.mkdir(dir,{recursive:true});
await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:profile.sha256,boundary,resourceSources:sources.length,storageClaims:resources.profiles.map(p=>({profile:p.profile,claims:p.claims.length,conflicts:p.conflicts.length})),obsoleteReservationConflicts:resources.rejectedOldFieldReservation.length,legacyMixConflicts:resources.rejectedLegacyCompositionMix.length,roundtripReady:resources.roundtripReady,unresolved:resources.unresolved,report:dir+'/report.json'},null,2));
// Audit success means known contracts were checked, not that integration is
// finished. An integration build must explicitly require the stronger gate.
if(process.argv.includes('--require-roundtrip'))check(resources.roundtripReady,'Single-ROM roundtrip gate remains open; see unresolved boundaries');
