import {Driver6502} from './driver6502.mjs';
import {check} from './source.mjs';

export const routines=[0x81c3,0x8c29,0x8bb8,0x8030,0x80ab,0x8ac0,0x8b9d,0x8003];
const snapshot=c=>Buffer.from(c.m.subarray(0x7f40,0x8000));
const apu=c=>Buffer.from(c.m.subarray(0x4000,0x4018));
function clone(data,source){const c=new Driver6502(data);c.m.set(source.m);c.banks=[...source.banks];return c;}

/* Record unported callees as explicit input/output boundaries. C must agree
 * before every callback; replaying its result must not mask a caller error. */
export function controlCase(data,source,op,label){
 const c=clone(data,source),before=snapshot(c),beforeApu=apu(c),callbacks=[];
 const step=c.step.bind(c);let inside=false;
 c.step=function(){
  const kind=new Map([[0x81e6,0],[0x857d,1],[0x8925,2]]).get(c.pc);
  if(kind===undefined||inside){step();return;}
  const entry=c.pc,input=snapshot(c),inputApu=apu(c),args=kind===2?[0,0,0]:[c.m[0xd0],c.m[0xd1],c.m[0xd2]],first=c.writes.length;
  inside=true;c.call(entry);inside=false;
  callbacks.push({kind,args,input,inputApu,output:snapshot(c),writes:c.writes.slice(first)});
  c.pc=((c.pop()|(c.pop()<<8))+1)&65535;
 };
 c.writes=[];c.call(routines[op]);
 const plain=clone(data,source);plain.writes=[];plain.call(routines[op]);
 check(snapshot(c).equals(snapshot(plain))&&apu(c).equals(apu(plain))&&JSON.stringify(c.writes)===JSON.stringify(plain.writes),'Callback instrumentation changed source behavior: '+label);
 const writes=w=>{check(w.length<128,'Fixture write log capacity');return Buffer.from([w.length,...w.flatMap(([r,v])=>[r-0x4000,v])]);};
 const bytes=Buffer.concat([Buffer.from([op]),before,beforeApu,Buffer.from([callbacks.length]),
  ...callbacks.flatMap(b=>[Buffer.from([b.kind,...b.args]),b.input,b.inputApu,b.output,writes(b.writes)]),
  snapshot(c),apu(c),writes(c.writes)]);
 return {bytes,label,op,callbacks:callbacks.length,writes:c.writes.length};
}

export function makeControlFixtures(data){
 const cases=[],counts={};
 const add=(c,op,label)=>{const f=controlCase(data,c,op,label);cases.push(f);counts[op]=(counts[op]||0)+1;};
 const base=new Driver6502(data);base.call(0x8000);base.m[0x7f43]=0x20;base.m[0x7f42]=1;
 for(let i=0;i<120;i++)base.call(0x8003);
 // Actual data contexts: every song and every effect slot, not selected names.
 for(let song=0;song<65;song++){
  const c=new Driver6502(data);c.call(0x8000);c.m[0x7f43]=song;c.m[0x7f42]=1;
  add(c,7,`song-${song}-request`);
  for(let tick=0;tick<121;tick++){
   c.call(0x8003);
   if([0,30,120].includes(tick)){add(c,4,`song-${song}-flush-${tick}`);add(c,5,`song-${song}-silence-${tick}`);}
  }
 }
 for(let id=0;id<97;id++){
  const c=clone(data,base);c.m[0x7f49]=0x80|id;
  add(c,2,`effect-${id}-init`);add(c,7,`effect-${id}-request`);
  for(let tick=0;tick<301;tick++){
   c.call(0x8003);
   if([0,1,10,60,300].includes(tick))add(c,7,`effect-${id}-tick-${tick}`);
   if(tick===10){
    add(c,1,`effect-${id}-release`);add(c,3,`effect-${id}-flush`);
    const stop=clone(data,c);stop.m[0x7f49]=255;add(stop,7,`effect-${id}-stop`);
    const replace=clone(data,c);replace.m[0x7f49]=0x80|((id+1)%97);add(replace,7,`effect-${id}-replace`);
    const repeat=clone(data,c);repeat.m[0x7f49]=0x80|id;add(repeat,7,`effect-${id}-restart`);
    const special=clone(data,c);special.m[0x7f43]=0x37;special.m[0x7f49]=255;add(special,7,`effect-${id}-song37`);
   }
  }
 }
 // Synthetic RAM exercises flag combinations and preservation of unrelated
 // bytes. These are boundary tests, not claims that the game reaches them.
 let rng=0x31415926;const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return rng&255;};
 for(let n=0;n<128;n++){
  const c=clone(data,base);for(let i=0x7f40;i<0x8000;i++)c.m[i]=random();
  for(let i=0x4000;i<0x4018;i++)c.m[i]=random();
  for(const op of [0,1,3,4,5])add(c,op,`flags-${n}-op-${op}`);
 }
 // Explicit dispatch branches, without requiring unsafe script pointers.
 for(const request of [0,255,0x80,0xe0]){const c=clone(data,base);c.m[0x7f49]=request;add(c,6,`dispatch-${request}`);}
 return {cases,counts,data:Buffer.concat(cases.map(c=>c.bytes))};
}
