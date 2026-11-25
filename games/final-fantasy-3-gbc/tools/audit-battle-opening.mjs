import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {ROOT,input,hash} from './source.mjs';import {fullOpeningReference,openingReference} from './battle-opening-source.mjs';
const {data,profile}=await input(),rows=[];
for(const hp of [1,500])for(const back of [false,true]){const r=fullOpeningReference(data,{hp,back});assert.deepEqual(r.trace,openingReference(data,r.state));rows.push({hp,back,events:r.trace.map(e=>({kind:e.kind,value:e.value,stateSha256:hash(e.state)})),boundaries:r.boundaries,sounds:r.sounds,scope:r.scope});}
const out=ROOT+'/evidence/battle-opening';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/original-presentation.json',JSON.stringify({sourceSha256:profile.sha256,rows},null,2));console.log(JSON.stringify(rows.map(r=>({hp:r.hp,back:r.back,events:r.events.length,boundaries:r.boundaries.length,sounds:r.sounds}))));
