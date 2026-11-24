import fs from 'node:fs/promises';
import {ROOT,input} from './source.mjs';
import {sceneComposition} from './battle-scene-pixels.mjs';
const {data,profile}=await input(),profiles=[];
for(const back of [false,true])for(const stress of [false,true]){
 const s=sceneComposition(data,{back,numbers:true,...(stress?{enemyValues:Array(8).fill(1234)}:{})});
 profiles.push({back,stress,source:s.source,summary:s.summary,failures:s.failures,runs:s.numberRuns,frames:s.frames.map(f=>({index:f.index,phase:f.phase,numberFrame:f.numberFrame,stats:f.composition.stats}))});
}
const result={sourceSha256:profile.sha256,scope:'Original AD2B display-boundary probes with separate numeral OBJ and exact BG/residual composition. Forced values, no damage calculation, original-time playback or normal-play reachability.',allEnemyFixtureFits:profiles.filter(p=>p.stress).every(p=>!p.summary.failed),wholeSceneGatePassed:false,normalGameplay:false,profiles};
await fs.mkdir(ROOT+'/evidence/battle-numbers',{recursive:true});await fs.writeFile(ROOT+'/evidence/battle-numbers/audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(profiles.map(p=>({back:p.back,stress:p.stress,...p.summary})),null,2));
