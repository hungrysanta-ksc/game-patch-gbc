import {check} from './source.mjs';
export function checkBattleTimeline(log,report,actual){
 const entries=report.battle.timeline.entries,timing=report.battle.timeline.timing;
 const rows=[...new Set([...log.matchAll(/battle-present:([\d,]+)/g)].map(m=>m[1]))].map(line=>{const [run,entry,origin,due,committed,prepared,misses,master,rate,lcdc,ly]=line.split(',').map(Number);return {run,entry,origin,due,committed,prepared,misses,master,rate,lcdc,ly};}).sort((a,b)=>a.run-b.run||a.entry-b.entry);
 check(rows.length>=entries.length*2&&rows.length%entries.length===0,'Complete autonomous runs');
 check(actual.pages.filter(p=>p.op===5).length===rows.length/entries.length,'All completed requests observed');
 const polls=[...new Set([...log.matchAll(/battle-check:([\d,]+)/g)].map(m=>m[1]))].map(line=>{const [run,entry,due,clock,ready,master,rate]=line.split(',').map(Number);return {run,entry,due,clock,ready,master,rate};});
 const signed=n=>(n<<16)>>16,late=[],intervals=[],lead=[],commitCosts=[];let first,previous;
 for(const [i,r]of rows.entries()){
  const e=entries[i%entries.length];check(r.run===Math.floor(i/entries.length)+1&&r.entry===e.frame&&!r.misses&&r.ly>=144&&r.ly<=152&&[131,139].includes(r.lcdc),'Original entry order/VBlank/readiness');
  if(!r.entry)first=r;check(r.origin===first.origin&&((r.due-r.origin)&65535)===e.timerOffset,'Absolute original deadline');
  const error=(r.master-first.master)/r.rate-e.sourceStart*timing.sourceRateDenominator/timing.sourceRateNumerator;
  // Select the first eligible VBlank; commit itself must fit that blank.
  // Include the measured ISR work, not just a request-completion stopwatch.
  const eligible=polls.filter(p=>p.run===r.run&&p.entry===r.entry&&(!r.entry||signed(p.clock-p.due)>=0));
  check(eligible.length===1,'First eligible VBlank must publish exactly once');const p=eligible[0],cost=(r.master-p.master)/r.rate;
  check(p.due===r.due||!r.entry,'Observed scheduling deadline');check(cost>=0&&cost<=4560/4194304,'Publication fits VBlank');commitCosts.push(cost*1000);
  check(error>=-1/timing.timerHz&&error<=70224/4194304+4560/4194304+1/timing.timerHz,'Bounded CGB projection '+error);
  late.push(error*1000);
  if(r.entry){intervals.push((r.master-previous.master)*1000/r.rate);check(signed(r.committed-r.due)>=0,'No early commit');}
  if(r.entry&&report.frames[r.entry].atlas.visual!==report.frames[r.entry-1].atlas.visual){const available=signed(r.due-r.prepared);check(available>=0&&p.ready===1,'Prepared before source deadline');lead.push(available*1000/timing.timerHz);check((r.lcdc&8)!==(previous.lcdc&8),'Atomic map/page swap');}
  previous=r;
 }
 const dma=[...log.matchAll(/battle-oam:(\d+),(\d+)/g)].at(-1);check(dma&&+dma[1]>0&&!+dma[2],'OAM DMA VBlank/IME');
 for(const run of [1,2])check(actual.pictures.filter(p=>p.kind==='entry'&&p.run===run).map(p=>p.entry).join()===entries.map(e=>e.frame).join(),'Actual frame captures include aliases and clear');
 return {runs:rows.length/entries.length,entries:rows.length,sourceFramesToClear:entries.at(-1).sourceStart,readinessMisses:0,firstEligibleVBlank:true,maxCommitCostMs:Math.max(...commitCosts),maxDisplayErrorMs:Math.max(...late),minDisplayErrorMs:Math.min(...late),minPrepareLeadMs:Math.min(...lead),minEntryIntervalMs:Math.min(...intervals),maxEntryIntervalMs:Math.max(...intervals),oamDma:+dma[1],invalidOamDma:+dma[2],timingGatePassed:true,scope:'Original hit-script boundary projection onto CGB VBlank, all entries and final clear; no full battle caller or synchronous spell SFX'};
}
