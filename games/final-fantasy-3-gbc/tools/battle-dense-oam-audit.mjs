import {check} from './source.mjs';
// An independent interval/lifetime checker, not the runtime slot allocator.
// A record may be replaced only AFTER all eight old rows and BEFORE any new
// row. Check the physical raster's active records against every logical OBJ.
export function denseSchedule(initial,records,count){
 check(initial.length===32&&records.length>=count*6&&count<=24,'Dense schedule ABI');
 const live=Array.from({length:8},(_,i)=>Buffer.from(initial.subarray(i*4,i*4+4))),logical=live.filter(q=>q[0]).map(q=>Buffer.from(q)),events=[];let previous=8;
 const valid=q=>check(q.length===4&&q[0]>=16&&q[0]<=152&&q[1]>=8&&q[1]<=160&&q[2]!==0,'Complete retained glyph');
 for(const q of logical)valid(q);
 for(let i=0;i<count;i++){const r=records.subarray(i*6,i*6+6),line=r[0],slot=(r[1]-128)/4,q=Buffer.from(r.subarray(2));valid(q);
  check(Number.isInteger(slot)&&slot>=0&&slot<8,'Only retained OAM slots');check(line>=previous+4&&line>=12,'Separated raster deadlines');
  check(!live[slot][0]||line>=live[slot][0]-8,'Old eight rows completed');check(line<=q[0]-19,'New eight rows not started');
  events.push({line,slot,q});logical.push(q);live[slot]=q;previous=line;
 }
 const hardware=Array.from({length:8},(_,i)=>initial.subarray(i*4,i*4+4)),lines=[];let e=0;
 for(let y=0;y<144;y++){while(e<events.length&&events[e].line<y){const r=events[e++];hardware[r.slot]=r.q;}
  const active=qs=>qs.filter(q=>q[0]&&y>=q[0]-16&&y<q[0]-8).map(q=>q.toString('hex')).sort();
  check(JSON.stringify(active(hardware))===JSON.stringify(active(logical)),'Every retained row represented '+y);lines.push(active(logical).length);
 }
 return {logical:logical.length,updates:count,peak:Math.max(...lines),lines};
}
