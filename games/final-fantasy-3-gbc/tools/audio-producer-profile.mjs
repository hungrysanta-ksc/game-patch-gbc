import {check} from './source.mjs';
import fs from 'node:fs/promises';
export async function audioProducerAudit(dir,symbols,rom){
 const sites=audioProducerSites(await fs.readFile(dir+'/obj/12.lst','utf8'),symbols,rom);
 return '\nlocal audioProducerBusy='+symbols.native_busy+';local audioProducerRequest='+symbols.scene_request+'\nlocal audioProducerSites={'+sites.map(s=>'{at='+s.at+',finish='+s.end+',kind='+s.kind+'}').join(',')+'}\n'+await fs.readFile(new URL('./audio-producer-audit.lua',import.meta.url),'utf8')+await refillAudit(symbols);
}
export async function refillAudit(s){const fields={busy:s.native_busy,request:s.scene_request,phase:s.scene_phase,transfer:s.text_transfer_busy,queue:s.native_queue,head:s.native_head,tail:s.native_tail,clock:s.native_clock,profile:s.action_profile,step:s.action_step};for(const [k,v]of Object.entries(fields))check(Number.isInteger(v)&&v>=0xc000&&v<0xe000,'Refill RAM symbol '+k);return '\nlocal refillAddresses={'+Object.entries(fields).map(([k,v])=>k+'='+v).join(',')+'}\n'+await fs.readFile(new URL('./audio-refill-audit.lua',import.meta.url),'utf8');}
export const audioCostNames=['packetWork','originalVm','outputConversion','metadataAndHashes','serviceControl','snapshots'];
export function audioProducerCosts(log,parents){
 const rows=[...new Set([...log.matchAll(/audio-cost:([\d,]+)/g)].map(m=>m[1]))].map(s=>s.split(',').map(Number)),seen=new Set();
 const runs=parents.map((p,i)=>({run:i+1,totalMs:0,costs:Object.fromEntries(audioCostNames.map(k=>[k,0])),calls:Object.fromEntries(audioCostNames.map(k=>[k,0]))}));
 for(const [run,kind,cycles,rate,calls]of rows){check(run>=1&&run<=runs.length&&kind>=0&&kind<6&&rate===8388608&&cycles>=0&&calls>=0,'Audio cost domain');check(!seen.has(run+':'+kind),'Conflicting audio cost');seen.add(run+':'+kind);const r=runs[run-1],ms=cycles*1000/rate;r.totalMs+=ms;r.costs[audioCostNames[kind]]=ms;r.calls[audioCostNames[kind]]=calls;}
 for(const [i,r]of runs.entries())check(Math.abs(r.totalMs-parents[i].costs.audioService)<0.001&&r.calls.originalVm>0&&r.calls.outputConversion>0&&r.calls.metadataAndHashes>0,'Complete exclusive audio attribution');
 return runs;
}
// Pinned SDCC listing anchors map CALL/return boundaries without patching ROM.
export function audioProducerSites(listing,symbols,rom){
 let area='',rows=[];for(const line of listing.split(/\r?\n/)){
  const a=line.match(/\.area (_\w+)/);if(a)area=a[1];
  const m=line.match(/^\s+([0-9A-F]{8})\s+(.*)$/);if(m)rows.push({area,offset:parseInt(m[1],16),line:m[2]});
 }
 const anchor=name=>{const r=rows.find(r=>r.line.endsWith('_'+name+'::'));check(r,'Listing anchor '+name);return symbols[name]-r.offset;};
 const bases={_HOME:anchor('ff3_native_service'),_CODE:anchor('ff3_output')};
 const labels={};for(const r of rows){const m=r.line.match(/\s(_\w+):+$/);if(m&&bases[r.area]!==undefined)labels[m[1]]=bases[r.area]+r.offset;}
 const groups={_prepare:0,_command:1,_ff3_backend_flush:2,_ff3_backend_sweep:2,_ff3_backend_restore:2,_publish:5,_put32:3,_packet_metadata:3};
 const sites=[];for(const [i,r]of rows.entries()){
  const m=r.line.match(/\bcall\s+(_\w+)$/);if(!m)continue;let name=m[1],kind=groups[name];
  if(name==='___sdcc_bcall_ehl'&&rows.slice(Math.max(0,i-3),i).some(r=>r.line.includes('#_ff3_engine_tick')))kind=1;
  if(name==='_put16'&&rows.slice(Math.max(0,i-2),i).some(r=>/ld\s+a, #0x0[ce]$/i.test(r.line)))kind=3;
  if(kind===undefined)continue;const at=bases[r.area]+r.offset;
  check(at>0&&at+3<0x4000&&rom[at]===0xcd,'Fixed CALL opcode '+name);
  const expected=labels[name]??symbols[name.slice(1)];check(expected!==undefined&&rom.readUInt16LE(at+1)===expected,'Linked CALL target '+name);
  sites.push({at,end:at+3,kind,name});
 }
 // Exact straight-line rolling-hash spans, excluding the backend tail jump
 // and RET. Fail if pinned compiler shape changes rather than guess ranges.
 const out=rows.findIndex(r=>r.line.endsWith('_ff3_output::')),gb=rows.findIndex(r=>r.line.endsWith('_ff3_gb_write::'));
 const tail=rows.slice(out+1,gb).find(r=>/jp\s+_ff3_backend_write$/.test(r.line));
 check(tail&&rom[labels._ff3_output]===0x4f&&rom[bases._CODE+tail.offset]===0xc3,'Source hash span');
 sites.push({at:labels._ff3_output,end:bases._CODE+tail.offset,kind:3,name:'source_hash'});
 const h=rows.slice(gb+1).findIndex(r=>/ld\s+hl, #_native_gb_hash \+ 1$/.test(r.line));check(h>=0,'Output hash start');
 const first=rows[gb+1+h],ret=rows.slice(gb+2+h).find(r=>/\bret$/.test(r.line));
 check(ret&&rom[bases._CODE+first.offset]===0x21&&rom[bases._CODE+ret.offset]===0xc9,'Output hash span');
 sites.push({at:bases._CODE+first.offset,end:bases._CODE+ret.offset,kind:3,name:'gb_hash'});
 for(const kind of [0,1,2,3,5])check(sites.some(s=>s.kind===kind),'Missing producer category '+kind);
 check(sites.filter(s=>s.name==='___sdcc_bcall_ehl').length===1,'Exactly one original engine tick call');
 return sites;
}
