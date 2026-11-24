import {check} from './source.mjs';
export function checkNumberTimeline(log,report,actual){
 const {runs,timing}=report.battle.numberTimeline;
 const parse=prefix=>[...new Set([...log.matchAll(new RegExp(prefix+':([\\d,]+)','g'))].map(m=>m[1]))].map(s=>s.split(',').map(Number));
 const rows=parse('battle-present').map(([run,entry,origin,due,committed,prepared,misses,master,rate,lcdc,ly])=>({run,entry,origin,due,committed,prepared,misses,master,rate,lcdc,ly})).sort((a,b)=>a.run-b.run||a.entry-b.entry);
 const polls=parse('battle-check').map(([run,entry,due,clock,ready,master,rate])=>({run,entry,due,clock,ready,master,rate}));
 const visible=parse('battle-visible').sort((a,b)=>a[0]-b[0]||a[1]-b[1]);check(visible.length===rows.length,'PPU frame observations');
 check(rows.length>=8*33&&rows.length%33===0&&actual.pages.filter(p=>p.op===6).length===rows.length/33,'Complete automatic numeral requests');
 const signed=n=>(n<<16)>>16,errors=[],costs=[],leads=[],intervals=[];let first,previous;
 for(const [i,r]of rows.entries()){
  check(r.run===Math.floor(i/33)+1&&r.entry===i%33&&!r.misses&&r.ly>=144&&r.ly<=152,'Numeral wait order/VBlank/readiness');
  if(!r.entry)first=r;
  const e=runs[(r.run-1)%runs.length].entries[r.entry];
  check(r.origin===first.origin&&((r.due-r.origin)&65535)===e.timerOffset&&r.lcdc===first.lcdc&&[131,139].includes(r.lcdc),'Absolute waits and pinned BG storage');
  const eligible=polls.filter(p=>p.run===r.run&&p.entry===r.entry&&(!r.entry||signed(p.clock-p.due)>=0));
  check(eligible.length===1&&eligible[0].ready===1,'First eligible VBlank has complete OAM');
  const v=visible[i],origin=visible[i-r.entry];check(v[0]===r.run&&v[1]===r.entry&&v[2]-origin[2]===r.entry,'Every original wait occupies one complete GBC frame');
  const p=eligible[0],cost=(r.master-p.master)/r.rate,error=(v[2]-origin[2])*70224/4194304-e.sourceStart*timing.sourceRateDenominator/timing.sourceRateNumerator;
  check(cost>=0&&cost<=4560/4194304,'Numeral commit within VBlank');
  check(error>=-1/timing.timerHz&&error<=70224/4194304+4560/4194304+1/timing.timerHz,'Numeral CGB clock projection '+error);
  costs.push(cost*1000);errors.push(error*1000);
  if(r.entry){check(p.due===r.due&&signed(r.committed-r.due)>=0&&signed(r.due-r.prepared)>=0,'OAM ready before source deadline');leads.push(signed(r.due-r.prepared)*1000/timing.timerHz);intervals.push((r.master-previous.master)*1000/r.rate);}
  previous=r;
 }
 let maxObjects=0,maxLine=0,samples=0;
 for(let run=1;run<=8;run++){
  const pictures=actual.pictures.filter(p=>p.kind==='entry'&&p.run===run),r=runs[(run-1)%4];
  check(pictures.length===33&&pictures.every((p,i)=>p.entry===i),'Every numeral frame, aliases and clear captured');
  for(const p of pictures){const expected=Buffer.from(r.oam.data.slice(p.entry*160,(p.entry+1)*160)),bytes=Buffer.from(p.oam,'hex');
   check(p.capturePpuFrame===p.sourcePpuFrame+1&&p.sourcePpuFrame===visible[(run-1)*33+p.entry][2],'Screenshot paired with the complete displayed PPU frame');
   for(let i=0;i<r.objects;i++)expected[i*4+2]+=((p.lcdc>>3)&1)*64;
   check(bytes.equals(expected)&&!(p.lcdc&4),'Complete actual numeral OAM '+run+'/'+p.entry);
   const lines=Array(144).fill(0);let count=0;for(let i=0;i<160;i+=4){const y=bytes[i]-16;if(y>=144||y+8<=0)continue;count++;for(let yy=Math.max(0,y);yy<Math.min(144,y+8);yy++)lines[yy]++;}
   check(count===(p.entry===32?r.objects-r.numberObjects:r.objects)&&count<=40&&Math.max(...lines)<=10,'Numeral hardware capacity without dropping glyphs');
   maxObjects=Math.max(maxObjects,count);maxLine=Math.max(maxLine,...lines);samples++;
  }
 }
 const dma=parse('battle-oam').at(-1),storage=parse('number-storage').at(-1);
 check(dma&&dma[0]>0&&!dma[1],'Numeral OAM DMA VBlank/IME');
 check(storage&&storage[0]>=rows.length/33*32&&!storage[1],'No VRAM/map/palette changes during numeral motion');
 return {runs:rows.length/33,entries:rows.length,sourceFrames:32,sourceDurationMs:32*1000*timing.sourceRateDenominator/timing.sourceRateNumerator,readinessMisses:0,firstEligibleVBlank:true,maxDisplayErrorMs:Math.max(...errors),minDisplayErrorMs:Math.min(...errors),maxCommitCostMs:Math.max(...costs),minPrepareLeadMs:Math.min(...leads),minIntervalMs:Math.min(...intervals),maxIntervalMs:Math.max(...intervals),oamSamples:samples,maxObjects,maxLine,invalidOamDma:dma[1],timedVramWrites:storage[1],timingGatePassed:true,scope:'Four finite source numeral fixtures; 32 original waits and immediate diagnostic caller clear, independent original music/SFX stress. Not full battle caller or all animations'};
}
