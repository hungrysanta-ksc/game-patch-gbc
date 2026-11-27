import {check} from './source.mjs';
import {battleCpu} from './battle-placement-source.mjs';
import {physicalRng} from './battle-physical-source.mjs';
import {segment} from './state-source.mjs';
import {originalFightCases,sourceFight} from './battle-fight-source.mjs';
export const RESULT_BYTES=828;
export const R={actorStatus:768,targetStatus:784,dead:800,types:808,result:816,escape:817,first:818,flags:819,actor:820,target:821,remaining:822,near:823,script:824,name:825,message:826,targetName:827};
export function resultSeed(){const s=Buffer.alloc(RESULT_BYTES);for(let i=0;i<12;i++){const p=i*64;s[p]=12;s.writeUInt16LE(90,p+3);s.writeUInt16LE(100,p+5);s[p+42]=25;s[p+44]=i<4?i:128+i-4;}s.fill(255,R.types,R.types+8);s[R.types]=0;s[R.remaining]=1;s[R.target]=128;s[48]=128;s[R.message]=255;return s;}
export function validResult(s,op){return s.length===RESULT_BYTES&&op>=0&&op<=4&&(op===1||op===4||(op===0&&(s[R.result]&2))||s[R.actor]<12)&&!(op===3&&s[R.actor]>=4)&&!(op===2&&s[R.actor]<4&&s.subarray(R.types,R.types+8).every(v=>v===255));}
// Executes the ROM's status helpers and near-fatal consumer. The renderer
// boundary is outside this oracle: these bytes do not prove a death animation.
export function sourceResult(rom,state,op,counters=[17,0,239],table=physicalRng(rom)){
 const s=Buffer.from(state);if(!validResult(s,op))return{ok:0,state:s,counters:Buffer.from(counters)};
 const c=battleCpu(rom,0x1a),actor=s[R.actor],a=0x7575+actor*64;
 if(op===2||op===3||(op===0&&!(s[R.result]&2)))check(s[actor*64+44]===(actor<4?actor:128+actor-4)&&s[actor*64+48]===s[R.target],'Source caller record flags');
 c.m.set(s.subarray(0,768),0x7575);c.m.set([0x75,0x75],0x5b);c.m.set([a&255,a>>8],0x6e);
 c.m.set(s.subarray(R.actorStatus,R.actorStatus+16),0xf0);c.m.set(s.subarray(R.targetStatus,R.targetStatus+16),0xe0);
 c.m.set(s.subarray(R.dead,R.dead+8),0x7ec4);c.m.set(s.subarray(R.types,R.types+8),0x7da7);
 for(const [k,addr]of Object.entries({result:0x78d3,escape:0x78d4,first:0x78ba,flags:0x7ed8,remaining:0x7dd2,near:0x7cec,script:0x78d5,name:0x78d7,message:0x78da,targetName:0x78d8}))c.m[addr]=s[R[k]];
 c.m.set(table,0x7be3);c.m.set(counters,0x15);
 if(op===0){if(!(s[R.result]&2))segment(c,0x9369,0x93b6);}
 else if(op===1){c.m.set([0xe0,0],0x18);c.call(0x9408);}
 else c.call(op===2?0xa8bf:op===3?0xa93b:0xa458);
 s.set(c.m.subarray(0x7575,0x7875));s.set(c.m.subarray(0xf0,0x100),R.actorStatus);s.set(c.m.subarray(0xe0,0xf0),R.targetStatus);s.set(c.m.subarray(0x7ec4,0x7ecc),R.dead);
 for(const [k,addr]of Object.entries({result:0x78d3,escape:0x78d4,near:0x7cec,script:0x78d5,name:0x78d7,message:0x78da,targetName:0x78d8}))s[R[k]]=c.m[addr];
 return{ok:1,state:s,counters:Buffer.from(c.m.subarray(0x15,0x18))};
}
export function resultCases(){
 const cases=[],add=(tag,s,op,counter=0)=>cases.push({tag,state:s,op,counters:[17,counter,239]}),actor=(s,i,t=128)=>{s[R.actor]=i;s[R.target]=t;s[i*64+48]=t;};
 for(const a of [0,3,4,11])for(const t of [0,128])for(let v=0;v<256;v++){
  const s=resultSeed();actor(s,a,t);s[R.actorStatus+(a%4)*2]=v;s[R.actorStatus+(a%4)*2+1]=v^0xa5;s[R.targetStatus]=v^0x5a;s[R.targetStatus+1]=v;s[1]=3;s[257]=0x17;s[R.near]=0x55;add('status-order',s,0);
 }
 for(let v=0;v<256;v++){const s=resultSeed();s[R.targetStatus+14]=v;s[R.targetStatus+15]=v^0xaa;s[11*64+1]=7;add('cannon-status',s,1);}
 for(const hp of [0,24,25,26,65535])for(const max of [0,99,100,65535])for(const st of [0,1,64,128,129]){const s=resultSeed();s.writeUInt16LE(hp,3);s.writeUInt16LE(max,5);s[1]=st;s[R.near]=255;add('near-fatal',s,0);}
 for(let pattern=0;pattern<256;pattern++)for(const remaining of [0,1])for(const result of [0,2,64,128]){const s=resultSeed();for(let i=0;i<4;i++)s[i*64+1]=((pattern>>(i*2))&3)*64;s[R.remaining]=remaining;s[R.result]=result;add('outcome',s,4);}
 for(const a of [0,3,4,11])for(const chance of [0,1,25,75,99,100,101,230,231,255])for(const first of [0,1])for(const flags of [0,1])for(const counter of [0,73,255]){
  const s=resultSeed();actor(s,a);s[a*64+42]=s[a*64+34]=chance;s[R.first]=first;s[R.flags]=flags;s[R.types+7]=1;s[11*64]=240;add('run',s,2,counter);
 }
 for(const op of [2,3])for(const confusion of [0,1,2,4,8,15])for(const flags of [0,1]){const s=resultSeed();s[R.first]=1;s[R.flags]=flags;for(let i=0;i<4;i++)if(confusion&(1<<i))s[i*64+2]=32;add('confusion-all-slots',s,op);}
 for(const op of [0,2,3]){const s=resultSeed();s[R.actor]=12;add('invalid',s,op);}let s=resultSeed();s.fill(255,R.types,R.types+8);add('invalid',s,2);s=resultSeed();actor(s,4);add('invalid',s,3);
 s=resultSeed();s[R.actor]=255;s[R.targetStatus]=128;add('cannon-status',s,1);
 return cases;
}
export function resultFixtures(rom){const table=physicalRng(rom),rows=resultCases(),counts={},chunks=[];for(const c of rows){const r=sourceResult(rom,c.state,c.op,c.counters,table);chunks.push(Buffer.from([c.op]),c.state,Buffer.from(c.counters),Buffer.from([r.ok]),r.state,r.counters);counts[c.tag]=(counts[c.tag]||0)+1;}
 const fights=originalFightCases(rom);
 for(const c of fights){
  const f=Buffer.from(c.state),s=resultSeed(),a=(f[44]&128)?4+(f[44]&7):(f[44]&7),t=(f[108]&128)?4+(f[108]&7):(f[108]&7);
  f[48]=f[108]&128;s.set(f.subarray(0,64),a*64);s.set(f.subarray(64,128),t*64);s[R.actor]=a;s[R.target]=f[48];
  const r=sourceFight(rom,f,c.counters,table),after=Buffer.from(s);check(r.ok,'Resolved original property fight');
  after.set(r.state.subarray(0,64),a*64);after.set(r.state.subarray(64,128),t*64);after.fill(0,R.actorStatus,R.dead);after.set(r.state.subarray(161,163),R.actorStatus+(f[44]&7)*2);after.set(r.state.subarray(163,165),R.targetStatus+(f[108]&7)*2);
  chunks.push(Buffer.from([5]),s,Buffer.from(c.counters),f,Buffer.from([1]),after,r.counters,r.state);
 }
 counts['original-fight-handoff']=fights.length;
 return{table,bytes:Buffer.concat(chunks),cases:rows.length+fights.length,counts,recordBytes:'1664; resolved-fight records add 350 bytes',negativeOffset:RESULT_BYTES+5};}
