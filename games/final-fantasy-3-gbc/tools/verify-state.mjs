import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,check,hash} from './source.mjs';import {sourceInitialState,sourceSeal,sourceValid,stateCpu,segment} from './state-source.mjs';
const {data,local}=await input(),dir=ROOT+'/build/state',negative=process.argv.includes('--negative');
const report=JSON.parse(await fs.readFile(dir+'/report.json')),rom=dir+'/ff3-state-'+(negative?'negative':'test')+'.gbc',romSha256=hash(await fs.readFile(rom));
check(romSha256===(negative?report.negativeRomSha256:report.romSha256),'State ROM identity');const coreSha256=hash(await fs.readFile(local.mesenCore));check(coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Mesen ABI identity');
const symbols={};for(const m of (await fs.readFile(dir+'/ff3-state-test.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const out=ROOT+'/evidence/state';await fs.mkdir(out,{recursive:true});
// Unique home for every run: these checks never touch real player saves.
const home=await fs.mkdtemp(ROOT+'/.local/mesen-state-'),fill=Buffer.alloc(1024,0xa5),canary=Buffer.alloc(1024,0xcc),commands=[];
const command=(list,op,slot,input,expected,result=1,offset=0)=>list.push({op,slot,offset,input:input.toString('hex'),expected:expected.toString('hex'),result});
const slots=[];
if(!negative){
 command(commands,5,0,fill,fill);
 for(let slot=1;slot<=3;slot++){
  const s=sourceInitialState(data);for(let i=0;i<1024;i++)s[i]=(s[i]+i*slot+(i>>8))&255;
  const sealed=sourceSeal(data,s,[slot*2,slot*4,41+slot,47+slot]);check(sourceValid(data,sealed,slot),'Original slot rejected');
  // Independently run original save-copy and load-copy byte loops.
  const c=stateCpu(data);c.m.fill(0xcc,0x6000,0x7000);c.m.set(sealed,0x6000);c.m[0x79f0]=(slot-1)*4;segment(c,0xa94c,0xa973);
  const saved=Buffer.from(c.m.subarray(0x6000+slot*1024,0x6400+slot*1024));check(saved.equals(sealed),'Original copy mismatch');c.m.fill(0xa5,0x6000,0x6400);c.a=0x60+slot*4;c.call(0xa9f9);check(Buffer.from(c.m.subarray(0x6000,0x6400)).equals(saved),'Original load copy mismatch');slots.push(saved);
  command(commands,1,slot,sealed,sealed);command(commands,2,slot,fill,saved);
 }
 for(const slot of [0,4,255])for(const op of [1,2])command(commands,op,slot,slots[0],slots[0],0);
 const invalid=Buffer.from(slots[0]);invalid[512]^=1;command(commands,1,1,invalid,invalid,0);command(commands,2,1,fill,slots[0]);
 // Corrupt marker/checksum/payload in every slot, require no partial active load,
 // then restore so the clean process restart must read all three originals.
 for(let slot=1;slot<=3;slot++)for(const off of [0x19,0x1a,0x3ff]){command(commands,3,slot,fill,fill,1,(slot-1)*1024+off);command(commands,2,slot,fill,fill,0);command(commands,1,slot,slots[slot-1],slots[slot-1]);}
 for(let offset=3072;offset<32768;offset+=1024)command(commands,4,0,fill,canary,1,offset);
}
async function run(phase,resume,list){const output=out+'/'+(negative?'negative':phase)+'.json',config={dll:local.mesenCore,home,mode:'state',resume,rom,romSha256,coreSha256,output,symbols,commands:list};const configPath=home+'/'+phase+'.json';await fs.writeFile(configPath,JSON.stringify(config));
 try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyState/bin/Release/net8.0/VerifyState.dll',configPath],{cwd:ROOT,timeout:900000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}
 const actual=JSON.parse(await fs.readFile(output));check(actual.romSha256===romSha256&&actual.coreSha256===coreSha256,'Observation identity');
 if(negative){check(actual.status===2&&actual.failure===1&&actual.testCase===0&&actual.index===0,'Corrupted expected byte not detected');return actual;}
 check(actual.status===1&&actual.failure===0&&actual.testCase===(resume?0:report.cases),'State comparison failed: '+JSON.stringify({...actual,observations:undefined}));check(actual.observations.length===list.length,'Missing storage observation');
 for(const [i,v]of actual.observations.entries())check(v.result===list[i].result&&v.state===list[i].expected&&!v.failure&&v.disabledRam===255,'SRAM command mismatch '+phase+' #'+i+' op='+list[i].op+' result='+v.result);
 return actual;
}
await run('first',false,commands);
if(!negative){const resume=[];for(let slot=1;slot<=3;slot++)command(resume,2,slot,fill,slots[slot-1]);for(let offset=3072;offset<32768;offset+=1024)command(resume,4,0,fill,canary,1,offset);await run('restart',true,resume);}
const result={romSha256,coreSha256,cases:negative?0:report.cases,negativeDetected:negative,storageCommands:commands.length,restartSlots:negative?0:3,untouchedSramBytes:negative?0:29696,recording:false};await fs.writeFile(out+'/'+(negative?'negative-result':'result')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
