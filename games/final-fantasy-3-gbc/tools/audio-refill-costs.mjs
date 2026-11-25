import {check} from './source.mjs';
export function refillCosts(log,parents){
 const rows=[...new Set([...log.matchAll(/refill-cost:([-\d,]+)/g)].map(m=>m[1]))].map(s=>s.split(',').map(Number)),seen=new Set();
 const runs=parents.map((_,i)=>({run:i+1,totalMs:0,maxMs:0,phases:[]}));
 for(const [run,key,calls,total,max,entryLead,exitLead,profile,step]of rows){
  check(run>=1&&run<=runs.length&&key>=0&&key<=26&&calls>0&&max>=0&&max<=total&&profile<4&&step<256,'Refill record domain');
  check(!seen.has(run+':'+key),'Duplicate refill phase');seen.add(run+':'+key);
  const p={phase:key&15,transfer:!!(key&16),calls,totalMs:total*1000/8388608,maxMs:max*1000/8388608,entryLead,exitLead,profile,step};
  const r=runs[run-1];r.totalMs+=p.totalMs;r.maxMs=Math.max(r.maxMs,p.maxMs);r.phases.push(p);
 }
 for(const [i,r]of runs.entries())check(Math.abs(r.totalMs-parents[i].costs.audioService)<0.001,'Complete service bursts');
 return runs;
}
