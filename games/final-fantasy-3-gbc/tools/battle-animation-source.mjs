import {battleCpu} from './battle-placement-source.mjs';import {offset} from './render-budget-source.mjs';import {check,hash} from './source.mjs';
export const animationSize=109,animationProjection=[...Array(101).keys(),102,103,104,107,108];
const fields=[[0,0x7ec2,1],[1,0x7ec3,1],[2,0x7e9a,1],[3,0x7e88,1],[4,0x7e9d,1],[5,0x7e93,1],[6,0x78d4,1],[7,0x7ee1,1],[8,0x7e94,1],[9,0x7d7b,1],[10,0x7e98,2],[12,0x7e9b,1],[13,0xbb,2],[15,0xcc,1],[16,0x7d9b,8],[24,0x78bb,8],[32,0x7ec4,8],[40,0x7da7,8],[48,0x7e4f,32],[80,0x7e26,8],[88,0x7e97,1],[89,0x7e6f,1],[90,0x52,1],[91,0xb8,1],[93,0x7e8f,2],[95,0x7e89,1],[96,0xca,2],[98,0x7e91,2],[100,0x7e96,1]];
export function animationAssets(rom){const read=(bank,at,n)=>Buffer.from(rom.subarray(offset(bank,at),offset(bank,at)+n)),search=read(0x3f,0xfd24,256),tables={actions:read(0x34,0x83f8,25),sounds:read(0x34,0x83a0,88),rows:read(0x34,0x8739,20)},ids=Array.from({length:256},(_,v)=>{const i=search.indexOf(v);return i<0?0:i;});
 return {tables,ids,header:'#include <stdint.h>\n'+Object.entries(tables).map(([k,b])=>'static const uint8_t ff3_anim_'+k+'[]={'+[...b]+'};').join('\n')+'\nstatic const uint8_t ff3_anim_ids[]={'+ids+'};\n',source:{dispatch:'34/8411..8738',actions:'34/83F8 (25)',sounds:'34/83A0 (88)',rows:'34/8739 (10 x 2)',maskLookup:'3F/FD24 + 8-bit index; not assumed to accept only one-hot masks',sha256:hash(Buffer.concat([...Object.values(tables),search]))}};
}
export function animationSeed(effect=4,o={}){const s=Buffer.alloc(animationSize);s[0]=effect;s[2]=64;s[7]=255;s[10]=128;s[11]=s[12]=128;s[13]=1;s.fill(255,40,48);s[40]=0;s.fill(255,48,80);s[102]=255;
 for(const [key,at]of Object.entries({summon:1,flags:2,spell:3,magic:4,overload:5,escape:6,split:7,summonAttack:8,layout:9,attacker:10,targets:11,hit:12,hits:13,item:15,previous:16,status:24,dead:32,types:40,numbers:48,rows:80}))if(o[key]!==undefined){if(Array.isArray(o[key])||Buffer.isBuffer(o[key]))s.set(o[key],at);else s[at]=o[key];}return s;
}
export function animationReference(rom,seed){const c=battleCpu(rom,0x1a);for(const [i,a,n]of fields)c.m.set(seed.subarray(i,i+n),a);let ticket=0,mask=seed[92];const trace=[];
 const snapshot=(request,done=0)=>{const s=Buffer.from(seed);for(const [i,a,n]of fields)s.set(c.m.subarray(a,a+n),i);if([10,11,12,13,35].includes(request))mask=c.m[0x7e];s[92]=mask;s[102]=request;s[103]=done;s.writeUInt16LE(ticket,107);trace.push(s);};
 const step=c.step.bind(c);c.step=function(){if(this.pc===0xfa0e){ticket++;snapshot(this.a);this.pc=((this.pop()|(this.pop()<<8))+1)&65535;return;}step();};c.call(0x8411);snapshot(255,1);return trace;
}
export function animationCases(rom){const out=[];for(let effect=0;effect<25;effect++)for(const flags of [0,64,128,192])out.push(animationSeed(effect,{flags}));
 for(const flags of [0,64,128,192])for(let actor=0;actor<((flags&128)?8:4);actor++)for(let target=0;target<((flags&64)?8:4);target++)out.push(animationSeed(4,{flags,attacker:128>>actor,targets:128>>target,hits:[2,3]}));
 for(const flags of [0,64,128,192])for(const magic of [0,5,6,7,8,9,13])for(const targets of [128,255])out.push(animationSeed(19,{flags,magic,targets,hit:128,spell:magic+1}));
 for(let layout=0;layout<10;layout++)for(const summonAttack of [0,17,34,112])out.push(animationSeed(19,{summon:1,layout,summonAttack,targets:255,types:[0,1,255,2,3,255,0,1]}));
 for(const flags of [0,128])for(const escape of [0,160])out.push(animationSeed(6,{flags,escape}));
 for(const flags of [0,128])for(const status of [Array(8).fill(0),[128,0,0,0,0,0,0,0]])for(const dead of [Array(8).fill(0),[128,0,0,0,0,0,0,0]])out.push(animationSeed(22,{flags,status,dead,types:[0,1,2,3,0,1,2,3]}));
 for(const flags of [0,64,128,192])for(const split of [255,128,160])out.push(animationSeed(23,{flags,split,numbers:Array.from({length:32},(_,i)=>i*7)}));
 const {ids}=animationAssets(rom);check(ids[255]===0,'Original lookup wraps to Y=0 for all-target mask');return out;
}
export function animationFixtures(rom){const rows=animationCases(rom),chunks=[];let events=0;for(const seed of rows){const trace=animationReference(rom,seed),n=Buffer.alloc(2);n.writeUInt16LE(trace.length);chunks.push(seed,n,...trace.map(s=>Buffer.from(animationProjection.map(i=>s[i]))));events+=trace.length;}return {bytes:Buffer.concat(chunks),cases:rows.length,events,negativeOffset:111};}
