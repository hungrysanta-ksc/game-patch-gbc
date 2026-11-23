import {check} from './source.mjs';
import {compileComposition,sharedCompositionPalettes,compositionRgb} from './npc-composition.mjs';
import {cellJob} from './composition-kernel.mjs';
export function cacheAssets(cases){
 const groups=new Map(),jobs=[],keys=new Map(),frames=[];
 for(const r of cases){const key=r.world+':'+r.map;if(!groups.has(key))groups.set(key,{id:groups.size,rows:cases.filter(q=>q.world===r.world&&q.map===r.map)});}
 for(const g of groups.values())g.palettes=sharedCompositionPalettes(g.rows.map(r=>r.scene));
 for(const r of cases){const group=groups.get(r.world+':'+r.map),c=compileComposition(r.scene,{palettes:group.palettes}),ids=[];
  for(let cell=0;cell<360;cell++){const j=cellJob(r.scene,c,cell,c.pixels),key=j.bytes.toString('hex');let id=keys.get(key);if(id===undefined){id=jobs.length;keys.set(key,id);jobs.push({...j,static:j.layers===0});}else check(jobs[id].expected.equals(j.expected),'Cache identity collision');ids.push(id);}
  check(new Set(ids).size<=128,'Active frame cache capacity');
  frames.push({label:r.label,world:r.world,map:r.map,camera:r.camera,evidence:r.evidence,group:group.id,ids,attributes:c.attributes,palette:Buffer.concat([c.bgPalette,c.objPalette]),rgb:compositionRgb(c),stats:c.stats});
 }
 for(let i=0;i<frames.length;i++)check(new Set([...frames[i].ids,...frames[(i+1)%frames.length].ids]).size<=128,'Active/staging cache union capacity');
 return {jobs,frames,groups:[...groups.values()].map(g=>({id:g.id,palettes:g.palettes.length}))};
}
